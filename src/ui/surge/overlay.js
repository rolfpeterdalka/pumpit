// The water hammer on the drawing (§10.3 of its specification): four quantities of the selector of results on the
// drawing, offered while it is on. At the time of the cursor, the static pressure or the grade line of every pipe (the
// mean of its output stations); over the whole run, the largest and the smallest static pressure each pipe reached at any
// of its stations (its envelopes). The colours at the cursor keep the range of the whole run, so that one time compares
// with another as the cursor moves (the time of the cursor is in its bar, above). Beside a junction: its pressure (at its inlet for a device), at the cursor or its
// extreme.
(function (root) {
  const PumpIt = root.PumpIt;
  const UI = PumpIt.ui, CS = UI.colorScales;
  const app = PumpIt.app;
  const { t } = PumpIt.i18n;
  const tx = (key, params) => t('surge.overlay.' + key, params);

  const offered = (gas) => !gas && !!(app.surgeOn && app.surgeOn());
  const run = () => app.surgeRun();
  const z = (p, i) => p.zUp + (p.zDown - p.zUp) * i / p.n;

  // the mean over the output stations of a pipe at a recorded time of its static pressure (head: of its grade line)
  function meanAt(r, p, k, head) {
    const rho = r.env.rho, rg = rho * r.env.g, k2 = 1 / (2 * rho * p.A * p.A);
    let sum = 0, n = 0;
    p.stations.forEach((i, s) => {
      const m = (p.series.mU[s][k] + p.series.mD[s][k]) / 2, ps = p.series.P[s][k] - m * m * k2;
      const v = head ? ps / rg + z(p, i) : ps;
      if (Number.isFinite(v)) { sum += v; n++; }
    });
    return n ? sum / n : NaN;
  }
  // the range of the whole run: of the static pressure, or of the grade line, at every station
  function range(r, head) {
    const rg = r.env.rho * r.env.g;
    let min = Infinity, max = -Infinity;
    for (const id in r.pipes) {
      const p = r.pipes[id], X = r.extremes.pipes[id];
      for (let i = 0; i <= p.n; i++) {
        const lo = head ? X.pmin[i] / rg + z(p, i) : X.pmin[i], hi = head ? X.pmax[i] / rg + z(p, i) : X.pmax[i];
        if (lo < min) min = lo;
        if (hi > max) max = hi;
      }
    }
    return { min, max };
  }
  function atCursor(head) {
    const r = run();
    if (!r) return null;
    const k = app.surgeCursor(), vals = new Map();
    for (const id in r.pipes) { const v = meanAt(r, r.pipes[id], k, head); if (Number.isFinite(v)) vals.set(Number(id), v); }
    const { min, max } = range(r, head);
    return max > min ? { vals, min, max } : { vals };
  }
  // the extreme of every pipe over all its stations (largest: its largest pmax; smallest: its smallest pmin)
  function envelope(largest) {
    const r = run();
    if (!r) return null;
    const vals = new Map();
    for (const id in r.pipes) {
      const X = r.extremes.pipes[id];
      let v = largest ? -Infinity : Infinity;
      for (const x of largest ? X.pmax : X.pmin) if (largest ? x > v : x < v) v = x;
      if (Number.isFinite(v)) vals.set(Number(id), v);
    }
    return { vals };
  }
  // the pressure of a junction: its node, or the inlet of a device
  const fieldOf = (o) => (o.fields.includes('P') ? 'P' : o.fields.includes('P1') ? 'P1' : null);
  function junctionAt(id, head) {
    const r = run(), o = r && r.junctions[id], f = o && fieldOf(o);
    if (!f) return null;
    const v = o.series[f][app.surgeCursor()];
    if (!head) return v;
    const jr = r.steady && r.steady.junctions[id];
    return jr && Number.isFinite(jr.z) ? v / (r.env.rho * r.env.g) + jr.z : null;
  }
  function junctionExtreme(id, largest) {
    const r = run(), o = r && r.junctions[id], f = o && fieldOf(o);
    const e = f && r.extremes.junctions[id] && r.extremes.junctions[id][f];
    return e ? (largest ? e.max : e.min) : null;
  }

  CS.addOverlay('surgeP', { cat: 'pressure', label: 'surge.overlay.P', offered, values: () => atCursor(false), junction: (id) => junctionAt(id, false), title: () => tx('titleP') });
  CS.addOverlay('surgeHGL', { cat: 'head', label: 'surge.overlay.HGL', offered, values: () => atCursor(true), junction: (id) => junctionAt(id, true), title: () => tx('titleHGL') });
  CS.addOverlay('surgePmax', { cat: 'pressure', label: 'surge.overlay.Pmax', offered, values: () => envelope(true), junction: (id) => junctionExtreme(id, true), title: () => tx('titlePmax') });
  CS.addOverlay('surgePmin', { cat: 'pressure', label: 'surge.overlay.Pmin', offered, values: () => envelope(false), junction: (id) => junctionExtreme(id, false), title: () => tx('titlePmin') });
})(window);
