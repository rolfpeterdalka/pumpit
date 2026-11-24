// Import of .imp model files (src/core/import/imp.js, with the reader of the network of a liquid it shares with the .fth
// importer, liquid.js, and the reader of the blocks of the kinds of junction, items.js). Usage: node tests/imp-import.test.cjs
//
// Every file of these checks is synthetic: this script writes it from the items of Annex A of the description of the
// .imp format written by the specification team (23 November 2026; decisions in docs/imp-import.md). The first line of a
// file is written with a word of these tests, given to the importer in place of the word of the program. No file of
// another program is read.
const fs = require('fs');
const path = require('path');
const { ROOT, loadCore } = require('./load-core');

const PumpIt = loadCore();
const M = PumpIt.model, S = PumpIt.solver, U = PumpIt.units, IMP = PumpIt.importers.imp, FTH = PumpIt.importers.fth;
const X = PumpIt.importShared, IT = PumpIt.importItems, JS = PumpIt.junctionTypes.shared;
const q = M.q;
const LBM = 0.45359237, FT = 0.3048, PSI = U.PSI;

let passed = 0, failed = 0;
function ok(name, cond, detail = '') {
  if (cond) passed++; else failed++;
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
}
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const allNotes = [], allModels = [];
function read(text, opts = {}) { const r = IMP.read(text, Object.assign({ name: 'synthetic.imp' }, opts)); allNotes.push(...r.notes); allModels.push(r.model); return r; }
const hasNote = (res, key, obj) => res.notes.some((n) => n.key === key && (!obj || n.objs.includes(obj)));
const J = (m, id) => m.junctions.find((j) => j.id === id);
const P = (m, id) => m.pipes.find((p) => p.id === id);
const run = (m) => S.run(M.effective(m, 'base'));
const thrown = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };

// the words of the programs of the family, for the first lines of these files
const saved = Object.assign({}, X.PROGRAMS);
Object.assign(X.PROGRAMS, { transient: X.wordHash('SOMETRANSIENT'), liquid: X.wordHash('SOMELIQUID'), gas: X.wordHash('SOMEGAS') });
const HEADER = 'ABC SOMETRANSIENT VERSION 10 INPUT FILE';

// ---------- writer of the format

// pipe: ID, name, length unit, elevation unit, inlet elevation, number of segments and their pairs (length, elevation at
// the end), one field, number of drawing points and the points (x, y, z), then the block b (section 11.1, as in .fth)
function pipe(o) {
  const segs = o.segs || (o.L != null ? [[o.L, o.z2 || 0]] : []);
  const pts = o.pts || [[0, 0, 0], [100, 0, 0]];
  const blk = new Array(64).fill('0');
  Object.assign(blk, { 0: 'None', 1: '-1', 3: o.from, 4: o.to, 5: o.D, 6: o.Du || 'cm', 8: 'None', 10: 'None', 11: 'None' });
  const [code, val, unit] = o.fric || ['0', 0.0045, 'cm'];
  Object.assign(blk, { 12: code, 13: val, 14: unit, 17: 'None', 18: 'None', 19: 'None', 20: o.K || 0, 21: '06 None', 22: 1, 23: 1, 26: 'None', 32: 'None', 34: 'None', 36: 'None', 38: o.special || 0, 39: 'None', 40: 1 });
  const head = [o.id, o.name || 'Pipe', segs.length ? o.Lu || 'meters' : 'None', o.zu || 'meters', o.z1 || 0, segs.length, ...segs.flat(), 0, pts.length, ...pts.flat()];
  // the transient block, its anchor w (the unit of the wave speed) at b+116, or further with more fields before it
  const surge = o.surge ? [...new Array(42 + (o.extra || 0)).fill('0'), ...surgeBlock(o.surge)] : [];
  return [...head, ...blk, ...surge].join(',');
}
// the transient block of a pipe from w−10 (section 11.2): the bulk modulus of the pipe and its unit, partly full, the
// wall and its unit, E and its unit, ν, the origin of a, a and its unit (w), the impedance, the sections, the support,
// c1, the stations (code, count and five places), w+12 to w+20, the ambient fluid, the stiffness of the rock eight fields
// after it with its unit, two fields and the increase of a buried pipe in the last field
function surgeBlock(s = {}) {
  const list = s.list || [];
  return [s.K || 0, s.Ku || 'psia', s.full == null ? -1 : s.full, s.e || 0, s.eu || 'mm', s.E || 0, s.Eu || 'psia', s.nu == null ? -1 : s.nu, s.src == null ? 1 : s.src,
    s.a == null ? 1200 : s.a, s.au || 'meters/sec', s.Z || 0, s.n || 0, s.sup == null ? 2 : s.sup, s.c1 || 0, s.st == null ? 1 : s.st, list.length,
    ...[0, 1, 2, 3, 4].map((i) => (list[i] != null ? list[i] : -1)), ...new Array(9).fill(0), 'AIR', ...new Array(7).fill(0), s.G || 0, s.Gu || 'psia', 0, 0, s.buried || 0];
}
// a pipe record of a child scenario with the lists of its parent (one segment, two points): the block b of empty fields,
// packed so that the transient block starts 9 fields before its place in the whole record (I-10), w at b+107; set: the
// fields it changes, by their place from w
function deltaP(id, set = {}) {
  const head = [id, '', '', '', '', -1, '', '', '', -2, '', '', '', '', '', ''];
  const blk = new Array(107 + 34).fill('');
  for (const [k, v] of Object.entries(set)) blk[107 + Number(k)] = v;
  return [...head, ...blk].join(',');
}
// the sections of the control of the run and of the sectioning (sections 8 and 9); a key given as undefined is left out
const TC = { StartTime: 0, StopTime: 10, TimeUnits: 'seconds', Frequency: 1, TotalSteps: 200, ModelCavitation: 1, Psi: 0.5, VoidFraction: '1E-07', VoidFractionPressure: 1, VoidFractionPressureUnits: 'atm',
  CavitationPressureType: 0, VariableResistance: 0, StopOnArtificialTransient: -1, Criteria: 0.5, CriteriaMinFlow: 0, CriteriaMinFlowUnits: 'kg/sec', NumDecelPoints: 10, UseThreads: 1 };
const SC = { MinSections: 1, MaxSections: 20, MaxErrorOption: 1, MaxError: 10, PctBandwidth: 25, PctIncrement: 0.05, IdealSections: 10, TimeStep: 0.05, SolutionGridType: 0 };
const keyLines = (o) => Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}= ${v}`);
const control = (tc = {}, sc = {}) => [['TRANSIENT CONTROL', keyLines(Object.assign({}, TC, tc))], ['SECTIONING', keyLines(Object.assign({}, SC, sc))]];
// the impedance a/A of a pipe in the internal US units of the format, psi per lbm/s
const impedance = (a, D) => (a / (Math.PI * D * D / 4)) * LBM / PSI;
// a block of a kind written from the items of Annex A: the values given by name (a field: its value; a list: its
// values; a table: { key, tu, units, rows }; an event: its 8 fields; perPipe: the fields of each pipe; a group: its
// elements; cfg: the configurations of a pump, each an object of its own items), the others as unused
function items(list, v, np) {
  const out = [];
  for (const it of list) {
    const x = it.name !== undefined ? v[it.name] : undefined;
    if (it.kind === 'skip') out.push(0);
    else if (it.kind === 'field') out.push(x !== undefined ? x : /U$/.test(it.name) ? 'None' : 0); // an unused unit is None
    else if (it.kind === 'event') out.push(...(x || [-1, -1, 0, 'None', -1, -1, -1, -1]));
    else if (it.kind === 'perPipe') for (let i = 0; i < np; i++) out.push(...((x && x[i]) || new Array(it.w).fill(0)));
    else if (it.kind === 'list') out.push((x || []).length, ...(x || []));
    else if (it.kind === 'group') out.push((x || []).length, ...(x || []).flat());
    else if (it.kind === 'table') {
      const tb = x || {}, rows = tb.rows || [], units = tb.units || ['None'];
      out.push(tb.key || 'None', units.length, rows.length, tb.tu || 'seconds', ...units, ...rows.flat());
    } else if (it.kind === 'cfg') for (const c of v.cfg || []) out.push(...items(IT.parse(IT.CFG), c, np));
  }
  return out;
}
const block = (type, v = {}, np = 1) => items(IT.parse(IT.SCHEMAS[type]), Object.assign(v.cfg ? { cfgCount: v.cfg.length } : {}, v), np);
// junction: type, ID, two fields, name, number of pipes, signed list (− leaves, + arrives), common block b+0..b+45, its
// tables closed by the anchor −999 (at b+68), and the block of the type (section 12.1, as in .fth)
const COMMON_TABLES = ['1', '-1', '3', '1', '%ALL%', '3', 'Percent', '1', '100', '2', '100', '3', '100', '0', '2', 'years', '-9999', '-9999', '4', '0', '5', '0', '-999'];
function junc(o) {
  const blk = new Array(46).fill('0');
  Object.assign(blk, { 0: o.x || 0, 1: o.y || 0, 2: -1, 4: 24, 5: -1, 7: o.z || 0, 9: o.zu || 'meters', 14: 'None', 15: 1, 18: 'None', 20: 'None', 22: 'None', 23: 'None', 24: o.spec == null ? -1 : o.spec, 25: o.spec === 1 ? 1 : 0, 26: '' });
  const t = Array.isArray(o.t) ? o.t : block(o.type, o.t || {}, o.pipes.length);
  return [o.type, o.id, 1, 8, o.name || '', o.pipes.length, ...o.pipes, ...blk, ...COMMON_TABLES, ...t].join(',');
}
// record of a child scenario: the head, the list of pipes (−n keeps that of the parent), the common block of empty
// fields, packed tables closed by the anchor and the block of the type
const COMPACT = ['', '', '', '0', '0', '', '0', '-2', '', '', '', '', '', '', '-0', '-999'];
function deltaJ({ type, id, pipes = null, nPar = 1, t = [] }) {
  const list = pipes || new Array(nPar).fill('');
  return [type, id, '', '', '', pipes ? pipes.length : -nPar, ...list, ...new Array(46).fill(''), ...COMPACT, ...t].join(',');
}
// a whole file; header: its first line
function imp({ fluid = {}, scen = [['Base Scenario', '']], secs, app = {}, header = HEADER, extraFluid = [], analysis = 3 }) {
  const L = [header, '[APPLICATION]', ...Object.entries(app).map(([k, v]) => `${k}= ${v}`)];
  L.push('[SCENARIO MANAGER]', `Number of Scenarios= ${scen.length}`);
  scen.forEach(([n, p, d = ''], i) => L.push(`Scenario #${i + 1}= ${n},${p},${d.length},${d},0,0,0,0`));
  const f = { name: 'Synthetic water', T: '20,deg. C', rho: '998.2,kg/m3', mu: '1.002,centipoise', pv: '2.339,kPa', amb: '1,atm', ...fluid };
  L.push('[SETTINGS]', `AnalysisType= ${analysis}`, '[FLUID DATA]', 'Number of Fluids= 1', `Fluid 1= ${f.name},0,${f.name},0`, `Ambient Pressure= ${f.amb}`,
    `Temperature= ${f.T}`, `Density= ${f.rho}`, `Viscosity= ${f.mu}`, `Vapor Pressure= ${f.pv}`, 'Gravity= 1', 'Properties= 0', 'Viscosity Model= 0',
    'ReTransLam= 2300', 'ReTransTurb= 4000', 'AltLossFactorMethod= 0', ...extraFluid);
  L.push('[OUTPUT PREFERENCES]', 'Analysis Title= Synthetic test');
  for (const [name, lines] of secs) L.push(`[${name}]`, ...lines);
  return L.join('\r\n') + '\r\n';
}
const BASE = (name) => `${name} -- SCENARIO #1 -- Base Scenario`;
// stored results in the US units of the format, from a calculation of Pump It (section 16: the pipes as in .fth files;
// the junctions with their own columns, I-34)
const pipeArchive = (r, rho, mu) => Object.entries(r.pipes).map(([id, x]) => [id, x.m / LBM, 0, x.P0in / PSI, x.P0out / PSI, 527.67, 527.67, rho / (LBM / FT ** 3), mu / (LBM / FT), 0, 0].join(','));
// a reservoir block: surface pressure, level and the K values of its pipes (P5: K out of it, K into it, two fields, depth)
const tank = ({ ks = [[0, 0]], P = 0, Pu = 'barG', level = 0, lu = 'meters' } = {}) => ({ perPipe: ks.map(([a, b]) => [a, b, 0, 0, 0]), depthU: 'meters', surfP: P, surfPU: Pu, level, levelU: lu });

console.log('\nFile and first line (I-01, I-T1)');
{
  const net = (o = {}) => imp(Object.assign({
    secs: [
      [BASE('JUNCTIONS'), [junc({ type: 2, id: 1, pipes: [-1], t: tank({ level: 20 }) }), junc({ type: 4, id: 2, pipes: [1], t: { perPipe: [[0, 0, 0]], p: 0, pU: 'barG' } })]],
      [BASE('PIPES'), [pipe({ id: 1, from: 1, to: 2, L: 100, D: 20 })]],
    ],
  }, o));
  const r = read(net());
  ok('a model of version 10 is read, by the word of its program', r.version === 10 && r.model.pipes.length === 1 && r.model.junctions.length === 2);
  ok('a reservoir and an imposed pressure, as in .fth files', J(r.model, 1).type === 'reservoir' && J(r.model, 2).type === 'pressure');
  const body = net().split('\r\n').slice(1).join('\r\n');
  const fthMsg = thrown(() => IMP.read('ABC SOMELIQUID VERSION 11 INPUT FILE\r\n' + body)), aroMsg = thrown(() => IMP.read('ABC SOMEGAS VERSION 10 INPUT FILE\r\n' + body));
  ok('a liquid model of the .fth format is refused, with the extension to give it', fthMsg === PumpIt.i18n.t('core.imp.liquidModel') && /\.fth/.test(fthMsg), fthMsg);
  ok('a gas model of the .aro format is refused, with the extension to give it', aroMsg === PumpIt.i18n.t('core.imp.gasModel') && /\.aro/.test(aroMsg), aroMsg);
  ok('a model of another program is refused', thrown(() => IMP.read('XYZ OTHER VERSION 10 INPUT FILE\r\n' + body)) === PumpIt.i18n.t('core.imp.otherProgram'));
  ok('the .fth importer still refuses a transient model', thrown(() => FTH.read(net())) === PumpIt.i18n.t('core.fth.otherProgram'));
  ok('a file without the first line of a model but with a network is read', read('Some text\r\n' + body).model.pipes.length === 1);
  ok('a file without the first line of a model and without a network is refused', thrown(() => IMP.read('Some text\r\n[SETTINGS]\r\nAnalysisType= 3\r\n')) === PumpIt.i18n.t('core.imp.notImp'));
  ok('another version is read as version 10, with a note', hasNote(read(net({ header: 'ABC SOMETRANSIENT VERSION 9 INPUT FILE' })), 'impVersion') && !hasNote(r, 'impVersion'));
  ok('the importer is offered for the extension .imp', Object.keys(PumpIt.importers).includes('imp') && IMP.encoding === 'windows-1252');
  // without the module of the water hammer in the page, the network comes in alone, with a note (P4, W-01)
  const SG = PumpIt.surge;
  delete PumpIt.surge;
  const alone = read(net({ secs: [...control(), ...[[BASE('JUNCTIONS'), [junc({ type: 2, id: 1, pipes: [-1], t: tank({ level: 20 }) }), junc({ type: 4, id: 2, pipes: [1], t: { perPipe: [[0, 0, 0]], p: 0, pU: 'barG' } })]], [BASE('PIPES'), [pipe({ id: 1, from: 1, to: 2, L: 100, D: 20, surge: {} })]]]] }));
  PumpIt.surge = SG;
  ok('without the module of the water hammer, its data are left out, with a note', hasNote(alone, 'surgeLeftOut') && alone.model.solution.surge === undefined && !alone.model.pipes[0].surge && !hasNote(r, 'surgeLeftOut'));
  // the sections and keys of a child scenario in capitals (section 5)
  const two = imp({
    scen: [['Base Scenario', ''], ['Heavier', 'Base Scenario']],
    secs: [
      [BASE('JUNCTIONS'), [junc({ type: 2, id: 1, pipes: [-1], t: tank({ level: 20 }) }), junc({ type: 4, id: 2, pipes: [1], t: { perPipe: [[0, 0, 0]], p: 0, pU: 'barG' } })]],
      [BASE('PIPES'), [pipe({ id: 1, from: 1, to: 2, L: 100, D: 20 })]],
      ['FLUID DATA -- SCENARIO #2 -- HEAVIER', ['DENSITY= 1100,kg/m3']],
    ],
  });
  const r2 = read(two, { scenario: 2 });
  ok('a child scenario changes the fluid with its keys in capitals', near(U.toSI(r2.model.system.fluid.rho.value, r2.model.system.fluid.rho.unit, 'density'), 1100));
  // add-on modules and the keys of the fluid that the steady state does not take (sections 6 and 10)
  const r3 = read(net({ app: { 'PFA Use': -1 }, extraFluid: ['Ambient Pressure Variation= 1', 'VariableGExists= -1', 'Bulk Modulus= 2.2,GPa'] }));
  ok('an add-on module switched on is reported', hasNote(r3, 'addOns'));
  ok('an ambient pressure varying with the elevation is reported', hasNote(r3, 'ambientVariation') && !hasNote(r, 'ambientVariation'));
  ok('a gravity varying in time is reported', hasNote(r3, 'variableGravity') && !hasNote(r, 'variableGravity'));
}

console.log('\nItems of the blocks (I-08, I-09, I-T4)');
{
  // the positions the descriptions state, against the walk of a record written from Annex A
  const walk = (type, v, np = 1) => IT.walk(block(type, v, np).map(String), 0, IT.schemaOf(type), np).by;
  const coef = (n) => Array.from({ length: n }, (_, i) => i + 1);
  ok('valve: L:coef at t+8 and loss at t+9+nc+7, as in .fth files (Annex A)', walk(8, { coef: coef(4) }).coef.at === 8 && walk(8, { coef: coef(4) }).loss.at === 9 + 4 + 7);
  ok('pump: cfgSel at t+11 and cfgCount at t+12, as in .fth files', walk(17, {}).cfgSel.at === 11 && walk(17, {}).cfgCount.at === 12);
  ok('generic component: loss at t+11+nc (I-05)', walk(20, { coef: coef(3) }).loss.at === 11 + 3);
  const res = walk(2, {});
  ok('reservoir: the finite tank at b+88 to b+101 (Annex A.3 of the time simulation, t = b+69)',
    res.tankType.at === 88 - 69 && res.levelType.at === 89 - 69 && res.level.at === 90 - 69 && res.known.at === 92 - 69 && res.bottom.at === 93 - 69
    && res.height.at === 95 - 69 && res.useVolTable.at === 97 - 69 && res.area.at === 98 - 69 && res.nGas.at === 100 - 69 && res.volTable.at === 101 - 69);
  // the triggers of the time data where Annex A.2 of the time simulation saw them in .fth files (b+n, t = b+69)
  const trig = (type, v, np) => walk(type, v, np).trig.at + 69;
  ok('the trigger of a branch with two pipes at b+89, of an imposed flow at b+83, of an imposed pressure at b+92 (Annex A.2)',
    trig(1, {}, 2) === 89 && trig(3, {}, 1) === 83 && trig(4, {}, 1) === 92 && trig(4, {}, 2) === 95);
  ok('the trigger of a reservoir with one pipe at b+111, of a valve at b+110 (6 coefficients), of a control valve between b+97 and b+105',
    trig(2, {}, 1) === 111 && trig(2, {}, 2) === 116 && trig(8, { coef: coef(6) }, 2) === 110 && trig(9, {}, 2) >= 97 && trig(9, {}, 2) <= 105);
  ok('the trigger of a nozzle between b+103 and b+105 with one pipe, at b+108 with two', [3, 4, 5].every((n) => trig(16, { coef: coef(n) }, 1) === 100 + n) && trig(16, { coef: coef(5) }, 2) === 108);

  // every kind of Annex A, with its lists, tables and groups filled, walks to the end of its record
  const full = {
    coef: [1, 2, 3], cons: [7, 8], mult: { tu: 'inches', units: ['None'], rows: [[1, 1], [2, 1.1]] }, table1: { tu: 'seconds', units: ['Percent'], rows: [[0, 100], [5, 0]] },
    table2: { units: ['Percent'], rows: [[0, 0], [2, 100], [4, 50]] }, openTable: { tu: 'Percent', units: ['None'], rows: [[0, 0], [100, 300]] },
    rates: [[0, 100, 2, 3], [50, 100, 4, 5]], seals: [[1, 2, 3]], volTable: { tu: 'meters', units: ['m3'], rows: [[0, 0], [5, 10]] },
    cvTheta: { tu: 'degrees', units: ['None'], rows: [[0, 0], [30, 50], [60, 100]] }, decelCoef: [0.1, 0.2], fqData: { tu: 'degrees', units: ['None', 'None'], rows: [[0, 0.6, -0.8], [360, 0.6, -0.8]] },
    geoTable: { tu: 'meters', units: ['m3'], rows: [[0, 0], [1, 2]] }, cvTable: { tu: 'Percent', units: ['None'], rows: [[0, 0], [100, 50]] },
    cfg: [{ cfgH: [70, 0, -1000], cfgN: [2], cfgE: [0, 9, -40] }, { cfgH: [60, 0, -900], cfgE: [] }],
  };
  const kinds = Object.keys(IT.SCHEMAS).map(Number);
  const bad = [];
  for (const type of kinds) {
    const f = block(type, full, 2).map(String);
    const w = IT.walk(f, 0, IT.schemaOf(type), 2);
    if (!IT.fits(w, f) || w.end !== f.length) bad.push(type);
  }
  ok(`each of the ${kinds.length} kinds of Annex A walks to the end of its record, with filled lists and tables`, !bad.length, bad.join(', '));

  // a record that ends one field before (I-08) and one that ends elsewhere
  const valveRec = (t) => imp({
    secs: [
      [BASE('JUNCTIONS'), [junc({ type: 2, id: 1, pipes: [-1], t: tank({ level: 20 }) }), junc({ type: 8, id: 2, pipes: [1, -2], t }), junc({ type: 4, id: 3, pipes: [2], t: { perPipe: [[0, 0, 0]], p: 0, pU: 'barG' } })]],
      [BASE('PIPES'), [pipe({ id: 1, from: 1, to: 2, L: 100, D: 20 }), pipe({ id: 2, from: 2, to: 3, L: 100, D: 20 })]],
    ],
  });
  const vb = block(8, { lossType: 1, loss: 2.5, eqU: 'feet' });
  const rShort = read(valveRec(vb.slice(0, -1))), rLong = read(valveRec([...vb, 0, 0])), rOk = read(valveRec(vb));
  ok('a record one field short reads, without a note (I-08)', J(rShort.model, 2).K === 2.5 && !hasNote(rShort, 'recordLength'));
  ok('a record that ends elsewhere is reported', hasNote(rLong, 'recordLength', 'J2') && !hasNote(rOk, 'recordLength'));

  // the merge of a child record, item by item
  const merged = (type, parent, child, np = 1, nPar = np) => {
    const pf = junc({ type, id: 5, pipes: Array.from({ length: np }, (_, i) => (i ? -(i + 1) : i + 1)), t: block(type, parent, np) }).split(',');
    const df = deltaJ({ type, id: 5, nPar, t: child }).split(',');
    const out = IT.mergeJunctionItems(pf, df, {});
    return IT.itemsOf(out, X.junctionLayout(out).t, X.junctionLayout(out).np);
  };
  // a child of a check valve: an empty field inherits, a filled one replaces; a table with new rows, each empty value
  // taking that of the parent at its row and column
  const sch10 = IT.parse(IT.SCHEMAS[10]);
  const blank10 = (v) => {
    // a child block: every field empty but those given; lists, tables and groups with the counts given (−n, 0 or n)
    const out = [];
    for (const it of sch10) {
      const x = it.name !== undefined ? v[it.name] : undefined;
      if (it.kind === 'skip' || it.kind === 'field') out.push(x !== undefined ? x : '');
      else if (it.kind === 'event') out.push(...new Array(8).fill(''));
      else if (it.kind === 'list') out.push(...(x || ['0']));
      else if (it.kind === 'table') out.push(...(x || ['', '-1', '0', '', '']));
    }
    return out;
  };
  const par10 = { lossType: 0, loss: 400, model: 2, thMax: 60, cvTheta: { tu: 'degrees', units: ['None'], rows: [[0, 0], [30, 45], [60, 100]] } };
  const m1 = merged(10, par10, blank10({ loss: '350', cvTheta: ['', '-1', '4', '', '', '0', '0', '20', '', '40', '70', '60', '100'] }), 2);
  const tb = m1.table('cvTheta');
  ok('a child replaces a filled field and inherits an empty one', m1.n('loss') === 350 && m1.n('lossType') === 0 && m1.n('thMax') === 60 && m1.n('model') === 2);
  ok('a child table with new rows: empty values take those of the parent at their row and column',
    tb.rows.length === 4 && JSON.stringify(tb.rows) === JSON.stringify([[0, 0], [20, 45], [40, 70], [60, 100]]) && tb.tu === 'degrees', JSON.stringify(tb.rows));
  const m2 = merged(10, par10, blank10({ cvTheta: ['', '-1', '-3', '', '', '', '', '', '50', '', ''] }), 2);
  ok('a child table with −n rows keeps those of the parent, its filled values replacing', JSON.stringify(m2.table('cvTheta').rows) === JSON.stringify([[0, 0], [30, 50], [60, 100]]));
  const m3 = merged(10, par10, blank10({ cvTheta: ['', '', '', '', '', '', '', '', '55', '', ''] }), 2);
  ok('a table whose counts are empty in the child keeps the size of the parent', JSON.stringify(m3.table('cvTheta').rows) === JSON.stringify([[0, 0], [30, 55], [60, 100]]));
  // a child with −999 and empty units inherits the None of the parent: no unit, so no counterweight and no spring (second answers)
  const mNo = merged(10, Object.assign({}, par10, { cwLU: 'None', cwWU: 'None', cwIU: 'None', ksU: 'None', Ts0U: 'None', cwAngle: -181 }), blank10({ cwL: '-999', cwW: '-999', cwI: '-999', cwAngle: '-999', ks: '-999', Ts0: '-999' }), 2);
  ok('a child with −999 and empty units inherits None from the parent', ['cwLU', 'cwWU', 'cwIU', 'ksU', 'Ts0U'].every((k) => mNo.v(k) === 'None') && mNo.n('cwL') === -999 && mNo.n('cwAngle') === -999);
  const m4 = merged(10, Object.assign({}, par10, { decelCoef: [1, 2, 3] }), blank10({ decelCoef: ['-3', '', '-5', ''] }), 2);
  ok('a counted list −n keeps the list of the parent; a value is never taken for a count', JSON.stringify(m4.list('decelCoef')) === JSON.stringify(['1', '-5', '3']));
  const m5 = merged(10, Object.assign({}, par10, { decelCoef: [1, 2, 3] }), blank10({ decelCoef: ['2', '', '9'] }), 2);
  ok('a counted list n is a new list, an empty value taking that of the parent', JSON.stringify(m5.list('decelCoef')) === JSON.stringify(['1', '9']));
  const m6 = merged(10, Object.assign({}, par10, { decelCoef: [1, 2, 3] }), blank10({}), 2);
  ok('a counted list 0 is the list of the parent', JSON.stringify(m6.list('decelCoef')) === JSON.stringify(['1', '2', '3']) && m6.walk.end === m6.walk.end);
  // a group of a control valve and the configurations of a pump, element by element
  const sch9 = IT.parse(IT.SCHEMAS[9]);
  const child9 = [];
  for (const it of sch9) {
    if (it.kind === 'group') child9.push('-2', '', '', '', '', '', '', '6', '');
    else if (it.kind === 'table') child9.push('', '-1', '0', '', '');
    else if (it.kind === 'list') child9.push('0');
    else if (it.kind === 'event') child9.push(...new Array(8).fill(''));
    else child9.push('');
  }
  const g = merged(9, { rates: [[0, 100, 2, 3], [50, 100, 4, 5]], set: 3 }, child9, 2).group('rates');
  ok('a group −n keeps the elements of the parent, field by field', JSON.stringify(g) === JSON.stringify([['0', '100', '2', '3'], ['50', '100', '6', '5']]), JSON.stringify(g));
  const sch17 = IT.parse(IT.SCHEMAS[17]), cfgItems = IT.parse(IT.CFG);
  const child17 = [];
  for (const it of sch17) {
    if (it.name === 'cfgCount') child17.push('-2');
    else if (it.kind === 'cfg') {
      // the first configuration as it was, the second with one coefficient of its head changed
      for (let k = 0; k < 2; k++) for (const c of cfgItems) {
        if (c.kind === 'list') child17.push(...(k === 1 && c.name === 'cfgH' ? ['-3', '', '-1', ''] : ['0']));
        else child17.push('');
      }
    } else if (it.kind === 'table') child17.push('', '-1', '0', '', '');
    else if (it.kind === 'list' || it.kind === 'group') child17.push('0');
    else if (it.kind === 'event') child17.push(...new Array(8).fill(''));
    else if (it.name === 'speed') child17.push('0.9');
    else child17.push('');
  }
  const pm = merged(17, { cfgSel: 2, speed: 1, cfg: full.cfg }, child17, 2);
  ok('the configurations of a pump merge one by one, with their lists (I-03)', pm.cfgs.length === 2 && JSON.stringify(pm.cfgs[1].list('cfgH')) === JSON.stringify(['60', '-1', '-900'])
    && JSON.stringify(pm.cfgs[0].list('cfgH')) === JSON.stringify(['70', '0', '-1000']) && pm.n('speed') === 0.9 && pm.v('cfgCount') === '2');
  // the fields of each pipe follow their pipe when a child changes the list of pipes (as in .fth files, F-08)
  const sch1 = IT.parse(IT.SCHEMAS[1]);
  const child1 = [];
  for (const it of sch1) {
    if (it.kind === 'perPipe') child1.push('', '', '', '', '2.5', '', '', '', ''); // the K of pipe 3, new in the list
    else if (it.kind === 'table') child1.push('', '-1', '0', '', '');
    else if (it.kind === 'event') child1.push(...new Array(8).fill(''));
    else child1.push('');
  }
  const pf1 = junc({ type: 1, id: 7, pipes: [1, -2], t: block(1, { perPipe: [[1, 0.5, 0], [1, 0.8, 0]], src: 3, srcU: 'liter/sec' }, 2) }).split(',');
  const df1 = deltaJ({ type: 1, id: 7, pipes: [-2, 3, 1], t: child1 }).split(',');
  const o1 = IT.mergeJunctionItems(pf1, df1, {}), lay = X.junctionLayout(o1), b1 = IT.itemsOf(o1, lay.t, lay.np);
  ok('the fields of each pipe of a branch follow their pipe in a new list of pipes', lay.np === 3 && JSON.stringify([0, 1, 2].map((i) => b1.perPipe(i)[1])) === JSON.stringify(['0.8', '2.5', '0.5']) && b1.n('src') === 3, JSON.stringify([0, 1, 2].map((i) => b1.perPipe(i))));
}

console.log('\nCorrections of the steady state (section 4.3, I-T6)');
{
  // reservoir → P1 → J2 → P2 → J3 → P3 → J4 (an end), all pipes of 20 cm
  const fileOf = (j2, j3, j4, extra = {}) => imp(Object.assign({
    secs: [
      [BASE('JUNCTIONS'), [junc({ type: 2, id: 1, pipes: [-1], t: tank({ level: 30 }) }), j2, j3, j4]],
      [BASE('PIPES'), [pipe({ id: 1, from: 1, to: 2, L: 100, D: 20 }), pipe({ id: 2, from: 2, to: 3, L: 100, D: 20 }), pipe({ id: 3, from: 3, to: 4, L: 100, D: 20 })]],
    ],
  }, extra));
  const end = junc({ type: 4, id: 4, pipes: [3], t: { perPipe: [[0, 0, 0]], p: 0, pU: 'barG' } });
  const nodeOf = (id, pipes) => junc({ type: 1, id, pipes, t: { perPipe: pipes.map(() => [0, 0, 0]) } });
  // check valve (I-04)
  const chk = (t, spec) => read(fileOf(junc({ type: 10, id: 2, pipes: [1, -2], t, spec }), nodeOf(3, [2, -3]), end));
  const c1 = chk({ lossType: 0, loss: 400 }), c2 = chk({ lossType: 1, loss: 3.5 }), c3 = chk({ lossType: 7, loss: 350 }), c4 = chk({ lossType: 1, loss: 3.5 }, 1);
  ok('a check valve by its Cv', J(c1.model, 2).type === 'check' && J(c1.model, 2).lossModel === 'Cv' && J(c1.model, 2).Cv === 400 && !J(c1.model, 2).closed);
  ok('by its K and by its Kv (I-07)', J(c2.model, 2).lossModel === 'K' && J(c2.model, 2).K === 3.5 && J(c3.model, 2).lossModel === 'Kv' && J(c3.model, 2).Kv === 350);
  ok('closed by its special condition', J(c4.model, 2).closed === true && hasNote(c4, 'closed', 'J2'));
  const c5 = chk({ lossType: 3, coef: [0, 0, 0.002], pU: 'psid', qU: 'gal/min', qMax: 1000 });
  ok('by a loss curve that is a square law: an exact K', J(c5.model, 2).lossModel === 'K' && J(c5.model, 2).K > 0 && !hasNote(c5, 'curveHalf'));
  ok('a check valve is no longer a component without loss', !hasNote(c1, 'unknownLoss'));
  // generic component (I-05)
  const gen = (t) => read(fileOf(nodeOf(2, [1, -2]), junc({ type: 20, id: 3, pipes: [2, -3], t }), end));
  const g1 = gen({ lossType: 1, coef: [0, 0, 5], loss: 4.2 }), g2 = gen({ lossType: 0, loss: 300 }), g3 = gen({ lossType: 7, loss: 260 });
  ok('a generic component by its K, in the item loss after the coefficients', J(g1.model, 3).genModel === 'K' && J(g1.model, 3).K === 4.2 && !hasNote(g1, 'lossModel'));
  const A = Math.PI * 0.2 * 0.2 / 4;
  ok('by its Cv and its Kv: the K of the same loss at the area of its inlet pipe', near(J(g2.model, 3).K, JS.gasValveK({ lossModel: 'Cv', Cv: 300 }, 0, A)) && near(J(g3.model, 3).K, 200 * (3600 * A / 260) ** 2) && hasNote(g2, 'genericCv', 'J3'));
  const g4 = gen({ lossType: 3, coef: [0, 0, 0.001], pU: 'psid', qU: 'gal/min', qMax: 1000 });
  ok('by a loss curve, as in .fth files', J(g4.model, 3).genModel === 'K' && J(g4.model, 3).K > 0);
  // nozzle (I-06)
  const spr = (t, pipes = [3]) => read(fileOf(nodeOf(2, [1, -2]), nodeOf(3, [2, -3]), junc({ type: 16, id: 4, pipes, t })));
  const s1 = spr({ lossType: 0, fa: 0.004, faU: 'meters2', holes: 4, loss: 0.8, pExit: 0, pExitU: 'barG' });
  const sj = J(s1.model, 4);
  ok('a nozzle by its discharge coefficient and the flow area of its holes', sj.type === 'spray' && sj.sprayModel === 'CdA' && sj.Cd === 0.8 && sj.nHoles === 4
    && near(sj.Cd * sj.nHoles * Math.PI * U.toSI(sj.dHole.value, sj.dHole.unit, 'length') ** 2 / 4, 0.8 * 0.004) && hasNote(s1, 'sprayCdA'));
  const s2 = spr({ lossType: 0, fa: 2, faU: 'inches2', holes: -1, loss: 0.6, pExit: 0, pExitU: 'psig' });
  ok('one hole when the file gives −1, its diameter in inches', J(s2.model, 4).nHoles === 1 && J(s2.model, 4).dHole.unit === 'in' && near(J(s2.model, 4).dHole.value, Math.sqrt(8 / Math.PI)));
  const s3 = spr({ lossType: 1, loss: 80, pU: 'bar', qU: 'liter/min', pExit: 0, pExitU: 'barG' });
  ok('by its K factor, as in .fth files', J(s3.model, 4).sprayModel === 'K' && J(s3.model, 4).Kf.unit === 'L/min/bar½');
  const s4 = spr({ lossType: 0, fa: 0, faU: 'meters2', holes: 2, loss: 0 });
  ok('a nozzle without its area asks for it', hasNote(s4, 'sprayHoles', 'J4'));
  // a nozzle on two pipes: the fields of each pipe move the rest of its block (Annex A)
  const two = read(imp({
    secs: [
      [BASE('JUNCTIONS'), [junc({ type: 2, id: 1, pipes: [-1, -2], t: tank({ ks: [[0, 0], [0, 0]], level: 30 }) }), junc({ type: 16, id: 4, pipes: [1, 2], t: block(16, { lossType: 0, fa: 0.002, faU: 'meters2', holes: 1, loss: 0.9, pExit: 0.5, pExitU: 'barG' }, 2) })]],
      [BASE('PIPES'), [pipe({ id: 1, from: 1, to: 4, L: 50, D: 20 }), pipe({ id: 2, from: 1, to: 4, L: 60, D: 20 })]],
    ],
  }));
  ok('a nozzle on two pipes reads its fields after those of its pipes', J(two.model, 4).Cd === 0.9 && J(two.model, 4).Pext.value === 0.5);
  // valve by its Kv (I-07)
  const v1 = read(fileOf(junc({ type: 8, id: 2, pipes: [1, -2], t: { lossType: 7, loss: 120 } }), nodeOf(3, [2, -3]), end));
  ok('a valve by its Kv', J(v1.model, 2).type === 'valve' && J(v1.model, 2).lossModel === 'Kv' && J(v1.model, 2).Kv === 120);
  const v2 = read(fileOf(nodeOf(2, [1, -2]), nodeOf(3, [2, -3]), junc({ type: 8, id: 4, pipes: [3], t: { lossType: 7, loss: 90, back: 1, backU: 'barG' } })));
  ok('an exit valve by its Kv', J(v2.model, 4).type === 'exitvalve' && J(v2.model, 4).Kv === 90 && J(v2.model, 4).Pout.value === 1);
  // pump: configurations with 15 fields after their efficiency, the second in use at 90 % (I-03)
  const cfg = [{ cfgQmax: 500, cfgH: [80, 0, -0.0002], cfgE: [0, 0.4, -0.0005] }, { cfgName: 'B', cfgQmax: 400, cfgH: [60, 0, -0.0002], cfgE: [0, 0.4, -0.0006] }];
  const pumpT = (v) => block(17, Object.assign({ pumpType: 0, hU: 'meters', qU: 'm3/hr', cfgSel: 2, cfg, speed: 0.9 }, v), 2);
  const pumpFile = (v, extra = []) => imp({
    secs: [
      [BASE('JUNCTIONS'), [junc({ type: 2, id: 1, pipes: [-1], t: tank({ level: 5 }) }), junc({ type: 17, id: 2, pipes: [1, -2], t: pumpT(v) }), junc({ type: 2, id: 3, pipes: [2], t: tank({ level: 30 }) }), ...extra]],
      [BASE('PIPES'), [pipe({ id: 1, from: 1, to: 2, L: 10, D: 20 }), pipe({ id: 2, from: 2, to: 3, L: 200, D: 20 })]],
    ],
  });
  const p1 = read(pumpFile({}));
  const pj = J(p1.model, 2);
  ok('the speed after configurations of 15 fields: 90 %', pj.type === 'pump' && near(pj.speed, 90), String(pj.speed));
  ok('the curve of the configuration in use', near(pj.curve.y[0], 60) && near(pj.curve.x[pj.curve.x.length - 1], 400) && hasNote(p1, 'pumpConfig', 'J2'));
  const p2 = read(pumpFile({ ctlType: 1, ctl: 150, ctlU: 'm3/hr' }));
  ok('a control of the flow by the speed, read in its items', J(p2.model, 2).mode === 'controlFlow' && J(p2.model, 2).setQ.value === 150);
  const p3 = read(pumpFile({ ctlType: 2, ctl: 3, ctlU: 'barG' }));
  ok('another control by the speed: the curve, with a note', J(p3.model, 2).mode === 'curve' && hasNote(p3, 'pumpControlOther', 'J2'));
  const p4 = read(pumpFile({ pumpType: 1, dfh: 120, dfhU: 'm3/hr', pdRpm: 300, pdBore: 4 }));
  ok('a positive displacement pump is reported', hasNote(p4, 'pumpDisplacement', 'J2') && !hasNote(p1, 'pumpDisplacement') && J(p4.model, 2).mode === 'fixedFlow');
  // a pump on a single pipe takes its suction pressure from its items
  const single = read(imp({
    secs: [
      [BASE('JUNCTIONS'), [junc({ type: 17, id: 2, pipes: [-2], t: block(17, { pumpType: 0, hU: 'meters', qU: 'm3/hr', cfgSel: 1, cfg: [cfg[0]], speed: 1, submerged: -1, subType: 1, subP: 0.5, subPU: 'barG' }, 1) }), junc({ type: 2, id: 3, pipes: [2], t: tank({ level: 30 }) })]],
      [BASE('PIPES'), [pipe({ id: 2, from: 2, to: 3, L: 200, D: 20 })]],
    ],
  }));
  const suc = single.model.junctions.find((j) => j.type === 'pressure');
  ok('the suction of a pump on a single pipe, from its items', suc && suc.P.value === 0.5 && suc.P.unit === 'bar(g)' && hasNote(single, 'pumpSuction', 'J2'));
}

console.log('\nThe calculation and the stored results (section 16, I-34)');
{
  // reservoir → P1 → check valve (Cv) → P2 → generic component (Kv) → P3 → nozzle (Cd and area)
  const secs = (archive = []) => [
    [BASE('JUNCTIONS'), [
      junc({ type: 2, id: 1, pipes: [-1], t: tank({ level: 40 }) }),
      junc({ type: 10, id: 2, pipes: [1, -2], t: { lossType: 0, loss: 400 } }),
      junc({ type: 20, id: 3, pipes: [2, -3], t: { lossType: 7, loss: 300 } }),
      junc({ type: 16, id: 4, pipes: [3], t: { lossType: 0, fa: 0.004, faU: 'meters2', holes: 4, loss: 0.8, pExit: 0, pExitU: 'barG' } }),
    ]],
    [BASE('PIPES'), [pipe({ id: 1, from: 1, to: 2, L: 100, D: 20 }), pipe({ id: 2, from: 2, to: 3, L: 150, D: 20 }), pipe({ id: 3, from: 3, to: 4, L: 80, D: 20 })]],
    ...archive,
  ];
  const r = read(imp({ secs: secs() }));
  const res = run(r.model);
  // the same network built in Pump It
  const m = M.newModel();
  m.system.fluid = { kind: 'user', name: 'w', rho: q(998.2, 'kg/m³'), mu: q(1.002, 'cP'), pv: q(2.339, 'kPa(a)') };
  m.system.patm = q(1, 'atm');
  m.system.laminarK = 'none';
  m.junctions.push(Object.assign(M.newJunction('reservoir', 1, 0, 0), { liquidElev: q(40, 'm'), elevation: q(0, 'm'), surfP: q(0, 'bar(g)') }));
  m.junctions.push(Object.assign(M.newJunction('check', 2, 0, 0), { lossModel: 'Cv', Cv: 400, elevation: q(0, 'm') }));
  m.junctions.push(Object.assign(M.newJunction('valve', 3, 0, 0), { lossModel: 'Kv', Kv: 300, elevation: q(0, 'm') }));
  m.junctions.push(Object.assign(M.newJunction('spray', 4, 0, 0), { sprayModel: 'CdA', Cd: 0.8, nHoles: 1, dHole: q(Math.sqrt(4 * 0.004 / Math.PI), 'm'), Pext: q(0, 'bar(g)'), elevation: q(0, 'm') }));
  for (const [id, a, b, L] of [[1, 1, 2, 100], [2, 2, 3, 150], [3, 3, 4, 80]]) {
    const p = M.newPipe(id, a, b);
    Object.assign(p, { length: q(L, 'm'), material: { kind: 'user', nps: '4', sch: '40' }, fittings: [] });
    p.geometry = { kind: 'circular', d: q(20, 'cm') };
    p.friction = { model: 'roughness', eps: q(0.0045, 'cm') };
    m.pipes.push(p);
  }
  const ref = run(m);
  ok('the imported network calculates', res.ok, (res.errors || []).join('; '));
  ok('identical to the same network built in Pump It (10⁻⁹)', res.ok && ref.ok && [1, 2, 3].every((id) => near(res.pipes[id].m, ref.pipes[id].m) && near(res.pipes[id].P0in, ref.pipes[id].P0in) && near(res.pipes[id].P0out, ref.pipes[id].P0out)),
    `${res.pipes[1] && res.pipes[1].m} / ${ref.pipes[1] && ref.pipes[1].m}`);
  // the results of that calculation stored in the file
  const rho = 998.2, mu = 1.002e-3;
  const pa = pipeArchive(res, rho, mu);
  const ja = [[1, 30, 0, 2, 0], [2, 29, 0, 10, 0], [3, 28, 0, 20, 0], [4, 25, 0, 16, 0]].map((x) => x.join(','));
  const r2 = read(imp({ secs: secs([[BASE('PIPE ARCHIVE DATA'), [`NumberOfArchivePipes= ${pa.length}`, ...pa]], [BASE('JUNCTION ARCHIVE DATA'), [`NumberOfArchiveJcts= ${ja.length}`, ...ja]]]) }));
  const c = IMP.compare(run(r2.model), r2.stored);
  ok('the stored results of the pipes, compared as for .fth files', r2.stored && r2.stored.size === 3 && c.n === 3 && c.flow < 1e-9 && c.pressure < 1e-9, JSON.stringify(c));
  ok('the stored results of the junctions: the stagnation pressure in column 1 and the kind in column 3', r2.storedJunctions && r2.storedJunctions.size === 4 && near(r2.storedJunctions.get(2).P0, 29 * PSI) && r2.storedJunctions.get(4).type === 16);
  const jb = [[1, 30, 0, 2, 0], [2, 29, 0, 8, 0]].map((x) => x.join(','));
  const r3 = read(imp({ secs: secs([[BASE('JUNCTION ARCHIVE DATA'), [`NumberOfArchiveJcts= ${jb.length}`, ...jb]]]) }));
  ok('a stored row of another kind than its junction is left out, with a note', r3.storedJunctions.size === 1 && hasNote(r3, 'archiveJunction', 'J2'));
  // the validation script of the user's files (section 19.3), on this network written in a folder of its own; the file
  // starts without the first line of a model, which the script reads with the word of the program
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'pumpit-imp-'));
  const file = path.join(dir, 'synthetic.imp');
  fs.writeFileSync(file, imp({ header: 'Synthetic file written by tests/imp-import.test.cjs', secs: secs([[BASE('PIPE ARCHIVE DATA'), [`NumberOfArchivePipes= ${pa.length}`, ...pa]]]) }), 'latin1');
  const { validateFile } = require('./validate-imp.js');
  const rows = validateFile(file);
  ok('the validation script imports the file, checks it and compares its stored results', rows.length === 1 && rows[0].compared === 3 && rows[0].flow < 1e-9 && rows[0].pressure < 1e-9 && !rows[0].dangling.length && !rows[0].bad.length, JSON.stringify(Object.assign({}, rows[0], { file: undefined })));
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('\nScenarios (section 7)');
{
  // a child scenario changes the Cv of a check valve and adds a coefficient to a generic component, item by item
  const scen = [['Base Scenario', ''], ['Other', 'Base Scenario']];
  const sch10 = IT.parse(IT.SCHEMAS[10]), sch20 = IT.parse(IT.SCHEMAS[20]);
  const childOf = (sch, set) => {
    const out = [];
    for (const it of sch) {
      const x = it.name !== undefined ? set[it.name] : undefined;
      if (it.kind === 'skip' || it.kind === 'field') out.push(x !== undefined ? x : '');
      else if (it.kind === 'event') out.push(...new Array(8).fill(''));
      else if (it.kind === 'list') out.push(...(x || ['0']));
      else if (it.kind === 'table') out.push('', '-1', '0', '', '');
    }
    return out;
  };
  const text = imp({
    scen,
    secs: [
      [BASE('JUNCTIONS'), [
        junc({ type: 2, id: 1, pipes: [-1], t: tank({ level: 40 }) }),
        junc({ type: 10, id: 2, pipes: [1, -2], t: { lossType: 0, loss: 400, coef: [1, 2] } }),
        junc({ type: 20, id: 3, pipes: [2, -3], t: { lossType: 1, loss: 2, coef: [0, 0, 1] } }),
        junc({ type: 4, id: 4, pipes: [3], t: { perPipe: [[0, 0, 0]], p: 0, pU: 'barG' } }),
      ]],
      [BASE('PIPES'), [pipe({ id: 1, from: 1, to: 2, L: 100, D: 20 }), pipe({ id: 2, from: 2, to: 3, L: 150, D: 20 }), pipe({ id: 3, from: 3, to: 4, L: 80, D: 20 })]],
      ['JUNCTIONS -- SCENARIO #2 -- Other', [
        deltaJ({ type: 10, id: 2, nPar: 2, t: childOf(sch10, { loss: '250', coef: ['-2', '', ''] }) }),
        deltaJ({ type: 20, id: 3, nPar: 2, t: childOf(sch20, { coef: ['4', '', '', '', '7'], loss: '' }) }),
      ]],
    ],
  });
  const base = read(text), child = read(text, { scenario: 2 });
  ok('the base scenario keeps its values', J(base.model, 2).Cv === 400 && J(base.model, 3).K === 2);
  ok('a child changes the Cv of a check valve; its other items inherit', J(child.model, 2).Cv === 250 && J(child.model, 2).lossModel === 'Cv');
  ok('a child that lengthens a list keeps the item after it in its place', J(child.model, 3).K === 2 && !hasNote(child, 'recordLength'), String(J(child.model, 3).K));
}

// ---------- the water hammer (phase I2)

// the case T5 of the specification of the water hammer written as a .imp file (I-T8): a reservoir at 1000 kPa(a), a pipe
// of 600 m, 0.3 m, a = 1200 m/s given, f = 0.018, and an exit valve to 101.325 kPa(a) whose Cv goes from 300 to 0 in 3 s;
// a time step of 0.05 s and a run of 10 s. o: { tc, sc } keys of the control, valve: items of the valve, pipe: its
// transient block, more: more sections
const t5 = (o = {}) => imp({
  fluid: { rho: '998.2,kg/m3', mu: '1,centipoise', pv: '2.34,kPa', amb: '101.325,kPa' },
  extraFluid: o.extraFluid || [],
  scen: o.scen,
  analysis: o.analysis,
  secs: [
    ...control(o.tc, o.sc),
    [BASE('JUNCTIONS'), [
      junc({ type: 2, id: 1, pipes: [-1], t: tank({ P: 1000, Pu: 'kPa' }) }),
      junc({ type: 8, id: 2, pipes: [1], t: Object.assign({ lossType: 0, loss: 300, back: 101.325, backU: 'kPa', table1: { units: ['None'], rows: [[0, 300], [3, 0]] } }, o.valve) }),
    ]],
    [BASE('PIPES'), [pipe({ id: 1, from: 1, to: 2, L: 600, D: 0.3, Du: 'meters', fric: ['4', 0.018, 'None'], extra: o.extra, surge: Object.assign({ a: 1200, n: 10, Z: impedance(1200, 0.3) }, o.pipe) })]],
    ...(o.more || []),
  ],
});
const sv = (r) => r.model.solution.surge;

console.log('\nThe control of the run and the sectioning (sections 8 to 10, I-T2)');
{
  const r = read(t5());
  const c = sv(r);
  ok('the water hammer is on, the time simulation off (I-20)', c && c.on === true && r.model.solution.time.on === false && hasNote(r, 'surgeOn'));
  ok('the duration, the time step given and the steps saved (I-14, I-15, I-19)', c.duration.value === 10 && c.duration.unit === 's' && c.dtMode === 'given' && c.dt.value === 0.05 && c.dt.unit === 's' && c.saveEvery === 1);
  ok('the vapour cavities, ψ, the void fraction and its pressure, the stagnation basis (I-17)', c.cavitation === 'dvcm' && c.psi === 0.5 && c.alpha0 === 1e-7 && c.p0.value === 1 && c.p0.unit === 'atm' && c.cavBasis === 'stagnation');
  ok('the friction of the steady state and the artificial transient (I-16, I-18)', c.friction === 'steady' && c.artificial.stop === true && c.artificial.criterion === 0.5 && c.artificial.minFlow.value === 0);
  ok('the limits of the search of the sections (I-14)', c.ncMin === 1 && c.ncMax === 20 && c.varianceMax === 10 && c.stations === 'ends');
  const codes = read(t5({ tc: { ModelCavitation: 2, VariableResistance: -1, CavitationPressureType: 1, StopOnArtificialTransient: 0, Frequency: 10, Psi: 0.95 }, sc: { MaxErrorOption: 0 } }));
  ok('gas cavities, the friction that varies, the static basis, a run that does not stop, 10 steps saved', sv(codes).cavitation === 'dgcm' && sv(codes).friction === 'variable' && sv(codes).cavBasis === 'static' && sv(codes).artificial.stop === false && sv(codes).saveEvery === 10 && sv(codes).psi === 0.95);
  ok('the limit of the variance: option 0 is 5 %, option 3 the value of the file', sv(codes).varianceMax === 5 && sv(read(t5({ sc: { MaxErrorOption: 3, MaxError: 1 } }))).varianceMax === 1);
  ok('the unsteady friction of Brunone', sv(read(t5({ tc: { VariableResistance: 1 } }))).friction === 'brunone');
  const odd = read(t5({ tc: { ModelCavitation: 7 } }));
  ok('a code that is not known keeps the default, with a note', sv(odd).cavitation === 'dvcm' && hasNote(odd, 'surgeCode'));
  const min = read(t5({ tc: { StopTime: 2, TimeUnits: 'minutes', TotalSteps: 2400 } }));
  ok('a run in minutes', sv(min).duration.value === 2 && sv(min).duration.unit === 'min' && !hasNote(min, 'surgeSteps'));
  ok('steps of the file that do not match the duration over the time step, with a note', hasNote(read(t5({ tc: { TotalSteps: 150 } })), 'surgeSteps') && !hasNote(r, 'surgeSteps'));
  const late = read(t5({ tc: { StartTime: 1, StopTime: 10 } }));
  const tb = J(late.model, 2).surge.tables[0];
  ok('a run that starts at 1 s: 9 s, the table by the clock moved back, with a note (I-15)', sv(late).duration.value === 9 && hasNote(late, 'surgeStart') && tb.t[0] === 0 && near(tb.v[0], 200) && tb.t[1] === 2 && tb.v[1] === 0, JSON.stringify(tb));
  const stop = read(t5({ tc: { StopTime: -1 } }));
  ok('an end at −1: the control is written off, with a note (I-20)', sv(stop) && sv(stop).on === false && hasNote(stop, 'surgeStop'));
  const auto = read(t5({ sc: { TimeStep: 0 } }));
  ok('no time step: the automatic search, with a note (I-14)', sv(auto).dtMode === 'auto' && hasNote(auto, 'surgeAutoStep'));
  ok('a staggered grid is reported', hasNote(read(t5({ sc: { SolutionGridType: 1 } })), 'surgeGrid') && !hasNote(r, 'surgeGrid'));
  const steady = read(t5({ analysis: 2 }));
  ok('a file of another kind of analysis: the water hammer off, with a note', sv(steady).on === false && hasNote(steady, 'surgeAnalysis'));
  // a child scenario changes the end of the run with its key in capitals (section 7)
  const child = read(t5({ scen: [['Base Scenario', ''], ['Shorter', 'Base Scenario']], more: [['TRANSIENT CONTROL -- SCENARIO #2 -- SHORTER', ['STOPTIME= 5']]] }), { scenario: 2 });
  ok('a child scenario changes the control with its keys in capitals', sv(child).duration.value === 5 && sv(child).dt.value === 0.05);
  // the bulk modulus of the liquid (section 10)
  const bulk = read(t5({ extraFluid: ['Bulk Modulus= 2200,MPa'] })), bulkUS = read(t5({ extraFluid: ['Bulk Modulus= 319000,psia'] }));
  ok('the bulk modulus of the liquid, in its unit of pressure (W-07)', bulk.model.system.fluid.K.value === 2200 && bulk.model.system.fluid.K.unit === 'MPa' && bulkUS.model.system.fluid.K.value === 319000 && bulkUS.model.system.fluid.K.unit === 'psi');
}

console.log('\nThe transient block of the pipes (section 11, I-T3)');
{
  const one = (pipeS, o = {}) => read(t5(Object.assign({ pipe: pipeS }, o)));
  const r = one({});
  const s = P(r.model, 1).surge;
  ok('the wave speed of the file, given (I-11)', s.wave === 'given' && s.a.value === 1200 && s.a.unit === 'm/s');
  ok('the stations of the ends; the impedance and the sections of the file check', s.stations === 'ends' && !hasNote(r, 'surgeImpedance') && !hasNote(r, 'surgeSections'));
  const us = one({ a: 3937.0078740157, au: 'feet/sec', Z: impedance(1200, 0.3) });
  ok('a wave speed in feet per second', P(us.model, 1).surge.a.unit === 'ft/s' && near(U.toSI(P(us.model, 1).surge.a.value, 'ft/s', 'velocity'), 1200, 1e-9) && !hasNote(us, 'surgeImpedance'));
  const wall = one({ e: 9.5, eu: 'mm', E: 30e6, Eu: 'psia', nu: 0.3, sup: 5, c1: 0.95 });
  const w = P(wall.model, 1).surge;
  ok('the wall, the material and the support kept for a calculated speed', w.wall.value === 9.5 && w.wall.unit === 'mm' && w.E.value === 30e6 && w.E.unit === 'psi' && w.nu === 0.3 && w.support === 'thickAnchored' && w.c1 === 0.95);
  const sup = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((k) => P(one({ sup: k, G: 5000, Gu: 'MPa', buried: 12 }).model, 1).surge.support);
  ok('the eleven supports (I-12)', sup.join() === 'user,thinUp,thinAnchored,thinJoints,thickUp,thickAnchored,thickJoints,tunnelUnlined,tunnelLined,thinAnchored,buried', sup.join());
  const soil = one({ sup: 9 }), rock = one({ sup: 7, G: 5000, Gu: 'MPa' }), buried = one({ sup: 10, buried: 12 });
  ok('buried by the stiffness of the soil: a thin wall anchored, with a note', hasNote(soil, 'surgeSoil', 'P1'));
  ok('a tunnel takes the stiffness of the rock eight fields after the ambient fluid', P(rock.model, 1).surge.G.value === 5000 && P(rock.model, 1).surge.G.unit === 'MPa' && hasNote(rock, 'surgeRock'));
  ok('a buried pipe takes its increase from the last field', P(buried.model, 1).surge.buriedPct === 12 && hasNote(buried, 'surgeBuried'));
  ok('every station, or a list of station numbers from 0 at the inlet (I-13, I-46)', P(one({ st: 0 }).model, 1).surge.stations === 'all' && P(one({ st: 5, list: [6, 2] }).model, 1).surge.stations.join() === '2,6' && !hasNote(one({ st: 5, list: [6, 2] }), 'surgeStationScale'));
  ok('with the codes 0 and 1 the places of the list are not read', P(one({ st: 1, list: [0, 10] }).model, 1).surge.stations === 'ends' && P(one({ st: 0, list: [3] }).model, 1).surge.stations === 'all');
  // the file sections the pipe into 5 where Pump It, with the time step of the file, makes 10: the stations of the list
  // move to the same places, round(k·10/5) (answer 2.2)
  const scaled = one({ n: 5, st: 5, list: [0, 2, 5, -1, -1] });
  ok('a list of a pipe Pump It sections otherwise moves to the same places, with a note', P(scaled.model, 1).surge.stations.join() === '0,4,10' && hasNote(scaled, 'surgeStationScale', 'P1') && hasNote(scaled, 'surgeSections', 'P1'), JSON.stringify(P(scaled.model, 1).surge.stations));
  const halfUp = one({ n: 4, st: 5, list: [1, 3] });
  ok('half a station rounds up, as the sectioning does', P(halfUp.model, 1).surge.stations.join() === '3,8', JSON.stringify(P(halfUp.model, 1).surge.stations));
  const calc = one({ a: 0, e: 9.5, eu: 'mm', E: 207, Eu: 'GPa' });
  ok('no wave speed in the file: calculated by Pump It, with a note', !P(calc.model, 1).surge.a && hasNote(calc, 'surgeWaveCalc', 'P1'));
  ok('an impedance that does not match the wave speed and the area, with a note', hasNote(one({ Z: 2 }), 'surgeImpedance', 'P1'));
  ok('a number of sections other than that of Pump It with the time step of the file, with a note', hasNote(one({ n: 12 }), 'surgeSections', 'P1'));
  ok('a bulk modulus of the pipe and a pipe partly full are reported', hasNote(one({ K: 300000 }), 'surgePipeK', 'P1') && hasNote(one({ full: 50 }), 'surgePartFull', 'P1'));
  const far = one({ a: 1100, Z: impedance(1100, 0.3) }, { extra: 4 });
  ok('the anchor further in the record (b+120)', P(far.model, 1).surge.a.value === 1100);
  const none = read(imp({ secs: [...control(), [BASE('JUNCTIONS'), [junc({ type: 2, id: 1, pipes: [-1], t: tank({ level: 20 }) }), junc({ type: 4, id: 2, pipes: [1], t: { perPipe: [[0, 0, 0]], p: 0, pU: 'barG' } })]], [BASE('PIPES'), [pipe({ id: 1, from: 1, to: 2, L: 100, D: 20 })]]] }));
  ok('a pipe without its transient block, with a note', !P(none.model, 1).surge && hasNote(none, 'surgePipe', 'P1'));
  // a child scenario: its transient block 9 fields before (I-10)
  const scen = [['Base Scenario', ''], ['Other', 'Base Scenario']];
  const child = (set) => read(t5({ scen, more: [['PIPES -- SCENARIO #2 -- Other', [deltaP(1, set)]]] }), { scenario: 2 });
  const c1 = child({ '-1': 1000, 0: 'meters/sec', 1: impedance(1000, 0.3) });
  ok('a child changes the wave speed in its own transient block; the rest inherits', P(c1.model, 1).surge.a.value === 1000 && P(c1.model, 1).surge.stations === 'ends' && !hasNote(c1, 'surgePipeChild') && !hasNote(c1, 'surgeImpedance'));
  const c2 = child({ '-1': 1000, '-6': 'psia' });
  ok('a child whose units are not in their places is left out, with a note', P(c2.model, 1).surge.a.value === 1200 && hasNote(c2, 'surgePipeChild', 'P1'));
  const c3 = child({ '-7': 12 });
  ok('an empty field of the child inherits, a filled one replaces', P(c3.model, 1).surge.a.value === 1200 && P(c3.model, 1).surge.wall.value === 12 && P(c3.model, 1).surge.wall.unit === 'mm');
}

console.log('\nTime data of the junctions (section 13, I-T5)');
{
  // reservoir → P1 → J2 → P2 → J3, with the control of the run and the transient blocks of the pipes
  const net = (j2, j3, more = []) => read(imp({
    secs: [
      ...control(),
      [BASE('JUNCTIONS'), [junc({ type: 2, id: 1, pipes: [-1], t: tank({ level: 30 }) }), j2, j3, ...more]],
      [BASE('PIPES'), [pipe({ id: 1, from: 1, to: 2, L: 600, D: 20, surge: { n: 10, Z: impedance(1200, 0.2) } }), pipe({ id: 2, from: 2, to: 3, L: 600, D: 20, surge: { n: 10, Z: impedance(1200, 0.2) } })]],
    ],
  }));
  const end = junc({ type: 4, id: 3, pipes: [2], t: { perPipe: [[0, 0, 0]], p: 0, pU: 'barG' } });
  const valve = (t) => net(junc({ type: 8, id: 2, pipes: [1, -2], t: Object.assign({ lossType: 0, loss: 300 }, t) }), end);
  const v1 = valve({ table1: { units: ['None'], rows: [[0, 300], [2, 0]] } });
  const d1 = J(v1.model, 2).surge;
  ok('a table of the Cv of a valve, by the clock (I-21)', d1 && d1.use && d1.what === 'Cv' && d1.basis === 'absolute' && d1.start === 'time' && d1.tables[0].t.join() === '0,2' && d1.tables[0].v.join() === '300,0' && d1.tables[0].tUnit === 's' && hasNote(v1, 'surgeData', 'J2'));
  ok('the time data go to j.surge, never to j.time (W-14)', !J(v1.model, 2).time);
  const v2 = valve({ rel: -1, table1: { units: ['Percent'], rows: [[0, 100], [2, 20]] } });
  ok('a relative opening in %: % of the steady value', J(v2.model, 2).surge.basis === 'relative' && J(v2.model, 2).surge.tables[0].vUnit === '%');
  const v3 = valve({ lossType: 1, loss: 2, table1: { units: ['None'], rows: [[0, 2], [1, 50]] } });
  ok('the unit None on a valve: the quantity of its loss model (K)', J(v3.model, 2).surge.what === 'K');
  const v4 = valve({ lossType: 7, loss: 250, table1: { units: ['None'], rows: [[0, 250], [1, 0]] } });
  ok('and Kv', J(v4.model, 2).surge.what === 'Kv');
  const ev = valve({ trig: 1, ev1: [0, 0, 0.5, 'seconds', -1, -1, -1, -1], table1: { units: ['None'], rows: [[0, 300], [2, 0]] } });
  const d2 = J(ev.model, 2).surge;
  ok('a table started by an event on the time', d2.start === 'single' && d2.when.length === 1 && d2.when[0].q === 'time' && d2.when[0].op === '>' && d2.when[0].value.value === 0.5);
  const ign = valve({ ign: 1, table1: { units: ['None'], rows: [[0, 300], [2, 0]] } });
  ok('data marked as ignored come in kept, not in use (I-22)', J(ign.model, 2).surge.use === false && hasNote(ign, 'timeIgnored', 'J2'));
  const kept = valve({ table1: { key: 'SET1', units: ['None'], rows: [] } });
  ok('a table kept in a set of data of the file is left out, with a note', !J(kept.model, 2).surge && hasNote(kept, 'timeDataSet', 'J2'));
  ok('a valve whose Cv comes from a table, and one with a profile of the program, are reported', hasNote(valve({ cvFromTable: 1 }), 'surgeCvTable', 'J2') && hasNote(valve({ profile: 3 }), 'surgeProfile', 'J2'));
  const ms = valve({ table1: { units: ['None'], tu: 'milliseconds', rows: [[0, 300], [500, 0]] } });
  ok('a table in milliseconds', J(ms.model, 2).surge.tables[0].tUnit === 'ms' && J(ms.model, 2).surge.tables[0].t[1] === 500);
  // imposed flow and pressure (section 14.3): a table, an infinite pipe, a sinusoid
  const flowEnd = (t) => net(junc({ type: 1, id: 2, pipes: [1, -2], t: { perPipe: [[0, 0, 0], [0, 0, 0]] } }), junc({ type: 3, id: 3, pipes: [2], t: Object.assign({ q: 50, qU: 'm3/hr', out: 1 }, t) }));
  const f1 = flowEnd({ table1: { units: ['m3/hr'], rows: [[0, 50], [1, 0]] } });
  ok('a table of an imposed flow', J(f1.model, 3).surge.what === 'Q' && J(f1.model, 3).surge.tables[0].vUnit === 'm³/h');
  const f2 = flowEnd({ ign: 2, table1: { units: ['m3/hr'], rows: [[0, 50], [1, 0]] } });
  ok('ign 2: an infinite pipe, its tables not used (I-22, W-45)', J(f2.model, 3).surgeSpecial === 'infinitePipe' && !J(f2.model, 3).surge && hasNote(f2, 'surgeInfinite', 'J3'));
  const p2 = net(junc({ type: 1, id: 2, pipes: [1, -2], t: { perPipe: [[0, 0, 0], [0, 0, 0]] } }), junc({ type: 4, id: 3, pipes: [2], t: { perPipe: [[0, 0, 0]], p: 0, pU: 'barG', ign: 2, periodic: -1 } }));
  ok('an infinite pipe at an imposed pressure; a sinusoid is reported (I-36)', J(p2.model, 3).surgeSpecial === 'infinitePipe' && hasNote(p2, 'surgePeriodic', 'J3'));
  ok('the reference pressure of an infinite pipe is reported', hasNote(flowEnd({ useRef: -1 }), 'surgeReference', 'J3'));
  // a node with a source, a reservoir with its level
  const src = net(junc({ type: 1, id: 2, pipes: [1, -2], t: { perPipe: [[0, 0, 0], [0, 0, 0]], src: 10, srcU: 'm3/hr', table1: { units: ['m3/hr'], rows: [[0, 10], [1, 0]] } } }), end);
  ok('a table of the source of a node', J(src.model, 2).surge.what === 'source');
  const lvl = net(junc({ type: 1, id: 2, pipes: [1, -2], t: { perPipe: [[0, 0, 0], [0, 0, 0]] } }), junc({ type: 2, id: 3, pipes: [2], t: Object.assign(tank({ level: 10 }), { table1: { units: ['meters'], rows: [[0, 10], [5, 12]] } }) }));
  ok('a table of the level of a reservoir', J(lvl.model, 3).surge.what === 'level' && J(lvl.model, 3).surge.tables[0].vUnit === 'm');
  // a nozzle takes no table in the water hammer
  const noz = net(junc({ type: 1, id: 2, pipes: [1, -2], t: { perPipe: [[0, 0, 0], [0, 0, 0]] } }), junc({ type: 16, id: 3, pipes: [2], t: { lossType: 1, loss: 80, pU: 'bar', qU: 'liter/min', pExit: 0, pExitU: 'barG', table1: { units: ['Percent'], rows: [[0, 100], [1, 0]] } } }));
  ok('time data that a junction does not take in the water hammer, with a note', !J(noz.model, 3).surge && hasNote(noz, 'surgeNoTables', 'J3'));
  // check valve (section 14.10): instantaneous, with its closing velocity and its reopening difference (I-27)
  const chk = (t) => net(junc({ type: 10, id: 2, pipes: [1, -2], t: Object.assign({ lossType: 0, loss: 400 }, t) }), end);
  const k1 = chk({ vClose: -0.05, vCloseU: 'meters/sec', dpType: 1, dpOpen: 0.1, dpOpenU: 'bar' });
  ok('a check valve with its closing velocity and its reopening difference, a pressure (dpType 1)', J(k1.model, 2).vClose.value === -0.05 && J(k1.model, 2).vClose.unit === 'm/s' && J(k1.model, 2).dPopen.value === 0.1 && J(k1.model, 2).dPopen.unit === 'bar' && !J(k1.model, 2).surge);
  // dpType 0: a difference of head of the liquid, ΔP = ρ·g·Δh with the density of the file (answer 4.1)
  const k2 = chk({ dpType: 0, dpOpen: 2, dpOpenU: 'meters' }), k3 = chk({ dpType: 0, dpOpen: 3, dpOpenU: 'feet' });
  const dp2 = J(k2.model, 2).dPopen, dp3 = J(k3.model, 2).dPopen;
  ok('a reopening difference as a head of the liquid (dpType 0), in kPa or psi', dp2.unit === 'kPa' && near(U.toSI(dp2.value, 'kPa', 'dp'), 998.2 * 9.80665 * 2, 1e-10) && dp3.unit === 'psi' && near(U.toSI(dp3.value, 'psi', 'dp'), 998.2 * 9.80665 * 3 * FT, 1e-10), JSON.stringify([dp2, dp3]));
  ok('a unit of the other category than dpType says is reported', hasNote(chk({ dpType: 0, dpOpen: 0.1, dpOpenU: 'bar' }), 'unit', 'J2') && J(chk({ dpType: 0, dpOpen: 0.1, dpOpenU: 'bar' }).model, 2).dPopen.value === 0);
  ok('tables of opening and closing over time are reported', hasNote(chk({ table1: { units: ['Percent'], rows: [[0, 100], [1, 0]] } }), 'surgeCheckTables', 'J2') && !J(k1.model, 2).dynamic);
  // control valve (section 14.6): ideal, with the smallest speed applied (I-32)
  const cv = net(junc({ type: 9, id: 2, pipes: [1, -2], t: { valveType: 2, set: 50, setU: 'm3/hr', rateClose: -1, rateOpen: -1, rates: [[0, 100, 5, 10]] } }), end);
  ok('a control valve is ideal in the transient, its speed the smallest applied, with notes', J(cv.model, 2).surgeControl === 'ideal' && J(cv.model, 2).surgeRate === 5 && hasNote(cv, 'surgeRate', 'J2') && hasNote(cv, 'surgeRateChar', 'J2'));
  const cv2 = net(junc({ type: 9, id: 2, pipes: [1, -2], t: { valveType: 2, set: 50, setU: 'm3/hr', always: -1, table1: { units: ['m3/hr'], rows: [[0, 50], [2, 30]] } } }), end);
  ok('its set point over time; a valve that never fails is reported', J(cv2.model, 2).surge.what === 'set' && J(cv2.model, 2).surgeRate === undefined && hasNote(cv2, 'surgeControlOptions', 'J2'));
  // the actions on a failure (answer 4.2): those of its kind are what the control valve of Pump It does, no note
  const ctl = (t) => net(junc({ type: 9, id: 2, pipes: [1, -2], t: Object.assign({ valveType: 0, set: 2, setU: 'barG' }, t) }), end);
  const quiet = [
    ctl({ defaultFail: -1 }), ctl({ defaultFail: 0, failIn: 0, failOut: 1 }), ctl({ defaultFail: 0, failIn: -1, failOut: 1 }),
    ctl({ valveType: 1, defaultFail: 0, failIn: 1, failOut: 0 }), ctl({ valveType: 2, set: 50, setU: 'm3/hr', defaultFail: -1, failIn: 1, failOut: 1 }),
    ctl({ valveType: 3, set: 0.5, setU: 'bar', defaultFail: -1, failIn: 1, failOut: 0 }),
  ];
  ok('the actions of its kind (the default, or the same written, a −1 of old files as 0) give no note', quiet.every((r) => !hasNote(r, 'surgeControlOptions')));
  const loud = [ctl({ defaultFail: 0, failIn: 0, failOut: 0 }), ctl({ defaultFail: -1, ovrFn: 2 }), ctl({ defaultFail: -1, failTable: { units: ['Percent'], rows: [[0, 100], [5, 0]] } })];
  ok('other actions, an override or a manoeuvre after the failure are reported', loud.every((r) => hasNote(r, 'surgeControlOptions', 'J2')));
}

console.log('\nPumps: trip, start and speed (section 14.14, I-24)');
{
  const cfg = [{ cfgQmax: 500, cfgH: [80, 0, -0.0002], cfgE: [0, 0.8, -0.0016] }];
  const file = (v, spec) => read(imp({
    secs: [
      ...control(),
      [BASE('JUNCTIONS'), [junc({ type: 2, id: 1, pipes: [-1], t: tank({ level: 5 }) }), junc({ type: 17, id: 2, pipes: [1, -2], spec, t: block(17, Object.assign({ pumpType: 0, hU: 'meters', qU: 'm3/hr', cfgSel: 1, cfg, speed: 1, I: 12, IU: 'kg-m2', rpm: 1780 }, v), 2) }), junc({ type: 2, id: 3, pipes: [2], t: tank({ level: 30 }) })]],
      [BASE('PIPES'), [pipe({ id: 1, from: 1, to: 2, L: 10, D: 20, surge: { n: 1, Z: impedance(1200, 0.2) } }), pipe({ id: 2, from: 2, to: 3, L: 600, D: 20, surge: { n: 10, Z: impedance(1200, 0.2) } })]],
    ],
  }));
  const t1 = file({ tModel: 2, checkValve: -1, trig: 1, ev1: [0, 0, 1, 'seconds', -1, -1, -1, -1] });
  const j1 = J(t1.model, 2);
  ok('a trip at an event, with the inertia, the rated speed and the check valve of the pump', j1.surge && j1.surge.what === 'trip' && j1.surge.start === 'single' && j1.surge.when[0].value.value === 1
    && j1.inertia.value === 12 && j1.inertia.unit === 'kg·m²' && j1.rpm.value === 1780 && j1.noReverse === true, JSON.stringify(j1.surge));
  // a trigger by the clock has no event: the program neither trips nor starts the pump, which keeps its state of the
  // steady state, as without transient data (answer 1.1)
  const t2 = file({ tModel: 2, trig: 0 }), t2b = file({ tModel: 3, trig: 0, fqSource: 0, fqIncr: 8, fqData: { units: ['None', 'None'], rows: Array.from({ length: 8 }, () => [0, 1, 1]) } });
  const t2c = file({ tModel: 5, trig: 0, startSpeedType: 1, table1: { units: ['N-m'], tu: 'Percent', rows: [[0, 300], [100, 200]] } }, 1);
  const t2d = file({ tModel: 4, trig: 0, table1: { units: ['Percent'], rows: [[0, 0], [5, 100]] } }, 1);
  ok('a trip or a start by the clock is not made, with a note (model 2, 3, 4 and 5)', [t2, t2b, t2c, t2d].every((r) => !J(r.model, 2).surge && !J(r.model, 2).fourQuad && !J(r.model, 2).motor && hasNote(r, 'surgeNoEvent', 'J2'))
    && J(t2.model, 2).inertia.value === 12);
  // two events (answer 1.3): the first makes the manoeuvre, the second the manoeuvre back, which is left out with a note
  const ev2 = (v) => Object.assign({ ev1: [0, 0, 1, 'seconds', -1, -1, -1, -1], ev2: [0, 0, 5, 'seconds', -1, -1, -1, -1] }, v);
  const d3 = file(ev2({ tModel: 2, trig: 3 })), d2 = file(ev2({ tModel: 5, trig: 2, startSpeedType: 1, table1: { units: ['N-m'], tu: 'Percent', rows: [[0, 300], [100, 200]] } }), 1);
  ok('a trip of two events: at the first, the restart of the second left out, with a note', J(d3.model, 2).surge.what === 'trip' && J(d3.model, 2).surge.start === 'single' && J(d3.model, 2).surge.when.length === 1 && J(d3.model, 2).surge.when[0].value.value === 1
    && hasNote(d3, 'surgeSecondRestart', 'J2') && !hasNote(d3, 'surgeSecondTrip'));
  ok('a start of two cyclic events: at the first, the trip of the second left out, with a note', J(d2.model, 2).surge.what === 'start' && J(d2.model, 2).surge.when[0].value.value === 1 && hasNote(d2, 'surgeSecondTrip', 'J2') && !hasNote(d2, 'surgeSecondRestart'));
  ok('one event makes no such note', !hasNote(file({ tModel: 2, trig: 1, ev1: [0, 0, 1, 'seconds', -1, -1, -1, -1] }), 'surgeSecondRestart'));
  const us = file({ tModel: 2, I: 300, IU: 'lbm-ft2' });
  ok('an inertia in lbm·ft²', J(us.model, 2).inertia.value === 300 && J(us.model, 2).inertia.unit === 'lb·ft²');
  const t3 = file({ tModel: 1, table1: { units: ['Percent'], rows: [[0, 100], [5, 50]] } });
  ok('a table of the speed (model 1)', J(t3.model, 2).surge.what === 'speed' && J(t3.model, 2).surge.tables[0].v.join() === '100,50' && J(t3.model, 2).surge.tables[0].vUnit === '%');
  const t4 = file({ tModel: 3, fqSource: 5, trig: 1, ev1: [0, 0, 0.5, 'seconds', -1, -1, -1, -1] });
  ok('a trip in four quadrants by a curve of the library: a trip without them, with a note (W-51)', J(t4.model, 2).surge.what === 'trip' && !J(t4.model, 2).fourQuad && hasNote(t4, 'surgeFourLibrary', 'J2'));
  const start = (v) => file(Object.assign({ tModel: 5, trig: 1, ev1: [0, 0, 0.5, 'seconds', -1, -1, -1, -1] }, v), 1);
  const s1 = start({ startSpeedType: 1, table1: { units: ['N-m'], tu: 'Percent', rows: [[0, 300], [50, 250], [100, 200]] } });
  const sj = J(s1.model, 2);
  ok('a start of a pump stopped and closed, with the torque of its motor in % of the rated speed (I-26, W-50)', sj.state === 'offClosed' && sj.surge.what === 'start' && sj.motor && sj.motor.x.join() === '0,50,100' && sj.motor.y.join() === '300,250,200' && sj.motor.yUnit === 'N·m'
    && !hasNote(s1, 'surgeStartState') && !hasNote(s1, 'surgeMotorAxis'));
  // the axis of the speeds of the table by startSpeedType (answer 3.1): 0 the speed of the shaft in rpm, 2 % of the
  // synchronous speed; turned into % of the rated speed, the axis of j.motor
  const s3 = start({ startSpeedType: 0, rpm: 1780, table1: { units: ['N-m'], tu: 'RPM', rows: [[0, 300], [890, 250], [1780, 200]] } });
  const s4 = start({ startSpeedType: 2, rpm: 1780, syncRpm: 1800, table1: { units: ['lbf-ft'], tu: 'Percent', rows: [[0, 220], [50, 180], [100, 0]] } });
  ok('the speeds of the shaft in rpm over the rated speed', J(s3.model, 2).motor.x.join() === '0,50,100' && !hasNote(s3, 'surgeMotorAxis'), JSON.stringify(J(s3.model, 2).motor));
  ok('the speeds in % of the synchronous speed, times the synchronous over the rated speed', J(s4.model, 2).motor.x.every((x, i) => near(x, [0, 50, 100][i] * 1800 / 1780, 1e-10)) && J(s4.model, 2).motor.yUnit === 'lbf·ft' && J(s4.model, 2).motor.y.join() === '220,180,0');
  const s5 = start({ startSpeedType: 0, rpm: 0, table1: { units: ['N-m'], tu: 'RPM', rows: [[0, 300], [1780, 200]] } }), s6 = start({ startSpeedType: 2, rpm: 1780, syncRpm: -1, table1: { units: ['N-m'], tu: 'Percent', rows: [[0, 300], [100, 200]] } });
  ok('without the rated or the synchronous speed the axis needs, the table asks for the user, with a note', !J(s5.model, 2).motor && hasNote(s5, 'surgeMotorSpeed', 'J2') && !J(s6.model, 2).motor && hasNote(s6, 'surgeMotorSpeed', 'J2'));
  const s7 = start({ startSpeedType: 1, table1: { units: ['N-m'], tu: 'RPM', rows: [[0, 300], [100, 200]] } });
  ok('a unit of the speeds that does not match the axis is read on the axis, with a note', J(s7.model, 2).motor.x.join() === '0,100' && hasNote(s7, 'surgeMotorAxis', 'J2'));
  const s2 = file({ tModel: 5, trig: 1, ev1: [0, 0, 0.5, 'seconds', -1, -1, -1, -1] }, 1);
  ok('a start without the table of the motor asks for it', hasNote(s2, 'surgeMotorMissing', 'J2'));
  ok('a start of a pump running in the steady state is reported', hasNote(file({ tModel: 5, trig: 1, ev1: [0, 0, 0.5, 'seconds', -1, -1, -1, -1] }), 'surgeStartState', 'J2'));
  const ctl = file({ ctlType: 1, ctl: 150, ctlU: 'm3/hr', tModel: 0, table1: { units: ['m3/hr'], rows: [[0, 150], [5, 100]] } });
  ok('the set point of a control over time is left out, with a note', J(ctl.model, 2).mode === 'controlFlow' && !J(ctl.model, 2).surge && hasNote(ctl, 'surgePumpTables', 'J2'));
  ok('a trip of a pump under control is reported', hasNote(file({ ctlType: 1, ctl: 150, ctlU: 'm3/hr', tModel: 2, trig: 1, ev1: [0, 0, 1, 'seconds', -1, -1, -1, -1] }), 'surgePumpState', 'J2'));
  ok('the check valve of the pump with a closing velocity is reported', hasNote(file({ tModel: 2, checkValve: -1, vClose: -0.1 }), 'surgePumpCheck', 'J2'));
  // a pump on a single pipe: the pipe the import creates takes the wave speed of the pipe of the pump (I-50); a pipe of
  // the file without its transient block does not
  const single = read(imp({ secs: [...control(), [BASE('JUNCTIONS'), [junc({ type: 17, id: 2, pipes: [-2], t: block(17, { pumpType: 0, hU: 'meters', qU: 'm3/hr', cfgSel: 1, cfg, speed: 1, submerged: -1, subType: 1, subP: 0.5, subPU: 'barG' }, 1) }), junc({ type: 2, id: 3, pipes: [2], t: tank({ level: 30 }) })]],
    [BASE('PIPES'), [pipe({ id: 2, from: 2, to: 3, L: 600, D: 20, surge: { a: 1100, n: 11, Z: impedance(1100, 0.2) } })]]] }));
  const made = single.model.pipes.find((p) => p.id !== 2);
  ok('the pipe created for a pump on a single pipe takes the wave speed of the pipe of the pump', made && made.surge && made.surge.a.value === 1100 && hasNote(single, 'surgeCreatedPipe', 'P' + made.id));
  const bare = read(imp({ secs: [...control(), [BASE('JUNCTIONS'), [junc({ type: 2, id: 1, pipes: [-1], t: tank({ level: 5 }) }), junc({ type: 17, id: 2, pipes: [1, -2], t: block(17, { pumpType: 0, hU: 'meters', qU: 'm3/hr', cfgSel: 1, cfg, speed: 1 }, 2) }), junc({ type: 2, id: 3, pipes: [2], t: tank({ level: 30 }) })]],
    [BASE('PIPES'), [pipe({ id: 1, from: 1, to: 2, L: 10, D: 20 }), pipe({ id: 2, from: 2, to: 3, L: 600, D: 20, surge: { n: 10, Z: impedance(1200, 0.2) } })]]] }));
  ok('a pipe of the file without its transient block stays without it, even next to a pump', !P(bare.model, 1).surge && hasNote(bare, 'surgePipe', 'P1') && !hasNote(bare, 'surgeCreatedPipe'));
  // the trip of the pump calculates
  const eff = M.effective(t1.model, 'base');
  const res = PumpIt.surge.run(eff);
  ok('the imported trip runs in the water hammer', res.ok, (res.errors || []).join('; '));
}

console.log('\nProtection devices, dynamic check valves, four quadrants and forces (sections 14.10 to 15, I-T7)');
{
  // reservoir → P1 (600 m) → J2 → P2 (600 m) → J3 (an imposed pressure), with the control and the transient blocks
  const blockS = { n: 10, Z: impedance(1200, 0.2) };
  const net = (j2, o = {}) => read(imp({
    secs: [
      ...control(),
      [BASE('JUNCTIONS'), [junc({ type: 2, id: 1, pipes: [-1], t: tank({ level: 30 }) }), j2, ...(o.end === false ? [] : [junc({ type: 4, id: 3, pipes: [2], t: { perPipe: [[0, 0, 0]], p: 0, pU: 'barG' } })])]],
      [BASE('PIPES'), [pipe({ id: 1, from: 1, to: 2, L: 600, D: 20, surge: blockS }), ...(o.end === false ? [] : [pipe({ id: 2, from: 2, to: 3, L: 600, D: 20, surge: blockS })])]],
      ...(o.more || []),
    ],
  }));
  const device = (type, t, o = {}) => net(junc({ type, id: 2, pipes: o.end === false ? [1] : [1, -2], spec: o.spec, t: Object.assign({ perPipe: o.end === false ? undefined : [[0, 0, 0], [0, 0, 0]] }, t) }), o);
  // surge tank (24, I-30)
  const st = device(24, { perPipe: [[0.5, 1, 0], [0.5, 1, 0]], height: 20, heightU: 'meters', area: 5, areaU: 'meters2', restrictor: -1, CdIn: 0.8, CdOut: 0.6, fa: 0.05, faU: 'meters2', riser: -1, riserF: 0.02, riserD: 0.5, riserDU: 'meters', riserL: 3, riserLU: 'meters' });
  const s = J(st.model, 2);
  ok('a surge tank: its section, its top, the K of its pipes, its level of the steady state', s.type === 'surgeTank' && s.shape === 'constant' && s.area.value === 5 && s.area.unit === 'm²' && s.height.value === 20 && s.level === 'steady' && s.pipeK[1].kOut === 0.5 && s.pipeK[2].kIn === 1);
  ok('its orifice, a discharge coefficient each way times the area, and its riser (W-41)', s.orifice === true && near(s.CdAin.value, 0.04) && near(s.CdAout.value, 0.03) && s.riser === true && s.riserL.value === 3 && s.riserD.value === 0.5 && s.riserF === 0.02);
  const st2 = device(24, { useVolTable: -1, volTable: { tu: 'meters', units: ['meters3'], rows: [[0, 0], [10, 50]] }, useRef: -1, refLevel: 12, refLevelU: 'meters', oneWay: -1, surfP: 1, surfPU: 'barG', table1: { units: ['barG'], rows: [[0, 1], [5, 2]] } });
  const s2 = J(st2.model, 2);
  ok('a table of volume by height reaching its top, a level given, one way, with notes', s2.shape === 'table' && s2.table.V.join() === '0,50' && s2.height.value === 10 && s2.level === 'given' && s2.liquidElev.value === 12 && s2.oneWay === true
    && hasNote(st2, 'surgeTankLevel', 'J2') && hasNote(st2, 'surgeOneWay', 'J2') && hasNote(st2, 'surgeTankPressure', 'J2') && hasNote(st2, 'surgeTankTables', 'J2'));
  ok('a device closed in the file is a node of its pipes, with a note', J(device(24, {}, { spec: 1 }).model, 2).type === 'branch' && hasNote(device(24, {}, { spec: 1 }), 'surgeDeviceClosed', 'J2'));
  // gas accumulator (22, I-29)
  // the orifice by its flag restrictor (answer 5): −1 there is one; 0 none, its coefficients not read and no note; −1
  // without a coefficient above zero each way or without its area, a note
  const noOr = device(24, { height: 20, heightU: 'meters', area: 5, areaU: 'meters2', restrictor: 0, CdIn: 0.8, CdOut: 0.6, fa: 0.05, faU: 'meters2' });
  const oneWay = device(24, { height: 20, heightU: 'meters', area: 5, areaU: 'meters2', restrictor: -1, CdIn: 0.8, CdOut: -1, fa: 0.05, faU: 'meters2' });
  ok('restrictor 0: no orifice, whatever its coefficients, and no note', !J(noOr.model, 2).orifice && !hasNote(noOr, 'surgeOrifice'));
  ok('restrictor −1 without a coefficient each way: no orifice, with a note (there is none of one way)', !J(oneWay.model, 2).orifice && hasNote(oneWay, 'surgeOrifice', 'J2'));
  const ac = device(22, { n: 1.2, V: 2, VU: 'm3', gasType: 0, restrictor: -1, CdIn: 0.8, CdOut: 0.8, fa: 0.01, faU: 'meters2', Vmax: 5, Vmin: 0.2, VlimU: 'm3' }, { end: false });
  const a = J(ac.model, 2);
  ok('a gas accumulator: an air vessel with its gas, the limits of its volume and its orifice', a.type === 'airVessel' && a.n === 1.2 && a.gasInit === 'given' && a.Vg0.value === 2 && a.Vg0.unit === 'm³' && a.vol.value === 5 && a.vgMin.value === 0.2 && a.shape === 'none' && a.orifice === true);
  const ac2 = device(22, { n: 1, V: 3, VU: 'm3', gasType: 1, gasP: 3, gasPU: 'barG', geometry: 1, geoTable: { tu: 'meters', units: ['m3'], rows: [[0, 0], [2, 4]] }, geoHU: 'meters', geoVU: 'm3', height: 2, heightU: 'meters' }, { end: false });
  const a2 = J(ac2.model, 2);
  ok('with a pre-charge and a geometry by a table (a hypothesis, with a note)', a2.gasInit === 'precharge' && a2.Ppre.value === 3 && a2.Ppre.unit === 'bar(g)' && a2.Vpre.value === 3 && a2.shape === 'table' && a2.table.V.join() === '0,4' && hasNote(ac2, 'surgePrecharge', 'J2'));
  // relief valve (21, I-28)
  const rv = (t, o) => device(21, Object.assign({ valveType: 2, lossType: 0, loss: 50, crackType: 1, crack: 8, crackU: 'barG', back: 0, backU: 'None', openType: 2, over: 9, overU: 'barG', closeType: 2, blowdown: 7, blowdownU: 'barG' }, t), Object.assign({ end: false }, o));
  const r1 = rv({ rateClose: -1, rateOpen: -1, rates: [[0, 100, 20, 10]] });
  const v1 = J(r1.model, 2);
  ok('a relief valve at an outlet: its pressures, its Cv, the ambient outside, its speed', v1.type === 'reliefValve' && v1.Pset.value === 8 && v1.Pfull.value === 9 && v1.Pclose.value === 7 && v1.lossModel === 'Cv' && v1.Cv === 50 && v1.Pext.value === 0 && v1.mode === 'pressure' && v1.rate === 10 && hasNote(r1, 'surgeRate', 'J2'));
  ok('in line at an outlet (3), between two pipes', J(rv({ valveType: 3 }, { end: true }).model, 2).type === 'reliefValve');
  const r3 = rv({ valveType: 1 }, { end: true });
  ok('an internal one (1): a closed valve between its pipes, with a note', J(r3.model, 2).type === 'valve' && J(r3.model, 2).closed === true && hasNote(r3, 'surgeReliefInternal', 'J2'));
  const r4 = rv({ crack: 2, crackU: 'psid', back: 1, backU: 'barG', lossType: 1, loss: 4, openType: 0, closeType: 3 });
  const v4 = J(r4.model, 2), A = Math.PI * 0.2 * 0.2 / 4;
  ok('a differential opening pressure over the outlet pressure; a K as a Cd·A at its pipe; at once; never closing, with a note', near(U.toSI(v4.Pset.value, v4.Pset.unit, 'pressure'), U.PATM + 1e5 + 2 * PSI, 1e-9) && v4.lossModel === 'CdA' && near(v4.CdA.value, (A / 2) * 1e4) && v4.mode === 'instant' && hasNote(r4, 'surgeReliefNever', 'J2'));
  // the base of its pressures (answer 10.1): balanced −1 the pressures at the valve, absolute or gauge by their unit; 0
  // differences over the outlet pressure in any unit of pressure; the full opening and closing pressures on the same
  // base, never relative to the opening one; crackType 0 heads, by ρ·g·h, or a piezometric head with balanced −1
  const SI = (x) => U.toSI(x.value, x.unit, 'pressure'), rg = 998.2 * 9.80665;
  const r5 = J(rv({ balanced: -1, crack: 300, crackU: 'psia', over: 325, overU: 'psia', blowdown: 250, blowdownU: 'psia', back: 1, backU: 'barG' }).model, 2);
  ok('balanced −1: absolute pressures at the valve, the outlet pressure not added', r5.Pset.value === 300 && r5.Pset.unit === 'psia' && r5.Pfull.value === 325 && r5.Pclose.value === 250 && r5.Pclose.unit === 'psia');
  const r6 = J(rv({ balanced: 0, crack: 10, crackU: 'bar', over: 11, overU: 'bar', blowdown: 9, blowdownU: 'bar', back: 1, backU: 'barG' }).model, 2);
  ok('balanced 0: an absolute unit read as a difference over the outlet pressure, the three on the same base', r6.Pset.unit === 'bar(g)' && near(r6.Pset.value, 11, 1e-12) && near(r6.Pfull.value, 12, 1e-12) && near(r6.Pclose.value, 10, 1e-12), JSON.stringify([r6.Pset, r6.Pfull, r6.Pclose]));
  const r7 = J(rv({ crackType: 0, crack: 50, crackU: 'meters', over: 55, overU: 'meters', blowdown: 45, blowdownU: 'meters' }).model, 2);
  ok('crackType 0: heads of the liquid as differences, ρ·g·h over the outlet pressure', r7.Pset.unit === 'kPa(g)' && near(SI(r7.Pset), U.PATM + rg * 50, 1e-12) && near(SI(r7.Pfull), U.PATM + rg * 55, 1e-12) && near(SI(r7.Pclose), U.PATM + rg * 45, 1e-12));
  const piezo = net(junc({ type: 21, id: 2, pipes: [1], z: 10, t: { valveType: 2, lossType: 0, loss: 50, crackType: 0, balanced: -1, crack: 60, crackU: 'meters', openType: 0, back: 0, backU: 'None' } }), { end: false });
  ok('crackType 0 with balanced −1: a piezometric head, at the elevation of the valve with the ambient pressure', near(SI(J(piezo.model, 2).Pset), U.PATM + rg * (60 - 10), 1e-12), JSON.stringify(J(piezo.model, 2).Pset));
  const r8 = rv({ balanced: -1, crack: 100, crackU: 'psid' });
  ok('balanced −1 with a unit of difference: not read, with a note', J(r8.model, 2).Pset.value === null && hasNote(r8, 'unit', 'J2'));
  // air valve (25, I-31)
  const av = (t) => device(25, Object.assign({ crackType: 1, crack: 0, crackU: 'psig', CdAin: 20, CdAinU: 'cm2', CdAout: 2, CdAoutU: 'cm2', avType: 3, CdAmid: 0.5, CdAmidU: 'cm2', trigType: 0, trig: 0.1, trigU: 'bar', liqTType: 1, liqT: 15, liqTU: 'deg. C', m0: 0.001, m0U: 'kg', molWt: 28.96, gamma: 1.4 }, t));
  const w0 = av({});
  const w1 = J(w0.model, 2);
  ok('an air valve in two stages: its Cd·A, its switch by a pressure difference (trigType 0), its air', w1.type === 'airValve' && w1.avType === 'twoStage' && w1.CdAin.value === 20 && w1.CdAin.unit === 'cm²' && w1.CdAout2.value === 0.5 && w1.switchBy === 'dP' && w1.switchDP.value === 0.1 && w1.switchDP.unit === 'bar'
    && w1.Popen.value === 0 && w1.Tair.value === 15 && w1.Tair.unit === '°C' && w1.mAir0.value === 0.001 && !hasNote(w0, 'surgeAirFlowSense') && !hasNote(w0, 'surgeAirOutside'));
  // trigType 1: the volumetric flow of the air expelled, at the outside pressure and the temperature of the cavity, as a
  // mass flow, with a note on the sense of the switch (answer 10.3)
  const w2 = av({ trigType: 1, trig: 0.05, trigU: 'm3/sec', gasPext: 1, gasPextU: 'atm', delay: 2 });
  const rhoAir = U.PATM / ((8314.462618 / 28.96) * 288.15);
  ok('a switch by the volumetric flow of the air expelled, as a mass flow, with a note on its sense', J(w2.model, 2).switchBy === 'flow' && J(w2.model, 2).switchFlow.unit === 'kg/s' && near(J(w2.model, 2).switchFlow.value, 0.05 * rhoAir, 1e-11) && hasNote(w2, 'surgeAirFlowSense', 'J2') && hasNote(w2, 'surgeAirDelay', 'J2'), JSON.stringify(J(w2.model, 2).switchFlow));
  const w3 = av({ trigType: 1, trigU: 'kg/sec', molWt: 4 });
  ok('a mass flow is taken as it is; another gas is reported', J(w3.model, 2).switchFlow.value === 0.1 && J(w3.model, 2).switchFlow.unit === 'kg/s' && hasNote(w3, 'surgeAirGas', 'J2'));
  const w5 = av({ trig: 0.3, trigU: 'kg/sec' });
  ok('the code of the trigger decides, not the unit: a flow under trigType 0 does not read, with a note', J(w5.model, 2).switchFlow.value !== 0.3 && J(w5.model, 2).switchDP.value !== 0.3 && hasNote(w5, 'surgeAirSwitch', 'J2'));
  // the air at the temperature of the liquid (answer 10.2): liqTType 0 that of the fluid of the model; the outside air
  // at another temperature is reported; crackType 0, a piezometric head
  const w4 = av({ liqTType: 0, liqT: 50, gasText: 20, gasTextU: 'deg. C', crackType: 0, crack: 5, crackU: 'meters' });
  ok('the air at the temperature of the fluid of the model; an opening pressure as a piezometric head', J(w4.model, 2).Tair.value === 20 && J(w4.model, 2).Tair.unit === '°C' && !hasNote(w4, 'surgeAirOutside')
    && near(SI(J(w4.model, 2).Popen), U.PATM + rg * 5, 1e-12), JSON.stringify(J(w4.model, 2).Popen));
  ok('outside air at another temperature than the air of the valve is reported', hasNote(av({ gasText: 30, gasTextU: 'deg. C' }), 'surgeAirOutside', 'J2') && !hasNote(av({ gasText: 59, gasTextU: 'deg. F' }), 'surgeAirOutside'));
  // without the module the devices come in as kinds the .fth importer does not read
  const SG = PumpIt.surge;
  delete PumpIt.surge;
  const none = device(24, { height: 20, heightU: 'meters', area: 5, areaU: 'meters2' });
  PumpIt.surge = SG;
  ok('without the module, a device is a component without loss, with a note', J(none.model, 2).type === 'generic' && hasNote(none, 'unknownLoss', 'J2'));
  // dynamic check valves (I-27)
  const chk = (t) => device(10, Object.assign({ lossType: 0, loss: 400 }, t));
  const d1 = chk({ model: 1, perfType: 2, decelWindow: 0.2, decelTable: { tu: 'meters/sec2', units: ['meters/sec'], rows: [[0, 0], [5, 0.1], [20, 0.5]] } });
  const dj = J(d1.model, 2);
  ok('a check valve by deceleration with the table of the user, its window in seconds (answer 8.1)', dj.dynamic === 'decel' && dj.decel.x.join() === '0,5,20' && dj.decel.y.join() === '0,0.1,0.5' && dj.decel.xUnit === 'm/s²' && dj.decel.yUnit === 'm/s' && dj.decelWindow.value === 0.2 && dj.decelWindow.unit === 's'
    && hasNote(d1, 'surgeDecel', 'J2') && !hasNote(d1, 'surgeDecelWindow'));
  const d1b = chk({ model: 1, perfType: 2, decelWindow: -1, decelTable: { tu: 'meters/sec2', units: ['meters/sec'], rows: [[0, 0], [5, 0.1], [20, 0.5]] } });
  ok('a window of −1, the average of the program: the window of Pump It, with a note; NumDecelPoints is not read', !J(d1b.model, 2).decelWindow && hasNote(d1b, 'surgeDecelWindow', 'J2'));
  const d2 = chk({ model: 1, perfType: 0 });
  ok('by a curve of the library: instantaneous, with a note (W-51)', !J(d2.model, 2).dynamic && hasNote(d2, 'surgeCheckLibrary', 'J2'));
  // a swinging disc (answers 6 and 7): its angles from the seat, the seat inclined by 90° − thMax, its weight without
  // buoyancy, no fluid mass, its inertia with those of the counterweight and of the liquid it drags
  const disc = { model: 2, I: 0.5, IU: 'kg-m2', rcg: 0.1, rcgU: 'meters', Ad: 0.03, AdU: 'meters2', Wd: 50, WdU: 'N', ks: -999, Ts0: -999, thMin: 10, thMax: 80, cvTheta: { tu: 'degrees', units: ['None'], rows: [[10, 400], [45, 200], [80, 0]] }, fluidMassType: 2, cwAngle: -999 };
  const swd = (v) => chk(Object.assign({}, disc, v));
  const sw = swd({ dpType: 1, dpOpen: 0.02, dpOpenU: 'bar' });
  const sj = J(sw.model, 2), swing = sj.swing, missS = [];
  PumpIt.surge.checks.validate(sj, missS);
  ok('a swinging disc: its angles from the seat, its seat, its arm, its weight as its mass, its Cv by angle', sj.dynamic === 'swing' && swing.thetaMax.value === 70 && swing.seat.value === 10 && swing.seat.unit === '°' && swing.I.value === 0.5 && swing.rcg.value === 0.1 && swing.rp.value === 0.1
    && near(swing.md.value, 50 / 9.80665) && swing.fluidMass === 'none' && swing.orient === 'horizontal' && swing.cv.x.join() === '0,35,70' && swing.cv.y.join() === '0,50,100' && !swing.Wc.value && hasNote(sw, 'surgeSwing', 'J2'));
  ok('which the checklist of the water hammer takes complete; its reopening difference, worked out by the program, is not read', !missS.length && sj.dPopen.value === 0, missS.join() + JSON.stringify(sj.dPopen));
  const r = Math.sqrt(0.03 / Math.PI), mf0 = (4 / 3) * Math.PI * r ** 3 * 998.2;
  const fm0 = J(swd({ fluidMassType: 0 }).model, 2).swing, fm1 = J(swd({ fluidMassType: 1, fluidMass: 2, fluidMassU: 'kg' }).model, 2).swing;
  ok('the liquid it drags adds 1.25·m_f·r² to its inertia: calculated, (4/3)·π·r³·ρ, or given', near(fm0.I.value, 0.5 + 1.25 * mf0 * r * r, 1e-10) && near(fm1.I.value, 0.5 + 1.25 * 2 * r * r, 1e-10) && fm0.fluidMass === 'none' && fm1.fluidMass === 'none', `${fm0.I.value} ${fm1.I.value}`);
  const noArea = swd({ fluidMassType: 0, Ad: 0 });
  ok('without the area of the disc that inertia is not added, with a note', J(noArea.model, 2).swing.I.value === 0.5 && hasNote(noArea, 'surgeSwingFluid', 'J2'));
  const cw = J(swd({ cwW: 10, cwWU: 'N', cwL: 0.2, cwLU: 'meters', cwI: 0.1, cwIU: 'kg-m2', cwAngle: 30 }).model, 2).swing;
  ok('a counterweight: its weight, arm and angle, its inertia added to that of the disc', cw.Wc.value === 10 && cw.Wc.unit === 'N' && cw.rc.value === 0.2 && cw.delta.value === 30 && near(cw.I.value, 0.6, 1e-12));
  // the counterweight by the presence of its units, not by its angle (second answers, 2): the cases 2.A to 2.E
  const exw = { I: 0.2, Ad: 0.02, thMin: 10, thMax: 45, orient: 0, cvTheta: { tu: 'degrees', units: ['None'], rows: [[10, 400], [45, 0]] } };
  const noteOf = (res, key) => res.notes.find((n) => n.key === key);
  const w2a = swd(Object.assign({}, exw, { cwL: 0.15, cwLU: 'meters', cwW: 30, cwWU: 'N', cwI: 0.05, cwIU: 'kg-m2', cwAngle: 30 }));
  const s2a = J(w2a.model, 2).swing;
  ok('2.A a counterweight with its three units: Wc, rc, delta, its inertia added; the reopening threshold of the program in a note', s2a.Wc.value === 30 && s2a.rc.value === 0.15 && s2a.delta.value === 30 && near(s2a.I.value, 0.25, 1e-10)
    && hasNote(w2a, 'surgeCounterReopen', 'J2') && noteOf(w2a, 'surgeCounterReopen').params.dp === '1.768', JSON.stringify(noteOf(w2a, 'surgeCounterReopen')));
  const w2b = swd(Object.assign({}, exw, { cwL: 0, cwLU: 'None', cwW: 0, cwWU: 'None', cwI: 0.05, cwIU: 'kg-m2', cwAngle: 0 }));
  ok('2.B only the inertia has a unit: no torque, its inertia added, no note', !J(w2b.model, 2).swing.Wc.value && near(J(w2b.model, 2).swing.I.value, 0.25, 1e-10)
    && !w2b.notes.some((n) => /^surgeCounter/.test(n.key)));
  const w2c = [-181, -999].map((a) => swd(Object.assign({}, exw, { cwL: 0, cwLU: 'None', cwW: 0, cwWU: 'None', cwI: 0.05, cwIU: 'kg-m2', cwAngle: a })));
  ok('2.C a unit and an angle outside −180° to 180° (−181 and −999): the program refuses it; no counterweight, no inertia, a note', w2c.every((r) => !J(r.model, 2).swing.Wc.value && near(J(r.model, 2).swing.I.value, 0.2, 1e-10) && hasNote(r, 'surgeCounterAngle', 'J2')));
  const w2d = swd(Object.assign({}, exw, { cwL: -999, cwLU: 'None', cwW: -999, cwWU: 'None', cwI: -999, cwIU: 'None', cwAngle: -999 }));
  ok('2.D no unit at all (the −999 of an empty record): no counterweight, no note', !J(w2d.model, 2).swing.Wc.value && near(J(w2d.model, 2).swing.I.value, 0.2, 1e-10) && !w2d.notes.some((n) => /^surgeCounter/.test(n.key)));
  const w2e = swd(Object.assign({}, exw, { cwL: -999, cwLU: 'None', cwW: -999, cwWU: 'None', cwI: 0.05, cwIU: 'kg-m2', cwAngle: 30 }));
  ok('2.E a negative value counts even without its unit: the program refuses it; nothing of the counterweight, a note', near(J(w2e.model, 2).swing.I.value, 0.2, 1e-10) && hasNote(w2e, 'surgeCounterNegative', 'J2') && !hasNote(w2e, 'surgeCounterAngle'));
  const w2f = swd(Object.assign({}, exw, { cwL: 0.15, cwLU: 'meters', cwW: 30, cwWU: 'N', cwI: 0, cwIU: '(User Specified)', cwAngle: 30, ks: 2, ksU: 'N-m/deg', Ts0: 1, Ts0U: 'N-m' }));
  const w2g = swd(Object.assign({}, exw, { cwL: 0.15, cwLU: 'NA', cwW: 30, cwWU: '(User Specified)', cwAngle: 30 }));
  ok('(User Specified) and NA are not a unit: no counterweight; the threshold of the program adds Ts0 with a spring', !J(w2g.model, 2).swing.Wc.value && !w2g.notes.some((n) => /^surgeCounter/.test(n.key))
    && noteOf(w2f, 'surgeCounterReopen').params.dp === String(+((50 * 0.1 * Math.cos(Math.PI / 4) + 1) / (0.1 * 0.02) / 1000).toPrecision(4)));
  // the spring per degree, its torque at the seat only with a spring (answer 7.1)
  const sp = J(swd({ ks: 2, ksU: 'N-m/deg', Ts0: 5, Ts0U: 'N-m' }).model, 2).swing, spUS = J(swd({ ks: 1, ksU: 'lbf-ft/deg', Ts0: 3, Ts0U: 'lbf-ft' }).model, 2).swing;
  ok('a spring per degree, N·m/rad = N·m/° × 180/π, and its torque at the seat', sp.ks.value === 2 && sp.ks.unit === 'N·m/°' && near(U.toSI(2, 'N·m/°', 'rotStiffness'), 2 * 180 / Math.PI, 1e-12) && sp.Ts0.value === 5 && sp.Ts0.unit === 'N·m'
    && near(U.toSI(spUS.ks.value, spUS.ks.unit, 'rotStiffness'), 4.4482216152605 * FT * 180 / Math.PI, 1e-10) && spUS.Ts0.unit === 'lbf·ft');
  const noSpring = J(swd({ ks: -999, Ts0: 5, Ts0U: 'N-m' }).model, 2).swing, perRad = swd({ ks: 2, ksU: 'N-m/rad' }), linear = swd({ ks: 2, ksU: 'N/m' });
  ok('no spring: no torque of a spring, nor its torque at the seat', !noSpring.ks.value && !noSpring.Ts0.value);
  // the spring by its units (second answers, correction of 7.1): none without the unit of ks or with ks 0; the two units
  // go together; a negative ks with its unit is invalid
  const spNone = swd({ ks: -999, ksU: 'None', Ts0: -999, Ts0U: 'None' }), spZero = swd({ ks: 0, ksU: 'N-m/deg', Ts0: 5, Ts0U: 'N-m' });
  const spOne = swd({ ks: 2, ksU: 'N-m/deg', Ts0: 5, Ts0U: 'None' }), spNeg = swd({ ks: -3, ksU: 'N-m/deg', Ts0: 5, Ts0U: 'N-m' });
  ok('ks −999 without units: no spring and no note; ks 0 with units: no spring, no Ts0, no note',
    !J(spNone.model, 2).swing.ks.value && !spNone.notes.some((n) => /^surgeSpring/.test(n.key)) && !J(spZero.model, 2).swing.ks.value && !J(spZero.model, 2).swing.Ts0.value && !spZero.notes.some((n) => /^surgeSpring/.test(n.key)));
  ok('only one of the two units: the program refuses it, a note; the spring is read as the file has it', hasNote(spOne, 'surgeSpringRefused', 'J2') && J(spOne.model, 2).swing.ks.value === 2 && !J(spOne.model, 2).swing.Ts0.value
    && hasNote(swd({ ks: -999, ksU: 'None', Ts0: 5, Ts0U: 'N-m' }), 'surgeSpringRefused', 'J2'));
  ok('a negative ks with its unit: invalid data, a note, no spring', hasNote(spNeg, 'surgeSpringNegative', 'J2') && !J(spNeg.model, 2).swing.ks.value && !J(spNeg.model, 2).swing.Ts0.value);
  ok('a spring in a unit that is not a torque per degree asks for the user, with a note', !J(perRad.model, 2).swing.ks.value && hasNote(perRad, 'surgeSwingSpring', 'J2') && hasNote(linear, 'surgeSwingSpring', 'J2'));
  // its position (answer 7.2): 0 horizontal, 1 vertical with the flow upwards, 2 the angle given
  const up = J(swd({ orient: 1, orientAngle: 90 }).model, 2).swing, tilt = J(swd({ orient: 2, orientAngle: 30 }).model, 2).swing, odd = swd({ orient: 7 });
  ok('its position: vertical, or an angle given in degrees; another code horizontal, with a note', up.orient === 'vertical' && tilt.orient === 'angle' && tilt.phi.value === 30 && tilt.phi.unit === '°' && J(odd.model, 2).swing.orient === 'horizontal' && hasNote(odd, 'surgeObjCode', 'J2'));
  const missT = [];
  PumpIt.surge.checks.validate(J(swd({ orient: 2, orientAngle: 30, ks: 2, ksU: 'N-m/deg', Ts0: 5, Ts0U: 'N-m', cwW: 10, cwWU: 'N', cwL: 0.2, cwLU: 'meters', cwI: 0.1, cwIU: 'kg-m2', cwAngle: 30, fluidMassType: 0 }).model, 2), missT);
  ok('a disc with all of them, which the checklist takes complete', !missT.length, missT.join());
  // a sliding disc (answers 6.2 and the correction of I-56): the travel of its table from the stop fully open, so the
  // travel from the seat is xMax less it; its mass with that of the liquid it moves
  const slide = { model: 3, WdT: 20, WdTU: 'N', AdT: 0.02, AdTU: 'meters2', xMax: 30, xMaxU: 'mm', ksT: 5000, ksTU: 'N/m', Fs0: 50, Fs0U: 'N', cvTravel: { tu: 'mm', units: ['None'], rows: [[0, 300], [15, 150], [30, 0]] }, fluidMassType: 2 };
  const sl = chk(slide);
  const nj = J(sl.model, 2), missN = [];
  PumpIt.surge.checks.validate(nj, missN);
  ok('a sliding disc: its travel, its weight as its mass, its spring, its Cv by the travel from the seat', nj.dynamic === 'nozzle' && nj.nozzle.xMax.value === 30 && near(nj.nozzle.m.value, 20 / 9.80665) && nj.nozzle.fluidMass === 'none' && nj.nozzle.k.value === 5000 && nj.nozzle.F0.value === 50
    && nj.nozzle.cv.x.join() === '0,15,30' && nj.nozzle.cv.y.join() === '0,50,100' && nj.nozzle.cv.xUnit === 'mm' && !missN.length, missN.join() + JSON.stringify(nj.nozzle.cv));
  const sl2 = J(chk(Object.assign({}, slide, { fluidMassType: 1, fluidMass: 0.75, fluidMassU: 'kg', orient: 1 })).model, 2).nozzle, sl3 = chk(Object.assign({}, slide, { fluidMassType: 0 }));
  ok('the mass of liquid given adds to its mass and stands for itself in the buoyancy (m = WdT/g + m_a, m_f = m_a); vertical', near(sl2.m.value, 20 / 9.80665 + 0.75, 1e-10) && sl2.fluidMass === 'user' && sl2.mf.value === 0.75 && sl2.orient === 'vertical');
  ok('the mass the program estimates at each step is left out, with a note', J(sl3.model, 2).nozzle.fluidMass === 'none' && near(J(sl3.model, 2).nozzle.m.value, 20 / 9.80665) && hasNote(sl3, 'surgeSlidingFluid', 'J2'));
  // the spring of the sliding disc (second answers, 1): Fs0 only with ksT above 0; the cases 1.A to 1.D
  const sx = { model: 3, orient: 1, WdT: 20, WdTU: 'N', AdT: 0.01, AdTU: 'meters2', xMax: 0.05, xMaxU: 'meters', Fs0: 50, Fs0U: 'N', fluidMassType: 2, cvTravel: { tu: 'meters', units: ['None'], rows: [[0, 300], [0.05, 0]] } };
  const sxn = (v) => { const r = chk(Object.assign({}, sx, v)); return { r, n: J(r.model, 2).nozzle }; };
  const x1a = sxn({ ksT: 1000, ksTU: 'N/m' });
  ok('1.A a spring: k = ksT, F_s0 = Fs0, no note of the spring', x1a.n.k.value === 1000 && x1a.n.k.unit === 'N/m' && x1a.n.F0.value === 50 && !x1a.r.notes.some((n) => /^surgeSliding(Refused|Reopen)|^surgeSpring/.test(n.key)));
  const x1b = sxn({ ksT: 0, ksTU: 'N/m' });
  ok('1.B ksT 0: no spring, no force at the seat; the note gives the two reopening thresholds, 7 kPa of the program and 2 kPa of Pump It', !x1b.n.k.value && !x1b.n.F0.value && hasNote(x1b.r, 'surgeSlidingReopen', 'J2')
    && noteOf(x1b.r, 'surgeSlidingReopen').params.dp === '7' && noteOf(x1b.r, 'surgeSlidingReopen').params.dpP === '2', JSON.stringify(noteOf(x1b.r, 'surgeSlidingReopen')));
  const x1h = sxn({ ksT: 0, ksTU: 'N/m', orient: 0 });
  ok('1.B horizontal: 5 kPa of the program, 0 of Pump It', noteOf(x1h.r, 'surgeSlidingReopen').params.dp === '5' && noteOf(x1h.r, 'surgeSlidingReopen').params.dpP === '0');
  const x1c = [sxn({ ksT: -999, ksTU: 'None' }), sxn({ ksT: -999, ksTU: '' })];
  ok('1.C ksT without its unit: the program refuses the valve; k = 0, F_s0 = 0, a note', x1c.every((x) => !x.n.k.value && !x.n.F0.value && hasNote(x.r, 'surgeSlidingRefused', 'J2') && !hasNote(x.r, 'surgeSpringNegative')));
  const x1d = sxn({ ksT: -999, ksTU: 'N/m' });
  ok('1.D ksT negative with its unit: no spring, F_s0 = 0, a note of a negative spring constant', !x1d.n.k.value && !x1d.n.F0.value && hasNote(x1d.r, 'surgeSpringNegative', 'J2') && !hasNote(x1d.r, 'surgeSlidingRefused'));
  ok('a sliding disc without the unit of Fs0 (or with a table of one row): refused, a note; Fs0 not read', (() => {
    const a = sxn({ ksT: 1000, ksTU: 'N/m', Fs0U: 'None' }), b = sxn({ ksT: 1000, ksTU: 'N/m', cvTravel: { tu: 'meters', units: ['None'], rows: [[0, 300]] } });
    return hasNote(a.r, 'surgeSlidingRefused', 'J2') && a.n.k.value === 1000 && !a.n.F0.value && hasNote(b.r, 'surgeSlidingRefused', 'J2');
  })());
  ok('a sliding disc whose fluidMassType 1 has no unit for the mass: refused, a note', hasNote(sxn({ ksT: 1000, ksTU: 'N/m', fluidMassType: 1, fluidMass: 1, fluidMassU: 'None' }).r, 'surgeSlidingRefused', 'J2'));
  // four quadrants of the user (I-25): the table of θ, WH and WB, closed at 360°
  const th = [0, 45, 90, 135, 180, 225, 270, 315];
  const fq = { tu: 'degrees', units: ['None', 'None'], rows: th.map((x) => [x, Math.cos((x * Math.PI) / 180), Math.sin((x * Math.PI) / 180)]) };
  const cfg = [{ cfgQmax: 500, cfgH: [80, 0, -0.0002], cfgE: [0, 0.5, -0.0008] }];
  const pumpNet = (v, spec) => read(imp({
    secs: [
      ...control(),
      [BASE('JUNCTIONS'), [junc({ type: 2, id: 1, pipes: [-1], t: tank({ level: 5 }) }), junc({ type: 17, id: 2, pipes: [1, -2], spec, t: block(17, Object.assign({ pumpType: 0, hU: 'meters', qU: 'm3/hr', cfgSel: 1, cfg, speed: 1, I: 12, IU: 'kg-m2', rpm: 1780 }, v), 2) }), junc({ type: 2, id: 3, pipes: [2], t: tank({ level: 30 }) })]],
      [BASE('PIPES'), [pipe({ id: 1, from: 1, to: 2, L: 10, D: 20, surge: { n: 1, Z: impedance(1200, 0.2) } }), pipe({ id: 2, from: 2, to: 3, L: 600, D: 20, surge: blockS })]],
    ],
  }));
  const ev = { trig: 1, ev1: [0, 0, 0.5, 'seconds', -1, -1, -1, -1] };
  const f1 = pumpNet(Object.assign({ tModel: 3, fqSource: 0, fqIncr: 8, fqData: fq, fqRated: 0 }, ev));
  const fj = J(f1.model, 2);
  ok('a trip in four quadrants with the table of the user, closed at 360°, the reference of the steady state', fj.surge.what === 'trip' && fj.fourQuad.use && fj.fourQuad.ref === 'steady' && fj.fourQuad.theta.join() === '0,45,90,135,180,225,270,315,360' && fj.fourQuad.wh[8] === fj.fourQuad.wh[0]
    && fj.fourQuad.wh[2] === fq.rows[2][1] && !!PumpIt.surge.pumps.suterTable(fj.fourQuad) && hasNote(f1, 'surgeFour', 'J2') && !hasNote(f1, 'surgeFourType1'));
  ok('the reference of the best efficiency; four quadrants in the steady state, with a note (I-35)', J(pumpNet({ tModel: 7, fqSource: 0, fqIncr: 8, fqData: fq, fqRated: 1 }).model, 2).fourQuad.ref === 'bep' && hasNote(pumpNet({ tModel: 7, fqSource: 0, fqIncr: 8, fqData: fq, fqRated: 2 }), 'surgeFourSteady', 'J2'));
  // θ by the order of the rows, from 0° in steps of 360°/fqIncr, not by the column; the row after fqIncr is not read
  // (answer 9.2)
  const rowsOf = (n, f) => Array.from({ length: n }, (_, k) => f(k));
  const four = (v) => J(pumpNet(Object.assign({ tModel: 7, fqSource: 0 }, v)).model, 2).fourQuad;
  const byRow = four({ fqIncr: 8, fqData: { units: ['None', 'None'], rows: rowsOf(9, (k) => [0, k === 8 ? 9 : k, -k]) } });
  ok('θ by the order of the rows; the closing row of the table is the first one, not the row after fqIncr', byRow.theta.join() === '0,45,90,135,180,225,270,315,360' && byRow.wh.join() === '0,1,2,3,4,5,6,7,0' && byRow.wb[8] === 0, JSON.stringify(byRow));
  // fqAngleType 1, θ = atan2(α, v): moved to the θ of Pump It by (270° − θ) mod 360° and sorted (answer 9.1); the row at
  // 45° of the file (α = v = 1) is at 225°
  const t1 = four({ fqIncr: 8, fqAngleType: 1, fqData: { units: ['None', 'None'], rows: rowsOf(8, (k) => [k * 45, k, -k]) } });
  ok('a table with θ = atan2(α, v), moved to π + atan2(v, α), with a note', t1.theta.join() === '0,45,90,135,180,225,270,315,360' && t1.wh.join() === '6,5,4,3,2,1,0,7,6' && t1.wb.join() === '-6,-5,-4,-3,-2,-1,0,-7,-6' && t1.wh[t1.theta.indexOf(225)] === 1
    && hasNote(pumpNet({ tModel: 7, fqSource: 0, fqIncr: 8, fqAngleType: 1, fqData: { units: ['None', 'None'], rows: rowsOf(8, (k) => [k * 45, k, -k]) } }), 'surgeFourType1', 'J2'), JSON.stringify(t1));
  const t10 = four({ fqIncr: 10, fqAngleType: 1, fqData: { units: ['None', 'None'], rows: rowsOf(11, (k) => [k * 36, k % 10, 0]) } });
  ok('moved points that do not hold 0°: its point on the straight line between the last point and the first', t10.theta[0] === 0 && t10.wh[0] === 7.5 && t10.theta[t10.theta.length - 1] === 360 && t10.wh[t10.wh.length - 1] === 7.5 && t10.theta.length === 12 && !!PumpIt.surge.pumps.suterTable(t10), JSON.stringify(t10));
  const short = pumpNet({ tModel: 7, fqSource: 0, fqIncr: 8, fqData: { units: ['None', 'None'], rows: rowsOf(7, (k) => [k * 45, 1, 1]) } }), oddType = pumpNet({ tModel: 7, fqSource: 0, fqIncr: 8, fqAngleType: 2, fqData: fq });
  ok('fewer rows than fqIncr, or a code of θ that is not known: left out, with a note', !J(short.model, 2).fourQuad && hasNote(short, 'surgeFourTable', 'J2') && !J(oddType.model, 2).fourQuad && hasNote(oddType, 'surgeFourAngle', 'J2'));
  const f2 = pumpNet(Object.assign({ tModel: 4, fqSource: 0, fqIncr: 8, fqData: fq, table1: { units: ['Percent'], rows: [[0, 0], [5, 100]] } }, ev), 1);
  ok('a start with a known speed in four quadrants: the table of its speed from 0 %, at its event', J(f2.model, 2).surge.what === 'speed' && J(f2.model, 2).surge.start === 'single' && J(f2.model, 2).surge.tables[0].v.join() === '0,100' && !hasNote(f2, 'surgePumpState'));
  const f3 = pumpNet({ tModel: 4, fqSource: 0, fqIncr: 8, fqData: fq, trig: 3, ev1: ev.ev1, ev2: [0, 0, 8, 'seconds', -1, -1, -1, -1], table1: { units: ['Percent'], rows: [[0, 0], [5, 100]] } }, 1);
  ok('with two events: the table at the first, the trip of the second left out, with a note', J(f3.model, 2).surge.start === 'single' && J(f3.model, 2).surge.when.length === 1 && J(f3.model, 2).surge.tables.length === 1 && hasNote(f3, 'surgeSecondTrip', 'J2'));
  ok('without the four-quadrant data it is left out, with a note', hasNote(pumpNet(Object.assign({ tModel: 4, fqSource: 5 }, ev), 1), 'surgeStartFour', 'J2'));
  // force sets (section 15, I-33)
  const forces = (applied, more = []) => read(t5({ more: [['FORCE SET DATA', ['NumberofForceSets= 3', 'ForceSetLengthUnits= meters', 'ForceSetAmbientPressureUnits= kPa', 'ForceSetAmbientPressureUsage= 0', 'ForceSetExitAreaUnits= cm2',
    'ForceSet#1= 1,Along,0,1,0,1,600,101.325,0,0,0,0,0,0', 'ForceSet#2= 2,Point,1,1,300,1,300,101.325,0,0,0,1,0,0', 'ForceSet#3= 3,Exit,3,1,0,1,600,101.325,0,200,0,0,0,0', ...more]], ['FORCE SET CONTROL', [`ForceSetsApplied= ${applied}`]]] }));
  const fs1 = forces('2, 1, 3'), sets = sv(fs1).forces;
  ok('the force sets applied: a segment and an exit with its area, at the ambient pressure', sets.length === 2 && sets[0].name === 'Along' && sets[0].kind === 'segment' && sets[0].a.pipe === 1 && sets[0].b.x.value === 600 && sets[1].kind === 'exit' && sets[1].As.value === 200 && sets[1].As.unit === 'cm²' && sets.every((x) => x.ambient === 'atm') && hasNote(fs1, 'surgeForcesRead') && !hasNote(fs1, 'surgeForceVector'));
  const fs2 = forces('3, 1, 2, 3');
  ok('a point; a unit vector is reported', sv(fs2).forces[1].kind === 'point' && sv(fs2).forces[1].a.x.value === 300 && hasNote(fs2, 'surgeForceVector'));
  ok('a type that is not known is left out, with a note', hasNote(forces('1, 4', ['ForceSet#4= 4,Odd,9,1,0,1,600,101.325,0,0,0,0,0,0']), 'surgeForceKind'));
  // the transient with them: the force sets of T5, and a gas accumulator that holds the pressure at a valve that closes
  const eff = M.effective(fs1.model, 'base');
  const res = PumpIt.surge.run(eff);
  ok('the imported force sets run with T5', res.ok && Object.keys(res.forces || {}).length === 2, (res.errors || []).join('; ') + ' ' + JSON.stringify(Object.keys(res.forces || {})));
  // T5 with a gas accumulator of 5 m³ 60 m before its valve: the peak at the end of the long pipe falls well below the
  // 1885.578 kPa of T5 (a vessel of 0.5 m³ would be too small: the column would compress its gas to some 2 MPa)
  const vessel = read(imp({
    fluid: { rho: '998.2,kg/m3', mu: '1,centipoise', pv: '2.34,kPa', amb: '101.325,kPa' },
    secs: [
      ...control(),
      [BASE('JUNCTIONS'), [
        junc({ type: 2, id: 1, pipes: [-1], t: tank({ P: 1000, Pu: 'kPa' }) }),
        junc({ type: 22, id: 2, pipes: [1, -2], t: { n: 1.2, V: 5, VU: 'm3', gasType: 0 } }),
        junc({ type: 8, id: 3, pipes: [2], t: { lossType: 0, loss: 300, back: 101.325, backU: 'kPa', table1: { units: ['None'], rows: [[0, 300], [3, 0]] } } }),
      ]],
      [BASE('PIPES'), [
        pipe({ id: 1, from: 1, to: 2, L: 600, D: 0.3, Du: 'meters', fric: ['4', 0.018, 'None'], surge: { a: 1200, n: 10, Z: impedance(1200, 0.3) } }),
        pipe({ id: 2, from: 2, to: 3, L: 60, D: 0.3, Du: 'meters', fric: ['4', 0.018, 'None'], surge: { a: 1200, n: 1, Z: impedance(1200, 0.3) } }),
      ]],
    ],
  }));
  const ve = M.effective(vessel.model, 'base'), vv = M.validate(ve), vr = vv.ok ? PumpIt.surge.run(ve) : null;
  const peak = vr && vr.ok ? vr.extremes.pipes[1].Pmax[10] / 1e3 : NaN;
  ok('an imported gas accumulator runs and holds the pressure: the peak at its node well below that of T5', vv.ok && vr.ok && peak < 1500, `${Number.isFinite(peak) ? peak.toFixed(1) : '?'} kPa ${vv.ok ? '' : JSON.stringify(vv.items.filter((i) => !i.ok))}`);
}

console.log('\nFrom a file to the dynamic check valves: the cases T26 and T27 of the addendum G3 (answers 6 and 7)');
{
  // the system of T24 to T27 written as a .imp file: a pressure imposed from 1050 kPa down to 650 kPa in 1 s → pipe 1 of
  // 100 m → the check valve, K = 2 → pipe 2 of 200 m → a reservoir of 1000 kPa; D = 0.3 m, a = 1000 m/s, f = 0.02, Δt =
  // 0.01 s, a run of 3 s. Each disc is written as the program keeps it: the swinging disc of T26 (θ_max = 60°, γ_c = 10°)
  // by the angles of its arm to the axis of the pipe, thMin 20° and thMax 80°, its Cv falling from thMin to thMax, and its
  // weight as the program takes it, without buoyancy, (m_d − m_f)·g; the sliding disc of T27 by the travel of the program
  // from its stop fully open, its weight (m − m_a)·g and the mass of liquid m_a it moves (fluidMassType 1)
  const run = (check) => {
    const r = read(imp({
      fluid: { rho: '998.2,kg/m3', mu: '1,centipoise', pv: '2.34,kPa', amb: '101.325,kPa' },
      secs: [
        ...control({ StopTime: 3, TotalSteps: 300 }, { TimeStep: 0.01 }),
        [BASE('JUNCTIONS'), [
          junc({ type: 4, id: 1, pipes: [-1], t: { perPipe: [[0, 0, 0]], stag: 0, p: 1050, pU: 'kPa', table1: { units: ['kPa'], rows: [[0, 1050], [1, 650]] } } }),
          junc({ type: 10, id: 2, pipes: [1, -2], t: Object.assign({ lossType: 1, loss: 2, vClose: 0, vCloseU: 'meters/sec', ks: -999, Ts0: -999, ksT: -999, Fs0: -999, cwAngle: -999 }, check) }),
          junc({ type: 2, id: 3, pipes: [2], t: tank({ P: 1000, Pu: 'kPa' }) }),
        ]],
        [BASE('PIPES'), [
          pipe({ id: 1, from: 1, to: 2, L: 100, D: 0.3, Du: 'meters', fric: ['4', 0.02, 'None'], surge: { a: 1000, n: 10, Z: impedance(1000, 0.3) } }),
          pipe({ id: 2, from: 2, to: 3, L: 200, D: 0.3, Du: 'meters', fric: ['4', 0.02, 'None'], surge: { a: 1000, n: 20, Z: impedance(1000, 0.3) } }),
        ]],
      ],
    }));
    const eff = M.effective(r.model, 'base'), v = M.validate(eff), res = v.ok ? PumpIt.surge.run(eff) : { ok: false, errors: [JSON.stringify(v.items.filter((i) => !i.ok)).slice(0, 300)] };
    return { r, res };
  };
  const at = (res, t) => [...res.times].findIndex((x) => Math.abs(x - t) < 1e-9);
  const closure = (res) => { const e = res.log.find((x) => x.obj === 'j:2' && x.key === 'surge.log.state' && x.params.to === 'closed'); return e ? e.t : NaN; };
  const kPa = (x) => x / 1e3, f3 = (x) => x.toFixed(3);
  const A3 = (Math.PI * 0.3 * 0.3) / 4;
  const T26 = run({ model: 2, I: 1, IU: 'kg-m2', rcg: 0.2, rcgU: 'meters', Ad: A3, AdU: 'meters2', Wd: (20 - (998.2 * 20) / 7850) * 9.80665, WdU: 'N', thMin: 20, thMax: 80, fluidMassType: 2,
    cvTheta: { tu: 'degrees', units: ['None'], rows: [[20, 400], [30, 340], [40, 260], [50, 180], [60, 100], [70, 40], [80, 0]] } });
  ok('T26 written as the program keeps it: the swinging disc of Pump It of T26', T26.res.ok && J(T26.r.model, 2).swing.thetaMax.value === 60 && J(T26.r.model, 2).swing.seat.value === 10 && J(T26.r.model, 2).swing.cv.y.join() === '0,10,25,45,65,85,100', (T26.res.errors || []).join('; '));
  if (T26.res.ok) {
    const res = T26.res, th = res.junctions[2].series.th, ang = { '1.2': 55.7906, '1.4': 41.5325, '2.0': 19.4769, '2.2': 7.6478 };
    ok('T26: the angle at 1.2, 1.4, 2.0 and 2.2 s', Object.entries(ang).every(([t, x]) => Math.abs((th[at(res, +t)] * 180) / Math.PI - x) < 5e-5), Object.keys(ang).map((t) => ((th[at(res, +t)] * 180) / Math.PI).toFixed(4)).join(' '));
    const Xd = res.extremes.pipes[2], Xu = res.extremes.pipes[1];
    ok('T26: closes at 2.29 s; downstream at most 1299.878 kPa at 2.68 s; upstream at least 545.360 kPa at 2.47 s', near(closure(res), 2.29, 1e-9) && Math.abs(kPa(Xd.Pmax[0]) - 1299.878) <= 0.001 && near(Xd.tPmax[0], 2.68, 1e-9) && Math.abs(kPa(Xu.Pmin[10]) - 545.360) <= 0.001 && near(Xu.tPmin[10], 2.47, 1e-9),
      `${closure(res)} s, ${f3(kPa(Xd.Pmax[0]))} kPa at ${Xd.tPmax[0]} s, ${f3(kPa(Xu.Pmin[10]))} kPa at ${Xu.tPmin[10]} s`);
  }
  const T27 = run({ model: 3, WdT: (6 - 0.75) * 9.80665, WdTU: 'N', fluidMassType: 1, fluidMass: 0.75, fluidMassU: 'kg', AdT: 0.04, AdTU: 'meters2', xMax: 50, xMaxU: 'mm', ksT: 1500, ksTU: 'N/m', Fs0: 40, Fs0U: 'N',
    cvTravel: { tu: 'mm', units: ['None'], rows: [[0, 100], [10, 90], [20, 75], [30, 55], [40, 30], [50, 0]] } });
  ok('T27 written as the program keeps it: the sliding disc of Pump It of T27', T27.res.ok && near(J(T27.r.model, 2).nozzle.m.value, 6, 1e-10) && J(T27.r.model, 2).nozzle.mf.value === 0.75 && J(T27.r.model, 2).nozzle.cv.y.join() === '0,30,55,75,90,100', (T27.res.errors || []).join('; '));
  if (T27.res.ok) {
    const res = T27.res, xd = res.junctions[2].series.xd, trav = { '1.0': 40.6323, '1.6': 20.1930, '2.0': 8.3920, '2.2': 1.1548 };
    ok('T27: the travel at 1.0, 1.6, 2.0 and 2.2 s', Object.entries(trav).every(([t, x]) => Math.abs(xd[at(res, +t)] * 1000 - x) < 5e-5), Object.keys(trav).map((t) => (xd[at(res, +t)] * 1000).toFixed(4)).join(' '));
    const Xd = res.extremes.pipes[2], Xu = res.extremes.pipes[1];
    ok('T27: closes at 2.25 s; downstream at most 1259.199 kPa at 2.64 s; upstream at least 561.254 kPa at 2.44 s', near(closure(res), 2.25, 1e-9) && Math.abs(kPa(Xd.Pmax[0]) - 1259.199) <= 0.001 && near(Xd.tPmax[0], 2.64, 1e-9) && Math.abs(kPa(Xu.Pmin[10]) - 561.254) <= 0.001 && near(Xu.tPmin[10], 2.44, 1e-9),
      `${closure(res)} s, ${f3(kPa(Xd.Pmax[0]))} kPa at ${Xd.tPmax[0]} s, ${f3(kPa(Xu.Pmin[10]))} kPa at ${Xu.tPmin[10]} s`);
  }
}

console.log('\nFrom a file to the transient: the case T5 (I-T8)');
{
  const r = read(t5());
  const eff = M.effective(r.model, 'base');
  const v = M.validate(eff);
  ok('the imported model is complete for the water hammer', v.ok, JSON.stringify(v.items.filter((i) => !i.ok)).slice(0, 300));
  const res = PumpIt.surge.run(eff);
  ok('it runs', res.ok, (res.errors || []).join('; '));
  if (res.ok) {
    const p = res.pipes[1], st = p.stations.indexOf(10);
    const at = (t) => p.series.P[st][[...res.times].findIndex((x) => Math.abs(x - t) < 1e-9)] / 1e3;
    ok('the steady flow of T5: 198.058 kg/s', near(res.steady.pipes[1].m, 198.058, 5e-4 / 198), String(res.steady.pipes[1].m));
    ok('the pressure at the valve of T5: 1885.578 kPa at 3.00 s and 120.878 kPa at 4.00 s', Math.abs(at(3) - 1885.578) <= 0.001 && Math.abs(at(4) - 120.878) <= 0.001, `${at(3).toFixed(3)} and ${at(4).toFixed(3)} kPa`);
  }
}

console.log('\nTexts');
{
  // the notes of the importer and of what it shares with the .fth and .aro importers
  const src = ['imp.js', 'imp-surge.js', 'items.js', 'liquid.js', 'shared.js'].map((f) => fs.readFileSync(path.join(ROOT, 'src/core/import', f), 'utf8')).join('\n');
  const noteKeys = [...src.matchAll(/note\('(\w+)', '(\w+)'/g)].map((x) => x[2]).concat(['pipeCount', 'unsupported']);
  const kinds = Object.values(IMP.parse.KINDS).concat(['unknown']);
  const missing = [];
  for (const { code } of PumpIt.i18n.languages()) {
    const cat = PumpIt.i18n.catalog(code);
    for (const k of noteKeys) if (!cat.has('core.import.notes.' + k)) missing.push(`${code}: notes.${k}`);
    for (const k of kinds) if (!cat.has('core.import.kinds.' + k)) missing.push(`${code}: kinds.${k}`);
    for (const k of ['notImp', 'otherProgram', 'liquidModel', 'gasModel']) if (!cat.has('core.imp.' + k)) missing.push(`${code}: imp.${k}`);
  }
  ok(`every note (${new Set(noteKeys).size}) and kind (${kinds.length}) has its text in every language`, !missing.length, missing.slice(0, 4).join(', '));
  const bad = [];
  for (const lang of ['pt-BR', 'en', 'es']) {
    PumpIt.i18n.setLanguage(lang);
    for (const n of allNotes) { const s = IMP.noteText(n); if (!s || /\{\w+\}/.test(s)) bad.push(`${lang}: ${n.key} → ${s}`); }
  }
  PumpIt.i18n.setLanguage('en');
  ok(`every note of these imports (${new Set(allNotes.map((n) => n.key)).size} kinds) reads in every language`, !bad.length, bad.slice(0, 3).join(' | '));
  ok(`every model of these imports (${allModels.length}) has the ids the interface accepts`, allModels.every((m) => M.idsWellFormed(m)));
}

Object.assign(X.PROGRAMS, saved);
console.log(`\n${passed} checks passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
