// netlify/functions/airtable.js
// Secure proxy for Airtable API — keeps token server-side

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_BASE = `https://api.airtable.com/v0/${BASE_ID}`;

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  // Parse path: /.netlify/functions/airtable/{table}/{recordId?}
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
      body: JSON.stringify({ error: "Table name required. Usage: /airtable/{table}/{recordId?}" }),
    };
  }

  if (!AIRTABLE_TOKEN || !BASE_ID) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Server misconfiguration: missing env vars." }),
    };
  }

  // Build Airtable URL
  let url = `${AIRTABLE_BASE}/${encodeURIComponent(table)}`;
  if (recordId) url += `/${recordId}`;

  // Forward query string (filters, fields, sort, etc.)
  if (event.queryStringParameters && Object.keys(event.queryStringParameters).length) {
    const qs = new URLSearchParams(event.queryStringParameters).toString();
    url += `?${qs}`;
  }

  try {
    const response = await fetch(url, {
      method: event.httpMethod,
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: ["POST", "PATCH", "PUT"].includes(event.httpMethod) ? event.body : undefined,
    });

    const data = await response.json();
    return {
      statusCode: response.status,
      headers,
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
