const https = require('https');

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = 'creativehub@angelstreetmemphis.com';
const ADMIN_EMAILS = ['sasha@angelstreetmemphis.com', 'creativehub@angelstreetmemphis.com'];

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' };

  let body;
  try { body = JSON.parse(event.body); } catch(e) { return { statusCode: 400, headers, body: 'Invalid JSON' }; }

  const { parentName, parentEmail, childName, grade, school } = body;

  const parentMsg = {
    to: parentEmail,
    from: FROM_EMAIL,
    subject: `Welcome to AngelStreet Programs, ${childName}!`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#ca3092;padding:24px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:24px;">AngelStreet Memphis</h1>
        <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px;">2026–2027 After-School Programs</p>
      </div>
      <div style="padding:24px;background:#fff;">
        <p>Hi ${parentName},</p>
        <p>Your account has been created for <strong>${childName}</strong> (${grade}th grade at ${school}).</p>
        <p>You can now log back in anytime to register for available programs at:</p>
        <p style="text-align:center;"><a href="https://app.angelstreetmemphis.com" style="background:#ca3092;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;">View Programs</a></p>
        <p style="color:#888;font-size:12px;margin-top:24px;">All programs are free. Registration for fall programs is now open.<br>Questions? Email us at creativehub@angelstreetmemphis.com</p>
      </div>
      <div style="background:#f5f5f5;padding:16px;text-align:center;">
        <p style="color:#aaa;font-size:11px;margin:0;">AngelStreet Memphis · 686 N 7th St, Memphis, TN 38107</p>
      </div>
    </div>`
  };

  const adminMsg = {
    to: ADMIN_EMAILS,
    from: FROM_EMAIL,
    subject: `New registration: ${childName} (${parentName})`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;">
      <h2>New account created</h2>
      <p><strong>Child:</strong> ${childName} — Grade ${grade}</p>
      <p><strong>School:</strong> ${school}</p>
      <p><strong>Parent/Guardian:</strong> ${parentName}</p>
      <p><strong>Email:</strong> ${parentEmail}</p>
      <p>View all registrations in the admin panel at <a href="https://app.angelstreetmemphis.com">app.angelstreetmemphis.com</a></p>
    </div>`
  };

  async function sendEmail(msg) {
    const data = JSON.stringify({ personalizations: [{ to: Array.isArray(msg.to) ? msg.to.map(e=>({email:e})) : [{email:msg.to}] }], from: {email:msg.from}, subject: msg.subject, content: [{type:'text/html',value:msg.html}] });
    return new Promise((resolve, reject) => {
      const req = https.request({ hostname:'api.sendgrid.com', path:'/v3/mail/send', method:'POST', headers:{'Authorization':'Bearer '+SENDGRID_API_KEY,'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)} }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({status:res.statusCode,body:d})); });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  try {
    await Promise.all([sendEmail(parentMsg), sendEmail(adminMsg)]);
    return { statusCode: 200, headers, body: JSON.stringify({success:true}) };
  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({error:e.message}) };
  }
};
