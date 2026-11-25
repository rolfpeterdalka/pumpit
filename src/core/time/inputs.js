// Inputs of the time simulation (docs/time-simulation.md, §4 and §8.2 of its specification): the checklist of the time
// data of a junction, their preparation in SI, and the model of a step, a copy of the effective model of the scenario
// with the values of the tables at the time t, the levels of the finite tanks and the pipes the tanks closed.
//
//   j.time = { use, what, basis: 'absolute' | 'relative', start: 'time' | 'single' | 'dualCyclic' | 'dualSequential' |
//              'combined', when: [condition], combined: name of an event of the model, tables: [{ t: [], v: [], tUnit,
//              vUnit, v2: [], v2Unit }], repeat, interp: 'linear' | 'step', resume: 'start' | 'current' }
//
// v2 is the second column of a table, where the quantity takes one (the temperature of the gas of a boundary, item 3 of
// D.10). resume says where a table started by an event begins: at its first point ('start', the default) or where it
// takes the value the junction has at the event ('current', item 5 of D.10).
(function (root) {
  const PumpIt = root.PumpIt;
  const M = PumpIt.model, U = PumpIt.units;
  const types = PumpIt.junctionTypes;
  const q = M.q;
  const E = () => PumpIt.time.events;
  const TB = () => PumpIt.time.tables;

  const BASES = ['absolute', 'relative'];
  const INTERP = ['linear', 'step'];
  const RESUMES = ['start', 'current'];

  // time data that count: present, in use, and of a type that takes them
  const active = (j) => !!(j && j.time && typeof j.time === 'object' && j.time.use && types.get(j.type) && types.get(j.type).time);

  // the regime of a model as the quantities of a junction see it: a gas, and its thermal model
  const regimeOf = (eff) => ({ gas: M.isCompressible(eff), adiabatic: M.isCompressible(eff) && eff.system.gasMode === 'adiabatic' });
  // the quantity of the time data of j in its current mode and in the regime of the model eff (null: it does not take it)
  function quantityOf(j, eff) {
    const tm = types.get(j.type).time;
    return ((tm.quantities && tm.quantities(j, regimeOf(eff))) || []).find((x) => x.what === j.time.what) || null;
  }
  // the special condition of a junction that closes or stops it (the special condition of its type, or ''): its table
  // must start there (rules 5, 6 and 9 of D.3)
  const specialOf = (j) => { const tm = types.get(j.type).time; return (tm && tm.special && tm.special(j)) || ''; };
  // a function that gives the SI value of a quantity of the model eff, as the steady values need it
  function siOf(eff) {
    const sys = eff.system;
    const ctx = {};
    try {
      ctx.patm = U.toSI(sys.patm.value, sys.patm.unit, 'pressure');
      if (M.isCompressible(eff)) ctx.rhoN = PumpIt.fluids.normalDensity(PumpIt.fluids.evaluateGas(sys).MW);
      else ctx.rho = PumpIt.fluids.evaluate(sys).rho;
    } catch (e) { /* incomplete system: its own checklist */ }
    return (x, cat) => U.toSI(x.value, x.unit, cat, ctx);
  }

  // the absolute temperature (K) of the gas a boundary supplies, which a relative second column is a percentage of (1 K
  // when it is not known yet: the sign of the percentage decides)
  function sourceT(j, qt, eff) {
    let T = NaN;
    try { T = qt.second.steady(j, siOf(eff), { T: PumpIt.fluids.evaluateGas(eff.system).T }); } catch (e) { /* incomplete: its own checklist */ }
    return T > 0 ? T : 1;
  }

  // what is missing in the time data of a junction, as keys under core.checklist.time (an empty list: complete)
  function check(j, eff) {
    const d = j.time, out = [];
    const qt = quantityOf(j, eff);
    if (!qt) out.push('data.what');
    if (!BASES.includes(d.basis)) out.push('data.basis');
    if (!E().STARTS.includes(d.start)) { out.push('data.start'); return out; }
    if (!INTERP.includes(d.interp)) out.push('data.interp');
    if (d.resume !== undefined && !RESUMES.includes(d.resume)) out.push('data.resume');
    const nE = E().EVENTS[d.start], nT = E().TABLES[d.start];
    const when = Array.isArray(d.when) ? d.when : [];
    if (when.length < nE) out.push('data.conditions');
    for (let i = 0; i < nE && i < when.length; i++) for (const k of E().check(when[i], eff)) out.push('condition.' + k);
    // a combined event: one of the events of the model, complete (§5.4)
    if (d.start === 'combined' && !E().namedOk(eff, d.combined)) out.push('data.combined');
    // a flow of a gas: a mass or a normal volume, in the junction as in its tables (a volume at the conditions of the pipe
    // changes with them, so a table cannot hold it)
    const gasFlow = qt && qt.cat === 'flow' && M.isCompressible(eff);
    if (gasFlow) {
      let vol = false;
      try { qt.steady(j, (x) => { if (x && U.isVolumetric(x.unit)) vol = true; return 0; }); } catch (e) { /* incomplete: its own checklist */ }
      if (vol) out.push('data.gasVolume');
    }
    const tables = Array.isArray(d.tables) ? d.tables : [];
    if (tables.length < nT) { out.push('data.tables'); return [...new Set(out)]; }
    let complete = true;
    for (let i = 0; i < nT; i++) {
      const tb = tables[i];
      const ok = tb && Array.isArray(tb.t) && Array.isArray(tb.v) && tb.t.length >= 1 && tb.t.length === tb.v.length
        && tb.t.every(Number.isFinite) && tb.v.every(Number.isFinite) && U.has('time', tb.tUnit);
      if (!ok) { out.push('data.table'); complete = false; continue; }
      if (qt && d.basis === 'absolute' && !U.has(qt.cat, tb.vUnit)) out.push('data.table');
      else if (gasFlow && d.basis === 'absolute' && U.isVolumetric(tb.vUnit)) out.push('data.gasVolume');
      // the second column (item 3 of D.10): empty, or a value for each time, in the unit of its quantity
      if (qt && qt.second && Array.isArray(tb.v2) && tb.v2.length) {
        if (!(tb.v2.length === tb.t.length && tb.v2.every(Number.isFinite) && (d.basis === 'relative' || U.has(qt.second.cat, tb.v2Unit)))) out.push('data.table');
        else if (d.basis === 'absolute' && qt.second.cat === 'temperature' && !tb.v2.every((x) => U.toSI(x, tb.v2Unit, 'temperature') > 0)) out.push('data.temperature');
        // a relative column: % of the absolute temperature of the source (that of the junction, or of the gas)
        else if (d.basis === 'relative' && qt.second.cat === 'temperature' && !tb.v2.every((x) => (x / 100) * sourceT(j, qt, eff) > 0)) out.push('data.temperature');
      }
      if (!tb.t.every((x, k) => k === 0 || x >= tb.t[k - 1])) out.push('data.order');
      if (tb.t[0] < 0) out.push('data.order');
      // a table started by an event counts its time from the event
      if (d.start !== 'time' && tb.t[0] !== 0) out.push('data.eventStart');
      if (d.repeat && tb.t.length > 1 && !(tb.t[tb.t.length - 1] > tb.t[0])) out.push('data.period');
      if (qt && qt.noNegative && tb.v.some((x) => x < 0)) out.push('data.negative');
    }
    if (qt && complete) for (const k of coherence(j, d, qt, tables.slice(0, nT), eff)) out.push(k);
    return [...new Set(out)];
  }

  // the rules of coherence of the reference before a run (D.3 of the specification, item 8 of D.10), where Pump It has
  // the matching feature (decision T-36). Rule 1, a first point away from the steady value, stays a caution (§4.5)
  function coherence(j, d, qt, tables, eff) {
    const out = [];
    const rel = d.basis === 'relative';
    const same = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
    let steady = 0;
    try { steady = qt.steady(j, siOf(eff)); } catch (e) { /* incomplete: its own checklist */ }
    // 2: a relative table starts at 100 % (the steady value), in each of its columns; the first table, which follows
    // the steady state (a second table takes over from the first one)
    const t1 = tables[0];
    if (rel && (!same(t1.v[0], 100) || (qt.second && TB().hasSecond(t1) && !same(t1.v2[0], 100)))) out.push('data.relStart');
    // 4: a repeated table ends with the values it starts with, in each of its columns
    if (d.repeat) {
      for (const tb of tables) {
        const n = tb.v.length;
        if (n > 1 && (!same(tb.v[0], tb.v[n - 1]) || (qt.second && TB().hasSecond(tb) && !same(tb.v2[0], tb.v2[n - 1])))) out.push('data.repeatEnds');
      }
    }
    // 5, 6 and 9: a junction its special condition closes or stops. A pump takes only the special conditions that fit what
    // its table drives (a speed or a pressure ratio: stopped with free passage; a flow: stopped without flow; a set
    // pressure: none); a relative table has nothing to be relative to; the first table starts closed or stopped
    const sp = specialOf(j);
    if (sp) {
      if (qt.specials && !qt.specials.includes(sp)) out.push('data.pumpSpecial');
      else if (rel) out.push('data.relSpecial');
      else if (!(qt.closes && qt.closes(t1.v[0]))) out.push('data.specialStart');
    }
    // 7: an opening between 0 and 100 %
    if (qt.range) {
      const [lo, hi] = qt.range;
      const outside = tables.some((tb) => tb.v.some((x) => { const v = rel ? (x / 100) * steady : x; return v < lo - 1e-9 || v > hi + 1e-9; }));
      if (outside) out.push('data.range');
    }
    // 8: a quantity with a steady value (a relative table needs it, and the first point is checked against it)
    if (Number.isNaN(steady)) out.push('data.noSteady');
    return out;
  }

  // the time data of junction j ready for the steps: its quantity, the tables in SI, the conditions and how the tables
  // end. steady: the steady value of the quantity in SI (base of the relative tables and of the first point check);
  // inUse: the value the junction uses at the start, its special condition included (a closed valve, a stopped pump: the
  // value that closes or stops it), from which a table may start (resume 'current')
  function prepare(j, eff, si, ctx, tc) {
    const d = j.time;
    const qt = quantityOf(j, eff);
    const steady = qt.steady(j, si);
    const steady2 = qt.second ? qt.second.steady(j, si, ctx) : NaN;
    const nT = E().TABLES[d.start], nE = E().EVENTS[d.start];
    const sp = specialOf(j);
    return {
      jid: j.id, def: types.get(j.type), q: qt, steady, start: d.start, what: d.what,
      inUse: sp && qt.stopped !== undefined ? qt.stopped : steady,
      resume: d.resume === 'current' && d.start !== 'time' ? 'current' : 'start',
      tables: d.tables.slice(0, nT).map((tb) => TB().prepare(tb, qt, { basis: d.basis, steady, steady2, ctx })),
      conds: d.start === 'combined' ? [E().prepareNamed(eff, d.combined, ctx)] : (d.when || []).slice(0, nE).map((c) => E().prepare(c, eff, ctx)),
      o: { repeat: !!d.repeat, interp: d.interp, dataEnd: tc.dataEnd },
    };
  }

  // the table that applies to a junction in its phase (null: none, the model as it is)
  const tableOf = (jt, s) => (s.phase >= 1 ? jt.tables[s.phase - 1] || null : null);
  // the time on the axis of a table: the clock for a table by time, the time since its event otherwise
  const tauOf = (jt, s, t) => (jt.start === 'time' ? t : t - s.te);

  // the model of step k at the time t (§8.2). plan: the prepared simulation; view: { trig (phase of each junction with
  // time data, by id), closed (pipes closed by the tanks), press (the gas pressure of each closed tank, NaN for an open
  // one), vessels (the pressure and the temperature of each finite gas vessel) }; levels: the level of each finite tank
  // used in the solution (over its bottom). sink (optional): { value(jt, v, past) } learns what each table gave. Step 0
  // is the model of the scenario as it is, special conditions included (§4.4); the tables apply from step 1. In step 0 a
  // tank or a vessel whose state is unknown is a free node, without pressure and without flow of its own, at the
  // elevation of its lowest connection (§6.6, item 2 of D.10).
  function stepModel(plan, view, k, t, levels, sink) {
    const m = JSON.parse(plan.json);
    const byId = new Map(m.junctions.map((j) => [j.id, j]));
    if (k > 0) {
      for (const jt of plan.jts) {
        const s = view.trig.get(jt.jid);
        const tb = tableOf(jt, s);
        if (!tb) continue;
        const r = TB().valueAt(tb, tauOf(jt, s, t), jt.o);
        const jc = byId.get(jt.jid);
        jt.q.apply(jc, r.v);
        // the second column, when the table has one
        if (r.v2 !== undefined && jt.q.second) jt.q.second.apply(jc, r.v2);
        if (sink) sink.value(jt, r.v, r.past);
      }
    }
    // finite tanks: the level of the solution, and their pipes connected at the elevations fixed at the start
    plan.tanks.forEach((T, i) => {
      const j = byId.get(T.jid);
      if (k === 0 && T.free) { freeNode(j, T.zref); return; }
      j.liquidElev = q(T.zb + levels[i], 'm');
      if (view.press && Number.isFinite(view.press[i])) j.surfP = q(view.press[i], 'Pa(a)');
      j.connBy = 'elevation';
      const pk = {};
      for (const c of T.conns) {
        const was = (j.pipeK && j.pipeK[c.pid]) || {};
        pk[c.pid] = { kOut: was.kOut || 0, kIn: was.kIn || 0, elev: q(c.z, 'm') };
      }
      j.pipeK = pk;
    });
    // finite gas vessels: the pressure and the temperature of their gas
    (plan.vessels || []).forEach((Vs, i) => {
      const j = byId.get(Vs.jid), v = view.vessels && view.vessels[i];
      if (k === 0 && Vs.free) { freeNode(j, Vs.zref); return; }
      if (!v) return;
      j.surfP = q(v.P, 'Pa(a)');
      j.gasT = q(v.T, 'K');
    });
    if (view.closed.size) for (const p of m.pipes) if (view.closed.has(p.id)) p.closed = true;
    // in the time simulation a control valve that cannot control takes its default action (§7.3)
    for (const j of m.junctions) if (j.alwaysControl) j.alwaysControl = false;
    return m;
  }
  // a reservoir as a free node of the first step: a branch without a flow of its own at the elevation z (m)
  function freeNode(j, z) {
    Object.assign(j, { type: 'branch', source: q(0, 'kg/s'), elevation: q(z, 'm') });
    for (const f of ['tank', 'vessel', 'pipeK', 'connBy', 'liquidElev', 'time', 'gasT']) delete j[f];
  }

  PumpIt.time = Object.assign(PumpIt.time || {}, { inputs: { BASES, INTERP, RESUMES, active, regimeOf, quantityOf, specialOf, check, prepare, tableOf, tauOf, stepModel } });
})(typeof window !== 'undefined' ? window : globalThis);
