// The water hammer (docs/water-hammer.md; its specification, "Golpe de aríete", version 1.0 of 5 November 2026): the
// elastic transient of a liquid network by the method of characteristics, with one time step for the whole network,
// from the steady state of the model. It is a module of its own: the steady state and the time simulation do not depend
// on it, and it only runs when the user turns it on (solution.surge.on; decision W-01).
//
//   PumpIt.surge.run(eff, opts) → SurgeRun                        at once (tests, Node)
//   PumpIt.surge.start(eff, opts) → { N, k, done, step(budgetMs), cancel(), result() }   in slices (the interface)
//   opts = { steady (the steady result of the model, its first guess), steps (a number of steps instead of the duration) }
//   SurgeRun = { ok, errors, warnings, dt, N, times, sectioning, pipes, junctions, extremes, log, artificial, stopped,
//                forces (phase G3: the unbalanced forces of the force sets of the control) }
//
// A run (§9): the network from the steady state (network.js); a test step without manoeuvres, which must give the steady
// state back (an artificial transient stops the run by default); then for k = 1..N, at t_k = k·Δt: the tables at t_k,
// the inner stations of every pipe, the boundaries of the junctions in the order of their numbers (each uses only the
// characteristics of the step before, so the order does not change the result), the new state, the extremes, the
// events (whose effect starts at the next step) and the record of every saveEvery-th step and of the last one.
// The same model gives the same results, bit for bit, in the browser and in Node: nothing depends on the clock of the
// machine (the budget of a slice only decides where it stops).
(function (root) {
  const PumpIt = root.PumpIt;
  const U = PumpIt.units;
  const { t } = PumpIt.i18n;
  const SG = PumpIt.surge;
  const TM = () => PumpIt.time;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  const MEMORY_LIMIT = 200e6; // bytes of recorded series above which a caution suggests recording less (§9.5)
  const MANY_SECTIONS = 500; // sections of one pipe above which the time step is suspicious (§4.4)

  // ---------- preparation (§9.2)
  function prepare(eff, opts = {}) {
    const B = SG.network.build(eff, opts);
    if (B.errors.length) return { errors: B.errors, warnings: B.warnings };
    const net = B.net, c = net.control;
    const dur = U.toSI(c.duration.value, c.duration.unit, 'time');
    const N = opts.steps > 0 ? Math.floor(opts.steps) : SG.network.stepsOf(dur, net.dt);
    const ctx = { rho: net.env.rho, patm: net.env.patm };
    const byJ = new Map(net.boundaries.map((x) => [x.jid, x]));
    const jts = [];
    for (const j of net.eff.junctions) {
      if (!SG.inputs.active(j)) continue;
      const bd = byJ.get(j.id);
      try {
        const jt = SG.inputs.prepare(j, net.eff, net.si, ctx);
        jt.b = bd;
        if (bd && bd.prepare) bd.prepare(jt);
        jts.push(jt);
      } catch (e) { return { errors: [t('surge.error.data', { id: j.id, message: e.message })], warnings: B.warnings }; }
    }
    // the cavitation of the run: vapour and gas cavities need the vapour pressure of the fluid. With the gas cavities (phase
    // G3) the sides of the two-port elements and the nodes of the protection devices keep the vapour cavities (on)
    const Pv = net.env.pv;
    const cv = { on: c.cavitation !== 'none' && Number.isFinite(Pv), gas: !!net.gas, Pv, psi: c.psi, staticBasis: c.cavBasis === 'static', dt: net.dt };
    // the force sets (phase G3)
    let forces = [];
    if (SG.forces && Array.isArray(c.forces) && c.forces.length) {
      try { forces = SG.forces.prepare(net, c.forces); } catch (e) { return { errors: [e.message], warnings: B.warnings }; }
    }
    return { errors: [], warnings: B.warnings, net, N, jts, cv, every: c.saveEvery, dur, byJ, variable: c.friction === 'variable' || c.friction === 'brunone', forces };
  }

  // the warnings known before the first step
  function initialWarnings(P, R) {
    const { net } = P, W = (level, key, params, obj) => SG.record.warnOnce(R, level, key, params, obj);
    for (const w of P.warnings) W(w.level, w.key, w.params, w.obj);
    const sec = net.sectioning;
    if (!sec.ok) W('warning', 'surge.warn.variance', { worst: 100 * sec.worst, limit: net.control.varianceMax });
    let Tmax = 0, nMax = 0;
    for (const p of net.pipes.values()) {
      Tmax = Math.max(Tmax, p.L / p.a);
      nMax = Math.max(nMax, p.n);
      if (!p.given && !p.thin) W('info', 'surge.warn.thickWall', { id: p.id }, 'p:' + p.id);
    }
    // the response of a pipe takes at least a period 4L/a (decision W-09)
    if (P.N * net.dt < 4 * Tmax) W('info', 'surge.warn.shortDuration', { t: 4 * Tmax });
    if (nMax > MANY_SECTIONS) W('caution', 'surge.warn.manySections', { n: nMax });
    if (net.control.cavitation !== 'none' && !P.cv.on) W('warning', 'surge.warn.noVapor');
    const r = SG.wavespeed.fluidKRange(net.eff.system);
    if (r) W('caution', 'surge.warn.fluidKRange', { T: r.T, min: r.min, max: r.max });
    // the memory of the series
    let fields = 0;
    for (const id in R.pipes) fields += R.pipes[id].stations.length * 4;
    for (const id in R.junctions) fields += R.junctions[id].fields.length;
    fields += P.forces.length;
    const mb = fields * R.nRec * 8;
    if (mb > MEMORY_LIMIT) W('caution', 'surge.warn.memory', { mb: Math.round(mb / 1e6) });
  }

  // ---------- one step of the method (§9.4, items 3 to 5): the new state, not yet the state of the network
  function solveStep(P, S) {
    const { net } = P, list = net.pipeList || [...net.pipes.values()];
    // the terms of Brunone of the step (from the steps before), before the characteristics that take them
    for (const p of list) if (p.dPB) SG.moc.brunoneTerms(p);
    for (const p of list) SG.moc.ends(p);
    for (const p of list) SG.moc.interior(p, P.cv);
    for (const b of net.boundaries) b.solve(S);
  }
  // every value of the new state is finite
  function finite(P) {
    for (const p of P.net.pipeList || P.net.pipes.values()) {
      const Pn = p.Pn, mUn = p.mUn, mDn = p.mDn, n = p.n;
      let s = 0;
      for (let i = 0; i <= n; i++) s += Pn[i] + mUn[i] + mDn[i];
      if (!Number.isFinite(s)) return false;
    }
    return true;
  }

  // the tables of the junctions at the time t, in their phase (§8.3); past its last point a table keeps its last value,
  // the usual end of a manoeuvre, so there is no warning
  function applyInputs(P, st, tk) {
    for (const jt of P.jts) {
      if (jt.trip) continue;
      const s = st.trig.get(jt.jid);
      const tb = SG.inputs.tableOf(jt, s);
      if (!tb) continue;
      const r = TM().tables.valueAt(tb, SG.inputs.tauOf(jt, s, tk), jt.o);
      if (jt.b) jt.b.input(jt, r.v);
      st.used.set(jt.jid, r.v);
    }
  }

  // ---------- the test step (§9.3): a whole step from the steady state, with the tables at t = 0, without events and
  // trips, must give the steady state back within the criterion; the state stays the steady one
  function testStep(P, st) {
    const { net } = P, c = net.control.artificial;
    const crit = c.criterion / 100;
    let mRef = 0;
    for (const p of net.pipes.values()) mRef = Math.max(mRef, Math.abs(p.mU[0]));
    const mMin = Math.max(U.toSI(c.minFlow.value, c.minFlow.unit, 'flow', { rho: net.env.rho }), 1e-9 * mRef);
    applyInputs(P, st, 0);
    solveStep(P, { k: 1, t: net.dt, dt: net.dt, cv: P.cv, test: true });
    const bad = [];
    let worstP = 0, worstM = 0;
    for (const p of net.pipes.values()) {
      for (let i = 0; i <= p.n; i++) {
        const P0 = p.P[i], dP = Math.abs(p.Pn[i] - P0) / Math.abs(P0);
        worstP = Math.max(worstP, dP);
        if (dP > crit) bad.push({ pid: p.id, i, what: 'P', rel: dP });
        const m0 = p.mU[i];
        if (Math.abs(m0) > mMin) {
          const dm = Math.max(Math.abs(p.mUn[i] - m0), Math.abs(p.mDn[i] - p.mD[i])) / Math.abs(m0);
          worstM = Math.max(worstM, dm);
          if (dm > crit) bad.push({ pid: p.id, i, what: 'm', rel: dm });
        }
      }
    }
    bad.sort((a, b) => b.rel - a.rel);
    return { ok: !bad.length, criterion: c.criterion, worst: bad.slice(0, 10), worstP, worstM, stop: !!c.stop };
  }

  // ---------- events (§8.4): the conditions are tested on the state of the end of a step; their effect starts at the
  // next step. The conditions read a result of the step in the fields of the steady results, for their objects only
  function rowsFor(P) {
    const { net } = P, sol = { pipes: {}, junctions: {}, pumps: {}, valves: {}, states: {}, fluid: { rho: net.env.rho } };
    const rho = net.env.rho, g = net.env.g;
    for (const id of P.watch.pipes) {
      const p = net.pipes.get(id);
      if (!p) continue;
      const at = (i) => {
        const m = (p.mU[i] + p.mD[i]) / 2, P0 = p.P[i], ps = P0 - m * m / (2 * rho * p.A * p.A), z = SG.moc.zOf(p, i);
        return { P0, ps, m, z };
      };
      const a = at(0), b = at(p.n);
      sol.pipes[id] = {
        P0in: a.P0, P0out: b.P0, Pin: a.ps, Pout: b.ps, HGLin: a.ps / (rho * g) + a.z, HGLout: b.ps / (rho * g) + b.z,
        EGLin: a.P0 / (rho * g) + a.z, EGLout: b.P0 / (rho * g) + b.z, m: a.m, Q: a.m / rho, V: a.m / (rho * p.A),
      };
    }
    for (const id of P.watch.junctions) {
      const b = P.byJ.get(id);
      if (!b) continue;
      const r = b.row();
      sol.junctions[id] = r.junction;
      if (r.pump) sol.pumps[id] = r.pump;
      if (r.valve) sol.valves[id] = r.valve;
    }
    for (const b of net.boundaries) { const s = b.stateName(); if (s !== undefined) sol.states[b.jid] = s; }
    return sol;
  }
  // the objects a condition reads (its tree of a combined event too)
  function watchOf(jts) {
    const w = { pipes: new Set(), junctions: new Set() };
    const add = (x) => { if (!x || x.id === undefined) return; (x.kind === 'p' ? w.pipes : w.junctions).add(x.id); };
    const walk = (pc) => {
      if (!pc) return;
      if (pc.node) { const n = (nd) => { if (nd.cond) walk(nd.cond); else (nd.of || []).forEach(n); }; n(pc.node); return; }
      add(pc); add(pc.second);
      // the velocity of a junction is that of its inlet pipe
      if (pc.inPipe !== undefined && pc.inPipe !== null) w.pipes.add(pc.inPipe);
      if (pc.second && pc.second.inPipe !== undefined && pc.second.inPipe !== null) w.pipes.add(pc.second.inPipe);
    };
    for (const jt of jts) jt.conds.forEach(walk);
    return w;
  }

  function fireEvents(P, st, R, tk) {
    let sol = null;
    const model = { junctions: P.net.boundaries.map((b) => b.jc) };
    for (const jt of P.jts) {
      const s = st.trig.get(jt.jid);
      const e = TM().events.armed(jt, s);
      if (e < 0 || !jt.conds[e]) continue;
      if (!sol) sol = rowsFor(P);
      // the level of a finite tank, from its boundary
      const tank = (jid) => { const b = P.byJ.get(jid); return b && b.tank ? b.tank() : null; };
      const S = { t: tk, ta: s.ta, sol, model, si: P.net.si, tank };
      if (TM().events.holds(jt.conds[e], S)) fire(P, st, R, jt, e, tk);
    }
  }
  // event e of a junction fires at the time t: its table starts (from the next step), or its pump trips or starts
  function fire(P, st, R, jt, e, tk) {
    if (jt.trip) {
      st.trig.set(jt.jid, TM().events.after(e, tk));
      trip(P, st, R, jt, tk);
      return;
    }
    const tb = jt.tables[e], from = st.used.get(jt.jid);
    let tau0 = 0;
    if (jt.resume === 'current') { const x = TM().tables.timeOfValue(tb, from, jt.o); if (x !== null) tau0 = x; }
    st.trig.set(jt.jid, TM().events.after(e, tk, tau0));
    SG.record.log(R, tk, 'j:' + jt.jid, 'event', 'surge.log.tableStarted', { n: e + 1 });
    if (tau0 > 0) SG.record.log(R, tk, 'j:' + jt.jid, 'info', 'surge.log.tableResumed', { n: e + 1, tau: tau0 });
  }
  // the torque of the motor of a pump is gone (a trip), or there (a start, decision W-50), from the next step on (§8.3)
  function trip(P, st, R, jt, tk) {
    if (st.tripped.has(jt.jid)) return;
    st.tripped.add(jt.jid);
    if (jt.b && jt.b.trip) jt.b.trip(jt.what);
    SG.record.log(R, tk, 'j:' + jt.jid, 'event', jt.what === 'start' ? 'surge.log.pumpStart' : 'surge.log.pumpTrip');
  }
  // the trips and starts by the clock that come due at t_k: the first step at or after their time
  function tripsDue(P, st, R, tk) {
    for (const jt of P.jts) if (jt.trip && jt.start === 'time' && !st.tripped.has(jt.jid) && tk >= jt.at - 1e-9 * P.net.dt) trip(P, st, R, jt, tk);
  }

  // the changes of the state of the devices of a step, in the log (§8.5)
  function commitJunctions(P, R, tk) {
    for (const b of P.net.boundaries) {
      const was = b.stateName();
      b.commit();
      const is = b.stateName();
      if (was !== undefined && is !== undefined && was !== is) SG.record.log(R, tk, 'j:' + b.jid, 'event', 'surge.log.state', { from: was, to: is });
    }
  }

  // ---------- the run
  function start(eff, opts = {}) {
    const P = prepare(eff, opts);
    const t0 = now();
    if (P.errors.length) {
      const res = { ok: false, errors: P.errors, warnings: SG.record.warningsOf(P.warnings || []), stopped: null };
      return { N: 0, k: 0, done: true, step: () => ({ done: true, k: 0, N: 0 }), cancel() {}, result: () => res };
    }
    const { net } = P;
    net.pipeList = [...net.pipes.values()]; // gone through at every step
    P.watch = watchOf(P.jts);
    const R = SG.record.create(net, P.N, P.every);
    net.warnOnce = (level, key, params, obj) => SG.record.warnOnce(R, level, key, params, obj);
    net.rootFailed = (jid, S) => SG.record.warnOnce(R, 'warning', 'surge.warn.root', { id: jid, t: S.t }, 'j:' + jid);
    net.warn = (level, key, params, obj) => SG.record.warnOnce(R, level, key, params, obj);
    // an entry of the log written by a boundary (the inversions of a pump in four quadrants, a dynamic check valve)
    net.log = (tk, obj, kind, key, params) => SG.record.log(R, tk, obj, kind, key, params);
    SG.record.forcesCreate(R, P.forces);
    initialWarnings(P, R);
    const st = {
      trig: new Map(P.jts.map((jt) => [jt.jid, TM().events.initial(jt, 0)])),
      used: new Map(P.jts.map((jt) => [jt.jid, jt.inUse])),
      tripped: new Set(),
    };
    const job = { N: P.N, k: 0, done: false };
    let result = null, artificial = null;

    function finish(stopped) {
      job.done = true;
      result = makeRun(P, R, stopped, artificial, now() - t0);
    }

    // the test step, then the state at t = 0: extremes, events, trips and its record
    artificial = testStep(P, st);
    if (!artificial.ok) {
      const list = artificial.worst.map((w) => t('surge.warn.artificialItem', { id: w.pid, i: w.i, what: t('surge.warn.artificialWhat.' + w.what), pct: SG.record.num(100 * w.rel) })).join('; ');
      SG.record.warnOnce(R, artificial.stop ? 'critical' : 'warning', 'surge.warn.artificial', { criterion: artificial.criterion, list });
    }
    if (!artificial.ok && artificial.stop) finish({ k: 0, t: 0, reason: 'error', errors: [t('surge.error.artificial', { criterion: artificial.criterion })] });
    else {
      SG.record.recordExtremes(R, net, 0);
      SG.record.forcesStep(R, P.forces, 0);
      fireEvents(P, st, R, 0);
      tripsDue(P, st, R, 0);
      SG.record.recordSeries(R, net, 0);
    }

    function advance() {
      const k = job.k + 1, tk = k * net.dt; // by multiplication, never adding the step again and again
      const S = { k, t: tk, dt: net.dt, cv: P.cv, test: false };
      applyInputs(P, st, tk);
      solveStep(P, S);
      if (!finite(P)) return finish({ k, t: tk, reason: 'error', errors: [t('surge.error.notFinite', { t: SG.record.num(tk) })] });
      for (const p of net.pipeList) { SG.moc.swap(p); if (p.dPB) SG.moc.brunoneShift(p); }
      commitJunctions(P, R, tk);
      // the friction that varies takes the flows of the step (§9.4, item 5)
      if (P.variable) for (const p of net.pipeList) if (p.Rs) SG.moc.updateFriction(p);
      SG.record.recordExtremes(R, net, tk);
      SG.record.forcesStep(R, P.forces, tk);
      if (P.cv.gas) SG.record.recordGas(R, net, tk);
      else if (P.cv.on) SG.record.recordCavities(R, net, tk);
      else SG.record.recordBelowVapor(R, net, tk, P.cv.Pv, P.cv.staticBasis);
      job.k = k;
      if (k < P.N) { fireEvents(P, st, R, tk); tripsDue(P, st, R, tk); }
      if (SG.record.isRecorded(k, P.N, P.every)) SG.record.recordSeries(R, net, tk);
      if (k >= P.N) finish(null);
    }

    job.step = (budgetMs = Infinity) => {
      const t1 = now();
      while (!job.done) {
        advance();
        if (now() - t1 >= budgetMs) break;
      }
      return { done: job.done, k: job.k, N: P.N };
    };
    job.cancel = () => { if (!job.done) finish({ k: job.k, t: job.k * net.dt, reason: 'cancel', errors: [] }); };
    job.result = () => result;
    return job;
  }

  // the result of a run, complete or stopped
  function makeRun(P, R, stopped, artificial, elapsed) {
    const { net } = P;
    SG.record.finish(R, net);
    const n = R.n;
    // the end of the last cavity of the network, and the pressures above the limit of each pipe (decision W-26)
    if (R.cavities.ever) {
      if (R.cavities.count) SG.record.log(R, n ? R.times[n - 1] : 0, '', 'info', 'surge.log.cavitiesAtEnd');
      else SG.record.log(R, R.cavities.lastEnd, '', 'info', 'surge.log.cavitiesEnded');
    }
    for (const p of net.pipes.values()) {
      const d = SG.wavespeed.dataOf(p.effPipe);
      if (!(d.pMax && Number.isFinite(d.pMax.value) && U.has('pressure', d.pMax.unit))) continue;
      const lim = net.si(d.pMax, 'pressure'), X = R.extremes.pipes[p.id];
      let i0 = -1;
      for (let i = 0; i <= p.n; i++) if (X.pmax[i] > lim && (i0 < 0 || X.pmax[i] > X.pmax[i0])) i0 = i;
      if (i0 >= 0) SG.record.warnOnce(R, 'warning', 'surge.warn.pMax', { id: p.id, i: i0, t: X.tpmax[i0], p: (X.pmax[i0] - net.env.patm) / 1e3, lim: (lim - net.env.patm) / 1e3 }, 'p:' + p.id);
    }
    R.log.sort((a, b) => a.t - b.t);
    const cut = (a) => a.subarray(0, n);
    const pipes = {};
    for (const p of net.pipes.values()) {
      const o = R.pipes[p.id];
      pipes[p.id] = {
        id: p.id, n: p.n, L: p.L, A: p.A, a: p.a0, aAdj: p.a, variance: p.variance, R: p.Rpipe, zUp: p.zUp, zDown: p.zDown,
        stations: o.stations, series: { P: o.P.map(cut), mU: o.mU.map(cut), mD: o.mD.map(cut), V: o.V ? o.V.map(cut) : null },
        steady: p.steady,
      };
    }
    const junctions = {};
    for (const id in R.junctions) {
      const o = R.junctions[id], s = {};
      for (const f of o.fields) s[f] = cut(o.series[f]);
      junctions[id] = { type: o.type, fields: o.fields, series: s };
      // the volumes a tank overflowed and missed (the protection devices and the finite reservoirs)
      const b = P.byJ.get(+id);
      if (b && b.totals) junctions[id].totals = b.totals();
      // what a boundary tells of itself (a pump in four quadrants: its reference point and the scales of its table)
      if (b && b.info) junctions[id].info = b.info();
    }
    const sec = net.sectioning;
    return {
      ok: n > 0, errors: n > 0 ? [] : (stopped && stopped.errors) || [], warnings: SG.record.warningsOf(R.warnings), stopped: stopped || null,
      dt: net.dt, N: P.N, saveEvery: P.every, duration: P.N * net.dt, elapsed,
      times: cut(R.times), pipes, junctions, extremes: R.extremes, log: R.log, artificial,
      sectioning: { dt: sec.dt, nc: sec.nc, controller: sec.controller, ok: sec.ok, worst: sec.worst, pipes: Object.fromEntries(sec.pipes.map((x) => [x.id, x])) },
      forces: SG.record.forcesOf(R, P.forces),
      cavitation: { model: P.cv.on, gas: !!P.cv.gas, ever: R.cavities.ever, lastEnd: R.cavities.lastEnd, pipes: Object.fromEntries(R.cavities.pipes), junctions: Object.fromEntries(R.cavities.junctions), below: Object.fromEntries(R.below) },
      env: { rho: net.env.rho, g: net.env.g, patm: net.env.patm, pv: net.env.pv, K: net.env.K },
      steady: net.res,
    };
  }

  function run(eff, opts = {}) {
    const job = start(eff, opts);
    job.step(Infinity);
    return job.result();
  }

  Object.assign(SG, { MEMORY_LIMIT, prepare, start, run });
})(typeof window !== 'undefined' ? window : globalThis);
