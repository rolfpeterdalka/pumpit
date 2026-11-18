// Inputs of the water hammer (docs/water-hammer.md; §8, §9.1 and §11.6 of its specification): the control of the run
// (solution.surge), the data of a pipe (pipe.surge, src/core/surge/wavespeed.js) and the time data of a junction
// (j.surge), their checklist, and the time data ready for the steps.
//
//   solution.surge = { on, duration, dtMode: 'auto' | 'given', dt, varianceMax (%), ncMin, ncMax,
//                      cavitation: 'dvcm' | 'dgcm' | 'none', psi, cavBasis: 'stagnation' | 'static', alpha0, p0,
//                      friction: 'steady' | 'variable' | 'brunone', artificial: { criterion (%), minFlow, stop },
//                      saveEvery, stations: 'ends' | 'all', forces: [force set] }
//   force set (src/core/surge/forces.js) = { name, kind: 'segment' | 'point' | 'exit', a: { pipe, x }, b: { pipe, x },
//                      ambient: 'atm' | 'given', pamb, As }
//   j.surge = { use, what, basis, start, when, combined, tables, repeat, interp, resume, at }
//
// j.surge has the structure of j.time (src/core/time/inputs.js) and is independent of it (decision W-14): a junction may
// hold hours of data for the time simulation and seconds for the water hammer. Its tables, triggers and conditions are
// those of PumpIt.time.tables and PumpIt.time.events. A pump trip (what: 'trip') or start (what: 'start', decision W-50)
// has no table: it happens at the time `at` (start 'time') or at an event (start 'single' or 'combined').
//
// The water hammer is off by default, and a model saved before it calculates as before: the module only runs when the
// user turns it on (decision W-01).
(function (root) {
  const PumpIt = root.PumpIt;
  const M = PumpIt.model, U = PumpIt.units;
  const types = PumpIt.junctionTypes;
  const q = M.q;
  const E = () => PumpIt.time.events;
  const TB = () => PumpIt.time.tables;

  const DT_MODES = ['auto', 'given'];
  // the cavities of vapour, of gas (phase G3, decision G3-10) or none; the friction of the steady state, one that varies
  // with the Reynolds number of each station (phase G2, §2.7), or that one with the unsteady term of Brunone (phase G3,
  // decisions G3-08 and G3-09)
  const CAVITATION = ['dvcm', 'dgcm', 'none'];
  const CAV_BASES = ['stagnation', 'static'];
  const FRICTION = ['steady', 'variable', 'brunone'];
  const FORCE_KINDS = ['segment', 'point', 'exit'];
  const AMBIENTS = ['atm', 'given'];
  const STATIONS = ['ends', 'all'];
  const PIPE_STATIONS = ['default', 'ends', 'all'];
  const BASES = ['absolute', 'relative'];
  const INTERP = ['linear', 'step'];
  const RESUMES = ['start', 'current'];
  const TRIP_STARTS = ['time', 'single', 'combined'];
  const MAX_SIZE = 2e9; // stations × steps above which a run is refused (§11.6, item 10)

  function newControl() {
    return {
      on: false, duration: q(20, 's'), dtMode: 'auto', dt: q(0.01, 's'), varianceMax: 10, ncMin: 1, ncMax: 20,
      cavitation: 'dvcm', psi: 0.5, cavBasis: 'stagnation', alpha0: 1e-7, p0: q(101.325, 'kPa(a)'), friction: 'steady',
      artificial: { criterion: 0.5, minFlow: q(0, 'm³/h'), stop: true }, saveEvery: 1, stations: 'ends', forces: [],
    };
  }
  // a new force set: a segment along a pipe from its up end to its down end (L, its length), with the atmospheric
  // pressure outside
  const newForce = (pipe, name, L) => ({ name, kind: 'segment', a: { pipe, x: q(0, L ? L.unit : 'm') }, b: { pipe, x: L ? q(L.value, L.unit) : q(0, 'm') }, ambient: 'atm', pamb: q(101.325, 'kPa(a)'), As: q(null, 'cm²') });
  const isQty = (v) => !!(v && typeof v === 'object' && 'value' in v && 'unit' in v);
  const isObj = (v) => !!(v && typeof v === 'object' && !Array.isArray(v));
  // the control of a model with the defaults of the fields it lacks (it is never written back by a read)
  function controlOf(eff) {
    const d = newControl(), o = eff && eff.solution && isObj(eff.solution.surge) ? eff.solution.surge : {};
    const c = Object.assign(d, o);
    c.artificial = Object.assign(newControl().artificial, isObj(o.artificial) ? o.artificial : {});
    return c;
  }
  const isOn = (eff) => !!(eff && eff.solution && isObj(eff.solution.surge) && eff.solution.surge.on === true);

  // the control of a loaded model: missing or invalid fields back to their defaults, the water hammer off unless the file
  // has it on (as normalizeTime does for the time simulation). A model without the control stays without it, so that a
  // model that never used the module carries nothing of it: controlOf reads its defaults, off (decision of docs/water-hammer.md)
  function normalize(m) {
    if (!m || !m.solution || m.solution.surge === undefined) return m;
    const d = newControl(), o = isObj(m.solution.surge) ? m.solution.surge : {};
    const c = Object.assign({}, d, o);
    c.on = o.on === true;
    for (const k of ['duration', 'dt', 'p0']) if (!isQty(c[k])) c[k] = d[k];
    for (const k of ['varianceMax', 'ncMin', 'ncMax', 'psi', 'saveEvery', 'alpha0']) if (typeof c[k] !== 'number') c[k] = d[k];
    if (!Array.isArray(c.forces)) c.forces = [];
    c.forces = c.forces.filter(isObj);
    if (!DT_MODES.includes(c.dtMode)) c.dtMode = d.dtMode;
    if (!CAVITATION.includes(c.cavitation)) c.cavitation = d.cavitation;
    if (!CAV_BASES.includes(c.cavBasis)) c.cavBasis = d.cavBasis;
    if (!FRICTION.includes(c.friction)) c.friction = d.friction;
    if (!STATIONS.includes(c.stations)) c.stations = d.stations;
    const a = isObj(o.artificial) ? o.artificial : {};
    c.artificial = Object.assign({}, d.artificial, a);
    if (typeof c.artificial.criterion !== 'number') c.artificial.criterion = d.artificial.criterion;
    if (!isQty(c.artificial.minFlow)) c.artificial.minFlow = d.artificial.minFlow;
    c.artificial.stop = a.stop !== false;
    m.solution.surge = c;
    return m;
  }

  // ---------- the quantities a table of the water hammer can drive in a junction (§8.2): those of its surge hook, or of
  // its time hook
  function quantities(j) {
    const def = types.get(j.type);
    if (!def) return [];
    if (def.surge && def.surge.quantities) return def.surge.quantities(j) || [];
    return (def.time && def.time.quantities && def.time.quantities(j, { gas: false, adiabatic: false })) || [];
  }
  const quantityOf = (j) => quantities(j).find((x) => x.what === (j.surge && j.surge.what)) || null;
  // the time data of the water hammer that count: present and in use, of a junction that takes some
  const active = (j) => !!(j && isObj(j.surge) && j.surge.use && types.get(j.type) && quantities(j).length);
  // the special condition of a junction that closes or stops it (as in the time simulation)
  const specialOf = (j) => { const tm = types.get(j.type).time; return (tm && tm.special && tm.special(j)) || ''; };

  function siOf(eff) {
    const sys = eff.system, ctx = {};
    try { ctx.patm = U.toSI(sys.patm.value, sys.patm.unit, 'pressure'); ctx.rho = PumpIt.fluids.evaluate(sys).rho; } catch (e) { /* incomplete system: its own checklist */ }
    return (x, cat) => U.toSI(x.value, x.unit, cat, ctx);
  }
  const timeOk = (x) => isQty(x) && Number.isFinite(x.value) && U.has('time', x.unit);
  const sec = (x) => U.toSI(x.value, x.unit, 'time');

  // what is missing in the time data of the water hammer of a junction, as keys under surge.checklist (an empty list:
  // complete). The conditions of the events are those of the time simulation (their texts too)
  function checkData(j, eff) {
    const d = j.surge, out = [];
    const qt = quantityOf(j);
    if (!qt) return ['data.what'];
    const when = Array.isArray(d.when) ? d.when : [];
    const conds = (n) => {
      if (when.length < n) out.push('data.conditions');
      for (let i = 0; i < n && i < when.length; i++) for (const k of E().check(when[i], eff)) out.push('condition.' + k);
    };
    if (qt.noTable) {
      // a trip or a start: by the clock at a time, or at an event
      if (!TRIP_STARTS.includes(d.start)) { out.push('data.tripStart'); return out; }
      if (d.start === 'time' && !(timeOk(d.at) && sec(d.at) >= 0)) out.push('data.tripAt');
      if (d.start === 'single') conds(1);
      if (d.start === 'combined' && !E().namedOk(eff, d.combined)) out.push('data.combined');
      return [...new Set(out)];
    }
    if (!BASES.includes(d.basis)) out.push('data.basis');
    if (!E().STARTS.includes(d.start)) { out.push('data.start'); return out; }
    if (!INTERP.includes(d.interp)) out.push('data.interp');
    if (d.resume !== undefined && !RESUMES.includes(d.resume)) out.push('data.resume');
    const nE = E().EVENTS[d.start], nT = E().TABLES[d.start];
    conds(nE);
    if (d.start === 'combined' && !E().namedOk(eff, d.combined)) out.push('data.combined');
    const tables = Array.isArray(d.tables) ? d.tables : [];
    if (tables.length < nT) { out.push('data.tables'); return [...new Set(out)]; }
    let complete = true;
    for (let i = 0; i < nT; i++) {
      const tb = tables[i];
      const ok = tb && Array.isArray(tb.t) && Array.isArray(tb.v) && tb.t.length >= 1 && tb.t.length === tb.v.length
        && tb.t.every(Number.isFinite) && tb.v.every(Number.isFinite) && U.has('time', tb.tUnit);
      if (!ok) { out.push('data.table'); complete = false; continue; }
      if (d.basis === 'absolute' && !U.has(qt.cat, tb.vUnit)) out.push('data.table');
      if (!tb.t.every((x, k) => k === 0 || x >= tb.t[k - 1]) || tb.t[0] < 0) out.push('data.order');
      if (d.start !== 'time' && tb.t[0] !== 0) out.push('data.eventStart');
      if (d.repeat && tb.t.length > 1 && !(tb.t[tb.t.length - 1] > tb.t[0])) out.push('data.period');
      if (qt.noNegative && tb.v.some((x) => x < 0)) out.push('data.negative');
    }
    if (complete) for (const k of coherence(j, d, qt, tables.slice(0, nT), eff)) out.push(k);
    return [...new Set(out)];
  }
  // the rules of coherence of the time simulation that fit the water hammer
  function coherence(j, d, qt, tables, eff) {
    const out = [], rel = d.basis === 'relative';
    const same = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
    let steady = 0;
    try { steady = qt.steady(j, siOf(eff)); } catch (e) { /* incomplete: its own checklist */ }
    if (rel && !same(tables[0].v[0], 100)) out.push('data.relStart');
    if (d.repeat) for (const tb of tables) { const n = tb.v.length; if (n > 1 && !same(tb.v[0], tb.v[n - 1])) out.push('data.repeatEnds'); }
    const sp = specialOf(j);
    if (sp) {
      if (rel) out.push('data.relSpecial');
      else if (!(qt.closes && qt.closes(tables[0].v[0]))) out.push('data.specialStart');
    }
    if (qt.range) {
      const [lo, hi] = qt.range;
      if (tables.some((tb) => tb.v.some((x) => { const v = rel ? (x / 100) * steady : x; return v < lo - 1e-9 || v > hi + 1e-9; }))) out.push('data.range');
    }
    if (Number.isNaN(steady)) out.push('data.noSteady');
    return out;
  }

  // the time data of junction j ready for the steps: its quantity, its tables in SI, its conditions, and for a trip or a
  // start the time it happens (SI)
  function prepare(j, eff, si, ctx) {
    const d = j.surge;
    const qt = quantityOf(j);
    const out = { jid: j.id, def: types.get(j.type), q: qt, what: d.what, start: d.start };
    if (qt.noTable) {
      out.trip = true;
      out.at = d.start === 'time' ? si(d.at, 'time') : NaN;
      out.tables = [];
      out.conds = d.start === 'combined' ? [E().prepareNamed(eff, d.combined, ctx)] : d.start === 'single' ? [E().prepare(d.when[0], eff, ctx)] : [];
      out.o = {};
      return out;
    }
    const steady = qt.steady(j, si);
    const nT = E().TABLES[d.start], nE = E().EVENTS[d.start];
    const sp = specialOf(j);
    return Object.assign(out, {
      steady, inUse: sp && qt.stopped !== undefined ? qt.stopped : steady,
      resume: d.resume === 'current' && d.start !== 'time' ? 'current' : 'start',
      tables: d.tables.slice(0, nT).map((tb) => TB().prepare(tb, qt, { basis: d.basis, steady, ctx })),
      conds: d.start === 'combined' ? [E().prepareNamed(eff, d.combined, ctx)] : (d.when || []).slice(0, nE).map((c) => E().prepare(c, eff, ctx)),
      o: { repeat: !!d.repeat, interp: d.interp, dataEnd: 'hold' },
    });
  }

  // ---------- the checklist (§11.6): the control (an item of its own), and what each pipe and junction needs
  function checkControl(eff) {
    const c = controlOf(eff), out = [];
    if (M.isCompressible(eff)) out.push('control.gas');
    if (eff.solution && eff.solution.time && eff.solution.time.on) out.push('control.time');
    if (!(timeOk(c.duration) && sec(c.duration) > 0)) out.push('control.duration');
    if (!DT_MODES.includes(c.dtMode)) out.push('control.dtMode');
    else if (c.dtMode === 'given' && !(timeOk(c.dt) && sec(c.dt) > 0)) out.push('control.dt');
    if (c.dtMode === 'auto') {
      if (!(c.varianceMax > 0)) out.push('control.variance');
      if (!(c.ncMin > 0 && c.ncMax >= c.ncMin)) out.push('control.nc');
    }
    if (!CAVITATION.includes(c.cavitation)) out.push('control.cavitation');
    // vapour and gas cavities need the vapour pressure of the fluid; gas cavities their void fraction at a pressure above it
    else if (c.cavitation !== 'none') {
      let pv = NaN, patm = NaN;
      try { pv = PumpIt.fluids.evaluate(eff.system).pv; patm = U.toSI(eff.system.patm.value, eff.system.patm.unit, 'pressure'); } catch (e) { /* the system checks it */ }
      if (!Number.isFinite(pv)) out.push('control.vapor');
      if (c.cavitation === 'dgcm') {
        if (!(typeof c.alpha0 === 'number' && c.alpha0 > 0 && c.alpha0 < 1)) out.push('control.alpha0');
        const p0 = isQty(c.p0) && Number.isFinite(c.p0.value) && U.has('pressure', c.p0.unit) ? U.toSI(c.p0.value, c.p0.unit, 'pressure', { patm }) : NaN;
        if (!(p0 > 0) || (Number.isFinite(pv) && !(p0 > pv))) out.push('control.p0');
      }
    }
    if (!(c.psi >= 0.5 && c.psi <= 1)) out.push('control.psi');
    if (!CAV_BASES.includes(c.cavBasis)) out.push('control.cavBasis');
    if (!FRICTION.includes(c.friction)) out.push('control.friction');
    const a = c.artificial;
    if (!(a.criterion >= 0)) out.push('control.criterion');
    if (!(isQty(a.minFlow) && a.minFlow.value >= 0 && U.has('flow', a.minFlow.unit))) out.push('control.minFlow');
    if (!(Number.isInteger(c.saveEvery) && c.saveEvery >= 1)) out.push('control.saveEvery');
    if (!STATIONS.includes(c.stations)) out.push('control.stations');
    // the force sets (phase G3): their pipes in the transient, their stations and a path between them
    if (!Array.isArray(c.forces)) out.push('control.forces');
    else if (PumpIt.surge.forces && c.forces.some((f) => PumpIt.surge.forces.check(eff, f).length)) out.push('control.forces');
    // the size of the run, when the pipes are complete
    const size = PumpIt.surge.network.sizeOf(eff);
    if (size && size.stations * size.steps > MAX_SIZE) out.push('control.size');
    return out;
  }

  // the water hammer data of a pipe (§11.6, item 5): keys under surge.checklist.pipe
  function checkPipe(eff, p) {
    if (p.closed) return [];
    const d = PumpIt.surge.wavespeed.dataOf(p);
    const K = PumpIt.surge.wavespeed.fluidK(eff.system);
    const out = PumpIt.surge.wavespeed.inputs(p, K).miss.slice();
    const st = d.stations;
    if (!(PIPE_STATIONS.includes(st) || (Array.isArray(st) && st.length && st.every((i) => Number.isInteger(i) && i >= 0)))) out.push('stations');
    if (d.pMax !== null && d.pMax !== undefined && !(isQty(d.pMax) && Number.isFinite(d.pMax.value) && U.has('pressure', d.pMax.unit))) out.push('pMax');
    // the coefficient of Brunone, optional (phase G3): empty, it comes from the Reynolds number of the steady state
    if (d.k !== null && d.k !== undefined && !(typeof d.k === 'number' && d.k >= 0)) out.push('k');
    return out;
  }

  // the water hammer data of a junction: its time data, the fields of its type, and a fixed pressure above the vapour
  // pressure (§7.3, §11.6 items 7 to 9). Keys under surge.checklist
  function checkJunction(eff, j) {
    const def = types.get(j.type), out = [];
    if (!def) return out;
    if (active(j)) for (const k of checkData(j, eff)) out.push(k);
    if (def.surge && def.surge.validate) {
      const miss = [];
      const fin = (x) => x && Number.isFinite(x.value), pos = (x) => fin(x) && x.value > 0;
      const curveOk = (c, min = 1) => c && Array.isArray(c.x) && c.x.length >= min && c.x.every(Number.isFinite) && c.y.every(Number.isFinite);
      // an absolute pressure of a field (a gauge one with the ambient pressure), and the temperature of the fluid (K)
      const sys = eff.system, cx = {};
      let fluidT = NaN;
      try { const fl = PumpIt.fluids.evaluate(sys); fluidT = fl.T; cx.rho = fl.rho; cx.patm = U.toSI(sys.patm.value, sys.patm.unit, 'pressure'); } catch (e) { /* the system checks it */ }
      const abs = (x) => U.toSI(x.value, x.unit, 'pressure', cx);
      def.surge.validate(j, miss, { fin, pos, curveOk, abs, fluidT, patm: cx.patm, pipeCount: M.pipesAt(eff, j.id).length, data: active(j) ? j.surge : null, quantity: active(j) ? quantityOf(j) : null });
      for (const k of miss) out.push(k);
    }
    // a fixed pressure of the network under the vapour pressure (with the vapour pressure of the fluid)
    if (def.multi && def.ref) {
      try {
        const sys = eff.system, fl = PumpIt.fluids.evaluate(sys);
        const patm = U.toSI(sys.patm.value, sys.patm.unit, 'pressure');
        const si = (x, cat) => U.toSI(x.value, x.unit, cat, { rho: fl.rho, patm });
        const nodes = [];
        const b = { eff, si, rho: fl.rho, g: U.G0 * sys.gravity, errors: [], warnings: [], pp: new Map(), kTerm: () => 0, env: { rho: fl.rho, patm },
          addNode: (o) => { nodes.push(Object.assign({ kind: 'free', value: 0 }, o)); return nodes[nodes.length - 1]; }, addLink: (lk) => lk };
        def.buildNode(j, b, si(j.elevation, 'length'));
        if (nodes.some((n) => n.kind !== 'free' && n.role !== 'ext' && Number.isFinite(fl.pv) && n.value < fl.pv)) out.push('belowVapor');
      } catch (e) { /* incomplete: its own checklist */ }
    }
    return [...new Set(out)];
  }

  // the value of a table of a junction in its phase at the time t, as the time simulation reads it
  const tableOf = (jt, s) => (s.phase >= 1 ? jt.tables[s.phase - 1] || null : null);
  const tauOf = (jt, s, t) => (jt.start === 'time' ? t : t - s.te);

  PumpIt.surge = Object.assign(PumpIt.surge || {}, {
    inputs: {
      DT_MODES, CAVITATION, CAV_BASES, FRICTION, FORCE_KINDS, AMBIENTS, STATIONS, PIPE_STATIONS, BASES, INTERP, RESUMES, TRIP_STARTS, MAX_SIZE,
      newControl, newForce, controlOf, isOn, normalize, quantities, quantityOf, active, checkData, prepare, checkControl, checkPipe, checkJunction, tableOf, tauOf,
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
