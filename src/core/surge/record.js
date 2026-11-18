// Results of the water hammer (docs/water-hammer.md; §10 of its specification): the series of the output stations of
// every pipe and of the junctions at the recorded steps, the extremes of every station (all the steps, recorded or not)
// with the first time each is reached, the event log and the warnings.
//
// A station records its stagnation pressure P and its two flows (mU, mD), and the volume V of its vapour cavity once the
// pipe has had one (with the gas cavities of phase G3, the volume of its free gas from the start); the static pressure
// and the grade lines follow from them (§2.6). The force sets of phase G3 record their force at the same times, with its
// extremes over every step.
(function (root) {
  const PumpIt = root.PumpIt;
  const { t } = PumpIt.i18n;

  const recordedCount = (N, every) => Math.floor(N / every) + 1 + (N % every ? 1 : 0);
  const isRecorded = (k, N, every) => k % every === 0 || k === N;

  // the output stations of a pipe: those of the control ('ends' or 'all') or of its own data (pipe.surge.stations:
  // 'default', 'ends', 'all' or a list of stations, decision W-25)
  function stationsOf(pipe, ctlStations) {
    const own = PumpIt.surge.wavespeed.dataOf(pipe.effPipe).stations;
    const pick = own === 'default' || own === undefined ? ctlStations : own;
    if (Array.isArray(pick)) {
      const s = [...new Set(pick.filter((i) => Number.isInteger(i) && i >= 0 && i <= pipe.n))].sort((a, b) => a - b);
      return s.length ? s : [0, pipe.n];
    }
    if (pick === 'all') return Array.from({ length: pipe.n + 1 }, (_, i) => i);
    return pipe.n ? [0, pipe.n] : [0];
  }

  // The run keeps its records in a layout made for writing them step after step, and lays them out by station and
  // quantity when it ends (finish): every station of every pipe is visited at every step, and one write into each of
  // many separate arrays would touch a page of memory each.
  //   extremes  one array per pipe with the 14 values of a station side by side (XKEYS)
  //   series    a block of SERIES_BLOCK rows, one row per recorded time with the stations side by side, copied into the
  //             series of each station when it fills up
  const XKEYS = ['Pmax', 'tPmax', 'Pmin', 'tPmin', 'pmax', 'tpmax', 'pmin', 'tpmin', 'mmax', 'tmmax', 'mmin', 'tmmin', 'Vmax', 'tVmax'];
  const XINIT = [-Infinity, NaN, Infinity, NaN, -Infinity, NaN, Infinity, NaN, -Infinity, NaN, Infinity, NaN, 0, NaN];
  const XN = XKEYS.length;
  const SERIES_BLOCK = 32;

  function create(net, N, every) {
    const nRec = recordedCount(N, every);
    const R = { nRec, n: 0, times: new Float64Array(nRec), pipes: {}, junctions: {}, extremes: { pipes: {}, junctions: {} }, log: [], warnings: [], warned: new Set(), cavities: { pipes: new Map(), junctions: new Map(), count: 0, ever: false, lastEnd: NaN }, below: new Map(), bigCavity: new Set() };
    const arr = () => { const a = new Float64Array(nRec); a.fill(NaN); return a; };
    const cols = [];
    for (const p of pipesOf(net)) {
      const st = stationsOf(p, net.control.stations);
      const x = new Float64Array((p.n + 1) * XN);
      for (let i = 0; i <= p.n; i++) x.set(XINIT, i * XN);
      const o = R.pipes[p.id] = { stations: st, P: st.map(arr), mU: st.map(arr), mD: st.map(arr), V: null, arr, x };
      st.forEach((i, s) => cols.push(o.P[s], o.mU[s], o.mD[s]));
    }
    R.cols = cols;
    R.blk = new Float64Array(cols.length * SERIES_BLOCK);
    R.blk0 = 0; // the recorded index of the first row of the block
    // a junction: its series by field; sc, its values at a step in the order of its fields (b.values writes them there);
    // arrs and xs, its series and its extremes in that order
    for (const b of net.boundaries) {
      const s = {}, fs = b.fields.slice(), sc = new Float64Array(fs.length);
      for (const f of fs) s[f] = arr();
      R.junctions[b.jid] = { type: b.j.type, fields: fs, series: s, sc, arrs: fs.map((f) => s[f]), xs: fs.map(() => ({ max: -Infinity, tmax: NaN, min: Infinity, tmin: NaN })) };
      R.extremes.junctions[b.jid] = {};
    }
    R.valuesAt = NaN; // the time of the values in sc
    return R;
  }
  // the pipes of a network as a list, faster to go through step after step than the map
  const pipesOf = (net) => net.pipeList || [...net.pipes.values()];

  // ---------- series
  function recordSeries(R, net, tk) {
    const ri = R.n++;
    R.times[ri] = tk;
    const blk = R.blk;
    let c = (ri - R.blk0) * R.cols.length;
    for (const p of pipesOf(net)) {
      const o = R.pipes[p.id], st = o.stations, ns = st.length, P = p.P, mU = p.mU, mD = p.mD;
      for (let s = 0; s < ns; s++, c += 3) { const i = st[s]; blk[c] = P[i]; blk[c + 1] = mU[i]; blk[c + 2] = mD[i]; }
      if (o.V || p.cavEver) {
        if (!o.V) o.V = st.map(() => new Float64Array(R.nRec));
        const V = p.V, oV = o.V;
        for (let s = 0; s < ns; s++) oV[s][ri] = V[st[s]];
      }
    }
    if (R.n - R.blk0 === SERIES_BLOCK) flushSeries(R);
    const F = R.forces;
    if (F) for (let k = 0; k < F.val.length; k++) F.series[k][ri] = F.val[k];
    // the values of the junctions the extremes of this time took, or taken now
    const fresh = R.valuesAt !== tk;
    for (const b of net.boundaries) {
      const J = R.junctions[b.jid], sc = J.sc, fs = J.fields, arrs = J.arrs;
      if (fresh) b.values(sc);
      for (let f = 0; f < fs.length; f++) arrs[f][ri] = sc[f];
    }
  }
  // the rows of the block into the series of the stations
  function flushSeries(R) {
    const cols = R.cols, nc = cols.length, rows = R.n - R.blk0, b0 = R.blk0, blk = R.blk;
    for (let c = 0; c < nc; c++) {
      const a = cols[c];
      for (let r = 0, k = c; r < rows; r++, k += nc) a[b0 + r] = blk[k];
    }
    R.blk0 = R.n;
  }

  // ---------- extremes of every station (§9.4, item 6) and of the junctions, with the first time each is reached
  function recordExtremes(R, net, tk) {
    for (const p of pipesOf(net)) {
      const x = R.pipes[p.id].x, P = p.P, mU = p.mU, mD = p.mD, V = p.V, n = p.n;
      const k2 = 1 / (2 * p.rho * p.A * p.A);
      for (let i = 0, j = 0; i <= n; i++, j += XN) {
        const Pi = P[i], a = mU[i], b = mD[i], m = (a + b) / 2, ps = Pi - m * m * k2;
        if (Pi > x[j]) { x[j] = Pi; x[j + 1] = tk; }
        if (Pi < x[j + 2]) { x[j + 2] = Pi; x[j + 3] = tk; }
        if (ps > x[j + 4]) { x[j + 4] = ps; x[j + 5] = tk; }
        if (ps < x[j + 6]) { x[j + 6] = ps; x[j + 7] = tk; }
        const hi = a > b ? a : b, lo = a < b ? a : b;
        if (hi > x[j + 8]) { x[j + 8] = hi; x[j + 9] = tk; }
        if (lo < x[j + 10]) { x[j + 10] = lo; x[j + 11] = tk; }
        const v = V[i];
        if (v > x[j + 12]) { x[j + 12] = v; x[j + 13] = tk; }
      }
    }
    for (const b of net.boundaries) {
      const J = R.junctions[b.jid], sc = J.sc, fs = J.fields, xs = J.xs;
      b.values(sc);
      for (let k = 0; k < fs.length; k++) {
        const v = sc[k];
        if (!Number.isFinite(v)) continue;
        const o = xs[k];
        if (v > o.max) { o.max = v; o.tmax = tk; }
        if (v < o.min) { o.min = v; o.tmin = tk; }
      }
    }
    R.valuesAt = tk;
  }

  // the end of a run: the last rows of the series, and the extremes of every pipe by quantity, one array per quantity
  // ({ Pmax: [station], tPmax: [station], … })
  function finish(R, net) {
    flushSeries(R);
    for (const p of pipesOf(net)) {
      const x = R.pipes[p.id].x, n1 = p.n + 1, X = {};
      XKEYS.forEach((k, q) => { const a = new Float64Array(n1); for (let i = 0; i < n1; i++) a[i] = x[i * XN + q]; X[k] = a; });
      R.extremes.pipes[p.id] = X;
    }
    // of a junction, the fields that had a value: { max, tmax, min, tmin }
    for (const id in R.junctions) {
      const J = R.junctions[id], X = R.extremes.junctions[id];
      J.fields.forEach((f, k) => { const o = J.xs[k]; if (o.max !== -Infinity) X[f] = o; });
    }
  }

  // ---------- the event log (§8.5): { t, obj, kind ('event' | 'info' | 'warning'), key, params }
  const log = (R, tk, obj, kind, key, params) => R.log.push({ t: tk, obj, kind, key, params: params || {} });
  // a warning of the run (once per key and object)
  function warnOnce(R, level, key, params, obj) {
    const id = key + '|' + (obj || '');
    if (R.warned.has(id)) return;
    R.warned.add(id);
    R.warnings.push({ level, key, params: params || {}, obj });
  }

  // the cavities after a step: the first of each pipe and junction, and when the last one of the network ends (§8.5);
  // a cavity above 10 % of the volume of its section (§7.5, decision W-17)
  function recordCavities(R, net, tk) {
    let count = 0;
    for (const p of pipesOf(net)) {
      let n = 0;
      const lim = 0.1 * p.A * p.L / p.n, V = p.V, N = p.n;
      for (let i = 0; i <= N; i++) {
        const v = V[i];
        if (v > 0) {
          n++;
          if (v > lim && !R.bigCavity.has(p.id)) { R.bigCavity.add(p.id); warnOnce(R, 'warning', 'surge.warn.bigCavity', { id: p.id, t: tk }, 'p:' + p.id); }
        }
      }
      p.cav = n;
      if (n) {
        p.cavEver = true;
        count += n;
        if (!R.cavities.pipes.has(p.id)) {
          R.cavities.pipes.set(p.id, tk);
          log(R, tk, 'p:' + p.id, 'warning', 'surge.log.cavityPipe', { id: p.id });
          warnOnce(R, 'caution', 'surge.warn.cavityPipe', { id: p.id, t: tk }, 'p:' + p.id);
        }
      }
    }
    for (const b of net.boundaries) {
      if (b.kind !== 'node' || !(b.st.V > 0) || b.ports.length < 2) continue;
      count++;
      if (!R.cavities.junctions.has(b.jid)) {
        R.cavities.junctions.set(b.jid, tk);
        log(R, tk, 'j:' + b.jid, 'warning', 'surge.log.cavityJunction', { id: b.jid });
        warnOnce(R, 'caution', 'surge.warn.cavityJunction', { id: b.jid, t: tk }, 'j:' + b.jid);
      }
    }
    if (count) R.cavities.ever = true;
    if (R.cavities.count && !count) R.cavities.lastEnd = tk;
    R.cavities.count = count;
  }

  // the gas cavities after a step (phase G3): a volume of gas above 10 % of the volume of its section, once per pipe and
  // junction (the discrete model loses accuracy there, as with the vapour cavities; decision W-17)
  function recordGas(R, net, tk) {
    for (const p of pipesOf(net)) {
      if (R.bigCavity.has(p.id)) continue;
      const lim = 0.1 * p.A * p.L / p.n, V = p.V;
      for (let i = 0; i <= p.n; i++) if (V[i] > lim) { R.bigCavity.add(p.id); warnOnce(R, 'warning', 'surge.warn.bigGas', { id: p.id, t: tk, i }, 'p:' + p.id); break; }
    }
    for (const b of net.boundaries) {
      if (b.gas !== 'node' || R.bigCavity.has('j' + b.jid)) continue;
      const lim = 0.1 * Math.min(...b.ports.map((pt) => pt.pipe.A * pt.pipe.L / pt.pipe.n));
      if (b.st.V > lim) { R.bigCavity.add('j' + b.jid); warnOnce(R, 'warning', 'surge.warn.bigGasJunction', { id: b.jid, t: tk }, 'j:' + b.jid); }
    }
  }

  // ---------- the force sets (phase G3, src/core/surge/forces.js): the force of each at every step, its extremes with the
  // first time, its value at the recorded times
  function forcesCreate(R, list) {
    if (!list || !list.length) { R.forces = null; return; }
    R.forces = {
      val: new Float64Array(list.length),
      series: list.map(() => { const a = new Float64Array(R.nRec); a.fill(NaN); return a; }),
      x: list.map(() => ({ max: -Infinity, tmax: NaN, min: Infinity, tmin: NaN, steady: NaN })),
    };
  }
  function forcesStep(R, list, tk) {
    const F = R.forces;
    if (!F) return;
    for (let k = 0; k < list.length; k++) {
      const v = list[k].value();
      F.val[k] = v;
      const o = F.x[k];
      if (tk === 0) o.steady = v;
      if (v > o.max) { o.max = v; o.tmax = tk; }
      if (v < o.min) { o.min = v; o.tmin = tk; }
    }
  }
  // the forces of a run: per set its stations, its series at the recorded times, its value in the steady state, its
  // extremes with the first time and its swing from peak to peak
  function forcesOf(R, list) {
    const F = R.forces;
    if (!F) return [];
    return list.map((f, k) => {
      const o = F.x[k];
      return Object.assign(f.describe(), { series: F.series[k].subarray(0, R.n), steady: o.steady, max: o.max, tmax: o.tmax, min: o.min, tmin: o.tmin, p2p: o.max - o.min });
    });
  }

  // without a model of cavitation, the first time and station where a pipe goes below the vapour pressure (§7.4)
  function recordBelowVapor(R, net, tk, Pv, staticBasis) {
    if (!Number.isFinite(Pv)) return;
    for (const p of net.pipes.values()) {
      if (R.below.has(p.id)) continue;
      for (let i = 0; i <= p.n; i++) {
        const P = staticBasis ? PumpIt.surge.moc.staticAt(p, i, p.P, p.mU, p.mD) : p.P[i];
        if (P < Pv) {
          R.below.set(p.id, { t: tk, i });
          warnOnce(R, 'warning', 'surge.warn.belowVapor', { id: p.id, t: tk, i }, 'p:' + p.id);
          break;
        }
      }
    }
  }

  // the numbers of a text: up to six significant digits, without the noise of the binary fractions (0.21, not
  // 0.21000000000000002), written as the language writes them (0,21 in Portuguese)
  const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? new Intl.NumberFormat(PumpIt.i18n.numberLocale(), { maximumSignificantDigits: 6, useGrouping: false }).format(x) : x);
  const textOf = (key, params) => {
    const p = {};
    for (const k in params || {}) p[k] = num(params[k]);
    return t(key, p);
  };
  // the text of an entry of the log: the states of a device by their names in the catalogs (surge.states)
  function logText(e) {
    const p = Object.assign({}, e.params);
    if (e.key === 'surge.log.state') { p.from = t('surge.states.' + p.from); p.to = t('surge.states.' + p.to); }
    return textOf(e.key, p);
  }
  // the warnings as texts, the most severe first
  const ORDER = { critical: 0, warning: 1, caution: 2, info: 3 };
  function warningsOf(list) {
    return list.map((w) => ({ level: w.level, obj: w.obj, key: w.key, params: w.params, text: textOf(w.key, w.params) })).sort((a, b) => ORDER[a.level] - ORDER[b.level]);
  }

  PumpIt.surge = Object.assign(PumpIt.surge || {}, {
    record: { recordedCount, isRecorded, stationsOf, create, recordSeries, recordExtremes, finish, log, warnOnce, recordCavities, recordGas, recordBelowVapor, forcesCreate, forcesStep, forcesOf, warningsOf, textOf, logText, num },
  });
})(typeof window !== 'undefined' ? window : globalThis);
