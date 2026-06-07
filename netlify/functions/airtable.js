// netlify/functions/airtable.js
// Secure proxy for Airtable API — uses https module for Node 16 compatibility

const https = require("https");
const { URL } = require("url");

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_BASE = `https://api.airtable.com/v0/${BASE_ID}`;

function httpsRequest(urlStr, method, token, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const options = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    };
    if (body) options.headers["Content-Length"] = Buffer.byteLength(body);

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const pathParts = (event.path || "")
    .replace(/^\/.netlify\/functions\/airtable\/?/, "")
    .split("/")
    .filter(Boolean);

  const table = pathParts[0];
  const recordId = pathParts[1];

  if (!table) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Table name required." }),
    };
  }

  if (!AIRTABLE_TOKEN || !BASE_ID) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Missing env vars: AIRTABLE_TOKEN or AIRTABLE_BASE_ID" }),
    };
  }

  let url = `${AIRTABLE_BASE}/${encodeURIComponent(table)}`;
  if (recordId) url += `/${recordId}`;

  if (event.queryStringParameters && Object.keys(event.queryStringParameters).length) {
    const qs = new URLSearchParams(event.queryStringParameters).toString();
    url += `?${qs}`;
  }

  try {
    const body = ["POST", "PATCH", "PUT"].includes(event.httpMethod) ? event.body : null;
    const result = await httpsRequest(url, event.httpMethod, AIRTABLE_TOKEN, body);
    return {
      statusCode: result.status,
      headers,
      body: result.body,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
