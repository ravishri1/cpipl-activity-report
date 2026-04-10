/**
 * Update designation and dateOfJoining for all employees
 * Run: node server/scripts/updateDesignationsJoining.js
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const UPDATES = [
  { employeeId: 'COLOR001', name: 'Ravi Pardeep Shrivastav',       joinDate: '2012-08-08', designation: 'CEO' },
  { employeeId: 'COLOR002', name: 'Priyanka Ravi Shrivastav',      joinDate: '2012-08-08', designation: 'Head Customer Support' },
  { employeeId: 'COLOR003', name: 'Himanshu Srivastava',           joinDate: '2016-05-01', designation: 'Managing Director' },
  { employeeId: 'COLOR005', name: 'Dayanand Vishnu Halde',         joinDate: '2019-08-30', designation: 'CFO' },
  { employeeId: 'COLOR006', name: 'Rajendra Pandharinath Ghuge',   joinDate: '2020-03-11', designation: 'Assistant Manager Accounts' },
  { employeeId: 'COLOR007', name: 'Pradnya Sushil Vaidya',         joinDate: '2017-11-01', designation: 'Team Leader Accounts' },
  { employeeId: 'COLOR013', name: 'Manish Singh',                  joinDate: '2016-05-01', designation: 'Office Assitant' },
  { employeeId: 'COLOR015', name: 'Rajan Saroj',                   joinDate: '2018-08-01', designation: 'Order Processing Executive' },
  { employeeId: 'COLOR018', name: 'Anil Kumar Ramdhruv Gautam',    joinDate: '2020-05-10', designation: 'Office Assitant' },
  { employeeId: 'COLOR021', name: 'Ajeet Kumar Yadav',             joinDate: '2019-01-01', designation: 'Sr Procurement Executive' },
  { employeeId: 'COLOR022', name: 'Rahul Dixit',                   joinDate: '2019-11-16', designation: 'Order Processing Executive' },
  { employeeId: 'COLOR026', name: 'Shailesh Vinod Naik',           joinDate: '2020-09-21', designation: 'Team Leader-Marketplace' },
  { employeeId: 'COLOR034', name: 'Pranali Nandu Patil',           joinDate: '2021-02-05', designation: 'Sr Customer Support Executive' },
  { employeeId: 'COLOR044', name: 'Rajat Kumar Shrivastava',       joinDate: '2021-09-01', designation: 'Project Head' },
  { employeeId: 'COLOR051', name: 'Suraj Baban Hate',              joinDate: '2021-12-04', designation: 'Supply Chain Executive' },
  { employeeId: 'COLOR055', name: 'Anil Kumar',                    joinDate: '2021-12-29', designation: 'Order Processing Executive' },
  { employeeId: 'COLOR057', name: 'Nandan Sanjay Maurya',          joinDate: '2022-01-24', designation: 'Marketplace Executive_catalogue' },
  { employeeId: 'COLOR059', name: 'Pankaj Kumar',                  joinDate: '2022-02-07', designation: 'Marketplace Executive_catalogue' },
  { employeeId: 'COLOR064', name: 'Anuj Arya',                     joinDate: '2022-02-01', designation: 'Marketplace Executive_catalogue' },
  { employeeId: 'COLOR070', name: 'Pratik Anil Singh',             joinDate: '2022-05-18', designation: 'Marketplace Executive_catalogue' },
  { employeeId: 'COLOR071', name: 'Lavita Jane Fernandes',         joinDate: '2022-06-01', designation: 'Sr. HR Executive' },
  { employeeId: 'COLOR076', name: 'Dilip Yadav',                   joinDate: '2022-07-01', designation: 'Jr.POS Executive' },
  { employeeId: 'COLOR085', name: 'Badal Mishra',                  joinDate: '2022-09-17', designation: 'Team Leader Customer Support' },
  { employeeId: 'COLOR089', name: 'Nishad Sujit',                  joinDate: '2022-12-05', designation: 'Supply Chain Executive' },
  { employeeId: 'COLOR090', name: 'Abhishek Yadav',                joinDate: '2022-12-12', designation: 'Manufacturing Executive' },
  { employeeId: 'COLOR095', name: 'Prashant Kumar Vishwakarma',    joinDate: '2023-02-01', designation: 'Jr. PLD Executive' },
  { employeeId: 'COLOR100', name: 'Abhishek Suresh Sawant',        joinDate: '2023-02-06', designation: 'Team Leader Data Analyst' },
  { employeeId: 'COLOR101', name: 'Swapnil Mahadev Parab',         joinDate: '2023-04-20', designation: 'Sr. PLD Executive' },
  { employeeId: 'COLOR108', name: 'Pritesh Santosh Varose',        joinDate: '2023-07-03', designation: 'Inventory Executive' },
  { employeeId: 'COLOR113', name: 'Abhilasha Jaiswal',             joinDate: '2023-09-20', designation: 'Customer Support Executive' },
  { employeeId: 'COLOR120', name: 'Ashishkumar Ashok Tavasalkar',  joinDate: '2023-12-04', designation: 'Admin Executive' },
  { employeeId: 'COLOR121', name: 'Suraj Gajanan Parab',           joinDate: '2023-12-11', designation: 'Junior Data Analyst' },
  { employeeId: 'COLOR128', name: 'Sameer Subhash Bhandvilkar',    joinDate: '2024-04-01', designation: 'Jr. Accounts Executive' },
  { employeeId: 'COLOR133', name: 'Neha Premchand Yadav',          joinDate: '2024-06-24', designation: 'Jr Accounts Executive' },
  { employeeId: 'COLOR136', name: 'Mansi Harsukhbhai Thummar',     joinDate: '2024-07-10', designation: 'Jr. Digital Marketing Executive' },
  { employeeId: 'COLOR137', name: 'Shubham Arya',                  joinDate: '2024-08-05', designation: 'Graphics and Video Editor' },
  { employeeId: 'COLOR139', name: 'Viraj Sawner',                  joinDate: '2024-09-20', designation: 'Data Analyst' },
  { employeeId: 'COLOR143', name: 'Samiksha Pushparaj Dhuri',      joinDate: '2024-10-01', designation: 'Junior Data Analyst' },
  { employeeId: 'COLOR145', name: 'Shikha Ankit Shukla',           joinDate: '2024-09-17', designation: 'Jr. PLD Executive' },
  { employeeId: 'COLOR146', name: 'Mehul Rikame',                  joinDate: '2024-10-01', designation: 'Jr. PLD Executive' },
  { employeeId: 'COLOR147', name: 'Kaustubh Gaikwad',              joinDate: '2024-10-01', designation: 'Jr. PLD Executive' },
  { employeeId: 'COLOR153', name: 'Daniel Sunil Das Kuzhivila',    joinDate: '2024-11-25', designation: 'Customer Support Executive' },
  { employeeId: 'COLOR154', name: 'Aashutosh Shailendra Patil',    joinDate: '2024-12-05', designation: 'Jr. Digital Marketing Executive' },
  { employeeId: 'COLOR155', name: 'Sharmila Dayanand Halde',       joinDate: '2024-12-01', designation: 'Customer Support Executive' },
  { employeeId: 'COLOR156', name: 'Rupali Ramesh Sharma',          joinDate: '2024-12-19', designation: 'Jr Return Executive' },
  { employeeId: 'COLOR157', name: 'Yashashree Yadava Kotian',      joinDate: '2024-12-27', designation: 'Accounts Executive' },
  { employeeId: 'COLOR158', name: 'Nikhil Shahaji Thorat',         joinDate: '2025-01-02', designation: 'Accounts Executive' },
];

async function main() {
  console.log(`Processing ${UPDATES.length} employees...\n`);

  let updated = 0;
  let notFound = 0;

  for (const row of UPDATES) {
    const user = await prisma.user.findFirst({
      where: { employeeId: row.employeeId },
      select: { id: true, name: true, employeeId: true },
    });

    if (!user) {
      console.log(`NOT FOUND: ${row.employeeId} — ${row.name}`);
      notFound++;
      continue;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        designation: row.designation,
        dateOfJoining: row.joinDate,
      },
    });

    console.log(`✓ ${row.employeeId} ${user.name} → ${row.designation} / ${row.joinDate}`);
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}, Not found: ${notFound}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
