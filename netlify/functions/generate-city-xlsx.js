// netlify/functions/generate-city-xlsx.js
const ExcelJS = require('exceljs');

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

  const { weekLabel, staff } = payload;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Angel Street');

  const GRAY  = 'FF333333';
  const WHITE = 'FFFFFFFF';
  const LTGRAY= 'FFF5F5F5';
  const LTBLUE= 'FFE8F4FD';
  const BLACK = 'FF000000';
  const GREEN = 'FF34D399';

  function fill(argb) { return { type: 'pattern', pattern: 'solid', fgColor: { argb } }; }
  function font(bold, color=BLACK, size=11) { return { bold, color:{argb:color}, name:'Arial', size }; }
  function border() {
    const s = { style:'thin', color:{argb:'FF999999'} };
    return { top:s, bottom:s, left:s, right:s };
  }
  function center() { return { horizontal:'center', vertical:'middle', wrapText:true }; }
  function left() { return { horizontal:'left', vertical:'middle' }; }

  // Determine days from staff[0]
  const days = staff[0] ? staff[0].days : [];

  // Col widths: Name + one col per day (hrs + initials) + total + signature
  const colWidths = [22];
  days.forEach(() => { colWidths.push(8); colWidths.push(8); }); // hrs + initials per day
  colWidths.push(10); // total
  colWidths.push(14); // signature
  ws.columns = colWidths.map(w => ({ width: w }));

  // Row 1: Title + Week of
  const r1 = ws.addRow(['MPLOY 2026 Roster', ...new Array(colWidths.length - 2).fill(null), 'Week of:', null]);
  ws.mergeCells(1, 1, 1, colWidths.length - 2);
  ws.mergeCells(1, colWidths.length - 1, 1, colWidths.length);
  r1.getCell(1).value = 'MPLOY 2026 Roster';
  r1.getCell(1).font = font(true, WHITE, 13);
  r1.getCell(1).fill = fill(GRAY);
  r1.getCell(1).alignment = left();
  r1.getCell(colWidths.length - 1).value = 'Week of:  ' + weekLabel.replace('Week of ', '');
  r1.getCell(colWidths.length - 1).font = font(true, WHITE, 11);
  r1.getCell(colWidths.length - 1).fill = fill(GRAY);
  r1.getCell(colWidths.length - 1).alignment = left();
  r1.height = 22;

  // Row 2: Business name
  const r2 = ws.addRow(['Business name: ', 'Angel Street']);
  ws.mergeCells(2, 2, 2, colWidths.length);
  r2.getCell(1).font = font(true);
  r2.getCell(2).font = font(false);
  r2.height = 16;

  // Row 3: Day headers (merged pairs for each day)
  const r3vals = [''];
  let col = 2;
  days.forEach(d => { r3vals.push(d.dayName); r3vals.push(null); });
  r3vals.push('Weekly Total'); r3vals.push(null);
  r3vals.push('');
  const r3 = ws.addRow(r3vals);
  col = 2;
  days.forEach((d, i) => {
    const c1 = col; const c2 = col + 1;
    ws.mergeCells(3, c1, 3, c2);
    r3.getCell(c1).value = d.dayName;
    r3.getCell(c1).font = font(true, WHITE);
    r3.getCell(c1).fill = fill(GRAY);
    r3.getCell(c1).alignment = center();
    r3.getCell(c1).border = border();
    col += 2;
  });
  // Total merged
  ws.mergeCells(3, col, 3, col + 1);
  r3.getCell(col).value = 'Weekly Total';
  r3.getCell(col).font = font(true, WHITE);
  r3.getCell(col).fill = fill(GRAY);
  r3.getCell(col).alignment = center();
  r3.getCell(col).border = border();
  r3.height = 18;

  // Row 4: Sub-headers (Youth Name | Hours | Initials per day | Total Hours | Signature)
  const r4vals = ['Youth Name'];
  days.forEach(d => { r4vals.push('Hours'); r4vals.push('Initials'); });
  r4vals.push('Total Hours'); r4vals.push('Signature');
  const r4 = ws.addRow(r4vals);
  r4.eachCell((cell) => {
    cell.font = font(true, WHITE, 10);
    cell.fill = fill('FF555555');
    cell.alignment = center();
    cell.border = border();
  });
  r4.getCell(1).alignment = left();
  r4.height = 16;

  // Data rows
  staff.forEach((youth, yi) => {
    const bg = yi % 2 === 0 ? LTGRAY : WHITE;
    const vals = [youth.legal];
    youth.days.forEach(d => {
      vals.push(d.hours > 0 ? Math.round(d.hours * 100) / 100 : '');
      vals.push(''); // initials — blank for youth to fill in
    });
    vals.push(youth.total > 0 ? Math.round(youth.total * 100) / 100 : '');
    vals.push(''); // signature
    const row = ws.addRow(vals);
    row.height = 20;
    row.getCell(1).font = font(true);
    row.getCell(1).fill = fill(bg);
    row.getCell(1).alignment = left();
    row.getCell(1).border = border();
    let c = 2;
    youth.days.forEach(d => {
      // Hours cell
      row.getCell(c).fill = fill(d.hours > 0 ? 'FFE8F5E9' : LTBLUE);
      row.getCell(c).alignment = center();
      row.getCell(c).border = border();
      if (d.hours > 0) {
        row.getCell(c).font = font(true, 'FF059669');
        row.getCell(c).numFmt = '0.00';
      }
      // Initials cell
      row.getCell(c + 1).fill = fill(LTBLUE);
      row.getCell(c + 1).alignment = center();
      row.getCell(c + 1).border = border();
      c += 2;
    });
    // Total
    row.getCell(c).font = font(true, 'FF059669');
    row.getCell(c).fill = fill('FFE8F5E9');
    row.getCell(c).alignment = center();
    row.getCell(c).border = border();
    if (youth.total > 0) row.getCell(c).numFmt = '0.00';
    // Signature
    row.getCell(c + 1).fill = fill(bg);
    row.getCell(c + 1).alignment = center();
    row.getCell(c + 1).border = border();
  });

  const buf = await wb.xlsx.writeBuffer();
  const b64 = Buffer.from(buf).toString('base64');
  return {
    statusCode: 200,
    headers: { ...headers, 'Content-Type': 'text/plain' },
    body: b64
  };
};
