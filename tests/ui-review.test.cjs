// Regression tests of the interface review (the fixes of a review of the app): a cell of a table that refuses a text
// that is not a number and keeps the value before (num-cell.js), and a paste from a spreadsheet that checks every line
// before the table changes (point-table.js), and another model that becomes one step of the history only once it is
// accepted, dropping the pipe being drawn (files.js, editing.js), and the legend and the table of values of a chart
// (line-chart.js), the time of the cursor in an export to Excel (export.js), the differences of a scenario
// (scenarios.js, forms.js) and the water hammer of a scenario the user comes back to (scenarios.js, surge/run.js,
// calculation.js). The interface files run on a small stand-in of the DOM: only what these modules use of it.
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
  ok('J2 at 0 h: 0 s and step 0, as numbers', val('Instante do cursor de tempo') === 0 && val('Passo gravado do cursor de tempo (a partir de 0)') === 0 && val('Análise') === 'Simulação no tempo');
  ok('J2 the series stay, before the Context sheet', book.sheets.length === 2 && book.sheets[0].name === 'Séries');
  cur = 6;
  app.exportResultsXlsx();
  ok('J2 at 1 h: another name', file === 'Bombeamento entre tanques - Base - resultados - t 3600 s.xlsx' && file !== f0, file);
  ok('J2 at 1 h: 3600 s, its clock and step 6', val('Instante do cursor de tempo') === 3600 && val('Instante do cursor de tempo (relógio)') === '01:00:00' && val('Passo gravado do cursor de tempo (a partir de 0)') === 6);
  ok('J2 the unit of the time is the second', ctxRows().rows.find((r) => r[0] === 'Instante do cursor de tempo')[2] === 's');
  ok('J3 a time with decimals in a file name', E.timeSuffix(0.5) === 't 0.5 s' && E.timeSuffix(86400) === 't 86400 s' && E.timeSuffix(0.1 + 0.2) === 't 0.3 s');
  const cols = ctxRows().columns;
  ok('J3 the values are real numbers in the sheet (a number format on the value column)', cols[1].format !== 'text' && cols[0].format === 'text');

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

console.log(`\n${pass} checks passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
