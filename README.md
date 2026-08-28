# 🔔 ProcureAlert — Automated Procurement Intelligence

ProcureAlert is an open-source procurement alert system that reads your PR/PO data from Google Sheets, runs configurable KPI logic, and sends automated email alerts every morning — with zero manual work.

Built by **Huzaifa Aziz** — based on real procurement workflows from Solvay SHPCO.

**GitHub:** [github.com/huzaifaaziz90/procurement-alert-system](https://github.com/huzaifaaziz90/procurement-alert-system)

---

## 🏗️ Architecture

```
Google Sheets (your data)
        ↓
GitHub Actions (runs daily at 7:50am UTC)
        ↓
Python Script (alert logic → report.json)
        ↓
Google Drive (stores report.json)
        ↓
n8n / Zapier / Make (fetches JSON → sends email)
        ↓
Your Inbox 📧

─────────────────────────────────────────

Web App (optional SaaS interface)
├── Frontend: React (GitHub Pages)
└── Backend: Node.js + Express (Railway / local)
```

---

## ✅ What's Built

| Component | Description | Status |
|-----------|-------------|--------|
| Python alert script | Reads Google Sheets, runs KPI logic, outputs report.json | ✅ Live |
| GitHub Actions | Runs script daily at 7:50am UTC automatically | ✅ Active |
| Google Drive integration | Uploads report.json after every run | ✅ Working |
| n8n workflow | Fetches JSON, builds HTML email, sends via Gmail SMTP | ✅ Active |
| React frontend | Setup wizard for new users | ✅ Built |
| Node.js backend | API with webhook endpoints per user | ✅ Built |
| Mock dataset v1 | 300-row clean dataset | ✅ Done |
| Mock dataset v2 | 300-row intentionally inconsistent dataset | ✅ Done |

---

## 📊 KPIs Tracked

| KPI | Description | Configurable |
|-----|-------------|-------------|
| Overdue deliveries | Items past promised delivery date | ✅ Days threshold |
| PRs without RFQ | Requests stuck without a quote | ✅ Days threshold |
| High-risk vendors | Suppliers with multiple overdue orders | ✅ Count threshold |
| Upcoming deliveries | Deliveries due soon | ✅ Days window |
| Avg PR→PO cycle time | Days from request to order | — |
| On-time delivery rate | % delivered on or before DOD | — |
| Spend by vendor | Top 10 suppliers by value | — |
| Cancellation rate | % of cancelled orders | — |
| Department breakdown | Order volume by department | — |

---

## 🚀 Quick Start

### Option A — Use the Web App (Easiest)

1. Open the frontend at `http://localhost:3000` (or deployed URL)
2. Enter your email
3. Paste your Google Sheet URL (must be set to "Anyone with link can view")
4. Map your columns — auto-detected
5. Select your KPIs and thresholds
6. Get your webhook URL
7. Plug into Zapier, Make, Power Automate, or n8n

### Option B — Python Script (GitHub Actions)

See [Full Setup Guide](#full-setup-guide) below.

---

## 🗂️ Project Structure

```
procurement-alert-system/
├── backend/                  # Node.js API
│   ├── index.js              # Express server + alert logic
│   ├── package.json
│   └── .env.example          # Copy to .env and fill in
│
├── frontend/                 # React web app
│   ├── src/
│   │   ├── App.js            # Main app — setup wizard + guides
│   │   └── index.js
│   └── package.json
│
├── scripts/                  # Python automation
│   ├── procurement_report.py # Main script
│   └── config.json           # Your column mappings + KPI config
│
├── data/
│   ├── PR_PO_Log_2026_Mock.xlsx    # Clean mock dataset (300 rows)
│   └── PR_PO_Log_2026_Mock_v2.xlsx # Inconsistent mock dataset (300 rows)
│
├── docs/
│   ├── DOCKER_SETUP.md       # Docker + n8n setup guide
│   └── N8N_SETUP.md          # n8n workflow guide
│
├── .github/
│   └── workflows/
│       └── run_report.yml    # GitHub Actions daily schedule
│
└── README.md
```

---

## 📋 Full Setup Guide

### Prerequisites
- Google account
- GitHub account
- Node.js v18+ (for web app)
- Python 3.11+ (for script)
- Docker Desktop (for local n8n)

---

### Step 1 — Clone the repo

```bash
git clone https://github.com/huzaifaaziz90/procurement-alert-system.git
cd procurement-alert-system
```

---

### Step 2 — Set up Google Sheets

1. Upload your PR/PO Excel file to Google Sheets
   - Go to [sheets.google.com](https://sheets.google.com)
   - File → Import → Upload your file
   - Import as Google Sheets format (not Excel)
2. Note your Sheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/**YOUR_SHEET_ID**/edit`
3. Share the sheet:
   - Click Share → Change to "Anyone with the link can view"

---

### Step 3 — Google Cloud Setup (for GitHub Actions)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create or select a project
3. Enable **Google Sheets API** and **Google Drive API**
4. Go to **IAM & Admin → Service Accounts** → Create Service Account
   - Name: `procurement-github-actions`
   - Click Create → skip optional steps → Done
5. Click the service account → **Keys** tab → Add Key → JSON
6. Download the JSON file — keep it safe
7. Share your Google Drive folder with the service account email

---

### Step 4 — GitHub Actions Setup

1. Go to your GitHub repo → **Settings → Secrets → Actions**
2. Add secret: `GOOGLE_SERVICE_ACCOUNT_JSON` → paste the full JSON key contents
3. The workflow runs automatically at 7:50am UTC daily
4. To run manually: **Actions → Run Procurement Report → Run workflow**

The workflow file is at `.github/workflows/run_report.yml`

---

### Step 5 — Run the Web App Locally

**Backend:**
```bash
cd backend
npm install
cp .env.example .env
# Fill in .env if needed
node index.js
# Running at http://localhost:3001
```

**Frontend:**
```bash
cd frontend
npm install
npm start
# Opens at http://localhost:3000
```

Go through the setup wizard, get your webhook URL.

---

### Step 6 — Connect Your Automation Tool

Paste your webhook URL into any of these tools:

| Tool | Free Tier | Best For |
|------|-----------|----------|
| [Make.com](https://make.com) | 1,000 ops/month | Everyone — recommended |
| [Zapier](https://zapier.com) | 100 tasks/month | Non-technical users |
| [n8n Cloud](https://app.n8n.cloud) | 5 workflows | Technical users |
| n8n Self-hosted | Unlimited | Full control |
| [Power Automate](https://flow.microsoft.com) | With Microsoft 365 | Microsoft shops |

**In Make/Zapier/n8n:**
1. Schedule trigger → daily at 8:00am
2. HTTP POST request → your webhook URL
3. Send email → map report data to email body

---

### Step 7 — Set Up n8n (Self-hosted with Docker)

See [docs/DOCKER_SETUP.md](docs/DOCKER_SETUP.md) for full Docker setup.

Quick start:
```bash
docker run -d \
  --restart unless-stopped \
  --name n8n \
  -p 5678:5678 \
  -v $HOME/.n8n:/home/node/.n8n \
  -v $HOME/procurement-alerts:/data/procurement \
  docker.n8n.io/n8nio/n8n
```

Open n8n at [http://localhost:5678](http://localhost:5678)

See [docs/N8N_SETUP.md](docs/N8N_SETUP.md) for workflow setup.

---

## 🔧 Configuration

Edit `scripts/config.json` to match your sheet's column names:

```json
{
  "data_source": "google_sheets",
  "sheet_id": "YOUR_SHEET_ID",
  "sheet_name": "Sheet1",
  "col_map": {
    "pr_date": "PR date",
    "rfq_date": "RFQ Date",
    "po_date": "PO Date",
    "dod": "PO DOD",
    "del_status": "Delivery Status",
    "vendor": "Vendor Name",
    "value": "PO Value",
    "desc": "Short Description",
    "po_number": "PO Number",
    "dept": "Dept.",
    "pgr": "PGr"
  },
  "delivered_text": "Delivered",
  "alerts": {
    "overdue": true,
    "overdue_days": 7,
    "no_rfq": true,
    "no_rfq_days": 14,
    "vendor_risk": true,
    "vendor_risk_count": 3,
    "upcoming": true,
    "upcoming_days": 14
  },
  "focus_group": "HEY"
}
```

---

## 🐍 Python Script Reference

```bash
# First run — interactive setup
python scripts/procurement_report.py

# Re-run with saved config
python scripts/procurement_report.py

# Reconfigure everything
python scripts/procurement_report.py --setup

# GitHub Actions mode (auto-uploads to Drive)
python scripts/procurement_report.py --auto
```

---

## 🔗 API Reference

### POST `/api/setup`
Save user configuration and get a webhook URL.

```json
{
  "email": "you@company.com",
  "sheetId": "YOUR_SHEET_ID",
  "sheetName": "Sheet1",
  "colMap": { "vendor": "Vendor Name", "dod": "PO DOD", ... },
  "kpis": { "overdue": { "enabled": true, "days": 7 } }
}
```

Returns:
```json
{
  "success": true,
  "userId": "abc123",
  "webhookUrl": "https://your-backend.com/api/run/abc123"
}
```

### POST `/api/run/:userId`
Run the report for a user. Called by Zapier/Make/n8n on a schedule.

Returns full JSON report with all KPI results.

### POST `/api/preview-sheet`
Load column headers from a Google Sheet for the setup wizard.

```json
{ "sheetId": "YOUR_SHEET_ID", "sheetName": "Sheet1" }
```

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Data source | Google Sheets |
| Alert logic (script) | Python + pandas |
| Alert logic (API) | Node.js + Express |
| Scheduler | GitHub Actions |
| Automation | n8n / Zapier / Make / Power Automate |
| Email | Gmail SMTP / any SMTP |
| Frontend | React |
| Hosting (backend) | Railway (free) |
| Hosting (frontend) | GitHub Pages |
| Storage | Google Drive (report.json) |

---

## 🗺️ Roadmap

- [ ] Deploy backend to Railway
- [ ] Deploy frontend to GitHub Pages
- [ ] SharePoint / OneDrive integration
- [ ] Email sending directly from the web app
- [ ] Dashboard with charts and trends
- [ ] Multi-user accounts with Google login
- [ ] PDF report export
- [ ] Slack / Teams notifications

---

## 👤 Author

**Huzaifa Aziz**
Procurement & Supply Chain Professional

Built to automate the PR/PO monitoring workflow I ran at Solvay SHPCO — flagging overdue deliveries, vendors with multiple late orders, and purchase requests stuck without quotes.

---

## 📄 License

MIT — free to use, modify, and distribute.
