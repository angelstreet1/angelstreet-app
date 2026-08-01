const https = require('https');
const { URL } = require('url');

const TOKEN = process.env.AIRTABLE_TOKEN_2;
const BASE_ID = process.env.AIRTABLE_BASE_ID_2;
const BASE_URL = `https://api.airtable.com/v0/${BASE_ID}`;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

function makeRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    let url;
    try { url = new URL(BASE_URL + urlPath); } catch(e) { return reject(e); }

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      timeout: 8000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.on('error', reject);

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (!TOKEN || !BASE_ID) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Missing env vars AIRTABLE_TOKEN_2 or AIRTABLE_BASE_ID_2' }) };

  const parts = event.path.replace('/.netlify/functions/airtable2', '').split('/').filter(Boolean);
  const table = parts[0];
  const recordId = parts[1];
  if (!table) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Table name required.' }) };

  let path = `/${encodeURIComponent(table)}`;
  if (recordId) path += `/${recordId}`;

  const qs = event.queryStringParameters || {};
  const params = new URLSearchParams();
  if (qs.pageSize) params.set('pageSize', qs.pageSize);
  if (qs.offset) params.set('offset', qs.offset);
  if (params.toString()) path += `?${params.toString()}`;

  let body = null;
  if (event.body && event.httpMethod !== 'GET') {
    try { body = JSON.parse(event.body); } catch (e) {}
  }

  try {
    const result = await makeRequest(event.httpMethod, path, body);
    return { statusCode: result.status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: result.body };
  } catch(e) {
    return { statusCode: 503, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: e.message }) };
  }
};
