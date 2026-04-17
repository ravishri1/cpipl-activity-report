#!/usr/bin/env python3
"""Fix Jyoti Vasant Naik (COLOR047) April 2025 payslip."""

import re
import psycopg2
import json

# Read DATABASE_URL from .env
env_path = r"D:\Activity Report Software\server\.env"
db_url = None
with open(env_path) as f:
    for line in f:
        m = re.match(r'^DATABASE_URL="?([^"\n]+)"?', line.strip())
        if m:
            db_url = m.group(1)
            break

if not db_url:
    raise Exception("DATABASE_URL not found in .env")

print(f"Connecting to DB...")
conn = psycopg2.connect(db_url)
cur = conn.cursor()

# 1. Find Jyoti's userId
cur.execute('SELECT id, name, "employeeId" FROM "User" WHERE "employeeId" = %s', ('COLOR047',))
row = cur.fetchone()
if not row:
    print("ERROR: User COLOR047 not found")
    conn.close()
    exit(1)

user_id, name, emp_id = row
print(f"Found user: {name} (id={user_id}, empId={emp_id})")

# 2. Check her salary structure
cur.execute("""
    SELECT id, basic, hra, "otherAllowance", "specialAllowance",
           "employeePf", "employeeEsi", "professionalTax", tds,
           "ctcMonthly", "netPayMonthly", components
    FROM "SalaryStructure"
    WHERE "userId" = %s
""", (user_id,))
sal = cur.fetchone()
if sal:
    print(f"\nSalary Structure:")
    print(f"  basic={sal[1]}, hra={sal[2]}, otherAllowance={sal[3]}, specialAllowance={sal[4]}")
    print(f"  employeePf={sal[5]}, employeeEsi={sal[6]}, professionalTax={sal[7]}, tds={sal[8]}")
    print(f"  ctcMonthly={sal[9]}, netPayMonthly={sal[10]}")
    if sal[11]:
        print(f"  components (JSON): {json.dumps(sal[11], indent=2)}")
    else:
        print(f"  components: None")
else:
    print("No salary structure found")

# 3. Check existing April 2025 payslip
cur.execute("""
    SELECT id, basic, hra, "specialAllowance", "otherAllowance",
           "grossEarnings", "employeePf", "employeeEsi", "professionalTax", tds,
           "lopDeduction", "salaryAdvanceDeduction", "otherDeductions", "netPay",
           status, month
    FROM "Payslip"
    WHERE "userId" = %s AND month = '2025-04'
""", (user_id,))
payslip = cur.fetchone()
if payslip:
    print(f"\nExisting April 2025 Payslip (id={payslip[0]}):")
    print(f"  basic={payslip[1]}, hra={payslip[2]}, specialAllowance={payslip[3]}, otherAllowance={payslip[4]}")
    print(f"  grossEarnings={payslip[5]}")
    print(f"  employeePf={payslip[6]}, employeeEsi={payslip[7]}, professionalTax={payslip[8]}, tds={payslip[9]}")
    print(f"  lopDeduction={payslip[10]}, salaryAdvanceDeduction={payslip[11]}, otherDeductions={payslip[12]}")
    print(f"  netPay={payslip[13]}, status={payslip[14]}, month={payslip[15]}")
else:
    print("\nNo April 2025 payslip found")

# 4. Update the payslip
if payslip:
    payslip_id = payslip[0]

    # Values from salary structure UI
    new_basic = 22580.0
    new_hra = 8000.0
    new_other_allowance = 9000.0
    new_special_allowance = 4516.0  # Statutory Bonus
    new_gross = 44096.0  # 22580 + 8000 + 9000 + 4516

    # Keep existing deductions from payslip
    employee_pf = payslip[6] or 0
    employee_esi = payslip[7] or 0
    professional_tax = payslip[8] or 0
    tds_val = payslip[9] or 0
    lop_deduction = payslip[10] or 0
    salary_advance_deduction = payslip[11] or 0
    other_deductions = payslip[12] or 0

    new_net_pay = round(new_gross - employee_pf - employee_esi - professional_tax - tds_val - lop_deduction - salary_advance_deduction - other_deductions)

    print(f"\nUpdating payslip {payslip_id}:")
    print(f"  new basic={new_basic}, hra={new_hra}, otherAllowance={new_other_allowance}, specialAllowance={new_special_allowance}")
    print(f"  new grossEarnings={new_gross}")
    print(f"  deductions: pf={employee_pf}, esi={employee_esi}, pt={professional_tax}, tds={tds_val}, lop={lop_deduction}, advance={salary_advance_deduction}, other={other_deductions}")
    print(f"  new netPay={new_net_pay}")

    cur.execute("""
        UPDATE "Payslip"
        SET basic = %s,
            hra = %s,
            "otherAllowance" = %s,
            "specialAllowance" = %s,
            "grossEarnings" = %s,
            "netPay" = %s
        WHERE id = %s
    """, (new_basic, new_hra, new_other_allowance, new_special_allowance, new_gross, new_net_pay, payslip_id))

    rows_updated = cur.rowcount
    print(f"\nRows updated: {rows_updated}")

    if rows_updated > 0:
        conn.commit()
        print("SUCCESS: Payslip updated and committed.")
    else:
        conn.rollback()
        print("ERROR: No rows updated, rolling back.")
else:
    print("\nNo payslip to update.")

cur.close()
conn.close()
