/**
 * Recalculate All User Levels Script
 *
 * Updates all user levels using the new exponential formula:
 * level = FLOOR(SQRT(xp / 50))
 *
 * Run with: bun run scripts/recalculate-levels.ts
 */

import prisma from '../src/db/client';
import { Prisma } from '@prisma/client';
import { BASE_XP } from '@vyrejack/shared';

async function recalculateLevels() {
  console.log('🔄 Recalculating all user levels...');
  console.log(`   Formula: level = FLOOR(SQRT(xp / ${BASE_XP}))`);

  // Get count before update
  const userCount = await prisma.user.count();
  console.log(`   Found ${userCount} users`);

  // Show some examples of what will change
  const samples = await prisma.user.findMany({
    select: { walletAddress: true, xp: true, level: true },
    take: 5,
    orderBy: { xp: 'desc' },
  });

  console.log('\n📊 Sample changes:');
  console.log('   Wallet           | XP      | Old Level | New Level');
  console.log('   ' + '-'.repeat(55));

  for (const user of samples) {
    const newLevel = Math.floor(Math.sqrt(user.xp / BASE_XP));
    const truncAddr = `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`;
    console.log(
      `   ${truncAddr.padEnd(17)} | ${String(user.xp).padEnd(7)} | ${String(user.level).padEnd(9)} | ${newLevel}`
    );
  }

  // Perform the update
  console.log('\n🚀 Updating all levels...');

  const result = await prisma.$executeRaw(
    Prisma.sql`
      UPDATE "User"
      SET level = FLOOR(SQRT(xp / ${BASE_XP}))
    `
  );

  console.log(`✅ Updated ${result} users`);

  // Verify some results
  const verifyUsers = await prisma.user.findMany({
    select: { walletAddress: true, xp: true, level: true },
    take: 5,
    orderBy: { xp: 'desc' },
  });

  console.log('\n✅ Verification (top 5 by XP):');
  console.log('   Wallet           | XP      | Level');
  console.log('   ' + '-'.repeat(40));

  for (const user of verifyUsers) {
    const truncAddr = `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`;
    console.log(`   ${truncAddr.padEnd(17)} | ${String(user.xp).padEnd(7)} | ${user.level}`);
  }

  console.log('\n🎉 Level recalculation complete!');
}

recalculateLevels()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
