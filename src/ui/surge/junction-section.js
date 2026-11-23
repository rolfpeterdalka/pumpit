// The water hammer of a junction in the inspector, with the water hammer on (§8 and §11.4 of its specification): the
// fields of its type (the surge hook of its view: the inertia of a pump, the mode of a control valve) and its time data
// of the water hammer, j.surge, kept apart from those of the time simulation (decision W-14): in use or kept aside, the
// quantity a table drives (or the trip or the start of a pump), absolute or relative values, how the tables start (by the
// clock or after events, with the editor of conditions of the time simulation), the tables of time × value in seconds,
// whether they repeat and how they go between points. Every change writes the data whole (one undo step).
(function (root) {
  const PumpIt = root.PumpIt;
  const UI = PumpIt.ui, I = UI.inspector, M = PumpIt.model, U = PumpIt.units;
  const app = PumpIt.app;
  const F = UI.format;
  const { el } = UI.dom;
  const { t } = PumpIt.i18n;
  const tx = (key, params) => t('surge.junction.' + key, params);
  const SI = () => PumpIt.surge.inputs;
  const E = () => PumpIt.time.events;

  // the unit a table starts with, by the category of its values
  const unitFor = (cat, basis) => (basis === 'relative' ? '%' : (UI.timeData.DEFAULT_UNIT[cat] ?? U.list(cat)[0]));
  const valueCat = (qt, basis) => (basis === 'relative' || qt.cat === 'percent' ? '%' : qt.cat);
  function steadyIn(j, qt, unit) {
    const sys = app.eff().system, ctx = {};
    try { ctx.patm = U.toSI(sys.patm.value, sys.patm.unit, 'pressure'); ctx.rho = PumpIt.fluids.evaluate(sys).rho; } catch (e) { /* incomplete */ }
    try {
      const v = qt.steady(j, (x, cat) => U.toSI(x.value, x.unit, cat, ctx));
      if (unit === '%' && qt.cat !== 'percent') return 100;
      return +U.fromSI(v, unit === '%' ? '%' : unit, qt.cat === 'none' ? 'none' : qt.cat, ctx).toPrecision(6);
    } catch (e) { return NaN; }
  }
  // new data: the trip of a pump at 0 s, or a table of the first quantity, its steady value held for a second
  function newData(j, qt) {
    if (qt.noTable) return { use: true, what: qt.what, start: 'time', when: [], at: { value: 0, unit: 's' } };
    const unit = unitFor(qt.cat, 'absolute');
    const v = steadyIn(j, qt, unit);
    const x = Number.isFinite(v) ? v : 0;
    return { use: true, what: qt.what, basis: 'absolute', start: 'time', when: [], tables: [{ t: [0, 1], v: [x, x], tUnit: 's', vUnit: unit }], repeat: false, interp: 'linear' };
  }
  const newCondition = () => ({ q: 'time', op: '>=', value: { value: 1, unit: 's' } });

  I.addSection('junction', (host, id) => {
    if (!app.surgeOn || !app.surgeOn()) return;
    const key = 'j:' + id;
    const j = app.effObj(key);
    const view = j && UI.junctionTypes.get(j.type);
    if (!j) return;
    const qs = SI().quantities(j);
    if (!view.surge && !qs.length) return;
    const s = UI.forms.section(tx('title'), { info: tx('hint') });
    host.appendChild(s);
    // the fields of the type
    if (view.surge) view.surge(s, { key, j, f: UI.forms, curveEditor: UI.curveEditor.build });
    if (!qs.length) return;
    const d = j.surge && typeof j.surge === 'object' ? j.surge : null;
    if (!d) {
      const row = el('div', { class: 'btn-row' });
      for (const qt of qs) {
        const b = el('button', { class: 'btn small', type: 'button' }, F.esc(tx('add.' + (qt.noTable ? qt.what : 'table'), { what: tx('whats.' + qt.what) })));
        b.addEventListener('click', () => app.setVal(key, 'surge', newData(j, qt)));
        row.appendChild(b);
      }
      s.appendChild(row);
      return;
    }
    const write = (fn) => { const next = M.clone(d); fn(next); app.setVal(key, 'surge', next); };
    const field = (label, ctl, opts) => UI.forms.wrap(key, 'surge', label, ctl, opts);
    const select = (id2, options, value, onChange) => {
      const sel = el('select', { id: `sd-${id}-${id2}` }, options.map(([v, l]) => F.option(v, l, String(v) === String(value))).join(''));
      sel.addEventListener('change', () => onChange(sel.value));
      return sel;
    };
    s.appendChild(UI.forms.chk(key, 'surge.use', tx('use')));
    const qt = qs.find((x) => x.what === d.what) || null;
    // the quantity: a change starts the data again for it
    s.appendChild(field(tx('what'), select('what', (qt ? [] : [[d.what, '—']]).concat(qs.map((x) => [x.what, tx('whats.' + x.what)])), d.what, (v) => {
      const nq = qs.find((x) => x.what === v);
      if (nq) app.setVal(key, 'surge', Object.assign(newData(j, nq), { use: d.use }));
    })));
    if (!qt) { s.appendChild(UI.forms.hint(F.esc(tx('whatGone')))); return; }
    const conditions = (n) => {
      for (let e = 0; e < n; e++) s.appendChild(UI.timeData.conditionBlock(`sd-${id}-e${e}`, n > 1 ? tx('event', { n: e + 1 }) : tx('eventOne'), (d.when || [])[e] || newCondition(), (c) => write((x) => { x.when = x.when || []; x.when[e] = c; })));
    };
    const combined = () => {
      const names = (app.eff().events || []).map((x) => x.name).filter((x) => typeof x === 'string' && x);
      if (!names.length) s.appendChild(UI.forms.hint(F.esc(tx('combinedNone'))));
      else s.appendChild(field(tx('combined'), select('combined', (names.includes(d.combined) ? [] : [['', '—']]).concat(names.map((x) => [x, x])), d.combined || '', (v) => write((x) => { x.combined = v; }))));
    };
    if (qt.noTable) {
      // the trip or the start of a pump: by the clock, or at an event
      const K = qt.what === 'start' ? { when: 'startWhen', hint: 'startPumpHint', at: 'startAt' } : { when: 'tripStart', hint: 'tripHint', at: 'tripAt' };
      s.appendChild(field(tx(K.when), select('start', SI().TRIP_STARTS.map((x) => [x, tx('tripStarts.' + x)]), d.start, (v) => write((x) => {
        x.start = v;
        x.when = x.when || [];
        if (v === 'single' && !x.when.length) x.when.push(newCondition());
        if (v === 'time' && !x.at) x.at = { value: 0, unit: 's' };
      })), { info: tx(K.hint) }));
      if (d.start === 'time') s.appendChild(UI.forms.qty(key, 'surge.at', tx(K.at), 'time'));
      if (d.start === 'single') conditions(1);
      if (d.start === 'combined') combined();
    } else {
      // absolute or relative values: the numbers of every table follow in one edit, by the steady value the water hammer
      // reads (the same conversion as the time data); without it the tables and the basis stay, and a message tells why
      s.appendChild(field(tx('basis'), select('basis', SI().BASES.map((b) => [b, t('time.data.bases.' + b)]), d.basis, (v) => {
        const tables = UI.timeData.rebase(j, qt, d.tables || [], v);
        if (!tables) { app.toast(t('time.data.basisNoSteady')); app.renderAll(); return; }
        write((x) => { x.tables = tables; x.basis = v; });
      }), { info: t('time.data.basisHint') }));
      s.appendChild(field(tx('start'), select('start', E().STARTS.map((x) => [x, t('time.data.starts.' + x)]), d.start, (v) => write((x) => {
        x.start = v;
        x.when = x.when || [];
        while (x.when.length < E().EVENTS[v]) x.when.push(newCondition());
        while (x.tables.length < E().TABLES[v]) x.tables.push(M.clone(x.tables[x.tables.length - 1]));
        if (v !== 'time') for (const tb of x.tables) if (tb.t.length && tb.t[0] !== 0) { const t0 = tb.t[0]; tb.t = tb.t.map((y) => y - t0); }
      })), { info: tx('startHint') }));
      if (d.start !== 'time') s.appendChild(field(t('time.data.resume'), select('resume', SI().RESUMES.map((x) => [x, t('time.data.resumes.' + x)]), d.resume || 'start', (v) => write((x) => { x.resume = v; })), { info: t('time.data.resumeHint') }));
      const nE = E().EVENTS[d.start] || 0, nT = E().TABLES[d.start] || 1;
      if (nE) conditions(nE);
      if (d.start === 'combined') combined();
      for (let i = 0; i < nT && i < (d.tables || []).length; i++) {
        const tb = d.tables[i];
        const box = el('div', { class: 'td-block' });
        box.appendChild(el('div', { class: 'td-title' }, F.esc(nT > 1 ? t('time.data.tableOf', { n: i + 1 }) : t('time.data.table'))));
        const rel = d.basis === 'relative';
        box.appendChild(UI.pointTable.build({
          id: `sd-${id}-t${i}`,
          x: { label: t('time.data.time'), cat: 'time', unit: tb.tUnit },
          y: { label: tx('whats.' + d.what), cat: valueCat(qt, d.basis) === '%' ? '%' : qt.cat, unit: tb.vUnit },
          xs: tb.t, ys: tb.v, steps: d.interp === 'step',
          onChange: (x) => write((n) => { n.tables[i] = { t: x.xs, v: x.ys, tUnit: x.xUnit, vUnit: rel || qt.cat === 'percent' ? '%' : x.yUnit }; }),
        }));
        s.appendChild(box);
      }
      s.appendChild(UI.forms.chk(key, 'surge.repeat', t('time.data.repeat')));
      s.appendChild(UI.forms.sel(key, 'surge.interp', t('time.data.interp'), SI().INTERP.map((x) => [x, t('time.data.interps.' + x)])));
    }
    const rm = el('button', { class: 'btn small', type: 'button' }, F.esc(tx('remove')));
    rm.addEventListener('click', () => app.setVal(key, 'surge', null));
    const row = el('div', { class: 'btn-row' });
    row.appendChild(rm);
    s.appendChild(row);
  });

  UI.surgeData = { newData, newCondition };
})(window);
