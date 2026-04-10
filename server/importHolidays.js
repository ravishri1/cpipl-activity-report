/**
 * Replace holidays for FY2025 and FY2026 from Excel data.
 * Run: node importHolidays.js
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// ── File 1: "Holiday List For the Year 2025" (FY 2025-26) ──────────
// Dates: Aug 2025 → Mar 2026; stored as year = 2025
const HOLIDAYS_2025 = [
  { date: '2025-08-15', name: 'Independence Day',    location: 'Mumbai'  },
  { date: '2025-08-15', name: 'Independence Day',    location: 'Lucknow' },
  { date: '2025-08-27', name: 'Ganesh Chaturthi',    location: 'Mumbai'  },
  { date: '2025-10-02', name: 'Gandhi Jayanti',      location: 'Mumbai'  },
  { date: '2025-10-02', name: 'Gandhi Jayanti',      location: 'Lucknow' },
  { date: '2025-10-20', name: 'Narak Chaturdashi',   location: 'Mumbai'  },
  { date: '2025-10-20', name: 'Narak Chaturdashi',   location: 'Lucknow' },
  { date: '2025-10-21', name: 'Lakshmi Pujan',       location: 'Mumbai'  },
  { date: '2025-10-21', name: 'Lakshmi Pujan',       location: 'Lucknow' },
  { date: '2025-10-22', name: 'Diwali Padwa',        location: 'Mumbai'  },
  { date: '2025-10-22', name: 'Diwali Padwa',        location: 'Lucknow' },
  { date: '2025-10-23', name: 'Bhai Dooj',           location: 'Mumbai'  },
  { date: '2025-10-23', name: 'Bhai Dooj',           location: 'Lucknow' },
  { date: '2025-12-25', name: 'Christmas',           location: 'Mumbai'  },
  { date: '2025-12-25', name: 'Christmas',           location: 'Lucknow' },
  { date: '2026-01-01', name: 'New Year',            location: 'Mumbai'  },
  { date: '2026-01-01', name: 'New Year',            location: 'Lucknow' },
  { date: '2026-01-14', name: 'Makar Sankranti',     location: 'Lucknow' },
  { date: '2026-01-26', name: 'Republic Day',        location: 'Mumbai'  },
  { date: '2026-01-26', name: 'Republic Day',        location: 'Lucknow' },
  { date: '2026-03-03', name: 'Holi',                location: 'Mumbai'  },
  { date: '2026-03-03', name: 'Holi',                location: 'Lucknow' },
  { date: '2026-03-04', name: 'Holi (2nd day)',      location: 'Lucknow' },
  { date: '2026-03-19', name: 'Gudi Padwa',          location: 'Mumbai'  },
];

// ── File 2: "Holiday List For the Year 2026" (FY 2026-27) ──────────
// Dates: May 2026 → Mar 2027; stored as year = 2026
const HOLIDAYS_2026 = [
  { date: '2026-05-01', name: 'Labour Day',              location: 'Mumbai'  },
  { date: '2026-05-01', name: 'Labour Day',              location: 'Lucknow' },
  { date: '2026-08-28', name: 'Rakshabandhan',           location: 'Mumbai'  },
  { date: '2026-08-28', name: 'Rakshabandhan',           location: 'Lucknow' },
  { date: '2026-09-14', name: 'Ganesh Chaturthi',        location: 'Mumbai'  },
  { date: '2026-10-02', name: 'Gandhi Jayanti',          location: 'Mumbai'  },
  { date: '2026-10-02', name: 'Gandhi Jayanti',          location: 'Lucknow' },
  { date: '2026-10-20', name: 'Dussehra',                location: 'Mumbai'  },
  { date: '2026-10-20', name: 'Dussehra',                location: 'Lucknow' },
  { date: '2026-11-09', name: 'Lakshmi Pujan',           location: 'Mumbai'  },
  { date: '2026-11-10', name: 'Diwali Padwa',            location: 'Mumbai'  },
  { date: '2026-11-10', name: 'Diwali Padwa',            location: 'Lucknow' },
  { date: '2026-11-11', name: 'Bhai Dooj',               location: 'Mumbai'  },
  { date: '2026-11-11', name: 'Bhai Dooj',               location: 'Lucknow' },
  { date: '2026-12-25', name: 'Christmas',               location: 'Mumbai'  },
  { date: '2026-12-25', name: 'Christmas',               location: 'Lucknow' },
  { date: '2027-01-01', name: 'New Year',                location: 'Mumbai'  },
  { date: '2027-01-01', name: 'New Year',                location: 'Lucknow' },
  { date: '2027-01-14', name: 'Makar Sankranti',         location: 'Lucknow' },
  { date: '2027-01-26', name: 'Republic Day',            location: 'Mumbai'  },
  { date: '2027-01-26', name: 'Republic Day',            location: 'Lucknow' },
  { date: '2027-03-22', name: 'Holi',                    location: 'Mumbai'  },
  { date: '2027-03-22', name: 'Holi',                    location: 'Lucknow' },
  { date: '2027-03-23', name: 'Holi (2nd day)',          location: 'Lucknow' },
];

async function main() {
  // Show existing counts before touching
  const before2025 = await p.holiday.count({ where: { year: 2025 } });
  const before2026 = await p.holiday.count({ where: { year: 2026 } });
  console.log(`Existing holidays — year 2025: ${before2025}, year 2026: ${before2026}`);

  // Delete existing holidays for both years
  const del25 = await p.holiday.deleteMany({ where: { year: 2025 } });
  const del26 = await p.holiday.deleteMany({ where: { year: 2026 } });
  console.log(`Deleted — year 2025: ${del25.count}, year 2026: ${del26.count}`);

  // Insert FY2025 holidays
  const ins25 = await p.holiday.createMany({
    data: HOLIDAYS_2025.map(h => ({ ...h, year: 2025, isOptional: false })),
    skipDuplicates: true,
  });
  console.log(`Inserted year 2025: ${ins25.count} holidays`);

  // Upsert FY2026 holidays (some 2027 dates may already exist with different year)
  let ins26 = 0;
  for (const h of HOLIDAYS_2026) {
    await p.holiday.upsert({
      where: { date_location: { date: h.date, location: h.location } },
      create: { ...h, year: 2026, isOptional: false },
      update: { name: h.name, year: 2026, isOptional: false },
    });
    ins26++;
  }
  console.log(`Upserted year 2026: ${ins26} holidays`);

  console.log('\n✅ Holiday list updated successfully.');

  // Summary
  console.log('\n── FY 2025 Holidays ──');
  const h25 = await p.holiday.findMany({ where: { year: 2025 }, orderBy: { date: 'asc' } });
  const seen25 = new Set();
  h25.forEach(h => {
    const key = h.date + h.name;
    if (!seen25.has(key)) { seen25.add(key); console.log(`  ${h.date}  ${h.name}`); }
  });

  console.log('\n── FY 2026 Holidays ──');
  const h26 = await p.holiday.findMany({ where: { year: 2026 }, orderBy: { date: 'asc' } });
  const seen26 = new Set();
  h26.forEach(h => {
    const key = h.date + h.name;
    if (!seen26.has(key)) { seen26.add(key); console.log(`  ${h.date}  ${h.name}`); }
  });
}

main()
  .catch(e => console.error('❌ Error:', e.message))
  .finally(() => p.$disconnect());
