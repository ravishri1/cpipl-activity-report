/**
 * Upload policy PDFs to Google Drive using admin OAuth token
 */
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { google } = require('googleapis');

const p = new PrismaClient();

const DOWNLOADS = 'C:\\Users\\91992\\Downloads';
const ROOT_FOLDER_NAME = process.env.DRIVE_ROOT_FOLDER_NAME || 'CPIPL HR Files';

// Map: policy slug → PDF filename in Downloads
const PDF_MAP = [
  { slug: 'employee-attendance-leave-policy',               file: 'Employee Attendance Policy.pdf' },
  { slug: 'performance-improvement-plan-pip-policy',        file: 'PIP Policy.pdf' },
  { slug: 'anti-discrimination-policy',                     file: 'Anti-discrimination Policy.pdf' },
  { slug: 'referral-policy',                                file: 'Referral Policy.pdf' },
  { slug: 'work-from-home-policy',                          file: 'Work From Home Policy.pdf' },
  { slug: 'personal-purchases-on-company-address-policy',   file: 'Personal Purchases on Company Address Policy.pdf' },
  { slug: 'weekly-off-saturday-weekend-work-policy',        file: '08.Weekly Off (Saturday) & Weekend Work Policy.pdf' },
];

async function getOAuthDriveClient() {
  const token = await p.googleToken.findFirst({ where: { userId: 1 } });
  if (!token) throw new Error('No OAuth token for admin user (id=1). Connect Google account first.');

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
  oauth2.setCredentials({
    access_token:  token.accessToken,
    refresh_token: token.refreshToken,
    expiry_date:   token.expiresAt ? new Date(token.expiresAt).getTime() : undefined,
  });

  // Auto-refresh listener — save new token to DB
  oauth2.on('tokens', async (tokens) => {
    const update = {};
    if (tokens.access_token) update.accessToken = tokens.access_token;
    if (tokens.refresh_token) update.refreshToken = tokens.refresh_token;
    if (tokens.expiry_date) update.expiresAt = new Date(tokens.expiry_date).toISOString();
    if (Object.keys(update).length) {
      await p.googleToken.update({ where: { userId: 1 }, data: update });
      console.log('  ↻ Token refreshed');
    }
  });

  return google.drive({ version: 'v3', auth: oauth2 });
}

async function getOrCreatePoliciesFolder(drive) {
  // Find root folder
  const rootRes = await drive.files.list({
    q: `name='${ROOT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
  });
  let rootId;
  if (rootRes.data.files.length > 0) {
    rootId = rootRes.data.files[0].id;
  } else {
    const folder = await drive.files.create({
      requestBody: { name: ROOT_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' },
      fields: 'id',
    });
    rootId = folder.data.id;
  }

  // Find/create "Company Policies" subfolder
  const polRes = await drive.files.list({
    q: `name='Company Policies' and '${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
  });
  if (polRes.data.files.length > 0) return polRes.data.files[0].id;

  const folder = await drive.files.create({
    requestBody: { name: 'Company Policies', mimeType: 'application/vnd.google-apps.folder', parents: [rootId] },
    fields: 'id',
  });
  return folder.data.id;
}

async function uploadPDF(drive, folderId, fileName, buffer) {
  const { Readable } = require('stream');
  const res = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType: 'application/pdf', body: Readable.from(buffer) },
    fields: 'id,webViewLink,webContentLink',
  });

  // Make publicly viewable
  await drive.permissions.create({
    fileId: res.data.id,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  return { fileId: res.data.id, webViewLink: res.data.webViewLink };
}

async function main() {
  console.log('Setting up Google Drive (OAuth)...');
  const drive = await getOAuthDriveClient();
  const folderId = await getOrCreatePoliciesFolder(drive);
  console.log(`Folder ready: ${folderId}\n`);

  let ok = 0, failed = 0;

  for (const entry of PDF_MAP) {
    const filePath = path.join(DOWNLOADS, entry.file);

    if (!fs.existsSync(filePath)) {
      console.log(`❌ FILE NOT FOUND: ${entry.file}`);
      failed++;
      continue;
    }

    const policy = await p.policy.findUnique({ where: { slug: entry.slug } });
    if (!policy) {
      console.log(`❌ POLICY NOT IN DB: ${entry.slug}`);
      failed++;
      continue;
    }

    try {
      const buffer = fs.readFileSync(filePath);
      const sizeMB  = (buffer.length / 1024 / 1024).toFixed(2);
      process.stdout.write(`Uploading: ${entry.file} (${sizeMB} MB)...`);

      const uploaded = await uploadPDF(drive, folderId, entry.file, buffer);

      await p.policy.update({
        where: { id: policy.id },
        data: {
          fileUrl:     uploaded.webViewLink,
          fileName:    entry.file,
          driveFileId: uploaded.fileId,
        },
      });

      console.log(` ✅`);
      console.log(`   ${uploaded.webViewLink}`);
      ok++;
    } catch (err) {
      console.log(` ❌`);
      console.log(`   ${err.message}`);
      failed++;
    }
  }

  console.log(`\n──────────────────────────────`);
  console.log(`Uploaded: ${ok}  Failed: ${failed}`);
}

main().catch(console.error).finally(() => p.$disconnect());
