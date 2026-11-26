// Network preparation (specification section 7): converts the effective model to SI, evaluates the fluid,
// prepares the pipes and builds the nodes and links that the Newton stage solves. Junction-type specific
// pieces come from the junction type registry (buildNode / buildElement).
//
// Unknowns: mass flow in every link (pipe, two-port element, discharge link) and stagnation pressure in
// every node. Two-port junctions become an element between an inlet node and an outlet node.
(function (root) {
  const PumpIt = root.PumpIt;
  const U = PumpIt.units, H = PumpIt.hyd;
  const types = PumpIt.junctionTypes;
  const { t } = PumpIt.i18n;

  // a pipe end more than DRY metres above the liquid surface of a reservoir is dry: the pipe discharges into the tank in
  // free fall from its end, and it cannot take liquid out of the tank (decision T-09 of the time simulation, in every
  // steady state since the review of a952425). A connection at the surface stays submerged, so that a reservoir whose level
  // is its bottom (a pressure source) still supplies
  const DRY = 1e-9;
  const dry = (nd, zEnd) => !!nd.isRes && zEnd > nd.z + DRY;

  // the state of a pipe with a dry end, a device of the solver (src/core/solver/devices.js) under its own key: open, it
  // takes the liquid that falls into the tank; it closes ('dry') when its flow would leave the tank through the dry end,
  // and opens again when the pressures and the elevations of its two nodes would push liquid into the tank. The margins
  // are those of the time simulation: a velocity of 1e-9 m/s, a grade line of 1e-9 m. A pipe dry at both ends never opens
  const dryDevice = {
    initial: () => 'open',
    configure(lk, s) { lk.mode = s === 'dry' ? 'closed' : 'loss'; },
    review(lk, sol, st, next, env) {
      const k = lk.stateKey, d = lk.dry;
      if (st[k] !== 'dry') {
        const m = sol.m[lk.idx], tol = 1e-9 * env.rho * lk.P.A * lk.P.N;
        if ((d.a && m > tol) || (d.b && m < -tol)) next[k] = 'dry';
      } else if (!(d.a && d.b)) {
        // what drives the flow from a to b through the closed pipe, Pa − Pb + G (the row of an open pipe)
        const drive = sol.P[lk.a] - sol.P[lk.b] + lk.G, tol = 1e-9 * env.rho * Math.abs(env.g);
        if (d.b ? drive > tol : drive < -tol) next[k] = 'open';
      }
    },
  };

  // pipe data in SI, by pipe id (also used by the compressible mode): section, length, friction model, ΣK of the
  // fittings, parallel tubes and the elevations where the pipe connects
  function pipeData(eff, si, errors) {
    const jById = new Map(eff.junctions.map((j) => [j.id, j]));
    const pp = new Map();
    for (const p of eff.pipes) {
      const gm = p.geometry;
      let A, Dh, phiLam = 1; // phiLam: the laminar factor of the section (f·Re = 64·phiLam)
      if (gm.kind === 'circular') { const d = si(gm.d, 'length'); A = Math.PI * d * d / 4; Dh = d; }
      else if (gm.kind === 'annulus') {
        const a = si(gm.dOuter, 'length'), b = si(gm.dInner, 'length');
        // an inner diameter below zero or not less than the outer one is no annulus (its area and Dh could still come out positive)
        if (!(b >= 0 && b < a)) { errors.push(t('core.solver.badGeometry', { id: p.id })); continue; }
        A = Math.PI * (a * a - b * b) / 4; Dh = a - b;
        phiLam = H.annulusLaminar(b / a);
      }
      else if (gm.kind === 'rectangular') {
        const w = si(gm.width, 'length'), h = si(gm.height, 'length');
        A = w * h; Dh = 2 * w * h / (w + h);
        phiLam = H.rectLaminar(Math.min(w, h) / Math.max(w, h));
      }
      else { A = si(gm.area, 'area'); Dh = 4 * A / si(gm.perim, 'length'); }
      const red = 1 - (p.idReduction || 0) / 100;
      Dh *= red; A *= red * red;
      if (!(A > 0) || !(Dh > 0)) { errors.push(t('core.solver.badGeometry', { id: p.id })); continue; }
      // the friction model: one of the list, without friction only when chosen (a missing or unknown one is refused)
      const fr = p.friction;
      if (!PumpIt.model.frictionKnown(fr)) {
        const fm0 = fr && typeof fr === 'object' ? fr.model : undefined;
        errors.push(t('core.solver.badFriction', { id: p.id, model: fm0 === undefined || fm0 === null || fm0 === '' ? '—' : String(fm0) }));
        continue;
      }
      let fm = 'darcy', eD = 0, fx = 0, C = 0;
      if (fr.model === 'roughness') eD = si(fr.eps, 'length') / Dh;
      else if (fr.model === 'relRoughness') eD = fr.rel;
      else if (fr.model === 'smooth') eD = 0;
      else if (fr.model === 'explicitF') { fm = 'explicit'; fx = fr.f; }
      else if (fr.model === 'hw') { fm = 'hw'; C = fr.C; }
      else if (fr.model === 'frictionless') fm = 'none';
      const fT = H.craneFT(Dh);
      let Ksum = 0;
      // a negative quantity or coefficient would turn a loss into a gain, an empty one into no loss
      const fi = PumpIt.model.fittingIssues(p, fT);
      if (fi.length) { errors.push(fi[0].what === 'sum' ? t('core.solver.badFittingSum', { id: p.id, sum: +fi[0].sum.toPrecision(6) }) : t('core.solver.badFittings', { id: p.id, n: fi[0].n })); continue; }
      for (const it of p.fittings || []) Ksum += (it.qty ?? 1) * (it.model === 'KfT' ? it.value * fT : it.value);
      const ju = jById.get(p.up), jd = jById.get(p.down);
      pp.set(p.id, {
        id: p.id, p, A, Dh, phiLam, L: si(p.length, 'length'), fm, eD, fx, C, Ksum, fT,
        fTurb: H.colebrook(1e8, eD), // same pipe at a very high Re (reference of the 'pipeFt' laminar correction)
        N: p.nParallel || 1,
        // a loose end has no elevation: the pipe is left out below, with its message
        zUp: ju ? endElev(ju, p.id) : 0, zDown: jd ? endElev(jd, p.id) : 0, closed: !!p.closed,
      });
    }

    // elevation where a pipe connects: the junction elevation, unless the type defines its own (reservoir depth)
    function endElev(j, pid) {
      const pk = j.pipeK && j.pipeK[pid];
      const def = types.get(j.type);
      const z = def && def.pipeEndElevation ? def.pipeEndElevation(j, pk, si) : undefined;
      return z !== undefined ? z : si(j.elevation, 'length');
    }
    return pp;
  }

  function prepare(eff) {
    const errors = [], warnings = [];
    const sys = eff.system;
    const fl = PumpIt.fluids.evaluate(sys);
    warnings.push(...fl.warnings);
    const rho = fl.rho, mu = fl.mu;
    if (!(rho > 0) || !(mu > 0)) throw new Error(t('core.solver.badFluid'));
    // the atmospheric pressure: a number, above zero once absolute (an empty one would be zero, or the standard one)
    const patm = PumpIt.model.patmOf(sys);
    if (!(patm > 0)) throw new Error(t('core.solver.badPatm'));
    // a vapour pressure below vacuum once absolute (a gauge value below minus the atmospheric pressure of the scenario)
    if (fl.pv < 0) throw new Error(t('core.solver.badVapor', PumpIt.model.vaporText(sys.fluid.pv, fl.pv)));
    const g = U.G0 * sys.gravity;
    if (sys.gravity === 0) warnings.push({ level: 'caution', text: t('core.solver.zeroGravity') });
    const ctx = { rho, patm };
    const si = (qt, cat) => U.toSI(qt.value, qt.unit, cat, ctx);
    const reLam = sys.reLam, reTurb = sys.reTurb;
    const lamMode = sys.laminarK;
    const env = { rho, mu, pv: fl.pv, patm, g, reLam, reTurb, fluid: fl };

    const jById = new Map(eff.junctions.map((j) => [j.id, j]));
    const pp = pipeData(eff, si, errors); // pipe data in SI

    // laminar correction factor of the K values, against the Crane fT or the pipe's own turbulent f; continuous at Re_lam
    // and Re_turb
    function kTerm(K, P, V) {
      if (!K) return 0;
      const aV = Math.abs(V);
      const base = K * rho * V * aV / 2;
      if (lamMode === 'none') return base;
      const Re = rho * aV * P.Dh / mu;
      if (Re >= reTurb) return base;
      const fref = lamMode === 'craneFt' ? P.fT : P.fTurb;
      if (Re < reLam) {
        const lam = K * 32 * mu * V / (P.Dh * fref); // = K·(64/Re)/f_ref·ρV|V|/2, finite as V → 0
        return Math.abs(lam) > Math.abs(base) ? lam : base;
      }
      const cl = Math.max(1, (64 / reLam) / fref);
      const w = (Re - reLam) / (reTurb - reLam);
      return base * ((1 - w) * cl + w);
    }

    function pipeLoss(P, m, endK) {
      const mm = m / P.N;
      const V = mm / (rho * P.A);
      const aV = Math.abs(V);
      const Re = rho * aV * P.Dh / mu;
      let dpF = 0, f = NaN;
      if (P.fm === 'darcy') {
        // laminar: phi·64/Re of the section (an annulus or a rectangle does not lose as a circle of its hydraulic diameter)
        if (Re < reLam) { dpF = P.phiLam * 32 * mu * P.L * V / (P.Dh * P.Dh); f = Re > 0 ? P.phiLam * 64 / Re : Infinity; }
        else { f = H.frictionFactor(Re, P.eD, reLam, reTurb, P.phiLam); dpF = f * P.L / P.Dh * rho * V * aV / 2; }
      } else if (P.fm === 'explicit') { f = P.fx; dpF = f * P.L / P.Dh * rho * V * aV / 2; }
      else if (P.fm === 'hw') {
        dpF = Math.sign(V) * rho * U.G0 * H.hazenWilliamsS(V, P.C, P.Dh) * P.L;
        f = aV > 0 ? Math.abs(dpF) / (P.L / P.Dh * rho * V * V / 2) : NaN;
      } else f = 0;
      const dpK = kTerm(P.Ksum, P, V);
      const dpE = kTerm(V >= 0 ? endK.fwd : endK.rev, P, V) + jetLoss(V >= 0 ? endK.jetF : endK.jetR, P, V);
      return { dp: dpF + dpK + dpE, dpF, dpK, dpE, V, Re, f };
    }
    // a free jet into a reservoir (the flow enters a dry end, whose K into the tank is kIn ≥ 0; −1: not a jet): the loss of
    // that end is at least the kinetic energy of the jet, ρV|V|/2, so that its static pressure is that of the gas over the
    // liquid. A K below 1 counts as 1, without the laminar correction of the K values, which would put the jet above the
    // pressure of the gas; a larger loss of its own K stays (decision 1a of the review of a952425). → the loss to add to
    // that of the K
    function jetLoss(kIn, P, V) {
      if (!(kIn >= 0)) return 0;
      const dyn = rho * V * Math.abs(V) / 2, k = kTerm(kIn, P, V);
      return Math.abs(k) < Math.abs(dyn) ? dyn - k : 0;
    }

    // ---- nodes and links
    const nodes = [], links = [];
    const addNode = (o) => { o.ix = nodes.length; nodes.push(Object.assign({ kind: 'free', demand: 0, value: 0 }, o)); return nodes[nodes.length - 1]; };
    const jNodes = new Map(); // jid → { main } or { in, out, pin, pout }

    // what a junction type sees while it builds its part of the network
    const builder = {
      eff, env, si, rho, g, errors, warnings, pp, kTerm, addNode,
      addLink: (lk) => { links.push(lk); return lk; },
    };

    for (const j of eff.junctions) {
      const def = types.get(j.type);
      const z = si(j.elevation, 'length');
      if (def.multi) {
        jNodes.set(j.id, { main: def.buildNode(j, builder, z) });
      } else {
        const pr = PumpIt.model.ports(eff, j);
        if (!pr) { errors.push(t('core.solver.needsTwoPipes', { id: j.id })); continue; }
        if (def.directional && !pr.consistent) { errors.push(t('core.solver.notDirectional', { id: j.id, label: def.label })); continue; }
        const nin = addNode({ z, jid: j.id, role: 'in' });
        const nout = addNode({ z, jid: j.id, role: 'out' });
        jNodes.set(j.id, { in: nin, out: nout, pin: pr.in.id, pout: pr.out.id });
      }
    }

    // ---- pipe links
    for (const p of eff.pipes) {
      const P = pp.get(p.id);
      if (!P) continue;
      const ja = jById.get(p.up), jb = jById.get(p.down);
      if (!ja || !jb) { errors.push(t('core.solver.pipeNotConnected', { id: p.id })); continue; }
      const na = nodeFor(ja, p.id), nb = nodeFor(jb, p.id);
      if (!na || !nb) continue;
      const pkA = pipeKs(ja, p.id), pkB = pipeKs(jb, p.id);
      const dryA = dry(na, P.zUp), dryB = dry(nb, P.zDown);
      // jetF, jetR: the K into the tank of a dry end that the flow enters, forward (b) or reverse (a)
      const endK = { fwd: pkA.out + pkB.in, rev: pkB.out + pkA.in, jetF: dryB ? pkB.in : -1, jetR: dryA ? pkA.in : -1 };
      const zaEff = effZ(na, P.zUp), zbEff = effZ(nb, P.zDown);
      Object.assign(P, { zaEff, zbEff, endK, pkA, pkB, dryA, dryB });
      const lk = {
        kind: 'pipe', pid: p.id, a: na.ix, b: nb.ix, G: rho * g * (zaEff - zbEff),
        mode: P.closed ? 'closed' : 'loss', fixedClosed: P.closed,
        phi: (m) => pipeLoss(P, m, endK).dp, mref: rho * P.A * P.N * 0.01, P,
      };
      // a dry end: the state of the pipe, by its own key (the junction ids of the dry ends name it in the warnings)
      if ((dryA || dryB) && !P.closed) Object.assign(lk, { device: dryDevice, stateKey: 'P' + p.id, dry: { a: dryA, b: dryB, ja: ja.id, jb: jb.id } });
      links.push(lk);
      P.link = lk;
    }

    function nodeFor(j, pid) {
      const jn = jNodes.get(j.id);
      if (!jn) return null;
      if (jn.main) return jn.main;
      return pid === jn.pin ? jn.in : jn.out;
    }
    // the K of the end of pipe pid at junction j; a static imposed pressure has none, its K values left out with a caution
    function pipeKs(j, pid) {
      const k = PumpIt.junctionTypes.shared.pipeEndK(j, pid);
      if (k.leftOut) warnings.push({ level: 'caution', text: t('core.solver.endKLeftOut', { id: j.id, pipe: pid }), obj: 'j:' + j.id });
      return k;
    }
    // reservoir: a pipe above the liquid level (dry) discharges in free fall (boundary pressure = surface pressure)
    function effZ(nd, zEnd) { return dry(nd, zEnd) ? zEnd : nd.z; }

    // ---- elements of two-port junctions
    for (const j of eff.junctions) {
      const jn = jNodes.get(j.id);
      if (!jn || jn.main) continue;
      const Pin = pp.get(jn.pin), Pout = pp.get(jn.pout);
      if (!Pin || !Pout) continue;
      const Ain = Pin.A * Pin.N, Aout = Pout.A * Pout.N;
      // K element: K referred to the upstream pipe area, per flow direction
      const kElem = (Kf, Kr) => (m) => (m >= 0 ? kTerm(Kf, Pin, m / (rho * Ain)) : kTerm(Kr, Pout, m / (rho * Aout)));
      const lk = { kind: 'elem', jid: j.id, type: j.type, a: jn.in.ix, b: jn.out.ix, G: 0, mode: 'loss', mref: rho * Ain * 0.01, Pin, Pout, j };
      types.get(j.type).buildElement(j, lk, Object.assign(Object.create(builder), { Pin, Pout, Ain, Aout, kElem }));
      links.push(lk);
    }

    return { eff, env, nodes, links, pp, jNodes, jById, errors, warnings, pipeLoss, kTerm };
  }

  PumpIt.solver = Object.assign(PumpIt.solver || {}, { prepare, pipeData, DRY });
})(typeof window !== 'undefined' ? window : globalThis);
