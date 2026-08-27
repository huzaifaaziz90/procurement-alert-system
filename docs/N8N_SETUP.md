# ⚙️ n8n Workflow Setup Guide

This guide walks you through setting up the procurement alert workflow
in n8n after Docker is running. Takes about 15 minutes.

**Before starting:** make sure you have completed the Docker setup
([DOCKER_SETUP.md](DOCKER_SETUP.md)) and n8n is open at
`http://localhost:5678`.

---

## Overview

The workflow has 4 nodes connected in sequence:

```
Schedule Trigger
      ↓
HTTP Request  ← fetches your report.json from Google Drive
      ↓
Code Node     ← builds the email HTML from the data
      ↓
IF Node       ← routes to alert email OR summary email
   ↓                        ↓
Send Email              Send Email
(urgent alerts)         (daily summary)
```

---

## Step 1 — Run the Python script first

Before building the n8n workflow, you need `report.json` to exist on
Google Drive so n8n has something to fetch.

Follow the Python script setup in the main README, run the script, and
confirm you have a public Google Drive link for `procurement_report.json`.

It looks like:
```
https://drive.google.com/uc?export=download&id=YOUR_FILE_ID_HERE
```

Keep this link — you will need it in Step 3.

---

## Step 2 — Set up Gmail App Password

n8n cannot use your regular Gmail password. You need to generate a
special App Password — a one-time setup.

**2a — Enable 2-Step Verification (if not already on)**

1. Go to https://myaccount.google.com/security
2. Find 2-Step Verification and turn it ON
3. Follow the prompts to verify your phone

**2b — Generate an App Password**

1. Go to https://myaccount.google.com/apppasswords
   (you may need to search "App Passwords" in the Google Account search bar)
2. Under "Select app" choose **Mail**
3. Under "Select device" choose **Windows Computer** (or Mac)
4. Click **Generate**
5. Google shows a 16-character password like `abcd efgh ijkl mnop`
6. **Copy it now — it only shows once**

Keep this password ready for Step 5.

---

## Step 3 — Create a new workflow

1. In n8n, click the **+** button or **New Workflow**
2. Click the workflow name at the top and rename it to:
   `Procurement Alert System`
3. Click Save

---

## Step 4 — Add Schedule Trigger

1. Click the **+** button in the middle of the canvas
2. Search for **Schedule Trigger** and select it
3. Set:
   - **Trigger Interval:** Days
   - **Days Between Triggers:** 1
   - **Trigger at Hour:** 8
   - **Trigger at Minute:** 0
4. Click outside to close

This fires the workflow every day at 8:00am.

---

## Step 5 — Add HTTP Request node

1. Click the **+** on the right edge of the Schedule Trigger node
2. Search for **HTTP Request** and select it
3. Set:
   - **Method:** GET
   - **URL:** paste your Google Drive link from Step 1
4. Scroll down to **Options** → click the **+** next to Options
5. Add **Response Format** → select **JSON**
6. Click **Execute Step** to test it
7. You should see your report data appear on the right panel
   (report_date, overall, overdue, etc.)

If you see a file download instead of JSON — make sure you added the
Response Format: JSON option in step 5.

---

## Step 6 — Add Code node

1. Click **+** from the HTTP Request node
2. Search for **Code** and select it
3. Make sure the mode dropdown says **Run Once for All Items**
4. Delete all default code and paste the code from
   `scripts/n8n_code_node.js` in this repository
5. Click **Execute Step** to test — you should see `alert_html` and
   `summary_html` fields in the output

---

## Step 7 — Add IF node

1. Click **+** from the Code node
2. Search for **IF** and select it
3. Click **Add Condition**
4. Click the **T** icon next to the condition → select **Boolean**
5. Click the value1 field → click the **{}** expression icon → type:
   ```
   {{ $json.alert_flags.has_overdue_alert }}
   ```
6. Change the operator to **is true**
7. Turn on **Convert types where required**

The IF node now has two outputs:
- **True** (left) = alerts exist → urgent email
- **False** (right) = all clear → daily summary

---

## Step 8 — Add Gmail credentials

Before adding the email nodes, set up your Gmail credentials once so
both email nodes can use them.

1. Click the **Settings** icon (gear) in the top right of n8n
2. Go to **Credentials** → **Add Credential**
3. Search for **SMTP** and select it
4. Fill in:
   - **Host:** `smtp.gmail.com`
   - **Port:** `465`
   - **SSL/TLS:** ON
   - **User:** your full Gmail address
   - **Password:** the 16-character App Password from Step 2
5. Click **Save** and name it `Gmail SMTP`

---

## Step 9 — Add Alert Email node (True branch)

1. Click the **True** output of the IF node → **+**
2. Search for **Send Email** and select it
3. Select your **Gmail SMTP** credential
4. Fill in:
   - **From Email:** your Gmail address
   - **To Email:** recipient email(s), comma-separated for multiple
   - **Subject:**
     ```
     🚨 Procurement Alert – {{ $json.report_date }}
     ```
   - **Email Type:** HTML
   - **Message:**
     ```
     {{ $json.alert_html }}
     ```

---

## Step 10 — Add Daily Summary Email node (False branch)

1. Click the **False** output of the IF node → **+**
2. Search for **Send Email** and select it
3. Select the same **Gmail SMTP** credential
4. Fill in:
   - **From Email:** your Gmail address
   - **To Email:** same recipients
   - **Subject:**
     ```
     📦 Daily Procurement Summary – {{ $json.report_date }}
     ```
   - **Email Type:** HTML
   - **Message:**
     ```
     {{ $json.summary_html }}
     ```

---

## Step 11 — Test the full workflow

1. Click the **Schedule Trigger** node
2. Click **Test Workflow** (the play button at the bottom of the screen)
3. Watch each node light up green as data flows through
4. Since the mock data has 83 overdue deliveries, the IF node takes
   the True branch → you should receive the alert email
5. Check your inbox — email arrives within 30 seconds

If any node goes red, click it to read the error message.
Common issues:

| Error | Fix |
|---|---|
| HTTP Request fails | Check your Google Drive URL is correct and the file is public |
| Code node error | Make sure mode is "Run Once for All Items" |
| Email fails | Double-check Gmail App Password — no spaces |
| IF node wrong branch | Make sure expression is `{{ $json.alert_flags.has_overdue_alert }}` |

---

## Step 12 — Activate the workflow

Once the test email arrives successfully:

1. Click **Save** (top right)
2. Toggle the workflow from **Inactive** to **Active** (top right switch)

The workflow now runs automatically every day at 8:00am.
You do not need to do anything else.

---

## Keeping it running

n8n needs to be running for the schedule to fire. Since you installed
it with `--restart unless-stopped`, it starts automatically when your
computer boots.

**Your computer must be on and not in deep sleep at 8am.**

To check n8n is running:
```bash
docker ps
```

You should see `n8n` in the list with status `Up X hours`.

---

## Changing recipients or thresholds

To change email recipients:
- Open n8n → click the Send Email node → update the To field

To change alert thresholds (e.g. flag overdue after 5 days instead of 7):
- Edit `config.json` in your procurement-alerts folder
- Re-run `python scripts/procurement_report.py` to generate a fresh report
- n8n picks up the new data automatically next time it runs

---

## Workflow diagram

```
[Schedule Trigger]
   Every day at 8:00am
         |
         v
[HTTP Request]
   GET report.json from Google Drive
   Response Format: JSON
         |
         v
[Code Node]
   Builds alert_html and summary_html
   from the report data
         |
         v
[IF Node]
   alert_flags.has_overdue_alert == true?
         |
    _____|_____
   |           |
  True        False
   |           |
   v           v
[Send Email] [Send Email]
🚨 Alert    📦 Summary
```
