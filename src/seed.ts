import { prisma } from './database/prisma';

async function seed() {
  console.log('[CLI Seed] Seeding database directly via Prisma...');
  
  // Clear database
  await prisma.communicationLog.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.campaign.deleteMany({});
  await prisma.customer.deleteMany({});

  const now = new Date();
  const daysAgo = (num: number) => new Date(now.getTime() - num * 24 * 60 * 60 * 1000);

  const customersData = [
    {
      name: 'Sarah Jenkins',
      email: 'sarah.j@example.com',
      phone: '+15550201',
      metadata: JSON.stringify({ tier: 'Gold', location: 'London', age: 32 }),
      orders: {
        create: [
          { amount: 180.00, itemPurchased: 'Premium Leather Boots', purchasedAt: daysAgo(12) },
          { amount: 240.00, itemPurchased: 'Wool Trench Coat', purchasedAt: daysAgo(45) }
        ]
      }
    },
    {
      name: 'Marcus Aurelius',
      email: 'marcus@example.com',
      phone: '+15550202',
      metadata: JSON.stringify({ tier: 'Platinum', location: 'Rome', age: 45 }),
      orders: {
        create: [
          { amount: 350.00, itemPurchased: 'Espresso Machine', purchasedAt: daysAgo(90) },
          { amount: 45.00, itemPurchased: 'Coffee Beans Blend', purchasedAt: daysAgo(5) }
        ]
      }
    },
    {
      name: 'Chloe Henderson',
      email: 'chloe.h@example.com',
      phone: '+15550203',
      metadata: JSON.stringify({ tier: 'Silver', location: 'Paris', age: 26 }),
      orders: {
        create: [
          { amount: 145.00, itemPurchased: 'Silk Summer Dress', purchasedAt: daysAgo(75) }
        ]
      }
    },
    {
      name: 'David Kim',
      email: 'david.k@example.com',
      phone: '+15550204',
      metadata: JSON.stringify({ tier: 'Bronze', location: 'Seoul', age: 29 }),
      orders: {
        create: [
          { amount: 95.00, itemPurchased: 'White Sneakers', purchasedAt: daysAgo(15) },
          { amount: 35.00, itemPurchased: 'Cotton T-Shirt', purchasedAt: daysAgo(15) }
        ]
      }
    },
    {
      name: 'Aisha Rahman',
      email: 'aisha.r@example.com',
      phone: '+15550205',
      metadata: JSON.stringify({ tier: 'Gold', location: 'Dubai', age: 31 }),
      orders: {
        create: [
          { amount: 220.00, itemPurchased: 'Designer Sunglasses', purchasedAt: daysAgo(80) },
          { amount: 130.00, itemPurchased: 'Perfume Oud', purchasedAt: daysAgo(3) }
        ]
      }
    },
    {
      name: 'Liam O\'Connor',
      email: 'liam.o@example.com',
      phone: '+15550206',
      metadata: JSON.stringify({ tier: 'Silver', location: 'Dublin', age: 35 }),
      orders: {
        create: [
          { amount: 65.00, itemPurchased: 'Leather Wallet', purchasedAt: daysAgo(120) }
        ]
      }
    },
    {
      name: 'Emma Watson',
      email: 'emma.w@example.com',
      phone: '+15550207',
      metadata: JSON.stringify({ tier: 'Platinum', location: 'New York', age: 28 }),
      orders: {
        create: [
          { amount: 450.00, itemPurchased: 'Diamond Ring', purchasedAt: daysAgo(65) },
          { amount: 300.00, itemPurchased: 'Pearl Necklace', purchasedAt: daysAgo(2) }
        ]
      }
    },
    {
      name: 'Carlos Santana',
      email: 'carlos.s@example.com',
      phone: '+15550208',
      metadata: JSON.stringify({ tier: 'Bronze', location: 'Madrid', age: 50 }),
      orders: {
        create: [
          { amount: 290.00, itemPurchased: 'Acoustic Guitar', purchasedAt: daysAgo(180) }
        ]
      }
    },
    {
      name: 'Yuki Tanaka',
      email: 'yuki.t@example.com',
      phone: '+15550209',
      metadata: JSON.stringify({ tier: 'Gold', location: 'Tokyo', age: 24 }),
      orders: {
        create: [
          { amount: 110.00, itemPurchased: 'Oversized Hoodie', purchasedAt: daysAgo(8) },
          { amount: 120.00, itemPurchased: 'Denim Jeans', purchasedAt: daysAgo(8) }
        ]
      }
    },
    {
      name: 'Olivia Martinez',
      email: 'olivia.m@example.com',
      phone: '+15550210',
      metadata: JSON.stringify({ tier: 'Bronze', location: 'Los Angeles', age: 33 }),
      orders: {
        create: [
          { amount: 48.00, itemPurchased: 'Lipstick Trio', purchasedAt: daysAgo(25) }
        ]
      }
    },
    {
      name: 'Alexander Carter',
      email: 'alex.c@example.com',
      phone: '+15550211',
      metadata: JSON.stringify({ tier: 'Silver', location: 'Toronto', age: 40 }),
      orders: {
        create: [
          { amount: 85.00, itemPurchased: 'Fleece Jacket', purchasedAt: daysAgo(60) }
        ]
      }
    },
    {
      name: 'Fiona Gallagher',
      email: 'fiona@example.com',
      phone: '+15550106',
      metadata: JSON.stringify({ tier: 'Bronze', location: 'Chicago', age: 23 }),
      orders: {
        create: []
      }
    },
    {
      name: 'George Clooney',
      email: 'george@example.com',
      phone: '+15550107',
      metadata: JSON.stringify({ tier: 'Platinum', location: 'Seattle', age: 50 }),
      orders: {
        create: [
          { amount: 320.00, itemPurchased: 'Smart Watch', purchasedAt: daysAgo(2) }
        ]
      }
    },
    {
      name: 'Hannah Abbott',
      email: 'hannah@example.com',
      phone: '+15550108',
      metadata: JSON.stringify({ tier: 'Silver', location: 'Austin', age: 31 }),
      orders: {
        create: [
          { amount: 95.00, itemPurchased: 'Leather Bag', purchasedAt: daysAgo(62) }
        ]
      }
    },
    {
      name: 'Alice Johnson',
      email: 'alice@example.com',
      phone: '+15550101',
      metadata: JSON.stringify({ tier: 'Gold', location: 'New York', age: 29 }),
      orders: {
        create: [
          { amount: 120.00, itemPurchased: 'Running Shoes', purchasedAt: daysAgo(45) }
        ]
      }
    }
  ];

  for (const cust of customersData) {
    await prisma.customer.create({ data: cust });
  }

  const customerCount = await prisma.customer.count();
  const orderCount = await prisma.order.count();
  console.log(`[CLI Seed] Completed. Seeded ${customerCount} customers and ${orderCount} orders.`);
}

seed()
  .catch((e) => {
    console.error('[CLI Seed Error]', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
