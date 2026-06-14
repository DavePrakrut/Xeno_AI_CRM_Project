export type ChannelType = 'WhatsApp' | 'SMS' | 'Email' | 'RCS';

export type DeliveryStatus = 
  | 'PENDING' 
  | 'SENT' 
  | 'DELIVERED' 
  | 'FAILED' 
  | 'OPENED' 
  | 'READ' 
  | 'CLICKED' 
  | 'CONVERTED';

export interface CustomerMetadata {
  tags?: string[];
  gender?: string;
  age?: number;
  location?: string;
  tier?: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  [key: string]: any;
}

export interface SegmentDefinition {
  conditions: {
    field: 'lastPurchaseDays' | 'totalSpend' | 'tier' | 'purchasedItem' | 'all';
    operator: 'equals' | 'greaterThan' | 'lessThan' | 'contains' | 'any';
    value: any;
  }[];
}

export interface ChannelSendRequest {
  messageId: string;
  recipient: string;
  body: string;
  channel: ChannelType;
  callbackUrl: string;
}

export interface ReceiptCallbackPayload {
  messageId: string;
  status: DeliveryStatus;
  timestamp: string;
  error?: string;
  // If conversion happens, order details might be attached
  conversionOrder?: {
    amount: number;
    itemPurchased: string;
  };
}
