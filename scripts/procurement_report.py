import pandas as pd
import json
import os
from datetime import datetime, timedelta
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaInMemoryUpload

# ── Config ───────────────────────────────────────────────────────────────────
EXCEL_PATH  = 'data/PR_PO_Log_2026_Mock.xlsx'
SHEET_NAME  = '2026'
FOCUS_PGR   = 'HEY'
TODAY       = datetime.today()
FOLDER_NAME = 'procurement-alerts'

ALERT_THRESHOLDS = {
    'overdue_days':       7,
    'no_rfq_days':       14,
    'vendor_overdue_pos': 3,
}

# ── Google Drive auth using service account ──────────────────────────────────
def get_drive_service():
    service_account_info = json.loads(os.environ['GOOGLE_SERVICE_ACCOUNT_JSON'])
    creds = service_account.Credentials.from_service_account_info(
        service_account_info,
        scopes=['https://www.googleapis.com/auth/drive']
    )
    return build('drive', 'v3', credentials=creds)

# ── Load data ────────────────────────────────────────────────────────────────
def load_data():
    df = pd.read_excel(EXCEL_PATH, sheet_name=SHEET_NAME)
    for col in ['PR date','RFQ Date','PO Date','PO DOD','Actual DOD','Issue to Vendor']:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors='coerce')
    for col in ['PO Value','Value in SAR','Savings','PR-PO','Days 2 Del']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
    return df

# ── Metrics ──────────────────────────────────────────────────────────────────
def section_overall(df):
    total_value   = df['Value in SAR'].sum()
    total_savings = df['Savings'].sum()
    savings_pct   = (total_savings / total_value * 100) if total_value else 0
    return {
        'total_prs':         int(df['PR #'].notna().sum()),
        'total_pos':         int(df['PO Number'].notna().sum()),
        'total_value_sar':   f"SAR {total_value:,.0f}",
        'total_savings_sar': f"SAR {total_savings:,.0f}",
        'savings_pct':       f"{savings_pct:.1f}%",
    }

def section_hey(df):
    hey = df[df['PGr'] == FOCUS_PGR]
    unissued = hey[hey['PO Number'].notna() & hey['Issue to Vendor'].isna()]
    issued_no_ack = hey[
        hey['Issue to Vendor'].notna() &
        (hey['Ackn'].isna() | (hey['Ackn'].astype(str).str.strip() == ''))
    ]
    return {
        'pgr':             FOCUS_PGR,
        'total_prs':       int(hey['PR #'].notna().sum()),
        'total_pos':       int(hey['PO Number'].notna().sum()),
        'total_value_sar': f"SAR {hey['Value in SAR'].sum():,.0f}",
        'unissued_pos':    int(len(unissued)),
        'issued_no_ack':   int(len(issued_no_ack)),
        'unissued_list':   unissued[['PR #','PO Number','Vendor Name','Short Description','PO Date']].fillna('').astype(str).to_dict('records')[:10],
        'no_ack_list':     issued_no_ack[['PR #','PO Number','Vendor Name','Issue to Vendor']].fillna('').astype(str).to_dict('records')[:10],
    }

def section_overdue(df):
    has_dod       = df[df['PO DOD'].notna()]
    not_delivered = has_dod[~has_dod['Delivery Status'].isin(['Delivered','Del','Cancelled'])]
    overdue       = not_delivered[not_delivered['PO DOD'] < TODAY].copy()
    overdue['days_overdue'] = (TODAY - overdue['PO DOD']).dt.days
    flagged = overdue[overdue['days_overdue'] >= ALERT_THRESHOLDS['overdue_days']].sort_values('days_overdue', ascending=False)
    return {
        'count': int(len(flagged)),
        'items': flagged[['PR #','PO Number','Vendor Name','Short Description','PO DOD','days_overdue','Dept.','PGr']].fillna('').astype(str).to_dict('records')[:15],
    }

def section_no_rfq(df):
    has_pr  = df[df['PR date'].notna()]
    no_rfq  = has_pr[has_pr['RFQ Date'].isna()].copy()
    no_rfq['pr_age_days'] = (TODAY - no_rfq['PR date']).dt.days
    flagged = no_rfq[no_rfq['pr_age_days'] >= ALERT_THRESHOLDS['no_rfq_days']].sort_values('pr_age_days', ascending=False)
    return {
        'count': int(len(flagged)),
        'items': flagged[['PR #','Short Description','PR date','pr_age_days','Dept.','PGr','End User']].fillna('').astype(str).to_dict('records')[:15],
    }

def section_upcoming(df):
    has_dod       = df[df['PO DOD'].notna()]
    not_delivered = has_dod[~has_dod['Delivery Status'].isin(['Delivered','Del','Cancelled'])]
    window_end    = TODAY + timedelta(days=14)
    upcoming      = not_delivered[(not_delivered['PO DOD'] >= TODAY) & (not_delivered['PO DOD'] <= window_end)].copy()
    upcoming['days_until_due'] = (upcoming['PO DOD'] - TODAY).dt.days
    return {
        'count': int(len(upcoming)),
        'items': upcoming.sort_values('days_until_due')[['PR #','PO Number','Vendor Name','Short Description','PO DOD','days_until_due','Dept.','PGr']].fillna('').astype(str).to_dict('records')[:15],
    }

def section_cycle_time(df):
    has_both = df[df['PR date'].notna() & df['PO Date'].notna()].copy()
    has_both['cycle_days'] = (has_both['PO Date'] - has_both['PR date']).dt.days
    has_both = has_both[has_both['cycle_days'] >= 0]
    avg = has_both['cycle_days'].mean()
    return {
        'overall_avg_days': round(float(avg), 1) if not pd.isna(avg) else 0,
        'by_dept': {k: float(v) for k, v in has_both.groupby('Dept.')['cycle_days'].mean().round(1).sort_values(ascending=False).head(8).items()},
        'by_pgr':  {k: float(v) for k, v in has_both.groupby('PGr')['cycle_days'].mean().round(1).items()},
    }

def section_vendor_alerts(df):
    has_dod       = df[df['PO DOD'].notna() & df['Vendor Name'].notna()]
    not_delivered = has_dod[~has_dod['Delivery Status'].isin(['Delivered','Del','Cancelled'])]
    overdue       = not_delivered[not_delivered['PO DOD'] < TODAY]
    vendor_counts = overdue.groupby('Vendor Name').size()
    flagged       = vendor_counts[vendor_counts >= ALERT_THRESHOLDS['vendor_overdue_pos']].sort_values(ascending=False)
    return {
        'count':   int(len(flagged)),
        'vendors': [{'vendor': v, 'overdue_po_count': int(c)} for v, c in flagged.items()],
    }

def section_savings(df):
    has_po        = df[df['PO Value'] > 0].copy()
    total_val     = has_po['Value in SAR'].sum()
    total_savings = has_po['Savings'].sum()
    savings_pct   = (total_savings / total_val * 100) if total_val else 0
    by_dept       = has_po.groupby('Dept.').agg(po_value=('Value in SAR','sum'), savings=('Savings','sum'))
    by_dept['savings_pct'] = (by_dept['savings'] / by_dept['po_value'] * 100).round(1)
    by_dept = by_dept.sort_values('savings', ascending=False).head(8)
    return {
        'total_po_value_sar':  f"SAR {total_val:,.0f}",
        'total_savings_sar':   f"SAR {total_savings:,.0f}",
        'savings_pct':         f"{savings_pct:.1f}%",
        'by_dept': [{'dept': d, 'po_value': f"SAR {r['po_value']:,.0f}", 'savings': f"SAR {r['savings']:,.0f}", 'savings_pct': f"{r['savings_pct']:.1f}%"} for d, r in by_dept.iterrows()],
    }

# ── Upload to Google Drive ───────────────────────────────────────────────────
def upload_to_drive(report, drive_service):
    report_json = json.dumps(report, indent=2, default=str)

    # Find folder
    folder_results = drive_service.files().list(
        q=f"name='{FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields="files(id, name)"
    ).execute()
    folders = folder_results.get('files', [])
    if not folders:
        raise Exception(f"Folder '{FOLDER_NAME}' not found in Drive")
    folder_id = folders[0]['id']

    media = MediaInMemoryUpload(
        report_json.encode('utf-8'),
        mimetype='application/json',
        resumable=False
    )

    # Update if exists, create if not
    existing = drive_service.files().list(
        q=f"name='procurement_report.json' and '{folder_id}' in parents and trashed=false",
        fields="files(id)"
    ).execute().get('files', [])

    if existing:
        drive_service.files().update(fileId=existing[0]['id'], media_body=media).execute()
        print(f"✅ Updated procurement_report.json in Drive")
    else:
        drive_service.files().create(
            body={'name': 'procurement_report.json', 'parents': [folder_id]},
            media_body=media, fields='id'
        ).execute()
        # Make public
        drive_service.permissions().create(
            fileId=existing[0]['id'] if existing else folder_id,
            body={'type': 'anyone', 'role': 'reader'}
        ).execute()
        print(f"✅ Created procurement_report.json in Drive")

# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    print(f"Running procurement report — {TODAY.strftime('%d %b %Y %H:%M')}")
    df            = load_data()
    overall       = section_overall(df)
    hey           = section_hey(df)
    overdue       = section_overdue(df)
    no_rfq        = section_no_rfq(df)
    upcoming      = section_upcoming(df)
    cycle_time    = section_cycle_time(df)
    vendor_alerts = section_vendor_alerts(df)
    savings       = section_savings(df)

    report = {
        'report_date':   TODAY.strftime('%d %b %Y'),
        'overall':       overall,
        'hey_focus':     hey,
        'overdue':       overdue,
        'no_rfq':        no_rfq,
        'upcoming':      upcoming,
        'cycle_time':    cycle_time,
        'vendor_alerts': vendor_alerts,
        'savings':       savings,
        'alert_flags': {
            'has_overdue_alert':     overdue['count'] > 0,
            'has_no_rfq_alert':      no_rfq['count'] > 0,
            'has_vendor_risk_alert': vendor_alerts['count'] > 0,
        }
    }

    drive_service = get_drive_service()
    upload_to_drive(report, drive_service)
    print("✅ Done")

if __name__ == '__main__':
    main()