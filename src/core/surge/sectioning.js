// Sectioning of the water hammer (docs/water-hammer.md; §4 of its specification): one time step Δt for the whole network,
// a whole number n ≥ 1 of sections in each pipe, and the wave speed adjusted to a' = L/(n·Δt), so that every section is
// crossed in exactly one step (a Courant number of 1 everywhere). The variance of a pipe is a'/a − 1.
//
// The automatic search (decision W-08): the controlling pipe is the one of the shortest travel time T = L/a (the lowest
// pipe number on a tie); its ideal number of sections N_c goes from N_min by 0.05 while N_c ≤ N_max, with Δt = T_c/N_c and
// n_j = max(1, round(T_j/Δt)), half rounded up; the first N_c whose largest variance stays within the limit is taken.
// Without one, the N_c of the smallest largest variance (the smallest N_c on a tie), with a warning. A given Δt takes
// n_j the same way.
(function (root) {
  const PumpIt = root.PumpIt;

  const STEP = 0.05;
  const TOL = 1e-9;
  const round = (x) => Math.floor(x + 0.5);

  // the sections of every pipe for one Δt: { dt, n: [], v: [], worst (the largest |variance|) }
  function trial(pipes, dt) {
    const n = [], v = [];
    let worst = 0;
    for (const p of pipes) {
      const ideal = p.T / dt;
      const k = Math.max(1, round(ideal));
      const x = ideal / k - 1;
      n.push(k); v.push(x);
      if (Math.abs(x) > worst) worst = Math.abs(x);
    }
    return { dt, n, v, worst };
  }

  // pipes: [{ id, L, a }] (SI); o = { mode: 'auto' | 'given', dt (given, s), limit (fraction: 0.1 for 10 %), ncMin, ncMax }
  // → { ok (the limit is met), dt, nc (auto), controller (id), pipes: [{ id, L, a, T, n, aAdj, variance }], worst }
  function section(pipes, o) {
    const list = pipes.map((p) => ({ id: p.id, L: p.L, a: p.a, T: p.L / p.a }));
    if (!list.length) return { ok: true, dt: NaN, nc: NaN, controller: null, pipes: [], worst: 0 };
    let ctl = list[0];
    for (const p of list) if (p.T < ctl.T || (p.T === ctl.T && p.id < ctl.id)) ctl = p;
    let best = null, nc = NaN;
    if (o.mode === 'given') best = trial(list, o.dt);
    else {
      const ncMin = o.ncMin, ncMax = o.ncMax;
      let bestNc = NaN;
      for (let m = 0; ; m++) {
        const x = ncMin + STEP * m; // by multiplication, never adding 0.05 again and again
        if (x > ncMax + TOL) break;
        const tr = trial(list, ctl.T / x);
        if (tr.worst <= o.limit + TOL) { best = tr; bestNc = x; break; }
        if (!best || tr.worst < best.worst) { best = tr; bestNc = x; }
      }
      nc = bestNc;
    }
    const out = list.map((p, i) => ({ id: p.id, L: p.L, a: p.a, T: p.T, n: best.n[i], aAdj: p.L / (best.n[i] * best.dt), variance: best.v[i] }));
    return { ok: best.worst <= o.limit + TOL, dt: best.dt, nc, controller: ctl.id, pipes: out, worst: best.worst };
  }

  PumpIt.surge = Object.assign(PumpIt.surge || {}, { sectioning: { STEP, section } });
})(typeof window !== 'undefined' ? window : globalThis);
