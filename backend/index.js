const fetch = (...args) =>
  import("node-fetch").then(({ default: f }) => f(...args));
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const DB_FILE = path.join(__dirname, "users.json");

function loadUsers() {
  if (!fs.existsSync(DB_FILE)) return {};
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function saveUsers(users) {
  fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
}

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

// ── ROUTES ──────────────────────────────────────────────

app.get("/", (req, res) => {
  res.json({ status: "ProcureAlert API is running" });
});

app.post("/api/setup", (req, res) => {
  const { email, sheetId, sheetName, colMap, kpis, emailConfig } = req.body;
  if (!email || !sheetId) {
    return res.status(400).json({ error: "Email and Sheet ID are required" });
  }
  const users = loadUsers();
  let userId = Object.keys(users).find((id) => users[id].email === email);
  if (!userId) userId = generateId();
  users[userId] = {
    email,
    sheetId,
    sheetName: sheetName || "Sheet1",
    colMap,
    kpis,
    emailConfig,
    createdAt: new Date().toISOString(),
    webhookUrl: `/api/run/${userId}`,
  };
  saveUsers(users);
  res.json({
    success: true,
    userId,
    webhookUrl: `${req.protocol}://${req.get("host")}/api/run/${userId}`,
    message: "Setup complete!",
  });
});

app.get("/api/user/:userId", (req, res) => {
  const users = loadUsers();
  const user = users[req.params.userId];
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

app.post("/api/run/:userId", async (req, res) => {
  const users = loadUsers();
  const user = users[req.params.userId];
  if (!user) return res.status(404).json({ error: "User not found" });
  try {
    const report = await runReport(user);
    res.json({ success: true, report });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/preview-sheet", async (req, res) => {
  const { sheetId, sheetName } = req.body;
  if (!sheetId) return res.status(400).json({ error: "Sheet ID required" });
  try {
    const columns = await getSheetColumns(sheetId, sheetName || "Sheet1");
    res.json({ success: true, columns });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── GOOGLE SHEETS (public CSV) ────────────────────────────

async function getSheetColumns(sheetId, sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&sheet=${encodeURIComponent(sheetName)}&range=1:1`;
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(
      'Could not access sheet. Make sure it is set to "Anyone with the link can view".',
    );
  const text = await res.text();
  const columns = text
    .split("\n")[0]
    .split(",")
    .map((c) => c.replace(/"/g, "").trim())
    .filter((c) => c);
  return columns;
}

async function getSheetData(sheetId, sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(
      'Could not access sheet. Make sure it is set to "Anyone with the link can view".',
    );
  const text = await res.text();

  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((c) => c.replace(/"/g, "").trim());

  return lines.slice(1).map((line) => {
    const values = line.split(",").map((c) => c.replace(/"/g, "").trim());
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] || "";
    });
    return obj;
  });
}

// ── ALERT LOGIC ───────────────────────────────────────────

function parseDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d) ? null : d;
}

function daysDiff(a, b) {
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

function isDelivered(val) {
  if (!val) return false;
  const v = val.toString().toLowerCase().trim();
  return [
    "delivered",
    "del",
    "done",
    "closed",
    "complete",
    "received",
  ].includes(v);
}

async function runReport(user) {
  const { sheetId, sheetName, colMap, kpis } = user;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows = await getSheetData(sheetId, sheetName);
  const c = colMap;

  const report = {
    reportDate: today.toDateString(),
    generatedAt: new Date().toISOString(),
    totalRows: rows.length,
    alertFlags: {},
    kpiResults: {},
  };

  // Overdue deliveries
  if (kpis.overdue?.enabled) {
    const thresh = kpis.overdue.days || 7;
    const items = rows
      .filter((r) => {
        const dod = parseDate(r[c.dod]);
        if (!dod) return false;
        if (isDelivered(r[c.delStatus])) return false;
        return daysDiff(dod, today) >= thresh;
      })
      .map((r) => ({
        po: r[c.poNumber] || "—",
        vendor: r[c.vendor] || "—",
        description: (r[c.desc] || "—").substring(0, 60),
        dod: r[c.dod],
        daysOverdue: daysDiff(parseDate(r[c.dod]), today),
        dept: r[c.dept] || "—",
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue)
      .slice(0, 20);
    report.kpiResults.overdue = { count: items.length, items };
    report.alertFlags.hasOverdue = items.length > 0;
  }

  // PRs without RFQ
  if (kpis.noRfq?.enabled) {
    const thresh = kpis.noRfq.days || 14;
    const items = rows
      .filter((r) => {
        const prDate = parseDate(r[c.prDate]);
        if (!prDate || r[c.rfqDate]) return false;
        return daysDiff(prDate, today) >= thresh;
      })
      .map((r) => ({
        description: (r[c.desc] || "—").substring(0, 60),
        prDate: r[c.prDate],
        ageDays: daysDiff(parseDate(r[c.prDate]), today),
        dept: r[c.dept] || "—",
      }))
      .sort((a, b) => b.ageDays - a.ageDays)
      .slice(0, 20);
    report.kpiResults.noRfq = { count: items.length, items };
    report.alertFlags.hasNoRfq = items.length > 0;
  }

  // Vendor risk
  if (kpis.vendorRisk?.enabled) {
    const thresh = kpis.vendorRisk.count || 3;
    const overdueByVendor = {};
    rows.forEach((r) => {
      const dod = parseDate(r[c.dod]);
      if (!dod || isDelivered(r[c.delStatus])) return;
      if (daysDiff(dod, today) < 1) return;
      const vendor = r[c.vendor] || "Unknown";
      overdueByVendor[vendor] = (overdueByVendor[vendor] || 0) + 1;
    });
    const vendors = Object.entries(overdueByVendor)
      .filter(([, count]) => count >= thresh)
      .map(([vendor, overdueCount]) => ({ vendor, overdueCount }))
      .sort((a, b) => b.overdueCount - a.overdueCount);
    report.kpiResults.vendorRisk = { count: vendors.length, vendors };
    report.alertFlags.hasVendorRisk = vendors.length > 0;
  }

  // Upcoming deliveries
  if (kpis.upcoming?.enabled) {
    const days = kpis.upcoming.days || 14;
    const windowEnd = new Date(today);
    windowEnd.setDate(windowEnd.getDate() + days);
    const items = rows
      .filter((r) => {
        const dod = parseDate(r[c.dod]);
        if (!dod || isDelivered(r[c.delStatus])) return false;
        return dod >= today && dod <= windowEnd;
      })
      .map((r) => ({
        po: r[c.poNumber] || "—",
        vendor: r[c.vendor] || "—",
        description: (r[c.desc] || "—").substring(0, 60),
        dod: r[c.dod],
        daysUntil: daysDiff(today, parseDate(r[c.dod])),
      }))
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 20);
    report.kpiResults.upcoming = { count: items.length, items };
  }

  // Avg cycle time
  if (kpis.cycleTime?.enabled) {
    const times = rows
      .map((r) => {
        const pr = parseDate(r[c.prDate]);
        const po = parseDate(r[c.poDate]);
        if (!pr || !po) return null;
        return daysDiff(pr, po);
      })
      .filter((d) => d !== null && d >= 0);
    const avg = times.length
      ? (times.reduce((a, b) => a + b, 0) / times.length).toFixed(1)
      : null;
    report.kpiResults.cycleTime = { avgDays: avg, sampleSize: times.length };
  }

  // On-time delivery rate
  if (kpis.onTimeRate?.enabled) {
    const delivered = rows.filter((r) => isDelivered(r[c.delStatus]));
    const onTime = delivered.filter((r) => {
      const dod = parseDate(r[c.dod]);
      const actual = parseDate(r[c.actualDod]);
      if (!dod || !actual) return false;
      return actual <= dod;
    });
    const rate = delivered.length
      ? ((onTime.length / delivered.length) * 100).toFixed(1)
      : null;
    report.kpiResults.onTimeRate = {
      rate,
      onTime: onTime.length,
      total: delivered.length,
    };
  }

  // Spend by vendor
  if (kpis.spendByVendor?.enabled) {
    const spend = {};
    rows.forEach((r) => {
      const vendor = r[c.vendor] || "Unknown";
      const val = parseFloat(r[c.value]) || 0;
      spend[vendor] = (spend[vendor] || 0) + val;
    });
    const top = Object.entries(spend)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([vendor, total]) => ({ vendor, total: total.toFixed(2) }));
    report.kpiResults.spendByVendor = { top };
  }

  // Cancellation rate
  if (kpis.cancellationRate?.enabled) {
    const cancelled = rows.filter((r) =>
      (r[c.delStatus] || "").toLowerCase().includes("cancel"),
    );
    const rate = rows.length
      ? ((cancelled.length / rows.length) * 100).toFixed(1)
      : null;
    report.kpiResults.cancellationRate = {
      rate,
      cancelled: cancelled.length,
      total: rows.length,
    };
  }

  // Dept breakdown
  if (kpis.deptBreakdown?.enabled) {
    const depts = {};
    rows.forEach((r) => {
      const dept = r[c.dept] || "Unknown";
      depts[dept] = (depts[dept] || 0) + 1;
    });
    const breakdown = Object.entries(depts)
      .sort((a, b) => b[1] - a[1])
      .map(([dept, count]) => ({ dept, count }));
    report.kpiResults.deptBreakdown = { breakdown };
  }

  report.alertFlags.anyAlert =
    report.alertFlags.hasOverdue ||
    report.alertFlags.hasNoRfq ||
    report.alertFlags.hasVendorRisk;

  return report;
}

// ── START ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`ProcureAlert API running on port ${PORT}`);
});
