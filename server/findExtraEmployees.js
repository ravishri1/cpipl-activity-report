const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

const ACTUAL_LIST = [
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
  const dbEmployees = await prisma.user.findMany({
    where: { isActive: true, dateOfJoining: { lte: '2025-04-30' } },
    select: { id: true, name: true, employeeId: true, dateOfJoining: true, isActive: true, employmentStatus: true },
    orderBy: { name: 'asc' },
  });

  console.log(`DB count (active, joined <= Apr 30 2025): ${dbEmployees.length}`);
  console.log(`Your actual list: ${ACTUAL_LIST.length}`);

  // Find employees in DB but NOT in your list
  const extra = dbEmployees.filter(u => !ACTUAL_LIST.includes(u.name));
  console.log(`\nEXTRA employees in DB not in your list (${extra.length}):`);
  extra.forEach(u => console.log(`  ${u.employeeId} | ${u.name} | joined=${u.dateOfJoining} | status=${u.employmentStatus} | active=${u.isActive}`));

  // Find employees in your list but NOT in DB
  const missing = ACTUAL_LIST.filter(name => !dbEmployees.find(u => u.name === name));
  if (missing.length > 0) {
    console.log(`\nMISSING from DB (in your list but not found):`);
    missing.forEach(n => console.log(`  ${n}`));
  }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
