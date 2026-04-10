import xlrd
import json

wb = xlrd.open_workbook(r'C:\Users\91992\Downloads\Day Wise Leave Transaction Report - Jyoti.xls')
sh = wb.sheet_by_index(0)

print(f"Rows: {sh.nrows}, Cols: {sh.ncols}")
print("\n--- First 40 rows ---")
for i in range(min(40, sh.nrows)):
    print(f"Row {i}: {sh.row_values(i)}")
