// netlify/functions/generate-payroll-xlsx.js
// Generates a formatted payroll XLSX matching the AngelStreet template

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PYTHON_SCRIPT = `
import sys, json, base64, datetime
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

data = json.loads(sys.argv[1])
label = data['label']
pay_date = data['payDate']
staff = data['staff']

PINK      = "FFCA3092"
DARK_PUR  = "FF3D1A47"
PURPLE    = "FF6A1B9A"
LT_GRAY   = "FFF5F5F5"
WHITE     = "FFFFFFFF"
LT_GREEN  = "FFE8F5E9"
LT_YELLOW = "FFFFF9C4"
LT_PURPLE = "FFF3E5F5"

def fill(c): return PatternFill("solid", fgColor=c)
def fnt(bold=False, color="FF000000", size=11):
    return Font(bold=bold, color=color, name="Arial", size=size)
def ctr(): return Alignment(horizontal="center", vertical="center")
def lft(): return Alignment(horizontal="left", vertical="center")

wb = Workbook()

# ── SUMMARY SHEET ─────────────────────────────────────────────────
ws = wb.active
ws.title = "Summary"
ws.column_dimensions["A"].width = 22
ws.column_dimensions["B"].width = 10
ws.column_dimensions["C"].width = 14
ws.column_dimensions["D"].width = 14
ws.column_dimensions["E"].width = 12
ws.column_dimensions["F"].width = 14
ws.row_dimensions[1].height = 22

ws.merge_cells("A1:F1")
ws["A1"] = "AngelStreet Creative Arts Camp 2026 — Payroll Report"
ws["A1"].fill = fill(PINK); ws["A1"].font = fnt(True, "FFFFFFFF", 13); ws["A1"].alignment = lft()

ws.merge_cells("A2:F2")
ws["A2"] = f"{label}  |  Pay Date: {pay_date}"
ws["A2"].fill = fill(DARK_PUR); ws["A2"].font = fnt(True, "FFFFFFFF"); ws["A2"].alignment = lft()

for col, h in enumerate(["Name","Rate/Hr","Total Hours","Hourly Pay","Flat Rate","Total Pay"], 1):
    c = ws.cell(row=3, column=col, value=h)
    c.fill = fill(PURPLE); c.font = fnt(True, "FFFFFFFF"); c.alignment = ctr()

for i, s in enumerate(staff):
    row = i + 4
    bg = LT_GRAY if i % 2 == 0 else WHITE
    sn = s['name']
    ws.cell(row=row, column=1, value=sn).font = fnt(True)
    ws.cell(row=row, column=1).fill = fill(bg)
    ws.cell(row=row, column=2, value=s['rate']).fill = fill(bg)
    ws.cell(row=row, column=2).number_format = '"$"#,##0.00'
    ws.cell(row=row, column=3, value=f"='{sn}'!E9").fill = fill(bg)
    ws.cell(row=row, column=3).number_format = "0.00"
    ws.cell(row=row, column=4, value=f"=C{row}*B{row}").fill = fill(bg)
    ws.cell(row=row, column=4).number_format = '"$"#,##0.00'
    if s['flat']:
        ws.cell(row=row, column=5, value=f"='{sn}'!C11").fill = fill(bg)
        ws.cell(row=row, column=5).number_format = '"$"#,##0.00'
        ws.cell(row=row, column=6, value=f"=D{row}+E{row}").fill = fill(LT_GREEN)
    else:
        ws.cell(row=row, column=5, value="—").fill = fill(bg)
        ws.cell(row=row, column=6, value=f"=D{row}").fill = fill(LT_GREEN)
    ws.cell(row=row, column=6).font = fnt(True)
    ws.cell(row=row, column=6).number_format = '"$"#,##0.00'

tr = len(staff) + 4
ws.cell(row=tr, column=1, value="TOTALS").fill = fill(PINK)
ws.cell(row=tr, column=1).font = fnt(True, "FFFFFFFF")
for col in range(2, 7):
    c = ws.cell(row=tr, column=col)
    c.fill = fill(PINK); c.font = fnt(True, "FFFFFFFF")
    if col >= 3:
        cl = get_column_letter(col)
        c.value = f"=SUM({cl}4:{cl}{tr-1})"
        c.number_format = '"$"#,##0.00' if col != 3 else "0.00"

# ── INDIVIDUAL SHEETS ──────────────────────────────────────────────
for s in staff:
    sn = s['name']
    ws2 = wb.create_sheet(title=sn[:31])
    for col, w in zip("ABCDEF", [14,13,13,13,14,12]):
        ws2.column_dimensions[col].width = w
    ws2.row_dimensions[1].height = 20

    ws2.merge_cells("A1:F1")
    ws2["A1"] = f"{sn} — {label}"
    ws2["A1"].fill = fill(PINK); ws2["A1"].font = fnt(True,"FFFFFFFF",12); ws2["A1"].alignment = lft()

    ws2.merge_cells("A2:F2")
    ws2["A2"] = f"Rate: $" + str(round(s['rate'],2)) + "/hr  |  Pay Date: " + pay_date + "  |  Yellow = enter data"
    ws2["A2"].font = fnt(True); ws2["A2"].alignment = lft()

    for col, h in enumerate(["Date","Day","Punch In","Punch Out","Hours Worked","Pay"], 1):
        c = ws2.cell(row=3, column=col, value=h)
        c.fill = fill(PURPLE); c.font = fnt(True,"FFFFFFFF"); c.alignment = ctr()

    for i, day in enumerate(s['days']):
        row = i + 4
        bg = LT_GRAY if i % 2 == 0 else WHITE
        ws2.cell(row=row, column=1, value=day['date']).fill = fill(bg)
        try:
            dt = datetime.datetime.strptime(day['date'], "%m/%d/%Y")
            dayname = dt.strftime("%A")
        except:
            dayname = ""
        ws2.cell(row=row, column=2, value=dayname).fill = fill(bg)
        if day['punchIn']:
            ws2.cell(row=row, column=3, value=day['punchIn']).fill = fill(LT_YELLOW)
        else:
            ws2.cell(row=row, column=3).fill = fill(LT_YELLOW)
        if day['punchOut']:
            ws2.cell(row=row, column=4, value=day['punchOut']).fill = fill(LT_YELLOW)
        else:
            ws2.cell(row=row, column=4).fill = fill(LT_YELLOW)
        ws2.cell(row=row, column=5, value=round(day['hours'],4)).fill = fill(LT_YELLOW)
        ws2.cell(row=row, column=5).number_format = "0.00"
        ws2.cell(row=row, column=6, value=round(day['hours']*s['rate'],2)).fill = fill(LT_YELLOW)
        ws2.cell(row=row, column=6).number_format = '"$"#,##0.00'

    ws2.cell(row=9,column=1,value="Hourly Total").fill=fill(LT_PURPLE)
    ws2.cell(row=9,column=1).font=fnt(True)
    ws2.cell(row=9,column=5,value="=SUM(E4:E8)").fill=fill(LT_PURPLE)
    ws2.cell(row=9,column=5).font=fnt(True); ws2.cell(row=9,column=5).number_format="0.00"
    ws2.cell(row=9,column=6,value="=SUM(F4:F8)").fill=fill(LT_GREEN)
    ws2.cell(row=9,column=6).font=fnt(True); ws2.cell(row=9,column=6).number_format='"$"#,##0.00'

    ws2.cell(row=10,column=1,value="TOTAL PAY:").font=fnt(True)
    if s['flat']:
        ws2.cell(row=10,column=3,value="=F9+C11").fill=fill(LT_GREEN)
        ws2.cell(row=10,column=3).font=fnt(True); ws2.cell(row=10,column=3).number_format='"$"#,##0.00'
        ws2.cell(row=11,column=1,value="Flat Rate Bonus:").font=fnt(True)
        ws2.cell(row=11,column=3,value=s['flatAmt']).fill=fill(LT_YELLOW)
        ws2.cell(row=11,column=3).number_format='"$"#,##0.00'
        ach_start=12
    else:
        ws2.cell(row=10,column=3,value="=F9").fill=fill(LT_GREEN)
        ws2.cell(row=10,column=3).font=fnt(True); ws2.cell(row=10,column=3).number_format='"$"#,##0.00'
        ach_start=11

    ws2.merge_cells(f"A{ach_start}:F{ach_start}")
    ws2.cell(row=ach_start,column=1,value="ACH / PAYMENT INFORMATION")
    ws2.cell(row=ach_start,column=1).fill=fill(PURPLE)
    ws2.cell(row=ach_start,column=1).font=fnt(True,"FFFFFFFF")

    for j,label2 in enumerate(["Same ACH as on file?","Bank Name:","Account Holder Name:","Routing Number:","Account Number:","Account Type (Checking/Savings):"]):
        r=ach_start+1+j
        ws2.cell(row=r,column=1,value=label2).font=fnt(True)
        ws2.cell(row=r,column=3).fill=fill(LT_YELLOW)

import tempfile, os
tmp = tempfile.mktemp(suffix='.xlsx')
wb.save(tmp)
with open(tmp,'rb') as f:
    b64 = base64.b64encode(f.read()).decode()
os.unlink(tmp)
print(b64)
`;

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method not allowed" };

  let payload;
  try { payload = JSON.parse(event.body); }
  catch (e) { return { statusCode: 400, headers, body: "Invalid JSON" }; }

  const tmpScript = path.join(os.tmpdir(), `payroll_${Date.now()}.py`);
  const tmpData = JSON.stringify(payload).replace(/'/g, "\\'");

  try {
    fs.writeFileSync(tmpScript, PYTHON_SCRIPT);

    // Check if openpyxl is available, install if not
    try { execSync("python3 -c 'import openpyxl'", { timeout: 5000 }); }
    catch (e) { execSync("pip3 install openpyxl --quiet --break-system-packages", { timeout: 30000 }); }

    const b64 = execSync(
      `python3 ${tmpScript} '${JSON.stringify(payload).replace(/'/g, "'\\''")}'`,
      { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }
    ).toString().trim();

    fs.unlinkSync(tmpScript);

    return {
      statusCode: 200,
      headers: {
        ...headers,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="AngelStreet_Payroll.xlsx"`,
        "Content-Transfer-Encoding": "base64",
      },
      body: b64,
      isBase64Encoded: true,
    };
  } catch (err) {
    if (fs.existsSync(tmpScript)) fs.unlinkSync(tmpScript);
    return {
      statusCode: 500,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
