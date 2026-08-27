# 📧 EmailJS Setup Guide

How to set up free email sending for ProcureAlert in under 5 minutes.
No server, no credit card, no technical knowledge needed.

---

## What is EmailJS?

EmailJS is a free service that lets a webpage send emails directly from
the browser — without any backend server. Your procurement data never
touches their servers; only the final formatted email is sent through them.

**Free tier includes:** 200 emails/month — more than enough for testing
and regular use.

---

## Step 1 — Create a free EmailJS account

1. Go to **https://www.emailjs.com**
2. Click **Sign Up Free**
3. Register with your email address (use your work or personal Gmail)
4. Verify your email

---

## Step 2 — Add Gmail as your Email Service

This is what allows EmailJS to send emails on your behalf.

1. After logging in, click **Email Services** in the left sidebar
2. Click **Add New Service**
3. Choose **Gmail**
4. Click **Connect Account** — a Google popup will appear
5. Sign in with the Gmail you want emails to be sent FROM
6. Allow the permissions
7. Give the service a name, e.g. `ProcureAlert`
8. Click **Create Service**
9. **Copy the Service ID** — it looks like `service_abc1234`
   — you'll need this in the tool

> **Note:** If your organisation uses Microsoft 365 / Outlook,
> choose **Outlook** instead of Gmail in Step 3 above.
> The rest of the steps are the same.

---

## Step 3 — Create an Email Template

The template tells EmailJS what the email should look like.

1. Click **Email Templates** in the left sidebar
2. Click **Create New Template**
3. Set the template fields like this:

**Subject:**
```
{{subject}}
```

**To Email:**
```
{{to_email}}
```

**Content** (switch to HTML mode by clicking the `</>` icon):
```html
{{{email_html}}}
```

> The triple curly braces `{{{ }}}` are important for the HTML field —
> they tell EmailJS not to escape the HTML content.

4. Click **Save**
5. **Copy the Template ID** — it looks like `template_xyz9876`

---

## Step 4 — Get your Public Key

1. Click your account name (top right) → **Account**
2. Go to the **General** tab
3. Find **Public Key** — it looks like `AbCdEfGhIjKlMnOpQr`
4. Copy it

---

## Step 5 — Enter your credentials in ProcureAlert

When you reach Step 2 of the tool (Configure screen), scroll down to
**"Where to Send Alerts"** and fill in:

| Field | Where to find it | Looks like |
|---|---|---|
| EmailJS Service ID | Email Services page | `service_abc1234` |
| EmailJS Template ID | Email Templates page | `template_xyz9876` |
| EmailJS Public Key | Account → General | `AbCdEfGhIjKlMnOpQr` |

---

## Step 6 — Test it

1. Upload your Excel file
2. Configure your columns and thresholds
3. Add your email address as a recipient
4. Fill in the three EmailJS fields
5. Click **Send Report Now**
6. Check your inbox — the email should arrive within 30 seconds

---

## Troubleshooting

**"Email failed — check your EmailJS credentials"**
- Double-check all three fields are copied correctly with no extra spaces
- Make sure the template uses `{{{email_html}}}` with triple braces
- Check you haven't exceeded 200 emails this month on the free tier

**Email arrives but looks broken / no tables**
- In your EmailJS template, make sure you clicked the `</>` HTML button
  before pasting the content field — it must be in HTML mode, not text mode

**Gmail shows a security warning**
- This is normal for the first send — Gmail flags new sending sources
- Click "Looks safe" or check your Gmail security settings
- After the first send it will be trusted

---

## Privacy Notes

- Your Excel data is **never sent to EmailJS** — only the formatted HTML email is
- EmailJS only sees: the recipient address, subject line, and the HTML email body
- No row-level procurement data, no vendor names, no values are stored by EmailJS
- All analysis happens in your browser before the email is composed

---

## Monthly Limit

EmailJS free tier = **200 emails per month**.

For a daily report to 3 people = 3 emails/day × 30 days = 90 emails/month.
Well within the free limit.

If you need more, EmailJS paid plans start at $9/month for 1,000 emails.

---

*ProcureAlert — built for procurement teams who live in Excel.*
