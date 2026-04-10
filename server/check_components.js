const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const comps = await prisma.salaryComponent.findMany({ orderBy:[{type:'asc'},{sortOrder:'asc'}] });
  console.log('ALL SalaryComponents in DB (' + comps.length + ' total):');
  comps.forEach(c => console.log('  id:'+c.id+' '+c.code.padEnd(22)+' type:'+c.type.padEnd(10)+' isSystem:'+String(c.isSystem).padEnd(5)+' isActive:'+c.isActive+' name:'+c.name));

  const structs = await prisma.salaryStructure.findMany({ select:{userId:true, components:true} });
  const usedCodes = new Set();
  structs.forEach(s => {
    if(s.components && Array.isArray(s.components)){
      s.components.forEach(c => { if(c.code) usedCodes.add(c.code); });
    }
  });
  console.log('\nCodes used in salary structures (' + usedCodes.size + '):', [...usedCodes].sort().join(', '));
  console.log('Total salary structures:', structs.length);
}

main()
  .catch(e => { console.error(e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
