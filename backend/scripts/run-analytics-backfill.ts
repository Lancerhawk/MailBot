declare const process: any;
import { PrismaClient } from '@prisma/client';
import { AnalyticsBackfillService } from '../src/modules/analytics/services/analytics-backfill.service';

const prisma = new PrismaClient();

async function main() {
  const startTime = Date.now();

  const targetUserId = process.argv[2];

  console.log(`Starting REAL Analytics Backfill script for ${targetUserId ? `user ${targetUserId}` : 'all users'}...`);

  try {
    const users = targetUserId
      ? [{ id: targetUserId }]
      : await prisma.user.findMany({ select: { id: true } });

    console.log(`Found ${users.length} users to process.`);

    let failures = 0;

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      console.log(`[${i + 1}/${users.length}] Purging fake data and rebuilding REAL analytics for user: ${user.id}`);
      try {
        await prisma.analytics.deleteMany({
          where: { userId: user.id }
        });

        await AnalyticsBackfillService.runBackfill(user.id);

      } catch (err) {
        console.error(`Error processing user ${user.id}:`, err);
        failures++;
      }
    }

    const executionTimeMs = Date.now() - startTime;

    console.log('\n--- BACKFILL SUMMARY ---');
    console.log(`Users Processed:     ${users.length}`);
    console.log(`Failures:            ${failures}`);
    console.log(`Total Execution Time: ${(executionTimeMs / 1000).toFixed(2)}s`);
    console.log('------------------------\n');

    if (failures > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('Failed to run backfill script:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
