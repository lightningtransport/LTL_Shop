"""Rebuilds validacion-hoy.html from Ninox's credential-free shares (approved in lightningtransport/data-reporting-kit).
Usage: NINOX_SHARE_OFF_DUTY=<url> NINOX_SHARE_ON_ROAD=<url> python3 validacion/actualizar-validacion.py
The two share links ("off duty" and "on the road") live in lightningtransport/data-reporting-kit; they are not
committed here. Needs network access to lightningtransport.ninoxdb.com. The output has real data: it is gitignored.
Keeps only truck, status, location, days in yard and group; no owner, insurance or Samsara ids."""
import datetime, json, os, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
OFF = os.environ.get('NINOX_SHARE_OFF_DUTY') or exit('Set NINOX_SHARE_OFF_DUTY (see data-reporting-kit)')
ON = os.environ.get('NINOX_SHARE_ON_ROAD') or exit('Set NINOX_SHARE_ON_ROAD (see data-reporting-kit)')
def now(): return datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
def get(url, timeout):
    start = now(); req = urllib.request.Request(url, headers={'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        body = r.read(2 * 1024 * 1024 + 1)
    if len(body) > 2 * 1024 * 1024: raise SystemExit('response too large')
    rows = json.loads(body)
    if not isinstance(rows, list): raise SystemExit('not a JSON array')
    return rows, start, now()
off, s1, e1 = get(OFF, 30)
trucks = []
for r in off:
    ms = r.get('Days In Yard')
    trucks.append({'truck': r['truck_number'], 'status': r.get('mechanic_status'), 'location': (r.get('yard_location') or '').strip() or None,
                   'days': None if ms is None else round(ms / 86400000), 'group': r.get('dispatcher')})
data = {'offDuty': {'fetchedAt': s1, 'completedAt': e1, 'trucks': trucks}, 'onRoad': None}
try:
    on, s2, e2 = get(ON, 90)
    data['onRoad'] = {'fetchedAt': s2, 'completedAt': e2, 'count': len({r['truck_number'] for r in on})}
except Exception as err:  # the page shows the on-road tile only when this answered
    print('on-road share did not answer:', err)
# One page: the redesign (mockup.html) with a first tab of queried Ninox data. No second file, no new tab.
page = open(os.path.join(ROOT, 'mockup.html')).read()
screens = open(os.path.join(HERE, 'ninox-screens.js')).read().replace('/*DATA*/null', json.dumps(data, separators=(',', ':')))
def swap(old, new):
    global page
    if old not in page: raise SystemExit('mockup changed, not found: ' + old[:60])
    page = page.replace(old, new, 1)
swap('<title>Shop Board redesign</title>', '<title>Shop Board today</title>')
swap('<div class="proto-title">Shop Board · boceto<small>Propuesta rediseno-pizarra · datos de ejemplo</small></div>',
     '<div class="proto-title">Lightning Shop · validación<small>"Ninox now": consultado en Ninox · las demás pestañas: versión resumida con camiones de ejemplo</small></div>')
swap("const SCREENS = [\n", "const SCREENS = [\n  ['ninox', 'Ninox now', 'Real data'],\n")
swap("  ['mgmt', 'Shop today', 'Gerencia'],\n];", "  ['mgmt', 'Shop today', 'Gerencia'],\n  ['decided', 'Decided', 'Owner'],\n];")
swap('<main class="wrap">', '<main class="wrap">\n  <section class="screen" id="s-ninox" hidden></section>\n  <section class="screen" id="s-decided" hidden></section>')
swap("let screen = 'board';", "let screen = 'ninox';")
swap("const RENDER = { ", screens + "\nconst RENDER = { ninox: renderNinox, decided: renderDecided, ")
swap("</style>", """.nxboard { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; align-items: start; }
@media (max-width: 1100px) { .nxboard { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 560px) { .nxboard { grid-template-columns: 1fr; } }
.nx { font-size: 11px; border-radius: 4px; padding: 2px 7px; font-weight: 600; white-space: nowrap; }
.nx-checked { background: oklch(0.93 0.12 100); color: oklch(0.35 0.08 95); } .nx-wip { background: oklch(0.88 0.07 235); color: oklch(0.32 0.09 245); }
.nx-heavy { background: oklch(0.85 0.09 30); color: oklch(0.38 0.12 30); } .nx-qc { background: oklch(0.88 0.1 150); color: oklch(0.32 0.09 150); }
.nx-rtg { background: oklch(0.55 0.13 150); color: oklch(0.99 0 0); }
</style>""")
open(os.path.join(ROOT, 'validacion-hoy.html'), 'w').write(page)
print('ok', len(trucks), 'off duty;', data['onRoad']['count'] if data['onRoad'] else 'no', 'on road;', s1)
