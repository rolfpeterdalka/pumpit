// Import of .fth model files (src/core/import/fth.js). Usage: node tests/fth-import.test.cjs
//
// Every file of these checks is synthetic: this script writes it from the layout of the records described by the
// specification team (Annex A of the specification and the format description of 20 October 2026; for the time data of
// the junctions, Annexes A.2 and D of the specification of the time simulation, version 1.1 of 4 November 2026; decisions
// in docs/fth-import.md). No file of another program is read.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ROOT, loadCore } = require('./load-core');

const PumpIt = loadCore();
const M = PumpIt.model, S = PumpIt.solver, U = PumpIt.units, FTH = PumpIt.importers.fth;
const q = M.q;
const LBM = 0.45359237, FT = 0.3048, PSI = U.PSI, G0 = U.G0;

let passed = 0, failed = 0;
function ok(name, cond, detail = '') {
  if (cond) passed++; else failed++;
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
}
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const relDiff = (a, b, scale) => Math.abs(a - b) / (scale || Math.max(Math.abs(a), Math.abs(b), 1e-30));
const allNotes = [], allModels = []; // every note and model of every import, to check them at the end
function read(text, opts = {}) { const r = FTH.read(text, Object.assign({ name: 'synthetic.fth' }, opts)); allNotes.push(...r.notes); allModels.push(r.model); return r; }
const hasNote = (res, key, obj) => res.notes.some((n) => n.key === key && (!obj || n.objs.includes(obj)));
const J = (m, id) => m.junctions.find((j) => j.id === id);
const P = (m, id) => m.pipes.find((p) => p.id === id);
const run = (m) => S.run(M.effective(m, 'base'));

// ---------- writer of the format: records with the documented positions set

// pipe: ID, name, length unit, elevation unit, inlet elevation, number of segments and their pairs (length, elevation at
// the end), one field, number of drawing points and the points (x, y, z), then the block b
function pipe(o) {
  const segs = o.segs || (o.L != null ? [[o.L, o.z2 || 0]] : []);
  const pts = o.pts || [[0, 0, 0], [100, 0, 0]];
  const blk = new Array(64).fill('0');
  Object.assign(blk, { 0: 'None', 1: '-1', 3: o.from, 4: o.to, 5: o.D, 6: o.Du || 'cm', 8: 'None', 10: 'None', 11: 'None' });
  const [code, val, unit] = o.fric || ['0', 0.004572, 'cm'];
  Object.assign(blk, { 12: code, 13: val, 14: unit, 17: 'None', 18: 'None', 19: 'None', 20: o.K || 0, 21: '06 None', 22: o.df || 1, 23: 1, 26: 'None', 32: 'None', 34: 'None', 36: 'None', 38: o.special || 0, 39: o.specialBy || 'None', 40: 1 });
  if (o.nc) Object.assign(blk, { 7: o.nc[0], 8: 'meters2', 9: o.nc[1], 10: 'meters', 16: 2 });
  const head = [o.id, o.name || 'Pipe', segs.length ? o.Lu || 'meters' : 'None', o.zu || 'meters', o.z1 || 0, segs.length, ...segs.flat(), 0, pts.length, ...pts.flat()];
  return [...head, ...blk].join(',');
}
// junction: type, ID, two fields, name, number of pipes, signed list (− leaves, + arrives), common block b+0..b+45, its
// tables closed by the anchor −999 (at b+68), and the block of the type
const COMMON_TABLES = ['1', '-1', '3', '1', '%ALL%', '3', 'Percent', '1', '100', '2', '100', '3', '100', '0', '2', 'years', '-9999', '-9999', '4', '0', '5', '0', '-999'];
function junc(o) {
  const blk = new Array(46).fill('0');
  Object.assign(blk, { 0: o.x || 0, 1: o.y || 0, 2: -1, 4: 24, 5: -1, 7: o.z || 0, 9: o.zu || 'meters', 14: 'None', 15: o.df || 1, 18: 'None', 20: 'None', 22: 'None', 23: 'None', 24: o.spec == null ? -1 : o.spec, 25: o.spec === 1 ? 1 : 0, 26: '' });
  return [o.type, o.id, 1, 8, o.name || '', o.pipes.length, ...o.pipes, ...blk, ...COMMON_TABLES, ...o.t].join(',');
}
// blocks of the types
const tank = ({ conns = [[0, 0, 0]], P = 1, Pu = 'atm', level = 0, lu = 'meters', du = 'meters' }) =>
  [...conns.flatMap(([kOut, kIn, depth]) => [kOut, kIn, 0, 0, depth]), 0, du, P, Pu, 0, 'None', 0, 'None', 0, 0, 0, 0, 'NA', '', 0, 0, level, lu, 0, 0];
const press = ({ ks = [[0, 0]], stat = 0, P = 0, Pu = 'barG' }) => [...ks.flatMap(([a, b]) => [a, b, 0]), stat, P, Pu, 0, 'None', 0, 0, 0, 'None', 'None', 0, 0, 'None', 'meters', 0, 'NA'];
const flow = ({ q: Q, qu, out = true, K = 0 }) => [0, Q, qu, out ? 1 : 0, 0, 'None', K, 'None', 0, 'NA', 0, 0, 0];
const branch = ({ ks = [], np, q: Q = 0, qu = 'None' }) => [...Array.from({ length: np }, (_, i) => [ks[i] ? 1 : 0, ks[i] || 0, 0]).flat(), 0, Q, qu, 0, 0, 'None', 'None', 'meters', 0, 'NA'];
const bend = (K) => [3, 90, -1, K, 0, 'None', 0, 0, 'None', 'None', 2];
const areaChange = (K) => [2, 0, -1, K, 0, 'None', 0, 0, 'None', 0, 'NA'];
const tee = (model) => [0, 90, -1, model, 0, 'NA', 0, 0, 0, 0];
const valve = ({ model = 1, coef = [0, 0, 0, 0, 0], du = 'None', qu = 'None', qmax = -1, K = 0, P: Pout = 0, Pu = 'None' }) =>
  [0, model, 0, du, 0, qu, qmax, 1, coef.length, ...coef, 1, Pout, Pu, 0, 'None', 0, 'None', K, 0, 0, 'None', 0, 1, 0, 'None', 2];
const cvalve = (kind, set, unit) => [kind, 0, 1, set, unit, 0, 1, -2, 1, -1, 0, 'None', 2, 0, 'None', 'None', 'meters2'];
const orifice = (K) => [0, 1, 0, 'None', 0, 'None', -1, 1, 5, 0, 0, 0, 0, 0, 0, 'None', 1, 50, 'mm', -1, K, 0, 0];
const curveComp = ({ model = 3, coef, du, qu, qmax = 100 }) => [0, model, 1, du, 0, qu, qmax, 1, coef.length, ...coef, 0, 'None', 0, 0, 0, 'None', 'None', 2, 0, 'cm'];
const spray = ({ model, kf = 0, coef = [0, 0, 0, 0, 0], du = 'bar', qu = 'liter/min', qmax = -1, P: Pout = 0, Pu = 'barG' }) =>
  [0, 0, 0, model === 1 ? 1 : 0, model, 1, du, 0, qu, qmax, model === 1 ? -2 : 1, coef.length, ...coef, 0, 'None', model === 1 ? 1 : -1, kf, 1, Pout, Pu, 0, 'None', 'meters', 0, 0, 'NA'];
// pump: a head of 13 fields, the configurations, then the relative speed and the rest (control 10 fields after the
// speed, the condition of a single pipe further on)
const cfg = ({ name = '', qmax, H, N = [], E = [] }) => [name, -1, -1, 'None', qmax, 1, H.length, ...H, 'Table1', 1, N.length, ...N, 2, -9999, 1, E.length, ...E, 0, -1, 'None', 0, 'None', -1, -1, -1, -1, -1, -1, -1, 'None'];
function pumpT({ mode, q: Q = 0, qu = 'None', hu = 'meters', cu = 'm3/hr', configs = [], sel = 1, speed = 1, ctl = null, suction = null }) {
  const post = [speed, 0, -1, 0, 0, 'None', 0, 0, 'None', '', ...(ctl || [0, 0, 'None']), 0, 0, 1, 0, 0, 0, 'None'];
  while (post.length < 40) post.push(0);
  post.push(...(suction ? [1, -1, ...suction] : [0, 0, 0, 0, 'None']), 0, 0, -1);
  return [mode, 0, Q, qu, 0, 0, hu, 0, cu, 0, 'Percent', sel, configs.length, ...configs.flatMap(cfg), ...post];
}
// record of a child scenario: empty fields inherit; counted lists with −n keep the list of the parent
const COMPACT = ['', '', '', '0', '0', '', '0', '-2', '', '', '', '', '', '', '-0', '-999'];
function deltaJ({ type, id, pipes = null, nPar = 1, common = {}, t = [] }) {
  const blk = new Array(46).fill('');
  for (const [k, v] of Object.entries(common)) blk[k] = v;
  const list = pipes || new Array(nPar).fill('');
  return [type, id, '', '', '', pipes ? pipes.length : -nPar, ...list, ...blk, ...COMPACT, ...t].join(',');
}
const blanks = (n) => new Array(n).fill('');
// a whole file; header: its first line; plain: sections without the scenario suffix
function fth({ fluid = {}, fluidKeys = null, scen = [['Base Scenario', '']], secs, app = {}, upper = false, header = '', extra = [] }) {
  const L = [header || 'Synthetic file written by tests/fth-import.test.cjs', '[APPLICATION]', ...Object.entries(app).map(([k, v]) => `${k}= ${v}`)];
  const key = (k) => (upper ? k.toUpperCase() : k);
  L.push('[SCENARIO MANAGER]', `Number of Scenarios= ${scen.length}`);
  scen.forEach(([n, p, d = ''], i) => L.push(`Scenario #${i + 1}= ${n},${p},${d.length},${d},0,0,0,0`));
  const f = { name: 'Synthetic water', T: '20,deg. C', rho: '998.2,kg/m3', mu: '1.002,centipoise', pv: '2.339,kPa', amb: '1,atm', ...fluid };
  L.push('[SETTINGS]', 'AnalysisType=1', '[FLUID DATA]');
  if (fluidKeys) L.push(...fluidKeys);
  else {
    L.push(`${key('Number of Fluids')}= 1`, `${key('Fluid 1')}= ${f.name},0,${f.name},0`, `${key('Ambient Pressure')}= ${f.amb}`,
      `${key('Temperature')}= ${f.T}`, `${key('Density')}= ${f.rho}`, `${key('Viscosity')}= ${f.mu}`, `${key('Vapor Pressure')}= ${f.pv}`, `${key('Gravity')}= 1`,
      `${key('Properties')}= 0`, `${key('Viscosity Model')}= 0`, `${key('ReTransLam')}= 2300`, `${key('ReTransTurb')}= 4000`, `${key('AltLossFactorMethod')}= 0`);
  }
  L.push('[OUTPUT PREFERENCES]', 'Analysis Title= Synthetic test', '[QRS CONTROL]', 'VariablesApplied = 0,', ...extra);
  for (const [name, lines] of secs) L.push(`[${name}]`, ...lines);
  return L.join('\r\n') + '\r\n';
}
const BASE = (name) => `${name} -- SCENARIO #1 -- Base Scenario`;
// stored results in the US units of the format, from a calculation of Pump It
function archiveOf(r, rho, mu) {
  return Object.entries(r.pipes).map(([id, x]) => [id, x.m / LBM, 0, x.P0in / PSI, x.P0out / PSI, 527.67, 527.67, rho / (LBM / FT ** 3), mu / (LBM / FT), 0, 0].join(','));
}

console.log('\nFile, fluid and units');
{
  const f1 = fth({
    fluid: { name: 'Light\x15 oil', rho: '0.85,S.G. water', mu: '9.5,centipoise', pv: '-0.85,kg/cm2 (g)', amb: '0.9,atm', T: '40,deg. C' },
    secs: [
      [BASE('JUNCTIONS'), [junc({ type: 4, id: 1, pipes: [-1], t: press({ P: 2, Pu: 'kg/cm2 (g)' }) }), junc({ type: 4, id: 2, pipes: [1], t: press({ P: 5, Pu: 'm H2O std. (g)', stat: 1 }) })]],
      [BASE('PIPES'), [pipe({ id: 1, from: 1, to: 2, L: 10, D: 5 })]],
    ],
  });
  const r1 = read(f1, { name: 'Oil line.fth' });
  const m1 = r1.model, s1 = m1.system, fl = s1.fluid;
  const patm = 0.9 * 101325;
  ok('fluid of the file: its name (0x15 is a comma), S.G. water at 62.375 lbm/ft³, centipoise', fl.kind === 'user' && fl.name === 'Light, oil'
    && fl.rho.unit === 'kg/m³' && near(fl.rho.value, 0.85 * 62.375 * LBM / FT ** 3, 1e-12) && fl.mu.unit === 'cP' && fl.mu.value === 9.5, JSON.stringify(fl));
  ok('the ambient pressure of the file is the atmospheric pressure, the reference of the gauge units', s1.patm.unit === 'atm' && s1.patm.value === 0.9
    && J(m1, 1).P.unit === 'kgf/cm²(g)' && J(m1, 1).P.value === 2 && near(U.toSI(2, 'kgf/cm²(g)', 'pressure', { patm }), patm + 2 * 98066.5, 1e-12));
  ok('a negative gauge vapour pressure becomes absolute', fl.pv.unit === 'kPa(a)' && near(fl.pv.value * 1e3, patm - 0.85 * 98066.5, 1e-9), JSON.stringify(fl.pv));
  ok('water column (1000 kg/m³ × g0) and a static pressure on one pipe', J(m1, 2).P.unit === 'mca(g)' && J(m1, 2).P.value === 5 && J(m1, 2).ptype === 'static'
    && near(U.toSI(5, 'mca(g)', 'pressure', { patm }) - patm, 5 * 1000 * G0, 1e-12));
  ok('transition Reynolds numbers, gravity, laminar correction code 0', s1.reLam === 2300 && s1.reTurb === 4000 && s1.gravity === 1 && s1.laminarK === 'none');
  ok('title from the file name; notes on the fluid read and its temperature', m1.title === 'Oil line' && hasNote(r1, 'fluidKeys') && hasNote(r1, 'fluidTemperature')
    && r1.notes.find((n) => n.key === 'fluidTemperature').params.T === '40 °C');
  const up = read(fth({ upper: true, fluid: { rho: '998,2,kg/m3' }, secs: [[BASE('JUNCTIONS'), [junc({ type: 4, id: 1, pipes: [-1], t: press({ P: 1 }) }), junc({ type: 4, id: 2, pipes: [1], t: press({ P: 0 }) })]], [BASE('PIPES'), [pipe({ id: 1, from: 1, to: 2, L: 10, D: 5 })]]] }));
  ok('keys in capitals and a value with a decimal comma', up.model.system.fluid.rho.value === 998.2 && up.model.system.fluid.name === 'Synthetic water');
  let thrown = '';
  try { FTH.read('XYZ OTHER VERSION 9 INPUT FILE\r\n' + f1.split('\r\n').slice(1).join('\r\n')); } catch (e) { thrown = e.message; }
  ok('a model of another program of the family, by its first line, is refused', thrown === PumpIt.i18n.t('core.fth.otherProgram'), thrown);
  const hd = FTH.parse.header('ABC SOMETHING VERSION 12 INPUT FILE\r\n[X]');
  ok('the version is read from the first line', hd && hd.version === 12 && FTH.parse.header('no header') === null);
  thrown = '';
  try { FTH.read('[SOMETHING]\r\nkey= 1\r\n'); } catch (e) { thrown = e.message; }
  ok('a file without sections of pipes or junctions is not a model', thrown === PumpIt.i18n.t('core.fth.notFth'));
}

console.log('\nPipes');
{
  const f2 = fth({
    secs: [
      [BASE('JUNCTIONS'), [
        junc({ type: 2, id: 1, pipes: [-1], z: 30, t: tank({ level: 30, P: 0, Pu: 'barG' }) }),
        junc({ type: 1, id: 2, pipes: [1, -2, -3, -4, -5, -6, -7, -8], z: 2, t: branch({ np: 8 }) }),
        ...[3, 4, 5, 6, 7, 8, 9].map((id) => junc({ type: 4, id, pipes: [id - 1], z: 2, t: press({ P: 0 }) })),
      ]],
      [BASE('PIPES'), [
        pipe({ id: 1, from: 1, to: 2, z1: 30, segs: [[10, 20], [5.5, 2], [100, 2]], D: 10.22604 }),
        pipe({ id: 2, from: 2, to: 3, L: 50, Lu: 'feet', D: 3.068, Du: 'inches', fric: ['1', 0.0002, 'None'], z1: 2, z2: 2 }),
        pipe({ id: 3, from: 2, to: 4, L: 20, D: 5, fric: ['3', 120, 'None'], z1: 2, z2: 2 }),
        pipe({ id: 4, from: 2, to: 5, L: 20, D: 5, fric: ['4', 0.025, 'None'], df: 1.1, z1: 2, z2: 2 }),
        pipe({ id: 5, from: 2, to: 6, D: 5, fric: ['7', 0, 'None'], z1: 2, z2: 2 }),
        pipe({ id: 6, from: 2, to: 7, L: 3, D: 20, nc: [0.04, 0.8], fric: ['2', 0, 'None'], special: 1, specialBy: 'P6', z1: 2, z2: 2 }),
        pipe({ id: 7, from: 2, to: 8, L: 3, D: 5, special: 3, specialBy: 'J8', z1: 2, z2: 2 }),
        pipe({ id: 8, from: 2, to: 9, D: 5, z1: 2, z2: 2 }),
      ]],
    ],
  });
  const r2 = read(f2), m2 = r2.model;
  ok('a pipe of 3 segments: their lengths summed, the roughness of the file', P(m2, 1).length.value === 115.5 && P(m2, 1).length.unit === 'm'
    && P(m2, 1).friction.model === 'roughness' && P(m2, 1).friction.eps.value === 0.004572 && P(m2, 1).friction.eps.unit === 'cm' && P(m2, 1).geometry.d.value === 10.22604);
  ok('the outlet elevation is that of the last segment (no note of other elevations at the branch)', !hasNote(r2, 'elevations', 'J2'));
  ok('feet, inches and relative roughness', P(m2, 2).length.unit === 'ft' && P(m2, 2).length.value === 50 && P(m2, 2).geometry.d.unit === 'in' && P(m2, 2).friction.model === 'relRoughness' && P(m2, 2).friction.rel === 0.0002);
  ok('Hazen-Williams, given f and its design factor (not applied, with a note)', P(m2, 3).friction.model === 'hw' && P(m2, 3).friction.C === 120
    && P(m2, 4).friction.model === 'explicitF' && P(m2, 4).friction.f === 0.025 && hasNote(r2, 'designFactor', 'P4'));
  ok('frictionless and without a length: 1 mm', P(m2, 5).friction.model === 'frictionless' && P(m2, 5).length.value === 1 && P(m2, 5).length.unit === 'mm' && !hasNote(r2, 'noLength', 'P5'));
  ok('non-circular section by area and perimeter; closed by the user', P(m2, 6).geometry.kind === 'noncircular' && P(m2, 6).geometry.area.value === 0.04
    && P(m2, 6).geometry.perim.value === 0.8 && P(m2, 6).friction.model === 'smooth' && P(m2, 6).closed === true && hasNote(r2, 'closed', 'P6'));
  ok('stopped by a closed junction (a state saved by the program): closed, with its note', P(m2, 7).closed === true && hasNote(r2, 'computedClosed', 'P7') && !hasNote(r2, 'closed', 'P7'));
  ok('a pipe with friction and no length is left for the user', P(m2, 8).length.value === null && hasNote(r2, 'noLength', 'P8'));
  ok('the pressure junctions of closed pipes need nothing, and no unit notes', !hasNote(r2, 'unit') && !hasNote(r2, 'notGiven'), r2.notes.map((n) => n.key).join(' '));
}

console.log('\nReservoirs, imposed pressures and flows, branches');
{
  const f3 = fth({
    secs: [
      [BASE('JUNCTIONS'), [
        junc({ type: 2, id: 1, pipes: [-1], z: 12, t: tank({ conns: [[0.5, 1, 2]], P: 1.5, Pu: 'barG', level: 12 }) }),
        junc({ type: 2, id: 2, pipes: [2, -3], z: 8, t: tank({ conns: [[0, 1, 3], [0.5, 1, 0]], P: 0, Pu: 'barG', level: 8 }) }),
        junc({ type: 1, id: 3, pipes: [1, -2, -4], t: branch({ np: 3, ks: [0, 0.8, 0], q: -2, qu: 'liter/sec' }) }),
        junc({ type: 3, id: 4, pipes: [4], t: flow({ q: 7200, qu: 'kg/hr', out: true }) }),
        junc({ type: 2, id: 5, pipes: [5], z: 4, t: tank({ conns: [[0, 1, -1.5]], P: 1, Pu: 'atm', level: 4 }) }),
        junc({ type: 4, id: 6, pipes: [-5, -6], t: press({ ks: [[1, 0], [0.5, 0]], P: 3, Pu: 'barG' }) }),
        junc({ type: 4, id: 7, pipes: [6, -7], t: press({ ks: [[0, 0], [0, 0]], stat: 1, P: 0 }) }),
        junc({ type: 3, id: 8, pipes: [7], t: flow({ q: -3, qu: 'm3/hr', out: true, K: 2 }) }),
        junc({ type: 2, id: 9, pipes: [3], z: 8, t: tank({ level: 'x', lu: 'None' }) }),
      ]],
      [BASE('PIPES'), [
        pipe({ id: 1, from: 1, to: 3, z1: 10, L: 20, D: 10 }), pipe({ id: 2, from: 3, to: 2, L: 20, D: 10, z2: 5 }), pipe({ id: 3, from: 2, to: 9, z1: 8, z2: 8, L: 20, D: 10 }),
        pipe({ id: 4, from: 3, to: 4, L: 5, D: 10 }), pipe({ id: 5, from: 6, to: 5, L: 5, D: 10, z2: 5.5 }), pipe({ id: 6, from: 6, to: 7, L: 5, D: 10 }),
        pipe({ id: 7, from: 7, to: 8, L: 5, D: 10 }),
      ]],
    ],
  });
  const r3 = read(f3), m3 = r3.model;
  const j1 = J(m3, 1), j2 = J(m3, 2);
  const depth = (j, pid) => j.pipeK[pid].depth && j.pipeK[pid].depth.unit === 'm' && j.pipeK[pid].elev === undefined ? j.pipeK[pid].depth.value : NaN;
  ok('reservoir: liquid surface, surface pressure, entrance and exit K, the depth of its pipe below the surface', j1.type === 'reservoir' && j1.liquidElev.value === 12
    && j1.surfP.value === 1.5 && j1.surfP.unit === 'bar(g)' && j1.pipeK[1].kOut === 0.5 && j1.pipeK[1].kIn === 1 && j1.connBy === 'depth' && depth(j1, 1) === 2, JSON.stringify(j1));
  ok('the bottom of the reservoir is its lowest connection, not the elevation of the junction', j1.elevation.value === 10 && j2.elevation.value === 5, `${j1.elevation.value} ${j2.elevation.value}`);
  ok('reservoir with two pipes at their own depths and losses: one reservoir, a row per pipe', j2.type === 'reservoir' && m3.junctions.filter((j) => j.type === 'reservoir').length === 4
    && j2.pipeK[2].kIn === 1 && j2.pipeK[2].kOut === 0 && depth(j2, 2) === 3 && j2.pipeK[3].kOut === 0.5 && depth(j2, 3) === 0, JSON.stringify(j2.pipeK));
  ok('a pipe above the liquid surface: a negative depth, the bottom at the surface (it discharges at the surface pressure)', depth(J(m3, 5), 5) === -1.5
    && J(m3, 5).liquidElev.value === 4 && J(m3, 5).elevation.value === 4 && J(m3, 5).surfP.unit === 'atm' && hasNote(r3, 'aboveSurface', 'P5'));
  ok('a level without its unit: the elevation of the junction, with a note', J(m3, 9).liquidElev.value === 8 && depth(J(m3, 9), 3) === 0 && hasNote(r3, 'reservoirLevel', 'J9'));
  ok('every reservoir with pipes says how its connections came in; the depths of the file agree with the ends', ['J1', 'J2', 'J5', 'J9'].every((o) => hasNote(r3, 'connDepth', o))
    && !r3.notes.some((n) => n.key === 'depthDiffers'));
  ok('branch: source −2 L/s (it leaves) and the K of the connection in both directions', J(m3, 3).type === 'branch' && J(m3, 3).source.value === -2 && J(m3, 3).source.unit === 'L/s'
    && J(m3, 3).pipeK[2].kOut === 0.8 && J(m3, 3).pipeK[2].kIn === 0.8 && Object.keys(J(m3, 3).pipeK).length === 1);
  ok('imposed flow in mass units, kept as such', J(m3, 4).type === 'flow' && J(m3, 4).dir === 'out' && J(m3, 4).Q.value === 7200 && J(m3, 4).Q.unit === 'kg/h');
  ok('a negative imposed flow turns around; the K of its connection', J(m3, 8).Q.value === 3 && J(m3, 8).dir === 'in' && J(m3, 8).pipeK[7].kOut === 2);
  ok('imposed pressure with two pipes: K of each pipe, a single junction', J(m3, 6).type === 'pressure' && J(m3, 6).ptype === 'stagnation' && J(m3, 6).P.value === 3
    && J(m3, 6).pipeK[5].kOut === 1 && J(m3, 6).pipeK[6].kOut === 0.5 && J(m3, 6).pipeK[5].kIn === 0);
  ok('a static pressure with two pipes becomes a stagnation pressure', J(m3, 7).ptype === 'stagnation' && hasNote(r3, 'staticManyPipes', 'J7'));
  // depths in feet; then a depth of the file (2.5 m) that the end of its pipe (2 m under the surface) contradicts
  const two = (t1, z1, zu) => fth({ secs: [[BASE('JUNCTIONS'), [junc({ type: 2, id: 1, pipes: [-1], t: t1 }), junc({ type: 2, id: 2, pipes: [1], t: tank({ level: 0 }) })]],
    [BASE('PIPES'), [pipe({ id: 1, from: 1, to: 2, L: 100, D: 10, z1, zu })]]] });
  const rf = read(two(tank({ conns: [[0, 0, 10]], level: 40, lu: 'feet', du: 'feet' }), 30, 'feet'));
  const pf = J(rf.model, 1).pipeK[1].depth;
  ok('a level and depths in feet: the depth in feet, the bottom at the connection', pf.value === 10 && pf.unit === 'ft' && J(rf.model, 1).elevation.value === 30
    && J(rf.model, 1).elevation.unit === 'ft' && !rf.notes.some((n) => n.key === 'depthDiffers'), JSON.stringify(J(rf.model, 1)));
  const rd = read(two(tank({ conns: [[0, 0, 2.5]], level: 12 }), 10));
  const nd = rd.notes.find((n) => n.key === 'depthDiffers');
  ok('a depth of the file that the end of the pipe contradicts: the end of the pipe, with a note', J(rd.model, 1).pipeK[1].depth.value === 2 && nd && nd.objs.join() === 'P1'
    && near(nd.params.file, 2.5, 1e-12) && near(nd.params.ends, 2, 1e-12) && nd.level === 'assumed', JSON.stringify(nd));
  // the elevation of the reservoir junction left undefined by the file
  const undef = (t1) => read(fth({ secs: [[BASE('JUNCTIONS'), [junc({ type: 2, id: 1, pipes: [-1], zu: 'None', t: t1 }), junc({ type: 2, id: 2, pipes: [1], t: tank({ level: 0 }) })]],
    [BASE('PIPES'), [pipe({ id: 1, from: 1, to: 2, L: 100, D: 10, z1: 10 })]]] }));
  const keys = (r) => r.notes.map((n) => n.key + ':' + n.objs).join(' ');
  const ru = undef(tank({ conns: [[0, 0, 2]], level: 12 }));
  ok('a reservoir without its own elevation: the level and the pipe give all it needs, and nothing asks to fill it in', J(ru.model, 1).elevation.value === 10
    && J(ru.model, 1).liquidElev.value === 12 && J(ru.model, 1).pipeK[1].depth.value === 2 && !hasNote(ru, 'notGiven') && !hasNote(ru, 'unit') && !hasNote(ru, 'reservoirLevel'), keys(ru));
  const rn = undef(tank({ conns: [[0, 0, 2]], level: 'x', lu: 'None' }));
  ok('without a level either: the level and the bottom blank for the user, with one note', J(rn.model, 1).liquidElev.value === null && J(rn.model, 1).elevation.value === null
    && J(rn.model, 1).pipeK[1].elev.value === 10 && hasNote(rn, 'notGiven', 'J1') && !hasNote(rn, 'reservoirLevel'), keys(rn));
}

console.log('\nValves, fittings and nozzles');
const A5 = Math.PI * 0.05 ** 2 / 4, RHO = 998.2;
{
  const f4 = fth({
    secs: [
      [BASE('JUNCTIONS'), [
        junc({ type: 2, id: 1, pipes: [-1], t: tank({ level: 20 }) }),
        junc({ type: 8, id: 2, pipes: [1, -2], spec: 0, t: valve({ K: 2.5 }) }),
        junc({ type: 8, id: 3, pipes: [2, -3], spec: 1, t: valve({ model: 0, K: 120 }) }),
        junc({ type: 8, id: 4, pipes: [3, -4], spec: 0, t: valve({ model: 3, coef: [0, 0, 0.002], du: 'kPa', qu: 'm3/hr' }) }),
        junc({ type: 6, id: 5, pipes: [4, -5], t: bend(0.75) }),
        junc({ type: 5, id: 6, pipes: [5, -6], t: areaChange(0.4) }),
        junc({ type: 12, id: 7, pipes: [6, -7], t: orifice(3.3) }),
        junc({ type: 20, id: 8, pipes: [7, -8], t: curveComp({ coef: [0, 0, 0.5], du: 'bar', qu: 'liter/sec' }) }),
        junc({ type: 7, id: 9, pipes: [8, -9, -10, -14], t: tee(2) }),
        junc({ type: 8, id: 10, pipes: [9], spec: 0, t: valve({ K: 1.2, P: 0.5, Pu: 'barG' }) }),
        junc({ type: 16, id: 11, pipes: [10], spec: 0, t: spray({ model: 1, kf: 80, P: 0, Pu: 'barG' }) }),
        junc({ type: 16, id: 12, pipes: [11], spec: 1, t: spray({ model: 1, kf: 80 }) }),
        junc({ type: 1, id: 13, pipes: [-11], t: branch({ np: 1 }) }),
        junc({ type: 8, id: 14, pipes: [14, -12], spec: 0, t: valve({ model: 3, coef: [0, 0.01, 0.002], du: 'kPa', qu: 'm3/hr', qmax: 60 }) }),
        junc({ type: 20, id: 15, pipes: [12, -13], t: curveComp({ coef: [1, 0, 0.5], du: 'bar', qu: 'liter/sec', qmax: 10 }) }),
        junc({ type: 15, id: 16, pipes: [13, -15], t: curveComp({ model: 1, coef: [0, 0, 0], du: 'bar', qu: 'liter/sec' }) }),
        junc({ type: 4, id: 17, pipes: [15], t: press({ P: 0 }) }),
      ]],
      [BASE('PIPES'), Array.from({ length: 15 }, (_, i) => pipe({ id: i + 1, from: [1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 13, 14, 15, 9, 16][i], to: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 16, 14, 17][i], L: 5, D: 5 }))],
    ],
  });
  const r4 = read(f4), m4 = r4.model;
  ok('valve by K (model 1): the K after the list of coefficients', J(m4, 2).type === 'valve' && J(m4, 2).lossModel === 'K' && J(m4, 2).K === 2.5 && J(m4, 2).closed === false);
  ok('valve by Cv (model 0), closed in the file', J(m4, 3).lossModel === 'Cv' && J(m4, 3).Cv === 120 && J(m4, 3).closed === true && hasNote(r4, 'closed', 'J3'));
  ok('square-law curve ΔP = 0.002·Q² (kPa, m³/h): an exact K at the area of the pipe', J(m4, 4).type === 'valve' && near(J(m4, 4).K, 2 * (0.002 * 1000 * 3600 ** 2) * A5 ** 2 / RHO, 1e-12), `${J(m4, 4).K}`);
  ok('bend and area change: their K', J(m4, 5).type === 'generic' && J(m4, 5).K === 0.75 && J(m4, 6).type === 'generic' && J(m4, 6).K === 0.4);
  ok('orifice: its K and diameter', J(m4, 7).type === 'orifice' && J(m4, 7).orModel === 'K' && J(m4, 7).K === 3.3 && J(m4, 7).dO.value === 50 && J(m4, 7).dO.unit === 'mm');
  ok('generic component with a square-law curve (bar, L/s): an exact K', J(m4, 8).type === 'generic' && J(m4, 8).genModel === 'K' && near(J(m4, 8).K, 2 * (0.5 * 1e5 / 1e-6) * A5 ** 2 / RHO, 1e-12));
  ok('a simple tee is a node, without notes', J(m4, 9).type === 'branch' && !r4.notes.some((n) => n.objs.includes('J9')));
  ok('exit valve: the outlet pressure and the K of the valve', J(m4, 10).type === 'exitvalve' && J(m4, 10).Pout.value === 0.5 && J(m4, 10).Pout.unit === 'bar(g)' && J(m4, 10).K === 1.2);
  const kf = J(m4, 11).Kf;
  ok('nozzle by its K factor: referred to water at 1000 kg/m³, with a note', J(m4, 11).type === 'spray' && J(m4, 11).sprayModel === 'K' && kf.unit === 'L/min/bar½'
    && near(kf.value, 80 * Math.sqrt(RHO / 1000), 1e-12) && J(m4, 11).Pext.unit === 'bar(g)' && hasNote(r4, 'sprayDensity', 'J11'), JSON.stringify(kf));
  ok('a closed nozzle is a closed end; a branch with one pipe, an imposed flow of zero', J(m4, 12).type === 'flow' && J(m4, 12).Q.value === 0 && hasNote(r4, 'closedEnd', 'J12')
    && J(m4, 13).type === 'flow' && J(m4, 13).Q.value === 0);
  const c14 = J(m4, 14).curve;
  ok('a valve with a curve that is not a square law: a generic component with that curve', J(m4, 14).type === 'generic' && J(m4, 14).genModel === 'curve' && c14.fit === '2'
    && c14.xUnit === 'm³/h' && c14.yUnit === 'kPa' && near(c14.x[10], 60) && near(c14.y[10], 0.01 * 60 + 0.002 * 3600) && hasNote(r4, 'curveGeneric', 'J14'));
  ok('a curve with a constant term and no stored results: the K at half of its largest flow, with a note', J(m4, 15).type === 'generic' && J(m4, 15).genModel === 'K'
    && near(J(m4, 15).K, 2 * (1 + 0.5 * 25) * 1e5 * A5 ** 2 / (RHO * (5e-3) ** 2), 1e-9) && hasNote(r4, 'curveHalf', 'J15'), `${J(m4, 15).K}`);
  ok('a heat exchanger with a loss model that is not known: K = 0, with notes', J(m4, 16).type === 'generic' && J(m4, 16).K === 0 && hasNote(r4, 'lossModel', 'J16') && hasNote(r4, 'heatExchanger', 'J16'));
  // the nozzle in a calculation: ΔP = (Q/K)² in L/min and bar, whatever the density of the fluid
  const fs1 = fth({ secs: [
    [BASE('JUNCTIONS'), [junc({ type: 4, id: 1, pipes: [-1], t: press({ P: 3, Pu: 'barG' }) }), junc({ type: 16, id: 2, pipes: [1], t: spray({ model: 1, kf: 80, P: 0, Pu: 'barG' }) })]],
    [BASE('PIPES'), [pipe({ id: 1, from: 1, to: 2, L: 20, D: 5 })]]] });
  const rs = run(read(fs1).model);
  const Qmin = rs.ok ? rs.junctions[2].Q * 60000 : NaN, dPbar = rs.ok ? rs.junctions[2].dP / 1e5 : NaN;
  ok('the nozzle discharges by ΔP = (Q/K)² of the file', rs.ok && near(dPbar, (Qmin / 80) ** 2, 1e-7), `Q ${Qmin.toFixed(3)} L/min, ΔP ${dPbar.toFixed(5)} bar`);
}

console.log('\nPumps');
{
  const pumpFile = (j2, { suction = true, archive = null } = {}) => fth({
    secs: [
      [BASE('JUNCTIONS'), [junc({ type: 2, id: 1, pipes: [-1], t: tank({ level: 0 }) }), junc({ type: 17, id: 2, ...j2 }), junc({ type: 2, id: 3, pipes: [2], t: tank({ level: 30 }) })]],
      [BASE('PIPES'), [...(suction ? [pipe({ id: 1, from: 1, to: 2, L: 5, D: 15 })] : []), pipe({ id: 2, from: 2, to: 3, L: 200, D: 15 })]],
      ...(archive ? [[BASE('PIPE ARCHIVE DATA'), archive]] : []),
    ],
  });
  const curveA = { name: 'Impeller A', qmax: 300, H: [50, 0.01, -0.0004] }, curveB = { name: 'Impeller B', qmax: 300, H: [60, 0, -0.0005], N: [1, 0.01, 0.0001], E: [10, 0.8, -0.002] };
  const r5a = read(pumpFile({ pipes: [1, -2], t: pumpT({ mode: 0, configs: [curveA, curveB], sel: 2, speed: 0.95 }) }));
  const pa = J(r5a.model, 2), c = pa.curve;
  ok('curve of the configuration in use (2 of 2): 11 points from zero to its largest flow, its degree', pa.type === 'pump' && pa.mode === 'curve' && c.x.length === 11 && c.fit === '2'
    && c.xUnit === 'm³/h' && c.yUnit === 'm' && c.y[0] === 60 && near(c.x[10], 300) && near(c.y[10], 60 - 0.0005 * 300 ** 2) && hasNote(r5a, 'pumpConfig', 'J2'), JSON.stringify(c.y.slice(0, 3)));
  ok('the relative speed after the configurations (0.95 → 95 %)', pa.speed === 95 && pa.state === 'on' && pa.nPumps === 1);
  ok('efficiency (%) and NPSHR curves of the configuration', pa.eff.x.length === 11 && near(pa.eff.y[5], 10 + 0.8 * 150 - 0.002 * 150 ** 2) && pa.npshr.yUnit === 'm'
    && near(pa.npshr.y[10], 1 + 0.01 * 300 + 0.0001 * 300 ** 2) && hasNote(r5a, 'npshr', 'J2'));
  const r5b = read(pumpFile({ pipes: [1, -2], t: pumpT({ mode: 1, q: 450, qu: 'gal/min' }) }));
  ok('fixed flow (mode 1) in gal/min', J(r5b.model, 2).mode === 'fixedFlow' && J(r5b.model, 2).fixedFlow.value === 450 && J(r5b.model, 2).fixedFlow.unit === 'gpm' && !hasNote(r5b, 'pumpCurve'));
  const r5c = read(pumpFile({ pipes: [1, -2], spec: 1, t: pumpT({ mode: 0, configs: [curveA], ctl: [1, 120, 'm3/hr'] }) }));
  ok('flow control by speed; closed in the file, the pump is off', J(r5c.model, 2).mode === 'controlFlow' && J(r5c.model, 2).setQ.value === 120 && J(r5c.model, 2).state === 'offClosed' && hasNote(r5c, 'closed', 'J2'));
  const r5d = read(pumpFile({ pipes: [-2], t: pumpT({ mode: 1, q: 30, qu: 'm3/hr' }) }, { suction: false }));
  ok('a fixed-flow pump on a single pipe is an imposed flow into the network', J(r5d.model, 2).type === 'flow' && J(r5d.model, 2).dir === 'in' && J(r5d.model, 2).Q.value === 30 && hasNote(r5d, 'pumpOnePipeFlow', 'J2'));
  const r5e = read(pumpFile({ pipes: [-2], z: 1, t: pumpT({ mode: 0, configs: [curveA], suction: [1, 0.5, 'barG'] }) }, { suction: false }));
  const m5e = r5e.model, suc = J(m5e, 4), vp = P(m5e, 3);
  ok('a curve pump on a single pipe: its suction as an imposed pressure, through a frictionless pipe of 1 mm', suc && suc.type === 'pressure' && suc.P.value === 0.5 && suc.P.unit === 'bar(g)'
    && suc.elevation.value === 1 && vp && vp.up === 4 && vp.down === 2 && vp.friction.model === 'frictionless' && vp.length.value === 1 && J(m5e, 2).mode === 'curve' && hasNote(r5e, 'pumpSuction', 'J2'),
  JSON.stringify([suc && suc.name, vp && vp.name]));
  ok('the created junction stands beside the pump', suc.x === J(m5e, 2).x - 80 && suc.y === J(m5e, 2).y);
  const r5r = run(m5e);
  ok('that model calculates', r5r.ok && r5r.converged, r5r.ok ? `${(r5r.pipes[2].Q * 3600).toFixed(2)} m³/h` : (r5r.errors || []).join('; '));
  const r5f = read(pumpFile({ pipes: [1, -2], t: pumpT({ mode: 2, configs: [] }) }));
  ok('a pump mode that is not known and no curve: the flow is left for the user', J(r5f.model, 2).mode === 'fixedFlow' && J(r5f.model, 2).fixedFlow.value === null && hasNote(r5f, 'pumpModeBlank', 'J2'));
}

console.log('\nScenarios');
{
  const curveA = { name: 'Impeller A', qmax: 300, H: [50, 0.01, -0.0004] };
  // #2 (child): the reservoir goes from 1 to 2 pipes, the pump from a fixed flow to a curve, the valve from K to a curve
  // of 3 coefficients; pipe 4 and junction 4 are deleted, pipe 6 is new; the fluid is heavier. #3 (grandchild): only the
  // speed of the pump, its configurations kept (−1)
  const f6 = fth({
    scen: [['Base Scenario', ''], ['Curve', 'Base Scenario', 'Line 1\x16Line 2, with a comma'], ['Slow', 'Base Scenario/Curve']],
    secs: [
      [BASE('JUNCTIONS'), [
        junc({ type: 2, id: 1, pipes: [-1], t: tank({ conns: [[0.5, 1, 2]], level: 10, P: 0.2, Pu: 'barG' }) }),
        junc({ type: 17, id: 2, pipes: [1, -2], t: pumpT({ mode: 1, q: 100, qu: 'm3/hr' }) }),
        junc({ type: 8, id: 3, pipes: [2, -3], t: valve({ K: 5 }) }),
        junc({ type: 11, id: 4, pipes: [4], t: [] }),
        junc({ type: 4, id: 5, pipes: [5], t: press({ P: 0 }) }),
        junc({ type: 1, id: 6, pipes: [3, -4, -5], t: branch({ np: 3 }) }),
      ]],
      [BASE('PIPES'), [pipe({ id: 1, from: 1, to: 2, L: 10, D: 15, z1: 8 }), pipe({ id: 2, from: 2, to: 3, L: 10, D: 15 }), pipe({ id: 3, from: 3, to: 6, L: 10, D: 15 }), pipe({ id: 4, from: 6, to: 4, L: 10, D: 15 }), pipe({ id: 5, from: 6, to: 5, L: 10, D: 15 })]],
      ['JUNCTIONS -- SCENARIO #2 -- Curve', ['NumberOfJunctions= 4', 'DELETED,11,4,Dead End',
        deltaJ({ type: 2, id: 1, pipes: [-1, -6], t: [0.5, 1, '', '', 2, 0, 1, '', '', 4] }),
        deltaJ({ type: 17, id: 2, nPar: 2, t: [0, ...blanks(11), 1, ...cfg(curveA), 1.0, ...blanks(30)] }),
        deltaJ({ type: 8, id: 3, nPar: 2, t: ['', 3, '', 'kPa', '', 'm3/hr', '', '', 3, 0, 0, 0.002, ...blanks(12)] })]],
      ['PIPES -- SCENARIO #2 -- Curve', ['NumberOfPipes= 2', 'DELETED,4,Pipe', pipe({ id: 6, from: 1, to: 6, L: 30, D: 10, z1: 6 })]],
      ['FLUID DATA -- SCENARIO #2 -- Curve', ['Density= 1000,kg/m3']],
      ['JUNCTIONS -- SCENARIO #3 -- Slow', ['NumberOfJunctions= 1', deltaJ({ type: 17, id: 2, nPar: 2, t: [...blanks(12), -1, ...blanks(6), -3, '', '', '', '', '', '-0', '', '', '', '-0', ...blanks(13), 0.9] })]],
    ],
  });
  const list = FTH.scenarios(f6);
  ok('list of scenarios: path and description read by its length', list.length === 3 && list[2].path === 'Base Scenario/Curve/Slow' && list[1].description === 'Line 1\nLine 2, with a comma'
    && list.every((s) => s.results === false), JSON.stringify(list[1]));
  const r6 = read(f6, { name: 'Plant.fth', scenario: 2 }), m6 = r6.model;
  const j1 = J(m6, 1);
  ok('the reservoir gains a pipe: its fields per pipe realigned, surface and pressure inherited', j1.pipeK[1].kOut === 0.5 && j1.pipeK[6].kOut === 0 && j1.pipeK[6].kIn === 1
    && j1.pipeK[1].depth.value === 2 && j1.pipeK[6].depth.value === 4 && j1.elevation.value === 6 && j1.liquidElev.value === 10 && j1.surfP.value === 0.2
    && !r6.notes.some((n) => n.key === 'depthDiffers'), JSON.stringify(j1.pipeK));
  ok('the pump: a new list of configurations (fixed flow → curve)', J(m6, 2).mode === 'curve' && J(m6, 2).curve.y[0] === 50 && J(m6, 2).speed === 100);
  ok('the valve: 3 coefficients instead of 5, and the fields after them realigned', near(J(m6, 3).K, 2 * (0.002 * 1000 * 3600 ** 2) * (Math.PI * 0.15 ** 2 / 4) ** 2 / 1000, 1e-12), `${J(m6, 3).K}`);
  ok('deleted pipe and junction; the new pipe comes in whole', !P(m6, 4) && !J(m6, 4) && P(m6, 6).length.value === 30 && P(m6, 6).geometry.d.value === 10 && P(m6, 6).down === 6);
  ok('the fluid of the scenario; title and scenario name', m6.system.fluid.rho.value === 1000 && m6.title === 'Plant (Curve)' && m6.scenarios.list[0].name === 'Curve'
    && r6.counts.scenario === 'Curve' && hasNote(r6, 'scenario') && r6.notes.find((n) => n.key === 'scenario').params.count === 3);
  const m6c = read(f6, { scenario: 'Slow' }).model;
  ok('grandchild: configurations inherited (−1), its own speed (0.9 → 90 %)', J(m6c, 2).mode === 'curve' && J(m6c, 2).speed === 90 && J(m6c, 2).curve.y[0] === 50 && !P(m6c, 4) && m6c.system.fluid.rho.value === 1000);
  const m6b = read(f6).model;
  ok('the base scenario stays as it is', J(m6b, 2).mode === 'fixedFlow' && !!P(m6b, 4) && !P(m6b, 6) && J(m6b, 3).K === 5 && m6b.system.fluid.rho.value === 998.2);
  let thrown = '';
  try { FTH.read(f6, { scenario: 9 }); } catch (e) { thrown = e.message; }
  ok('a scenario that is not in the file is refused', thrown === PumpIt.i18n.t('core.import.noScenario', { scenario: '9' }));
  const v6 = M.validate(M.effective(m6, 'base'));
  const r6r = v6.ok ? run(m6) : null;
  ok('the child scenario is complete and calculates', v6.ok && r6r.ok && r6r.converged, v6.ok ? (r6r.ok ? '' : r6r.errors.join('; ')) : JSON.stringify([...v6.undef].slice(0, 2)));
  ok('every scenario of a file with a whole base scenario has a network', list.every((s) => s.network === true));

  // a base scenario without a network (F-33): its sections left out, the network drawn in #2 and changed in its child
  // #3 (the pressure of junction 1)
  const fe = fth({
    scen: [['Base Scenario', ''], ['Line', 'Base Scenario'], ['Higher', 'Base Scenario/Line']],
    secs: [
      ['JUNCTIONS -- SCENARIO #2 -- Line', ['NumberOfJunctions= 2', junc({ type: 4, id: 1, pipes: [-1], t: press({ P: 2 }) }), junc({ type: 4, id: 2, pipes: [1], t: press({ P: 0 }) })]],
      ['PIPES -- SCENARIO #2 -- Line', ['NumberOfPipes= 1', pipe({ id: 1, from: 1, to: 2, L: 100, D: 5 })]],
      ['JUNCTIONS -- SCENARIO #3 -- Higher', ['NumberOfJunctions= 1', deltaJ({ type: 4, id: 1, nPar: 1, t: ['', '', '', '', 3] })]],
    ],
  });
  const le = FTH.scenarios(fe);
  ok('a base scenario without a network: the file is a model, and the list tells which scenarios have one', le.map((s) => s.network).join() === 'false,true,true', JSON.stringify(le.map((s) => [s.path, s.network])));
  const re = read(fe, { name: 'Empty base.fth' });
  const ve = M.validate(M.effective(re.model, 'base'));
  const rre = ve.ok ? run(re.model) : null;
  ok('by default, the first scenario with a network comes in whole, with a note, and calculates', re.counts.scenario === 'Line' && re.model.title === 'Empty base (Line)' && hasNote(re, 'emptyBase')
    && J(re.model, 1).P.value === 2 && P(re.model, 1).length.value === 100 && ve.ok && rre.ok && rre.converged, ve.ok ? (rre.ok ? '' : rre.errors.join('; ')) : JSON.stringify([...ve.undef].slice(0, 2)));
  ok('its child changes it as usual', J(read(fe, { scenario: 'Higher' }).model, 1).P.value === 3);
  thrown = '';
  try { read(fe, { scenario: 1 }); } catch (e) { thrown = e.message; }
  ok('the empty base scenario is refused, with the scenarios that have a network', thrown === PumpIt.i18n.t('core.import.emptyScenario', { scenario: 'Base Scenario', list: '“Base Scenario/Line”, “Base Scenario/Line/Higher”' }), thrown);
  thrown = '';
  try { read(fth({ secs: [[BASE('JUNCTIONS'), ['NumberOfJunctions= 0']], [BASE('PIPES'), ['NumberOfPipes= 0']]] })); } catch (e) { thrown = e.message; }
  ok('a file in which no scenario has a network is refused, with its scenarios', thrown === PumpIt.i18n.t('core.import.noNetwork', { list: '“Base Scenario”' }), thrown);
  // a model of the program by its first line, with no section of pipes or junctions in any scenario, is a model
  // without a network; without that line, the same file is not a model
  const X = PumpIt.importShared, saved = Object.assign({}, X.PROGRAMS);
  const two = [['Base Scenario', ''], ['Line', 'Base Scenario']];
  thrown = '';
  try {
    X.PROGRAMS.liquid = X.wordHash('SOMELIQUID');
    read(fth({ header: 'ABC SOMELIQUID VERSION 11 INPUT FILE', scen: two, secs: [] }));
  } catch (e) { thrown = e.message; } finally { Object.assign(X.PROGRAMS, saved); }
  ok('a model without sections of pipes or junctions has no network, and the message names its scenarios', thrown === PumpIt.i18n.t('core.import.noNetwork', { list: '“Base Scenario”, “Base Scenario/Line”' }), thrown);
  thrown = '';
  try { read(fth({ scen: two, secs: [] })); } catch (e) { thrown = e.message; }
  ok('without the first line of a model, the same file is not a model', thrown === PumpIt.i18n.t('core.fth.notFth'), thrown);
}

console.log('\nStored results and the losses taken from them');
{
  // a detailed tee (t+3 = 1) and a pressure-reducing valve
  const rowP = (id, mLbs, p0in, p0out) => `${id},${mLbs},0,${p0in},${p0out},527.67,527.67,62.3156,0.000673,0,0,0,0,0,0`;
  const f7 = (archive, pipeK = 0) => fth({
    secs: [
      [BASE('JUNCTIONS'), [
        junc({ type: 4, id: 1, pipes: [-1], t: press({ P: 50, Pu: 'psia' }) }),
        junc({ type: 7, id: 2, pipes: [1, -2, -3], t: tee(1) }),
        junc({ type: 9, id: 3, pipes: [2, -4], t: cvalve(0, 2, 'barG') }),
        junc({ type: 4, id: 4, pipes: [4], t: press({ P: 1, Pu: 'barG' }) }),
        junc({ type: 4, id: 5, pipes: [3], t: press({ P: 1, Pu: 'barG' }) }),
      ]],
      [BASE('PIPES'), [pipe({ id: 1, from: 1, to: 2, L: 10, D: 10 }), pipe({ id: 2, from: 2, to: 3, L: 10, D: 10, K: pipeK }), pipe({ id: 3, from: 2, to: 5, L: 10, D: 10 }), pipe({ id: 4, from: 3, to: 4, L: 10, D: 10 })]],
      ...(archive ? [['PIPE ARCHIVE DATA -- SCENARIO #1 -- Base Scenario', ['NumberOfArchivePipes= 4', ...archive]], ['JUNCTION ARCHIVE DATA -- SCENARIO #1 -- Base Scenario', ['NumberOfArchiveJcts= 1', '1,527.67,50,0,4']]] : []),
    ],
  });
  const arch = [rowP(1, 40, 50, 49.5), rowP(2, 25, 49.2, 48.9), rowP(3, 15, 49.4, 30), rowP(4, 25, 35, 29.5)];
  const r7 = read(f7(arch)), m7 = r7.model;
  const A10 = Math.PI * 0.1 ** 2 / 4;
  const kOf = (dPpsi, mLbs) => (2 * dPpsi * PSI * RHO * A10 * A10) / (mLbs * LBM) ** 2;
  const st = r7.stored.get(1);
  ok('stored results: lbm/s and psia in SI', near(st.m, 40 * LBM) && near(st.P0in, 50 * PSI) && near(st.rho, 62.3156 * LBM / FT ** 3) && r7.stored.size === 4);
  ok('detailed tee: the loss of each path becomes a K at the end of its pipe', J(m7, 2).type === 'branch' && near(J(m7, 2).pipeK[2].kOut, kOf(0.3, 25), 1e-9)
    && near(J(m7, 2).pipeK[3].kOut, kOf(0.1, 15), 1e-9) && !J(m7, 2).pipeK[1] && hasNote(r7, 'teeCalibrated', 'J2'), JSON.stringify(J(m7, 2).pipeK));
  const cv = J(m7, 3);
  ok('pressure-reducing valve: a control valve of Pump It, that opens fully when it cannot reach its set point', cv.type === 'control' && cv.ctype === 'PRV' && cv.setP.value === 2
    && cv.setP.unit === 'bar(g)' && cv.alwaysControl === false && cv.failAction === 'open' && cv.special === 'none' && hasNote(r7, 'controlType', 'J3'));
  ok('not controlling at the stored point: its set point is read as a static pressure, with a note', cv.basis === 'static' && hasNote(r7, 'controlBasis', 'J3'));
  // the valve controlling at the stored point: the pressure after it on one basis or the other
  const set = 2e5 + 101325, V = 25 * LBM / (RHO * A10), dyn = RHO * V * V / 2;
  const at = (p0) => [rowP(1, 40, 50, 49.5), rowP(2, 25, 49.2, 48.9), rowP(3, 15, 49.4, 30), rowP(4, 25, p0 / PSI, 29.5)];
  ok('controlling at the stored point: a stagnation set point', J(read(f7(at(set))).model, 3).basis === 'stagnation');
  ok('controlling at the stored point: a static set point', J(read(f7(at(set + dyn))).model, 3).basis === 'static');
  const r7n = read(f7(arch), { calibrate: false });
  ok('without the stored results (calibrate: false): the tee has no losses', Object.keys(J(r7n.model, 2).pipeK).length === 0 && hasNote(r7n, 'teePlain', 'J2'));
  const r7s = read(f7(null));
  ok('a file without stored results', r7s.stored === null && hasNote(r7s, 'teePlain', 'J2'));
  // a gain of pressure on a path: into the fittings of the pipe (within their K), and its stored pressure moved to the
  // junction side; a pipe without fittings cannot take it
  const gain = [rowP(1, 40, 50, 49.5), rowP(2, 25, 49.6, 48.9), rowP(3, 15, 49.7, 30), rowP(4, 25, 35, 29.5)];
  const r7g = read(f7(gain, 2)), m7g = r7g.model;
  const fit = P(m7g, 2).fittings.find((it) => it.id === 'imported-tee');
  ok('a gain of pressure goes into the fittings of the pipe; the stored pressure of that end moves to the junction', fit && near(fit.value, -kOf(0.1, 25), 1e-9)
    && near(r7g.stored.get(2).P0in, 49.5 * PSI, 1e-12) && !J(m7g, 2).pipeK[2], JSON.stringify(P(m7g, 2).fittings));
  ok('without fittings to take it, the gain is cut, with a note', !P(m7g, 3).fittings.some((it) => it.id === 'imported-tee') && hasNote(r7g, 'teeGain', 'P3'));
  // calibrated model against its own stored results: the losses taken from them give them back
  const f7c = (archive) => fth({
    secs: [
      [BASE('JUNCTIONS'), [
        junc({ type: 2, id: 1, pipes: [-1], z: 20, t: tank({ level: 20, P: 0, Pu: 'barG' }) }),
        junc({ type: 7, id: 2, pipes: [1, -2, -3], t: tee(1) }),
        junc({ type: 4, id: 3, pipes: [2], t: press({ P: 0, Pu: 'barG' }) }),
        junc({ type: 4, id: 4, pipes: [3], t: press({ P: 0.3, Pu: 'barG' }) }),
      ]],
      [BASE('PIPES'), [pipe({ id: 1, from: 1, to: 2, z1: 20, L: 50, D: 10 }), pipe({ id: 2, from: 2, to: 3, L: 40, D: 7 }), pipe({ id: 3, from: 2, to: 4, L: 30, D: 5 })]],
      ...(archive ? [['PIPE ARCHIVE DATA -- SCENARIO #1 -- Base Scenario', archive]] : []),
    ],
  });
  // the "stored" point: the same network with losses at the tee, calculated by Pump It
  const mRef = read(f7c(null)).model;
  J(mRef, 2).pipeK = { 2: { kOut: 0.9, kIn: 0.9 }, 3: { kOut: 1.6, kIn: 1.6 } };
  mRef.solution.tolRel = 1e-11;
  const rRef = run(mRef);
  const mCal = read(f7c(archiveOf(rRef, RHO, 1.002e-3))).model;
  mCal.solution.tolRel = 1e-11;
  const rCal = run(mCal);
  ok('the losses taken from the stored point give that point back', rRef.ok && rCal.ok && near(J(mCal, 2).pipeK[2].kOut, 0.9, 1e-6) && near(J(mCal, 2).pipeK[3].kOut, 1.6, 1e-6)
    && relDiff(rCal.pipes[2].m, rRef.pipes[2].m) < 1e-7 && relDiff(rCal.pipes[3].m, rRef.pipes[3].m) < 1e-7,
  `K ${J(mCal, 2).pipeK[2] && J(mCal, 2).pipeK[2].kOut.toFixed(6)}, ${J(mCal, 2).pipeK[3] && J(mCal, 2).pipeK[3].kOut.toFixed(6)}`);
}

console.log('\nThe imported model against the same network built in Pump It');
const PIPES = [
  { id: 1, from: 1, to: 2, L: 50, z1: 8, z2: 0, D: 154.05, Du: 'mm', fric: ['0', 0.046, 'mm'], K: 1.2 },
  { id: 2, from: 2, to: 3, L: 200 / FT, Lu: 'feet', z1: 0, z2: 2, D: 6.065, Du: 'inches', fric: ['3', 120, 'None'] },
  { id: 3, from: 3, to: 4, L: 100, z1: 2, z2: 2, D: 102.26, Du: 'mm', fric: ['1', 0.0005, 'None'] },
  { id: 4, from: 3, to: 5, L: 80, z1: 2, z2: 1, D: 0.1, Du: 'meters', nc: [0.01, 0.4], fric: ['4', 0.02, 'None'] },
  { id: 5, from: 4, to: 7, L: 30, z1: 2, z2: 2, D: 102.26, Du: 'mm', fric: ['2', 0, 'None'] },
  { id: 6, from: 7, to: 6, L: 20, z1: 2, z2: 5, D: 102.26, Du: 'mm', fric: ['0', 0.046, 'mm'] },
  { id: 7, from: 3, to: 8, L: 40, z1: 2, z2: 3, D: 52.5, Du: 'mm', fric: ['0', 0.046, 'mm'] },
  { id: 8, from: 3, to: 9, L: 10, z1: 2, z2: 2, D: 52.5, Du: 'mm', fric: ['0', 0.046, 'mm'] },
];
const H = (Qh) => 40 - 0.002 * Qh * Qh; // pump head (m) at Q (m³/h)
const JUNCTIONS = (branchK = 0.4, pos = {}) => [
  junc({ type: 2, id: 1, name: 'Suction tank', pipes: [-1], x: 0, y: 0, z: 10, t: tank({ conns: [[0.5, 0, 2]], P: 0, Pu: 'psig', level: 10 }) }),
  junc({ type: 17, id: 2, name: 'Pump', pipes: [1, -2], x: 300, y: 0, z: 0, t: pumpT({ mode: 0, configs: [{ qmax: 140, H: [40, 0, -0.002] }] }) }),
  junc({ type: 1, id: 3, pipes: [2, -3, -4, -7, -8], x: 600, y: 0, z: 2, t: branch({ np: 5, ks: [0, branchK, 0, 0, 0], q: -10, qu: 'm3/hr' }) }),
  junc({ type: 8, id: 4, name: 'Valve', pipes: [3, -5], x: 900, y: -150, z: 2, spec: 0, t: valve({ K: 5 }) }),
  junc({ type: 3, id: 5, name: 'Consumer', pipes: [4], x: 900, y: 150, z: 1, t: flow({ q: 20, qu: 'm3/hr', out: true }) }),
  junc({ type: 4, id: 6, name: 'Header', pipes: [6], x: 1500, y: -150, z: 5, t: press({ P: 2.5, Pu: 'bar' }) }),
  junc({ type: 6, id: 7, name: 'Bend', pipes: [5, -6], x: 1200, y: -150, z: 2, t: bend(0.3) }),
  junc({ type: 8, id: 8, name: 'Drain', pipes: [7], x: 600, y: 300, z: 3, spec: 0, t: valve({ K: 2, P: 0, Pu: 'barG' }) }),
  junc({ type: 11, id: 9, name: 'Stub', pipes: [8], x: pos.x9 ?? 300, y: pos.y9 ?? 300, z: 2, t: [] }),
];
const WATER = { kind: 'user', name: 'Synthetic water', rho: q(998.2, 'kg/m³'), mu: q(1.002, 'cP'), pv: q(2.339, 'kPa(a)') };
function reference(branchK = 0.4) {
  const m = M.newModel();
  m.system.fluid = JSON.parse(JSON.stringify(WATER));
  m.system.patm = q(1, 'atm');
  m.system.laminarK = 'none';
  m.solution.tolRel = 1e-10;
  const add = (type, id, props) => { const j = Object.assign(M.newJunction(type, id, 0, 0), props); m.junctions.push(j); return j; };
  add('reservoir', 1, { elevation: q(10, 'm'), liquidElev: q(10, 'm'), surfP: q(0, 'psig'), pipeK: { 1: { kOut: 0.5, kIn: 0, elev: q(8, 'm') } } });
  add('pump', 2, { mode: 'curve', elevation: q(0, 'm'), curve: { x: [0, 50, 100, 140], y: [0, 50, 100, 140].map(H), xUnit: 'm³/h', yUnit: 'm', fit: '2' }, eff: { x: [], y: [], xUnit: 'm³/h', fit: '2' }, npshr: { x: [], y: [], xUnit: 'm³/h', yUnit: 'm', fit: '2' } });
  add('branch', 3, { elevation: q(2, 'm'), source: q(-10, 'm³/h'), pipeK: branchK ? { 3: { kOut: branchK, kIn: branchK } } : {} });
  add('valve', 4, { elevation: q(2, 'm'), lossModel: 'K', K: 5 });
  add('flow', 5, { elevation: q(1, 'm'), Q: q(20, 'm³/h'), dir: 'out' });
  add('pressure', 6, { elevation: q(5, 'm'), P: q(2.5, 'bar(a)'), ptype: 'stagnation' });
  add('generic', 7, { elevation: q(2, 'm'), genModel: 'K', K: 0.3 });
  add('exitvalve', 8, { elevation: q(3, 'm'), lossModel: 'K', K: 2, Pout: q(0, 'bar(g)') });
  add('flow', 9, { elevation: q(2, 'm'), Q: q(0, 'm³/h'), dir: 'out' });
  const pp = (id, up, down, L, geometry, friction, fittings = []) => {
    const p = M.newPipe(id, up, down);
    Object.assign(p, { length: L, fittings });
    p.material = { kind: 'user', nps: '4', sch: '40' };
    Object.assign(p.geometry, geometry);
    Object.assign(p.friction, friction);
    m.pipes.push(p);
  };
  const rough = { model: 'roughness', eps: q(0.046, 'mm') };
  pp(1, 1, 2, q(50, 'm'), { kind: 'circular', d: q(154.05, 'mm') }, rough, [{ model: 'K', value: 1.2, qty: 1 }]);
  pp(2, 2, 3, q(200 / FT, 'ft'), { kind: 'circular', d: q(6.065, 'in') }, { model: 'hw', C: 120 });
  pp(3, 3, 4, q(100, 'm'), { kind: 'circular', d: q(102.26, 'mm') }, { model: 'relRoughness', rel: 0.0005 });
  pp(4, 3, 5, q(80, 'm'), { kind: 'noncircular', area: q(0.01, 'm²'), perim: q(0.4, 'm') }, { model: 'explicitF', f: 0.02 });
  pp(5, 4, 7, q(30, 'm'), { kind: 'circular', d: q(102.26, 'mm') }, { model: 'smooth' });
  pp(6, 7, 6, q(20, 'm'), { kind: 'circular', d: q(102.26, 'mm') }, rough);
  pp(7, 3, 8, q(40, 'm'), { kind: 'circular', d: q(52.5, 'mm') }, rough);
  pp(8, 3, 9, q(10, 'm'), { kind: 'circular', d: q(52.5, 'mm') }, rough);
  return m;
}
const netFile = (opts = {}) => fth({ secs: [[BASE('JUNCTIONS'), JUNCTIONS(opts.branchK ?? 0.4, opts.pos || {})], [BASE('PIPES'), PIPES.map(pipe)], ...(opts.archive ? [[BASE('PIPE ARCHIVE DATA'), opts.archive]] : [])] });
{
  const ref = reference();
  const rRef = run(ref);
  ok('the reference network solves', rRef.ok && rRef.converged, rRef.ok ? `${rRef.iterations} iterations` : (rRef.errors || []).join('; '));
  const res = read(netFile({ archive: archiveOf(rRef, RHO, 1.002e-3) }), { name: 'Pumping station.fth' });
  const m1 = res.model;
  ok('9 junctions and 8 pipes with the IDs of the file, of the expected types', m1.junctions.length === 9 && m1.pipes.length === 8
    && ['reservoir', 'pump', 'branch', 'valve', 'flow', 'pressure', 'generic', 'exitvalve', 'flow'].every((type, i) => J(m1, i + 1).type === type), m1.junctions.map((j) => j.id + ':' + j.type).join(' '));
  ok('names and drawing positions kept', J(m1, 1).name === 'Suction tank' && J(m1, 3).name === '' && P(m1, 1).name === 'Pipe' && J(m1, 2).x - J(m1, 1).x === 160);
  m1.solution.tolRel = 1e-10;
  const v1 = M.validate(M.effective(m1, 'base'));
  ok('the imported model is complete', v1.ok, v1.ok ? '' : JSON.stringify([...v1.undef].slice(0, 3)));
  const r1 = run(m1);
  ok('it solves', r1.ok && r1.converged, r1.ok ? `${r1.iterations} iterations` : (r1.errors || []).join('; '));
  let dQ = 0, dP = 0;
  const Pscale = Math.max(...Object.values(rRef.junctions).map((x) => Math.abs(x.P0 || 0)), 1e5);
  for (const id of Object.keys(rRef.pipes)) {
    dQ = Math.max(dQ, relDiff(r1.pipes[id].m, rRef.pipes[id].m, 1));
    dP = Math.max(dP, relDiff(r1.pipes[id].P0in, rRef.pipes[id].P0in, Pscale), relDiff(r1.pipes[id].P0out, rRef.pipes[id].P0out, Pscale));
  }
  ok('same flows and pressures as the network built in Pump It', dQ < 1e-9 && dP < 1e-9, `flow ${dQ.toExponential(1)} kg/s, pressure ${dP.toExponential(1)}`);
  const cmp = FTH.compare(r1, res.stored);
  ok('the comparison with the stored results finds them equal', cmp.n === 8 && cmp.flow < 1e-8 && cmp.pressure < 1e-8, `flow ${cmp.flow.toExponential(1)}, pressure ${cmp.pressure.toExponential(1)}`);
  const m1b = read(netFile({ archive: archiveOf(rRef, RHO, 1.002e-3) })).model;
  J(m1b, 4).K = 50; // a different valve: the comparison has to show it
  const c2 = FTH.compare(run(m1b), res.stored);
  ok('a model that differs from the stored results shows the difference', c2.flow > 1e-3 && c2.pressure > 1e-3, `flow ${(c2.flow * 100).toFixed(2)} %, pressure ${(c2.pressure * 100).toFixed(2)} %`);
  ok('nothing needs the user in that file', !res.notes.some((n) => n.level === 'missing'), res.notes.filter((n) => n.level === 'missing').map((n) => n.key).join(' '));

  console.log('\nThe physics of two reservoirs');
  const f8 = fth({ secs: [
    [BASE('JUNCTIONS'), [junc({ type: 2, id: 1, pipes: [-1], z: 30, t: tank({ conns: [[0.5, 1, 0]], level: 30, P: 0, Pu: 'barG' }) }), junc({ type: 2, id: 2, pipes: [1], t: tank({ conns: [[0.5, 1, 0]], level: 0, P: 0.5, Pu: 'barG' }) })]],
    [BASE('PIPES'), [pipe({ id: 1, from: 1, to: 2, z1: 30, L: 250, D: 10.22604, K: 3.5 })]]] });
  const r8 = run(read(f8).model);
  const Q = r8.ok ? r8.pipes[1].Q : NaN;
  const D = 0.1022604, A = Math.PI * D * D / 4, eps = 0.04572e-3, V8 = Q / A, Re = RHO * V8 * D / 1.002e-3;
  let x = 7;
  for (let i = 0; i < 80; i++) x = 1.14 - 2 * Math.log10(eps / D + 9.35 * x / Re);
  const head = 30 - 0.5e5 / (RHO * G0); // upstream level − downstream pressure, in metres
  // friction, the K of the pipe, the entrance K of tank 1 (0.5, tank → pipe) and the exit K of tank 2 (1, pipe → tank)
  const loss = ((1 / (x * x)) * 250 / D + 3.5 + 0.5 + 1) * V8 * V8 / (2 * G0);
  ok('the imported model closes the energy balance', r8.ok && Math.abs(loss - head) < 1e-6 * head, `Q ${(Q * 3600).toFixed(3)} m³/h, loss ${loss.toFixed(5)} m, head ${head.toFixed(5)} m`);

  console.log('\nA fixed friction factor and a flow control that cannot reach its set point');
  const f9a = fth({ secs: [
    [BASE('JUNCTIONS'), [junc({ type: 4, id: 1, pipes: [-1], t: press({ P: 2, Pu: 'barG' }) }), junc({ type: 4, id: 2, pipes: [1], t: press({ P: 1, Pu: 'barG' }) })]],
    [BASE('PIPES'), [pipe({ id: 1, from: 1, to: 2, L: 1000, D: 10, K: 1, fric: ['7', 0, 'None'] })]]] });
  const r9 = run(read(f9a).model);
  ok('a frictionless pipe loses only its K: V = √(2ΔP/ρK)', r9.ok && near(Math.abs(r9.pipes[1].V), Math.sqrt(2e5 / RHO), 1e-8), r9.ok ? `V ${r9.pipes[1].V.toFixed(6)} m/s` : '');
  const f9b = (fcv) => fth({ secs: [
    [BASE('JUNCTIONS'), [junc({ type: 2, id: 1, pipes: [-1], z: 10, t: tank({ level: 10, P: 0, Pu: 'barG' }) }),
      junc({ type: fcv ? 9 : 8, id: 2, pipes: [1, -2], spec: 0, t: fcv ? cvalve(2, 200, 'm3/hr') : valve({ K: 0 }) }), junc({ type: 4, id: 3, pipes: [2], t: press({ P: 0 }) })]],
    [BASE('PIPES'), [pipe({ id: 1, from: 1, to: 2, z1: 10, L: 100, D: 5 }), pipe({ id: 2, from: 2, to: 3, L: 100, D: 5 })]]] });
  const rFcv = run(read(f9b(true)).model), rOpen = run(read(f9b(false)).model);
  ok('the flow control opens fully and passes the flow of the open valve', rFcv.ok && rOpen.ok && near(rFcv.pipes[1].Q, rOpen.pipes[1].Q, 1e-7) && rFcv.pipes[1].Q * 3600 < 200
    && rFcv.states[2] === 'open', rFcv.ok ? `${(rFcv.pipes[1].Q * 3600).toFixed(4)} m³/h, state ${rFcv.states[2]}` : (rFcv.errors || []).join('; '));
}

console.log('\nWhat the format leaves open');
{
  const P2 = [
    { id: 1, from: 1, to: 2, L: 10, D: 10, name: 'Main\x15 north' }, { id: 2, from: 2, to: 3, L: 10, D: 10, fric: ['6', 0, 'None'] },
    { id: 3, from: 3, to: 4, L: 10, D: 10, Lu: 'furlongs' }, { id: 4, from: 4, to: 5, L: 10, D: 10 }, { id: 5, from: 5, to: 6, L: 10, D: 10 },
    { id: 6, from: 6, to: 7, L: 10, D: 10 }, { id: 7, from: 1, to: 77, L: 10, D: 10 }, { id: 8, from: 4, to: 8, L: 10, D: 10 },
  ];
  const J2 = [
    junc({ type: 4, id: 1, pipes: [-1, -7], t: press({ ks: [[0, 0], [0, 0]], P: 1 }) }),
    junc({ type: 10, id: 2, pipes: [1, -2], t: [] }),
    junc({ type: 27, id: 3, pipes: [2, -3], t: [] }),
    junc({ type: 1, id: 4, pipes: [3, -4, -8], t: branch({ np: 3 }) }),
    junc({ type: 99, id: 5, pipes: [4, -5], t: [] }),
    junc({ type: 9, id: 6, pipes: [5, -6], t: cvalve(7, 1, 'barG') }),
    junc({ type: 4, id: 7, pipes: [6], t: press({ P: 0 }) }),
    junc({ type: 21, id: 8, pipes: [8], t: [] }),
  ];
  const text = fth({ fluidKeys: ['Gravity= 1', 'AltLossFactorMethod= 2'], app: { 'QRS Use': -1, 'TUV Use': 0 }, secs: [[BASE('JUNCTIONS'), J2], [BASE('PIPES'), [...P2.map(pipe), '999,lost']]] });
  const res2 = read(text), m2 = res2.model;
  const keys = res2.notes.map((n) => `${n.key}[${n.objs.join(' ')}]`).join(', ');
  ok('a name with a comma (0x15) is read whole', P(m2, 1).name === 'Main, north');
  ok('a broken record and a pipe to a missing junction are left out, with notes', hasNote(res2, 'badRecord', 'P999') && hasNote(res2, 'dangling', 'P7') && !P(m2, 7) && !P(m2, 999), keys);
  ok('a friction model that is not known: blank roughness, with a note', P(m2, 2).friction.eps.value === null && hasNote(res2, 'friction', 'P2'));
  ok('a unit that is not known: blank length, with a note', P(m2, 3).length.value === null && hasNote(res2, 'unit', 'P3') && res2.notes.find((n) => n.key === 'unit').params.unit === 'furlongs');
  ok('a check valve (no data in the description) becomes a component with K = 0', J(m2, 2).type === 'generic' && J(m2, 2).K === 0 && hasNote(res2, 'unknownLoss', 'J2'));
  ok('a three-way valve and an unknown code become nodes; a relief valve on one pipe, a closed end', J(m2, 3).type === 'branch' && J(m2, 5).type === 'generic' && J(m2, 8).type === 'flow'
    && J(m2, 8).Q.value === 0 && hasNote(res2, 'unsupported', 'J3') && hasNote(res2, 'unsupported', 'J8') && hasNote(res2, 'unknownLoss', 'J5'));
  ok('a control valve of an unknown kind: an open valve, with a note', J(m2, 6).type === 'valve' && J(m2, 6).K === 0 && hasNote(res2, 'controlUnknown', 'J6'));
  ok('add-on modules, an unknown laminar correction and no fluid data are reported', hasNote(res2, 'addOns') && hasNote(res2, 'laminarK') && hasNote(res2, 'fluidDefault')
    && m2.system.fluid.kind === 'water' && m2.system.laminarK === 'craneFt' && res2.stored === null, keys);
  const v2 = M.validate(M.effective(m2, 'base'));
  ok('the checklist asks for what was left blank', !v2.ok && v2.undef.has('p:2') && v2.undef.has('p:3'), [...v2.undef.keys()].join(' '));
  ok('notes ordered: needs the user, assumed, left out, read', res2.notes.every((n, i, a) => i === 0 || FTH.LEVELS.indexOf(a[i - 1].level) <= FTH.LEVELS.indexOf(n.level)));
}

console.log('\nDrawing positions and file variants');
{
  const m1 = read(netFile()).model;
  const xs = m1.junctions.map((j) => j.x), ys = m1.junctions.map((j) => j.y);
  ok('on the grid of the drawing, from the margin', m1.junctions.every((j) => j.x % 20 === 0 && j.y % 20 === 0) && Math.min(...xs) === 100 && Math.min(...ys) === 100);
  ok('the layout of the file kept, neighbours about 160 apart', J(m1, 2).x - J(m1, 1).x === 160 && J(m1, 3).x - J(m1, 2).x === 160 && J(m1, 4).y < J(m1, 3).y && J(m1, 5).y > J(m1, 3).y);
  const same = read(netFile({ pos: { x9: 600, y9: 300 } })).model;
  ok('two junctions on one point: one grid step apart, the scale kept', J(same, 9).y === J(same, 8).y && Math.abs(J(same, 9).x - J(same, 8).x) === 20 && J(same, 2).x - J(same, 1).x === 160);
  const flatText = fth({ secs: [[BASE('JUNCTIONS'), [junc({ type: 4, id: 1, pipes: [-1], x: 5, y: 5, t: press({ P: 1 }) }), junc({ type: 4, id: 2, pipes: [1], x: 5, y: 5, t: press({ P: 0 }) })]], [BASE('PIPES'), [pipe({ id: 1, from: 1, to: 2, L: 10, D: 5 })]]] });
  const flat = read(flatText);
  ok('without usable positions: a grid, with a note', new Set(flat.model.junctions.map((j) => j.x + ',' + j.y)).size === 2 && hasNote(flat, 'layout'));
  const plain = read(fth({ secs: [['JUNCTIONS', JUNCTIONS()], ['PIPES', PIPES.map(pipe)]] }));
  ok('sections without scenarios', plain.counts.pipes === 8 && plain.counts.junctions === 9);
  const accented = netFile().replace('Pump,', 'Bomba de recalque nº 2 – sucção,');
  const decoded = new TextDecoder('windows-1252').decode(Buffer.from(accented.replace('–', '\u0096'), 'latin1'));
  ok('Windows-1252 names', J(read(decoded).model, 2).name === 'Bomba de recalque nº 2 – sucção');
}

console.log('\nTime data of the junctions (Annex A.2 of the time simulation, as its version 1.1 corrects it, and Annex D)');
// the block of the time data, written field by field: [rel] [ign] [rep1] [rep2] [trigger] [event 1: code, comparison,
// value, unit, end 1, object 1, end 2, object 2] [event 2] [table 1: key, nY, n, time unit, nY units, n rows (τ, v1 …
// vnY)] [table 2]
const NO_EVENT = [-1, -1, 0, 'None', -1, -1, -1, -1];
const eventF = (e) => (e ? [e.code, e.cond, e.v, e.unit || 'None', e.end ?? 1, e.obj ?? -1, e.end2 ?? -1, e.obj2 ?? -1] : NO_EVENT);
const tableF = ({ key = 'None', tu = 'seconds', units = ['None'], rows = [] } = {}) => [key, units.length, rows.length, tu, ...units, ...rows.flat()];
const timeF = ({ rel = 0, ign = 0, rep1 = 0, rep2 = 0, trig = 0, e1, e2, t1, t2 }) => [rel, ign, rep1, rep2, trig, ...eventF(e1), ...eventF(e2), ...tableF(t1), ...tableF(t2)];
// the block of a type followed by its time data, the trigger at b+at (zeros in between), and in a reservoir the model of
// its transient just before rel
function timed(blk, at, fields, model) {
  const out = blk.slice(), pre = at - 69 - 4 - (model === undefined ? 0 : 1);
  while (out.length < pre) out.push('0');
  return [...out, ...(model === undefined ? [] : [model]), ...fields];
}
{
  const EV = PumpIt.time.events;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const PUMP = pumpT({ mode: 0, configs: [{ qmax: 300, H: [50, 0, -0.0004] }] }), FLOW = flow({ q: 20, qu: 'm3/hr', out: true });
  // a line: reservoir 1, pump 2 on its curve, valve 3 by its Cv, flow control valve 4 and imposed flow 5, joined by pipes 1
  // to 4; blocks: the block of the type of some junctions, by ID
  const line = (blocks = {}) => fth({ secs: [
    [BASE('JUNCTIONS'), [
      junc({ type: 2, id: 1, pipes: [-1], z: 10, t: blocks[1] || tank({ level: 10, P: 0, Pu: 'barG' }) }),
      junc({ type: 17, id: 2, pipes: [1, -2], t: blocks[2] || PUMP }),
      junc({ type: 8, id: 3, pipes: [2, -3], spec: 0, t: blocks[3] || valve({ model: 0, K: 50 }) }),
      junc({ type: 9, id: 4, pipes: [3, -4], t: blocks[4] || cvalve(2, 100, 'm3/hr') }),
      junc({ type: 3, id: 5, pipes: [4], t: blocks[5] || FLOW }),
    ]],
    [BASE('PIPES'), [1, 2, 3, 4].map((id) => pipe({ id, from: id, to: id + 1, L: 10, D: 10 }))],
  ] });
  // the time data of junction id in such a line, the notes on it and the effective model
  function timeOf(id, blocks) {
    const r = read(line(blocks));
    return { r, time: J(r.model, id).time, notes: r.notes.filter((n) => n.objs.includes('J' + id)), eff: M.effective(r.model, 'base') };
  }
  const keysOf = (x) => x.notes.map((n) => n.key).join(' ');
  const noteOf = (x, k) => x.notes.find((n) => n.key === k);
  // the imposed flow 5 with time data: by default by the clock, a table in m³/h
  const TABLE = { units: ['m3/hr'], rows: [[0, 20], [30, 0]] }, T2 = { units: ['m3/hr'], rows: [[0, 0], [60, 20]] };
  const LOW = { code: 4, cond: 3, v: 10, unit: 'm3/hr', obj: 1 }, HIGH = { code: 4, cond: 1, v: 30, unit: 'm3/hr', obj: 1 };
  const onFlow = (time) => timeOf(5, { 5: timed(FLOW, 86, timeF(Object.assign({ t1: TABLE }, time))) });
  const single = (e1) => onFlow({ trig: 1, e1 });

  // comparisons 0 >, 1 ≥, 3 ≤, 4 <, and 5 or 2 for a state; the events with a condition in Pump It (§5.2), complete for
  // its checklist
  const read1 = [
    ['1, the static pressure at the outlet (end 2) of a pipe, ≥ (1)', { code: 1, cond: 1, v: 8, unit: 'barG', end: 2, obj: 3 }, { q: 'pStatic', obj: 'p:3', end: 'out', op: '>=', value: q(8, 'bar(g)') }],
    ['2, the stagnation pressure at the inlet (end 1), < (4)', { code: 2, cond: 4, v: 30, unit: 'psig', end: 1, obj: 2 }, { q: 'pStag', obj: 'p:2', end: 'in', op: '<', value: q(30, 'psig') }],
    ['3, the mass flow of a pipe, > (0), without an end', { code: 3, cond: 0, v: 5, unit: 'kg/sec', end: 2, obj: 1 }, { q: 'flowMass', obj: 'p:1', op: '>', value: q(5, 'kg/s') }],
    ['4, the volume flow, ≤ (3)', { code: 4, cond: 3, v: 20, unit: 'm3/hr', obj: 1 }, { q: 'flowVol', obj: 'p:1', op: '<=', value: q(20, 'm³/h') }],
    ['5, the hydraulic grade line at an end', { code: 5, cond: 1, v: 30, unit: 'meters', end: 2, obj: 4 }, { q: 'hgl', obj: 'p:4', end: 'out', op: '>=', value: q(30, 'm') }],
    ['6, the energy grade line at an end', { code: 6, cond: 0, v: 100, unit: 'feet', end: 1, obj: 4 }, { q: 'egl', obj: 'p:4', end: 'in', op: '>', value: q(100, 'ft') }],
    ['22, the velocity, in a length per second', { code: 22, cond: 1, v: 3, unit: 'feet/sec', obj: 2 }, { q: 'velocity', obj: 'p:2', op: '>=', value: q(3, 'ft/s') }],
    ['7, the speed of a pump (%)', { code: 7, cond: 3, v: 50, unit: 'Percent', obj: 2 }, { q: 'pumpSpeed', obj: 'j:2', op: '<=', value: q(50, '%') }],
    ['10, the state of a control valve by 5, "state equal to": 1.2 rounds to 1, fully open', { code: 10, cond: 5, v: 1.2, obj: 4 }, { q: 'state', obj: 'j:4', op: '=', value: 'open' }],
    ['10 by 2, "equal to", a whole code: 0, controlling', { code: 10, cond: 2, v: 0, obj: 4 }, { q: 'state', obj: 'j:4', op: '=', value: 'control' }],
    ['10 by 5: 2, closed', { code: 10, cond: 5, v: 2, obj: 4 }, { q: 'state', obj: 'j:4', op: '=', value: 'closed' }],
    ['23, the time since the last event of the junction', { code: 23, cond: 1, v: 2, unit: 'minutes' }, { q: 'elapsed', op: '>=', value: q(2, 'min') }],
    ['24, the pressure of a tank, its surface pressure', { code: 24, cond: 4, v: 1.2, unit: 'barG', obj: 1 }, { q: 'surfP', obj: 'j:1', op: '<', value: q(1.2, 'bar(g)') }],
    ['28, the Cv of a valve', { code: 28, cond: 3, v: 40, obj: 3 }, { q: 'cv', obj: 'j:3', op: '<=', value: q(40, '') }],
    ['0, the clock', { code: 0, cond: 4, v: 1, unit: 'hours' }, { q: 'time', op: '<', value: q(1, 'h') }],
  ];
  for (const [name, ev, want] of read1) {
    const x = single(ev), got = x.time && x.time.when;
    ok(`event ${name}`, same(got, [want]) && x.time.start === 'single' && !EV.check(want, x.eff).length, JSON.stringify(got));
  }
  // a difference between two places: the first less the second, which the description does not state (a note)
  const diffs = [
    ['11, the static pressure across a junction: its inlet side less its outlet side', { code: 11, cond: 1, v: 0.5, unit: 'bar', obj: 3 }, { q: 'pStatic', obj: 'j:3', end: 'in', obj2: 'j:3', end2: 'out', op: '>=', value: q(0.5, 'bar') }],
    ['16, the stagnation pressure between two pipes: the end of the first less that of the second', { code: 16, cond: 0, v: 10, unit: 'psid', end: 1, obj: 1, end2: 2, obj2: 4 }, { q: 'pStag', obj: 'p:1', end: 'in', obj2: 'p:4', end2: 'out', op: '>', value: q(10, 'psi') }],
    ['17, the hydraulic grade line between two pipes', { code: 17, cond: 4, v: 2, unit: 'meters', end: 2, obj: 2, end2: 1, obj2: 3 }, { q: 'hgl', obj: 'p:2', end: 'out', obj2: 'p:3', end2: 'in', op: '<', value: q(2, 'm') }],
  ];
  for (const [name, ev, want] of diffs) {
    const x = single(ev), got = x.time && x.time.when;
    ok(`event ${name}, with a note`, same(got, [want]) && !EV.check(want, x.eff).length && noteOf(x, 'timeDifference') && noteOf(x, 'timeDifference').level === 'assumed', JSON.stringify(got));
  }
  // 29, a Kv, compared as a Cv: the Cv that Pump It gives as the result of a valve of that Kv
  const kv = single({ code: 29, cond: 0, v: 34.6, obj: 3 });
  const mk = M.newModel();
  const addJ = (type, id, props) => mk.junctions.push(Object.assign(M.newJunction(type, id, 0, 0), { elevation: q(0, 'm') }, props));
  addJ('pressure', 1, { P: q(2, 'bar(g)') });
  addJ('valve', 2, { lossModel: 'Kv', Kv: 34.6 });
  addJ('pressure', 3, { P: q(0, 'bar(g)') });
  for (const id of [1, 2]) {
    const p = Object.assign(M.newPipe(id, id, id + 1), { length: q(10, 'm'), material: { kind: 'user', nps: '4', sch: '40' }, fittings: [] });
    Object.assign(p.geometry, { kind: 'circular', d: q(0.1, 'm') });
    p.friction = { model: 'explicitF', f: 0.02 };
    mk.pipes.push(p);
  }
  const rk = run(mk), cvKv = kv.time ? kv.time.when[0].value.value : NaN;
  ok('event 29, a Kv: compared as the Cv of the same loss', rk.ok && kv.time.when[0].q === 'cv' && kv.time.when[0].value.unit === '' && near(cvKv, rk.valves[2].Cv, 1e-9),
    `${cvKv} against ${rk.ok ? rk.valves[2].Cv : '—'}`);

  // what comes in with a note
  const noEnd = single({ code: 1, cond: 1, v: 8, unit: 'barG', end: 0, obj: 3 });
  ok('an end that is neither 1 nor 2: the condition without its end, which the checklist asks for, with a note', same(noEnd.time && noEnd.time.when, [{ q: 'pStatic', obj: 'p:3', op: '>=', value: q(8, 'bar(g)') }])
    && same(EV.check(noEnd.time.when[0], noEnd.eff), ['end']) && noteOf(noEnd, 'timeEnd').level === 'missing' && noteOf(noEnd, 'timeEnd').params.id === 'P3', keysOf(noEnd));
  const gone = single({ code: 1, cond: 1, v: 8, unit: 'barG', end: 2, obj: 99 });
  ok('a pipe that is not in the model: the event kept, with a note', gone.time && gone.time.when[0].obj === 'p:99' && noteOf(gone, 'timeObject') && noteOf(gone, 'timeObject').params.id === 'P99', keysOf(gone));
  const level = single({ code: 21, cond: 3, v: 2, unit: 'meters', obj: 1 });
  ok('21, the level of a reservoir that is not a finite tank: kept, with a note', same(level.time && level.time.when, [{ q: 'tankLevel', obj: 'j:1', op: '<=', value: q(2, 'm') }]) && !!noteOf(level, 'timeNotTank'));
  const opening = single({ code: 25, cond: 4, v: 40, unit: 'Percent', obj: 4 });
  ok('25, the opening of a valve: kept, with a note that asks for its characteristic', same(opening.time && opening.time.when, [{ q: 'opening', obj: 'j:4', op: '<', value: q(40, '%') }])
    && noteOf(opening, 'timeOpening').level === 'missing' && noteOf(opening, 'timeOpening').params.id === 'J4');

  // what leaves the time data of the junction out, with a note
  const left = [
    ['2, "equal to", on a number', { code: 1, cond: 2, v: 8, unit: 'barG', end: 2, obj: 3 }, 'timeCompare', { code: 2 }],
    ['5, "state equal to", on a number', { code: 7, cond: 5, v: 100, unit: 'Percent', obj: 2 }, 'timeCompare', { code: 5 }],
    ['an inequality on a state', { code: 10, cond: 0, v: 1, obj: 4 }, 'timeCompare', { code: 0 }],
    ['a state "equal to" a value that is not a whole code', { code: 10, cond: 2, v: 1.5, obj: 4 }, 'timeState', { value: 1.5 }],
    ['a state code out of its list', { code: 10, cond: 5, v: 3, obj: 4 }, 'timeState', { value: 3 }],
    ['a comparison of an unknown code', { code: 1, cond: 6, v: 8, unit: 'barG', end: 2, obj: 3 }, 'timeCondition', { code: 6 }],
    ['8, the state of a check valve', { code: 8, cond: 5, v: 1, obj: 3 }, 'timeEvent', { code: 8 }],
    ['13, a grade line across a junction', { code: 13, cond: 1, v: 1, unit: 'meters', obj: 3 }, 'timeEvent', { code: 13 }],
    ['31, a combined event', { code: 31, cond: 5, v: 1 }, 'timeEvent', { code: 31 }],
    ['a value in a unit of another category (a mass flow for a volume flow)', { code: 4, cond: 1, v: 5, unit: 'kg/sec', obj: 1 }, 'timeUnit', { unit: 'kg/sec' }],
  ];
  for (const [name, ev, k, params] of left) {
    const x = single(ev), n = noteOf(x, k);
    ok(`left out: ${name}`, !x.time && n && n.level === 'ignored' && same(n.params, params) && !noteOf(x, 'timeData'), keysOf(x));
  }

  // the four fields before the trigger (F-39)
  const absOk = onFlow({});
  ok('rel 0 in a unit of the quantity: absolute values in that unit, in use, not repeated; the note of the data read', absOk.time && absOk.time.basis === 'absolute' && absOk.time.use === true
    && absOk.time.repeat === false && absOk.time.start === 'time' && same(absOk.time.tables, [{ t: [0, 30], v: [20, 0], tUnit: 's', vUnit: 'm³/h' }])
    && noteOf(absOk, 'timeData').level === 'info' && keysOf(absOk) === 'timeData', keysOf(absOk));
  const rel = onFlow({ rel: 1, t1: { units: ['Percent'], rows: [[0, 100], [3600, 150]] } });
  ok('rel ≠ 0: values in % of the steady value', rel.time && rel.time.basis === 'relative' && same(rel.time.tables, [{ t: [0, 3600], v: [100, 150], tUnit: 's', vUnit: '%' }]) && keysOf(rel) === 'timeData');
  const relUnit = onFlow({ rel: -1 });
  ok('rel ≠ 0 with a unit of the quantity: the values still in %, with a note on the unit', relUnit.time && relUnit.time.basis === 'relative' && same(relUnit.time.tables[0].v, [20, 0])
    && relUnit.time.tables[0].vUnit === '%' && noteOf(relUnit, 'timeRelUnit').params.unit === 'm3/hr');
  const pct = onFlow({ t1: { units: ['Percent'], rows: [[0, 100], [30, 0]] } });
  ok('rel 0 with a table in percent of a flow: the rule of the unit disagrees, left out with a note', !pct.time && noteOf(pct, 'timePercent').level === 'ignored');
  const speed = (r) => timeOf(2, { 2: timed(PUMP, 168, timeF({ rel: r, t1: { units: ['Percent'], rows: [[0, 100], [60, 80]] } })) });
  const sa = speed(0), sr = speed(1);
  ok('the speed of a pump in percent: absolute with rel 0, relative with rel 1, no note on the unit', sa.time && sa.time.what === 'speed' && sa.time.basis === 'absolute' && sr.time && sr.time.what === 'speed'
    && sr.time.basis === 'relative' && same(sr.time.tables[0].v, [100, 80]) && keysOf(sa) === 'timeData' && keysOf(sr) === 'timeData', `${keysOf(sa)} | ${keysOf(sr)}`);
  const ign = onFlow({ ign: 1 }), special = onFlow({ ign: 2 });
  ok('ign 1: the data kept, not in use, with a note', ign.time && ign.time.use === false && noteOf(ign, 'timeIgnored').level === 'info');
  ok('ign of another code: in use, with a note', special.time && special.time.use === true && noteOf(special, 'timeSpecial').params.code === 2);
  const tank1 = timeOf(1, { 1: timed(tank({ level: 10, P: 0, Pu: 'barG' }), 111, timeF({ ign: 1, rep1: 1, t1: { tu: 'hours', units: ['meters'], rows: [[0, 10], [12, 8], [24, 10]] } }), 2) });
  ok('a reservoir: the model of its transient before rel; its level by the clock, kept unused and repeated', tank1.time && tank1.time.what === 'level' && tank1.time.basis === 'absolute'
    && tank1.time.use === false && tank1.time.repeat === true && same(tank1.time.tables, [{ t: [0, 12, 24], v: [10, 8, 10], tUnit: 'h', vUnit: 'm' }]), JSON.stringify(tank1.time));
  const cyc = onFlow({ trig: 2, rep1: 1, rep2: 0, e1: LOW, e2: HIGH, t2: T2 });
  ok('2, two cyclic events: two conditions and two tables; rep1 ≠ 0 repeats, and a second table that does not repeat has a note', cyc.time && cyc.time.start === 'dualCyclic'
    && same(cyc.time.when.map((c) => c.op), ['<=', '>=']) && cyc.time.tables.length === 2 && cyc.time.repeat === true && noteOf(cyc, 'timeRepeat').level === 'assumed');
  const seq = onFlow({ trig: 3, rep1: 1, rep2: 1, e1: LOW, e2: HIGH, t2: T2 });
  ok('3, two events in sequence, both tables repeated: no note', seq.time && seq.time.start === 'dualSequential' && seq.time.repeat === true && !noteOf(seq, 'timeRepeat'));
  const one = onFlow({ trig: 1, rep1: 0, rep2: 1, e1: LOW, t2: T2 });
  ok('one event: the second table is not used, nor its repetition', one.time && one.time.start === 'single' && one.time.tables.length === 1 && one.time.repeat === false && !noteOf(one, 'timeRepeat'));

  // the tables (F-37): their key, their columns of values
  const set1 = onFlow({ t1: Object.assign({ key: 'Morning\x15 demand' }, TABLE) }), set2 = onFlow({ trig: 2, e1: LOW, e2: HIGH, t2: Object.assign({ key: 'Evening' }, T2) });
  ok('a table kept in a set of data of the file, first or second: left out, with a note that names the set', !set1.time && noteOf(set1, 'timeDataSet').params.key === 'Morning, demand'
    && !set2.time && noteOf(set2, 'timeDataSet').params.key === 'Evening');
  const cols = onFlow({ trig: 2, e1: LOW, e2: HIGH, t1: { tu: 'minutes', units: ['m3/hr', 'deg. C'], rows: [[0, 20, 15], [30, 35, 16], [60, 20, 17]] }, t2: { units: ['m3/hr'], rows: [[0, 20], [90, 5]] } });
  ok('two columns of values: each row read whole, the first column used, with a note; the second table read after the rows', cols.time && same(cols.time.tables, [
    { t: [0, 30, 60], v: [20, 35, 20], tUnit: 'min', vUnit: 'm³/h' }, { t: [0, 90], v: [20, 5], tUnit: 's', vUnit: 'm³/h' }]) && noteOf(cols, 'timeColumns').level === 'ignored', JSON.stringify(cols.time && cols.time.tables));
  const none = onFlow({ t1: {} });
  ok('an empty first table: no time data and no note', !none.time && !none.notes.some((n) => n.key.startsWith('time')));

  // the synthetic example of the specification (Annex D.9): a pump in fixed flow whose 0.05 kg/s fall to zero in 20 s
  // when the static pressure at the outlet of pipe 7 reaches 8 bar gauge
  const D9 = '0,0,0,0,1,1,1,8,barG,2,7,-1,-1,-1,-1,0,None,-1,-1,-1,-1,None,1,3,seconds,kg/sec,0,0.05,20,0,600,0,None,1,0,seconds,kg/sec'.split(',');
  const r9 = read(fth({ secs: [
    [BASE('JUNCTIONS'), [
      junc({ type: 2, id: 1, pipes: [-1], z: 5, t: tank({ level: 5, P: 0, Pu: 'barG' }) }),
      junc({ type: 17, id: 2, pipes: [1, -7], t: timed(pumpT({ mode: 1, q: 0.05, qu: 'kg/sec' }), 168, D9) }),
      junc({ type: 2, id: 3, pipes: [7], z: 20, t: tank({ level: 20, P: 0, Pu: 'barG' }) }),
    ]],
    [BASE('PIPES'), [pipe({ id: 1, from: 1, to: 2, L: 5, D: 5, z1: 5 }), pipe({ id: 7, from: 2, to: 3, L: 50, D: 5, z2: 20 })]],
  ] }));
  const e9 = M.effective(r9.model, 'base'), p9 = J(r9.model, 2).time;
  ok('the example of the specification (D.9): one event at the outlet of pipe 7, three points of mass flow, the empty second table left aside', same(p9, {
    use: true, what: 'Q', basis: 'absolute', start: 'single', when: [{ q: 'pStatic', obj: 'p:7', end: 'out', op: '>=', value: q(8, 'bar(g)') }],
    tables: [{ t: [0, 20, 600], v: [0.05, 0, 0], tUnit: 's', vUnit: 'kg/s' }], repeat: false, interp: 'linear', resume: 'current',
  }) && !PumpIt.time.inputs.check(e9.junctions.find((j) => j.id === 2), e9).length, JSON.stringify(p9));

  // a run: a valve by K closes when the flow of pipe 1 passes 1 m³/h, and opens again when the static pressure across it,
  // its inlet side less its outlet side, reaches 1.99 bar (two cyclic events; K = −1 is closed)
  const runText = fth({
    extra: ['[TRANSIENT CONTROL]', 'StartTime= 0', 'StopTime= 20', 'TimeUnits= seconds', 'TimeStep= 5', 'TimeStepUnits= seconds', 'Frequency= 1', 'DifferenceMethod= 0'],
    secs: [
      [BASE('JUNCTIONS'), [
        junc({ type: 4, id: 1, pipes: [-1], t: press({ P: 2, Pu: 'barG' }) }),
        junc({ type: 8, id: 2, pipes: [1, -2], spec: 0, t: timed(valve({ K: 2 }), 110, timeF({
          trig: 2, e1: { code: 4, cond: 0, v: 1, unit: 'm3/hr', obj: 1 }, e2: { code: 11, cond: 1, v: 1.99, unit: 'bar', obj: 2 },
          t1: { rows: [[0, 2], [10, -1]] }, t2: { rows: [[0, -1], [10, 2]] },
        })) }),
        junc({ type: 4, id: 3, pipes: [2], t: press({ P: 0, Pu: 'barG' }) }),
      ]],
      [BASE('PIPES'), [pipe({ id: 1, from: 1, to: 2, L: 10, D: 10 }), pipe({ id: 2, from: 2, to: 3, L: 10, D: 10 })]],
    ],
  }).replace('AnalysisType=1', 'AnalysisType=2');
  const rr = read(runText), effR = M.effective(rr.model, 'base'), vR = M.validate(effR);
  const sim = vR.ok ? PumpIt.time.run(effR) : null;
  const iAt = (t) => [...sim.times].findIndex((x) => Math.abs(x - t) < 1e-9);
  const started = sim && sim.ok ? sim.events.filter((e) => e.key === 'core.time.log.table.started').map((e) => `${e.t}:${e.params.n}`).join() : '';
  ok('in a run: the flow closes the valve at once, the pressure across it opens it at 10 s, the flow closes it again at 15 s', vR.ok && sim.ok && !sim.stopped && started === '0:1,10:2,15:1'
    && near(sim.series.inputs[2].v[iAt(5)], 8, 1e-9) && sim.series.pipes[1].Q[iAt(10)] === 0 && sim.series.pipes[1].Q[iAt(15)] > 0,
  vR.ok ? (sim.ok ? started : sim.errors.join('; ')) : JSON.stringify([...vR.undef]));
}

console.log('\nFinite tanks with the complement of Annex A.3 (version 1.1)');
{
  // the record of a reservoir from b+88: the model, the level by height (1) or by elevation (0) with its value and unit,
  // what is known at the start, the bottom, the height, the section (0 constant, else a table of volume by height), the
  // area, the exponent of the gas, the table of volume by height from b+101 (empty: 5 fields), the model of its
  // transient, its time data, then the relief and the vent pressures
  function tankA3({ np = 1, model = 1, byHeight = 1, level, known = 0, bottom = 0, height, section = 0, area = 0, n = 0, rows = [], hu = 'meters', vu = 'meters3', time = timeF({}), pMax = [0, 'psia'], pMin = [0, 'psia'], P = 0, Pu = 'barG' }) {
    const o = 5 * (np - 1);
    const base = tank({ conns: Array.from({ length: np }, () => [0, 0, 0]), P, Pu }).slice(0, 19 + o);
    return [...base, model, byHeight, level, 'meters', known, bottom, 'meters', height, 'meters', section, area, 'meters2', n,
      ...tableF({ tu: hu, units: [vu], rows }), 0, ...time, ...pMax, ...pMin];
  }
  const fileOf = (t) => fth({ secs: [
    [BASE('JUNCTIONS'), [junc({ type: 2, id: 1, pipes: [-1], t }), junc({ type: 3, id: 2, pipes: [1], t: flow({ q: 10, qu: 'm3/hr', out: true }) })]],
    [BASE('PIPES'), [pipe({ id: 1, from: 1, to: 2, L: 10, D: 10 })]],
  ] });
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const has = (r, key, level) => r.notes.some((x) => x.key === key && (!level || x.level === level) && x.objs.includes('J1'));
  // an open tank of a table of volume by height, whose three rows move its time data six fields on
  const surf = timeF({ trig: 0, t1: { tu: 'seconds', units: ['psig'], rows: [[0, 0], [60, 5]] } });
  const r1 = read(fileOf(tankA3({ level: 1.5, height: 2, section: 1, rows: [[0, 0], [1, 2], [2, 6]], time: surf })));
  const t1 = J(r1.model, 1).tank, d1 = J(r1.model, 1).time;
  ok('a table of volume by height (section other than 0) is read as the shape of the tank', t1 && t1.shape === 'table' && same(t1.table, { h: [0, 1, 2], V: [0, 2, 6], hUnit: 'm', vUnit: 'm³' }) && has(r1, 'tankOpen'), JSON.stringify(t1 && t1.table));
  ok('the time data come after the table and the model of the transient', d1 && d1.what === 'surfP' && same(d1.tables[0], { t: [0, 60], v: [0, 5], tUnit: 's', vUnit: 'psig' }), JSON.stringify(d1));
  ok('volumes written as m3 or in gallons', same(J(read(fileOf(tankA3({ level: 1, height: 2, section: 1, rows: [[0, 0], [2, 4]], vu: 'm3' }))).model, 1).tank.table.vUnit, 'm³')
    && same(J(read(fileOf(tankA3({ level: 1, height: 2, section: 1, rows: [[0, 0], [2, 4]], vu: 'gal' }))).model, 1).tank.table.vUnit, 'gal'));
  const bad = read(fileOf(tankA3({ level: 1, height: 2, section: 1, rows: [[0, 0], [2, 4]], vu: 'hogsheads' })));
  ok('a unit of volume that is not known: a note, and an infinite reservoir', !J(bad.model, 1).tank && has(bad, 'tankShape') && bad.notes.some((x) => x.key === 'unit'));
  // a closed tank: the exponent of its gas, its relief pressure, and a vent at vacuum, which is none
  const r2 = read(fileOf(tankA3({ model: 2, level: 1, height: 4, area: 2, n: 1.2, known: 2, pMax: [50, 'psig'], pMin: [0, 'psia'] })));
  const t2 = J(r2.model, 1).tank;
  ok('a closed tank: the exponent of its gas and its relief pressure; a vent at vacuum is none', t2 && t2.model === 'closed' && t2.gas.n === 1.2 && same(t2.gas.pMax, q(50, 'psig')) && t2.gas.pMin.value === null && has(r2, 'tankClosedGas'), JSON.stringify(t2 && t2.gas));
  ok('known 2: the level is known and the pressure of the gas is calculated', same(t2.known, { level: true, pressure: false }));
  ok('a closed tank without an exponent asks for it', has(read(fileOf(tankA3({ model: 2, level: 1, height: 4, area: 2 }))), 'tankClosed', 'missing'));
  const r3 = read(fileOf(tankA3({ level: 1, height: 4, area: 2, known: 1 })));
  ok('known 1: the pressure is known and the level is calculated', same(J(r3.model, 1).tank.known, { level: false, pressure: true }));
  const r4 = read(fileOf(tankA3({ level: 1, height: 4, area: 2, known: 2 })));
  ok('an open tank always knows its pressure: known 2 is taken as both known, with a note', same(J(r4.model, 1).tank.known, { level: true, pressure: true }) && has(r4, 'tankKnown', 'assumed'));
  const eff = M.effective(r2.model, 'base');
  eff.solution.time.on = true;
  ok('the closed tank read is complete for the time simulation', M.validate(eff).ok, JSON.stringify([...M.validate(eff).undef]));
}

console.log('\nTexts');
{
  // the notes of the importer, and those of the parts it shares with the .aro importer
  const src = ['fth.js', 'shared.js'].map((f) => fs.readFileSync(path.join(ROOT, 'src/core/import', f), 'utf8')).join('\n');
  const noteKeys = [...src.matchAll(/note\('(\w+)', '(\w+)'/g)].map((x) => x[2]).concat(['pipeCount', 'unsupported']);
  const kinds = [...src.match(/const KINDS = \{([\s\S]*?)\};/)[1].matchAll(/'(\w+)'/g)].map((x) => x[1]).concat(['unknown']);
  const missing = [];
  for (const { code } of PumpIt.i18n.languages()) {
    const cat = PumpIt.i18n.catalog(code);
    for (const k of noteKeys) if (!cat.has('core.import.notes.' + k)) missing.push(`${code}: notes.${k}`);
    for (const k of kinds) if (!cat.has('core.import.kinds.' + k)) missing.push(`${code}: kinds.${k}`);
  }
  ok(`every note (${new Set(noteKeys).size}) and kind (${kinds.length}) has its text in every language`, !missing.length, missing.slice(0, 4).join(', '));
  const bad = [];
  for (const lang of ['pt-BR', 'en', 'es']) {
    PumpIt.i18n.setLanguage(lang);
    for (const n of allNotes) { const s = FTH.noteText(n); if (!s || /\{\w+\}/.test(s)) bad.push(`${lang}: ${n.key} → ${s}`); }
  }
  PumpIt.i18n.setLanguage('en');
  ok(`every note of these imports (${new Set(allNotes.map((n) => n.key)).size} kinds) reads in every language`, !bad.length, bad.slice(0, 3).join(' | '));
  ok(`every model of these imports (${allModels.length}) has the ids the interface accepts`, allModels.every((m) => M.idsWellFormed(m)));
}

console.log('\nThe validation script (tests/validate-fth.js) on a synthetic file');
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pumpit-fth-'));
  const ref0 = reference(0);
  const r0 = run(ref0);
  const file = path.join(dir, 'synthetic.fth');
  fs.writeFileSync(file, netFile({ branchK: 0, archive: archiveOf(r0, RHO, 1.002e-3) }), 'latin1');
  const { buildCase, compare } = require('./validate-fth.js');
  const cs = buildCase(file);
  const out = cs.skip ? { err: cs.skip } : compare(cs);
  ok('it reads the file and finds the stored results', out.worst !== undefined && out.worst < 1e-6, out.worst !== undefined ? `worst ${out.worst.toExponential(1)}` : out.err);
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('\nThe drawing of junctions with a stray coordinate');
{
  // three junctions close together and two on the same spot far away (1e30): a step of the grid no longer moves them there
  const js = [1, 2, 3, 4, 5].map((id) => ({ id }));
  const raw = new Map([[1, [0, 0]], [2, [1, 0]], [3, [2, 0]], [4, [1e30, 0]], [5, [1e30, 0]]]);
  const notes = [];
  PumpIt.importShared.place(js, raw, (level, key) => notes.push(key));
  ok('the junctions go on a grid, each on its own spot, and the import says so (was a tab that hung)',
    new Set(js.map((j) => j.x + ',' + j.y)).size === 5 && js.every((j) => j.x < 1000 && j.y < 1000) && notes.includes('layout'), js.map((j) => j.x + ',' + j.y).join(' '));
}

console.log(`\n${passed} checks passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
