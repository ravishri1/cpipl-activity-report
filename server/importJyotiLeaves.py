import xlrd
import json
from datetime import datetime, date

def excel_date(serial):
    """Convert Excel date serial to YYYY-MM-DD string"""
    # Excel date serial: days since 1899-12-30
    d = xlrd.xldate_as_datetime(serial, 0)
    return d.strftime('%Y-%m-%d')

wb = xlrd.open_workbook(r'C:\Users\91992\Downloads\Day Wise Leave Transaction Report - Jyoti.xls')
sh = wb.sheet_by_index(0)

# Map leave type names → codes
LEAVE_TYPE_MAP = {
    'Carry Forward (CF)': 'CF',
    'Comp - Off': 'COF',
    'Privilege Leave': 'PL',
    'Loss of Pay': 'LOP',
    'Loss Of Pay': 'LOP',
    'Privilege Leave ': 'PL',  # trailing space variant
}

# Collect Jyoti's rows
raw_records = []
for i in range(4, sh.nrows):
    row = sh.row_values(i)
    emp_no = str(row[1]).strip()
    if emp_no != 'COLOR047':
        continue
    leave_type_name = str(row[5]).strip()
    from_serial = row[6]
    to_serial = row[7]
    trans_type = str(row[8]).strip()
    days = float(row[9]) if row[9] else 0
    reason = str(row[10]).strip() if row[10] else ''

    if trans_type != 'Availed':
        continue
    if not from_serial or not to_serial:
        continue

    lt_code = LEAVE_TYPE_MAP.get(leave_type_name)
    if not lt_code:
        print(f"  Unknown leave type: '{leave_type_name}' row {i}")
        continue

    from_date = excel_date(from_serial)
    to_date = excel_date(to_serial)

    raw_records.append({
        'leaveType': lt_code,
        'fromDate': from_date,
        'toDate': to_date,
        'days': days,
        'reason': reason,
    })

# Deduplicate: group by (leaveType, fromDate, toDate), sum days
deduped = {}
for r in raw_records:
    key = (r['leaveType'], r['fromDate'], r['toDate'])
    if key not in deduped:
        deduped[key] = {'leaveType': r['leaveType'], 'fromDate': r['fromDate'], 'toDate': r['toDate'], 'days': 0, 'reason': r['reason']}
    deduped[key]['days'] += r['days']

records = list(deduped.values())

print(f"\nJyoti leave records: {len(records)}")
for r in records:
    print(f"  {r['leaveType']:4s} | {r['fromDate']} to {r['toDate']} | {r['days']:4.1f}d | {r['reason'][:50]}")

# Save to JSON
out_path = r'D:\Activity Report Software\server\jyoti_leaves.json'
with open(out_path, 'w') as f:
    json.dump(records, f, indent=2)
print(f"\nSaved to {out_path}")
