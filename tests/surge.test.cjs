// Tests of the water hammer (docs/water-hammer.md): the cases of section 12 of its specification, with the values its
// specification team calculated with a program of its own. Usage: node tests/surge.test.cjs
const { loadCore } = require('./load-core');

const PumpIt = loadCore('en');
const { model: M, surge: SG } = PumpIt;
const q = M.q;

let pass = 0, fail = 0;
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log('  ok   ' + name + (detail ? '  ' + detail : '')); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  ' + detail : '')); }
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const kPa = (x) => x / 1e3;
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : String(x));

// ---------- the models of the cases (§12): ρ = 998.2 kg/m³, Pv = 2.34 kPa(a), Patm = 101.325 kPa, g0, horizontal pipes,
// given wave speeds and a given Δt (no variance), a fixed friction factor, no losses at the ends, absolute pressures
function base() {
  const m = M.newModel();
  m.system.fluid = { kind: 'user', name: 'test liquid', rho: q(998.2, 'kg/m³'), mu: q(1, 'mPa·s'), pv: q(2.34, 'kPa(a)') };
  m.system.patm = q(101.325, 'kPa(a)');
  m.solution.surge = Object.assign(SG.inputs.newControl(), { on: true });
  return m;
}
const J = (m, type, id, props) => { const j = Object.assign(M.newJunction(type, id, 0, 0), props); m.junctions.push(j); return j; };
function pipe(m, id, up, down, L, D, f, a) {
  const p = M.newPipe(id, up, down);
  p.length = q(L, 'm');
  p.geometry.d = q(D, 'm');
  p.material = { kind: 'user' };
  p.friction = f ? { model: 'explicitF', f } : { model: 'frictionless' };
  p.surge = { wave: 'given', a: q(a, 'm/s') };
  m.pipes.push(p);
  return p;
}
const control = (m, dt, dur, more = {}) => Object.assign(m.solution.surge, { dtMode: 'given', dt: q(dt, 's'), duration: q(dur, 's') }, more);
const area = (D) => Math.PI * D * D / 4;
// an instantaneous closure: an imposed flow whose relative step table is 100 % at 0 s and 0 % from 0.001 s
const closure = () => ({ use: true, what: 'Q', basis: 'relative', start: 'time', when: [], tables: [{ t: [0, 0.001], v: [100, 0], tUnit: 's', vUnit: '%' }], repeat: false, interp: 'step' });

function simulate(m, sid = 'base', opts) {
  const eff = M.effective(m, sid);
  const v = M.validate(eff);
  if (!v.ok) throw new Error('Incomplete model: ' + JSON.stringify([...v.undef]) + ' ' + JSON.stringify(v.items.filter((i) => !i.ok)));
  const r = SG.run(eff, opts);
  if (!r.ok) throw new Error('Failed: ' + r.errors.join('; '));
  return r;
}
const idx = (r, t) => { const i = [...r.times].findIndex((x) => Math.abs(x - t) < 1e-9); if (i < 0) throw new Error('time not recorded: ' + t); return i; };
// the stagnation pressure of a station of a pipe at a time (the station among the recorded ones)
function Pat(r, pid, station, t) {
  const p = r.pipes[pid], s = p.stations.indexOf(station);
  if (s < 0) throw new Error('station not recorded: ' + station);
  return p.series.P[s][idx(r, t)];
}
const seriesOf = (r, pid, station, field) => { const p = r.pipes[pid]; return p.series[field][p.stations.indexOf(station)]; };

// ---------- T1: wave speed
console.log('\nT1  Wave speed');
{
  const W = SG.wavespeed;
  const K = 2.19e9, rho = 998.2, D = 0.3, e = 0.01, E = 207e9, nu = 0.3, G = 10e9;
  const exp = {
    thinUp: [0.85, 1314.46], thinAnchored: [0.91, 1304.72], thinJoints: [1, 1290.49], thickUp: [0.90925, 1304.84],
    thickAnchored: [0.96731, 1295.61], thickJoints: [1.05441, 1282.12], tunnelUnlined: [NaN, 1341.56], tunnelLined: [NaN, 1393.65], buried: [NaN, 1435.19],
  };
  check('√(K/ρ) of the fluid alone', near(Math.sqrt(K / rho), 1481.20, 0.01), Math.sqrt(K / rho).toFixed(2));
  for (const [s, [c1, a]] of Object.entries(exp)) {
    const x = W.speed({ support: s, K, rho, D, e, E, nu, G, buriedPct: 10 });
    const cc = W.c1Of(s, nu, D, e);
    check(`${s}: c1 and a`, near(x, a, 0.01) && (Number.isNaN(c1) || near(cc, c1, 5e-6)), `c1 = ${Number.isFinite(cc) ? cc.toFixed(5) : '—'}, a = ${x.toFixed(2)} m/s`);
  }
  const ah = W.speed({ support: 'thickAnchored', K, rho, D: 0.2, e: 0.0182, E: 0.9e9, nu: 0.45 });
  const at = W.speed({ support: 'thinAnchored', K, rho, D: 0.2, e: 0.0182, E: 0.9e9, nu: 0.45 });
  check('HDPE: thick wall anchored c1 0.99488, a 281.93 m/s; thin 313.48 m/s', near(W.c1Of('thickAnchored', 0.45, 0.2, 0.0182), 0.99488, 5e-6) && near(ah, 281.93, 0.01) && near(at, 313.48, 0.01), `${ah.toFixed(2)} / ${at.toFixed(2)}`);
  const c = PumpIt.fluids.waterSoundSpeed(20);
  check('water at 20 °C (Marczak): c = 1482.380 m/s, K = 2.1935 GPa with ρ = 998.2', near(c, 1482.380, 0.001) && near(998.2 * c * c / 1e9, 2.1935, 5e-5), `${c.toFixed(3)} m/s`);
  // a pipe of the model: the catalogue of its material and its wall
  const m = base();
  const p = M.newPipe(1, 1, 2);
  p.material = { kind: 'steel', nps: '10', sch: '40' };
  p.geometry.d = q(10.020, 'in');
  const wv = W.pipeSpeed(p, 2.19e9, 998.2);
  const e10 = 0.365 * 0.0254, D10 = 10.020 * 0.0254;
  const exp10 = Math.sqrt((2.19e9 / 998.2) / (1 + 0.91 * 2.19e9 * D10 / (207e9 * e10)));
  check('a catalogue pipe takes E, ν of its material and its wall', near(wv.a, exp10, 1e-9), `${wv.a.toFixed(2)} m/s`);
  void m;
}

// ---------- T2: sectioning
console.log('\nT2  Sectioning');
{
  const pipes = [{ id: 1, L: 500, a: 1250 }, { id: 2, L: 73, a: 1180 }, { id: 3, L: 312, a: 1050 }, { id: 4, L: 1440, a: 1310 }];
  const r10 = SG.sectioning.section(pipes, { mode: 'auto', limit: 0.10, ncMin: 1, ncMax: 20 });
  check('controller pipe 2, T = 0.0618644 s', r10.controller === 2 && near(r10.pipes[1].T, 0.0618644, 1e-7));
  check('10 %: N_c 1.00, Δt 0.06186441 s, n 6 1 5 18', near(r10.nc, 1, 1e-12) && near(r10.dt, 0.06186441, 1e-8) && r10.pipes.map((p) => p.n).join() === '6,1,5,18');
  check("10 %: a' 1347.03 1180.00 1008.66 1293.15 m/s", [1347.03, 1180, 1008.66, 1293.15].every((a, i) => near(r10.pipes[i].aAdj, a, 0.005)));
  check('10 %: variances +7.763 0 −3.937 −1.286 %', [7.763, 0, -3.937, -1.286].every((v, i) => near(100 * r10.pipes[i].variance, v, 0.0005)));
  const r5 = SG.sectioning.section(pipes, { mode: 'auto', limit: 0.05, ncMin: 1, ncMax: 20 });
  check('5 %: N_c 1.05, Δt 0.05891848 s, n 7 1 5 19, largest variance 5.000 % (the 1e-9 tolerance)', near(r5.nc, 1.05, 1e-12) && near(r5.dt, 0.05891848, 1e-8) && r5.pipes.map((p) => p.n).join() === '7,1,5,19' && near(100 * r5.worst, 5, 1e-6) && r5.ok);
  const r1 = SG.sectioning.section(pipes, { mode: 'auto', limit: 0.01, ncMin: 1, ncMax: 20 });
  check('1 %: N_c 4.95, Δt 0.01249786 s, n 32 5 24 88, largest variance 1.000 %', near(r1.nc, 4.95, 1e-12) && near(r1.dt, 0.01249786, 1e-8) && r1.pipes.map((p) => p.n).join() === '32,5,24,88' && near(100 * r1.worst, 1, 5e-4));
  const rn = SG.sectioning.section(pipes, { mode: 'auto', limit: 1e-6, ncMin: 1, ncMax: 2 });
  check('no N_c meets the limit: the smallest largest variance, not ok', !rn.ok && rn.nc >= 1 && rn.nc <= 2);
}

// ---------- T3 and T4: instantaneous closure, without and with friction
function t3(f) {
  const m = base();
  J(m, 'reservoir', 1, { liquidElev: q(0, 'm'), surfP: q(2000, 'kPa(a)') });
  J(m, 'flow', 2, { Q: q(area(0.5), 'm³/s'), dir: 'out', surge: closure() });
  pipe(m, 1, 1, 2, 1200, 0.5, f, 1200);
  control(m, 0.1, 10);
  return m;
}
console.log('\nT3  Instantaneous closure without friction');
{
  const r = simulate(t3(0));
  check('ρ·a·V₀ = 1197.840 kPa; steady flow 195.996 kg/s', near(r.steady.pipes[1].m, 195.996, 5e-4), r.steady.pipes[1].m.toFixed(3));
  const valve = (t) => kPa(Pat(r, 1, 10, t));
  const rng = (a, b) => { const out = []; for (let k = Math.round(a * 10); k <= Math.round(b * 10); k++) out.push(k / 10); return out; };
  check('valve 3197.840 kPa from 0.1 to 2.0 s', rng(0.1, 2.0).every((t) => near(valve(t), 3197.840, 0.001)));
  check('valve 802.160 kPa from 2.1 to 4.0 s', rng(2.1, 4.0).every((t) => near(valve(t), 802.160, 0.001)));
  check('valve 3197.840 kPa from 4.1 to 6.0 s (period 4 s)', rng(4.1, 6.0).every((t) => near(valve(t), 3197.840, 0.001)));
  // the middle (station 5) is not an output station by default: the extremes and a run with every station
  const m = t3(0);
  m.pipes[0].surge.stations = 'all';
  const ra = simulate(m);
  const mid = (t) => kPa(Pat(ra, 1, 5, t));
  check('middle: 2000.000 kPa up to 0.5 s, 3197.840 from 0.6 to 1.5 s', rng(0, 0.5).every((t) => near(mid(t), 2000, 0.001)) && rng(0.6, 1.5).every((t) => near(mid(t), 3197.840, 0.001)));
  check('middle: 2000.000 from 1.6 to 2.5 s, 802.160 from 2.6 to 3.5 s, 2000.000 from 3.6 to 4.5 s', rng(1.6, 2.5).every((t) => near(mid(t), 2000, 0.001)) && rng(2.6, 3.5).every((t) => near(mid(t), 802.160, 0.001)) && rng(3.6, 4.5).every((t) => near(mid(t), 2000, 0.001)));
  const out = seriesOf(r, 1, 0, 'mD');
  const flow = (t) => out[idx(r, t)];
  check('flow out of the reservoir: +195.996 up to 1.0 s, −195.996 from 1.1 to 3.0 s, +195.996 from 3.1 to 5.0 s', rng(0, 1).every((t) => near(flow(t), 195.996, 5e-4)) && rng(1.1, 3).every((t) => near(flow(t), -195.996, 5e-4)) && rng(3.1, 5).every((t) => near(flow(t), 195.996, 5e-4)));
  check('the test step gives the steady state back', r.artificial.ok && r.artificial.worstP < 1e-12, `largest change ${r.artificial.worstP.toExponential(2)}`);
}

console.log('\nT4  Instantaneous closure with friction');
let t4run;
{
  const r = simulate(t3(0.02));
  t4run = r;
  check('R of the pipe 0.623640 Pa/(kg/s)²', near(r.pipes[1].R, 0.623640, 5e-7), r.pipes[1].R.toFixed(6));
  const valve = (t) => kPa(Pat(r, 1, 10, t));
  check('steady state at the valve 1976.043 kPa', near(valve(0), 1976.043, 0.001), f3(valve(0)));
  const pts = { 0.1: 3176.279, 1.0: 3185.852, 1.9: 3197.818, 2.1: 844.540, 3.0: 834.973, 4.1: 3135.366, 9.9: 3118.617 };
  for (const [t, v] of Object.entries(pts)) check(`valve at ${t} s: ${v} kPa`, near(valve(+t), v, 0.001), f3(valve(+t)));
  const X = r.extremes.pipes[1];
  check('valve: maximum 3197.818 kPa (1.9 s), minimum 823.015 kPa (3.9 s)', near(kPa(X.Pmax[10]), 3197.818, 0.001) && near(X.tPmax[10], 1.9, 1e-9) && near(kPa(X.Pmin[10]), 823.015, 0.001), `${f3(kPa(X.Pmax[10]))} at ${X.tPmax[10]} s, ${f3(kPa(X.Pmin[10]))} at ${X.tPmin[10]} s`);
  const m = t3(0.02);
  m.pipes[0].surge.stations = [5];
  const r5 = simulate(m);
  check('middle at 1.0 s: 3187.049 kPa', near(kPa(Pat(r5, 1, 5, 1.0)), 3187.049, 0.001), f3(kPa(Pat(r5, 1, 5, 1.0))));
}

// ---------- T5: linear closure of an exit valve
function t5(start = 'time', when = [], close = 3, dur = 10) {
  const m = base();
  J(m, 'reservoir', 1, { liquidElev: q(0, 'm'), surfP: q(1000, 'kPa(a)') });
  J(m, 'exitvalve', 2, {
    Pout: q(101.325, 'kPa(a)'), lossModel: 'opening', char: 'linear', CvMax: 300, open: 100,
    surge: { use: true, what: 'open', basis: 'absolute', start, when, tables: [{ t: [0, close], v: [100, 0], tUnit: 's', vUnit: '%' }], repeat: false, interp: 'linear' },
  });
  pipe(m, 1, 1, 2, 600, 0.3, 0.018, 1200);
  control(m, 0.05, dur);
  return m;
}
console.log('\nT5  Linear closure of an exit valve');
let t5run;
{
  const r = simulate(t5());
  t5run = r;
  const s = r.steady;
  check('steady: 198.058 kg/s (2.8070 m/s), 858.429 kPa at the valve, 757.104 kPa across it', near(s.pipes[1].m, 198.058, 5e-4) && near(s.pipes[1].V, 2.8070, 5e-5) && near(kPa(s.pipes[1].P0out), 858.429, 0.001) && near(kPa(s.junctions[2].dP), 757.104, 0.001), `${s.pipes[1].m.toFixed(3)} kg/s, ${f3(kPa(s.pipes[1].P0out))} kPa`);
  const valve = (t) => kPa(Pat(r, 1, 10, t));
  const pts = { 1: 1354.241, 2: 1737.209, 2.5: 1848.228, 3: 1885.578, 4: 120.878, 5: 1872.756, 7: 1860.292 };
  for (const [t, v] of Object.entries(pts)) check(`valve at ${t} s: ${v} kPa`, near(valve(+t), v, 0.001), f3(valve(+t)));
  const X = r.extremes.pipes[1];
  check('valve: maximum 1885.578 kPa at 3.00 s, minimum 120.878 kPa at 4.00 s', near(kPa(X.Pmax[10]), 1885.578, 0.001) && near(X.tPmax[10], 3, 1e-9) && near(kPa(X.Pmin[10]), 120.878, 0.001) && near(X.tPmin[10], 4, 1e-9), `${f3(kPa(X.Pmax[10]))} at ${X.tPmax[10]}, ${f3(kPa(X.Pmin[10]))} at ${X.tPmin[10]}`);
  check('middle: maximum 1448.503 kPa at 3.00 s, minimum 554.140 kPa', near(kPa(X.Pmax[5]), 1448.503, 0.001) && near(X.tPmax[5], 3, 1e-9) && near(kPa(X.Pmin[5]), 554.140, 0.001), `${f3(kPa(X.Pmax[5]))} at ${X.tPmax[5]}, ${f3(kPa(X.Pmin[5]))}`);
}

// ---------- T6: the wave transmitted at a tee
console.log('\nT6  Wave transmitted at a tee');
{
  const m = base();
  J(m, 'reservoir', 1, { liquidElev: q(0, 'm'), surfP: q(2000, 'kPa(a)') });
  J(m, 'branch', 2, { source: q(0, 'kg/s') });
  J(m, 'flow', 3, { Q: q(0, 'm³/s'), dir: 'out' });
  J(m, 'flow', 4, { Q: q(area(0.3) * 2, 'm³/s'), dir: 'out', surge: closure() });
  pipe(m, 1, 1, 2, 1200, 0.5, 0, 1200);
  pipe(m, 2, 2, 3, 1200, 0.4, 0, 1200);
  pipe(m, 3, 2, 4, 600, 0.3, 0, 1200);
  control(m, 0.1, 3);
  const r = simulate(m);
  check('steady flow in C 141.117 kg/s, B at rest', near(r.steady.pipes[3].m, 141.117, 5e-4) && Math.abs(r.steady.pipes[2].m) < 1e-9);
  const J2 = r.junctions[2].series.P, at = (t) => kPa(J2[idx(r, t)]);
  const rng = (a, b) => { const out = []; for (let k = Math.round(a * 10); k <= Math.round(b * 10); k++) out.push(k / 10); return out; };
  check('J: 2000.000 kPa up to 0.5 s', rng(0, 0.5).every((t) => near(at(t), 2000, 0.001)));
  check('J: 2862.445 kPa from 0.6 to 1.5 s (the transmitted wave)', rng(0.6, 1.5).every((t) => near(at(t), 2862.445, 0.001)), f3(at(1.0)));
  check('J: 2310.480 kPa at 1.6 s', near(at(1.6), 2310.480, 0.001), f3(at(1.6)));
  const end = (t) => kPa(Pat(r, 3, 5, t));
  check('closed end of C: 4395.680 kPa from 0.1 to 1.0 s, 1329.210 kPa at 1.4 s', rng(0.1, 1.0).every((t) => near(end(t), 4395.680, 0.001)) && near(end(1.4), 1329.210, 0.001), `${f3(end(0.5))}, ${f3(end(1.4))}`);
}

// ---------- T7: column separation (vapour cavities)
function t7(psi) {
  const m = base();
  J(m, 'reservoir', 1, { liquidElev: q(0, 'm'), surfP: q(300, 'kPa(a)') });
  J(m, 'flow', 2, { Q: q(area(0.1), 'm³/s'), dir: 'out', surge: closure() });
  pipe(m, 1, 1, 2, 100, 0.1, 0.02, 1000);
  control(m, 0.01, 1.2, { cavitation: 'dvcm', psi, cavBasis: 'stagnation' });
  return m;
}
console.log('\nT7  Column separation, vapour cavities');
{
  for (const [psi, exp] of [[0.5, { on: 0.21, off: 0.86, V: 1198.07, peak: 1671.460, tPeak: 1.05 }], [1, { on: 0.21, off: 0.85, V: 1201.09, peak: 1671.364, tPeak: 1.04 }]]) {
    const r = simulate(t7(psi));
    if (psi === 0.5) check('steady at the valve 290.018 kPa', near(kPa(r.steady.pipes[1].P0out), 290.018, 0.001), f3(kPa(r.steady.pipes[1].P0out)));
    const V = seriesOf(r, 1, 10, 'V'), P = seriesOf(r, 1, 10, 'P');
    const times = [...r.times];
    const on = times.find((t, i) => V[i] > 0);
    let off = NaN;
    for (let i = 1; i < times.length; i++) if (V[i - 1] > 0 && !(V[i] > 0)) { off = times[i]; break; }
    const X = r.extremes.pipes[1];
    // the peak after the first collapse
    let pk = -Infinity, tp = NaN;
    for (let i = 0; i < times.length; i++) if (times[i] > off && P[i] > pk) { pk = P[i]; tp = times[i]; }
    check(`ψ = ${psi}: the cavity at the valve appears at ${exp.on} s and collapses at ${exp.off} s`, near(on, exp.on, 1e-9) && near(off, exp.off, 1e-9), `${on} s, ${off} s`);
    check(`ψ = ${psi}: largest volume ${exp.V} cm³ (0.05 %)`, near(X.Vmax[10] * 1e6, exp.V, exp.V * 5e-4), `${(X.Vmax[10] * 1e6).toFixed(2)} cm³`);
    check(`ψ = ${psi}: peak after the collapse ${exp.peak} kPa at ${exp.tPeak} s (0.05 %)`, near(kPa(pk), exp.peak, exp.peak * 5e-4) && near(tp, exp.tPeak, 1e-9), `${f3(kPa(pk))} kPa at ${tp} s`);
    check(`ψ = ${psi}: minimum at the valve 2.340 kPa`, near(kPa(X.Pmin[10]), 2.340, 0.001), f3(kPa(X.Pmin[10])));
    if (psi === 0.5) check('cavities form at inner stations too', [...X.Vmax].slice(1, 10).some((v) => v > 0));
  }
}

// ---------- T8: pump trip by its inertia, without reverse flow
function t8() {
  const m = base();
  J(m, 'reservoir', 1, { liquidElev: q(0, 'm'), surfP: q(150, 'kPa(a)') });
  J(m, 'reservoir', 3, { liquidElev: q(0, 'm'), surfP: q(500, 'kPa(a)') });
  J(m, 'pump', 2, {
    mode: 'curve', speed: 100, nPumps: 1, state: 'on',
    curve: { x: [0, 0.1, 0.2], y: [70, 60, 30], xUnit: 'm³/s', yUnit: 'm', fit: '2' },
    eff: { x: [], y: [], xUnit: 'm³/s', fit: '2' },
    power: { x: [0, 0.1, 0.2], y: [50, 75, 100], xUnit: 'm³/s', yUnit: 'kW', fit: '2' },
    inertia: q(10, 'kg·m²'), rpm: q(1750, 'rpm'),
    surge: { use: true, what: 'trip', start: 'time', when: [], at: q(0, 's') },
  });
  pipe(m, 1, 1, 2, 10, 0.3, 0.015, 1000);
  pipe(m, 2, 2, 3, 500, 0.3, 0.015, 1000);
  control(m, 0.01, 20);
  return m;
}
console.log('\nT8  Pump trip by its inertia, without reverse flow');
let t8run;
{
  const r = simulate(t8());
  t8run = r;
  const pr = r.steady.pumps[2];
  check('steady: 164.550 kg/s (164.847 L/s), H 42.826 m', near(r.steady.pipes[2].m, 164.550, 5e-4) && near(pr.Q * 1e3, 164.847, 5e-4) && near(pr.dH, 42.826, 5e-4), `${r.steady.pipes[2].m.toFixed(3)} kg/s, ${pr.dH.toFixed(3)} m`);
  const sj = r.junctions[2].series;
  check('torque at the start 497.719 N·m', near(sj.T[0], 497.719, 5e-4), sj.T[0].toFixed(3));
  const rows = { 0.5: [87.862, 156.033, 441.544], 1: [78.046, 149.760, 348.206], 2: [63.688, 118.048, 294.064], 3: [54.175, 84.571, 284.357], 5: [43.462, 20.777, 278.969] };
  for (const [t, [s, Q, Pd]] of Object.entries(rows)) {
    const i = idx(r, +t);
    const pd = kPa(Pat(r, 2, 0, +t));
    check(`at ${t} s: speed ${s} %, flow ${Q} L/s, discharge ${Pd} kPa`, near(sj.s[i], s, s * 1e-5 + 5e-4) && near(sj.m[i] / 998.2 * 1e3, Q, 5e-4) && near(pd, Pd, 0.001), `${sj.s[i].toFixed(3)} %, ${(sj.m[i] / 998.2 * 1e3).toFixed(3)} L/s, ${f3(pd)} kPa`);
  }
  const times = [...r.times];
  const stop = times.find((t, i) => sj.m[i] === 0 && t > 0);
  check('the pump stops pumping at 5.63 s', near(stop, 5.63, 1e-9), `${stop} s`);
  const X = r.extremes.pipes[2], Xs = r.extremes.pipes[1];
  check('discharge: minimum 273.052 kPa at 5.62 s, maximum 724.811 kPa at 6.62 s', near(kPa(X.Pmin[0]), 273.052, 0.001) && near(X.tPmin[0], 5.62, 1e-9) && near(kPa(X.Pmax[0]), 724.811, 0.001) && near(X.tPmax[0], 6.62, 1e-9), `${f3(kPa(X.Pmin[0]))} at ${X.tPmin[0]}, ${f3(kPa(X.Pmax[0]))} at ${X.tPmax[0]}`);
  check('suction end: maximum 155.914 kPa', near(kPa(Xs.Pmax[1]), 155.914, 0.001), f3(kPa(Xs.Pmax[1])));
  check('the trip is in the log', r.log.some((e) => e.key === 'surge.log.pumpTrip' && e.t === 0));
}

// ---------- T9: surge tank, mass oscillation (phase G2)
const jSeries = (r, jid, f) => r.junctions[jid].series[f];
const jAt = (r, jid, f, t) => jSeries(r, jid, f)[idx(r, t)];
function t9() {
  const m = base();
  J(m, 'reservoir', 1, { liquidElev: q(50, 'm'), surfP: q(101.325, 'kPa(a)') });
  J(m, 'surgeTank', 2, { level: 'steady', shape: 'constant', area: q(50, 'm²'), bottom: q(0, 'm'), height: q(null, 'm') });
  J(m, 'flow', 3, { Q: q(area(3) * 2, 'm³/s'), dir: 'out', surge: closure() });
  pipe(m, 1, 1, 2, 3000, 3, 0.015, 1000);
  pipe(m, 2, 2, 3, 200, 2, 0.015, 1000);
  // the values of the case come without the cavitation model (decision W-48): with vapour cavities the column of the
  // penstock separates after the closure, and its collapses go above the first peak
  control(m, 0.1, 600, { cavitation: 'none' });
  return m;
}
console.log('\nT9  Surge tank, mass oscillation');
{
  const r = simulate(t9());
  check('steady flow in the tunnel 14 111.7 kg/s (2 m/s)', near(r.steady.pipes[1].m, 14111.7, 0.05), r.steady.pipes[1].m.toFixed(1));
  const lv = (t) => jAt(r, 2, 'level', t);
  check('steady level of the tank 46.941 m (a loss of 3.059 m in the tunnel)', near(lv(0), 46.941, 0.001), lv(0).toFixed(4));
  const X = r.extremes.junctions[2].level;
  check('level: maximum 61.219 m at 81.4 s', near(X.max, 61.219, 0.001) && near(X.tmax, 81.4, 1e-9), `${X.max.toFixed(4)} m at ${X.tmax} s`);
  check('level: minimum 41.139 m at 228.2 s', near(X.min, 41.139, 0.001) && near(X.tmin, 228.2, 1e-9), `${X.min.toFixed(4)} m at ${X.tmin} s`);
  for (const [t, v] of [[60, 60.060], [150, 51.565], [300, 49.365], [450, 50.001]]) check(`level at ${t} s: ${v} m`, near(lv(t), v, 0.001), lv(t).toFixed(4));
  const Xe = r.extremes.pipes[2];
  check('closed end: maximum 5052.723 kPa at 0.30 s', near(kPa(Xe.Pmax[2]), 5052.723, 0.001) && near(Xe.tPmax[2], 0.3, 1e-9), `${f3(kPa(Xe.Pmax[2]))} at ${Xe.tPmax[2]} s`);
  const g = 9.80665, A = area(3), As = 50, L = 3000;
  check('rigid column without friction, for comparison: amplitude 13.153 m, period 292.3 s', near(2 * Math.sqrt(L * A / (g * As)), 13.153, 0.001) && near(2 * Math.PI * Math.sqrt(L * As / (g * A)), 292.3, 0.05));
}

// ---------- T10: air vessel
function t10() {
  const m = base();
  J(m, 'reservoir', 1, { liquidElev: q(0, 'm'), surfP: q(500, 'kPa(a)') });
  J(m, 'airVessel', 2, { n: 1.2, gasInit: 'given', Vg0: q(2, 'm³'), shape: 'none', vol: q(null, 'm³') });
  J(m, 'exitvalve', 3, {
    Pout: q(101.325, 'kPa(a)'), lossModel: 'opening', char: 'linear', CvMax: 300, open: 100,
    surge: { use: true, what: 'open', basis: 'absolute', start: 'time', when: [], tables: [{ t: [0, 2], v: [100, 0], tUnit: 's', vUnit: '%' }], repeat: false, interp: 'linear' },
  });
  pipe(m, 1, 1, 2, 2000, 0.4, 0.02, 1000);
  pipe(m, 2, 2, 3, 200, 0.4, 0.02, 1000);
  control(m, 0.1, 60);
  return m;
}
console.log('\nT10 Air vessel');
{
  const r = simulate(t10());
  const s = r.steady;
  check('steady: 132.263 kg/s (1.0544 m/s), 444.510 kPa at the vessel, 337.636 kPa across the valve', near(s.pipes[1].m, 132.263, 5e-4) && near(s.pipes[1].V, 1.0544, 5e-5) && near(kPa(s.junctions[2].P0in), 444.510, 0.001) && near(kPa(s.junctions[3].dP), 337.636, 0.001), `${s.pipes[1].m.toFixed(3)} kg/s, ${f3(kPa(s.junctions[2].P0in))} kPa, ${f3(kPa(s.junctions[3].dP))} kPa`);
  for (const [t, P, V] of [[5, 613.163, 1.5297], [10, 849.658, 1.1656], [20, 525.790, 1.7388], [30, 338.512, 2.5097]]) {
    const p = kPa(jAt(r, 2, 'P', t)), v = jAt(r, 2, 'Vg', t);
    check(`vessel at ${t} s: ${P} kPa and ${V} m³`, near(p, P, 0.01) && near(v, V, 1e-4), `${f3(p)} kPa, ${v.toFixed(4)} m³`);
  }
  const X = r.extremes.junctions[2];
  check('vessel: maximum 868.722 kPa at 11.2 s, gas 1.1443 m³ at the least', near(kPa(X.P.max), 868.722, 0.01) && near(X.P.tmax, 11.2, 1e-9) && near(X.Vg.min, 1.1443, 1e-4), `${f3(kPa(X.P.max))} kPa at ${X.P.tmax} s, ${X.Vg.min.toFixed(4)} m³`);
  check('vessel: minimum 329.285 kPa at 33.1 s', near(kPa(X.P.min), 329.285, 0.01) && near(X.P.tmin, 33.1, 1e-9), `${f3(kPa(X.P.min))} kPa at ${X.P.tmin} s`);
  const Xv = r.extremes.pipes[2];
  check('valve: maximum 982.921 kPa at 10.80 s', near(kPa(Xv.Pmax[2]), 982.921, 0.01) && near(Xv.tPmax[2], 10.8, 1e-9), `${f3(kPa(Xv.Pmax[2]))} at ${Xv.tPmax[2]} s`);
  const low = Math.min(...Xv.Pmin);
  check('smallest pressure in pipe 2: 242.755 kPa', near(kPa(low), 242.755, 0.01), f3(kPa(low)));
}

// ---------- T11: infinite pipe
console.log('\nT11 Infinite pipe');
{
  const m = base();
  J(m, 'pressure', 1, { P: q(2000, 'kPa(a)'), ptype: 'stagnation', surgeSpecial: 'infinitePipe' });
  J(m, 'flow', 2, { Q: q(area(0.5), 'm³/s'), dir: 'out', surge: closure() });
  pipe(m, 1, 1, 2, 1200, 0.5, 0, 1200);
  control(m, 0.1, 10);
  const r = simulate(m);
  const P = seriesOf(r, 1, 10, 'P'), times = [...r.times];
  const bad = times.filter((t, i) => t > 0.05 && !near(kPa(P[i]), 3197.840, 0.001));
  check('valve at 3197.840 kPa in every step from 0.1 to 10 s', !bad.length, bad.length ? `${bad.length} steps differ, first at ${bad[0]} s: ${f3(kPa(P[times.indexOf(bad[0])]))}` : '');
  const one = base();
  J(one, 'pressure', 1, { P: q(2000, 'kPa(a)'), ptype: 'stagnation', surgeSpecial: 'infinitePipe' });
  J(one, 'flow', 2, { Q: q(area(0.5), 'm³/s'), dir: 'out' });
  pipe(one, 1, 1, 2, 120, 0.5, 0, 1200);
  control(one, 0.1, 1);
  const r1 = SG.run(M.effective(one, 'base'));
  check('an infinite pipe needs 2 sections in its pipe', !r1.ok && r1.errors.length > 0, r1.errors[0] || '');
}

// ---------- T15: relief valve
function t15(dur = 10) {
  const m = base();
  J(m, 'reservoir', 1, { liquidElev: q(0, 'm'), surfP: q(2000, 'kPa(a)') });
  J(m, 'reliefValve', 2, { mode: 'pressure', Pset: q(2500, 'kPa(a)'), Pfull: q(2750, 'kPa(a)'), Pclose: q(2500, 'kPa(a)'), lossModel: 'Cv', Cv: 2000, Pext: q(101.325, 'kPa(a)'), rate: null });
  J(m, 'flow', 3, { Q: q(area(0.5), 'm³/s'), dir: 'out', surge: closure() });
  pipe(m, 1, 1, 2, 1200, 0.5, 0, 1200);
  pipe(m, 2, 2, 3, 240, 0.5, 0, 1200);
  control(m, 0.1, dur);
  return m;
}
console.log('\nT15 Relief valve');
{
  const r = simulate(t15());
  const opened = r.log.find((e) => e.obj === 'j:2' && e.key === 'surge.log.state' && e.params.to === 'open');
  const closed = r.log.find((e) => e.obj === 'j:2' && e.key === 'surge.log.state' && e.params.to === 'closed');
  check('opens at 0.3 s and closes for the first time at 2.3 s', opened && closed && near(opened.t, 0.3, 1e-9) && near(closed.t, 2.3, 1e-9), `${opened && opened.t} s, ${closed && closed.t} s`);
  for (const [t, P, mr] of [[0.3, 2523.365, 220.721], [0.5, 2523.365, 220.721], [1.0, 2500.786, 7.389], [2.0, 2521.909, 206.906], [3.0, 2173.689, 0]]) {
    const p = kPa(jAt(r, 2, 'P', t)), m = jAt(r, 2, 'mr', t);
    check(`node at ${t} s: ${P} kPa, ${mr} kg/s relieved`, near(p, P, 0.001) && near(m, mr, 5e-4), `${f3(p)} kPa, ${m.toFixed(3)} kg/s`);
  }
  // the same largest value from 0.3 to 0.5 s: its first time depends on the rounding (as in T14)
  const X = r.extremes.junctions[2].mr;
  check('the largest relieved flow is that of 0.3 s', near(X.max, 220.721, 5e-4) && near(jAt(r, 2, 'mr', 0.3), X.max, 1e-9 * X.max), `${X.max.toFixed(3)} kg/s`);
  const Xc = r.extremes.pipes[2], Xa = r.extremes.pipes[1];
  check('closed end: maximum 3197.840 kPa at 0.1 s (the direct wave does not pass the relief)', near(kPa(Xc.Pmax[2]), 3197.840, 0.001) && near(Xc.tPmax[2], 0.1, 1e-9), `${f3(kPa(Xc.Pmax[2]))} at ${Xc.tPmax[2]}`);
  const lowC = Math.min(...Xc.Pmin), lowA = Math.min(...Xa.Pmin);
  check('smallest pressures: 1803.732 kPa in pipe C, 1804.466 kPa in pipe A', near(kPa(lowC), 1803.732, 0.001) && near(kPa(lowA), 1804.466, 0.001), `${f3(kPa(lowC))}, ${f3(kPa(lowA))}`);
}

// ---------- T16: air flow of an air valve
console.log('\nT16 Air flow of an air valve');
{
  const D = SG.devices, p0 = 101325, T0 = 293.15, CdA = 1e-3;
  check('critical pressure ratio 0.52828', near(D.RC, 0.52828, 5e-6), D.RC.toFixed(5));
  const cases = [['in, 50 kPa inside (sonic)', 50e3, 0.239174], ['in, 80 kPa inside (subsonic)', 80e3, 0.199458], ['out, 150 kPa inside (subsonic)', 150e3, -0.336621], ['out, 250 kPa inside (sonic)', 250e3, -0.590115]];
  for (const [name, p, exp] of cases) {
    const m = D.airFlow(CdA, CdA, p, p0, T0, T0);
    check(`${name}: ${Math.abs(exp)} kg/s`, near(m, exp, 5e-7), m.toFixed(6));
  }
}

// ---------- phase G2 beyond the cases of §12: what the specification asks without values of its own
console.log('\nG2  Devices, finite reservoir and friction that varies');
{
  // the surge tank of T9 with an orifice (smaller swings) and one-way (it only feeds the network)
  const swing = (props) => {
    const m = t9();
    Object.assign(m.junctions[1], props);
    m.solution.surge.duration = q(200, 's');
    const r = simulate(m);
    return { r, X: r.extremes.junctions[2].level };
  };
  const free = swing({});
  const orifice = swing({ orifice: true, CdAin: q(1, 'm²'), CdAout: q(1, 'm²') });
  check('surge tank: an orifice damps the swing of the level', orifice.X.max < free.X.max - 0.1 && orifice.X.max > 46.941, `${orifice.X.max.toFixed(3)} m against ${free.X.max.toFixed(3)} m`);
  const riser = swing({ riser: true, riserL: q(20, 'm'), riserD: q(2, 'm'), riserF: 0.015 });
  check('surge tank: a riser with its inertia gives a run of its own, its level near the free one', riser.r.ok && Math.abs(riser.X.max - free.X.max) < 1 && riser.X.max !== free.X.max, `${riser.X.max.toFixed(3)} m`);
  const one = swing({ oneWay: true });
  check('surge tank one-way: the level never rises above that of the steady state', one.X.max <= 46.941 + 1e-6, `largest ${one.X.max.toFixed(4)} m`);
  const top = swing({ height: q(55, 'm') });
  check('surge tank with a top: the level stays at the top, the excess overflows (warning and log)', near(top.X.max, 55, 1e-9) && top.r.junctions[2].totals.over > 0 && top.r.warnings.some((w) => w.key === 'surge.warn.tankFull') && top.r.log.some((e) => e.key === 'surge.log.state' && e.params.to === 'full'), `${top.r.junctions[2].totals.over.toFixed(1)} m³ overflowed`);

  // a finite reservoir: its volume follows the flows of its pipes exactly (the trapezoid rule of the run)
  const fr = t3(0.02);
  Object.assign(fr.junctions[0], { liquidElev: q(5, 'm'), surfP: q(1900, 'kPa(a)'), tank: Object.assign(PumpIt.time.tanks.newTank(fr.junctions[0]), { area: q(2, 'm²'), height: q(20, 'm') }) });
  const rf = simulate(fr);
  const lvl = jSeries(rf, 1, 'level'), nf = jSeries(rf, 1, 'net');
  let vol = 0;
  for (let i = 1; i < rf.times.length; i++) vol -= (nf[i] + nf[i - 1]) / 2 * rf.dt / 998.2;
  const dV = (lvl[lvl.length - 1] - lvl[0]) * 2;
  check('finite reservoir: the change of its volume is the flow that came in', near(dV, vol, 1e-9 * Math.max(1, Math.abs(vol))) && Math.abs(dV) > 1e-3, `${dV.toFixed(6)} m³ against ${vol.toFixed(6)} m³`);
  const n0 = rf.steady.junctions[1].net;
  check('finite reservoir: at 0 s its net flow is that of the steady state, which its first step integrates', near(nf[0], n0, 1e-12 * Math.abs(n0)) && Math.abs(n0) > 1, `${nf[0]} against ${n0} kg/s`);
  const inf = simulate(t3(0.02));
  const ni = jSeries(inf, 1, 'net');
  check('a reservoir and an imposed flow give at 0 s the net flow of the steady state', near(ni[0], inf.steady.junctions[1].net, 1e-12 * Math.abs(ni[0])) && near(jSeries(inf, 2, 'net')[0], inf.steady.junctions[2].net, 1e-12 * Math.abs(ni[0])), `${ni[0]} kg/s`);
  check('finite reservoir: its level moves, so the run differs from the infinite one', kPa(Pat(rf, 1, 10, 9.9)) !== kPa(Pat(inf, 1, 10, 9.9)));
  const fu = t3(0.02);
  Object.assign(fu.junctions[0], { liquidElev: q(0, 'm'), surfP: q(1900, 'kPa(a)'), tank: Object.assign(PumpIt.time.tanks.newTank(fu.junctions[0]), { area: q(2, 'm²'), height: q(20, 'm') }) });
  const ru = SG.run(M.effective(fu, 'base'));
  check('finite reservoir: a tank that starts with the end of its pipe uncovered stops the run, saying why', !ru.ok && ru.errors.length === 1 && ru.errors[0].includes('J1') && ru.errors[0].includes('P1') && ru.errors[0].includes('uncovered'), ru.errors[0] || '');
  const qs = SG.inputs.quantities(fr.junctions[0]);
  check('finite reservoir: only its surface pressure takes a table', qs.length === 1 && qs[0].what === 'surfP');

  // an air valve at the middle of a line whose upstream flow stops at once
  const av = (type) => {
    const m = base();
    J(m, 'flow', 1, { Q: q(area(0.3), 'm³/s'), dir: 'in', surge: closure() });
    J(m, type, 2, type === 'airValve' ? { avType: 'both', CdAin: q(50, 'cm²'), CdAout: q(5, 'cm²'), Tair: q(20, '°C') } : { source: q(0, 'kg/s') });
    J(m, 'reservoir', 3, { liquidElev: q(0, 'm'), surfP: q(150, 'kPa(a)') });
    pipe(m, 1, 1, 2, 500, 0.3, 0.02, 1000);
    pipe(m, 2, 2, 3, 500, 0.3, 0.02, 1000);
    control(m, 0.01, 25, { cavitation: 'none' });
    return simulate(m);
  };
  const ra = av('airValve'), rb = av('branch');
  const Xa = ra.extremes.junctions[2], Xb = rb.extremes.junctions[2];
  check('air valve: the pressure of the line would fall far below vacuum without it', Xb.P.min < 0, `${f3(kPa(Xb.P.min))} kPa`);
  check('air valve: it lets air in and holds the pressure above the vapour pressure', Xa.Va.max > 0 && Xa.P.min > 2340 && ra.log.some((e) => e.obj === 'j:2' && e.params.to === 'admit'), `${f3(kPa(Xa.P.min))} kPa, ${(Xa.Va.max * 1e3).toFixed(2)} L of air`);
  check('air valve: the air goes out again and the valve closes', ra.log.some((e) => e.obj === 'j:2' && e.params.to === 'expel') && ra.log.some((e) => e.obj === 'j:2' && e.params.from !== 'closed' && e.params.to === 'closed'));

  // the friction that varies with the Reynolds number: the steady state holds, and a transient differs from the steady
  // friction once the flows change
  const vf = (friction) => {
    const m = t3(0);
    m.pipes[0].friction = { model: 'roughness', eps: q(0.05, 'mm') };
    m.solution.surge.friction = friction;
    return m;
  };
  const still = vf('variable');
  still.junctions[1].surge = null;
  const rs = simulate(still);
  const Xs = rs.extremes.pipes[1];
  let worst = 0;
  for (let i = 0; i <= 10; i++) worst = Math.max(worst, Math.abs(Xs.Pmax[i] - rs.pipes[1].steady.P[i]) / rs.pipes[1].steady.P[i], Math.abs(Xs.Pmin[i] - rs.pipes[1].steady.P[i]) / rs.pipes[1].steady.P[i]);
  check('friction that varies: the steady state holds (test step and every step)', rs.artificial.ok && worst < 1e-9, worst.toExponential(1));
  const rv = simulate(vf('variable')), rq = simulate(vf('steady'));
  const pv = kPa(Pat(rv, 1, 10, 0.1)), pq = kPa(Pat(rq, 1, 10, 0.1));
  check('friction that varies: the same first step, a different decay later', near(pv, pq, 1e-9) && Math.abs(kPa(Pat(rv, 1, 10, 9.9)) - kPa(Pat(rq, 1, 10, 9.9))) > 1e-3, `${f3(kPa(Pat(rv, 1, 10, 9.9)))} against ${f3(kPa(Pat(rq, 1, 10, 9.9)))} kPa at 9.9 s`);

  // the checklists of the devices
  const ck = (type, props, key) => {
    const m = base();
    J(m, 'reservoir', 1, { liquidElev: q(0, 'm'), surfP: q(200, 'kPa(a)') });
    J(m, type, 2, props);
    pipe(m, 1, 1, 2, 100, 0.3, 0.02, 1000);
    control(m, 0.01, 1);
    const v = M.validate(M.effective(m, 'base'));
    return (v.undef.get('j:2') || []).includes(PumpIt.i18n.t('surge.checklist.' + key));
  };
  check('checklist: a surge tank needs its area', ck('surgeTank', { area: q(null, 'm²') }, 'device.area'));
  check('checklist: an air vessel needs its gas, and n from 1 to 1.4', ck('airVessel', { Vg0: q(null, 'm³') }, 'device.Vg0') && ck('airVessel', { n: 1.6 }, 'device.n'));
  check('checklist: a relief valve opens fully above its set pressure', ck('reliefValve', { Pfull: q(9, 'kgf/cm²(g)') }, 'device.Pfull'));
  check('checklist: the largest speed of a relief valve is above zero, or empty', ck('reliefValve', { rate: -5 }, 'device.rate') && ck('reliefValve', { rate: 0 }, 'device.rate') && !ck('reliefValve', { rate: null }, 'device.rate') && !ck('reliefValve', { rate: 10 }, 'device.rate'));
  check('checklist: an air valve of a fluid without a temperature needs that of its air', ck('airValve', { Tair: q(null, '°C') }, 'device.Tair'));
  const tb = { h: [0, 10], V: [0, 100], hUnit: 'm', vUnit: 'm³' };
  check('checklist: a surge tank with a table needs its top, and the table reaching it', ck('surgeTank', { shape: 'table', table: tb, height: q(null, 'm') }, 'device.height') && ck('surgeTank', { shape: 'table', table: tb, height: q(12, 'm') }, 'device.tableShort') && !ck('surgeTank', { shape: 'table', table: tb, height: q(10, 'm') }, 'device.tableShort') && !ck('surgeTank', { shape: 'constant', height: q(null, 'm') }, 'device.height'));
}

// ---------- phase G3 before its addendum: the largest speed of a control valve (W-49) and the start of a pump (W-50),
// checked against what they must do (an analytic speed, the steady state they end in), without values of the specification
console.log('\nG3  Largest speed of a control valve, start of a pump');
{
  // a pressure reducing valve that controls at every step, upstream of an imposed flow that closes in 2 s
  const prv = (rate, mode = 'ideal', more = {}) => {
    const m = base();
    J(m, 'reservoir', 1, { liquidElev: q(0, 'm'), surfP: q(600, 'kPa(a)') });
    J(m, 'control', 2, Object.assign({ ctype: 'PRV', setP: q(300, 'kPa(a)'), basis: 'stagnation', kOpen: 0, char: 'linear', CvMax: 1000, surgeControl: mode, surgeRate: rate }, more));
    J(m, 'flow', 3, { Q: q(0.1, 'm³/s'), dir: 'out', surge: { use: true, what: 'Q', basis: 'relative', start: 'time', when: [], tables: [{ t: [0, 2], v: [100, 0], tUnit: 's', vUnit: '%' }], repeat: false, interp: 'linear' } });
    pipe(m, 1, 1, 2, 200, 0.3, 0.02, 1000);
    pipe(m, 2, 2, 3, 1000, 0.3, 0.02, 1000);
    control(m, 0.01, 10);
    return m;
  };
  const same = (a, b) => ['P1', 'P2', 'm', 'x'].every((f) => a.junctions[2].series[f].every((x, i) => Object.is(x, b.junctions[2].series[f][i])));
  const ideal = simulate(prv(null)), fast = simulate(prv(1e9)), slow = simulate(prv(5));
  check('control valve: a speed it never reaches gives the run of the ideal valve, bit for bit (its opening too)', same(ideal, fast) && JSON.stringify(ideal.log) === JSON.stringify(fast.log) && !!ideal.junctions[2].series.x);
  const x = [...slow.junctions[2].series.x];
  const r0 = slow.steady.junctions[2];
  const cv0 = PumpIt.junctionTypes.shared.equivalentCv(r0.m, r0.P0in - r0.P0out, 998.2);
  check('control valve: its opening starts from the Cv of the steady state (linear, 1000 fully open)', near(x[0], cv0 / 10, 1e-9) && near(x[0], 24.571, 5e-4), `${x[0].toFixed(4)} %`);
  let steepest = 0;
  for (let i = 1; i < x.length; i++) steepest = Math.max(steepest, Math.abs(x[i] - x[i - 1]) / slow.dt);
  check('control valve: its opening never moves faster than 5 %/s, and moves at that speed while it lags', steepest <= 5 * (1 + 1e-9) && near(steepest, 5, 1e-6), `${steepest.toFixed(6)} %/s`);
  const p2 = (r, tt) => kPa(r.junctions[2].series.P2[idx(r, tt)]);
  check('control valve: the ideal valve holds its outlet at 300 kPa while it controls; held back, the outlet goes above', near(p2(ideal, 2), 300, 1e-6) && p2(slow, 2) > 700, `${f3(p2(ideal, 2))} and ${f3(p2(slow, 2))} kPa at 2 s`);
  const sameFrozen = (a, b) => ['P1', 'P2', 'm'].every((f) => a.junctions[2].series[f].every((x, i) => Object.is(x, b.junctions[2].series[f][i])));
  check('control valve: frozen, the largest speed changes nothing', sameFrozen(simulate(prv(5, 'frozen')), simulate(prv(null, 'frozen'))));
  const ckv = (props, key) => {
    const v = M.validate(M.effective(prv(5, 'ideal', props), 'base'));
    return (v.undef.get('j:2') || []).includes(PumpIt.i18n.t('surge.checklist.' + key));
  };
  check('checklist: a largest speed above zero, which needs the characteristic of the valve', ckv({ surgeRate: -1 }, 'valve.rate') && ckv({ char: 'none' }, 'valve.char') && !ckv({}, 'valve.char') && !ckv({ surgeControl: 'frozen', surgeRate: -1 }, 'valve.rate'));

  // the start of a pump stopped and closed in the steady state, between reservoirs at 150 kPa and highP
  const wr = 1750 * 2 * Math.PI / 60, a0 = 50000 / wr; // the torque of the pump without flow at its rated speed (N·m)
  const motor = { x: [0, 50, 90, 100], y: [400, 450, 700, 0], yUnit: 'N·m' };
  const start = (mt, highP, I, dt, dur, at = 0) => {
    const m = base();
    J(m, 'reservoir', 1, { liquidElev: q(0, 'm'), surfP: q(150, 'kPa(a)') });
    J(m, 'reservoir', 3, { liquidElev: q(0, 'm'), surfP: q(highP, 'kPa(a)') });
    J(m, 'pump', 2, {
      mode: 'curve', speed: 100, nPumps: 1, state: 'offClosed',
      curve: { x: [0, 0.1, 0.2], y: [70, 60, 30], xUnit: 'm³/s', yUnit: 'm', fit: '2' },
      eff: { x: [], y: [], xUnit: 'm³/s', fit: '2' },
      power: { x: [0, 0.1, 0.2], y: [50, 75, 100], xUnit: 'm³/s', yUnit: 'kW', fit: '2' },
      inertia: q(I, 'kg·m²'), rpm: q(1750, 'rpm'), motor: mt,
      surge: { use: true, what: 'start', start: 'time', when: [], at: q(at, 's') },
    });
    pipe(m, 1, 1, 2, 10, 0.3, 0.015, 1000);
    pipe(m, 2, 2, 3, 500, 0.3, 0.015, 1000);
    control(m, dt, dur);
    return m;
  };
  // against a pressure it cannot overcome the flow stays zero, and with a motor of the constant torque a0,
  // I·ω_r·ds/dt = a0·(1 − s²): s = tanh(a0·t/(I·ω_r))
  const ra = simulate(start({ x: [0, 200], y: [a0, a0], yUnit: 'N·m' }, 1500, 1, 0.001, 2));
  const sa = ra.junctions[2].series;
  let worst = 0, mMax = 0;
  for (let i = 0; i < ra.times.length; i++) { worst = Math.max(worst, Math.abs(sa.s[i] / 100 - Math.tanh(a0 * ra.times[i] / wr))); mMax = Math.max(mMax, Math.abs(sa.m[i])); }
  check('pump start against a pressure it cannot overcome: no flow, the speed of tanh(a·t/(I·ω_r)) within 10⁻⁶', mMax === 0 && worst < 1e-6, worst.toExponential(2));
  check('pump start: in the log at 0 s', ra.log.some((e) => e.key === 'surge.log.pumpStart' && e.t === 0));
  // a start that pumps: its check valve opens once its head at no flow passes the 350 kPa against it
  const rb = simulate(start(motor, 500, 10, 0.01, 40));
  const sb = rb.junctions[2].series, n = rb.times.length;
  const opens = rb.log.find((e) => e.obj === 'j:2' && e.key === 'surge.log.state');
  const io = opens ? idx(rb, opens.t) : -1, sOpen = 100 * Math.sqrt(350e3 / (998.2 * 9.80665 * 70));
  check('pump start: held by its check valve until its head overcomes the pressure against it', !!opens && opens.params.from === 'shut' && opens.params.to === 'run' && sb.s[io - 1] <= sOpen && sb.s[io] > sOpen && sb.m[io - 1] === 0 && sb.m[io] > 0, opens ? `opens at ${opens.t} s, ${sb.s[io].toFixed(3)} % against ${sOpen.toFixed(3)} %` : '');
  const sEnd = sb.s[n - 1] / 100, mc = SG.pumps.motorCurve({ motor });
  check('pump start: the speed settles where the torque of the motor meets that of the pump', near(mc.at(sEnd), sb.T[n - 1], 1e-6 * sb.T[n - 1]), `${sb.s[n - 1].toFixed(4)} %, ${sb.T[n - 1].toFixed(4)} N·m`);
  const mm = start(motor, 500, 10, 0.01, 40);
  Object.assign(mm.junctions[2], { state: 'on', speed: sEnd * 100, surge: null });
  const ss = PumpIt.solver.run(M.effective(mm, 'base'));
  check('pump start: it ends with the flow of the steady state at that speed', near(sb.m[n - 1], ss.pipes[2].m, 1e-5 * ss.pipes[2].m), `${sb.m[n - 1].toFixed(5)} against ${ss.pipes[2].m.toFixed(5)} kg/s`);
  const rc = simulate(start(motor, 500, 10, 0.01, 2, 1));
  const sc = rc.junctions[2].series;
  check('pump start at 1 s: nothing moves before it, the speed rises after it', [...rc.times].every((tt, i) => tt > 1 + 1e-9 || (sc.s[i] === 0 && sc.m[i] === 0)) && sc.s[idx(rc, 1.01)] > 0 && rc.log.some((e) => e.key === 'surge.log.pumpStart' && near(e.t, 1, 1e-9)));
  const rd = simulate(start({ x: [0, 50], y: [a0, a0], yUnit: 'N·m' }, 1500, 1, 0.01, 2));
  check('pump start: a speed past the last point of the table of the motor gives a caution', rd.warnings.some((w) => w.key === 'surge.warn.motorBeyond'));
  const ckp = (props, key) => {
    const m = start(motor, 500, 10, 0.01, 1);
    Object.assign(m.junctions[2], props);
    const v = M.validate(M.effective(m, 'base'));
    return (v.undef.get('j:2') || []).includes(PumpIt.i18n.t('surge.checklist.' + key));
  };
  check('checklist: a start needs the pump off and closed, the table of its motor from 0 % with a starting torque, and its inertia',
    ckp({ state: 'on' }, 'pump.startState') && ckp({ state: 'on' }, 'data.what') && ckp({ motor: null }, 'pump.motor') && ckp({ motor: { x: [10, 100], y: [400, 0], yUnit: 'N·m' } }, 'pump.motor')
    && ckp({ motor: { x: [0, 100], y: [0, 0], yUnit: 'N·m' } }, 'pump.motor') && ckp({ inertia: q(null, 'kg·m²') }, 'pump.inertia') && !ckp({}, 'pump.motor'));
}

// ---------- phase G3: the cases T19 to T31 of the addendum of the specification (golpe-de-ariete-g3-respostas.md), with
// the values of its team. Speeds and openings in % come with four decimals, so they are checked within half of the last
// one; the other quantities within the tolerances of the addendum
const pct4 = (a, b) => Math.abs(a - b) <= 5e-5 + 1e-9;
const dec = (a, b, d) => Math.abs(a - b) <= 0.5 * Math.pow(10, -d) + 1e-12;
const LS = (m) => m / 998.2 * 1e3;

// T19: the largest speed of a control valve (W-49)
function t19(rate) {
  const m = base();
  J(m, 'reservoir', 1, { liquidElev: q(0, 'm'), surfP: q(1000, 'kPa(a)') });
  J(m, 'control', 2, { ctype: 'PRV', setP: q(500, 'kPa(a)'), basis: 'stagnation', kOpen: 0, char: 'linear', CvMax: 600, surgeControl: 'ideal', surgeRate: rate });
  J(m, 'exitvalve', 3, {
    Pout: q(101.325, 'kPa(a)'), lossModel: 'opening', char: 'linear', CvMax: 400, open: 100,
    surge: { use: true, what: 'open', basis: 'absolute', start: 'time', when: [], tables: [{ t: [0, 5], v: [100, 40], tUnit: 's', vUnit: '%' }], repeat: false, interp: 'linear' },
  });
  pipe(m, 1, 1, 2, 500, 0.3, 0.02, 1000);
  pipe(m, 2, 2, 3, 1000, 0.3, 0.02, 1000);
  control(m, 0.1, 15);
  return m;
}
console.log('\nT19 Largest speed of a control valve');
{
  const r = simulate(t19(null));
  const r0 = r.steady.junctions[2], cv0 = PumpIt.junctionTypes.shared.equivalentCv(r0.m, r0.P0in - r0.P0out, 998.2);
  const x = (rr, tt) => rr.junctions[2].series.x[idx(rr, tt)];
  const p2 = (rr, tt) => kPa(rr.junctions[2].series.P2[idx(rr, tt)]);
  check('steady: 150.763 kg/s (2.1367 m/s), 924.045 kPa at the inlet of the valve, Cv 305.138, opening 50.8563 %', near(r.steady.pipes[1].m, 150.763, 5e-4) && near(r.steady.pipes[1].V, 2.1367, 5e-5) && near(kPa(r0.P0in), 924.045, 0.001) && near(cv0, 305.138, 5e-4) && pct4(x(r, 0), 50.8563), `${r.steady.pipes[1].m.toFixed(3)} kg/s, ${f3(kPa(r0.P0in))} kPa, Cv ${cv0.toFixed(3)}, ${x(r, 0).toFixed(4)} %`);
  const P2 = r.junctions[2].series.P2;
  check('without a limit: the valve controls at every step, P2 = 500.000 kPa', P2.every((v) => near(kPa(v), 500, 0.001)));
  const ideal = { 2: 43.3992, 3: 42.7609, 5: 29.3659, 7: 33.1168, 10: 18.9153, 15: 30.4371 };
  check('without a limit: the openings at 2, 3, 5, 7, 10 and 15 s', Object.entries(ideal).every(([tt, v]) => pct4(x(r, +tt), v)), Object.keys(ideal).map((tt) => x(r, +tt).toFixed(4)).join(' '));
  const Xr = r.extremes.junctions[2].x, Xe = r.extremes.pipes[2];
  check('without a limit: the smallest opening 18.8562 % at 8.0 s, at the exit valve at most 738.406 kPa at 5.0 s', pct4(Xr.min, 18.8562) && near(Xr.tmin, 8, 1e-9) && near(kPa(Xe.Pmax[10]), 738.406, 0.001) && near(Xe.tPmax[10], 5, 1e-9), `${Xr.min.toFixed(4)} % at ${Xr.tmin} s, ${f3(kPa(Xe.Pmax[10]))} kPa at ${Xe.tPmax[10]} s`);
  const r3 = simulate(t19(3));
  const tab3 = { 1: [50.8563, 500.000], 2: [47.8563, 538.802], 3: [44.8563, 547.866], 5: [38.8563, 666.077], 7: [32.8563, 638.197], 10: [23.8563, 515.679], 15: [23.4735, 500.000] };
  for (const [tt, [o, p]] of Object.entries(tab3)) check(`3 %/s at ${tt} s: opening ${o} %, P2 ${p} kPa`, pct4(x(r3, +tt), o) && near(p2(r3, +tt), p, 0.001), `${x(r3, +tt).toFixed(4)} %, ${f3(p2(r3, +tt))} kPa`);
  const xs3 = r3.junctions[2].series.x, ts3 = [...r3.times];
  const lagging = ts3.filter((tt, i) => i > 0 && near(Math.abs(xs3[i] - xs3[i - 1]), 0.3, 1e-9));
  check('3 %/s: the opening lags from 1.1 s to 10.3 s, 0.3 % per step, then follows the one asked for again', near(lagging[0], 1.1, 1e-9) && near(lagging[lagging.length - 1], 10.2, 1e-9) && lagging.length === 92, `${lagging[0]} to ${lagging[lagging.length - 1]} s, ${lagging.length} steps`);
  const X3 = r3.extremes.junctions[2].P2, Xe3 = r3.extremes.pipes[2];
  check('3 %/s: P2 at most 771.024 kPa at 6.0 s, at the exit valve at most 828.049 kPa at 5.0 s', near(kPa(X3.max), 771.024, 0.001) && near(X3.tmax, 6, 1e-9) && near(kPa(Xe3.Pmax[10]), 828.049, 0.001) && near(Xe3.tPmax[10], 5, 1e-9), `${f3(kPa(X3.max))} at ${X3.tmax} s, ${f3(kPa(Xe3.Pmax[10]))} at ${Xe3.tPmax[10]} s`);
  const r10 = simulate(t19(10));
  const X10 = r10.extremes.junctions[2].P2;
  check('10 %/s: at 7 s the opening is 28.7763 % and P2 468.414 kPa; P2 between 468.414 kPa (7.0 s) and 531.358 kPa (7.7 s)', pct4(x(r10, 7), 28.7763) && near(p2(r10, 7), 468.414, 0.001) && near(kPa(X10.min), 468.414, 0.001) && near(X10.tmin, 7, 1e-9) && near(kPa(X10.max), 531.358, 0.001) && near(X10.tmax, 7.7, 1e-9), `${x(r10, 7).toFixed(4)} %, ${f3(kPa(X10.min))} at ${X10.tmin} s, ${f3(kPa(X10.max))} at ${X10.tmax} s`);
}

// T20 to T23: the system of T8 with the pump off and closed (a start) or with the four-quadrant data
const TH = [0, 10, 20, 30, 40, 45, 50, 60, 70, 80, 90, 100, 110, 120, 130, 135, 140, 150, 160, 170, 180, 190, 200, 210, 220, 225, 230, 240, 250, 260, 270, 280, 290, 300, 310, 315, 320, 330, 340, 350, 360];
const WH = [0.6, 0.668404, 0.728558, 0.773205, 0.796962, 0.8, 0.796962, 0.773205, 0.728558, 0.668404, 0.6, 0.681457, 0.813396, 0.979904, 1.160897, 1.25, 1.334545, 1.479904, 1.57944, 1.621149, 1.6, 1.533662, 1.342649, 1.05, 0.691013, 0.5, 0.308987, -0.05, -0.342649, -0.533662, -0.6, -0.598018, -0.523905, -0.386603, -0.20267, -0.1, 0.005708, 0.213397, 0.395348, 0.529614, 0.6];
const WB = [-0.8, -0.677815, -0.479906, -0.230144, 0.041346, 0.175, 0.301818, 0.519856, 0.669161, 0.731724, 0.7, 0.661275, 0.618175, 0.575897, 0.539543, 0.525, 0.513496, 0.500897, 0.503268, 0.520321, 0.55, 0.638541, 0.671173, 0.643958, 0.560181, 0.5, 0.429944, 0.268958, 0.096639, -0.066228, -0.2, -0.320698, -0.463023, -0.609808, -0.743348, -0.8, -0.847537, -0.909808, -0.92265, -0.884514, -0.8];
const fourQ = (ref, more = {}) => Object.assign({ use: true, ref, theta: TH, wh: WH, wb: WB }, more);
function t8x(state, what, fourQuad, motor, dur) {
  const m = t8();
  Object.assign(m.junctions[2], { state, fourQuad, motor, surge: what ? { use: true, what, start: 'time', when: [], at: q(0, 's') } : null });
  m.solution.surge.duration = q(dur, 's');
  return m;
}
// the speed (%), the flow (L/s) and the discharge pressure (kPa) of the pump at the times of a table
function pumpTable(r, rows, name) {
  const sj = r.junctions[2].series;
  for (const [tt, [s, Q, Pd]] of Object.entries(rows)) {
    const i = idx(r, +tt), pd = kPa(Pat(r, 2, 0, +tt));
    check(`${name} at ${tt} s: speed ${s} %, flow ${Q} L/s, discharge ${Pd} kPa`, pct4(sj.s[i], s) && dec(LS(sj.m[i]), Q, 4) && near(pd, Pd, 0.001), `${sj.s[i].toFixed(4)} %, ${LS(sj.m[i]).toFixed(4)} L/s, ${f3(pd)} kPa`);
  }
}
const motor20 = { x: [0, 50, 80, 95, 100, 103], y: [900, 950, 1300, 1100, 550, 0], yUnit: 'N·m' };
console.log('\nT20 Start with the curve of the motor, overcoming the difference');
{
  const r = simulate(t8x('offClosed', 'start', null, motor20, 20));
  const op = r.log.find((e) => e.obj === 'j:2' && e.key === 'surge.log.state');
  check('the check valve of the pump opens (it pumps) at 1.43 s', !!op && op.params.to === 'run' && near(op.t, 1.43, 1e-9), op ? `${op.t} s` : '—');
  pumpTable(r, { 0.5: [24.7407, 0, 500], 1: [49.2477, 0, 500], 2: [99.4094, 22.6208, 819.727], 3: [101.0238, 65.9872, 802.021], 5: [100.5669, 127.1151, 681.256], 10: [100.2855, 163.5007, 575.711], 20: [100.2673, 165.7389, 568.626] }, 'T20');
  const X = r.extremes.pipes[2], Xs = r.extremes.pipes[1];
  check('discharge: at most 846.737 kPa at 2.42 s; suction end: at least 137.517 kPa', near(kPa(X.Pmax[0]), 846.737, 0.001) && near(X.tPmax[0], 2.42, 1e-9) && near(kPa(Xs.Pmin[1]), 137.517, 0.001), `${f3(kPa(X.Pmax[0]))} at ${X.tPmax[0]} s, ${f3(kPa(Xs.Pmin[1]))} kPa`);
}
console.log('\nT21 Start that does not overcome the difference');
{
  const r = simulate(t8x('offClosed', 'start', null, { x: [0, 50, 70], y: [300, 100, 0], yUnit: 'N·m' }, 20));
  const sj = r.junctions[2].series;
  check('the check valve never opens: no flow, the pressures constant over the run', sj.m.every((v) => v === 0) && !r.log.some((e) => e.key === 'surge.log.state') && r.extremes.pipes[2].Pmax[0] === r.extremes.pipes[2].Pmin[0]);
  const rows = { 1: 14.6006, 2: 25.8576, 5: 44.6983, 10: 52.9126, 20: 54.0405 };
  check('the speed at 1, 2, 5, 10 and 20 s', Object.entries(rows).every(([tt, v]) => pct4(sj.s[idx(r, +tt)], v)), Object.keys(rows).map((tt) => sj.s[idx(r, +tt)].toFixed(4)).join(' '));
  // it tends to where the torque of the motor, 350 − 500·s, meets that of the pump without flow, a·s² with a = P1(0)/ω_r
  // (272.837 N·m)
  const a0 = 50000 / (1750 * 2 * Math.PI / 60);
  const sEq = (-500 + Math.sqrt(500 * 500 + 4 * a0 * 350)) / (2 * a0);
  check('it tends to 54.0554 %, where the torque of the motor meets that of the pump without flow (272.837·s² N·m)', near(100 * sEq, 54.0554, 5e-5) && near(sj.T[sj.T.length - 1] / Math.pow(sj.s[sj.s.length - 1] / 100, 2), 272.837, 5e-4), `${(100 * sEq).toFixed(4)} %`);
}
console.log('\nT22 Trip in four quadrants');
{
  const r = simulate(t8x('on', 'trip', fourQ('steady'), null, 30));
  const fq = r.junctions[2].info.fourQuad;
  check('Q_R 164.847 L/s, H_R 42.8255 m, T_R 497.719 N·m, N_R 1750 rpm, c_H = c_B = 1', dec(fq.QR * 1e3, 164.847, 3) && dec(fq.HR, 42.8255, 4) && dec(fq.TR, 497.719, 3) && near(fq.NR * 60 / (2 * Math.PI), 1750, 1e-9) && near(fq.cH, 1, 1e-12) && near(fq.cB, 1, 1e-12), `${(fq.QR * 1e3).toFixed(3)} L/s, ${fq.HR.toFixed(4)} m, ${fq.TR.toFixed(3)} N·m`);
  pumpTable(r, {
    0.5: [87.9624, 156.2161, 444.165], 1: [78.3699, 150.1420, 353.745], 2: [64.2896, 119.0749, 298.577], 3: [54.6799, 85.9015, 285.396], 5: [43.3921, 21.4508, 274.761], 6: [40.5119, -10.9327, 268.363],
    8: [34.3170, -71.3714, 298.448], 10: [20.5869, -117.2705, 328.553], 15: [-56.0091, -147.3294, 512.629], 20: [-81.0467, -103.7559, 499.534], 30: [-77.1276, -101.2455, 473.875],
  }, 'T22');
  const fr = r.log.find((e) => e.key === 'surge.log.pumpFlowReversed'), sr = r.log.find((e) => e.key === 'surge.log.pumpSpeedReversed');
  check('the flow reverses at 5.64 s and the speed at 11.71 s (the log)', !!fr && !!sr && near(fr.t, 5.64, 1e-9) && near(sr.t, 11.71, 1e-9), `${fr && fr.t} s, ${sr && sr.t} s`);
  const X = r.extremes.junctions[2];
  check('the smallest speed −81.2088 % at 19.40 s; the largest reverse flow −155.8577 L/s at 13.49 s', pct4(X.s.min, -81.2088) && near(X.s.tmin, 19.4, 1e-9) && dec(LS(X.m.min), -155.8577, 4) && near(X.m.tmin, 13.49, 1e-9), `${X.s.min.toFixed(4)} % at ${X.s.tmin} s, ${LS(X.m.min).toFixed(4)} L/s at ${X.m.tmin} s`);
  const Xd = r.extremes.pipes[2];
  check('discharge: at least 267.832 kPa at 6.10 s, never above the steady 567.862 kPa', near(kPa(Xd.Pmin[0]), 267.832, 0.001) && near(Xd.tPmin[0], 6.1, 1e-9) && near(kPa(Xd.Pmax[0]), 567.862, 0.001) && Xd.tPmax[0] === 0, `${f3(kPa(Xd.Pmin[0]))} at ${Xd.tPmin[0]} s, ${f3(kPa(Xd.Pmax[0]))} kPa`);
}
console.log('\nT23 Start in four quadrants');
{
  const r = simulate(t8x('offClosed', 'start', fourQ('user', { Q: q(0.165, 'm³/s'), H: q(43, 'm'), N: q(1750, 'rpm'), P: q(90, 'kW') }), motor20, 20));
  const op = r.log.find((e) => e.obj === 'j:2' && e.key === 'surge.log.state');
  check('it pumps from 1.44 s', !!op && op.params.to === 'run' && near(op.t, 1.44, 1e-9), op ? `${op.t} s` : '—');
  pumpTable(r, { 0.5: [24.7422, 0, 500], 1: [49.2596, 0, 500], 2: [99.4102, 21.4834, 803.630], 3: [100.9546, 63.1597, 793.325], 5: [100.5433, 123.9398, 681.959], 10: [100.3166, 163.4816, 577.801], 20: [100.3020, 166.4353, 569.228] }, 'T23');
  const X = r.extremes.pipes[2], Xs = r.extremes.pipes[1];
  check('discharge: at most 830.521 kPa at 2.43 s; suction end: at least 138.044 kPa', near(kPa(X.Pmax[0]), 830.521, 0.001) && near(X.tPmax[0], 2.43, 1e-9) && near(kPa(Xs.Pmin[1]), 138.044, 0.001), `${f3(kPa(X.Pmax[0]))} at ${X.tPmax[0]} s, ${f3(kPa(Xs.Pmin[1]))} kPa`);
}

// T24 to T27: the check valves, between a pressure imposed from 1050 kPa down to 650 kPa in 1 s and a reservoir of 1000 kPa
function tCheck(dynamic, props = {}, table = true) {
  const m = base();
  J(m, 'pressure', 1, { P: q(1050, 'kPa(a)'), ptype: 'stagnation', surge: table ? { use: true, what: 'P', basis: 'absolute', start: 'time', when: [], tables: [{ t: [0, 1], v: [1050, 650], tUnit: 's', vUnit: 'kPa(a)' }], repeat: false, interp: 'linear' } : null });
  J(m, 'check', 2, Object.assign({ lossModel: 'K', K: 2, vClose: q(0, 'm/s'), dPopen: q(0, 'kPa'), dynamic }, props));
  J(m, 'reservoir', 3, { liquidElev: q(0, 'm'), surfP: q(1000, 'kPa(a)') });
  pipe(m, 1, 1, 2, 100, 0.3, 0.02, 1000);
  pipe(m, 2, 2, 3, 200, 0.3, 0.02, 1000);
  control(m, 0.01, 3);
  return m;
}
const swingT26 = () => ({
  thetaMax: q(60, '°'), seat: q(10, '°'), I: q(1, 'kg·m²'), md: q(20, 'kg'), rcg: q(0.2, 'm'), Ad: q(null, 'cm²'), rp: q(0.2, 'm'),
  Ts0: q(null, 'N·m'), ks: q(null, 'N·m/rad'), c: q(null, 'N·m·s/rad'), Wc: q(null, 'N'), rc: q(null, 'm'), delta: q(0, '°'),
  fluidMass: 'calculated', mf: q(null, 'kg'), rhoM: q(7850, 'kg/m³'), orient: 'horizontal', phi: q(0, '°'),
  cv: { x: [0, 10, 20, 30, 40, 50, 60], y: [0, 10, 25, 45, 65, 85, 100], xUnit: '°' },
});
const nozzleT27 = () => ({
  xMax: q(50, 'mm'), m: q(6, 'kg'), Ad: q(0.04, 'm²'), F0: q(40, 'N'), k: q(1500, 'N/m'), c: q(null, 'N·s/m'),
  fluidMass: 'user', mf: q(0.75, 'kg'), rhoM: q(7850, 'kg/m³'), orient: 'horizontal', phi: q(0, '°'),
  cv: { x: [0, 10, 20, 30, 40, 50], y: [0, 30, 55, 75, 90, 100], xUnit: 'mm' },
});
// the closure of a check valve: its time, the velocity of the step before it and the smallest one before it, and the
// extremes on its two sides (station 0 of pipe 2 downstream, station 10 of pipe 1 upstream)
function closing(r) {
  const s = r.junctions[2].series, times = [...r.times], A = area(0.3);
  const cl = r.log.find((e) => e.obj === 'j:2' && e.key === 'surge.log.state' && e.params.to === 'closed');
  const ic = cl ? idx(r, cl.t) : -1;
  let vmin = Infinity, tv = NaN;
  for (let i = 0; i < ic; i++) { const V = s.m[i] / (998.2 * A); if (V < vmin) { vmin = V; tv = times[i]; } }
  const Xd = r.extremes.pipes[2], Xu = r.extremes.pipes[1];
  return { t: cl ? cl.t : NaN, Vprev: ic > 0 ? s.m[ic - 1] / (998.2 * A) : NaN, vmin, tv, down: kPa(Xd.Pmax[0]), tDown: Xd.tPmax[0], up: kPa(Xu.Pmin[10]), tUp: Xu.tPmin[10] };
}
const closingText = (c) => `closes at ${c.t} s, V ${c.Vprev.toFixed(5)} m/s the step before (smallest ${c.vmin.toFixed(5)} at ${c.tv} s), downstream ${f3(c.down)} kPa at ${c.tDown} s, upstream ${f3(c.up)} kPa at ${c.tUp} s`;
console.log('\nT24 Instantaneous check valve');
let t24run;
{
  const r = simulate(tCheck('none'));
  t24run = r;
  check('steady: 150.567 kg/s (2.13393 m/s), 4.545455 kPa across the check valve', near(r.steady.pipes[1].m, 150.567, 5e-4) && dec(r.steady.pipes[1].V, 2.13393, 5) && dec(kPa(r.steady.junctions[2].dP), 4.545455, 6), `${r.steady.pipes[1].m.toFixed(3)} kg/s, ${kPa(r.steady.junctions[2].dP).toFixed(6)} kPa`);
  const s = r.junctions[2].series, i1 = idx(r, 1);
  check('at 1.0 s: 755.287 kPa at the inlet, 753.089 kPa at the outlet, V = 1.48383 m/s', near(kPa(s.P1[i1]), 755.287, 0.001) && near(kPa(s.P2[i1]), 753.089, 0.001) && dec(s.m[i1] / (998.2 * area(0.3)), 1.48383, 5));
  const c = closing(r);
  check('closes at 2.25 s, with V = 0.00588 m/s the step before; downstream at most 1259.230 kPa at 2.65 s; upstream at least 566.244 kPa at 2.44 s', near(c.t, 2.25, 1e-9) && dec(c.Vprev, 0.00588, 5) && near(c.down, 1259.230, 0.001) && near(c.tDown, 2.65, 1e-9) && near(c.up, 566.244, 0.001) && near(c.tUp, 2.44, 1e-9), closingText(c));
}
// up to the time a disc leaves its stop, the dynamic models give the instantaneous one
const sameUntil = (a, b, t1) => [...a.times].every((tt, i) => tt > t1 + 1e-9 || ['P1', 'P2', 'm'].every((f) => near(a.junctions[2].series[f][i], b.junctions[2].series[f][i], 1e-9 * Math.max(1, Math.abs(a.junctions[2].series[f][i])))));
console.log('\nT25 Check valve by deceleration');
{
  const r = simulate(tCheck('decel', { decel: { x: [0, 0.5, 1, 2, 5, 10], y: [0, 0.05, 0.12, 0.30, 0.90, 2.0], xUnit: 'm/s²', yUnit: 'm/s' }, decelWindow: q(0.1, 's') }));
  const inv = r.log.find((e) => e.key === 'surge.log.checkDecel');
  check('reverses at 2.25 s, with a_d = 1.04916 m/s² and V_R = 0.12885 m/s (the log)', !!inv && near(inv.t, 2.25, 1e-9) && dec(inv.params.ad, 1.04916, 5) && dec(inv.params.VR, 0.12885, 5), inv ? `${inv.t} s, ${inv.params.ad.toFixed(5)} m/s², ${inv.params.VR.toFixed(5)} m/s` : '—');
  const c = closing(r);
  check('closes at 2.37 s; the velocity before it −0.11931 m/s (2.36 s); downstream at most 1379.745 kPa at 2.76 s; upstream at least 442.309 kPa at 2.56 s', near(c.t, 2.37, 1e-9) && dec(c.vmin, -0.11931, 5) && near(c.tv, 2.36, 1e-9) && near(c.down, 1379.745, 0.001) && near(c.tDown, 2.76, 1e-9) && near(c.up, 442.309, 0.001) && near(c.tUp, 2.56, 1e-9), closingText(c));
  check('the same as the instantaneous check valve until it reverses', sameUntil(r, t24run, 2.24));
}
console.log('\nT26 Swing check valve with its inertia');
{
  const r = simulate(tCheck('swing', { swing: swingT26() }));
  const s = r.junctions[2].series;
  check('steady torque at its stop: +32.0861 N·m (open)', dec(s.Td[0], 32.0861, 4), s.Td[0].toFixed(4));
  const leaves = r.log.find((e) => e.key === 'surge.log.discLeaves');
  check('leaves its stop at 0.98 s', !!leaves && near(leaves.t, 0.98, 1e-9), leaves ? `${leaves.t} s` : '—');
  const ang = { 1.2: 55.7906, 1.4: 41.5325, 1.6: 34.4065, 2.0: 19.4769, 2.2: 7.6478 };
  check('the angle at 1.2, 1.4, 1.6, 2.0 and 2.2 s', Object.entries(ang).every(([tt, v]) => dec(s.th[idx(r, +tt)] * 180 / Math.PI, v, 4)), Object.keys(ang).map((tt) => (s.th[idx(r, +tt)] * 180 / Math.PI).toFixed(4)).join(' '));
  const c = closing(r);
  check('closes at 2.29 s; the velocity before it −0.03171 m/s (2.28 s); downstream at most 1299.878 kPa at 2.68 s; upstream at least 545.360 kPa at 2.47 s', near(c.t, 2.29, 1e-9) && dec(c.vmin, -0.03171, 5) && near(c.tv, 2.28, 1e-9) && near(c.down, 1299.878, 0.001) && near(c.tDown, 2.68, 1e-9) && near(c.up, 545.360, 0.001) && near(c.tUp, 2.47, 1e-9), closingText(c));
  check('the same as the instantaneous check valve until it leaves its stop', sameUntil(r, t24run, 0.97));
}
console.log('\nT27 Nozzle check valve');
{
  const r = simulate(tCheck('nozzle', { nozzle: nozzleT27() }));
  const s = r.junctions[2].series;
  check('steady force at its stop: +66.8182 N', dec(s.Fd[0], 66.8182, 4), s.Fd[0].toFixed(4));
  const leaves = r.log.find((e) => e.key === 'surge.log.discLeaves');
  check('leaves its stop at 0.82 s', !!leaves && near(leaves.t, 0.82, 1e-9), leaves ? `${leaves.t} s` : '—');
  const trav = { 1.0: 40.6323, 1.2: 34.5055, 1.4: 27.3983, 1.6: 20.1930, 2.0: 8.3920, 2.2: 1.1548 };
  check('the travel at 1.0, 1.2, 1.4, 1.6, 2.0 and 2.2 s', Object.entries(trav).every(([tt, v]) => dec(s.xd[idx(r, +tt)] * 1000, v, 4)), Object.keys(trav).map((tt) => (s.xd[idx(r, +tt)] * 1000).toFixed(4)).join(' '));
  const c = closing(r);
  check('closes at 2.25 s without reverse flow (V = 0.00135 m/s the step before); downstream at most 1259.199 kPa at 2.64 s; upstream at least 561.254 kPa at 2.44 s', near(c.t, 2.25, 1e-9) && dec(c.Vprev, 0.00135, 5) && c.vmin > 0 && near(c.down, 1259.199, 0.001) && near(c.tDown, 2.64, 1e-9) && near(c.up, 561.254, 0.001) && near(c.tUp, 2.44, 1e-9), closingText(c));
}

console.log('\nT28 Unsteady friction of Brunone');
{
  const brunone = (k) => {
    const m = t3(0.02);
    m.solution.surge.friction = 'brunone';
    m.solution.surge.duration = q(20, 's');
    m.pipes[0].surge.k = k;
    return simulate(m);
  };
  const r0 = brunone(0), m4 = t3(0.02);
  m4.solution.surge.duration = q(20, 's');
  const r4 = simulate(m4);
  check('with k = 0 the case gives T4 exactly (bit for bit)', r0.pipes[1].series.P.every((x, s) => x.every((v, i) => Object.is(v, r4.pipes[1].series.P[s][i]))));
  const r = brunone(0.05), P = r.pipes[1].series.P[1];
  const valve = { 1: 3185.734, 3: 863.119, 5: 3090.816, 7: 952.688, 9: 3006.117, 11: 1033.045, 13: 2929.543, 15: 1106.395, 17: 2858.872, 19: 1174.899 };
  for (const [tt, v] of Object.entries(valve)) check(`k = 0.05, valve at ${tt} s: ${v} kPa`, near(kPa(P[idx(r, +tt)]), v, 0.001), f3(kPa(P[idx(r, +tt)])));
  const windows = [[3197.552, 851.338], [3102.539, 941.015], [3017.819, 1021.128], [2941.977, 1093.019], [2873.749, 1157.843]];
  const got = windows.map((_, w) => { let mx = -Infinity, mn = Infinity; r.times.forEach((tt, i) => { if (tt > 4 * w + 1e-9 && tt <= 4 * w + 4 + 1e-9) { mx = Math.max(mx, P[i]); mn = Math.min(mn, P[i]); } }); return [kPa(mx), kPa(mn)]; });
  check('k = 0.05: the largest and smallest at the valve in every window of 4 s', got.every(([mx, mn], w) => near(mx, windows[w][0], 0.001) && near(mn, windows[w][1], 0.001)), got.map(([a, b]) => `${f3(a)}/${f3(b)}`).join(' '));
  const K = SG.network.brunoneK;
  check('k from the Reynolds number: 0.034496 (1500), 0.007422 (10⁵), 0.003697 (10⁶)', dec(K(1500), 0.034496, 6) && dec(K(1e5), 0.007422, 6) && dec(K(1e6), 0.003697, 6), `${K(1500).toFixed(6)} ${K(1e5).toFixed(6)} ${K(1e6).toFixed(6)}`);
}

console.log('\nT29 Discrete gas cavities');
{
  for (const [psi, exp] of [[0.95, { V: 1191.349, back: 0.86, peak: 1678.590, tPeak: 1.03 }], [1, { V: 1191.938, back: 0.86, peak: 1673.138, tPeak: 1.03 }]]) {
    const m = t7(psi);
    Object.assign(m.solution.surge, { cavitation: 'dgcm', alpha0: 1e-7, p0: q(101.325, 'kPa(a)') });
    const r = simulate(m);
    const P = seriesOf(r, 1, 10, 'P'), V = seriesOf(r, 1, 10, 'V'), times = [...r.times];
    const X = r.extremes.pipes[1];
    if (psi === 0.95) {
      check('gas at the valve at the start (half a section): 1.351209·10⁻³ cm³; the valve at 0.01 s: 1289.202 kPa', dec(V[0] * 1e9, 1.351209, 6) && near(kPa(P[1]), 1289.202, 0.001), `${(V[0] * 1e9).toFixed(6)}·10⁻³ cm³, ${f3(kPa(P[1]))} kPa`);
      const below = times.filter((tt, i) => P[i] < 10e3);
      check('the valve stays below 10 kPa from 0.21 s on, never below the vapour pressure: at least 2.340 kPa', near(below[0], 0.21, 1e-9) && near(kPa(X.Pmin[10]), 2.340, 0.001) && X.Pmin[10] > 2340, `${below[0]} s, ${kPa(X.Pmin[10]).toFixed(4)} kPa`);
    }
    const iV = times.indexOf(X.tVmax[10]);
    const back = times.find((tt, i) => i > iV && P[i] > 300e3);
    let pk = -Infinity, tp = NaN;
    times.forEach((tt, i) => { if (tt >= back && P[i] > pk) { pk = P[i]; tp = tt; } });
    check(`ψ = ${psi}: largest gas volume at the valve ${exp.V} cm³ at 0.60 s (0.05 %)`, near(X.Vmax[10] * 1e6, exp.V, exp.V * 5e-4) && near(X.tVmax[10], 0.6, 1e-9), `${(X.Vmax[10] * 1e6).toFixed(3)} cm³ at ${X.tVmax[10]} s`);
    check(`ψ = ${psi}: back above 300 kPa at ${exp.back} s, the next peak ${exp.peak} kPa at ${exp.tPeak} s (0.05 %)`, near(back, exp.back, 1e-9) && near(kPa(pk), exp.peak, exp.peak * 5e-4) && near(tp, exp.tPeak, 1e-9), `${back} s, ${f3(kPa(pk))} kPa at ${tp} s`);
  }
}

console.log('\nT30 Unbalanced forces');
{
  const m = t3(0.02);
  m.solution.surge.forces = [
    { name: 'pipe', kind: 'segment', a: { pipe: 1, x: q(0, 'm') }, b: { pipe: 1, x: q(1200, 'm') }, ambient: 'atm' },
    { name: 'end', kind: 'point', a: { pipe: 1, x: q(1200, 'm') }, ambient: 'atm' },
  ];
  const r = simulate(m);
  const [seg, pt] = r.forces;
  const kN = (f, tt) => f.series[idx(r, tt)] / 1e3;
  check('the segment of the pipe of T4 between its stations 0 and 10: 0 in the steady state', Math.abs(seg.steady) < 1e-6 && seg.a.i === 0 && seg.b.i === 10, `${seg.steady.toExponential(1)} N`);
  const segT = { 0.1: 235.215, 0.5: 234.274, 1.0: 232.863, 2.0: 230.898, 2.1: -231.167, 3.0: -228.963, 4.1: 226.891 };
  check('the segment at 0.1, 0.5, 1.0, 2.0, 2.1, 3.0 and 4.1 s (kN)', Object.entries(segT).every(([tt, v]) => near(kN(seg, +tt), v, 0.001)), Object.keys(segT).map((tt) => kN(seg, +tt).toFixed(3)).join(' '));
  check('the segment: at most 235.215 kN at 0.1 s, at least −231.167 kN at 2.1 s', near(seg.max / 1e3, 235.215, 0.001) && near(seg.tmax, 0.1, 1e-9) && near(seg.min / 1e3, -231.167, 0.001) && near(seg.tmin, 2.1, 1e-9) && near(seg.p2p, seg.max - seg.min, 1e-9));
  check('at station 10: 368.198 kN in the steady state, 603.766 kN at 0.1 s, 145.930 kN at 2.1 s', near(pt.steady / 1e3, 368.198, 0.001) && near(kN(pt, 0.1), 603.766, 0.001) && near(kN(pt, 2.1), 145.930, 0.001), `${(pt.steady / 1e3).toFixed(3)} ${kN(pt, 0.1).toFixed(3)} ${kN(pt, 2.1).toFixed(3)}`);
  const m5 = t5();
  m5.solution.surge.forces = [{ name: 'exit', kind: 'exit', a: { pipe: 1, x: q(0, 'm') }, b: { pipe: 1, x: q(600, 'm') }, ambient: 'atm', As: q(0.02, 'm²') }];
  const r5 = simulate(m5);
  const ex = r5.forces[0];
  const exT = { 0: -1.965, 1: 31.254, 2: 54.179, 3: 62.598, 4: -62.142, 5: 61.692 };
  check('the exit of T5 from station 0 to the exit valve, A_s = 0.02 m² (kN)', Object.entries(exT).every(([tt, v]) => near(ex.series[idx(r5, +tt)] / 1e3, v, 0.001)), Object.keys(exT).map((tt) => (ex.series[idx(r5, +tt)] / 1e3).toFixed(4)).join(' '));
  check('the exit: at most 62.598 kN at 3.00 s, at least −62.142 kN at 4.00 s', near(ex.max / 1e3, 62.598, 0.001) && near(ex.tmax, 3, 1e-9) && near(ex.min / 1e3, -62.142, 0.001) && near(ex.tmin, 4, 1e-9), `${(ex.max / 1e3).toFixed(4)} at ${ex.tmax} s, ${(ex.min / 1e3).toFixed(4)} at ${ex.tmin} s`);
}

console.log('\nT31 The steady state holds (phase G3)');
{
  const holds = (name, m) => {
    const r = simulate(m, 'base', { steps: 200 });
    let dP = 0, dm = 0, mRef = 0;
    for (const id in r.pipes) mRef = Math.max(mRef, Math.abs(r.pipes[id].steady.m));
    for (const id in r.pipes) {
      const p = r.pipes[id], X = r.extremes.pipes[id];
      for (let i = 0; i <= p.n; i++) {
        const P0 = p.steady.P[i];
        dP = Math.max(dP, Math.abs(X.Pmax[i] - P0) / Math.abs(P0), Math.abs(X.Pmin[i] - P0) / Math.abs(P0));
        dm = Math.max(dm, Math.abs(X.mmax[i] - p.steady.m), Math.abs(X.mmin[i] - p.steady.m));
      }
    }
    check(`${name}: the test step passes, 200 steps within 10⁻⁶`, r.artificial.ok && dP <= 1e-6 && dm <= 1e-6 * mRef, `ΔP ${dP.toExponential(1)}, Δṁ ${(dm / mRef).toExponential(1)}`);
  };
  holds('T22 without the trip', t8x('on', null, fourQ('steady'), null, 2));
  holds('T26 without the table of J1', tCheck('swing', { swing: swingT26() }, false));
  holds('T27 without the table of J1', tCheck('nozzle', { nozzle: nozzleT27() }, false));
  const mb = t3(0.02);
  mb.junctions[1].surge = null;
  Object.assign(mb.solution.surge, { friction: 'brunone' });
  mb.pipes[0].surge.k = 0.05;
  holds('T4 with Brunone (k = 0.05) without the closure', mb);
  const mg = t7(0.95);
  mg.junctions[1].surge = null;
  mg.solution.surge.cavitation = 'dgcm';
  holds('T7 with gas cavities without the closure', mg);
}

console.log('\nG3  Checklists of the addendum');
{
  const undef = (m, key) => M.validate(M.effective(m, 'base')).undef.get(key) || [];
  const has = (m, key, k) => undef(m, key).includes(PumpIt.i18n.t('surge.checklist.' + k));
  const pump = (four, state = 'on', what = null) => t8x(state, what, four, null, 1);
  check('four quadrants: a periodic table of at least 9 points from 0 to 360°', has(pump(fourQ('steady', { theta: TH.slice(0, 8), wh: WH.slice(0, 8), wb: WB.slice(0, 8) })), 'j:2', 'pump.fourTable') && has(pump(fourQ('steady', { wh: WH.slice(0, -1).concat([0.7]) })), 'j:2', 'pump.fourTable') && !has(pump(fourQ('steady')), 'j:2', 'pump.fourTable'));
  check('four quadrants: the steady reference needs the pump running, the user one its four values', has(pump(fourQ('steady'), 'offClosed', 'start'), 'j:2', 'pump.fourSteady') && has(pump(fourQ('user')), 'j:2', 'pump.fourUser') && !has(pump(fourQ('user', { Q: q(0.165, 'm³/s'), H: q(43, 'm'), N: q(1750, 'rpm'), P: q(90, 'kW') })), 'j:2', 'pump.fourUser'));
  const offSpeed = t8x('offClosed', null, fourQ('bep'), null, 1);
  offSpeed.junctions[2].surge = { use: true, what: 'speed', basis: 'absolute', start: 'time', when: [], tables: [{ t: [0, 1], v: [0, 100], tUnit: 's', vUnit: '%' }], repeat: false, interp: 'linear' };
  check('four quadrants: a table of speed starts a pump off and closed (a start with a known speed)', !has(offSpeed, 'j:2', 'pump.mode') && M.validate(M.effective(offSpeed, 'base')).ok);
  const ck = (props) => tCheck('swing', Object.assign({ swing: swingT26() }, props));
  check('dynamic check valves: a quadratic loss fully open (K, Cv or Kv)', has(ck({ lossModel: 'opening', char: 'linear', CvMax: 300, open: 100 }), 'j:2', 'check.loss') && !has(ck({}), 'j:2', 'check.loss'));
  check('dynamic check valves: the table of the deceleration, the inertia of a disc and a table of its Cv up to its stop', has(tCheck('decel', { decel: { x: [1], y: [0.1], xUnit: 'm/s²', yUnit: 'm/s' } }), 'j:2', 'check.decel')
    && has(ck({ swing: Object.assign(swingT26(), { I: q(null, 'kg·m²') }) }), 'j:2', 'check.inertia') && has(ck({ swing: Object.assign(swingT26(), { thetaMax: q(70, '°') }) }), 'j:2', 'check.cvTable'));
  const cg = t7(0.95);
  Object.assign(cg.solution.surge, { cavitation: 'dgcm', alpha0: 0 });
  check('gas cavities: a void fraction above zero', has(cg, 'surge', 'control.alpha0') || M.validate(M.effective(cg, 'base')).items.some((i) => i.key === 'surge' && !i.ok && i.detail.includes(PumpIt.i18n.t('surge.checklist.control.alpha0'))));
  const cf = t3(0.02);
  cf.solution.surge.forces = [{ name: 'F', kind: 'segment', a: { pipe: 1, x: q(0, 'm') }, b: { pipe: 7, x: q(10, 'm') }, ambient: 'atm' }];
  check('forces: a set needs pipes of the model', M.validate(M.effective(cf, 'base')).items.some((i) => i.key === 'surge' && !i.ok && i.detail.includes(PumpIt.i18n.t('surge.checklist.control.forces'))));
  const ckk = t3(0.02);
  ckk.pipes[0].surge.k = -1;
  check('Brunone: the coefficient of a pipe is 0 or more, or empty', has(ckk, 'p:1', 'pipe.k'));
}

// ---------- T12: every example keeps its steady state
console.log('\nT12 The steady state holds');
{
  for (const ex of PumpIt.examples.EXAMPLES) {
    const m = ex.build();
    if (M.isCompressible(m)) continue;
    m.solution.surge = Object.assign(SG.inputs.newControl(), { on: true });
    m.solution.time.on = false;
    // a pipe out of the catalogues has no wall to calculate its wave speed from: it gets one
    const K = SG.wavespeed.fluidK(m.system);
    let given = 0;
    for (const p of m.pipes) if (SG.wavespeed.inputs(p, K).miss.length) { p.surge = { wave: 'given', a: q(1200, 'm/s') }; given++; }
    const eff = M.effective(m, 'base');
    const v = M.validate(eff);
    if (!v.ok) { check(`${ex.id}: checklist complete`, false, JSON.stringify(v.items.filter((i) => !i.ok)) + JSON.stringify([...v.undef])); continue; }
    const r = SG.run(eff, { steps: 200 });
    if (!r.ok) { check(`${ex.id}: runs`, false, r.errors.join('; ')); continue; }
    let dP = 0, dm = 0, mRef = 0;
    for (const id in r.pipes) mRef = Math.max(mRef, Math.abs(r.pipes[id].steady.m));
    for (const id in r.pipes) {
      const p = r.pipes[id], X = r.extremes.pipes[id];
      for (let i = 0; i <= p.n; i++) {
        const P0 = p.steady.P[i];
        dP = Math.max(dP, Math.abs(X.Pmax[i] - P0) / Math.abs(P0), Math.abs(X.Pmin[i] - P0) / Math.abs(P0));
        dm = Math.max(dm, Math.abs(X.mmax[i] - p.steady.m), Math.abs(X.mmin[i] - p.steady.m));
      }
    }
    check(`${ex.id}: test step passes, 200 steps within 1e-6`, r.artificial.ok && dP <= 1e-6 && dm <= 1e-6 * mRef, `${r.N} steps, Δt ${r.dt.toPrecision(4)} s, ΔP ${dP.toExponential(1)}, Δṁ ${(dm / mRef).toExponential(1)}${given ? `, ${given} pipe(s) with a given wave speed` : ''}`);
  }
}

// ---------- T13: closure started by an event
console.log('\nT13 Closure started by an event');
{
  const r = simulate(t5('single', [{ q: 'time', op: '>=', value: q(0.49, 's') }]));
  const valve = (t) => kPa(Pat(r, 1, 10, t));
  const ev = r.log.find((e) => e.key === 'surge.log.tableStarted');
  check('the event fires at 0.50 s', ev && near(ev.t, 0.5, 1e-9), ev ? String(ev.t) : '—');
  check('valve at 1.5 s: 1354.241 kPa (T5 shifted by 0.5 s)', near(valve(1.5), 1354.241, 0.001), f3(valve(1.5)));
  const X = r.extremes.pipes[1];
  check('maximum 1885.578 kPa at 3.50 s', near(kPa(X.Pmax[10]), 1885.578, 0.001) && near(X.tPmax[10], 3.5, 1e-9), `${f3(kPa(X.Pmax[10]))} at ${X.tPmax[10]}`);
}

// ---------- T14: envelopes
console.log('\nT14 Envelopes and extremes');
{
  const X = t4run.extremes.pipes[1];
  const max = [2000.000, 3187.049, 3188.245, 3189.442, 3190.638, 3191.835, 3193.032, 3194.228, 3195.425, 3196.621, 3197.818];
  const min = [2000.000, 833.777, 832.581, 831.385, 830.190, 828.994, 827.798, 826.602, 825.407, 824.211, 823.015];
  check('maximum of every station', max.every((v, i) => near(kPa(X.Pmax[i]), v, 0.001)), [...X.Pmax].map((x) => f3(kPa(x))).join(' '));
  check('minimum of every station', min.every((v, i) => near(kPa(X.Pmin[i]), v, 0.001)), [...X.Pmin].map((x) => f3(kPa(x))).join(' '));
}

// ---------- T17: reproducibility
console.log('\nT17 Reproducibility');
{
  const same = (a, b) => {
    if (a.times.length !== b.times.length) return false;
    for (const id in a.pipes) for (const f of ['P', 'mU', 'mD']) for (let s = 0; s < a.pipes[id].series[f].length; s++) {
      const x = a.pipes[id].series[f][s], y = b.pipes[id].series[f][s];
      for (let i = 0; i < x.length; i++) if (!Object.is(x[i], y[i])) return false;
    }
    for (const id in a.junctions) for (const f of a.junctions[id].fields) {
      const x = a.junctions[id].series[f], y = b.junctions[id].series[f];
      for (let i = 0; i < x.length; i++) if (!Object.is(x[i], y[i])) return false;
    }
    return true;
  };
  for (const [name, build, first] of [['T5', () => t5(), t5run], ['T8', t8, t8run]]) {
    const again = simulate(build());
    const eff = M.effective(build(), 'base');
    const job = SG.start(eff);
    let calls = 0;
    while (!job.step(0).done) calls++;
    const sliced = job.result();
    check(`${name}: twice and in ${calls + 1} slices, identical bit for bit`, same(first, again) && same(first, sliced));
  }
}

// ---------- T18: a child scenario
console.log('\nT18 Child scenario');
{
  const m = t5();
  const s = M.addScenario(m, 'base', 'slow');
  M.setField(m, s.id, 'sol', 'surge.duration', q(12, 's'));
  const d = M.clone(m.junctions[1].surge);
  d.tables[0].t = [0, 6];
  M.setField(m, s.id, 'j:2', 'surge', d);
  const rb = simulate(m, 'base'), rc = simulate(m, s.id);
  const Xb = rb.extremes.pipes[1], Xc = rc.extremes.pipes[1];
  check('the base scenario gives T5', near(kPa(Xb.Pmax[10]), 1885.578, 0.001) && near(rb.duration, 10, 1e-9));
  check('the child gives a lower maximum at the valve, over 12 s', kPa(Xc.Pmax[10]) < 1885.578 - 1 && near(rc.duration, 12, 1e-9), f3(kPa(Xc.Pmax[10])));
  check('the base scenario does not change', m.junctions[1].surge.tables[0].t[1] === 3 && m.solution.surge.duration.value === 10);
}

// ---------- the module is off by default, and the checklist
console.log('\nModule and checklist');
{
  const m = M.newModel();
  check('a new model has the water hammer off', !SG.inputs.isOn(m) && !SG.inputs.controlOf(m).on);
  const old = { solution: {} };
  SG.inputs.normalize(old);
  check('a model saved before it stays without the control, and reads it off', old.solution.surge === undefined && !SG.inputs.isOn(old) && SG.inputs.controlOf(old).cavitation === 'dvcm');
  const bad = { solution: { surge: { on: 'yes', cavitation: 'x', duration: 5, artificial: { stop: false } } } };
  SG.inputs.normalize(bad);
  const bc = bad.solution.surge;
  check('a damaged control gets its defaults, off', bc.on === false && bc.cavitation === 'dvcm' && bc.duration.unit === 's' && bc.artificial.stop === false && bc.artificial.criterion === 0.5);
  const g = t5();
  g.system.regime = 'compressible';
  const vg = M.validate(M.effective(g, 'base'));
  check('refused in the compressible mode', !vg.ok && vg.items.some((i) => i.key === 'surge' && !i.ok));
  const tm = t5();
  tm.solution.time.on = true;
  const vt = M.validate(M.effective(tm, 'base'));
  check('refused with the time simulation on', !vt.ok && vt.items.some((i) => i.key === 'surge' && !i.ok));
  const np = t5();
  np.pipes[0].surge = { wave: 'calculated' };
  const vn = M.validate(M.effective(np, 'base'));
  check('a calculated wave speed needs the wall of a pipe out of the catalogues', !vn.ok && (vn.undef.get('p:1') || []).length > 0, (vn.undef.get('p:1') || []).join('; '));
  const off = t5();
  off.solution.surge.on = false;
  off.pipes[0].surge = { wave: 'calculated' };
  const vo = M.validate(M.effective(off, 'base'));
  check('with the water hammer off its data are not checked', vo.ok);
}

// ---------- review of 6c4f0fa, item 9: a level table of the reservoir J1 of the example of pumping between tanks, 3 and
// 2.7 m in 1 s, is the same run given in % of the steady level, 100 and 90 %
console.log('\nA level table in metres or in % of the steady level');
{
  const levelRun = (tb, basis) => {
    const m = PumpIt.examples.get('pump').build();
    m.solution.surge = Object.assign(SG.inputs.newControl(), { on: true, duration: { value: 1, unit: 's' } });
    m.junctions.find((j) => j.id === 1).surge = { use: true, what: 'level', basis, start: 'time', when: [], tables: [tb], repeat: false, interp: 'linear' };
    return simulate(m);
  };
  const a = levelRun({ t: [0, 1], v: [3, 2.7], tUnit: 's', vUnit: 'm' }, 'absolute');
  const b = levelRun({ t: [0, 1], v: [100, 90], tUnit: 's', vUnit: '%' }, 'relative');
  const n = a.times.length, Pa = seriesOf(a, 1, 0, 'P'), Pb = seriesOf(b, 1, 0, 'P');
  check('171 samples and 127 070.44 Pa at the end, at the first station of P1', n === 171 && b.times.length === 171 && Math.abs(Pa[n - 1] - 127070.44) < 0.005, `${n} ${Pa[n - 1]}`);
  check('the two representations give the same series', Pa.every((x, i) => Math.abs(x - Pb[i]) <= 1e-9 * Math.abs(x)));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
