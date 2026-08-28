import React, { useState } from 'react';

const BACKEND = 'http://localhost:3001';

const AVAILABLE_KPIS = [
  { key: 'overdue', label: 'Overdue Deliveries', icon: '⏰', description: 'Items past their promised delivery date', hasThreshold: true, thresholdLabel: 'Flag after', unit: 'days overdue', defaultDays: 7 },
  { key: 'noRfq', label: 'PRs Without RFQ', icon: '📋', description: 'Purchase requests stuck without a quote', hasThreshold: true, thresholdLabel: 'Flag after', unit: 'days without quote', defaultDays: 14 },
  { key: 'vendorRisk', label: 'High-Risk Vendors', icon: '🏭', description: 'Suppliers with multiple overdue orders simultaneously', hasThreshold: true, thresholdLabel: 'Flag vendors with', unit: 'or more overdue orders', defaultDays: 3 },
  { key: 'upcoming', label: 'Upcoming Deliveries', icon: '📅', description: 'Deliveries expected soon — plan ahead', hasThreshold: true, thresholdLabel: 'Show deliveries due in next', unit: 'days', defaultDays: 14 },
  { key: 'cycleTime', label: 'Avg PR→PO Cycle Time', icon: '⚡', description: 'Average days from purchase request to order placed', hasThreshold: false },
  { key: 'onTimeRate', label: 'On-Time Delivery Rate', icon: '✅', description: 'Percentage of orders delivered on or before promised date', hasThreshold: false },
  { key: 'spendByVendor', label: 'Spend by Vendor', icon: '💰', description: 'Top 10 suppliers ranked by total order value', hasThreshold: false },
  { key: 'cancellationRate', label: 'Cancellation Rate', icon: '❌', description: 'Percentage of orders cancelled', hasThreshold: false },
  { key: 'deptBreakdown', label: 'Department Breakdown', icon: '🏢', description: 'Order volume split by department', hasThreshold: false },
];

const FIELD_DEFS = [
  { key: 'prDate', label: 'PR / Request Date', hint: 'When the purchase request was raised' },
  { key: 'rfqDate', label: 'RFQ / Quote Date', hint: 'When a quote was received' },
  { key: 'poDate', label: 'PO / Order Date', hint: 'When the purchase order was placed' },
  { key: 'dod', label: 'Expected Delivery Date', hint: 'Promised delivery date (DOD)' },
  { key: 'actualDod', label: 'Actual Delivery Date', hint: 'When it was actually delivered' },
  { key: 'delStatus', label: 'Delivery Status', hint: 'e.g. Delivered, Pending, Cancelled' },
  { key: 'vendor', label: 'Vendor / Supplier Name', hint: 'Supplier or contractor name' },
  { key: 'value', label: 'PO Value / Order Value', hint: 'Monetary value of the order' },
  { key: 'desc', label: 'Item Description', hint: 'What is being purchased' },
  { key: 'poNumber', label: 'PO Number', hint: 'Purchase order reference number' },
  { key: 'dept', label: 'Department', hint: 'Requesting department' },
  { key: 'pgr', label: 'Purchasing Group', hint: 'e.g. HEY, FAV, HEV' },
];

const GUIDES = {
  n8n_local: {
    title: 'n8n (Self-hosted)',
    icon: '🔧',
    color: '#e74c3c',
    steps: [
      { title: 'Open n8n', desc: 'Go to http://localhost:5678 in your browser.' },
      { title: 'Create a new workflow', desc: 'Click "New Workflow" and give it a name like "ProcureAlert".' },
      { title: 'Add Schedule Trigger', desc: 'Add a "Schedule Trigger" node. Set it to run daily at your preferred time (e.g. 8:00 AM).' },
      { title: 'Add HTTP Request node', desc: 'Add an "HTTP Request" node. Set Method to POST. Paste your webhook URL. If n8n is in Docker, replace "localhost" with "host.docker.internal" in the URL.' },
      { title: 'Add Send Email node', desc: 'Add a "Send Email" node. Connect your Gmail SMTP credentials (smtp.gmail.com, port 465, SSL). Use {{ $json.report.kpiResults }} to build your email body.' },
      { title: 'Activate the workflow', desc: 'Toggle the workflow to Active. It will now run automatically every day.' },
    ],
    link: 'https://docs.n8n.io',
    linkText: 'n8n Documentation'
  },
  n8n_cloud: {
    title: 'n8n Cloud',
    icon: '☁️',
    color: '#e74c3c',
    steps: [
      { title: 'Sign up for n8n Cloud', desc: 'Go to app.n8n.cloud and create a free account.' },
      { title: 'Create a new workflow', desc: 'Click "Add workflow" from the dashboard.' },
      { title: 'Add Schedule Trigger', desc: 'Add a Schedule Trigger node and set your preferred daily time.' },
      { title: 'Add HTTP Request node', desc: 'Add an HTTP Request node. Set Method to POST. Paste your webhook URL exactly as shown.' },
      { title: 'Add Send Email node', desc: 'Add a Send Email node with your SMTP credentials or use n8n\'s built-in Gmail node.' },
      { title: 'Save and activate', desc: 'Click Save, then toggle the workflow to Active.' },
    ],
    link: 'https://app.n8n.cloud',
    linkText: 'Open n8n Cloud'
  },
  zapier: {
    title: 'Zapier',
    icon: '⚡',
    color: '#ff4a00',
    steps: [
      { title: 'Sign up for Zapier', desc: 'Go to zapier.com and create a free account (100 tasks/month free).' },
      { title: 'Create a new Zap', desc: 'Click "Create Zap" from your dashboard.' },
      { title: 'Set the trigger', desc: 'Choose "Schedule by Zapier" as your trigger. Set it to run daily at your preferred time.' },
      { title: 'Add a Webhooks action', desc: 'Add a "Webhooks by Zapier" action. Set Type to POST. Paste your webhook URL. Set Data Type to JSON.' },
      { title: 'Add an Email action', desc: 'Add a "Gmail" or "Email by Zapier" action. Map the report data to your email body. Add recipient email addresses.' },
      { title: 'Turn on your Zap', desc: 'Click "Publish Zap". Your alerts will now run automatically every day.' },
    ],
    link: 'https://zapier.com',
    linkText: 'Open Zapier'
  },
  make: {
    title: 'Make (formerly Integromat)',
    icon: '🔄',
    color: '#6d2ae2',
    steps: [
      { title: 'Sign up for Make', desc: 'Go to make.com and create a free account (1,000 operations/month free — no credit card needed).' },
      { title: 'Create a new scenario', desc: 'Click "Create a new scenario" from your dashboard.' },
      { title: 'Add a Schedule trigger', desc: 'Click the + button and search for "Schedule". Set it to run daily.' },
      { title: 'Add an HTTP module', desc: 'Add an HTTP → Make a request module. Set Method to POST. Paste your webhook URL. Set Body type to Raw → JSON.' },
      { title: 'Add an Email module', desc: 'Add a Gmail or Email module. Map the response data to your email. Add your recipient email addresses.' },
      { title: 'Activate the scenario', desc: 'Click "Run once" to test, then turn on scheduling. Your alerts are now fully automated.' },
    ],
    link: 'https://make.com',
    linkText: 'Open Make'
  },
  power_automate: {
    title: 'Power Automate',
    icon: '🔵',
    color: '#0066cc',
    steps: [
      { title: 'Open Power Automate', desc: 'Go to flow.microsoft.com and sign in with your Microsoft 365 account.' },
      { title: 'Create a new flow', desc: 'Click "New flow" → "Scheduled cloud flow". Set your daily run time.' },
      { title: 'Add an HTTP action', desc: 'Click "+ New step" → search for "HTTP". Set Method to POST. Paste your webhook URL. Add Header: Content-Type = application/json.' },
      { title: 'Add a Send Email action', desc: 'Add "Send an email (V2)" action from the Outlook connector. Map the HTTP response body to your email.' },
      { title: 'Add recipient emails', desc: 'In the To field, add all recipient email addresses separated by semicolons.' },
      { title: 'Save and test', desc: 'Click Save, then "Test" to run it manually. Once confirmed, it will run automatically on schedule.' },
    ],
    link: 'https://flow.microsoft.com',
    linkText: 'Open Power Automate'
  },
  gmail: {
    title: 'Gmail SMTP Setup',
    icon: '📧',
    color: '#ea4335',
    steps: [
      { title: 'Enable 2-Step Verification', desc: 'Go to myaccount.google.com → Security → 2-Step Verification and turn it on.' },
      { title: 'Generate an App Password', desc: 'Go to myaccount.google.com/apppasswords. Select "Mail" and your device. Click Generate.' },
      { title: 'Copy the 16-character password', desc: 'Google will show you a 16-character password like "abcd efgh ijkl mnop". Copy it — you won\'t see it again.' },
      { title: 'Use in your automation tool', desc: 'In n8n/Zapier/Make, set SMTP server to smtp.gmail.com, port 465, SSL enabled. Use your Gmail address and the App Password.' },
    ],
    link: 'https://myaccount.google.com/apppasswords',
    linkText: 'Generate App Password'
  }
};

// ── Styles ──────────────────────────────────────────────────────────────────
const theme = {
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  primaryLight: '#eff6ff',
  primaryBorder: '#bfdbfe',
  success: '#059669',
  successLight: '#ecfdf5',
  warning: '#d97706',
  warningLight: '#fffbeb',
  danger: '#dc2626',
  dangerLight: '#fef2f2',
  text: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  border: '#e5e7eb',
  borderStrong: '#d1d5db',
  bg: '#f9fafb',
  white: '#ffffff',
  radius: '12px',
  radiusSm: '8px',
};

const s = {
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 6 },
  hint: { display: 'block', fontSize: 12, color: theme.textMuted, marginBottom: 6 },
  input: { width: '100%', padding: '10px 14px', border: `1.5px solid ${theme.border}`, borderRadius: theme.radiusSm, fontSize: 14, boxSizing: 'border-box', outline: 'none', color: theme.text, background: theme.white, fontFamily: 'inherit' },
  select: { width: '100%', padding: '10px 14px', border: `1.5px solid ${theme.border}`, borderRadius: theme.radiusSm, fontSize: 14, boxSizing: 'border-box', outline: 'none', color: theme.text, background: theme.white, fontFamily: 'inherit' },
};

export default function App() {
  const [step, setStep] = useState(1);
  const [page, setPage] = useState('wizard'); // wizard | guide
  const [guideKey, setGuideKey] = useState(null);
  const [email, setEmail] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetName, setSheetName] = useState('Sheet1');
  const [columns, setColumns] = useState([]);
  const [colMap, setColMap] = useState({});
  const [kpis, setKpis] = useState({});
  const [emailConfig, setEmailConfig] = useState({ type: 'webhook' });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function extractSheetId(url) {
    const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return m ? m[1] : url.trim();
  }

  async function handlePreviewSheet() {
    setError('');
    setLoading(true);
    try {
      const sheetId = extractSheetId(sheetUrl);
      const res = await fetch(`${BACKEND}/api/preview-sheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetId, sheetName }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setColumns(data.columns);
      // Auto-map columns by fuzzy match
      const autoMap = {};
      const keywords = {
        prDate: ['pr date', 'pr_date', 'request date', 'req date', 'requisition'],
        rfqDate: ['rfq date', 'rfq_date', 'quote date', 'enquiry'],
        poDate: ['po date', 'po_date', 'order date', 'purchase date'],
        dod: ['dod', 'po dod', 'delivery date', 'expected delivery', 'due date', 'eta'],
        actualDod: ['actual dod', 'actual delivery'],
        delStatus: ['delivery status', 'del status', 'status', 'current status'],
        vendor: ['vendor name', 'vendor', 'supplier', 'contractor'],
        value: ['po value', 'value', 'order value', 'amount'],
        desc: ['short description', 'description', 'item', 'material'],
        poNumber: ['po number', 'po no', 'order number'],
        dept: ['dept', 'department', 'dept.'],
        pgr: ['pgr', 'purchasing group', 'pur. group'],
      };
      data.columns.forEach(col => {
        const colLower = col.toLowerCase();
        Object.entries(keywords).forEach(([field, kws]) => {
          if (!autoMap[field] && kws.some(kw => colLower.includes(kw) || kw.includes(colLower))) {
            autoMap[field] = col;
          }
        });
      });
      setColMap(autoMap);
      setStep(3);
    } catch (e) {
      setError('Could not load sheet. Make sure it is set to "Anyone with the link can view".');
    }
    setLoading(false);
  }

  async function handleSubmit() {
    setError('');
    setLoading(true);
    try {
      const sheetId = extractSheetId(sheetUrl);
      const res = await fetch(`${BACKEND}/api/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, sheetId, sheetName, colMap, kpis, emailConfig }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setResult(data);
      setStep(6);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  function openGuide(key) {
    setGuideKey(key);
    setPage('guide');
  }

  if (page === 'guide' && guideKey) {
    return <GuidePage guide={GUIDES[guideKey]} onBack={() => setPage('wizard')} />;
  }

  const totalSteps = 5;
  const progress = Math.min(((step - 1) / totalSteps) * 100, 100);

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Header */}
      <header style={{ background: theme.white, borderBottom: `1px solid ${theme.border}`, padding: '0 24px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 780, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, background: theme.primary, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🔔</div>
            <span style={{ fontWeight: 700, fontSize: 18, color: theme.text }}>ProcureAlert</span>
          </div>
          {step < 6 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: theme.textSecondary }}>
              <span>Step {step} of {totalSteps}</span>
            </div>
          )}
        </div>
      </header>

      {/* Progress */}
      {step < 6 && (
        <div style={{ background: theme.border, height: 3 }}>
          <div style={{ background: theme.primary, height: 3, width: `${progress}%`, transition: 'width 0.4s ease' }} />
        </div>
      )}

      <main style={{ maxWidth: 680, margin: '40px auto', padding: '0 20px 60px' }}>

        {/* Step 1 — Welcome */}
        {step === 1 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <div style={{ width: 72, height: 72, background: theme.primaryLight, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 20px' }}>🔔</div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: theme.text, margin: '0 0 10px' }}>Welcome to ProcureAlert</h1>
              <p style={{ color: theme.textSecondary, fontSize: 16, margin: 0 }}>Set up automated procurement alerts in 5 minutes. No technical knowledge required.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 40 }}>
              {[['📊', 'Connect your sheet', 'Google Sheets or Excel'], ['⚙️', 'Choose your KPIs', 'Pick what to track'], ['📧', 'Get alerts', 'Daily to your inbox']].map(([icon, title, desc]) => (
                <div key={title} style={{ background: theme.white, border: `1px solid ${theme.border}`, borderRadius: theme.radius, padding: 20, textAlign: 'center' }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: theme.text, marginBottom: 4 }}>{title}</div>
                  <div style={{ fontSize: 12, color: theme.textMuted }}>{desc}</div>
                </div>
              ))}
            </div>

            <Card>
              <label style={s.label}>Your work email</label>
              <input style={s.input} type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && email && setStep(2)} />
              <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 8, marginBottom: 0 }}>We'll generate a personal webhook URL tied to your email.</p>
              {error && <ErrorBox msg={error} />}
              <PrimaryButton style={{ marginTop: 24 }} onClick={() => { if (!email) { setError('Please enter your email'); return; } setError(''); setStep(2); }}>
                Get Started →
              </PrimaryButton>
            </Card>
          </div>
        )}

        {/* Step 2 — Connect Sheet */}
        {step === 2 && (
          <Card>
            <StepHeader step={2} title="Connect Your Data" subtitle="Paste your Google Sheet link below" />
            <div style={{ background: theme.primaryLight, border: `1px solid ${theme.primaryBorder}`, borderRadius: theme.radiusSm, padding: '12px 16px', marginBottom: 24, fontSize: 13, color: theme.primary }}>
              <strong>Before continuing:</strong> Open your Google Sheet → Share → Change to "Anyone with the link can view"
            </div>
            <label style={s.label}>Google Sheet URL</label>
            <input style={s.input} placeholder="https://docs.google.com/spreadsheets/d/..." value={sheetUrl} onChange={e => setSheetUrl(e.target.value)} />
            <div style={{ marginTop: 16 }}>
              <label style={s.label}>Sheet / Tab name</label>
              <span style={s.hint}>The tab name at the bottom of your spreadsheet</span>
              <input style={s.input} placeholder="Sheet1" value={sheetName} onChange={e => setSheetName(e.target.value)} />
            </div>
            {error && <ErrorBox msg={error} />}
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <SecondaryButton onClick={() => setStep(1)}>← Back</SecondaryButton>
              <PrimaryButton onClick={handlePreviewSheet} disabled={loading}>{loading ? 'Loading columns...' : 'Load My Columns →'}</PrimaryButton>
            </div>
          </Card>
        )}

        {/* Step 3 — Map Columns */}
        {step === 3 && (
          <Card>
            <StepHeader step={3} title="Map Your Columns" subtitle="We've auto-detected your columns — confirm or adjust below" />
            <div style={{ background: theme.successLight, border: `1px solid #a7f3d0`, borderRadius: theme.radiusSm, padding: '10px 14px', marginBottom: 24, fontSize: 13, color: theme.success }}>
              ✓ Loaded {columns.length} columns from your sheet
            </div>
            {FIELD_DEFS.map(field => (
              <div key={field.key} style={{ marginBottom: 16 }}>
                <label style={s.label}>{field.label}</label>
                <span style={s.hint}>{field.hint}</span>
                <select style={s.select} value={colMap[field.key] || ''} onChange={e => setColMap(p => ({ ...p, [field.key]: e.target.value }))}>
                  <option value="">— skip this field —</option>
                  {columns.map(col => <option key={col} value={col}>{col}</option>)}
                </select>
              </div>
            ))}
            {error && <ErrorBox msg={error} />}
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <SecondaryButton onClick={() => setStep(2)}>← Back</SecondaryButton>
              <PrimaryButton onClick={() => setStep(4)}>Next →</PrimaryButton>
            </div>
          </Card>
        )}

        {/* Step 4 — Select KPIs */}
        {step === 4 && (
          <Card>
            <StepHeader step={4} title="Select Your KPIs" subtitle="Choose which metrics and alerts you want to track" />
            {AVAILABLE_KPIS.map((kpi, i) => (
              <div key={kpi.key} style={{ padding: '16px 0', borderBottom: i < AVAILABLE_KPIS.length - 1 ? `1px solid ${theme.border}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ paddingTop: 2 }}>
                    <input type="checkbox" id={kpi.key} checked={!!kpis[kpi.key]?.enabled}
                      onChange={() => setKpis(p => ({ ...p, [kpi.key]: { ...p[kpi.key], enabled: !p[kpi.key]?.enabled, days: p[kpi.key]?.days || kpi.defaultDays } }))}
                      style={{ width: 18, height: 18, cursor: 'pointer', accentColor: theme.primary }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label htmlFor={kpi.key} style={{ fontWeight: 600, cursor: 'pointer', fontSize: 15, color: theme.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{kpi.icon}</span> {kpi.label}
                    </label>
                    <p style={{ margin: '3px 0 0', fontSize: 13, color: theme.textSecondary }}>{kpi.description}</p>
                    {kpis[kpi.key]?.enabled && kpi.hasThreshold && (
                      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, background: theme.primaryLight, padding: '10px 14px', borderRadius: theme.radiusSm }}>
                        <span style={{ fontSize: 13, color: theme.primary }}>{kpi.thresholdLabel}</span>
                        <input type="number" min="1" max="365" value={kpis[kpi.key]?.days || kpi.defaultDays}
                          onChange={e => setKpis(p => ({ ...p, [kpi.key]: { ...p[kpi.key], days: parseInt(e.target.value) } }))}
                          style={{ ...s.input, width: 70, margin: 0, textAlign: 'center' }} />
                        <span style={{ fontSize: 13, color: theme.primary }}>{kpi.unit}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {error && <ErrorBox msg={error} />}
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <SecondaryButton onClick={() => setStep(3)}>← Back</SecondaryButton>
              <PrimaryButton onClick={() => { if (!Object.values(kpis).some(k => k?.enabled)) { setError('Select at least one KPI'); return; } setError(''); setStep(5); }}>Next →</PrimaryButton>
            </div>
          </Card>
        )}

        {/* Step 5 — Delivery Method */}
        {step === 5 && (
          <Card>
            <StepHeader step={5} title="Choose How to Receive Alerts" subtitle="Pick your preferred automation tool to send emails" />
            {[
              { type: 'make', label: 'Make.com', icon: '🔄', desc: 'Free, no credit card, easiest to set up — recommended', badge: 'Recommended' },
              { type: 'zapier', label: 'Zapier', icon: '⚡', desc: 'Popular automation platform, 100 tasks/month free' },
              { type: 'n8n_cloud', label: 'n8n Cloud', icon: '☁️', desc: 'Online n8n — good for technical users' },
              { type: 'n8n_local', label: 'n8n Self-hosted', icon: '🔧', desc: 'Running n8n locally on your machine via Docker' },
              { type: 'power_automate', label: 'Power Automate', icon: '🔵', desc: 'Best if you use Microsoft 365 / Outlook' },
            ].map(opt => (
              <div key={opt.type} onClick={() => setEmailConfig({ type: opt.type })}
                style={{ padding: 16, border: `2px solid ${emailConfig.type === opt.type ? theme.primary : theme.border}`, borderRadius: theme.radius, marginBottom: 12, cursor: 'pointer', background: emailConfig.type === opt.type ? theme.primaryLight : theme.white, transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 24 }}>{opt.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 15, color: theme.text }}>{opt.label}</span>
                      {opt.badge && <span style={{ background: theme.primary, color: 'white', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{opt.badge}</span>}
                    </div>
                    <div style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2 }}>{opt.desc}</div>
                  </div>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${emailConfig.type === opt.type ? theme.primary : theme.borderStrong}`, background: emailConfig.type === opt.type ? theme.primary : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {emailConfig.type === opt.type && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'white' }} />}
                  </div>
                </div>
              </div>
            ))}
            {error && <ErrorBox msg={error} />}
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <SecondaryButton onClick={() => setStep(4)}>← Back</SecondaryButton>
              <PrimaryButton onClick={handleSubmit} disabled={loading}>{loading ? 'Saving...' : 'Complete Setup →'}</PrimaryButton>
            </div>
          </Card>
        )}

        {/* Step 6 — Done */}
        {step === 6 && result && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ width: 72, height: 72, background: theme.successLight, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 20px' }}>🎉</div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: theme.text, margin: '0 0 10px' }}>You're all set!</h1>
              <p style={{ color: theme.textSecondary, fontSize: 16, margin: 0 }}>Your ProcureAlert is configured. Now connect your automation tool.</p>
            </div>

            {/* Webhook URL */}
            <Card style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: theme.text, marginBottom: 12 }}>🔗 Your Webhook URL</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={{ ...s.input, fontFamily: 'monospace', fontSize: 13, background: theme.bg }} value={result.webhookUrl} readOnly />
                <button onClick={() => { navigator.clipboard.writeText(result.webhookUrl); }}
                  style={{ padding: '10px 18px', background: theme.primary, color: 'white', border: 'none', borderRadius: theme.radiusSm, cursor: 'pointer', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' }}>
                  Copy
                </button>
              </div>
              <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 8, marginBottom: 0 }}>
                User ID: <code style={{ background: theme.bg, padding: '2px 6px', borderRadius: 4 }}>{result.userId}</code> — save this to update your settings later
              </p>
            </Card>

            {/* Setup Guide */}
            <Card>
              <div style={{ fontWeight: 700, fontSize: 15, color: theme.text, marginBottom: 16 }}>📖 Setup Guides</div>
              <p style={{ fontSize: 14, color: theme.textSecondary, marginTop: 0, marginBottom: 20 }}>
                Click a guide below to see step-by-step instructions for connecting your webhook to your chosen tool.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {Object.entries(GUIDES).map(([key, guide]) => (
                  <button key={key} onClick={() => openGuide(key)}
                    style={{ padding: '14px 16px', background: theme.bg, border: `1.5px solid ${theme.border}`, borderRadius: theme.radius, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 24 }}>{guide.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: theme.text }}>{guide.title}</div>
                      <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{guide.steps.length} steps</div>
                    </div>
                    <span style={{ marginLeft: 'auto', color: theme.textMuted, fontSize: 16 }}>→</span>
                  </button>
                ))}
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Guide Page ───────────────────────────────────────────────────────────────
function GuidePage({ guide, onBack }) {
  return (
    <div style={{ minHeight: '100vh', background: theme.bg, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <header style={{ background: theme.white, borderBottom: `1px solid ${theme.border}`, padding: '0 24px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16, height: 64 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: theme.primary, fontWeight: 600, padding: 0 }}>← Back</button>
          <span style={{ color: theme.border }}>|</span>
          <span style={{ fontSize: 20 }}>{guide.icon}</span>
          <span style={{ fontWeight: 700, fontSize: 16, color: theme.text }}>{guide.title} Setup Guide</span>
        </div>
      </header>

      <main style={{ maxWidth: 680, margin: '40px auto', padding: '0 20px 60px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {guide.steps.map((step, i) => (
            <div key={i} style={{ background: theme.white, border: `1px solid ${theme.border}`, borderRadius: theme.radius, padding: 24, display: 'flex', gap: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: theme.primaryLight, border: `2px solid ${theme.primaryBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, color: theme.primary, flexShrink: 0 }}>
                {i + 1}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: theme.text, marginBottom: 6 }}>{step.title}</div>
                <div style={{ fontSize: 14, color: theme.textSecondary, lineHeight: 1.6 }}>{step.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 32, padding: 24, background: theme.primaryLight, border: `1px solid ${theme.primaryBorder}`, borderRadius: theme.radius, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: theme.primary }}>Need more help?</div>
            <div style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}>Visit the official documentation</div>
          </div>
          <a href={guide.link} target="_blank" rel="noreferrer"
            style={{ padding: '10px 20px', background: theme.primary, color: 'white', borderRadius: theme.radiusSm, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
            {guide.linkText} ↗
          </a>
        </div>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: theme.primary, fontWeight: 600 }}>← Back to your setup</button>
        </div>
      </main>
    </div>
  );
}

// ── Reusable Components ───────────────────────────────────────────────────────
function Card({ children, style }) {
  return (
    <div style={{ background: theme.white, borderRadius: theme.radius, padding: 32, border: `1px solid ${theme.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', ...style }}>
      {children}
    </div>
  );
}

function StepHeader({ step, title, subtitle }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: theme.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Step {step}</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: theme.text, margin: '0 0 6px' }}>{title}</h2>
      <p style={{ fontSize: 14, color: theme.textSecondary, margin: 0 }}>{subtitle}</p>
    </div>
  );
}

function PrimaryButton({ onClick, children, disabled, style }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ flex: 1, padding: '13px 24px', background: disabled ? theme.textMuted : theme.primary, color: 'white', border: 'none', borderRadius: theme.radiusSm, fontSize: 15, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', transition: 'background 0.2s', fontFamily: 'inherit', ...style }}>
      {children}
    </button>
  );
}

function SecondaryButton({ onClick, children }) {
  return (
    <button onClick={onClick}
      style={{ padding: '13px 20px', background: theme.white, color: theme.primary, border: `2px solid ${theme.primaryBorder}`, borderRadius: theme.radiusSm, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
      {children}
    </button>
  );
}

function ErrorBox({ msg }) {
  return (
    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: theme.radiusSm, padding: '12px 16px', color: '#dc2626', fontSize: 14, marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span>⚠️</span> {msg}
    </div>
  );
}
