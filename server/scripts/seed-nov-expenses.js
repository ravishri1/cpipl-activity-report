const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const userId = 25; // Ashish
const adminId = 1; // Jyoti

const catMap = {
  'tea_coffee': 'tea_coffee',
  'office': 'office_expenses',
  'repair': 'repair_maintenance',
  'diesel': 'diesel_petrol',
  'travel': 'travel',
  'welfare': 'staff_welfare',
};

const expenses = [
  ['2025-11-01','Milk',128,'tea_coffee'],
  ['2025-11-01','Ankush Hardware',400,'repair'],
  ['2025-11-01','Twodots software services',4234,'office'],
  ['2025-11-03','Milk',128,'tea_coffee'],
  ['2025-11-03','Ginger',30,'tea_coffee'],
  ['2025-11-03','Coconut (02)',100,'office'],
  ['2025-11-04','Milk',128,'tea_coffee'],
  ['2025-11-05','Milk',128,'tea_coffee'],
  ['2025-11-05','Glass door repair',350,'repair'],
  ['2025-11-06','Milk',128,'tea_coffee'],
  ['2025-11-06','Fsons',520,'office'],
  ['2025-11-07','Milk',128,'tea_coffee'],
  ['2025-11-07','Munciple sweeper',500,'office'],
  ['2025-11-08','Milk',128,'tea_coffee'],
  ['2025-11-08','Ankush Hardware (WD-40)',260,'office'],
  ['2025-11-08','Fan Repair & Winding (Ligistics)',600,'repair'],
  ['2025-11-10','Milk',128,'tea_coffee'],
  ['2025-11-10','Activa Petrol',481,'diesel'],
  ['2025-11-11','Milk',128,'tea_coffee'],
  ['2025-11-12','Milk',128,'tea_coffee'],
  ['2025-11-13','Milk',128,'tea_coffee'],
  ['2025-11-13','Coffee Packet',50,'tea_coffee'],
  ['2025-11-14','Milk',128,'tea_coffee'],
  ['2025-11-14','Ginger',50,'tea_coffee'],
  ['2025-11-14','200 ml Water Bottle',600,'office'],
  ['2025-11-14','Office-Metro-Office Auto Fare',250,'office'],
  ['2025-11-15','Milk',96,'tea_coffee'],
  ['2025-11-15','Evening Snacks (Logistic)',180,'office'],
  ['2025-11-16','Milk',32,'tea_coffee'],
  ['2025-11-17','Milk',128,'tea_coffee'],
  ['2025-11-17','Nanadwana Transport',850,'travel'],
  ['2025-11-17','Ankush Hardware',80,'office'],
  ['2025-11-17','Omee Tablet',60,'office'],
  ['2025-11-18','Milk',64,'tea_coffee'],
  ['2025-11-19','Milk',96,'tea_coffee'],
  ['2025-11-20','Milk',96,'tea_coffee'],
  ['2025-11-21','Milk',96,'tea_coffee'],
  ['2025-11-21','Activa Petrol',413,'diesel'],
  ['2025-11-22','Milk',96,'tea_coffee'],
  ['2025-11-23','Milk',32,'tea_coffee'],
  ['2025-11-23','Lock',40,'office'],
  ['2025-11-24','Milk',96,'tea_coffee'],
  ['2025-11-25','Milk',96,'tea_coffee'],
  ['2025-11-25','VI Bill (8879097490)',50,'office'],
  ['2025-11-26','Milk',96,'tea_coffee'],
  ['2025-11-27','Ginger',50,'tea_coffee'],
  ['2025-11-27','Milk',96,'tea_coffee'],
  ['2025-11-27','Match box',10,'office'],
  ['2025-11-28','Milk',96,'tea_coffee'],
  ['2025-11-29','Milk',96,'tea_coffee'],
  ['2025-11-29','Birthday Cake',925,'welfare'],
  ['2025-11-30','Milk',32,'tea_coffee'],
  ['2025-11-30','Foolwala',1200,'office'],
];

async function main() {
  let total = 0;
  for (const [date, title, amount, cat] of expenses) {
    await p.expenseClaim.create({
      data: {
        userId,
        title,
        category: catMap[cat],
        amount,
        date,
        status: 'approved',
        reviewedBy: adminId,
        reviewedAt: new Date(date),
      }
    });
    total += amount;
  }
  console.log('Added ' + expenses.length + ' expense claims. Total: Rs.' + total);
}

main().then(() => p.$disconnect());
