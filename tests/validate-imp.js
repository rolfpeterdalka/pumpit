// Validation of the .imp importer on the user's own model files (section 19.3 of the description of the .imp format).
// Usage: node tests/validate-imp.js <folder> [<folder> ...]
//
// The files are the user's own models: they are read on the user's computer, only as test data, and are never copied
// into the project; this script writes nothing. For each .imp file of the folders and their subfolders, every scenario
// with a network is imported (src/core/import/imp.js); every pipe must connect junctions of the model and every number of
// the model must be finite; and the steady state of each scenario with stored results is calculated and compared with
// them by the measure of the import report: the mass flow of each pipe relative to the largest stored flow, and the
// stagnation pressure at the pipe ends relative to the largest stored pressure drop in a pipe.
const fs = require('fs');
const path = require('path');
const { loadCore } = require('./load-core');

const PumpIt = loadCore();
const { model: M, solver: S } = PumpIt;
const IMP = PumpIt.importers.imp;
const MATCH = 1e-3; // within 0.1 %, as the import report says the results match

// the places of the numbers of a model that are not finite
function badNumbers(x, at = '', out = []) {
  if (typeof x === 'number') { if (!Number.isFinite(x)) out.push(at); }
  else if (Array.isArray(x)) x.forEach((v, i) => badNumbers(v, `${at}[${i}]`, out));
  else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) badNumbers(v, at ? `${at}.${k}` : k, out);
  return out;
}

// the scenarios of one file: [{ file, scenario, error } or { file, scenario, pipes, junctions, notes, dangling, bad,
// calcError } or the comparison { compared, flow, pressure }]
function validateFile(file) {
  const text = new TextDecoder('windows-1252').decode(fs.readFileSync(file));
  let list;
  try { list = IMP.scenarios(text); } catch (e) { return [{ file, scenario: '', error: e.message }]; }
  const rows = [];
  for (const s of list.filter((x) => x.network !== false)) {
    const row = { file, scenario: `#${s.n} ${s.path}` };
    rows.push(row);
    let res;
    try { res = IMP.read(text, { name: path.basename(file), scenario: s.n }); } catch (e) { row.error = e.message; continue; }
    const m = res.model, ids = new Set(m.junctions.map((j) => j.id));
    Object.assign(row, { pipes: m.pipes.length, junctions: m.junctions.length, notes: res.notes.length });
    row.dangling = m.pipes.filter((p) => !ids.has(p.up) || !ids.has(p.down)).map((p) => 'P' + p.id);
    row.bad = badNumbers(m);
    if (!res.stored) continue;
    const eff = M.effective(m, 'base');
    const v = M.validate(eff);
    if (!v.ok) { row.calcError = 'incomplete model: ' + JSON.stringify([...v.undef].slice(0, 2)); continue; }
    const r = S.run(eff);
    if (!r.ok) { row.calcError = (r.errors || [])[0] || 'not solved'; continue; }
    const c = IMP.compare(r, res.stored);
    Object.assign(row, { compared: c.n, flow: c.flow, pressure: c.pressure });
  }
  return rows;
}

module.exports = { validateFile, badNumbers, MATCH };
if (require.main !== module) return;
const dirs = process.argv.slice(2);
if (!dirs.length) { console.log('Usage: node tests/validate-imp.js <folder> [<folder> ...]'); process.exit(1); }
const files = [];
const walkDir = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walkDir(p); else if (/\.imp$/i.test(e.name)) files.push(p);
  }
};
dirs.forEach(walkDir);
const rows = files.sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).flatMap(validateFile);
const pct = (x) => (x * 100).toPrecision(2) + ' %';
for (const r of rows) {
  const name = `${path.basename(r.file)} ${r.scenario}`.padEnd(60);
  if (r.error) console.log(`ERR   ${name} ${r.error}`);
  else if (r.dangling.length || r.bad.length) console.log(`BAD   ${name} pipes without a junction: ${r.dangling.slice(0, 5).join(', ') || '—'}; numbers not finite: ${r.bad.slice(0, 5).join(', ') || '—'}`);
  else if (r.calcError) console.log(`CALC  ${name} ${r.calcError}`);
  else if (r.compared !== undefined) console.log(`${r.flow < MATCH && r.pressure < MATCH ? 'ok   ' : 'DIFF '} ${name} flow ${pct(r.flow)}, pressure ${pct(r.pressure)} (${r.compared} pipes)`);
  else console.log(`read  ${name} ${r.pipes} pipes, ${r.junctions} junctions, ${r.notes} notes, no stored results`);
}
const read = rows.filter((r) => !r.error), compared = rows.filter((r) => r.compared !== undefined);
console.log(`\n${files.length} files, ${rows.length} scenarios with a network`);
console.log(`Imported without error: ${read.length}; with pipes without a junction or numbers not finite: ${read.filter((r) => r.dangling.length || r.bad.length).length}`);
console.log(`With stored results: ${read.filter((r) => r.compared !== undefined || r.calcError).length}; calculated and compared: ${compared.length}; within 0.1 %: ${compared.filter((r) => r.flow < MATCH && r.pressure < MATCH).length}`);
