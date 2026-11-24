// The data of the water hammer in .imp files (sections 8 to 15 of the description of the format written by the
// specification team, 23 November 2026, with the answers of that team to the questions of phases I2 and I3, 24 November
// 2026; decisions I-10 to I-33 and I-35, I-36 of docs/imp-import.md, and those of the implementation). They go into the
// fields of the module of the water hammer (src/core/surge/inputs.js, wavespeed.js, checks.js, pumps.js, forces.js): the
// control of the run, the sectioning and the force sets (solution.surge), the bulk modulus of the liquid
// (system.fluid.K), the transient block of each pipe (pipe.surge), the time data of the junctions (j.surge, with the
// structure of j.time, decision W-14), the fields of the water hammer of their kinds, and the protection devices, which
// are junction types of their own (surgeTank, airVessel, reliefValve, airValve). They are read only while the module is
// in the page (decision W-01): without it the network comes in alone, with a note, and the devices as the .fth importer
// brings in the kinds it does not read. imp.js calls these readers from the hooks of the reader of the network
// (liquid.js); c is the context of that reading.
(function (root) {
  const PumpIt = root.PumpIt;
  const U = PumpIt.units;
  const q = PumpIt.model.q;
  const {
    FT, LBM, num, n0, str, key, kv, valUnit, keyValues, sectionOf, scenarioSection, scenarioKey, inTable, LENGTH, AREA, VOLUME,
    PRESSURE, DP, FLOW, TEMPERATURE, TIME, pipeLayout, mergePipe, unesc,
  } = PumpIt.importShared;

  const hasModule = () => !!(PumpIt.surge && PumpIt.surge.inputs);
  // a flag of the file, 0 when it is not a number
  const flag = (x) => (Number.isFinite(x) ? x : 0);
  const round12 = (x) => +x.toPrecision(12);

  // ---------- units of the water hammer (section 17 of the description): a velocity is a length per second, minute,
  // hour or day; the moduli of elasticity and of compressibility are in units of pressure; inertia and torque
  const VELOCITY = {};
  for (const [n, [u, f]] of Object.entries(LENGTH)) {
    for (const [p, s] of [['sec', 1], ['min', 60], ['hr', 3600], ['day', 86400]]) {
      const si = U.toSI(f, u, 'length') / s;
      VELOCITY[`${n}/${p}`] = ['ft', 'in', 'mi'].includes(u) ? ['ft/s', si / FT] : ['m/s', si];
    }
  }
  const INERTIA = { 'kg-m2': ['kg·m²', 1], 'lbm-ft2': ['lb·ft²', 1], 'lbm-in2': ['lb·ft²', 1 / 144] };
  const TORQUE = { 'n-m': ['N·m', 1], 'lbf-ft': ['lbf·ft', 1], 'lbf-in': ['lbf·ft', 1 / 12], 'kg-m': ['N·m', 9.80665] };
  const velocity = (v, unit) => { const e = VELOCITY[key(unit)]; return e && Number.isFinite(v) ? q(round12(v * e[1]), e[0]) : null; };
  // force, a spring of a sliding disc, an angle, a mass, an acceleration (a length per second or minute squared); the
  // spring of a hinge is a unit of torque per degree, the only one the program has (I-55)
  const FORCE = { n: ['N', 1], kn: ['kN', 1], lbf: ['lbf', 1], kgf: ['N', 9.80665], kip: ['lbf', 1000], oz: ['lbf', 1 / 16] };
  const STIFFNESS = {
    'n/m': ['N/m', 1], 'n/cm': ['N/m', 100], 'n/mm': ['N/mm', 1], 'kgf/m': ['N/m', 9.80665], 'kgf/cm': ['N/m', 980.665], 'kgf/mm': ['N/mm', 9.80665],
    'lbf/ft': ['lbf/in', 1 / 12], 'lbf/in': ['lbf/in', 1], 'oz/ft': ['lbf/in', 1 / 192], 'oz/in': ['lbf/in', 1 / 16],
  };
  const ROT_STIFFNESS = {};
  for (const [n, [u, f]] of Object.entries(TORQUE)) ROT_STIFFNESS[`${n}/deg`] = ['N·m/°', U.toSI(f, u, 'torque')];
  const ANGLE = { degrees: ['°', 1], degree: ['°', 1], deg: ['°', 1], radians: ['rad', 1], radian: ['rad', 1], rad: ['rad', 1] };
  const MASS = { kg: ['kg', 1], kgs: ['kg', 1], gram: ['kg', 1e-3], grams: ['kg', 1e-3], lbm: ['lbm', 1], slug: ['kg', 14.59390293720636], 'm-ton': ['t', 1] };
  const ACCEL = {};
  for (const [n, [u, f]] of Object.entries(LENGTH)) {
    for (const [p, s] of [['sec2', 1], ['min2', 3600]]) {
      const si = U.toSI(f, u, 'length') / s;
      ACCEL[`${n}/${p}`] = ['ft', 'in', 'mi'].includes(u) ? ['ft/s²', si / FT] : ['m/s²', si];
    }
  }
  // a quantity of a table of units of the file, or null (the value not a number, or the unit not in the table)
  const qOf = (table, v, unit) => { const e = table[key(unit)]; return e && Number.isFinite(v) ? q(round12(v * e[1]), e[0]) : null; };
  // a modulus in a unit of pressure of the file (an absolute unit, read as a difference): a unit of Pump It for it, or MPa
  function modulus(v, unit) {
    const e = DP[key(unit)];
    if (!e || !Number.isFinite(v)) return null;
    return U.has('modulus', e[0]) ? q(round12(v * e[1]), e[0]) : q(round12(U.toSI(v * e[1], e[0], 'dp') / 1e6), 'MPa');
  }
  // a pressure of the file in any of its units read as a difference (I-28, I-31): a unit of difference, or an absolute
  // or a gauge unit taken without its reference → { Pa, unit: the unit of difference of Pump It of its scale }, or null
  const DP_OF = {
    'kPa(a)': 'kPa', 'kPa(g)': 'kPa', 'bar(a)': 'bar', 'bar(g)': 'bar', 'MPa(a)': 'MPa', 'MPa(g)': 'MPa', 'Pa(a)': 'Pa', 'Pa(g)': 'Pa',
    psia: 'psi', psig: 'psi', 'kgf/cm²(a)': 'kgf/cm²', 'kgf/cm²(g)': 'kgf/cm²', 'mca(g)': 'mca', 'mmHg(a)': 'mmHg',
  };
  function asDifference(v, unit) {
    if (!Number.isFinite(v)) return null;
    const d = DP[key(unit)];
    if (d) return { Pa: U.toSI(v * d[1], d[0], 'dp'), unit: d[0] };
    const p = PRESSURE[key(unit)];
    if (!p) return null;
    return { Pa: U.toSI(v * p[1], p[0], 'pressure') - U.toSI(0, p[0], 'pressure'), unit: DP_OF[p[0]] || 'kPa' };
  }
  // a head of the liquid (a length of the file) as a pressure difference ρ·g·h → { Pa, unit: psi for a length in feet,
  // inches or miles, kPa otherwise }, or null when the unit is not a length
  function headOf(c, v, unit) {
    const e = LENGTH[key(unit)];
    if (!e || !Number.isFinite(v)) return null;
    return { Pa: U.toSI(v * e[1], e[0], 'length') * c.rho * c.grav, unit: ['ft', 'in', 'mi'].includes(e[0]) ? 'psi' : 'kPa' };
  }
  // a pressure difference (Pa) as a quantity in a unit of difference of Pump It
  const dpQ = (Pa, unit) => q(round12(U.fromSI(Pa, unit, 'dp')), unit);
  // an absolute pressure P (Pa) as a gauge pressure of the scale of a unit of difference
  const GAUGE_OF = { kPa: 'kPa(g)', bar: 'bar(g)', MPa: 'MPa(g)', Pa: 'Pa(g)', psi: 'psig', 'kgf/cm²': 'kgf/cm²(g)', mca: 'mca(g)' };
  const gauge = (c, P, du) => { const u = GAUGE_OF[du] || 'kPa(g)'; return q(round12(U.fromSI(P, u, 'pressure', { patm: c.patm })), u); };
  // a piezometric head H of the file (an elevation of the hydraulic grade line) as the pressure at the elevation of the
  // junction of context c, with the ambient pressure: P = P_amb + ρ·g·(H − z) (I-28, I-31); null when it does not read
  function piezometric(c, v, unit) {
    const h = headOf(c, v, unit);
    if (!h || !Number.isFinite(c.zJ)) return null;
    return gauge(c, c.patm + h.Pa - c.rho * c.grav * c.zJ, h.unit);
  }
  // a unit of the file, of any category, and a text that is no number
  const UNITS = [LENGTH, AREA, VOLUME, PRESSURE, DP, FLOW, TIME, VELOCITY, INERTIA, TORQUE, TEMPERATURE, FORCE, STIFFNESS, ROT_STIFFNESS, ANGLE, MASS, ACCEL];
  const isUnit = (s) => key(s) === 'none' || UNITS.some((tb) => inTable(tb, s));
  const isText = (s) => str(s) !== '' && !Number.isFinite(Number(str(s)));

  // ---------- the control of the run and the sectioning (sections 8 and 9)

  // the keys of a section of control along the chain of scenarios: those of the base, then those each child changes (in
  // capitals in a child, section 5), by their names in lower case
  function keysOf(S, chain, name) {
    const out = {};
    const take = (lines) => { for (const [k, v] of Object.entries(keyValues(lines))) out[k.toLowerCase()] = v; };
    take(scenarioSection(S, name, 1));
    for (const k of chain.slice(1)) { const x = scenarioKey(S, name, k, true); if (x) take(S[x]); }
    return out;
  }
  const CAVITATION = { 0: 'none', 1: 'dvcm', 2: 'dgcm' }; // I-17
  const CAV_BASES = { 0: 'stagnation', 1: 'static' };
  const FRICTION = { 0: 'steady', '-1': 'variable', 1: 'brunone' }; // I-16
  const VARIANCE = { 0: 5, 1: 10 }; // MaxErrorOption; 3 takes MaxError

  // before the pipes: the control of the run and the sectioning into solution.surge (I-14 to I-20), the bulk modulus of
  // the liquid; c.surge keeps what the pipes and junctions need: the start of the run of the file (s), the time step
  // (s) and the pipes read. Without the module only the note
  function start(c) {
    const { S, chain, m, note } = c;
    if (!hasModule()) { c.surge = null; note('ignored', 'surgeLeftOut', null); return; }
    const sv = c.surge = { shift: 0, dt: NaN, pipes: [], seen: new Set() };
    // the kind of analysis, along the chain: 3 is a transient (section 5)
    let type = kv(sectionOf(S, 'SETTINGS'), 'AnalysisType');
    for (const k of chain.slice(1)) {
      const x = scenarioKey(S, 'SETTINGS', k, true), v = x && kv(S[x], 'AnalysisType');
      if (v !== undefined && v !== null) type = v;
    }
    const tc = keysOf(S, chain, 'TRANSIENT CONTROL'), sc = keysOf(S, chain, 'SECTIONING');
    const ctl = PumpIt.surge.inputs.newControl();
    const has = (o, k) => str(o[k]) !== '', val = (o, k) => num(o[k]);
    // a code of the file in a list of Pump It; another one keeps the default, with a note
    const code = (o, k, map, name) => {
      if (!has(o, k)) return undefined;
      const x = map[String(val(o, k))];
      if (x === undefined) note('assumed', 'surgeCode', null, { key: name, code: str(o[k]) });
      return x;
    };
    // the duration, from the start to the end of the run of the file in its unit (I-15): an end at −1 sets no transient
    const tu = TIME[key(tc.timeunits)] || TIME.seconds;
    const sec = (x) => U.toSI(x * tu[1], tu[0], 'time');
    const t0 = Number.isFinite(val(tc, 'starttime')) ? val(tc, 'starttime') : 0, t1 = val(tc, 'stoptime');
    const set = t1 > t0;
    if (set) ctl.duration = q(round12((t1 - t0) * tu[1]), tu[0]);
    if (set && t0 !== 0) { sv.shift = sec(t0); note('assumed', 'surgeStart', null, { start: t0, unit: tu[0] }); }
    if (Number.isInteger(val(tc, 'frequency')) && val(tc, 'frequency') >= 1) ctl.saveEvery = val(tc, 'frequency');
    // cavities, the weight of their integration, the gas of the gas cavities and the basis of the comparison (I-17)
    const cav = code(tc, 'modelcavitation', CAVITATION, 'ModelCavitation');
    if (cav) ctl.cavitation = cav;
    if (Number.isFinite(val(tc, 'psi'))) ctl.psi = val(tc, 'psi');
    if (val(tc, 'voidfraction') > 0) ctl.alpha0 = val(tc, 'voidfraction');
    if (has(tc, 'voidfractionpressure')) {
      const p0 = c.pressure(val(tc, 'voidfractionpressure'), tc.voidfractionpressureunits, null);
      if (p0.value !== null) ctl.p0 = p0; else c.unknownUnit(null, tc.voidfractionpressureunits);
    }
    const basis = code(tc, 'cavitationpressuretype', CAV_BASES, 'CavitationPressureType');
    if (basis) ctl.cavBasis = basis;
    // the friction of the transient (I-16) and the test of the artificial transient (I-18)
    const fr = code(tc, 'variableresistance', FRICTION, 'VariableResistance');
    if (fr) ctl.friction = fr;
    if (has(tc, 'stoponartificialtransient')) ctl.artificial.stop = val(tc, 'stoponartificialtransient') !== 0;
    if (val(tc, 'criteria') >= 0) ctl.artificial.criterion = val(tc, 'criteria');
    if (has(tc, 'criteriaminflow')) {
      const Q = c.flow(val(tc, 'criteriaminflow'), tc.criteriaminflowunits, null);
      if (Q.value !== null && Q.value >= 0) ctl.artificial.minFlow = Q; else c.unknownUnit(null, tc.criteriaminflowunits);
    }
    // NumDecelPoints is not read: the program keeps it, and its check valves do not take it (I-58)
    // the sectioning (section 9, I-14): the time step of the file, given; the limits of the search filled for the user
    if (val(sc, 'minsections') > 0) ctl.ncMin = val(sc, 'minsections');
    if (val(sc, 'maxsections') > 0) ctl.ncMax = val(sc, 'maxsections');
    const opt = val(sc, 'maxerroroption');
    if (opt === 3 && val(sc, 'maxerror') > 0) ctl.varianceMax = val(sc, 'maxerror');
    else if (VARIANCE[opt]) ctl.varianceMax = VARIANCE[opt];
    else if (has(sc, 'maxerroroption')) note('assumed', 'surgeCode', null, { key: 'MaxErrorOption', code: str(sc.maxerroroption) });
    const dt = val(sc, 'timestep');
    if (dt > 0) { Object.assign(ctl, { dtMode: 'given', dt: q(dt, 's') }); sv.dt = dt; } else if (set) note('assumed', 'surgeAutoStep', null);
    if (n0(sc.solutiongridtype) === 1) note('ignored', 'surgeGrid', null);
    // the steps the program counted, against the duration over the time step
    const steps = val(tc, 'totalsteps');
    if (set && dt > 0 && steps > 0 && Math.abs(sec(t1 - t0) / dt - steps) > 1 + 1e-6) note('assumed', 'surgeSteps', null, { file: steps, model: Math.round(sec(t1 - t0) / dt) });
    // on with a transient and an end of the run (I-20); the time simulation off (W-19)
    const transient = str(type) === '3';
    if (!transient) note('assumed', 'surgeAnalysis', null, { code: str(type) || '?' });
    else if (!set) note('missing', 'surgeStop', null);
    ctl.on = transient && set;
    m.solution.surge = ctl;
    if (ctl.on) { m.solution.time.on = false; note('info', 'surgeOn', null); }
    // the bulk modulus of the liquid (section 10, W-07), for a liquid of the file
    const bm = valUnit(kv(c.F, 'Bulk Modulus'));
    if (bm) {
      const K = modulus(bm.v, bm.unit);
      if (!K) c.unknownUnit(null, bm.unit);
      else if (m.system.fluid && m.system.fluid.kind === 'user') m.system.fluid.K = K;
      else note('ignored', 'surgeBulkModulus', null);
    }
  }

  // ---------- pipes (section 11)

  // the supports of the wall (w+3; I-12), by their code: 9, buried by the stiffness of the soil, has no counterpart
  const SUPPORTS = ['user', 'thinUp', 'thinAnchored', 'thinJoints', 'thickUp', 'thickAnchored', 'thickJoints', 'tunnelUnlined', 'tunnelLined', 'thinAnchored', 'buried'];
  // the anchor w of the transient block of a pipe record f (section 11.2, I-10): the first field from b+60 that is a unit
  // of velocity, or −1
  function anchorOf(f, b) {
    for (let i = b + 60; i < f.length; i++) if (inTable(VELOCITY, f[i])) return i;
    return -1;
  }
  // the stiffness of the rock of a tunnel (supports 7 and 8): eight fields after the name of the ambient fluid, the first
  // text that is not a unit after w+20, with its unit of pressure (section 11.2, structure)
  function rockOf(f, w) {
    for (let i = w + 21; i < f.length; i++) if (isText(f[i]) && !isUnit(f[i])) return modulus(num(f[i + 8]), f[i + 9]);
    return null;
  }

  // the transient block of pipe p from its record f (section 11.2): the wave speed of the file, given (I-11), with the
  // wall, the material, the support and c1 kept for a speed calculated by Pump It; the stations it records (I-13)
  function pipe(c, f, p) {
    const sv = c.surge;
    if (!sv) return;
    const { note } = c, obj = 'P' + p.id;
    sv.seen.add(p);
    const w = anchorOf(f, pipeLayout(f).b);
    if (w < 0) { note('missing', 'surgePipe', obj); return; }
    const at = (i) => (w + i < f.length ? f[w + i] : '');
    const d = {};
    const a = num(at(-1)), av = a > 0 ? velocity(a, at(0)) : null;
    if (av) Object.assign(d, { wave: 'given', a: av });
    else note('assumed', 'surgeWaveCalc', obj);
    const e = c.len(num(at(-7)), at(-6), null), E = modulus(num(at(-5)), at(-4)), nu = num(at(-3)), c1 = num(at(4));
    if (e.value > 0) d.wall = e;
    if (E && E.value > 0) d.E = E;
    if (nu > 0 && nu < 0.5) d.nu = nu; // −1 or 0: not given
    if (c1 > 0) d.c1 = c1;
    const sup = num(at(3));
    if (Number.isInteger(sup) && sup >= 0 && sup < SUPPORTS.length) {
      d.support = SUPPORTS[sup];
      if (sup === 9) note('assumed', 'surgeSoil', obj);
      if (sup === 7 || sup === 8) { const G = rockOf(f, w); if (G && G.value > 0) d.G = G; note('assumed', 'surgeRock', obj); }
      if (sup === 10) { d.buriedPct = num(f[f.length - 1]); note('assumed', 'surgeBuried', obj); }
    } else if (str(at(3)) !== '') note('assumed', 'surgeObjCode', obj, { field: 'support', code: str(at(3)) });
    // the stations it records (I-13, I-46): 0 all, 1 the ends, 5 a list of up to five station numbers, 0 at the inlet and
    // the number of sections of the file (w+2) at the outlet, −1 an empty place; with 0 and 1 the places may keep what a
    // list chosen before left in them, and are not read. finish moves the list when Pump It sections the pipe otherwise
    const st = num(at(5));
    if (st === 0) d.stations = 'all';
    else if (st === 1) d.stations = 'ends';
    else if (st === 5) {
      const list = [];
      for (let i = 7; i <= 11; i++) { const x = num(at(i)); if (Number.isInteger(x) && x >= 0 && !list.includes(x)) list.push(x); }
      if (list.length) d.stations = list.sort((x, y) => x - y);
    } else if (str(at(5)) !== '') note('assumed', 'surgeObjCode', obj, { field: 'stations', code: str(at(5)) });
    // a bulk modulus of the pipe itself is in the wave speed of the file already (section 10); a pipe partly full
    if (num(at(-10)) > 0) note('info', 'surgePipeK', obj);
    if (Number.isFinite(num(at(-8))) && num(at(-8)) !== -1) note('ignored', 'surgePartFull', obj);
    // the impedance a/A of the file (psi per lbm/s) checks the wave speed and the area
    const A = c.pipes.get(p.id).A, Z = num(at(1));
    if (av && A > 0 && Z > 0) {
      const z = (U.toSI(av.value, av.unit, 'velocity') / A) * LBM / U.PSI;
      if (Math.abs(z - Z) > 1e-3 * Z) note('assumed', 'surgeImpedance', obj);
    }
    p.surge = d;
    sv.pipes.push({ p, n: num(at(2)) });
  }

  // a pipe record of a child scenario over that of its parent (section 11.3, I-10): the fields up to b+59 as in .fth
  // files, then its transient block, which starts 9 fields before its place in the whole record of the parent. The units
  // at w, w−4, w−6 and w−9 must be empty or of their category (or "None" for the three units of the material; I-44); a
  // block that does not check is left out, with a note. Then an empty field inherits and a filled one replaces
  function mergeSurgePipe(par, d, note) {
    const out = mergePipe(par, d);
    if (!hasModule()) return out;
    const P = pipeLayout(par), D = pipeLayout(d), O = pipeLayout(out);
    const wp = anchorOf(par, P.b);
    if (wp < 0) return out;
    const wd = D.b + (wp - P.b) - 9, wo = O.b + (wp - P.b);
    if (wd - 10 >= d.length) return out;
    const unitAt = (i, tables, none) => {
      const v = wd + i < d.length ? str(d[wd + i]) : '';
      return v === '' || (none && key(v) === 'none') || tables.some((tb) => inTable(tb, v));
    };
    if (!(unitAt(0, [VELOCITY]) && unitAt(-4, [PRESSURE, DP], true) && unitAt(-6, [LENGTH], true) && unitAt(-9, [PRESSURE, DP], true))) {
      note('ignored', 'surgePipeChild', 'P' + str(par[0]));
      return out;
    }
    for (let i = wd - 10; i < d.length; i++) {
      const k = wo + (i - wd), v = d[i];
      if (v !== '' && v !== undefined) out[k] = v; else if (k >= out.length) out[k] = '';
    }
    return out;
  }

  // ---------- time data of the junctions (section 13)

  // a table by the clock of a run that starts at sh (in the unit of its times): its rows from 0 on, the value at 0 by a
  // straight line between the rows around it (I-15)
  function cut(t, v, sh) {
    const t2 = t.map((x) => round12(x - sh));
    const k = t2.findIndex((x) => x >= 0);
    if (k < 0) return { t: [0], v: [v[v.length - 1]] };
    if (k === 0 || t2[k] === 0) return { t: t2.slice(k), v: v.slice(k) };
    const f = -t2[k - 1] / (t2[k] - t2[k - 1]);
    return { t: [0, ...t2.slice(k)], v: [v[k - 1] + f * (v[k] - v[k - 1]), ...v.slice(k)] };
  }
  // a condition on the time of the run, by the clock of Pump It (I-15)
  function shiftCondition(c, cond) {
    const sh = c.surge.shift;
    if (!sh || cond.q !== 'time' || !cond.value) return;
    cond.value = q(round12(cond.value.value - sh / U.toSI(1, cond.value.unit, 'time')), cond.value.unit);
  }
  // the time data of junction j (blk: its block, from its items) into j.surge (I-21): the trigger, the events and the
  // tables, with their options, as the .fth importer reads them into j.time, the quantity being one of those the type
  // takes in the water hammer (surge.quantities). opt.what: the quantity the data must drive (a pump by its model),
  // opt.quantity the one to read them with when the junction does not take it in its state
  function surgeData(c, j, blk, opt = {}) {
    const { note, obj } = c, sv = c.surge;
    if (!blk || !blk.tables[0]) return;
    const given = blk.tables.filter(Boolean);
    // a junction without time data keeps empty tables in its record
    if (!given.some((x) => x.rows.length) && given.every((x) => key(x.key) === 'none')) return;
    let qs = PumpIt.surge.inputs.quantities(j).filter((x) => !x.noTable);
    if (opt.what) {
      qs = qs.filter((x) => x.what === opt.what);
      if (!qs.length) { note('assumed', 'surgePumpState', obj); qs = [opt.quantity]; }
    }
    if (!qs.length) { note('ignored', 'surgeNoTables', obj); return; }
    // opt.single: the data a manoeuvre of a pump drives, started by the first event of a trigger of one or two events (the
    // second event of the program is the manoeuvre back, which pump() reports, I-45)
    const trig = flag(blk.trig);
    const start = opt.single && trig >= 1 && trig <= 3 ? 'single' : c.STARTS[trig];
    if (!start) { note('ignored', 'surgeTrigger', obj, { code: str(blk.trig) || '?' }); return; }
    const E = PumpIt.time.events, nE = E.EVENTS[start], nT = E.TABLES[start];
    const later = [], when = [];
    for (let e = 0; e < nE; e++) {
      const cond = blk.events[e] && c.eventCondition(blk.events[e], obj, later);
      if (!cond) return;
      shiftCondition(c, cond);
      when.push(cond);
    }
    const tbs = blk.tables.slice(0, nT).filter(Boolean);
    if (tbs.length < nT) { note('ignored', 'timeTables', obj); return; }
    const kept = tbs.find((x) => key(x.key) !== 'none');
    if (kept) { note('ignored', 'timeDataSet', obj, { key: unesc(kept.key) }); return; }
    const relative = flag(blk.rel) !== 0, u1 = tbs[0].units[0];
    const first = c.tableQuantity(j, u1, relative, qs);
    if (!first) {
      if (!relative && key(u1) === 'percent') note('ignored', 'timePercent', obj);
      else note('ignored', 'timeQuantity', obj, { unit: str(u1) || '?' });
      return;
    }
    const tables = [];
    for (const tb of tbs) {
      const u = tb.units[0], qt = c.tableQuantity(j, u, relative, qs);
      if (!qt || qt.x.what !== first.x.what) { note('ignored', 'timeQuantity', obj, { unit: str(u) || '?' }); return; }
      const tu = TIME[key(tb.tu)];
      if (!tu) { note('ignored', 'timeUnit', obj, { unit: str(tb.tu) || '?' }); return; }
      if (qt.odd) later.push(() => note('assumed', 'timeRelUnit', obj, { unit: str(u) || '?' }));
      let t = tb.rows.map((r) => r[0] * tu[1]), v = tb.rows.map((r) => r[1] * qt.f);
      // a table by the clock starts with the run of the file
      if (start === 'time' && sv.shift) ({ t, v } = cut(t, v, sv.shift / U.toSI(1, tu[0], 'time')));
      tables.push({ t, v, tUnit: tu[0], vUnit: qt.unit });
    }
    if (tbs.some((x) => x.nY > 1)) later.push(() => note('ignored', 'timeColumns', obj));
    // the options (F-39): ign 1 keeps the data unused; −1 (does not apply) is none; one choice of repetition
    const ign = flag(blk.ign) === -1 ? 0 : flag(blk.ign);
    const { use, repeat } = c.options(Object.assign({}, blk, { ign, rep1: flag(blk.rep1), rep2: flag(blk.rep2) }), nT, obj, later);
    j.surge = { use, what: first.x.what, basis: relative ? 'relative' : 'absolute', start, when, tables, repeat, interp: 'linear', resume: 'current' };
    note('info', 'surgeData', obj);
    for (const fn of later) fn();
  }

  // a trip or a start of a pump (sections 13 and 14.14, I-24, I-45): at the first event of its trigger (one event, or
  // the first of two; pump() checks the trigger), its tables empty, or holding the torque of the motor of a start
  function trip(c, j, blk, what) {
    const { note, obj } = c;
    if (!blk) return;
    const later = [];
    const cond = blk.events[0] && c.eventCondition(blk.events[0], obj, later);
    if (!cond) return;
    shiftCondition(c, cond);
    const use = flag(blk.ign) !== 1;
    if (!use) later.push(() => note('info', 'timeIgnored', obj));
    j.surge = { use, what, start: 'single', when: [cond] };
    // the state of the pump in the steady state must take it
    const takes = PumpIt.surge.inputs.quantities(j).some((x) => x.what === what);
    if (!takes && what === 'start') note('assumed', 'surgeStartState', obj);
    else if (!takes) note('assumed', 'surgePumpState', obj);
    note('info', 'surgeData', obj);
    for (const fn of later) fn();
  }

  // the torque of the motor of a start (I-26, I-49): the first table, its values in a unit of torque, against the speed
  // on the axis startSpeedType gives (0 the speed of the shaft in rpm, 1 % of the rated speed of the pump, the item rpm,
  // 2 % of the synchronous speed of the motor, syncRpm), turned into % of the rated speed, the axis of j.motor. The unit
  // of the speeds confirms the axis (RPM with 0 only): a note when it does not
  function motor(c, j, it, blk) {
    const { note, obj } = c;
    const tb = blk && blk.tables[0], tq = tb && TORQUE[key(tb.units[0])];
    if (!tq || tb.rows.length < 2) { note('missing', 'surgeMotorMissing', obj); return; }
    const type = it.n('startSpeedType'), rated = it.n('rpm'), sync = it.n('syncRpm');
    const f = type === 1 ? 1 : type === 0 ? (rated > 0 ? 100 / rated : NaN) : type === 2 && rated > 0 && sync > 0 ? sync / rated : NaN;
    if (!(f > 0)) { note('missing', 'surgeMotorSpeed', obj, { code: str(it.v('startSpeedType')) || '?' }); return; }
    const xu = key(tb.tu);
    if ((xu === 'rpm' || xu === 'percent') && (xu === 'rpm') !== (type === 0)) note('assumed', 'surgeMotorAxis', obj, { unit: str(tb.tu) });
    j.motor = { x: tb.rows.map((r) => round12(r[0] * f)), y: tb.rows.map((r) => round12(r[1] * tq[1])), yUnit: tq[0] };
    note('assumed', 'surgeMotor', obj);
  }

  // ---------- junctions (section 14)

  // the speed of a pump in its tables
  const SPEED = { what: 'speed', cat: 'percent' };
  // the items of the block of the junction of context c (items.js), walked once, as imp.js keeps them
  const itemsOf = (c) => c.items || (c.items = PumpIt.importItems.itemsOf(c.f, c.tb, c.np));
  // the pipe that arrives at a junction
  const inPipeOf = (c) => (c.conn.find((p) => p.down === c.id) || c.conn[0] || {}).id;
  // whether some of the tables named hold rows
  const hasRows = (it, ...names) => names.some((n) => { const tb = it.table(n); return !!(tb && tb.rows.length); });
  // the speeds of a manoeuvre (a control valve, a relief valve): per element of G4:rates [from %, to %, closing, opening]
  // (%/s), each kind when its flag (rateClose, rateOpen) is set
  function ratesOf(it) {
    const out = [];
    for (const r of it.group('rates')) {
      if (n0(it.v('rateClose')) !== 0 && num(r[2]) > 0) out.push(num(r[2]));
      if (n0(it.v('rateOpen')) !== 0 && num(r[3]) > 0) out.push(num(r[3]));
    }
    return out;
  }

  // the fields of the water hammer of junction j of context c (it: the reader of the items of its block, blk: its time
  // data) and its time data
  function junction(c, j, blk, it) {
    if (!c.surge || !it) return;
    const { note, obj } = c, kind = c.type;
    const rows = !!blk && blk.tables.some((x) => x && x.rows.length);
    // imposed flow and pressure (section 14.3): no reflection (ign 2, an infinite pipe, I-22), sinusoids (I-36) and the
    // reference pressure of an infinite pipe
    if (kind === 3 || kind === 4) {
      if (n0(it.v('periodic')) !== 0) note('ignored', 'surgePeriodic', obj);
      if (kind === 3 && n0(it.v('useRef')) !== 0) note('ignored', 'surgeReference', obj);
      if (blk && flag(blk.ign) === 2) {
        if (j.type === 'flow' || j.type === 'pressure') { j.surgeSpecial = 'infinitePipe'; note('info', 'surgeInfinite', obj); }
        else note('ignored', 'surgeInfiniteKind', obj);
        return;
      }
    }
    // valve (section 14.5): a Cv from a table of Cv by opening, and the opening profiles of the program
    if (kind === 8) {
      if (n0(it.v('cvFromTable')) === 1) note('assumed', 'surgeCvTable', obj);
      if (n0(it.v('profile')) !== 0) note('missing', 'surgeProfile', obj);
    }
    // control valve (section 14.6): ideal in the transient, its speed the smallest one applied (I-32)
    if (kind === 9 && j.type === 'control') controlValve(c, j, it);
    // check valve (section 14.10): its closing velocity, its reopening difference and its dynamic model (I-27); its
    // tables of opening and closing over time have no counterpart
    if (kind === 10) {
      if (j.type === 'check') checkValve(c, j, it);
      if (rows) note('ignored', 'surgeCheckTables', obj);
      return;
    }
    if (kind === 17) { pump(c, j, blk, it, rows); return; }
    // the protection devices are read by their own readers (types below), their tables included
    if ([21, 22, 24, 25].includes(kind)) return;
    surgeData(c, j, blk);
  }

  function controlValve(c, j, it) {
    const { note, obj } = c;
    j.surgeControl = 'ideal';
    note('info', 'surgeIdeal', obj);
    const rates = ratesOf(it);
    if (rates.length) {
      j.surgeRate = Math.min(...rates);
      if (new Set(rates).size > 1) note('assumed', 'surgeRate', obj, { rate: j.surgeRate });
      if (!PumpIt.junctionTypes.shared.CHARS.includes(j.char)) note('missing', 'surgeRateChar', obj);
    }
    // its options in the transient (I-32), booleans −1 yes and 0 no: always −1 controls always and never fails;
    // defaultFail −1 takes the actions on a failure of its kind, 0 those of failIn (when the inlet side keeps it from
    // controlling) and failOut (the outlet side), 0 opening it fully, so that it may control again, and 1 closing it (a −1
    // of old files is 0). Those of its kind: a pressure reducing valve 0 and 1, a sustaining one 1 and 0, a flow control
    // valve 0 and 0, a pressure drop valve those written. They are what the control valve of Pump It does, imported to
    // fail as its kind does (F-20); a note when the file asks for more: a valve that never fails, other actions, a
    // manoeuvre after the failure (rows of failTable, relFail) or an override (ovrFn other than 0)
    const KIND_FAIL = { 0: [0, 1], 1: [1, 0], 2: [0, 0] };
    const act = (k) => (n0(it.v(k)) === -1 ? 0 : n0(it.v(k)));
    const written = [act('failIn'), act('failOut')], kind = KIND_FAIL[it.n('valveType')] || written;
    const eff = n0(it.v('defaultFail')) !== 0 ? kind : written;
    const fail = it.table('failTable');
    if (n0(it.v('always')) !== 0 || eff[0] !== kind[0] || eff[1] !== kind[1] || (fail && fail.rows.length) || n0(it.v('ovrFn')) !== 0) note('ignored', 'surgeControlOptions', obj);
  }

  // ---------- check valves (section 14.10, I-27)

  function checkValve(c, j, it) {
    const { note, obj } = c;
    const vc = it.n('vClose'), v = velocity(vc, it.v('vCloseU'));
    if (v) j.vClose = v;
    else if (Number.isFinite(vc) && vc !== 0) c.unknownUnit(obj, it.v('vCloseU'));
    // the model: 0 instantaneous, 1 by deceleration, 2 a swinging disc, 3 a sliding disc
    const model = it.n('model');
    // the reopening difference: that of a disc is the one the program worked out from its weight, spring and area, and a
    // disc of Pump It opens again by its own torque (I-27)
    if (model !== 2 && model !== 3) reopening(c, j, it);
    if (model === 1) decelOf(c, j, it);
    else if (model === 2) swingOf(c, j, it);
    else if (model === 3) slidingOf(c, j, it);
    else if (Number.isFinite(model) && model !== 0) note('assumed', 'surgeObjCode', obj, { field: 'model', code: str(it.v('model')) });
  }

  // the reopening difference of a check valve (I-27): dpType 0 a difference of head of the liquid, ΔP = ρ·g·Δh, in a unit
  // of length; 1 a pressure difference. Another code keeps the default of Pump It
  function reopening(c, j, it) {
    const { note, obj } = c, v = it.n('dpOpen'), u = it.v('dpOpenU'), type = it.n('dpType');
    if (!Number.isFinite(v)) return;
    const d = type === 0 ? headOf(c, v, u) : type === 1 ? asDifference(v, u) : null;
    if (d) j.dPopen = dpQ(d.Pa, d.unit);
    else if (v !== 0 && (type === 0 || type === 1)) c.unknownUnit(obj, u);
    else if (v !== 0) note('assumed', 'surgeObjCode', obj, { field: 'dpType', code: str(it.v('dpType')) || '?' });
  }

  // by deceleration (G3-04): only the table of the user (perfType 2), the reverse velocity against the deceleration; a
  // curve of the library of the program is not in the file (W-51). Its window decelWindow is a time in seconds (I-58); −1
  // (or 0) is another method of the program, the average deceleration since the velocity fell below that of the steady
  // state, which Pump It does not have: its window of 0.1 s stays, with a note. NumDecelPoints is not read
  function decelOf(c, j, it) {
    const { note, obj } = c;
    if (it.n('perfType') !== 2) { note('missing', 'surgeCheckLibrary', obj); return; }
    const tb = it.table('decelTable');
    const ax = tb && ACCEL[key(tb.tu)], vy = tb && VELOCITY[key(tb.units[0])];
    if (!tb || tb.rows.length < 2 || !ax || !vy) { note('missing', 'surgeDecelTable', obj); return; }
    j.dynamic = 'decel';
    j.decel = { x: tb.rows.map((r) => round12(r[0] * ax[1])), y: tb.rows.map((r) => round12(r[1] * vy[1])), xUnit: ax[0], yUnit: vy[0] };
    const w = it.n('decelWindow');
    if (w > 0) j.decelWindow = q(w, 's');
    else note('assumed', 'surgeDecelWindow', obj);
    note('assumed', 'surgeDecel', obj);
  }

  // the mass of a weight of the file (a force) with the gravity of the model, m = W/g: in kg, or in lbm for a weight in
  // lbf; null when it is not given
  function massOfWeight(c, v, unit, obj) {
    const W = qOf(FORCE, v, unit);
    if (!W) { if (Number.isFinite(v) && v !== 0) c.unknownUnit(obj, unit); return null; }
    if (!(W.value > 0)) return null;
    const kg = U.toSI(W.value, W.unit, 'force') / c.grav;
    return W.unit === 'lbf' ? q(round12(kg / LBM), 'lbm') : q(round12(kg), 'kg');
  }
  // a table of the Cv of a disc against its position from the seat, [[x, Cv]] in any order → { x, y } from the seat (0) to
  // the stop xMax, y in % of the Cv at the stop, its values at the ends on the straight lines of the table (its end values
  // held beyond it); null when it does not read
  function cvTable(pts, xMax) {
    const s = pts.filter(([x, v]) => Number.isFinite(x) && Number.isFinite(v)).sort((a, b) => a[0] - b[0]);
    if (s.length < 2 || !(xMax > 0)) return null;
    const at = PumpIt.surge.checks.line(s.map((p) => p[0]), s.map((p) => p[1]));
    const all = [[0, at(0)], ...s.filter(([x]) => x > 1e-12 * xMax && x < xMax * (1 - 1e-12)), [xMax, at(xMax)]];
    const open = all[all.length - 1][1];
    if (!(open > 0)) return null;
    return { x: all.map((p) => round12(p[0])), y: all.map((p) => round12((100 * p[1]) / open)) };
  }
  // a unit of the file is there once the merge with the parent is done (answers 2, 1): None, (None), NA, (User Specified)
  // and the empty field are not a unit
  const unitOn = (u) => !['', 'none', '(none)', 'na', '(userspecified)'].includes(key(u));
  // a pressure in Pa as kPa for the notes
  const kPaText = (Pa) => String(+(Pa / 1000).toPrecision(4));
  // the angle φ of a check valve with the pipe, in degrees (orient 0, 1 and 2, as orientOf takes them)
  const phiOf = (it) => { const o = it.n('orient'); return o === 1 ? 90 : o === 2 && Number.isFinite(it.n('orientAngle')) ? it.n('orientAngle') : 0; };
  // a force of the file in N, or 0 without its unit
  const newtons = (v, unit) => { const f = qOf(FORCE, v, unit); return f ? U.toSI(f.value, f.unit, 'force') : 0; };
  // the mass of liquid a disc moves, of the file (I-54) → kg: fluidMassType 1 the mass given, 2 none; 0, the mass the
  // program works out (calc), or NaN when it cannot; another code none, with a note
  function fluidMassOf(c, it, calc) {
    const code = n0(it.v('fluidMassType'));
    if (code === 1) {
      const x = qOf(MASS, it.n('fluidMass'), it.v('fluidMassU'));
      if (!x && Number.isFinite(it.n('fluidMass')) && it.n('fluidMass') !== 0) c.unknownUnit(c.obj, it.v('fluidMassU'));
      return x && x.value > 0 ? U.toSI(x.value, x.unit, 'mass') : 0;
    }
    if (code === 0) return calc();
    if (code !== 2) c.note('assumed', 'surgeObjCode', c.obj, { field: 'fluidMassType', code: str(it.v('fluidMassType')) || '?' });
    return 0;
  }
  // the counterweight of a swinging disc (I-57, answers 2): there is one when at least one of the units of cwL, cwW and cwI
  // is there, whatever cwAngle (−181 of a new valve, −999 of an empty one) says; its arm, its weight and its inertia are
  // each zero (null) without their own unit. The program refuses the valve when one of the three values is negative
  // (counted without a unit too) or cwAngle, the angle δ to the arm of the disc, is outside −180° to 180°: nothing of the
  // counterweight is read then, with a note
  function counterweight(c, it) {
    if (!['cwL', 'cwW', 'cwI'].some((k) => unitOn(it.v(k + 'U')))) return null;
    const ang = it.n('cwAngle');
    if (['cwL', 'cwW', 'cwI'].some((k) => it.n(k) < 0)) { c.note('ignored', 'surgeCounterNegative', c.obj); return null; }
    if (!(ang >= -180 && ang <= 180)) { c.note('ignored', 'surgeCounterAngle', c.obj); return null; }
    const part = (k, read) => {
      const v = it.n(k), u = it.v(k + 'U');
      if (!unitOn(u)) return null;
      const x = read(v, u);
      if (!x && Number.isFinite(v) && v !== 0) c.unknownUnit(c.obj, u);
      return x && x.value > 0 ? x : null;
    };
    return {
      W: part('cwW', (v, u) => qOf(FORCE, v, u)),
      L: part('cwL', (v, u) => (inTable(LENGTH, u) ? c.len(v, u, null) : null)),
      I: part('cwI', (v, u) => qOf(INERTIA, v, u)),
      delta: q(ang, '°'),
    };
  }
  // the position of a check valve (I-57): 0 horizontal (φ = 0), 1 vertical with the flow upwards (φ = 90°), 2 the angle
  // orientAngle in degrees, positive with the flow rising; the φ of Pump It. Another code keeps it horizontal
  function orientOf(c, it, s) {
    const o = it.n('orient');
    if (o === 1) s.orient = 'vertical';
    else if (o === 2) Object.assign(s, { orient: 'angle', phi: q(Number.isFinite(it.n('orientAngle')) ? it.n('orientAngle') : null, '°') });
    else if (Number.isFinite(o) && o !== 0) c.note('assumed', 'surgeObjCode', c.obj, { field: 'orient', code: str(it.v('orient')) });
  }

  // a swinging disc (G3-05, G3-06). The program measures θ between the arm of the disc (from the hinge to the centre of
  // gravity) and the axis of the pipe, thMax closed and thMin fully open, and closes it by the torque
  // Wd·rcg·cos(θ − φ) + cwW·cwL·cos(θ − φ − δ) + Ts0 + ks·(thMax − θ) − ΔP·Ad·rcg, ks per degree: with θ_P = thMax − θ
  // from the seat, its stop thMax − thMin and its seat inclined by γ_c = 90° − thMax, the torques of Pump It are the same
  // (I-57). Its weight is as the program takes it, without buoyancy, its mass with no fluid mass (I-54); its arm is that
  // of the pressure too; the spring per degree, its torque at the seat only with a spring (I-55); its inertia that of the
  // disc with those of the counterweight and of the liquid it drags, 1.25·m_f·r² with r = √(Ad/π) (the inertia of a disc
  // of mass m_f about its edge), m_f calculated as the liquid of the sphere of radius r, (4/3)·π·r³·ρ (I-54, I-57)
  function swingOf(c, j, it) {
    const { note, obj } = c;
    const s = PumpIt.surge.checks.newSwing();
    const thMin = it.n('thMin'), thMax = it.n('thMax');
    s.thetaMax = q(Number.isFinite(thMin) && Number.isFinite(thMax) ? round12(thMax - thMin) : null, '°');
    if (Number.isFinite(thMax)) s.seat = q(round12(90 - thMax), '°');
    s.rcg = c.len(it.n('rcg'), it.v('rcgU'), obj);
    s.rp = Object.assign({}, s.rcg);
    const Ad = c.area(it.n('Ad'), it.v('AdU'), null), a = c.si(Ad, 'area');
    if (Ad.value > 0) s.Ad = Ad;
    const md = massOfWeight(c, it.n('Wd'), it.v('WdU'), obj);
    if (md) s.md = md;
    s.fluidMass = 'none';
    // the spring (answers 7.1 and 2): none without the unit of ks or with ks 0; its two units go together, the program
    // refusing the valve with one of them; its torque at the seat only with a spring; a negative ks with its unit is invalid
    const ksOn = unitOn(it.v('ksU')), TsOn = unitOn(it.v('Ts0U')), ks = it.n('ks');
    if (ksOn !== TsOn) note('ignored', 'surgeSpringRefused', obj);
    if (ksOn && ks < 0) note('ignored', 'surgeSpringNegative', obj);
    if (ksOn && ks > 0) {
      const k = qOf(ROT_STIFFNESS, ks, it.v('ksU'));
      if (k) s.ks = k; else note('missing', 'surgeSwingSpring', obj);
      if (TsOn && Number.isFinite(it.n('Ts0'))) { const T = qOf(TORQUE, it.n('Ts0'), it.v('Ts0U')); if (T) s.Ts0 = T; else c.unknownUnit(obj, it.v('Ts0U')); }
    }
    // the Cv against the angle from the seat, thMax less the angle of the file, in % of the Cv fully open (I-56)
    const tb = it.table('cvTheta');
    const cv = tb && s.thetaMax.value > 0 ? cvTable(tb.rows.map((r) => [thMax - r[0], r[1]]), s.thetaMax.value) : null;
    if (cv) s.cv = { x: cv.x, y: cv.y, xUnit: '°' }; else note('missing', 'surgeCvDisc', obj);
    const cw = counterweight(c, it);
    if (cw && cw.W) Object.assign(s, { Wc: cw.W, delta: cw.delta }, cw.L ? { rc: cw.L } : {});
    // the counterweight is out of the pressure at which the program reopens a closed disc, (Wd·rcg·cos(thMax − φ) + Ts0
    // only with a spring)/(rcg·Ad), which Pump It does not have apart from its torques: the threshold, with a note (answer 2)
    if (cw && cw.W && cw.L) {
      const rcg = c.si(s.rcg, 'length'), A = c.si(Ad, 'area');
      const Ts0 = s.ks && s.ks.value > 0 && s.Ts0 ? U.toSI(s.Ts0.value, s.Ts0.unit, 'torque') : 0;
      const th = (Number.isFinite(thMax) ? thMax - phiOf(it) : 0) * Math.PI / 180;
      const Pa = (newtons(it.n('Wd'), it.v('WdU')) * rcg * Math.cos(th) + Ts0) / (rcg * A);
      if (Number.isFinite(Pa)) note('assumed', 'surgeCounterReopen', obj, { dp: kPaText(Pa) });
    }
    // the inertia, in the unit of that of the disc
    const I = qOf(INERTIA, it.n('I'), it.v('IU'));
    if (I && I.value > 0) {
      let tot = U.toSI(I.value, I.unit, 'inertia');
      if (cw && cw.I) tot += U.toSI(cw.I.value, cw.I.unit, 'inertia');
      const mf = fluidMassOf(c, it, () => (a > 0 ? (4 / 3) * Math.PI * (a / Math.PI) ** 1.5 * c.rho : NaN));
      if (Number.isNaN(mf) || (mf > 0 && !(a > 0))) note('missing', 'surgeSwingFluid', obj);
      else if (mf > 0) tot += (1.25 * mf * a) / Math.PI;
      s.I = q(round12(U.fromSI(tot, I.unit, 'inertia')), I.unit);
    } else if (it.n('I') > 0) c.unknownUnit(obj, it.v('IU'));
    orientOf(c, it, s);
    Object.assign(j, { dynamic: 'swing', swing: s });
    note('assumed', 'surgeSwing', obj);
  }

  // a sliding disc (G3-05, G3-06): its travel, its area, its spring and the force of the spring at the seat, its
  // position (I-57). Its weight is as the program takes it, without buoyancy, and the mass of liquid it moves, m_a, adds to
  // its mass and stands for itself in the term of buoyancy of Pump It, (m − m_f)·g·sin φ: m = WdT/g + m_a, m_f = m_a, so
  // that its weight is WdT·sin φ and its mass WdT/g + m_a; fluidMassType 1 gives m_a, 2 none, and 0 is a mass the
  // program estimates at each step, ρ·AdT·|Δx|, which Pump It does not have (a note; I-54). The program measures its
  // travel from the stop fully open: T:cvTravel goes from 0 (the Cv fully open) to xMax (Cv 0), so the travel from the
  // seat is xMax less it (I-56)
  function slidingOf(c, j, it) {
    const { note, obj } = c;
    const s = PumpIt.surge.checks.newNozzle();
    const xm = c.len(it.n('xMax'), it.v('xMaxU'), obj);
    s.xMax = xm;
    const Ad = c.area(it.n('AdT'), it.v('AdTU'), null);
    if (Ad.value > 0) s.Ad = Ad;
    // the program refuses the valve without the unit of xMax, AdT, WdT, ksT or Fs0, with fluidMassType 1 without that of
    // fluidMass, or with fewer than 2 rows in T:cvTravel
    const tbT = it.table('cvTravel');
    if (['xMax', 'AdT', 'WdT', 'ksT', 'Fs0'].some((k) => !unitOn(it.v(k + 'U'))) || (it.n('fluidMassType') === 1 && !unitOn(it.v('fluidMassU'))) || !tbT || tbT.rows.length < 2) note('ignored', 'surgeSlidingRefused', obj);
    // the spring (answer 1): k = ksT with its unit and ksT above 0, F_s0 = Fs0 with that k and its own unit; otherwise none
    const kv = it.n('ksT'), kOn = unitOn(it.v('ksTU'));
    if (kOn && kv > 0) {
      const k = qOf(STIFFNESS, kv, it.v('ksTU'));
      if (k) {
        s.k = k;
        if (unitOn(it.v('Fs0U')) && Number.isFinite(it.n('Fs0'))) { const F = qOf(FORCE, it.n('Fs0'), it.v('Fs0U')); if (F) s.F0 = F; else c.unknownUnit(obj, it.v('Fs0U')); }
      } else c.unknownUnit(obj, it.v('ksTU'));
    } else if (kOn && kv < 0) note('ignored', 'surgeSpringNegative', obj);
    // without a spring the program still reopens the closed disc at (WdT·sin φ + Fs0)/AdT; Pump It, with F_s0 = 0, at
    // WdT·sin φ/AdT: both in the note
    if (kOn && kv === 0 && unitOn(it.v('Fs0U')) && Number.isFinite(it.n('Fs0')) && it.n('Fs0') !== 0) {
      const A = c.si(Ad, 'area'), W = newtons(it.n('WdT'), it.v('WdTU')), w = W * Math.sin(phiOf(it) * Math.PI / 180);
      if (A > 0) note('assumed', 'surgeSlidingReopen', obj, { dp: kPaText((w + newtons(it.n('Fs0'), it.v('Fs0U'))) / A), dpP: kPaText(w / A) });
    }
    const ma = fluidMassOf(c, it, () => { note('ignored', 'surgeSlidingFluid', obj); return 0; });
    const m = massOfWeight(c, it.n('WdT'), it.v('WdTU'), obj), mu = m ? m.unit : 'kg';
    if (m) s.m = ma > 0 ? q(round12(U.fromSI(U.toSI(m.value, mu, 'mass') + ma, mu, 'mass')), mu) : m;
    Object.assign(s, ma > 0 ? { fluidMass: 'user', mf: q(round12(U.fromSI(ma, mu, 'mass')), mu) } : { fluidMass: 'none' });
    // the Cv against the travel from the seat, in the unit of the travel, in % of the Cv fully open
    const tb = it.table('cvTravel'), lu = tb && LENGTH[key(tb.tu)];
    const pts = tb && lu && xm.value > 0 ? tb.rows.map((r) => [xm.value - U.fromSI(U.toSI(r[0] * lu[1], lu[0], 'length'), xm.unit, 'length'), r[1]]) : null;
    const cv = pts && cvTable(pts, xm.value);
    if (cv) s.cv = { x: cv.x, y: cv.y, xUnit: xm.unit }; else note('missing', 'surgeCvDisc', obj);
    orientOf(c, it, s);
    Object.assign(j, { dynamic: 'nozzle', nozzle: s });
    note('assumed', 'surgeSliding', obj);
  }

  // ---------- pumps (section 14.14, I-24, I-25)

  // the four-quadrant data of the user (I-25): fqIncr + 1 rows from 0° to 360° in equal steps of 360°/fqIncr, the last
  // equal to the first. The program reads WH and WB by the order of the rows (row k at θ = k·360°/fqIncr, from 0), not
  // their column of θ, uses the first fqIncr and comes back to the first after the last, the curves being periodic: so
  // θ goes by the row, and the table closes at 360° on its first point. fqAngleType defines θ: 0 π + atan2(v, α), that
  // of Pump It (G3-01); 1 atan2(α, v) from 0 to 360°, moved to that of Pump It by θ_P = (270° − θ) mod 360°, sorted, with
  // the point of 0°, on the straight line between the last point and the first when the points moved do not hold it. WH
  // and WB are the same in both. The curves of the library of the program are not in the file (W-51). The reference
  // point: 0 the steady state, 1 the best efficiency, 2 the steady state with a note (I-35). → whether they came in
  function fourQuad(c, j, it) {
    const { note, obj } = c, src = it.n('fqSource');
    // a model in four quadrants without their data (−1, none)
    if (!(src >= 0)) { note('missing', 'surgeFourTable', obj); return false; }
    if (src > 0) { note('missing', 'surgeFourLibrary', obj); return false; }
    const type = n0(it.v('fqAngleType'));
    if (type !== 0 && type !== 1) { note('missing', 'surgeFourAngle', obj, { code: str(it.v('fqAngleType')) }); return false; }
    const tb = it.table('fqData'), n = it.n('fqIncr');
    if (!tb || tb.nY < 2 || !(Number.isInteger(n) && n >= 2) || tb.rows.length < n) { note('missing', 'surgeFourTable', obj); return false; }
    let pts = tb.rows.slice(0, n).map((r, k) => [round12((k * 360) / n), r[1], r[2]]);
    if (type === 1) {
      pts = pts.map(([t, h, b]) => [round12((((270 - t) % 360) + 360) % 360), h, b]).sort((x, y) => x[0] - y[0]);
      if (pts[0][0] !== 0) {
        const [t1, h1, b1] = pts[pts.length - 1], [t2, h2, b2] = pts[0], w = (360 - t1) / (t2 + 360 - t1);
        pts.unshift([0, round12(h1 + w * (h2 - h1)), round12(b1 + w * (b2 - b1))]);
      }
      note('assumed', 'surgeFourType1', obj);
    }
    pts.push([360, pts[0][1], pts[0][2]]);
    const rated = n0(it.v('fqRated'));
    if (rated === 2) note('assumed', 'surgeFourSteady', obj);
    else if (rated !== 0 && rated !== 1) note('assumed', 'surgeObjCode', obj, { field: 'fqRated', code: str(it.v('fqRated')) });
    j.fourQuad = { use: true, ref: rated === 1 ? 'bep' : 'steady', theta: pts.map((p) => p[0]), wh: pts.map((p) => p[1]), wb: pts.map((p) => p[2]) };
    note('info', 'surgeFour', obj);
    return true;
  }

  // pump: the inertia, the rated speed and the check valve; the model of its transient decides what its data are: 1 a
  // table of its speed, 2 a trip, 3 a trip in four quadrants, 4 a start with a known speed in four quadrants, 5 a start
  // by its motor (W-50), 6 the same in four quadrants, 7 the four quadrants without a transient of the pump. A trip (2,
  // 3) or a start (4 to 6) happens only at an event of its trigger (I-24, I-45): by the clock (0) the program makes
  // neither, and the pump keeps the state of its steady state through the run, as without transient data (model 0);
  // the first of two events (2 cyclic, 3 in sequence) makes the manoeuvre and the second the manoeuvre back (a restart
  // after a trip, a trip after a start), once or alternating, which Pump It does not have (one manoeuvre per pump, W-50)
  function pump(c, j, blk, it, rows) {
    const { note, obj } = c;
    const tm = it.n('tModel');
    if (j.type !== 'pump') { if (tm > 0) note('assumed', 'surgePumpState', obj); return; }
    const I = it.n('I'), iu = INERTIA[key(it.v('IU'))];
    if (I > 0 && iu) j.inertia = q(round12(I * iu[1]), iu[0]);
    else if (I > 0) c.unknownUnit(obj, it.v('IU'));
    if (it.n('rpm') > 0) j.rpm = q(it.n('rpm'), 'rpm');
    if (n0(it.v('checkValve')) === -1) {
      j.noReverse = true;
      if ((it.n('vClose') || 0) !== 0 || (it.n('dpOpen') || 0) !== 0) note('ignored', 'surgePumpCheck', obj);
    }
    if (n0(it.v('periodic')) !== 0) note('ignored', 'surgePeriodic', obj);
    const manoeuvre = [2, 3, 4, 5, 6].includes(tm), trig = blk ? flag(blk.trig) : 0;
    if (manoeuvre && trig === 0) { note('ignored', 'surgeNoEvent', obj); return; }
    if (manoeuvre && !(trig >= 1 && trig <= 3)) { note('ignored', 'surgeTrigger', obj, { code: str(blk && blk.trig) || '?' }); return; }
    const four = [3, 4, 6, 7].includes(tm) && fourQuad(c, j, it);
    if (tm === 1) surgeData(c, j, blk, { what: 'speed', quantity: SPEED });
    else if (tm === 2 || tm === 3) trip(c, j, blk, 'trip');
    else if (tm === 4) { if (four) surgeData(c, j, blk, { what: 'speed', quantity: SPEED, single: true }); else note('missing', 'surgeStartFour', obj); }
    else if (tm === 5 || tm === 6) { motor(c, j, it, blk); trip(c, j, blk, 'start'); }
    else if (tm === 0 || !Number.isFinite(tm)) { if (rows) note('ignored', 'surgePumpTables', obj); }
    else if (tm !== 7) note('assumed', 'surgeObjCode', obj, { field: 'tModel', code: str(it.v('tModel')) });
    if (manoeuvre && trig > 1 && tm <= 3) note('ignored', 'surgeSecondRestart', obj);
    else if (manoeuvre && trig > 1) note('ignored', 'surgeSecondTrip', obj);
  }

  // ---------- protection devices (sections 14.11 to 14.13 and 14.15): junction types of their own while the module of the
  // water hammer is in the page (W-39); without it, null, and the reader of liquid.js brings them in as kinds it does not
  // read (F-26)

  // a device closed by its special condition: a node of its pipes, without the device
  function closedDevice(c) {
    c.note('info', 'surgeDeviceClosed', c.obj);
    return c.plainNode();
  }
  // the K of each pipe at a tank (P3: the K into the pipe, the K into the tank, the difference of elevation of the
  // connection), in the order of the other kinds with fields per pipe (F-16, F-18)
  function pipeKOf(c, it) {
    const pk = {};
    let dz = false;
    for (let i = 0; i < c.np; i++) {
      const [kOut, kIn, z] = it.perPipe(i).map(num), pid = c.pidAt(i);
      if (pid && (kOut > 0 || kIn > 0)) pk[pid] = { kOut: kOut > 0 ? kOut : 0, kIn: kIn > 0 ? kIn : 0 };
      if (Number.isFinite(z) && z !== 0) dz = true;
    }
    if (dz) c.note('ignored', 'surgeConnElev', c.obj);
    return pk;
  }
  // the orifice and the riser of a tank or an accumulator (W-41, I-29, I-30): an orifice when restrictor is −1 (0 none,
  // its coefficients and area not read; I-53), with a discharge coefficient above zero each way, CdIn for the liquid into
  // the device and CdOut out of it, and its area (there is no orifice of one way); a riser (a flag, −1 when there is one)
  // with its friction factor, diameter (or area) and length
  function connection(c, it) {
    const { note, obj } = c, out = {};
    if (n0(it.v('restrictor')) !== 0) {
      const A = c.area(it.n('fa'), it.v('faU'), null), a = c.si(A, 'area'), ci = it.n('CdIn'), co = it.n('CdOut');
      if (ci > 0 && co > 0 && a > 0) Object.assign(out, { orifice: true, CdAin: q(round12(ci * A.value), A.unit), CdAout: q(round12(co * A.value), A.unit) });
      else note('missing', 'surgeOrifice', obj);
    }
    if (n0(it.v('riser')) !== 0) {
      let D = c.len(it.n('riserD'), it.v('riserDU'), null);
      if (!(D.value > 0)) { const Ar = c.si(c.area(it.n('riserA'), it.v('riserAU'), null), 'area'); if (Ar > 0) D = q(round12(Math.sqrt((4 * Ar) / Math.PI)), 'm'); }
      const f = it.n('riserF');
      Object.assign(out, { riser: true, riserL: c.len(it.n('riserL'), it.v('riserLU'), obj), riserD: D, riserF: Number.isFinite(f) && f >= 0 ? f : 0.015 });
      if (Number.isFinite(it.n('riserDz')) && it.n('riserDz') !== 0) note('ignored', 'surgeRiserDz', obj);
    }
    return out;
  }
  // a table of volume by height [key None, nY = 1, n, unit of the height, unit of the volume, rows (h, V)], in the units
  // hu and vu → { h, V, hUnit, vUnit } in units of Pump It, or null
  function hvTable(tb, hu, vu) {
    const h = LENGTH[key(hu)], V = VOLUME[key(vu)];
    if (!tb || tb.rows.length < 2 || !h || !V || key(tb.key) !== 'none') return null;
    return { h: tb.rows.map((r) => round12(r[0] * h[1])), V: tb.rows.map((r) => round12(r[1] * V[1])), hUnit: h[0], vUnit: V[0] };
  }

  // surge tank (24, I-30): its shape (a constant section, or a table of volume by height, which reaches its top), its
  // top, the K of its pipes, its orifice and riser, one way; a level of the file (useRef) is a level given (a hypothesis)
  function surgeTank(c) {
    if (!c.surge) return null;
    if (!c.fits('surgeTank')) return c.pipeCount();
    if (c.closed) return closedDevice(c);
    const it = itemsOf(c), { note, obj } = c;
    const props = { pipeK: pipeKOf(c, it), level: 'steady' };
    const H = c.len(it.n('height'), it.v('heightU'), null);
    props.height = H.value > 0 ? H : q(null, 'm');
    if (n0(it.v('useVolTable')) !== 0) {
      const vt = it.table('volTable'), tb = vt && hvTable(vt, vt.tu, vt.units[0]);
      Object.assign(props, { shape: 'table', table: tb || { h: [], V: [], hUnit: 'm', vUnit: 'm³' } });
      if (!tb) note('missing', 'surgeTankShape', obj);
      else if (!(H.value > 0)) props.height = q(tb.h[tb.h.length - 1], tb.hUnit);
    } else Object.assign(props, { shape: 'constant', area: c.area(it.n('area'), it.v('areaU'), obj) });
    if (n0(it.v('useRef')) !== 0) {
      Object.assign(props, { level: 'given', liquidElev: c.len(it.n('refLevel'), it.v('refLevelU'), obj) });
      note('assumed', 'surgeTankLevel', obj);
    }
    const sp = c.si(c.pressure(it.n('surfP'), it.v('surfPU'), null), 'pressure');
    if (Number.isFinite(sp) && Math.abs(sp - c.patm) > 1e-6 * c.patm) note('ignored', 'surgeTankPressure', obj);
    Object.assign(props, connection(c, it));
    if (n0(it.v('oneWay')) !== 0) { props.oneWay = true; note('ignored', 'surgeOneWay', obj); }
    if (n0(it.v('dip')) !== 0) note('ignored', 'surgeDip', obj);
    if (it.n('nGas') > 0) note('ignored', 'surgeTankGas', obj);
    if (hasRows(it, 'table1', 'table2')) note('ignored', 'surgeTankTables', obj);
    return c.make('surgeTank', props);
  }

  // gas accumulator (22, I-29): an air vessel with the exponent of its gas; its volume of gas in the steady state, or its
  // pre-charge, the pressure of the file for its volume (a hypothesis); the limits of its gas volume; its geometry by a
  // table of volume by height; its orifice and riser
  function accumulator(c) {
    if (!c.surge) return null;
    if (!c.fits('airVessel')) return c.pipeCount();
    if (c.closed) return closedDevice(c);
    const it = itemsOf(c), { note, obj } = c;
    const vol = (v, unit) => { const x = qOf(VOLUME, v, unit); if (!x && Number.isFinite(v) && v > 0) c.unknownUnit(obj, unit); return x; };
    const n = it.n('n'), V = vol(it.n('V'), it.v('VU')) || q(null, 'm³');
    const props = { n: n > 0 ? n : 1.2 };
    if (n0(it.v('gasType')) === 0) Object.assign(props, { gasInit: 'given', Vg0: V });
    else {
      Object.assign(props, { gasInit: 'precharge', Vpre: V, Ppre: c.pressure(it.n('gasP'), it.v('gasPU'), obj) });
      note('assumed', 'surgePrecharge', obj);
    }
    // the limits of the gas volume, in their unit (−1: none)
    const lim = (k) => (it.n(k) > 0 ? vol(it.n(k), it.v('VlimU')) : null);
    const vmax = lim('Vmax'), vmin = lim('Vmin');
    if (vmax) props.vol = vmax;
    if (vmin) props.vgMin = vmin;
    if (n0(it.v('geometry')) === 0) props.shape = 'none';
    else {
      const gt = it.table('geoTable');
      const tb = gt && hvTable(gt, inTable(LENGTH, it.v('geoHU')) ? it.v('geoHU') : gt.tu, inTable(VOLUME, it.v('geoVU')) ? it.v('geoVU') : gt.units[0]);
      if (tb) {
        const H = c.len(it.n('height'), it.v('heightU'), null);
        Object.assign(props, { shape: 'table', table: tb, height: H.value > 0 ? H : q(tb.h[tb.h.length - 1], tb.hUnit) });
      } else { props.shape = 'none'; note('ignored', 'surgeVesselShape', obj); }
    }
    Object.assign(props, connection(c, it));
    if (n0(it.v('relief')) !== 0) note('ignored', 'surgeVesselRelief', obj);
    return c.make('airVessel', props);
  }

  // relief valve (21, I-28): on an outlet (2) or in line at an outlet (3), a relief valve; an internal one (1), between two
  // pipes, a closed valve. Its opening (crack), full opening (over) and closing (blowdown) pressures are on one base: heads
  // or pressures by crackType, differences over the outlet pressure or the pressures at the valve by balanced; its loss a
  // Cv, a Kv or, from a K, a Cd·A at the area of its inlet pipe
  function reliefValve(c) {
    if (!c.surge) return null;
    const it = itemsOf(c), { note, obj } = c, vt = it.n('valveType');
    if (vt === 1) {
      if (c.n !== 2) return c.pipeCount();
      note('assumed', 'surgeReliefInternal', obj);
      if (c.closed) c.closedObjs.push(obj);
      return c.make('valve', { lossModel: 'K', K: 0, closed: true });
    }
    if (!c.fits('reliefValve')) return c.pipeCount();
    if (c.closed) return closedDevice(c);
    if (vt !== 2 && vt !== 3) note('assumed', 'surgeObjCode', obj, { field: 'valveType', code: str(it.v('valveType')) });
    // the outlet pressure: 0 or None is the ambient one
    const back = it.n('back'), bu = it.v('backU');
    const Pext = !(Number.isFinite(back) && back !== 0) || key(bu) === 'none' || key(bu) === '' ? q(0, 'kgf/cm²(g)') : c.pressure(back, bu, obj);
    const base = c.si(Pext, 'pressure');
    // the base of its pressures (I-28): crackType 0 heads of the liquid, 1 pressures (another code: the category of the
    // unit); balanced 0 differences over the outlet pressure, a pressure in any of its units read as a difference and a
    // head by ρ·g·h; −1 the pressures at the valve, absolute or gauge by their unit, a head a piezometric head at the
    // elevation of the valve with the ambient pressure. The full opening and closing pressures are on the base of the
    // opening one, never relative to it
    const ct = it.n('crackType'), balanced = n0(it.v('balanced')) !== 0;
    const at = (v, unit) => {
      const none = q(null, 'kgf/cm²(g)');
      if (!Number.isFinite(v) || key(unit) === 'none' || key(unit) === '') return none;
      let P = null;
      if (ct === 0 || (ct !== 1 && inTable(LENGTH, unit))) {
        if (balanced) P = piezometric(c, v, unit);
        else { const h = headOf(c, v, unit); P = h && Number.isFinite(base) ? gauge(c, base + h.Pa, h.unit) : null; }
      } else if (balanced) P = inTable(PRESSURE, unit) ? c.pressure(v, unit, obj) : null;
      else { const d = asDifference(v, unit); P = d && Number.isFinite(base) ? gauge(c, base + d.Pa, d.unit) : null; }
      if (!P) { if (Number.isFinite(base) || balanced) c.unknownUnit(obj, unit); return none; }
      return P;
    };
    const props = { Pext, Pset: at(it.n('crack'), it.v('crackU')) };
    // the loss: 0 a Cv, 7 a Kv, 1 a K as a Cd·A at its inlet pipe; 5, not decoded, a Cv (a hypothesis)
    const lm = it.n('lossType'), val = it.n('loss');
    if (lm === 0 || lm === 5) {
      Object.assign(props, { lossModel: 'Cv', Cv: val > 0 ? val : null });
      if (lm === 5) note('assumed', 'surgeReliefLoss', obj);
    } else if (lm === 7) Object.assign(props, { lossModel: 'Kv', Kv: val > 0 ? val : null });
    else if (lm === 1) {
      const A = c.areaOf(inPipeOf(c));
      Object.assign(props, { lossModel: 'CdA', CdA: q(val > 0 && A > 0 ? round12((A / Math.sqrt(val)) * 1e4) : null, 'cm²') });
    } else note('assumed', 'lossModel', obj, { code: str(it.v('lossType')) || '?' });
    // opening: 0 at once, 2 by the pressure, 1 over time (by the pressure, with a note); its full opening pressure
    const ot = it.n('openType');
    props.mode = ot === 0 ? 'instant' : 'pressure';
    if (ot === 1) note('assumed', 'surgeReliefOpenTime', obj);
    props.Pfull = at(it.n('over'), it.v('overU'));
    // closing: 2 by the pressure, at its blowdown pressure; 3 never and 1 over time, with notes; 0 at its set pressure
    const cl = it.n('closeType');
    if (cl === 2) props.Pclose = at(it.n('blowdown'), it.v('blowdownU'));
    else if (cl === 3) note('ignored', 'surgeReliefNever', obj);
    else if (cl === 1) note('assumed', 'surgeReliefCloseTime', obj);
    const rates = ratesOf(it);
    if (rates.length) {
      props.rate = Math.min(...rates);
      if (new Set(rates).size > 1) note('assumed', 'surgeRate', obj, { rate: props.rate });
    }
    if (['preset', 'remoteUse', 'anticip', 'cdaSource', 'api526'].some((k) => n0(it.v(k)) !== 0)) note('ignored', 'surgeReliefOptions', obj);
    if (hasRows(it, 'table1', 'table2')) note('ignored', 'surgeReliefTables', obj);
    return c.make('reliefValve', props);
  }

  // air valve (25, I-31): its kind, its Cd·A in and out (and that of its intermediate stage, switched as trigType says),
  // its opening pressure (a pressure or a piezometric head, as crackType says), the temperature of its air, that of the
  // liquid (liqTType 0 the fluid of the model, 1 liqT), its initial air
  const AIR_KINDS = { 0: 'both', 1: 'in', 2: 'out', 3: 'twoStage' };
  const AIR_M = 28.9647, R_U = 8314.462618; // the molar mass of air (kg/kmol) and the gas constant (J/(kmol·K))
  const temperatureOf = (v, unit) => (TEMPERATURE[key(unit)] && Number.isFinite(v) ? q(v, TEMPERATURE[key(unit)]) : null);
  function airValve(c) {
    if (!c.surge) return null;
    if (!c.fits('airValve')) return c.pipeCount();
    if (c.closed) return closedDevice(c);
    const it = itemsOf(c), { note, obj } = c;
    const avType = AIR_KINDS[it.n('avType')] || 'both';
    if (!AIR_KINDS[it.n('avType')] && str(it.v('avType')) !== '') note('assumed', 'surgeObjCode', obj, { field: 'avType', code: str(it.v('avType')) });
    // the Cd·A of each way, a note when a way the valve uses has none
    const cda = (k, u, used) => c.area(it.n(k), it.v(u), used ? obj : null);
    const props = { avType, CdAin: cda('CdAin', 'CdAinU', avType !== 'out'), CdAout: cda('CdAout', 'CdAoutU', avType !== 'in') };
    // the air of the cavity is at the temperature of the liquid (isothermal): liqTType 0 that of the fluid of the model,
    // 1 liqT; the outside air (gasText, with gasPext) is the air that comes in, which Pump It takes at the temperature of
    // the cavity too (a note when they differ)
    const lt = it.n('liqTType');
    let T = null;
    if (lt === 1) T = temperatureOf(it.n('liqT'), it.v('liqTU'));
    else if (lt === 0 || !Number.isFinite(lt)) { const x = valUnit(kv(c.F, 'Temperature')); T = x && temperatureOf(x.v, x.unit); }
    else note('assumed', 'surgeObjCode', obj, { field: 'liqTType', code: str(it.v('liqTType')) });
    if (T) props.Tair = T;
    const Tc = T ? U.toSI(T.value, T.unit, 'temperature') : NaN, Tx = temperatureOf(it.n('gasText'), it.v('gasTextU'));
    if (Tx && Number.isFinite(Tc) && Math.abs(U.toSI(Tx.value, Tx.unit, 'temperature') - Tc) > 1e-3) note('ignored', 'surgeAirOutside', obj);
    const pe = c.si(c.pressure(it.n('gasPext'), it.v('gasPextU'), null), 'pressure');
    if (Number.isFinite(pe) && Math.abs(pe - c.patm) > 1e-6 * c.patm) note('ignored', 'surgeAirPext', obj);
    // the intermediate stage, switched by trigType: 0 a pressure difference over the outside pressure, in any unit of
    // pressure, the switch of Pump It by the difference; 1 the volumetric flow of the air expelled, at the outside pressure
    // and the temperature of the cavity, below which the program keeps that stage, while Pump It switches to it once the
    // mass flow expelled passes its limit: the limit trig·ρ_air, ρ_air = gasPext/(R·T), with a note
    if (avType === 'twoStage') {
      props.CdAout2 = cda('CdAmid', 'CdAmidU', true);
      const tt = it.n('trigType'), v = it.n('trig'), u = it.v('trigU'), fl = FLOW[key(u)];
      let sw = null;
      if (tt === 0) { const d = asDifference(v, u); if (d) sw = { switchBy: 'dP', switchDP: dpQ(d.Pa, d.unit) }; }
      else if (tt === 1 && fl && Number.isFinite(v)) {
        if (U.has('massFlow', fl[0])) sw = { switchBy: 'flow', switchFlow: q(round12(v * fl[1]), fl[0]) };
        else {
          const P = pe > 0 ? pe : c.patm, M = it.n('molWt') > 0 ? it.n('molWt') : AIR_M, rho = P / ((R_U / M) * Tc);
          if (rho > 0) sw = { switchBy: 'flow', switchFlow: q(round12(U.toSI(v * fl[1], fl[0], 'volFlow') * rho), 'kg/s') };
        }
        if (sw) note('assumed', 'surgeAirFlowSense', obj);
      }
      if (sw) Object.assign(props, sw); else note('missing', 'surgeAirSwitch', obj);
    }
    // the opening pressure: crackType 0 a piezometric head, 1 a pressure, absolute or gauge by its unit (another code: the
    // category of the unit)
    const Pc = it.n('crack'), cu = it.v('crackU'), ct = it.n('crackType');
    if (Number.isFinite(Pc) && key(cu) !== 'none' && key(cu) !== '') {
      const P = ct === 0 || (ct !== 1 && inTable(LENGTH, cu)) ? piezometric(c, Pc, cu) : inTable(PRESSURE, cu) ? c.pressure(Pc, cu, obj) : null;
      if (P) props.Popen = P; else c.unknownUnit(obj, cu);
    } else if (Number.isFinite(Pc) && Pc !== 0) c.unknownUnit(obj, cu);
    // a gas other than air (gasType 1), by its molar mass and its ratio of specific heats (with gasType 0 the file keeps
    // those of air; Pump It uses air, W-22)
    const mw = it.n('molWt'), k = it.n('gamma');
    if ((mw > 0 && Math.abs(mw - AIR_M) > 0.3) || (k > 0 && Math.abs(k - 1.4) > 0.01)) note('ignored', 'surgeAirGas', obj);
    const m0 = qOf(MASS, it.n('m0'), it.v('m0U'));
    if (m0 && m0.value > 0) props.mAir0 = m0;
    // a delay of its opening, in seconds
    if (it.n('delay') > 0) note('ignored', 'surgeAirDelay', obj);
    return c.make('airValve', props);
  }

  // ---------- force sets (section 15, I-33)

  // the force sets applied in the scenario: segments between two points (0, and 2 through several pipes), points (1) and
  // exits (3, and 4 through several pipes), at the ambient pressure of the file or one given per set; the unit vector and
  // the group are left out, with a note
  function forceSets(c) {
    const { S, chain, note } = c;
    const ctl = keysOf(S, chain, 'FORCE SET CONTROL'), data = keysOf(S, chain, 'FORCE SET DATA');
    const ap = String(ctl.forcesetsapplied || '').split(',').map(num);
    if (!(ap[0] > 0)) return [];
    const ids = ap.slice(1, 1 + ap[0]);
    const lu = LENGTH[key(data.forcesetlengthunits)];
    if (!lu) c.unknownUnit(null, data.forcesetlengthunits);
    const given = n0(data.forcesetambientpressureusage) === 1;
    const byId = new Map();
    let vector = false;
    for (const [k, v] of Object.entries(data)) {
      if (!/^forceset#\d+$/.test(k)) continue;
      const f = String(v).split(',').map((s) => s.trim()), id = num(f[0]);
      if (!ids.includes(id)) continue;
      const name = unesc(f[1]) || 'F' + id;
      const kind = { 0: 'segment', 1: 'point', 2: 'segment', 3: 'exit', 4: 'exit' }[num(f[2])];
      if (!kind) { note('ignored', 'surgeForceKind', null, { name, code: str(f[2]) || '?' }); continue; }
      const at = (i) => (lu && Number.isFinite(num(f[i])) ? q(round12(num(f[i]) * lu[1]), lu[0]) : q(null, 'm'));
      const set = Object.assign(PumpIt.surge.inputs.newForce(num(f[3]), name, null), { kind, a: { pipe: num(f[3]), x: at(4) }, b: { pipe: num(f[5]), x: at(6) } });
      if (given) Object.assign(set, { ambient: 'given', pamb: c.pressure(num(f[7]), data.forcesetambientpressureunits, null) });
      if (kind === 'exit' && num(f[9]) > 0) set.As = c.area(num(f[9]), data.forcesetexitareaunits, null);
      // the group and the unit vector (the last three fields), filled
      const g = str(f[8]);
      if ((g !== '' && !(num(g) <= 0)) || f.slice(-3).map(num).some((x) => Number.isFinite(x) && x !== 0)) vector = true;
      byId.set(id, set);
    }
    const out = ids.map((id) => byId.get(id)).filter(Boolean);
    if (vector) note('ignored', 'surgeForceVector', null);
    if (out.length) note('info', 'surgeForcesRead', null, { n: out.length });
    return out;
  }

  // ---------- after the network

  // the number of sections of each pipe with the time step of the file, against that of the file (section 9), and the
  // list of stations of a pipe Pump It sections otherwise; the wave speed of a pipe the import creates; the objects of the
  // events; the force sets
  function finish(c) {
    const sv = c.surge, { m, note } = c;
    if (!sv) return;
    if (sv.dt > 0) {
      const si = (x, cat) => U.toSI(x.value, x.unit, cat);
      const open = sv.pipes.filter((x) => !x.p.closed && x.n > 0 && x.p.surge.wave === 'given' && x.p.length && x.p.length.value > 0);
      const s = PumpIt.surge.sectioning.section(open.map((x) => ({ id: x.p.id, L: si(x.p.length, 'length'), a: si(x.p.surge.a, 'velocity') })), { mode: 'given', dt: sv.dt });
      s.pipes.forEach((r, i) => {
        const { p, n: N } = open[i];
        if (r.n === N) return;
        note('info', 'surgeSections', 'P' + r.id);
        // the stations of its list number the N sections of the file: at the same places of the n sections of Pump It,
        // round(k·n/N) (I-46)
        if (Array.isArray(p.surge.stations)) {
          p.surge.stations = [...new Set(p.surge.stations.map((k) => Math.floor((k * r.n) / N + 0.5)))].sort((x, y) => x - y);
          note('info', 'surgeStationScale', 'P' + r.id, { n: r.n, N });
        }
      });
    }
    // a pipe created for a pump on a single pipe (liquid.js), which has no record, takes the wave speed of the pipe of
    // the pump (I-50)
    for (const p of m.pipes) {
      if (sv.seen.has(p) || p.surge) continue;
      const pj = m.junctions.find((j) => j.type === 'pump' && (j.id === p.up || j.id === p.down));
      const other = pj && m.pipes.find((x) => x !== p && (x.up === pj.id || x.down === pj.id));
      if (other && other.surge && other.surge.a) { p.surge = { wave: 'given', a: Object.assign({}, other.surge.a) }; note('assumed', 'surgeCreatedPipe', 'P' + p.id); }
    }
    c.checkObjects(m, 'surge');
    if (m.solution.surge) m.solution.surge.forces = forceSets(c);
  }

  // the readers of the kinds of the protection devices, for the readers of the kinds of the format (imp.js)
  const types = { 21: reliefValve, 22: accumulator, 24: surgeTank, 25: airValve };

  PumpIt.importImpSurge = {
    VELOCITY, INERTIA, TORQUE, FORCE, STIFFNESS, ROT_STIFFNESS, ANGLE, MASS, ACCEL, SUPPORTS,
    modulus, anchorOf, cvTable, start, pipe, mergeSurgePipe, junction, finish, types,
  };
})(typeof window !== 'undefined' ? window : globalThis);
