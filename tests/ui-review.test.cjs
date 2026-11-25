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
// (charts/time-chart.js), and a draft of a cell kept in the scenario it was typed in (num-cell.js), and the fixes of the
// UX script of d5fa5e9: a model the browser does not keep (state.js), what the import report compared
// (import-report.js), one colour for values that read the same (color-scales.js), keys that a control used
// (keyboard.js) and the tools of a closed group in a narrow window (responsive.css), and the quantities of a condition
// that exist in the regime of the model (time/data-section.js, review of ab3e0d1). The interface files run on a small
// stand-in of the DOM: only what these modules use of it.
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
  constructor(tag) { this.tagName = tag.toUpperCase(); this.attrs = new Map(); this.children = []; this.parent = null; this.listeners = {}; this.value = ''; this.textContent = ''; this.className = '';
    const cls = new Set(); this.classList = { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) }; }
  prepend(c) { c.parent = this; this.children.unshift(c); return c; }
  setAttribute(k, v) { this.attrs.set(k, String(v)); if (k === 'id') this.id = String(v); }
  getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
  hasAttribute(k) { return this.attrs.has(k); }
  removeAttribute(k) { this.attrs.delete(k); }
  appendChild(c) { c.parent = this; this.children.push(c); return c; }
  append(...cs) { cs.forEach((c) => this.appendChild(c)); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this); this.parent = null; }
  querySelector(sel) {
    const m = /^\[id="(.+)"\]$/.exec(sel);
    const tag = /^[a-z]+$/i.test(sel) ? sel.toUpperCase() : null; // a tag name, or an id, or a class
    const cl = /^\.([\w-]+)$/.exec(sel);
    const walk = (n) => { for (const c of n.children) { if ((m && c.id === m[1]) || (tag && c.tagName === tag) || (cl && String(c.className || '').split(' ').includes(cl[1]))) return c; const r = walk(c); if (r) return r; } return null; };
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

  // review of ab3e0d1: the quantities of a condition follow the regime; a stored one outside it shows as '—'
  const find = (n, id) => (n.id === id ? n : n.children.reduce((o, c) => o || find(c, id), null));
  const forms0 = UI.forms;
  UI.forms = Object.assign({}, forms0, { unitOptions: () => '' });
  const qSelect = (c) => { const box = UI.timeData.conditionBlock('tq', '', c, (n) => { changed.push(n); }); return find(box, 'tq-q'); };
  const changed = [];
  const html = (sel) => sel.html || sel.innerHTML || '';
  app.model = P6.examples.get('air').build();
  const gasSel = qSelect({ q: 'hgl', obj: 'p:1', end: 'in', op: '>', value: M.q(0, 'm') });
  ok('ab3e0d1 a gas: no grade line, level or surface among the quantities; the stored grade line shows as —', gasSel && !/value="(hgl|egl|tankLevel|tankVolume|surfaceElev)"/.test(html(gasSel)) && /value="pStatic"/.test(html(gasSel)) && /<option value="" selected[^>]*>—/.test(html(gasSel)), gasSel ? html(gasSel).slice(0, 160) : 'no select');
  gasSel.value = ''; (gasSel.listeners.change || []).forEach((fn) => fn());
  ok('ab3e0d1 choosing — changes nothing', changed.length === 0);
  app.model = P6.examples.get('pump').build();
  const liqSel = qSelect({ q: 'hgl', obj: 'p:1', end: 'in', op: '>', value: M.q(0, 'm') });
  ok('ab3e0d1 a liquid keeps every quantity, the grade line selected', liqSel && /value="hgl" selected/.test(html(liqSel)) && /value="tankLevel"/.test(html(liqSel)) && !/>—</.test(html(liqSel)));
  UI.forms = forms0;
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

  // The value a table of a gas gave (review of 6c4f0fa, item 1): 400 Nm³/h at J5 of the air plant, recorded in kg/s,
  // read back at the normal density in Nm³/h and at the density of J5 at that step in m³/h, in the table and the chart.
  UI.columnSetup = UI.columnSetup || { columns: () => [] };
  UI.junctionTypes = UI.junctionTypes || { get: () => null };
  UI.timeFormat.num = () => '';
  app.savePrefs = () => {};
  const units = {};
  app.outUnit = (k, cat) => (units[k] && P10.units.has(cat, units[k]) ? units[k] : P10.units.list(cat)[0]);
  const plant = (v, P5) => {
    m = P10.examples.get('airPlant').build();
    m.solution.time = Object.assign(M.newTimeControl(), { on: true, start: M.q(0, 'h'), stop: M.q(1, 'h'), step: M.q(10, 'min') });
    const j5 = m.junctions.find((j) => j.id === 5);
    j5.time = { use: true, what: 'Q', basis: 'absolute', start: 'time', when: [], tables: [{ t: [0, 0.5, 1], v, tUnit: 'h', vUnit: 'Nm³/h' }], repeat: false, interp: 'step' };
    // the set pressure of the reducing valve J3 over time, so that the density at J5 changes
    if (P5) m.junctions.find((j) => j.id === 3).time = { use: true, what: 'set', basis: 'absolute', start: 'time', when: [], tables: [{ t: [0, 1], v: P5, tUnit: 'h', vUnit: 'bar(g)' }], repeat: false, interp: 'linear' };
    run = P10.time.run(M.effective(m, 'base'));
  };
  // the column of the table values at every row, in a unit
  const column = (u) => {
    units['tin.Q'] = u; app.prefs.timeObj = 'junctions:5';
    const box = new Node('div'); UI.timeResults.render('series', box);
    return [...box.html.match(/<tbody>([\s\S]*?)<\/tbody>/)[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => [...r[1].matchAll(/<td class="num[^"]*">([^<]*)<\/td>/g)].pop()[1]);
  };
  const num = (s) => Number(s.replace(/\s/g, '').replace('.', '').replace(',', '.').replace('−', '-'));
  plant([400, 400, 400]);
  const rho5 = run.series.junctions[5].rho, kg = run.series.inputs[5].v;
  const nm = column('Nm³/h'), loc = column('m³/h'), ks = column('kg/s');
  ok('Q3 the table over time of J5 in Nm³/h: 400 at every step', nm.length === run.times.length && nm.every((x) => Math.abs(num(x) - 400) < 1e-3), nm.join(' | '));
  ok('Q3 in kg/s: 0,14358 as recorded', Math.abs(num(ks[0]) - 0.14358) < 1e-5 && Math.abs(kg[0] - 0.143584562) < 1e-8, ks[0]);
  ok('Q3 in m³/h: at the density of J5, 63,83 at the first step', Math.abs(num(loc[0]) - 63.83) < 5e-3 && Math.abs(num(loc[0]) - kg[0] / rho5[0] * 3600) < 1e-3, `${loc[0]} rho ${rho5[0]}`);
  units['tchart.flow'] = 'Nm³/h';
  const cn = draw('junctions:5', ['junctions:5|@input']);
  ok('Q3 the chart in Nm³/h draws 400 at every step', cn[0].series[0].pts.every((p) => Math.abs(p[1] - 400) < 1e-6), cn[0].series[0].pts.map((p) => p[1].toFixed(2)).join(' '));
  units['tchart.flow'] = 'm³/h';
  const cl = draw('junctions:5', ['junctions:5|@input']);
  ok('Q3 the chart in m³/h follows the density of J5', cl[0].series[0].pts.every((p, i) => Math.abs(p[1] - kg[i] / rho5[i] * 3600) < 1e-9));
  // a vessel pressure over time: the density of J5 changes, and each row and point converts with its own
  plant([400, 400, 400], [6, 3]);
  const r5 = run.series.junctions[5].rho, k5 = run.series.inputs[5].v, last = run.times.length - 1;
  const loc2 = column('m³/h');
  units['tchart.flow'] = 'm³/h';
  const cv = draw('junctions:5', ['junctions:5|@input']);
  ok('Q4 with a varying pressure the density of J5 changes over the run', Math.abs(r5[last] / r5[0] - 1) > 0.05, `${r5[0]} → ${r5[last]}`);
  ok('Q4 m³/h at two steps: each at the density of J5 at its step, in the table and the chart',
    [0, last].every((i) => Math.abs(num(loc2[i]) - k5[i] / r5[i] * 3600) < 1e-3 * k5[i] / r5[i] * 3600 && Math.abs(cv[0].series[0].pts[i][1] - k5[i] / r5[i] * 3600) < 1e-9),
    `${loc2[0]} ${loc2[last]}`);
  ok('Q4 Nm³/h stays 400', column('Nm³/h').every((x) => Math.abs(num(x) - 400) < 1e-3));
  // no density of J5 at a step: the volume flow there is not available, the mass and normal flows are
  const saved = run.series.junctions[5].rho;
  run.series.junctions[5].rho = saved.map((x, i) => (i === 1 ? NaN : x));
  const gap = column('m³/h');
  ok('Q4 without the density of J5 at a step, its m³/h is —', gap[1] === '—' && gap[0] !== '—' && column('Nm³/h')[1] !== '—', gap.slice(0, 3).join(' | '));
  run.series.junctions[5].rho = saved;
  // the event log of a gas: a table started at 30 min jumps from the steady 400 to 200, told in Nm³/h
  plant([400, 400, 400]);
  m.junctions.find((j) => j.id === 5).time = { use: true, what: 'Q', basis: 'absolute', start: 'single', when: [{ q: 'time', op: '>=', value: M.q(30, 'min') }], tables: [{ t: [0, 1], v: [200, 200], tUnit: 'h', vUnit: 'Nm³/h' }], repeat: false, interp: 'linear' };
  run = P10.time.run(M.effective(m, 'base'));
  units['tev.flow'] = 'Nm³/h';
  const evBox = new Node('div'); UI.timeResults.render('events', evBox);
  const jump = (evBox.html.match(/<td class="txt">([^<]*400[^<]*)<\/td><\/tr>/) || [])[1] || '';
  ok('Q5 the event log tells a jump of the flow of a gas in Nm³/h: 400 → 200', /400\s*Nm³\/h/.test(jump) && /200\s*Nm³\/h/.test(jump), jump || evBox.html.slice(0, 300));
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

// ------------------------------------------------------------ a field inside a block a scenario overrides
// Review of 6c4f0fa, items 5 and 7, on the example of pumping between tanks and its 90 % speed scenario: the table of
// the losses at the pipes writes the field typed (pipeK.1.kIn), so that the K leaving stays inherited; the friction a
// new material gives is written field by field, and a roughness back from the parent is the parent's; a file that
// holds a whole block is split on opening, with the same effective model.
console.log('\nA field inside a block of a scenario follows the parent');
{
  const c12 = loadContext(['src/ui/namespace.js', 'src/ui/common/format.js', 'src/ui/common/dom.js', 'src/ui/common/num-cell.js']);
  const P12 = c12.PumpIt, UI = P12.ui, M = P12.model;
  UI.dialogs = { toast() {}, modal() {} };
  UI.canvas = { dropDraft() {} };
  UI.scene3d = { carryView() {} };
  UI.inspector = { addSection() {} };
  const run = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), c12, { filename: f });
  run('src/ui/app/state.js');
  const app = P12.app;
  run('src/ui/app/editing.js');
  run('src/ui/app/files.js');
  run('src/ui/inspector/forms.js');
  run('src/ui/inspector/pipe-losses-table.js');
  UI.junctionTypes = { get: (type) => ({ connectionElevation: type === 'reservoir' }) };
  Object.assign(app, { changed: () => { app.version++; }, pruneSelection() {}, renderAll() {}, save() {}, recalc() {}, okResults: () => null });
  const reopen = (text) => app.loadModel(JSON.parse(text), { fit: false });
  app.eff = () => M.effective(app.model, app.model.scenarios.current);
  P12.i18n.setLanguage('pt-BR');
  const fresh = () => { app.model = P12.examples.get('pump').build(); app.model.scenarios.current = 's1'; app.undoStack = []; app.redoStack = []; };
  const flow = (m = app.model, sid = 's1') => P12.solver.run(M.effective(m, sid)).pipes[1].Q * 3600;
  const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
  const own = (prefix, sid = 's1') => Object.keys(app.model.scenarios.list.find((s) => s.id === sid).overrides).filter((k) => k.startsWith(prefix)).sort().join(',');
  // a cell of the table of J1 typed as the user does
  const type = (sid, field, v) => {
    app.model.scenarios.current = sid;
    const s = UI.pipeLossesTable.build('j:1', M.getObj(app.eff(), 'j:1'));
    const find = (n) => { if (n.id === `pk-1-1-${field}`) return n; for (const c of n.children || []) { const r = find(c); if (r) return r; } return null; };
    const inp = find(s);
    inp.value = String(v).replace('.', ','); inp.fire('change');
  };
  const pk = (sid) => M.getObj(M.effective(app.model, sid), 'j:1').pipeK[1];

  fresh();
  type('s1', 'kIn', 9);
  ok('I5 K arriving 9 in the child: only that field of the child changes', own('j:1|') === 'j:1|pipeK.1.kIn', own('j:1|'));
  type('base', 'kOut', 100);
  ok('I5 K leaving 100 in the base reaches the child: 100 and 9, 71.88 m³/h', pk('s1').kOut === 100 && pk('s1').kIn === 9 && near(flow(), 71.88, 1e-4), `${JSON.stringify(pk('s1'))} ${flow().toFixed(3)}`);
  const saved = JSON.stringify(app.model);
  reopen(saved);
  ok('I5 saved and opened again: 100 and 9, 71.88 m³/h', pk('s1').kOut === 100 && pk('s1').kIn === 9 && near(flow(app.model, 's1'), 71.88, 1e-4), flow(app.model, 's1').toFixed(3));
  type('base', 'kOut', 2);
  ok('I5 a later change in the base still reaches the child', pk('s1').kOut === 2 && pk('s1').kIn === 9);
  // the elevation of the connection of P1 to the reservoir J1, typed in the child, is one field of its own
  type('s1', 'elev', 1);
  ok('I5 the elevation of the connection is a field of its own', own('j:1|') === 'j:1|pipeK.1.elev,j:1|pipeK.1.kIn' && pk('s1').kOut === 2, own('j:1|'));
  // review of aca2807, case 8: a negative K is refused in its cell, with a message that names the pipe and the direction
  {
    app.model.scenarios.current = 'base';
    const s = UI.pipeLossesTable.build('j:1', M.getObj(app.eff(), 'j:1'));
    const all = (n, out = []) => { out.push(n); for (const c of n.children || []) all(c, out); return out; };
    const inp = all(s).find((n) => n.id === 'pk-1-1-kOut');
    inp.value = '-10'; inp.fire('change');
    const msg = all(s).find((n) => n.id === 'pk-1-1-kOut-err');
    ok('aca2807-8 K leaving −10 is refused, by its pipe and direction (pt-BR text), and the model keeps 2', pk('base').kOut === 2 && inp.getAttribute('aria-invalid') === 'true' && !!msg && /P1/.test(msg.textContent) && /K saindo/.test(msg.textContent) && /zero ou mais/.test(msg.textContent), msg && msg.textContent);
  }

  // a file of before: the whole entry in the child, split on opening without any value changing
  fresh();
  M.setField(app.model, 's1', 'j:1', 'pipeK.1', { kOut: 0.5, kIn: 9 });
  ok('I6 a file of before holds the whole entry', own('j:1|') === 'j:1|pipeK.1');
  reopen(JSON.stringify(app.model));
  ok('I6 opened: only K arriving stays in the child, the flow as before', own('j:1|') === 'j:1|pipeK.1.kIn' && pk('s1').kIn === 9 && pk('s1').kOut === 0.5, own('j:1|'));
  app.model.scenarios.current = 's1';
  M.setField(app.model, 'base', 'j:1', 'pipeK.1.kOut', 100);
  ok('I6 then the base reaches the K leaving of the child: 71.88 m³/h', near(flow(), 71.88, 1e-4), flow().toFixed(3));
  // a whole block that cannot be split (the parent has a field the override lacks) keeps every value
  fresh();
  M.setField(app.model, 'base', 'j:1', 'pipeK.1', { kOut: 0.5, kIn: 1, elev: { value: 1, unit: 'm' } });
  M.setField(app.model, 's1', 'j:1', 'pipeK.1', { kOut: 0.5, kIn: 9 });
  const before = JSON.stringify(M.effective(app.model, 's1'));
  M.setField(app.model, 's1', 'j:1', 'pipeK.1.kOut', 3);
  const e1 = M.getObj(M.effective(app.model, 's1'), 'j:1').pipeK[1];
  ok('I6 a block that cannot be split keeps its values and takes the field typed', e1.kOut === 3 && e1.kIn === 9 && e1.elev === undefined, JSON.stringify(e1));
  M.clearOverride(app.model, 's1', 'j:1', 'pipeK.1.kOut');
  ok('I6 and its field restored takes the parent value', M.getObj(M.effective(app.model, 's1'), 'j:1').pipeK[1].kOut === 0.5 && JSON.stringify(M.effective(app.model, 's1')) === before);

  // item 7: stainless steel in the child, the roughness back from the parent by the button and by typing it
  const eps = (sid = 's1') => M.getObj(M.effective(app.model, sid), 'p:1').friction.eps.value;
  fresh();
  app.setVal('p:1', 'material.kind', 'stainless');
  ok('I7 stainless steel in the child: 0.015 mm, field by field', eps() === 0.015 && !own('p:1|').split(',').includes('p:1|friction'), own('p:1|'));
  app.clearOv('p:1', 'friction.eps');
  ok('I7 the button brings back 0.046 mm and the field is not marked; the material stays stainless', eps() === 0.046 && !app.isOv('p:1', 'friction.eps') && M.getObj(app.eff(), 'p:1').material.kind === 'stainless');
  M.setField(app.model, 'base', 'p:1', 'friction.eps', { value: 0.05, unit: 'mm' });
  ok('I7 a later roughness of the base reaches the child', eps() === 0.05);
  app.undo();
  ok('I7 undo of the restore: 0.015 mm again', eps() === 0.015 && app.isOv('p:1', 'friction.eps'));
  fresh();
  app.setVal('p:1', 'material.kind', 'stainless');
  app.setVal('p:1', 'friction.eps', { value: 0.046, unit: 'mm' });
  ok('I7 typing 0.046 mm also follows the parent again', eps() === 0.046 && !app.isOv('p:1', 'friction.eps'));
  // a file of before, with the friction written whole by the change of material
  fresh();
  M.setField(app.model, 's1', 'p:1', 'material.kind', 'stainless');
  M.setField(app.model, 's1', 'p:1', 'friction', { model: 'roughness', eps: { value: 0.015, unit: 'mm' }, rel: 0.0001, f: 0.02, C: 120 });
  reopen(JSON.stringify(app.model));
  ok('I7 a file of before: the friction becomes its roughness alone, 0.015 mm', own('p:1|') === 'p:1|friction.eps,p:1|material.kind' && eps() === 0.015, own('p:1|'));
  app.model.scenarios.current = 's1';
  app.clearOv('p:1', 'friction.eps');
  ok('I7 and its restore brings back 0.046 mm', eps() === 0.046 && !app.isOv('p:1', 'friction.eps'));
  // the time data of a junction written whole by the child: "Use" can be ticked again
  fresh();
  const j2 = app.model.junctions.find((j) => j.id === 2);
  j2.time = { use: true, what: 'speed', basis: 'absolute', start: 'time', when: [], tables: [{ t: [0, 1], v: [100, 100], tUnit: 'h', vUnit: '' }], repeat: false, interp: 'linear' };
  app.setVal('j:2', 'time.use', false);
  app.setVal('j:2', 'time', Object.assign(M.clone(M.getObj(app.eff(), 'j:2').time), { tables: [{ t: [0, 1], v: [90, 90], tUnit: 'h', vUnit: '' }] }));
  app.setVal('j:2', 'time.use', true);
  const tm = M.getObj(app.eff(), 'j:2').time;
  ok('I7 time data written whole by the child: "Use" ticked again holds, the table of the child stays', tm.use === true && tm.tables[0].v[0] === 90 && !app.isOv('j:2', 'time.use'), own('j:2|'));
}

// ------------------------------------------------------------ the type of a junction and the mode of a scenario
// Review of 6c4f0fa, items 6 and 8, on the example of pumping between tanks and its 90 % speed scenario: a new type
// keeps, in the base and in the child, the loss the new type accepts; the mode a child chose holds whatever its parent
// chooses later, and comes back from the parent as one choice.
console.log('\nA new type and a mode of calculation follow the scenarios');
{
  const c13 = loadContext(['src/ui/namespace.js', 'src/ui/common/format.js', 'src/ui/common/dom.js', 'src/ui/common/num-cell.js']);
  const P13 = c13.PumpIt, UI = P13.ui, M = P13.model;
  UI.dialogs = { toast() {}, modal() {} };
  UI.canvas = { dropDraft() {} };
  UI.scene3d = { carryView() {} };
  UI.inspector = { addSection() {} };
  const run = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), c13, { filename: f });
  run('src/ui/app/state.js');
  const app = P13.app;
  run('src/ui/app/editing.js');
  run('src/ui/app/files.js');
  run('src/ui/inspector/forms.js');
  run('src/ui/time/system.js');
  run('src/ui/surge/system.js');
  Object.assign(app, { changed: () => { app.version++; }, pruneSelection() {}, renderAll() {}, save() {}, recalc() {}, okResults: () => null });
  app.eff = () => M.effective(app.model, app.model.scenarios.current);
  app.validation = () => ({ items: [] });
  const reopen = (text) => app.loadModel(JSON.parse(text), { fit: false });
  P13.i18n.setLanguage('pt-BR');
  const fresh = () => { app.model = P13.examples.get('pump').build(); app.model.scenarios.current = 's1'; app.undoStack = []; app.redoStack = []; };
  const flow = (sid = 's1') => P13.solver.run(M.effective(app.model, sid)).pipes[1].Q * 3600;
  const near = (a, b, tol = 1e-4) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
  const j3 = (sid) => M.getObj(M.effective(app.model, sid), 'j:3');

  // item 6: K = 25 in the child, a check valve in the base
  fresh();
  app.setVal('j:3', 'K', 25);
  ok('I8 K = 25 in the child: 78.82 m³/h', near(flow(), 78.82), flow().toFixed(3));
  app.model.scenarios.current = 'base';
  app.changeType(3, 'check');
  ok('I8 a check valve everywhere, 0.14 in the base and 25 in the child', j3('base').type === 'check' && j3('s1').type === 'check' && j3('base').K === 0.14 && j3('s1').K === 25, `${j3('base').K} ${j3('s1').K}`);
  ok('I8 the child flows 78.82 m³/h', near(flow(), 78.82), flow().toFixed(3));
  const saved = JSON.stringify(app.model);
  ok('I8 the saved file keeps the K of the child', JSON.parse(saved).scenarios.list.find((s) => s.id === 's1').overrides['j:3|K'] === 25);
  reopen(saved);
  ok('I8 reopened: 25 in the child, 78.82 m³/h', j3('s1').K === 25 && near(flow(), 78.82), flow().toFixed(3));
  fresh();
  app.setVal('j:3', 'K', 25);
  app.model.scenarios.current = 'base';
  app.changeType(3, 'check');
  app.undo();
  ok('I8 undo: a valve again, K 25 in the child', j3('s1').type === 'valve' && j3('s1').K === 25 && j3('base').K === 0.14);
  app.redo();
  ok('I8 redo: a check valve, K 25 in the child', j3('s1').type === 'check' && j3('s1').K === 25 && near(flow(), 78.82));
  // a loss model the new type does not accept goes back to its default, in the base and in the child; a Cv stays
  fresh();
  app.setVals('j:3', [['lossModel', 'opening'], ['open', 50]]);
  app.model.scenarios.current = 'base';
  app.setVals('j:3', [['lossModel', 'Cv'], ['Cv', 300]]);
  app.changeType(3, 'check');
  const own3 = Object.keys(app.model.scenarios.list.find((s) => s.id === 's1').overrides).filter((k) => k.startsWith('j:3|')).sort().join(',');
  ok('I8 by opening in the child: the check valve takes the Cv of the base, the opening goes', j3('s1').lossModel === 'Cv' && j3('s1').Cv === 300 && j3('s1').open === undefined && own3 === '', own3);
  app.changeType(3, 'reliefValve');
  ok('I8 a relief valve keeps the Cv', j3('base').lossModel === 'Cv' && j3('base').Cv === 300 && j3('base').K === undefined);
  app.changeType(3, 'branch');
  ok('I8 a branch has no loss model', j3('base').lossModel === undefined && j3('base').Cv === undefined);
  // the K of a sharp-edged orifice (unused, 10) does not reach a valve, nor the K of a valve an orifice
  fresh();
  app.model.scenarios.current = 'base';
  app.changeType(3, 'orifice');
  ok('I8 an orifice keeps its own K, 10', j3('base').K === 10, String(j3('base').K));
  app.changeType(3, 'valve');
  ok('I8 the orifice back to a valve: the default K of a valve, 0.2', j3('base').lossModel === 'K' && j3('base').K === 0.2, String(j3('base').K));

  // item 8: the boxes of the system window, ticked as the user does
  const box = (sid, what) => {
    app.model.scenarios.current = sid;
    const s = what === 'time' ? UI.timeSystem.section() : UI.surgeSystem.section();
    const find = (n) => { if (n.id === UI.forms.idOf('sol', what + '.on')) return n; for (const c of n.children || []) { const r = find(c); if (r) return r; } return null; };
    return find(s);
  };
  const tick = (sid, what, on) => { const b = box(sid, what); b.checked = on; b.fire('change'); };
  const mode = (sid) => { const e = M.effective(app.model, sid); return `${e.solution.time.on ? 'time' : ''}${P13.surge.inputs.isOn(e) ? 'surge' : ''}` || 'steady'; };
  const both = (sid) => mode(sid) === 'timesurge';
  const second = () => { const s = M.addScenario(app.model, 'base', 'second'); return s.id; };
  fresh();
  const s2 = second();
  tick('s1', 'time', true);
  ok('I9 the child turns the time simulation on', mode('s1') === 'time' && mode('base') === 'steady');
  tick('base', 'surge', true);
  ok('I9 the base turns the water hammer on: the child keeps the time simulation', mode('s1') === 'time' && !both('s1') && mode('base') === 'surge', mode('s1'));
  ok('I9 a second child inherits the water hammer of the base', mode(s2) === 'surge');
  reopen(JSON.stringify(app.model));
  ok('I9 reopened: time in the child, water hammer in the base and in the second child', mode('s1') === 'time' && mode('base') === 'surge' && mode(s2) === 'surge');
  app.model.scenarios.current = 's1';
  ok('I9 both switches marked as the choice of the child', app.isOv('sol', 'time.on') && app.isOv('sol', 'surge.on'));
  app.clearOv('sol', 'time.on');
  ok('I9 restored: the child does the water hammer of the base, both switches unmarked', mode('s1') === 'surge' && !app.isOv('sol', 'time.on') && !app.isOv('sol', 'surge.on'));
  app.undo();
  ok('I9 undo of the restore: the time simulation again', mode('s1') === 'time');
  // the other order: the child chooses the water hammer, the base the time simulation
  fresh();
  const s3 = second();
  tick('s1', 'surge', true);
  tick('base', 'time', true);
  ok('I9 the other order: water hammer in the child, time in the base and in the second child', mode('s1') === 'surge' && mode('base') === 'time' && mode(s3) === 'time' && !both('s1'), mode('s1'));
  // the base turns the water hammer on over its time simulation: the base switches in one edit, the child keeps its own
  tick('base', 'surge', true);
  ok('I9 the base switches to the water hammer, its time simulation off', mode('base') === 'surge' && mode('s1') === 'surge' && mode(s3) === 'surge');
  ok('I9 a file of before with both on in one scenario still tells it', (() => { const m = M.clone(app.model); m.scenarios.list.find((s) => s.id === 's1').overrides['sol|time.on'] = true; return P13.surge.inputs.checkControl(M.effective(m, 's1')).includes('control.time'); })());
}

// ------------------------------------------------------------ the basis of a table of the water hammer
// Review of 6c4f0fa, item 9: the level of J1 of the example of pumping between tanks, 3 and 2.7 m, goes to 100 and 90 %
// and back with its numbers; a speed table of a pump at 90 % takes that 90 % as its 100 %; without a steady value the
// data stay, with the message.
console.log('\nThe basis of a table of the water hammer converts its values');
{
  const c14 = loadContext(['src/ui/namespace.js', 'src/ui/common/format.js', 'src/ui/common/dom.js', 'src/ui/common/num-cell.js', 'src/ui/time/point-table.js']);
  const P14 = c14.PumpIt, UI = P14.ui, M = P14.model;
  const sections = [];
  let toasts = [];
  UI.dialogs = { toast() {}, modal() {} };
  UI.canvas = { dropDraft() {} };
  UI.scene3d = { carryView() {} };
  UI.inspector = { addSection: (kind, fn) => sections.push(fn) };
  UI.junctionTypes = { get: () => ({}) };
  const run = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), c14, { filename: f });
  run('src/ui/app/state.js');
  const app = P14.app;
  run('src/ui/app/editing.js');
  run('src/ui/inspector/forms.js');
  run('src/ui/time/data-section.js');
  run('src/ui/surge/junction-section.js');
  const surgeSection = sections[sections.length - 1];
  Object.assign(app, { changed: () => { app.version++; }, pruneSelection() {}, renderAll() {}, save() {}, recalc() {}, okResults: () => null, surgeOn: () => true, toast: (m) => toasts.push(m) });
  app.eff = () => M.effective(app.model, app.model.scenarios.current);
  app.effObj = (k) => M.getObj(app.eff(), k);
  P14.i18n.setLanguage('pt-BR');
  const find = (n, id) => { if (n.id === id) return n; for (const c of n.children || []) { const r = find(c, id); if (r) return r; } return null; };
  const choose = (jid, v) => { const host = new Node('div'); surgeSection(host, jid); const s = find(host, `sd-${jid}-basis`); s.value = v; s.fire('change'); };
  const data = (jid) => M.getObj(app.model, 'j:' + jid).surge;
  app.model = P14.examples.get('pump').build(); app.model.scenarios.current = 'base'; app.undoStack = []; app.redoStack = [];
  app.model.solution.surge = Object.assign(P14.surge.inputs.newControl(), { on: true, duration: { value: 1, unit: 's' } });
  M.getObj(app.model, 'j:1').surge = { use: true, what: 'level', basis: 'absolute', start: 'time', when: [], tables: [{ t: [0, 1], v: [3, 2.7], tUnit: 's', vUnit: 'm' }], repeat: false, interp: 'linear' };
  const shown = (jid) => data(jid).tables.map((tb) => tb.v.join(' ') + ' ' + tb.vUnit).join(' | ');
  choose(1, 'relative');
  ok('S1 3 and 2.7 m become 100 and 90 %', data(1).basis === 'relative' && shown(1) === '100 90 %', shown(1));
  const undoes = app.undoStack.length;
  choose(1, 'absolute');
  ok('S1 and back to 3 and 2.7 m, one undo step each', data(1).basis === 'absolute' && shown(1) === '3 2.7 m' && app.undoStack.length === undoes + 1, shown(1));
  // a pump at 90 %: its speed table of 90 and 72 % is 100 and 80 % of it
  const j2 = M.getObj(app.model, 'j:2');
  j2.speed = 90;
  j2.surge = { use: true, what: 'speed', basis: 'absolute', start: 'combined', when: [], tables: [{ t: [0, 1], v: [90, 72], tUnit: 's', vUnit: '%' }, { t: [0, 1], v: [72, 45], tUnit: 's', vUnit: '%' }], repeat: false, interp: 'linear' };
  const qs = P14.surge.inputs.quantities(j2).map((q) => q.what);
  if (qs.includes('speed')) {
    choose(2, 'relative');
    ok('S1 a speed of reference 90 %: every table follows, 100 and 80 %, 80 and 50 %', shown(2) === '100 80 % | 80 50 %', shown(2));
    choose(2, 'absolute');
    ok('S1 and back to 90 and 72 %, 72 and 45 %', shown(2) === '90 72 % | 72 45 %', shown(2));
  } else ok('S1 a pump has a speed table in the water hammer', false, qs.join(','));
  // without a steady value (no level), the data stay and the message tells why
  M.getObj(app.model, 'j:1').liquidElev = { value: 0, unit: 'm' };
  toasts = [];
  const before = JSON.stringify(data(1));
  choose(1, 'relative');
  ok('S1 a steady level of zero: the tables and the basis stay, with the message', JSON.stringify(data(1)) === before && toasts.length === 1 && /não podem acompanhar/.test(toasts[0]), toasts.join());
}

// Review of aca2807, cases 7 and 13: switching the reference of the connections of a reservoir keeps a blank cell at the
// bottom (and never brings back an old elevation), and a blank maximum pressure of a pipe stays no limit whatever unit
// is chosen for it, also in a file of before
console.log('\nReview of aca2807, cases 7 and 13: a blank connection and a blank pressure limit');
{
  const cx = loadContext(['src/ui/namespace.js', 'src/ui/common/format.js', 'src/ui/common/dom.js', 'src/ui/common/num-cell.js']);
  const PX = cx.PumpIt, UI = PX.ui, M = PX.model;
  UI.dialogs = { toast() {}, modal() {} };
  UI.canvas = { dropDraft() {} };
  UI.scene3d = { carryView() {} };
  const sections = {};
  UI.inspector = { addSection: (kind, fn) => { sections[kind] = fn; } };
  const run = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), cx, { filename: f });
  run('src/ui/app/state.js');
  const app = PX.app;
  run('src/ui/app/editing.js');
  run('src/ui/app/files.js');
  run('src/ui/inspector/forms.js');
  run('src/ui/inspector/pipe-losses-table.js');
  UI.junctionTypes = { get: (type) => ({ connectionElevation: type === 'reservoir' }) };
  Object.assign(app, { changed: () => { app.version++; }, pruneSelection() {}, renderAll() {}, save() {}, recalc() {}, okResults: () => null });
  app.eff = () => M.effective(app.model, app.model.scenarios.current);
  app.effObj = (key) => M.getObj(app.eff(), key);
  const reopen = () => app.loadModel(JSON.parse(JSON.stringify(app.model)), { fit: false });
  PX.i18n.setLanguage('pt-BR');
  const all = (n, out = []) => { out.push(n); for (const c of n.children || []) all(c, out); return out; };
  const table = () => UI.pipeLossesTable.build('j:1', M.getObj(app.eff(), 'j:1'));
  const typeIn = (field, text) => { const inp = all(table()).find((n) => n.id === 'pk-1-1-' + field); inp.value = text; inp.fire('change'); };
  const switchTo = (which) => all(table()).filter((n) => n.getAttribute && n.getAttribute('role') === 'radio')[which === 'depth' ? 1 : 0].fire('click');
  const pk = (sid = app.model.scenarios.current) => M.getObj(M.effective(app.model, sid), 'j:1').pipeK[1];
  const kPa = (sid = app.model.scenarios.current) => PX.solver.run(M.effective(app.model, sid)).pipes[1].Pin / 1000;
  const fresh = (sid = 'base') => { app.model = PX.examples.get('pump').build(); app.model.scenarios.current = sid; app.undoStack = []; app.redoStack = []; };

  fresh();
  typeIn('elev', '2');
  const at2 = kPa();
  switchTo('depth');
  ok('aca2807-7 an elevation of 2 m becomes a depth of 1 m', app.model.junctions[0].connBy === 'depth' && pk().depth && pk().depth.value === 1 && Math.abs(kPa() - at2) < 1e-9, JSON.stringify(pk()));
  typeIn('depth', '');
  const bottom = kPa();
  ok('aca2807-7 the depth erased: the bottom, about 128.63 kPa(a) at P1', Math.abs(bottom - 128.63) < 0.01, bottom.toFixed(3));
  switchTo('elevation');
  ok('aca2807-7 back to the elevation: still the bottom, the old 2 m gone', !(pk().elev && Number.isFinite(pk().elev.value)) && Math.abs(kPa() - bottom) < 1e-9, JSON.stringify(pk()) + ' ' + kPa().toFixed(3));
  app.undo();
  ok('aca2807-7 undo: the depth again, still blank', app.model.junctions[0].connBy === 'depth' && !(pk().depth && Number.isFinite(pk().depth.value)) && Math.abs(kPa() - bottom) < 1e-9, app.model.junctions[0].connBy + ' ' + JSON.stringify(pk()));
  switchTo('elevation'); switchTo('depth'); switchTo('elevation');
  reopen();
  ok('aca2807-7 twice more, saved and opened again: the bottom', !(pk().elev && Number.isFinite(pk().elev.value)) && !(pk().depth && Number.isFinite(pk().depth.value)) && Math.abs(kPa() - bottom) < 1e-9, JSON.stringify(pk()));
  // a filled value still converts, and a child that inherits the losses of the base writes only its connection fields
  fresh('s1');
  M.setField(app.model, 'base', 'j:1', 'pipeK.1.elev', M.q(2, 'm'));
  switchTo('depth');
  const own = () => Object.keys(app.model.scenarios.list.find((x) => x.id === 's1').overrides).filter((k) => k.startsWith('j:1|')).sort().join(',');
  ok('aca2807-7 a child: 2 m becomes a depth of 1 m, only connBy and the depth in the child', pk('s1').depth.value === 1 && own() === 'j:1|connBy,j:1|pipeK.1.depth' && pk('s1').kOut === 0.5, own());
  typeIn('depth', '');
  switchTo('elevation');
  ok('aca2807-7 ... erased and back: the bottom in the child, the base keeps its 2 m', !(pk('s1').elev && Number.isFinite(pk('s1').elev.value)) && pk('base').elev.value === 2 && pk('s1').kOut === 0.5, JSON.stringify(pk('s1')));

  // case 13: the field of the maximum pressure of P1
  // the hint of the unit fields lives in the page once
  cx.document = Object.assign({}, documentStub, { body: new Node('body'), getElementById: () => null });
  run('src/ui/surge/pipe-section.js');
  fresh();
  app.surgeOn = () => true;
  const field = () => { const host = new Node('div'); sections.pipe(host, 1); const ns = all(host); return { inp: ns.find((n) => n.id === UI.forms.idOf('p:1', 'surge.pMax')), us: ns.find((n) => n.id === UI.forms.idOf('p:1', 'surge.pMax') + '-u') }; };
  const pMax = () => app.model.pipes[0].surge && app.model.pipes[0].surge.pMax;
  let fx;
  try { fx = field(); } catch (e) { fx = null; console.log('  (the section could not be drawn: ' + e.message + ')'); }
  ok('aca2807-13 the field of the maximum pressure is drawn', !!(fx && fx.inp && fx.us));
  if (fx && fx.inp) {
    fx.us.value = 'bar(g)'; fx.us.fire('change');
    ok('aca2807-13 only the unit of a blank limit changed: nothing written, no limit', pMax() === null || pMax() === undefined, JSON.stringify(pMax()));
    fx.inp.value = '10'; fx.inp.fire('change');
    ok('aca2807-13 a number then takes the unit chosen', pMax() && pMax().value === 10 && pMax().unit === 'bar(g)', JSON.stringify(pMax()));
    fx.inp.value = ''; fx.inp.fire('change');
    ok('aca2807-13 erased again: no limit', pMax() === null, JSON.stringify(pMax()));
  }
  const pending = (v) => { const m = PX.examples.get('pump').build(); m.pipes[0].surge = Object.assign({}, m.pipes[0].surge || {}, { pMax: v }); return PX.surge.inputs.checkPipe(M.effective(m, 'base'), M.effective(m, 'base').pipes[0]); };
  ok('aca2807-13 a file of before with {value: null, unit: "bar(g)"}: no limit, P1 complete', !pending({ value: null, unit: 'bar(g)' }).includes('pMax') && !pending(null).includes('pMax'));
  ok('aca2807-13 a limit that is not a pressure is still refused', pending({ value: 10, unit: 'm' }).includes('pMax'));
}

// Review of aca2807, case 11: over time, an exit valve of one node gives the stagnation pressure at its inlet, the static
// pressure outside and no stagnation pressure at its outlet, as in the table of the step; an in-line valve its two sides
console.log('\nReview of aca2807, case 11: the end pressures of a valve over time');
{
  const cy = loadContext(['src/ui/namespace.js', 'src/ui/common/format.js', 'src/ui/common/dom.js']);
  const PY = cy.PumpIt, UI = PY.ui, M = PY.model;
  UI.lineChart = { lineChart: () => '' };
  UI.timeFormat = { unitFor: () => 'h', clock: () => '00:00:00' };
  const app = PY.app || (PY.app = {});
  let m = null, run = null;
  Object.assign(app, { prefs: { colUnits: {} }, outUnit: (k, cat) => PY.units.list(cat)[0], eff: () => M.effective(m, 'base'), timeRun: () => run, cursorIndex: () => 0, currentResults: () => run.snapshotAt(0) });
  ['src/ui/results/catalog.js', 'src/ui/results/columns.js', 'src/ui/time/results.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), cy, { filename: f }));
  UI.junctionTypes = UI.junctionTypes || { get: () => null };
  const sim = (id, set) => {
    m = PY.examples.get(id).build();
    if (set) set(m);
    m.solution.time = Object.assign(M.newTimeControl(), { on: true, start: M.q(0, 'h'), stop: M.q(1, 'h'), step: M.q(10, 'min') });
    run = PY.time.run(M.effective(m, 'base'));
  };
  sim('exit', (x) => Object.assign(x.junctions.find((j) => j.id === 3), { lossModel: 'K', K: 15 }));
  const patm = PY.units.toSI(m.system.patm.value, m.system.patm.unit, 'pressure');
  const kgf = (P) => (P - patm) / 98066.5;
  const r = UI.timeResults.rowAt(run, 'valves', 3, 0), st = run.snapshotAt(0);
  const step = UI.resultCatalog.rows('valves', st, M.effective(m, 'base'), { dn: () => '', series: () => '', boundary: () => NaN }).find((x) => x.id === 3);
  ok('aca2807-11 the exit valve: P0 inlet 1.7589, P static outlet 1.5 and no P0 outlet, in kgf/cm²(g)', Math.abs(kgf(r.P0in) - 1.7589) < 1e-4 && Math.abs(kgf(r.Pout) - 1.5) < 1e-9 && !Number.isFinite(r.P0out),
    kgf(r.P0in).toFixed(4) + ' ' + kgf(r.Pout).toFixed(4) + ' ' + r.P0out);
  ok('aca2807-11 ... the same as the table of the step', step && step.P0in === r.P0in && step.Pout === r.Pout && !Number.isFinite(step.P0out));
  sim('pump');
  const v = UI.timeResults.rowAt(run, 'valves', 3, 0), jr = run.snapshotAt(0).junctions[3];
  ok('aca2807-11 an in-line valve: its two stagnation pressures, from its junction', v.P0in === jr.P0in && v.P0out === jr.P0out && v.P0in > v.P0out, v.P0in + ' ' + v.P0out);
}

// The fixes of the UX script of d5fa5e9. Item 1: a model the browser refuses to keep (state.js) is known apart from the
// preferences, and the header hears of each change of that state once
console.log('\nUX script d5fa5e9, item 1: a model the browser does not keep');
{
  const cs = loadContext(['src/ui/namespace.js', 'src/ui/common/format.js', 'src/ui/common/dom.js']);
  const stored = new Map();
  let refuse = null; // the key whose write fails, as with no room left
  cs.localStorage = {
    getItem: (k) => (stored.has(k) ? stored.get(k) : null),
    setItem: (k, v) => { if (k === refuse) throw new Error('QuotaExceededError'); stored.set(k, String(v)); },
  };
  cs.PumpIt.ui.dialogs = { toast: () => {} };
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/ui/app/state.js'), 'utf8'), cs, { filename: 'src/ui/app/state.js' });
  const app = cs.PumpIt.app, calls = [];
  cs.PumpIt.ui.header = { renderSave: (changed) => calls.push([app.saveFailed, changed]) };
  app.model = { title: 'Estudo A' };
  app.save();
  ok('ux-1 a model kept: no warning', !app.saveFailed && !calls.length && JSON.parse(stored.get('pumpit.model')).title === 'Estudo A');
  refuse = 'pumpit.model';
  app.model = { title: 'Estudo B' };
  app.save(); app.save();
  ok('ux-1 a write refused: the state says so, and the header hears it once', app.saveFailed && calls.length === 1 && calls[0][0] === true && calls[0][1] === true && JSON.parse(stored.get('pumpit.model')).title === 'Estudo A', JSON.stringify(calls));
  app.prefs.grid = false;
  app.savePrefs();
  ok('ux-1 ... the preferences are kept apart from it', app.saveFailed && JSON.parse(stored.get('pumpit.prefs')).grid === false && calls.length === 1);
  refuse = null;
  app.model = { title: 'Estudo C' };
  app.save();
  ok('ux-1 the next write that works takes the warning away, once', !app.saveFailed && calls.length === 2 && calls[1][0] === false && JSON.parse(stored.get('pumpit.model')).title === 'Estudo C', JSON.stringify(calls));
}

// Item 2: the report says what the comparison covered, and confirms only a complete one (import-report.js)
console.log('\nUX script d5fa5e9, item 2: what the import report compared');
{
  const cr = loadContext(['src/ui/namespace.js', 'src/ui/common/format.js', 'src/ui/common/dom.js']);
  const PR = cr.PumpIt;
  let body = null;
  PR.ui.dialogs = { modal: (o) => { body = o.body; } };
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/ui/app/import-report.js'), 'utf8'), cr, { filename: 'src/ui/app/import-report.js' });
  PR.i18n.setLanguage('pt-BR');
  const IMP = PR.importers.imp;
  const texts = (n) => [n.textContent, ...n.children.flatMap(texts)].filter(Boolean);
  const report = (stored, res = { ok: true, converged: true, pipes: { 1: { m: 10, P0in: 3e5, P0out: 2e5 } } }) => {
    PR.ui.importReport.show('x.imp', { counts: { pipes: 1, junctions: 2, scenario: 'Base' }, notes: [], stored: new Map([[1, stored]]) }, res, IMP);
    return texts(body).join(' | ');
  };
  const all = report({ m: 10, P0in: 3e5, P0out: 2e5 });
  ok('ux-2 everything stored and equal: the steady state matches, 1 of 1 pipe and 2 of 2 ends', all.includes('O regime permanente confere') && all.includes('Vazão mássica, 1 de 1 tubos') && all.includes('Pressão de estagnação, 2 de 2 extremidades de tubo'), all);
  const flow = report({ m: 10, P0in: NaN, P0out: NaN });
  ok('ux-2 only the flow: a partial comparison, and no pressure compared', flow.includes('Comparação parcial') && flow.includes('Vazão mássica, 1 de 1 tubos') && flow.includes('nenhuma extremidade de tubo tem pressão gravada') && !flow.includes('confere'), flow);
  const press = report({ m: NaN, P0in: 3.5e5, P0out: 2.5e5 });
  ok('ux-2 only the pressures, 50 kPa off: compared and found, with the pipe', press.includes('Comparação parcial') && press.includes('nenhum tubo tem vazão gravada') && press.includes('Pressão de estagnação, 2 de 2 extremidades de tubo: maior diferença 50') && press.includes('(P1)'), press);
  const none = report({ m: NaN, P0in: NaN, P0out: NaN });
  ok('ux-2 neither: no comparable data, and nothing else said of the comparison', none.includes('Sem dados comparáveis') && !none.includes('Vazão mássica') && !none.includes('confere'), none);
  const zero = report({ m: 0, P0in: 3e5, P0out: 2e5 });
  ok('ux-2 every stored flow zero: the difference in kg/s, not a percentage', zero.includes('10,0 kg/s, pois todas as vazões gravadas são zero') && !zero.includes('confere'), zero);
  const conv = report({ m: 10, P0in: 3e5, P0out: 2e5 }, { ok: true, converged: false, pipes: { 1: { m: 10, P0in: 3e5, P0out: 2e5 } } });
  ok('ux-2 a calculation that did not converge confirms nothing', conv.includes('O cálculo não convergiu') && !conv.includes('confere'), conv);
  PR.i18n.setLanguage('en');
}

// Item 6: values the labels show alike take one colour, and the legend says so (color-scales.js)
console.log('\nUX script d5fa5e9, item 6: one colour for values that read the same');
{
  const cc = loadContext(['src/ui/namespace.js', 'src/ui/common/format.js', 'src/ui/network/color-scales.js']);
  const PC = cc.PumpIt, CS = PC.ui.colorScales, F = PC.ui.format;
  PC.i18n.setLanguage('pt-BR');
  const fmtOv = (v, cat) => F.fmt(F.conv(v, cat, cat === 'volFlow' ? 'm³/h' : 'm/s', {}), 3);
  const resOf = (qs) => ({ regime: 'incompressible', pipes: Object.fromEntries(qs.map((q, i) => [i + 1, { Q: q / 3600, V: 1.2 }])) });
  const colours = (ov) => [...ov.vals.values()].map((v) => CS.pipeColor('Q', v, CS.rampT(ov, v)));
  const same = CS.scale(resOf([111.364, 111.364, 111.364]), 'Q', fmtOv);
  ok('ux-6 equal flows: one colour, the middle of the ramp', same.uniform === 'same' && new Set(colours(same)).size === 1 && colours(same)[0] === CS.rampColor(0.5));
  const near = CS.scale(resOf([578.834, 578.834, 578.831, 578.831]), 'Q', fmtOv);
  ok('ux-6 578.834 and 578.831 m³/h, both shown as 579: one colour, not red against blue', near.uniform === 'shown' && new Set(colours(near)).size === 1, colours(near).join(' '));
  const lg = { hidden: true, innerHTML: '' };
  CS.renderLegend(lg, near, 'Q', () => 'm³/h', fmtOv);
  ok('ux-6 ... the legend gives the value once, at the precision shown, without a ramp', lg.innerHTML.includes('Mesmo valor em todos os tubos, na precisão mostrada: 579') && !lg.innerHTML.includes('class="ramp"'), lg.innerHTML);
  CS.renderLegend(lg, same, 'Q', () => 'm³/h', fmtOv);
  ok('ux-6 ... and equal values as such', lg.innerHTML.includes('Mesmo valor em todos os tubos: 111'));
  const spread = CS.scale(resOf([13.56, 175, 100.32]), 'Q', fmtOv);
  ok('ux-6 flows that read differently keep the ramp from end to end', !spread.uniform && CS.rampT(spread, 13.56 / 3600) === 0 && CS.rampT(spread, 175 / 3600) === 1);
  CS.renderLegend(lg, spread, 'Q', () => 'm³/h', fmtOv);
  ok('ux-6 ... with the ramp in the legend', lg.innerHTML.includes('class="ramp"') && lg.innerHTML.includes('13,6') && lg.innerHTML.includes('175'));
  const vel = CS.scale(resOf([100, 100]), 'V', fmtOv);
  ok('ux-6 the velocity of a liquid keeps its fixed scale', vel && !vel.uniform);
  documentStub.getElementById = () => null; // no selector of the overlay on this page
  CS.addOverlay('xr', { cat: 'volFlow', label: 'network.overlay.Q', offered: () => true, values: () => ({ vals: new Map([[1, 0.03], [2, 0.03]]), min: 0, max: 0.1 }), title: () => 'x' });
  delete documentStub.getElementById;
  const given = CS.scale(resOf([1]), 'xr', fmtOv);
  ok('ux-6 a range a module gives stays its own', given.given && !given.uniform && CS.rampT(given, 0.03) === 0.3);
  PC.i18n.setLanguage('en');
}

// Item 7: a key a control has used is no shortcut (keyboard.js), so Home on the tabs of the properties panel does not
// fit the drawing and an arrow does not turn the 3D view
console.log('\nUX script d5fa5e9, item 7: keys that a control used');
{
  const listeners = {};
  documentStub.addEventListener = (type, fn) => { listeners[type] = fn; };
  const ck = loadContext(['src/ui/namespace.js', 'src/ui/common/format.js', 'src/ui/common/dom.js']);
  const UI = ck.PumpIt.ui;
  let fits = 0, turns = 0, in3d = false;
  UI.dialogs = { isModalOpen: () => false, closeModal: () => {} };
  UI.help = { open: () => {}, isOpen: () => false, close: () => {} };
  UI.systemWindow = { isOpen: () => false, close: () => {} };
  UI.columnWindow = { isOpen: () => false, close: () => {} };
  UI.canvas = { fit: () => fits++, zoomBy: () => {}, cancel: () => {}, setTool: () => {} };
  UI.scene3d = { active: () => in3d, setMode: () => {} };
  UI.nav3d = { key: () => { turns++; return true; } };
  UI.fullScreen = { toggle: () => {} };
  ck.PumpIt.app = { view: 'net', hideMenus: () => {} };
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/ui/app/keyboard.js'), 'utf8'), ck, { filename: 'src/ui/app/keyboard.js' });
  UI.keyboard.bind();
  delete documentStub.addEventListener;
  const press = (key, used) => listeners.keydown({ key, target: { closest: () => null }, defaultPrevented: used, preventDefault() {} });
  press('Home', true);
  ok('ux-7 Home used by a tab bar does not fit the drawing', fits === 0);
  press('Home', false);
  ok('ux-7 ... Home on the drawing still does', fits === 1);
  in3d = true;
  press('ArrowRight', true);
  ok('ux-7 an arrow used by a tab bar does not turn the 3D view', turns === 0);
  press('ArrowRight', false);
  ok('ux-7 ... an arrow on the 3D view still does', turns === 1);
}

// Item 3: in a narrow window the tools of a closed group show too: the rule that shows them weighs as much as the one
// that hides them and comes after it
console.log('\nUX script d5fa5e9, item 3: the tools of a closed group in a narrow window');
{
  const css = (f) => fs.readFileSync(path.join(ROOT, 'src/ui/styles', f), 'utf8');
  const weight = (sel) => (sel.match(/[.:][a-z]/gi) || []).length - (sel.match(/:not\(/g) || []).length;
  const hide = /([^\n{}]*\.palette-items\.shut[^{}]*)\{\s*display:\s*none;\s*\}/.exec(css('network.css'));
  const narrow = css('responsive.css').split('@media (max-width: 860px)')[1] || '';
  const show = /([^\n{}]*\.palette-items\.shut[^{}]*)\{\s*display:\s*flex;\s*\}/.exec(narrow);
  const order = (f) => fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').indexOf('styles/' + f);
  ok('ux-3 the narrow rule weighs as much as the rule that hides the tools, and its sheet comes later', hide && show && weight(show[1]) >= weight(hide[1]) && order('responsive.css') > order('network.css'),
    `${hide && hide[1].trim()} (${hide && weight(hide[1])}) · ${show && show[1].trim()} (${show && weight(show[1])})`);
}

// Review of 6043c80, bugs 2 and 4: a fitting coefficient below zero, or not a number, is refused where it is typed and
// marked where it is loaded; an unknown friction model in a file opens with the pipe pending and its field named
console.log('\nReview of 6043c80: the cells of the fittings and a friction model of a file');
{
  const cr6 = loadContext(['src/ui/namespace.js', 'src/ui/common/format.js', 'src/ui/common/dom.js', 'src/ui/common/num-cell.js']);
  const P = cr6.PumpIt, UI = P.ui, M = P.model;
  P.i18n.setLanguage('pt-BR');
  UI.dialogs = { toast() {}, modal() {} };
  UI.canvas = { dropDraft() {} };
  UI.scene3d = { carryView() {} };
  UI.inspector = { addSection() {} };
  const run = (file) => vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), cr6, { filename: file });
  run('src/ui/app/state.js');
  const app = P.app;
  run('src/ui/app/editing.js');
  run('src/ui/app/files.js');
  run('src/ui/inspector/forms.js');
  run('src/ui/inspector/pending.js');
  Object.assign(app, { changed: () => { app.version++; }, pruneSelection() {}, renderAll() {}, save() {}, recalc() {}, okResults: () => null });
  // the editor of the fittings, with what it writes kept and its readouts readable
  const commits = [];
  app.setVal = (key, p, v) => commits.push(v);
  const forms = UI.forms;
  UI.forms = Object.assign({}, forms, { section: () => new Node('div'), readout: (label, v) => { const n = new Node('div'); n.textContent = label + ' ' + v; return n; } });
  run('src/ui/inspector/fittings-editor.js');
  const find = (n, id) => { if (n.id === id) return n; for (const c of n.children || []) { const r = find(c, id); if (r) return r; } return null; };
  const all = (n, out = []) => { out.push(n); for (const c of n.children || []) all(c, out); return out; };
  const pipeWith = (fittings) => { const m = P.examples.get('pump').build(); m.pipes[0].fittings = fittings; return M.getObj(M.effective(m, 'base'), 'p:1'); };
  for (const model of ['K', 'KfT']) {
    commits.length = 0;
    const box = UI.fittingsEditor.build('p:1', pipeWith([{ model, qty: 1, value: 1, id: 'custom' }]), { Dh: 0.15405 });
    const cell = find(box, 'fit-v-p:1-0');
    cell.value = '-10'; cell.fire('change');
    const err = find(box, 'fit-v-p:1-0-err');
    ok(`6043c80-2 −10 typed in the ${model} cell is refused: nothing written, the cell marked, the rule told`,
      commits.length === 0 && cell.getAttribute('aria-invalid') === 'true' && err && err.textContent.includes('“-10” não é aceito (um coeficiente de perda é zero ou mais)'), err && err.textContent);
    cell.value = '10'; cell.fire('change');
    ok(`6043c80-2 ... and 10 in the ${model} cell is written`, commits.length === 1 && commits[0][0].value === 10 && !cell.hasAttribute('aria-invalid'));
  }
  {
    // a model saved with −10 (and one with a text): the cell shows the value, marked, and the sum is not given
    const box = UI.fittingsEditor.build('p:1', pipeWith([{ model: 'K', qty: 1, value: -10 }, { model: 'KfT', qty: 1, value: 'abc' }]), { Dh: 0.15405 });
    const c0 = find(box, 'fit-v-p:1-0'), c1 = find(box, 'fit-v-p:1-1'), e0 = find(box, 'fit-v-p:1-0-err'), e1 = find(box, 'fit-v-p:1-1-err');
    const sum = all(box).find((n) => String(n.textContent).startsWith('ΣK'));
    ok('6043c80-2 a loaded −10 shows as it is, marked, with its message', c0.value === '-10' && c0.getAttribute('aria-invalid') === 'true' && e0 && e0.textContent.startsWith('Linha 1 · K: o valor do modelo, -10, não é aceito (um coeficiente de perda é zero ou mais)'), e0 && e0.textContent);
    ok('6043c80-2 a loaded text shows as it is, marked as not a number', c1.value === 'abc' && c1.getAttribute('aria-invalid') === 'true' && e1 && e1.textContent.includes('não é um número'), e1 && e1.textContent);
    ok('6043c80-2 ... and ΣK is not given', sum && sum.textContent.endsWith('—'), sum && sum.textContent);
    c0.fire('keydown', { key: 'Escape' });
    ok('6043c80-2 Esc keeps the loaded value marked', c0.getAttribute('aria-invalid') === 'true');
    // a fitting saved without a quantity counts one, as the core reads it: its cell is not marked
    const b2 = UI.fittingsEditor.build('p:1', pipeWith([{ model: 'K', value: 2, id: 'custom' }]), { Dh: 0.15405 });
    ok('6043c80-2 a fitting saved without a quantity is not marked (it counts one)', !find(b2, 'fit-q-p:1-0').hasAttribute('aria-invalid') && !find(b2, 'fit-v-p:1-0').hasAttribute('aria-invalid'));
  }
  {
    // the calibrated tee of the .fth importer (F-23) keeps its negative K, and takes a negative one typed
    commits.length = 0;
    const box = UI.fittingsEditor.build('p:1', pipeWith([{ model: 'K', qty: 1, value: 2, id: 'imported' }, { model: 'K', qty: 1, value: -1.5, id: 'imported-tee' }]), { Dh: 0.15405 });
    const c1 = find(box, 'fit-v-p:1-1');
    const marked = c1.hasAttribute('aria-invalid');
    c1.value = '-1'; c1.fire('change');
    ok('6043c80-2 a calibrated tee keeps −1.5 unmarked and takes −1', !marked && commits.length === 1 && commits[0][1].value === -1);
  }
  UI.forms = forms;
  // a JSON file with an unknown friction model, and one whose fitting is −10, opened in the editor
  const text = (set) => { const m = P.examples.get('pump').build(); set(m); return JSON.stringify(m); };
  app.loadModel(JSON.parse(text((m) => { m.pipes[1].friction.model = 'typo'; })), { fit: false });
  const v = app.validation(), items = UI.pending.of('p:2');
  ok('6043c80-4 a file with the friction model "typo" opens with P2 pending and the model kept', app.model.pipes[1].friction.model === 'typo' && !v.ok && v.undef.size === 1 && v.undef.has('p:2'),
    [...v.undef].map(([k, x]) => k + ': ' + x.join('; ')).join(' | '));
  ok('6043c80-4 ... its message names the model and points to the friction field', items.length === 1 && items[0].text.includes('"typo"') && items[0].path === 'friction.model', JSON.stringify(items));
  app.loadModel(JSON.parse(text((m) => { delete m.pipes[0].friction; })), { fit: false });
  const nf = UI.pending.of('p:1');
  ok('6043c80-4 a file without the friction of P1 opens (it was refused as not a model) with P1 pending at its friction field', !app.validation().ok && nf.length === 1 && nf[0].path === 'friction.model', JSON.stringify(nf));
  app.loadModel(JSON.parse(text((m) => { m.pipes[0].fittings = [{ model: 'K', qty: 1, value: 0.5 }, { model: 'K', qty: 1, value: -10 }]; })), { fit: false });
  const nk = UI.pending.of('p:1');
  ok('6043c80-2 a file with −10 in fitting 2 opens with P1 pending at the cell of that fitting', !app.validation().ok && nk.length === 1 && nk[0].path === '#fit-v-p:1-1', JSON.stringify(nk));
}

console.log(`\n${pass} checks passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
