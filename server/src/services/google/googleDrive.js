const { google } = require('googleapis');
const { Readable } = require('stream');
const { getServiceAccountClient } = require('./googleAuth');

const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive'];
const ROOT_FOLDER_NAME = process.env.DRIVE_ROOT_FOLDER_NAME || 'CPIPL HR Files';

/**
 * Translate Google API errors into user-friendly messages.
 */
function friendlyDriveError(err) {
  const msg = err.message || '';
  const code = err.response?.data?.error?.code || err.code;

  if (msg.includes('API has not been used') || msg.includes('SERVICE_DISABLED')) {
    return 'Google Drive API is not enabled. Ask your admin to enable it at console.cloud.google.com.';
  }
  if (code === 401 || msg.includes('invalid_grant') || msg.includes('UNAUTHENTICATED')) {
    return 'Google Drive authentication failed. Check the service account key.';
  }
  if (code === 403 || msg.includes('insufficientPermissions')) {
    return 'Google Drive permission denied. The service account may not have access.';
  }
  if (code === 404) {
    return 'Google Drive folder or file not found.';
  }
  if (msg.includes('ENOTFOUND') || msg.includes('ETIMEDOUT')) {
    return 'Cannot connect to Google Drive. Check your internet connection.';
  }
  return `Google Drive error: ${msg.slice(0, 150)}`;
}

/**
 * Get an authenticated Google Drive v3 client using service account.
 * SA acts as itself (no domain impersonation for Drive).
 */
async function getDriveClient() {
  try {
    const auth = await getServiceAccountClient(null, DRIVE_SCOPES);
    return google.drive({ version: 'v3', auth });
  } catch (err) {
    throw new Error(friendlyDriveError(err));
  }
}

/**
 * Find or create the root HR folder in the SA's Drive.
 * @returns {string} folderId
 */
async function getOrCreateRootFolder(drive) {
  try {
    // Search for existing folder
    const res = await drive.files.list({
      q: `name='${ROOT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (res.data.files && res.data.files.length > 0) {
      return res.data.files[0].id;
    }

    // Create it
    const folder = await drive.files.create({
      requestBody: {
        name: ROOT_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id',
    });

    return folder.data.id;
  } catch (err) {
    throw new Error(friendlyDriveError(err));
  }
}

/**
 * Find or create a per-employee subfolder under the root folder.
 * Folder name: "{employeeName} ({employeeId})" or "{employeeName}" if no empId.
 * @returns {string} folderId
 */
async function getOrCreateEmployeeFolder(drive, rootFolderId, employeeName, employeeId) {
  const folderName = employeeId
    ? `${employeeName} (${employeeId})`
    : employeeName;

  // Search for existing folder
  const res = await drive.files.list({
    q: `name='${folderName.replace(/'/g, "\\'")}' and '${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id;
  }

  // Create it
  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [rootFolderId],
    },
    fields: 'id',
  });

  return folder.data.id;
}

/**
 * Upload a file buffer to a Drive folder.
 * Sets anyoneWithLink = reader for inline preview via hyperlinks.
 * @returns {{ fileId: string, webViewLink: string, webContentLink: string, thumbnailLink: string }}
 */
async function uploadFile(drive, folderId, fileName, mimeType, buffer) {
  try {
    const fileMetadata = {
      name: fileName,
      parents: [folderId],
    };

    const media = {
      mimeType,
      body: Readable.from(buffer),
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: 'id, name, mimeType, size, webViewLink, webContentLink, thumbnailLink',
    });

    // Make file publicly readable via link
    await drive.permissions.create({
      fileId: file.data.id,
      requestBody: { role: 'reader', type: 'anyone' },
    });

    return {
      fileId: file.data.id,
      webViewLink: file.data.webViewLink,
      webContentLink: file.data.webContentLink,
      thumbnailLink: file.data.thumbnailLink,
    };
  } catch (err) {
    throw new Error(friendlyDriveError(err));
  }
}

/**
 * Delete a file from Google Drive.
 */
async function deleteFile(drive, driveFileId) {
  await drive.files.delete({ fileId: driveFileId });
}

/**
 * List all files in a Drive folder.
 * @returns {Array<{ id, name, mimeType, size, webViewLink, thumbnailLink }>}
 */
async function listFiles(drive, folderId) {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id, name, mimeType, size, webViewLink, thumbnailLink, createdTime)',
    orderBy: 'createdTime desc',
    pageSize: 100,
  });

  return res.data.files || [];
}

/**
 * Get file metadata from Google Drive.
 */
async function getFileMetadata(drive, driveFileId) {
  const res = await drive.files.get({
    fileId: driveFileId,
    fields: 'id, name, mimeType, size, webViewLink, webContentLink, thumbnailLink, createdTime',
  });
  return res.data;
}

/**
 * Ensure an employee has a Drive folder. Creates root + employee folder if needed.
 * Updates user.driveFolderId in DB if not already set.
 * @returns {string} employee folderId
 */
async function ensureEmployeeFolder(drive, user, prisma) {
  if (user.driveFolderId) return user.driveFolderId;

  const rootId = await getOrCreateRootFolder(drive);
  const folderId = await getOrCreateEmployeeFolder(drive, rootId, user.name, user.employeeId);

  // Save folder ID on user record
  await prisma.user.update({
    where: { id: user.id },
    data: { driveFolderId: folderId },
  });

  return folderId;
}

/**
 * Convert a Drive file ID to a direct image URL that works in <img> tags.
 * Uses Google's lh3 CDN which serves images directly for publicly shared files.
 */
function getDirectImageUrl(fileId) {
  return `https://lh3.googleusercontent.com/d/${fileId}`;
}

module.exports = {
  getDriveClient,
  getOrCreateRootFolder,
  getOrCreateEmployeeFolder,
  uploadFile,
  deleteFile,
  listFiles,
  getFileMetadata,
  ensureEmployeeFolder,
  getDirectImageUrl,
};
