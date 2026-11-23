// Regression tests of the interface review (the fixes of a review of the app): a cell of a table that refuses a text
// that is not a number and keeps the value before (num-cell.js), and a paste from a spreadsheet that checks every line
// before the table changes (point-table.js), and another model that becomes one step of the history only once it is
// accepted, dropping the pipe being drawn (files.js, editing.js), and the legend and the table of values of a chart
// (line-chart.js), the time and the step of the cursor in an export to Excel (export.js), the differences of a scenario
// (scenarios.js, forms.js) and the water hammer of a scenario the user comes back to (scenarios.js, surge/run.js,
// calculation.js), and actions that must keep the physics: the material of a pipe back from the parent (editing.js),
// the ambient pressure converted to a gauge unit (value-convert.js) and the basis of a table over time
// (time/data-section.js), and inputs that are not possible: an annulus with a negative inner diameter and a negative
// quantity of fittings (validation.js, solver/network.js, fittings-editor.js), and the curve of a pump drawn at the speed
// its control found (pump-chart.js, solver/system-curve.js), and the links of a renamed event and of the conditions of
// a pasted pump (time/events-section.js, clipboard.js), and the numbers without unit of the chart over time
// (charts/time-chart.js), and a draft of a cell kept in the scenario it was typed in (num-cell.js). The interface
// files run on a small stand-in of the DOM: only what these modules use of it.
// Usage: node tests/ui-review.test.cjs
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { ROOT, coreScripts } = require('./load-core');

let pass = 0, fail = 0;
function ok(name, cond, detail = '') {
  if (cond) pass++; else fail++;
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (detail ? '  ' + detail : ''));
}

// ------------------------------------------------------------ a stand-in of the DOM
class Node {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.attrs = new Map(); this.children = []; this.parent = null; this.listeners = {}; this.value = ''; this.textContent = ''; this.className = ''; }
  setAttribute(k, v) { this.attrs.set(k, String(v)); if (k === 'id') this.id = String(v); }
  getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
  hasAttribute(k) { return this.attrs.has(k); }
  removeAttribute(k) { this.attrs.delete(k); }
  appendChild(c) { c.parent = this; this.children.push(c); return c; }
  append(...cs) { cs.forEach((c) => this.appendChild(c)); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this); this.parent = null; }
  querySelector(sel) {
    const m = /^\[id="(.+)"\]$/.exec(sel);
    const walk = (n) => { for (const c of n.children) { if (m && c.id === m[1]) return c; const r = walk(c); if (r) return r; } return null; };
    return walk(this);
  }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  fire(type, extra = {}) {
    let stopped = false, prevented = false;
    const e = Object.assign({ type, target: this, stopPropagation() { stopped = true; }, preventDefault() { prevented = true; } }, extra);
    (this.listeners[type] || []).forEach((fn) => fn(e));
    return { stopped, prevented };
  }
  set innerHTML(h) { this.html = h; }
  insertAdjacentHTML(where, h) { this.html = (this.html || '') + h; }
}
const documentStub = { createElement: (tag) => new Node(tag) };

// the core, the catalogs and the given interface files in one context
function loadContext(files) {
  const ctx = vm.createContext({ console, document: documentStub, CSS: { escape: (s) => s } });
  ctx.window = ctx;
  const run = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  coreScripts().forEach(run);
  files.forEach(run);
  return ctx;
}
const load = (files) => loadContext(files).PumpIt;
const PumpIt = load(['src/ui/namespace.js', 'src/ui/common/format.js', 'src/ui/common/dom.js', 'src/ui/common/num-cell.js', 'src/ui/time/point-table.js']);
const NC = PumpIt.ui.numCell, PT = PumpIt.ui.pointTable;
const lang = (l) => PumpIt.i18n.setLanguage(l);

// ------------------------------------------------------------ what a cell reads
console.log('\nA number typed in a cell');
lang('pt-BR');
{
  const r = (s, o) => JSON.stringify(NC.read(s, o));
  ok('C1 an empty cell is refused', r('') === '{"error":"empty"}' && r('   ') === '{"error":"empty"}');
  ok('C1 a text that is not a number is refused', r('abc') === '{"error":"invalid"}' && r('4,5,6x') === '{"error":"invalid"}');
  ok('C2 a decimal comma and a decimal point', NC.read('45,5').value === 45.5 && NC.read('45.5').value === 45.5 && NC.read('1.234,5').value === 1234.5);
  ok('C2 a zero typed is a number', NC.read('0').value === 0 && NC.read('0,0').value === 0);
  ok('C3 an empty cell that stands for a value (the bottom of a reservoir)', NC.read('', { empty: null }).value === null);
  const where = NC.where(NC.row(2), 'Altura', 'm');
  ok('C4 the cell in words: row, quantity and unit', where === 'Linha 2 · Altura (m)', where);
  const msg = NC.message({ where, value: 46.5 }, 'abc', 'invalid');
  ok('C4 the message tells the text refused and the value Esc brings back', msg === 'Linha 2 · Altura (m): “abc” não é um número, e o valor anterior continua valendo. Esc restaura 46,5.', msg);
  ok('C4 an empty cell has its own message', NC.message({ where, value: 46.5 }, '', 'empty').startsWith('Linha 2 · Altura (m): a célula está vazia'));
  ok('C4 a quantity named with markup is told in plain text', NC.where('P3', 'K<sub>out</sub>') === 'P3 · Kout');
}

// ------------------------------------------------------------ the cell in a table
console.log('\nThe cell keeps the value before');
{
  const commits = [];
  const errs = NC.errors();
  const mk = (value) => NC.input({ id: 'cv-j:2-curve-y-1', aria: 'Altura do ponto 2', value, errs, where: 'Linha 2 · Altura (m)', onCommit: (n) => commits.push(n) });
  let inp = mk(46.5);
  ok('T1 the cell shows the value of the model', inp.value === '46,5' && !inp.hasAttribute('aria-invalid'));
  inp.value = ''; inp.fire('change');
  ok('T2 an empty cell writes nothing', commits.length === 0);
  ok('T2 it is marked invalid, tied to its message under the table', inp.getAttribute('aria-invalid') === 'true' && inp.getAttribute('aria-describedby') === 'cv-j:2-curve-y-1-err' && errs.children.length === 1 && errs.children[0].textContent.includes('Linha 2 · Altura (m)'));
  inp.value = 'abc'; inp.fire('change');
  ok('T3 a text that is not a number writes nothing, and the message follows it', commits.length === 0 && errs.children.length === 1 && errs.children[0].textContent.includes('“abc”'));
  // the panel drawn again (a run that ends draws everything again): the text is still there, with its message
  const errs2 = NC.errors();
  const again = NC.input({ id: 'cv-j:2-curve-y-1', aria: 'x', value: 46.5, errs: errs2, where: 'Linha 2 · Altura (m)', onCommit: (n) => commits.push(n) });
  ok('T4 the draft outlives a redraw of the panel', again.value === 'abc' && again.getAttribute('aria-invalid') === 'true' && errs2.children.length === 1);
  const esc = again.fire('keydown', { key: 'Escape' });
  ok('T5 Esc brings the value before back and clears the message', again.value === '46,5' && !again.hasAttribute('aria-invalid') && errs2.children.length === 0 && commits.length === 0);
  ok('T5 and keeps the Esc to itself (the window around stays open)', esc.stopped && esc.prevented);
  const calm = again.fire('keydown', { key: 'Escape' });
  ok('T5 Esc on a cell as it was lets the key go on', !calm.stopped);
  const after = NC.input({ id: 'cv-j:2-curve-y-1', aria: 'x', value: 46.5, errs: NC.errors(), where: 'w', onCommit: () => {} });
  ok('T5 the draft is gone after Esc', after.value === '46,5');
  inp = mk(46.5);
  inp.value = '45,5'; inp.fire('change');
  ok('T6 a number is written once', commits.length === 1 && commits[0] === 45.5);
  inp = mk(46.5);
  inp.value = '46.5'; inp.fire('change');
  ok('T6 the same number written another way writes nothing', commits.length === 1 && inp.value === '46,5');
  const z = []; const zc = NC.input({ id: 'tf-table-x-0', aria: 't', value: 5, errs: NC.errors(), where: 'w', onCommit: (n) => z.push(n) });
  zc.value = '0'; zc.fire('change');
  ok('T7 a zero typed is written', z.length === 1 && z[0] === 0);
  // a draft whose value changed in the model since (undo, another scenario) is dropped
  inp = mk(46.5); inp.value = 'abc'; inp.fire('change');
  const moved = mk(40);
  ok('T8 a draft is dropped when the model has another value now', moved.value === '40' && !moved.hasAttribute('aria-invalid'));
  inp = mk(46.5); inp.value = 'abc'; inp.fire('change');
  NC.clearDrafts();
  ok('T8 opening another model drops every draft', mk(46.5).value === '46,5');
  const b = []; const bottom = NC.input({ id: 'pk-1-1-elev', aria: 'e', value: 2, empty: null, errs: NC.errors(), where: 'w', onCommit: (n) => b.push(n) });
  bottom.value = ''; bottom.fire('change');
  ok('T9 an empty cell that stands for the bottom is written as such', b.length === 1 && b[0] === null);
}

console.log('\nNo cell writes zero for a text that is not a number');
{
  const files = ['src/ui/inspector/curve-editor.js', 'src/ui/time/point-table.js', 'src/ui/inspector/fittings-editor.js', 'src/ui/inspector/pipe-losses-table.js'];
  for (const f of files) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    ok(`Z1 ${f}: its cells go through numCell`, !/isFinite\(n\) \? n : 0/.test(s) && /NC\.input\(/.test(s));
  }
}

// ------------------------------------------------------------ a paste from a spreadsheet
console.log('\nA paste checks every line first');
{
  const P = (text, n = 2) => PT.parsePaste(text, n);
  const cols = (r) => JSON.stringify(r.cols);
  const labels = ['Hora', 'Preço por kWh'];
  let r = P('0\t0,50\n8\t\n18\t1,20');
  ok('P1 a missing price refuses the whole paste, by its line and column', r.error && r.error.line === 2 && r.error.col === 1 && r.error.kind === 'missing', JSON.stringify(r));
  const m = PT.pasteMessage(r.error, labels);
  ok('P1 the message names the line and the column', m === 'Linha 2 · Preço por kWh: falta o valor.', m);
  r = P('0\t0,50\n8\t0,80\n18\t1,20');
  ok('P2 complete, the three points in the order pasted', cols(r) === '[[0,8,18],[0.5,0.8,1.2]]', cols(r));
  ok('P3 blank lines at the end of the copy', cols(P('0\t0,50\n8\t0,80\n\n\r\n')) === '[[0,8],[0.5,0.8]]');
  r = P('0\t\t5\n1\t2\t3', 3);
  ok('P4 three columns, the middle one empty: refused at its column', r.error && r.error.line === 1 && r.error.col === 1 && r.error.kind === 'missing', JSON.stringify(r));
  r = P('\t5');
  ok('P4 an empty first cell stays in its column', r.error && r.error.col === 0 && r.error.kind === 'missing');
  ok('P5 a price of zero is a price', cols(P('0\t0\n12\t0,0')) === '[[0,12],[0,0]]');
  r = P('0\tabc');
  ok('P6 a text that is not a number', r.error && r.error.kind === 'invalid' && r.error.text === 'abc' && PT.pasteMessage(r.error, labels) === 'Linha 1 · Preço por kWh: “abc” não é um número.');
  r = P('0\t1\t2');
  ok('P7 a column too many is refused', r.error && r.error.kind === 'columns' && r.error.has === 3 && PT.pasteMessage(r.error, labels) === 'Linha 1: 3 colunas, e a tabela tem 2.');
  ok('P7 empty cells after the last column say nothing', cols(P('0\t1\t\t\n2\t3\t')) === '[[0,2],[1,3]]');
  r = P('0;0,5\n8;');
  ok('P8 semicolons keep an empty cell too', r.error && r.error.line === 2 && r.error.col === 1);
  ok('P9 numbers between spaces', cols(P('0 0,5\n8   0,8')) === '[[0,8],[0.5,0.8]]');
  ok('P9 a comma between numbers with a point', cols(P('0,0.5\n8,0.8')) === '[[0,8],[0.5,0.8]]');
  r = P('0 0,5\n8');
  ok('P9 a line short of a number, between spaces', r.error && r.error.line === 2 && r.error.col === 1);
  ok('P10 blank lines in the middle are skipped, and the lines keep their numbers', P('0\t1\n\n2\tx').error.line === 3);
  ok('P11 nothing pasted', P('').none && P('\n \n').none);
}

lang('en');
{
  const m = PT.pasteMessage({ line: 2, col: 1, kind: 'missing' }, ['Time', 'Price per kWh']);
  ok('L1 the messages in English', m === 'Row 2 · Price per kWh: the value is missing.', m);
}

// ------------------------------------------------------------ the history when the model is replaced
// The application state, the editing and the files of the app, with the drawing, the views and the calculation left
// out: what they are asked is counted.
console.log('\nThe history when another model comes');
{
  const c2 = loadContext(['src/ui/namespace.js', 'src/ui/common/format.js', 'src/ui/common/dom.js', 'src/ui/common/num-cell.js']);
  const P2 = c2.PumpIt;
  const UI = P2.ui, M = P2.model;
  const toasts = [];
  let drops = 0, boom = false;
  UI.dialogs = { toast: (s) => toasts.push(s) };
  UI.canvas = { dropDraft: () => { drops++; } };
  UI.scene3d = { carryView() {}, ensureVisible() {} };
  const run = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), c2, { filename: f });
  run('src/ui/app/state.js');
  const app = P2.app;
  run('src/ui/app/editing.js');
  run('src/ui/app/files.js');
  run('src/ui/results/column-setup.js');
  app.recalc = () => { if (boom) throw new Error('boom'); };
  app.renderAll = () => {};
  app.save = () => {};
  app.changed = () => { app.version++; };
  app.pruneSelection = () => {};
  c2.requestAnimationFrame = () => {};
  P2.i18n.setLanguage('pt-BR');

  const titled = (s) => Object.assign(M.newModel(), { title: s });
  app.loadModel(titled('T0'));
  const title = () => app.model.title;
  // the reproduction of the review: a title changed, undone, then a file refused
  app.pushUndo(); app.model.title = 'T1';
  app.undo();
  const st = () => `${app.undoStack.length}/${app.redoStack.length}`;
  const before = st();
  let threw = false;
  try { app.replaceModel({ format: 'pumpit-profile', version: 1, outputs: {}, templates: [] }); } catch (e) { threw = true; }
  ok('H1 a file that is not a model is refused', threw && title() === 'T0');
  ok('H1 the undo and the redo stacks are as they were', st() === before && before === '0/1', st());
  app.redo();
  ok('H1 redo still brings the new title back', title() === 'T1');
  app.undo();
  ok('H1 and undo the first one', title() === 'T0');

  boom = true; threw = false;
  try { app.replaceModel(titled('X')); } catch (e) { threw = true; }
  boom = false;
  ok('H2 a model that fails to calculate leaves the model and the history', threw && title() === 'T0' && st() === '0/1', st());

  for (let i = 0; i < 80; i++) app.pushUndo();
  app.undoStack[0] = JSON.stringify(titled('oldest'));
  threw = false;
  try { app.replaceModel({ pipes: 'x' }); } catch (e) { threw = true; }
  ok('H3 a full undo stack keeps its oldest step when a model is refused', threw && app.undoStack.length === 80 && JSON.parse(app.undoStack[0]).title === 'oldest');
  app.undoStack = []; app.redoStack = ['{}'];

  app.replaceModel(titled('T2'));
  ok('H4 a model accepted is one step of the history', title() === 'T2' && st() === '1/0', st());
  app.undo();
  ok('H4 undo brings the model before back', title() === 'T0');

  const profileText = (() => { toasts.length = 0; const r = UI.files.profileRefused({ format: 'pumpit-profile' }); return r && toasts[0]; })();
  ok('H5 a profile of columns is pointed to where it opens', profileText === 'Este arquivo é um perfil de colunas de resultados, e não um modelo. Ele entra por Resultados → Colunas → Importar perfil.', profileText);
  ok('H5 a model is not a profile', UI.files.profileRefused(titled('Y')) === false);

  drops = 0;
  app.replaceModel(titled('T3')); app.undo(); app.redo();
  ok('H6 the pipe being drawn is dropped by another model, by undo and by redo', drops === 3, String(drops));

  // a pipe only between junctions of the model
  app.loadModel(M.newModel());
  const a = app.addJunction('branch', 0, 0), b = app.addJunction('branch', 100, 0);
  const n = app.undoStack.length;
  ok('H7 a pipe towards a junction that is not in the model is refused', app.addPipe(a, 99) === null && app.addPipe(98, b) === null && app.model.pipes.length === 0);
  ok('H7 and the history stays as it was', app.undoStack.length === n);
  const p = app.addPipe(a, b);
  ok('H7 a pipe between two junctions of the model', p !== null && app.model.pipes.length === 1 && app.model.pipes[0].up === a && app.model.pipes[0].down === b);
}

// ------------------------------------------------------------ the legend and the values of a chart
console.log('\nThe legend draws the line of each series, and the values open under the chart');
{
  const P = load(['src/ui/namespace.js', 'src/ui/common/format.js', 'src/ui/charts/line-chart.js']);
  const LC = P.ui.lineChart, fmt = (v) => P.ui.format.fmt(v, 5), lang = (l) => P.i18n.setLanguage(l);
  const series = [
    { name: 'Static', pts: [[0, 100], [10, 90], [10, 80], [20, 70]], color: 'var(--accent)' },
    { name: 'Stagnation', pts: [[0, 102], [20, 72]], color: '#c0612b', dash: '6 4' },
    { name: 'Vapour', pts: [[0, 3], [20, 3]], color: 'var(--crit)', dash: '2 4', width: 1.6 },
    { name: 'Curve', pts: [[0, 1], [5, 2]], color: 'red', marker: true },
  ];
  const html = LC.lineChart({ title: 'Profile', xLabel: 'x', yLabel: 'y', series });
  const legend = html.slice(html.indexOf('chart-legend'));
  const swatches = legend.match(/<svg class="swatch"[^]*?<\/svg>/g) || [];
  ok('I1 one sample per named series', swatches.length === 4, String(swatches.length));
  ok('I1 a solid line has no dashes', !/stroke-dasharray/.test(swatches[0]) && /stroke-width="2.4"/.test(swatches[0]));
  ok('I1 the dashes and the width of the series', /stroke-dasharray="6 4"/.test(swatches[1]) && /stroke-dasharray="2 4"/.test(swatches[2]) && /stroke-width="1.6"/.test(swatches[2]));
  ok('I1 the marker of a series with markers', /<circle/.test(swatches[3]) && !/<circle/.test(swatches[0]));
  ok('I1 the samples are hidden from screen readers (the name is the text)', swatches.every((s) => /aria-hidden="true"/.test(s)));

  lang('en');
  const tbl = LC.valuesTable({ id: 'v', summary: 'See the values', xHead: 'Distance (m)', yHead: 'Pressure (kPa)', series: series.slice(0, 3) });
  const rows = tbl.match(/<tr><td/g) || [];
  ok('I2 the values open in a <details> with its summary', /^<details class="chart-values" id="v">/.test(tbl) && /<summary>See the values<\/summary>/.test(tbl) && !/ open/.test(tbl.slice(0, 40)));
  ok('I2 the headings give the series, the distance and the quantity with their units', /<th class="txt">Series<\/th><th>Distance \(m\)<\/th><th>Pressure \(kPa\)<\/th>/.test(tbl));
  ok('I2 one row per point, a step at the same distance kept as two rows', rows.length === 8, String(rows.length));
  const cell = (x, y) => `<td class="num">${fmt(x)}</td><td class="num">${fmt(y)}</td>`;
  ok('I2 both values at the step, in the format of the tables', tbl.includes(cell(10, 90)) && tbl.includes(cell(10, 80)), fmt(10));
  ok('I2 a point repeated exactly is shown once', (LC.valuesTable({ summary: 's', xHead: 'x', yHead: 'y', series: [{ name: 'A', pts: [[0, 1], [5, 2], [5, 2], [9, 3]] }] }).match(/<tr><td/g) || []).length === 3);
  ok('I2 shown open when asked', / open>/.test(LC.valuesTable({ summary: 's', xHead: 'x', yHead: 'y', series, open: true }).slice(0, 60)));
  ok('I2 nothing without points', LC.valuesTable({ summary: 's', xHead: 'x', yHead: 'y', series: [{ name: 'A', pts: [] }] }) === '');
  const esc = LC.valuesTable({ summary: '<b>', xHead: 'x', yHead: 'y', series: [{ name: '<i>P1</i>', pts: [[0, 1]] }] });
  ok('I2 the names are escaped', !/<i>P1/.test(esc) && !/<summary><b>/.test(esc));
  lang('pt-BR');
  ok('I2 the heading of the series follows the language', /<th class="txt">Série<\/th>/.test(LC.valuesTable({ summary: 's', xHead: 'x', yHead: 'y', series })));
  lang('en');
}

// ------------------------------------------------------------ the instant of an export to Excel
console.log('\nAn export at the time cursor says which step its tables come from');
{
  const c3 = loadContext(['src/ui/namespace.js', 'src/ui/common/format.js']);
  const P3 = c3.PumpIt, UI = P3.ui;
  const run = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), c3, { filename: f });
  UI.dialogs = { toast() {} };
  P3.app = P3.app || {};
  run('src/ui/common/download.js');
  UI.resultCatalog = { TABLES: [] }; // no tables of objects: the sheets around them are what is checked
  run('src/ui/results/export.js');
  const app = P3.app, E = UI.resultExport;
  P3.i18n.setLanguage('pt-BR');
  // the tables, the series and the file are counted, not built
  let book = null, file = null, run1 = null;
  UI.timeResults = { sheets: () => (run1 ? [{ name: 'Séries', columns: [], rows: [] }] : []) };
  UI.surgeResults = { sheets: () => [] };
  UI.timeFormat = { clock: (s) => (s === 3600 ? '01:00:00' : '00:00:00') };
  UI.xlsx = { workbook: (o) => { book = o; return 'blob'; } };
  UI.download.saveFile = (name) => { file = name; };
  app.model = { title: 'Bombeamento entre tanques' };
  app.scenario = () => ({ name: 'Base' });
  app.okResults = () => ({ ok: true });
  app.eff = () => ({});
  let cur = 0;
  app.timeRun = () => run1;
  app.cursorIndex = () => cur;
  app.cursorTime = () => run1.times[cur];
  const ctxRows = () => book.sheets[book.sheets.length - 1];
  const val = (label) => (ctxRows().rows.find((r) => r[0] === label) || [])[1];

  app.exportResultsXlsx();
  ok('J1 the steady state keeps its file name', file === 'Bombeamento entre tanques - Base - resultados.xlsx', file);
  ok('J1 and ends with the Context sheet', ctxRows().name === 'Contexto' && val('Análise') === 'Regime permanente' && val('Modelo') === 'Bombeamento entre tanques' && val('Cenário') === 'Base');
  ok('J1 with no time nor step', val('Instante do cursor de tempo') === undefined && val('Tabelas de objetos') === 'Resultados do regime permanente');

  run1 = { times: [0, 600, 1200, 1800, 2400, 3000, 3600] };
  cur = 0;
  app.exportResultsXlsx();
  const f0 = file;
  ok('J2 at 0 h: the time in the name', f0 === 'Bombeamento entre tanques - Base - resultados - t 0 s.xlsx', f0);
  ok('J2 at 0 h: 0 s and step 0, as numbers', val('Instante do cursor de tempo') === 0 && val('Passo da simulação do cursor de tempo') === 0 && val('Análise') === 'Simulação no tempo');
  ok('J2 the series stay, before the Context sheet', book.sheets.length === 2 && book.sheets[0].name === 'Séries');
  cur = 6;
  app.exportResultsXlsx();
  ok('J2 at 1 h: another name', file === 'Bombeamento entre tanques - Base - resultados - t 3600 s.xlsx' && file !== f0, file);
  ok('J2 at 1 h: 3600 s, its clock and step 6', val('Instante do cursor de tempo') === 3600 && val('Instante do cursor de tempo (relógio)') === '01:00:00' && val('Passo da simulação do cursor de tempo') === 6);
  ok('J2 the unit of the time is the second', ctxRows().rows.find((r) => r[0] === 'Instante do cursor de tempo')[2] === 's');
  ok('J2 every step recorded: the sample is the step', val('Índice da amostra gravada do cursor de tempo (a partir de 0)') === 6);
  ok('J3 a time with decimals in a file name', E.timeSuffix(0.5) === 't 0.5 s' && E.timeSuffix(86400) === 't 86400 s' && E.timeSuffix(0.1 + 0.2) === 't 0.3 s');
  const cols = ctxRows().columns;
  ok('J3 the values are real numbers in the sheet (a number format on the value column)', cols[1].format !== 'text' && cols[0].format === 'text');

  // one step in three recorded (item 10 of the bug report): the step of the simulation and the index of the sample
  run1 = { times: [0, 1800, 3600], steps: [0, 3, 6], exact: [0, 0, 0] };
  const stepOf = () => [val('Passo da simulação do cursor de tempo'), val('Índice da amostra gravada do cursor de tempo (a partir de 0)')].join('/');
  cur = 1; app.exportResultsXlsx();
  ok('J5 recorded every 3 steps, at 30 min: step 3, sample 1', val('Instante do cursor de tempo') === 1800 && stepOf() === '3/1', stepOf());
  cur = 2; app.exportResultsXlsx();
  ok('J5 at 60 min: step 6, sample 2', val('Instante do cursor de tempo') === 3600 && stepOf() === '6/2' && val('Instante exato de um evento') === undefined, stepOf());
  // a sample at the exact time of an event between steps 1 and 2, as the time bar tells it
  run1 = { times: [0, 600, 750, 1200], steps: [0, 1, 1, 2], exact: [0, 0, 1, 0] };
  cur = 2; app.exportResultsXlsx();
  ok('J5 a sample at the exact time of an event: between steps 1 and 2', stepOf() === '1/2' && val('Instante exato de um evento') === 'entre os passos 1 e 2', stepOf());
  // the file itself: the Context sheet read back from the .xlsx written
  const stub = UI.xlsx;
  run('src/ui/common/xlsx.js');
  // a Blob that keeps its parts, to read the file back at once
  c3.Blob = class { constructor(parts) { this.parts = parts; } };
  c3.TextEncoder = TextEncoder;
  const realBook = UI.xlsx.workbook(book);
  const bytes = Buffer.concat(realBook.parts.map((p) => (typeof p === 'string' ? Buffer.from(p) : Buffer.from(p.buffer, p.byteOffset, p.byteLength)))).toString('utf8');
  const sheetsXml = bytes.split('<worksheet').slice(1);
  const last = sheetsXml[sheetsXml.length - 1];
  // the cells of the row that starts with a label: numbers as <v>, texts as <t>
  const cells = (label) => {
    const row = last.split('</row>').find((r) => r.includes(`<t>${label}</t>`));
    return row ? [...row.matchAll(/<v>([^<]*)<\/v>|<t>([^<]*)<\/t>/g)].map((m) => m[1] ?? m[2]) : null;
  };
  ok('J6 the .xlsx written: its Context sheet has step 1, the exact event and sample 2', JSON.stringify(cells('Passo da simulação do cursor de tempo')) === '["Passo da simulação do cursor de tempo","1",""]'
    && JSON.stringify(cells('Índice da amostra gravada do cursor de tempo (a partir de 0)')) === '["Índice da amostra gravada do cursor de tempo (a partir de 0)","2",""]'
    && cells('Instante exato de um evento')[1] === 'entre os passos 1 e 2', JSON.stringify(cells('Passo da simulação do cursor de tempo')));

  UI.xlsx = stub;
  run1 = null;
  UI.surgeResults = { sheets: () => [{ name: 'Golpe', columns: [], rows: [] }] };
  app.exportResultsXlsx();
  ok('J4 with the water hammer the tables are of the steady state', val('Análise') === 'Golpe de aríete' && val('Tabelas de objetos') === 'Resultados do regime permanente' && !/ t /.test(file));
}

// ------------------------------------------------------------ the differences of a scenario
console.log('\nThe differences of a scenario are named and written as the inspector does');
{
  const c4 = loadContext(['src/ui/namespace.js', 'src/ui/common/format.js', 'src/ui/common/dom.js']);
  const P4 = c4.PumpIt, UI = P4.ui;
  const run = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), c4, { filename: f });
  UI.dialogs = { toast() {}, modal() {}, askText() {}, confirmBox() {} };
  P4.app = Object.assign(P4.app || {}, { getVal: (k, p) => (p === 'mode' ? 'curve' : 90), isOv: () => false });
  run('src/ui/inspector/forms.js');
  run('src/ui/topbar/scenarios.js');
  P4.i18n.setLanguage('pt-BR');
  const Fm = UI.forms, S = UI.scenarios;

  // the fields built while describe runs: label and what reads the value; nothing is kept outside it
  const got = Fm.describe(() => {
    Fm.num('j:2', 'speed', 'Rotação', { suffix: '%' });
    Fm.sel('j:2', 'mode', 'Modo', [['curve', 'Curva'], ['fixedFlow', 'Vazão fixa']]);
    Fm.remember('j:2', 'curve', { label: 'Curva de altura', curve: { xCat: 'volFlow', yCat: 'head', yName: 'Altura' } });
  });
  ok('K1 describe gives the label and the suffix of a number', got['j:2|speed'] && got['j:2|speed'].label === 'Rotação' && got['j:2|speed'].suffix === '%');
  ok('K1 the options of a list and the axes of a curve', got['j:2|mode'].options.length === 2 && got['j:2|curve'].curve.yName === 'Altura');
  ok('K1 fields built outside describe are not kept', Object.keys(Fm.describe(() => {})).length === 0 && (Fm.num('j:9', 'x', 'X'), true) && !Fm.describe(() => {})['j:9|x']);

  const fmt = (v) => P4.ui.format.inputStr(v);
  ok('K2 a speed as the inspector: 90% and 100%', S.showValue(90, got['j:2|speed']) === '90%' && S.showValue(100, got['j:2|speed']) === '100%');
  ok('K2 a quantity as typed, with its unit', S.showValue({ value: 46.5, unit: 'm' }) === `${fmt(46.5)} m`, S.showValue({ value: 46.5, unit: 'm' }));
  ok('K2 an option by its text, a check box by yes or no', S.showValue('fixedFlow', got['j:2|mode']) === 'Vazão fixa' && S.showValue(true) === 'sim' && S.showValue(false) === 'não');
  ok('K2 a value not there, and a curve by its points', S.showValue(undefined) === '—' && S.showValue({ x: [0, 40, 80], y: [1, 2, 3] }) === '3 pontos');

  const o = got['j:2|curve'].curve;
  const parent = { x: [0, 40, 80, 120], y: [48, 46.5, 41, 33], xUnit: 'm³/h', yUnit: 'm', fit: '2' };
  const one = S.curveDiff(Object.assign({}, parent, { y: [48, 45.5, 41, 33] }), parent, o);
  ok('K3 one point changed: Altura a 40 m³/h, 45,5 m here and 46,5 m in the parent', one.length === 1 && one[0].label === `Altura a ${fmt(40)} m³/h` && one[0].here === `${fmt(45.5)} m` && one[0].parent === `${fmt(46.5)} m`, JSON.stringify(one));
  ok('K3 the same curve has no rows', S.curveDiff(parent, parent, o).length === 0);
  const add = S.curveDiff(Object.assign({}, parent, { x: [0, 40, 60, 80, 120], y: [48, 46.5, 44, 41, 33] }), parent, o);
  ok('K3 a point added', add.length === 1 && add[0].label === `Ponto incluído a ${fmt(60)} m³/h` && add[0].parent === '—');
  const rem = S.curveDiff(Object.assign({}, parent, { x: [0, 40, 120], y: [48, 46.5, 33] }), parent, o);
  ok('K3 a point removed', rem.length === 1 && rem[0].label === `Ponto removido a ${fmt(80)} m³/h` && rem[0].here === '—' && rem[0].parent === `${fmt(41)} m`);
  // the same curve typed in L/s and ft: no point changed, but the units differ and each side keeps its own
  const ls = { x: [0, 40 / 3.6, 80 / 3.6, 120 / 3.6], y: [48, 46.5, 41, 33].map((h) => h / 0.3048), xUnit: 'L/s', yUnit: 'ft', fit: '2' };
  const u = S.curveDiff(ls, parent, o);
  ok('K4 flows matched in SI across units: only the units differ', u.length === 1 && u[0].label === 'Unidades' && u[0].here === 'L/s · ft' && u[0].parent === 'm³/h · m', JSON.stringify(u));
  const uf = S.curveDiff(Object.assign({}, ls, { y: ls.y.map((v, i) => (i === 1 ? 45.5 / 0.3048 : v)) }), parent, o);
  ok('K4 a changed point in other units shows each value in the units of its curve', uf.length === 2 && uf[0].here.endsWith(' ft') && uf[0].parent === `${fmt(46.5)} m`);
  const fit = S.curveDiff(Object.assign({}, parent, { fit: 'xy' }), parent, o);
  ok('K4 a different fit', fit.length === 1 && fit[0].label === 'Tipo de ajuste');
  ok('K4 a curve where the parent has none: every point added', S.curveDiff(parent, undefined, o).length === 4);
  P4.i18n.setLanguage('en');
}

// ------------------------------------------------------------ back to a scenario while the water hammer runs
// The calculation, the run of the water hammer and the scenario switch of the app, on the gravity example, with the
// run itself replaced by one of a few slices and the timers run by hand: two switches in the same cycle, as the
// keyboard on the scenario list does, and back to the child.
console.log('\nBack to a scenario, its water hammer starts again or keeps its result');
{
  const c5 = loadContext(['src/ui/namespace.js', 'src/ui/common/format.js', 'src/ui/common/dom.js']);
  const P5 = c5.PumpIt, UI = P5.ui, M = P5.model;
  const run = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), c5, { filename: f });
  const timers = [];
  c5.setTimeout = (fn) => { timers.push(fn); };
  c5.performance = { now: () => 0 };
  const flush = (n = Infinity) => { while (n-- > 0 && timers.length) timers.shift()(); };
  // a run of the water hammer in four slices
  let made = 0, cancelled = 0;
  P5.surge.start = () => {
    made++;
    return { k: 0, N: 100, stopped: false, step() { this.k += 25; return { done: this.k >= this.N }; }, cancel() { cancelled++; this.stopped = true; }, result() { return { ok: true, times: [0, 1], stopped: this.stopped, n: made }; } };
  };
  const nodes = {};
  UI.dom = Object.assign({}, UI.dom, { $: (sel) => nodes[sel] || (nodes[sel] = new Node('select')) });
  UI.dialogs = { toast() {}, modal() {}, askText() {}, confirmBox() {} };
  UI.surgeBar = { renderProgress() {} };
  const m = P5.examples.get('gravity').build();
  m.solution.surge = Object.assign(P5.surge.inputs.newControl(), { on: true });
  const alt = M.addScenario(m, 'base', 'Alternativa');
  const app = Object.assign(P5.app || (P5.app = {}), {
    model: m, version: 1, results: {}, save() {}, renderAll() {}, startTime() {}, timeResult: () => null, timeProgress: () => null,
    eff: () => M.effective(m, m.scenarios.current), validation: () => ({ ok: true }),
  });
  app.steadyResults = () => app.results[m.scenarios.current] || null;
  run('src/ui/app/calculation.js');
  run('src/ui/surge/run.js');
  run('src/ui/topbar/scenarios.js');
  UI.scenarios.bind();
  let starts = 0;
  const startSurge = app.startSurge;
  app.startSurge = () => { starts++; startSurge(); };
  const sel = nodes['#scenario-select'];
  const go = (sid) => { sel.value = sid; sel.fire('change'); };

  app.recalc(); flush();
  const baseRun = app.surgeResult();
  ok('L1 the base has its steady state and its water hammer', app.steadyResults().ok && baseRun && baseRun.ok && !baseRun.stopped);
  go(alt.id); flush(1);
  const progress = app.surgeProgress();
  ok('L2 in the child, its steady state is calculated and its water hammer is going', app.steadyResults().ok && progress && progress.k === 25, JSON.stringify(progress));
  go('base');
  ok('L2 back in the base in the same cycle: its result is kept, nothing starts', app.surgeResult() === baseRun && !app.surgeProgress() && starts === 2, String(starts));
  flush();
  ok('L2 the run of the child stops without a result', cancelled === 1 && !app.surgeRuns[alt.id]);
  go(alt.id);
  ok('L3 back in the child with its steady state: its water hammer starts again', starts === 3 && !!app.surgeProgress());
  flush();
  ok('L3 and gives its result, so its cursor and tab come back', app.surgeRun() && app.surgeResult().ok && !app.surgeResult().stopped);
  const altRun = app.surgeResult();
  go('base'); go(alt.id);
  ok('L4 a complete result is kept on the way back', starts === 3 && app.surgeResult() === altRun);
  app.startSurge(); flush(1); app.cancelSurge();
  const stopped = app.surgeResult();
  go('base'); go(alt.id);
  ok('L4 a run stopped by the user is kept as stopped', stopped && stopped.stopped && app.surgeResult() === stopped && starts === 4, String(starts));
  app.surgeRuns[alt.id] = { ok: false, error: 'refused' };
  go('base'); go(alt.id);
  ok('L4 a refused run keeps its error', starts === 4 && app.surgeResult().error === 'refused');
  go('base');
  ok('L5 the base still shows its own result', app.surgeResult() === baseRun);
}

// ------------------------------------------------------------ a physical quantity an action must not change
// The editing of the app on the example of pumping between tanks, in its 90 % speed scenario: the material of a pipe
// back from the parent, the ambient pressure converted to a gauge unit and the basis of a table over time.
console.log('\nA restore, a conversion and a change of basis keep the physics');
{
  const c6 = loadContext(['src/ui/namespace.js', 'src/ui/common/format.js', 'src/ui/common/dom.js', 'src/ui/common/num-cell.js']);
  const P6 = c6.PumpIt, UI = P6.ui, M = P6.model, U = P6.units, D = P6.data;
  const toasts = [];
  UI.dialogs = { toast: (s) => toasts.push(s), modal() {} };
  UI.canvas = { dropDraft() {} };
  UI.scene3d = { carryView() {} };
  UI.inspector = { addSection() {} };
  const run = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), c6, { filename: f });
  run('src/ui/app/state.js');
  const app = P6.app;
  run('src/ui/app/editing.js');
  run('src/ui/inspector/value-convert.js');
  run('src/ui/time/data-section.js');
  let renders = 0;
  Object.assign(app, { changed: () => { app.version++; }, pruneSelection() {}, renderAll: () => { renders++; }, save() {}, okResults: () => null });
  app.eff = () => M.effective(app.model, app.model.scenarios.current);
  P6.i18n.setLanguage('pt-BR');
  const fresh = (sid = 's1') => { app.model = P6.examples.get('pump').build(); app.model.scenarios.current = sid; app.undoStack = []; app.redoStack = []; };
  const pipe = () => M.getObj(app.eff(), 'p:1');
  const dmm = () => { const g = pipe().geometry; return U.toSI(g.d.value, g.d.unit, 'length') * 1000; };
  const flow = (m = app.model, sid = m.scenarios.current) => P6.solver.run(M.effective(m, sid)).pipes[1].Q * 3600;
  const own = (sid = 's1') => Object.keys(app.model.scenarios.list.find((s) => s.id === sid).overrides).filter((k) => k.startsWith('p:1|')).sort().join(',');
  const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

  // item 1: the nominal size back from the parent brings its bore back
  fresh();
  const q0 = flow();
  ok('M1 the pipe of the child as in the base: 6", 154.05 mm, 89.29 m³/h', pipe().material.nps === '6' && near(dmm(), 154.05) && near(q0, 89.294, 1e-4), q0.toFixed(3));
  app.setVal('p:1', 'material.nps', '2');
  const q2 = flow();
  ok('M1 2" in the child: 52.50 mm and 44.62 m³/h', near(dmm(), 52.5) && near(q2, 44.62, 1e-3), `${dmm()} ${q2.toFixed(3)}`);
  app.clearOv('p:1', 'material.nps');
  ok('M1 the size restored: 6", 154.05 mm and the flow of the base', pipe().material.nps === '6' && near(dmm(), 154.05) && near(flow(), q0), `${dmm()} ${flow().toFixed(3)}`);
  ok('M1 nothing of the pipe is left changed in the child', own() === '', own());
  const reopened = JSON.parse(JSON.stringify(app.model));
  ok('M1 saved and opened again: the same flow', near(flow(reopened, 's1'), q0));
  app.undo();
  ok('M1 one undo brings back the 2" line', pipe().material.nps === '2' && near(dmm(), 52.5) && near(flow(), q2));
  app.redo();
  ok('M1 and redo the restored 6"', pipe().material.nps === '6' && near(dmm(), 154.05));
  // a series with another wall
  app.setVal('p:1', 'material.sch', '80');
  ok('M1 schedule 80 in the child: a thicker wall, 146.33 mm', near(dmm(), 146.33, 1e-4), String(dmm()));
  app.clearOv('p:1', 'material.sch');
  ok('M1 the schedule restored: 154.05 mm, nothing left changed', near(dmm(), 154.05) && own() === '' && near(flow(), q0), own());
  // a material back: its bore and its roughness, but a roughness of the user stays
  app.setVal('p:1', 'material.kind', 'hdpe');
  ok('M1 another material in the child changes the bore and the roughness', !near(dmm(), 154.05) && pipe().friction.eps.value !== 0.046);
  app.clearOv('p:1', 'material.kind');
  ok('M1 the material restored: steel 6", its roughness and the flow of the base', pipe().material.kind === 'steel' && pipe().material.nps === '6' && pipe().friction.eps.value === 0.046 && own() === '' && near(flow(), q0), own());
  app.setVal('p:1', 'material.kind', 'hdpe');
  app.setVal('p:1', 'friction.eps', { value: 0.2, unit: 'mm' });
  app.clearOv('p:1', 'material.kind');
  ok('M1 a roughness typed in the child stays when the material comes back', pipe().material.kind === 'steel' && near(dmm(), 154.05) && pipe().friction.eps.value === 0.2, JSON.stringify(pipe().friction.eps));
  // another change of the child stays
  fresh();
  app.setVal('p:1', 'length', { value: 30, unit: 'm' });
  app.setVal('p:1', 'material.nps', '2');
  app.clearOv('p:1', 'material.nps');
  ok('M1 a change of the child on its own stays', own() === 'p:1|length' && pipe().length.value === 30 && near(dmm(), 154.05), own());

  // item 2: the ambient pressure converted to a gauge unit keeps its value
  fresh('base');
  app.setVal('sys', 'patm', { value: 80, unit: 'kPa(a)' });
  const npsh = () => P6.solver.run(app.eff()).pumps[2].NPSHA;
  const n0 = npsh();
  ok('M2 80 kPa(a) of ambient pressure: NPSH available 10.485 m', near(n0, 10.485, 1e-4), n0.toFixed(4));
  const cs = UI.valueConvert.context('sys', 'patm');
  ok('M2 its own field converts against the standard atmosphere', cs.ctx.patm === U.PATM);
  const g = U.convert(80, 'kPa(a)', 'kPa(g)', 'pressure', cs.ctx);
  ok('M2 80 kPa(a) is −21.325 kPa(g) for the ambient field', near(g, -21.325), String(g));
  app.setVal('sys', 'patm', { value: Number(g.toPrecision(12)), unit: 'kPa(g)' });
  ok('M2 applied: 80 000 Pa and the same NPSH', near(U.toSI(app.eff().system.patm.value, app.eff().system.patm.unit, 'pressure'), 80000) && near(npsh(), n0), npsh().toFixed(4));
  const back = U.convert(g, 'kPa(g)', 'kPa(a)', 'pressure', UI.valueConvert.context('sys', 'patm').ctx);
  ok('M2 and back to kPa(a): 80', near(back, 80), String(back));
  const reread = JSON.parse(JSON.stringify(app.model));
  ok('M2 saved and opened again: the same NPSH', near(P6.solver.run(M.effective(reread, 'base')).pumps[2].NPSHA, n0));
  const cp = UI.valueConvert.context('j:2', 'setP');
  ok('M2 a process pressure still uses the ambient pressure of the scenario: 0 kPa(g) is 80 kPa(a)', near(U.convert(0, 'kPa(g)', 'kPa(a)', 'pressure', cp.ctx), 80));

  // item 4: the basis of the speed table of a pump, in the 90 % scenario
  fresh();
  app.model.solution.time = Object.assign(M.newTimeControl(), { on: true, start: M.q(0, 'h'), stop: M.q(1, 'h'), step: M.q(10, 'min') });
  const absolute = { use: true, what: 'speed', basis: 'absolute', start: 'time', when: [], tables: [{ t: [0, 1], v: [90, 81], tUnit: 'h', vUnit: '%' }], repeat: false, interp: 'linear' };
  M.setField(app.model, 's1', 'j:2', 'time', absolute);
  const last = () => {
    const eff = app.eff();
    const v = M.validate(eff);
    if (!v.ok) return { err: v.items.filter((i) => !i.ok).map((i) => i.text || JSON.stringify(i)).join('; ') };
    const r = P6.time.run(eff);
    const n = r.times.length - 1;
    return { Q: r.series.pipes[1].Q[n] * 3600, s: r.series.pumps[2].speed[n] };
  };
  const a0 = last();
  ok('M4 absolute 90 and 81: at the end 81 % and 66.455 m³/h', near(a0.s, 81) && near(a0.Q, 66.455, 1e-4), JSON.stringify(a0));
  const j2 = M.getObj(app.eff(), 'j:2'), qt = P6.junctionTypes.get('pump').time.quantities(j2, {})[0];
  const rel = UI.timeData.rebase(j2, qt, absolute.tables, 'relative');
  ok('M4 to % of the steady state: 100 and 90', rel && rel[0].v.join() === '100,90' && rel[0].vUnit === '%', rel && rel[0].v.join());
  M.setField(app.model, 's1', 'j:2', 'time', Object.assign({}, absolute, { basis: 'relative', tables: rel }));
  const a1 = last();
  ok('M4 the relative table calculates the same run', near(a1.Q, a0.Q) && near(a1.s, 81), JSON.stringify(a1));
  const abs = UI.timeData.rebase(M.getObj(app.eff(), 'j:2'), qt, rel, 'absolute');
  ok('M4 and back to absolute: 90 and 81', abs && abs[0].v.join() === '90,81', abs && abs[0].v.join());
  const stopped = Object.assign(M.clone(j2), { speed: 0 });
  ok('M4 a steady value of zero cannot be a basis: nothing is converted', UI.timeData.rebase(stopped, qt, absolute.tables, 'relative') === null);
}

// ------------------------------------------------------------ an input that is not possible
// An annulus whose inner diameter is negative or not less than the outer one, and a fitting with a negative quantity:
// the checklist holds the calculation, the solver refuses them on its own, and the cell of the quantity keeps the
// value before.
console.log('\nAn impossible annulus or quantity of fittings');
{
  const c7 = loadContext(['src/ui/namespace.js', 'src/ui/common/format.js', 'src/ui/common/dom.js', 'src/ui/common/num-cell.js']);
  const P7 = c7.PumpIt, UI = P7.ui, M = P7.model;
  P7.i18n.setLanguage('pt-BR');
  const near = (a, b, tol = 1e-4) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
  const mk = () => P7.examples.get('pump').build();
  const check = (m) => { const v = M.validate(M.effective(m, 'base')); return { ok: v.ok, p1: (v.undef.get('p:1') || []).join(' | ') }; };
  const flow = (m) => { const r = P7.solver.run(M.effective(m, 'base')); return r.ok ? r.pipes[1].Q * 3600 : NaN; };

  // item 5: the annulus
  const m = mk();
  const g = m.pipes[0].geometry;
  m.pipes[0].material = { kind: 'user' };
  g.kind = 'annulus'; g.dOuter = M.q(100, 'mm'); g.dInner = M.q(50, 'mm');
  ok('N1 an annulus of 100 and 50 mm: 93.39 m³/h', check(m).ok && near(flow(m), 93.39), flow(m).toFixed(2));
  const bad = P7.i18n.t('core.checklist.pipe.annulusInner');
  for (const [v, u] of [[-50, 'mm'], [100, 'mm'], [0.11, 'm']]) {
    g.dInner = M.q(v, u);
    const c = check(m);
    const r = P7.solver.run(M.effective(m, 'base'));
    ok(`N1 an inner diameter of ${v} ${u} with 100 mm outside is not an annulus`, !c.ok && c.p1 === bad && !r.ok, c.p1);
  }
  g.dOuter = M.q(0.1, 'm'); g.dInner = M.q(50, 'mm');
  ok('N1 0.10 m outside and 50 mm inside, compared in one unit: 93.39 m³/h again', check(m).ok && near(flow(m), 93.39), flow(m).toFixed(2));
  g.dInner = M.q(0, 'mm');
  ok('N1 an inner diameter of zero is a full pipe', check(m).ok);
  // a model file with the annulus that is not one
  g.dInner = M.q(-50, 'mm');
  const opened = JSON.parse(JSON.stringify(m));
  ok('N1 a file with it waits in the checklist', !check(opened).ok && check(opened).p1 === bad);

  // item 6: the quantity of a fitting
  const m2 = mk();
  m2.pipes[0].fittings.push(Object.assign(P7.data.customFitting(), { qty: 1, value: 5 }));
  const q1 = flow(m2);
  ok('N2 a K of 5 once with the fittings of the example: 109.86 m³/h', check(m2).ok && near(q1, 109.86), q1.toFixed(2));
  m2.pipes[0].fittings[2].qty = -1;
  const c2 = check(m2);
  ok('N2 a file with a quantity of −1 waits in the checklist', !c2.ok && c2.p1 === P7.i18n.t('core.checklist.pipe.fittingQty'), c2.p1);
  const r2 = P7.solver.run(M.effective(m2, 'base'));
  ok('N2 and the solver refuses it on its own, never as a gain', !r2.ok && r2.errors.join().includes('P1'), r2.errors.join());
  m2.pipes[0].fittings[2].qty = 0;
  ok('N2 a quantity of zero is accepted', check(m2).ok);
  m2.pipes[0].fittings[2].qty = 1;
  ok('N2 back to 1: 109.86 m³/h', near(flow(m2), 109.86));

  // the editor of fittings: −1 typed in the quantity
  const commits = [];
  const app = P7.app || (P7.app = {});
  app.setVal = (key, p, v) => commits.push(v);
  UI.forms = { el: UI.dom.el, section: () => new Node('div'), readout: () => new Node('div') };
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/ui/inspector/fittings-editor.js'), 'utf8'), c7, { filename: 'fittings-editor.js' });
  const p = M.getObj(M.effective(m2, 'base'), 'p:1');
  const box = UI.fittingsEditor.build('p:1', p, { Dh: 0.15405 });
  const find = (n, id) => { if (n.id === id) return n; for (const c of n.children || []) { const r = find(c, id); if (r) return r; } return null; };
  const cell = find(box, 'fit-q-p:1-2');
  cell.value = '-1'; cell.fire('change');
  const err = find(box, 'fit-q-p:1-2-err');
  ok('N3 −1 typed in the quantity is refused: nothing written, the cell marked', commits.length === 0 && cell.getAttribute('aria-invalid') === 'true', String(commits.length));
  ok('N3 its message tells the row and why', err && err.textContent.startsWith('Linha 3 · ') && err.textContent.includes('“-1” não é aceito (a quantidade é zero ou mais)') && err.textContent.endsWith('Esc restaura 1.'), err && err.textContent);
  cell.value = '2'; cell.fire('change');
  ok('N3 a quantity of 2 is written', commits.length === 1 && commits[0][2].qty === 2 && !cell.hasAttribute('aria-invalid'));
}

// ------------------------------------------------------------ the curve of a pump its control drives
// The chart of a pump against the system on the example of pumping between tanks, with the drawing of the chart
// replaced by one that keeps what it is given: the curve, its legend and the operating point must agree.
console.log('\nThe curve of a controlled pump is drawn at the speed its control found');
{
  const c8 = loadContext(['src/ui/namespace.js', 'src/ui/common/format.js', 'src/ui/common/dom.js']);
  const P8 = c8.PumpIt, UI = P8.ui, M = P8.model;
  P8.i18n.setLanguage('pt-BR');
  let drawn = null;
  UI.lineChart = { lineChart: (o) => { drawn = o; return ''; } };
  const app = P8.app || (P8.app = {});
  let m = null, res = null;
  Object.assign(app, {
    version: 1, prefs: {}, outUnit: (k, cat) => (cat === 'volFlow' ? 'm³/h' : 'm'), validation: () => ({ ok: true }),
    timeRun: () => null, currentResults: () => res, scenario: () => ({ id: 'base', name: 'Base' }),
    eff: () => M.effective(m, 'base'),
  });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/ui/charts/pump-chart.js'), 'utf8'), c8, { filename: 'pump-chart.js' });
  const setUp = (fields) => { m = P8.examples.get('pump').build(); Object.assign(m.junctions[1], fields); app.version++; res = P8.solver.run(M.effective(m, 'base')); };
  const draw = () => { drawn = null; const notes = new Node('p'); UI.pumpChart.render(new Node('div'), new Node('div'), notes); return { d: drawn, notes: notes.html || '' }; };
  // the head of the drawn pump curve at the flow of the operating point, between its two points around it
  const onCurve = (d) => {
    const pump = d.series.find((s) => s.name.startsWith('Bomba a'));
    const p = d.points[0];
    const k = pump.pts.findIndex(([q], i) => i > 0 && q >= p.x);
    const [[q0, h0], [q1, h1]] = [pump.pts[k - 1], pump.pts[k]];
    return h0 + ((h1 - h0) * (p.x - q0)) / (q1 - q0) - p.y;
  };
  const control = { mode: 'controlFlow', setQ: M.q(80, 'm³/h') };
  setUp(control);
  const pr = res.pumps[2];
  ok('O1 the control of 80 m³/h finds 86.147 % and 29.622 m', Math.abs(pr.speed - 86.147) < 1e-3 && Math.abs(pr.dH - 29.622) < 1e-3, `${pr.speed} ${pr.dH}`);
  const a = draw();
  const name = (d) => d.series.find((s) => s.name.startsWith('Bomba a')).name;
  ok('O1 typed at 100 %: the curve is named at the speed found', name(a.d) === 'Bomba a 86,147%', name(a.d));
  ok('O1 and passes through the operating point', Math.abs(onCurve(a.d)) < 0.05, onCurve(a.d).toFixed(4));
  setUp(Object.assign({ speed: 70 }, control));
  const b = draw();
  ok('O2 typed at 70 % first: the same curve, legend and point', name(b.d) === name(a.d) && JSON.stringify(b.d.series[0].pts) === JSON.stringify(a.d.series[0].pts) && Math.abs(onCurve(b.d)) < 0.05);
  setUp({ mode: 'curve', speed: pr.speed });
  const c = draw();
  ok('O3 on its curve at 86.147 % imposed: 80.00 m³/h and 29.62 m on the curve', Math.abs(res.pumps[2].Q * 3600 - 80) < 0.01 && Math.abs(res.pumps[2].dH - 29.62) < 0.01 && Math.abs(onCurve(c.d)) < 0.05, `${res.pumps[2].Q * 3600}`);
  setUp({ mode: 'curve', speed: 90 });
  ok('O3 on its curve the speed typed names it', name(draw().d) === 'Bomba a 90%');
  setUp({ mode: 'fixedFlow', fixedFlow: M.q(80, 'm³/h') });
  const f = draw();
  ok('O4 sizing by a fixed flow: the system alone, the head it needs', f.d.series.length === 1 && f.d.series[0].name === 'Sistema (altura necessária)');
  setUp({ mode: 'controlFlow', setQ: M.q(500, 'm³/h') });
  const h = draw();
  ok('O5 a set point no speed reaches: no pump curve, and the note says why', res.pumps[2].control === 'high' && h.d.series.length === 1 && h.notes.includes('não encontrou rotação'), h.notes);
}

// ------------------------------------------------------------ the links between objects
// A named event renamed and the rename undone (time/events-section.js, with its fields on the stand-in of the DOM), and
// a network copied and pasted with the conditions of its pump (clipboard.js), in the same model and in another one.
console.log('\nThe links of an event and of a condition');
{
  const c9 = loadContext(['src/ui/namespace.js', 'src/ui/common/format.js', 'src/ui/common/dom.js']);
  const P9 = c9.PumpIt, UI = P9.ui, M = P9.model;
  P9.i18n.setLanguage('pt-BR');
  UI.dialogs = { toast() {} };
  UI.canvas = { dropDraft() {} };
  UI.scene3d = { carryView() {} };
  UI.forms = { section: () => new Node('div') };
  UI.timeData = { conditionBlock: () => new Node('div'), newCondition: () => ({ q: 'time', op: '>=', value: M.q(1, 'h') }) };
  const run = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), c9, { filename: f });
  run('src/ui/app/state.js');
  const app = P9.app;
  run('src/ui/app/editing.js');
  run('src/ui/time/events-section.js');
  run('src/ui/app/clipboard.js');
  Object.assign(app, { changed: () => { app.version++; }, pruneSelection() {}, renderAll() {}, save() {}, hitOf: (k) => ({ key: k }) });
  const timeOn = (m) => { m.solution.time = Object.assign(M.newTimeControl(), { on: true, start: M.q(0, 'h'), stop: M.q(1, 'h'), step: M.q(10, 'min') }); return m; };
  const valid = (m, sid) => { const v = M.validate(M.effective(m, sid)); return v.ok ? 'ok' : JSON.stringify([...v.undef]); };
  const find = (n, id) => { if (n.id === id) return n; for (const c of n.children || []) { const r = find(c, id); if (r) return r; } return null; };

  // item 7: rename, undo, redo
  const m = timeOn(P9.examples.get('pump').build());
  m.events = [{ name: 'Partida A', cond: { q: 'time', op: '>=', value: M.q(0.5, 'h') } }];
  const data = (v) => ({ use: true, what: 'speed', basis: 'absolute', start: 'combined', combined: 'Partida A', when: [], tables: [{ t: [0, 1], v, tUnit: 'h', vUnit: '%' }], repeat: false, interp: 'linear' });
  m.junctions[1].time = data([100, 100]);
  // the child changes the time data of the pump: its own copy names the event too
  m.scenarios.list[1].overrides['j:2|time'] = data([90, 80]);
  app.model = m; app.undoStack = []; app.redoStack = [];
  const names = () => [app.model.events[0].name, app.model.junctions[1].time.combined, M.effective(app.model, 's1').junctions[1].time.combined].join(' / ');
  ok('P1 the event and both scenarios calculate', valid(app.model, 'base') === 'ok' && valid(app.model, 's1') === 'ok', valid(app.model, 'base'));
  const sec = UI.timeEvents.section();
  const name = find(sec, 'te-0-name');
  name.value = 'Partida B'; name.fire('change');
  ok('P1 renamed: the event, the pump and the child follow', names() === 'Partida B / Partida B / Partida B', names());
  ok('P1 a single undo step', app.undoStack.length === 1);
  app.undo();
  ok('P1 undo: the event and the pump in both scenarios point to Partida A', names() === 'Partida A / Partida A / Partida A', names());
  ok('P1 and both calculate', valid(app.model, 'base') === 'ok' && valid(app.model, 's1') === 'ok');
  app.redo();
  ok('P1 redo: all to Partida B, and both calculate', names() === 'Partida B / Partida B / Partida B' && valid(app.model, 'base') === 'ok' && valid(app.model, 's1') === 'ok', names());
  const saved = JSON.parse(JSON.stringify(app.model));
  ok('P1 the file written agrees', saved.events[0].name === saved.junctions[1].time.combined);

  // item 8: the conditions of a pasted pump
  const src = timeOn(P9.examples.get('pump').build());
  src.junctions[1].time = {
    use: true, what: 'speed', basis: 'absolute', start: 'dualSequential', combined: '', repeat: false, interp: 'linear',
    when: [
      { q: 'flowVol', obj: 'p:1', op: '>=', value: M.q(10, 'm³/h') },
      // a difference between two copied objects: the static pressure from the start of P1 to the end of P3
      { q: 'pStatic', obj: 'p:1', end: 'in', obj2: 'p:3', end2: 'out', op: '>=', value: M.q(-10, 'kgf/cm²') },
    ],
    tables: [{ t: [0, 1], v: [100, 100], tUnit: 'h', vUnit: '%' }, { t: [0, 1], v: [100, 100], tUnit: 'h', vUnit: '%' }],
  };
  src.junctions[1].surge = { when: [{ q: 'flowVol', obj: 'p:2', op: '>=', value: M.q(1, 'm³/h') }] };
  app.model = src; app.undoStack = [];
  ok('P2 the pump with its conditions calculates', valid(app.model, 'base') === 'ok', valid(app.model, 'base'));
  app.selSet = new Set(['j:1', 'j:2', 'j:3', 'j:4', 'p:1', 'p:2', 'p:3']);
  app.copySelection();
  app.paste();
  const pump = (id) => app.model.junctions.find((j) => j.id === id);
  const conds = (j) => j.time.when.map((c) => [c.obj, c.obj2].filter(Boolean).join('→')).join(', ') + ' | ' + j.surge.when[0].obj;
  ok('P2 duplicated: J2 still watches P1', conds(pump(2)) === 'p:1, p:1→p:3 | p:2', conds(pump(2)));
  ok('P2 and J6 watches the copies P4 and P6, P5 for its water hammer', conds(pump(6)) === 'p:4, p:4→p:6 | p:5', conds(pump(6)));
  ok('P2 both networks calculate', valid(app.model, 'base') === 'ok');
  // the same copy into another model, emptied first
  const other = P9.examples.get('gravity').build();
  other.junctions = []; other.pipes = []; other.scenarios.list.forEach((s) => { s.overrides = {}; });
  app.model = other; app.undoStack = []; app.clipboard.pastes = 0;
  app.paste();
  timeOn(app.model);
  const pids = app.model.pipes.map((p) => p.id).join(',');
  const jp = app.model.junctions.find((j) => j.type === 'pump');
  ok(`P3 pasted into another model (pipes ${pids}): J${jp.id} watches P${app.model.pipes[0].id}, the copy of P1`, conds(jp) === `p:${app.model.pipes[0].id}, p:${app.model.pipes[0].id}→p:${app.model.pipes[2].id} | p:${app.model.pipes[1].id}`, conds(jp));
  ok('P3 and it calculates at once', valid(app.model, 'base') === 'ok', valid(app.model, 'base'));
  // a condition on an object left out of the copy keeps watching it
  app.model = src; app.undoStack = [];
  app.selSet = new Set(['j:2']);
  app.copySelection(); app.paste();
  const alone = app.model.junctions[app.model.junctions.length - 1];
  ok('P4 the pump copied alone keeps watching P1 of the same model', conds(alone) === 'p:1, p:1→p:3 | p:2', conds(alone));
}

// ------------------------------------------------------------ the quantities of the chart over time
// The chart over time with the drawing replaced by one that keeps what it is given, on a real run: the numbers of the
// table over time without a unit (a speed, an efficiency worked out from eta, a Mach number, a Reynolds number) can be
// drawn, with the values of the table, the percentages on a scale in %.
console.log('\nThe chart over time draws every number of the table over time');
{
  const c10 = loadContext(['src/ui/namespace.js', 'src/ui/common/format.js', 'src/ui/common/dom.js']);
  const P10 = c10.PumpIt, UI = P10.ui, M = P10.model;
  P10.i18n.setLanguage('pt-BR');
  let panels = [];
  UI.lineChart = { lineChart: (o) => { panels.push(o); return ''; } };
  UI.timeFormat = { unitFor: () => 'h', clock: () => '00:00:00' };
  const app = P10.app || (P10.app = {});
  let m = null, run = null;
  Object.assign(app, {
    prefs: { colUnits: {} }, outUnit: (k, cat) => P10.units.list(cat)[0],
    eff: () => M.effective(m, 'base'), timeRun: () => run, cursorIndex: () => 0,
    currentResults: () => run.snapshotAt(0),
  });
  const run1 = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), c10, { filename: f });
  ['src/ui/results/catalog.js', 'src/ui/results/columns.js', 'src/ui/time/results.js', 'src/ui/charts/time-chart.js'].forEach(run1);
  const simulate = (id) => {
    m = P10.examples.get(id).build();
    m.solution.time = Object.assign(M.newTimeControl(), { on: true, start: M.q(0, 'h'), stop: M.q(1, 'h'), step: M.q(10, 'min') });
    run = P10.time.run(M.effective(m, 'base'));
  };
  // the quantities offered for an object, and the panels drawn for the series chosen
  const offered = (obj) => { app.prefs.timeChart = { obj, series: [] }; const ctl = new Node('div'); UI.timeChart.render(new Node('div'), ctl, new Node('p')); return [...ctl.html.match(/<select id="tch-q">([\s\S]*?)<\/select>/)[1].matchAll(/value="([^"]+)"/g)].map((x) => x[1]); };
  const draw = (obj, series) => { panels = []; app.prefs.timeChart = { obj, series }; UI.timeChart.render(new Node('div'), new Node('div'), new Node('p')); return panels; };
  const row0 = (kind, id) => UI.timeResults.rowAt(run, kind, id, 0);

  simulate('pump');
  const qs = offered('pumps:2');
  ok('Q1 J2 among the pumps offers its speed and efficiency, with flow and head', ['speed', 'etaPct', 'Q', 'dH'].every((k) => qs.includes(k)), qs.join(','));
  const pp = draw('pumps:2', ['pumps:2|speed', 'pumps:2|etaPct']);
  const r = row0('pumps', 2);
  ok('Q1 speed and efficiency share one panel in %', pp.length === 1 && pp[0].yLabel === '%', pp.map((p) => p.yLabel).join(' / '));
  ok('Q1 at the first sample: 100 % and the efficiency of the table', pp[0].series[0].pts[0][1] === 100 && Math.abs(pp[0].series[1].pts[0][1] - r.etaPct) < 1e-12 && Math.abs(r.etaPct - 73.895) < 1e-3, `${pp[0].series[1].pts[0][1]}`);
  const one = draw('pumps:2', ['pumps:2|speed']);
  ok('Q1 alone, the axis keeps the label of the table without a second (%)', one[0].yLabel === 'Rotação (%)', one[0].yLabel);

  simulate('air');
  const qp = offered('pipes:1');
  ok('Q2 P1 of the gas line offers Mach at both ends and the Reynolds number', ['Min', 'Mout', 'Re'].every((k) => qp.includes(k)), qp.join(','));
  const gp = draw('pipes:1', ['pipes:1|Min', 'pipes:1|Mout', 'pipes:1|Re']);
  const g = row0('pipes', 1);
  ok('Q2 the values of the table over time: 0.093498, 0.12260 and 1 220 573', gp.length === 1
    && Math.abs(gp[0].series[0].pts[0][1] - g.Min) < 1e-15 && Math.abs(g.Min - 0.093498) < 1e-6
    && Math.abs(gp[0].series[1].pts[0][1] - g.Mout) < 1e-15 && Math.abs(g.Mout - 0.12260) < 1e-5
    && Math.abs(gp[0].series[2].pts[0][1] - g.Re) < 1e-6 && Math.abs(g.Re - 1220573) < 1, `${g.Min} ${g.Mout} ${g.Re}`);
}

// ------------------------------------------------------------ a draft belongs to its scenario
// The cell of the head at 40 m³/h of the curve of J2, drawn again as the panel is when the scenario changes.
console.log('\nA draft of a cell stays in the scenario it was typed in');
{
  const c11 = loadContext(['src/ui/namespace.js', 'src/ui/common/format.js', 'src/ui/common/dom.js', 'src/ui/common/num-cell.js']);
  const P11 = c11.PumpIt, NC11 = P11.ui.numCell;
  P11.i18n.setLanguage('pt-BR');
  const m = P11.examples.get('pump').build();
  P11.app = Object.assign(P11.app || {}, { model: m });
  const commits = [];
  // the panel of the scenario shown: the cell with the value of the model there
  const cell = () => {
    const errs = NC11.errors();
    const v = P11.model.effective(m, m.scenarios.current).junctions[1].curve.y[1];
    const inp = NC11.input({ id: 'pt-y-j:2-1', aria: 'Altura', value: v, errs, where: NC11.where(NC11.row(2), 'Altura', 'm'), onCommit: (n) => commits.push(n) });
    return { inp, errs };
  };
  const shows = (c) => `${c.inp.value}${c.inp.getAttribute('aria-invalid') ? ' (inválido)' : ''}`;
  m.scenarios.current = 'base';
  let c = cell();
  c.inp.value = 'abc'; c.inp.fire('change');
  ok('R1 abc typed in the base: refused, the model keeps 46.5', shows(c) === 'abc (inválido)' && commits.length === 0 && m.junctions[1].curve.y[1] === 46.5);
  ok('R1 a redraw in the base keeps it', shows(cell()) === 'abc (inválido)');
  m.scenarios.current = 's1';
  c = cell();
  ok('R2 the child shows its own 46,5, without the error', shows(c) === '46,5', shows(c));
  c.inp.value = 'xyz'; c.inp.fire('change');
  ok('R2 a text typed in the child is its own draft', shows(cell()) === 'xyz (inválido)');
  c = cell();
  c.inp.fire('keydown', { key: 'Escape' });
  ok('R2 Esc drops it in the child', shows(c) === '46,5' && shows(cell()) === '46,5');
  m.scenarios.current = 'base';
  ok('R3 back in the base, its abc is still there', shows(cell()) === 'abc (inválido)');
  ok('R3 and the file keeps the number', JSON.parse(JSON.stringify(m)).junctions[1].curve.y[1] === 46.5 && commits.length === 0);
  NC11.clearDrafts();
  ok('R4 another model drops every draft', shows(cell()) === '46,5');
}

console.log(`\n${pass} checks passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
