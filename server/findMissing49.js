const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

const CPIPL_LIST = [
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
  for (const name of CPIPL_LIST) {
    const u = await prisma.user.findFirst({
      where: { name },
      select: { id: true, name: true, employeeId: true, companyId: true, isActive: true, dateOfJoining: true },
    });
    if (!u) { console.log(`NOT IN DB: ${name}`); continue; }
    const inCount = u.companyId === 1 && u.isActive && u.dateOfJoining && u.dateOfJoining <= '2025-04-30';
    if (!inCount) {
      console.log(`EXCLUDED: ${u.employeeId} ${u.name} | companyId=${u.companyId} | isActive=${u.isActive} | joined=${u.dateOfJoining}`);
    }
  }
  console.log('Done.');
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
