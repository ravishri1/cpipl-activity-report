const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const userId = 25, adminId = 1;
const cat = { t:'tea_coffee', o:'office_expenses', r:'repair_maintenance', d:'diesel_petrol', w:'staff_welfare' };
const e = [
['2025-12-01','Milk',96,'t'],['2025-12-01','Munciple sweeper',500,'o'],
['2025-12-02','Milk',96,'t'],['2025-12-03','Milk',96,'t'],['2025-12-04','Milk',96,'t'],
['2025-12-05','Tea',300,'t'],['2025-12-06','Activa Wash',60,'o'],['2025-12-06','milk',96,'t'],
['2025-12-06','Ravechi Stationery (Tissue Rolls)',1400,'r'],
['2025-12-07','Milk',64,'t'],['2025-12-07','Haar',60,'o'],
['2025-12-07','Mira Plastic (Packing Materials)',2360,'o'],
['2025-12-08','Milk',96,'t'],['2025-12-08','Sandwizzaa (Devloper Snacks)',475,'t'],
['2025-12-08','Samadhan (Devloper Dinner)',1954,'t'],
['2025-12-09','Milk',96,'t'],['2025-12-10','Milk',96,'t'],['2025-12-10','Activa petrol',458,'d'],
['2025-12-11','Milk',96,'t'],['2025-12-12','Milk',96,'t'],['2025-12-12','D-Mart',49,'o'],
['2025-12-12','Bouquet',500,'o'],['2025-12-13','Milk',64,'t'],['2025-12-13','Ginger',50,'t'],
['2025-12-15','Milk',96,'t'],['2025-12-15','TwoDots software service',117,'o'],
['2025-12-15','Happy Sellers Software',235,'o'],
['2025-12-16','Milk',96,'t'],['2025-12-17','Milk',96,'t'],['2025-12-17','Milan Xerox',300,'o'],
['2025-12-18','Milk',96,'t'],['2025-12-18','Activa petrol',335,'d'],
['2025-12-19','Milk',96,'t'],['2025-12-19','Platic Tie-up',160,'o'],
['2025-12-19','Fsons Enterprises',450,'o'],
['2025-12-20','Milk',96,'t'],['2025-12-22','Milk',96,'t'],
['2025-12-22','Metro Electric & Hardware',1240,'o'],['2025-12-22','Shree Bhairavnath Electric',740,'o'],
['2025-12-22','Electricision Charges',500,'o'],['2025-12-22','Glue Dots',80,'o'],
['2025-12-23','Milk',96,'t'],['2025-12-23','D-Mart',408,'o'],
['2025-12-23','Jeden Cake Shop (Christmas)',2080,'w'],['2025-12-23','Evening Snacks (Meeting)',250,'o'],
['2025-12-24','Milk',96,'t'],['2025-12-24','Banglore Iyangar Bakery',800,'w'],
['2025-12-26','Milk',128,'t'],['2025-12-26','V-Fast',50,'o'],
['2025-12-27','Milk',96,'t'],['2025-12-27','200 ml Water Bottle',600,'o'],
['2025-12-27','Evening Snacks (Meeting)',150,'o'],
['2025-12-28','milk',32,'t'],['2025-12-29','Milk',96,'t'],['2025-12-29','Activa petrol',510,'d'],
['2025-12-29','Tea (Daya sir Guest)',40,'t'],
['2025-12-30','Milk',96,'t'],['2025-12-30','Ginger',50,'t'],
['2025-12-30','Carpenter (Bani Boutique Door)',200,'r'],
['2025-12-31','Milk',96,'t'],['2025-12-31','Broom',200,'o'],
['2025-12-31','New year cake',1480,'w'],['2025-12-31','Monthly birthday Cake',665,'w'],
['2025-12-31','Snacks',600,'w'],['2025-12-31','Foolwala',1200,'o'],
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
