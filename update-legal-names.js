#!/usr/bin/env node
// update-legal-names.js
// Run after Netlify deploys the proxy function.
// Usage: node update-legal-names.js
//
// Or run directly against Airtable (set USE_PROXY=false and provide AIRTABLE_TOKEN):
//   AIRTABLE_TOKEN=xxx node update-legal-names.js

const USE_PROXY = process.env.USE_PROXY !== "false";
const PROXY_BASE = "https://app.angelstreetmemphis.com/.netlify/functions/airtable";
const AIRTABLE_DIRECT = `https://api.airtable.com/v0/app4rFvbq29z77DPS`;
const TOKEN = process.env.AIRTABLE_TOKEN || "";

const TABLE = "Invoices";

// Name → LegalName mappings (search by Name field)
const UPDATES = [
  { search: "DJ Shai",  legalName: "SABRIYYA YATES" },
  { search: "McKenzie", legalName: "McKenzie Mitchell" },
  { search: "Patience", legalName: "Patience Andrews" },
  { search: "Jasmine",  legalName: "Jasmine Watson" },
];

async function fetchRecords(nameFilter) {
  const formula = encodeURIComponent(`SEARCH("${nameFilter}", {Name})`);
  let url, headers;
  if (USE_PROXY) {
    url = `${PROXY_BASE}/${TABLE}?filterByFormula=${formula}&fields[]=Name&fields[]=LegalName`;
    headers = { "Content-Type": "application/json" };
  } else {
    url = `${AIRTABLE_DIRECT}/${TABLE}?filterByFormula=${formula}&fields[]=Name&fields[]=LegalName`;
    headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
  }
  const res = await fetch(url, { headers });
  return res.json();
}

async function updateRecord(recordId, legalName) {
  let url, headers;
  if (USE_PROXY) {
    url = `${PROXY_BASE}/${TABLE}/${recordId}`;
    headers = { "Content-Type": "application/json" };
  } else {
    url = `${AIRTABLE_DIRECT}/${TABLE}/${recordId}`;
    headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
  }
  const res = await fetch(url, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ fields: { LegalName: legalName } }),
  });
  return res.json();
}

async function main() {
  console.log(`Mode: ${USE_PROXY ? "Proxy" : "Direct Airtable"}\n`);
  for (const { search, legalName } of UPDATES) {
    console.log(`🔍 Searching for "${search}"...`);
    const data = await fetchRecords(search);
    if (!data.records || data.records.length === 0) {
      console.log(`  ⚠️  No records found for "${search}"\n`);
      continue;
    }
    for (const record of data.records) {
      console.log(`  Found: ${record.id} — Name: "${record.fields.Name}", current LegalName: "${record.fields.LegalName || "(empty)"}"`);
      const result = await updateRecord(record.id, legalName);
      if (result.id) {
        console.log(`  ✅ Updated LegalName → "${legalName}"\n`);
      } else {
        console.log(`  ❌ Error: ${JSON.stringify(result)}\n`);
      }
    }
  }
  console.log("Done.");
}

main().catch(console.error);
