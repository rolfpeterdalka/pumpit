// Dynamic check valves of the water hammer (phase G3; decisions G3-04 to G3-06 of the addendum of its specification). A
// check valve whose open loss is quadratic (K, Cv or Kv) may take, instead of the instantaneous model of phase G1
// (j.dynamic 'none', the generic element of src/core/surge/boundaries.js), one of:
//
//   decel   by deceleration: the user's table of the reverse velocity at closure V_R (m/s) against the deceleration a_d
//           (m/s²) of the liquid. At each inversion (the first step in which V = ṁ/(ρ·A) at the end of the inlet pipe is
//           ≤ 0, open), a_d is minus the least-squares slope of V(t) over the last max(2, round(τ_d/Δt) + 1) steps, the
//           current one included and none before the last reopening (fewer than 2 points: a_d = 0; a positive slope: 0).
//           V_R comes from the table in straight lines, its end values held beyond it (a caution). The valve stays open
//           with the reverse flow and closes at once in the step where V < −V_R, the model of phase G1 with vClose = −V_R
//           (in the same step when V_R = 0). It opens again as in phase G1, and the log keeps a_d and V_R
//   swing   a swinging disc with its inertia (Thorley, 2004; Li and Liou, 2003): θ from the seat (0 closed, θ_max at its
//           stop), I·d²θ/dt² = ΔP·A_d·r_p − (m_d − m_f)·g·r_cg·sin(θ + γ_c + φ) − W_c·r_c·sin(θ + γ_c + φ + δ) − (T_s0 +
//           k_s·θ) − c·dθ/dt
//   nozzle  a disc sliding along its axis: x from the seat, m·d²x/dt² = ΔP·A_d − (F_s0 + k·x) − (m − m_f)·g·sin φ − c·dx/dt
//
// For the two discs, the loss at a position is the quadratic loss of the valve fully open over the square of the
// fraction of its Cv (a table from (0, 0 %) to (the stop, 100 %), in straight lines). Each step is the implicit
// trapezoid rule on the position and its speed: for each position tried the element is solved with its characteristics,
// and the position is the root of 2(y_k − y_k−1)/Δt − 2v_k−1 − Δt/(2I)·(T_k−1 + T_k(y_k)) = 0, by the protected Newton
// of the boundaries from the position of the step before (near the seat the function may turn back, and that root
// continues the motion); past a stop it stays there with no speed (no rebound), and at a stop the torque of the step
// before that pushes against it counts as zero. At the seat the valve is closed; it opens when the torque there is
// positive. It starts at its stop fully open (or at its seat when the steady state has it closed), with a warning when
// the steady torque there would close it.
(function (root) {
  const PumpIt = root.PumpIt;
  const U = PumpIt.units, M = PumpIt.model;
  const { t } = PumpIt.i18n;
  const q = M.q;
  const BD = () => PumpIt.surge.boundaries;

  const MODELS = ['none', 'decel', 'swing', 'nozzle'];
  const FLUID_MASS = ['none', 'user', 'calculated'];
  const ORIENTS = ['horizontal', 'vertical', 'angle'];
  const QUADRATIC = ['K', 'Cv', 'Kv'];
  const RHO_STEEL = 7850;

  // the data of a model, new: the window of the deceleration, the fields of a disc (empty optional fields: none)
  const newDecel = () => ({ x: [], y: [], xUnit: 'm/s²', yUnit: 'm/s' });
  const shared = () => ({ fluidMass: 'calculated', mf: q(null, 'kg'), rhoM: q(RHO_STEEL, 'kg/m³'), orient: 'horizontal', phi: q(0, '°') });
  const newSwing = () => Object.assign({
    thetaMax: q(60, '°'), seat: q(0, '°'), I: q(null, 'kg·m²'), md: q(null, 'kg'), rcg: q(null, 'm'), Ad: q(null, 'cm²'), rp: q(null, 'm'),
    Ts0: q(null, 'N·m'), ks: q(null, 'N·m/rad'), c: q(null, 'N·m·s/rad'), Wc: q(null, 'N'), rc: q(null, 'm'), delta: q(0, '°'),
    cv: { x: [], y: [], xUnit: '°' },
  }, shared());
  const newNozzle = () => Object.assign({
    xMax: q(null, 'mm'), m: q(null, 'kg'), Ad: q(null, 'cm²'), F0: q(null, 'N'), k: q(null, 'N/m'), c: q(null, 'N·s/m'),
    cv: { x: [], y: [], xUnit: 'mm' },
  }, shared());

  const empty = (x) => !x || x.value === null || x.value === undefined || x.value === '';
  const has = (x, cat) => !!(x && Number.isFinite(x.value) && U.has(cat, x.unit));
  const si = (x, cat) => U.toSI(x.value, x.unit, cat);
  // an optional quantity: empty is none, otherwise a number of the category not below lo
  const optOk = (x, cat, lo = -Infinity) => empty(x) || (has(x, cat) && x.value >= lo);
  const opt = (x, cat, dflt = 0) => (empty(x) || !has(x, cat) ? dflt : si(x, cat));

  // the table of the fraction of the Cv against the position (SI), from (0, 0 %) to (the stop, 100 %), positions rising
  function cvTableOk(c, cat, yMax) {
    if (!(c && Array.isArray(c.x) && Array.isArray(c.y) && c.x.length >= 2 && c.x.length === c.y.length && U.has(cat, c.xUnit))) return false;
    if (!(c.x.every(Number.isFinite) && c.y.every(Number.isFinite))) return false;
    const n = c.x.length, xs = c.x.map((x) => U.toSI(x, c.xUnit, cat));
    if (!xs.every((x, i) => i === 0 || x > xs[i - 1])) return false;
    if (!c.y.every((y) => y >= 0 && y <= 100)) return false;
    return xs[0] === 0 && c.y[0] === 0 && c.y[n - 1] === 100 && Math.abs(xs[n - 1] - yMax) <= 1e-9 * Math.max(yMax, 1e-12);
  }
  // a table in straight lines with its end values held beyond it. → f(x), or null
  function line(xs, ys) {
    const n = xs.length;
    return (x) => {
      if (!(x > xs[0])) return ys[0];
      if (x >= xs[n - 1]) return ys[n - 1];
      let i = 1;
      while (x > xs[i]) i++;
      return ys[i - 1] + (x - xs[i - 1]) / (xs[i] - xs[i - 1]) * (ys[i] - ys[i - 1]);
    };
  }

  // ---------- the checklist (keys under surge.checklist.check)
  function validate(j, miss) {
    const m = j.dynamic;
    if (m === undefined || m === null || m === 'none') return;
    if (!MODELS.includes(m)) { miss.push('check.model'); return; }
    if (!QUADRATIC.includes(j.lossModel)) miss.push('check.loss');
    if (m === 'decel') {
      const d = j.decel;
      const ok = d && Array.isArray(d.x) && Array.isArray(d.y) && d.x.length >= 2 && d.x.length === d.y.length && d.x.every(Number.isFinite) && d.y.every(Number.isFinite)
        && U.has('accel', d.xUnit) && U.has('velocity', d.yUnit) && d.x.every((x, i) => x >= 0 && (i === 0 || x > d.x[i - 1])) && d.y.every((y) => y >= 0);
      if (!ok) miss.push('check.decel');
      if (!empty(j.decelWindow) && !(has(j.decelWindow, 'time') && j.decelWindow.value > 0)) miss.push('check.window');
      return;
    }
    const swing = m === 'swing';
    const o = swing ? j.swing : j.nozzle;
    if (!o || typeof o !== 'object') { miss.push('check.disc'); return; }
    const yMaxOk = swing ? has(o.thetaMax, 'angle') && o.thetaMax.value > 0 && si(o.thetaMax, 'angle') <= Math.PI : has(o.xMax, 'length') && o.xMax.value > 0;
    if (!yMaxOk) miss.push('check.stop');
    if (swing) {
      if (!(has(o.I, 'inertia') && o.I.value > 0)) miss.push('check.inertia');
      if (!(has(o.md, 'mass') && o.md.value >= 0 && has(o.rcg, 'length') && o.rcg.value >= 0)) miss.push('check.weight');
      if (!has(o.seat, 'angle') || !optOk(o.Ad, 'area', 0) || !optOk(o.rp, 'length', 0) || !optOk(o.Ts0, 'torque') || !optOk(o.ks, 'rotStiffness', 0)
        || !optOk(o.c, 'rotDamping', 0) || !optOk(o.Wc, 'force', 0) || !optOk(o.rc, 'length', 0) || !optOk(o.delta, 'angle')) miss.push('check.optional');
    } else {
      if (!(has(o.m, 'mass') && o.m.value > 0)) miss.push('check.inertia');
      if (!optOk(o.Ad, 'area', 0) || !optOk(o.F0, 'force') || !optOk(o.k, 'stiffness', 0) || !optOk(o.c, 'damping', 0)) miss.push('check.optional');
    }
    if (yMaxOk && !cvTableOk(o.cv, swing ? 'angle' : 'length', swing ? si(o.thetaMax, 'angle') : si(o.xMax, 'length'))) miss.push('check.cvTable');
    if (!FLUID_MASS.includes(o.fluidMass) || (o.fluidMass === 'user' && !(has(o.mf, 'mass') && o.mf.value >= 0)) || (o.fluidMass === 'calculated' && !(has(o.rhoM, 'density') && o.rhoM.value > 0))) miss.push('check.fluidMass');
    if (!ORIENTS.includes(o.orient) || (o.orient === 'angle' && !(has(o.phi, 'angle') && Math.abs(si(o.phi, 'angle')) <= Math.PI / 2 * (1 + 1e-12)))) miss.push('check.orient');
  }

  // ---------- the boundary
  function boundary(j, ctx) {
    const { net, def, portOf } = ctx;
    const { pr, pin, pout } = ctx.elementPorts(net, j, portOf);
    const rho = net.env.rho, g = net.env.g;
    const jc = M.clone(j);
    const res = net.res, row0 = res.junctions[j.id] || {};
    // closed in the steady state (by its special condition or by its device): it starts at its seat
    const closed0 = !!jc.closed || (res.states && res.states[j.id] === 'closed');
    jc.closed = false;
    const lk = ctx.elementShape(net, jc, def, pr.in.id, pr.out.id);
    const e = { pin, pout, rho, sc: net.mScale };
    for (const pt of [pin, pout]) if (pt) ctx.attach(net, pt, jc, net.si(jc.elevation, 'length'), false);
    const phiOpen = lk.phiOpen;
    const Pin = net.prep.pp.get(pr.in.id), Ain = Pin.A * Pin.N;
    const dPopen = net.si(jc.dPopen, 'dp');
    const OPEN = { mode: 'loss', phi: phiOpen }, CLOSED = { mode: 'closed' };
    const m0 = Number.isFinite(row0.m) ? row0.m : 0;
    const base = { m: closed0 ? 0 : m0, P1: row0.P0in, P2: row0.P0out, V1: 0, V2: 0, state: closed0 ? 'closed' : 'open' };
    const common = (b) => Object.assign(b, {
      jid: j.id, j, jc, def, ports: [pin, pout].filter(Boolean), kind: 'element', e,
      commit() { b.st = b.nx; },
      stateName: () => b.st.state,
      row() {
        const st = b.st;
        const vel = (pt) => (pt ? Math.abs((pt.pipe.mU[pt.i] + pt.pipe.mD[pt.i]) / 2) / (rho * pt.pipe.A) : 0);
        const Vi = vel(pin), Vo = vel(pout);
        const JS = PumpIt.junctionTypes.shared;
        return {
          junction: { P0in: st.P1, P0out: st.P2, Pin: st.P1 - rho * Vi * Vi / 2, Pout: st.P2 - rho * Vo * Vo / 2, m: st.m, Q: st.m / rho },
          valve: { Cv: JS.flowCv(st.m, st.P1 - st.P2, rho), open: b.opening ? b.opening() : st.state === 'closed' ? 0 : 100 },
        };
      },
    });

    if (jc.dynamic === 'decel') {
      // the window of the deceleration in steps, and the table of the reverse velocity at closure
      const tau = has(jc.decelWindow, 'time') && jc.decelWindow.value > 0 ? si(jc.decelWindow, 'time') : 0.1;
      const Nw = Math.max(2, Math.floor(tau / net.dt + 0.5) + 1);
      const d = jc.decel, ads = d.x.map((x) => U.toSI(x, d.xUnit, 'accel')), vrs = d.y.map((y) => U.toSI(y, d.yUnit, 'velocity'));
      const VRof = line(ads, vrs);
      const b = common({
        st: Object.assign(base, { vc: NaN, inv: false, hist: closed0 ? [] : [m0 / (rho * Ain)] }), nx: null,
        fields: ['P1', 'P2', 'm'],
        input() {},
        solve(S) {
          const st = b.st;
          let state = st.state, vc = st.vc, inv = st.inv, hist = st.hist, x;
          if (state === 'open') {
            x = ctx.elementStep(e, OPEN, S, st);
            const V = x.m / (rho * Ain);
            if (V > 0) { inv = false; vc = NaN; }
            else if (!inv) {
              // the inversion: the deceleration over the window, and the reverse velocity at which the valve closes
              const pts = hist.slice(-(Nw - 1)).concat([V]);
              let ad = 0;
              if (pts.length >= 2) {
                const n = pts.length, im = (n - 1) / 2;
                let vm = 0, sxy = 0, sxx = 0;
                for (const v of pts) vm += v / n;
                pts.forEach((v, i) => { sxy += (i - im) * (v - vm); sxx += (i - im) * (i - im); });
                ad = Math.max(0, -sxy / (sxx * S.dt));
              }
              const VR = VRof(ad);
              vc = -VR; inv = true;
              if (!S.test) {
                net.log(S.t, 'j:' + j.id, 'event', 'surge.log.checkDecel', { ad, VR });
                if (ad < ads[0] || ad > ads[ads.length - 1]) net.warnOnce('caution', 'surge.warn.decelRange', { id: j.id, t: S.t, ad }, 'j:' + j.id);
              }
            }
            if (inv && V < vc - 1e-9) { state = 'closed'; x = ctx.elementStep(e, CLOSED, S, st); }
          } else {
            x = ctx.elementStep(e, CLOSED, S, st);
            if (x.P1 - x.P2 > dPopen + 1e-3) { state = 'open'; x = ctx.elementStep(e, OPEN, S, st); inv = false; vc = NaN; hist = []; }
          }
          if (!x.ok) net.rootFailed(j.id, S);
          ctx.elementWrite(e, x);
          const V = x.m / (rho * Ain);
          b.nx = { m: x.m, P1: x.P1, P2: x.P2, V1: x.V1, V2: x.V2, state, vc, inv, hist: state === 'open' ? hist.slice(-(Nw - 1)).concat([V]) : [] };
        },
        values(o) { o[0] = b.st.P1; o[1] = b.st.P2; o[2] = b.st.m; },
      });
      return b;
    }

    // a disc: its position y (an angle or a travel), its stop yMax, its inertia, the force or torque on it, and the
    // fraction of the Cv at a position
    const swing = jc.dynamic === 'swing';
    const o = swing ? jc.swing : jc.nozzle;
    const yMax = swing ? si(o.thetaMax, 'angle') : si(o.xMax, 'length');
    const Iner = swing ? si(o.I, 'inertia') : si(o.m, 'mass');
    const mass = swing ? si(o.md, 'mass') : si(o.m, 'mass');
    const mf = o.fluidMass === 'user' ? si(o.mf, 'mass') : o.fluidMass === 'calculated' ? rho * mass / si(o.rhoM, 'density') : 0;
    const phi = o.orient === 'vertical' ? Math.PI / 2 : o.orient === 'angle' ? si(o.phi, 'angle') : 0;
    const Ad = opt(o.Ad, 'area', Ain);
    const cvX = o.cv.x.map((x) => U.toSI(x, o.cv.xUnit, swing ? 'angle' : 'length')), cvY = o.cv.y.map((y) => y / 100);
    const frac = line(cvX, cvY);
    let force;
    if (swing) {
      const rcg = si(o.rcg, 'length'), rp = opt(o.rp, 'length', rcg), gc = si(o.seat, 'angle');
      const W = (mass - mf) * g, Ts0 = opt(o.Ts0, 'torque'), ks = opt(o.ks, 'rotStiffness'), c = opt(o.c, 'rotDamping');
      const Wc = opt(o.Wc, 'force'), rc = opt(o.rc, 'length'), dl = opt(o.delta, 'angle');
      force = (y, w, dP) => dP * Ad * rp - W * rcg * Math.sin(y + gc + phi) - Wc * rc * Math.sin(y + gc + phi + dl) - (Ts0 + ks * y) - c * w;
    } else {
      const W = (mass - mf) * g * Math.sin(phi), F0 = opt(o.F0, 'force'), k = opt(o.k, 'stiffness'), c = opt(o.c, 'damping');
      force = (y, w, dP) => dP * Ad - (F0 + k * y) - W - c * w;
    }
    // the law of the element at a position: the quadratic loss of the valve fully open, k·ṁ|ṁ| (a K without the laminar
    // correction of the steady state, which would make it linear as the disc nears its seat and the flow vanishes), over
    // the square of its fraction of the Cv; closed at the seat
    const Pout = net.prep.pp.get(pr.out.id), Aout = Pout.A * Pout.N;
    const kIn = jc.K / (2 * rho * Ain * Ain), kOut = jc.K / (2 * rho * Aout * Aout);
    const phiQ = jc.lossModel === 'K' ? (m) => (m >= 0 ? kIn : kOut) * m * Math.abs(m) : phiOpen;
    const FULL = { mode: 'loss', phi: phiQ };
    const lawAt = (y) => { const c = frac(y); return c > 0 ? (c === 1 ? FULL : { mode: 'loss', phi: (m) => phiQ(m) / (c * c) }) : CLOSED; };
    const y0 = closed0 ? 0 : yMax;
    const T0 = force(y0, 0, row0.P0in - row0.P0out);
    if (!closed0 && T0 < 0) net.warn('warning', 'surge.warn.discNotOpen', { id: j.id }, 'j:' + j.id);
    const fieldY = swing ? 'th' : 'xd', fieldT = swing ? 'Td' : 'Fd';
    const b = common({
      st: Object.assign(base, { y: y0, w: 0, T: T0 }), nx: null,
      fields: ['P1', 'P2', 'm', fieldY, fieldT],
      opening: () => 100 * frac(b.st.y),
      input() {},
      solve(S) {
        const st = b.st, dt = S.dt, k2 = dt / (2 * Iner);
        // the torque of the step before that pushes against a stop counts as zero (the stop balances it)
        let Tb = st.T;
        if ((st.y >= yMax && Tb > 0) || (st.y <= 0 && Tb < 0)) Tb = 0;
        const F = (y) => {
          const x = ctx.elementStep(e, lawAt(y), S, st);
          return 2 * (y - st.y) / dt - 2 * st.w - k2 * (Tb + force(y, 2 * (y - st.y) / dt - st.w, x.P1 - x.P2));
        };
        // the root by the protected Newton of the boundaries (§5.12) from the position of the step before, over the whole
        // line (the table keeps its end values beyond the stops), then held between the stops. Near the seat the torque of
        // the liquid grows so fast as the disc closes that F may turn back (two roots below the position before): the
        // search from there keeps the root that continues the motion
        const r = BD().root(F, st.y, yMax);
        if (!r.ok) net.rootFailed(j.id, S);
        const y = Math.min(yMax, Math.max(0, r.x));
        // at a stop it has no speed (no rebound)
        const atStop = y <= 0 || y >= yMax;
        const w = atStop ? 0 : 2 * (y - st.y) / dt - st.w;
        const x = ctx.elementStep(e, lawAt(y), S, st);
        if (!x.ok) net.rootFailed(j.id, S);
        ctx.elementWrite(e, x);
        const T = force(y, w, x.P1 - x.P2);
        const state = y <= 0 ? 'closed' : 'open';
        b.nx = { m: x.m, P1: x.P1, P2: x.P2, V1: x.V1, V2: x.V2, state, y, w, T };
        if (!S.test) {
          if (st.y >= yMax && y < yMax) net.log(S.t, 'j:' + j.id, 'event', 'surge.log.discLeaves');
          else if (st.y < yMax && y >= yMax) net.log(S.t, 'j:' + j.id, 'event', 'surge.log.discFull');
        }
      },
      values(out) { const st = b.st; out[0] = st.P1; out[1] = st.P2; out[2] = st.m; out[3] = st.y; out[4] = st.T; },
    });
    return b;
  }

  PumpIt.surge = Object.assign(PumpIt.surge || {}, {
    checks: { MODELS, FLUID_MASS, ORIENTS, QUADRATIC, RHO_STEEL, newDecel, newSwing, newNozzle, validate, boundary, line },
  });
})(typeof window !== 'undefined' ? window : globalThis);
