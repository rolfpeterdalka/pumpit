// Generic component: a given K, or a pressure-drop × flow curve. The curve is a loss: from no flow to its last point the
// fitted curve never goes below zero (a gain would make the component a pump), and in the compressible mode, where the
// flow is found from the loss, it rises too. Beyond its last point the curve is extrapolated, and an operating point
// there where it breaks the same rule gives no result.
(function (root) {
  const PumpIt = root.PumpIt;
  const { t } = PumpIt.i18n;
  const U = PumpIt.units, H = PumpIt.hyd;

  // the loss curve in SI (volume flow → pressure drop), with tol: the rounding a fit through the points may leave below
  // zero or in its slope (10⁻⁹ of the largest point)
  function lossCurve(c) {
    const ys = c.y.map((v) => U.toSI(v, c.yUnit, 'dp'));
    const cv = H.makeCurve(c.x.map((v) => U.toSI(v, c.xUnit, 'volFlow')), ys, c.fit);
    cv.tol = 1e-9 * Math.max(0, ...ys.filter(Number.isFinite).map(Math.abs));
    return cv;
  }
  // a flow of the curve in its own unit, for a message
  const flowText = (c, Q) => String(+U.fromSI(Q, c.xUnit, 'volFlow').toPrecision(4));
  // what is wrong with a loss curve, or null: { key: 'fit' | 'gain' | 'falls', and the parameters of its message }
  function curveIssue(c, gas) {
    let cv;
    try { cv = lossCurve(c); } catch (e) { return { key: 'fit', message: e.message }; }
    const top = Math.max(cv.xmax, 0), unit = U.label(c.xUnit);
    const below = H.belowZero(cv, 0, top, cv.tol);
    // (a range that starts at a flow too small to tell from none starts at 0)
    if (below) return { key: 'gain', from: flowText(c, below.from > 1e-6 * top ? below.from : 0), to: flowText(c, below.to), unit };
    if (gas && !H.curveRises(cv, 0, top, cv.tol)) return { key: 'falls', to: flowText(c, top), unit };
    return null;
  }

  PumpIt.junctionTypes.register({
    type: 'generic', order: 110, group: 'losses',
    pipes: [2, 2],

    defaults: () => ({
      genModel: 'K', K: 1,
      curve: { x: [0, 10, 20, 30], y: [0, 0.05, 0.2, 0.45], xUnit: 'm³/h', yUnit: 'kgf/cm²', fit: '2' },
    }),

    validate(j, miss, { curveOk, gas }) {
      if (j.genModel === 'K' && !(j.K >= 0)) miss.push('K');
      if (j.genModel !== 'curve') return;
      if (!curveOk(j.curve, 2)) { miss.push(t('junctions.generic.check.curve')); return; }
      let issue = null;
      try { issue = curveIssue(j.curve, gas); } catch (e) { return; } // a unit the checklist reports
      if (issue) miss.push(t('junctions.generic.check.' + issue.key, issue));
    },

    buildElement(j, lk, net) {
      if (j.genModel === 'curve') {
        const rho = net.rho;
        const c = j.curve;
        const issue = curveIssue(c, false);
        if (issue) { net.errors.push(t('junctions.generic.error.' + issue.key, Object.assign({ id: j.id }, issue))); return; }
        const cv = lossCurve(c);
        lk.phi = (m) => Math.sign(m) * H.evalCurve(cv, Math.abs(m) / rho);
        lk.curve = cv;
      } else lk.phi = net.kElem(j.K, j.K);
    },

    // an operating point beyond the last point of the curve, where the extrapolated loss is a gain: no result
    elementResults(j, jr, rc) {
      const cv = rc.el.curve;
      if (!cv || jr.isolated) return;
      const Q = Math.abs(rc.m) / rc.env.rho;
      if (!(Q > cv.xmax * (1 + 1e-9))) return;
      const v = H.evalCurve(cv, Q);
      if (v < -cv.tol) rc.refuse(t('junctions.generic.error.beyond', { id: j.id, flow: flowText(j.curve, Q), unit: U.label(j.curve.xUnit), dp: (v / 1000).toFixed(3) }));
    },

    // compressible mode: a K element, or the curve read against the volume flow at the inlet conditions (the gas
    // density of the node the flow comes from)
    gas: {
      element(j, lk, net) {
        if (j.genModel !== 'curve') { net.kElement(j.K, j.K); return; }
        const c = j.curve;
        const issue = curveIssue(c, true);
        if (issue) { net.errors.push(t('junctions.generic.error.' + issue.key, Object.assign({ id: j.id }, issue))); return; }
        const cv = lossCurve(c);
        const cx = net.cx;
        lk.rel = 'curve';
        lk.curve = cv;
        lk.curveFlow = (na, nb) => {
          const fwd = na.P >= nb.P, up = fwd ? na : nb;
          const Q = invertCurve(cv, Math.abs(na.P - nb.P));
          return { m: (fwd ? 1 : -1) * Q * PumpIt.gas.flow.rhoOf(cx, up.P, PumpIt.gas.flow.tempOf(cx, up)), choked: false };
        };
      },
      // an operating point beyond the last point of the curve, where the extrapolated loss falls: the flow found from the
      // loss is not the only one, so no result
      results(j, jr, rc) {
        const cv = rc.el && rc.el.curve;
        if (!cv || jr.isolated) return;
        const Fw = PumpIt.gas.flow;
        const up = rc.nodeOf(rc.m >= 0 ? rc.el.a : rc.el.b), rho = Fw.rhoOf(rc.cx, up.P, Fw.tempOf(rc.cx, up));
        const Q = rho > 0 ? Math.abs(rc.m) / rho : NaN;
        if (Q > cv.xmax * (1 + 1e-9) && !H.curveRises(cv, cv.xmax, Q, cv.tol)) {
          rc.refuse(t('junctions.generic.error.beyondFalls', { id: j.id, flow: flowText(j.curve, Q), unit: U.label(j.curve.xUnit) }));
        }
      },
    },
  });

  // flow at which an increasing curve gives the pressure drop dP (0 below the start of the curve)
  function invertCurve(cv, dP) {
    if (!(dP > 0)) return 0;
    const f = (q) => H.evalCurve(cv, q) - dP;
    if (f(0) >= 0) return 0;
    let lo = 0, hi = Math.max(cv.xmax, 1e-9);
    for (let i = 0; i < 60 && f(hi) < 0; i++) { lo = hi; hi *= 2; }
    if (f(hi) < 0) return hi;
    for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (f(mid) < 0) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
})(typeof window !== 'undefined' ? window : globalThis);
