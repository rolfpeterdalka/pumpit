// Control valve: PRV (downstream pressure), PSV (upstream pressure), FCV (flow) or PDCV (pressure drop).
// It is a stateful device: controlling, fully open or closed, reviewed after each hydraulic convergence
// (specification section 7). A special condition (open/closed) fixes the state. An optional characteristic (the Cv
// at full opening, linear or of equal percentage) gives its opening in the results (§7.2 of the time simulation).
(function (root) {
  const PumpIt = root.PumpIt;
  const { t } = PumpIt.i18n;
  const q = PumpIt.model.q;
  const JS = PumpIt.junctionTypes.shared;
  const { KGF, fmtSI, dynOf } = PumpIt.solver.util;

  const device = {
    initial: (lk) => (lk.j.special === 'closed' ? 'closed' : lk.j.special === 'open' ? 'open' : 'control'),
    // a state carried from the step before (time simulation): a special condition still fixes the state. A flow control
    // valve closed by a failure starts again from control, so that it controls once the network lets it, and closes
    // again where it still cannot (item 10 of the review of a952425): its closed state has no review of its own
    resume: (lk, s) => (lk.j.special && lk.j.special !== 'none' ? device.initial(lk) : lk.ctype === 'FCV' && s === 'closed' ? 'control' : s),

    configure(lk, s) {
      if (s === 'closed') lk.mode = 'closed';
      else if (s === 'open') { lk.mode = 'loss'; lk.phi = lk.phiOpen; }
      else lk.mode = lk.controlMode;
    },

    review(lk, sol, st, next, env) {
      const j = lk.j;
      if (j.special && j.special !== 'none') return; // a special condition fixes the state
      const { rho } = env;
      const m = sol.m[lk.idx];
      const Pa = sol.P[lk.a], Pb = sol.P[lk.b];
      const s = st[lk.jid];
      const dPreq = Pa - Pb;
      const dPopen = lk.phiOpen(m);
      const basisDown = Pb - dynOf(lk.ctype === 'PRV' ? lk.dynPipe : null, rho, sol.m[lk.dynPipe?.link?.idx ?? -1] ?? m);
      const basisUp = Pa - dynOf(lk.ctype === 'PSV' ? lk.dynPipe : null, rho, sol.m[lk.dynPipe?.link?.idx ?? -1] ?? m);
      // a reverse flow beyond the rounding: a velocity of 1e-9 m/s in the inlet pipe
      const reverse = m < -1e-9 * rho * lk.Ain;
      if (s === 'control') {
        if (j.alwaysControl) return;
        if (lk.ctype === 'FCV') { if (dPreq < dPopen) next[lk.jid] = j.failAction === 'closed' ? 'closed' : 'open'; }
        else if (lk.ctype === 'PRV' || lk.ctype === 'PSV') {
          if (m < 0) next[lk.jid] = 'closed';
          else if (dPreq < dPopen) next[lk.jid] = 'open';
        }
      } else if (s === 'open') {
        // fully open, a pressure reducing or sustaining valve closes against a reverse flow, as it does controlling
        // (I-61; item 11 of the review of a952425)
        if ((lk.ctype === 'PRV' || lk.ctype === 'PSV') && reverse) { next[lk.jid] = 'closed'; return; }
        if (lk.ctype === 'PRV' && basisDown > lk.value) next[lk.jid] = 'control';
        if (lk.ctype === 'PSV' && basisUp < lk.value) next[lk.jid] = 'control';
        if (lk.ctype === 'FCV' && m > lk.value) next[lk.jid] = 'control';
      } else if (s === 'closed') {
        if (lk.ctype === 'PRV' && Pa > Pb && Pb < lk.value) next[lk.jid] = 'control';
        if (lk.ctype === 'PSV' && Pa > lk.value && Pa > Pb) next[lk.jid] = 'control';
      }
    },
  };

  PumpIt.junctionTypes.register({
    type: 'control', order: 80, group: 'valves',
    pipes: [2, 2], directional: true,

    defaults: () => ({
      ctype: 'PRV', setP: q(2, 'kgf/cm²(g)'), setQ: q(20, 'm³/h'), setDP: q(0.5, 'kgf/cm²'),
      basis: 'static', alwaysControl: true, kOpen: 0, failAction: 'open', special: 'none',
      char: 'none', CvMax: 100, R: 50,
    }),

    validate(j, miss, { fin, pos, gasP }) {
      if ((j.ctype === 'PRV' || j.ctype === 'PSV') && !fin(j.setP)) miss.push(t('junctions.control.check.setP'));
      if (j.ctype === 'PRV' || j.ctype === 'PSV') gasP(j.setP, 'junctions.control.check.setP');
      if (j.ctype === 'FCV' && !pos(j.setQ)) miss.push(t('junctions.control.check.setQ'));
      if (j.ctype === 'PDCV' && !fin(j.setDP)) miss.push(t('junctions.control.check.setDP'));
      if (!(j.kOpen >= 0)) miss.push(t('junctions.control.check.kOpen'));
      if (j.char && j.char !== 'none') JS.checkCharacteristic(j, miss, false);
    },

    buildElement(j, lk, net) {
      const { si, Pin, Pout } = net;
      lk.phiOpen = net.kElem(j.kOpen, j.kOpen);
      lk.ctype = j.ctype;
      if (j.ctype === 'PRV') { lk.controlMode = 'pDown'; lk.value = si(j.setP, 'pressure'); lk.dynPipe = j.basis === 'static' ? Pout : null; }
      else if (j.ctype === 'PSV') { lk.controlMode = 'pUp'; lk.value = si(j.setP, 'pressure'); lk.dynPipe = j.basis === 'static' ? Pin : null; }
      else if (j.ctype === 'FCV') { lk.controlMode = 'fixedFlow'; lk.value = si(j.setQ, 'flow'); }
      else { lk.controlMode = 'dP'; lk.value = si(j.setDP, 'dp'); }
      lk.phi = lk.phiOpen;
      lk.Ain = net.Pin.A * net.Pin.N;
      lk.device = device;
    },

    elementResults(j, jr, rc) {
      const vr = JS.inlineValveResult(j, jr, rc);
      // the loss of the fully open valve at the flow, against the drop it holds
      stateAndWarnings(j, vr, rc, () => [rc.el.phiOpen(rc.m), rc.dP]);
      rc.valves[j.id] = vr;
    },

    // time simulation: the set point follows a table; once it applies, the valve controls (the special condition no
    // longer applies). Its state is that of the device: controlling, fully open or closed
    time: {
      results: 'valves', states: ['control', 'open', 'closed'], log: 'control',
      quantities(j) {
        const set = (field, cat, unit, min) => ({
          what: 'set', cat, min, noNegative: min === 0, steady: (x, si) => si(x[field], cat),
          apply: (jc, v) => { jc.special = 'none'; jc[field] = q(v, unit); },
        });
        if (j.ctype === 'FCV') return [set('setQ', 'flow', 'kg/s', 0)];
        if (j.ctype === 'PDCV') return [set('setDP', 'dp', 'Pa')];
        return [set('setP', 'pressure', 'Pa(a)')];
      },
      stateOf: (jc, sol) => (sol && sol.states ? sol.states[jc.id] : undefined),
      opening: (j) => !!(j.char && j.char !== 'none'),
      // closed by its special condition: no set point starts closed, so a table does not fit it (rule 6 of D.3)
      special: (j) => (j.special === 'closed' ? 'closed' : ''),
    },

    // water hammer (docs/water-hammer.md, decision W-12): frozen, the default, keeps the loss of its steady state, as a
    // valve of a fixed opening; ideal controls at every step with the states above, and only then takes a table of its set
    // point. An ideal valve may have a largest speed of its opening (surgeRate, % of the full opening per second; decision
    // W-49), which needs its characteristic: its opening then follows the one its control asks for no faster than that
    surge: {
      quantities: (j) => (j.surgeControl === 'ideal' ? PumpIt.junctionTypes.get('control').time.quantities(j) : []),
      frozen: (j) => j.surgeControl !== 'ideal',
      // its opening joins the results whenever it controls with its characteristic (phase G3, case T19)
      tracks: (j) => j.surgeControl === 'ideal' && JS.CHARS.includes(j.char) && j.CvMax > 0,
      rate: (j) => (j.surgeControl === 'ideal' && Number.isFinite(j.surgeRate) && j.surgeRate > 0 && JS.CHARS.includes(j.char) ? j.surgeRate / 100 : 0),
      openingOf: (j, Cv) => JS.openingOfCv(j.char, j.CvMax, j.R, Cv),
      cvAt: (j, x) => JS.cvAtOpening(j.char, j.CvMax, j.R, x),
      validate(j, miss) {
        if (j.surgeControl !== 'ideal' || j.surgeRate === null || j.surgeRate === undefined) return;
        if (!(Number.isFinite(j.surgeRate) && j.surgeRate > 0)) miss.push('valve.rate');
        else if (!JS.CHARS.includes(j.char)) miss.push('valve.char');
      },
    },

    // compressible mode: the same states and rules, with the gas relations. Open, the valve is a K element of kOpen;
    // controlling, its flow is an unknown with a row of its own: the pressure on the basis of the set point (static or
    // stagnation, converted through the Mach number of the pipe at that end), the mass flow (a volume is read at the
    // inlet conditions) or the pressure drop.
    gas: {
      element(j, lk, net) {
        const { si, cx } = net;
        lk.ctype = j.ctype;
        lk.pk = net.internal;
        net.kElement(j.kOpen, j.kOpen);
        lk.open = { mode: lk.mode, con: lk.con, conScale: lk.conScale };
        const basis = j.basis === 'static' ? 'static' : 'stagnation';
        if (j.ctype === 'PRV' || j.ctype === 'PSV') {
          const v = si(j.setP, 'pressure'), down = j.ctype === 'PRV';
          lk.value = v;
          lk.basisOf = (sol, side) => basisP(cx, side === 'b' ? gnode(lk, sol, lk.b) : gnode(lk, sol, lk.a), basis, machAt(sol, side === 'b' ? net.Pout : net.Pin, side === 'b' ? lk.b : lk.a));
          lk.ctrl = {
            mode: down ? 'pDown' : 'pUp', conScale: 'P',
            con: (m, na, nb, sol) => basisP(cx, down ? nb : na, basis, machAt(sol, down ? net.Pout : net.Pin, down ? lk.b : lk.a)) - v,
          };
        } else if (j.ctype === 'FCV') {
          const f = net.flowExt(j.setQ, 1, j) || { m: 0 };
          if (f.m !== undefined) { lk.ctrl = { mode: 'fixedFlow', value: f.m }; lk.setMass = () => f.m; }
          else {
            lk.setMass = (na) => f.Q * PumpIt.gas.flow.rhoOf(cx, na.P, PumpIt.gas.flow.tempOf(cx, na));
            lk.ctrl = { mode: 'fixedFlow', value: f.Q * net.env.rhoN, conScale: 'M', con: (m, na) => m - lk.setMass(na) };
            lk.localVolume = true; // its value is a scale only, not the mass of the set flow
          }
          lk.value = lk.ctrl.value;
        } else {
          const v = si(j.setDP, 'dp');
          lk.ctrl = { mode: 'dP', conScale: 'P', con: (m, na, nb) => na.P - nb.P - v };
        }
        lk.controlMode = lk.ctrl.mode;
        lk.device = gasDevice;
      },
      results(j, jr, rc) {
        const vr = { type: j.type, m: rc.m, Q: jr.Q, QN: jr.QN, dP: rc.dP, Pin: jr.Pin, P0in: rc.P0in, K: jr.K, choked: jr.choked };
        // the K and the area of the pipe the flow comes from (the outlet one in reverse flow, as the K is referred)
        vr.Cv = JS.gasEquivalentCv(jr.K, rc.el.d ? rc.el.d.A[rc.m < 0 ? 1 : 0] : NaN);
        // the drop the fully open valve needs for the flow, against the drop it holds (between its nodes, as its row)
        stateAndWarnings(j, vr, rc, () => {
          const na = gnode(rc.el, rc.res, rc.el.a), nb = gnode(rc.el, rc.res, rc.el.b);
          return [openDrop(rc.cx, rc.el, na, nb, rc.m), na.P - nb.P];
        });
        rc.valves[j.id] = vr;
      },
    },
  });

  // state shown for the valve and the warnings of a valve that adds pressure or does not control. openLoss() gives the
  // drop the fully open valve needs for the flow and the drop the valve holds
  function stateAndWarnings(j, vr, rc, openLoss) {
    const s = rc.st[j.id];
    vr.state = t('junctions.states.' + (s === 'control' ? 'controlling' : s === 'open' ? 'fullyOpen' : 'closed'));
    vr.ctype = j.ctype;
    // the opening, from the characteristic: closed 0 %, fully open 100 %, controlling the inverse of its Cv
    if (j.char && j.char !== 'none' && j.CvMax > 0) vr.open = s === 'closed' ? 0 : s === 'open' ? 100 : 100 * JS.openingOfCv(j.char, j.CvMax, j.R, vr.Cv);
    if (s === 'control' && rc.dP < 0) {
      vr.state = t('junctions.states.addingPressure');
      rc.warn('critical', t('junctions.control.warn.addingPressure', { id: j.id, dp: fmtSI(-rc.dP / KGF) }), 'j:' + j.id);
    }
    // a PDCV is ideal: it holds its drop at any flow and never fails (I-61). A flow above what the fully open valve passes
    // at that drop warns (decision 3b of the review of a952425): the fully open valve would need more than the drop
    if (s === 'control' && j.ctype === 'PDCV' && rc.m > 0 && openLoss) {
      const [open, held] = openLoss();
      if (open > held + 1e-9 * Math.max(Math.abs(held), 1)) {
        const text = Number.isFinite(open) ? t('junctions.control.warn.beyondOpen', { id: j.id, open: fmtSI(open / KGF), dp: fmtSI(held / KGF) })
          : t('junctions.control.warn.beyondChoke', { id: j.id, dp: fmtSI(held / KGF) });
        rc.warn('warning', text, 'j:' + j.id);
      }
    }
    if (s !== 'control' && j.special === 'none') rc.warn('warning', t('junctions.control.warn.notControlling', { ctype: j.ctype, id: j.id, state: vr.state }), 'j:' + j.id);
  }

  // ---------- compressible mode helpers
  const gnode = (lk, sol, ix) => JS.gasNode(lk.pk, sol, ix);
  const machAt = JS.gasMachAt, basisP = JS.gasBasisP;
  // pressure drop the fully open valve needs for the mass flow m (Infinity when it cannot pass it)
  function openDrop(cx, lk, na, nb, m) {
    if (!(m > 0) || lk.open.mode !== 'loss') return 0;
    const Fw = PumpIt.gas.flow;
    const s = Fw.ductOut(cx, lk.d, 1, na, m / (lk.d.A[0] * lk.d.N));
    return s.ok ? na.P - Fw.outEq(cx, s, nb.pk) : Infinity;
  }
  const gasDevice = {
    initial: device.initial,
    resume: device.resume,
    configure(lk, s) {
      const o = s === 'open' ? lk.open : s === 'control' ? lk.ctrl : null;
      if (!o) { lk.mode = 'closed'; return; }
      lk.mode = o.mode; lk.con = o.con; lk.conScale = o.conScale;
      if (o.mode === 'fixedFlow') lk.value = o.value;
    },
    review(lk, sol, st, next, env) {
      const j = lk.j;
      if (j.special && j.special !== 'none') return;
      const cx = env.cx;
      const m = sol.m[lk.idx];
      const na = gnode(lk, sol, lk.a), nb = gnode(lk, sol, lk.b);
      const s = st[lk.jid];
      const dPreq = na.P - nb.P, dPopen = openDrop(cx, lk, na, nb, m);
      // a reverse flow beyond the rounding: a velocity of 1e-9 m/s in the inlet pipe, at the density of its node
      const Fw = PumpIt.gas.flow, A = lk.d ? lk.d.A[0] * lk.d.N : NaN;
      const reverse = m < 0 && !(m >= -1e-9 * Fw.rhoOf(cx, na.P, Fw.tempOf(cx, na)) * A);
      if (s === 'control') {
        if (j.alwaysControl) return;
        if (lk.ctype === 'FCV') { if (dPreq < dPopen) next[lk.jid] = j.failAction === 'closed' ? 'closed' : 'open'; }
        else if (lk.ctype === 'PRV' || lk.ctype === 'PSV') {
          if (m < 0) next[lk.jid] = 'closed';
          else if (dPreq < dPopen) next[lk.jid] = 'open';
        }
      } else if (s === 'open') {
        if ((lk.ctype === 'PRV' || lk.ctype === 'PSV') && reverse) { next[lk.jid] = 'closed'; return; }
        if (lk.ctype === 'PRV' && lk.basisOf(sol, 'b') > lk.value) next[lk.jid] = 'control';
        if (lk.ctype === 'PSV' && lk.basisOf(sol, 'a') < lk.value) next[lk.jid] = 'control';
        if (lk.ctype === 'FCV' && m > lk.setMass(na)) next[lk.jid] = 'control';
      } else if (s === 'closed') {
        if (lk.ctype === 'PRV' && na.P > nb.P && lk.basisOf(sol, 'b') < lk.value) next[lk.jid] = 'control';
        if (lk.ctype === 'PSV' && na.P > lk.value && na.P > nb.P) next[lk.jid] = 'control';
      }
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
