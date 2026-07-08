// netlify/functions/airtable-batch.js
// Fetches multiple Airtable tables in parallel in a single function call

const https = require('https');
const { URL } = require('url');

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_BASE = `https://api.airtable.com/v0/${BASE_ID}`;

function fetchTable(table) {
  return new Promise((resolve) => {
    let allRecords = [];

    function fetchPage(offset) {
      const url = new URL(`${AIRTABLE_BASE}/${encodeURIComponent(table)}`);
      url.searchParams.set('pageSize', '100');
      if (offset) url.searchParams.set('offset', offset);

      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'GET',
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            allRecords = allRecords.concat(json.records || []);
            if (json.offset) {
              fetchPage(json.offset);
            } else {
              resolve({ table, records: allRecords, error: null });
            }
          } catch (e) {
            resolve({ table, records: [], error: e.message });
          }
        });
      });
      req.on('error', (e) => resolve({ table, records: [], error: e.message }));
      req.end();
    }

    fetchPage(null);
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' };

  let tables;
  try {
    const body = JSON.parse(event.body);
    tables = body.tables;
    if (!Array.isArray(tables) || tables.length === 0) throw new Error('No tables');
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Send { tables: ["Table1","Table2"] }' }) };
  }

  // Fetch all tables in parallel
  const results = await Promise.all(tables.map(fetchTable));

  const output = {};
  results.forEach(r => { output[r.table] = r.records; });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(output)
  };
};
