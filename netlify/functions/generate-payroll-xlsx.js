// netlify/functions/generate-payroll-xlsx.js
const ExcelJS = require('exceljs');

const PINK    = 'FFCA3092';
const DPURP   = 'FF3D1A47';
const PURP    = 'FF6A1B9A';
const LTGRAY  = 'FFF5F5F5';
const WHITE   = 'FFFFFFFF';
const LTGREEN = 'FFE8F5E9';
const LTYELLOW= 'FFFFF9C4';
const LTPURP  = 'FFF3E5F5';
const BLACK   = 'FF000000';

function fill(argb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}
function font(bold, color = BLACK, size = 11) {
  return { bold, color: { argb: color }, name: 'Arial', size };
}
function border() {
  const s = { style: 'thin', color: { argb: 'FFCCCCCC' } };
  return { top: s, bottom: s, left: s, right: s };
}
function hdrStyle(bold = true) {
  return { fill: fill(PURP), font: font(bold, WHITE), alignment: { horizontal: 'center', vertical: 'middle' }, border: border() };
}
function cellStyle(bg, bold = false, color = BLACK) {
  return { fill: fill(bg), font: font(bold, color), alignment: { horizontal: 'left', vertical: 'middle' }, border: border() };
}

function applyRow(row, styles) {
  row.eachCell({ includeEmpty: true }, (cell, colNum) => {
    const s = styles[colNum - 1];
    if (s) {
      if (s.fill) cell.fill = s.fill;
      if (s.font) cell.font = s.font;
      if (s.alignment) cell.alignment = s.alignment;
      if (s.border) cell.border = s.border;
    }
  });
}

function styleCell(ws, rowNum, colNum, style) {
  const cell = ws.getCell(rowNum, colNum);
  if (style.fill) cell.fill = style.fill;
  if (style.font) cell.font = style.font;
  if (style.alignment) cell.alignment = style.alignment;
  if (style.border) cell.border = style.border;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' };

  let payload;
  try { payload = JSON.parse(event.body); }
  catch (e) { return { statusCode: 400, headers, body: 'Invalid JSON' }; }

  const { label, payDate, staff } = payload;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AngelStreet Memphis';

  // ── SUMMARY SHEET ───────────────────────────────────────────────
  const sum = wb.addWorksheet('Summary');
  sum.columns = [
    { width: 24 }, { width: 11 }, { width: 15 },
    { width: 15 }, { width: 13 }, { width: 15 }
  ];

  // Title
  sum.mergeCells('A1:F1');
  sum.getCell('A1').value = 'AngelStreet Creative Arts Camp 2026 — Payroll Report';
  sum.getCell('A1').fill = fill(PINK);
  sum.getCell('A1').font = font(true, WHITE, 13);
  sum.getCell('A1').alignment = { horizontal: 'left', vertical: 'middle' };
  sum.getRow(1).height = 24;

  // Subtitle
  sum.mergeCells('A2:F2');
  sum.getCell('A2').value = `${label}  |  Pay Date: ${payDate}`;
  sum.getCell('A2').fill = fill(DPURP);
  sum.getCell('A2').font = font(true, WHITE, 11);
  sum.getCell('A2').alignment = { horizontal: 'left', vertical: 'middle' };

  // Blank row
  sum.addRow([]);

  // Header row
  const hdrRow = sum.addRow(['Name', 'Rate/Hr', 'Total Hours', 'Hourly Pay', 'Flat Rate', 'Total Pay']);
  hdrRow.height = 18;
  hdrRow.eachCell((cell) => {
    cell.fill = fill(PURP);
    cell.font = font(true, WHITE);
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = border();
  });

  let grandTotal = 0;
  staff.forEach((s, i) => {
    const bg = i % 2 === 0 ? LTGRAY : WHITE;
    const totalHrs = s.days.reduce((sum, d) => sum + (d.hours || 0), 0);
    const hp = totalHrs * s.rate;
    const flat = s.flatAmt || 0;
    const tot = hp + flat;
    grandTotal += tot;

    const isInvoice = s.invoiceOnly;
    const rowBg = isInvoice ? 'FFFFF3CD' : bg; // yellow tint for invoice-only
    const nameLabel = isInvoice ? s.name + ' ★ INVOICE BUDGET' : s.name;
    if (!isInvoice) grandTotal += tot; // don't add invoice staff to payroll total

    const row = sum.addRow([
      nameLabel,
      s.rate,
      Math.round(totalHrs * 100) / 100,
      Math.round(hp * 100) / 100,
      s.flat ? flat : '—',
      Math.round(tot * 100) / 100
    ]);
    row.getCell(1).fill = fill(rowBg); row.getCell(1).font = font(true); row.getCell(1).border = border();
    row.getCell(2).fill = fill(rowBg); row.getCell(2).font = font(false); row.getCell(2).numFmt = '"$"#,##0.00'; row.getCell(2).border = border();
    row.getCell(3).fill = fill(rowBg); row.getCell(3).numFmt = '0.00'; row.getCell(3).border = border();
    row.getCell(4).fill = fill(rowBg); row.getCell(4).numFmt = '"$"#,##0.00'; row.getCell(4).border = border();
    row.getCell(5).fill = fill(rowBg); row.getCell(5).border = border();
    if (s.flat) { row.getCell(5).numFmt = '"$"#,##0.00'; }
    const totalCellBg = isInvoice ? 'FFFFE0B2' : LTGREEN; // orange tint for invoice total
    row.getCell(6).fill = fill(totalCellBg); row.getCell(6).font = font(true); row.getCell(6).numFmt = '"$"#,##0.00'; row.getCell(6).border = border();
  });

  // Totals row (payroll budget only — excludes invoice staff)
  const totRow = sum.addRow(['PAYROLL TOTALS (excl. Invoice Budget)', '', '', '', '', Math.round(grandTotal * 100) / 100]);
  totRow.eachCell((cell) => {
    cell.fill = fill(PINK);
    cell.font = font(true, WHITE);
    cell.border = border();
  });
  totRow.getCell(6).numFmt = '"$"#,##0.00';

  // ── INDIVIDUAL SHEETS ────────────────────────────────────────────
  const DAYNAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (const s of staff) {
    const ws = wb.addWorksheet(s.name.slice(0, 31));
    ws.columns = [
      { width: 14 }, { width: 13 }, { width: 13 },
      { width: 13 }, { width: 14 }, { width: 13 }
    ];

    // Title
    ws.mergeCells('A1:F1');
    ws.getCell('A1').value = `${s.name} — ${label}`;
    ws.getCell('A1').fill = fill(PINK);
    ws.getCell('A1').font = font(true, WHITE, 12);
    ws.getCell('A1').alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getRow(1).height = 22;

    // Rate row
    ws.mergeCells('A2:F2');
    ws.getCell('A2').value = s.invoiceOnly
      ? `Rate: $${s.rate.toFixed(2)}/hr  |  Pay Date: ${payDate}  |  ★ PAID FROM INVOICE BUDGET`
      : `Rate: $${s.rate.toFixed(2)}/hr  |  Pay Date: ${payDate}  |  Yellow = enter data`;
    ws.getCell('A2').font = font(true);
    ws.getCell('A2').alignment = { horizontal: 'left', vertical: 'middle' };

    // Blank
    ws.addRow([]);

    // Column headers
    const colHdr = ws.addRow(['Date', 'Day', 'Punch In', 'Punch Out', 'Hours Worked', 'Pay']);
    colHdr.height = 18;
    colHdr.eachCell((cell) => {
      cell.fill = fill(PURP);
      cell.font = font(true, WHITE);
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = border();
    });

    // Date rows
    let totalHrs = 0;
    s.days.forEach((day, i) => {
      const bg = i % 2 === 0 ? LTGRAY : WHITE;
      const parts = day.date.split('/');
      const dt = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]), 12);
      const dayName = DAYNAMES[dt.getDay()];
      const hrs = day.hours || 0;
      totalHrs += hrs;

      const row = ws.addRow([
        day.date, dayName,
        day.punchIn || '', day.punchOut || '',
        Math.round(hrs * 100) / 100,
        Math.round(hrs * s.rate * 100) / 100
      ]);
      [1, 2].forEach(c => { row.getCell(c).fill = fill(bg); row.getCell(c).border = border(); });
      [3, 4, 5, 6].forEach(c => { row.getCell(c).fill = fill(LTYELLOW); row.getCell(c).border = border(); });
      row.getCell(5).numFmt = '0.00';
      row.getCell(6).numFmt = '"$"#,##0.00';
    });

    // Hourly total row
    const hrTotRow = ws.addRow(['Hourly Total', '', '', '', Math.round(totalHrs * 100) / 100, Math.round(totalHrs * s.rate * 100) / 100]);
    [1, 2, 3, 4].forEach(c => { hrTotRow.getCell(c).fill = fill(LTPURP); hrTotRow.getCell(c).font = font(true); hrTotRow.getCell(c).border = border(); });
    hrTotRow.getCell(5).fill = fill(LTPURP); hrTotRow.getCell(5).font = font(true); hrTotRow.getCell(5).numFmt = '0.00'; hrTotRow.getCell(5).border = border();
    hrTotRow.getCell(6).fill = fill(LTGREEN); hrTotRow.getCell(6).font = font(true); hrTotRow.getCell(6).numFmt = '"$"#,##0.00'; hrTotRow.getCell(6).border = border();

    // Total Pay row
    const flat = s.flatAmt || 0;
    const totalPay = totalHrs * s.rate + flat;
    const totPayRow = ws.addRow(['TOTAL PAY:', '', Math.round(totalPay * 100) / 100]);
    totPayRow.getCell(1).font = font(true); totPayRow.getCell(1).border = border();
    totPayRow.getCell(3).fill = fill(LTGREEN); totPayRow.getCell(3).font = font(true); totPayRow.getCell(3).numFmt = '"$"#,##0.00'; totPayRow.getCell(3).border = border();

    // Flat rate row
    if (s.flat) {
      const flatRow = ws.addRow(['Flat Rate Bonus:', '', flat]);
      flatRow.getCell(1).font = font(true); flatRow.getCell(1).border = border();
      flatRow.getCell(3).fill = fill(LTYELLOW); flatRow.getCell(3).numFmt = '"$"#,##0.00'; flatRow.getCell(3).border = border();
    }

    // ACH section
    const achHdrRow = ws.addRow(['ACH / PAYMENT INFORMATION']);
    ws.mergeCells(`A${achHdrRow.number}:F${achHdrRow.number}`);
    achHdrRow.getCell(1).fill = fill(PURP);
    achHdrRow.getCell(1).font = font(true, WHITE);
    achHdrRow.getCell(1).border = border();

    const ach = s.ach || {};
    if (ach.sameAsFile) {
      const r = ws.addRow(['Same ACH as on file?', '', '✓ YES — Same as on file']);
      r.getCell(1).font = font(true); r.getCell(1).border = border();
      r.getCell(3).fill = fill(LTGREEN); r.getCell(3).font = font(true); r.getCell(3).border = border();
    } else {
      [
        ['Same ACH as on file?', 'No — New info below'],
        ['Bank Name:', ach.bank || ''],
        ['Account Holder Name:', ach.holder || ''],
        ['Routing Number:', ach.routing || ''],
        ['Account Number:', ach.account || ''],
        ['Account Type:', ach.type || '']
      ].forEach(([label2, val]) => {
        const r = ws.addRow([label2, '', val]);
        r.getCell(1).font = font(true); r.getCell(1).border = border();
        r.getCell(3).fill = fill(LTYELLOW); r.getCell(3).border = border();
      });
    }
  }

  // Write to buffer and return
  const buffer = await wb.xlsx.writeBuffer();
  const b64 = Buffer.from(buffer).toString('base64');

  return {
    statusCode: 200,
    headers: {
      ...headers,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="AngelStreet_Payroll.xlsx"`,
      'Content-Transfer-Encoding': 'base64',
    },
    body: b64,
    isBase64Encoded: true,
  };
};
