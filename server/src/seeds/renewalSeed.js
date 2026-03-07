/**
 * Renewal Seed Script
 * Seeds renewal categories and company-specific subscriptions/renewals.
 * Run once: node server/src/seeds/renewalSeed.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ─── Categories ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { name: 'Software & Cloud',         icon: '☁️',  sortOrder: 1 },
  { name: 'AI Tools',                 icon: '🤖', sortOrder: 2 },
  { name: 'Internet & Connectivity',  icon: '🌐', sortOrder: 3 },
  { name: 'Finance & Credit',         icon: '💳', sortOrder: 4 },
  { name: 'Compliance & Legal',       icon: '📜', sortOrder: 5 },
  { name: 'Facility & Utilities',     icon: '🏢', sortOrder: 6 },
  { name: 'Communication',            icon: '📧', sortOrder: 7 },
  { name: 'Security & Infrastructure',icon: '🔒', sortOrder: 8 },
  { name: 'Miscellaneous',            icon: '📦', sortOrder: 9 },
];

// ─── Renewals ─────────────────────────────────────────────────────────────────
// renewalDate = next due date (YYYY-MM-DD). Use approximate dates.

function buildRenewals(catMap) {
  return [
    // ── Software & Cloud ──────────────────────────────────────────────────────
    {
      itemName:     'RDP (Remote Desktop)',
      vendorName:   'Microsoft / RDP Provider',
      categoryId:   catMap['Software & Cloud'],
      billingCycle: 'yearly',
      renewalDate:  '2026-06-01',
      currency:     'INR',
      status:       'active',
      notes:        'Remote desktop access for office systems',
    },
    {
      itemName:     'Web Hosting',
      vendorName:   'Hosting Provider',
      categoryId:   catMap['Software & Cloud'],
      billingCycle: 'yearly',
      renewalDate:  '2026-09-01',
      currency:     'INR',
      status:       'active',
      notes:        'Company website hosting',
    },
    {
      itemName:     'Amazon AWS',
      vendorName:   'Amazon Web Services',
      categoryId:   catMap['Software & Cloud'],
      billingCycle: 'monthly',
      renewalDate:  '2026-04-01',
      currency:     'USD',
      status:       'active',
      notes:        'Cloud infrastructure — check monthly bill',
    },
    {
      itemName:     'Domain Registration',
      vendorName:   'Domain Registrar',
      categoryId:   catMap['Software & Cloud'],
      billingCycle: 'yearly',
      renewalDate:  '2026-12-01',
      currency:     'INR',
      status:       'active',
      notes:        'Company domain names renewal',
    },
    {
      itemName:     'Google Workspace (G Suite)',
      vendorName:   'Google LLC',
      categoryId:   catMap['Software & Cloud'],
      billingCycle: 'yearly',
      renewalDate:  '2026-07-01',
      currency:     'INR',
      status:       'active',
      notes:        'Google Workspace licenses for team',
    },
    {
      itemName:     'Tally Software',
      vendorName:   'Tally Solutions',
      categoryId:   catMap['Software & Cloud'],
      billingCycle: 'yearly',
      renewalDate:  '2026-08-01',
      currency:     'INR',
      status:       'active',
      notes:        'Tally Prime accounting software renewal',
    },

    // ── AI Tools (per person) ─────────────────────────────────────────────────
    {
      itemName:     'AI Tools — Ravi',
      vendorName:   'Various AI Providers',
      categoryId:   catMap['AI Tools'],
      assignedTo:   'Ravi',
      billingCycle: 'monthly',
      renewalDate:  '2026-04-01',
      currency:     'USD',
      status:       'active',
      notes:        'ChatGPT / Claude / Gemini subscription for Ravi',
    },
    {
      itemName:     'AI Tools — Accounts',
      vendorName:   'Various AI Providers',
      categoryId:   catMap['AI Tools'],
      assignedTo:   'Accounts Team',
      billingCycle: 'monthly',
      renewalDate:  '2026-04-01',
      currency:     'USD',
      status:       'active',
      notes:        'AI subscription for Accounts department',
    },
    {
      itemName:     'AI Tools — Jyoti',
      vendorName:   'Various AI Providers',
      categoryId:   catMap['AI Tools'],
      assignedTo:   'Jyoti',
      billingCycle: 'monthly',
      renewalDate:  '2026-04-01',
      currency:     'USD',
      status:       'active',
      notes:        'AI subscription for Jyoti',
    },
    {
      itemName:     'AI Tools — Pravin',
      vendorName:   'Various AI Providers',
      categoryId:   catMap['AI Tools'],
      assignedTo:   'Pravin',
      billingCycle: 'monthly',
      renewalDate:  '2026-04-01',
      currency:     'USD',
      status:       'active',
      notes:        'AI subscription for Pravin',
    },

    // ── Internet & Connectivity ───────────────────────────────────────────────
    {
      itemName:     'Internet — Mumbai Office',
      vendorName:   'ISP - Mumbai',
      categoryId:   catMap['Internet & Connectivity'],
      billingCycle: 'monthly',
      renewalDate:  '2026-04-01',
      currency:     'INR',
      status:       'active',
      notes:        'Broadband / leased line for Mumbai office',
    },
    {
      itemName:     'Internet — Lucknow Office',
      vendorName:   'ISP - Lucknow',
      categoryId:   catMap['Internet & Connectivity'],
      billingCycle: 'monthly',
      renewalDate:  '2026-04-01',
      currency:     'INR',
      status:       'active',
      notes:        'Broadband / leased line for Lucknow office',
    },

    // ── Finance & Credit (CIBIL per person) ───────────────────────────────────
    {
      itemName:     'CIBIL.com — Ravi',
      vendorName:   'TransUnion CIBIL',
      categoryId:   catMap['Finance & Credit'],
      assignedTo:   'Ravi',
      billingCycle: 'yearly',
      renewalDate:  '2026-06-01',
      loginUrl:     'https://www.cibil.com',
      currency:     'INR',
      status:       'active',
      notes:        'Individual CIBIL credit score subscription',
    },
    {
      itemName:     'CIBIL.com — Dayanand',
      vendorName:   'TransUnion CIBIL',
      categoryId:   catMap['Finance & Credit'],
      assignedTo:   'Dayanand',
      billingCycle: 'yearly',
      renewalDate:  '2026-06-01',
      loginUrl:     'https://www.cibil.com',
      currency:     'INR',
      status:       'active',
      notes:        'Individual CIBIL credit score subscription',
    },
    {
      itemName:     'CIBIL.com — Priyanka',
      vendorName:   'TransUnion CIBIL',
      categoryId:   catMap['Finance & Credit'],
      assignedTo:   'Priyanka',
      billingCycle: 'yearly',
      renewalDate:  '2026-06-01',
      loginUrl:     'https://www.cibil.com',
      currency:     'INR',
      status:       'active',
      notes:        'Individual CIBIL credit score subscription',
    },
    {
      itemName:     'CIBIL.com — Sharmila',
      vendorName:   'TransUnion CIBIL',
      categoryId:   catMap['Finance & Credit'],
      assignedTo:   'Sharmila',
      billingCycle: 'yearly',
      renewalDate:  '2026-06-01',
      loginUrl:     'https://www.cibil.com',
      currency:     'INR',
      status:       'active',
      notes:        'Individual CIBIL credit score subscription',
    },
    {
      itemName:     'CIBIL.com — Himanshu',
      vendorName:   'TransUnion CIBIL',
      categoryId:   catMap['Finance & Credit'],
      assignedTo:   'Himanshu',
      billingCycle: 'yearly',
      renewalDate:  '2026-06-01',
      loginUrl:     'https://www.cibil.com',
      currency:     'INR',
      status:       'active',
      notes:        'Individual CIBIL credit score subscription',
    },

    // ── Compliance & Legal ────────────────────────────────────────────────────
    {
      itemName:     'FSSAI Licence Renewal',
      vendorName:   'FSSAI (Food Safety and Standards Authority of India)',
      categoryId:   catMap['Compliance & Legal'],
      billingCycle: 'yearly',
      renewalDate:  '2026-09-01',
      currency:     'INR',
      status:       'active',
      alertDaysBefore: 30,
      notes:        'FSSAI food licence — annual renewal required',
    },
    {
      itemName:     'Trademark Registration',
      vendorName:   'Trademark Registry / IP India',
      categoryId:   catMap['Compliance & Legal'],
      billingCycle: 'yearly',
      renewalDate:  '2027-01-01',
      currency:     'INR',
      status:       'active',
      alertDaysBefore: 60,
      notes:        'Company trademark protection renewal',
    },

    // ── Facility & Utilities ──────────────────────────────────────────────────
    {
      itemName:     'Pest Control — Lucknow Office',
      vendorName:   'Pest Control Service',
      categoryId:   catMap['Facility & Utilities'],
      billingCycle: 'quarterly',
      renewalDate:  '2026-06-01',
      currency:     'INR',
      status:       'active',
      notes:        'Quarterly pest control treatment for Lucknow office',
    },
    {
      itemName:     'Water Bill — Lucknow Office',
      vendorName:   'Lucknow Municipal Corporation',
      categoryId:   catMap['Facility & Utilities'],
      billingCycle: 'monthly',
      renewalDate:  '2026-04-01',
      currency:     'INR',
      status:       'active',
      notes:        'Monthly water utility bill for Lucknow office',
    },

    // ── Communication ─────────────────────────────────────────────────────────
    {
      itemName:     'Microsoft 365 (Email & Office)',
      vendorName:   'Microsoft',
      categoryId:   catMap['Communication'],
      billingCycle: 'yearly',
      renewalDate:  '2026-10-01',
      loginUrl:     'https://admin.microsoft.com',
      currency:     'INR',
      status:       'active',
      notes:        'Microsoft 365 Business licenses — email, Teams, Office apps',
    },

    // ── Security & Infrastructure (suggested) ─────────────────────────────────
    {
      itemName:     'SSL Certificate',
      vendorName:   'SSL Provider',
      categoryId:   catMap['Security & Infrastructure'],
      billingCycle: 'yearly',
      renewalDate:  '2026-12-01',
      currency:     'INR',
      status:       'active',
      alertDaysBefore: 30,
      notes:        'Website SSL/TLS certificate renewal',
    },
    {
      itemName:     'Antivirus / Endpoint Security',
      vendorName:   'Security Vendor',
      categoryId:   catMap['Security & Infrastructure'],
      billingCycle: 'yearly',
      renewalDate:  '2026-11-01',
      currency:     'INR',
      status:       'active',
      notes:        'Office endpoint protection — all machines',
    },

    // ── Miscellaneous (suggested) ─────────────────────────────────────────────
    {
      itemName:     'Naukri.com / Job Portal',
      vendorName:   'Info Edge (Naukri)',
      categoryId:   catMap['Miscellaneous'],
      billingCycle: 'yearly',
      renewalDate:  '2026-08-01',
      currency:     'INR',
      status:       'active',
      notes:        'Job posting / recruitment portal subscription',
    },
    {
      itemName:     'LinkedIn Recruiter / Premium',
      vendorName:   'LinkedIn',
      categoryId:   catMap['Miscellaneous'],
      billingCycle: 'yearly',
      renewalDate:  '2026-05-01',
      currency:     'USD',
      status:       'active',
      notes:        'LinkedIn talent solution for hiring',
    },
  ];
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Starting Renewal seed...\n');

  // ── Seed categories ──────────────────────────────────────────────────────
  const catMap = {};
  for (const cat of CATEGORIES) {
    const existing = await prisma.renewalCategory.findFirst({ where: { name: cat.name } });
    if (existing) {
      catMap[cat.name] = existing.id;
      console.log(`  ✓ Category exists: ${cat.name}`);
    } else {
      const created = await prisma.renewalCategory.create({ data: cat });
      catMap[cat.name] = created.id;
      console.log(`  + Category created: ${cat.name}`);
    }
  }

  // ── Seed renewals ────────────────────────────────────────────────────────
  const renewals = buildRenewals(catMap);
  let created = 0, skipped = 0;

  for (const renewal of renewals) {
    const existing = await prisma.renewal.findFirst({
      where: { itemName: renewal.itemName, assignedTo: renewal.assignedTo || null },
    });
    if (existing) {
      console.log(`  ✓ Renewal exists: ${renewal.itemName}${renewal.assignedTo ? ` (${renewal.assignedTo})` : ''}`);
      skipped++;
    } else {
      await prisma.renewal.create({ data: renewal });
      console.log(`  + Renewal created: ${renewal.itemName}${renewal.assignedTo ? ` (${renewal.assignedTo})` : ''}`);
      created++;
    }
  }

  console.log(`\n✅ Seed complete: ${CATEGORIES.length} categories, ${created} renewals created, ${skipped} skipped.`);
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
