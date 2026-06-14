const CRM_API_URL = '/api';
const CHANNEL_API_URL = window.location.port === '3008'
  ? `${window.location.protocol}//${window.location.hostname}:3009/api/channel`
  : `/api/channel`;

// State variables
let activeCampaignId = null;
let pollInterval = null;
let parsedCampaignCache = null;

// DOM Elements
const tabs = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.content-view');
const btnSeed = document.getElementById('btn-seed');
const btnParseGoal = document.getElementById('btn-parse-goal');
const campaignPrompt = document.getElementById('campaign-prompt');
const aiParsedResults = document.getElementById('ai-parsed-results');
const parsedNameInput = document.getElementById('parsed-name');
const parsedTemplateInput = document.getElementById('parsed-template');
const campaignChannelSelect = document.getElementById('campaign-channel');
const btnLaunchCampaign = document.getElementById('btn-launch-campaign');
const btnCancelCampaign = document.getElementById('btn-cancel-campaign');
const ruleBadgeContainer = document.getElementById('parsed-rules-badge-container');

// Funnel Elements
const funnelPlaceholder = document.getElementById('funnel-placeholder');
const funnelActiveContainer = document.getElementById('funnel-active-container');
const activeCampName = document.getElementById('active-camp-name');
const activeCampStatus = document.getElementById('active-camp-status');
const activeConversionsList = document.getElementById('active-conversions-list');

// Funnel metrics & bars
const barSent = document.getElementById('bar-sent');
const barDelivered = document.getElementById('bar-delivered');
const barOpened = document.getElementById('bar-opened');
const barClicked = document.getElementById('bar-clicked');
const barConverted = document.getElementById('bar-converted');
const barFailed = document.getElementById('bar-failed');
const rowFailedContainer = document.getElementById('row-failed-container');

const metricSent = document.getElementById('metric-sent');
const metricDelivered = document.getElementById('metric-delivered');
const metricOpened = document.getElementById('metric-opened');
const metricClicked = document.getElementById('metric-clicked');
const metricConverted = document.getElementById('metric-converted');
const metricFailed = document.getElementById('metric-failed');

const rateDelivered = document.getElementById('rate-delivered');
const rateOpened = document.getElementById('rate-opened');
const rateClicked = document.getElementById('rate-clicked');
const rateConverted = document.getElementById('rate-converted');

// Dashboard Overall KPIs
const kpiRevenue = document.getElementById('kpi-revenue');
const kpiCost = document.getElementById('kpi-cost');
const kpiProfit = document.getElementById('kpi-profit');
const kpiRoi = document.getElementById('kpi-roi');

// Tables
const dashboardCampaignsTbody = document.getElementById('dashboard-campaigns-tbody');
const campaignHistoryTbody = document.getElementById('campaign-history-tbody');
const shoppersTbody = document.getElementById('shoppers-tbody');

// Console Log Body
const channelOutboxConsole = document.getElementById('channel-outbox-console');
const btnRefreshLogs = document.getElementById('btn-refresh-logs');

// Modal Elements
const insightsModal = document.getElementById('insights-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const modalCampaignTitle = document.getElementById('modal-campaign-title');
const modalRevenue = document.getElementById('modal-revenue');
const modalCost = document.getElementById('modal-cost');
const modalProfit = document.getElementById('modal-profit');
const modalRoi = document.getElementById('modal-roi');
const modalFunnelSent = document.getElementById('modal-funnel-sent');
const modalFunnelDelivered = document.getElementById('modal-funnel-delivered');
const modalFunnelOpened = document.getElementById('modal-funnel-opened');
const modalFunnelClicked = document.getElementById('modal-funnel-clicked');
const modalFunnelConverted = document.getElementById('modal-funnel-converted');
const modalFunnelFailed = document.getElementById('modal-funnel-failed');
const modalRateDelivered = document.getElementById('modal-rate-delivered');
const modalRateOpened = document.getElementById('modal-rate-opened');
const modalRateClicked = document.getElementById('modal-rate-clicked');
const modalRateConverted = document.getElementById('modal-rate-converted');
const modalConversionsFeed = document.getElementById('modal-conversions-feed');

// Suggestions
const suggestions = document.querySelectorAll('.suggestion-tag');

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
  setupTabListeners();
  setupEventListeners();
  loadDashboardData();
  setupLogStream();
});

// 1. Tab Event Listeners
function setupTabListeners() {
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = tab.getAttribute('data-tab');
      
      // Toggle tabs
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Toggle views
      views.forEach(view => {
        view.classList.remove('active');
        if (view.id === `view-${targetTab}`) {
          view.classList.add('active');
        }
      });

      // Fetch fresh data based on view
      if (targetTab === 'campaigns') {
        loadCampaignHistory();
      } else if (targetTab === 'shoppers') {
        loadShoppers();
      } else if (targetTab === 'logs') {
        loadOutboxLogs();
      } else if (targetTab === 'dashboard') {
        loadDashboardData();
      }
    });
  });
}

// 2. Setup Event Listeners
function setupEventListeners() {
  // Database Seeding
  btnSeed.addEventListener('click', async () => {
    try {
      btnSeed.disabled = true;
      btnSeed.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Seeding...`;
      
      const response = await fetch(`${CRM_API_URL}/data/ingest`, { method: 'POST' });
      const data = await response.json();
      
      alert(`Seeding successful!\nIngested ${data.customersIngested} customers and ${data.ordersIngested} orders.`);
      loadDashboardData();
      appendConsoleLine(`Database successfully seeded with ${data.customersIngested} shoppers.`, 'info');
    } catch (err) {
      console.error(err);
      alert('Error seeding database.');
      appendConsoleLine(`Database seed failed: ${err.message}`, 'error');
    } finally {
      btnSeed.disabled = false;
      btnSeed.innerHTML = `<i class="fa-solid fa-database"></i> Seed/Reset DB`;
    }
  });

  // Suggestion Tags
  suggestions.forEach(tag => {
    tag.addEventListener('click', () => {
      campaignPrompt.value = tag.innerText;
    });
  });

  // Parse Campaign NL Goal
  btnParseGoal.addEventListener('click', async () => {
    const prompt = campaignPrompt.value.trim();
    if (!prompt) {
      alert('Please enter a campaign goal.');
      return;
    }

    try {
      btnParseGoal.disabled = true;
      btnParseGoal.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Reading Intent...`;
      
      const response = await fetch(`${CRM_API_URL}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiPrompt: prompt })
      });
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      parsedCampaignCache = data;
      
      // Populate results card
      parsedNameInput.value = data.campaign.name;
      parsedTemplateInput.value = data.suggestedCopyTemplate;
      
      // Parse & populate badges
      ruleBadgeContainer.innerHTML = '';
      const segDefinition = JSON.parse(data.campaign.segmentDefinition);
      const conditions = segDefinition.conditions || [];
      
      conditions.forEach(cond => {
        const badge = document.createElement('span');
        badge.className = 'cond-badge';
        badge.innerHTML = `<i class="fa-solid fa-filter"></i> ${cond.field} ${getOperatorSymbol(cond.operator)} ${cond.value}`;
        ruleBadgeContainer.appendChild(badge);
      });

      aiParsedResults.classList.remove('hidden');
      appendConsoleLine(`AI analyzed prompt: "${prompt}". Generated strategy "${data.campaign.name}".`, 'info');
    } catch (err) {
      console.error(err);
      alert(`Failed to parse goal: ${err.message}`);
      appendConsoleLine(`AI goal parse error: ${err.message}`, 'error');
    } finally {
      btnParseGoal.disabled = false;
      btnParseGoal.innerHTML = `<i class="fa-solid fa-brain"></i> Parse Campaign Goal`;
    }
  });

  // Cancel Campaign
  btnCancelCampaign.addEventListener('click', () => {
    aiParsedResults.classList.add('hidden');
    parsedCampaignCache = null;
    campaignPrompt.value = '';
    appendConsoleLine('Campaign draft discarded.', 'info');
  });

  // Launch Campaign
  btnLaunchCampaign.addEventListener('click', async () => {
    if (!parsedCampaignCache) return;
    
    const campaignId = parsedCampaignCache.campaign.id;
    const selectedChannel = campaignChannelSelect.value;
    const editedTemplate = parsedTemplateInput.value.trim();

    try {
      btnLaunchCampaign.disabled = true;
      btnLaunchCampaign.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Launching...`;

      const response = await fetch(`${CRM_API_URL}/campaigns/${campaignId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: selectedChannel,
          suggestedCopyTemplate: editedTemplate
        })
      });
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Hide creator results card & clean input
      aiParsedResults.classList.add('hidden');
      campaignPrompt.value = '';

      // Initialize real-time visualization
      setupFunnelVisualization(campaignId, parsedNameInput.value);
      
      // Track live logs console
      appendConsoleLine(`Campaign "${parsedNameInput.value}" successfully launched over ${selectedChannel} to ${data.recipientCount} target shoppers.`, 'dispatch');
      
      // Start polling insights
      startInsightsPolling(campaignId);

    } catch (err) {
      console.error(err);
      alert(`Error launching campaign: ${err.message}`);
      appendConsoleLine(`Campaign dispatch error: ${err.message}`, 'error');
    } finally {
      btnLaunchCampaign.disabled = false;
      btnLaunchCampaign.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Launch Campaign`;
    }
  });

  // Close Modal
  btnCloseModal.addEventListener('click', () => {
    insightsModal.classList.add('hidden');
  });
  
  // Close Modal on click outside
  insightsModal.addEventListener('click', (e) => {
    if (e.target === insightsModal) {
      insightsModal.classList.add('hidden');
    }
  });

  // Refresh Console Logs
  btnRefreshLogs.addEventListener('click', () => {
    loadOutboxLogs();
  });
}

// 3. Load Dashboard Data (Overall ROI Metrics & Campaigns Table)
async function loadDashboardData() {
  try {
    const response = await fetch(`${CRM_API_URL}/campaigns`);
    const data = await response.json();
    const campaigns = data.campaigns || [];
    
    // Render campaigns list on dashboard
    renderDashboardCampaigns(campaigns);

    // Compute aggregated ROI metrics
    let totalRevenue = 0;
    let totalCost = 0;

    // Fetch insights for each campaign to aggregate
    const insightPromises = campaigns.map(camp => 
      fetch(`${CRM_API_URL}/campaigns/${camp.id}/insights`).then(res => res.json())
    );

    const insights = await Promise.all(insightPromises);

    insights.forEach(ins => {
      if (ins.financials) {
        totalRevenue += ins.financials.totalRevenue;
        totalCost += ins.financials.totalCost;
      }
    });

    const netProfit = totalRevenue - totalCost;
    const roiVal = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;

    // Set UI values
    kpiRevenue.innerText = `$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    kpiCost.innerText = `$${totalCost.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
    
    if (netProfit < 0) {
      kpiProfit.innerText = `-$${Math.abs(netProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      kpiProfit.className = 'kpi-value text-red';
    } else {
      kpiProfit.innerText = `$${netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      kpiProfit.className = 'kpi-value';
    }

    kpiRoi.innerText = `${roiVal.toFixed(1)}%`;

    // Update GEMINI API badge indicator
    // Check if key is mock or real
    // (We will check from one of the campaign insights, or just let backend let us know.
    // For now we check if any campaign has dynamic AI responses. Actually, we can fetch
    // the status from one endpoint if needed, or simply assume mock unless key is provided)
    const anyRealAI = insights.some(ins => ins.campaign.aiPrompt && !ins.campaign.aiPrompt.includes("Mock"));
    // Just a placeholder indicator check:
    const geminiBadge = document.getElementById('ai-mode-badge');
    if (window.location.host.includes('localhost') || window.location.host.includes('127.0.0.1')) {
      // In local mode, let's keep it clean
    }

  } catch (err) {
    console.error('Failed to load dashboard data:', err);
  }
}

// 4. Load Campaign History View
async function loadCampaignHistory() {
  try {
    const response = await fetch(`${CRM_API_URL}/campaigns`);
    const data = await response.json();
    const campaigns = data.campaigns || [];
    
    campaignHistoryTbody.innerHTML = '';
    
    if (campaigns.length === 0) {
      campaignHistoryTbody.innerHTML = `<tr><td colspan="7" class="text-center">No campaigns created yet.</td></tr>`;
      return;
    }

    campaigns.forEach(camp => {
      const tr = document.createElement('tr');
      const date = new Date(camp.createdAt).toLocaleString();
      const statusBadge = getStatusBadgeHTML(camp.status);
      
      tr.innerHTML = `
        <td>#${camp.id}</td>
        <td><strong>${escapeHtml(camp.name)}</strong></td>
        <td>${statusBadge}</td>
        <td><code>${escapeHtml(camp.goal)}</code></td>
        <td class="text-muted"><small>${escapeHtml(camp.aiPrompt)}</small></td>
        <td>${date}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="showCampaignInsights(${camp.id})">
            <i class="fa-solid fa-chart-pie"></i> Insights
          </button>
        </td>
      `;
      campaignHistoryTbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load campaigns:', err);
  }
}

// 5. Load Shoppers View
async function loadShoppers() {
  try {
    const response = await fetch(`${CRM_API_URL}/customers`);
    const data = await response.json();
    const shoppers = data.customers || [];
    
    shoppersTbody.innerHTML = '';
    
    if (shoppers.length === 0) {
      shoppersTbody.innerHTML = `<tr><td colspan="7" class="text-center">No customer data. Trigger "Seed DB" to Ingest.</td></tr>`;
      return;
    }

    shoppers.forEach(shop => {
      const tr = document.createElement('tr');
      const tierBadge = `<span class="badge badge-outline">${shop.tier}</span>`;
      const contactStr = `Phone: ${shop.phone}<br>Email: ${shop.email}`;
      
      tr.innerHTML = `
        <td>#${shop.id}</td>
        <td><strong>${escapeHtml(shop.name)}</strong></td>
        <td><small>${contactStr}</small></td>
        <td>${tierBadge}</td>
        <td>${escapeHtml(shop.location)}</td>
        <td><span class="badge" style="background-color: rgba(255,255,255,0.05);">${shop.orderCount} orders</span></td>
        <td><strong>$${shop.totalSpend.toFixed(2)}</strong></td>
      `;
      shoppersTbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load shoppers:', err);
  }
}

// 6. Real-time Funnel Simulation Layout
function setupFunnelVisualization(campaignId, name) {
  activeCampaignId = campaignId;
  
  // Show active funnel UI
  funnelPlaceholder.classList.add('hidden');
  funnelActiveContainer.classList.remove('hidden');
  
  activeCampName.innerText = name;
  activeCampStatus.className = 'badge badge-progress';
  activeCampStatus.innerText = 'IN_PROGRESS';
  
  // Reset Bars & numbers
  barSent.style.width = '0%';
  barDelivered.style.width = '0%';
  barOpened.style.width = '0%';
  barClicked.style.width = '0%';
  barConverted.style.width = '0%';
  barFailed.style.width = '0%';
  rowFailedContainer.classList.add('hidden');

  metricSent.innerText = '0';
  metricDelivered.innerHTML = '0 <span class="rate-pct">(0%)</span>';
  metricOpened.innerHTML = '0 <span class="rate-pct">(0%)</span>';
  metricClicked.innerHTML = '0 <span class="rate-pct">(0%)</span>';
  metricConverted.innerHTML = '0 <span class="rate-pct">(0%)</span>';
  metricFailed.innerText = '0';

  activeConversionsList.innerHTML = `<div class="empty-feed-item">Awaiting customer purchases...</div>`;
}

// Polling Loop for Active Campaigns
function startInsightsPolling(campaignId) {
  if (pollInterval) clearInterval(pollInterval);
  
  pollInterval = setInterval(async () => {
    try {
      const response = await fetch(`${CRM_API_URL}/campaigns/${campaignId}/insights`);
      const data = await response.json();
      
      const { campaign, funnel, rates, conversions } = data;
      
      // Update stats numbers
      metricSent.innerText = funnel.sent;
      metricDelivered.innerHTML = `${funnel.delivered} <span class="rate-pct">(${rates.deliveryRate}%)</span>`;
      metricOpened.innerHTML = `${funnel.opened} <span class="rate-pct">(${rates.openRate}%)</span>`;
      metricClicked.innerHTML = `${funnel.clicked} <span class="rate-pct">(${rates.clickThroughRate}%)</span>`;
      metricConverted.innerHTML = `${funnel.converted} <span class="rate-pct">(${rates.conversionRate}%)</span>`;
      metricFailed.innerText = funnel.failed;

      // Calculate relative percentage width for bar visualization
      const maxCount = funnel.sent || 1;
      barSent.style.width = '100%';
      barDelivered.style.width = `${(funnel.delivered / maxCount) * 100}%`;
      barOpened.style.width = `${(funnel.opened / maxCount) * 100}%`;
      barClicked.style.width = `${(funnel.clicked / maxCount) * 100}%`;
      barConverted.style.width = `${(funnel.converted / maxCount) * 100}%`;
      
      if (funnel.failed > 0) {
        rowFailedContainer.classList.remove('hidden');
        barFailed.style.width = `${(funnel.failed / maxCount) * 100}%`;
      }

      // Update status tag
      activeCampStatus.innerText = campaign.status;
      if (campaign.status === 'COMPLETED') {
        activeCampStatus.className = 'badge badge-completed';
        clearInterval(pollInterval);
        loadDashboardData(); // Refresh tables and metrics on completion
        appendConsoleLine(`Campaign ID ${campaignId} successfully completed all dispatch status runs!`, 'attribution');
      }

      // Populate conversions list
      if (conversions && conversions.length > 0) {
        activeConversionsList.innerHTML = '';
        conversions.forEach(conv => {
          const feedItem = document.createElement('div');
          feedItem.className = 'feed-item';
          feedItem.innerHTML = `
            <span class="feed-cust">${escapeHtml(conv.customerName)}</span>
            <span class="feed-item-details">bought "${escapeHtml(conv.itemPurchased)}"</span>
            <span class="feed-amt">+$${conv.amount.toFixed(2)}</span>
          `;
          activeConversionsList.appendChild(feedItem);
        });
      }

    } catch (err) {
      console.error('Error polling campaign insights:', err);
    }
  }, 1000);
}

// 7. Show Modal Insights
async function showCampaignInsights(campaignId) {
  try {
    const response = await fetch(`${CRM_API_URL}/campaigns/${campaignId}/insights`);
    const data = await response.json();

    const { campaign, funnel, rates, financials, conversions } = data;

    modalCampaignTitle.innerText = `Campaign: ${campaign.name}`;
    modalRevenue.innerText = `$${financials.totalRevenue.toFixed(2)}`;
    modalCost.innerText = `$${financials.totalCost.toFixed(4)}`;
    modalProfit.innerText = `$${financials.netProfit.toFixed(2)}`;
    modalRoi.innerText = `${financials.roi.toFixed(1)}%`;

    modalFunnelSent.innerText = funnel.sent;
    modalFunnelDelivered.innerText = funnel.delivered;
    modalFunnelOpened.innerText = funnel.opened;
    modalFunnelClicked.innerText = funnel.clicked;
    modalFunnelConverted.innerText = funnel.converted;
    modalFunnelFailed.innerText = funnel.failed;

    modalRateDelivered.innerText = `(${rates.deliveryRate}%)`;
    modalRateOpened.innerText = `(${rates.openRate}%)`;
    modalRateClicked.innerText = `(${rates.clickThroughRate}%)`;
    modalRateConverted.innerText = `(${rates.conversionRate}%)`;

    // Render Modal sales conversions list
    modalConversionsFeed.innerHTML = '';
    if (conversions && conversions.length > 0) {
      conversions.forEach(conv => {
        const item = document.createElement('div');
        item.className = 'modal-sales-item';
        item.innerHTML = `
          <span><strong>${escapeHtml(conv.customerName)}</strong> - ${escapeHtml(conv.itemPurchased)}</span>
          <span class="text-green font-mono">+$${conv.amount.toFixed(2)}</span>
        `;
        modalConversionsFeed.appendChild(item);
      });
    } else {
      modalConversionsFeed.innerHTML = `<div class="empty-feed-item">No attributed sales converted yet.</div>`;
    }

    insightsModal.classList.remove('hidden');

  } catch (err) {
    console.error(err);
    alert('Failed to fetch campaign insights.');
  }
}

// 8. Render Table Helper
function renderDashboardCampaigns(campaigns) {
  dashboardCampaignsTbody.innerHTML = '';
  
  if (campaigns.length === 0) {
    dashboardCampaignsTbody.innerHTML = `<tr><td colspan="8" class="text-center">No campaigns found. Use the AI Assistant to create one.</td></tr>`;
    return;
  }

  // Display only first 5 campaigns on dashboard
  const limitCampaigns = campaigns.slice(0, 5);

  limitCampaigns.forEach(camp => {
    const tr = document.createElement('tr');
    const statusBadge = getStatusBadgeHTML(camp.status);
    
    // We fetch details asynchronously or display placeholder while loading
    tr.id = `dash-camp-row-${camp.id}`;
    tr.innerHTML = `
      <td>#${camp.id}</td>
      <td>
        <div style="font-weight:600">${escapeHtml(camp.name)}</div>
        <div class="text-muted" style="font-size:0.75rem">${escapeHtml(camp.aiPrompt)}</div>
      </td>
      <td>${statusBadge}</td>
      <td id="dash-camp-size-${camp.id}">Loading...</td>
      <td id="dash-camp-conv-${camp.id}">-</td>
      <td id="dash-camp-rev-${camp.id}">-</td>
      <td id="dash-camp-roi-${camp.id}">-</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="showCampaignInsights(${camp.id})">
          <i class="fa-solid fa-chart-pie"></i> Insights
        </button>
      </td>
    `;
    dashboardCampaignsTbody.appendChild(tr);

    // Fetch individual campaign metrics
    fetch(`${CRM_API_URL}/campaigns/${camp.id}/insights`)
      .then(res => res.json())
      .then(ins => {
        const sizeTd = document.getElementById(`dash-camp-size-${camp.id}`);
        const convTd = document.getElementById(`dash-camp-conv-${camp.id}`);
        const revTd = document.getElementById(`dash-camp-rev-${camp.id}`);
        const roiTd = document.getElementById(`dash-camp-roi-${camp.id}`);

        if (sizeTd) sizeTd.innerText = ins.funnel.sent;
        if (convTd) convTd.innerHTML = `${ins.funnel.converted} <small class="text-muted">(${ins.rates.conversionRate}%)</small>`;
        if (revTd) revTd.innerText = `$${ins.financials.totalRevenue.toFixed(2)}`;
        
        if (roiTd) {
          roiTd.innerText = `${ins.financials.roi.toFixed(1)}%`;
          if (ins.financials.netProfit > 0) {
            roiTd.className = 'text-green font-weight-bold';
          } else if (ins.financials.netProfit < 0) {
            roiTd.className = 'text-red';
          }
        }
      })
      .catch(err => console.error(err));
  });
}

// 9. Load Outbox Logs Console View
async function loadOutboxLogs() {
  try {
    const response = await fetch(`${CHANNEL_API_URL}/logs`);
    const data = await response.json();
    const logs = data.logs || [];
    
    channelOutboxConsole.innerHTML = '';
    
    if (logs.length === 0) {
      channelOutboxConsole.innerHTML = `<div class="console-line text-muted">Listening for new channel message dispatches...</div>`;
      return;
    }

    logs.forEach(log => {
      const date = new Date(log.timestamp).toLocaleTimeString();
      const line = document.createElement('div');
      line.className = 'console-line dispatch';
      line.innerHTML = `[${date}] [Outbox] Dispatching through <span class="badge badge-outline">${log.channel}</span> to ${log.recipient} | Body: "${escapeHtml(log.body)}" (ext_id: ${log.externalMessageId})`;
      channelOutboxConsole.appendChild(line);
    });

    channelOutboxConsole.scrollTop = channelOutboxConsole.scrollHeight;

  } catch (err) {
    console.error('Failed to load outbox logs:', err);
    channelOutboxConsole.innerHTML = `<div class="console-line error">[ERR] Failed to pull logs from Channel Service API: ${err.message}. Ensure channel service server is running on port 3009.</div>`;
  }
}

// Real-time Event Log Loop simulation mock
function setupLogStream() {
  // Poll outbox logs and callback notifications every 3 seconds to keep logs view fresh
  setInterval(() => {
    const activeTab = document.querySelector('.nav-item.active').getAttribute('data-tab');
    if (activeTab === 'logs') {
      loadOutboxLogs();
    }
  }, 3000);
}

// 10. Utility Helpers
function getOperatorSymbol(op) {
  switch (op) {
    case 'greaterThan': return '>';
    case 'lessThan': return '<';
    case 'equals': return '=';
    case 'contains': return '∋';
    default: return '::';
  }
}

function getStatusBadgeHTML(status) {
  switch (status) {
    case 'IN_PROGRESS':
      return `<span class="badge badge-progress"><i class="fa-solid fa-spinner fa-spin"></i> In Progress</span>`;
    case 'COMPLETED':
      return `<span class="badge badge-completed"><i class="fa-solid fa-circle-check"></i> Completed</span>`;
    case 'FAILED':
      return `<span class="badge text-red" style="border: 1px solid var(--red); background: rgba(239,68,68,0.08);"><i class="fa-solid fa-circle-xmark"></i> Failed</span>`;
    default:
      return `<span class="badge" style="border: 1px solid var(--text-muted); color: var(--text-secondary); background: rgba(255,255,255,0.03);">${status}</span>`;
  }
}

function appendConsoleLine(message, type = 'info') {
  const line = document.createElement('div');
  const date = new Date().toLocaleTimeString();
  line.className = `console-line ${type}`;
  line.innerHTML = `[${date}] [${type.toUpperCase()}] ${message}`;
  
  if (channelOutboxConsole) {
    // If placeholder console text exists, clear it
    if (channelOutboxConsole.innerHTML.includes('Listening for new channel message')) {
      channelOutboxConsole.innerHTML = '';
    }
    
    channelOutboxConsole.appendChild(line);
    channelOutboxConsole.scrollTop = channelOutboxConsole.scrollHeight;
  }
}

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Make globally accessible
window.showCampaignInsights = showCampaignInsights;
