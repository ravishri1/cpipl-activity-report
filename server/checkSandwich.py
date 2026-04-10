from datetime import datetime, date, timedelta

# Jyoti's leave records (from imported data)
leaves = [
    {'type': 'CF',  'from': '2025-05-07', 'to': '2025-05-09', 'days': 3.0, 'reason': "sister's wedding"},
    {'type': 'COF', 'from': '2025-05-12', 'to': '2025-05-12', 'days': 0.5, 'reason': ''},
    {'type': 'CF',  'from': '2025-05-13', 'to': '2025-05-13', 'days': 1.0, 'reason': 'emergency at home'},
    {'type': 'PL',  'from': '2025-05-14', 'to': '2025-05-14', 'days': 1.0, 'reason': 'mother hospitalised'},
    {'type': 'PL',  'from': '2025-07-07', 'to': '2025-07-09', 'days': 3.0, 'reason': 'admitted to the hospital'},
    {'type': 'COF', 'from': '2025-07-10', 'to': '2025-07-10', 'days': 1.0, 'reason': ''},
    {'type': 'LOP', 'from': '2025-07-11', 'to': '2025-07-13', 'days': 3.0, 'reason': 'LOP'},
    {'type': 'LOP', 'from': '2025-07-14', 'to': '2025-07-14', 'days': 1.0, 'reason': 'admitted to the hospital'},
    {'type': 'COF', 'from': '2025-08-12', 'to': '2025-08-12', 'days': 1.0, 'reason': 'high fever'},
    {'type': 'COF', 'from': '2025-09-02', 'to': '2025-09-02', 'days': 1.0, 'reason': 'grandfather passed away'},
    {'type': 'COF', 'from': '2025-11-05', 'to': '2025-11-05', 'days': 1.0, 'reason': 'emergency village'},
    {'type': 'COF', 'from': '2025-12-06', 'to': '2025-12-06', 'days': 1.0, 'reason': 'family function'},
    {'type': 'PL',  'from': '2025-12-15', 'to': '2025-12-15', 'days': 1.0, 'reason': 'mother not well'},
    {'type': 'PL',  'from': '2025-12-22', 'to': '2025-12-22', 'days': 1.0, 'reason': 'mother sick'},
    {'type': 'PL',  'from': '2026-01-19', 'to': '2026-01-19', 'days': 1.0, 'reason': 'birthday celebration'},
    {'type': 'PL',  'from': '2026-02-16', 'to': '2026-02-16', 'days': 1.0, 'reason': 'hospitalised stomach pain'},
    {'type': 'COF', 'from': '2026-03-30', 'to': '2026-03-30', 'days': 1.0, 'reason': 'mother sick'},
    {'type': 'PL',  'from': '2026-03-31', 'to': '2026-03-31', 'days': 1.0, 'reason': 'mother hospitalised'},
]

DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

print("=== LEAVE SCHEDULE WITH DAY OF WEEK ===")
# Build a set of all leave dates
leave_dates = set()
for l in leaves:
    d = datetime.strptime(l['from'], '%Y-%m-%d').date()
    end = datetime.strptime(l['to'], '%Y-%m-%d').date()
    while d <= end:
        leave_dates.add(d)
        d += timedelta(days=1)

for l in leaves:
    fd = datetime.strptime(l['from'], '%Y-%m-%d').date()
    td = datetime.strptime(l['to'], '%Y-%m-%d').date()
    print(f"  {l['type']:4s} | {l['from']} ({DAY_NAMES[fd.weekday()]}) to {l['to']} ({DAY_NAMES[td.weekday()]}) | {l['days']}d | {l['reason'][:40]}")

print("\n=== SANDWICH LEAVE CHECK ===")
print("Rule: If leaves exist on both sides of Sat/Sun (or holiday), the gap days are sandwich leave\n")

# Sort leaves by start date
sorted_leaves = sorted(leaves, key=lambda x: x['from'])

sandwich_cases = []

for i in range(len(sorted_leaves) - 1):
    curr = sorted_leaves[i]
    nxt = sorted_leaves[i + 1]

    curr_end = datetime.strptime(curr['to'], '%Y-%m-%d').date()
    next_start = datetime.strptime(nxt['from'], '%Y-%m-%d').date()

    gap_start = curr_end + timedelta(days=1)
    gap_end = next_start - timedelta(days=1)

    if gap_start > gap_end:
        continue  # Consecutive or overlapping, no gap

    # Check if all gap days are weekend (Sat=5, Sun=6)
    gap_days = []
    d = gap_start
    while d <= gap_end:
        gap_days.append(d)
        d += timedelta(days=1)

    all_weekend = all(d.weekday() >= 5 for d in gap_days)
    any_weekend = any(d.weekday() >= 5 for d in gap_days)

    if any_weekend and len(gap_days) <= 2:
        gap_str = ', '.join(f"{d} ({DAY_NAMES[d.weekday()]})" for d in gap_days)
        print(f"  SANDWICH FOUND!")
        print(f"    Before: {curr['type']} ends {curr['to']} ({DAY_NAMES[curr_end.weekday()]})")
        print(f"    Gap:    {gap_str}  <- should be counted as leave")
        print(f"    After:  {nxt['type']} starts {nxt['from']} ({DAY_NAMES[next_start.weekday()]})")
        print(f"    Extra days to add: {len(gap_days)}")
        print()
        sandwich_cases.append({
            'before': curr,
            'after': nxt,
            'gap_days': [str(d) for d in gap_days],
            'extra_days': len(gap_days),
        })

if not sandwich_cases:
    print("  No sandwich leave cases found.")

print(f"\nTotal sandwich cases: {len(sandwich_cases)}")
