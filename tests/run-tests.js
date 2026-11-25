// Verification suite of the calculation core. Usage: node tests/run-tests.js
// Each case compares the network solver with an independent solution (analytical or by bisection).
const { loadCore } = require('./load-core');

const PumpIt = loadCore('en'); // some checks read texts of the results (valve states, warnings)
const { model: M, solver: S, hyd: H, units: U, fluids: F } = PumpIt;
const q = M.q;

let pass = 0, fail = 0;
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log('  ok   ' + name + (detail ? '  ' + detail : '')); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  ' + detail : '')); }
}
const rel = (a, b) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-300);
const bisect = (f, a, b) => { let fa = f(a); for (let i = 0; i < 200; i++) { const m = (a + b) / 2, fm = f(m); if ((fm > 0) === (fa > 0)) { a = m; fa = fm; } else b = m; } return (a + b) / 2; };

function solveOk(m, sid = 'base') {
  const eff = M.effective(m, sid);
  const v = M.validate(eff);
  if (!v.ok) throw new Error('Invalid model: ' + JSON.stringify([...v.undef]));
  const r = S.run(eff);
  if (!r.ok) throw new Error('Failed: ' + r.errors.join('; '));
  return r;
}

console.log('\nProperties and correlations');
{
  check('water ρ at 20 °C (Kell) ≈ 998.21 kg/m³', rel(F.waterDensity(20), 998.21) < 2e-4, F.waterDensity(20).toFixed(3));
  check('water μ at 20 °C (Vogel) ≈ 1.002 mPa·s', rel(F.waterViscosity(20), 1.0016e-3) < 5e-3, (F.waterViscosity(20) * 1e3).toFixed(4));
  check('Psat at 100 °C (IF97) = 101.418 kPa', rel(F.waterVaporPressure(100), 101418) < 1e-4, F.waterVaporPressure(100).toFixed(1));
  check('Psat at 20 °C (IF97) ≈ 2.339 kPa', rel(F.waterVaporPressure(20), 2339.2) < 1e-3, F.waterVaporPressure(20).toFixed(1));
  // original form of Colebrook: direct check of the implicit equation
  const f = H.colebrook(1e5, 1e-4);
  const resid = 1 / Math.sqrt(f) - (1.14 - 2 * Math.log10(1e-4 + 9.35 / (1e5 * Math.sqrt(f))));
  check('Colebrook (1.14 / 9.35) satisfies the equation', Math.abs(resid) < 1e-12, 'f = ' + f.toFixed(6));
  check('Crane f_T, 2" sch 40 ≈ 0.019', Math.abs(H.craneFT(0.0525) - 0.019) < 0.0006, H.craneFT(0.0525).toFixed(4));
  check('Continuous transition at Re = 4000', rel(H.frictionFactor(4000, 1e-4), H.frictionFactor(4000.0001, 1e-4)) < 1e-6);
  check('Conversion gpm → m³/s', rel(U.toSI(100, 'gpm', 'volFlow'), 6.30902e-3) < 1e-5);
  check('Conversion bar(g) → absolute Pa', U.toSI(1, 'bar(g)', 'pressure', { patm: 101325 }) === 201325);
  check('Conversion °F → K', rel(U.toSI(212, '°F', 'temperature'), 373.15) < 1e-12);
  // the Convert value command of the inspector: flows within a family need no density, pressures need the ambient
  // pressure only between gauge and absolute units, and what is missing is named
  check('Convert 15 m → 15000 mm', rel(U.convert(15, 'm', 'mm', 'length'), 15000) < 1e-12);
  check('Convert 20 °C → 68 °F', rel(U.convert(20, '°C', '°F', 'temperature'), 68) < 1e-12);
  check('Convert m³/h → L/s without a density', U.convertNeeds('m³/h', 'L/s', 'flow', {}) === null && rel(U.convert(36, 'm³/h', 'L/s', 'flow'), 10) < 1e-12);
  check('Convert m³/h → kg/s needs the density', U.convertNeeds('m³/h', 'kg/s', 'flow', {}) === 'rho' && rel(U.convert(36, 'm³/h', 'kg/s', 'flow', { rho: 1000 }), 10) < 1e-12);
  check('Convert Nm³/h → kg/h needs the normal density', U.convertNeeds('Nm³/h', 'kg/h', 'flow', {}) === 'rhoN' && rel(U.convert(100, 'Nm³/h', 'kg/h', 'flow', { rhoN: 1.293 }), 129.3) < 1e-12);
  check('Convert bar(g) → bar(a) needs the ambient pressure', U.convertNeeds('bar(g)', 'bar(a)', 'pressure', {}) === 'patm' && rel(U.convert(1, 'bar(g)', 'bar(a)', 'pressure', { patm: 101325 }), 2.01325) < 1e-12);
  check('Convert bar(g) → kPa(g) without it', U.convertNeeds('bar(g)', 'kPa(g)', 'pressure', {}) === null && rel(U.convert(1, 'bar(g)', 'kPa(g)', 'pressure', {}), 100) < 1e-12);
  const c = H.polyfit([0, 1, 2, 3], [5, 3, -3, -13], 2);
  check('Exact polynomial fit (5 − 2x²)', Math.abs(c[0] - 5) < 1e-9 && Math.abs(c[1]) < 1e-9 && Math.abs(c[2] + 2) < 1e-9);
}

console.log('\nSingle pipe between reservoirs (Darcy + Colebrook)');
{
  const m = M.newModel();
  m.junctions.push(Object.assign(M.newJunction('reservoir', 1, 0, 0), { liquidElev: q(30, 'm'), elevation: q(0, 'm') }));
  m.junctions.push(Object.assign(M.newJunction('reservoir', 2, 100, 0), { liquidElev: q(10, 'm'), elevation: q(0, 'm') }));
  const p = M.newPipe(1, 1, 2);
  p.length = q(800, 'm'); p.geometry.d = q(150, 'mm'); p.friction.eps = q(0.05, 'mm');
  m.pipes.push(p);
  const r = solveOk(m);
  const fl = F.evaluate(m.system);
  const D = 0.15, L = 800, g = 9.80665, eps = 0.05e-3;
  const V = bisect((V) => { const Re = fl.rho * V * D / fl.mu; return H.frictionFactor(Re, eps / D) * L / D * V * V / 2 - g * 20; }, 0.01, 20);
  check('Velocity equals the analytical solution', rel(r.pipes[1].V, V) < 1e-7, `${r.pipes[1].V.toFixed(6)} × ${V.toFixed(6)} m/s`);
  check('Converged', r.converged, r.iterations + ' iterations');
  // entrance and exit losses are not automatic: P0 at the pipe end = tank P0 + ρg(z_surface − z_end)
  const P0exp = r.patm + fl.rho * g * 30;
  check('P0 at the upstream end = P_surface + ρg·h', rel(r.pipes[1].P0in, P0exp) < 1e-9);
}

console.log('\nReservoir connections by elevation and by depth');
{
  // two tanks and one pipe; r1 and r2 add to the tanks (surfaces at 30 m and 10 m, bottoms at 0 m)
  const build = (r1 = {}, r2 = {}) => {
    const m = M.newModel();
    m.junctions.push(Object.assign(M.newJunction('reservoir', 1, 0, 0), { liquidElev: q(30, 'm'), elevation: q(0, 'm') }, r1));
    m.junctions.push(Object.assign(M.newJunction('reservoir', 2, 100, 0), { liquidElev: q(10, 'm'), elevation: q(0, 'm') }, r2));
    const p = M.newPipe(1, 1, 2);
    p.length = q(800, 'm'); p.geometry.d = q(150, 'mm'); p.friction.eps = q(0.05, 'mm');
    m.pipes.push(p);
    return m;
  };
  const fl = F.evaluate(M.newModel().system);
  const g = 9.80665, D = 0.15, L = 800, eps = 0.05e-3;
  const P0at = (r, h) => r.patm + fl.rho * g * h; // stagnation pressure h metres under a surface at the atmospheric pressure
  const byElev = (z) => ({ pipeK: { 1: { kOut: 0, kIn: 0, elev: q(z, 'm') } } });
  const byDepth = (d, unit = 'm') => ({ connBy: 'depth', pipeK: { 1: { kOut: 0, kIn: 0, depth: q(d, unit) } } });
  const rE = solveOk(build(byElev(20))), rD = solveOk(build(byDepth(10)));
  check('A depth of 10 m under a surface at 30 m = an elevation of 20 m', rel(rD.pipes[1].m, rE.pipes[1].m) < 1e-12 && rel(rD.pipes[1].P0in, rE.pipes[1].P0in) < 1e-12);
  check('P0 at the connection = P_surface + ρg·depth', rel(rD.pipes[1].P0in, P0at(rD, 10)) < 1e-9);
  check('A depth in feet', rel(solveOk(build(byDepth(10 / 0.3048, 'ft'))).pipes[1].P0in, P0at(rD, 10)) < 1e-9);
  // the level 5 m higher: a depth goes with the surface, an elevation stays where it is
  const up = { liquidElev: q(35, 'm') };
  const rE2 = solveOk(build(Object.assign(byElev(20), up))), rD2 = solveOk(build(Object.assign(byDepth(10), up)));
  check('A higher level: the depth stays 10 m, the elevation 20 m', rel(rD2.pipes[1].P0in, P0at(rD2, 10)) < 1e-9 && rel(rE2.pipes[1].P0in, P0at(rE2, 15)) < 1e-9);
  // a blank cell is the bottom, and only the field of the reference in use counts
  const rB = solveOk(build({ connBy: 'depth', pipeK: { 1: { kOut: 0, kIn: 0, elev: q(20, 'm') } } }));
  check('By depth, a pipe without one connects at the bottom (its elevation is not used)', rel(rB.pipes[1].P0in, P0at(rB, 30)) < 1e-9);
  // a negative depth is above the surface: the pipe discharges in free fall, from 12 m
  const rF = solveOk(build({}, { connBy: 'depth', pipeK: { 1: { kOut: 0, kIn: 0, depth: q(-2, 'm') } } }));
  const V = bisect((V) => { const Re = fl.rho * V * D / fl.mu; return H.frictionFactor(Re, eps / D) * L / D * V * V / 2 - g * 18; }, 0.01, 20);
  check('A negative depth discharges in free fall above the surface', rel(rF.pipes[1].V, V) < 1e-7 && rel(rF.pipes[1].P0out, rF.patm) < 1e-9, `${rF.pipes[1].V.toFixed(6)} × ${V.toFixed(6)} m/s`);
  check('… as the same elevation does', rel(solveOk(build({}, byElev(12))).pipes[1].m, rF.pipes[1].m) < 1e-12);
}

console.log('\nHazen-Williams');
{
  const m = M.newModel();
  m.junctions.push(Object.assign(M.newJunction('reservoir', 1, 0, 0), { liquidElev: q(25, 'm') }));
  m.junctions.push(Object.assign(M.newJunction('reservoir', 2, 100, 0), { liquidElev: q(5, 'm') }));
  const p = M.newPipe(1, 1, 2);
  p.length = q(1000, 'm'); p.geometry.d = q(200, 'mm'); p.friction = { model: 'hw', C: 120 };
  m.pipes.push(p);
  const r = solveOk(m);
  // V = k·C·R^0.63·S^0.54 with S = Δz/L (ρ g h = ρ g0 h with standard gravity)
  const V = H.HW_K * 120 * Math.pow(0.05, 0.63) * Math.pow(20 / 1000, 0.54);
  check('Velocity = classic formula', rel(r.pipes[1].V, V) < 1e-7, `${r.pipes[1].V.toFixed(6)} × ${V.toFixed(6)} m/s`);
}

console.log('\nPump × system (intersection by bisection)');
{
  const m = M.newModel();
  m.junctions.push(Object.assign(M.newJunction('reservoir', 1, 0, 0), { liquidElev: q(2, 'm') }));
  m.junctions.push(Object.assign(M.newJunction('pump', 2, 0, 0), { mode: 'curve',
    curve: { x: [0, 0.01, 0.02, 0.03], y: [40, 39, 36, 31], xUnit: 'm³/s', yUnit: 'm', fit: '2' },
  }));
  m.junctions.push(Object.assign(M.newJunction('reservoir', 3, 0, 0), { liquidElev: q(22, 'm') }));
  const p1 = M.newPipe(1, 1, 2); p1.length = q(10, 'm'); p1.geometry.d = q(100, 'mm');
  const p2 = M.newPipe(2, 2, 3); p2.length = q(400, 'm'); p2.geometry.d = q(100, 'mm');
  m.pipes.push(p1, p2);
  const r = solveOk(m);
  const fl = F.evaluate(m.system);
  const a = H.polyfit([0, 0.01, 0.02, 0.03], [40, 39, 36, 31], 2);
  const loss = (Q, L) => { const V = Q / (Math.PI * 0.01 / 4); const Re = fl.rho * V * 0.1 / fl.mu; return H.frictionFactor(Re, 0.046e-3 / 0.1) * L / 0.1 * V * V / (2 * 9.80665); };
  const Q = bisect((Q) => H.polyval(a, Q) - 20 - loss(Q, 10) - loss(Q, 400), 1e-6, 0.05);
  check('Flow at the operating point', rel(r.pumps[2].Q, Q) < 1e-7, `${(r.pumps[2].Q * 3600).toFixed(4)} × ${(Q * 3600).toFixed(4)} m³/h`);
  check('Pump head = curve at the point', rel(r.pumps[2].dH, H.polyval(a, Q)) < 1e-6);
  // affinity laws: at 80 % speed, H(Q) = s²·H1(Q/s)
  m.junctions[1].speed = 80;
  const r2 = solveOk(m);
  const Q2 = bisect((Q) => 0.64 * H.polyval(a, Q / 0.8) - 20 - loss(Q, 10) - loss(Q, 400), 1e-6, 0.05);
  check('Affinity at 80 % speed', rel(r2.pumps[2].Q, Q2) < 1e-7);
  // system curve
  const sc = S.systemCurve(M.effective(m, 'base'), 2, 8);
  const [Qs, Hs] = sc.sys[4];
  check('System curve = static head + losses', rel(Hs, 20 + loss(Qs, 10) + loss(Qs, 400)) < 1e-6);
}

console.log('\nThree reservoirs (mass and energy balance)');
{
  const r = solveOk(PumpIt.examples.get('threeRes').build());
  const sum = r.pipes[1].m - r.pipes[2].m - r.pipes[3].m;
  check('Continuity at the junction', Math.abs(sum) < 1e-9 * r.pipes[1].m, `ΣQ = ${sum.toExponential(2)} kg/s`);
  check('Flow from A to C', r.pipes[1].m > 0 && r.pipes[3].m > 0);
  const P0j = r.junctions[4].P0in;
  check('Consistent pressures at the pipe ends', rel(r.pipes[1].P0out, P0j) < 1e-12 && rel(r.pipes[2].P0in, P0j) < 1e-12);
}

console.log('\nLooped network (Hazen-Williams)');
{
  const m = PumpIt.examples.get('loop').build();
  const r = solveOk(m);
  const demand = 175 / 3600 * r.fluid.rho;
  check('Reservoir outflow = sum of the demands', rel(r.pipes[1].m, demand) < 1e-8);
  // loop N2-N3-N6-N5: the head losses add up to zero
  const dh = (id) => r.pipes[id].P0in - r.pipes[id].P0out + r.fluid.rho * r.g * (r.pipes[id].zin - r.pipes[id].zout);
  const loop = dh(2) + dh(7) - dh(5) - dh(4);
  check('Energy closes around the loop', Math.abs(loop) < 1e-3, `${loop.toExponential(2)} Pa`);
  check('No mass imbalance warnings', !r.warnings.some((w) => /imbalance/.test(w.text)));
}

console.log('\nPressure-reducing valve and scenarios');
{
  const m = PumpIt.examples.get('prv').build();
  const r = solveOk(m);
  const Ps = r.pipes[2].Pin - r.patm;
  check('PRV keeps 3 kgf/cm²(g) static downstream', Math.abs(Ps - 3 * 98066.5) < 1, `${(Ps / 98066.5).toFixed(6)} kgf/cm²(g)`);
  check('State: controlling', r.valves[2].state === 'controlling');
  const r2 = solveOk(m, 's1');
  check('Peak: the PRV goes fully open', r2.valves[2].state === 'fully open', r2.valves[2].state);
  check('Peak: imposed flow respected', rel(r2.pipes[2].Q * 3600, 300) < 1e-9);
  // inheritance rule: editing with the inherited value relinks the attribute to the parent
  M.setField(m, 's1', 'j:3', 'Q', q(80, 'm³/h'));
  check('A value equal to the inherited one removes the override', !M.isOverridden(m, 's1', 'j:3', 'Q'));
}

console.log('\nExit valve and controlled flow');
{
  // reservoir → pipe → exit valve with a residual pressure
  const m = M.newModel();
  m.junctions.push(Object.assign(M.newJunction('reservoir', 1, 0, 0), { liquidElev: q(30, 'm') }));
  m.junctions.push(Object.assign(M.newJunction('exitvalve', 2, 0, 0), { elevation: q(5, 'm'), Pout: q(1, 'kgf/cm²(g)') }));
  const p = M.newPipe(1, 1, 2);
  p.material.kind = 'user'; p.length = q(500, 'm'); p.geometry.d = q(100, 'mm'); p.friction.eps = q(0.05, 'mm');
  m.pipes.push(p);
  const fl = F.evaluate(m.system);
  const g = 9.80665, D = 0.1;
  const Vfor = (K) => bisect((V) => { const Re = fl.rho * V * D / fl.mu; return (H.frictionFactor(Re, 0.05e-3 / D) * 500 / D + K) * fl.rho * V * V / 2 - (fl.rho * g * 25 - 98066.5); }, 0.01, 20);
  const r = solveOk(m);
  check('Stagnation pressure at the outlet = residual (K = 0)', rel(r.pipes[1].P0out - r.patm, 98066.5) < 1e-9);
  check('Flow equals the analytical solution (K = 0)', rel(r.pipes[1].V, Vfor(0)) < 1e-7, `${(r.pipes[1].Q * 3600).toFixed(3)} m³/h`);
  m.junctions[1].K = 2;
  const r2 = solveOk(m);
  check('Flow with a loss in the exit valve (K = 2)', rel(r2.pipes[1].V, Vfor(2)) < 1e-7, `${(r2.pipes[1].Q * 3600).toFixed(3)} m³/h`);
  // FCV between two tanks
  const m2 = M.newModel();
  m2.junctions.push(Object.assign(M.newJunction('reservoir', 1, 0, 0), { liquidElev: q(15, 'm') }));
  m2.junctions.push(Object.assign(M.newJunction('control', 2, 0, 0), { ctype: 'FCV', setQ: q(30, 'm³/h') }));
  m2.junctions.push(Object.assign(M.newJunction('reservoir', 3, 0, 0), { liquidElev: q(0, 'm') }));
  m2.pipes.push(Object.assign(M.newPipe(1, 1, 2), { length: q(50, 'm') }), Object.assign(M.newPipe(2, 2, 3), { length: q(50, 'm') }));
  const r3 = solveOk(m2);
  check('FCV imposes the flow', rel(r3.pipes[2].Q * 3600, 30) < 1e-12);
  check('FCV dissipates the excess energy', r3.valves[2].dP > 0);
  // fixed-flow pump: reports the required head and does not use a curve
  const m3 = PumpIt.examples.get('pump').build();
  Object.assign(m3.junctions.find((j) => j.id === 2), { mode: 'fixedFlow', fixedFlow: q(90, 'm³/h'), curve: { x: [], y: [], xUnit: 'm³/h', yUnit: 'm', fit: '2' } });
  const r4 = solveOk(m3);
  check('Fixed-flow pump needs no curve', rel(r4.pumps[2].Q * 3600, 90) < 1e-12 && r4.pumps[2].dH > 22, `${r4.pumps[2].dH.toFixed(3)} m`);
}

console.log('\nSprinklers');
{
  const r = solveOk(PumpIt.examples.get('sprinkler').build());
  const k = U.toSI(80, 'L/min/bar½', 'kfactor');
  const j = r.junctions[3];
  // Q = K·√ΔP for water (reference density 1000 kg/m³)
  const Qexp = k * Math.sqrt(j.dP) * Math.sqrt(1000 / r.fluid.rho);
  check('Sprinkler flow = K·√ΔP', rel(j.Q, Qexp) < 1e-9, `${(j.Q * 60000).toFixed(2)} L/min`);
}

console.log('\nLaminar correction of K in older models');
{
  // the names held by models saved until 19 October 2026 open as the current ones, also in a child scenario; an
  // unknown name goes back to the default
  const m = PumpIt.examples.get('pump').build();
  m.system.laminarK = 'improvedAtkf';
  m.scenarios.list.push({ id: 'old', name: 'Old', parent: 'base', overrides: { 'sys|laminarK': 'atkf' }, notes: '' });
  M.normalizeRegime(m);
  check('Old names read as craneFt and pipeFt', m.system.laminarK === 'craneFt' && m.scenarios.list.find((s) => s.id === 'old').overrides['sys|laminarK'] === 'pipeFt');
  m.system.laminarK = 'other';
  M.normalizeRegime(m);
  check('An unknown laminar correction goes back to the default', m.system.laminarK === 'craneFt');
}

console.log('\nPipe catalogues (docs/pipe-library.md)');
{
  const D = PumpIt.data;
  const dims = (kind, nps, sch) => D.pipeDims({ kind, nps: String(nps), sch });
  // the bore of carbon steel, (OD − 2·wall)·25.4 to 0.0001 mm
  const steelOk = D.B3610.every((r) => D.SCHEDULES.every((s, k) => Math.abs(dims('steel', r[0], s).id - (r[1] - 2 * r[2 + k]) * 25.4) < 5e-5));
  check('Carbon steel: bores of ASME B36.10M (4" Sch 40 102.26 mm as before, 8" Sch 80 193.68 mm)', steelOk && dims('steel', '4', '40').id === 102.2604
    && +dims('steel', '8', '80').id.toFixed(2) === 193.68);
  // inside diameters (in) of table 4.B.1 of the Hydraulic Institute, ASME B36.19M-2018
  const ss = [['1/8', '10S', 0.307], ['1/2', '5S', 0.71], ['2', '40S', 2.067], ['3 1/2', '80S', 3.364], ['4', '10S', 4.26], ['8', '10S', 8.329], ['12', '5S', 12.438], ['24', '80S', 23], ['30', '10S', 29.376]];
  check('Stainless steel: inside diameters of ASME B36.19M', ss.every(([n, s, id]) => Math.abs(dims('stainless', n, s).id - id * 25.4) < 1e-9));
  check('Stainless steel: schedules the standard does not have', dims('stainless', '1/4', '5S') === null && dims('stainless', '30', '80S') === null && D.pipeSeries('stainless', '22').join() === '5S,10S');
  // published walls: ISO 4437 and EN 12201-2 tables, SINAPI items of NBR 15561, PE 100 datasheets
  const pe = [[20, '11', 2], [32, '11', 3], [32, '17', 2], [75, '11', 6.8], [90, '17', 5.4], [110, '17', 6.6], [110, '11', 10], [125, '17', 7.4], [200, '17', 11.9], [250, '17', 14.8], [250, '11', 22.7], [280, '11', 25.4], [450, '11', 40.9], [560, '11', 50.8], [710, '11', 64.5]];
  check('HDPE: published walls', pe.every(([d, s, w]) => dims('hdpe', d, s).wall === w));
  // the universal wall table of ISO 4065: exact S of the R10 series, e rounded to 0.01 mm and then up to 0.1 mm, 2.0 mm
  // at least, 3.0 mm for 32 mm SDR 11; a series starts at 1.8 mm
  const R10 = { 41: 13, 33: 12, 26: 11, 21: 10, 17: 9, 13.6: 8, 11: 7, 9: 6, 7.4: 5 };
  const iso4065 = (d, sdr) => {
    const raw = d / (2 * 10 ** (R10[sdr] / 10) + 1);
    return raw < 1.8 ? null : d === 32 && sdr === '11' ? 3 : Math.max(Math.ceil(Math.round(raw * 100) / 10) / 10, 2);
  };
  const cells = D.HDPE.flatMap((row) => D.HDPE_SDRS.map((s, i) => [row[0], s, row[1 + i]]));
  const off = cells.filter(([d, s, w]) => w !== iso4065(d, s));
  check('HDPE: every wall follows ISO 4065', off.length === 0, `${cells.length} cells` + (off.length ? `, differ: ${off.map((c) => c.join(' ')).join('; ')}` : ''));
  check('HDPE: bore OD − 2e, nominal pressures of PE 100 and PE 80', dims('hdpe', 110, '11').id === 90 && dims('hdpe', 20, '17') === null
    && D.pipePN({ kind: 'hdpe', sch: '11', grade: 'PE100' }) === 16 && D.pipePN({ kind: 'hdpe', sch: '11', grade: 'PE80' }) === 12.5);
  // ductile iron: e = K(0.5 + 0.001 DN) with 5 mm (K7) and 6 mm (K9) at least, lining of NBR 7675:2022
  const di = (dn, cls) => dims('ductile', dn, cls);
  check('Ductile iron K9: 6.0, 6.3, 6.8, 7.2 and 15.3 mm', [[80, 6], [200, 6.3], [250, 6.8], [300, 7.2], [1200, 15.3]].every(([dn, e]) => di(dn, 'K9').wall === e));
  check('Ductile iron K7: 5.0 mm at least, 5.6 at DN 300, 6.0 at DN 350', di(150, 'K7').wall === 5 && di(300, 'K7').wall === 5.6 && di(350, 'K7').wall === 6);
  check('Ductile iron: bore DE − 2e − 2·lining (DN 100: 100.0, DN 400: 402.8, DN 1200: 1212.4 mm)', di(100, 'K9').id === 100 && di(400, 'K9').id === 402.8 && di(1200, 'K9').id === 1212.4);
  // every definition is complete, with a default pipe the catalogue has; larger sizes have larger outside diameters;
  // heavier series (in the order of each catalogue but carbon steel's) have smaller bores
  let ok = true;
  for (const kind of D.PIPE_KINDS) {
    const c = D.pipeCatalog(kind), dft = c.defaults;
    if (!(c.eps > 0) || !c.system || !c.seriesKind || !c.digits || !dims(kind, dft.nps, dft.sch) || (c.grades && !c.grades[dft.grade])) ok = false;
    let od = 0;
    for (const n of D.pipeSizes(kind)) {
      const ds = D.pipeSeries(kind, n).map((s) => dims(kind, n, s));
      if (!ds.length || !(ds[0].od > od) || ds.some((d) => !(d.id > 0 && d.wall > 0))) ok = false;
      if (kind !== 'steel' && ds.some((d, i) => i && !(d.id < ds[i - 1].id))) ok = false;
      od = ds[0].od;
    }
  }
  check('Every catalogue: a complete definition, sizes in order, positive walls and bores', ok);
  // a new material: the size whose bore is nearest, or the same NPS; a series the size lacks becomes the nearest one
  const fit = (m, o) => JSON.stringify(D.fitMaterial(m, o));
  check('Changing the material keeps a similar bore', fit({ kind: 'hdpe', nps: '4', sch: '40' }, { refId: 102.26, resize: true }) === '{"kind":"hdpe","nps":"125","sch":"11","grade":"PE100"}'
    && fit({ kind: 'ductile', nps: '4', sch: '40' }, { refId: 102.26, resize: true }) === '{"kind":"ductile","nps":"100","sch":"K9"}'
    && fit({ kind: 'stainless', nps: '4', sch: '40' }, { refId: 102.26 }) === '{"kind":"stainless","nps":"4","sch":"10S"}');
  check('A series the size lacks becomes the nearest one', fit({ kind: 'stainless', nps: '1/4', sch: '5S' }) === '{"kind":"stainless","nps":"1/4","sch":"10S"}'
    && fit({ kind: 'hdpe', nps: '20', sch: '17', grade: 'PE80' }) === '{"kind":"hdpe","nps":"20","sch":"11","grade":"PE80"}');
}

console.log('\nEvery example');
for (const ex of PumpIt.examples.EXAMPLES) {
  const m = ex.build();
  for (const s of m.scenarios.list) {
    const r = solveOk(m, s.id);
    check(`${ex.name} [${s.name}] converges`, r.converged, `${r.iterations} it., ${r.warnings.length} warnings`);
  }
}

// Review of 6c4f0fa, item 4: an efficiency curve fitted above 100 % between valid points gives no shaft power and a
// warning; linear interpolation follows the points; points outside 0 to 100 % stay pending in the checklist, and a
// control without a speed leaves the efficiency unknown
console.log('\nThe efficiency of a pump stays within 0 to 100 %');
{
  const ex = () => PumpIt.examples.get('pump').build();
  const withEff = (y, fit) => { const m = ex(); m.junctions.find((j) => j.id === 2).eff = { x: [0, 40, 80, 120], y, xUnit: 'm³/h', fit }; return m; };
  const r2 = solveOk(withEff([0, 85, 98, 99], '2'));
  const p2 = r2.pumps[2], w2 = r2.warnings.filter((w) => w.obj === 'j:2');
  check('order 2: 101.93 % at 111.36 m³/h, no shaft power, one warning that names the fit', Math.abs(p2.eta * 100 - 101.930) < 1e-3 && Math.abs(p2.Q * 3600 - 111.36) < 5e-3
    && Number.isNaN(p2.Pshaft) && p2.etaInvalid && w2.length === 1 && w2[0].level === 'warning' && w2[0].text.includes('101.93%') && w2[0].text.includes('fit'), JSON.stringify(w2.map((w) => w.text)));
  const rx = solveOk(withEff([0, 85, 98, 99], 'xy'));
  check('linear interpolation: 98.784 % and 11.150 kW, no warning', Math.abs(rx.pumps[2].eta * 100 - 98.784) < 1e-3 && Math.abs(rx.pumps[2].Pshaft / 1000 - 11.150) < 5e-4
    && !rx.pumps[2].etaInvalid && !rx.warnings.some((w) => w.obj === 'j:2'));
  const pending = (m) => { const v = M.validate(M.effective(m, 'base')); return !v.ok && (v.undef.get('j:2') || []).includes(PumpIt.i18n.t('junctions.pump.check.effRange')); };
  check('points of 120 % stay pending in the checklist', pending(withEff([120, 120, 120, 120], '2')));
  check('0 % only at zero flow; a negative point or 0 % at a flow stay pending', !pending(withEff([0, 85, 98, 99], '2')) && pending(withEff([5, 0, 98, 99], '2')) && pending(withEff([-1, 85, 98, 99], '2')));
  const fixed = withEff([120, 120, 120, 120], '2'); fixed.junctions.find((j) => j.id === 2).mode = 'fixedFlow';
  check('a liquid pump at a fixed flow does not read the curve: not pending', !pending(fixed));
  // a flow control that cannot reach its flow, even at 300 %: no speed, so no efficiency and no shaft power
  const far = ex(); Object.assign(far.junctions.find((j) => j.id === 2), { mode: 'controlFlow', setQ: q(2000, 'm³/h') });
  const rf = S.run(M.effective(far, 'base'));
  const pf = rf.pumps && rf.pumps[2];
  check('a control without a speed: efficiency and shaft power not available, with a warning', !!pf && Number.isNaN(pf.speed) && Number.isNaN(pf.eta) && Number.isNaN(pf.Pshaft) && pf.etaInvalid
    && rf.warnings.some((w) => w.obj === 'j:2' && w.text.includes('without the speed')), pf ? `${pf.speed} ${pf.eta}` : JSON.stringify(rf.errors));
}

// Review of aca2807, case 3: a vapour pressure in a gauge unit is the same absolute pressure, with the ambient pressure of
// the scenario
console.log('\nReview of aca2807, case 3: a gauge vapour pressure');
{
  const npsh = (pv, patm2) => {
    const m = PumpIt.examples.get('pump').build();
    m.system.fluid = { kind: 'user', name: 'u', rho: q(1000, 'kg/m³'), mu: q(1, 'cP'), pv };
    m.system.patm = q(80, 'kPa(a)');
    let sid = 'base';
    if (patm2) { const s = M.addScenario(m, 'base', 'child'); s.overrides['sys|patm'] = q(patm2, 'kPa(a)'); sid = s.id; }
    const r = solveOk(m, sid);
    return { pv: r.fluid.pv, N: r.pumps[2].NPSHA };
  };
  const a = npsh(q(5, 'kPa(a)')), g = npsh(q(-75, 'kPa(g)'));
  check('5 kPa(a) and −75 kPa(g) with 80 kPa(a): 5000 Pa, the same NPSHA (10.1997 m)', a.pv === 5000 && Math.abs(g.pv - 5000) < 1e-9 && Math.abs(a.N - g.N) < 1e-3 && Math.abs(a.N - 10.1997) < 1e-4, a.N + ' ' + g.N);
  const ca = npsh(q(5, 'kPa(a)'), 90), cg = npsh(q(-85, 'kPa(g)'), 90);
  check('a child at 90 kPa(a): −85 kPa(g) is 5000 Pa, the same NPSHA', Math.abs(cg.pv - 5000) < 1e-9 && Math.abs(ca.N - cg.N) < 1e-3, ca.N + ' ' + cg.N);
}

// Review of aca2807, case 8: a loss at the pipe of a single-node junction is zero or more
console.log('\nReview of aca2807, case 8: a negative loss at a reservoir');
{
  const with_ = (k, type) => {
    const m = PumpIt.examples.get('pump').build();
    if (type) { const j = m.junctions[0]; j.type = type; }
    m.junctions[0].pipeK[1].kOut = k;
    return M.validate(M.effective(m, 'base'));
  };
  const v = with_(-10);
  check('K leaving −10: J1 is pending, the item names P1, the direction and −10', !v.ok && (v.undef.get('j:1') || []).some((x) => x.includes('P1') && x.includes('leaving') && x.includes('-10')), JSON.stringify(v.undef.get('j:1')));
  check('K = 0 and K = 0.5 are accepted', with_(0).ok && with_(0.5).ok);
  const left = PumpIt.examples.get('pump').build(); left.junctions[0].pipeK[9] = { kOut: -10, kIn: 0 };
  check('an entry left by a pipe no longer connected (P9) does not count', M.validate(M.effective(left, 'base')).ok);
  const m = PumpIt.examples.get('pump').build(); m.junctions[0].pipeK[1].kIn = -1;
  check('K arriving below zero too', (M.validate(M.effective(m, 'base')).undef.get('j:1') || []).some((x) => x.includes('arriving')));
  const t = PumpIt.examples.get('pump').build();
  t.junctions.find((j) => j.id === 3).time = { use: true, what: 'K', basis: 'absolute', start: 'time', when: [], tables: [{ t: [0, 1], v: [0.14, -1], tUnit: 'h', vUnit: '' }], repeat: false, interp: 'step' };
  t.solution.time.on = true;
  check('a negative K in a table over time still closes a valve', M.validate(M.effective(t, 'base')).ok);
}

// Review of aca2807, case 9: the Reynolds numbers of the transition are above zero and in order
console.log('\nReview of aca2807, case 9: the Reynolds numbers of the transition');
{
  const v = (a, b) => { const m = PumpIt.examples.get('pump').build(); Object.assign(m.system, { reLam: a, reTurb: b }); return M.validate(M.effective(m, 'base')); };
  const item = PumpIt.i18n.t('core.checklist.fluid.reynolds');
  for (const [a, b] of [[300000, 3000], [3000, 3000], [0, 4000], [2300, null]]) {
    const r = v(a, b);
    check(a + ' and ' + b + ': the system is pending', !r.ok && r.items.find((i) => i.key === 'sys').detail.includes(item));
  }
  const saved = PumpIt.examples.get('pump').build(); Object.assign(saved.system, { reLam: 300000, reTurb: 3000 });
  check('the same in a model saved and read again', !M.validate(M.effective(JSON.parse(JSON.stringify(saved)), 'base')).ok);
  const r = solveOk(PumpIt.examples.get('pump').build());
  check('2300 and 4000: P1 turbulent, f = 0.0172403', v(2300, 4000).ok && /turbulent/i.test(r.pipes[1].regime) && Math.abs(r.pipes[1].f - 0.0172403) < 1e-7, r.pipes[1].f);
}

// Review of aca2807, case 10: the Cv of a valve drawn against the flow is that of the loss along the flow
console.log('\nReview of aca2807, case 10: the Cv of a valve drawn against the flow');
{
  const run = (flip, measure) => {
    const m = PumpIt.examples.get('gravity').build();
    Object.assign(m.junctions.find((j) => j.id === 2), { lossModel: 'Cv', Cv: 100 });
    if (flip) for (const p of m.pipes.filter((p) => p.id === 1 || p.id === 2)) [p.up, p.down] = [p.down, p.up];
    return solveOk(m).valves[2];
  };
  const a = run(false), b = run(true);
  check('as drawn and reversed: |Q| 66.471 m³/h and Cv 100, the signs of Q and ΔP kept', Math.abs(a.Q * 3600 - 66.471) < 1e-3 && Math.abs(b.Q * 3600 + 66.471) < 1e-3 && b.dP < 0
    && Math.abs(a.Cv - 100) < 1e-6 && Math.abs(b.Cv - 100) < 1e-6, a.Cv + ' ' + b.Cv);
  check('the effective K too: the same positive K in both orientations', a.K > 0 && Math.abs(a.K - b.K) < 1e-9 * a.K, a.K + ' ' + b.K);
  const JS = PumpIt.junctionTypes.shared;
  check('no flow and no pressure drop: no coefficient', Number.isNaN(JS.flowCv(0, 0, 998)) && Number.isNaN(JS.flowCv(-1, 1000, 998)));
}

console.log('\nReview of 6043c80, bugs 2 to 4: inputs the calculation must refuse');
{
  // the checklist (its messages of the pipe or of the system) and the solver called directly
  const look = (m, sid = 'base') => {
    const e = M.effective(m, sid), v = M.validate(e), r = S.run(e);
    const msgs = [...v.undef.values()].flat().concat(v.items.filter((i) => !i.ok && i.key === 'sys').map((i) => i.detail));
    return { v, r, msgs, text: msgs.join(' | ') + ' || ' + (r.ok ? 'solved' : r.errors.join('; ')) };
  };
  const refused = (o, re) => !o.v.ok && !o.r.ok && o.msgs.some((x) => re.test(x)) && o.r.errors.some((x) => re.test(x) || /P\d+/.test(x));
  // bug 2: one fitting on the suction pipe of the pump example; K 0 and K 10 are the controls of the report
  const fit = (model, value, qty = 1) => { const m = PumpIt.examples.get('pump').build(); m.pipes[0].fittings = [{ model, qty, value }]; return m; };
  const k0 = look(fit('K', 0)), k10 = look(fit('K', 10));
  check('fittings: K 0 and K 10 calculate as in the report (0 and 13.10 kPa, 111.68 and 108.70 m³/h, NPSHA 12.80 and 11.48 m)',
    k0.v.ok && k10.v.ok && k0.r.ok && k10.r.ok && Math.abs(k0.r.pipes[1].dPfit) < 1e-9 && Math.abs(k10.r.pipes[1].dPfit / 1e3 - 13.10) < 0.005
      && Math.abs(k0.r.pipes[1].Q * 3600 - 111.68) < 0.005 && Math.abs(k10.r.pipes[1].Q * 3600 - 108.70) < 0.005
      && Math.abs(k0.r.pumps[2].NPSHA - 12.80) < 0.005 && Math.abs(k10.r.pumps[2].NPSHA - 11.48) < 0.005,
    `${k0.r.pumps[2].NPSHA} ${k10.r.pumps[2].NPSHA}`);
  for (const [model, value] of [['K', -10], ['KfT', -10], ['K', null], ['K', 'abc'], ['K', '5']]) {
    const m = fit(model, value), o = look(m);
    check(`fittings: ${model} = ${JSON.stringify(value)} is refused by the checklist and by the solver, and stays in the model`,
      refused(o, /fitting 1/) && m.pipes[0].fittings[0].value === value, o.text);
  }
  {
    const m = PumpIt.examples.get('pump').build();
    m.pipes[0].fittings = [{ model: 'K', qty: 1, value: 0.5 }, Object.assign({ qty: 1 }, PumpIt.data.FITTINGS.find((x) => x.model === 'KfT'), { value: -10 })];
    const o = look(m);
    check('fittings: the message names the pipe, the row and the fitting', o.v.undef.has('p:1') && o.msgs.some((x) => x.includes('fitting 2 (' + PumpIt.data.fittingName(m.pipes[0].fittings[1]) + '): K/fT is -10')), o.text);
  }
  {
    // the calibrated tee of the .fth importer (F-23): a negative K within the K of the other fittings of the pipe
    const tee = (K) => { const m = PumpIt.examples.get('pump').build(); m.pipes[0].fittings = [{ model: 'K', qty: 1, value: 2, id: 'imported' }, { model: 'K', qty: 1, value: K, id: 'imported-tee' }]; return look(m); };
    const a = tee(-1.5), b = tee(-3);
    check('fittings: a calibrated tee of -1.5 beside K 2 calculates; one of -3 is refused (the sum would be -1)', a.v.ok && a.r.ok && refused(b, /add up to -1/), b.text);
  }
  {
    // a scenario that overrides the fittings: the base calculates, the child is refused
    const m = PumpIt.examples.get('pump').build();
    m.scenarios.list[1].overrides['p:1|fittings'] = [{ model: 'K', qty: 1, value: -10 }];
    const base = look(m, 'base'), child = look(m, 's1');
    check('fittings: a scenario with K -10 is refused while its base calculates', base.v.ok && base.r.ok && refused(child, /fitting 1/), child.text);
  }
  // bug 3: the atmospheric pressure, in both regimes
  const atm = (value, unit, ex = 'pump') => { const m = PumpIt.examples.get(ex).build(); m.system.patm = q(value, unit); return look(m); };
  const okAtm = atm(101.325, 'kPa(a)');
  check('atmosphere: the example of the report (128.63 kPa(a) at the inlet of P1, NPSHA 12.66 m)', okAtm.v.ok && okAtm.r.ok && Math.abs(okAtm.r.pipes[1].Pin / 1e3 - 128.63) < 0.005 && Math.abs(okAtm.r.pumps[2].NPSHA - 12.66) < 0.005,
    `${okAtm.r.pipes[1].Pin} ${okAtm.r.pumps[2].NPSHA}`);
  for (const [v, u, ex] of [[null, 'kPa(a)', 'pump'], [-100, 'kPa(a)', 'pump'], [null, 'bar(g)', 'pump'], [0, 'kPa(a)', 'pump'], ['abc', 'kPa(a)', 'pump'], [null, 'kPa(a)', 'air'], [-100, 'kPa(a)', 'air']]) {
    const o = atm(v, u, ex);
    check(`atmosphere: ${JSON.stringify(v)} ${u} (${ex}) is refused by the checklist and by the solver, no NPSH`, refused(o, /atmospheric pressure/) && !(o.r.pumps && o.r.pumps[2]), o.text);
  }
  {
    // another valid atmosphere, absolute and gauge (a gauge value is relative to the standard atmosphere)
    const a = atm(90, 'kPa(a)'), g = atm(90 - 101.325, 'kPa(g)');
    check('atmosphere: 90 kPa(a) and -11.325 kPa(g) give the same results', a.r.ok && g.r.ok && a.r.patm === 90000 && Math.abs(g.r.patm - 90000) < 1e-9
      && Math.abs(a.r.pumps[2].NPSHA - g.r.pumps[2].NPSHA) < 1e-9 && a.r.pumps[2].NPSHA < okAtm.r.pumps[2].NPSHA, `${a.r.pumps[2].NPSHA} ${g.r.pumps[2].NPSHA}`);
  }
  // bug 4: the friction model
  const fric = (set) => { const m = PumpIt.examples.get('pump').build(); set(m); return look(m); };
  const rough = fric(() => {}), none = fric((m) => { for (const p of m.pipes) p.friction.model = 'frictionless'; });
  check('friction: the controls of the report (111.36 m³/h and 2.31 kPa with roughness; 154.15 m³/h and no loss without friction)',
    rough.r.ok && none.r.ok && Math.abs(rough.r.pipes[1].Q * 3600 - 111.36) < 0.005 && Math.abs(rough.r.pipes[1].dPfric / 1e3 - 2.31) < 0.005
      && Math.abs(none.r.pipes[1].Q * 3600 - 154.15) < 0.005 && none.r.pipes[1].dPfric === 0, `${rough.r.pipes[1].Q * 3600} ${none.r.pipes[1].Q * 3600}`);
  const all = fric((m) => { for (const p of m.pipes) p.friction.model = 'typo'; });
  check('friction: "typo" on every pipe is refused, each pipe named', refused(all, /"typo"/) && all.v.undef.size === 3 && ['P1', 'P2', 'P3'].every((id) => all.r.errors.some((x) => x.includes(id))), all.text);
  const one = fric((m) => { m.pipes[1].friction.model = 'typo'; });
  check('friction: one unknown model among valid pipes names that pipe only', refused(one, /"typo"/) && one.v.undef.size === 1 && one.v.undef.has('p:2') && one.r.errors.length === 1 && one.r.errors[0].includes('P2'), one.text);
  for (const [what, set] of [['no model', (m) => { delete m.pipes[0].friction.model; }], ['a null model', (m) => { m.pipes[0].friction.model = null; }], ['no friction at all', (m) => { delete m.pipes[0].friction; }]]) {
    const o = fric(set);
    check(`friction: ${what} is refused (not a pipe without friction), and the checklist does not fail`, refused(o, /friction model/) && o.v.undef.has('p:1'), o.text);
  }
}

console.log('\nReview of 319654f, bugs 1 and 9: fitted curves that go below zero');
{
  const look = (m, sid = 'base') => {
    const e = M.effective(m, sid), v = M.validate(e), r = S.run(e);
    const msgs = [...v.undef.values()].flat();
    return { v, r, msgs, text: msgs.join(' | ') + ' || ' + (r.ok ? 'solved' : r.errors.join('; ')) };
  };
  // bug 1: the NPSH required of the pump example, three rising points of a catalogue
  const npsh = (curve, set) => {
    const m = PumpIt.examples.get('pump').build(), j = m.junctions.find((x) => x.id === 2);
    j.npshr = Object.assign({ xUnit: 'm³/h', yUnit: 'm' }, curve);
    if (set) set(j);
    return look(m);
  };
  const warns = (o) => (o.r.warnings || []).filter((w) => /NPSH/.test(w.text)).map((w) => w.text);
  const lin = npsh({ x: [0, 200, 210], y: [15, 16, 23], fit: 'xy' }), par = npsh({ x: [0, 200, 210], y: [15, 16, 23], fit: '2' });
  check('NPSHR: linear, 15.56 m required against 12.66 m available, with the warning',
    lin.v.ok && lin.r.ok && Math.abs(lin.r.pumps[2].NPSHR - 15.5568) < 1e-4 && Math.abs(lin.r.pumps[2].NPSHA - 12.6637) < 1e-4 && warns(lin).some((x) => /lower than required \(15\.56 m\)/.test(x)), warns(lin).join(' | '));
  const pp = par.r.pumps[2];
  check('NPSHR: quadratic, the fit gives −17.11 m: no NPSHR (not zero), invalid, the pump and the flow named, no comparison',
    par.v.ok && par.r.ok && Number.isNaN(pp.NPSHR) && pp.npshrInvalid === true && Math.abs(pp.NPSHRfit + 17.111) < 1e-3
      && warns(par).length === 1 && /J2.*-17\.11 m at 111\.36 m³\/h.*not compared/.test(warns(par)[0]), warns(par).join(' | '));
  check('NPSHR: the hydraulics do not depend on the NPSHR curve (same flow and NPSHA as the linear fit)',
    par.r.pumps[2].Q === lin.r.pumps[2].Q && par.r.pumps[2].NPSHA === lin.r.pumps[2].NPSHA && par.r.pipes[1].dP0 === lin.r.pipes[1].dP0);
  const good = npsh({ x: [0, 100, 200], y: [2, 3, 6], fit: '2' }), none = npsh({ x: [], y: [], fit: '2' });
  check('NPSHR: a valid quadratic fit is compared (3.24 m, no warning)', good.r.ok && Math.abs(good.r.pumps[2].NPSHR - 3.2402) < 1e-4 && !good.r.pumps[2].npshrInvalid && warns(good).length === 0, String(good.r.pumps[2].NPSHR));
  check('NPSHR: without the optional curve, no NPSHR and no warning', none.v.ok && none.r.ok && none.r.pumps[2].NPSHR === undefined && !none.r.pumps[2].npshrInvalid && warns(none).length === 0);
  const slow = npsh({ x: [0, 200, 210], y: [15, 16, 23], fit: '2' }, (j) => { j.speed = 80; j.nPumps = 2; });
  check('NPSHR: at 80 % speed with two pumps the curve is read at Q/(N·s) and scaled by s² (−5.88 m at 78.15 m³/h, invalid)',
    slow.r.ok && slow.r.pumps[2].npshrInvalid && Math.abs(slow.r.pumps[2].NPSHRfit - 0.64 * H.evalCurve(H.makeCurve([0, 200, 210].map((x) => x / 3600), [15, 16, 23], '2'), slow.r.pumps[2].Q / 1.6)) < 1e-9 && /-5\.88 m at 78\.15/.test(warns(slow)[0] || ''), warns(slow).join(' | '));
  const stuck = npsh({ x: [50, 50, 50], y: [3, 4, 5], fit: '2' });
  check('NPSHR: a curve that cannot be fitted gives a warning and no NPSHR, and the pump still calculates (111.36 m³/h)',
    stuck.v.ok && stuck.r.ok && Number.isNaN(stuck.r.pumps[2].NPSHR ?? NaN) && stuck.r.pumps[2].npshrInvalid && Math.abs(stuck.r.pumps[2].Q * 3600 - 111.364) < 1e-3 && warns(stuck).some((x) => /cannot be fitted/.test(x)), stuck.text);
  for (const [what, c] of [['a negative head', { x: [0, 100], y: [-1, 3], fit: 'xy' }], ['a negative flow', { x: [-10, 100], y: [1, 3], fit: 'xy' }], ['a head that is not a number', { x: [0, 100], y: [1, null], fit: 'xy' }], ['fewer heads than flows', { x: [0, 100], y: [1], fit: 'xy' }]]) {
    const o = npsh(c);
    check(`NPSHR points: ${what} is refused by the checklist`, !o.v.ok && o.msgs.some((x) => /NPSH required points/.test(x)), o.text);
  }
  // bug 9: a generic component on a loss curve, between the reservoir of the gravity example and a demand of 50 m³/h
  const generic = (fit, x, y, Q = 50, dir = 'out') => {
    const m = PumpIt.examples.get('gravity').build();
    const c = Object.assign(M.newJunction('generic', 2, 0, 0), { elevation: q(25, 'm'), genModel: 'curve', curve: { x, y, xUnit: 'm³/h', yUnit: 'kPa', fit } });
    const d = Object.assign(M.newJunction('flow', 3, 0, 0), { elevation: q(18, 'm'), Q: q(Q, 'm³/h'), dir });
    m.junctions = [m.junctions[0], c, d];
    return look(m);
  };
  const gl = generic('xy', [0, 100, 110], [0, 10, 50]), gq = generic('2', [0, 100, 110], [0, 10, 50]);
  check('loss curve: linear, 5.00 kPa lost at 50 m³/h', gl.v.ok && gl.r.ok && Math.abs(gl.r.junctions[2].dP - 5000) < 1e-6, String(gl.r.junctions[2].dP));
  check('loss curve: the quadratic fit, a gain from 0 to 97.18 m³/h, is refused by the checklist and by the solver, the component named',
    !gq.v.ok && gq.msgs.some((x) => /gain from 0 to 97\.18 m³\/h/.test(x)) && !gq.r.ok && /J2.*gain from 0 to 97\.18 m³\/h/.test(gq.r.errors[0]), gq.text);
  const gd = generic('2', [0, 50, 100], [0, 2.5, 10]);
  check('loss curve: a dissipative quadratic fit is kept (2.5 kPa at 50 m³/h)', gd.v.ok && gd.r.ok && Math.abs(gd.r.junctions[2].dP - 2500) < 1e-6, String(gd.r.junctions[2].dP));
  const rev = generic('2', [0, 50, 100], [0, 2.5, 10], 50, 'in'), rj = rev.r.junctions[2];
  check('loss curve: reverse flow loses the same 2.5 kPa, Q·(P0in − P0out) ≥ 0 in both directions',
    rev.r.ok && rj.m < 0 && Math.abs(rj.P0in - rj.P0out + 2500) < 1e-6 && rj.m * (rj.P0in - rj.P0out) > 0 && gd.r.junctions[2].m * gd.r.junctions[2].dP > 0, `${rj.m} ${rj.P0in - rj.P0out}`);
  const beyondOk = generic('xy', [0, 50, 100], [0, 5, 4], 150), beyondGain = generic('xy', [0, 50, 100], [0, 5, 4], 400);
  check('loss curve: beyond the last point, still a loss (3 kPa at 150 m³/h), the result stands', beyondOk.v.ok && beyondOk.r.ok && Math.abs(beyondOk.r.junctions[2].dP - 3000) < 1e-6, beyondOk.text);
  check('loss curve: beyond the last point, a gain (−2 kPa at 400 m³/h): no result, the component and the flow named',
    beyondGain.v.ok && !beyondGain.r.ok && /J2: at 400 m³\/h, beyond the last point.*-2\.000 kPa/.test(beyondGain.r.errors[0]), beyondGain.text);
  check('curves: the lowest point of a parabola between its points, and where it is below zero',
    Math.abs(H.curveMin(H.makeCurve([0, 100, 110], [0, 10, 50], '2'), 0, 110).x - 48.59) < 0.01 && Math.abs(H.belowZero(H.makeCurve([0, 100, 110], [0, 10, 50], '2'), 0, 110).to - 97.179) < 1e-3
      && H.belowZero(H.makeCurve([0, 50, 100], [0, 2.5, 10], '2'), 0, 100, 1e-8) === null);
}

console.log('\nReview of 319654f, bugs 2 and 4: vapor pressure below vacuum, repeated ids');
{
  // bug 2: a user liquid in the pump example; the vapor pressure absolute, or gauge with the atmospheric pressure of the scenario
  const liquid = (pv, patm = 100, childPatm) => {
    const m = PumpIt.examples.get('pump').build();
    m.system.patm = q(patm, 'kPa(a)');
    m.system.fluid = { kind: 'user', name: 'test liquid', rho: q(1000, 'kg/m³'), mu: q(1, 'mPa·s'), pv };
    let sid = 'base';
    if (childPatm) { const c = M.addScenario(m, 'base', 'child'); c.overrides['sys|patm'] = q(childPatm, 'kPa(a)'); sid = c.id; }
    const e = M.effective(m, sid), v = M.validate(e), r = S.run(e);
    const sys = v.items.find((i) => i.key === 'sys');
    return { v, r, sys, text: (sys.detail || '') + ' || ' + (r.ok ? 'solved' : r.errors.join('; ')) };
  };
  const ok80 = liquid(q(80, 'kPa(a)')), neg = liquid(q(-80, 'kPa(a)')), none = liquid(q(null, 'kPa(a)'));
  check('vapor pressure: 80 kPa(a) is accepted (NPSHA 4.59 m at 100 kPa(a))', ok80.v.ok && ok80.r.ok && ok80.r.fluid.pv === 80000 && Math.abs(ok80.r.pumps[2].NPSHA - 4.5913) < 1e-4, ok80.text);
  check('vapor pressure: −80 kPa(a) is refused by the checklist, the field and the absolute value named',
    !neg.v.ok && !neg.sys.ok && /vapor pressure: -80 kPa\(a\) is -80 kPa\(a\), below vacuum/.test(neg.sys.detail), neg.text);
  check('vapor pressure: −80 kPa(a) is refused by the solver', !neg.r.ok && /vapor pressure of -80 kPa\(a\) is -80 kPa\(a\), below vacuum/.test(neg.r.errors[0]), neg.text);
  check('vapor pressure: empty stays unknown (no NPSHA, no refusal)', none.v.ok && none.r.ok && Number.isNaN(none.r.fluid.pv), none.text);
  const g20 = liquid(q(-20, 'kPa(g)')), g20child = liquid(q(-20, 'kPa(g)'), 100, 90);
  check('vapor pressure: −20 kPa(g) at 100 kPa(a) is +80 kPa(a), the same as the absolute value', g20.v.ok && g20.r.ok && Math.abs(g20.r.fluid.pv - 80000) < 1e-9 && Math.abs(g20.r.pumps[2].NPSHA - 4.5913) < 1e-4, g20.text);
  check('vapor pressure: −20 kPa(g) in a child scenario at 90 kPa(a) is +70 kPa(a), accepted', g20child.v.ok && g20child.r.ok && Math.abs(g20child.r.fluid.pv - 70000) < 1e-9, g20child.text);
  const g95 = liquid(q(-95, 'kPa(g)')), g95child = liquid(q(-95, 'kPa(g)'), 100, 90);
  check('vapor pressure: −95 kPa(g) is +5 kPa(a) in the base, accepted', g95.v.ok && g95.r.ok && Math.abs(g95.r.fluid.pv - 5000) < 1e-9, g95.text);
  check('vapor pressure: −95 kPa(g) in the child scenario at 90 kPa(a) is −5 kPa(a), refused by the checklist and the solver',
    !g95child.v.ok && /-95 kPa\(g\) is -5 kPa\(a\)/.test(g95child.sys.detail) && !g95child.r.ok && /-5 kPa\(a\)/.test(g95child.r.errors[0]), g95child.text);
  const mca = liquid(q(-20, 'mca(g)'));
  check('vapor pressure: a gauge unit without an absolute one is told in kPa(a) (−20 mca(g) is −96.13 kPa(a))', !mca.v.ok && /-20 mH₂O\(g\) is -96\.13 kPa\(a\)/.test(mca.sys.detail), mca.text);
  const wrong = liquid(q(5, 'm'));
  check('vapor pressure: a unit that is not a pressure is refused by the checklist', !wrong.v.ok && /vapor pressure: a number in a unit of pressure/.test(wrong.sys.detail), wrong.text);
  const issue = (pv, patm = 100) => M.vaporIssue({ patm: q(patm, 'kPa(a)'), fluid: { kind: 'user', pv } });
  check('vapor pressure: the issue the system window marks its field by (none, vapor, vaporVacuum; none for a library fluid)',
    issue(q(80, 'kPa(a)')) === null && issue(q(null, 'kPa(a)')) === null && issue(q(5, 'm')).key === 'vapor' && issue(q(-95, 'kPa(g)'), 90).key === 'vaporVacuum'
      && M.vaporIssue({ patm: q(100, 'kPa(a)'), fluid: { kind: 'water', T: q(20, '°C'), pv: q(-80, 'kPa(a)') } }) === null);

  // bug 4: the gravity example reduced to its two reservoirs, joined by P1 (100 m) and a copy of it (1000 m)
  const twin = (id, set) => {
    const m = PumpIt.examples.get('gravity').build();
    m.junctions = m.junctions.filter((j) => j.type === 'reservoir');
    for (const j of m.junctions) j.pipeK = {};
    const first = m.pipes[0]; first.down = 3; first.length = q(100, 'm');
    const second = M.clone(first); second.id = id; second.length = q(1000, 'm');
    m.pipes = [first, second];
    if (set) set(m);
    const e = M.effective(m, 'base'), v = M.validate(e), r = S.run(e);
    return { m, v, r, text: v.items.map((i) => i.label + ': ' + (i.ok ? 'ok' : i.detail)).join(' | ') + ' || ' + (r.ok ? 'solved' : r.errors.join('; ')) };
  };
  const two = twin(2);
  check('ids: two pipes with their own ids give 170.03 and 52.86 m³/h, 61.80 kg/s from J1',
    two.v.ok && two.r.ok && Math.abs(two.r.pipes[1].Q * 3600 - 170.0324) < 1e-3 && Math.abs(two.r.pipes[2].Q * 3600 - 52.8556) < 1e-3 && Math.abs(two.r.junctions[1].net - 61.8021) < 1e-3, two.text);
  const dupP = twin(1);
  check('ids: two pipes P1 are refused by the checklist (the pipes item names P1) and by the solver',
    !dupP.v.ok && /Pipe P1 appears more than once/.test(dupP.v.items.find((i) => i.net === 'pipes').detail) && !dupP.r.ok && /Pipe P1 appears more than once/.test(dupP.r.errors[0]), dupP.text);
  const swapped = twin(1, (m) => m.pipes.reverse());
  check('ids: the same with the copy first is refused too', !swapped.v.ok && !swapped.r.ok, swapped.text);
  const dupJ = twin(2, (m) => { m.junctions[1].id = 1; });
  check('ids: two junctions J1 are refused by the checklist (the junctions item names J1) and by the solver',
    !dupJ.v.ok && /Junction J1 appears more than once/.test(dupJ.v.items.find((i) => i.net === 'junctions').detail) && !dupJ.r.ok && dupJ.r.errors.some((x) => /Junction J1 appears more than once/.test(x)), dupJ.text);
  const dupS = M.newModel(); M.addScenario(dupS, 'base', 'a'); dupS.scenarios.list.push(M.clone(dupS.scenarios.list[1]));
  const ds = M.duplicateIds(dupS);
  check('ids: two scenarios with one id are found, each repeated id once', ds.length === 1 && ds[0].what === 'scenario' && /Scenario "[\w-]+" appears more than once/.test(M.duplicateText(ds[0])), JSON.stringify(ds));
  // the gas regime and the time simulation refuse them too
  const air = PumpIt.examples.get('air').build(); air.pipes.push(M.clone(air.pipes[0]));
  const ra = S.run(M.effective(air, 'base'));
  check('ids: the compressible mode refuses a repeated pipe id', !ra.ok && /Pipe P\d+ appears more than once/.test(ra.errors[0]), ra.ok ? 'solved' : ra.errors.join('; '));
  const tm = PumpIt.time.run(M.effective(dupP.m, 'base'));
  check('ids: the time simulation refuses a repeated pipe id at its start', !tm.ok && /Pipe P1 appears more than once/.test(tm.errors[0]), JSON.stringify(tm.errors));
}

console.log('\nReview of 319654f, bug 3: laminar flow in an annulus');
{
  // an oil (0.1 Pa·s) at 1 m³/h through 100 m of an annulus 100 × 80 mm, from a reservoir at 2 bar(a) to a demand
  const oil = (geometry, Q = 1, mu = 0.1) => {
    const m = M.newModel();
    m.system.fluid = { kind: 'user', name: 'oil', rho: q(1000, 'kg/m³'), mu: q(mu, 'Pa·s') };
    m.junctions = [
      Object.assign(M.newJunction('reservoir', 1, 0, 0), { elevation: q(0, 'm'), liquidElev: q(0, 'm'), surfP: q(2, 'bar(a)') }),
      Object.assign(M.newJunction('flow', 2, 0, 0), { elevation: q(0, 'm'), Q: q(Q, 'm³/h'), dir: 'out' }),
    ];
    const p = M.newPipe(1, 1, 2);
    Object.assign(p, { length: q(100, 'm'), geometry, friction: { model: 'smooth' } });
    m.pipes = [p];
    const e = M.effective(m, 'base'), r = S.run(e);
    return { ok: M.validate(e).ok && r.ok, r, p: r.pipes && r.pipes[1], text: r.ok ? 'solved' : r.errors.join('; ') };
  };
  // the exact laminar drop of a concentric annulus: ΔP = 8μLQ / (π[ro⁴ − ri⁴ − (ro² − ri²)²/ln(ro/ri)])
  const exact = (ro, ri, Q, mu = 0.1, L = 100) => 8 * mu * L * Q / (Math.PI * (ro ** 4 - ri ** 4 - (ro ** 2 - ri ** 2) ** 2 / Math.log(ro / ri)));
  const an = oil({ kind: 'annulus', dOuter: q(100, 'mm'), dInner: q(80, 'mm') });
  check('annulus: the laminar drop is the exact one of the annulus (117.79 kPa), 1.4988 times that of 64/Re',
    an.ok && rel(an.p.dPfric, exact(0.05, 0.04, 1 / 3600)) < 1e-12 && Math.abs(an.p.dPfric - 117794.968) < 1e-2, an.text + ' ' + (an.p && an.p.dPfric));
  check('annulus: the reported f is phi·64/Re', an.ok && rel(an.p.f, H.annulusLaminar(0.8) * 64 / an.p.Re) < 1e-12, an.p && String(an.p.f * an.p.Re));
  const thin = oil({ kind: 'annulus', dOuter: q(100, 'mm'), dInner: q(99, 'mm') }, 0.01);
  check('annulus: a narrow gap (100 × 99 mm) is the exact one too, close to two plates (f·Re → 96)',
    thin.ok && rel(thin.p.dPfric, exact(0.05, 0.0495, 0.01 / 3600)) < 1e-9 && Math.abs(thin.p.f * thin.p.Re - 96) < 0.01, thin.text + ' ' + (thin.p && thin.p.f * thin.p.Re));
  const circ = oil({ kind: 'circular', d: q(100, 'mm') }), core0 = oil({ kind: 'annulus', dOuter: q(100, 'mm'), dInner: q(0, 'mm') });
  check('annulus: without an inner pipe it is the circle (Hagen-Poiseuille, 64/Re), to the last digit',
    circ.ok && core0.ok && core0.p.dPfric === circ.p.dPfric && core0.p.f === circ.p.f && rel(circ.p.dPfric, 128 * 0.1 * 100 * (1 / 3600) / (Math.PI * 0.1 ** 4)) < 1e-12, core0.text);
  check('annulus: phi is 1 at k = 0, 1.4988 at 0.8 and 1.5 at k = 1; its series and its formula agree at the switch (k = 0.95)',
    H.annulusLaminar(0) === 1 && Math.abs(H.annulusLaminar(0.8) - 1.4987584) < 1e-7 && H.annulusLaminar(1) === 1.5
      && Math.abs(H.annulusLaminar(0.95 + 1e-12) - H.annulusLaminar(0.95 - 1e-12)) < 1e-10 && Math.abs(H.annulusLaminar(1 - 1e-9) - 1.5) < 1e-15);
  // the transition starts from phi·64/Re_lam: no step in f at Re_lam
  const fAt = (Re) => H.frictionFactor(Re, 0, 2300, 4000, H.annulusLaminar(0.8));
  check('annulus: f has no step at Re_lam (the transition starts from phi·64/Re_lam) and reaches Colebrook at Re_turb',
    rel(fAt(2300 - 1e-9), fAt(2300)) < 1e-9 && rel(fAt(4000), H.colebrook(4000, 0)) < 1e-12 && H.frictionFactor(3000, 0, 2300, 4000) === H.frictionFactor(3000, 0, 2300, 4000, 1));
  // the turbulent drop does not change (Colebrook on the hydraulic diameter)
  const turb = oil({ kind: 'annulus', dOuter: q(100, 'mm'), dInner: q(80, 'mm') }, 30, 0.001);
  check('annulus: in turbulent flow the drop is that of Colebrook on Dh, as before', turb.ok && turb.p.Re > 4000 && rel(turb.p.f, H.colebrook(turb.p.Re, 0)) < 1e-12, turb.text);
  // the water hammer reads the same laminar factor in its friction that varies with the flow
  const P = { fm: 'darcy', L: 100, Dh: 0.02, eD: 0, phiLam: H.annulusLaminar(0.8) }, A = Math.PI * (0.05 ** 2 - 0.04 ** 2);
  const env = { rho: 1000, mu: 0.1, reLam: 2300, reTurb: 4000 };
  const Rf = PumpIt.surge.network.frictionOf(P, A, 1, env), R1 = PumpIt.surge.network.frictionOf(Object.assign({}, P, { phiLam: 1 }), A, 1, env);
  const mLam = 1000 * A * 0.1;
  check('annulus: the variable friction of the water hammer is phi times that of a circle in laminar flow', rel(Rf(mLam) / R1(mLam), H.annulusLaminar(0.8)) < 1e-12);
}

console.log(`\n${pass} checks passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
