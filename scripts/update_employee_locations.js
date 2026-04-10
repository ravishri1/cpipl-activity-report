// Script: Update employee location and department from GreyTHR Excel data
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const employeeData = [
  { employeeId: 'COLOR088', name: 'ARATI BHAGAWAN RAUT',               department: 'PLD',               location: 'Mumbai' },
  { employeeId: 'COLOR154', name: 'Aashutosh Shailendra Patil',         department: 'Marketing',         location: 'Mumbai' },
  { employeeId: 'COLOR113', name: 'Abhilasha Jaiswal',                  department: 'Support',           location: 'Lucknow' },
  { employeeId: 'COLOR100', name: 'Abhishek Suresh Sawant',             department: 'Data Analyst',      location: 'Mumbai' },
  { employeeId: 'COLOR090', name: 'Abhishek Yadav',                     department: 'Logistic',          location: 'Mumbai' },
  { employeeId: 'COLOR021', name: 'Ajeet Kumar Yadav',                  department: 'Purchase',          location: 'Lucknow' },
  { employeeId: 'COLOR191', name: 'Akshat Shailesh Mehta',              department: 'Data Analyst',      location: 'Mumbai' },
  { employeeId: 'COLOR115', name: 'Aman Saini',                         department: 'Logistic',          location: 'Lucknow' },
  { employeeId: 'COLOR055', name: 'Anil Kumar',                         department: 'Logistic',          location: 'Mumbai' },
  { employeeId: 'COLOR018', name: 'Anil Kumar Ramdhruv Gautam',         department: 'Logistic',          location: 'Mumbai' },
  { employeeId: 'COLOR176', name: 'Ankit Singh Anil',                   department: 'PLD',               location: 'Mumbai' },
  { employeeId: 'COLOR064', name: 'Anuj Arya',                          department: 'Purchase',          location: 'Lucknow' },
  { employeeId: 'COLOR129', name: 'Anuj Sah',                           department: 'Marketing',         location: 'Mumbai' },
  { employeeId: 'COLOR120', name: 'Ashishkumar Ashok Tavasalkar',       department: 'HR_Admin_IT',       location: 'Mumbai' },
  { employeeId: 'COLOR171', name: 'Avinash Vinayak Kadam',              department: 'Accounts_Finance',  location: 'Mumbai' },
  { employeeId: 'COLOR085', name: 'Badal Mishra',                       department: 'Support',           location: 'Lucknow' },
  { employeeId: 'COLOR123', name: 'Chandrakant Krishna Jadhav',         department: 'Data Analyst',      location: 'Mumbai' },
  { employeeId: 'COLOR160', name: 'Chetan Mukesh Soudagar',             department: 'Logistic',          location: 'Mumbai' },
  { employeeId: 'COLOR131', name: 'Chitrangi Satyawan Mungekar',        department: 'Marketing',         location: 'Mumbai' },
  { employeeId: 'COLOR153', name: 'Daniel Sunil Das Kuzhivila',         department: 'Support',           location: 'Mumbai' },
  { employeeId: 'COLOR005', name: 'Dayanand Vishnu Halde',              department: 'Management',        location: 'Mumbai' },
  { employeeId: 'COLOR185', name: 'Dilip Kumar',                        department: 'Logistic',          location: 'Lucknow' },
  { employeeId: 'COLOR076', name: 'Dilip Yadav',                        department: 'Purchase',          location: 'Lucknow' },
  { employeeId: 'COLOR110', name: 'Divya Devi',                         department: 'Support',           location: 'Lucknow' },
  { employeeId: 'COLOR134', name: 'Divyash Chandegra',                  department: 'Accounts_Finance',  location: 'Mumbai' },
  { employeeId: 'COLOR003', name: 'Himanshu Srivastava',                department: 'Management',        location: 'Lucknow' },
  { employeeId: 'COLOR047', name: 'Jyoti Vasant Naik',                  department: 'HR_Admin_IT',       location: 'Mumbai' },
  { employeeId: 'COLOR147', name: 'Kaustubh Gaikwad',                   department: 'PLD',               location: 'Mumbai' },
  { employeeId: 'COLOR117', name: 'Lahiri Noopur',                      department: 'Logistic',          location: 'Lucknow' },
  { employeeId: 'COLOR071', name: 'Lavita Jane Fernandes',              department: 'HR_Admin_IT',       location: 'Mumbai' },
  { employeeId: 'COLOR190', name: 'Manish Jaya Mendon',                 department: 'Accounts_Finance',  location: 'Mumbai' },
  { employeeId: 'COLOR013', name: 'Manish Singh',                       department: 'Logistic',          location: 'Mumbai' },
  { employeeId: 'COLOR136', name: 'Mansi Harsukhbhai Thummar',          department: 'Marketing',         location: 'Mumbai' },
  { employeeId: 'COLOR146', name: 'Mehul Rikame',                       department: 'PLD',               location: 'Mumbai' },
  { employeeId: 'COLOR195', name: 'NISHAD SUJIT',                       department: 'Logistic',          location: 'Mumbai' },
  { employeeId: 'COLOR057', name: 'Nandan Sanjay Maurya',               department: 'PLD',               location: 'Mumbai' },
  { employeeId: 'COLOR133', name: 'Neha Premchand Yadav',               department: 'Accounts_Finance',  location: 'Mumbai' },
  { employeeId: 'COLOR158', name: 'Nikhil Shahaji Thorat',              department: 'Accounts_Finance',  location: 'Mumbai' },
  { employeeId: 'COLOR089', name: 'Nishad Sujit',                       department: 'Logistic',          location: 'Mumbai' },
  { employeeId: 'COLOR112', name: 'Nishant Deepak Upadhayay',           department: 'Accounts_Finance',  location: 'Mumbai' },
  { employeeId: 'COLOR087', name: 'Nutan Nitin Chikhle',                department: 'Marketing',         location: 'Mumbai' },
  { employeeId: 'COLOR122', name: 'PRATHAMESH RAMESH RAMANE',           department: 'Marketing',         location: 'Mumbai' },
  { employeeId: 'COLOR193', name: 'PRATIKSHA PANKAJ MANJREKAR',         department: 'Data Analyst',      location: 'Mumbai' },
  { employeeId: 'COLOR063', name: 'Pallavi Pravin More',                department: 'Accounts_Finance',  location: 'Mumbai' },
  { employeeId: 'COLOR059', name: 'Pankaj Kumar',                       department: 'PLD',               location: 'Lucknow' },
  { employeeId: 'COLOR007', name: 'Pradnya Sushil Vaidya',              department: 'Accounts_Finance',  location: 'Mumbai' },
  { employeeId: 'COLOR104', name: 'Prajyot Vijay Chavan',               department: 'PLD',               location: 'Mumbai' },
  { employeeId: 'COLOR034', name: 'Pranali Nandu Patil',                department: 'Support',           location: 'Mumbai' },
  { employeeId: 'COLOR095', name: 'Prashant Kumar Vishwakarma',         department: 'PLD',               location: 'Lucknow' },
  { employeeId: 'COLOR070', name: 'Pratik Anil Singh',                  department: 'PLD',               location: 'Mumbai' },
  { employeeId: 'COLOR196', name: 'Pravin Hindurao Shinde',             department: 'General',           location: 'Mumbai' },
  { employeeId: 'COLOR108', name: 'Pritesh Santosh Varose',             department: 'Accounts_Finance',  location: 'Mumbai' },
  { employeeId: 'COLOR098', name: 'Priyank Kamlesh Singh',              department: 'Marketing',         location: 'Mumbai' },
  { employeeId: 'COLOR002', name: 'Priyanka Ravi Shrivastav',           department: 'Management',        location: 'Mumbai' },
  { employeeId: 'COLOR068', name: 'Rachana Ravindra Sawant',            department: 'Accounts_Finance',  location: 'Mumbai' },
  { employeeId: 'COLOR022', name: 'Rahul Dixit',                        department: 'Logistic',          location: 'Lucknow' },
  { employeeId: 'COLOR184', name: 'Rahul Yadav',                        department: 'Logistic',          location: 'Lucknow' },
  { employeeId: 'COLOR015', name: 'Rajan Saroj',                        department: 'Logistic',          location: 'Mumbai' },
  { employeeId: 'COLOR044', name: 'Rajat Kumar Shrivastava',            department: 'Purchase',          location: 'Lucknow' },
  { employeeId: 'COLOR138', name: 'Rajeev Kumar Singh',                 department: 'Marketing',         location: 'Mumbai' },
  { employeeId: 'COLOR006', name: 'Rajendra Pandharinath Ghuge',        department: 'Accounts_Finance',  location: 'Mumbai' },
  { employeeId: 'COLOR001', name: 'Ravi Pardeep Shrivastav',            department: 'Management',        location: 'Mumbai' },
  { employeeId: 'COLOR175', name: 'Rohit Raosaheb Phatangare',          department: 'Data Analyst',      location: 'Mumbai' },
  { employeeId: 'COLOR156', name: 'Rupali Ramesh Sharma',               department: 'Logistic',          location: 'Mumbai' },
  { employeeId: 'COLOR194', name: 'SHALINI CHAURASIA',                  department: 'Data Analyst',      location: 'Mumbai' },
  { employeeId: 'COLOR197', name: 'SHELTON RODRIGUES',                  department: 'Accounts_Finance',  location: 'Mumbai' },
  { employeeId: 'COLOR163', name: 'Sagar Stavarmath',                   department: 'Logistic',          location: 'Mumbai' },
  { employeeId: 'COLOR167', name: 'Sameer Manik Patil',                 department: 'Logistic',          location: 'Mumbai' },
  { employeeId: 'COLOR128', name: 'Sameer Subhash Bhandvilkar',         department: 'Accounts_Finance',  location: 'Mumbai' },
  { employeeId: 'COLOR143', name: 'Samiksha Pushparaj Dhuri',           department: 'Data Analyst',      location: 'Mumbai' },
  { employeeId: 'COLOR132', name: 'Seema H Gupta',                      department: 'Logistic',          location: 'Mumbai' },
  { employeeId: 'COLOR026', name: 'Shailesh Vinod Naik',                department: 'PLD',               location: 'Mumbai' },
  { employeeId: 'COLOR155', name: 'Sharmila Dayanand Halde',            department: 'Support',           location: 'Mumbai' },
  { employeeId: 'COLOR116', name: 'Shashi Pal',                         department: 'Logistic',          location: 'Lucknow' },
  { employeeId: 'COLOR170', name: 'Shaunak Sharad Kadam',               department: 'Accounts_Finance',  location: 'Mumbai' },
  { employeeId: 'COLOR093', name: 'Shawn Godfrey Fernandes',            department: 'Logistic',          location: 'Mumbai' },
  { employeeId: 'COLOR179', name: 'Shelton Rodrigues',                  department: 'Accounts_Finance',  location: 'Mumbai' },
  { employeeId: 'COLOR145', name: 'Shikha Ankit Shukla',                department: 'PLD',               location: 'Mumbai' },
  { employeeId: 'COLOR181', name: 'Shraddha Prakash Shivgan',           department: 'Data Analyst',      location: 'Mumbai' },
  { employeeId: 'COLOR091', name: 'Shubhadra Nayba Sadawarte',          department: 'Logistic',          location: 'Mumbai' },
  { employeeId: 'COLOR137', name: 'Shubham Arya',                       department: 'Marketing',         location: 'Mumbai' },
  { employeeId: 'COLOR188', name: 'Shubhanshu Prasad',                  department: 'Support',           location: 'Mumbai' },
  { employeeId: 'COLOR159', name: 'Sonal Ramkumar Chauhan',             department: 'Logistic',          location: 'Mumbai' },
  { employeeId: 'COLOR177', name: 'Sumit Kumar Maurya',                 department: 'Logistic',          location: 'Mumbai' },
  { employeeId: 'COLOR051', name: 'Suraj Baban Hate',                   department: 'Logistic',          location: 'Mumbai' },
  { employeeId: 'COLOR121', name: 'Suraj Gajanan Parab',                department: 'Data Analyst',      location: 'Mumbai' },
  { employeeId: 'COLOR101', name: 'Swapnil Mahadev Parab',              department: 'PLD',               location: 'Mumbai' },
  { employeeId: 'COLOR107', name: 'Tanuja Vasudev More',                department: 'Marketing',         location: 'Mumbai' },
  { employeeId: 'COLOR106', name: 'Uttara Jayant Chavan',               department: 'Marketing',         location: 'Mumbai' },
  { employeeId: 'COLOR126', name: 'VIJAY KUMAR SINGH',                  department: 'Accounts_Finance',  location: 'Mumbai' },
  { employeeId: 'COLOR189', name: 'Vikrant Aravind Malavade',           department: 'HR_Admin_IT',       location: 'Mumbai' },
  { employeeId: 'COLOR139', name: 'Viraj Sawner',                       department: 'Data Analyst',      location: 'Mumbai' },
  { employeeId: 'COLOR077', name: 'Vishal Sonu Gharate',                department: 'Logistic',          location: 'Mumbai' },
  { employeeId: 'COLOR182', name: 'Yadav Ritesh Vinod',                 department: 'PLD',               location: 'Mumbai' },
  { employeeId: 'COLOR157', name: 'Yashashree Yadava Kotian',           department: 'Accounts_Finance',  location: 'Mumbai' },
];

async function main() {
  // Unique departments from data
  const uniqueDepts = [...new Set(employeeData.map(e => e.department).filter(Boolean))];
  console.log('Departments to ensure exist:', uniqueDepts);

  // Ensure all departments exist in Department table
  for (const deptName of uniqueDepts) {
    await prisma.department.upsert({
      where: { name: deptName },
      update: {},
      create: { name: deptName },
    });
  }
  console.log(`✅ ${uniqueDepts.length} departments ensured`);

  // Update each user
  let updated = 0, notFound = 0;
  for (const emp of employeeData) {
    const user = await prisma.user.findFirst({
      where: { employeeId: emp.employeeId },
      select: { id: true, name: true },
    });
    if (!user) {
      console.log(`  ⚠️  NOT FOUND in EOD: ${emp.employeeId} ${emp.name}`);
      notFound++;
      continue;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: {
        department: emp.department,
        location: emp.location,
      },
    });
    updated++;
    console.log(`  ✅ ${emp.employeeId} → dept: ${emp.department}, loc: ${emp.location}`);
  }

  console.log(`\nDone. Updated: ${updated}, Not found: ${notFound}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
