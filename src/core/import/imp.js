// Import of .imp model files: models of hydraulic transients of a liquid, kept in the same family of files as .fth and
// .aro (Windows-1252 text in INI-style sections, with positional CSV records). The layout follows only the description
// of the format written by the specification team (formato-imp.md, version 1 of 23 November 2026), the descriptions it
// refers to (the .fth format of 20 October 2026; Annexes A.2 and D of the specification of the time simulation, version
// 1.1) and this repository. The network of the liquid and its steady state are read as in .fth files, by liquid.js, with
// the corrections of section 4.3 of the description; the blocks of the kinds of junction are read and merged item by
// item (items.js); the data of the water hammer go to the fields of its module (imp-surge.js). What has no counterpart
// in Pump It is approximated or left out, and every such case goes into the import notes. The decisions are recorded
// in docs/imp-import.md (I-xx).
(function (root) {
  const PumpIt = root.PumpIt;
  const U = PumpIt.units;
  const { t } = PumpIt.i18n;
  const q = PumpIt.model.q;
  const {
    PROGRAMS, num, n0, str, isInt, inTable, FLOW, PRESSURE, DP, LENGTH, kv, records, scenarioSection, scenarios, compare,
    noteText, LEVELS,
  } = PumpIt.importShared;
  const IT = PumpIt.importItems;
  const SURGE = PumpIt.importImpSurge;
  const JS = PumpIt.junctionTypes.shared;

  // kinds of junction of the format by their code, for the notes: those of .fth files and the kinds of a transient
  const KINDS = {
    1: 'branch', 2: 'reservoir', 3: 'flow', 4: 'pressure', 5: 'areaChange', 6: 'bend', 7: 'tee', 8: 'valve',
    9: 'controlValve', 10: 'checkValve', 11: 'deadEnd', 12: 'orifice', 13: 'venturi', 14: 'screen', 15: 'heatExchanger',
    16: 'spray', 17: 'pump', 18: 'ejector', 19: 'volumeBalance', 20: 'generic', 21: 'reliefValve', 22: 'gasAccumulator',
    23: 'liquidAccumulator', 24: 'surgeTank', 25: 'airValve', 26: 'separator', 27: 'threeWayValve', 28: 'weir', 29: 'turbine',
  };
  // the place of the count of the curve coefficients of the kinds read as in .fth files (F-08): only those without a
  // schema of items use it (I-09)
  const COUNTED = { 8: 8, 12: 8, 15: 8, 20: 8, 16: 11 };
  // the codes of the loss models: 1 K, 0 Cv, 7 Kv (I-07); 3, a loss curve, is read as in .fth files
  const LOSS_CODES = { 1: 'K', 0: 'Cv', 7: 'Kv' };
  // the fields of a positive displacement pump (section 14.14 of the description)
  const DISPLACEMENT = ['pdC', 'pdK', 'pdRpm', 'pdHeads', 'pdSpeed', 'pdBore', 'pdStroke', 'pdRod', 'pdClear', 'pdCrank', 'pdRodDia', 'pdCrankClear'];

  // the items of the block of the junction of context c (items.js), walked once
  const itemsOf = (c) => c.items || (c.items = IT.itemsOf(c.f, c.tb, c.np));
  // the pipe a junction of two pipes takes its K at: the one that arrives at it
  const inPipeOf = (c) => (c.conn.find((p) => p.down === c.id) || c.conn[0] || {}).id;

  // check valve (10): its loss model and value, as the valve's (I-04): 0 Cv, 1 K, 7 Kv, and a loss curve turned into a K
  // as for an exit valve (F-21); closed by its special condition
  function checkValve(c) {
    if (c.n !== 2) return c.pipeCount();
    const it = itemsOf(c), lm = it.n('lossType'), val = it.n('loss'), lc = LOSS_CODES[lm];
    let loss;
    if (lc === 'K') loss = { lossModel: 'K', K: val >= 0 ? val : 0 };
    else if (lc) loss = { lossModel: lc, [lc]: val > 0 ? val : undefined };
    else if (lm === 3) loss = c.curveLoss(it.list('coef').map(num), it.v('pU'), it.v('qU'), n0(it.v('qMax')), inPipeOf(c), false, c.obj) || { lossModel: 'K', K: 0 };
    else { c.note('assumed', 'lossModel', c.obj, { code: it.v('lossType') || '?' }); loss = { lossModel: 'K', K: 0 }; }
    if (c.closed) c.closedObjs.push(c.obj);
    return c.make('check', Object.assign(loss, { closed: c.closed }));
  }

  // generic component (20): a K, a Cv or a Kv in the item loss, at t+11+nc (I-05); a loss curve as in .fth files (null:
  // the reader of liquid.js). Pump It gives a generic component a K, so a Cv or a Kv becomes the K of the same loss at the
  // area of the pipe that arrives at it, exactly for a flow in the reference direction
  function generic(c) {
    const it = itemsOf(c), lm = it.n('lossType');
    if (lm === 3) return null;
    const lc = LOSS_CODES[lm], val = it.n('loss');
    let K = 0;
    if (lc === 'K') K = val >= 0 ? val : 0;
    else if (lc) {
      const A = c.areaOf(inPipeOf(c));
      if (val > 0 && A > 0) { K = JS.gasValveK({ lossModel: lc, [lc]: val }, 0, A); c.note('info', 'genericCv', c.obj, { model: lc }); }
      else { K = undefined; c.note('missing', 'notGiven', c.obj); }
    } else c.note('assumed', 'lossModel', c.obj, { code: it.v('lossType') || '?' });
    return c.lossElement('generic', { genModel: 'K', K }, K);
  }

  // nozzle (16): the fields of each pipe first, then the layout of .fth files (F-24) with one more model, 0, a discharge
  // coefficient with the flow area of its holes (I-06); 1 a K factor and 3 a loss curve as in .fth files
  function spray(c) {
    if (!c.fits('spray')) return c.pipeCount();
    if (c.closed) { const j = c.n === 1 ? c.deadEnd() : c.make('branch'); c.closedObjs.push(c.obj); c.note('info', 'closedEnd', c.obj); return j; }
    const it = itemsOf(c), lm = it.n('lossType');
    const Pext = c.pressure(it.n('pExit'), it.v('pExitU'), c.obj);
    if (lm !== 0) return c.nozzle(c, { lm, du: it.v('pU'), qu: it.v('qU'), qmax: n0(it.v('qMax')), coef: it.list('coef').map(num), kf: it.v('loss'), Pext });
    // the holes: their number (−1 is one) and the diameter that gives each its share of the area, √(4·A/(π·n))
    const A = c.area(it.n('fa'), it.v('faU'), c.obj), Asi = c.si(A, 'area');
    const holes = it.n('holes') >= 1 ? Math.round(it.n('holes')) : 1, Cd = it.n('loss');
    const unit = A.unit === 'in²' || A.unit === 'ft²' ? 'in' : 'mm';
    const d = Asi > 0 ? U.fromSI(Math.sqrt((4 * Asi) / (Math.PI * holes)), unit, 'length') : null;
    const j = c.make('spray', { sprayModel: 'CdA', Cd: Cd > 0 ? Cd : undefined, dHole: q(d, unit), nHoles: holes, Pext });
    c.note('assumed', 'sprayCdA', c.obj);
    if (!(Cd > 0) || !(Asi > 0)) c.note('missing', 'sprayHoles', c.obj);
    return j;
  }

  const FORMAT = {
    // the first line: a model of the .fth or .aro format names the extension to give it; another program is refused
    // (I-01). The words of the programs are read when the file is, so that the tests can give their own
    refuse: (hd) => (hd.program === PROGRAMS.transient ? null
      : t(hd.program === PROGRAMS.liquid ? 'core.imp.liquidModel' : hd.program === PROGRAMS.gas ? 'core.imp.gasModel' : 'core.imp.otherProgram')),
    notModel: 'core.imp.notImp',
    counted: COUNTED,
    // the junction records of a child scenario merge item by item (I-09), the transient block of a pipe record where the
    // child keeps it (I-10)
    merge: { junction: IT.mergeJunctionItems, pipe: SURGE.mergeSurgePipe },
    kinds: KINDS,
    // the control of the water hammer before the pipes, and the transient block of each pipe (sections 8 to 11)
    start: SURGE.start,
    pipe: SURGE.pipe,
    // the time simulation of .fth files is not that of these files (AnalysisType 3): its control is not read, and the
    // time data of the junctions belong to the water hammer (section 13, W-14)
    timeControl: false,
    timeData: false,
    cfgTail: 15,
    lossCodes: LOSS_CODES,
    // the kinds the format completes; the protection devices, while the module of the water hammer is in the page
    types: Object.assign({ 10: checkValve, 16: spray, 20: generic }, SURGE.types),
    // the control of a pump by its speed and the suction of a pump on a single pipe, in their items (section 14.14)
    pumpControl(c) {
      const it = itemsOf(c), kind = str(it.v('ctlType')), v = it.n('ctl'), unit = it.v('ctlU');
      return /^[1-9]$/.test(kind) && v > 0 && (inTable(FLOW, unit) || inTable(PRESSURE, unit) || inTable(DP, unit)) ? { kind: Number(kind), v, unit } : null;
    },
    pumpSuction(c) {
      const it = itemsOf(c), mode = str(it.v('subType')), v = it.n('subP'), unit = it.v('subPU');
      return str(it.v('submerged')) === '-1' && (mode === '1' || mode === '0') && Number.isFinite(v) && (inTable(PRESSURE, unit) || inTable(LENGTH, unit)) ? { v, unit } : null;
    },
    // the time data of a junction, in its items: [rel] [ign] [rep1] [rep2] [trigger] [event 1] [event 2] [table 1]
    // [table 2], in the order of its kind (section 13)
    timeBlock(c) {
      const it = itemsOf(c);
      if (!it || !it.has('table1')) return null;
      const ev = (name) => { const e = it.event(name); return e && { code: n0(e[0]), cond: n0(e[1]), v: num(e[2]), unit: e[3], end: n0(e[4]), obj: n0(e[5]), end2: n0(e[6]), obj2: n0(e[7]) }; };
      return {
        rel: it.n('rel'), ign: it.n('ign'), rep1: it.n('rep1'), rep2: it.n('rep2'), trig: it.n('trig'),
        events: [ev('ev1'), ev('ev2')].filter(Boolean), tables: [it.table('table1'), it.table('table2')], at: it.at('trig'),
      };
    },
    junction(c, j, blk) {
      const it = itemsOf(c);
      if (!it) return;
      // a record that does not end where the items of its kind do (or one field before, I-08)
      if (!IT.fits(it.walk, c.f)) c.note('assumed', 'recordLength', c.obj, { found: c.f.length - c.tb, expected: it.walk.end - c.tb });
      // a positive displacement pump is out of scope
      if (c.type === 17 && n0(it.v('pumpType')) !== 0 && DISPLACEMENT.some((x) => it.n(x) > 0)) c.note('ignored', 'pumpDisplacement', c.obj);
      // the fields and the time data of the water hammer (sections 13 and 14)
      SURGE.junction(c, j, blk, it);
    },
    finish,
  };

  // what is read after the network: the version of the file, the keys of the fluid that the steady state does not use,
  // the stored results of the junctions and the data of the water hammer
  function finish(c) {
    const { note } = c;
    if (c.hd && c.hd.version !== 10) note('assumed', 'impVersion', null, { version: c.hd.version });
    // the ambient pressure varying with the elevation and a gravity varying in time are not modelled (section 10)
    if (n0(kv(c.F, 'Ambient Pressure Variation')) !== 0) note('ignored', 'ambientVariation', null);
    if (n0(kv(c.F, 'VariableGExists')) !== 0) note('ignored', 'variableGravity', null);
    // the stored results of the junctions have their own columns (I-34): 0 the ID, 1 the stagnation pressure (psia), 3
    // the code of the kind of the junction. A row of another kind than the record of its junction is not of this network
    const storedJunctions = new Map();
    for (const f of records(scenarioSection(c.S, 'JUNCTION ARCHIVE DATA', c.target.n))) {
      const id = num(f[0]), r = c.recs.J.get(str(f[0]));
      if (!isInt(id) || !c.m.junctions.some((j) => j.id === id)) continue;
      if (r && Number.isFinite(num(f[3])) && num(f[3]) !== num(r[0])) { note('assumed', 'archiveJunction', 'J' + id); continue; }
      storedJunctions.set(id, { P0: num(f[1]) * U.PSI, type: num(f[3]) });
    }
    // the water hammer: the sections of the pipes, the events and what is read in phase I3
    SURGE.finish(c);
    return { storedJunctions: storedJunctions.size ? storedJunctions : null };
  }

  // text of a .imp file → { model, notes, stored, storedJunctions, counts, version, scenario, scenarios } (liquid.js)
  const read = (text, opts = {}) => PumpIt.importLiquid.read(text, opts, FORMAT);

  PumpIt.importers = Object.assign(PumpIt.importers || {}, {
    imp: { encoding: 'windows-1252', read, scenarios, compare, noteText, LEVELS, parse: { KINDS, LOSS_CODES } },
  });
})(typeof window !== 'undefined' ? window : globalThis);
