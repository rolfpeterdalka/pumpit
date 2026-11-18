// The results of the water hammer in the results view (§10 of its specification): the summary of the run (its step, its
// sections, the test step from the steady state, the cavities) with the extremes of the junctions (and the reference of
// the four-quadrant data of a pump) and the unbalanced forces of phase G3; the envelopes, the
// largest and smallest pressures of every pipe with where and when, and of every station of a pipe; the event log; and
// the warnings of the run beside those of the steady state, which stays the instant zero of the other tables. Tables are
// copied as text and the series, the envelopes and the log go to the Excel file.
(function (root) {
  const PumpIt = root.PumpIt;
  const UI = PumpIt.ui, M = PumpIt.model;
  const app = PumpIt.app;
  const F = UI.format;
  const C = UI.resultColumns;
  const { t } = PumpIt.i18n;
  const tx = (key, params) => t('surge.results.' + key, params);

  const TABS = ['surge', 'surgeEnv', 'surgeLog'];
  // the unit categories of the series of the junctions (the protection devices add theirs: the level of a tank, the gas of
  // a vessel, the relief of a valve, the air of an air valve)
  const FIELD_CAT = {
    P: 'pressure', P1: 'pressure', P2: 'pressure', net: 'massFlow', m: 'massFlow', s: 'percent', dH: 'head', T: 'torque', V: 'volume',
    level: 'length', mt: 'massFlow', Pg: 'pressure', Vg: 'volume', mr: 'massFlow', x: 'percent', Va: 'volume', ma: 'mass', mair: 'massFlow',
    // the dynamic check valves of phase G3: the angle of a swinging disc and the torque on it, the travel of a sliding disc
    // and the force on it
    th: 'angle', Td: 'torque', xd: 'length', Fd: 'force',
  };

  const ctxOf = (run) => ({ rho: run.env.rho, patm: run.env.patm });
  const unitOf = (k, cat) => app.outUnit('surge.' + k, cat);
  const head = (label, k, cat) => `${F.esc(label)}${cat && cat !== 'percent' ? C.unitSelect('surge', { k, c: cat }, label) : cat === 'percent' ? ' %' : ''}`;
  const val = (v, cat, k, cx) => (Number.isFinite(v) ? F.fmt(cat ? F.conv(v, cat, unitOf(k, cat), cx) : v, 5) : '—');
  const time = (x) => UI.surgeFormat.time(x);
  function objName(key) {
    if (!key) return '—';
    const o = M.getObj(app.eff(), key);
    return (key[0] === 'p' ? 'P' : 'J') + key.slice(2) + (o && o.name ? ' ' + o.name : '');
  }
  const card = (title, body, hint, buttons = '') => `<div class="card"><div class="card-head"><h3>${F.esc(title)}</h3>${hint ? `<span class="muted small">${F.esc(hint)}</span>` : ''}${buttons ? `<div class="btn-row">${buttons}</div>` : ''}</div>${body}</div>`;
  const table = (id, th, rows) => `<div class="table-scroll"><table class="grid" id="${id}"><thead><tr>${th}</tr></thead><tbody>${rows}</tbody></table></div>`;
  const copyBtn = (id) => `<button class="btn small" data-scopy="${id}" type="button">${F.esc(t('results.copyTable'))}</button>`;

  // ------------------------------------------------------------ the summary of the run
  function summaryCard(run) {
    const r = run || app.surgeResult();
    if (!r) return '';
    if (!r.ok) return card(tx('summary'), `<ul class="warn-list">${r.errors.map((e) => `<li><span class="lvl critical">${F.esc(t('results.error'))}</span><span>${F.esc(e)}</span></li>`).join('')}</ul>`);
    const a = r.artificial;
    const cav = r.cavitation;
    const kv = [
      [tx('dt'), `${time(r.dt)}${Number.isFinite(r.sectioning.nc) ? ` · N_c ${F.fixed(r.sectioning.nc, 2)}` : ''}`],
      [tx('steps'), `${r.N} · ${tx('recorded', { n: r.times.length })}`],
      [tx('duration'), time(r.duration)],
      [tx('elapsed'), Number.isFinite(r.elapsedApp ?? r.elapsed) ? `${F.fmt((r.elapsedApp ?? r.elapsed) / 1000, 3)} s` : '—'],
      [tx('test'), a.ok ? tx('testOk', { p: F.fmt(100 * a.worstP, 2), m: F.fmt(100 * a.worstM, 2) }) : tx('testFailed', { criterion: a.criterion })],
      [tx('cavitation'), cav.gas ? tx('gasModel') : !cav.model ? tx('noModel') : cav.ever ? tx('cavitated', { n: Object.keys(cav.pipes).length + Object.keys(cav.junctions).length, t: time(Math.min(...Object.values(cav.pipes).concat(Object.values(cav.junctions)))) }) : tx('noCavity')],
    ];
    if (r.stopped) kv.push([tx('stoppedAt'), `${time(r.stopped.t)}${r.stopped.errors.length ? ' · ' + r.stopped.errors.join(' ') : ''}`]);
    return card(tx('summary'), `<div class="kv">${kv.map(([k, v]) => `<div><span class="eyebrow">${F.esc(k)}</span><b>${F.esc(v)}</b></div>`).join('')}</div>`, tx('summaryHint'));
  }

  // the sectioning of the run (§4.4)
  function sectioningCard(run) {
    const sec = run.sectioning;
    const th = ['pipe', 'L', 'a', 'n', 'aAdj', 'variance', 'R'].map((k, i) => `<th class="${i ? '' : 'txt'}">${F.esc(t('surge.system.cols.' + k))}</th>`).join('');
    const rows = Object.values(run.pipes).map((p) => `<tr data-key="p:${p.id}"><td class="txt">P${p.id}${p.id === sec.controller ? ` <span class="muted small">${F.esc(t('surge.system.controller'))}</span>` : ''}</td><td class="num">${F.fmt(p.L, 5)}</td><td class="num">${F.fmt(p.a, 5)}</td><td class="num">${p.n}</td><td class="num">${F.fmt(p.aAdj, 5)}</td><td class="num">${F.fixed(100 * p.variance, 3)}</td><td class="num">${F.fmt(p.R, 4)}</td></tr>`).join('');
    return card(tx('sectioning'), table('su-sec', th, rows), tx('sectioningHint'), copyBtn('su-sec'));
  }

  // the extremes of the junctions: each of their series, largest and smallest with the time
  function junctionsCard(run) {
    const cx = ctxOf(run);
    const X = run.extremes.junctions;
    const rows = [];
    for (const id of Object.keys(run.junctions)) {
      const o = run.junctions[id];
      for (const f of o.fields) {
        const e = X[id] && X[id][f];
        if (!e) continue;
        const cat = FIELD_CAT[f] || null, k = 'jx.' + f;
        rows.push(`<tr data-key="j:${id}"><td class="txt">${F.esc(objName('j:' + id))}</td><td class="txt">${F.esc(tx('fields.' + f))}${cat === 'percent' ? ' (%)' : cat ? ` (${F.esc(F.unit(unitOf(k, cat)))})` : ''}</td><td class="num">${val(e.max, cat === 'percent' ? null : cat, k, cx)}</td><td class="num">${time(e.tmax)}</td><td class="num">${val(e.min, cat === 'percent' ? null : cat, k, cx)}</td><td class="num">${time(e.tmin)}</td></tr>`);
      }
      // the reference point of the four-quadrant data of a pump, and the scales of its table at the steady state
      const fq = o.info && o.info.fourQuad;
      if (fq) {
        const vals = [
          ['QR', `${F.fmt(fq.QR * 1000, 6)} L/s`], ['HR', `${F.fmt(fq.HR, 6)} m`], ['TR', `${F.fmt(fq.TR, 6)} N·m`],
          ['NR', `${F.fmt(fq.NR * 60 / (2 * Math.PI), 6)} rpm`], ['cH', F.fmt(fq.cH, 6)], ['cB', F.fmt(fq.cB, 6)],
        ];
        for (const [k, v] of vals) rows.push(`<tr data-key="j:${id}"><td class="txt">${F.esc(objName('j:' + id))}</td><td class="txt">${F.esc(tx('four.' + k, { ref: tx('four.refs.' + fq.ref) }))}</td><td class="num">${F.esc(v)}</td><td class="num">—</td><td class="num">—</td><td class="num">—</td></tr>`);
      }
      // the volumes a tank overflowed and missed over the run
      for (const k of ['over', 'deficit']) {
        const v = o.totals && o.totals[k];
        if (!(v > 0)) continue;
        const kk = 'jx.' + k;
        rows.push(`<tr data-key="j:${id}"><td class="txt">${F.esc(objName('j:' + id))}</td><td class="txt">${F.esc(tx('totals.' + k))} (${F.esc(F.unit(unitOf(kk, 'volume')))})</td><td class="num">${val(v, 'volume', kk, cx)}</td><td class="num">—</td><td class="num">—</td><td class="num">—</td></tr>`);
      }
    }
    if (!rows.length) return '';
    const th = ['junction', 'quantity', 'max', 'tmax', 'min', 'tmin'].map((k, i) => `<th class="${i < 2 ? 'txt' : ''}">${F.esc(tx('cols.' + k))}</th>`).join('');
    return card(tx('junctions'), table('su-jx', th, rows.join('')), tx('junctionsHint'), copyBtn('su-jx'));
  }

  // the unbalanced forces of the force sets (phase G3): where each set is, its value in the steady state, its largest and
  // smallest values with the first time, and its swing from peak to peak
  function forcesCard(run) {
    const list = run.forces || [];
    if (!list.length) return '';
    const cx = ctxOf(run), c = 'force', k = 'F';
    const where = (w) => (w ? `P${w.pipe} · ${w.i} (${F.fmt(w.x, 5)} m)` : '—');
    const th = `<th class="txt">${F.esc(tx('cols.force'))}</th><th class="txt">${F.esc(tx('cols.kind'))}</th><th class="txt">${F.esc(tx('cols.from'))}</th><th class="txt">${F.esc(tx('cols.to'))}</th><th>${head(tx('cols.steady'), k, c)}</th><th>${head(tx('cols.max'), k, c)}</th><th>${F.esc(tx('cols.tmax'))}</th><th>${head(tx('cols.min'), k, c)}</th><th>${F.esc(tx('cols.tmin'))}</th><th>${head(tx('cols.p2p'), k, c)}</th>`;
    // a steady force that is zero but for the rounding of its terms (a horizontal path) shows as zero
    const clean = (f, x) => (Math.abs(x) < 1e-9 * Math.max(Math.abs(f.max), Math.abs(f.min), 1) ? 0 : x);
    const rows = list.map((f) => `<tr><td class="txt">${F.esc(f.name)}</td><td class="txt">${F.esc(t('surge.system.forceKinds.' + f.kind))}</td><td class="txt">${F.esc(where(f.a))}</td><td class="txt">${F.esc(where(f.b))}</td><td class="num">${val(clean(f, f.steady), c, k, cx)}</td><td class="num">${val(f.max, c, k, cx)}</td><td class="num">${time(f.tmax)}</td><td class="num">${val(f.min, c, k, cx)}</td><td class="num">${time(f.tmin)}</td><td class="num">${val(f.p2p, c, k, cx)}</td></tr>`).join('');
    return card(tx('forces'), table('su-forces', th, rows), tx('forcesHint'), copyBtn('su-forces'));
  }

  // ------------------------------------------------------------ the envelopes
  // the largest and smallest static pressure of a pipe, with its station and time
  function pipeExtremes(run, id) {
    const X = run.extremes.pipes[id], p = run.pipes[id];
    let iMax = 0, iMin = 0, iV = 0;
    for (let i = 0; i <= p.n; i++) {
      if (X.pmax[i] > X.pmax[iMax]) iMax = i;
      if (X.pmin[i] < X.pmin[iMin]) iMin = i;
      if (X.Vmax[i] > X.Vmax[iV]) iV = i;
    }
    return { iMax, iMin, iV, X, p };
  }
  function envelopeTab(run) {
    const cx = ctxOf(run);
    const ids = Object.keys(run.pipes).map(Number);
    // the largest volume of a cavity, or of the free gas with the gas cavities
    const vmax = run.cavitation && run.cavitation.gas ? 'vmaxGas' : 'vmax';
    const th = `<th class="txt">${F.esc(tx('cols.pipe'))}</th><th>${head(tx('cols.pmax'), 'p', 'pressure')}</th><th>${F.esc(tx('cols.station'))}</th><th>${F.esc(tx('cols.tmax'))}</th><th>${head(tx('cols.pmin'), 'p', 'pressure')}</th><th>${F.esc(tx('cols.station'))}</th><th>${F.esc(tx('cols.tmin'))}</th><th>${head(tx('cols.' + vmax), 'V', 'volume')}</th><th>${F.esc(tx('cols.tV'))}</th>`;
    const rows = ids.map((id) => {
      const e = pipeExtremes(run, id), X = e.X;
      const V = X.Vmax[e.iV] > 0;
      const vap = Number.isFinite(run.env.pv) && X.pmin[e.iMin] <= run.env.pv * (1 + 1e-9);
      return `<tr data-key="p:${id}" data-pipe="${id}"><td class="txt">${F.esc(objName('p:' + id))}</td><td class="num">${val(X.pmax[e.iMax], 'pressure', 'p', cx)}</td><td class="num">${e.iMax}</td><td class="num">${time(X.tpmax[e.iMax])}</td><td class="num${vap ? ' bad' : ''}">${val(X.pmin[e.iMin], 'pressure', 'p', cx)}</td><td class="num">${e.iMin}</td><td class="num">${time(X.tpmin[e.iMin])}</td><td class="num">${V ? val(X.Vmax[e.iV], 'volume', 'V', cx) : '—'}</td><td class="num">${V ? time(X.tVmax[e.iV]) : '—'}</td></tr>`;
    }).join('');
    let html = card(tx('envelopes'), table('su-env', th, rows), tx('envelopesHint'), copyBtn('su-env'));
    // the stations of one pipe
    const pick = ids.includes(app.prefs.surgePipe) ? app.prefs.surgePipe : ids[0];
    const p = run.pipes[pick], X = run.extremes.pipes[pick];
    const g = run.env.rho * run.env.g;
    const z = (i) => p.zUp + (p.zDown - p.zUp) * i / p.n;
    const sth = `<th>${F.esc(tx('cols.i'))}</th><th>${head(tx('cols.x'), 'x', 'length')}</th><th>${head(tx('cols.steady'), 'p', 'pressure')}</th><th>${head(tx('cols.pmax'), 'p', 'pressure')}</th><th>${F.esc(tx('cols.tmax'))}</th><th>${head(tx('cols.pmin'), 'p', 'pressure')}</th><th>${F.esc(tx('cols.tmin'))}</th><th>${head(tx('cols.hglMax'), 'H', 'length')}</th><th>${head(tx('cols.hglMin'), 'H', 'length')}</th><th>${head(tx('cols.' + vmax), 'V', 'volume')}</th>`;
    let srows = '';
    for (let i = 0; i <= p.n; i++) {
      const A = p.A, m0 = p.steady.m, ps0 = p.steady.P[i] - m0 * m0 / (2 * run.env.rho * A * A);
      srows += `<tr><td class="num">${i}</td><td class="num">${val(p.L * i / p.n, 'length', 'x', cx)}</td><td class="num">${val(ps0, 'pressure', 'p', cx)}</td><td class="num">${val(X.pmax[i], 'pressure', 'p', cx)}</td><td class="num">${time(X.tpmax[i])}</td><td class="num">${val(X.pmin[i], 'pressure', 'p', cx)}</td><td class="num">${time(X.tpmin[i])}</td><td class="num">${val(X.pmax[i] / g + z(i), 'length', 'H', cx)}</td><td class="num">${val(X.pmin[i] / g + z(i), 'length', 'H', cx)}</td><td class="num">${X.Vmax[i] > 0 ? val(X.Vmax[i], 'volume', 'V', cx) : '—'}</td></tr>`;
    }
    const opts = ids.map((id) => F.option(id, objName('p:' + id), id === pick)).join('');
    html += card(tx('stations'), table('su-st', sth, srows), '', `<label class="muted small" for="su-pipe">${F.esc(tx('pipe'))}</label> <select id="su-pipe">${opts}</select>${copyBtn('su-st')}`);
    return html;
  }

  // ------------------------------------------------------------ the event log
  function logTab(run) {
    if (!run.log.length) return card(tx('log'), `<div class="empty">${F.esc(tx('noEvents'))}</div>`);
    const th = `<th>${F.esc(tx('cols.time'))}</th><th class="txt">${F.esc(tx('cols.object'))}</th><th class="txt">${F.esc(tx('cols.message'))}</th>`;
    const rows = run.log.map((e) => `<tr${e.obj ? ` data-key="${e.obj}"` : ''}><td class="num">${time(e.t)}</td><td class="txt">${F.esc(objName(e.obj))}</td><td class="txt"><span class="lvl ${e.kind === 'warning' ? 'warning' : 'info'}">${F.esc(tx('kinds.' + e.kind))}</span> ${F.esc(PumpIt.surge.record.logText(e))}</td></tr>`).join('');
    return card(tx('log'), table('su-log', th, rows), tx('logHint'), copyBtn('su-log'));
  }

  // ------------------------------------------------------------ the warnings of the run (in the warnings tab)
  function warningsCard() {
    const r = app.surgeRun();
    if (!r) return '';
    if (!r.warnings.length) return card(tx('warnings'), `<div class="empty">${F.esc(tx('noWarnings'))}</div>`);
    const li = r.warnings.map((w) => `<li data-key="${w.obj || ''}"><span class="lvl ${w.level}">${C.level(w.level)}</span><span>${F.esc(w.text)}</span></li>`).join('');
    return card(tx('warnings'), `<ul class="warn-list">${li}</ul>`, tx('warningsHint'));
  }

  function render(tab, container) {
    const run = app.surgeRun();
    if (!run) { container.innerHTML = summaryCard(); return; }
    if (tab === 'surge') container.innerHTML = summaryCard(run) + sectioningCard(run) + junctionsCard(run) + forcesCard(run);
    else if (tab === 'surgeEnv') container.innerHTML = envelopeTab(run);
    else container.innerHTML = logTab(run);
  }

  // the text of a table of this view, for the clipboard (tab-separated)
  function tableText(id) {
    const tb = document.getElementById(id);
    if (!tb) return '';
    const cell = (c) => { const s = c.querySelector('select'); const txt = c.cloneNode(true); txt.querySelectorAll('select').forEach((x) => x.remove()); return (txt.textContent.trim() + (s ? ' (' + s.selectedOptions[0].textContent + ')' : '')).replace(/\s+/g, ' '); };
    return [...tb.rows].map((r) => [...r.cells].map(cell).join('\t')).join('\n');
  }

  function bind(view) {
    view.addEventListener('click', (e) => {
      const c = e.target.closest('[data-scopy]');
      if (c) { UI.dialogs.copyText(tableText(c.dataset.scopy), t('results.copied')); e.stopPropagation(); }
    }, true);
    view.addEventListener('change', (e) => {
      if (e.target.id === 'su-pipe') { app.prefs.surgePipe = Number(e.target.value); app.savePrefs(); app.renderView(); }
    });
  }

  // ------------------------------------------------------------ the sheets of the Excel file
  function sheets() {
    const run = app.surgeRun();
    if (!run) return [];
    const cx = ctxOf(run), n = run.times.length, out = [];
    const auto = UI.resultExport.autoFormat;
    const num = (v) => (Number.isFinite(v) ? v : '—');
    // the series: the time, then for each output station its pressure and its flow
    const uP = unitOf('p', 'pressure'), uM = unitOf('m', 'massFlow');
    const cols = [];
    for (const id of Object.keys(run.pipes)) {
      const p = run.pipes[id];
      p.stations.forEach((i, s) => {
        cols.push({ header: `P${id}/${i} ${tx('cols.P0')} (${F.unit(uP)})`, get: (k) => num(F.conv(p.series.P[s][k], 'pressure', uP, cx)) });
        cols.push({ header: `P${id}/${i} ${tx('cols.flow')} (${F.unit(uM)})`, get: (k) => num(F.conv((p.series.mU[s][k] + p.series.mD[s][k]) / 2, 'massFlow', uM, cx)) });
      });
    }
    for (const id of Object.keys(run.junctions)) {
      const o = run.junctions[id];
      for (const f of o.fields) {
        const cat = FIELD_CAT[f];
        const u = cat && cat !== 'percent' ? unitOf('jx.' + f, cat) : null;
        cols.push({ header: `J${id} ${tx('fields.' + f)}${u ? ` (${F.unit(u)})` : cat === 'percent' ? ' (%)' : ''}`, get: (k) => num(u ? F.conv(o.series[f][k], cat, u, cx) : o.series[f][k]) });
      }
    }
    // the force sets
    const uF = unitOf('F', 'force');
    for (const f of run.forces || []) cols.push({ header: `${f.name} (${F.unit(uF)})`, get: (k) => num(F.conv(f.series[k], 'force', uF, cx)) });
    const rows = [];
    for (let k = 0; k < n; k++) rows.push([run.times[k]].concat(cols.map((c) => c.get(k))));
    out.push({ name: tx('sheets.series'), columns: [{ header: tx('cols.timeS'), width: 12, format: '0.######' }].concat(cols.map((c, i) => ({ header: c.header, width: Math.min(40, Math.max(12, c.header.length + 2)), format: auto(rows.map((r) => r[i + 1])) }))), rows });
    // the envelopes of every station
    const erows = [];
    const g = run.env.rho * run.env.g;
    for (const id of Object.keys(run.pipes)) {
      const p = run.pipes[id], X = run.extremes.pipes[id];
      for (let i = 0; i <= p.n; i++) {
        const z = p.zUp + (p.zDown - p.zUp) * i / p.n;
        erows.push([`P${id}`, i, num(p.L * i / p.n), num(F.conv(X.pmax[i], 'pressure', uP, cx)), num(X.tpmax[i]), num(F.conv(X.pmin[i], 'pressure', uP, cx)), num(X.tpmin[i]), num(X.pmax[i] / g + z), num(X.pmin[i] / g + z), num(X.Vmax[i] * 1000)]);
      }
    }
    const eh = [[tx('cols.pipe'), 'text'], [tx('cols.i'), '0'], [tx('cols.xm'), '0.###'], [`${tx('cols.pmax')} (${F.unit(uP)})`, '0.000'], [tx('cols.tmaxS'), '0.######'], [`${tx('cols.pmin')} (${F.unit(uP)})`, '0.000'], [tx('cols.tminS'), '0.######'], [tx('cols.hglMaxM'), '0.000'], [tx('cols.hglMinM'), '0.000'], [tx('cols.vmaxL'), '0.000']];
    out.push({ name: tx('sheets.envelopes'), columns: eh.map(([h, f]) => ({ header: h, width: Math.max(12, h.length + 2), format: f })), rows: erows });
    if (run.log.length) out.push({ name: tx('sheets.log'), columns: [{ header: tx('cols.timeS'), width: 12, format: '0.######' }, { header: tx('cols.object'), width: 18, format: 'text' }, { header: tx('cols.message'), width: 60, format: 'text' }], rows: run.log.map((e) => [e.t, objName(e.obj), PumpIt.surge.record.logText(e)]) });
    return out;
  }

  UI.surgeResults = { TABS, FIELD_CAT, objName, render, bind, summaryCard, warningsCard, sheets, tableText };
})(window);
