const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const userId = 25, adminId = 1;
const cat = { t:'tea_coffee', o:'office_expenses', r:'repair_maintenance', d:'diesel_petrol', w:'staff_welfare' };
const e = [
['2026-01-02','Milk',96,'t'],['2026-01-02','Munciple sweeper',500,'o'],
['2026-01-03','Milk',96,'t'],['2026-01-05','Milk',96,'t'],
['2026-01-05','Ravechi Stationery (Tea Cup)',1900,'t'],
['2026-01-05','Munciple labour (Water leakage)',400,'r'],
['2026-01-06','Milk',96,'t'],['2026-01-07','Milk',96,'t'],['2026-01-08','Milk',96,'t'],
['2026-01-09','Milk',96,'t'],['2026-01-10','Milk',96,'t'],['2026-01-10','Discount Buzzer',900,'o'],
['2026-01-11','Milk',32,'t'],['2026-01-12','Milk',96,'t'],['2026-01-13','Milk',96,'t'],
['2026-01-13','Ginger',50,'t'],['2026-01-14','Milk',96,'t'],['2026-01-14','Lamination',15,'o'],
['2026-01-14','Activa Petrol',462,'d'],['2026-01-15','Milk',64,'t'],
['2026-01-15','Evening Tea',70,'t'],['2026-01-16','Milk',64,'t'],
['2026-01-16','Mobile Recharge (9867787395)',199,'o'],['2026-01-17','Milk',64,'t'],
['2026-01-17','Mahataja Plastic',400,'o'],['2026-01-18','Milk',32,'t'],
['2026-01-19','Milk',96,'t'],['2026-01-20','Milk',96,'t'],['2026-01-20','D-Mart',535,'o'],
['2026-01-21','Milk',96,'t'],['2026-01-22','Milk',64,'t'],['2026-01-23','Milk',64,'t'],
['2026-01-23','Water Tanker',1400,'o'],['2026-01-23','Jodhpur Sweet',1080,'w'],
['2026-01-24','Milk',64,'t'],['2026-01-24','Flag & Glue dots',100,'w'],
['2026-01-24','Maharaj Sweet',600,'w'],['2026-01-27','Milk',96,'t'],['2026-01-27','Ginger',50,'t'],
['2026-01-28','Milk',96,'t'],['2026-01-29','Milk',96,'t'],['2026-01-29','Activa Petrol',475,'t'],
['2026-01-30','Milk',96,'t'],['2026-01-30','TDS Challan',70,'o'],['2026-01-31','Milk',128,'t'],
['2026-01-31','Season Hotel',7000,'o'],['2026-01-31','Jeden Cake',1280,'w'],
['2026-01-31','Carpenter work',200,'r'],['2026-01-31','Lunch (CTAS Team)',1375,'o'],
['2026-01-31','Evening Snack (CTAS Team)',165,'o'],['2026-01-31','Lunch (CTAS Team)',120,'o'],
['2026-01-31','Foolwala',1200,'o'],
];
async function main() {
  let total = 0;
  for (const [date,title,amount,c] of e) {
    await p.expenseClaim.create({ data: { userId, title, category: cat[c], amount, date, status:'approved', reviewedBy:adminId, reviewedAt:new Date(date) } });
    total += amount;
  }
  console.log('Added ' + e.length + ' expenses. Total: Rs.' + total);
}
main().then(() => p.$disconnect());
