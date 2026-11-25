// Tables of the time simulation (docs/time-simulation.md, §4.3 of its specification): the value of a table of points
// (τ, v) at a time τ, linear or stepwise between the points, and past the last one repeated, held or extrapolated.
// A table is typed like the curves of Pump It (a list of numbers per column and a unit per column) and converted to SI
// once, when the simulation is prepared. A table may hold a second column of values (v2, v2Unit; item 3 of D.10): the
// temperature of the gas of a boundary, or the volume of a vessel whose heat is given; it follows the times of the first.
(function (root) {
  const PumpIt = root.PumpIt;
  const U = PumpIt.units;

  // a table as typed → { t: [s], c: [values in the interpolation space], n, c2 (the second column in SI, when the
  // quantity takes one) }. q: the quantity the table drives (its unit category, its interpolation space, q.second for the
  // second column); basis 'relative': the values are % of the steady value (SI) of that quantity, steady2 that of the
  // second column
  function prepare(tt, q, { basis, steady, steady2, ctx }) {
    const t = tt.t.map((x) => U.toSI(x, tt.tUnit, 'time'));
    const col = (xs, unit, cat, st) => (basis === 'relative' ? xs.map((x) => (x / 100) * st) : xs.map((x) => U.toSI(x, unit, cat, ctx)));
    const v = col(tt.v, tt.vUnit, q.cat, steady);
    const c = q.space ? v.map(q.space.to) : v;
    // min and max: the domain of the quantity (an opening from 0 to 100 %), which an extrapolated value stays in
    const T = { t, c, n: t.length, space: q.space || null, min: q.min, max: q.range ? q.range[1] : undefined };
    if (q.second && hasSecond(tt)) { T.c2 = col(tt.v2, tt.v2Unit, q.second.cat, steady2); T.min2 = q.second.min; }
    return T;
  }
  // a table typed with a second column of values, as long as its times
  const hasSecond = (tt) => !!(tt && Array.isArray(tt.v2) && tt.v2.length && tt.v2.length === (tt.t || []).length);

  // value of the interpolation between two points a and b at the fraction f; an infinite value (the capacity of a valve
  // with K = 0) wins over any finite one between the points
  function lerp(a, b, f) {
    if (f <= 0) return a;
    if (f >= 1) return b;
    if (!Number.isFinite(a) || !Number.isFinite(b)) return Infinity;
    return a + (b - a) * f;
  }

  // the last point whose time is not after τ (τ ≥ t[0]); with two points at the same time it is the second one
  function lastAtOrBefore(t, tau) {
    let lo = 0, hi = t.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (t[mid] <= tau) lo = mid; else hi = mid - 1;
    }
    return lo;
  }

  // value of a prepared table at τ (SI): { v, past, v2 } where past is '' inside the table, 'held' past the last point
  // without repetition (the last value) or 'extrapolated' (the line of the last two points, limited to the domain of the
  // quantity); v2 is the value of the second column, when the table has one. o = { repeat, interp ('linear' | 'step'),
  // dataEnd ('hold' | 'extrapolate') }
  function valueAt(T, tau, o) {
    const { t, n } = T;
    let at;
    if (n === 1 || tau < t[0]) at = { i: 0 };
    else if (tau > t[n - 1] && o.repeat && t[n - 1] > t[0]) {
      const P = t[n - 1] - t[0];
      at = inside(t, t[0] + (((tau - t[0]) % P) + P) % P, o);
    } else if (tau > t[n - 1]) at = { past: tau - t[n - 1] };
    else at = inside(t, tau, o);
    const first = column(T, T.c, T.space, T.min, at, o, T.max);
    const r = { v: first.v, past: first.past };
    if (T.c2) r.v2 = column(T, T.c2, null, T.min2, at, o).v;
    return r;
  }
  // where τ falls between the points: the point i, and the fraction f towards the next one (linear)
  function inside(t, tau, o) {
    const n = t.length, i = lastAtOrBefore(t, tau);
    if (i >= n - 1 || o.interp === 'step') return { i };
    return { i, f: (tau - t[i]) / (t[i + 1] - t[i]) };
  }
  // the value of one column of values c at the place at: inside the table, or past its last point by at.past
  function column(T, c, space, min, at, o, max) {
    const { t, n } = T;
    let x, past = '';
    if (at.past === undefined) x = at.f === undefined ? c[at.i] : lerp(c[at.i], c[at.i + 1], at.f);
    else {
      const dt = t[n - 1] - t[n - 2];
      const slope = dt > 0 ? (c[n - 1] - c[n - 2]) / dt : NaN;
      if (o.dataEnd === 'extrapolate' && Number.isFinite(slope)) {
        x = c[n - 1] + slope * at.past;
        past = 'extrapolated';
      } else { x = c[n - 1]; past = 'held'; }
    }
    let v = space ? space.from(x) : x;
    if (past === 'extrapolated') v = limit(min, max, v);
    return { v, past };
  }

  // an extrapolated value stays in the domain of its quantity (a flow, a speed, a Cv, an area are not negative; an
  // opening is not above 100 %)
  const limit = (min, max, v) => (Number.isFinite(min) && v < min ? min : Number.isFinite(max) && v > max ? max : v);

  // the first time τ*, from the first point on, at which a prepared table takes the value x (SI, of the quantity of the
  // table; item 5 of D.10): at a point, or between two points on the straight line of a linear table. Null when the table
  // never takes it. The comparison is made in the space of the table (1/√K for a valve by K) and allows for rounding
  function timeOfValue(T, x, o) {
    const { t, c, n } = T;
    const y = T.space ? T.space.to(x) : x;
    if (Number.isNaN(y)) return null;
    // two infinities (a valve with K = 0) only by equality: the rounding is of finite numbers
    const same = (a, b) => a === b || (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * Math.max(Math.abs(a), Math.abs(b)));
    for (let i = 0; i < n; i++) {
      if (same(c[i], y)) return t[i];
      if (i === n - 1 || o.interp === 'step' || !(t[i + 1] > t[i])) continue;
      const a = c[i], b = c[i + 1];
      if (Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(y) && (a - y) * (b - y) < 0) return t[i] + (t[i + 1] - t[i]) * (y - a) / (b - a);
    }
    return null;
  }

  PumpIt.time = Object.assign(PumpIt.time || {}, { tables: { prepare, valueAt, timeOfValue, hasSecond } });
})(typeof window !== 'undefined' ? window : globalThis);
