// netlify/functions/send-invoices.js
// Generates PDF invoices and emails them to Brooke via SendGrid

const https = require("https");

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = "creativehub@angelstreetmemphis.com";
const FROM_NAME = "AngelStreet Memphis";
const TO_EMAIL = "vbrookeking@gmail.com";
const TO_NAME = "Brooke King";

function httpsPost(urlStr, headers, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const bodyStr = JSON.stringify(body);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(bodyStr),
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    req.write(bodyStr);
    req.end();
  });
}

function generateInvoiceHTML(inv) {
  const f = inv.fields;
  const name = f.LegalName || f.Name || "Teaching Artist";
  const period = f.WeekLabel || "—";
  const submitted = f.SubmittedDate || "—";
  const total = f.Total || "0";
  const lines = (f.LineItems || "").split(",").map(l => l.trim()).filter(Boolean);

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; color: #000; margin: 0; padding: 0; background: #fff; }
  .invoice { max-width: 600px; margin: 0 auto; padding: 32px; }
  .header { border-bottom: 4px solid #ca3092; padding-bottom: 16px; margin-bottom: 24px; }
  .title { font-size: 32px; font-weight: 900; color: #ca3092; letter-spacing: 2px; }
  .org { font-size: 12px; color: #888; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  td { padding: 8px 4px; font-size: 13px; border-bottom: 1px solid #eee; }
  td:first-child { color: #888; width: 140px; }
  td:last-child { font-weight: 700; }
  .services { background: #f9f9f9; border-radius: 8px; padding: 14px; margin-bottom: 20px; }
  .services-title { font-size: 11px; color: #888; font-weight: 700; text-transform: uppercase; margin-bottom: 8px; }
  .service-line { font-size: 13px; color: #333; padding: 4px 0; border-bottom: 1px solid #eee; }
  .total-box { background: #ca3092; color: #fff; border-radius: 8px; padding: 16px; display: flex; justify-content: space-between; align-items: center; }
  .total-label { font-size: 15px; font-weight: 700; }
  .total-amount { font-size: 30px; font-weight: 900; }
  .footer { margin-top: 24px; font-size: 11px; color: #aaa; text-align: center; }
</style></head>
<body>
<div class="invoice">
  <div class="header">
    <div class="title">INVOICE</div>
    <div class="org">AngelStreet Memphis Creative Arts Camp 2026</div>
  </div>
  <table>
    <tr><td>Teaching Artist</td><td>${name}</td></tr>
    <tr><td>Period</td><td>${period}</td></tr>
    <tr><td>Submitted</td><td>${submitted}</td></tr>
  </table>
  <div class="services">
    <div class="services-title">Services Rendered</div>
    ${lines.length ? lines.map(l => `<div class="service-line">${l}</div>`).join("") : '<div class="service-line">See invoice details</div>'}
  </div>
  <div class="total-box">
    <span class="total-label">TOTAL DUE</span>
    <span class="total-amount">$${total}</span>
  </div>
  <div class="footer">AngelStreet Memphis · 686 N 7th St, Memphis, TN 38107</div>
</div>
</body>
</html>`;
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  if (!SENDGRID_API_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Missing SENDGRID_API_KEY env var" }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  const { invoices, senderName, senderEmail } = payload;

  if (!invoices || !invoices.length) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "No invoices provided" }) };
  }

  // Build attachment for each invoice
  const attachments = invoices.map((inv) => {
    const html = generateInvoiceHTML(inv);
    const b64 = Buffer.from(html).toString("base64");
    const name = (inv.fields.LegalName || inv.fields.Name || "Invoice").replace(/[^a-z0-9]/gi, "_");
    const week = (inv.fields.WeekLabel || "Week").replace(/[^a-z0-9]/gi, "_");
    return {
      content: b64,
      filename: `${name}_${week}_Invoice.html`,
      type: "text/html",
      disposition: "attachment",
    };
  });

  // Build email body
  const total = invoices.reduce((sum, r) => sum + (parseFloat(r.fields.Total) || 0), 0);
  const invoiceList = invoices.map((inv, i) => {
    const f = inv.fields;
    return `${i + 1}. ${f.LegalName || f.Name} — ${f.WeekLabel} — $${f.Total}`;
  }).join("\n");

  const htmlBody = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
  <div style="border-bottom:4px solid #ca3092;padding-bottom:12px;margin-bottom:20px;">
    <img src="https://angelstreetmemphis.com/wp-content/uploads/2022/04/AS_logo_gold.png" height="40" style="margin-bottom:8px;display:block;" onerror="this.style.display='none'"/>
    <div style="font-size:20px;font-weight:700;color:#ca3092;">AngelStreet Memphis</div>
    <div style="font-size:12px;color:#888;">Creative Arts Camp 2026 — Teaching Artist Invoices</div>
  </div>
  <p style="font-size:14px;">Hi Brooke,</p>
  <p style="font-size:14px;">Please find the attached Teaching Artist invoices for AngelStreet Creative Arts Camp 2026.</p>
  <div style="background:#f9f9f9;border-radius:8px;padding:16px;margin:16px 0;">
    ${invoices.map((inv, i) => {
      const f = inv.fields;
      return `<div style="padding:8px 0;border-bottom:1px solid #eee;font-size:13px;">
        <strong>${i+1}. ${f.LegalName || f.Name}</strong> — ${f.WeekLabel} — <strong>$${f.Total}</strong>
        ${f.LineItems ? `<br/><span style="color:#888;font-size:12px;">${f.LineItems}</span>` : ''}
      </div>`;
    }).join("")}
    <div style="padding:12px 0;font-size:15px;font-weight:700;color:#ca3092;">Total: $${total.toFixed(0)}</div>
  </div>
  <p style="font-size:13px;color:#888;">Individual invoice files are attached to this email.</p>
  <p style="font-size:14px;">Thank you,<br/><strong>${senderName}</strong><br/>AngelStreet Memphis</p>
</div>`;

  const sgPayload = {
    personalizations: [{
      to: [{ email: TO_EMAIL, name: TO_NAME }],
      cc: senderEmail ? [{ email: senderEmail, name: senderName }] : undefined,
    }],
    from: { email: FROM_EMAIL, name: FROM_NAME },
    reply_to: { email: senderEmail || FROM_EMAIL, name: senderName || FROM_NAME },
    subject: `AngelStreet Creative Arts Camp 2026 — Teaching Artist Invoices (${invoices.length} invoice${invoices.length > 1 ? "s" : ""})`,
    content: [
      { type: "text/plain", value: `Hi Brooke,\n\nPlease find the attached Teaching Artist invoices.\n\n${invoiceList}\n\nTotal: $${total.toFixed(0)}\n\nThank you,\n${senderName}\nAngelStreet Memphis` },
      { type: "text/html", value: htmlBody },
    ],
    attachments,
  };

  try {
    const result = await httpsPost(
      "https://api.sendgrid.com/v3/mail/send",
      { Authorization: `Bearer ${SENDGRID_API_KEY}` },
      sgPayload
    );

    if (result.status === 202) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, count: invoices.length }) };
    } else {
      return { statusCode: result.status, headers, body: JSON.stringify({ error: "SendGrid error", detail: result.body }) };
    }
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
