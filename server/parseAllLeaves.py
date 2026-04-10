import xlrd, json
from datetime import datetime

def excel_date(serial):
    return xlrd.xldate_as_datetime(serial, 0).strftime('%Y-%m-%d')

LEAVE_TYPE_MAP = {
    'Carry Forward (CF)': 'CF',
    'Comp - Off':         'COF',
    'Privilege Leave':    'PL',
    'Privilege Leave ':   'PL',
    'Loss of Pay':        'LOP',
    'Loss Of Pay':        'LOP',
}

wb = xlrd.open_workbook(r'C:\Users\91992\Downloads\Day Wise Leave Transaction Report.xls')
sh = wb.sheet_by_index(0)
print(f"Rows: {sh.nrows}")

raw = []
for i in range(4, sh.nrows):
    row = sh.row_values(i)
    emp_no = str(row[1]).strip()
    if not emp_no.startswith('COLOR'):
        continue
    lt_name  = str(row[5]).strip()
    from_ser = row[6]
    to_ser   = row[7]
    trans    = str(row[8]).strip()
    days     = float(row[9]) if row[9] else 0
    reason   = str(row[10]).strip() if row[10] else ''

    if trans != 'Availed' or not from_ser or not to_ser:
        continue
    lt_code = LEAVE_TYPE_MAP.get(lt_name)
    if not lt_code:
        print(f"  Unknown: '{lt_name}' row {i}")
        continue

    raw.append({
        'empNo': emp_no,
        'leaveType': lt_code,
        'fromDate': excel_date(from_ser),
        'toDate':   excel_date(to_ser),
        'days':     days,
        'reason':   reason,
    })

# Deduplicate: group by (empNo, leaveType, fromDate, toDate), sum days
deduped = {}
for r in raw:
    key = (r['empNo'], r['leaveType'], r['fromDate'], r['toDate'])
    if key not in deduped:
        deduped[key] = {**r, 'days': 0}
    deduped[key]['days'] = round(deduped[key]['days'] + r['days'], 2)

records = list(deduped.values())
print(f"Total unique records: {len(records)}")

# Count per employee
from collections import Counter
emp_counts = Counter(r['empNo'] for r in records)
print(f"Employees with leaves: {len(emp_counts)}")

# Save
out = r'D:\Activity Report Software\server\all_leaves.json'
with open(out, 'w') as f:
    json.dump(records, f, indent=2)
print(f"Saved to {out}")
