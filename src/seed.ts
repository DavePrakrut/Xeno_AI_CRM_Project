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
      name: 'Alice Johnson',
      email: 'alice@example.com',
      phone: '+15550101',
      metadata: JSON.stringify({ tier: 'Gold', location: 'New York', age: 29 }),
      orders: {
        create: [
          { amount: 120.00, itemPurchased: 'Running Shoes', purchasedAt: daysAgo(45) }
        ]
      }
    },
    {
      name: 'Bob Smith',
      email: 'bob@example.com',
      phone: '+15550102',
      metadata: JSON.stringify({ tier: 'Bronze', location: 'Chicago', age: 34 }),
      orders: {
        create: [
          { amount: 45.00, itemPurchased: 'Gym T-Shirt', purchasedAt: daysAgo(15) }
        ]
      }
    },
    {
      name: 'Charlie Davis',
      email: 'charlie@example.com',
      phone: '+15550103',
      metadata: JSON.stringify({ tier: 'Platinum', location: 'San Francisco', age: 42 }),
      orders: {
        create: [
          { amount: 250.00, itemPurchased: 'Smart Watch', purchasedAt: daysAgo(75) }
        ]
      }
    },
    {
      name: 'Diana Prince',
      email: 'diana@example.com',
      phone: '+15550104',
      metadata: JSON.stringify({ tier: 'Silver', location: 'Los Angeles', age: 28 }),
      orders: {
        create: [
          { amount: 85.00, itemPurchased: 'Floral Dress', purchasedAt: daysAgo(5) }
        ]
      }
    },
    {
      name: 'Ethan Hunt',
      email: 'ethan@example.com',
      phone: '+15550105',
      metadata: JSON.stringify({ tier: 'Gold', location: 'Miami', age: 38 }),
      orders: {
        create: [
          { amount: 130.00, itemPurchased: 'Running Shoes', purchasedAt: daysAgo(90) }
        ]
      }
    },
    {
      name: 'Fiona Gallagher',
      email: 'fiona@example.com',
      phone: '+15550106',
      metadata: JSON.stringify({ tier: 'Bronze', location: 'Boston', age: 23 }),
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
