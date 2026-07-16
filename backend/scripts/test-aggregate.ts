import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const aggregate = await prisma.analytics.aggregate({
      where: { userId: 'does-not-exist' },
      _sum: { emailsReceived: true },
      _max: { storageUsedBytes: true }
    });
    console.log("SUCCESS:", aggregate);
  } catch (err) {
    console.error("ERROR:", err);
  } finally {
    await prisma.$disconnect();
  }
}
main();
