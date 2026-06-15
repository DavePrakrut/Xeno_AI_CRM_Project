import os from 'os';
import path from 'path';
import fs from 'fs';

// Use /tmp for serverless Vercel environment, local tmp folder for development
const TEMP_DIR = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'tmp');

const CUSTOMERS_FILE = path.join(TEMP_DIR, 'customers.csv');
const ORDERS_FILE = path.join(TEMP_DIR, 'orders.csv');
const CAMPAIGNS_FILE = path.join(TEMP_DIR, 'campaigns.csv');
const LOGS_FILE = path.join(TEMP_DIR, 'logs.csv');

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  metadata: string; // JSON string of { tier, location, age }
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: number;
  customerId: number;
  amount: number;
  itemPurchased: string;
  purchasedAt: Date;
}

export interface Campaign {
  id: number;
  name: string;
  aiPrompt: string;
  goal: string;
  segmentDefinition: string; // JSON string
  status: string; // DRAFT, IN_PROGRESS, COMPLETED
  createdAt: Date;
}

export interface CommunicationLog {
  id: number;
  recipient: string;
  messageBody: string;
  channel: string;
  status: string;
  timestamp: Date;
  campaignId: number;
  customerId: number;
  externalMessageId: string | null;
  updatedAt: Date;
}

let isInitialized = false;

async function init(): Promise<void> {
  if (isInitialized) return;

  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  const srcCustomers = path.join(process.cwd(), 'data/customers.csv');
  const srcOrders = path.join(process.cwd(), 'data/orders.csv');

  // Copy customers
  if (!fs.existsSync(CUSTOMERS_FILE)) {
    if (fs.existsSync(srcCustomers)) {
      fs.copyFileSync(srcCustomers, CUSTOMERS_FILE);
      console.log('[csvDb] Initialized customers.csv in temp directory.');
    } else {
      fs.writeFileSync(CUSTOMERS_FILE, 'id,name,email,phone,tier,location,age\n', 'utf-8');
    }
  }

  // Copy orders
  if (!fs.existsSync(ORDERS_FILE)) {
    if (fs.existsSync(srcOrders)) {
      fs.copyFileSync(srcOrders, ORDERS_FILE);
      console.log('[csvDb] Initialized orders.csv in temp directory.');
    } else {
      fs.writeFileSync(ORDERS_FILE, 'id,customerId,amount,itemPurchased,purchasedAt\n', 'utf-8');
    }
  }

  // Initialize empty campaigns file
  if (!fs.existsSync(CAMPAIGNS_FILE)) {
    fs.writeFileSync(CAMPAIGNS_FILE, 'id,name,aiPrompt,goal,segmentDefinition,status,createdAt\n', 'utf-8');
  }

  // Initialize empty logs file
  if (!fs.existsSync(LOGS_FILE)) {
    fs.writeFileSync(LOGS_FILE, 'id,recipient,messageBody,channel,status,timestamp,campaignId,customerId,externalMessageId,updatedAt\n', 'utf-8');
  }

  isInitialized = true;
}

function parseCSVRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i++; // Skip the escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(content: string): string[][] {
  if (!content.trim()) return [];
  const lines = content.split(/\r?\n/);
  return lines
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(parseCSVRow);
}

function toCSVRow(arr: any[]): string {
  return arr.map(val => {
    if (val === null || val === undefined) return '';
    let str = '';
    if (val instanceof Date) {
      str = val.toISOString();
    } else {
      str = String(val);
    }
    const escaped = str.replace(/"/g, '""');
    if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
      return `"${escaped}"`;
    }
    return escaped;
  }).join(',');
}

// Reader functions
async function readCustomers(): Promise<Customer[]> {
  await init();
  const content = fs.readFileSync(CUSTOMERS_FILE, 'utf-8');
  const rows = parseCSV(content);
  if (rows.length <= 1) return [];
  return rows.slice(1).map(row => {
    const id = parseInt(row[0], 10);
    const name = row[1];
    const email = row[2];
    const phone = row[3];
    const tier = row[4] || 'Bronze';
    const location = row[5] || 'Unknown';
    const age = row[6] ? parseInt(row[6], 10) : null;
    const metadata = JSON.stringify({ tier, location, age });
    return {
      id,
      name,
      email,
      phone,
      metadata,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  });
}

async function writeCustomers(customers: Customer[]): Promise<void> {
  const headers = ['id', 'name', 'email', 'phone', 'tier', 'location', 'age'];
  const rows: any[][] = [headers];
  for (const c of customers) {
    const metaObj = JSON.parse(c.metadata || '{}');
    rows.push([
      c.id,
      c.name,
      c.email,
      c.phone,
      metaObj.tier || 'Bronze',
      metaObj.location || 'Unknown',
      metaObj.age || ''
    ]);
  }
  const csvContent = rows.map(toCSVRow).join('\n') + '\n';
  fs.writeFileSync(CUSTOMERS_FILE, csvContent, 'utf-8');
}

async function readRawOrders(): Promise<Order[]> {
  await init();
  const content = fs.readFileSync(ORDERS_FILE, 'utf-8');
  const rows = parseCSV(content);
  if (rows.length <= 1) return [];
  return rows.slice(1).map(row => ({
    id: parseInt(row[0], 10),
    customerId: parseInt(row[1], 10),
    amount: parseFloat(row[2]),
    itemPurchased: row[3],
    purchasedAt: new Date(row[4])
  }));
}

async function readOrders(): Promise<Order[]> {
  const orders = await readRawOrders();
  const now = Date.now();
  return orders.filter(o => o.purchasedAt.getTime() <= now);
}

async function writeOrders(orders: Order[]): Promise<void> {
  const headers = ['id', 'customerId', 'amount', 'itemPurchased', 'purchasedAt'];
  const rows: any[][] = [headers];
  for (const o of orders) {
    rows.push([
      o.id,
      o.customerId,
      o.amount,
      o.itemPurchased,
      o.purchasedAt.toISOString()
    ]);
  }
  const csvContent = rows.map(toCSVRow).join('\n') + '\n';
  fs.writeFileSync(ORDERS_FILE, csvContent, 'utf-8');
}

async function readCampaigns(): Promise<Campaign[]> {
  await init();
  const content = fs.readFileSync(CAMPAIGNS_FILE, 'utf-8');
  const rows = parseCSV(content);
  if (rows.length <= 1) return [];
  const now = Date.now();
  return rows.slice(1).map(row => {
    const id = parseInt(row[0], 10);
    const name = row[1];
    const aiPrompt = row[2];
    const goal = row[3];
    const segmentDefinition = row[4];
    const savedStatus = row[5];
    const createdAt = new Date(row[6]);

    let status = savedStatus;
    if (savedStatus === 'IN_PROGRESS' && (now - createdAt.getTime() >= 1550)) {
      status = 'COMPLETED';
    }

    return {
      id,
      name,
      aiPrompt,
      goal,
      segmentDefinition,
      status,
      createdAt
    };
  });
}

async function writeCampaigns(campaigns: Campaign[]): Promise<void> {
  const headers = ['id', 'name', 'aiPrompt', 'goal', 'segmentDefinition', 'status', 'createdAt'];
  const rows: any[][] = [headers];
  for (const c of campaigns) {
    rows.push([
      c.id,
      c.name,
      c.aiPrompt,
      c.goal,
      c.segmentDefinition,
      c.status,
      c.createdAt.toISOString()
    ]);
  }
  const csvContent = rows.map(toCSVRow).join('\n') + '\n';
  fs.writeFileSync(CAMPAIGNS_FILE, csvContent, 'utf-8');
}

async function readLogs(): Promise<CommunicationLog[]> {
  await init();
  const content = fs.readFileSync(LOGS_FILE, 'utf-8');
  const rows = parseCSV(content);
  if (rows.length <= 1) return [];
  const now = new Date();
  return rows.slice(1).map(row => {
    const id = parseInt(row[0], 10);
    const recipient = row[1];
    const messageBody = row[2];
    const channel = row[3];
    const savedStatus = row[4];
    const timestamp = new Date(row[5]);
    const campaignId = parseInt(row[6], 10);
    const customerId = parseInt(row[7], 10);
    const externalMessageId = row[8] || null;
    const updatedAt = new Date(row[9]);

    const elapsedMs = now.getTime() - timestamp.getTime();
    let status = savedStatus;

    if (savedStatus !== 'PENDING') {
      if (savedStatus === 'FAILED') {
        if (elapsedMs < 150) status = 'PENDING';
      } else {
        if (elapsedMs < 150) {
          status = 'PENDING';
        } else if (elapsedMs < 350) {
          status = 'SENT';
        } else if (elapsedMs < 650) {
          status = 'DELIVERED';
        } else if (elapsedMs < 1050) {
          const openStatus = (channel === 'WhatsApp' || channel === 'RCS') ? 'READ' : 'OPENED';
          status = ['OPENED', 'READ', 'CLICKED', 'CONVERTED'].includes(savedStatus) ? openStatus : savedStatus;
        } else if (elapsedMs < 1550) {
          status = ['CLICKED', 'CONVERTED'].includes(savedStatus) ? 'CLICKED' : savedStatus;
        }
      }
    }

    return {
      id,
      recipient,
      messageBody,
      channel,
      status,
      timestamp,
      campaignId,
      customerId,
      externalMessageId,
      updatedAt
    };
  });
}

async function writeLogs(logs: CommunicationLog[]): Promise<void> {
  const headers = [
    'id', 'recipient', 'messageBody', 'channel', 'status',
    'timestamp', 'campaignId', 'customerId', 'externalMessageId', 'updatedAt'
  ];
  const rows: any[][] = [headers];
  for (const l of logs) {
    rows.push([
      l.id,
      l.recipient,
      l.messageBody,
      l.channel,
      l.status,
      l.timestamp.toISOString(),
      l.campaignId,
      l.customerId,
      l.externalMessageId || '',
      l.updatedAt.toISOString()
    ]);
  }
  const csvContent = rows.map(toCSVRow).join('\n') + '\n';
  fs.writeFileSync(LOGS_FILE, csvContent, 'utf-8');
}

// Database API Methods

export async function clearAll(): Promise<void> {
  await init();
  fs.writeFileSync(CUSTOMERS_FILE, 'id,name,email,phone,tier,location,age\n', 'utf-8');
  fs.writeFileSync(ORDERS_FILE, 'id,customerId,amount,itemPurchased,purchasedAt\n', 'utf-8');
  fs.writeFileSync(CAMPAIGNS_FILE, 'id,name,aiPrompt,goal,segmentDefinition,status,createdAt\n', 'utf-8');
  fs.writeFileSync(LOGS_FILE, 'id,recipient,messageBody,channel,status,timestamp,campaignId,customerId,externalMessageId,updatedAt\n', 'utf-8');
}

export async function createCustomer(data: { name: string; email: string; phone: string; metadata: string }): Promise<Customer> {
  const customers = await readCustomers();
  const nextId = customers.reduce((max, c) => Math.max(max, c.id), 0) + 1;
  const newCustomer: Customer = {
    id: nextId,
    name: data.name,
    email: data.email,
    phone: data.phone,
    metadata: data.metadata,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  customers.push(newCustomer);
  await writeCustomers(customers);
  return newCustomer;
}

export async function createOrder(data: { customerId: number; amount: number; itemPurchased: string; purchasedAt: Date }): Promise<Order> {
  const orders = await readRawOrders();
  const nextId = orders.reduce((max, o) => Math.max(max, o.id), 0) + 1;
  const newOrder: Order = {
    id: nextId,
    customerId: data.customerId,
    amount: data.amount,
    itemPurchased: data.itemPurchased,
    purchasedAt: data.purchasedAt
  };
  orders.push(newOrder);
  await writeOrders(orders);
  return newOrder;
}

export async function countCustomers(): Promise<number> {
  const customers = await readCustomers();
  return customers.length;
}

export async function countOrders(): Promise<number> {
  const orders = await readOrders();
  return orders.length;
}

export async function createCampaign(data: { name: string; aiPrompt: string; goal: string; segmentDefinition: string }): Promise<Campaign> {
  const campaigns = await readCampaigns();
  const nextId = campaigns.reduce((max, c) => Math.max(max, c.id), 0) + 1;
  const newCampaign: Campaign = {
    id: nextId,
    name: data.name,
    aiPrompt: data.aiPrompt,
    goal: data.goal,
    segmentDefinition: data.segmentDefinition,
    status: 'DRAFT',
    createdAt: new Date()
  };
  campaigns.push(newCampaign);
  await writeCampaigns(campaigns);
  return newCampaign;
}

export async function findCampaignById(id: number): Promise<Campaign | null> {
  const campaigns = await readCampaigns();
  return campaigns.find(c => c.id === id) || null;
}

export async function findCustomersWithOrders(options?: { orderBy?: { name?: 'asc' | 'desc' } }): Promise<(Customer & { orders: Order[] })[]> {
  const customers = await readCustomers();
  const orders = await readOrders();

  const ordersMap: Record<number, Order[]> = {};
  for (const o of orders) {
    if (!ordersMap[o.customerId]) {
      ordersMap[o.customerId] = [];
    }
    ordersMap[o.customerId].push(o);
  }

  for (const cid in ordersMap) {
    ordersMap[cid].sort((a, b) => b.purchasedAt.getTime() - a.purchasedAt.getTime());
  }

  const result = customers.map(c => ({
    ...c,
    orders: ordersMap[c.id] || []
  }));

  if (options?.orderBy?.name === 'asc') {
    result.sort((a, b) => a.name.localeCompare(b.name));
  }

  return result;
}

export async function updateCampaignStatus(id: number, status: string): Promise<Campaign | null> {
  const campaigns = await readCampaigns();
  const index = campaigns.findIndex(c => c.id === id);
  if (index === -1) return null;
  campaigns[index].status = status;
  await writeCampaigns(campaigns);
  return campaigns[index];
}

export async function createCommunicationLog(data: {
  recipient: string;
  messageBody: string;
  channel: string;
  status: string;
  campaignId: number;
  customerId: number;
}): Promise<CommunicationLog> {
  const logs = await readLogs();
  const nextId = logs.reduce((max, l) => Math.max(max, l.id), 0) + 1;
  const newLog: CommunicationLog = {
    id: nextId,
    recipient: data.recipient,
    messageBody: data.messageBody,
    channel: data.channel,
    status: data.status,
    timestamp: new Date(),
    campaignId: data.campaignId,
    customerId: data.customerId,
    externalMessageId: null,
    updatedAt: new Date()
  };
  logs.push(newLog);
  await writeLogs(logs);
  return newLog;
}

export async function updateCommunicationLog(id: number, data: { externalMessageId?: string | null; status?: string; updatedAt?: Date }): Promise<CommunicationLog | null> {
  const logs = await readLogs();
  const index = logs.findIndex(l => l.id === id);
  if (index === -1) return null;
  if (data.externalMessageId !== undefined) logs[index].externalMessageId = data.externalMessageId;
  if (data.status !== undefined) logs[index].status = data.status;
  logs[index].updatedAt = data.updatedAt || new Date();
  await writeLogs(logs);
  return logs[index];
}

export async function findCommunicationLogByExternalId(externalId: string): Promise<CommunicationLog | null> {
  const logs = await readLogs();
  return logs.find(l => l.externalMessageId === externalId) || null;
}

export async function countActiveLogsForCampaign(campaignId: number): Promise<number> {
  const logs = await readLogs();
  return logs.filter(l => l.campaignId === campaignId && ['PENDING', 'SENT'].includes(l.status)).length;
}

export async function findCampaignWithLogs(id: number): Promise<(Campaign & { communicationLogs: CommunicationLog[] }) | null> {
  const camp = await findCampaignById(id);
  if (!camp) return null;
  const logs = await readLogs();
  const campLogs = logs.filter(l => l.campaignId === id);
  return {
    ...camp,
    communicationLogs: campLogs
  };
}

export async function findFirstOrder(customerId: number, gte: Date, lte: Date): Promise<Order | null> {
  const orders = await readOrders();
  return orders.find(o => 
    o.customerId === customerId && 
    o.purchasedAt.getTime() >= gte.getTime() && 
    o.purchasedAt.getTime() <= lte.getTime()
  ) || null;
}

export async function findCustomerById(id: number): Promise<Customer | null> {
  const customers = await readCustomers();
  return customers.find(c => c.id === id) || null;
}

export async function findCampaigns(options?: { orderBy?: { createdAt?: 'asc' | 'desc' } }): Promise<Campaign[]> {
  const campaigns = await readCampaigns();
  if (options?.orderBy?.createdAt === 'desc') {
    campaigns.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } else if (options?.orderBy?.createdAt === 'asc') {
    campaigns.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
  return campaigns;
}

export async function seedFromTemplates(): Promise<void> {
  await init();
  fs.writeFileSync(CAMPAIGNS_FILE, 'id,name,aiPrompt,goal,segmentDefinition,status,createdAt\n', 'utf-8');
  fs.writeFileSync(LOGS_FILE, 'id,recipient,messageBody,channel,status,timestamp,campaignId,customerId,externalMessageId,updatedAt\n', 'utf-8');

  const srcCustomers = path.join(process.cwd(), 'data/customers.csv');
  const srcOrders = path.join(process.cwd(), 'data/orders.csv');

  if (fs.existsSync(srcCustomers)) {
    fs.copyFileSync(srcCustomers, CUSTOMERS_FILE);
  }
  if (fs.existsSync(srcOrders)) {
    fs.copyFileSync(srcOrders, ORDERS_FILE);
  }
}

export async function createCommunicationLogs(logsData: {
  recipient: string;
  messageBody: string;
  channel: string;
  status: string;
  campaignId: number;
  customerId: number;
}[]): Promise<CommunicationLog[]> {
  const logs = await readLogs();
  let nextId = logs.reduce((max, l) => Math.max(max, l.id), 0) + 1;

  const newLogs: CommunicationLog[] = logsData.map(data => ({
    id: nextId++,
    recipient: data.recipient,
    messageBody: data.messageBody,
    channel: data.channel,
    status: data.status,
    timestamp: new Date(),
    campaignId: data.campaignId,
    customerId: data.customerId,
    externalMessageId: `ext_${Math.random().toString(36).substring(2, 11)}`,
    updatedAt: new Date()
  }));

  logs.push(...newLogs);
  await writeLogs(logs);
  return newLogs;
}

export async function createOrders(ordersData: {
  customerId: number;
  amount: number;
  itemPurchased: string;
  purchasedAt: Date;
}[]): Promise<Order[]> {
  const orders = await readRawOrders();
  let nextId = orders.reduce((max, o) => Math.max(max, o.id), 0) + 1;

  const newOrders: Order[] = ordersData.map(data => ({
    id: nextId++,
    customerId: data.customerId,
    amount: data.amount,
    itemPurchased: data.itemPurchased,
    purchasedAt: data.purchasedAt
  }));

  orders.push(...newOrders);
  await writeOrders(orders);
  return newOrders;
}

export async function syncCampaignsLogsAndOrders(
  clientCampaigns: any[],
  clientLogs: any[],
  clientOrders: any[]
): Promise<void> {
  // 1. Sync Campaigns
  if (clientCampaigns && clientCampaigns.length > 0) {
    const existingCampaigns = await readCampaigns();
    const existingCampaignIds = new Set(existingCampaigns.map(c => c.id));
    
    let campaignsUpdated = false;
    for (const cc of clientCampaigns) {
      const existingCampaign = existingCampaigns.find(c => c.id === cc.id);
      if (!existingCampaign) {
        existingCampaigns.push({
          id: cc.id,
          name: cc.name,
          aiPrompt: cc.aiPrompt,
          goal: cc.goal,
          segmentDefinition: cc.segmentDefinition,
          status: cc.status,
          createdAt: new Date(cc.createdAt)
        });
        existingCampaignIds.add(cc.id);
        campaignsUpdated = true;
      } else if (existingCampaign.status !== cc.status) {
        existingCampaign.status = cc.status;
        campaignsUpdated = true;
      }
    }
    if (campaignsUpdated) {
      await writeCampaigns(existingCampaigns);
    }
  }

  // 2. Sync Logs
  if (clientLogs && clientLogs.length > 0) {
    const existingLogs = await readLogs();
    const existingLogKeys = new Set(existingLogs.map(l => `${l.campaignId}_${l.customerId}`));
    
    let logsUpdated = false;
    let nextLogId = existingLogs.reduce((max, l) => Math.max(max, l.id), 0) + 1;
    for (const cl of clientLogs) {
      const key = `${cl.campaignId}_${cl.customerId}`;
      const existingLog = existingLogs.find(l => `${l.campaignId}_${l.customerId}` === key);
      if (!existingLog) {
        existingLogs.push({
          id: cl.id || nextLogId++,
          recipient: cl.recipient,
          messageBody: cl.messageBody,
          channel: cl.channel,
          status: cl.status,
          timestamp: new Date(cl.timestamp || cl.updatedAt || Date.now()),
          campaignId: cl.campaignId,
          customerId: cl.customerId,
          externalMessageId: cl.externalMessageId || null,
          updatedAt: new Date(cl.updatedAt || Date.now())
        });
        existingLogKeys.add(key);
        logsUpdated = true;
      } else if (existingLog.status !== cl.status) {
        existingLog.status = cl.status;
        existingLog.updatedAt = new Date(cl.updatedAt || Date.now());
        logsUpdated = true;
      }
    }
    if (logsUpdated) {
      await writeLogs(existingLogs);
    }
  }

  // 3. Sync Orders
  if (clientOrders && clientOrders.length > 0) {
    const existingOrders = await readRawOrders();
    const existingOrderKeys = new Set(existingOrders.map(o => `${o.customerId}_${o.amount}_${o.itemPurchased}_${new Date(o.purchasedAt).getTime()}`));
    
    let ordersUpdated = false;
    let nextOrderId = existingOrders.reduce((max, o) => Math.max(max, o.id), 0) + 1;
    for (const co of clientOrders) {
      const pDate = new Date(co.purchasedAt);
      const key = `${co.customerId}_${co.amount}_${co.itemPurchased}_${pDate.getTime()}`;
      if (!existingOrderKeys.has(key)) {
        existingOrders.push({
          id: co.id || nextOrderId++,
          customerId: co.customerId,
          amount: parseFloat(co.amount),
          itemPurchased: co.itemPurchased,
          purchasedAt: pDate
        });
        existingOrderKeys.add(key);
        ordersUpdated = true;
      }
    }
    if (ordersUpdated) {
      await writeOrders(existingOrders);
    }
  }
}
