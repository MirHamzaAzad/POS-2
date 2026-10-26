import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const sales = await prisma.sale.findMany({ select: { id: true, invoice_number: true, created_at: true, branch_id: true }});
  console.dir(sales, { depth: null });
  
  const today = new Date();
  console.log("today is", today);
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  console.log("dateStr", dateStr);
  const count = await prisma.sale.count({
    where: {
      created_at: {
        gte: new Date(today.setHours(0, 0, 0, 0)),
        lt: new Date(today.setHours(23, 59, 59, 999)),
      },
    },
  });
  console.log("count is", count);
}

main().finally(() => prisma.$disconnect());
