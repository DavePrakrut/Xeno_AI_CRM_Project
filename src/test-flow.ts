import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const PORT_CRM = process.env.PORT_CRM || 3008;
const CRM_BASE_URL = `http://localhost:${PORT_CRM}/api`;


const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runTestFlow() {
  console.log('\n==================================================================');
  console.log('🚀 STARTING END-TO-END INTEGRATION TEST FOR XENO AI-NATIVE CRM 🚀');
  console.log('==================================================================\n');

  try {
    // 1. Ingest Data
    console.log('Step 1: Triggering Data Ingestion / Database Seeding...');
    const ingestRes = await axios.post(`${CRM_BASE_URL}/data/ingest`);
    console.log(`✅ Success: Ingested ${ingestRes.data.customersIngested} customers and ${ingestRes.data.ordersIngested} orders.\n`);

    // 2. Create Campaign via AI Natural Language Goal
    console.log('Step 2: Submitting Campaign Goal to AI-Native Layer...');
    const goalPrompt = "Win back customers who haven't bought anything in 60 days";
    console.log(`Prompt: "${goalPrompt}"`);
    
    const campaignRes = await axios.post(`${CRM_BASE_URL}/campaigns`, {
      aiPrompt: goalPrompt
    });
    
    const campaign = campaignRes.data.campaign;
    console.log('✅ Campaign Created Successfully!');
    console.log(`   - Name: ${campaign.name}`);
    console.log(`   - Goal slug: ${campaign.goal}`);
    console.log(`   - Segment conditions: ${JSON.stringify(JSON.parse(campaign.segmentDefinition).conditions)}`);
    console.log(`   - Suggested AI Message Template: "${campaignRes.data.suggestedCopyTemplate}"\n`);

    // 3. Trigger Send
    console.log('Step 3: Triggering Campaign Dispatch...');
    const sendRes = await axios.post(`${CRM_BASE_URL}/campaigns/${campaign.id}/send`, {
      channel: 'WhatsApp',
      suggestedCopyTemplate: campaignRes.data.suggestedCopyTemplate
    });
    console.log(`✅ Dispatch Triggered! ${sendRes.data.message}`);
    console.log(`   - Number of targeted shoppers: ${sendRes.data.recipientCount}\n`);

    // 4. Poll Insights for 4 seconds to let the callbacks fully arrive and propagate
    console.log('Step 4: Monitoring Callback Loop & Simulating Real-time Funnel Progression...');
    const totalPollSeconds = 4;
    let finalInsights: any = null;

    for (let sec = 1; sec <= totalPollSeconds; sec++) {
      await delay(1000); // Wait 1 second

      const insightsRes = await axios.get(`${CRM_BASE_URL}/campaigns/${campaign.id}/insights`);
      finalInsights = insightsRes.data;
      const { campaign: campInfo, funnel } = finalInsights;

      console.log(`[Second ${sec}] Status: ${campInfo.status} | Sent: ${funnel.sent} | Delivered: ${funnel.delivered} | Opened: ${funnel.opened} | Clicked: ${funnel.clicked} | Converted: ${funnel.converted}`);
    }

    console.log('\n✅ All callback logs processed successfully!\n');
    
    const { campaign: campInfo, funnel, rates, financials } = finalInsights;
    console.log('==================================================================');
    console.log('📊           CAMPAIGN INSIGHTS & ROI ATTRIBUTION REPORT          📊');
    console.log('==================================================================');
    console.log(`Campaign Name:  ${campInfo.name}`);
    console.log(`AI Goal Prompt: "${campInfo.aiPrompt}"`);
    console.log(`Created At:     ${campInfo.createdAt}`);
    console.log('------------------------------------------------------------------');
    console.log('DELIVERY FUNNEL METRICS:');
    console.log(`  Messages Dispatched: ${funnel.sent}`);
    console.log(`  Messages Delivered:  ${funnel.delivered}  (Delivery Rate: ${rates.deliveryRate}%)`);

        console.log(`  Messages Opened:     ${funnel.opened}     (Open Rate: ${rates.openRate}%)`);
        console.log(`  Messages Clicked:    ${funnel.clicked}    (Click-through Rate (CTR): ${rates.clickThroughRate}%)`);
        console.log(`  Purchases Converted: ${funnel.converted}  (Conversion Rate: ${rates.conversionRate}%)`);
        console.log(`  Deliveries Failed:   ${funnel.failed}`);
        console.log('------------------------------------------------------------------');
        console.log('FINANCIALS & ROI ANALYSIS:');
        console.log(`  Attributed Revenue:  $${financials.totalRevenue.toFixed(2)}`);
        console.log(`  Campaign Cost:       $${financials.totalCost.toFixed(4)}`);
        console.log(`  Net Profit:          $${financials.netProfit.toFixed(2)}`);
        console.log(`  Return on Investment (ROI): ${financials.roi.toFixed(2)}%`);
        console.log('------------------------------------------------------------------');
        console.log('CONVERSIONS ATTRIBUTED:');
        if (finalInsights.conversions && finalInsights.conversions.length > 0) {
          finalInsights.conversions.forEach((conv: any) => {
            console.log(`  - Customer: ${conv.customerName} purchased "${conv.itemPurchased}" for $${conv.amount.toFixed(2)}`);
          });
        } else {
          console.log('  No conversions recorded.');
        }
        console.log('==================================================================\n');


  } catch (error: any) {
    console.error('❌ E2E Integration Test Failed:', error.response?.data || error.message);
  }
}

// Execute test
runTestFlow();
