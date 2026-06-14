import { GoogleGenerativeAI } from '@google/generative-ai';
import { SegmentDefinition } from '../types';

interface ParsedCampaign {
  name: string;
  goal: string;
  segmentDefinition: SegmentDefinition;
  suggestedCopyTemplate: string;
}

export class AIService {
  private genAI: any | null = null;
  private isMockMode: boolean = true;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey.trim() !== '') {
      try {
        // Correct initialization for modern @google/generative-ai
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.isMockMode = false;
        console.log('AI Service initialized in GEMINI API mode.');
      } catch (err) {
        console.warn('Failed to initialize Gemini API Client, falling back to mock mode:', err);
        this.isMockMode = true;
      }

    } else {
      console.log('No GEMINI_API_KEY found. Running in MOCK AI mode.');
      this.isMockMode = true;
    }
  }

  /**
   * Translates a natural language campaign goal into a structured campaign setup.
   */
  async parseCampaignGoal(prompt: string): Promise<ParsedCampaign> {
    if (this.isMockMode) {
      return this.mockParseCampaignGoal(prompt);
    }

    try {
      const model = this.genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: { responseMimeType: "application/json" }
      });
      
      const systemInstruction = `
        You are an elite product architect and marketing AI agent. 
        Your task is to parse a marketing goal prompt from a user and return a JSON object with:
        1. "name": A catchy campaign name (e.g., "Win-back Shoe Shoppers")
        2. "goal": A brief slug/goal identifier (e.g., "win_back_inactive_buyers")
        3. "segmentDefinition": A structured SegmentDefinition object matching this structure:
           {
             "conditions": [
               {
                 "field": "lastPurchaseDays" | "totalSpend" | "tier" | "purchasedItem" | "all",
                 "operator": "equals" | "greaterThan" | "lessThan" | "contains" | "any",
                 "value": any (string, number, boolean)
               }
             ]
           }
        4. "suggestedCopyTemplate": A template message with placeholders like {{name}}, {{lastItemPurchased}} to customize.

        Examples:
        - "Win back customers who haven't bought anything in 60 days":
          {
            "name": "60-Day Re-engagement",
            "goal": "win_back_60_days",
            "segmentDefinition": {
              "conditions": [{ "field": "lastPurchaseDays", "operator": "greaterThan", "value": 60 }]
            },
            "suggestedCopyTemplate": "Hey {{name}}! We notice it's been a while since your last order. Grab 10% off your next purchase with code WINBACK10!"
          }
        - "Promote new accessories to Gold tier VIPs who bought Shoes":
          {
            "name": "Gold Tier Shoe Lovers Accessories",
            "goal": "vip_shoes_accessories",
            "segmentDefinition": {
              "conditions": [
                { "field": "tier", "operator": "equals", "value": "Gold" },
                { "field": "purchasedItem", "operator": "contains", "value": "Shoes" }
              ]
            },
            "suggestedCopyTemplate": "Hi {{name}}, as one of our VIPs, we thought you would love to pair your last purchase of {{lastItemPurchased}} with our new matching laces! Use VIPLACE for free shipping."
          }
      `;

      const response = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: `Parse this prompt: "${prompt}"` }] }],
        systemInstruction: systemInstruction
      });

      const text = response.response.text();
      return JSON.parse(text) as ParsedCampaign;
    } catch (error) {
      console.error('Gemini API call failed, using mock parser fallback:', error);
      return this.mockParseCampaignGoal(prompt);
    }
  }

  /**
   * Generates a highly personalized message for a customer based on their characteristics and the campaign prompt/template.
   */
  async generatePersonalizedCopy(
    customerName: string,
    lastItem: string,
    tier: string,
    template: string,
    aiPrompt: string
  ): Promise<string> {
    if (this.isMockMode) {
      return this.mockGeneratePersonalizedCopy(customerName, lastItem, tier, template, aiPrompt);
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = `
        You are personalizing a message for a customer.
        Customer Name: ${customerName}
        Last Item Purchased: ${lastItem}
        Customer Loyalty Tier: ${tier}
        Campaign Context / NL Goal: ${aiPrompt}
        Base Copy Template: ${template}

        Write the final message. Keep it short, conversational (suitable for SMS or WhatsApp), persuasive, and tailored to the customer. Fill in any placeholders or improve the tone. Output ONLY the message text.
      `;

      const response = await model.generateContent(prompt);
      return response.response.text().trim();
    } catch (error) {
      console.error('Gemini API personalization failed, using mock fallback:', error);
      return this.mockGeneratePersonalizedCopy(customerName, lastItem, tier, template, aiPrompt);
    }
  }

  // --- MOCK FALLBACKS ---

  private mockParseCampaignGoal(prompt: string): ParsedCampaign {
    const lower = prompt.toLowerCase();
    
    let name = "Custom Targeted Outreach";
    let goal = "custom_outreach";
    let conditions: SegmentDefinition['conditions'] = [];
    let suggestedCopyTemplate = "Hi {{name}}, check out our latest offers tailored just for you! Use code CRM10 for 10% off.";

    // Parse "days" inactivity conditions
    const daysMatch = lower.match(/(\d+)\s*days/);
    if (daysMatch) {
      const days = parseInt(daysMatch[1], 10);
      conditions.push({
        field: 'lastPurchaseDays',
        operator: 'greaterThan',
        value: days
      });
      name = `${days}-Day Inactive Win-Back`;
      goal = `win_back_${days}_days`;
      suggestedCopyTemplate = `Hey {{name}}! We missed you. It has been over ${days} days since your last purchase. We would love to welcome you back with a special 15% discount! Code: WELCOMEBACK`;
    }

    // Parse "spend" conditions
    const spendMatch = lower.match(/(?:spent|spend|above|over|>\s*)\$*(\d+)/);
    if (spendMatch) {
      const amount = parseInt(spendMatch[1], 10);
      conditions.push({
        field: 'totalSpend',
        operator: 'greaterThan',
        value: amount
      });
      name = `High Spender Campaign ($${amount}+)`;
      goal = `high_spender_${amount}`;
      suggestedCopyTemplate = `Hello {{name}}! As one of our premium shoppers who has spent over $${amount} with us, we are giving you exclusive early access to our new drop.`;
    }

    // Parse loyalty tier conditions
    if (lower.includes('vip') || lower.includes('gold') || lower.includes('platinum')) {
      const tier = lower.includes('platinum') ? 'Platinum' : (lower.includes('gold') ? 'Gold' : 'Silver');
      conditions.push({
        field: 'tier',
        operator: 'equals',
        value: tier
      });
      name = `${tier} Tier Loyalty Rewards`;
      goal = `${tier.toLowerCase()}_loyalty`;
      suggestedCopyTemplate = `Hi {{name}}, as a valued {{tier}} member, thank you for your loyalty! Here is a special gift code just for you: VIPTHANKYOU`;
    }

    // Parse product conditions
    const items = ['shoes', 't-shirt', 'bag', 'watch', 'dress', 'jeans', 'sneakers'];
    for (const item of items) {
      if (lower.includes(item)) {
        conditions.push({
          field: 'purchasedItem',
          operator: 'contains',
          value: item.charAt(0).toUpperCase() + item.slice(1)
        });
        name = `${item.charAt(0).toUpperCase() + item.slice(1)} Buyers Promotion`;
        goal = `promote_${item}`;
        suggestedCopyTemplate = `Hi {{name}}, we hope you are loving your {{lastItemPurchased}}! We wanted to suggest some matching accessories that we think you'll love.`;
        break; // prioritize first found item
      }
    }

    // If no conditions were matched, target everyone
    if (conditions.length === 0) {
      conditions.push({
        field: 'all',
        operator: 'any',
        value: true
      });
      name = "Broadcast Campaign";
      goal = "broadcast";
    }

    return {
      name,
      goal,
      segmentDefinition: { conditions },
      suggestedCopyTemplate
    };
  }

  private mockGeneratePersonalizedCopy(
    customerName: string,
    lastItem: string,
    tier: string,
    template: string,
    aiPrompt: string
  ): string {
    // Basic regex replacement for common templates
    let msg = template
      .replace(/\{\{name\}\}/g, customerName)
      .replace(/\{\{lastItemPurchased\}\}/g, lastItem || 'previous purchase')
      .replace(/\{\{tier\}\}/g, tier);

    // Add some dynamic variation to show "AI personalization"
    if (lastItem) {
      if (lastItem.toLowerCase().includes('shoes')) {
        msg += ` How are those shoes holding up? 👟`;
      } else if (lastItem.toLowerCase().includes('watch')) {
        msg += ` Keep tracking time in style! ⌚`;
      } else if (lastItem.toLowerCase().includes('bag')) {
        msg += ` Hope your bag is keeping your essentials safe! 👜`;
      }
    }

    return msg;
  }
}
