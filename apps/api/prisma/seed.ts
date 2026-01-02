/**
 * Prisma Seed Script
 * Seeds the database with initial required data
 */

import prisma from '../src/db/client';

async function main() {
  console.log('🌱 Seeding database...');

  // Seed Chain data
  const riseTestnet = await prisma.chain.upsert({
    where: { id: 713715 },
    update: {},
    create: {
      id: 713715,
      name: 'Rise Testnet',
      slug: 'rise',
      rpcUrl: 'https://testnet.risechain.com',
      explorerUrl: 'https://testnet.explorer.risechain.com',
      currency: 'ETH',
      isActive: true,
    },
  });

  console.log('✅ Created chain:', riseTestnet.name);

  // Optional: Add more chains
  const arbitrum = await prisma.chain.upsert({
    where: { id: 42161 },
    update: {},
    create: {
      id: 42161,
      name: 'Arbitrum',
      slug: 'arbitrum',
      rpcUrl: 'https://arb1.arbitrum.io/rpc',
      explorerUrl: 'https://arbiscan.io',
      currency: 'ETH',
      isActive: false, // Not active yet
    },
  });

  console.log('✅ Created chain:', arbitrum.name);

  console.log('🌱 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
