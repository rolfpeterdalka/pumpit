// Boundaries of the water hammer (docs/water-hammer.md; §5 and §7.3 of its specification). Every junction ties the ends
// of its pipes, its ports, where the characteristic that leaves each pipe gives P_end = C − B·q, q the flow into the
// junction. A junction type without a `surge.boundary` hook takes the generic boundary of its shape, built by the steady
// builders of its type (buildNode, buildElement) on a copy of the junction, so the laws are those of the steady state:
//
//   node     the pressure P of the junction, at each port C − B·q = P + hz + φe(q) (hz: the elevation between the junction
//            and the end of the pipe; φe: the loss of the end, its pipeK). Fixed (a reservoir, an imposed stagnation
//            pressure): P given. Static (an imposed static pressure, one pipe): P − ṁ²/(2ρA²) given. Free: Σ q − Σ ṁ_ext −
//            demand = 0, with the discharges ṁ_ext of the junction to a fixed outside pressure (a nozzle, an exit valve)
//   element  two ports, in and out, and the flow ṁ from in to out: P_in − P_out = φ(ṁ) (mode loss), ṁ = 0 (closed), ṁ
//            given (fixedFlow), the outlet or inlet pressure given (pDown, pUp) or their difference (dP); a device of the
//            steady state (a check valve, a control valve in the ideal mode) reviews its state after each solution, and a
//            change solves the step again, which then holds from that step on (decision W-11). A device may give a largest
//            speed of its opening (a control valve, decision W-49): held back, it is a fixed valve at the opening it reached
//
// Cavities (DVCM): a free node with two ports or more holds its cavity at the node; one with one port, and each side of an
// element, at the station of the port, whose two flows then differ. Fixed pressures never cavitate. With the gas
// cavities (DGCM, phase G3) a free node holds the free gas of its pipe ends in the same places, always; the sides of an
// element keep the vapour cavities (decision G3-10).
//
// A boundary object: { jid, ports, input(jt, v), solve(S), commit(), stateName(), fields, values(o), row() }; S = { k,
// t, dt, cv (cavitation), test }. solve writes the new state of its ports and keeps its own in nx; commit makes nx the
// state of the junction; values(o) writes the values of its fields, in their order, into the array o.
(function (root) {
  const PumpIt = root.PumpIt;
  const M = PumpIt.model, U = PumpIt.units;
  const { t } = PumpIt.i18n;
  const types = PumpIt.junctionTypes;
  const MOC = () => PumpIt.surge.moc;

  const REL = 1e-12; // relative tolerance of the scalar roots (§5.12)
  const MAX_IT = 100;

  // ---------- scalar roots (§5.12): Newton with a derivative by differences, kept inside the bracket of a sign change by
  // bisection once both sides are known. f is monotonic. sc: the scale of x (the floor of the relative tolerance)
  // → { x, ok }
  function solveRoot(f, x0, sc) {
    let x = Number.isFinite(x0) ? x0 : 0;
    let fx = f(x);
    let a = NaN, fa = NaN, b = NaN, fb = NaN; // a: f > 0, b: f < 0
    const floor = Math.max(sc, 1e-300);
    for (let it = 0; it < MAX_IT; it++) {
      if (fx === 0) return { x, ok: true };
      if (!Number.isFinite(fx)) return { x, ok: false };
      if (fx > 0) { a = x; fa = fx; } else { b = x; fb = fx; }
      const h = 1e-7 * Math.max(Math.abs(x), floor);
      const d = (f(x + h) - fx) / h;
      let xn = d !== 0 && Number.isFinite(d) ? x - fx / d : NaN;
      const bracket = Number.isFinite(a) && Number.isFinite(b);
      if (bracket) {
        const lo = Math.min(a, b), hi = Math.max(a, b);
        if (!(xn > lo && xn < hi)) xn = (a * fb - b * fa) / (fb - fa); // false position
        if (!(xn > lo && xn < hi)) xn = (lo + hi) / 2;
      } else if (!Number.isFinite(xn)) {
        // no slope: a step that grows until the sign changes
        xn = x + (fx > 0 ? 1 : -1) * Math.sign(d || 1) * 10 * floor;
      }
      if (Math.abs(xn - x) <= REL * Math.max(Math.abs(xn), floor)) return { x: xn, ok: true };
      x = xn;
      fx = f(x);
      if (bracket && Math.abs(a - b) <= REL * Math.max(Math.abs(x), floor)) return { x, ok: true };
    }
    return { x, ok: false };
  }
  // a root of F between a and b, where F changes sign: false position in the Illinois variant, never leaving the bracket,
  // with a bisection whenever four steps did not halve it, to the relative tolerance of the scalar roots. floor: the scale
  // of x near zero. → { x, ok }
  function bracketRoot(F, a, b, fa, fb, floor = 0) {
    if (fa === 0) return { x: a, ok: true };
    if (fb === 0) return { x: b, ok: true };
    if (!(Number.isFinite(fa) && Number.isFinite(fb)) || (fa < 0) === (fb < 0)) return { x: a, ok: false };
    let side = 0, x = NaN, width = Math.abs(b - a), n = 0;
    for (let it = 0; it < 400; it++) {
      let xn = (a * fb - b * fa) / (fb - fa);
      if (++n >= 4) { if (Math.abs(b - a) > width / 2) xn = (a + b) / 2; width = Math.abs(b - a); n = 0; }
      if (!(xn > Math.min(a, b) && xn < Math.max(a, b))) xn = (a + b) / 2;
      const tol = REL * Math.max(Math.abs(xn), floor);
      if (Math.abs(xn - x) <= tol || Math.abs(b - a) <= tol) return { x: xn, ok: true };
      x = xn;
      const fx = F(x);
      if (fx === 0) return { x, ok: true };
      if (!Number.isFinite(fx)) return { x, ok: false };
      if ((fx < 0) === (fb < 0)) { b = x; fb = fx; if (side === -1) fa /= 2; side = -1; }
      else { a = x; fa = fx; if (side === 1) fb /= 2; side = 1; }
    }
    return { x, ok: false };
  }
  // a root of R(u), decreasing on (0, ∞) with R(0+) = +∞ (the gas of a station or a node, u = P − Pc): a bracket by
  // doubling or halving from u0 > 0, then bracketRoot
  function gasRoot(R, u0) {
    let lo = u0 > 0 ? u0 : 1, hi = lo, flo = R(lo), fhi = flo;
    if (flo > 0) { for (let i = 0; i < 2000 && fhi > 0; i++) { lo = hi; flo = fhi; hi *= 2; fhi = R(hi); } }
    else { for (let i = 0; i < 2000 && flo < 0; i++) { hi = lo; fhi = flo; lo /= 2; flo = R(lo); } }
    return bracketRoot(R, lo, hi, flo, fhi);
  }

  // ---------- the steady builders on a copy of a junction
  // a builder as the steady preparation gives the junction types (src/core/solver/network.js), with its own nodes and links
  function builder(net) {
    const nodes = [], links = [];
    const b = {
      eff: net.eff, env: net.env, si: net.si, rho: net.env.rho, g: net.env.g, errors: [], warnings: [], pp: net.prep.pp, kTerm: net.prep.kTerm,
      addNode: (o) => { o.ix = nodes.length; nodes.push(Object.assign({ kind: 'free', demand: 0, value: 0 }, o)); return nodes[nodes.length - 1]; },
      addLink: (lk) => { links.push(lk); return lk; },
    };
    return { b, nodes, links };
  }
  // the node of a single-node junction and its discharges to the outside: { node, ext: [{ Pext, phi, closed }] }
  function nodeShape(net, jc, def) {
    const { b, nodes, links } = builder(net);
    const node = def.buildNode(jc, b, net.si(jc.elevation, 'length'));
    const ext = links.filter((l) => l.kind === 'ext').map((l) => ({ Pext: nodes[l.b].value, phi: l.phi, closed: l.mode === 'closed', mref: l.mref || 1 }));
    return { node, ext, errors: b.errors };
  }
  // the element link of a two-port junction, built as the steady preparation builds it
  function elementShape(net, jc, def, pin, pout) {
    const { b } = builder(net);
    const rho = net.env.rho, kTerm = net.prep.kTerm;
    const Pin = net.prep.pp.get(pin), Pout = net.prep.pp.get(pout);
    const Ain = Pin.A * Pin.N, Aout = Pout.A * Pout.N;
    const kElem = (Kf, Kr) => (m) => (m >= 0 ? kTerm(Kf, Pin, m / (rho * Ain)) : kTerm(Kr, Pout, m / (rho * Aout)));
    const lk = { kind: 'elem', jid: jc.id, type: jc.type, a: 0, b: 1, idx: 0, G: 0, mode: 'loss', mref: rho * Ain * 0.01, Pin, Pout, j: jc };
    def.buildElement(jc, lk, Object.assign(Object.create(b), { Pin, Pout, Ain, Aout, kElem }));
    return lk;
  }

  // ---------- the ports
  // a port joined to a junction: the elevation between the pressure of the junction (at zNode; a reservoir at its level,
  // unless the pipe is above it) and the end of the pipe, and the loss of the end (its pipeK)
  function attach(net, pt, j, nodeZ, isRes) {
    const P = net.prep.pp.get(pt.pipe.id);
    const zEnd = pt.down ? P.zDown : P.zUp;
    pt.zEnd = zEnd;
    level(net, pt, nodeZ, isRes);
    const pk = j.pipeK && j.pipeK[pt.pipe.id];
    pt.kIn = (pk && pk.kIn) || 0; pt.kOut = (pk && pk.kOut) || 0;
    pt.kTerm = net.prep.kTerm; pt.PP = P;
  }
  // the elevation term of a port for a node at zNode (a reservoir whose level moves calls it again)
  function level(net, pt, nodeZ, isRes) {
    const zEff = isRes && pt.zEnd > nodeZ ? pt.zEnd : nodeZ;
    pt.hz = net.env.rho * net.env.g * (zEff - pt.zEnd);
  }

  // the flow into the junction at a port whose junction side is at the pressure Pj (the station without a cavity)
  function portQ(pt, Pj, sc) {
    const q0 = (pt.C - pt.hz - Pj) / pt.B;
    if (!MOC().hasLoss(pt)) return { q: q0, ok: true };
    const r = solveRoot((q) => pt.C - pt.B * q - pt.hz - MOC().portLoss(pt, q) - Pj, q0, sc);
    return { q: r.x, ok: r.ok };
  }
  // the pressure of the junction side of a port with the flow q into the junction, the station at Pend
  const sideP = (pt, Pend, q) => Pend - pt.hz - MOC().portLoss(pt, q);

  // the discharge through an outside link at the pressure P of the node (the steady law φ(ṁ) = P − P_ext); none when
  // closed, nor inwards for a nozzle
  function extFlow(x, P, outOnly, sc, guess) {
    if (x.closed) return { m: 0, ok: true };
    const D = P - x.Pext;
    if (outOnly && !(D > 0)) return { m: 0, ok: true };
    if (D === 0) return { m: 0, ok: true };
    const r = solveRoot((m) => x.phi(m) - D, Number.isFinite(guess) && guess !== 0 && Math.sign(guess) === Math.sign(D) ? guess : Math.sign(D) * x.mref, sc);
    return { m: r.x, ok: r.ok };
  }

  // ---------- the generic node
  // opts.gas: false keeps the gas cavities out of the node (a protection device built on it)
  function nodeBoundary(net, j, def, ports, opts = {}) {
    const jc = M.clone(j);
    const outOnly = !!(def.surge && def.surge.outflowOnly);
    const sc = net.mScale, scP = net.pScale;
    let shape = nodeShape(net, jc, def);
    const one = ports.length === 1;
    const row0 = net.res.junctions[j.id] || {};
    for (const pt of ports) attach(net, pt, jc, shape.node.z, shape.node.isRes);
    // the gas cavities (DGCM): a free node holds the gas of its single pipe end at that station, or the gas of all its
    // pipe ends at the node (Cg the sum of their half sections), at its steady pressure over the vapour pressure
    const gasAt = net.gas && opts.gas !== false && shape.node.kind === 'free' && ports.length ? (one ? 'station' : 'node') : '';
    let Cg = 0, V0 = 0;
    if (gasAt === 'node') {
      for (const pt of ports) { Cg += pt.pipe.Cg[pt.i]; MOC().gasNone(pt.pipe, pt.i); }
      const u0 = row0.P0in - net.env.pv;
      if (!(u0 > 0)) throw new Error(t('surge.error.gasNode'));
      V0 = Cg / u0;
    } else if (gasAt === 'station') V0 = ports[0].pipe.V[ports[0].i];
    // a step with the gas (decision G3-10): Vg = Cg/(P − Pc) = Vg(k−1) + (Δt/ρ)·[ψ·out(k) + (1 − ψ)·out(k−1)], out the
    // liquid that leaves the volume of the gas (to the junction side or the outside), increasing with P: the stable root of
    // the quadratic without discharges and losses, a scalar root otherwise
    function gas(S) {
      const st = b.st, nd = shape.node, cv = S.cv, k = S.dt / net.env.rho, psi = cv.psi;
      const open = shape.ext.map((x, i) => [x, i]).filter(([x]) => !x.closed);
      const nx = b.nx;
      if (gasAt === 'station') {
        // at the station of the single port: the pipe side by its characteristic, the junction side by the junction at
        // P − hz (the loss of the end of the pipe taken at the flow of the junction side)
        const pt = ports[0], cg = pt.pipe.Cg[pt.i], Pc = MOC().portCavityP(pt, cv);
        const [qjOld, qpOld] = MOC().portOld(pt);
        const A0 = st.V + k * (1 - psi) * (qjOld - qpOld);
        const jside = (P) => {
          if (!open.length) return { q: nd.demand, Pj: P - pt.hz - MOC().portLoss(pt, nd.demand), ext: shape.ext.map(() => 0) };
          const at = (q) => { const Pj = P - pt.hz - MOC().portLoss(pt, q); let s2 = nd.demand; const ext = shape.ext.map((x, i) => { const m = x.closed ? 0 : extFlow(x, Pj, outOnly, sc, st.ext[i]).m; s2 += m; return m; }); return { s: s2, Pj, ext }; };
          if (!MOC().hasLoss(pt)) { const r = at(0); return { q: r.s, Pj: r.Pj, ext: r.ext }; }
          const r = solveRoot((q) => q - at(q).s, Number.isFinite(st.net) ? st.net : 0, sc);
          const y = at(r.x);
          return { q: r.x, Pj: y.Pj, ext: y.ext };
        };
        let u;
        if (!open.length) u = MOC().gasU(k * psi / pt.B, A0 + k * psi * (nd.demand - (pt.C - Pc) / pt.B), cg);
        else {
          const r = gasRoot((x) => cg / x - A0 - k * psi * (jside(Pc + x).q - (pt.C - Pc - x) / pt.B), Number.isFinite(st.P) ? st.P + pt.hz - Pc : 1e5);
          if (!r.ok) net.rootFailed(j.id, S);
          u = r.x;
        }
        const P = Pc + u, qp = (pt.C - P) / pt.B, js = jside(P), V = cg / u;
        MOC().portSet(pt, P, js.q, qp, V);
        Object.assign(nx, { P: js.Pj, V, out: js.q - qp, net: js.q, ext: js.ext });
        return;
      }
      // at the node: its pressure on the stagnation basis, its ports by their characteristics
      const Pc = cv.Pv, A0 = st.V + k * (1 - psi) * st.out;
      const lossless = ports.every((pt) => !MOC().hasLoss(pt));
      const outAt = (P) => {
        let o = nd.demand;
        for (const pt of ports) o -= portQ(pt, P, sc).q;
        for (const [x, i] of open) o += extFlow(x, P, outOnly, sc, st.ext[i]).m;
        return o;
      };
      let u;
      if (lossless && !open.length) {
        let Q0 = 0, Sg = 0;
        for (const pt of ports) { Q0 += (pt.C - pt.hz) / pt.B; Sg += 1 / pt.B; }
        u = MOC().gasU(k * psi * Sg, A0 + k * psi * (nd.demand - Q0 + Pc * Sg), Cg);
      } else {
        const r = gasRoot((x) => Cg / x - A0 - k * psi * outAt(Pc + x), Number.isFinite(st.P) ? st.P - Pc : 1e5);
        if (!r.ok) net.rootFailed(j.id, S);
        u = r.x;
      }
      const P = Pc + u;
      let into = 0;
      for (const pt of ports) { const q = portQ(pt, P, sc).q; MOC().portSet(pt, pt.C - pt.B * q, q, q, 0); into += q; }
      const ext = shape.ext.map((x, i) => (x.closed ? 0 : extFlow(x, P, outOnly, sc, st.ext[i]).m));
      let o = nd.demand - into;
      for (const m of ext) o += m;
      Object.assign(nx, { P, V: Cg / u, out: o, net: into, ext });
    }
    const b = {
      jid: j.id, j, jc, def, ports, kind: 'node',
      // the state: the pressure of the node, the volume of its cavity, the liquid that left the node volume, the discharges,
      // the flow into the node from its pipes (at the start that of the steady state, which gives the network row0.net)
      st: { P: Number.isFinite(row0.P0in) ? row0.P0in : NaN, V: V0, out: 0, ext: shape.ext.map(() => 0), net: Number.isFinite(row0.net) ? -row0.net : 0 },
      nx: null, gas: gasAt,
      fields: ['P', 'net'].concat(ports.length > 1 && !shape.node.kind.startsWith('fixed') ? ['V'] : []),
      input(jt, v) {
        jt.q.apply(jc, v);
        shape = nodeShape(net, jc, def);
        for (const pt of ports) level(net, pt, shape.node.z, shape.node.isRes);
      },
      solve(S) {
        const nd = shape.node, st = b.st;
        const nx = { P: NaN, V: 0, out: 0, ext: st.ext.slice(), net: 0 };
        b.nx = nx;
        if (!ports.length) return;
        if (nd.kind === 'fixed') {
          nx.P = nd.value;
          for (const pt of ports) {
            const r = portQ(pt, nd.value, sc);
            if (!r.ok) net.rootFailed(j.id, S);
            MOC().portSet(pt, pt.C - pt.B * r.q, r.q, r.q, 0);
            nx.net += r.q;
          }
          return;
        }
        if (nd.kind === 'fixedStatic') {
          // P − ṁ²/(2ρA²) = p, one pipe: the root of the same sign as the one without the velocity term (§5.4)
          const pt = ports[0], A = pt.pipe.A, rho = net.env.rho;
          const f = (q) => pt.C - pt.B * q - pt.hz - MOC().portLoss(pt, q) - (nd.value + q * q / (2 * rho * A * A));
          const r = solveRoot(f, (pt.C - pt.hz - nd.value) / pt.B, sc);
          if (!r.ok) net.rootFailed(j.id, S);
          const q = r.x;
          MOC().portSet(pt, pt.C - pt.B * q, q, q, 0);
          nx.P = nd.value + q * q / (2 * rho * A * A); nx.net = q;
          return;
        }
        // a free node: the balance of its ports, its open discharges and its demand
        const open = shape.ext.map((x, i) => [x, i]).filter(([x]) => !x.closed);
        const lossless = ports.every((pt) => !MOC().hasLoss(pt));
        const sumQ = (P) => { let s = 0; for (const pt of ports) s += portQ(pt, P, sc).q; return s; };
        // the pressure of the node without discharges
        const bare = () => {
          if (lossless) {
            let num = -nd.demand, den = 0;
            for (const pt of ports) { num += (pt.C - pt.hz) / pt.B; den += 1 / pt.B; }
            return num / den;
          }
          const r = solveRoot((P) => sumQ(P) - nd.demand, Number.isFinite(st.P) ? st.P : 0, scP);
          if (!r.ok) net.rootFailed(j.id, S);
          return r.x;
        };
        const liquid = () => {
          let P;
          nx.ext.fill(0);
          if (!open.length) P = bare();
          else if (open.length === 1) {
            // one discharge: its flow is the unknown and P = P_ext + φ(ṁ), which holds without a loss too (an exit valve
            // of K = 0 fixes the pressure of the node)
            const [x, i] = open[0];
            const r = solveRoot((m) => sumQ(x.Pext + x.phi(m)) - m - nd.demand, Number.isFinite(st.ext[i]) ? st.ext[i] : 0, sc);
            if (!r.ok) net.rootFailed(j.id, S);
            if (outOnly && !(r.x > 0)) P = bare();
            else { nx.ext[i] = r.x; P = x.Pext + x.phi(r.x); }
          } else {
            const r = solveRoot((p) => { let s = sumQ(p) - nd.demand; for (const [x, i] of open) s -= extFlow(x, p, outOnly, sc, st.ext[i]).m; return s; }, Number.isFinite(st.P) ? st.P : 0, scP);
            if (!r.ok) net.rootFailed(j.id, S);
            P = r.x;
            for (const [x, i] of open) nx.ext[i] = extFlow(x, P, outOnly, sc, st.ext[i]).m;
          }
          nx.P = P; nx.V = 0; nx.out = 0; nx.net = 0;
          for (const pt of ports) {
            const q = portQ(pt, P, sc).q;
            MOC().portSet(pt, pt.C - pt.B * q, q, q, 0);
            nx.net += q;
          }
        };
        const cv = S.cv;
        if (cv.gas && gasAt) { gas(S); return; }
        if (!cv.on) { liquid(); return; }
        // the pressure of a cavity: at the station of a single port (its basis), at the node otherwise (stagnation)
        const Pc = one ? MOC().portCavityP(ports[0], cv) : cv.Pv;
        let cavity = st.V > 0;
        if (!cavity) {
          liquid();
          const Pcheck = one ? ports[0].pipe.Pn[ports[0].i] : nx.P;
          if (!(Pcheck < Pc)) return;
          cavity = true;
        }
        const k = S.dt / net.env.rho, psi = cv.psi;
        if (one) {
          // the cavity at the station of the port: the pipe side by its characteristic, the junction side by the junction
          const pt = ports[0];
          const qp = (pt.C - Pc) / pt.B;
          const Pj = Pc - pt.hz;
          let qj = nd.demand, ok = true;
          const ext = shape.ext.map((x, i) => { const r = extFlow(x, Pj, outOnly, sc, st.ext[i]); ok = ok && r.ok; qj += r.m; return r.m; });
          const [qjOld, qpOld] = MOC().portOld(pt);
          const V = st.V + k * (psi * (qj - qp) + (1 - psi) * (qjOld - qpOld));
          if (ok && V > 0) { MOC().portSet(pt, Pc, qj, qp, V); Object.assign(nx, { P: Pj, V, out: qj - qp, net: qj, ext }); return; }
        } else {
          let into = 0, ok = true;
          const qs = ports.map((pt) => { const q = portQ(pt, Pc, sc).q; into += q; return q; });
          let out = nd.demand;
          const ext = shape.ext.map((x, i) => { const r = extFlow(x, Pc, outOnly, sc, st.ext[i]); ok = ok && r.ok; out += r.m; return r.m; });
          out -= into;
          const V = st.V + k * (psi * out + (1 - psi) * st.out);
          if (ok && V > 0) {
            nx.ext = ext;
            ports.forEach((pt, n) => MOC().portSet(pt, pt.C - pt.B * qs[n], qs[n], qs[n], 0));
            Object.assign(nx, { P: Pc, V, out, net: into });
            return;
          }
        }
        // the cavity collapses: the node is solved as liquid in the same step
        liquid();
      },
      commit() { b.st = b.nx; },
      stateName: () => undefined,
      // net: the flow the junction gives the network (out of it into its pipes), as in the steady results
      values(o) { o[0] = b.st.P; o[1] = -b.st.net; if (o.length > 2) o[2] = b.st.V; },
      // a row as the steady results give it, for the conditions of events (§8.4)
      row() {
        const P0 = b.st.P;
        let vin = 0, vout = 0;
        for (const pt of ports) {
          const p = pt.pipe, i = pt.i, mm = (p.mU[i] + p.mD[i]) / 2, V = Math.abs(mm) / (net.env.rho * p.A);
          const into = pt.down ? mm : -mm;
          if (into >= 0) vin = Math.max(vin, V); else vout = Math.max(vout, V);
        }
        const r = net.env.rho;
        return { junction: { P0in: P0, P0out: P0, Pin: P0 - r * vin * vin / 2, Pout: P0 - r * vout * vout / 2, m: Math.abs(b.st.net), net: -b.st.net } };
      },
    };
    return b;
  }

  // ---------- the generic element
  // one solution of an element for a law { mode, phi, value, dyn1, dyn2 } with the sides in or out of a cavity (cav1,
  // cav2 and their pressures Pc1, Pc2): → { m, S1, S2 (the pressures of the junction sides), ok }. A side without a port
  // is a dead end, and the element then carries no flow
  function elementSolve(e, law, cav1, cav2, Pc1, Pc2, guess) {
    const p1 = e.pin, p2 = e.pout, rho = e.rho;
    const L = MOC().portLoss;
    const S1 = (m) => (cav1 ? Pc1 : p1.C - p1.B * m) - p1.hz - L(p1, m);
    const S2 = (m) => (cav2 ? Pc2 : p2.C + p2.B * m) - p2.hz - L(p2, -m);
    const dyn = (A, m) => (A ? m * m / (2 * rho * A * A) : 0);
    let f;
    switch (law.mode) {
      case 'closed': return { m: 0, ok: true };
      case 'fixedFlow': return { m: law.value, ok: true };
      case 'pDown': f = (m) => S2(m) - dyn(law.dyn2, m) - law.value; break;
      case 'pUp': f = (m) => S1(m) - dyn(law.dyn1, m) - law.value; break;
      case 'dP': f = (m) => S1(m) - S2(m) - law.value; break;
      default: f = (m) => S1(m) - S2(m) - law.phi(m);
    }
    // the guess: the step before, or the flow without the law (a valve wide open)
    const r = solveRoot(f, Number.isFinite(guess) ? guess : 0, e.sc);
    return { m: r.x, ok: r.ok };
  }

  // a step of an element with its cavities (§7.3): the sides go into a cavity when their pressure falls below that of
  // the cavity, and a cavity that collapses solves the step again with that side liquid. → the new state of the sides,
  // written into the ports: { m, P1, P2 (junction sides), V1, V2, ok }
  function elementStep(e, law, S, st) {
    const p1 = e.pin, p2 = e.pout, cv = S.cv;
    const dead = !p1 || !p2 || law.mode === 'closed';
    let cav1 = !!(cv.on && p1 && st.V1 > 0), cav2 = !!(cv.on && p2 && st.V2 > 0);
    let gone1 = false, gone2 = false;
    const Pc1 = cv.on && p1 ? MOC().portCavityP(p1, cv) : NaN, Pc2 = cv.on && p2 ? MOC().portCavityP(p2, cv) : NaN;
    const k = S.dt / e.rho, psi = cv.psi;
    let out = null;
    for (let pass = 0; pass < 6; pass++) {
      const r = dead ? { m: 0, ok: true } : elementSolve(e, law, cav1, cav2, Pc1, Pc2, st.m);
      const m = r.m;
      // the stations of the ports as liquid, and whether a side goes into a cavity
      const E1 = p1 ? (cav1 ? Pc1 : p1.C - p1.B * m) : NaN;
      const E2 = p2 ? (cav2 ? Pc2 : p2.C + p2.B * m) : NaN;
      if (cv.on) {
        let again = false;
        if (p1 && !cav1 && !gone1 && E1 < Pc1) { cav1 = true; again = true; }
        if (p2 && !cav2 && !gone2 && E2 < Pc2) { cav2 = true; again = true; }
        if (again && !dead) continue;
        if (again && dead) { /* a dead side needs no new solution: its flow stays zero */ }
      }
      // the volumes of the cavities of the sides
      let V1 = 0, V2 = 0;
      let qp1 = m, qp2 = -m;
      if (p1 && cav1) {
        qp1 = (p1.C - Pc1) / p1.B;
        const [qo, qpo] = MOC().portOld(p1);
        V1 = st.V1 + k * (psi * (m - qp1) + (1 - psi) * (qo - qpo));
        if (!(V1 > 0)) { cav1 = false; gone1 = true; if (!dead) continue; V1 = 0; qp1 = m; }
      }
      if (p2 && cav2) {
        qp2 = (p2.C - Pc2) / p2.B;
        const [qo, qpo] = MOC().portOld(p2);
        V2 = st.V2 + k * (psi * (-m - qp2) + (1 - psi) * (qo - qpo));
        if (!(V2 > 0)) { cav2 = false; gone2 = true; if (!dead) continue; V2 = 0; qp2 = -m; }
      }
      const P1e = p1 ? (cav1 ? Pc1 : p1.C - p1.B * m) : NaN;
      const P2e = p2 ? (cav2 ? Pc2 : p2.C + p2.B * m) : NaN;
      out = { m, ok: r.ok, V1, V2, P1e, P2e, qp1, qp2, P1: p1 ? sideP(p1, P1e, m) : NaN, P2: p2 ? sideP(p2, P2e, -m) : NaN };
      break;
    }
    if (!out) {
      // the cavities went in and out without settling: the last solution, liquid
      const m = dead ? 0 : elementSolve(e, law, false, false, Pc1, Pc2, st.m).m;
      const P1e = p1 ? p1.C - p1.B * m : NaN, P2e = p2 ? p2.C + p2.B * m : NaN;
      out = { m, ok: false, V1: 0, V2: 0, P1e, P2e, qp1: m, qp2: -m, P1: p1 ? sideP(p1, P1e, m) : NaN, P2: p2 ? sideP(p2, P2e, -m) : NaN };
    }
    return out;
  }
  // the new state of the stations of the ports of an element
  function elementWrite(e, x) {
    if (e.pin) MOC().portSet(e.pin, x.P1e, x.m, x.qp1, x.V1);
    if (e.pout) MOC().portSet(e.pout, x.P2e, -x.m, x.qp2, x.V2);
  }

  // the element of a two-port junction: its ports (in and out, by the ports of the model), its law from the steady
  // builder, and its device
  function elementPorts(net, j, portOf) {
    const pr = M.ports(net.eff, j);
    const pin = pr ? portOf(pr.in.id, j.id) : null, pout = pr ? portOf(pr.out.id, j.id) : null;
    return { pr, pin, pout };
  }

  function elementBoundary(net, j, def, portOf) {
    const { pr, pin, pout } = elementPorts(net, j, portOf);
    const jc = M.clone(j);
    jc.alwaysControl = false; // a control valve that cannot control takes its action, as in the time simulation
    const s = def.surge || {};
    const res = net.res, row0 = res.junctions[j.id] || {};
    const steadyState = res.states ? res.states[j.id] : undefined;
    // a device closed by its special condition that may open in the transient (a check valve)
    let state = steadyState;
    if (s.reopens && jc.closed) { jc.closed = false; state = s.reopens; }
    let lk = elementShape(net, jc, def, pr.in.id, pr.out.id);
    const e = { pin, pout, rho: net.env.rho, sc: net.mScale };
    for (const pt of [pin, pout]) if (pt) attach(net, pt, jc, net.si(jc.elevation, 'length'), false);
    const frozen = !!(lk.device && s.frozen && s.frozen(jc));
    // a control device frozen at its steady state (decision W-12): its loss at the steady flow, fully open or closed
    let fixedLaw = null;
    if (frozen) {
      const m0 = row0.m, dP = row0.P0in - row0.P0out;
      if (steadyState === 'closed' || !(Math.abs(m0) > 0)) fixedLaw = { mode: 'closed' };
      else if (steadyState === 'open') fixedLaw = { mode: 'loss', phi: lk.phiOpen };
      else {
        const k = Math.max(0, dP / (m0 * Math.abs(m0)));
        if (dP / (m0 * Math.abs(m0)) < 0) net.warn('warning', 'surge.warn.frozenNegative', { id: j.id }, 'j:' + j.id);
        fixedLaw = { mode: 'loss', phi: (m) => k * m * Math.abs(m) };
      }
    }
    const device = frozen ? null : lk.device || null;
    if (device && state === undefined) state = device.initial(lk);
    // a device whose opening has a largest speed (a control valve, phase G3, decision W-49): the opening its control asks
    // for, from the Cv of the ideal solution by the inverse of its characteristic (closed 0, fully open 1), and its law at
    // an opening, a fixed valve of the Cv of its characteristic
    // (its opening joins the results whenever the valve controls with its characteristic, with or without the speed)
    const track = !!(device && s.tracks && s.tracks(jc));
    const rate = track && s.rate ? s.rate(jc) : 0;
    const rho = net.env.rho;
    const openingAsked = (m, dP, stt) => {
      if (stt === 'closed') return 0;
      if (stt === 'open') return 1;
      const Cv = PumpIt.junctionTypes.shared.equivalentCv(m, dP, rho);
      return Number.isFinite(Cv) ? s.openingOf(jc, Cv) : 1;
    };
    const lawAtOpening = (x) => {
      const Cv = s.cvAt(jc, x);
      return Cv > 0 ? { mode: 'loss', phi: PumpIt.junctionTypes.shared.valveLoss({ lossModel: 'Cv', Cv }, null, rho) } : { mode: 'closed' };
    };
    // the law of the element in a state of its device (the device sets the mode of the link)
    const lawOf = (stt) => {
      if (fixedLaw) return fixedLaw;
      const view = Object.create(lk);
      if (device) device.configure(view, stt);
      const mode = view.mode === 'loss' || view.mode === 'closed' || view.mode === 'fixedFlow' || view.mode === 'pDown' || view.mode === 'pUp' || view.mode === 'dP' ? view.mode : 'loss';
      const dynA = (P) => (P ? P.A * P.N : 0);
      return { mode, phi: view.phi, value: view.value, dyn1: mode === 'pUp' ? dynA(view.dynPipe) : 0, dyn2: mode === 'pDown' ? dynA(view.dynPipe) : 0 };
    };
    const env = { rho: net.env.rho, g: net.env.g };
    const m0 = Number.isFinite(row0.m) ? row0.m : 0;
    const b = {
      jid: j.id, j, jc, def, ports: [pin, pout].filter(Boolean), kind: 'element', e,
      // x: the opening of a device with a largest speed, at the start that of the steady state
      st: { m: m0, P1: row0.P0in, P2: row0.P0out, V1: 0, V2: 0, state, value: NaN, x: track ? openingAsked(m0, row0.P0in - row0.P0out, state) : NaN },
      nx: null,
      fields: ['P1', 'P2', 'm'].concat(track ? ['x'] : []),
      input(jt, v) {
        if (v === b.lastInput) return;
        b.lastInput = v;
        jt.q.apply(jc, v);
        lk = elementShape(net, jc, def, pr.in.id, pr.out.id);
      },
      solve(S) {
        const st = b.st;
        let stt = st.state;
        const seen = new Set([stt]);
        let x = null;
        for (let pass = 0; pass < 6; pass++) {
          x = elementStep(e, lawOf(stt), S, st);
          if (!device) break;
          // the device sees the solution (its link at index 0 between the nodes 0 and 1)
          const next = { [j.id]: stt };
          const view = Object.create(lk);
          device.configure(view, stt);
          device.review(view, { m: [x.m], P: [x.P1, x.P2] }, { [j.id]: stt }, next, env);
          const ns = next[j.id];
          if (ns === stt || seen.has(ns)) break;
          seen.add(ns); stt = ns;
        }
        // a largest speed of the opening: further than rate·Δt from the opening of the step before, the opening goes only
        // that far towards the one asked for, and the valve is a fixed valve at that opening (its state stays that of its
        // control, which the opening follows)
        let xo = NaN;
        if (track) {
          const want = openingAsked(x.m, x.P1 - x.P2, stt), reach = rate * S.dt;
          if (rate && Math.abs(want - st.x) > reach) {
            xo = st.x + Math.sign(want - st.x) * reach;
            x = elementStep(e, lawAtOpening(xo), S, st);
          } else xo = want;
        }
        if (!x.ok) net.rootFailed(j.id, S);
        elementWrite(e, x);
        b.nx = { m: x.m, P1: x.P1, P2: x.P2, V1: x.V1, V2: x.V2, state: stt, x: xo };
      },
      commit() { b.st = b.nx; },
      stateName: () => b.st.state,
      values(o) { o[0] = b.st.P1; o[1] = b.st.P2; o[2] = b.st.m; if (track) o[3] = 100 * b.st.x; },
      row() {
        const st = b.st, r = net.env.rho;
        const vel = (pt) => (pt ? Math.abs((pt.pipe.mU[pt.i] + pt.pipe.mD[pt.i]) / 2) / (r * pt.pipe.A) : 0);
        const Vi = vel(pin), Vo = vel(pout);
        const jr = { P0in: st.P1, P0out: st.P2, Pin: st.P1 - r * Vi * Vi / 2, Pout: st.P2 - r * Vo * Vo / 2, m: st.m, Q: st.m / r };
        const out = { junction: jr };
        if (def.time && def.time.results === 'valves') {
          const JS = PumpIt.junctionTypes.shared;
          out.valve = { Cv: JS.equivalentCv(st.m, st.P1 - st.P2, r), open: track ? 100 * st.x : jc.lossModel === 'opening' ? (jc.closed ? 0 : jc.open) : NaN };
        }
        return out;
      },
    };
    return b;
  }

  // the boundary of a junction: its hook (which may give none, for the generic one), or the generic one of its shape.
  // portOf(pid, jid): the port of the pipe at the junction (null when the pipe is out of the transient)
  function make(net, j, portOf) {
    const def = types.get(j.type);
    if (def.surge && def.surge.boundary) {
      const b = def.surge.boundary(j, { net, def, portOf, nodeBoundary, elementBoundary, elementPorts, elementShape, elementStep, elementWrite, attach, root: solveRoot, bracketRoot });
      if (b) return b;
    }
    if (def.multi) {
      const ports = [];
      for (const p of M.pipesAt(net.eff, j.id)) { const pt = portOf(p.id, j.id); if (pt) ports.push(pt); }
      return nodeBoundary(net, j, def, ports);
    }
    return elementBoundary(net, j, def, portOf);
  }

  PumpIt.surge = Object.assign(PumpIt.surge || {}, {
    boundaries: { REL, root: solveRoot, bracketRoot, gasRoot, builder, nodeShape, elementShape, attach, level, portQ, extFlow, nodeBoundary, elementSolve, elementStep, elementWrite, elementPorts, elementBoundary, make },
  });
})(typeof window !== 'undefined' ? window : globalThis);
