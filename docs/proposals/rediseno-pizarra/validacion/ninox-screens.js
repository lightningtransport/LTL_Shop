/* ---------- Ninox, queried (not screenshots): written by actualizar-validacion.py ---------- */
const NINOX = /*DATA*/null;
const NX_STATUS = [['Checked In', 'nx-checked'], ['Work in Progress', 'nx-wip'], ['Heavy Work No ETA', 'nx-heavy'], ['Ready for Q.C.', 'nx-qc'], ['Q.C.', 'nx-qc'], ['Ready To Go', 'nx-rtg']];
function nxWhen(iso) { return new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET'; }
function renderNinox() {
  const el = $('#s-ninox');
  if (!NINOX) { el.innerHTML = '<div class="card card-pad">No Ninox data in this version.</div>'; return; }
  const T = NINOX.offDuty.trucks;
  const by = (st) => T.filter((t) => t.status === st);
  const yard = T.filter((t) => t.location === '301 Yard');
  const longRtg = by('Ready To Go').filter((t) => t.days >= 14).sort((a, b) => b.days - a.days);
  const longHeavy = by('Heavy Work No ETA').filter((t) => t.days >= 20).sort((a, b) => b.days - a.days);
  const d = (t) => t.days == null ? '' : `${t.days} ${t.days === 1 ? 'day' : 'days'}`;
  const cols = NX_STATUS.filter(([n]) => n !== 'Q.C.' || by('Q.C.').length);
  el.innerHTML = `
    <div class="app-head"><h1>The shop right now</h1><span class="live"><i></i>Ninox · ${esc(nxWhen(NINOX.offDuty.fetchedAt))}</span></div>
    <p class="sub muted" style="margin:-8px 0 16px;max-width:80ch">Datos <b>consultados</b> en Ninox (no copiados de capturas): los camiones que no están en la ruta, con su estado en Ninox. Así se vería la vista "By truck" de la app con los camiones de hoy.</p>
    <div class="kpis" style="margin-bottom:16px">
      <div class="card kpi"><div class="v">${T.length}</div><div class="l">Off the road</div><div class="c">${yard.length} in 301 Yard · ${T.length - yard.length} elsewhere</div></div>
      ${NINOX.onRoad ? `<div class="card kpi"><div class="v">${NINOX.onRoad.count}</div><div class="l">On the road</div><div class="c">Ninox · on the road</div></div>` : ''}
      <div class="card kpi"><div class="v">${by('Checked In').length}</div><div class="l">Checked In</div><div class="c">Arrived, waiting for work</div></div>
      <div class="card kpi"><div class="v">${by('Heavy Work No ETA').length}</div><div class="l">Heavy Work No ETA</div><div class="c">${longHeavy.length} with 20+ days</div></div>
      <div class="card kpi"><div class="v">${by('Ready To Go').length}</div><div class="l">Ready To Go</div><div class="c">${longRtg.length} with 14+ days in the yard</div></div>
    </div>
    <div class="nxboard">${cols.map(([n, c]) => {
      const ts = by(n).sort((a, b) => (b.days ?? -1) - (a.days ?? -1));
      return `<div class="col"><div class="col-head"><span class="nx ${c}">${esc(n)}</span><span class="count">${ts.length}</span></div><div class="col-body">${ts.map((t) => `<div class="jcard ${t.days >= 20 ? 'blocked' : ''}"><span class="top"><span class="num">${t.truck}</span><span class="spacer" style="flex:1"></span><span class="sub muted">${esc(d(t))}</span></span><span class="meta">${esc(t.location || '—')} · ${esc(t.group || '')}</span></div>`).join('') || '<div class="empty">Empty</div>'}</div></div>`;
    }).join('')}</div>
    <div class="why"><b>Para el manager, con estos datos</b><ul>
      ${longRtg.length ? `<li>${longRtg.map((t) => `${t.truck} (${t.days} d)`).join(', ')}: Ready To Go y siguen en la yard. ¿Por qué no han salido?</li>` : ''}
      ${longHeavy.length ? `<li>${longHeavy.map((t) => `${t.truck} (${t.days} d)`).join(', ')}: Heavy Work No ETA hace 20 días o más. ¿Qué esperan?</li>` : ''}
      <li>¿Este tablero está al día? ¿Quién cambia el estado y cuándo? ¿"Checked In" es cuando llega con las llaves?</li></ul></div>
    <p class="sub muted" style="margin-top:10px;font-size:12px">Fuente: shares de Ninox "off duty" y "on the road" (aprobados por la empresa). Consulta ${esc(NINOX.offDuty.fetchedAt)} UTC · ${T.length} camiones. Lo que Ninox no publica en un link (último PM, quién trabaja qué, listas de Bay Work) no está aquí. Las demás pestañas son la versión resumida con camiones de ejemplo.</p>`;
}
const DECIDED_ITEMS = [
  ['Detailers', 'Tablet del equipo. No ponen su nombre; marcan qué camión empezaron y cuándo terminaron. Varios a la vez; cualquiera termina.', 'Dueño · 26-oct', true],
  ['PM o Fuel filter', 'Menos de 30,000 mi → Fuel filter. 30,000–40,000 → aviso, decide el manager. 40,000+ → PM.', 'Dueño · 26-oct', true],
  ['Mecánico de PM', 'Su pantalla se queda igual.', 'Dueño · 26-oct', true],
  ['Pizarra', 'Una tarjeta por trabajo, una columna por especialidad.', 'Prompt del PM + dueño', true],
  ['"Work Order"', 'Recomendado: se queda, con "tipo de visita".', 'Falta tu OK (P45)', false],
  ['QC no requerido', '¿Lo decide solo el manager?', 'Safety y Carlos (P46)', false],
  ['Tomar = empezar', '¿El tiempo corre al tomar o al empezar?', 'Manager (P47)', false],
  ['Plantillas', 'Qué lleva un camión de fin de contrato y uno de paso.', 'Manager y Carlos', false],
  ['Liberar', '¿Cerrar y Return to Service juntos o aparte?', 'Manager (P56)', false],
];
function renderDecided() {
  $('#s-decided').innerHTML = `
    <div class="app-head"><h1>Decided and open</h1></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:16px"><div class="card card-pad"><h2 class="section-title">Decidido</h2>${DECIDED_ITEMS.filter((x) => x[3]).map(([t, x, s]) => `<div class="row"><span class="badge b-ok">✓</span><b>${esc(t)}</b><span class="grow sub" style="min-width:0">${esc(x)}</span><span class="sub muted">${esc(s)}</span></div>`).join('')}</div>
    <div class="card card-pad"><h2 class="section-title">Falta decidir</h2>${DECIDED_ITEMS.filter((x) => !x[3]).map(([t, x, s]) => `<div class="row"><span class="badge b-warn">?</span><b>${esc(t)}</b><span class="grow sub" style="min-width:0">${esc(x)}</span><span class="sub muted">${esc(s)}</span></div>`).join('')}</div></div>`;
}
