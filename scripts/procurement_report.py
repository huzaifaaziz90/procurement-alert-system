"""
ProcureAlert — Procurement Report Script
=========================================
Reads your PR/PO data from a local Excel file or Google Sheets,
runs configurable alert logic, and outputs a structured report.json
that n8n uses to send email alerts.

First run:  python procurement_report.py          (interactive setup)
Re-run:     python procurement_report.py          (uses saved config)
New setup:  python procurement_report.py --setup  (reconfigure)
Auto mode:  python procurement_report.py --auto   (GitHub Actions)

Author: Huzaifa Aziz
"""

import pandas as pd
import json
import os
import sys
import argparse
from datetime import datetime, timedelta
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR  = Path(__file__).parent.resolve()
CONFIG_FILE = SCRIPT_DIR / 'config.json'
OUTPUT_FILE = SCRIPT_DIR / 'report.json'
TODAY       = datetime.today().replace(hour=0, minute=0, second=0, microsecond=0)

# ── Terminal colours ──────────────────────────────────────────────────────────
def c(text, colour):
    codes = {'green':'\033[92m','yellow':'\033[93m','red':'\033[91m',
             'blue':'\033[94m','bold':'\033[1m','reset':'\033[0m','cyan':'\033[96m'}
    return f"{codes.get(colour,'')}{text}{codes['reset']}"

def header(text):
    print(f"\n{c('='*60,'blue')}\n{c(text,'bold')}\n{c('='*60,'blue')}")

def section(text): print(f"\n{c('── '+text+' ──','cyan')}")
def ok(text):      print(f"  {c('✓','green')} {text}")
def warn(text):    print(f"  {c('!','yellow')} {text}")
def info(text):    print(f"  {c('→','blue')} {text}")

def ask(prompt, default=None, options=None):
    if options:
        print(f"\n  {c(prompt,'bold')}")
        for i,opt in enumerate(options,1):
            print(f"    {c(str(i),'yellow')}. {opt}")
        hint = f" [default: {default}]" if default else ""
        while True:
            try:
                raw = input(f"  Enter number{hint}: ").strip()
                if not raw and default is not None: return default
                choice = int(raw)
                if 1 <= choice <= len(options): return options[choice-1]
                print(f"  {c('Enter a number 1–'+str(len(options)),'red')}")
            except (ValueError, KeyboardInterrupt):
                print(f"  {c('Please enter a valid number','red')}")
    else:
        hint = f" [{c(str(default),'yellow')}]" if default is not None else ""
        raw = input(f"\n  {c(prompt,'bold')}{hint}: ").strip()
        return raw if raw else (str(default) if default is not None else '')

def ask_yn(prompt, default=True):
    hint = f"[{c('Y','green')}/n]" if default else f"[y/{c('N','red')}]"
    raw = input(f"\n  {c(prompt,'bold')} {hint}: ").strip().lower()
    if not raw: return default
    return raw in ('y','yes')

# ── Setup ─────────────────────────────────────────────────────────────────────
def run_setup():
    header("ProcureAlert — First Time Setup")
    print(f"\n  Welcome! This takes about 2 minutes. Answers saved to config.json.\n")
    config = {}

    section("1. Where is your data?")
    source = ask("Where does your procurement data live?",
                 options=["Local Excel file (.xlsx or .xls)",
                          "Google Sheets (link)"])

    if "Local" in source:
        config['data_source'] = 'local'
        while True:
            path = ask("Full path to your Excel file",
                       default=str(SCRIPT_DIR/'data'/'PR_PO_Log_2026_Mock.xlsx'))
            if os.path.exists(path):
                ok(f"Found: {path}")
                config['file_path'] = path
                break
            warn(f"File not found: {path}")
        try:
            xl = pd.ExcelFile(config['file_path'])
            sheets = xl.sheet_names
            config['sheet_name'] = sheets[0] if len(sheets)==1 else ask(
                "Which sheet?", options=sheets)
            ok(f"Using sheet: {config['sheet_name']}")
        except Exception:
            config['sheet_name'] = ask("Sheet name", default="Sheet1")
    else:
        config['data_source'] = 'google_sheets'
        url = ask("Google Sheets URL or Sheet ID")
        import re
        m = re.search(r'/spreadsheets/d/([a-zA-Z0-9-_]+)', url)
        config['sheet_id'] = m.group(1) if m else url
        config['sheet_name'] = ask("Sheet/tab name", default="Sheet1")
        ok(f"Sheet ID: {config['sheet_id']}")

    section("2. Column Mapping")
    print("  Loading your file to show available columns...\n")
    df_sample = load_data_raw(config)
    if df_sample is None:
        warn("Could not load data. Check your path and try again.")
        sys.exit(1)

    headers = list(df_sample.columns)
    print(f"  Found {c(str(len(headers)),'green')} columns: "
          f"{c(', '.join(headers[:8]),'yellow')}{'...' if len(headers)>8 else ''}\n")

    def suggest(keywords):
        for h in headers:
            for kw in keywords:
                if kw.lower() in h.lower(): return h
        return None

    field_defs = [
        ('pr_date',    'PR / Request date',
         ['pr date','request date','req date','requisition','date raised']),
        ('rfq_date',   'RFQ / Quote date',
         ['rfq','quote date','enquiry','tender']),
        ('po_date',    'PO / Order date',
         ['po date','order date','purchase date']),
        ('dod',        'Expected delivery date (promised)',
         ['dod','delivery date','expected delivery','due date','eta','promised']),
        ('del_status', 'Delivery status (e.g. Delivered, Pending)',
         ['delivery status','del status','status','order status']),
        ('vendor',     'Supplier / Vendor name',
         ['vendor','supplier','contractor','company']),
        ('value',      'Order value / PO value',
         ['value','po value','order value','amount','cost','price']),
        ('desc',       'Item description',
         ['description','short description','item','material','desc']),
        ('po_number',  'PO / Order number (optional)',
         ['po number','po no','order number','purchase order']),
        ('dept',       'Department (optional)',
         ['dept','department','division']),
        ('pgr',        'Purchasing group (optional)',
         ['pgr','purchasing group','pur. group']),
    ]

    col_map = {}
    for field, label, keywords in field_defs:
        suggestion = suggest(keywords)
        options = ['— skip this field —'] + headers
        print(f"\n  {c(label,'bold')}")
        if suggestion: print(f"  {c('Suggested:','green')} {suggestion}")
        chosen = ask("Which column?", options=options,
                     default=suggestion if suggestion else options[0])
        col_map[field] = chosen if chosen != '— skip this field —' else None
        ok(f"→ {col_map[field]}") if col_map[field] else info("Skipped")

    config['col_map'] = col_map

    section("2b. Delivered status text")
    if col_map.get('del_status') and col_map['del_status'] in df_sample.columns:
        vals = df_sample[col_map['del_status']].dropna().unique()[:10]
        print(f"  Values in your data: {c(', '.join(str(v) for v in vals),'yellow')}")
    config['delivered_text'] = ask("Exact word for Delivered status", default="Delivered")

    section("3. Which alerts do you want?")
    alerts = {}
    alerts['overdue'] = ask_yn("Flag overdue deliveries (past expected delivery date)?", True)
    if alerts['overdue']:
        alerts['overdue_days'] = int(ask("Flag as overdue after how many days?", default=7))

    alerts['no_rfq'] = ask_yn("Flag requests stuck without a quote?", True)
    if alerts['no_rfq']:
        alerts['no_rfq_days'] = int(ask("Flag after how many days without a quote?", default=14))

    alerts['vendor_risk'] = ask_yn("Flag high-risk suppliers (multiple overdue orders)?", True)
    if alerts['vendor_risk']:
        alerts['vendor_risk_count'] = int(ask("How many overdue orders = high risk?", default=3))

    alerts['upcoming'] = ask_yn("Show upcoming deliveries?", True)
    if alerts['upcoming']:
        alerts['upcoming_days'] = int(ask("Show deliveries due within how many days?", default=14))

    alerts['no_ack']   = ask_yn("Flag issued POs without vendor acknowledgement?", True)
    alerts['unissued'] = ask_yn("Flag POs not yet issued to vendor?", True)
    config['alerts'] = alerts

    section("4. Focus purchasing group (optional)")
    use_focus = ask_yn("Set up a focus group for detailed metrics?", False)
    if use_focus and col_map.get('pgr') and col_map['pgr'] in df_sample.columns:
        vals = df_sample[col_map['pgr']].dropna().unique()[:10]
        print(f"  Groups found: {c(', '.join(str(v) for v in vals),'yellow')}")
        config['focus_group'] = ask("Which group?", default="HEY")
    else:
        config['focus_group'] = None

    section("5. Output")
    output = ask("Save report.json to?",
                 options=["Local folder (next to this script)",
                          "Google Drive (via Colab Cell 3)"])
    config['output'] = 'local' if "Local" in output else 'google_drive'
    config['output_path'] = str(OUTPUT_FILE)
    ok(f"Will save to: {OUTPUT_FILE}")

    with open(CONFIG_FILE,'w') as f:
        json.dump(config, f, indent=2)

    header("Setup Complete!")
    ok("Configuration saved to config.json")
    ok("Running report now...\n")
    return config

# ── Data loading ──────────────────────────────────────────────────────────────
def load_data_raw(config):
    try:
        if config.get('data_source') == 'google_sheets':
            import gspread

            sa_json = os.environ.get('GOOGLE_SERVICE_ACCOUNT_JSON')
            if sa_json:
                # GitHub Actions mode — use service account from secret
                from google.oauth2.service_account import Credentials
                creds = Credentials.from_service_account_info(
                    json.loads(sa_json),
                    scopes=['https://spreadsheets.google.com/feeds',
                            'https://www.googleapis.com/auth/drive'])
                gc = gspread.authorize(creds)
            else:
                # Colab mode — use interactive auth
                import google.auth
                from google.colab import auth
                auth.authenticate_user()
                creds, _ = google.auth.default()
                gc = gspread.authorize(creds)

            sh = gc.open_by_key(config['sheet_id'])
            ws = sh.worksheet(config.get('sheet_name', 'Sheet1'))
            return pd.DataFrame(ws.get_all_records())
        else:
            return pd.read_excel(config['file_path'],
                                 sheet_name=config.get('sheet_name', 0))
    except Exception as e:
        warn(f"Could not load data: {e}")
        return None

def load_and_clean(config):
    df = load_data_raw(config)
    if df is None: return None
    col = config.get('col_map',{})
    for field in ['pr_date','rfq_date','po_date','dod']:
        cn = col.get(field)
        if cn and cn in df.columns:
            df[cn] = pd.to_datetime(df[cn], errors='coerce')
    cn = col.get('value')
    if cn and cn in df.columns:
        df[cn] = pd.to_numeric(
            df[cn].astype(str).str.replace(',',''), errors='coerce').fillna(0)
    return df

# ── Logic helpers ─────────────────────────────────────────────────────────────
def is_delivered(val, delivered_text):
    if not val: return False
    v = str(val).lower().strip()
    return v == delivered_text.lower() or v in ('delivered','del','done','closed','complete','received')

def not_delivered_mask(df, col, delivered_text):
    if not col.get('del_status') or col['del_status'] not in df.columns:
        return pd.Series([True]*len(df), index=df.index)
    return ~df[col['del_status']].apply(lambda x: is_delivered(x, delivered_text))

# ── Alert sections ────────────────────────────────────────────────────────────
def calc_overdue(df, config):
    col = config['col_map']; alerts = config['alerts']
    if not alerts.get('overdue') or not col.get('dod'): return {'count':0,'items':[]}
    thresh = alerts.get('overdue_days',7)
    dt = config.get('delivered_text','Delivered')
    base = df[df[col['dod']].notna() & not_delivered_mask(df,col,dt)]
    ov = base[base[col['dod']] < TODAY].copy()
    ov['_d'] = (TODAY - ov[col['dod']]).dt.days
    flagged = ov[ov['_d']>=thresh].sort_values('_d',ascending=False)
    items = []
    for _,r in flagged.head(20).iterrows():
        items.append({'po_number':str(r.get(col.get('po_number',''),'—')),
                      'vendor':str(r.get(col.get('vendor',''),'—')),
                      'description':str(r.get(col.get('desc',''),'—'))[:60],
                      'dod':str(r[col['dod']].date()) if pd.notna(r[col['dod']]) else '—',
                      'days_overdue':int(r['_d']),
                      'dept':str(r.get(col.get('dept',''),'—')),
                      'pgr':str(r.get(col.get('pgr',''),'—'))})
    return {'count':len(flagged),'items':items}

def calc_no_rfq(df, config):
    col = config['col_map']; alerts = config['alerts']
    if not alerts.get('no_rfq') or not col.get('pr_date') or not col.get('rfq_date'):
        return {'count':0,'items':[]}
    thresh = alerts.get('no_rfq_days',14)
    base = df[df[col['pr_date']].notna() & df[col['rfq_date']].isna()].copy()
    base['_age'] = (TODAY - base[col['pr_date']]).dt.days
    flagged = base[base['_age']>=thresh].sort_values('_age',ascending=False)
    items = []
    for _,r in flagged.head(20).iterrows():
        items.append({'description':str(r.get(col.get('desc',''),'—'))[:60],
                      'pr_date':str(r[col['pr_date']].date()) if pd.notna(r[col['pr_date']]) else '—',
                      'pr_age_days':int(r['_age']),
                      'dept':str(r.get(col.get('dept',''),'—')),
                      'pgr':str(r.get(col.get('pgr',''),'—'))})
    return {'count':len(flagged),'items':items}

def calc_upcoming(df, config):
    col = config['col_map']; alerts = config['alerts']
    if not alerts.get('upcoming') or not col.get('dod'): return {'count':0,'items':[]}
    days = alerts.get('upcoming_days',14)
    dt = config.get('delivered_text','Delivered')
    window_end = TODAY + timedelta(days=days)
    base = df[df[col['dod']].notna() & not_delivered_mask(df,col,dt)]
    up = base[(base[col['dod']]>=TODAY)&(base[col['dod']]<=window_end)].copy()
    up['_left'] = (up[col['dod']] - TODAY).dt.days
    up = up.sort_values('_left')
    items = []
    for _,r in up.head(20).iterrows():
        items.append({'po_number':str(r.get(col.get('po_number',''),'—')),
                      'vendor':str(r.get(col.get('vendor',''),'—')),
                      'description':str(r.get(col.get('desc',''),'—'))[:60],
                      'dod':str(r[col['dod']].date()) if pd.notna(r[col['dod']]) else '—',
                      'days_until_due':int(r['_left'])})
    return {'count':len(up),'items':items}

def calc_vendor_risk(df, config):
    col = config['col_map']; alerts = config['alerts']
    if not alerts.get('vendor_risk') or not col.get('vendor') or not col.get('dod'):
        return {'count':0,'vendors':[]}
    thresh = alerts.get('vendor_risk_count',3)
    dt = config.get('delivered_text','Delivered')
    base = df[df[col['dod']].notna() & df[col['vendor']].notna() & not_delivered_mask(df,col,dt)]
    ov = base[base[col['dod']]<TODAY]
    counts = ov.groupby(col['vendor']).size()
    flagged = counts[counts>=thresh].sort_values(ascending=False)
    return {'count':int(len(flagged)),
            'vendors':[{'vendor':v,'overdue_count':int(c)} for v,c in flagged.items()]}

def calc_overall(df, config):
    col = config['col_map']
    tv = df[col['value']].sum() if col.get('value') else 0
    return {'total_prs':len(df),
            'total_pos':int(df[col['po_number']].notna().sum()) if col.get('po_number') else 0,
            'total_value':round(float(tv),2),
            'total_value_fmt':f"{tv:,.0f}"}

def calc_cycle_time(df, config):
    col = config['col_map']
    if not col.get('pr_date') or not col.get('po_date'):
        return {'overall_avg_days':None,'by_dept':{}}
    hb = df[df[col['pr_date']].notna()&df[col['po_date']].notna()].copy()
    hb['_c'] = (hb[col['po_date']] - hb[col['pr_date']]).dt.days
    hb = hb[hb['_c']>=0]
    avg = hb['_c'].mean()
    by_dept = {}
    if col.get('dept'):
        by_dept = {k:float(v) for k,v in
                   hb.groupby(col['dept'])['_c'].mean().round(1)
                   .sort_values(ascending=False).head(8).items()}
    return {'overall_avg_days':round(float(avg),1) if not pd.isna(avg) else None,
            'by_dept':by_dept}

def calc_focus_group(df, config):
    col = config['col_map']
    fg  = config.get('focus_group')
    if not fg or not col.get('pgr'): return None
    grp = df[df[col['pgr']].astype(str).str.upper()==fg.upper()]
    if grp.empty: return None
    tv = grp[col['value']].sum() if col.get('value') else 0
    return {'group':fg,'total_prs':len(grp),
            'total_pos':int(grp[col['po_number']].notna().sum()) if col.get('po_number') else 0,
            'total_value_fmt':f"{tv:,.0f}",
            'unissued_pos':0,'issued_no_ack':0}

# ── Drive upload (GitHub Actions) ─────────────────────────────────────────────
def upload_to_drive(out):
    sa_json = os.environ.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    if not sa_json:
        return
    info("Uploading report.json to Google Drive...")
    try:
        from google.oauth2.service_account import Credentials
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaFileUpload

        creds = Credentials.from_service_account_info(
            json.loads(sa_json),
            scopes=['https://www.googleapis.com/auth/drive'])
        drive = build('drive', 'v3', credentials=creds)

        results = drive.files().list(
            q="name='report.json' and trashed=false",
            fields="files(id, name)").execute()
        files = results.get('files', [])

        media = MediaFileUpload(str(out), mimetype='application/json')
        if files:
            drive.files().update(
                fileId=files[0]['id'], media_body=media).execute()
            ok("Updated existing report.json on Google Drive")
        else:
            drive.files().create(
                body={'name': 'report.json'}, media_body=media).execute()
            ok("Uploaded new report.json to Google Drive")
    except Exception as e:
        warn(f"Drive upload failed: {e}")
        sys.exit(1)

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--setup', action='store_true', help='Re-run interactive setup')
    parser.add_argument('--auto', action='store_true', help='GitHub Actions mode — upload to Drive after run')
    args = parser.parse_args()

    if args.setup or not CONFIG_FILE.exists():
        config = run_setup()
    else:
        with open(CONFIG_FILE) as f: config = json.load(f)
        header("ProcureAlert — Generating Report")
        info(f"Config: {CONFIG_FILE}  |  run --setup to change settings\n")

    info("Loading data...")
    df = load_and_clean(config)
    if df is None or df.empty:
        warn("No data loaded. Check config and try again.")
        sys.exit(1)
    ok(f"Loaded {len(df):,} rows")

    info("Running alert logic...")
    overall     = calc_overall(df, config)
    overdue     = calc_overdue(df, config)
    no_rfq      = calc_no_rfq(df, config)
    upcoming    = calc_upcoming(df, config)
    vendor_risk = calc_vendor_risk(df, config)
    cycle_time  = calc_cycle_time(df, config)
    focus_group = calc_focus_group(df, config)

    alert_flags = {
        'has_overdue_alert': overdue['count'] > 0,
        'has_no_rfq_alert':  no_rfq['count'] > 0,
        'has_vendor_risk':   vendor_risk['count'] > 0,
        'any_alert':         overdue['count']>0 or no_rfq['count']>0 or vendor_risk['count']>0,
    }

    report = {
        'report_date':  TODAY.strftime('%d %b %Y'),
        'generated_at': datetime.now().isoformat(),
        'overall':      overall,
        'overdue':      overdue,
        'no_rfq':       no_rfq,
        'upcoming':     upcoming,
        'vendor_risk':  vendor_risk,
        'cycle_time':   cycle_time,
        'focus_group':  focus_group,
        'alert_flags':  alert_flags,
    }

    out = Path(config.get('output_path', OUTPUT_FILE))
    with open(out,'w') as f: json.dump(report, f, indent=2, default=str)

    header("Report Summary")
    ok(f"Rows analysed : {overall['total_prs']:,}")
    print()
    for label, count, colour in [
        ("Overdue deliveries  ", overdue['count'], 'red'),
        ("PRs without RFQ     ", no_rfq['count'], 'red'),
        ("High-risk suppliers ", vendor_risk['count'], 'red'),
    ]:
        icon = c('⚠','red') if count else c('✓','green')
        val  = c(str(count), colour) if count else c('0','green')
        print(f"  {icon}  {label}: {val}")

    print(f"  {c('→','blue')}  Upcoming (14 days)   : {upcoming['count']}")
    if cycle_time['overall_avg_days']:
        print(f"  {c('→','blue')}  Avg PR→PO cycle      : {cycle_time['overall_avg_days']} days")

    if focus_group:
        print(f"\n  {c('Focus: '+focus_group['group'],'cyan')}  "
              f"PRs:{focus_group['total_prs']}  POs:{focus_group['total_pos']}")

    print()
    ok(f"Saved: {out}")
    if alert_flags['any_alert']:
        warn("Alerts found — n8n will send the urgent alert email")
    else:
        ok("No alerts — n8n will send the daily summary email")

    # Upload to Drive if running in GitHub Actions (--auto) or configured for Drive
    if args.auto or config.get('output') == 'google_drive':
        if os.environ.get('GOOGLE_SERVICE_ACCOUNT_JSON'):
            upload_to_drive(out)
        else:
            print(f"\n  {c('Next step:','yellow')} Run Cell 3 in Colab to upload to Google Drive.")

if __name__ == '__main__':
    main()
