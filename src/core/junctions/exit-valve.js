// Exit valve: the end of a single pipe discharging to a given residual pressure, through a valve loss
// (K, Cv, Kv or an opening with its characteristic). A table of the time simulation may close it (closed).
(function (root) {
  const PumpIt = root.PumpIt;
  const { t } = PumpIt.i18n;
  const q = PumpIt.model.q;
  const JS = PumpIt.junctionTypes.shared;

  PumpIt.junctionTypes.register({
    type: 'exitvalve', order: 90, group: 'valves',
    pipes: [1, 1], multi: true, ref: true,
    lossModels: ['K', 'Cv', 'Kv', 'opening'],

    defaults: () => ({ Pout: q(0, 'kgf/cm²(g)'), lossModel: 'K', K: 0, Cv: 100, Kv: 86, CvMax: 100, char: 'linear', R: 50, open: 100 }),

    validate(j, miss, { fin, gasP }) {
      if (!fin(j.Pout)) miss.push(t('junctions.exitvalve.check.Pout'));
      gasP(j.Pout, 'junctions.exitvalve.check.Pout');
      JS.checkValveLoss(j, miss);
    },

    buildNode(j, net, z) {
      const rho = net.rho;
      const nd = net.addNode({ z, jid: j.id });
      const ext = net.addNode({ kind: 'fixed', value: net.si(j.Pout, 'pressure'), z, jid: j.id, role: 'ext' });
      const pc = PumpIt.model.pipesAt(net.eff, j.id)[0];
      const P = pc && net.pp.get(pc.id);
      if (!P) { net.errors.push(t('junctions.exitvalve.error.noPipe', { id: j.id })); return nd; }
      const lk = net.addLink({
        kind: 'ext', jid: j.id, a: nd.ix, b: ext.ix, G: 0, mode: 'loss', P,
        phi: JS.valveLoss(j, (m) => net.kTerm(j.K, P, m / (rho * P.A * P.N)), rho),
        mref: rho * P.A * P.N * 0.01,
        m0: rho * P.A * P.N * 1,
      });
      if (j.closed || JS.shutByOpening(j)) { lk.mode = 'closed'; lk.fixedClosed = true; }
      return nd;
    },

    nodeResults(j, jr, rc) {
      JS.dischargeResults(j, jr, rc);
      if (rc.nd.isolated) return;
      const { rho } = rc.env;
      const pc = rc.con[0], pr = pc && rc.pipeOf(pc.id);
      const vr = { type: j.type, m: jr.m, Q: jr.Q, dP: jr.dP, Pin: jr.Pin, P0in: rc.P0, Pout: jr.Pext, state: t('junctions.states.discharging') };
      // K and Cv by the loss along the flow, as an in-line valve: an inflow (from the outside pressure) through the same
      // valve has the same K and Cv; the flow and the drop keep their signs (review of e6b8f15, item 22)
      const loss = jr.m < 0 ? -jr.dP : jr.dP;
      vr.K = pr && pr.V ? loss / (rho * pr.V * pr.V / 2) : NaN;
      vr.Cv = JS.flowCv(jr.m, jr.dP, rho);
      if (j.closed || JS.shutByOpening(j)) vr.state = t('junctions.states.closed');
      if (j.lossModel === 'opening') vr.open = j.closed ? 0 : j.open;
      if (jr.m < 0) rc.warn('warning', t('junctions.exitvalve.warn.inflow', { id: j.id }), 'j:' + j.id);
      rc.valves[j.id] = vr;
    },

    // time simulation: as a valve, the value of its loss model follows a table, which also closes it
    time: JS.valveTime,

    // compressible mode: a K element (K, or the K of Cv or Kv at the area of the pipe) from the end of the pipe to the
    // outside pressure, where the static pressure of the jet is the residual one; it chokes like a K element
    gas: {
      node(j, net, z) {
        const nd = net.addNode({ z, jid: j.id });
        const ext = net.addNode({ kind: 'fixed', value: net.si(j.Pout, 'pressure'), pk: 'static', z, jid: j.id, role: 'ext' });
        const pc = PumpIt.model.pipesAt(net.eff, j.id)[0];
        const P = pc && net.pp.get(pc.id);
        if (!P) { net.errors.push(t('junctions.exitvalve.error.noPipe', { id: j.id })); return nd; }
        const A = P.A * P.N, K = JS.shutByOpening(j) ? 0 : JS.gasValveK(j, j.K, A);
        const lk = {
          kind: 'ext', jid: j.id, a: nd.ix, b: ext.ix, mode: 'loss', rel: 'duct', P,
          d: { L: 0, N: 1, A: [A, A], D: [P.Dh, P.Dh], K: [K, K], lam: [net.lamOf(P), net.lamOf(P)], fm: 'none', eD: 0, fx: 0, dz: 0, reLam: net.env.reLam, reTurb: net.env.reTurb },
        };
        // without a loss between two pressures of one kind, the end of the pipe is at the outside pressure
        if (!(K > 0) && nd.pk === ext.pk) { lk.mode = 'dP'; lk.value = 0; lk.con = (m, na, nb) => na.P - nb.P; lk.conScale = 'P'; }
        if (j.closed || JS.shutByOpening(j)) { lk.mode = 'closed'; lk.fixedClosed = true; }
        net.addLink(lk);
        return nd;
      },
      // K and Cv: the drop referred to the density and the velocity of the end of the pipe at the valve (its "out" end when
      // the pipe is drawn towards the valve, its "in" end when drawn from it), so the drawing does not change them
      // (G-40); an inflow, which warns, takes the same end, and its K and Cv are those of the loss along the flow, as
      // for a liquid (review of e6b8f15, item 22)
      results(j, jr, rc) {
        JS.gasDischargeResults(j, jr, rc);
        if (rc.nd.isolated) return;
        const pc = rc.con[0], pr = pc && rc.pipeOf(pc.id);
        const vr = { type: j.type, m: jr.m, Q: jr.Q, QN: jr.QN, dP: jr.dP, Pin: jr.Pin, P0in: jr.P0in, Pout: jr.Pext, state: t('junctions.states.discharging'), choked: jr.choked };
        const atOut = pc && pc.down === j.id, rhoE = pr ? (atOut ? pr.rhoOut : pr.rhoIn) : NaN, VE = pr ? (atOut ? pr.Vout : pr.Vin) : NaN;
        vr.K = VE && rhoE > 0 ? (jr.m < 0 ? -jr.dP : jr.dP) / (rhoE * VE * VE / 2) : NaN;
        vr.Cv = pr ? JS.gasEquivalentCv(vr.K, pr.A * pr.N) : NaN;
        if (j.closed || JS.shutByOpening(j)) vr.state = t('junctions.states.closed');
        if (j.lossModel === 'opening') vr.open = j.closed ? 0 : j.open;
        if (jr.m < 0) rc.warn('warning', t('junctions.exitvalve.warn.inflow', { id: j.id }), 'j:' + j.id);
        rc.valves[j.id] = vr;
      },
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
