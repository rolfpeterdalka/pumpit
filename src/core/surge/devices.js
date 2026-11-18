// Protection devices and special ends of the water hammer (docs/water-hammer.md; §6 of its specification, phase G2).
// Each one is the boundary of a single-node junction (src/core/surge/boundaries.js), which the surge hook of its type
// gives:
//
//   surge tank        an open tank on the node; its level follows the flow into it by the trapezoid rule, solved with
//                     the node in the same step (decision W-23). Optionally an orifice with its own loss each way, a
//                     short riser whose column has inertia, a check that only lets the tank feed the network, a top
//                     where it overflows and a bottom where it runs empty
//   air vessel        a closed vessel whose gas follows P·Vg^n = C (decision W-21), with the same orifice and riser, and
//                     optionally the geometry that gives the level of its liquid and the limits of its gas volume
//   relief valve      a discharge from the node, closed in the steady state, opened by the pressure of the node (or by a
//                     table of its opening, a pilot valve), its Cv linear between the opening and the full opening
//                     pressures (decision W-20)
//   air valve         air held at the node, let in and out through orifices (Wylie and Streeter): ideal air, isothermal
//                     in the cavity (decision W-22)
//   infinite pipe     an imposed pressure or flow whose end lets the waves out: the characteristic from outside is that
//                     of the steady state (§6.5)
//   finite reservoir  a reservoir with a tank (src/core/time/tanks.js): its level follows the net flow into it, with the
//                     rules of the time simulation for full and empty tanks (§6.6)
//
// Every scalar equation is monotonic and solved by the protected Newton of the boundaries (§5.12). The pressures are
// absolute and of stagnation, the flows mass flows, as everywhere in the water hammer.
(function (root) {
  const PumpIt = root.PumpIt;
  const M = PumpIt.model, U = PumpIt.units;
  const { t } = PumpIt.i18n;
  const { GAL_MIN } = PumpIt.solver.util;
  const BD = () => PumpIt.surge.boundaries;
  const MOC = () => PumpIt.surge.moc;
  const TK = () => PumpIt.time.tanks;

  const fin = (x) => !!(x && Number.isFinite(x.value));
  const has = (x, cat) => fin(x) && U.has(cat, x.unit);

  // ---------- air (§6.4): ideal, R = 287.05 J/(kg·K), k = 1.4 (decision W-22)
  const AIR = { R: 287.05, k: 1.4 };
  const RC = Math.pow(2 / (AIR.k + 1), AIR.k / (AIR.k - 1)); // the critical pressure ratio, 0.52828
  const SONIC = Math.pow(2 / (AIR.k + 1), (AIR.k + 1) / (2 * (AIR.k - 1)));
  // the mass flow of air through an orifice of area Cd·A from a side at pu (absolute) and Tu to a side at pd < pu:
  // sonic at or below the critical ratio, subsonic above it
  function orificeAir(CdA, pu, Tu, pd) {
    if (!(CdA > 0) || !(pu > pd)) return 0;
    const { R, k } = AIR;
    if (pd <= RC * pu) return CdA * pu * Math.sqrt(k / (R * Tu)) * SONIC;
    const r = pd / pu, rho = pu / (R * Tu);
    return CdA * Math.sqrt(2 * k / (k - 1) * pu * rho * (Math.pow(r, 2 / k) - Math.pow(r, (k + 1) / k)));
  }
  // the air flow into an air valve (kg/s, negative out), with p inside, p0 and T0 outside and the air inside at T
  const airFlow = (CdAin, CdAout, p, p0, T0, T) => (p < p0 ? orificeAir(CdAin, p0, T0, p) : p > p0 ? -orificeAir(CdAout, p, T, p0) : 0);

  // ---------- pieces shared by the devices
  // a root of an increasing function: the protected Newton of the boundaries, then bisection when it did not settle (the
  // air flow next to the outside pressure goes as a square root, whose slope there has no bound)
  function rootUp(F, x0, sc) {
    const r = BD().root(F, x0, sc);
    if (r.ok) return r;
    const tol = (x) => 1e-12 * Math.max(Math.abs(x), sc);
    let a = r.x, b = r.x, fa = F(a), fb = fa, step = tol(r.x) * 1e3;
    for (let i = 0; i < 200 && fa > 0; i++) { a -= step; step *= 2; fa = F(a); }
    step = tol(r.x) * 1e3;
    for (let i = 0; i < 200 && fb < 0; i++) { b += step; step *= 2; fb = F(b); }
    if (!(fa <= 0 && fb >= 0)) return r;
    for (let i = 0; i < 300; i++) {
      const x = (a + b) / 2;
      if (b - a <= tol(x)) return { x, ok: true };
      const fx = F(x);
      if (fx === 0) return { x, ok: true };
      if (fx < 0) a = x; else b = x;
    }
    return { x: (a + b) / 2, ok: true };
  }
  // the pipes at a single-node junction, attached as its ports at the elevation z (the losses of their ends)
  function portsOf(ctx, j, jc, z, isRes = false) {
    const { net, portOf } = ctx;
    const ports = [];
    for (const p of M.pipesAt(net.eff, j.id)) { const pt = portOf(p.id, j.id); if (pt) ports.push(pt); }
    for (const pt of ports) BD().attach(net, pt, jc, z, isRes);
    return ports;
  }
  // the flow into the junction from all its ports at its pressure P, for the characteristics of the step: Σ (C − hz −
  // P)/B without losses at the ends of the pipes, a root per port with them
  function inflow(ports, sc) {
    if (ports.every((pt) => !MOC().hasLoss(pt))) {
      let a = 0, b = 0;
      for (const pt of ports) { a += (pt.C - pt.hz) / pt.B; b += 1 / pt.B; }
      return (P) => a - b * P;
    }
    return (P) => { let s = 0; for (const pt of ports) s += BD().portQ(pt, P, sc).q; return s; };
  }
  // the stations of the ports as liquid with the junction at the pressure P; → the flow into the junction
  function writePorts(ports, P, sc) {
    let s = 0;
    for (const pt of ports) { const q = BD().portQ(pt, P, sc).q; MOC().portSet(pt, pt.C - pt.B * q, q, q, 0); s += q; }
    return s;
  }
  // a row of results of a node as the steady results give it, for the conditions of events (§8.4)
  function nodeRow(net, ports, P, netFlow) {
    let vin = 0, vout = 0;
    for (const pt of ports) {
      const p = pt.pipe, i = pt.i, mm = (p.mU[i] + p.mD[i]) / 2, V = Math.abs(mm) / (net.env.rho * p.A);
      const into = pt.down ? mm : -mm;
      if (into >= 0) vin = Math.max(vin, V); else vout = Math.max(vout, V);
    }
    const r = net.env.rho;
    return { junction: { P0in: P, P0out: P, Pin: P - r * vin * vin / 2, Pout: P - r * vout * vout / 2, m: Math.abs(netFlow), net: netFlow } };
  }
  // the smallest volume of a section next to a junction (the point models of air and gas lose their meaning above it)
  const sectionVolume = (ports) => ports.reduce((v, pt) => Math.min(v, pt.pipe.A * pt.pipe.L / pt.pipe.n), Infinity);

  // the shape of a tank or a vessel: a constant section or a table of volume by height over its bottom, as the finite
  // tanks of the time simulation (their volume and height functions follow the end segments of a table beyond it)
  function shapeOf(j, si) {
    if (j.shape === 'table') {
      return { hs: j.table.h.map((x) => U.toSI(x, j.table.hUnit, 'length')), Vs: j.table.V.map((x) => U.toSI(x, j.table.vUnit, 'volume')), R: 0 };
    }
    return { A: si(j.area, 'area'), R: 0 };
  }
  const volumeAt = (T, h) => TK().volumeOf(T, h);
  const heightAt = (T, V) => TK().levelOf(T, V);
  // the bottom of a tank, by default at the elevation of its junction
  const bottomOf = (j, si, z) => (has(j.bottom, 'length') ? si(j.bottom, 'length') : z);

  // the connection of a tank or a vessel to its node: an orifice with a loss into it and another out of it,
  // ΔP = ṁ|ṁ|/(2ρ(Cd·A)²), and a short riser whose column has the inertia L/A and the friction f·L/D
  function connectionOf(j, si, rho) {
    const k = (x) => (has(x, 'area') && x.value > 0 ? 1 / (2 * rho * Math.pow(si(x, 'area'), 2)) : 0);
    const c = { kIn: 0, kOut: 0, I: 0, kf: 0 };
    if (j.orifice) { c.kIn = k(j.CdAin); c.kOut = k(j.CdAout); }
    if (j.riser) {
      const L = si(j.riserL, 'length'), D = si(j.riserD, 'length'), A = Math.PI * D * D / 4;
      c.I = L / A;
      c.kf = (Number.isFinite(j.riserF) ? j.riserF : 0) * L / D / (2 * rho * A * A);
    }
    return c;
  }
  // the loss of the connection with the flow m into the tank (Pa, with the sign of m)
  const connLoss = (c, m) => (m >= 0 ? c.kIn + c.kf : c.kOut + c.kf) * m * Math.abs(m);
  // the driving pressure of the riser at the end of a step with the flow m, by the trapezoid rule on its momentum:
  // (L/A)·dṁ/dt = F, F = P_node − P_tank − losses, so F_k = 2(L/A)(ṁ_k − ṁ_k−1)/Δt − F_k−1 (none without a riser)
  const riserF = (c, m, st, dt) => (c.I > 0 ? 2 * c.I * (m - st.m) / dt - st.F : 0);

  // ---------- surge tank (§6.1)
  function surgeTank(j, ctx) {
    const { net } = ctx;
    const env = net.env, rho = env.rho, g = env.g, si = net.si, sc = net.mScale;
    const jc = M.clone(j);
    const zN = si(jc.elevation, 'length');
    const ports = portsOf(ctx, j, jc, zN);
    const T = shapeOf(jc, si);
    const zb = bottomOf(jc, si, zN);
    const H = has(jc.height, 'length') && jc.height.value > 0 ? si(jc.height, 'length') : Infinity;
    const Vmax = Number.isFinite(H) ? volumeAt(T, H) : Infinity;
    const c = connectionOf(jc, si, rho);
    const oneWay = !!jc.oneWay;
    const row0 = net.res.junctions[j.id] || {};
    const P0 = row0.P0in;
    // the level of the steady state: the one given, or the equilibrium with the pressure of the node
    const zs0 = jc.level === 'given' ? si(jc.liquidElev, 'length') : zN + (P0 - env.patm) / (rho * g);
    let V0 = volumeAt(T, zs0 - zb), mode0 = 'normal';
    if (V0 > Vmax) { net.warn('warning', 'surge.warn.tankAboveTop', { id: j.id }, 'j:' + j.id); V0 = Vmax; mode0 = 'full'; }
    if (V0 < 0) { net.warn('warning', 'surge.warn.tankBelowBottom', { id: j.id }, 'j:' + j.id); V0 = 0; mode0 = 'empty'; }
    // the pressure of the tank at the elevation of the node, with the volume V
    const Ptank = (V) => env.patm + rho * g * (zb + heightAt(T, V) - zN);
    const Pbottom = env.patm + rho * g * (zb - zN);
    const b = {
      jid: j.id, j, jc, def: ctx.def, ports, kind: 'surgeTank',
      // the pressure of the node, the volume of liquid, the flow into the tank, the driving pressure of its riser, the
      // state (normal, full: at its top, empty: at its bottom, closed: its check holds), the volumes overflowed and missing
      st: { P: P0, V: V0, m: 0, F: 0, mode: mode0, over: 0, deficit: 0 },
      nx: null,
      fields: ['P', 'level', 'mt'],
      input() {},
      solve(S) {
        const st = b.st, dt = S.dt, k2 = dt / (2 * rho);
        const Q = inflow(ports, sc);
        const Vof = (m) => st.V + k2 * (m + st.m);
        // the node with the flow m into the tank: the level of its volume (or its top), the connection and the riser
        const Pnode = (m, full) => (full ? Ptank(Vmax) : Ptank(Vof(m))) + connLoss(c, m) + riserF(c, m, st, dt);
        const attempt = (mode) => {
          if (mode === 'empty') { const m = Q(Pbottom); return { mode, m, P: Pbottom, V: 0 }; }
          const full = mode === 'full';
          const r = BD().root((m) => Q(Pnode(m, full)) - m, st.m, sc);
          if (!r.ok) net.rootFailed(j.id, S);
          return { mode, m: r.x, P: Pnode(r.x, full), V: full ? Vmax : Vof(r.x) };
        };
        let x;
        if (st.mode === 'empty') {
          // a pressure end at its bottom, letting liquid only into the network; liquid coming back fills it again
          x = attempt('empty');
          if (x.m > 0) x = attempt('normal');
        } else if (st.mode === 'full') {
          // at its top while liquid comes in; the level falls once more leaves than comes in
          x = attempt('full');
          if (Vof(x.m) < Vmax) x = attempt('normal');
        } else x = attempt('normal');
        if (x.mode === 'normal') {
          if (x.V > Vmax) x = attempt('full');
          else if (x.V < 0) x = attempt('empty');
        }
        // the check of a one-way tank lets it only feed the network: closed, the node is a node of pipes alone
        if (oneWay && x.m > 0 && !S.test) {
          const Pb = BD().root((P) => Q(P), st.P, net.pScale);
          if (!Pb.ok) net.rootFailed(j.id, S);
          x = { mode: 'closed', m: 0, P: Pb.x, V: Math.min(Vmax, Math.max(0, Vof(0))) };
        }
        let over = st.over, deficit = st.deficit;
        if (x.mode === 'full') over += Math.max(0, Vof(x.m) - Vmax);
        if (x.mode === 'empty') deficit += Math.max(0, -Vof(x.m));
        writePorts(ports, x.P, sc);
        const F = x.mode === 'empty' || x.mode === 'closed' ? 0 : riserF(c, x.m, st, dt);
        b.nx = { P: x.P, V: x.V, m: x.m, F, mode: x.mode, over, deficit };
        if (!S.test && x.mode !== st.mode) {
          if (x.mode === 'full') net.warnOnce('warning', 'surge.warn.tankFull', { id: j.id, t: S.t }, 'j:' + j.id);
          if (x.mode === 'empty') net.warnOnce('warning', 'surge.warn.tankEmpty', { id: j.id, t: S.t }, 'j:' + j.id);
        }
      },
      commit() { b.st = b.nx; },
      stateName: () => b.st.mode,
      values(o) { const st = b.st; o[0] = st.P; o[1] = zb + heightAt(T, st.V); o[2] = st.m; },
      row: () => nodeRow(net, ports, b.st.P, -b.st.m),
      totals: () => ({ over: b.st.over, deficit: b.st.deficit }),
    };
    return b;
  }

  // ---------- air vessel (§6.2)
  // the gas of the steady state: { Vg0, Pg0 }, given or from the pre-charge P0·V0 = Pg0·Vg0 (isothermal, decision W-21);
  // Pg0 = P_node − ρg(z_liquid − z_node) with a geometry, P_node without it
  function vesselGas(jc, si, P0, liquidP) {
    if (jc.gasInit === 'precharge') {
      const PV = si(jc.Ppre, 'pressure') * si(jc.Vpre, 'volume');
      // with a geometry the level depends on the gas volume: (P0 − liquidP(Vg))·Vg = P0·V0, whose left side grows with Vg
      let Vg = PV / P0;
      for (let it = 0; it < 100; it++) {
        const f = (v) => (P0 - liquidP(v)) * v - PV;
        const h = 1e-7 * Math.max(Vg, 1e-12), d = (f(Vg + h) - f(Vg)) / h;
        const nx = Vg - f(Vg) / d;
        if (!Number.isFinite(nx)) break;
        if (Math.abs(nx - Vg) <= 1e-13 * Math.max(Vg, 1e-12)) { Vg = nx; break; }
        Vg = nx;
      }
      return { Vg0: Vg, Pg0: P0 - liquidP(Vg) };
    }
    const Vg0 = si(jc.Vg0, 'volume');
    return { Vg0, Pg0: P0 - liquidP(Vg0) };
  }

  function airVessel(j, ctx) {
    const { net } = ctx;
    const env = net.env, rho = env.rho, g = env.g, si = net.si, sc = net.mScale;
    const jc = M.clone(j);
    const zN = si(jc.elevation, 'length');
    const ports = portsOf(ctx, j, jc, zN);
    const geo = jc.shape === 'constant' || jc.shape === 'table';
    const T = geo ? shapeOf(jc, si) : null;
    const zb = geo ? bottomOf(jc, si, zN) : zN;
    // the volume of the vessel: that of its geometry up to its height, or the one given (none: no limit)
    const Vtot = geo ? volumeAt(T, si(jc.height, 'length')) : has(jc.vol, 'volume') && jc.vol.value > 0 ? si(jc.vol, 'volume') : Infinity;
    const VgMin = has(jc.vgMin, 'volume') && jc.vgMin.value > 0 ? si(jc.vgMin, 'volume') : 0;
    const n = jc.n;
    const c = connectionOf(jc, si, rho);
    const row0 = net.res.junctions[j.id] || {};
    const P0 = row0.P0in;
    // the pressure of the column of liquid over the node, with the gas volume Vg
    const liquidP = (Vg) => (geo ? rho * g * (zb + heightAt(T, Vtot - Vg) - zN) : 0);
    const { Vg0, Pg0 } = vesselGas(jc, si, P0, liquidP);
    if (!(Vg0 > 0) || !(Pg0 > 0)) throw new Error(t('surge.error.vesselGas', { id: j.id }));
    if (Vg0 > Vtot * (1 + 1e-9)) throw new Error(t('surge.error.vesselTooSmall', { id: j.id }));
    if (Vg0 < VgMin) net.warn('warning', 'surge.warn.vesselBelowMin', { id: j.id }, 'j:' + j.id);
    const C = Pg0 * Math.pow(Vg0, n);
    const floor = 1e-9 * Vg0;
    const Pgas = (Vg) => C / Math.pow(Math.max(Vg, floor), n);
    const b = {
      jid: j.id, j, jc, def: ctx.def, ports, kind: 'airVessel',
      // the pressure of the node, the gas volume and pressure, the flow into the vessel, the driving pressure of its
      // riser, the state (normal, full: the gas at its smallest volume, empty: no liquid left) and the volume missing
      st: { P: P0, Vg: Vg0, Pg: Pg0, m: 0, F: 0, mode: 'normal', deficit: 0 },
      nx: null,
      fields: ['P', 'Pg', 'Vg', 'mt'].concat(geo ? ['level'] : []),
      input() {},
      solve(S) {
        const st = b.st, dt = S.dt, k2 = dt / (2 * rho);
        const Q = inflow(ports, sc);
        const Vof = (m) => st.Vg - k2 * (m + st.m);
        const Pnode = (m, Vg) => Pgas(Vg) + liquidP(Vg) + connLoss(c, m) + riserF(c, m, st, dt);
        const attempt = (mode) => {
          if (mode === 'empty') { const P = Pgas(Vtot) + liquidP(Vtot); return { mode, m: Q(P), P, Vg: Vtot }; }
          const r = BD().root((m) => Q(Pnode(m, Vof(m))) - m, st.m, sc);
          if (!r.ok) net.rootFailed(j.id, S);
          const Vg = Vof(r.x);
          return { mode, m: r.x, P: Pnode(r.x, Vg), Vg };
        };
        let x;
        if (st.mode === 'empty') {
          // the gas reached the volume of the vessel: a pressure end that lets liquid only into the network
          x = attempt('empty');
          if (x.m > 0) x = attempt('normal');
        } else x = attempt('normal');
        if (x.mode === 'normal' && x.Vg > Vtot) x = attempt('empty');
        // the gas at its smallest volume takes no more liquid: the node is a node of pipes alone while liquid would come in
        if (x.mode === 'normal' && x.Vg < VgMin && x.m > 0) {
          const Pb = BD().root((P) => Q(P), st.P, net.pScale);
          if (!Pb.ok) net.rootFailed(j.id, S);
          x = { mode: 'full', m: 0, P: Pb.x, Vg: Math.max(VgMin, Vof(0)) };
        }
        const deficit = st.deficit + (x.mode === 'empty' ? Math.max(0, Vof(x.m) - Vtot) : 0);
        writePorts(ports, x.P, sc);
        const F = x.mode === 'normal' ? riserF(c, x.m, st, dt) : 0;
        b.nx = { P: x.P, Vg: x.Vg, Pg: Pgas(x.Vg), m: x.m, F, mode: x.mode, deficit };
        if (!S.test && x.mode !== st.mode) {
          if (x.mode === 'empty') net.warnOnce('warning', 'surge.warn.vesselEmpty', { id: j.id, t: S.t }, 'j:' + j.id);
          if (x.mode === 'full') net.warnOnce('warning', 'surge.warn.vesselFull', { id: j.id, t: S.t }, 'j:' + j.id);
        }
      },
      commit() { b.st = b.nx; },
      stateName: () => b.st.mode,
      values(o) { const st = b.st; o[0] = st.P; o[1] = st.Pg; o[2] = st.Vg; o[3] = st.m; if (o.length > 4) o[4] = zb + heightAt(T, Vtot - st.Vg); },
      row: () => nodeRow(net, ports, b.st.P, -b.st.m),
      totals: () => ({ deficit: b.st.deficit }),
    };
    return b;
  }

  // ---------- relief valve (§6.3)
  // the flow of a relief valve fully open with the pressure difference dp across it (kg/s): by its Cv (US), its Kv or
  // its Cd·A, with the relations of the valves of the steady state (src/core/junctions/shared.js)
  function reliefCapacity(j, si, rho) {
    let c;
    if (j.lossModel === 'Kv') c = rho * j.Kv / 3600 * Math.sqrt(1000 / (rho * 1e5));
    else if (j.lossModel === 'CdA') c = si(j.CdA, 'area') * Math.sqrt(2 * rho);
    else c = rho * GAL_MIN * j.Cv * Math.sqrt(999.0 / (rho * U.PSI));
    return (dp) => (dp > 0 ? c * Math.sqrt(dp) : 0);
  }

  function reliefValve(j, ctx) {
    const { net, def } = ctx;
    const env = net.env, rho = env.rho, si = net.si, sc = net.mScale;
    const ports = [];
    for (const p of M.pipesAt(net.eff, j.id)) { const pt = ctx.portOf(p.id, j.id); if (pt) ports.push(pt); }
    // closed, it is the node of its type with its discharge closed: the generic node, with its vapour cavities (never the
    // gas cavities, which the protection devices do not hold)
    const gen = ctx.nodeBoundary(net, j, def, ports, { gas: false });
    const jc = gen.jc;
    const Pext = si(jc.Pext, 'pressure');
    const Pa = si(jc.Pset, 'pressure');
    // without a closing pressure it closes at its opening pressure
    const Pf = has(jc.Pclose, 'pressure') ? si(jc.Pclose, 'pressure') : Pa;
    const Pt = has(jc.Pfull, 'pressure') ? si(jc.Pfull, 'pressure') : Pa;
    const instant = jc.mode === 'instant';
    const cap = reliefCapacity(jc, si, rho);
    const rate = Number.isFinite(jc.rate) && jc.rate > 0 ? jc.rate / 100 : Infinity; // of the opening, per second
    // the opening the pressure P asks for: linear between the closing and the full opening pressures, or all at once
    const target = (P) => (instant ? 1 : Pt > Pf ? Math.min(1, Math.max(0, (P - Pf) / (Pt - Pf))) : P > Pf ? 1 : 0);
    // closed in the steady state, whose pressure should stay below its set pressure (§6.3)
    if (gen.st.P > Pa) net.warn('warning', 'surge.warn.reliefSteady', { id: j.id }, 'j:' + j.id);
    let pilot = NaN; // the opening of a table in the step (0 to 1)
    const b = {
      jid: j.id, j, jc, def, ports, kind: 'reliefValve', gen,
      st: { P: gen.st.P, x: 0, mr: 0, state: 'closed' },
      nx: null,
      fields: ['P', 'mr', 'x'],
      input(jt, v) { if (jt.what === 'open') pilot = Math.min(1, Math.max(0, v / 100)); },
      solve(S) {
        const st = b.st, dt = S.dt;
        const lo = Math.max(0, st.x - rate * dt), hi = Math.min(1, st.x + rate * dt);
        const clamp = (x) => Math.min(hi, Math.max(lo, x));
        const Q = inflow(ports, sc);
        // the node with the valve open at the opening x(P): Σq(P) = ṁ_relief(P), decreasing in P
        const open = (xOf) => {
          const r = BD().root((P) => Q(P) - xOf(P) * cap(P - Pext), Number.isFinite(st.P) ? st.P : Pa, net.pScale);
          if (!r.ok) net.rootFailed(j.id, S);
          const P = r.x, x = xOf(P), mr = x * cap(P - Pext);
          const into = writePorts(ports, P, sc);
          gen.nx = { P, V: 0, out: 0, ext: gen.st.ext.slice(), net: into };
          return { P, x, mr };
        };
        const closed = () => { gen.solve(S); return { P: gen.nx.P, x: 0, mr: 0 }; };
        let y, state = st.state;
        if (Number.isFinite(pilot) && !S.test) {
          // a pilot valve: the opening of its table
          const x = clamp(pilot);
          y = x > 0 ? open(() => x) : closed();
          state = y.x > 0 ? 'open' : 'closed';
        } else if (st.state === 'closed' || S.test) {
          y = closed();
          // it opens in the step where the pressure of the node passes the opening pressure (none in the test step)
          if (!S.test && y.P > Pa) { y = open((P) => clamp(target(P))); state = y.x > 0 ? 'open' : 'closed'; }
        } else {
          y = open((P) => clamp(target(P)));
          // it closes once the pressure falls to the closing pressure
          if (y.P <= Pf) {
            const z = clamp(0);
            y = z > 0 ? open(() => z) : closed();
            state = y.x > 0 ? 'open' : 'closed';
          } else state = 'open';
        }
        b.nx = { P: y.P, x: y.x, mr: y.mr, state };
      },
      commit() { gen.commit(); b.st = b.nx; },
      stateName: () => b.st.state,
      values(o) { const st = b.st; o[0] = st.P; o[1] = st.mr; o[2] = st.x * 100; },
      row: () => nodeRow(net, ports, b.st.P, -b.st.mr),
    };
    return b;
  }

  // ---------- air valve (§6.4)
  const AIR_TYPES = ['both', 'in', 'out', 'twoStage'];
  function airValve(j, ctx) {
    const { net, def } = ctx;
    const env = net.env, rho = env.rho, si = net.si, sc = net.mScale;
    const ports = [];
    for (const p of M.pipesAt(net.eff, j.id)) { const pt = ctx.portOf(p.id, j.id); if (pt) ports.push(pt); }
    // without air it is the node of its pipes, with its vapour cavities (never the gas cavities)
    const gen = ctx.nodeBoundary(net, j, def, ports, { gas: false });
    const jc = gen.jc;
    const area = (x) => (has(x, 'area') && x.value > 0 ? si(x, 'area') : 0);
    const kind = AIR_TYPES.includes(jc.avType) ? jc.avType : 'both';
    const CdAin = kind === 'out' ? 0 : area(jc.CdAin);
    const CdAout = kind === 'in' ? 0 : area(jc.CdAout);
    const CdAout2 = kind === 'twoStage' ? area(jc.CdAout2) : CdAout;
    const p0 = env.patm;
    const Popen = has(jc.Popen, 'pressure') ? si(jc.Popen, 'pressure') : p0;
    const Tair = has(jc.Tair, 'temperature') ? si(jc.Tair, 'temperature') : env.fluid.T;
    const RT = AIR.R * Tair;
    const switchDP = jc.switchBy === 'flow' ? Infinity : has(jc.switchDP, 'dp') ? si(jc.switchDP, 'dp') : Infinity;
    const switchFlow = jc.switchBy === 'flow' && has(jc.switchFlow, 'massFlow') ? si(jc.switchFlow, 'massFlow') : Infinity;
    const P0 = gen.st.P;
    const ma0 = has(jc.mAir0, 'mass') && jc.mAir0.value > 0 ? si(jc.mAir0, 'mass') : 0;
    const Va0 = ma0 > 0 ? ma0 * RT / P0 : 0;
    const big = sectionVolume(ports);
    const stateOf = (Va, mair) => (!(Va > 0) ? 'closed' : mair > 0 ? 'admit' : mair < 0 ? 'expel' : 'hold');
    const b = {
      jid: j.id, j, jc, def, ports, kind: 'airValve', gen,
      // the pressure of the node, the air in it (volume and mass), the air flow in, the liquid flow into the node, the
      // stage of a two-stage valve
      st: { P: P0, Va: Va0, ma: ma0, mair: 0, q: 0, stage: 'large', state: stateOf(Va0, 0) },
      nx: null,
      fields: ['P', 'Va', 'ma', 'mair'],
      input() {},
      solve(S) {
        const st = b.st, dt = S.dt, k2 = dt / (2 * rho);
        const liquid = () => {
          gen.solve(S);
          b.nx = { P: gen.nx.P, Va: 0, ma: 0, mair: 0, q: gen.nx.net, stage: 'large', state: 'closed' };
        };
        // the test step keeps the air as it is
        if (S.test) {
          if (!(st.Va > 0)) { liquid(); return; }
          writePorts(ports, st.P, sc);
          gen.nx = { P: st.P, V: 0, out: 0, ext: gen.st.ext.slice(), net: 0 };
          b.nx = Object.assign({}, st);
          return;
        }
        if (!(st.Va > 0)) {
          liquid();
          // it opens when the pressure of the node falls below its opening pressure
          if (!(b.nx.P < Popen) || !(CdAin > 0)) return;
        }
        // with air: p·V = m_a·R·T, the volume and the mass of air by the trapezoid rule. The residual p·V − m_a·R·T grows
        // with p wherever the volume is positive (V grows with p, m_a falls with it); the search starts where the volume
        // is zero (or at zero pressure), and below that point the residual goes on as a straight line
        const Q = inflow(ports, sc);
        const out = st.stage === 'small' ? CdAout2 : CdAout;
        const air = (p) => airFlow(CdAin, out, p, p0, Tair, Tair);
        const Vof = (p) => st.Va - k2 * (Q(p) + st.q);
        const mOf = (p) => st.ma + dt / 2 * (air(p) + st.mair);
        const G = (p) => p * Vof(p) - mOf(p) * RT;
        let lo = 0;
        if (!(Vof(0) > 0)) lo = Math.max(0, BD().root(Vof, Number.isFinite(st.P) ? st.P : p0, net.pScale).x);
        const G0 = G(lo), h = 1e-6 * Math.max(lo, p0), S0 = Math.max((G(lo + h) - G0) / h, 1e-12);
        const F = (p) => (p >= lo ? G(p) : G0 + (p - lo) * S0);
        const r = rootUp(F, Math.max(lo, Number.isFinite(st.P) ? st.P : p0), net.pScale);
        if (!r.ok) net.rootFailed(j.id, S);
        const p = r.x, Va = Vof(p), ma = mOf(p);
        if (!(Va > 0) || !(ma > 0)) { liquid(); return; } // the air is gone: the valve closes, the node is liquid again
        const into = writePorts(ports, p, sc);
        gen.nx = { P: p, V: 0, out: 0, ext: gen.st.ext.slice(), net: into };
        const mair = air(p);
        // a two-stage valve expels through its smaller orifice once the difference or the air flow passes its limit
        let stage = st.stage;
        if (mair >= 0) stage = 'large';
        else if (p - p0 > switchDP || -mair > switchFlow) stage = 'small';
        b.nx = { P: p, Va, ma, mair, q: into, stage, state: stateOf(Va, mair) };
        if (Va > big) net.warnOnce('warning', 'surge.warn.bigAir', { id: j.id, t: S.t }, 'j:' + j.id);
      },
      commit() { gen.commit(); b.st = b.nx; },
      stateName: () => b.st.state,
      values(o) { const st = b.st; o[0] = st.P; o[1] = st.Va; o[2] = st.ma; o[3] = st.mair; },
      row: () => nodeRow(net, ports, b.st.P, -b.st.q),
    };
    return b;
  }

  // ---------- infinite pipe (§6.5): each end at the junction lets the waves out. The characteristic that would come from
  // outside is that of the steady state: with P0 and q0 the steady pressure and flow into the junction at the station,
  // P = P0 + B·(q − q0), together with the characteristic of the pipe, P = C − B_p·q. The tables of the junction are
  // ignored in the transient
  function infinitePipe(j, ctx) {
    const { net } = ctx;
    const ports = [];
    for (const p of M.pipesAt(net.eff, j.id)) { const pt = ctx.portOf(p.id, j.id); if (pt) ports.push(pt); }
    const ends = ports.map((pt) => {
      const p = pt.pipe;
      if (p.n < 2) throw new Error(t('surge.error.infiniteSections', { id: j.id, pid: p.id }));
      const [q0] = MOC().portOld(pt);
      return { pt, P0: p.P[pt.i], q0, B: p.B };
    });
    const b = {
      jid: j.id, j, jc: M.clone(j), def: ctx.def, ports, kind: 'infinitePipe',
      st: { P: ends.length ? ends[0].P0 : NaN, net: ends.reduce((s, e) => s + e.q0, 0) },
      nx: null,
      fields: ['P', 'net'],
      input() {},
      solve(S) {
        let P = NaN, into = 0;
        for (const e of ends) {
          const pt = e.pt, Ce = e.P0 - e.B * e.q0;
          const q = (pt.C - Ce) / (pt.B + e.B);
          const Pe = Ce + e.B * q;
          MOC().portSet(pt, Pe, q, q, 0);
          if (!Number.isFinite(P)) P = Pe;
          into += q;
          if (S.cv.on && !S.test && Pe < S.cv.Pv) net.warnOnce('warning', 'surge.warn.infiniteCavity', { id: j.id, t: S.t }, 'j:' + j.id);
        }
        b.nx = { P, net: into };
      },
      commit() { b.st = b.nx; },
      stateName: () => undefined,
      values(o) { o[0] = b.st.P; o[1] = -b.st.net; },
      row: () => nodeRow(net, ports, b.st.P, -b.st.net),
    };
    return b;
  }

  // ---------- finite reservoir (§6.6): the tank of the time simulation, its level from the net flow into it by the
  // trapezoid rule, solved with its pipes in the same step. Full: the level stays at the top and the excess overflows;
  // empty: the volume stays at zero and the rest is missing (as in the time simulation, §6.4 of its specification). A pipe
  // whose end the surface uncovers takes liquid in by free fall and gives none: it is closed while it would draw from the
  // tank. A closed tank holds its gas over the liquid, P·Vg^n = C between its relief and vent pressures
  function finiteReservoir(j, ctx) {
    const { net } = ctx;
    const env = net.env, rho = env.rho, si = net.si, sc = net.mScale;
    const jc = M.clone(j);
    const T = TK().prepare(jc, net.eff, si);
    const ports = portsOf(ctx, j, jc, T.zb + heightAt(T, T.V0), true);
    const surfP = () => si(jc.surfP, 'pressure');
    const gas = (V, C) => TK().gasAt(T, Math.min(V, T.Vmax), C);
    const levelOfV = (V) => T.zb + heightAt(T, Math.min(T.Vmax, Math.max(0, V)));
    const row0 = net.res.junctions[j.id] || {};
    // the steady state cannot draw liquid through a pipe end the tank leaves uncovered (its rule in every step)
    const zs0 = levelOfV(T.V0);
    for (const pt of ports) {
      if (MOC().portOld(pt)[0] < -1e-9 * sc && pt.zEnd >= zs0 - 1e-9) throw new Error(t('surge.error.tankUncovered', { pid: pt.pipe.id }));
    }
    const b = {
      jid: j.id, j, jc, def: ctx.def, ports, kind: 'finiteReservoir',
      // q: the flow into the tank from its pipes, at the start that of the steady state (the first step integrates it)
      st: { P: T.closed ? T.P0 : surfP(), V: T.V0, q: Number.isFinite(row0.net) ? -row0.net : 0, C: T.closed ? T.C0 : NaN, mode: 'normal', over: 0, deficit: 0 },
      nx: null,
      fields: ['P', 'level', 'net'],
      input(jt, v) { jt.q.apply(jc, v); },
      solve(S) {
        const st = b.st, k2 = S.dt / (2 * rho);
        // the flows of the ports into the tank with its volume at V: the surface at its level, an uncovered end closed
        // while it would draw from the tank
        const flows = (V, write) => {
          const zs = levelOfV(V);
          // a closed tank full of liquid without a relief holds a pressure without limit: a large one here
          const Ps = T.closed ? Math.min(gas(V, st.C).P, 1e12) : surfP();
          let s = 0;
          for (const pt of ports) {
            BD().level(net, pt, zs, true);
            let q = BD().portQ(pt, Ps, sc).q;
            if (q < 0 && pt.zEnd >= zs - 1e-9) q = 0; // uncovered: no liquid from the tank
            if (write) MOC().portSet(pt, pt.C - pt.B * q, q, q, 0);
            s += q;
          }
          return { s, Ps };
        };
        const r = BD().root((V) => V - st.V - k2 * (flows(V, false).s + st.q), st.V, 1e-9 * Math.max(T.Vmax, 1e-6));
        if (!r.ok && !S.test) net.rootFailed(j.id, S);
        let V = r.x, mode = 'normal', over = st.over, deficit = st.deficit;
        if (V > T.Vmax) { mode = 'full'; V = T.Vmax; }
        else if (V < 0) { mode = 'empty'; V = 0; }
        const f = flows(V, true);
        const Vt = st.V + k2 * (f.s + st.q);
        if (mode === 'full') over += Math.max(0, Vt - T.Vmax);
        if (mode === 'empty') deficit += Math.max(0, -Vt);
        let C = st.C;
        if (T.closed) C = gas(V, st.C).C;
        b.nx = { P: f.Ps, V, q: f.s, C, mode, over, deficit };
        if (!S.test && mode !== st.mode) {
          if (mode === 'full') net.warnOnce('warning', 'surge.warn.tankFull', { id: j.id, t: S.t }, 'j:' + j.id);
          if (mode === 'empty') net.warnOnce('warning', 'surge.warn.tankEmpty', { id: j.id, t: S.t }, 'j:' + j.id);
        }
      },
      commit() {
        b.st = b.nx;
        for (const pt of ports) BD().level(net, pt, levelOfV(b.st.V), true);
      },
      stateName: () => b.st.mode,
      values(o) { const st = b.st; o[0] = st.P; o[1] = levelOfV(st.V); o[2] = -st.q; },
      row() { const r = nodeRow(net, ports, b.st.P, -b.st.q); r.junction.P0in = r.junction.P0out = b.st.P; return r; },
      // the tank as the conditions of events read it: { h, zs, V, Ps }
      tank() { const zs = levelOfV(b.st.V); return { h: zs - T.zb, zs, V: b.st.V, Ps: b.st.P }; },
      totals: () => ({ over: b.st.over, deficit: b.st.deficit }),
    };
    return b;
  }

  // ---------- the checklists of the devices (§11.6, item 11): keys under surge.checklist.device
  const tableOk = (tb) => {
    const ok = tb && Array.isArray(tb.h) && Array.isArray(tb.V) && tb.h.length >= 2 && tb.h.length === tb.V.length
      && U.has('length', tb.hUnit) && U.has('volume', tb.vUnit) && tb.h.every(Number.isFinite) && tb.V.every(Number.isFinite);
    const rising = (xs) => xs.every((x, i) => i === 0 || x > xs[i - 1]);
    return !!ok && tb.h[0] === 0 && tb.V[0] === 0 && rising(tb.h) && rising(tb.V);
  };
  // a table describes the tank up to its top, so it needs the top and reaches it (as the finite tank of the time
  // simulation); a constant section may go without a top
  function checkShape(j, out, needHeight) {
    const table = j.shape === 'table';
    if (table) { if (!tableOk(j.table)) out.push('device.table'); } else if (!(has(j.area, 'area') && j.area.value > 0)) out.push('device.area');
    if (j.bottom && j.bottom.value !== null && j.bottom.value !== undefined && !has(j.bottom, 'length')) out.push('device.bottom');
    const hOk = has(j.height, 'length') && j.height.value > 0;
    if (needHeight || table ? !hOk : j.height && j.height.value !== null && j.height.value !== undefined && !hOk) out.push('device.height');
    else if (table && hOk && tableOk(j.table)) {
      const tb = j.table;
      if (U.toSI(tb.h[tb.h.length - 1], tb.hUnit, 'length') < U.toSI(j.height.value, j.height.unit, 'length') * (1 - 1e-12)) out.push('device.tableShort');
    }
  }
  function checkConnection(j, out) {
    const pos = (x, cat) => has(x, cat) && x.value > 0;
    if (j.orifice && !(pos(j.CdAin, 'area') && pos(j.CdAout, 'area'))) out.push('device.orifice');
    if (j.riser && !(pos(j.riserL, 'length') && pos(j.riserD, 'length') && Number.isFinite(j.riserF) && j.riserF >= 0)) out.push('device.riser');
  }
  const optional = (x) => !x || x.value === null || x.value === undefined || x.value === '';
  function validateSurgeTank(j, miss) {
    checkShape(j, miss, false);
    checkConnection(j, miss);
  }
  function validateAirVessel(j, miss) {
    if (!(Number.isFinite(j.n) && j.n >= 1 && j.n <= 1.4)) miss.push('device.n');
    if (j.gasInit === 'precharge') {
      if (!(has(j.Ppre, 'pressure') && has(j.Vpre, 'volume') && j.Vpre.value > 0)) miss.push('device.precharge');
    } else if (!(has(j.Vg0, 'volume') && j.Vg0.value > 0)) miss.push('device.Vg0');
    if (j.shape === 'constant' || j.shape === 'table') checkShape(j, miss, true);
    else if (!optional(j.vol) && !(has(j.vol, 'volume') && j.vol.value > 0)) miss.push('device.vol');
    if (!optional(j.vgMin) && !(has(j.vgMin, 'volume') && j.vgMin.value >= 0)) miss.push('device.vgMin');
    checkConnection(j, miss);
  }
  function validateRelief(j, miss, v) {
    const p = (x) => has(x, 'pressure');
    if (!p(j.Pset)) miss.push('device.Pset');
    if (!p(j.Pext)) miss.push('device.Pext');
    if (j.lossModel === 'Kv' ? !(j.Kv > 0) : j.lossModel === 'CdA' ? !(has(j.CdA, 'area') && j.CdA.value > 0) : !(j.Cv > 0)) miss.push('device.capacity');
    // the rate is a plain number (empty: null, no limit)
    if (j.rate !== null && j.rate !== undefined && !(Number.isFinite(j.rate) && j.rate > 0)) miss.push('device.rate');
    const abs = v.abs || ((x) => x.value);
    if (p(j.Pset) && !optional(j.Pclose) && (!p(j.Pclose) || abs(j.Pclose) > abs(j.Pset) * (1 + 1e-12))) miss.push('device.Pclose');
    if (j.mode !== 'instant' && p(j.Pset) && (!p(j.Pfull) || !(abs(j.Pfull) > abs(j.Pset)))) miss.push('device.Pfull');
  }
  function validateAirValve(j, miss, v) {
    const pos = (x) => has(x, 'area') && x.value > 0;
    const kind = j.avType;
    if (!AIR_TYPES.includes(kind)) { miss.push('device.avType'); return; }
    if (kind !== 'out' && !pos(j.CdAin)) miss.push('device.CdAin');
    if (kind !== 'in' && !pos(j.CdAout)) miss.push('device.CdAout');
    if (kind === 'twoStage') {
      if (!pos(j.CdAout2)) miss.push('device.CdAout2');
      if (j.switchBy === 'flow' ? !(has(j.switchFlow, 'massFlow') && j.switchFlow.value > 0) : !(has(j.switchDP, 'dp') && j.switchDP.value > 0)) miss.push('device.switch');
    }
    if (!optional(j.Popen) && !has(j.Popen, 'pressure')) miss.push('device.Popen');
    if (optional(j.Tair) ? !(v.fluidT > 0) : !has(j.Tair, 'temperature')) miss.push('device.Tair');
    if (!optional(j.mAir0) && !(has(j.mAir0, 'mass') && j.mAir0.value >= 0)) miss.push('device.mAir0');
  }

  PumpIt.surge = Object.assign(PumpIt.surge || {}, {
    devices: {
      AIR, RC, AIR_TYPES, orificeAir, airFlow, reliefCapacity, shapeOf, connectionOf,
      surgeTank, airVessel, reliefValve, airValve, infinitePipe, finiteReservoir,
      validateSurgeTank, validateAirVessel, validateRelief, validateAirValve,
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
