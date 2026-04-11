const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

// All 49 confirmed CPIPL employees for April 2025
const CPIPL_EMPLOYEES = [
  'Ravi Pardeep Shrivastav','Priyanka Ravi Shrivastav','Himanshu Srivastava',
  'Dayanand Vishnu Halde','Rajendra Pandharinath Ghuge','Pradnya Sushil Vaidya',
  'Manish Singh','Rajan Saroj','Anil Kumar Ramdhruv Gautam','Ajeet Kumar Yadav',
  'Rahul Dixit','Shailesh Vinod Naik','Pranali Nandu Patil','Rajat Kumar Shrivastava',
  'Jyoti Vasant Naik','Suraj Baban Hate','Anil Kumar','Nandan Sanjay Maurya',
  'Pankaj Kumar','Anuj Arya','Pratik Anil Singh','Lavita Jane Fernandes',
  'Dilip Yadav','Vishal Sonu Gharate','Badal Mishra','Nishad Sujit',
  'Abhishek Yadav','Prashant Kumar Vishwakarma','Abhishek Suresh Sawant',
  'Swapnil Mahadev Parab','Pritesh Santosh Varose','Abhilasha Jaiswal',
  'Ashishkumar Ashok Tavasalkar','Suraj Gajanan Parab','Sameer Subhash Bhandvilkar',
  'Divyash Nanji Bhai Chandegra','Mansi Harsukhbhai Thummar','Shubham Arya',
  'Viraj Sawner','Samiksha Pushparaj Dhuri','Shikha Ankit Shukla','Mehul Rikame',
  'Kaustubh Gaikwad','Daniel Sunil Das Kuzhivila','Aashutosh Shailendra Patil',
  'Sharmila Dayanand Halde','Rupali Ramesh Sharma','Yashashree Yadava Kotian',
  'Nikhil Shahaji Thorat',
];

async function main() {
  console.log('=== FIXING COMPANY IDs ===\n');

  let fixed = 0, notFound = 0;

  for (const name of CPIPL_EMPLOYEES) {
    const user = await prisma.user.findFirst({
      where: { name },
      select: { id: true, name: true, employeeId: true, companyId: true },
    });
    if (!user) { console.log(`  NOT FOUND: ${name}`); notFound++; continue; }

    if (user.companyId === 1) {
      console.log(`  OK:    ${user.employeeId} ${user.name} already companyId=1`);
      continue;
    }

    await prisma.user.update({ where: { id: user.id }, data: { companyId: 1 } });
    console.log(`  FIXED: ${user.employeeId} ${user.name} → companyId=1 (was ${user.companyId})`);
    fixed++;
  }

  console.log(`\n✅ Fixed: ${fixed} | Not found: ${notFound}`);

  // Final count
  const finalCount = await prisma.user.count({
    where: { isActive: true, companyId: 1, dateOfJoining: { lte: '2025-04-30' } },
  });
  console.log(`\nCPIPL employees (active, joined ≤ Apr 2025): ${finalCount}`);
  console.log(finalCount === 49 ? '✅ Correct — matches your list of 49' : `⚠ Expected 49, got ${finalCount}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
