import { Router, Request, Response } from 'express';
import * as csvDb from '../database/csvDb';
import { AIService } from '../services/ai.service';
import { ChannelType, DeliveryStatus, ReceiptCallbackPayload } from '../types';
import axios from 'axios';

const router = Router();
const aiService = new AIService();

// Get channel cost per message (realistic system-wide cost including carrier fees and platform overhead)
function getChannelCost(channel: string): number {
  switch (channel) {
    case 'WhatsApp': return 1.50;
    case 'SMS': return 0.50;
    case 'RCS': return 1.00;
    case 'Email': return 0.10;
    default: return 0.25;
  }
}

// Simulated final outcome generator based on Channel Service statistics
function simulateFinalStatus(channel: string): { status: string; error?: string; conversionOrder?: { amount: number; itemPurchased: string } } {
  // 1. Sent
  if (Math.random() >= 0.98) {
    return { status: 'FAILED', error: 'Carrier queue timeout' };
  }
  // 2. Delivered
  if (Math.random() >= 0.95) {
    return { status: 'FAILED', error: 'Undeliverable number / handset offline' };
  }
  // 3. Opened/Read
  let openProb = 0.85;
  if (channel === 'SMS') openProb = 0.65;
  if (channel === 'Email') openProb = 0.32;
  if (Math.random() >= openProb) {
    return { status: 'DELIVERED' };
  }
  const openStatus = (channel === 'WhatsApp' || channel === 'RCS') ? 'READ' : 'OPENED';

  // 4. Clicked
  let clickProb = 0.35;
  if (channel === 'SMS') clickProb = 0.12;
  if (channel === 'Email') clickProb = 0.06;
  if (Math.random() >= clickProb) {
    return { status: openStatus };
  }

  // 5. Converted
  let convertProb = 0.22;
  if (channel === 'SMS') convertProb = 0.15;
  if (channel === 'Email') convertProb = 0.10;
  if (Math.random() >= convertProb) {
    return { status: 'CLICKED' };
  }

  const items = ['Premium Leather Shoes', 'Designer Bag', 'Minimalist Watch', 'Summer Dress', 'Denim Jeans'];
  const itemPurchased = items[Math.floor(Math.random() * items.length)];
  const amount = Math.floor(Math.random() * 120) + 40; // $40 to $160

  return {
    status: 'CONVERTED',
    conversionOrder: { amount, itemPurchased }
  };
}

/**
 * 1. POST /api/data/ingest
 * Seed/Ingest customer and order data.
 */
router.post('/data/ingest', async (req: Request, res: Response) => {
  try {
    console.log('[CRM] Ingesting seed data from CSV templates...');
    await csvDb.seedFromTemplates();

    const customerCount = await csvDb.countCustomers();
    const orderCount = await csvDb.countOrders();

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

    const campaign = await csvDb.createCampaign({
      name: parsedCampaign.name,
      aiPrompt: aiPrompt,
      goal: parsedCampaign.goal,
      segmentDefinition: JSON.stringify(parsedCampaign.segmentDefinition)
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
    const campaign = await csvDb.findCampaignById(campaignId);

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const segmentDef = JSON.parse(campaign.segmentDefinition);
    const conditions = segmentDef.conditions || [];

    // Fetch all customers & orders to filter matching target segment
    const customers = await csvDb.findCustomersWithOrders();
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
    await csvDb.updateCampaignStatus(campaignId, 'IN_PROGRESS');

    const host = req.headers.host || `localhost:${process.env.PORT_CRM || 3008}`;
    const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const isSingleService = !!process.env.VERCEL || process.env.SINGLE_SERVICE === 'true';

    const channelUrl = isSingleService 
      ? `${protocol}://${host}/api/channel/send`
      : `http://localhost:${process.env.PORT_CHANNEL || 3009}/api/channel/send`;
      
    const callbackUrl = isSingleService
      ? `${protocol}://${host}/api/receipts/callback`
      : `http://localhost:${process.env.PORT_CRM || 3008}/api/receipts/callback`;

    // 1. Generate personalization copies concurrently
    const logsToCreate = await Promise.all(matchedCustomers.map(async (customer) => {
      const lastOrder = customer.orders[0];
      const lastItem = lastOrder ? lastOrder.itemPurchased : '';
      const metadata = JSON.parse(customer.metadata || '{}');
      const customerTier = metadata.tier || 'Bronze';

      const personalizedBody = await aiService.generatePersonalizedCopy(
        customer.name,
        lastItem,
        customerTier,
        template,
        campaign.aiPrompt
      );

      const outcome = simulateFinalStatus(channel);

      return {
        recipient: channel === 'Email' ? customer.email : customer.phone,
        messageBody: personalizedBody,
        channel: channel as ChannelType,
        status: outcome.status,
        campaignId: campaign.id,
        customerId: customer.id,
        conversionOrder: outcome.status === 'CONVERTED' ? outcome.conversionOrder : null
      };
    }));

    // 2. Separate into logs and orders lists
    const finalLogs = logsToCreate.map(item => ({
      recipient: item.recipient,
      messageBody: item.messageBody,
      channel: item.channel,
      status: item.status,
      campaignId: item.campaignId,
      customerId: item.customerId
    }));

    const finalOrders = logsToCreate
      .filter(item => item.conversionOrder !== null)
      .map(item => ({
        customerId: item.customerId,
        amount: item.conversionOrder!.amount,
        itemPurchased: item.conversionOrder!.itemPurchased,
        purchasedAt: new Date(Date.now() + 1600)
      }));

    // 3. Perform batch database writes in a single disk operation each!
    if (finalLogs.length > 0) {
      await csvDb.createCommunicationLogs(finalLogs);
    }
    if (finalOrders.length > 0) {
      await csvDb.createOrders(finalOrders);
    }

    // 4. Trigger fire-and-forget dispatches (optional fallback)
    for (const log of logsToCreate) {
      try {
        axios.post(channelUrl, {
          messageId: `ext_${Math.random().toString(36).substring(2, 11)}`,
          recipient: log.recipient,
          body: log.messageBody,
          channel: log.channel as ChannelType,
          callbackUrl: callbackUrl
        }).catch(() => {});
      } catch (err) {}
    }

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
 * Webhook callback kept for compatibility (redundant under dynamic time-sliced engine, but resolves database callbacks if called)
 */
router.post('/receipts/callback', async (req: Request, res: Response) => {
  const payload = req.body as ReceiptCallbackPayload;

  if (!payload.messageId || !payload.status) {
    return res.status(400).json({ error: 'Missing required webhook parameters: messageId, status' });
  }

  try {
    const log = await csvDb.findCommunicationLogByExternalId(payload.messageId);
    if (!log) {
      return res.status(200).json({ message: 'Log not found or already processed' });
    }

    if (payload.status === 'CONVERTED' && payload.conversionOrder) {
      const { amount, itemPurchased } = payload.conversionOrder;
      await csvDb.createOrder({
        customerId: log.customerId,
        amount,
        itemPurchased,
        purchasedAt: new Date(payload.timestamp)
      });
    }

    await csvDb.updateCommunicationLog(log.id, {
      status: payload.status,
      updatedAt: new Date(payload.timestamp)
    });

    const remainingActive = await csvDb.countActiveLogsForCampaign(log.campaignId);
    if (remainingActive === 0) {
      await csvDb.updateCampaignStatus(log.campaignId, 'COMPLETED');
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
    const campaign = await csvDb.findCampaignWithLogs(campaignId);

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

    const conversionLogs = logs.filter(l => l.status === 'CONVERTED');
    let totalRevenue = 0;
    const conversionDetails: any[] = [];

    for (const log of conversionLogs) {
      const order = await csvDb.findFirstOrder(
        log.customerId,
        new Date(log.updatedAt.getTime() - 5000),
        new Date(log.updatedAt.getTime() + 5000)
      );
      if (order) {
        totalRevenue += order.amount;
        const customer = await csvDb.findCustomerById(log.customerId);
        conversionDetails.push({
          customerName: customer ? customer.name : 'Unknown',
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
    const customers = await csvDb.findCustomersWithOrders({
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
    const campaigns = await csvDb.findCampaigns({
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
