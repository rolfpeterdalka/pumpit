// The network of the method of characteristics (docs/water-hammer.md; §2.5 and §9.2 of its specification), built from
// the steady state of the model:
//   1. the steady state, refined to a relative tolerance of 1e-10 so that the balances of the nodes and the laws of the
//      elements close (residues of the steady state become artificial transients); without it, the run goes on with
//      the steady state as it was and a caution (decision W-02);
//   2. the active pipes: neither closed (decision W-05) nor isolated; their wave speeds, the sectioning, and the loss
//      coefficient R of each pipe from its steady loss, R = ΔP/(ṁ₀|ṁ₀|), or from the fully turbulent friction of its
//      roughness when it carries no steady flow (decisions W-03 and W-04); with the friction that varies (§2.7), R of
//      each station from then on;
//   3. every station at the steady state, and a boundary for every junction (src/core/surge/boundaries.js); with the
//      unsteady friction of Brunone the coefficient k of each pipe, and with the gas cavities the free gas of each station
//      (phase G3).
(function (root) {
  const PumpIt = root.PumpIt;
  const M = PumpIt.model, U = PumpIt.units;
  const { t } = PumpIt.i18n;
  const SG = () => PumpIt.surge;

  const REFINE = 1e-10;
  const ZERO_FLOW = 1e-6; // a pipe below this fraction of the largest steady flow has no steady loss to take R from

  // Colebrook in its original form, as PumpIt.hyd.colebrook (src/core/hydraulics/friction.js) gives it, by Newton's method
  // from x0 = 1/√f near the root (a few steps where the fixed point of the steady solver takes tens): → 1/√f
  function colebrook(Re, eD, x0) {
    const a = 9.35 / Re, c = 2 / Math.LN10;
    let x = x0 > 0 && Number.isFinite(x0) ? x0 : 7;
    for (let i = 0; i < 50; i++) {
      const u = eD + a * x;
      const dx = (x - 1.14 + 2 * Math.log10(u)) / (1 + c * a / u);
      x -= dx;
      if (Math.abs(dx) <= 1e-14 * x) break;
    }
    return x;
  }
  // the friction part of R of one section at the flow m (§2.7): the correlation of the steady loss of the pipe
  // (pipeLoss in src/core/solver/network.js), Darcy with its laminar and transition parts or Hazen-Williams, without
  // its fittings, f·L/(2ρA²·D) per pipe; A is the area of all its parallel pipes. null when it does not depend on m
  function frictionOf(P, A, n, env) {
    const H = PumpIt.hyd, rho = env.rho, mu = env.mu;
    if (P.fm === 'darcy') {
      const k = P.L / P.Dh / (2 * rho * A * A) / n, reD = P.Dh / (mu * A), eD = P.eD;
      const reLam = env.reLam, reTurb = env.reTurb, fLam = 64 / reLam, fTurb = H.colebrook(reTurb, eD);
      let x = 1 / Math.sqrt(fTurb); // 1/√f of the last call, where the next one starts
      return (m) => {
        const Re = Math.abs(m) * reD;
        let f;
        if (Re < reLam) f = 64 / Re;
        else if (Re > reTurb) { x = colebrook(Re, eD, x); f = 1 / (x * x); }
        else { const w = (Re - reLam) / (reTurb - reLam); f = (1 - w) * fLam + w * fTurb; }
        const r = f * k;
        return r >= 0 && Number.isFinite(r) ? r : 0;
      };
    }
    if (P.fm === 'hw') {
      const c = rho * U.G0 * P.L / n;
      return (m) => {
        const r = c * H.hazenWilliamsS(m / (rho * A), P.C, P.Dh) / (m * m);
        return r >= 0 && Number.isFinite(r) ? r : 0;
      };
    }
    return null;
  }

  // the fluid and the environment of a model: { rho, mu, pv, patm, g, K }
  function envOf(eff) {
    const sys = eff.system;
    const fl = PumpIt.fluids.evaluate(sys);
    return { rho: fl.rho, mu: fl.mu, pv: fl.pv, patm: U.toSI(sys.patm.value, sys.patm.unit, 'pressure'), g: U.G0 * sys.gravity, K: SG().wavespeed.fluidK(sys), fluid: fl };
  }

  // the coefficient of Brunone from the Reynolds number of the steady flow (Vardy and Brown; decision G3-09): k = √C*/2,
  // C* = 0.00476 below 2000 and 7.41/Re^(log₁₀(14.3/Re^0.05)) above
  function brunoneK(Re) {
    const C = Re < 2000 ? 0.00476 : 7.41 / Math.pow(Re, Math.log10(14.3 / Math.pow(Re, 0.05)));
    return Math.sqrt(C) / 2;
  }

  // the flows of a steady result as the first guess of the solver
  function guessOf(sol) {
    const g = { pipes: {}, elems: {} };
    for (const id in sol.pipes) { const m = sol.pipes[id].m; if (Number.isFinite(m) && m) g.pipes[id] = m; }
    for (const id in sol.junctions) { const r = sol.junctions[id]; if (r.Q !== undefined && Number.isFinite(r.m) && r.m) g.elems[id] = r.m; }
    return g;
  }

  // the steady state the run starts from: the result of the model (given, or solved), refined (§9.2)
  function steadyState(eff, given, warnings) {
    const res0 = given && given.ok ? given : PumpIt.solver.run(eff);
    if (!res0.ok) return { error: t('surge.error.steady', { message: (res0.errors || []).join(' ') }) };
    if (!res0.converged) return { error: t('surge.error.steadyNotConverged') };
    const effR = M.clone(eff);
    effR.solution.tolRel = Math.min(eff.solution.tolRel, REFINE);
    effR.solution.maxIter = Math.max(eff.solution.maxIter, 200);
    effR.solution.relax = 1;
    const res = PumpIt.solver.run(effR, { guess: guessOf(res0), states: res0.states });
    if (res.ok && res.converged) return { res };
    warnings.push({ level: 'caution', key: 'surge.warn.notRefined' });
    return { res: res0 };
  }

  // the wave speeds and the sectioning of the open pipes of a model, without its steady state: what the checklist and
  // the system window show before a run. → { pipes: [{ id, L, a }], sec, missing (pipes without a wave speed) }
  function waves(eff, env) {
    const list = [], missing = [];
    for (const p of eff.pipes) {
      if (p.closed) continue;
      const L = p.length && Number.isFinite(p.length.value) && U.has('length', p.length.unit) ? U.toSI(p.length.value, p.length.unit, 'length') : NaN;
      const w = SG().wavespeed.pipeSpeed(p, env.K, env.rho);
      if (!(w.a > 0) || !(L > 0)) { missing.push(p.id); continue; }
      list.push({ id: p.id, L, a: w.a, c1: w.c1, x: w.x });
    }
    return { list, missing };
  }
  function sectionOf(eff, list) {
    const c = SG().inputs.controlOf(eff);
    const dt = c.dtMode === 'given' && c.dt && Number.isFinite(c.dt.value) && U.has('time', c.dt.unit) ? U.toSI(c.dt.value, c.dt.unit, 'time') : NaN;
    return SG().sectioning.section(list, { mode: c.dtMode, dt, limit: c.varianceMax / 100, ncMin: c.ncMin, ncMax: c.ncMax });
  }
  // the number of steps of a run of the duration d (s) with the step dt: N = max(2, round(d/Δt))
  const stepsOf = (d, dt) => Math.max(2, Math.floor(d / dt + 0.5));

  // the size of a run before it is made (the checklist, §11.6 item 10): stations and steps; null when it cannot be told
  function sizeOf(eff) {
    try {
      const env = envOf(eff);
      const w = waves(eff, env);
      if (w.missing.length || !w.list.length) return null;
      const sec = sectionOf(eff, w.list);
      if (!(sec.dt > 0)) return null;
      const c = SG().inputs.controlOf(eff);
      const d = U.toSI(c.duration.value, c.duration.unit, 'time');
      if (!(d > 0)) return null;
      return { stations: sec.pipes.reduce((s, p) => s + p.n + 1, 0), steps: stepsOf(d, sec.dt), dt: sec.dt, sec };
    } catch (e) { return null; }
  }

  // the network of a run: opts.steady (the steady result of the model, used as the first guess). → { errors, warnings,
  // net }
  function build(eff0, opts = {}) {
    const eff = M.stripLayout(eff0);
    const warnings = [];
    const W = (level, key, params, obj) => warnings.push({ level, key, params: params || {}, obj });
    let env;
    try { env = envOf(eff); } catch (e) { return { errors: [e.message], warnings }; }
    const c = SG().inputs.controlOf(eff);
    const si = (x, cat) => U.toSI(x.value, x.unit, cat, { rho: env.rho, patm: env.patm });
    const st = steadyState(eff, opts.steady, warnings);
    if (st.error) return { errors: [st.error], warnings };
    const res = st.res;
    let prep;
    try { prep = PumpIt.solver.prepare(eff); } catch (e) { return { errors: [e.message], warnings }; }
    if (prep.errors.length) return { errors: prep.errors, warnings };

    // the active pipes: open, connected and not isolated in the steady state
    const pipesById = new Map(eff.pipes.map((p) => [p.id, p]));
    const active = [];
    for (const p of eff.pipes) {
      const P = prep.pp.get(p.id), r = res.pipes[p.id];
      if (!P || !r || P.closed || r.isolated || !Number.isFinite(r.P0in) || !Number.isFinite(r.m)) continue;
      active.push({ p, P, r });
    }
    if (!active.length) return { errors: [t('surge.error.noPipes')], warnings };
    // wave speeds and sectioning
    const list = [];
    for (const x of active) {
      const w = SG().wavespeed.pipeSpeed(x.p, env.K, env.rho);
      if (!(w.a > 0)) return { errors: [t('surge.error.waveSpeed', { id: x.p.id })], warnings };
      x.a = w.a; x.c1 = w.c1; x.thin = w.x.thin; x.plastic = w.x.plastic; x.given = w.x.given;
      list.push({ id: x.p.id, L: x.P.L, a: w.a });
    }
    const sec = sectionOf(eff, list);
    if (!(sec.dt > 0)) return { errors: [t('surge.error.timeStep')], warnings };
    const byId = new Map(sec.pipes.map((s) => [s.id, s]));
    // R of each pipe from its steady loss (friction and fittings), or from the friction of its roughness
    let mRef = 0;
    for (const x of active) mRef = Math.max(mRef, Math.abs(x.r.m));
    const pipes = new Map();
    // the friction that varies, also the quasi-steady part of that of Brunone (decision G3-09)
    const variable = c.friction === 'variable' || c.friction === 'brunone';
    const brunone = c.friction === 'brunone';
    for (const x of active) {
      const s = byId.get(x.p.id), P = x.P, A = P.A * P.N, m0 = x.r.m;
      let R, Rk; // of the whole pipe, and of its fittings alone
      if (Math.abs(m0) > ZERO_FLOW * mRef && Math.abs(m0) > 0) {
        R = (x.r.dPfric + x.r.dPfit) / (m0 * Math.abs(m0));
        Rk = x.r.dPfit / (m0 * Math.abs(m0));
      } else {
        const ft = P.fm === 'darcy' ? (P.eD > 0 ? 1 / (-2 * Math.log10(P.eD / 3.7)) ** 2 : 0.01) : P.fm === 'explicit' ? P.fx : P.fm === 'hw' ? 0.01 : 0;
        R = (ft * P.L / P.Dh + P.Ksum) / (2 * env.rho * A * A);
        Rk = P.Ksum / (2 * env.rho * A * A);
        W('info', 'surge.warn.zeroFlow', { id: x.p.id }, 'p:' + x.p.id);
      }
      if (!(R >= 0) || !Number.isFinite(R)) R = 0;
      if (!(Rk >= 0) || !Number.isFinite(Rk)) Rk = 0;
      const pipe = SG().moc.makePipe({ id: x.p.id, n: s.n, L: P.L, a: s.aAdj, A, R, zUp: P.zUp, zDown: P.zDown, rho: env.rho, g: env.g, P0: x.r.P0in, m0 });
      Object.assign(pipe, { a0: x.a, variance: s.variance, c1: x.c1, thin: x.thin, plastic: x.plastic, given: x.given, effPipe: x.p });
      // the friction that varies with the Reynolds number (§2.7): the friction of the steady correlation at the flow of
      // each station, per section, with the fittings of the steady state; it starts as the R of the steady state. A
      // friction factor given or no friction does not vary
      const Rf = variable ? frictionOf(P, A, s.n, prep.env) : null;
      if (Rf) SG().moc.variableFriction(pipe, { Rk: Rk / s.n, Rf, mFloor: env.rho * A * 1e-6 });
      // the unsteady term of Brunone: k given in the pipe, or from the Reynolds number of its steady flow (laminar without
      // a steady flow)
      if (brunone) {
        const kGiven = SG().wavespeed.dataOf(x.p).k;
        const Re = Math.abs(m0) > ZERO_FLOW * mRef && Math.abs(m0) > 0 ? Math.abs(m0) * P.Dh / (env.mu * A) : 0;
        SG().moc.brunone(pipe, typeof kGiven === 'number' && kGiven >= 0 ? kGiven : brunoneK(Re));
        pipe.Re = Re;
      }
      // the steady state of its stations, the base of the envelopes
      pipe.steady = { P: Float64Array.from(pipe.P), m: m0 };
      pipes.set(x.p.id, pipe);
    }
    // the gas cavities (decision G3-10): the free gas of every station at its steady pressure
    const gas = c.cavitation === 'dgcm' && Number.isFinite(env.pv);
    if (gas) {
      const o = { alpha0: c.alpha0, p0: si(c.p0, 'pressure'), Pv: env.pv, staticBasis: c.cavBasis === 'static' };
      for (const p of pipes.values()) {
        const bad = SG().moc.gasInit(p, o);
        if (bad) return { errors: [t('surge.error.gasSteady', { id: p.id, i: bad.i })], warnings };
      }
    }
    // scales of the roots: the flows and the pressures of the model
    let Amax = 0;
    for (const p of pipes.values()) Amax = Math.max(Amax, p.A);
    const mScale = 1e-3 * Math.max(mRef, env.rho * Amax * 0.01, 1e-9);
    let pScale = env.patm;
    for (const p of pipes.values()) for (let i = 0; i <= p.n; i++) pScale = Math.max(pScale, Math.abs(p.P[i]));
    const net = {
      eff, env, si, prep, res, control: c, dt: sec.dt, sectioning: sec, pipes, pipesById, mScale, pScale: 1e-3 * pScale,
      warnings, gas,
      warn: (level, key, params, obj) => W(level, key, params, obj),
      warnOnce: null, rootFailed: null, // set by the run
    };
    // the boundaries of the junctions, by their id
    const portOf = (pid, jid) => {
      const pipe = pipes.get(pid), p = pipesById.get(pid);
      if (!pipe || !p) return null;
      return p.up === jid ? pipe.up : p.down === jid ? pipe.down : null;
    };
    net.portOf = portOf;
    const juncs = eff.junctions.slice().sort((a, b) => a.id - b.id);
    net.boundaries = [];
    for (const j of juncs) {
      try { net.boundaries.push(SG().boundaries.make(net, j, portOf)); } catch (e) { return { errors: [t('surge.error.boundary', { id: j.id, message: e.message })], warnings }; }
    }
    // the gas stays only at the stations of the boundaries that hold it (a free node: at the station of its single port, or
    // at the node itself); the ports of the others hold none
    if (gas) for (const b of net.boundaries) if (!b.gas) for (const pt of b.ports) SG().moc.gasNone(pt.pipe, pt.i);
    // the pipe ends that no junction claims (a pipe out of the transient at the other end) hold none either
    if (gas) {
      const claimed = new Set();
      for (const b of net.boundaries) for (const pt of b.ports) claimed.add(pt);
      for (const p of pipes.values()) for (const pt of [p.up, p.down]) if (!claimed.has(pt)) SG().moc.gasNone(p, pt.i);
    }
    return { errors: [], warnings, net };
  }

  PumpIt.surge = Object.assign(PumpIt.surge || {}, { network: { REFINE, brunoneK, envOf, steadyState, waves, sectionOf, stepsOf, sizeOf, build } });
})(typeof window !== 'undefined' ? window : globalThis);
