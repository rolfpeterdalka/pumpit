// The charts of the water hammer (§10.3 of its specification), in tabs of their own in the charts view while it is on.
// Over time: series of the output stations of the pipes, of the junctions and of the force sets (phase G3), chosen by
// object and quantity, one panel for each unit category, with the time of the cursor marked on every series. Envelopes: along a path of pipes between
// two junctions (the same path as the profile of the steady state), the largest and smallest grade lines (or static
// pressures) of every station, that of the steady state, that at the time of the cursor (through the output stations),
// the elevation of the pipes and the line of the vapour pressure. The grade lines take the absolute pressure, as those of
// the steady state, so the vapour line runs just above the pipes.
(function (root) {
  const PumpIt = root.PumpIt;
  const U = PumpIt.units, UI = PumpIt.ui;
  const F = UI.format;
  const { lineChart } = UI.lineChart;
  const app = PumpIt.app;
  const { t } = PumpIt.i18n;
  const tx = (key, params) => t('surge.charts.' + key, params);

  const COLORS = ['var(--accent)', 'var(--sel)', '#c0612b', 'var(--ok)', 'var(--m3-press)', 'var(--warn)', 'var(--crit)', 'var(--caution)'];
  // the quantities of an output station of a pipe, with their unit category; the vapour volume once the pipe has had one
  // (the volume of the free gas of the gas cavities)
  const STATION_Q = [['p', 'pressure'], ['P0', 'pressure'], ['HGL', 'head'], ['m', 'massFlow'], ['Q', 'volFlow'], ['V', 'volume']];
  // the most points of a series on the screen: beyond them, the largest and the smallest of each stretch (the peaks stay)
  const MAX_POINTS = 4000;

  const ctxOf = (run) => ({ rho: run.env.rho, patm: run.env.patm });
  const time = (x) => UI.surgeFormat.time(x);

  // ------------------------------------------------------------ over time
  // the objects of the run: every output station of a pipe, the junctions, then the force sets
  function objects(run) {
    const out = [];
    for (const id of Object.keys(run.pipes)) {
      const p = run.pipes[id];
      for (const i of p.stations) out.push({ v: `p:${id}:${i}`, kind: 'pipe', id: Number(id), i, label: tx('station', { pipe: 'P' + id, i, n: p.n }) });
    }
    for (const id of Object.keys(run.junctions)) out.push({ v: 'j:' + id, kind: 'junction', id: Number(id), label: UI.surgeResults.objName('j:' + id) });
    (run.forces || []).forEach((f, k) => out.push({ v: 'f:' + k, kind: 'force', id: k, label: tx('force', { name: f.name }) }));
    return out;
  }
  const objectOf = (run, v) => objects(run).find((o) => o.v === v) || null;

  // the quantities an object can draw, with their unit category (null: a percentage, or no unit)
  function quantities(run, o) {
    if (o.kind === 'force') return [{ k: 'F', c: 'force', label: tx('q.F') }];
    if (o.kind === 'pipe') {
      const p = run.pipes[o.id], gas = !!(run.cavitation && run.cavitation.gas);
      return STATION_Q.filter(([k]) => k !== 'V' || p.series.V).map(([k, c]) => ({ k, c, label: tx('q.' + (k === 'V' && gas ? 'Vg' : k)) }));
    }
    const FC = UI.surgeResults.FIELD_CAT;
    return run.junctions[o.id].fields.map((f) => ({ k: f, c: FC[f] && FC[f] !== 'percent' ? FC[f] : null, pct: FC[f] === 'percent', label: t('surge.results.fields.' + f) }));
  }

  // the values of a series at every recorded time, in SI
  function values(run, o, k) {
    const n = run.times.length, out = new Array(n);
    if (o.kind === 'force') {
      const s = run.forces[o.id].series;
      for (let r = 0; r < n; r++) out[r] = s[r];
      return out;
    }
    if (o.kind === 'junction') {
      const s = run.junctions[o.id].series[k];
      for (let r = 0; r < n; r++) out[r] = s[r];
      return out;
    }
    const p = run.pipes[o.id], s = p.stations.indexOf(o.i);
    const rho = run.env.rho, g = run.env.g, k2 = 1 / (2 * rho * p.A * p.A), z = p.zUp + (p.zDown - p.zUp) * o.i / p.n;
    const P = p.series.P[s], mU = p.series.mU[s], mD = p.series.mD[s], V = p.series.V && p.series.V[s];
    for (let r = 0; r < n; r++) {
      const m = (mU[r] + mD[r]) / 2, ps = P[r] - m * m * k2;
      out[r] = k === 'P0' ? P[r] : k === 'p' ? ps : k === 'HGL' ? ps / (rho * g) + z : k === 'm' ? m : k === 'Q' ? m / rho : k === 'V' && V ? V[r] : NaN;
    }
    return out;
  }

  // the points of a series for the screen: all of them, or the largest and the smallest of each of MAX_POINTS / 2
  // stretches, in the order of time
  function thin(xs, ys) {
    const n = xs.length;
    if (n <= MAX_POINTS) return xs.map((x, i) => [x, ys[i]]);
    const out = [], parts = MAX_POINTS / 2;
    for (let b = 0; b < parts; b++) {
      const i0 = Math.floor((b * n) / parts), i1 = Math.floor(((b + 1) * n) / parts);
      let lo = -1, hi = -1;
      for (let i = i0; i < i1; i++) {
        if (!Number.isFinite(ys[i])) continue;
        if (lo < 0 || ys[i] < ys[lo]) lo = i;
        if (hi < 0 || ys[i] > ys[hi]) hi = i;
      }
      if (lo < 0) continue;
      for (const i of lo === hi ? [lo] : lo < hi ? [lo, hi] : [hi, lo]) out.push([xs[i], ys[i]]);
    }
    return out;
  }

  const seriesKey = (s) => { const at = s.lastIndexOf('|'); return [s.slice(0, at), s.slice(at + 1)]; };
  function seriesName(run, s) {
    const [v, k] = seriesKey(s);
    const o = objectOf(run, v);
    const q = o && quantities(run, o).find((x) => x.k === k);
    return `${o ? o.label : v} · ${q ? q.label : k}`;
  }

  function renderTime(box, ctl, notes) {
    const run = app.surgeRun();
    notes.textContent = '';
    if (!run) { ctl.innerHTML = ''; box.innerHTML = `<div class="empty">${F.esc(tx('noRun'))}</div>`; return; }
    const pf = app.prefs.surgeChart || {};
    const objs = objects(run);
    const chosen = (pf.series || []).filter((s) => { const [v, k] = seriesKey(s); const o = objs.find((x) => x.v === v); return o && quantities(run, o).some((q) => q.k === k); });
    const obj = objs.find((o) => o.v === pf.obj) || objs[0];
    const qs = obj ? quantities(run, obj) : [];
    const pipes = objs.filter((o) => o.kind === 'pipe'), js = objs.filter((o) => o.kind === 'junction'), fs = objs.filter((o) => o.kind === 'force');
    const group = (label, list) => (list.length ? `<optgroup label="${F.esc(label)}">${list.map((o) => F.option(o.v, o.label, o === obj)).join('')}</optgroup>` : '');
    const chips = chosen.map((s, i) => `<span class="tc-chip"><i style="background:${COLORS[i % COLORS.length]}"></i>${F.esc(seriesName(run, s))}<button type="button" class="row-btn" data-scdel="${F.esc(s)}" aria-label="${F.esc(tx('remove'))}">×</button></span>`).join('');
    ctl.innerHTML = `<label>${F.esc(tx('object'))}<select id="sch-obj">${group(tx('stations'), pipes)}${group(tx('junctions'), js)}${group(tx('forces'), fs)}</select></label>
      <label>${F.esc(tx('quantity'))}<select id="sch-q">${qs.map((q) => F.option(q.k, q.label, false)).join('')}</select></label>
      <button type="button" class="btn small" id="sch-add">${F.esc(tx('add'))}</button>
      <div class="tc-chips">${chips}</div>`;
    if (!chosen.length) { box.innerHTML = `<div class="empty">${F.esc(tx('choose'))}</div>`; return; }
    const xs = Array.from(run.times);
    const ic = app.surgeCursor();
    const cx = ctxOf(run);
    // one panel per unit category
    const byCat = new Map();
    chosen.forEach((s, i) => {
      const [v, k] = seriesKey(s);
      const o = objs.find((x) => x.v === v), q = quantities(run, o).find((x) => x.k === k);
      const cat = q.c || (q.pct ? '%' : 'none');
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat).push({ s, i, o, q });
    });
    let html = '';
    for (const [cat, list] of byCat) {
      const real = cat !== 'none' && cat !== '%';
      const u = real ? app.outUnit('stchart.' + cat, cat) : cat === '%' ? '%' : '';
      const conv = (v) => (real ? F.conv(v, cat, u, cx) : v);
      const series = list.map(({ s, i, o, q }) => {
        const ys = values(run, o, q.k).map(conv);
        return { name: seriesName(run, s), color: COLORS[i % COLORS.length], pts: thin(xs, ys), at: [xs[ic], ys[ic]] };
      });
      const unitSel = real ? `<select class="unit-sel" data-t="stchart" data-c="${cat}" data-cat="${cat}" aria-label="${F.esc(tx('unit'))}">${U.list(cat).map((x) => F.option(x, F.unit(x), x === u)).join('')}</select>` : '';
      const one = list.length === 1;
      html += `<div class="tc-panel"><div class="tc-panel-head">${unitSel}</div>${lineChart({
        title: list.map((x) => x.q.label).join(', '), xLabel: tx('timeAxis'), yLabel: one ? `${list[0].q.label}${u ? ' (' + F.unit(u) + ')' : ''}` : (u ? F.unit(u) : ''),
        series: series.map((x) => ({ name: x.name, pts: x.pts, color: x.color, width: 1.8 })),
        points: series.map((x) => ({ x: x.at[0], y: x.at[1], color: x.color })),
      })}</div>`;
    }
    box.innerHTML = html;
    notes.textContent = tx('cursorNote', { t: time(run.times[ic]) });
  }

  // ------------------------------------------------------------ the envelopes along a path
  function renderProfile(box, ctl, notes) {
    const eff = app.eff();
    const js = eff.junctions;
    notes.textContent = '';
    if (js.length < 2) { ctl.innerHTML = ''; box.innerHTML = `<div class="empty">${F.esc(t('charts.profile.needsTwo'))}</div>`; return; }
    const pf = app.prefs.surgeProfile || {};
    const a = js.some((j) => j.id === pf.a) ? pf.a : js[0].id;
    const b = js.some((j) => j.id === pf.b) ? pf.b : js[js.length - 1].id;
    const isHead = (pf.what || 'heads') === 'heads';
    const cat = isHead ? 'head' : 'pressure';
    const u = app.outUnit('surge.profile.' + cat, cat);
    const opt = (sel) => js.map((j) => `<option value="${j.id}"${j.id === sel ? ' selected' : ''}>J${j.id} ${F.esc(j.name)}</option>`).join('');
    ctl.innerHTML = `<label>${F.esc(t('charts.profile.from'))}<select id="spf-a">${opt(a)}</select></label><label>${F.esc(t('charts.profile.to'))}<select id="spf-b">${opt(b)}</select></label>
      <label>${F.esc(t('charts.profile.quantity'))}<select id="spf-what"><option value="heads"${isHead ? ' selected' : ''}>${F.esc(t('charts.profile.heads'))}</option><option value="pressure"${!isHead ? ' selected' : ''}>${F.esc(tx('pressures'))}</option></select></label>
      <label>${F.esc(t('charts.profile.unit'))}<select class="unit-sel" data-t="surge.profile" data-c="${cat}" data-cat="${cat}">${U.list(cat).map((x) => F.option(x, F.unit(x), x === u)).join('')}</select></label>`;
    const run = app.surgeRun();
    if (!run) { box.innerHTML = `<div class="empty">${F.esc(tx('noRun'))}</div>`; return; }
    const path = UI.profileChart.findPath(eff, a, b);
    if (!path || !path.length) { box.innerHTML = `<div class="empty">${F.esc(t('charts.profile.noPath'))}</div>`; return; }
    const off = path.find(({ pipe }) => !run.pipes[pipe.id]);
    if (off) { box.innerHTML = `<div class="empty">${F.esc(tx('pathOff', { pipe: 'P' + off.pipe.id }))}</div>`; return; }
    const cx = ctxOf(run), rho = run.env.rho, g = run.env.g, pv = run.env.pv;
    const lu = app.outUnit('profile.x', 'length');
    // a static pressure at a station as the chosen quantity, in the chosen unit
    const cv = (p, z) => U.fromSI(isHead ? p / (rho * g) + z : p, u, cat, cx);
    const ic = app.surgeCursor();
    const ser = { max: [], min: [], steady: [], now: [], z: [], vap: [] };
    const vapor = [];
    let s0 = 0;
    for (const { pipe, fwd } of path) {
      const p = run.pipes[pipe.id], X = run.extremes.pipes[pipe.id];
      const k2 = 1 / (2 * rho * p.A * p.A), m0 = p.steady.m;
      let reached = false;
      for (let j = 0; j <= p.n; j++) {
        const i = fwd ? j : p.n - j;
        const x = U.fromSI(s0 + p.L * j / p.n, lu, 'length');
        const z = p.zUp + (p.zDown - p.zUp) * i / p.n;
        ser.max.push([x, cv(X.pmax[i], z)]);
        ser.min.push([x, cv(X.pmin[i], z)]);
        ser.steady.push([x, cv(p.steady.P[i] - m0 * m0 * k2, z)]);
        const s = p.stations.indexOf(i);
        if (s >= 0) {
          const m = (p.series.mU[s][ic] + p.series.mD[s][ic]) / 2;
          ser.now.push([x, cv(p.series.P[s][ic] - m * m * k2, z)]);
        }
        if (isHead) ser.z.push([x, U.fromSI(z, u, 'head', cx)]);
        if (Number.isFinite(pv)) ser.vap.push([x, cv(pv, z)]);
        if (Number.isFinite(pv) && X.pmin[i] <= pv * (1 + 1e-9)) reached = true;
      }
      if (reached) vapor.push('P' + pipe.id);
      s0 += p.L;
    }
    const series = [
      { name: tx(isHead ? 'hglMax' : 'pMax'), pts: ser.max, color: 'var(--crit)', width: 2 },
      { name: tx(isHead ? 'hglMin' : 'pMin'), pts: ser.min, color: 'var(--accent)', width: 2 },
      { name: tx('steady'), pts: ser.steady, color: 'var(--ink-3)', dash: '6 4', width: 1.6 },
      { name: tx('atCursor', { t: time(run.times[ic]) }), pts: ser.now, color: '#c0612b', width: 1.6, marker: ser.now.length <= 60 },
    ];
    if (isHead) series.push({ name: t('charts.profile.pipeElevation'), pts: ser.z, color: 'var(--ink)', width: 1.4 });
    if (ser.vap.length) series.push({ name: t('charts.profile.vapor'), pts: ser.vap, color: 'var(--warn)', dash: '2 4', width: 1.4 });
    box.innerHTML = lineChart({ title: tx('envelopes'), xLabel: t('charts.profile.xLabel', { u: F.unit(lu) }), yLabel: t(isHead ? 'charts.profile.yHead' : 'charts.profile.yPressure', { u: F.unit(u) }), series });
    notes.textContent = tx('profileNotes', { path: path.map(({ pipe }) => 'P' + pipe.id).join(' → '), length: F.fmt(U.fromSI(s0, lu, 'length'), 5), u: F.unit(lu) }) + (vapor.length ? ' ' + tx('vaporReached', { pipes: vapor.join(', ') }) : '');
  }

  function bind() {
    const pf = () => (app.prefs.surgeChart = app.prefs.surgeChart || { series: [] });
    document.addEventListener('change', (e) => {
      const id = e.target.id;
      if (id === 'sch-obj') { pf().obj = e.target.value; app.savePrefs(); app.renderView(); }
      if (id === 'spf-a' || id === 'spf-b' || id === 'spf-what') {
        const v = (x) => document.getElementById(x).value;
        app.prefs.surgeProfile = { a: Number(v('spf-a')), b: Number(v('spf-b')), what: v('spf-what') };
        app.savePrefs(); app.renderView();
      }
    });
    document.addEventListener('click', (e) => {
      if (e.target.id === 'sch-add') {
        const o = document.getElementById('sch-obj'), q = document.getElementById('sch-q');
        if (!o || !q || !q.value) return;
        const s = o.value + '|' + q.value, p = pf();
        p.series = (p.series || []).filter((x) => x !== s).concat([s]);
        app.savePrefs(); app.renderView();
      }
      const del = e.target.closest('[data-scdel]');
      if (del) { const p = pf(); p.series = (p.series || []).filter((x) => x !== del.dataset.scdel); app.savePrefs(); app.renderView(); }
    });
  }

  const visible = () => !!(app.surgeOn && app.surgeOn());
  UI.charts.register('surgeTime', { render: renderTime, visible, label: 'surge.charts.tabs.time', bind });
  UI.charts.register('surgeProfile', { render: renderProfile, visible, label: 'surge.charts.tabs.profile' });

  UI.surgeCharts = { objects, quantities, values, thin };
})(window);
