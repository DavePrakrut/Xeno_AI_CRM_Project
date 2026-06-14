import { Router, Request, Response } from 'express';
import { prisma } from '../database/prisma';
import { AIService } from '../services/ai.service';
import { ChannelType, DeliveryStatus, ReceiptCallbackPayload } from '../types';
import axios from 'axios';

const router = Router();
const aiService = new AIService();

// Get channel cost per message
function getChannelCost(channel: string): number {
  switch (channel) {
    case 'WhatsApp': return 0.08;
    case 'SMS': return 0.02;
    case 'RCS': return 0.05;
    case 'Email': return 0.002;
    default: return 0.01;
  }
}

/**
 * 1. POST /api/data/ingest
 * Seed/Ingest customer and order data.
 */
router.post('/data/ingest', async (req: Request, res: Response) => {
  try {
    console.log('[CRM] Ingesting seed data...');
    
    // Clear existing data to be idempotent
    await prisma.communicationLog.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.campaign.deleteMany({});
    await prisma.customer.deleteMany({});

    const now = new Date();
    const daysAgo = (num: number) => new Date(now.getTime() - num * 24 * 60 * 60 * 1000);

    // Seed Customers
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
      await prisma.customer.create({
        data: cust
      });
    }

    const customerCount = await prisma.customer.count();
    const orderCount = await prisma.order.count();

    console.log(`[CRM] Seeding complete. Ingested ${customerCount} customers and ${orderCount} orders.`);
    res.status(201).json({
      message: 'Database seeded successfully',
      customersIngested: customerCount,
      ordersIngested: orderCount
    });
  } catch (error: any) {
    console.error('[CRM] Ingestion error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 2. POST /api/campaigns
 * Create a campaign and define segment parameters using AI.
 */
router.post('/campaigns', async (req: Request, res: Response) => {
  const { aiPrompt } = req.body;

  if (!aiPrompt) {
    return res.status(400).json({ error: 'Missing parameter: aiPrompt' });
  }

  try {
    console.log(`[CRM AI Goal Parsing] Prompt: "${aiPrompt}"`);
    const parsedCampaign = await aiService.parseCampaignGoal(aiPrompt);
    console.log(`[CRM AI Result] Campaign Name: "${parsedCampaign.name}"`);

    const campaign = await prisma.campaign.create({
      data: {
        name: parsedCampaign.name,
        aiPrompt: aiPrompt,
        goal: parsedCampaign.goal,
        segmentDefinition: JSON.stringify(parsedCampaign.segmentDefinition)
      }
    });

    res.status(201).json({
      message: 'Campaign created and goal parsed successfully',
      campaign,
      suggestedCopyTemplate: parsedCampaign.suggestedCopyTemplate
    });
  } catch (error: any) {
    console.error('[CRM] Create Campaign error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 3. POST /api/campaigns/:id/send
 * Segment target group, generate personalized messages, and call Channel Service.
 */
router.post('/campaigns/:id/send', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { channel = 'WhatsApp', suggestedCopyTemplate } = req.body;

  try {
    const campaignId = parseInt(id, 10);
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const segmentDef = JSON.parse(campaign.segmentDefinition);
    const conditions = segmentDef.conditions || [];

    // Fetch all customers & orders to filter matching target segment
    const customers = await prisma.customer.findMany({ include: { orders: { orderBy: { purchasedAt: 'desc' } } } });
    const matchedCustomers: typeof customers = [];

    const now = new Date();

    for (const customer of customers) {
      let matchesAllConditions = true;
      const metadata = JSON.parse(customer.metadata || '{}');

      // Calculate helper metrics
      const lastOrder = customer.orders[0];
      const lastPurchaseDays = lastOrder
        ? Math.floor((now.getTime() - new Date(lastOrder.purchasedAt).getTime()) / (1000 * 60 * 60 * 24))
        : 9999; // Never bought = infinity days

      const totalSpend = customer.orders.reduce((sum, o) => sum + o.amount, 0);

      for (const cond of conditions) {
        const { field, operator, value } = cond;

        if (field === 'lastPurchaseDays') {
          if (operator === 'greaterThan' && !(lastPurchaseDays > value)) matchesAllConditions = false;
          if (operator === 'lessThan' && !(lastPurchaseDays < value)) matchesAllConditions = false;
          if (operator === 'equals' && !(lastPurchaseDays === value)) matchesAllConditions = false;
        } else if (field === 'totalSpend') {
          if (operator === 'greaterThan' && !(totalSpend > value)) matchesAllConditions = false;
          if (operator === 'lessThan' && !(totalSpend < value)) matchesAllConditions = false;
        } else if (field === 'tier') {
          if (operator === 'equals' && metadata.tier !== value) matchesAllConditions = false;
        } else if (field === 'purchasedItem') {
          const hasItem = customer.orders.some(o => o.itemPurchased.toLowerCase().includes(value.toLowerCase()));
          if (operator === 'contains' && !hasItem) matchesAllConditions = false;
        } else if (field === 'all') {
          // 'all' condition matches everyone
        }
      }

      if (matchesAllConditions) {
        matchedCustomers.push(customer);
      }
    }

    console.log(`[CRM Segment] Campaign "${campaign.name}" matched ${matchedCustomers.length} shoppers.`);

    if (matchedCustomers.length === 0) {
      return res.status(200).json({ message: 'Campaign sent to 0 recipients (segment empty)', sentCount: 0 });
    }

    // Default template fallback if not passed in request
    const template = suggestedCopyTemplate || "Hi {{name}}! Check out our new products.";
    
    // Update campaign status
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'IN_PROGRESS' }
    });

    const host = req.headers.host || `localhost:${process.env.PORT_CRM || 3008}`;
    const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const isSingleService = !!process.env.VERCEL || process.env.SINGLE_SERVICE === 'true';

    const channelUrl = isSingleService 
      ? `${protocol}://${host}/api/channel/send`
      : `http://localhost:${process.env.PORT_CHANNEL || 3009}/api/channel/send`;
      
    const callbackUrl = isSingleService
      ? `${protocol}://${host}/api/receipts/callback`
      : `http://localhost:${process.env.PORT_CRM || 3008}/api/receipts/callback`;

    // Process and dispatch messages asynchronously
    const dispatchPromises = matchedCustomers.map(async (customer) => {
      const lastOrder = customer.orders[0];
      const lastItem = lastOrder ? lastOrder.itemPurchased : '';
      const metadata = JSON.parse(customer.metadata || '{}');
      const customerTier = metadata.tier || 'Bronze';

      // 1. Generate personalization copy
      const personalizedBody = await aiService.generatePersonalizedCopy(
        customer.name,
        lastItem,
        customerTier,
        template,
        campaign.aiPrompt
      );

      // 2. Create local CommunicationLog as PENDING
      const log = await prisma.communicationLog.create({
        data: {
          recipient: channel === 'Email' ? customer.email : customer.phone,
          messageBody: personalizedBody,
          channel: channel as ChannelType,
          status: 'PENDING',
          campaignId: campaign.id,
          customerId: customer.id
        }
      });

      // 3. Dispatch to Channel Service
      try {
        const response = await axios.post(channelUrl, {
          messageId: String(log.id),
          recipient: log.recipient,
          body: log.messageBody,
          channel: log.channel as ChannelType,
          callbackUrl: callbackUrl
        });

        // 4. Update with external Message ID & set to SENT
        const { externalMessageId } = response.data;
        await prisma.communicationLog.update({
          where: { id: log.id },
          data: {
            externalMessageId: externalMessageId,
            status: 'SENT'
          }
        });
      } catch (err: any) {
        console.error(`[CRM Send Error] Failed to transmit message log ID ${log.id} to Channel:`, err.message);
        await prisma.communicationLog.update({
          where: { id: log.id },
          data: { status: 'FAILED' }
        });
      }
    });

    // We do NOT block the HTTP thread for the full simulation, but await the initial queueing
    await Promise.all(dispatchPromises);

    res.status(200).json({
      message: `Successfully queued and dispatched campaign to ${matchedCustomers.length} recipients`,
      recipientCount: matchedCustomers.length
    });
  } catch (error: any) {
    console.error('[CRM Send Campaign Error]:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 4. POST /api/receipts/callback
 * Webhook called by the Channel Service to notify CRM about delivery outcomes.
 */
router.post('/receipts/callback', async (req: Request, res: Response) => {
  const payload = req.body as ReceiptCallbackPayload;

  if (!payload.messageId || !payload.status) {
    return res.status(400).json({ error: 'Missing required webhook parameters: messageId, status' });
  }

  try {
    const log = await prisma.communicationLog.findUnique({
      where: { externalMessageId: payload.messageId }
    });

    if (!log) {
      console.warn(`[CRM Callback Warning] Callback received for unknown external message ID: ${payload.messageId}`);
      return res.status(404).json({ error: 'Communication log not found' });
    }

    console.log(`[CRM Webhook Recv] Updating Log ID ${log.id} to ${payload.status}`);

    // If status is CONVERTED, ingest the purchase order and attribute it
    if (payload.status === 'CONVERTED' && payload.conversionOrder) {
      const { amount, itemPurchased } = payload.conversionOrder;
      
      console.log(`[CRM Attribution] Attributing purchase from Customer ID ${log.customerId}: $${amount} for ${itemPurchased}`);
      
      await prisma.order.create({
        data: {
          customerId: log.customerId,
          amount,
          itemPurchased,
          purchasedAt: new Date(payload.timestamp)
        }
      });
    }

    // Update log status
    await prisma.communicationLog.update({
      where: { id: log.id },
      data: {
        status: payload.status,
        updatedAt: new Date(payload.timestamp)
      }
    });

    // Check if campaign is fully completed (all logs are in terminal states: FAILED, CLICKED, CONVERTED, or OPENED/READ if they didn't proceed)
    // To keep it simple, if no logs are PENDING or SENT, we can mark campaign as COMPLETED
    const remainingActive = await prisma.communicationLog.count({
      where: {
        campaignId: log.campaignId,
        status: { in: ['PENDING', 'SENT'] }
      }
    });

    if (remainingActive === 0) {
      await prisma.campaign.update({
        where: { id: log.campaignId },
        data: { status: 'COMPLETED' }
      });
      console.log(`[CRM Campaign] Campaign ID ${log.campaignId} marked as COMPLETED.`);
    }

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[CRM Webhook Error]:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 5. GET /api/campaigns/:id/insights
 * Return delivery funnel conversion metrics and attributed ROI.
 */
router.get('/campaigns/:id/insights', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const campaignId = parseInt(id, 10);
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { communicationLogs: true }
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const logs = campaign.communicationLogs;
    const sentCount = logs.filter(l => l.status !== 'PENDING').length;
    
    // Funnel counts (cumulative progression)
    const failedCount = logs.filter(l => l.status === 'FAILED').length;
    const deliveredCount = logs.filter(l => ['DELIVERED', 'OPENED', 'READ', 'CLICKED', 'CONVERTED'].includes(l.status)).length;
    const openedCount = logs.filter(l => ['OPENED', 'READ', 'CLICKED', 'CONVERTED'].includes(l.status)).length;
    const clickedCount = logs.filter(l => ['CLICKED', 'CONVERTED'].includes(l.status)).length;
    const convertedCount = logs.filter(l => l.status === 'CONVERTED').length;

    // Financial analysis
    let totalCost = 0;
    logs.forEach(log => {
      if (log.status !== 'PENDING') {
        totalCost += getChannelCost(log.channel);
      }
    });

    // Sum conversion values directly attributed via CONVERTED callback logs
    // In our callback, we attribute conversions by adding a new order. 
    // To calculate ROI precisely, we look at the count of conversions * the average conversion value,
    // or sum the conversion order amounts directly. Since the channel service callback sends the amount, 
    // we can sum the customer's orders created at the time of conversion.
    // For simplicity and exact accuracy, we can look up the orders that were created around the same timestamp as the conversion log,
    // or calculate it using our logs.
    // Let's query orders for matched customers created at/after the conversion timestamp.
    // A clean approach: We can look at conversion logs, and since we know which orders were created during conversions,
    // we can fetch the orders created by converted customers at the exact conversion log updatedAt timestamp,
    // or we can aggregate the revenue directly.
    // Let's do a direct calculation: for each converted log, find the order of the customer purchased within a 5-second window of log.updatedAt.
    const conversionLogs = logs.filter(l => l.status === 'CONVERTED');
    let totalRevenue = 0;
    const conversionDetails: any[] = [];

    for (const log of conversionLogs) {
      // Find the order that was created
      const order = await prisma.order.findFirst({
        where: {
          customerId: log.customerId,
          purchasedAt: {
            gte: new Date(log.updatedAt.getTime() - 5000), // 5s buffer
            lte: new Date(log.updatedAt.getTime() + 5000)
          }
        }
      });
      if (order) {
        totalRevenue += order.amount;
        conversionDetails.push({
          customerName: await prisma.customer.findUnique({ where: { id: log.customerId } }).then(c => c?.name),
          itemPurchased: order.itemPurchased,
          amount: order.amount,
          timestamp: order.purchasedAt
        });
      }
    }

    const netProfit = totalRevenue - totalCost;
    const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;

    // Rates calculation (safeguard division by zero)
    const deliveryRate = sentCount > 0 ? (deliveredCount / sentCount) * 100 : 0;
    const openRate = deliveredCount > 0 ? (openedCount / deliveredCount) * 100 : 0;
    const clickThroughRate = openedCount > 0 ? (clickedCount / openedCount) * 100 : 0;
    const conversionRate = clickedCount > 0 ? (convertedCount / clickedCount) * 100 : 0;

    res.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        aiPrompt: campaign.aiPrompt,
        status: campaign.status,
        createdAt: campaign.createdAt
      },
      funnel: {
        sent: sentCount,
        failed: failedCount,
        delivered: deliveredCount,
        opened: openedCount,
        clicked: clickedCount,
        converted: convertedCount
      },
      rates: {
        deliveryRate: parseFloat(deliveryRate.toFixed(2)),
        openRate: parseFloat(openRate.toFixed(2)),
        clickThroughRate: parseFloat(clickThroughRate.toFixed(2)),
        conversionRate: parseFloat(conversionRate.toFixed(2))
      },
      financials: {
        totalCost: parseFloat(totalCost.toFixed(4)),
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        netProfit: parseFloat(netProfit.toFixed(2)),
        roi: parseFloat(roi.toFixed(2))
      },
      conversions: conversionDetails
    });

  } catch (error: any) {
    console.error('[CRM Insights Error]:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 6. GET /api/customers
 * Retrieve all customers with their orders and computed lifetime value.
 */
router.get('/customers', async (req: Request, res: Response) => {
  try {
    const customers = await prisma.customer.findMany({
      include: {
        orders: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    const formattedCustomers = customers.map(customer => {
      const orders = customer.orders;
      const totalSpend = orders.reduce((sum, o) => sum + o.amount, 0);
      const metadata = JSON.parse(customer.metadata || '{}');
      return {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        tier: metadata.tier || 'Bronze',
        location: metadata.location || 'Unknown',
        age: metadata.age || null,
        orderCount: orders.length,
        totalSpend: parseFloat(totalSpend.toFixed(2)),
        orders
      };
    });

    res.json({ customers: formattedCustomers });
  } catch (error: any) {
    console.error('[CRM Get Customers Error]:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 7. GET /api/campaigns
 * Retrieve all campaigns.
 */
router.get('/campaigns', async (req: Request, res: Response) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({ campaigns });
  } catch (error: any) {
    console.error('[CRM Get Campaigns Error]:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
