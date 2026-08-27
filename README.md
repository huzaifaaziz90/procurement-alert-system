# ProcureAlert — Automated Procurement Monitoring System

[![Python](https://img.shields.io/badge/Python-3.8%2B-blue?logo=python)](https://python.org)
[![n8n](https://img.shields.io/badge/n8n-Workflow%20Automation-orange?logo=n8n)](https://n8n.io)
[![Docker](https://img.shields.io/badge/Docker-Required-blue?logo=docker)](https://docker.com)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Active-brightgreen)]()

A self-hosted procurement alert system that reads your PR/PO data from
Excel or Google Sheets, runs configurable business logic, and sends
automated email alerts — daily summaries, overdue deliveries, vendor
risk flags, and more.

Built as a portfolio project demonstrating end-to-end automation using
Python, n8n, Docker, and Google Drive. Designed for procurement and
operations teams who want actionable alerts without enterprise software costs.

---

## 📸 What It Does

```
Your Excel / Google Sheets data
          ↓
Python script — runs your alert logic
          ↓
report.json — structured output
          ↓
n8n workflow — reads report, routes alerts
          ↓
Gmail — daily summary + urgent alert emails
```

**Daily Summary Email** — every morning at 8am:
- Total PRs and POs in the pipeline
- Average PR-to-PO cycle time
- Savings achieved vs PO value
- HEY purchase group focus metrics

**Urgent Alert Email** — fires when thresholds are breached:
- Deliveries overdue by 7+ days
- PRs stuck without RFQ for 14+ days
- Vendors with 3 or more overdue POs
- Issued POs without vendor acknowledgement

---

## 🗂 Project Structure

```
procurement-alert-system/
├── scripts/
│   └── procurement_report.py     # Main logic script (configurable)
├── data/
│   └── PR_PO_Log_2026_Mock.xlsx  # Mock 2026 data (300 rows, all alert types)
├── frontend/
│   └── procurement-alert-tool.html  # Browser-based tool (no install needed)
├── docs/
│   ├── DOCKER_SETUP.md           # Docker installation guide
│   ├── N8N_SETUP.md              # n8n workflow setup guide
│   ├── EMAILJS_SETUP.md          # Email sending setup
│   └── screenshots/              # UI and email screenshots
├── .github/
│   └── workflows/
│       └── run_report.yml        # GitHub Actions (optional automation)
├── requirements.txt
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

| Tool | Purpose | Install Guide |
|---|---|---|
| Docker Desktop | Runs n8n locally | [docs/DOCKER_SETUP.md](docs/DOCKER_SETUP.md) |
| Python 3.8+ | Runs the report script | [python.org/downloads](https://python.org/downloads) |
| Google Account | Hosts report.json on Drive | Free |
| Gmail | Sends alert emails | Free |

### 1 — Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/procurement-alert-system.git
cd procurement-alert-system
```

### 2 — Install Python dependencies

```bash
pip install -r requirements.txt
```

### 3 — Run the script (interactive setup)

```bash
python scripts/procurement_report.py
```

On first run, the script walks you through:
- Where your data lives (local Excel or Google Sheets)
- Which columns map to which fields
- Which alerts you want enabled
- Where to save the output (local folder or Google Drive)

Your choices are saved to `config.json` so you never have to repeat them.

### 4 — Set up n8n

Follow [docs/N8N_SETUP.md](docs/N8N_SETUP.md) to import the workflow
and connect your Gmail credentials. Takes about 15 minutes.

### 5 — Activate

Toggle the workflow Active in n8n. Done — emails start arriving daily.

---

## ⚙️ Configuration

When you run the script for the first time, it asks you a series of
questions and saves your answers to `config.json`. You can re-run
setup at any time:

```bash
python scripts/procurement_report.py --setup
```

### What gets configured

**Data source**
- Local Excel file path, or
- Google Sheets ID (share link)

**Column mapping** — tell the script which of your columns means what:

| Concept | Example column names |
|---|---|
| PR / Request date | PR date, Request Date, Req Date |
| RFQ / Quote date | RFQ Date, Quote Date, Enquiry Date |
| PO / Order date | PO Date, Order Date |
| Expected delivery | PO DOD, ETA, Delivery Date, Due Date |
| Delivery status | Delivery Status, Order Status, Status |
| Vendor / Supplier | Vendor Name, Supplier, Contractor |
| Order value | PO Value, Amount, Cost |
| Description | Short Description, Item, Material |

**Alert thresholds**

| Alert | Default | What it flags |
|---|---|---|
| Overdue delivery | 7 days | Past expected delivery, not delivered |
| PR without RFQ | 14 days | Request raised, no quote requested yet |
| Vendor risk | 3 POs | Supplier has 3+ overdue orders simultaneously |
| High-value PO | SAR 100,000 | Single order above threshold |

**Purchase group focus** (optional)
- Filter metrics by a specific purchasing group (e.g. HEY, FAV, HEV)
- Reports unissued POs and POs without vendor acknowledgement

---

## 📊 Mock Data

`data/PR_PO_Log_2026_Mock.xlsx` contains 300 rows of realistic
2026 procurement data generated from actual 2022 Solvay SHPCO patterns.

| Metric | Count |
|---|---|
| Total rows | 300 |
| Purchase groups | HEY (177), FAV (85), HEV (38) |
| Overdue deliveries | 83 |
| PRs without RFQ | 49 |
| Upcoming (14 days) | 29 |
| Issued POs — no acknowledgement | 47 |
| High-risk vendors (3+ overdue) | 14 |

All vendor names, descriptions, and values are real patterns from
industrial procurement (chemicals, maintenance, E&I, QHSE) with
dates shifted to 2026 for demo purposes.

---

## 🌐 Frontend Tool

`frontend/procurement-alert-tool.html` is a standalone browser tool
for one-off reports. No installation. No server. Open the file in
Chrome and it works.

**Features:**
- Drag and drop Excel upload (.xlsx, .xls, .csv)
- Auto-detects column names
- Configurable thresholds
- Live results table with overdue, upcoming, and vendor flags
- Email preview
- Copy-to-clipboard report for pasting into Outlook or Gmail
- 100% private — data never leaves the browser

**To use:** download the HTML file, open it in Chrome, upload your
Excel file, configure, click Generate.

**Live demo:**
[https://YOUR_USERNAME.github.io/procurement-alert-system/frontend/procurement-alert-tool.html](https://YOUR_USERNAME.github.io/procurement-alert-system/frontend/procurement-alert-tool.html)

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────┐
│                   DATA SOURCES                       │
│  Local Excel (.xlsx)  │  Google Sheets (live link)  │
└──────────────┬──────────────────────────┬───────────┘
               │                          │
               ▼                          ▼
┌─────────────────────────────────────────────────────┐
│           procurement_report.py (Python)            │
│                                                     │
│  • Column mapping (user-defined)                    │
│  • Alert logic (configurable thresholds)            │
│  • Overdue / No RFQ / Vendor risk / Upcoming        │
│  • Outputs structured report.json                   │
└──────────────────────────┬──────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────┐
│              report.json (output)                   │
│  Local folder  │  Google Drive (public link)        │
└──────────────────────────┬──────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────┐
│                 n8n (local, Docker)                 │
│                                                     │
│  Schedule Trigger (daily 8am)                       │
│       ↓                                             │
│  HTTP Request (fetch report.json)                   │
│       ↓                                             │
│  Code node (build email HTML)                       │
│       ↓                                             │
│  IF node (alert flags)                              │
│   ↓ True              ↓ False                       │
│  🚨 Alert email    📦 Summary email                 │
└──────────────────────────┬──────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────┐
│              Gmail (SMTP via App Password)          │
│  Recipients: configurable, multiple addresses       │
└─────────────────────────────────────────────────────┘
```

---

## 🔒 Privacy

- Your procurement data is never sent to any third-party service
- The Python script reads your data locally or from your own Google Drive
- n8n runs entirely on your own machine (Docker container)
- Gmail credentials are stored locally in n8n's encrypted credential store
- The frontend HTML tool processes data entirely in your browser

---

## 🛠 Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Data processing | Python, pandas, openpyxl | Flexible, handles messy Excel |
| Workflow automation | n8n (self-hosted) | Visual, no-code friendly, free |
| Containerisation | Docker | Consistent environment, easy setup |
| Email delivery | Gmail SMTP | Free, reliable |
| Cloud storage | Google Drive | Free hosting for report JSON |
| Frontend | Vanilla HTML/JS, SheetJS | No framework needed, works offline |
| Version control | GitHub + GitHub Pages | Free hosting and CI |

---

## 📋 Requirements

```
pandas>=1.3.0
openpyxl>=3.0.0
gspread>=5.0.0
google-auth>=2.0.0
google-api-python-client>=2.0.0
```

---

## 🗺 Roadmap

- [x] Python report script with configurable column mapping
- [x] n8n workflow for daily scheduling and email routing
- [x] Mock 2026 data for testing and demonstration
- [x] Frontend HTML tool for one-off reports
- [ ] FastAPI backend for cloud hosting
- [ ] SharePoint / OneDrive integration (Microsoft 365)
- [ ] Gmail OAuth (send from user's own email)
- [ ] User dashboard with report history
- [ ] Multi-tenant support

---

## 👤 Author

**Huzaifa Aziz**
Business Analyst | Product Manager | Procurement Operations

- Worked as Procurement Analyst at Solvay (multinational chemicals)
- Built and managed PR/PO workflows in SAP MM for European suppliers
- Previously rebuilt this workflow in Power Automate — this project
  recreates and extends that system using open-source tools

[LinkedIn](https://linkedin.com/in/huzaifaaziz) · [GitHub](https://github.com/huzaifaaziz)

---

## 📄 License

MIT License — free to use, modify, and distribute.
See [LICENSE](LICENSE) for details.
