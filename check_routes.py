import os, re

routes_dir = r'D:\Activity Report Software\server\src\routes'

route_re = re.compile(r"router\.(get|post|put|delete)\(\s*'([^']+)'")

for fname in sorted(os.listdir(routes_dir)):
    if not fname.endswith('.js'):
        continue
    path = os.path.join(routes_dir, fname)
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Collect all route definitions: (line_no, method, pattern)
    routes = []
    for i, line in enumerate(lines, 1):
        m = route_re.search(line)
        if m:
            routes.append((i, m.group(1), m.group(2)))

    # Find the first single-segment parametric route (/:something)
    first_param_line = None
    for lineno, method, pattern in routes:
        segs = pattern.split('/')
        # e.g. '/:id' -> ['', ':id']
        if len(segs) == 2 and segs[1].startswith(':'):
            first_param_line = lineno
            break

    if first_param_line is None:
        continue

    # Find any single-segment FIXED routes defined AFTER the first parametric
    bugs = []
    for lineno, method, pattern in routes:
        if lineno <= first_param_line:
            continue
        segs = pattern.split('/')
        if len(segs) == 2 and segs[1] and not segs[1].startswith(':'):
            bugs.append((lineno, method, pattern))

    if bugs:
        print(f'=== {fname} (first /:param at line {first_param_line}) ===')
        for lineno, method, pattern in bugs:
            print(f'  Line {lineno}: {method.upper()} {pattern}  <-- SHADOWED')
        print()

print('Scan complete.')
