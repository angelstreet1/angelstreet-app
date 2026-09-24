const https = require('https');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'creativehub@angelstreetmemphis.com';
const ADMIN_EMAILS = ['sasha@angelstreetmemphis.com', 'creativehub@angelstreetmemphis.com'];

async function sendEmail(to, subject, html) {
  const data = JSON.stringify({
    from: FROM_EMAIL,
    to: Array.isArray(to) ? to : [to],
    subject, html
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

  const { studentName, parentName, parentEmail, grade, school, programInterest } = body;

  try {
    await sendEmail(parentEmail,
      `${studentName} is registered for AngelStreet Sound Check!`,
      `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#ca3092;padding:24px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:24px;">AngelStreet Memphis</h1>
          <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;">AngelStreet Sound Check</p>
        </div>
        <div style="padding:24px;background:#fff;">
          <p>Hi ${parentName},</p>
          <p><strong>${studentName}</strong> (Grade ${grade} at ${school}) is registered for <strong>AngelStreet Sound Check</strong>!</p>
          <div style="background:#f9f9f9;border-left:4px solid #ca3092;padding:16px;margin:20px 0;border-radius:4px;">
            <p style="margin:0 0 8px;"><strong>📅 Date:</strong> Wednesday, September 30, 2026</p>
            <p style="margin:0 0 8px;"><strong>🕐 Time:</strong> 3:30 PM – 6:30 PM</p>
            <p style="margin:0;"><strong>📍 Location:</strong> 686 N 7th St, Memphis, TN 38107</p>
          </div>
          <p><strong>Program interest:</strong> ${programInterest}</p>
          <p style="color:#888;font-size:12px;">Questions? Contact Ms. Sa'Sha at 901-236-3737</p>
        </div>
        <div style="background:#f5f5f5;padding:16px;text-align:center;">
          <p style="color:#aaa;font-size:11px;margin:0;">AngelStreet Memphis · 686 N 7th St, Memphis, TN 38107</p>
        </div>
      </div>`
    );

    await sendEmail(ADMIN_EMAILS,
      `New Sound Check registration: ${studentName}`,
      `<div style="font-family:Arial,sans-serif;max-width:600px;">
        <h2>New Sound Check Registration</h2>
        <p><strong>Student:</strong> ${studentName} — Grade ${grade}</p>
        <p><strong>School:</strong> ${school}</p>
        <p><strong>Program Interest:</strong> ${programInterest}</p>
        <p><strong>Parent/Guardian:</strong> ${parentName}</p>
        <p><strong>Email:</strong> ${parentEmail}</p>
      </div>`
    );

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
