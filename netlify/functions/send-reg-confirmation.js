const https = require('https');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'creativehub@angelstreetmemphis.com';
const ADMIN_EMAILS = ['sasha@angelstreetmemphis.com', 'creativehub@angelstreetmemphis.com'];

async function sendEmail(to, subject, html) {
  const data = JSON.stringify({
    from: FROM_EMAIL,
    to: Array.isArray(to) ? to : [to],
    subject,
    html
  });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.resend.com', path: '/emails', method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d })); });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' };

  let body;
  try { body = JSON.parse(event.body); } catch(e) { return { statusCode: 400, headers, body: 'Invalid JSON' }; }

  const { parentName, parentEmail, childName, grade, school } = body;
  const firstName = (parentName || '').split(' ')[0] || 'there';

  try {
    await sendEmail(parentEmail,
      `${childName} is registered with AngelStreet Programs!`,
      `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#ca3092;padding:24px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:24px;">AngelStreet Memphis</h1>
          <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px;">2026–2027 After-School Programs</p>
        </div>
        <div style="padding:24px;background:#fff;">
          <p>Hi ${firstName},</p>
          <p><strong>${childName}</strong> (Grade ${grade} at ${school}) has been added to your account. Log in anytime to register for available programs.</p>
          <p style="text-align:center;margin:24px 0;"><a href="https://app.angelstreetmemphis.com" style="background:#ca3092;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;">View Programs</a></p>
          <p style="color:#888;font-size:12px;">All programs are free. Questions? Email creativehub@angelstreetmemphis.com</p>
        </div>
        <div style="background:#f5f5f5;padding:16px;text-align:center;">
          <p style="color:#aaa;font-size:11px;margin:0;">AngelStreet Memphis · 686 N 7th St, Memphis, TN 38107</p>
        </div>
      </div>`
    );

    await sendEmail(ADMIN_EMAILS,
      `New registration: ${childName} (${parentName})`,
      `<div style="font-family:Arial,sans-serif;max-width:600px;">
        <h2>New child registered</h2>
        <p><strong>Child:</strong> ${childName} — Grade ${grade}</p>
        <p><strong>School:</strong> ${school}</p>
        <p><strong>Parent/Guardian:</strong> ${parentName}</p>
        <p><strong>Email:</strong> ${parentEmail}</p>
        <p>View all registrations at <a href="https://app.angelstreetmemphis.com">app.angelstreetmemphis.com</a></p>
      </div>`
    );

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
