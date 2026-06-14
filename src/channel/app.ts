import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { ChannelSendRequest, DeliveryStatus, ReceiptCallbackPayload } from '../types';

const app = express();
app.use(express.json());
app.use(cors());

// In-memory log of messages sent through the channel for auditability/debugging
const messageLogs: any[] = [];

app.get('/api/channel/logs', (req, res) => {
  res.json({ logs: messageLogs });
});

app.post('/api/channel/send', async (req, res) => {
  const payload = req.body as ChannelSendRequest;

  // Validate request
  if (!payload.messageId || !payload.recipient || !payload.body || !payload.channel || !payload.callbackUrl) {
    console.error('[Channel] Invalid payload received:', payload);
    return res.status(400).json({ error: 'Missing required parameters: messageId, recipient, body, channel, callbackUrl' });
  }

  const externalMessageId = `ext_${Math.random().toString(36).substring(2, 11)}`;
  console.log(`[Channel] Message ${payload.messageId} accepted. Assigned external ID: ${externalMessageId}`);

  // Push to local log
  messageLogs.push({
    messageId: payload.messageId,
    externalMessageId,
    recipient: payload.recipient,
    body: payload.body,
    channel: payload.channel,
    timestamp: new Date().toISOString()
  });

  if (process.env.VERCEL) {
    // Await simulation before responding on Vercel to prevent environment freezing
    await simulateLifecycle(payload, externalMessageId);
    res.status(202).json({
      status: 'queued',
      externalMessageId
    });
  } else {
    // Respond immediately with 202 Accepted
    res.status(202).json({
      status: 'queued',
      externalMessageId
    });

    // Start background simulation
    simulateLifecycle(payload, externalMessageId);
  }
});

/**
 * Simulates a realistic delivery funnel for the message.
 * Returns a Promise that resolves when the simulation completes.
 */
function simulateLifecycle(req: ChannelSendRequest, externalMessageId: string): Promise<void> {
  return new Promise<void>(async (resolve) => {
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    // Helper to send webhooks back to CRM Receipt API
    const triggerCallback = async (status: DeliveryStatus, conversionOrder?: any, error?: string) => {
      const callbackPayload: ReceiptCallbackPayload = {
        messageId: externalMessageId, // We callback using the external message ID we generated and returned to CRM
        status,
        timestamp: new Date().toISOString(),
        ...(error && { error }),
        ...(conversionOrder && { conversionOrder })
      };

      try {
        console.log(`[Channel Callback] Dispatching ${status} for external ID: ${externalMessageId}`);
        await axios.post(req.callbackUrl, callbackPayload, {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err: any) {
        console.error(`[Channel Callback Error] Failed to send webhook to CRM: ${err.message}`);
      }
    };

    try {
      // 1. Queue -> Sent (150ms delay)
      await delay(150);
      const isSent = Math.random() < 0.98; // 98% sent rate
      if (!isSent) {
        await triggerCallback('FAILED', undefined, 'Carrier queue timeout');
        return;
      }
      await triggerCallback('SENT');

      // 2. Sent -> Delivered (200ms delay)
      await delay(200);
      const isDelivered = Math.random() < 0.95; // 95% delivery rate
      if (!isDelivered) {
        await triggerCallback('FAILED', undefined, 'Undeliverable number / handset offline');
        return;
      }
      await triggerCallback('DELIVERED');

      // 3. Delivered -> Opened/Read (300ms delay)
      await delay(300);
      // Realistic open rates: WhatsApp/RCS = 85%, SMS = 65%, Email = 32%
      let openProb = 0.85;
      if (req.channel === 'SMS') openProb = 0.65;
      if (req.channel === 'Email') openProb = 0.32;

      const isOpened = Math.random() < openProb;
      if (!isOpened) return;

      const openStatus: DeliveryStatus = (req.channel === 'WhatsApp' || req.channel === 'RCS') ? 'READ' : 'OPENED';
      await triggerCallback(openStatus);

      // 4. Opened/Read -> Clicked (400ms delay)
      await delay(400);
      // Realistic Click-Through Rates (CTR): WhatsApp/RCS = 35%, SMS = 12%, Email = 6%
      let clickProb = 0.35;
      if (req.channel === 'SMS') clickProb = 0.12;
      if (req.channel === 'Email') clickProb = 0.06;

      const isClicked = Math.random() < clickProb;
      if (!isClicked) return;
      await triggerCallback('CLICKED');

      // 5. Clicked -> Converted (500ms delay)
      await delay(500);
      // Realistic conversion rates of clicked users: WhatsApp/RCS = 22%, SMS = 15%, Email = 10%
      let convertProb = 0.22;
      if (req.channel === 'SMS') convertProb = 0.15;
      if (req.channel === 'Email') convertProb = 0.10;

      const isConverted = Math.random() < convertProb;
      if (!isConverted) return;

      // Determine simulated transaction details to return on conversion
      const items = ['Premium Leather Shoes', 'Designer Bag', 'Minimalist Watch', 'Summer Dress', 'Denim Jeans'];
      const itemPurchased = items[Math.floor(Math.random() * items.length)];
      const amount = Math.floor(Math.random() * 120) + 40; // $40 to $160

      await triggerCallback('CONVERTED', {
        amount,
        itemPurchased
      });

    } catch (err: any) {
      console.error(`[Channel Simulation Crash] messageId: ${externalMessageId}`, err.message);
    } finally {
      resolve();
    }
  });
}

export default app;
