// Pumps in the water hammer (docs/water-hammer.md; §5.11 of its specification). A pump is an element between its suction
// and discharge pipes whose gain is that of its curve at the relative speed s, by the affinity laws of the steady state:
//
//   Δp(ṁ, s) = ρg·H(Q, s),  H(Q, s) = s²·H1(Q/(N·s)),  Q = ṁ/ρ        (N identical pumps in parallel)
//
// with s ≥ 10⁻⁶ in the division, so that s = 0 leaves of a polynomial curve its term in Q², which acts as a loss
// (decision W-13). Modes:
//   constant speed     the speed of the steady state (the speed the steady state found under control, frozen)
//   speed table        s(t) by a table (% of the rated speed), without inertia
//   trip               the torque of the motor gone from the trip on; the speed falls by I·ω_r·ds/dt = −T(Q, s), by the
//                      trapezoid rule iterated with the solution of the step; T(Q, s) = s²·P1(Q/(N·s))/ω_r, P1 the shaft
//                      power at the rated speed (its curve, or ρg·Q·H1/η1 from the efficiency data); s never goes below 0
//   start              (phase G3, decision W-50) a pump stopped and closed in the steady state: from the start on its motor
//                      gives the torque Tm(s) of its table (torque against the speed, % of the rated one, in straight
//                      lines, its end values held beyond), and the speed rises by I·ω_r·ds/dt = Tm(s) − T(Q, s), by the
//                      trapezoid rule; the speed of each step is the root of that rule with the solution of the step (a
//                      motor whose torque falls fast near its synchronous speed makes successive substitutions diverge)
//   sizing             (fixedFlow, no curve) the flow of the steady state
//   off                closed, or a free passage, as in the steady state
// A tripped or started pump lets no flow back: it closes as a check valve when the flow would go back, and pumps once
// Δp(0, s) overcomes the difference across it. With noReverse, any pump does the same.
//
// Four quadrants (phase G3, decisions G3-01 to G3-03): with the user's curves of Suter (j.fourQuad), in every mode, the
// head and the torque come from them in all quadrants, with α = N/N_R, v = Q/Q_R, h = H/H_R, β = T/T_R and
// θ = π + atan2(v, α) (0 to 360°):
//
//   h = (α² + v²)·c_H·WH(θ),  β = (α² + v²)·c_B·WB(θ)      (a periodic table of θ, WH and WB, in straight lines)
//
// The reference point is that of the steady state of the pump (the default), its best efficiency at the rated speed, or
// one the user gives; c_H and c_B scale the table so that it meets the steady state (a caution beyond 5 %; 1 for a pump
// at rest). A trip or a start then lets the flow and the speed go back; only noReverse holds the flow, and a pump that
// starts off and closed stays closed until its head at no flow overcomes the difference across it. The speed of a trip
// or a start is the root of the trapezoid rule with the solution of the step, as in a start, since s may cross zero.
(function (root) {
  const PumpIt = root.PumpIt;
  const U = PumpIt.units, H = PumpIt.hyd, M = PumpIt.model;
  const { t } = PumpIt.i18n;
  const BD = () => PumpIt.surge.boundaries;

  const S_MIN = 1e-6;
  const SPEED_TOL = 1e-12;
  const SPEED_IT = 50;
  const FOUR_REFS = ['steady', 'bep', 'user'];
  const FOUR_MIN_POINTS = 9;
  const SCALE_CAUTION = 0.05; // the scales of the table above which a caution says the table and the curve disagree

  // the shaft power at the rated speed, per pump (W against m³/s): its own curve, or the points ρg·Q·H1(Q)/η of the
  // efficiency data with η > 0, fitted with the order of the efficiency curve (decision W-13); null without either
  function powerCurve(j, headCurve, rho, g) {
    const pw = j.power;
    if (pw && Array.isArray(pw.x) && pw.x.length >= 2 && pw.x.length === pw.y.length && pw.x.every(Number.isFinite) && pw.y.every(Number.isFinite) && U.has('volFlow', pw.xUnit) && U.has('power', pw.yUnit)) {
      return H.makeCurve(pw.x.map((v) => U.toSI(v, pw.xUnit, 'volFlow')), pw.y.map((v) => U.toSI(v, pw.yUnit, 'power')), pw.fit || '2');
    }
    const ef = j.eff;
    if (!headCurve || !ef || !Array.isArray(ef.x) || !U.has('volFlow', ef.xUnit)) return null;
    const xs = [], ys = [];
    ef.x.forEach((x, i) => {
      const eta = ef.y[i] / 100, Q = U.toSI(x, ef.xUnit, 'volFlow');
      if (eta > 0 && Number.isFinite(Q)) { xs.push(Q); ys.push(rho * g * Q * H.evalCurve(headCurve, Q) / eta); }
    });
    if (xs.length < 2) return null;
    return H.makeCurve(xs, ys, ef.fit || '2');
  }
  const hasPower = (j) => {
    const ok = (c) => c && Array.isArray(c.x) && c.x.length && c.x.every(Number.isFinite) && c.y.every(Number.isFinite);
    return (ok(j.power) && j.power.x.length >= 2) || (ok(j.eff) && j.eff.y.filter((y) => y > 0).length >= 2);
  };

  // the torque of the motor of a start (decision W-50), from its table j.motor = { x: speeds (% of the rated one), y:
  // torques, yUnit }: in straight lines between its points, its end values held beyond them. → { at(s), sMax } (s the
  // relative speed), or null when the table is not complete: at least 2 points, the speeds rising from 0 %, the torques
  // numbers of a torque unit, the starting torque above zero
  function motorCurve(j) {
    const c = j.motor;
    if (!(c && Array.isArray(c.x) && Array.isArray(c.y) && c.x.length >= 2 && c.x.length === c.y.length)) return null;
    if (!(c.x.every(Number.isFinite) && c.y.every(Number.isFinite) && U.has('torque', c.yUnit))) return null;
    if (c.x[0] !== 0 || !c.x.every((x, i) => i === 0 || x > c.x[i - 1]) || !(c.y[0] > 0)) return null;
    const xs = c.x.map((x) => x / 100), ys = c.y.map((y) => U.toSI(y, c.yUnit, 'torque')), n = xs.length;
    const at = (s) => {
      if (!(s > 0)) return ys[0];
      if (s >= xs[n - 1]) return ys[n - 1];
      let i = 1;
      while (s > xs[i]) i++;
      return ys[i - 1] + (s - xs[i - 1]) / (xs[i] - xs[i - 1]) * (ys[i] - ys[i - 1]);
    };
    return { at, sMax: xs[n - 1] };
  }

  // ---------- four quadrants
  // the four-quadrant data of a pump, in use: on a pump with a curve (not sizing)
  const fourOn = (j) => !!(j.fourQuad && typeof j.fourQuad === 'object' && j.fourQuad.use && j.mode !== 'fixedFlow' && j.mode !== 'ratio');
  // the table of Suter, periodic: θ in degrees rising from 0 to 360, at least 9 points, WH and WB at 360° those of 0°.
  // → at(θ°) = [WH, WB] in straight lines, or null when it is not complete
  function suterTable(fq) {
    const th = fq && fq.theta, wh = fq && fq.wh, wb = fq && fq.wb;
    if (!(Array.isArray(th) && Array.isArray(wh) && Array.isArray(wb) && th.length >= FOUR_MIN_POINTS && th.length === wh.length && th.length === wb.length)) return null;
    if (!(th.every(Number.isFinite) && wh.every(Number.isFinite) && wb.every(Number.isFinite))) return null;
    const n = th.length;
    if (th[0] !== 0 || th[n - 1] !== 360 || !th.every((x, i) => i === 0 || x > th[i - 1])) return null;
    if (wh[0] !== wh[n - 1] || wb[0] !== wb[n - 1]) return null;
    const at = (x) => {
      if (!(x > 0)) return [wh[0], wb[0]];
      if (x >= 360) return [wh[n - 1], wb[n - 1]];
      let i = 1;
      while (x > th[i]) i++;
      const w = (x - th[i - 1]) / (th[i] - th[i - 1]);
      return [wh[i - 1] + w * (wh[i] - wh[i - 1]), wb[i - 1] + w * (wb[i] - wb[i - 1])];
    };
    return { at };
  }
  const DEG = 180 / Math.PI;
  // θ of a point (degrees, from 0 to 360): π + atan2(v, α)
  const thetaOf = (a, v) => (Math.PI + Math.atan2(v, a)) * DEG;

  // the best efficiency point at the rated speed (the reference 'bep'): the largest efficiency over the range of the
  // efficiency data (its curve), or of the curve of power (ρg·Q·H1/P1). → { Q (per pump, m³/s), eta } or null
  function bepOf(j, headCurve, rho, g) {
    const ef = j.eff;
    let eta = null, lo = NaN, hi = NaN;
    if (ef && Array.isArray(ef.x) && ef.x.length >= 2 && ef.x.length === ef.y.length && ef.x.every(Number.isFinite) && ef.y.every(Number.isFinite) && U.has('volFlow', ef.xUnit) && ef.y.filter((y) => y > 0).length >= 2) {
      const xs = ef.x.map((x) => U.toSI(x, ef.xUnit, 'volFlow'));
      const c = H.makeCurve(xs, ef.y.map((y) => y / 100), ef.fit || '2');
      eta = (Q) => H.evalCurve(c, Q);
      lo = Math.min(...xs); hi = Math.max(...xs);
    } else {
      const P1 = powerCurve(j, headCurve, rho, g), pw = j.power;
      if (!P1 || !pw || !Array.isArray(pw.x)) return null;
      const xs = pw.x.map((x) => U.toSI(x, pw.xUnit, 'volFlow'));
      eta = (Q) => rho * g * Q * H.evalCurve(headCurve, Q) / H.evalCurve(P1, Q);
      lo = Math.min(...xs); hi = Math.max(...xs);
    }
    if (!(hi > lo)) return null;
    // a search over the range, then golden sections around the best point
    const N = 2000;
    let best = lo, bv = -Infinity;
    for (let i = 0; i <= N; i++) { const Q = lo + (hi - lo) * i / N, v = eta(Q); if (v > bv) { bv = v; best = Q; } }
    let a = Math.max(lo, best - (hi - lo) / N), b = Math.min(hi, best + (hi - lo) / N);
    const gr = (Math.sqrt(5) - 1) / 2;
    for (let i = 0; i < 100 && b - a > 1e-13 * Math.max(Math.abs(b), 1e-9); i++) {
      const c = b - gr * (b - a), d = a + gr * (b - a);
      if (eta(c) >= eta(d)) b = d; else a = c;
    }
    const Q = (a + b) / 2;
    return eta(Q) > 0 ? { Q, eta: eta(Q) } : null;
  }

  // the checklist of the four-quadrant data (keys under surge.checklist.pump)
  function validateFour(j, miss, v) {
    const fq = j.fourQuad;
    if (!suterTable(fq)) miss.push('pump.fourTable');
    if (!FOUR_REFS.includes(fq.ref)) { miss.push('pump.fourRef'); return; }
    if (fq.ref === 'steady' && !(j.state === 'on')) miss.push('pump.fourSteady');
    if (fq.ref === 'bep' && !hasPower(j)) miss.push('pump.fourBep');
    if (fq.ref === 'user') {
      const q = (x, cat) => v.pos(x) && U.has(cat, x.unit);
      if (!(q(fq.Q, 'volFlow') && q(fq.H, 'head') && q(fq.N, 'rotation') && q(fq.P, 'power'))) miss.push('pump.fourUser');
    }
    if (fq.ref !== 'steady' && !(v.pos(j.rpm) && U.has('rotation', j.rpm.unit))) miss.push('pump.rpm');
  }

  // the checklist of a pump in the water hammer (§11.6, item 7): a table or a trip needs a running pump on its curve, a
  // start a pump on its curve stopped and closed (a table of speed too, with the four-quadrant data: a start with a known
  // speed); a trip or a start also its inertia, its rated speed and its shaft power (a curve of power or of efficiency,
  // which a start in four quadrants does without), and a start the torque of its motor and the curve of its head
  function validate(j, miss, v) {
    const four = fourOn(j);
    if (four) validateFour(j, miss, v);
    if (!v.data) return;
    const start = v.data.what === 'start';
    const speedStart = v.data.what === 'speed' && four && j.mode === 'curve' && j.state === 'offClosed';
    if (start ? !(j.mode === 'curve' && j.state === 'offClosed') : !(speedStart || (j.mode === 'curve' && j.state === 'on'))) { miss.push(start ? 'pump.startState' : 'pump.mode'); return; }
    if (speedStart && !v.curveOk(j.curve)) miss.push('pump.curve');
    if (v.data.what !== 'trip' && !start) return;
    if (!(v.pos(j.inertia) && U.has('inertia', j.inertia.unit))) miss.push('pump.inertia');
    if (!(v.pos(j.rpm) && U.has('rotation', j.rpm.unit))) miss.push('pump.rpm');
    if (!(start && four) && !hasPower(j)) miss.push('pump.power');
    if (!start) return;
    // a pump that is off has its curve checked here only
    if (!v.curveOk(j.curve)) miss.push('pump.curve');
    if (!motorCurve(j)) miss.push('pump.motor');
  }

  function boundary(j, ctx) {
    const { net, def, portOf } = ctx;
    const { pr, pin, pout } = ctx.elementPorts(net, j, portOf);
    const rho = net.env.rho, g = net.env.g;
    const jc = M.clone(j);
    const lk = ctx.elementShape(net, jc, def, pr.in.id, pr.out.id);
    const e = { pin, pout, rho, sc: net.mScale };
    for (const pt of [pin, pout]) if (pt) ctx.attach(net, pt, jc, net.si(jc.elevation, 'length'), false);
    const res = net.res, row0 = res.junctions[j.id] || {}, pr0 = res.pumps[j.id] || {};
    const m00 = Number.isFinite(row0.m) ? row0.m : 0;
    const running = j.state === 'on' && j.mode !== 'fixedFlow' && !!lk.curve;
    // a pump stopped and closed on its curve may start (decision W-50): the curve of its head from a copy of it running
    const startable = j.state === 'offClosed' && j.mode === 'curve';
    let lkRun = lk;
    if (startable) { try { lkRun = ctx.elementShape(net, Object.assign(M.clone(j), { state: 'on' }), def, pr.in.id, pr.out.id); } catch (err) { lkRun = lk; } }
    const curve = lkRun.curve;
    // the speed of the steady state: that of the junction on its curve, the one found under control
    const controlled = running && j.mode !== 'curve';
    let s0 = running ? (controlled ? pr0.speed / 100 : lk.s) : 0;
    if (controlled && !(s0 > 0)) { net.warn('warning', 'surge.warn.pumpSpeedUnknown', { id: j.id }, 'j:' + j.id); s0 = lk.s; }
    const N = lkRun.N || 1;
    const Hof = (Q, s) => { const sf = Math.max(s, S_MIN); return sf * sf * H.evalCurve(curve, Q / (N * sf)); };
    // a pump off, or sizing: the law of the steady state (closed, a free passage, or the flow)
    const fixedLaw = running ? null : lk.mode === 'closed' ? { mode: 'closed' } : lk.mode === 'fixedFlow' ? { mode: 'fixedFlow', value: lk.value } : { mode: 'loss', phi: lk.phi || (() => 0) };
    // the inertia data of a trip or a start
    const wr = j.rpm && Number.isFinite(j.rpm.value) && U.has('rotation', j.rpm.unit) ? U.toSI(j.rpm.value, j.rpm.unit, 'rotation') : NaN;
    const I = j.inertia && Number.isFinite(j.inertia.value) && U.has('inertia', j.inertia.unit) ? U.toSI(j.inertia.value, j.inertia.unit, 'inertia') : NaN;
    let P1 = null;
    try { P1 = (running || startable) && curve ? powerCurve(j, curve, rho, g) : null; } catch (err) { P1 = null; }
    // the gain and the torque of the curves of the steady state, by the affinity laws
    const gainCurve = (m, s) => rho * g * Hof(m / rho, s);
    const torqueCurve = (m, s) => {
      if (!P1) return NaN;
      const sf = Math.max(s, S_MIN);
      return sf * sf * H.evalCurve(P1, m / rho / (N * sf)) / wr;
    };
    // the four-quadrant data in use, from its reference point and scales
    const four = fourOn(j) && (running || startable) && curve ? fourOf(j) : null;
    const gain = four ? four.gain : gainCurve;
    const torque = four ? four.torque : torqueCurve;
    // the law at the speed s: the steady law itself at the speed of the steady state on its curve
    const steadyLaw = running && !controlled && !four ? { mode: 'loss', phi: lk.phi } : null;
    const lawAt = (s) => (steadyLaw && s === s0 ? steadyLaw : { mode: 'loss', phi: (m) => -gain(m, s) });
    // the torque of the motor of a start
    const motor = startable ? motorCurve(j) : null;
    const Tm = (s) => (motor ? motor.at(s) : 0);
    // a pump that lets no flow back: one with its own check valve, and any pump once tripped or started (without the
    // four-quadrant data); a pump that starts is held by it until it overcomes the difference across it
    const steadyCheck = res.states ? res.states[j.id] : undefined;
    const st0 = {
      m: m00, P1: row0.P0in, P2: row0.P0out, V1: 0, V2: 0,
      s: s0, T: running ? torque(m00, s0) : startable ? 0 : NaN, check: startable || steadyCheck === 'shut' ? 'shut' : 'run', tripped: false, started: false,
      revFlow: false, revSpeed: false,
    };
    let sTable = NaN; // the speed of a table in the step (relative)
    let tripMode = false, startMode = false, speedMode = false; // the junction has a trip, a start or a table of speed in its data
    // turning: running in the steady state, started, or driven by a table of speed from rest
    const turning = () => running || b.st.started || (startable && speedMode);

    // the four-quadrant data: the reference point and the scales of the table at the steady state
    function fourOf(jj) {
      const fq = jj.fourQuad, tb = suterTable(fq);
      if (!tb) throw new Error(t('surge.error.fourTable'));
      let QR, HR, TR, sR;
      if (fq.ref === 'steady') {
        // the steady point of each pump: it must pump
        if (!(running && m00 > 0)) throw new Error(t('surge.error.fourSteady'));
        QR = m00 / (rho * N); HR = Hof(m00 / rho, s0); TR = torqueCurve(m00, s0); sR = s0;
      } else if (fq.ref === 'bep') {
        const bp = bepOf(jj, curve, rho, g);
        if (!bp) throw new Error(t('surge.error.fourBep'));
        QR = bp.Q; HR = H.evalCurve(curve, QR); TR = rho * g * QR * HR / (bp.eta * wr); sR = 1;
      } else {
        const q = (x, cat) => U.toSI(x.value, x.unit, cat);
        QR = q(fq.Q, 'volFlow'); HR = q(fq.H, 'head'); const wR = q(fq.N, 'rotation'); TR = q(fq.P, 'power') / wR; sR = wR / wr;
      }
      if (!(QR > 0 && HR > 0 && sR > 0)) throw new Error(t('surge.error.fourRef'));
      // the head and the torque of the table at a point, without the scales
      const raw = (m, s) => {
        const a = s / sR, v = m / (rho * N * QR), r2 = a * a + v * v;
        if (!(r2 > 0)) return [0, 0];
        const w = tb.at(thetaOf(a, v));
        return [r2 * w[0], r2 * w[1]];
      };
      // the scales that make the table meet the steady state; 1 for a pump at rest
      let cH = 1, cB = 1;
      if (running) {
        const r = raw(m00, s0);
        cH = (Hof(m00 / rho, s0) / HR) / r[0];
        const T0 = torqueCurve(m00, s0);
        cB = Number.isFinite(T0) && Number.isFinite(TR) ? (T0 / TR) / r[1] : 1;
        if (!(Number.isFinite(cH) && cH > 0 && Number.isFinite(cB) && cB > 0)) throw new Error(t('surge.error.fourScale'));
        if (Math.abs(cH - 1) > SCALE_CAUTION || Math.abs(cB - 1) > SCALE_CAUTION) net.warn('caution', 'surge.warn.fourScale', { id: jj.id, cH, cB }, 'j:' + jj.id);
      }
      const kH = rho * g * HR * cH, kB = TR * cB;
      return {
        ref: fq.ref, QR, HR, TR, NR: sR * wr, cH, cB,
        gain: (m, s) => kH * raw(m, s)[0],
        torque: (m, s) => kB * raw(m, s)[1],
      };
    }

    const b = {
      jid: j.id, j, jc, def, ports: [pin, pout].filter(Boolean), kind: 'pump', e,
      st: st0, nx: null,
      fields: ['P1', 'P2', 'm', 's', 'dH', 'T'],
      input(jt, v) { if (jt.what === 'speed') sTable = v / 100; },
      // the data of the junction holds a trip, a start or a table of speed: without the four-quadrant data the pump lets
      // no flow back from the beginning of the run (a trip or a start)
      prepare(jt) {
        if (jt && jt.trip) { if (jt.what === 'start') startMode = true; else tripMode = true; }
        else if (jt && jt.what === 'speed') speedMode = true;
      },
      // the torque of the motor is gone (a trip) or there (a start) from the end of this step on
      trip(what) {
        if (what === 'start') { if (startable && !b.st.started) b.st = Object.assign({}, b.st, { started: true }); return; }
        if (!b.st.tripped) b.st = Object.assign({}, b.st, { tripped: true });
      },
      // the reference point and the scales of the four-quadrant data, for the results
      info: () => (four ? { fourQuad: { ref: four.ref, QR: four.QR, HR: four.HR, TR: four.TR, NR: four.NR, cH: four.cH, cB: four.cB } } : null),
      solve(S) {
        const st = b.st;
        if (fixedLaw && !st.started && !(startable && speedMode && four)) {
          const x = ctx.elementStep(e, fixedLaw, S, st);
          if (!x.ok) net.rootFailed(j.id, S);
          ctx.elementWrite(e, x);
          b.nx = Object.assign({}, st, { m: x.m, P1: x.P1, P2: x.P2, V1: x.V1, V2: x.V2 });
          return;
        }
        const noRev = four ? !!j.noReverse : !!j.noReverse || tripMode || startMode;
        // a solution at the speed s with the check of the pump: it closes when the flow would go back (with noRev), and
        // opens once its head at no flow overcomes the difference across it
        const solveAt = (s, check) => {
          let c = check;
          let x = ctx.elementStep(e, c === 'shut' ? { mode: 'closed' } : lawAt(s), S, st);
          if (c === 'run' && noRev && x.m < 0) { c = 'shut'; x = ctx.elementStep(e, { mode: 'closed' }, S, st); }
          else if (c === 'shut' && gain(0, s) > x.P2 - x.P1) {
            const y = ctx.elementStep(e, lawAt(s), S, st);
            if (!(y.m < 0)) { c = 'run'; x = y; }
          }
          return { x, c };
        };
        let s, r;
        if (st.tripped && !S.test && !four) {
          // the trapezoid rule on the speed, iterated with the solution of the step
          const k = S.dt / (2 * I * wr);
          let sEst = Math.max(0, st.s - 2 * k * st.T);
          let ok = false;
          for (let it = 0; it < SPEED_IT; it++) {
            r = solveAt(sEst, st.check);
            const Tk = torque(r.x.m, sEst);
            const sNew = Math.max(0, st.s - k * (st.T + Tk));
            if (Math.abs(sNew - sEst) < SPEED_TOL) { sEst = sNew; ok = true; break; }
            sEst = sNew;
          }
          if (!ok) net.warnOnce('warning', 'surge.warn.pumpSpeedIteration', { id: j.id, t: S.t }, 'j:' + j.id);
          s = sEst;
          r = solveAt(s, st.check);
        } else if ((st.started || (st.tripped && four)) && !S.test) {
          // a start, or a trip in four quadrants: s_k = s_{k−1} + Δt/(2·I·ω_r)·[Tm(s_{k−1}) − T_{k−1} + Tm(s_k) − T_k],
          // the root in s_k with the solution of the step at that speed (after a trip the motor gives no torque at
          // either end of the step, §8.3); without the four-quadrant data the speed stays above zero
          const k = S.dt / (2 * I * wr), started = st.started, old = (started ? Tm(st.s) : 0) - st.T;
          const sOf = (x) => (four ? x : Math.max(0, x));
          const F = (x) => { const s1 = sOf(x); return x - st.s - k * (old + (started ? Tm(s1) : 0) - torque(solveAt(s1, st.check).x.m, s1)); };
          const rr = BD().root(F, sOf(st.s + 2 * k * old), 1e-6);
          if (!rr.ok) net.rootFailed(j.id, S);
          s = sOf(rr.x);
          r = solveAt(s, st.check);
          // past the last point of the table of its motor, whose last torque it keeps
          if (started && motor && s > motor.sMax * (1 + 1e-9)) net.warnOnce('caution', 'surge.warn.motorBeyond', { id: j.id, t: S.t }, 'j:' + j.id);
        } else {
          s = Number.isFinite(sTable) && !S.testNoTable ? sTable : st.s;
          r = solveAt(s, st.check);
        }
        if (!r.x.ok) net.rootFailed(j.id, S);
        ctx.elementWrite(e, r.x);
        const T = torque(r.x.m, s);
        b.nx = { m: r.x.m, P1: r.x.P1, P2: r.x.P2, V1: r.x.V1, V2: r.x.V2, s, T, check: r.c, tripped: st.tripped, started: st.started, revFlow: st.revFlow, revSpeed: st.revSpeed };
        if (four) {
          // the first reversal of the flow and of the speed, in the log
          if (!S.test && !st.revFlow && r.x.m < 0) { b.nx.revFlow = true; net.log(S.t, 'j:' + j.id, 'event', 'surge.log.pumpFlowReversed'); }
          if (!S.test && !st.revSpeed && s < 0) { b.nx.revSpeed = true; net.log(S.t, 'j:' + j.id, 'event', 'surge.log.pumpSpeedReversed'); }
        } else if (r.c === 'run' && r.x.m > 0 && s > 0 && r.x.m / rho / (N * Math.max(s, S_MIN)) > curve.xmax * 1.0001) {
          // past the end of its curve (the four-quadrant data would be needed)
          net.warnOnce('warning', 'surge.warn.pumpBeyondCurve', { id: j.id, t: S.t }, 'j:' + j.id);
        }
      },
      commit() {
        b.st = b.nx;
        // the copy of the junction follows the pump: running while it turns (the conditions on its state)
        jc.speed = (b.st.s || 0) * 100;
        jc.state = turning() ? (b.st.s !== 0 ? 'on' : 'offClosed') : j.state;
      },
      stateName: () => (turning() ? b.st.check : undefined),
      values(o) {
        const st = b.st;
        o[0] = st.P1; o[1] = st.P2; o[2] = st.m; o[3] = turning() ? st.s * 100 : 0; o[4] = (st.P2 - st.P1) / (rho * g); o[5] = st.T;
      },
      row() {
        const st = b.st;
        const vel = (pt) => (pt ? Math.abs((pt.pipe.mU[pt.i] + pt.pipe.mD[pt.i]) / 2) / (rho * pt.pipe.A) : 0);
        const Vi = vel(pin), Vo = vel(pout);
        return {
          junction: { P0in: st.P1, P0out: st.P2, Pin: st.P1 - rho * Vi * Vi / 2, Pout: st.P2 - rho * Vo * Vo / 2, m: st.m, Q: st.m / rho },
          pump: { speed: turning() ? st.s * 100 : 0, Q: st.m / rho, dH: (st.P2 - st.P1) / (rho * g) },
        };
      },
    };
    return b;
  }

  PumpIt.surge = Object.assign(PumpIt.surge || {}, {
    pumps: { S_MIN, FOUR_REFS, FOUR_MIN_POINTS, powerCurve, hasPower, motorCurve, fourOn, suterTable, thetaOf, bepOf, validate, boundary },
  });
})(typeof window !== 'undefined' ? window : globalThis);
