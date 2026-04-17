const path = require('path');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });
const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));
const p = new PrismaClient();

const EXPECTED = new Set([
  'Ravi Pardeep Shrivastav','Priyanka Ravi Shrivastav','Himanshu Srivastava',
  'Dayanand Vishnu Halde','Rajendra Pandharinath Ghuge','Pradnya Sushil Vaidya',
  'Manish Singh','Rajan Saroj','Anil Kumar Ramdhruv Gautam','Ajeet Kumar Yadav',
  'Rahul Dixit','Shailesh Vinod Naik','Pranali Nandu Patil','Rajat Kumar Shrivastava',
  'Jyoti Vasant Naik','Suraj Baban Hate','Anil Kumar','Nandan Sanjay Maurya',
  'Pankaj Kumar','Anuj Arya','Pratik Anil Singh','Lavita Jane Fernandes',
  'Dilip Yadav','Badal Mishra','Nishad Sujit','Abhishek Yadav',
  'Prashant Kumar Vishwakarma','Abhishek Suresh Sawant','Swapnil Mahadev Parab',
  'Pritesh Santosh Varose','Abhilasha Jaiswal','Ashishkumar Ashok Tavasalkar',
  'Suraj Gajanan Parab','Sameer Subhash Bhandvilkar','Mansi Harsukhbhai Thummar',
  'Shubham Arya','Viraj Sawner','Samiksha Pushparaj Dhuri','Shikha Ankit Shukla',
  'Mehul Rikame','Kaustubh Gaikwad','Daniel Sunil Das Kuzhivila',
  'Aashutosh Shailendra Patil','Sharmila Dayanand Halde','Rupali Ramesh Sharma',
  'Yashashree Yadava Kotian','Nikhil Shahaji Thorat','Sagar Stavarmath',
  'Shaunak Sharad Kadam'
]);

async function main() {
  const users = await p.user.findMany({
    where: {
      companyId: 1,
      dateOfJoining: { lte: '2025-05-31' },
      OR: [
        { isActive: true, OR: [{ separation: null }, { separation: { lastWorkingDate: { gte: '2025-05-01' } } }] },
        { isActive: false, separation: { lastWorkingDate: { gte: '2025-05-01' } } },
      ],
    },
    include: { separation: { select: { lastWorkingDate: true, type: true } } },
    orderBy: { employeeId: 'asc' },
  });

  console.log('Total counted by new filter:', users.length);
  console.log('Expected:', EXPECTED.size);

  const extras = users.filter(u => !EXPECTED.has(u.name));
  console.log('\nEXTRA employees (' + extras.length + '):');
  for (const u of extras) {
    const lwd = u.separation?.lastWorkingDate || 'NONE';
    console.log(`  ${u.employeeId} | ${u.name} | isActive:${u.isActive} | doj:${u.dateOfJoining} | status:${u.employmentStatus} | LWD:${lwd}`);
  }

  const missing = [...EXPECTED].filter(n => !users.find(u => u.name === n));
  if (missing.length) console.log('\nMISSING from DB (in list but not counted):', missing.join(', '));

  // Also show what the OLD filter (isActive:true only) would have returned
  const old = await p.user.count({ where: { companyId: 1, isActive: true, dateOfJoining: { lte: '2025-05-31' } } });
  console.log('\nOLD filter (isActive:true) count:', old);

  await p.$disconnect();
}
main().catch(e => { console.error(e.message); p.$disconnect(); process.exit(1); });
