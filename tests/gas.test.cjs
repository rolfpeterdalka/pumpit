// Compressible mode: the gas physics (T1–T11, appendix B of the specification of the compressible mode, with its names and messages in English)
// and the calculation of models in the compressible regime (T12 onwards). Usage:
//   node tests/gas.test.cjs            the module of this repository (src/core/gas/gas.js, loaded with the core)
//   node tests/gas.test.cjs <file.js>  T1–T11 on another implementation of the same functions (a CommonJS module; thermal models 'isothermal' and 'adiabatic')
const path = require('path');
const { loadCore } = require('./load-core');
const PumpIt = process.argv[2] ? null : loadCore();
const G = process.argv[2] ? require(path.resolve(process.argv[2])) : PumpIt.gas;
let fails = 0;
const ok = (name, cond, info = '') => { if (!cond) fails++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${info ? ` — ${info}` : ''}`); };
const rel = (a, b) => Math.abs(a - b) / Math.max(1e-30, Math.abs(b));
const near = (a, b, tol = 1e-3) => rel(a, b) <= tol;

const air = { MW: 28.9647, k: 1.4, Z: 1, mu: 1.8e-5 };     // air
const gn = { MW: 16.9, k: 1.30, Z: 0.9, mu: 1.1e-5 };     // approximate natural gas

// T1 ideal gas: density, speed of sound, Mach
ok('T1 rho of air at 101325 Pa, 300 K', near(G.density(air, 101325, 300), 1.1766, 2e-3), `${G.density(air, 101325, 300).toFixed(4)} kg/m³`);
ok('T1 a of air at 300 K ≈ 347 m/s', near(G.sound(air, 300), 347.2, 3e-3), `${G.sound(air, 300).toFixed(1)} m/s`);
const Gflux = 1.1766 * 50; // rho·V with V=50 m/s
ok('T1 Mach from G, P, T', near(G.mach(air, Gflux, 101325, 300), 50 / 347.2, 3e-3), `${G.mach(air, Gflux, 101325, 300).toFixed(4)}`);
ok('T1 Z enters rho and a', G.density(gn, 5e6, 320) > 0 && near(G.sound(gn, 320), Math.sqrt(0.9 * 1.30 * (8314.462618 / 16.9) * 320), 1e-9));

// T2 isothermal: closed form there and back (G→P2→G) and consistency of P1²−P2²
{
  const P1 = 5e5, L = 200, D = 0.1, f = 0.02, T = 300;
  const Gm = G.isoGfromP(air, P1, 3e5, L, D, f, T);
  const P2 = G.isoP2fromG(air, P1, Gm, L, D, f, T);
  ok('T2 isothermal G↔P2 consistent', near(P2, 3e5, 1e-6), `P2=${P2.toFixed(1)} Pa`);
}
// T3 isothermal: the march equals the closed form
{
  const P1 = 8e5, L = 500, D = 0.15, f = 0.018, T = 310;
  const Gm = G.isoGfromP(air, P1, 6e5, L, D, f, T);
  const r = G.marchPipe(air, { P1, T1: T, G: Gm, L, D, f, mode: 'isothermal' }, 400);
  ok('T3 isothermal march = closed form', near(r.P2, 6e5, 2e-4), `march ${r.P2.toFixed(1)} vs closed 600000`);
  ok('T3 not choked (M<1/√k)', !r.choked && r.M2 < 1 / Math.sqrt(air.k), `M2=${r.M2.toFixed(3)}, limit ${(1 / Math.sqrt(air.k)).toFixed(3)}`);
}
// T4 isothermal choking happens at M→1/√k (asymptotic approach of the uniform-step march)
{
  const P1 = 5e5, L = 50, D = 0.1, f = 0.02, T = 300, Mlim = 1 / Math.sqrt(air.k);
  const Gc = G.chokedG(air, { P1, T1: T, L, D, f, mode: 'isothermal' }, 4000);
  const r = G.marchPipe(air, { P1, T1: T, G: Gc, L, D, f, mode: 'isothermal' }, 8000);
  ok('T4 critical flow: outlet M close to 1/√k, not beyond', r.M2 > Mlim * 0.95 && r.M2 <= Mlim + 1e-6, `outlet M ${r.M2.toFixed(4)} (1/√k=${Mlim.toFixed(4)})`);
  ok('T4 2% above the critical flow → chokes', G.marchPipe(air, { P1, T1: T, G: Gc * 1.02, L, D, f, mode: 'isothermal' }, 8000).choked);
  ok('T4 90% of the critical flow → does not choke', !G.marchPipe(air, { P1, T1: T, G: Gc * 0.9, L, D, f, mode: 'isothermal' }, 8000).choked);
}
// T5 Fanno: consistent sonic relations (M=1 → ratios=1; derivatives with the right sign)
{
  ok('T5 Fanno T/T*, P/P*, P0/P0* = 1 at M=1', near(G.fannoT(air, 1), 1, 1e-12) && near(G.fannoP(air, 1), 1, 1e-12) && near(G.fannoP0(air, 1), 1, 1e-12));
  ok('T5 Fanno fL*/D = 0 at M=1 and > 0 at M<1', Math.abs(G.fannoFLD(air, 1)) < 1e-12 && G.fannoFLD(air, 0.3) > 0 && G.fannoFLD(air, 0.5) > G.fannoFLD(air, 0.8));
  ok('T5 Fanno P0/P0* minimum at M=1 (subsonic, falls to 1)', G.fannoP0(air, 0.4) > G.fannoP0(air, 0.7) && G.fannoP0(air, 0.7) > 1);
}
// T6 Fanno: the march of M equals the length of the Fanno function, and the ratios P2/P1, T2/T1 agree
{
  const M1 = 0.3, D = 0.1, f = 0.02;
  const Lstar = G.fannoFLD(air, M1) * D / f;              // length up to choking
  const Luse = Lstar * 0.6;
  // march of M² by RK4 over Luse
  let M2v = M1 * M1, h = Luse / 4000;
  for (let i = 0; i < 4000; i++) {
    const k1 = G.fannoDm2dx(air, M2v, D, f);
    const k2 = G.fannoDm2dx(air, M2v + h / 2 * k1, D, f);
    const k3 = G.fannoDm2dx(air, M2v + h / 2 * k2, D, f);
    const k4 = G.fannoDm2dx(air, M2v + h * k3, D, f);
    M2v += h / 6 * (k1 + 2 * k2 + 2 * k3 + k4);
  }
  const M2 = Math.sqrt(M2v);
  const LfromFn = (G.fannoFLD(air, M1) - G.fannoFLD(air, M2)) * D / f;
  ok('T6 Fanno march of M ↔ function fL*/D', near(LfromFn, Luse, 2e-3), `L march ${Luse.toFixed(3)} vs function ${LfromFn.toFixed(3)}`);
  const P2P1 = G.fannoP(air, M2) / G.fannoP(air, M1), T2T1 = G.fannoT(air, M2) / G.fannoT(air, M1);
  ok('T6 subsonic Fanno: P falls, T falls, M rises', P2P1 < 1 && T2T1 < 1 && M2 > M1, `P2/P1=${P2P1.toFixed(3)} T2/T1=${T2T1.toFixed(3)} M2=${M2.toFixed(3)}`);
}
// T7 Fanno by marchPipe (adiabatic): constant T0 and choking at M=1
{
  const gas = air, P1 = 6e5, T1 = 320, D = 0.1, f = 0.02;
  // G for M1≈0.3
  const a1 = G.sound(gas, T1), rho1 = G.density(gas, P1, T1), Gm = rho1 * 0.3 * a1;
  const M1 = G.mach(gas, Gm, P1, T1);
  const T01 = T1 * G.T0ofT(gas, M1);
  const Lstar = G.fannoFLD(gas, M1) * D / f;
  const r = G.marchPipe(gas, { P1, T1, G: Gm, L: Lstar * 0.98, D, f, mode: 'adiabatic' }, 3000);
  const T02 = r.T2 * G.T0ofT(gas, r.M2);
  ok('T7 adiabatic: T0 constant along the pipe', near(T02, T01, 2e-3), `T0 in ${T01.toFixed(2)} K, out ${T02.toFixed(2)} K`);
  // M expected at 0.98·L* by the exact Fanno function: fannoFLD(M2)=0.02·fannoFLD(M1)
  const target = 0.02 * G.fannoFLD(gas, M1);
  let mlo = M1, mhi = 1;
  for (let i = 0; i < 80; i++) { const mm = (mlo + mhi) / 2; if (G.fannoFLD(gas, mm) > target) mlo = mm; else mhi = mm; }
  ok('T7 adiabatic: M of the march = exact Fanno at 0.98·L*', near(r.M2, mlo, 3e-3), `march M2=${r.M2.toFixed(4)} vs Fanno ${mlo.toFixed(4)}`);
  const rc = G.marchPipe(gas, { P1, T1, G: Gm, L: Lstar * 1.2, D, f, mode: 'adiabatic' }, 3000);
  ok('T7 adiabatic chokes beyond L*', rc.choked && near(rc.M2, 1, 2e-2), `choked=${rc.choked}, M=${rc.M2.toFixed(3)}`);
}
// T8 incompressible limit: small ΔP → the same Darcy loss as the incompressible model
{
  const P1 = 1e7, L = 100, D = 0.2, f = 0.015, T = 300; // high pressure, ΔP<<P1
  const Gm = 200; // kg/(m²s) moderate
  const r = G.marchPipe(air, { P1, T1: T, G: Gm, L, D, f, mode: 'isothermal' }, 400);
  const rho = G.density(air, P1, T), V = Gm / rho;
  const dpInc = f * L / D * rho * V * V / 2;           // incompressible Darcy
  ok('T8 compressible ΔP ≈ incompressible Darcy when ΔP<<P1', near(P1 - r.P2, dpInc, 5e-3), `comp ${(P1 - r.P2).toFixed(0)} Pa vs inc ${dpInc.toFixed(0)} Pa (${(100 * (P1 - r.P2) / P1).toFixed(2)}% of P1)`);
}
// T9 two pipes in series (isothermal): the same ṁ in both, a single intermediate P
{
  const P1 = 7e5, P3 = 4e5, T = 300, D = 0.1, f = 0.02, L1 = 150, L2 = 150;
  // P2 such that G(pipe1,P1→P2) == G(pipe2,P2→P3)
  let lo = P3 + 1, hi = P1 - 1, P2 = 0;
  for (let i = 0; i < 100; i++) {
    P2 = (lo + hi) / 2;
    const g1 = G.isoGfromP(air, P1, P2, L1, D, f, T), g2 = G.isoGfromP(air, P2, P3, L2, D, f, T);
    if (g1 > g2) lo = P2; else hi = P2;
  }
  const g1 = G.isoGfromP(air, P1, P2, L1, D, f, T), g2 = G.isoGfromP(air, P2, P3, L2, D, f, T);
  ok('T9 series: the same mass flux in both pipes', near(g1, g2, 1e-4), `G1=${g1.toFixed(3)} G2=${g2.toFixed(3)}, P2=${(P2 / 1e3).toFixed(1)} kPa`);
  // check by march: pipe 1 with G1 arrives at P2
  const r = G.marchPipe(air, { P1, T1: T, G: g1, L: L1, D, f, mode: 'isothermal' }, 300);
  ok('T9 series checked by the march', near(r.P2, P2, 1e-3), `march P2=${r.P2.toFixed(0)} vs ${P2.toFixed(0)}`);
}

// T10 isothermal network: two pipes in series reproduce the intermediate P of T9
{
  const T = 300, D = 0.1, f = 0.02, A = Math.PI * D * D / 4;
  const nodes = [{ id: 'A', P: 7e5 }, { id: 'B', P: null, inflow: 0 }, { id: 'C', P: 4e5 }];
  const pipes = [{ from: 'A', to: 'B', L: 150, D, f, A, K: 0 }, { from: 'B', to: 'C', L: 150, D, f, A, K: 0 }];
  const r = G.solveGasNetworkIso(air, T, nodes, pipes);
  ok('T10 series network converges', r.ok, `${r.iters} iter`);
  ok('T10 intermediate P ≈ 570.8 kPa (as in T9)', near(r.P.get('B'), 570805, 2e-3), `P_B=${(r.P.get('B') / 1e3).toFixed(1)} kPa`);
  ok('T10 the same ṁ in both pipes', near(r.mdot.get(0), r.mdot.get(1), 1e-6), `ṁ1=${r.mdot.get(0).toFixed(4)} ṁ2=${r.mdot.get(1).toFixed(4)} kg/s`);
}
// T11 branched isothermal network: the mass balance closes at every node
{
  const T = 288, D = 0.08, f = 0.02, A = Math.PI * D * D / 4;
  //  S1(high) ─1─ J ─2─ D1 ;  S2(high) ─3─ J ;  J ─4─ D2(low)
  const nodes = [
    { id: 'S1', P: 6e5 }, { id: 'S2', P: 55e4 }, { id: 'J', P: null, inflow: 0 },
    { id: 'D1', P: 3e5 }, { id: 'D2', P: 2.5e5 },
  ];
  const pipes = [
    { from: 'S1', to: 'J', L: 100, D, f, A }, { from: 'J', to: 'D1', L: 120, D, f, A },
    { from: 'S2', to: 'J', L: 80, D, f, A }, { from: 'J', to: 'D2', L: 150, D, f, A },
  ];
  const r = G.solveGasNetworkIso(air, T, nodes, pipes);
  ok('T11 branched network converges', r.ok, `${r.iters} iter, P_J=${(r.P.get('J') / 1e3).toFixed(1)} kPa`);
  const into = (id) => pipes.reduce((s, p, k) => s + (p.to === id ? r.mdot.get(k) : p.from === id ? -r.mdot.get(k) : 0), 0);
  ok('T11 the mass balance closes at node J', Math.abs(into('J')) < 1e-9, `residual ${into('J').toExponential(2)} kg/s`);
  ok('T11 sum of the sources = sum of the consumers', near(-(into('S1') + into('S2')), into('D1') + into('D2'), 1e-6),
    `sources ${(-(into('S1') + into('S2'))).toFixed(4)} = consumers ${(into('D1') + into('D2')).toFixed(4)} kg/s`);
}

// ------------------------------------------------------------------ models of the app (T12 onwards)
if (PumpIt) {
  const { model: M, solver: S, hyd: H } = PumpIt;
  const q = M.q;
  const Ru = 8314.462618;
  const same = (a, b) => JSON.stringify(Object.assign({}, a, { history: 0 })) === JSON.stringify(Object.assign({}, b, { history: 0 }));
  // a compressible model built from junction rows [id, type, props] and pipe rows [id, up, down, L (m), D (mm), set]
  function gasModel(js, ps, sys = {}) {
    const m = M.newModel();
    Object.assign(m.system, { regime: 'compressible', gasMode: 'isothermal' }, sys);
    for (const [id, type, props] of js) m.junctions.push(Object.assign(M.newJunction(type, id, 0, 0), props));
    for (const [id, a, b, L, Dmm, set] of ps) {
      const p = M.newPipe(id, a, b);
      Object.assign(p, { material: { kind: 'user', nps: '4', sch: '40' }, length: q(L, 'm') });
      p.geometry.d = q(Dmm, 'mm');
      if (set) set(p);
      m.pipes.push(p);
    }
    return m;
  }
  const solve = (m, sid = 'base') => {
    const eff = M.effective(m, sid);
    const v = M.validate(eff);
    if (!v.ok) return { ok: false, errors: ['incomplete model: ' + JSON.stringify([...v.undef])] };
    return S.run(eff);
  };
  const customAir = { kind: 'gas', gas: 'custom', name: 'Air', MW: 28.9647, k: 1.4, Z: 1, mu: q(1.8e-5, 'Pa·s'), T: q(300, 'K') };

  // T12 the calculation follows the regime of the model (appendix C): the incompressible one does not see the gas path
  {
    const m = PumpIt.examples.get('threeRes').build();
    const r1 = S.run(M.effective(m, 'base'));
    m.system.regime = 'compressible';
    const r2 = S.run(M.effective(m, 'base'));
    m.system.regime = 'incompressible';
    const r3 = S.run(M.effective(m, 'base'));
    ok('T12 incompressible regime: the same result as before', r1.ok && same(r1, r3));
    ok('T12 compressible regime: follows the gas path', r2.ok && r2.regime === 'compressible' && !same(r1, r2), r2.ok ? 'solved' : (r2.errors || []).join('; '));
  }

  // T13 appendix D (example "air"): solves, closes the mass balance, and the pressure of the branch equals an
  // independent calculation (bisection on that pressure, closed isothermal form, isentropic entrance from the vessel),
  // in absolute pressures: the gauge ones of the example plus the atmospheric pressure of the model (R-13)
  {
    const m = PumpIt.examples.get('air').build();
    m.system.fluidGas = Object.assign({}, customAir);
    const r = solve(m);
    ok('T13 example D solves in the compressible mode', r.ok && r.converged, r.ok ? `${r.iterations} iterations` : r.errors.join('; '));
    if (r.ok) {
      const bal = r.pipes[1].m - r.pipes[2].m - r.pipes[3].m;
      ok('T13 the mass balance closes at the branch', Math.abs(bal) < 1e-9 * r.pipes[1].m, `${bal.toExponential(2)} kg/s`);
      const ZRT = Ru / 28.9647 * 300, k = 1.4, e = k / (k - 1), mu = 1.8e-5;
      const fOf = (Gf, D) => H.frictionFactor(Gf * D / mu, 0.046e-3 / D, 2300, 4000);
      const fluxSS = (P1, P2, L, D) => { let Gf = 100; for (let i = 0; i < 100; i++) Gf = Math.sqrt((P1 * P1 - P2 * P2) / (ZRT * (fOf(Gf, D) * L / D + 2 * Math.log(P1 / P2)))); return Gf; };
      const fluxVS = (P0, P2, L, D) => {
        let lo = 0, hi = 2000;
        for (let i = 0; i < 200; i++) {
          const Gf = (lo + hi) / 2;
          let P1 = P0; for (let j = 0; j < 60; j++) { const M1 = Gf * Math.sqrt(ZRT) / (Math.sqrt(k) * P1); P1 = P0 * Math.pow(1 + (k - 1) / 2 * M1 * M1, -e); }
          if (P1 * P1 - P2 * P2 - Gf * Gf * ZRT * (fOf(Gf, D) * L / D + 2 * Math.log(P1 / P2)) > 0) lo = Gf; else hi = Gf;
        }
        return (lo + hi) / 2;
      };
      const A = (D) => Math.PI * D * D / 4;
      const pa = PumpIt.units.toSI(m.system.patm.value, m.system.patm.unit, 'pressure');
      const P0 = 5e5 + pa, PA = 2.5e5 + pa, PB = 2e5 + pa;
      let lo = PA, hi = P0;
      for (let i = 0; i < 100; i++) { const Pb = (lo + hi) / 2; if (fluxVS(P0, Pb, 200, 0.1) * A(0.1) > (fluxSS(Pb, PA, 150, 0.08) + fluxSS(Pb, PB, 180, 0.08)) * A(0.08)) lo = Pb; else hi = Pb; }
      const Pb = (lo + hi) / 2;
      ok('T13 pressure of the branch = independent calculation', near(r.junctions[2].Pin, Pb, 1e-7), `${(r.junctions[2].Pin / 1e3).toFixed(4)} × ${(Pb / 1e3).toFixed(4)} kPa`);
      ok('T13 flows = independent calculation', near(r.pipes[1].m, fluxVS(P0, Pb, 200, 0.1) * A(0.1), 1e-6) && near(r.pipes[3].m, fluxSS(Pb, PB, 180, 0.08) * A(0.08), 1e-6), `ṁ1=${r.pipes[1].m.toFixed(5)} kg/s`);
      ok('T13 the results carry Mach and stagnation', r.pipes[3].Mout > r.pipes[3].Min && r.pipes[3].P0out > r.pipes[3].Pout && r.junctions[2].T === 300);
    }
  }

  // T14 choking: a consumer far below the choke pressure; the outlet Mach stops at 1/√k, the flow at the critical one,
  // and a lower pressure downstream does not increase it (R-24)
  {
    const mk = (Pb) => gasModel([[1, 'reservoir', { surfP: q(5, 'bar(a)'), liquidElev: q(0, 'm') }], [2, 'pressure', { P: q(Pb, 'bar(a)'), ptype: 'static' }]], [[1, 1, 2, 30, 40]], { fluidGas: Object.assign({}, customAir) });
    const r1 = solve(mk(0.5)), r2 = solve(mk(0.2));
    ok('T14 choked pipe detected and warned', r1.ok && r1.pipes[1].choked && r1.warnings.some((w) => w.level === 'critical' && w.obj === 'p:1'));
    if (r1.ok) ok('T14 outlet Mach at the isothermal limit 1/√k', near(r1.pipes[1].Mout, 1 / Math.sqrt(1.4), 1e-6), `M=${r1.pipes[1].Mout.toFixed(6)}`);
    if (r1.ok && r2.ok) ok('T14 the flow does not exceed the critical one', near(r1.pipes[1].m, r2.pipes[1].m, 1e-6), `${r1.pipes[1].m.toFixed(5)} = ${r2.pipes[1].m.toFixed(5)} kg/s`);
    // the critical flux of the closed form, independently: the largest G for which h(P*) ≥ 0, with the isentropic
    // entrance from the vessel (inlet Mach found by bisection on the subsonic branch)
    if (r1.ok) {
      const ZRT = Ru / 28.9647 * 300, k = 1.4, e = k / (k - 1), D = 0.04, L = 30, Ml = 1 / Math.sqrt(k);
      const fOf = (Gf) => H.frictionFactor(Gf * D / 1.8e-5, 0.046e-3 / D, 2300, 4000);
      const chi = (Mx) => Mx * Math.pow(1 + (k - 1) / 2 * Mx * Mx, -e);
      const feasible = (Gf) => {
        const tau = Gf * Math.sqrt(ZRT / k) / 5e5;
        if (tau >= chi(Ml)) return false;
        let a = 0, b = Ml;
        for (let i = 0; i < 100; i++) { const c = (a + b) / 2; if (chi(c) < tau) a = c; else b = c; }
        const P1 = 5e5 * Math.pow(1 + (k - 1) / 2 * a * a, -e), Ps = Gf * Math.sqrt(ZRT);
        return P1 > Ps && P1 * P1 - Ps * Ps - Ps * Ps * (fOf(Gf) * L / D + 2 * Math.log(P1 / Ps)) >= 0;
      };
      let lo = 1, hi = 5000;
      for (let i = 0; i < 200; i++) { const Gf = (lo + hi) / 2; if (feasible(Gf)) lo = Gf; else hi = Gf; }
      const mc = (lo + hi) / 2 * Math.PI * D * D / 4;
      ok('T14 critical flow = independent closed form', near(r1.pipes[1].m, mc, 1e-6), `${r1.pipes[1].m.toFixed(6)} × ${mc.toFixed(6)} kg/s`);
    }
  }

  // T15 one pipe between two static pressures, with a given friction factor, equals isoGfromP (R-31)
  {
    const m = gasModel([[1, 'pressure', { P: q(7, 'bar(a)'), ptype: 'static' }], [2, 'pressure', { P: q(4, 'bar(a)'), ptype: 'static' }]],
      [[1, 1, 2, 150, 100, (p) => { p.friction = { model: 'explicitF', f: 0.02, eps: q(0.046, 'mm'), rel: 0, C: 120 }; }]], { fluidGas: Object.assign({}, customAir) });
    const r = solve(m);
    const ar2 = { MW: 28.9647, k: 1.4, Z: 1, mu: 1.8e-5 };
    const Gx = G.isoGfromP(ar2, 7e5, 4e5, 150, 0.1, 0.02, 300) * Math.PI * 0.01 / 4;
    ok('T15 single pipe = isothermal closed form', r.ok && near(r.pipes[1].m, Gx, 1e-9), r.ok ? `${r.pipes[1].m.toFixed(6)} × ${Gx.toFixed(6)} kg/s` : r.errors.join('; '));
  }

  // T16 regime fields: old models open as incompressible, a gas written as the active fluid (§8.1) becomes the gas of
  // the model, unknown values go back to the defaults, and a change of regime loses nothing (R-02, R-03, §8.5)
  {
    const old = M.newModel();
    delete old.system.regime; delete old.system.gasMode; delete old.system.fluidGas;
    M.normalizeRegime(old);
    ok('T16 an old model opens as incompressible', old.system.regime === 'incompressible' && old.system.gasMode === 'isothermal' && old.system.fluidGas.gas === 'air');
    const spec = M.newModel();
    delete spec.system.regime;
    spec.system.fluid = { kind: 'gas', name: 'Air', MW: 28.9647, k: 1.4, Z: 1, mu: 1.8e-5, T: 300 };
    M.normalizeRegime(spec);
    const g = spec.system.fluidGas;
    ok('T16 a gas in the layout of §8.1 becomes the gas of the model', spec.system.regime === 'compressible' && g.gas === 'custom' && g.MW === 28.9647 && g.mu.value === 1.8e-5 && g.mu.unit === 'Pa·s' && g.T.unit === 'K' && spec.system.fluid.kind === 'water');
    const bad = M.newModel();
    Object.assign(bad.system, { regime: 'gaseous', gasMode: 'polytropic' });
    M.normalizeRegime(bad);
    ok('T16 unknown values go back to the defaults', bad.system.regime === 'incompressible' && bad.system.gasMode === 'isothermal');
    // the Portuguese names of the specification, held by models saved before 19 October 2026, read as the English ones
    const legacy = PumpIt.examples.get('air').build();
    Object.assign(legacy.system, { regime: 'compressivel', gasMode: 'isotermico' });
    const child = legacy.scenarios.list.find((s) => 'sys|gasMode' in s.overrides);
    child.overrides['sys|gasMode'] = 'adiabatico';
    M.normalizeRegime(legacy);
    ok('T16 the old names of the values open as the English ones', legacy.system.regime === 'compressible' && legacy.system.gasMode === 'isothermal' && child.overrides['sys|gasMode'] === 'adiabatic');
    const m = PumpIt.examples.get('air').build();
    const before = JSON.stringify(m.system);
    m.system.regime = 'incompressible';
    const ri = S.run(M.effective(m, 'base'));
    m.system.regime = 'compressible';
    ok('T16 switching the regime erases nothing', JSON.stringify(m.system) === before && ri.ok && !ri.regime, ri.ok ? 'liquid solved' : ri.errors.join('; '));
  }

  // T17 gas library and checklist (R-10, R-11)
  {
    const sys = M.newModel().system;
    sys.fluidGas = Object.assign(M.newGasFluid(), { gas: 'air', T: q(300, 'K') });
    const fl = PumpIt.fluids.evaluateGas(sys);
    const muS = 1.716e-5 * Math.pow(300 / 273.15, 1.5) * (273.15 + 110.4) / (300 + 110.4);
    ok('T17 air of the library: MW, k and μ by Sutherland', fl.MW === 28.9647 && fl.k === 1.4 && near(fl.mu, muS, 1e-12), `μ=${fl.mu.toExponential(4)} Pa·s`);
    ok('T17 normal density of air ≈ 1.2923 kg/m³', near(PumpIt.fluids.normalDensity(28.9647), 1.2923, 1e-4));
    const m = PumpIt.examples.get('air').build();
    m.system.fluidGas = Object.assign({}, customAir, { k: 1 });
    const v = M.validate(M.effective(m, 'base'));
    ok('T17 a custom gas with k ≤ 1 stays pending in the checklist', !v.ok && v.items.some((i) => !i.ok && /k/.test(i.detail || '')));
  }

  // T18 low speed and small drop: the compressible flow is the incompressible one with the mean density (P6)
  {
    const mk = (regime) => gasModel([[1, 'reservoir', { surfP: q(10, 'bar(a)'), liquidElev: q(0, 'm') }], [2, 'pressure', { P: q(9.99, 'bar(a)') }]], [[1, 1, 2, 100, 100]],
      { regime, fluidGas: Object.assign({}, customAir) });
    const rg = solve(mk('compressible'));
    const mi = mk('incompressible');
    mi.system.fluid = { kind: 'user', name: 'air', rho: q(9.995e5 * 28.9647 / (Ru * 300), 'kg/m³'), mu: q(1.8e-5, 'Pa·s'), pv: q(null, 'Pa(a)') };
    const ri = solve(mi);
    ok('T18 low speed: compressible ≈ incompressible', rg.ok && ri.ok && near(rg.pipes[1].m, ri.pipes[1].m, 1e-4), rg.ok && ri.ok ? `${rg.pipes[1].m.toPrecision(7)} × ${ri.pipes[1].m.toPrecision(7)} kg/s, M=${rg.pipes[1].Mout.toFixed(4)}` : '');
  }

  // T19 valves, orifices and nozzles: a K valve is the closed form with f·L/D = 0 and F = K; the K of Cv equals the
  // liquid relation; a restriction orifice and a nozzle choke at the critical flow of their holes
  {
    const k = 1.4, ZRT = Ru / 28.9647 * 300, ar3 = { MW: 28.9647, k, Z: 1, mu: 1.8e-5 };
    // 5 bar(a) → pipe (f·L/D = 0,4) → valve K = 20 → pipe (0,4) → 4,5 bar(a), static nodes: in series by the closed
    // form, the valve being a length of f·L/D = K
    const fx = (p) => { p.friction = { model: 'explicitF', f: 0.02, eps: q(0, 'mm'), rel: 0, C: 120 }; };
    const mv = gasModel([[1, 'pressure', { P: q(5, 'bar(a)'), ptype: 'static' }], [2, 'valve', { lossModel: 'K', K: 20 }], [3, 'pressure', { P: q(4.5, 'bar(a)'), ptype: 'static' }]],
      [[1, 1, 2, 1, 50, fx], [2, 2, 3, 1, 50, fx]], { fluidGas: Object.assign({}, customAir) });
    const rv = solve(mv);
    let glo = 1, ghi = 500;
    const chain = (Gf) => G.isoP2fromG(ar3, G.isoP2fromG(ar3, G.isoP2fromG(ar3, 5e5, Gf, 1, 0.05, 0.02, 300), Gf, 20, 1, 1, 300), Gf, 1, 0.05, 0.02, 300);
    for (let i = 0; i < 200; i++) { const Gf = (glo + ghi) / 2; if (chain(Gf) > 4.5e5) glo = Gf; else ghi = Gf; }
    const mk = (glo + ghi) / 2 * Math.PI * 0.05 * 0.05 / 4;
    ok('T19 K valve = closed form with f·L/D = K', rv.ok && near(rv.pipes[1].m, mk, 1e-7), rv.ok ? `${rv.pipes[1].m.toFixed(6)} × ${mk.toFixed(6)} kg/s` : rv.errors.join('; '));
    const A = Math.PI * 0.05 * 0.05 / 4;
    const Kcv = PumpIt.junctionTypes.shared.gasValveK({ lossModel: 'Cv', Cv: 60 }, 0, A);
    const GAL = 3.785411784e-3 / 60, PSI = 6894.757293168, V = 3, rho = 999;
    const dPcv = (rho / 999) * Math.pow(V * A / GAL / 60, 2) * PSI;
    ok('T19 K of the Cv = liquid relation (Cv 60 in 2")', near(Kcv * rho * V * V / 2, dPcv, 1e-12), `K=${Kcv.toFixed(4)}`);
    // nozzle to the atmosphere from 4 bar(a): choked, m = Cd·A·P0·√(k/(ZRT0))·(2/(k+1))^((k+1)/(2(k−1)))
    const mn = gasModel([[1, 'reservoir', { surfP: q(4, 'bar(a)'), liquidElev: q(0, 'm') }], [2, 'spray', { sprayModel: 'CdA', Cd: 0.8, dHole: q(6, 'mm'), nHoles: 1, Pext: q(1, 'bar(a)') }]],
      [[1, 1, 2, 2, 50]], { fluidGas: Object.assign({}, customAir) });
    const rn = solve(mn);
    if (rn.ok) {
      const P0 = rn.junctions[2].Pin, CdA = 0.8 * Math.PI * 0.006 * 0.006 / 4;
      const mc = CdA * P0 * Math.sqrt(k / ZRT) * Math.pow(2 / (k + 1), (k + 1) / (2 * (k - 1)));
      ok('T19 choked nozzle: isentropic critical flow', rn.junctions[2].choked && near(rn.junctions[2].m, mc, 1e-9), `${rn.junctions[2].m.toFixed(6)} × ${mc.toFixed(6)} kg/s`);
    } else ok('T19 choked nozzle: isentropic critical flow', false, rn.errors.join('; '));
    // restriction orifice of 10 mm in a 50 mm line, 6 → 1 bar(a): choked at the hole (Cc 0.61 for a sharp edge)
    const mo = gasModel([[1, 'reservoir', { surfP: q(6, 'bar(a)'), liquidElev: q(0, 'm') }], [2, 'orifice', { orModel: 'sharp', dO: q(10, 'mm') }], [3, 'pressure', { P: q(1, 'bar(a)'), ptype: 'static' }]],
      [[1, 1, 2, 5, 50], [2, 2, 3, 5, 50]], { fluidGas: Object.assign({}, customAir) });
    const ro = solve(mo);
    if (ro.ok) {
      const j = ro.junctions[2];
      const mc = 0.61 * Math.PI * 0.01 * 0.01 / 4 * j.P0in * Math.sqrt(k / (ZRT * (j.T0in / 300))) * Math.pow(2 / (k + 1), (k + 1) / (2 * (k - 1)));
      ok('T19 restriction orifice chokes at the hole', j.choked && near(j.m, mc, 1e-6), `${j.m.toFixed(6)} × ${mc.toFixed(6)} kg/s`);
    } else ok('T19 restriction orifice chokes at the hole', false, ro.errors.join('; '));
  }

  // T20 a pressure-reducing valve keeps its set pressure downstream (static basis), and a flow control valve its flow
  {
    const m = gasModel([
      [1, 'reservoir', { surfP: q(8, 'bar(g)'), liquidElev: q(0, 'm') }], [2, 'control', { ctype: 'PRV', setP: q(3, 'bar(g)'), basis: 'static', kOpen: 1 }],
      [3, 'branch', {}], [4, 'pressure', { P: q(1, 'bar(g)'), ptype: 'static' }], [5, 'control', { ctype: 'FCV', setQ: q(500, 'kg/h'), kOpen: 1 }], [6, 'pressure', { P: q(0, 'bar(g)'), ptype: 'static' }],
    ], [[1, 1, 2, 50, 50], [2, 2, 3, 50, 50], [3, 3, 4, 100, 25], [4, 3, 5, 20, 40], [5, 5, 6, 20, 40]], { fluidGas: Object.assign({}, customAir) });
    const r = solve(m);
    ok('T20 reducing valve keeps the static pressure downstream', r.ok && near(r.pipes[2].Pin - r.patm, 3e5, 1e-9), r.ok ? `${((r.pipes[2].Pin - r.patm) / 1e5).toFixed(6)} bar(g), ${r.valves[2].state}` : r.errors.join('; '));
    ok('T20 flow control valve sets 500 kg/h', r.ok && near(r.valves[5].m * 3600, 500, 1e-12) && near(r.pipes[5].m * 3600, 500, 1e-9), r.ok ? `${(r.pipes[5].m * 3600).toFixed(9)} kg/h, ${r.valves[5].state}` : '');
  }

  // T21 the advice of §5: a gas-light fluid in the incompressible mode that is fast or loses much pressure, and a gas
  // in the compressible mode that is slow with small drops
  {
    const m = PumpIt.examples.get('air').build();
    m.system.regime = 'incompressible';
    m.system.fluid = { kind: 'user', name: 'air', rho: q(4.2, 'kg/m³'), mu: q(0.0185, 'cP'), pv: q(null, 'Pa(a)') };
    const ri = solve(m);
    ok('T21 incompressible with a fast gas: suggests the compressible mode', ri.ok && ri.warnings.some((w) => w.level === 'caution' && /P1/.test(w.text) && /Mach 0[.,]3/.test(w.text)));
    const ms = PumpIt.examples.get('air').build();
    ms.junctions[2].P = q(4.99, 'bar(g)'); ms.junctions[3].P = q(4.995, 'bar(g)');
    const rs = solve(ms);
    ok('T21 slow compressible: says the incompressible mode would give the same', rs.ok && rs.warnings.length === 1 && rs.warnings[0].level === 'info');
    const rf = solve(PumpIt.examples.get('air').build());
    ok('T21 example D does not get that information', rf.ok && !rf.warnings.some((w) => w.level === 'info'));
  }

  // T22 a flow given as a normal volume (Nm³/h at 0 °C and 101.325 kPa) is a mass flow of ρN·Q (§8.4)
  {
    const m = gasModel([[1, 'reservoir', { surfP: q(6, 'bar(g)'), liquidElev: q(0, 'm') }], [2, 'flow', { Q: q(500, 'Nm³/h'), dir: 'out' }]], [[1, 1, 2, 100, 50]],
      { fluidGas: Object.assign({}, customAir) });
    const r = solve(m);
    const rhoN = 101325 * 28.9647 / (Ru * 273.15);
    ok('T22 normal flow converted to mass', r.ok && near(r.pipes[1].m, 500 / 3600 * rhoN, 1e-9) && near(r.pipes[1].QN * 3600, 500, 1e-9), r.ok ? `${(r.pipes[1].m * 3600).toFixed(4)} kg/h` : r.errors.join('; '));
    const U = PumpIt.units;
    ok('T22 normal units: Nm³/h ↔ kg/s with the normal density', near(U.toSI(500, 'Nm³/h', 'flow', { rhoN }), 500 / 3600 * rhoN, 1e-12) && near(U.fromSI(500 / 3600 * rhoN, 'Nm³/h', 'flow', { rhoN }), 500, 1e-12));
  }

  // ---------------------------------------------------------------- adiabatic model (phase 3)
  const adiab = { gasMode: 'adiabatic', fluidGas: Object.assign({}, customAir) };
  const fx = (f) => (p) => { p.friction = { model: 'explicitF', f, eps: q(0, 'mm'), rel: 0, C: 120 }; };
  const k = 1.4, e = k / (k - 1), ZR = Ru / 28.9647;
  const fac = (Mx) => 1 + (k - 1) / 2 * Mx * Mx;
  // T23 one pipe from a vessel (P0, T0) to a static pressure equals exact Fanno flow with an isentropic entrance
  {
    const P0 = 5e5, T0 = 300, L = 30, D = 0.04, f = 0.02, P2set = 3e5;
    const m = gasModel([[1, 'reservoir', { surfP: q(5, 'bar(a)'), liquidElev: q(0, 'm') }], [2, 'pressure', { P: q(3, 'bar(a)'), ptype: 'static' }]], [[1, 1, 2, L, D * 1000, fx(f)]], adiab);
    const r = solve(m);
    const ar4 = { MW: 28.9647, k, Z: 1, mu: 1.8e-5 };
    const P2of = (M1) => {
      const P1 = P0 * Math.pow(fac(M1), -e);
      const target = G.fannoFLD(ar4, M1) - f * L / D;
      let lo = M1, hi = 1;
      for (let i = 0; i < 200; i++) { const mm = (lo + hi) / 2; if (G.fannoFLD(ar4, mm) > target) lo = mm; else hi = mm; }
      return P1 * G.fannoP(ar4, (lo + hi) / 2) / G.fannoP(ar4, M1);
    };
    let lo = 1e-4, hi = 0.99;
    for (let i = 0; i < 200; i++) { const mm = (lo + hi) / 2; if (G.fannoFLD(ar4, mm) - f * L / D < 0) hi = mm; else lo = mm; }
    let a = 1e-4, b = lo;
    for (let i = 0; i < 200; i++) { const mm = (a + b) / 2; if (P2of(mm) > P2set) a = mm; else b = mm; }
    const M1 = (a + b) / 2, Gx = P0 * Math.sqrt(k / (ZR * T0)) * M1 * Math.pow(fac(M1), -(k + 1) / (2 * (k - 1)));
    const mx = Gx * Math.PI * D * D / 4;
    ok('T23 adiabatic, single pipe: flow = exact Fanno with an isentropic entrance', r.ok && near(r.pipes[1].m, mx, 2e-4), r.ok ? `${r.pipes[1].m.toFixed(6)} × ${mx.toFixed(6)} kg/s` : r.errors.join('; '));
    if (r.ok) {
      const p = r.pipes[1];
      ok('T23 T0 kept in the pipe and the outlet static T = T0/(1+(k−1)/2·M²)', near(p.T0out, T0, 1e-6) && near(p.Tout, T0 / fac(p.Mout), 1e-9), `T0 out ${p.T0out.toFixed(4)} K, T out ${p.Tout.toFixed(3)} K, M ${p.Mout.toFixed(4)}`);
    }
  }

  // T24 a series of pipes: the same mass flow in all, T0 of the source at every junction, the static T falling as the
  // gas speeds up
  {
    const m = gasModel([[1, 'reservoir', { surfP: q(6, 'bar(a)'), liquidElev: q(0, 'm') }], [2, 'branch', {}], [3, 'branch', {}], [4, 'pressure', { P: q(2, 'bar(a)'), ptype: 'static' }]],
      [[1, 1, 2, 100, 50], [2, 2, 3, 100, 50], [3, 3, 4, 100, 50]], adiab);
    const r = solve(m);
    ok('T24 adiabatic series converges', r.ok && r.converged, r.ok ? `${r.iterations} iterations` : r.errors.join('; '));
    if (r.ok) {
      ok('T24 the same mass flow in the three pipes (R-40: 1e-8)', near(r.pipes[2].m, r.pipes[1].m, 1e-8) && near(r.pipes[3].m, r.pipes[1].m, 1e-8));
      ok('T24 T0 of the source at every junction', [2, 3].every((id) => near(r.junctions[id].T0, 300, 1e-9)), `T0 = ${r.junctions[2].T0.toFixed(6)}, ${r.junctions[3].T0.toFixed(6)} K`);
      ok('T24 the static T falls along the series', r.pipes[1].Tout > r.pipes[2].Tout && r.pipes[2].Tout > r.pipes[3].Tout && r.pipes[3].Tout < 300, `${r.pipes[1].Tout.toFixed(2)} > ${r.pipes[2].Tout.toFixed(2)} > ${r.pipes[3].Tout.toFixed(2)} K`);
    }
  }

  // T25 two sources at different temperatures meet at a node: its T0 is the mass-weighted mix (§10.3), and the energy
  // that leaves equals the energy that enters
  {
    const m = gasModel([
      [1, 'reservoir', { surfP: q(6, 'bar(a)'), liquidElev: q(0, 'm'), gasT: q(350, 'K') }], [2, 'reservoir', { surfP: q(5.5, 'bar(a)'), liquidElev: q(0, 'm'), gasT: q(280, 'K') }],
      [3, 'branch', {}], [4, 'pressure', { P: q(2, 'bar(a)'), ptype: 'static' }],
    ], [[1, 1, 3, 80, 50], [2, 2, 3, 60, 50], [3, 3, 4, 120, 65]], adiab);
    const r = solve(m);
    ok('T25 mixing converges', r.ok && r.converged, r.ok ? `${r.iterations} iterations` : r.errors.join('; '));
    if (r.ok) {
      const m1 = r.pipes[1].m, m2 = r.pipes[2].m, Tmix = (m1 * 350 + m2 * 280) / (m1 + m2);
      ok('T25 T0 of the node = mass-weighted mix', near(r.junctions[3].T0, Tmix, 1e-6), `${r.junctions[3].T0.toFixed(4)} × ${Tmix.toFixed(4)} K (ṁ ${m1.toFixed(4)} + ${m2.toFixed(4)} kg/s)`);
      ok('T25 the outlet pipe carries that T0 to its end', near(r.pipes[3].T0out, Tmix, 1e-6) && near(r.pipes[3].m, m1 + m2, 1e-9));
      ok('T25 each source delivers its own T0', near(r.pipes[1].T0in, 350, 1e-9) && near(r.pipes[2].T0in, 280, 1e-9));
    }
  }

  // T26 adiabatic choking: the outlet Mach stops at 1, the flow at the critical one
  {
    const mk = (Pb) => gasModel([[1, 'reservoir', { surfP: q(5, 'bar(a)'), liquidElev: q(0, 'm') }], [2, 'pressure', { P: q(Pb, 'bar(a)'), ptype: 'static' }]], [[1, 1, 2, 30, 40, fx(0.02)]], adiab);
    const r1 = solve(mk(0.5)), r2 = solve(mk(0.2));
    ok('T26 adiabatic choking: outlet Mach 1', r1.ok && r1.pipes[1].choked && near(r1.pipes[1].Mout, 1, 1e-4), r1.ok ? `M=${r1.pipes[1].Mout.toFixed(6)}` : r1.errors.join('; '));
    ok('T26 the flow does not exceed the critical one', r1.ok && r2.ok && near(r1.pipes[1].m, r2.pipes[1].m, 1e-6), r1.ok && r2.ok ? `${r1.pipes[1].m.toFixed(5)} = ${r2.pipes[1].m.toFixed(5)} kg/s` : '');
    // the critical flux of exact Fanno with the isentropic entrance: fannoFLD(M1) = f·L/D
    let lo = 1e-4, hi = 1;
    for (let i = 0; i < 200; i++) { const mm = (lo + hi) / 2; if (G.fannoFLD({ MW: 28.9647, k, Z: 1, mu: 1.8e-5 }, mm) > 0.02 * 30 / 0.04) lo = mm; else hi = mm; }
    const M1 = (lo + hi) / 2, mc = 5e5 * Math.sqrt(k / (ZR * 300)) * M1 * Math.pow(fac(M1), -(k + 1) / (2 * (k - 1))) * Math.PI * 0.04 * 0.04 / 4;
    ok('T26 critical flow = exact Fanno', r1.ok && near(r1.pipes[1].m, mc, 1e-4), r1.ok ? `${r1.pipes[1].m.toFixed(6)} × ${mc.toFixed(6)} kg/s` : '');
  }

  // T27 the example in both thermal models: at low Mach the two agree closely, the adiabatic gas is cooler where it is fast
  {
    const mi = PumpIt.examples.get('air').build();
    const ma = PumpIt.examples.get('air').build();
    ma.system.gasMode = 'adiabatic';
    const ri = solve(mi), ra = solve(ma);
    ok('T27 example D in both thermal models', ri.ok && ra.ok && near(ra.pipes[1].m, ri.pipes[1].m, 1e-2) && ra.pipes[3].Tout < 300 && near(ri.pipes[3].Tout, 300, 1e-12),
      ri.ok && ra.ok ? `ṁ1 iso ${ri.pipes[1].m.toFixed(4)} × adiab ${ra.pipes[1].m.toFixed(4)} kg/s; outlet T of P3 adiab ${ra.pipes[3].Tout.toFixed(2)} K` : '');
  }

  // T28 compressor (§10.5): fixed ratio, curve, flow and discharge control; heating of the gas in the adiabatic model
  {
    const curve = { x: [0, 1000, 2000, 3000], y: [20000, 19000, 16000, 11000], xUnit: 'm³/h', yUnit: 'm', fit: '2' };
    const mk = (mode, pump) => gasModel([[1, 'reservoir', { surfP: q(1, 'bar(a)'), liquidElev: q(0, 'm') }], [2, 'pump', pump], [3, 'pressure', { P: q(2.5, 'bar(a)'), ptype: 'static' }]],
      [[1, 1, 2, 20, 150], [2, 2, 3, 200, 100]], { gasMode: mode, fluidGas: Object.assign({}, customAir) });
    const ra = solve(mk('adiabatic', { mode: 'ratio', ratio: 3, etaGas: 75 }));
    ok('T28 fixed-ratio compressor: P0 out = 3·P0 in', ra.ok && near(ra.junctions[2].P0out / ra.junctions[2].P0in, 3, 1e-9), ra.ok ? `r = ${(ra.junctions[2].P0out / ra.junctions[2].P0in).toFixed(9)}` : ra.errors.join('; '));
    if (ra.ok) {
      const T0in = ra.pumps[2].T0in, T0out = T0in * Math.pow(3, (k - 1) / (k * 0.75));
      ok('T28 polytropic heating T0·r^((k−1)/(k·η)) carried by the next pipe', near(ra.pumps[2].T0out, T0out, 1e-9) && near(ra.pipes[2].T0in, T0out, 1e-6), `${ra.pumps[2].T0out.toFixed(3)} K`);
      ok('T28 power to the gas = ṁ·cp·ΔT0', near(ra.pumps[2].Pgas, ra.pumps[2].m * (k * ZR / (k - 1)) * (T0out - T0in), 1e-9), `${(ra.pumps[2].Pgas / 1e3).toFixed(3)} kW`);
    }
    const rc = solve(mk('isothermal', { mode: 'curve', curve }));
    if (rc.ok) {
      const pr = rc.pumps[2];
      const a2 = H.polyfit([0, 1000, 2000, 3000].map((v) => v / 3600), [20000, 19000, 16000, 11000], 2);
      ok('T28 curve: the isentropic head at the point = the curve at the suction flow', near(pr.dHs, H.polyval(a2, pr.Q), 1e-7), `${pr.dHs.toFixed(2)} × ${H.polyval(a2, pr.Q).toFixed(2)} m`);
    } else ok('T28 curve: the isentropic head at the point = the curve at the suction flow', false, rc.errors.join('; '));
    const rf = solve(mk('isothermal', { mode: 'fixedFlow', fixedFlow: q(1500, 'Nm³/h') }));
    ok('T28 fixed flow in Nm³/h', rf.ok && near(rf.pumps[2].m, 1500 / 3600 * 101325 * 28.9647 / (Ru * 273.15), 1e-9));
    const rd = solve(mk('adiabatic', { mode: 'controlDischarge', setP: q(3, 'bar(a)'), curve }));
    ok('T28 discharge control: static P = 3 bar(a) and the speed the curve asks for', rd.ok && near(rd.pipes[2].Pin, 3e5, 1e-9) && rd.pumps[2].speed > 50 && rd.pumps[2].speed < 100,
      rd.ok ? `P = ${(rd.pipes[2].Pin / 1e5).toFixed(6)} bar(a), speed ${rd.pumps[2].speed.toFixed(2)} %` : rd.errors.join('; '));
  }

  // T29 gauge and absolute pressures (R-13): the example is in gauge pressures; a gauge value is the absolute one less
  // the atmospheric pressure of the model, whatever that is; a pressure at or below vacuum, and an atmospheric pressure
  // that is not above zero, stay pending in the checklist of a gas, and a liquid is not affected
  {
    const tr = PumpIt.i18n.t;
    const ex = () => PumpIt.examples.get('air').build();
    const e0 = ex();
    ok('T29 example D in gauge pressures: 5, 2.5 and 2 bar(g)', [e0.junctions[0].surfP, e0.junctions[2].P, e0.junctions[3].P].map((x) => x.value + ' ' + x.unit).join(', ') === '5 bar(g), 2.5 bar(g), 2 bar(g)');
    // the same line typed in gauge and in absolute pressures, at sea level and at about 1400 m
    const typed = (unit, add, patm) => {
      const m = ex();
      m.system.patm = q(patm, 'bar(a)');
      m.junctions[0].surfP = q(5 + add, unit); m.junctions[2].P = q(2.5 + add, unit); m.junctions[3].P = q(2 + add, unit);
      return m;
    };
    for (const patm of [1.01325, 0.85]) {
      const rg = solve(typed('bar(g)', 0, patm)), ra = solve(typed('bar(a)', patm, patm));
      ok(`T29 gauge = absolute − atmospheric (${patm} bar(a))`, rg.ok && ra.ok && near(rg.pipes[1].m, ra.pipes[1].m, 1e-9) && near(rg.junctions[2].Pin, ra.junctions[2].Pin, 1e-9) && near(rg.patm, patm * 1e5, 1e-12),
        rg.ok && ra.ok ? `ṁ1 ${rg.pipes[1].m.toFixed(6)} × ${ra.pipes[1].m.toFixed(6)} kg/s` : '');
    }
    const vac = (key) => tr('core.checklist.junction.vacuum', { what: tr(key) });
    const pending = (v, id, key) => (v.undef.get('j:' + id) || []).includes(vac(key));
    const below = ex();
    below.junctions[0].surfP = q(-1.5, 'bar(g)');            // −0.49 bar(a)
    below.junctions[2].P = q(0, 'bar(a)');                   // vacuum
    below.junctions[3].P = q(-0.5, 'bar(g)');                // 0.51 bar(a): a vacuum line, which a gas allows
    const vb = M.validate(M.effective(below, 'base'));
    ok('T29 a vessel and a consumer at or below vacuum stay pending, with the field named', !vb.ok && pending(vb, 1, 'junctions.reservoir.check.gasP') && pending(vb, 3, 'junctions.pressure.check.P') && !vb.undef.has('j:4'),
      JSON.stringify([...vb.undef]));
    below.system.regime = 'incompressible';
    ok('T29 a liquid is not checked', M.validate(M.effective(below, 'base')).ok);
    const dev = gasModel([
      [1, 'reservoir', { surfP: q(8, 'bar(g)'), liquidElev: q(0, 'm') }], [2, 'control', { ctype: 'PRV', setP: q(-1.2, 'bar(g)'), basis: 'static', kOpen: 1 }],
      [3, 'branch', {}], [4, 'exitvalve', { Pout: q(-1.1, 'bar(g)') }], [5, 'spray', { sprayModel: 'CdA', Cd: 0.8, dHole: q(6, 'mm'), nHoles: 1, Pext: q(0, 'bar(a)') }],
      [6, 'pump', { mode: 'controlDischarge', setP: q(-2, 'bar(g)') }], [7, 'pressure', { P: q(1, 'bar(g)'), ptype: 'static' }],
    ], [[1, 1, 2, 10, 50], [2, 2, 3, 10, 50], [3, 3, 4, 10, 50], [4, 3, 5, 10, 50], [5, 3, 6, 10, 50], [6, 6, 7, 10, 50]], { fluidGas: Object.assign({}, customAir) });
    const vd = M.validate(M.effective(dev, 'base'));
    ok('T29 set and outside pressures at or below vacuum stay pending: reducing valve, exit valve, nozzle, compressor',
      pending(vd, 2, 'junctions.control.check.setP') && pending(vd, 4, 'junctions.exitvalve.check.Pout') && pending(vd, 5, 'junctions.spray.check.Pext') && pending(vd, 6, 'junctions.pump.check.setP')
      && !vd.undef.has('j:1') && !vd.undef.has('j:7'), JSON.stringify([...vd.undef]));
    const thin = ex();
    thin.system.patm = q(0, 'bar(a)');
    const vs = M.validate(M.effective(thin, 'base'));
    ok('T29 an atmospheric pressure of zero stays pending for a gas', !vs.ok && vs.items.find((i) => i.key === 'sys').detail.includes(tr('core.checklist.fluid.patm')));
  }
}

// ------------------------------------------------------------------ review of 6c4f0fa
// Item 2: the volume flows of a pipe follow the ends of its reference direction, as rhoIn, rhoOut, Vin and Vout; a pipe
// turned against the flow keeps Q·ρ = ṁ at each end (Q at the start of the reference direction, Qout at its end).
if (PumpIt) {
  const M = PumpIt.model;
  const solve = (m) => PumpIt.solver.run(M.effective(m, 'base'));
  const m = PumpIt.examples.get('air').build();
  const a = solve(m).pipes[1];
  M.swapEnds(m.pipes.find((p) => p.id === 1));
  const b = solve(m).pipes[1];
  const h = (x) => (x * 3600).toFixed(2);
  const ends = (r) => near(r.Q * r.rhoIn, r.m, 1e-12) && near(r.Qout * r.rhoOut, r.m, 1e-12);
  ok('6c4f0fa-2 J1 → J2: Q·ρ = ṁ at each end, 917.91 and 1203.66 m³/h', ends(a) && near(a.Q * 3600, 917.91, 1e-5) && near(a.Qout * 3600, 1203.66, 1e-5), `${h(a.Q)} ${h(a.Qout)}`);
  ok('6c4f0fa-2 reversed: −1203.66 at the start and −917.91 at the end, Q·ρ = ṁ at each end', ends(b) && b.m < 0
    && near(b.Q * 3600, -1203.66, 1e-5) && near(b.Qout * 3600, -917.91, 1e-5) && near(b.rhoIn, 5.292522, 1e-6) && near(b.rhoOut, 6.940133, 1e-6), `${h(b.Q)} ${h(b.Qout)} m ${b.m}`);
}

// Item 3: a compressor under flow control reads its efficiency at the speed the control finds, whatever speed was typed
// before, in the isothermal and the adiabatic models (with the temperature the gas leaves with); a fitted efficiency
// above 100 % gives no power to the gas and a warning
if (PumpIt) {
  const M = PumpIt.model, q = M.q;
  const pump = (gasMode, mode, speed, eff) => {
    const m = PumpIt.examples.get('pump').build();
    Object.assign(m.system, { regime: 'compressible', gasMode });
    const j2 = m.junctions.find((j) => j.id === 2);
    Object.assign(j2, { mode, speed, setQ: q(80, 'm³/h') });
    if (eff) j2.eff = eff;
    const r = PumpIt.solver.run(M.effective(m, 'base'));
    return { r, p: r.pumps[2] };
  };
  const a = pump('isothermal', 'controlFlow', 100).p, b = pump('isothermal', 'controlFlow', 70).p;
  // the set volume flow is that of the suction at rest, as on the curve (review of e6b8f15, item 21; 90.8229 % before,
  // when the set flow read the pressure of the node): the compressor shows the 80 m³/h set
  ok('6c4f0fa-3 isothermal, flow control after 100 % and after 70 %: 90.8232 %, 79.121 % and 11.147 W in both, 80 m³/h at the suction',
    [a, b].every((p) => near(p.Q * 3600, 80, 1e-8) && near(p.speed, 90.82324, 1e-6) && near(p.eta * 100, 79.121, 1e-5) && near(p.Pgas, 11.147, 1e-4)), `${a.eta * 100} ${b.eta * 100} ${a.Pgas} ${b.Pgas}`);
  const fx = pump('isothermal', 'curve', a.speed).p;
  ok('6c4f0fa-3 isothermal: the same as the machine at that fixed speed', near(fx.eta, a.eta, 1e-6) && near(fx.Pgas, a.Pgas, 1e-6), `${fx.eta * 100} ${fx.Pgas}`);
  const c = pump('adiabatic', 'controlFlow', 100), d = pump('adiabatic', 'controlFlow', 70);
  const e = pump('adiabatic', 'curve', c.p.speed);
  ok('6c4f0fa-3 adiabatic: the same speed, efficiency, power and discharge temperatures after 100 % and after 70 %',
    near(c.p.speed, d.p.speed, 1e-9) && near(c.p.eta, d.p.eta, 1e-9) && near(c.p.Pgas, d.p.Pgas, 1e-9) && near(c.p.T0out, d.p.T0out, 1e-12) && near(c.r.pipes[2].Tout, d.r.pipes[2].Tout, 1e-12),
    `${c.p.speed} ${d.p.speed}`);
  // T0 out: the reservoir J1 sits 3 m above the suction, so the gas reaches it at 293.15 + g·3/cp = 293.1793 K (G-39)
  ok('6c4f0fa-3 adiabatic: as at the fixed speed, 79.121 %, 11.140 W, T0 out 293.5936 K and 293.5824 K at the end of P2',
    near(c.p.eta * 100, 79.121, 1e-5) && near(c.p.Pgas, 11.140, 1e-4) && Math.abs(c.p.T0out - 293.5936) < 1e-4 && Math.abs(c.r.pipes[2].Tout - 293.5824) < 1e-4
    && near(e.p.eta, c.p.eta, 1e-6) && near(e.p.Pgas, c.p.Pgas, 1e-6) && Math.abs(e.r.pipes[2].Tout - c.r.pipes[2].Tout) < 1e-6, `${c.p.eta * 100} ${c.p.Pgas} ${c.p.T0out} ${c.r.pipes[2].Tout}`);
  const hi = pump('isothermal', 'curve', 100, { x: [0, 40, 80, 120], y: [0, 85, 98, 99], xUnit: 'm³/h', fit: '2' });
  const wh = hi.r.warnings.filter((w) => w.obj === 'j:2' && w.text.includes('outside 0 to 100%'));
  ok('6c4f0fa-4 a compressor whose fitted efficiency passes 100 %: no power to the gas, a warning', hi.p.eta > 1 && Number.isNaN(hi.p.Pgas) && hi.p.etaInvalid && wh.length === 1, `${hi.p.eta * 100}`);
}

// Review of aca2807, case 9: the Reynolds numbers of the transition are checked in the compressible mode too
console.log('\nReview of aca2807, case 9 in the compressible mode');
{
  const m = PumpIt.examples.get('air').build();
  Object.assign(m.system, { reLam: 300000, reTurb: 3000 });
  const v = PumpIt.model.validate(PumpIt.model.effective(m, 'base'));
  // the effective K of a valve drawn against the flow of a gas (review of aca2807, beside case 10)
  const kOf = (flip) => {
    const g = PumpIt.examples.get('air').build();
    const v = PumpIt.model.newJunction('valve', 9, 200, 200);
    Object.assign(v, { elevation: PumpIt.model.q(0, 'm'), lossModel: 'K', K: 5 });
    g.junctions.push(v);
    const p1 = g.pipes.find((p) => p.id === 1), p9 = PumpIt.model.newPipe(9, 9, 2);
    Object.assign(p9, JSON.parse(JSON.stringify({ material: p1.material, geometry: p1.geometry, friction: p1.friction, length: p1.length })));
    p1.down = 9; g.pipes.push(p9);
    if (flip) for (const p of [p1, p9]) [p.up, p.down] = [p.down, p.up];
    const r = PumpIt.solver.run(PumpIt.model.effective(g, 'base'));
    return r.ok ? r.junctions[9] : { K: NaN, m: NaN, err: r.errors };
  };
  const ka = kOf(false), kb = kOf(true);
  ok('aca2807-10 gas: a valve of K 5 drawn against the flow gives the same effective K as drawn with it', ka.m > 0 && kb.m < 0 && Math.abs(ka.K - kb.K) < 1e-6 * ka.K && ka.K > 0, `${ka.K} ${kb.K}`);
  ok('aca2807-9 a gas with inverted limits: the system is pending', !v.ok && v.items.find((i) => i.key === 'sys').detail.includes(PumpIt.i18n.t('core.checklist.fluid.reynolds')));
}

console.log('\nReview of ab3e0d1, bug 1: a gas pipe of no friction on a slope');
if (PumpIt) {
  const M = PumpIt.model, q = M.q;
  // the case of the report: the source of example D, 500 m of pipe and an imposed demand at the elevation z
  const run = (z, friction, Qkg, mode) => {
    const m = PumpIt.examples.get('air').build();
    m.system.gasMode = mode;
    const source = Object.assign(m.junctions[2], { id: 1 });
    const demand = Object.assign(M.newJunction('flow', 2, 0, 0), { elevation: q(z, 'm'), Q: q(Qkg, 'kg/s'), dir: 'out' });
    m.junctions = [source, demand];
    m.pipes = m.pipes.slice(0, 1);
    Object.assign(m.pipes[0], { length: q(500, 'm'), friction });
    const e = M.effective(m, 'base'), s = PumpIt.solver.run(e);
    const conv = s.ok && !s.warnings.some((w) => /converge/i.test(w.text));
    return { e, s, r: s.ok ? s.pipes[1] : null, ok: M.validate(e).ok && conv, zs: PumpIt.units.toSI(source.elevation.value, source.elevation.unit, 'length') };
  };
  const none = { model: 'frictionless' };
  for (const mode of ['isothermal', 'adiabatic']) {
    const h = run(0, none, 0.1, mode), up = run(500, none, 0.1, mode), dn = run(-500, none, 0.1, mode);
    const all = h.ok && up.ok && dn.ok;
    ok(`ab3e0d1-1 ${mode}: the three cases solve and converge`, all, all ? '' : [h, up, dn].map((o) => (o.s.errors || []).join('; ')).join(' | '));
    if (!all) continue;
    ok(`ab3e0d1-1 ${mode}: the imposed flow is honoured`, [h, up, dn].every((o) => Math.abs(o.r.m - 0.1) < 1e-9));
    ok(`ab3e0d1-1 ${mode}: a horizontal pipe keeps its pressure`, near(h.r.Pout, h.r.Pin, 1e-9), `${h.r.Pin.toFixed(3)} → ${h.r.Pout.toFixed(3)} Pa`);
    ok(`ab3e0d1-1 ${mode}: the pressure falls on the rise and grows on the descent`, up.r.Pout < h.r.Pout - 1e4 && dn.r.Pout > h.r.Pout + 1e4,
      `rise ${up.r.Pout.toFixed(2)}, level ${h.r.Pout.toFixed(2)}, descent ${dn.r.Pout.toFixed(2)} Pa`);
    // an independent column of gas at low flow, with the absolute T and the specific R: isothermal, P2/P1 =
    // exp(−g·Δz/(Z·R·T)); adiabatic, the gas cools by g·Δz/cp as it rises (G-39), so the column is isentropic,
    // P2/P1 = (1 − g·Δz/(cp·T))^(cp/(Z·R))
    const fl = PumpIt.fluids.evaluateGas(h.e.system), g = 9.80665 * (h.e.system.gravity || 1), R = 8314.462618 / fl.MW, cp = fl.k * R / (fl.k - 1);
    for (const z of [500, -500]) {
      const lo = run(z, none, 1e-6, mode);
      const dz = z - lo.zs;
      const col = mode === 'isothermal' ? Math.exp(-g * dz / (fl.Z * R * fl.T)) : Math.pow(1 - g * dz / (cp * fl.T), cp / (fl.Z * R));
      ok(`ab3e0d1-1 ${mode}: at low flow P2/P1 = the gas column (z ${z} m)`, lo.ok && near(lo.r.Pout / lo.r.Pin, col, 1e-7), lo.ok ? `${(lo.r.Pout / lo.r.Pin).toFixed(10)} × ${col.toFixed(10)}` : (lo.s.errors || []).join('; '));
    }
    // continuity as the friction tends to zero, on the rise and on the descent
    for (const [z, o0] of [[500, up], [-500, dn]]) {
      const fs = [1e-3, 1e-4, 1e-5, 1e-6, 1e-7, 1e-9].map((f) => run(z, { model: 'explicitF', f }, 0.1, mode));
      const gaps = fs.map((o) => (o.ok ? Math.abs(o.r.Pout - o0.r.Pout) : NaN));
      ok(`ab3e0d1-1 ${mode}: the pressure is continuous as f → 0 (z ${z} m)`, gaps.every((d, i) => Number.isFinite(d) && (i === 0 || d < gaps[i - 1])) && gaps[gaps.length - 1] < 1e-3,
        gaps.map((d) => d.toExponential(1)).join(' '));
    }
  }
  // a compressor at a fixed ratio beside a pipe of no loss on a slope reads the Mach at the end of that pipe
  for (const mode of ['isothermal', 'adiabatic']) {
    const m = M.newModel();
    Object.assign(m.system, { regime: 'compressible', gasMode: mode });
    m.system.fluidGas = Object.assign(M.newGasFluid(), { gas: 'air', Z: 1, T: q(300, 'K') });
    const J = (type, id, props) => m.junctions.push(Object.assign(M.newJunction(type, id, 0, 0), { elevation: q(0, 'm') }, props));
    J('reservoir', 1, { surfP: q(1, 'bar(a)'), liquidElev: q(0, 'm') });
    J('pump', 2, { mode: 'ratio', ratio: 2, state: 'on' });
    J('pressure', 3, { P: q(1.5, 'bar(a)'), ptype: 'static', elevation: q(200, 'm') });
    for (const [id, a, b, L, Dmm, friction] of [[1, 1, 2, 30, 100, { model: 'frictionless' }], [2, 2, 3, 300, 50, { model: 'explicitF', f: 0.02 }]]) {
      const p = Object.assign(M.newPipe(id, a, b), { material: { kind: 'user', nps: '4', sch: '40' }, length: q(L, 'm'), friction });
      p.geometry.d = q(Dmm, 'mm');
      m.pipes.push(p);
    }
    m.junctions[0].elevation = q(-100, 'm');
    const e = M.effective(m, 'base'), r = M.validate(e).ok ? PumpIt.solver.run(e) : { ok: false, errors: ['incomplete model'] };
    ok(`ab3e0d1-1 ${mode}: a fixed-ratio compressor after a pipe of no loss keeps P0 out = 2·P0 in`, r.ok && r.pumps[2].m > 0 && near(r.junctions[2].P0out / r.junctions[2].P0in, 2, 1e-9),
      r.ok ? `r = ${(r.junctions[2].P0out / r.junctions[2].P0in).toFixed(10)}, ṁ ${r.pumps[2].m.toFixed(4)} kg/s` : r.errors.join('; '));
  }
}

console.log('\nReview of 6043c80, bug 1: the potential energy in the energy balance of the adiabatic model');
if (PumpIt) {
  const M = PumpIt.model, q = M.q;
  const g = 9.80665, cp = 1.4 * (8314.462618 / 28.9647) / 0.4;
  // the case of the report: the source of example D as a stagnation pressure, 1000 m of pipe and a demand of 0.1 kg/s
  // at the elevation z; series: two pipes of 500 m through a branch at z/2; rev: the pipe (or pipe 1 or 2 of the series)
  // drawn against the flow
  const build = (mode, z, o = {}) => {
    const m = PumpIt.examples.get('air').build();
    m.system.gasMode = mode;
    m.system.fluidGas = Object.assign(M.newGasFluid(), { gas: 'custom', MW: 28.9647, k: 1.4, Z: 1, T: q(300, 'K') });
    const src = Object.assign(m.junctions[2], { id: 1, ptype: 'stagnation', elevation: q(0, 'm') });
    const sink = Object.assign(M.newJunction('flow', 2, 0, 0), { elevation: q(z, 'm'), Q: q(0.1, 'kg/s'), dir: 'out' });
    const fr = () => (o.darcy ? { model: 'roughness', eps: q(0.046, 'mm') } : { model: 'frictionless' });
    if (!o.series) {
      m.junctions = [src, sink];
      m.pipes = m.pipes.slice(0, 1);
      Object.assign(m.pipes[0], o.rev ? { up: 2, down: 1 } : { up: 1, down: 2 }, { length: q(1000, 'm'), friction: fr() });
    } else {
      m.junctions = [src, sink, Object.assign(M.newJunction('branch', 3, 0, 0), { elevation: q(z / 2, 'm') })];
      m.pipes = m.pipes.slice(0, 2);
      Object.assign(m.pipes[0], o.rev === 1 ? { up: 3, down: 1 } : { up: 1, down: 3 }, { length: q(500, 'm'), friction: fr() });
      Object.assign(m.pipes[1], o.rev === 2 ? { up: 2, down: 3 } : { up: 3, down: 2 }, { length: q(500, 'm'), friction: fr() });
    }
    const e = M.effective(m, 'base'), s = M.validate(e).ok ? PumpIt.solver.run(e) : { ok: false, errors: ['incomplete model'] };
    return s.ok && s.converged ? s : Object.assign(s, { ok: false, errors: s.errors || ['not converged'] });
  };
  // the stagnation temperature where the gas leaves pipe id, whatever its reference direction
  const leaves = (s, id) => (s.pipes[id].m >= 0 ? s.pipes[id].T0out : s.pipes[id].T0in);
  const enters = (s, id) => (s.pipes[id].m >= 0 ? s.pipes[id].T0in : s.pipes[id].T0out);
  for (const darcy of [false, true]) {
    const how = darcy ? 'Darcy' : 'no friction';
    for (const z of [0, 1000, -1000]) {
      const want = 300 - g * z / cp, s = build('adiabatic', z, { darcy });
      ok(`6043c80-1 ${how}, z ${z} m: cp·(T0 out − T0 in) + g·Δz = 0 (${want.toFixed(2)} K), also at the demand`,
        s.ok && Math.abs(leaves(s, 1) - want) < 0.02 && Math.abs(s.junctions[2].T0 - want) < 0.02 && Math.abs(enters(s, 1) - 300) < 1e-9,
        s.ok ? `${enters(s, 1)} → ${leaves(s, 1)} K, J2 ${s.junctions[2].T0} K` : s.errors.join('; '));
    }
    for (const z of [1000, -1000]) {
      const want = 300 - g * z / cp, mid = 300 - g * z / 2 / cp;
      for (const rev of [0, 1, 2]) {
        const s = build('adiabatic', z, { darcy, series: true, rev });
        ok(`6043c80-1 ${how}, z ${z} m in two pipes of 500 m${rev ? `, P${rev} reversed` : ''}: T0 continuous at the middle node, the same at the end`,
          s.ok && Math.abs(leaves(s, 1) - mid) < 0.02 && Math.abs(s.junctions[3].T0 - leaves(s, 1)) < 1e-6 && Math.abs(enters(s, 2) - s.junctions[3].T0) < 1e-6
            && Math.abs(leaves(s, 2) - want) < 0.02 && Math.abs(s.junctions[2].T0 - want) < 0.02,
          s.ok ? `P1 ${leaves(s, 1).toFixed(4)}, J3 ${s.junctions[3].T0.toFixed(4)}, P2 ${enters(s, 2).toFixed(4)} → ${leaves(s, 2).toFixed(4)} K` : s.errors.join('; '));
      }
      const r = build('adiabatic', z, { darcy, rev: true });
      ok(`6043c80-1 ${how}, z ${z} m, the pipe drawn against the flow: the same T0 at the demand`,
        r.ok && r.pipes[1].m < 0 && Math.abs(r.pipes[1].T0in - want) < 0.02 && Math.abs(r.pipes[1].T0out - 300) < 1e-9 && Math.abs(r.junctions[2].T0 - want) < 0.02,
        r.ok ? `${r.pipes[1].T0out} → ${r.pipes[1].T0in} K` : r.errors.join('; '));
    }
  }
  // the isothermal model imposes the static temperature: it stays the gas temperature at both ends, at any elevation
  for (const z of [1000, -1000]) {
    const s = build('isothermal', z);
    ok(`6043c80-1 isothermal, z ${z} m: the static temperature stays 300 K at both ends`, s.ok && s.pipes[1].Tin === 300 && s.pipes[1].Tout === 300,
      s.ok ? `${s.pipes[1].Tin} → ${s.pipes[1].Tout} K` : s.errors.join('; '));
  }
  // the next equipment gets the enthalpy that leaves the pipe: a compressor 200 m above its source sucks gas cooled by
  // g·200/cp, and heats it from there
  {
    const m = M.newModel();
    Object.assign(m.system, { regime: 'compressible', gasMode: 'adiabatic' });
    m.system.fluidGas = Object.assign(M.newGasFluid(), { gas: 'custom', MW: 28.9647, k: 1.4, Z: 1, T: q(300, 'K') });
    const J = (type, id, props) => m.junctions.push(Object.assign(M.newJunction(type, id, 0, 0), props));
    J('pressure', 1, { P: q(2, 'bar(a)'), ptype: 'stagnation', elevation: q(0, 'm') });
    J('pump', 2, { mode: 'ratio', ratio: 1.5, state: 'on', elevation: q(200, 'm') });
    J('pressure', 3, { P: q(2.5, 'bar(a)'), ptype: 'static', elevation: q(200, 'm') });
    for (const [id, a, b, L] of [[1, 1, 2, 400], [2, 2, 3, 300]]) {
      const p = Object.assign(M.newPipe(id, a, b), { material: { kind: 'user', nps: '4', sch: '40' }, length: q(L, 'm'), friction: { model: 'roughness', eps: q(0.046, 'mm') } });
      m.pipes.push(p);
    }
    const e = M.effective(m, 'base'), s = M.validate(e).ok ? PumpIt.solver.run(e) : { ok: false, errors: ['incomplete model'] };
    const want = 300 - g * 200 / cp;
    ok('6043c80-1 a compressor 200 m above its source takes the gas at 300 − g·200/cp', s.ok && s.pumps[2].m > 0 && Math.abs(s.pumps[2].T0in - want) < 0.02 && s.pumps[2].T0out > s.pumps[2].T0in,
      s.ok ? `T0 in ${s.pumps[2].T0in} K (want ${want.toFixed(4)}), out ${s.pumps[2].T0out} K, ṁ ${s.pumps[2].m}` : s.errors.join('; '));
  }
}

console.log('\nReview of 319654f, bug 9: the loss curve of a generic component in the compressible mode');
if (PumpIt) {
  const M = PumpIt.model, q = M.q;
  // the air example with a component on a loss curve between pipe P1 and a new pipe to J2
  const run = (fit, x, y) => {
    const m = PumpIt.examples.get('air').build();
    const p = m.pipes[0], nx = M.clone(p);
    m.junctions.push(Object.assign(M.newJunction('generic', 9, 0, 0), { elevation: q(0, 'm'), genModel: 'curve', curve: { x, y, xUnit: 'm³/h', yUnit: 'kPa', fit } }));
    Object.assign(nx, { id: 9, up: 9, down: p.down }); p.down = 9; m.pipes.push(nx);
    const e = M.effective(m, 'base'), v = M.validate(e), s = PumpIt.solver.run(e);
    return { v, s, msgs: [...v.undef.values()].flat(), text: [...v.undef.values()].flat().join(' | ') + ' || ' + (s.ok ? 'solved' : s.errors.join('; ')) };
  };
  const dip = run('2', [0, 100, 110], [0, 10, 50]), fall = run('xy', [0, 100, 110], [0, 10, 9]), rise = run('xy', [0, 100, 200], [0, 10, 40]);
  ok('319654f-9 gas: a fit below zero between the points is refused by the checklist and by the solver', !dip.v.ok && dip.msgs.some((x) => /gain from 0 to 97\.18/.test(x)) && !dip.s.ok && /J9/.test(dip.s.errors[0]), dip.text);
  ok('319654f-9 gas: a loss that falls is refused, the flow being found from the loss', !fall.v.ok && fall.msgs.some((x) => /falls/.test(x)) && !fall.s.ok && /J9.*falls/.test(fall.s.errors[0]), fall.text);
  const r = rise.s.ok && rise.s.junctions[9];
  ok('319654f-9 gas: a rising loss curve calculates, with a loss along the flow', rise.v.ok && rise.s.ok && r.m > 0 && r.dP > 0, rise.text);
}

console.log('\nReview of 319654f, bug 3: laminar flow in an annulus');
{
  const Fw = PumpIt.gas.flow, H = PumpIt.hyd;
  const d = { fm: 'darcy', eD: 0, fx: 0, reLam: 2300, reTurb: 4000 };
  const phi = H.annulusLaminar(0.8);
  ok('G3a the gas friction of an annulus is phi·64/Re in laminar flow', Math.abs(Fw.friction(Object.assign({ phiLam: phi }, d), 1000) - phi * 0.064) < 1e-15);
  ok('G3a ... and of a K element or a circle 64/Re, as before', Fw.friction(d, 1000) === 0.064 && Fw.friction(Object.assign({ phiLam: 1 }, d), 1000) === 0.064);
  ok('G3a ... no step at Re_lam', Math.abs(Fw.friction(Object.assign({ phiLam: phi }, d), 2300 - 1e-9) - Fw.friction(Object.assign({ phiLam: phi }, d), 2300)) < 1e-12);
  // an air model whose pipe is an annulus: its d carries the factor
  const m = PumpIt.examples.get('air').build();
  m.pipes[0].geometry = { kind: 'annulus', dOuter: PumpIt.model.q(100, 'mm'), dInner: PumpIt.model.q(80, 'mm') };
  const prep = PumpIt.gas.prepare(PumpIt.model.effective(m, 'base'));
  const lk = prep && prep.links && prep.links.find((l) => l.kind === 'pipe' && l.pid === m.pipes[0].id);
  ok('G3a the duct of an annulus pipe in a gas model carries its laminar factor', !!lk && Math.abs(lk.d.phiLam - phi) < 1e-12, JSON.stringify(lk && lk.d.phiLam));
}

console.log('\nReview of 319654f, bugs 5 and 6: results of a gas that depend on the direction or the end');
{
  const M = PumpIt.model, q = M.q;
  // a valve of K 5 between pipe P1 (100 mm) and a new pipe of 150 mm in the air example, drawn with or against the flow
  const valve = (flip, type = 'valve') => {
    const m = PumpIt.examples.get('air').build();
    const v = Object.assign(M.newJunction(type, 9, 0, 0), { elevation: q(0, 'm') });
    if (type === 'valve') Object.assign(v, { lossModel: 'K', K: 5 });
    m.junctions.push(v);
    const p = m.pipes[0], next = M.clone(p);
    p.down = 9; Object.assign(next, { id: 9, up: 9, down: 2 });
    p.geometry = { kind: 'circular', d: q(100, 'mm') };
    next.geometry = { kind: 'circular', d: q(150, 'mm') };
    m.pipes.push(next);
    if (flip) for (const l of [p, next]) [l.up, l.down] = [l.down, l.up];
    Object.assign(m.solution.time, { on: true, start: q(0, 's'), stop: q(60, 's'), step: q(30, 's') });
    v.time = { use: true, what: 'K', basis: 'absolute', start: 'single', when: [{ q: 'cv', obj: 'j:9', op: '>=', value: q(300, '') }], tables: [{ t: [0], v: [20], tUnit: 's', vUnit: '' }], interp: 'step', repeat: false };
    const e = M.effective(m, 'base'), s = PumpIt.solver.run(e);
    return { e, s, r: s.ok && s.valves[9], text: s.ok ? 'solved' : s.errors.join('; ') };
  };
  const fwd = valve(false), rev = valve(true);
  ok('319654f-5 gas Cv: the same valve and flow drawn against the flow give the same Cv (188.9, the area of the 100 mm pipe it comes from)',
    fwd.r && rev.r && rev.r.m < 0 && Math.abs(fwd.r.Cv - 188.9001) < 1e-3 && Math.abs(rev.r.Cv - fwd.r.Cv) < 1e-5, `${fwd.r && fwd.r.Cv} ${rev.r && rev.r.Cv}`);
  const runs = [fwd, rev].map((o) => PumpIt.time.run(o.e));
  ok('319654f-5 gas Cv: an event on the Cv (≥ 300) fires in neither drawing', runs.every((x) => x.ok && !x.events.some((ev) => ev.key === 'core.time.log.table.started')), JSON.stringify(runs.map((x) => x.events.map((ev) => ev.key))));
  // bug 6: the extremes of the flows and velocities of a gas pipe take both ends and tell the end
  const m = PumpIt.examples.get('air').build();
  Object.assign(m.solution.time, { on: true, start: q(0, 's'), stop: q(60, 's'), step: q(30, 's') });
  const run = PumpIt.time.run(M.effective(m, 'base'));
  const all = Object.entries(run.series.pipes).every(([id, row]) => {
    const X = run.extremes.pipes[id], Qs = [...row.Q, ...row.Qout];
    return X.Qmax.v === Math.max(...Qs) && X.Qmin.v === Math.min(...Qs) && ['in', 'out'].includes(X.Qmax.end) && ['in', 'out'].includes(X.Vmax.end);
  });
  const X1 = run.extremes.pipes[1];
  ok('319654f-6 gas extremes: Qmax of pipe 1 is 1203.66 m³/h at its outlet (918 m³/h at its inlet), and every pipe takes both ends', run.ok && all
    && Math.abs(X1.Qmax.v * 3600 - 1203.6649) < 1e-3 && X1.Qmax.end === 'out' && X1.Vmax.end === 'out', JSON.stringify(X1));
}

console.log('\nReview of a952425, items 1, 4 and 5: a rectangular duct, the Cd of a nozzle and the edge radius in the compressible mode');
if (PumpIt) {
  const M = PumpIt.model, q = M.q, H = PumpIt.hyd, Fw = PumpIt.gas.flow;
  // item 1: the gas friction and the duct of a rectangular pipe carry the factor of its sides
  const phi = H.rectLaminar(0.1), d = { fm: 'darcy', eD: 0, fx: 0, reLam: 2300, reTurb: 4000 };
  ok('a952425-1 the gas friction of a rectangle 1:10 is phi·64/Re in laminar flow (f·Re 84.68)', Math.abs(Fw.friction(Object.assign({ phiLam: phi }, d), 1000) - phi * 0.064) < 1e-15 && Math.abs(64 * phi - 84.676) < 1e-3);
  const m = PumpIt.examples.get('air').build();
  m.pipes[0].geometry = { kind: 'rectangular', width: q(100, 'mm'), height: q(10, 'mm') };
  const prep = PumpIt.gas.prepare(M.effective(m, 'base'));
  const lk = prep && prep.links && prep.links.find((l) => l.kind === 'pipe' && l.pid === m.pipes[0].id);
  ok('a952425-1 the duct of a rectangular pipe in a gas model carries its laminar factor', !!lk && Math.abs(lk.d.phiLam - phi) < 1e-12, JSON.stringify(lk && lk.d.phiLam));
  // the air example with an orifice between pipe P1 and a new pipe to J2, or its end J3 as a nozzle
  const look = (m) => {
    const e = M.effective(m, 'base'), v = M.validate(e), s = PumpIt.solver.run(e);
    const msgs = [...v.undef.values()].flat();
    return { v, s, msgs, text: msgs.join(' | ') + ' || ' + (s.ok ? 'solved' : s.errors.join('; ')) };
  };
  const withOrifice = (rmm) => {
    const m = PumpIt.examples.get('air').build();
    const p = m.pipes[0], nx = M.clone(p);
    m.junctions.push(Object.assign(M.newJunction('orifice', 9, 0, 0), { elevation: q(0, 'm'), orModel: 'rounded', dO: q(30, 'mm'), rEdge: q(rmm, 'mm') }));
    Object.assign(nx, { id: 9, up: 9, down: p.down }); p.down = 9; m.pipes.push(nx);
    return look(m);
  };
  const neg = withOrifice(-10), zero = withOrifice(0), pos = withOrifice(3);
  ok('a952425-5 gas: a negative edge radius is refused by the checklist and by the solver (its choking area uses it too)',
    !neg.v.ok && neg.msgs.includes(PumpIt.i18n.t('junctions.orifice.check.rEdge')) && !neg.s.ok && neg.s.errors[0] === PumpIt.i18n.t('junctions.orifice.error.rEdge', { id: 9 }), neg.text);
  ok('a952425-5 gas: radii of 0 and 3 mm calculate', zero.v.ok && zero.s.ok && pos.v.ok && pos.s.ok, zero.text + ' ' + pos.text);
  const nozzle = (Cd) => {
    const m = PumpIt.examples.get('air').build();
    const old = m.junctions.find((j) => j.id === 3);
    m.junctions[m.junctions.indexOf(old)] = Object.assign(M.newJunction('spray', 3, old.x, old.y), { elevation: old.elevation, sprayModel: 'CdA', Cd, nHoles: 1, dHole: q(20, 'mm'), Pext: old.P });
    return look(m);
  };
  const n62 = nozzle(62), n08 = nozzle(0.8);
  ok('a952425-4 gas: a nozzle with Cd 62 is refused by the checklist and by the solver; Cd 0.8 calculates',
    !n62.v.ok && n62.msgs.includes(PumpIt.i18n.t('junctions.spray.check.Cd')) && !n62.s.ok && /J3/.test(n62.s.errors[0]) && n08.v.ok && n08.s.ok, n62.text + ' ' + n08.text);
}

console.log('\nReview of a952425, items 2, 8 and 9 in the compressible mode: an exit valve drawn either way, a PDCV beyond what it passes fully open, a static pressure with an end K');
if (PumpIt) {
  const M = PumpIt.model, q = M.q, t = PumpIt.i18n.t, { KGF, fmtSI } = PumpIt.solver.util;
  // item 2: J3 of the air example as an exit valve of K 5 at its old pressure, the pipe to it drawn towards it or from it,
  // with a table that takes its K to 20 when its Cv reaches `limit`
  const exitAt = (flip, limit, extra = {}) => {
    const m = PumpIt.examples.get('air').build();
    const old = m.junctions.find((j) => j.id === 3);
    const v = Object.assign(M.newJunction('exitvalve', 3, old.x, old.y), { elevation: old.elevation, Pout: old.P, lossModel: 'K', K: 5 }, extra);
    m.junctions[m.junctions.indexOf(old)] = v;
    const p = m.pipes.find((x) => x.down === 3);
    if (flip) [p.up, p.down] = [p.down, p.up];
    Object.assign(m.solution.time, { on: true, start: q(0, 's'), stop: q(60, 's'), step: q(30, 's') });
    v.time = { use: true, what: 'K', basis: 'absolute', start: 'single', when: [{ q: 'cv', obj: 'j:3', op: '>=', value: q(limit, '') }], tables: [{ t: [0], v: [20], tUnit: 's', vUnit: '' }], interp: 'step', repeat: false };
    return m;
  };
  const steady = (m) => PumpIt.solver.run(M.effective(m, 'base'));
  const [a, b] = [false, true].map((flip) => steady(exitAt(flip, 140))).map((s) => s.ok && s.valves[3]);
  ok('a952425-2 gas exit valve: the same K and Cv (129.774) whichever way its pipe is drawn (145.25 drawn from the valve before)',
    !!a && !!b && Math.abs(a.Cv - 129.7741) < 1e-3 && Math.abs(b.Cv - a.Cv) < 1e-9 * a.Cv && Math.abs(b.K - a.K) < 1e-9 * a.K && Math.abs(b.m - a.m) < 1e-12, `${a && a.Cv} ${b && b.Cv}`);
  const runs = (limit) => [false, true].map((flip) => PumpIt.time.run(M.effective(exitAt(flip, limit), 'base')));
  const series = (r) => (r.ok ? [...r.series.valves[3].m] : []);
  const started = (r) => (r.ok ? r.events.filter((e) => e.key === 'core.time.log.table.started').length : -1);
  const r140 = runs(140), r120 = runs(120);
  ok('a952425-2 gas exit valve over time: an event at a Cv of 140 fires in neither drawing, the discharge 0.81473 kg/s throughout',
    r140.every((r) => started(r) === 0 && series(r).length === 3 && series(r).every((x) => Math.abs(x - 0.8147286) < 1e-6)), JSON.stringify(r140.map(series)));
  ok('a952425-2 … at a Cv of 120 it fires once in each drawing, with the same discharge (0.81473, then 0.72627 kg/s)',
    r120.every((r) => started(r) === 1) && series(r120[0]).length === 3 && series(r120[0]).every((x, i) => Math.abs(x - series(r120[1])[i]) < 1e-12)
      && Math.abs(series(r120[0])[1] - 0.7262712) < 1e-6, JSON.stringify(r120.map(series)));
  // closed, and at rest (J4 and its pipe removed, the residual pressure that of J1): no K nor Cv, in both drawings
  const none = (s) => s.ok && s.valves[3].m === 0 && Number.isNaN(s.valves[3].K) && Number.isNaN(s.valves[3].Cv);
  const closed = [false, true].map((flip) => steady(exitAt(flip, 140, { closed: true })));
  const still = [false, true].map((flip) => {
    const m = exitAt(flip, 140, { Pout: q(5, 'bar(g)') });
    m.junctions = m.junctions.filter((j) => j.id !== 4); m.pipes = m.pipes.filter((p) => p.id !== 3);
    return steady(m);
  });
  ok('a952425-2 a closed gas exit valve, and one without flow: no K nor Cv, in both drawings', closed.every(none) && still.every(none),
    JSON.stringify(closed.concat(still).map((s) => s.ok && [s.valves[3].m, s.valves[3].K, s.valves[3].Cv])));
  // an inflow (a residual pressure of 6 bar(g), above the network): the same end in both drawings, K about 5 and its Cv
  // by the loss along the flow, as for a liquid (review of e6b8f15, item 22), and the warning
  const inflow = [false, true].map((flip) => steady(exitAt(flip, 140, { Pout: q(6, 'bar(g)') })));
  const [ia, ib] = inflow.map((s) => s.ok && s.valves[3]);
  ok('a952425-2 an inflow through a gas exit valve: the same K (about 5) and Cv in both drawings, and its warning',
    !!ia && !!ib && ia.m < 0 && Math.abs(ia.K - 5) < 0.05 && Math.abs(ib.K - ia.K) < 1e-9 && ia.Cv > 0 && Math.abs(ib.Cv - ia.Cv) < 1e-9 * ia.Cv
      && inflow.every((s) => s.warnings.some((w) => w.text === t('junctions.exitvalve.warn.inflow', { id: 3 }))), `${ia && ia.K} ${ib && ib.K} ${ia && ia.Cv}`);

  // item 8: a PDCV between pipe P1 and a new pipe to J2 in the air example (as the valve of 319654f)
  const pdcv = (setDP, kOpen, special = 'none') => {
    const m = PumpIt.examples.get('air').build();
    m.junctions.push(Object.assign(M.newJunction('control', 9, 0, 0), { elevation: q(0, 'm'), ctype: 'PDCV', setDP: q(setDP, 'kPa'), kOpen, alwaysControl: false, special }));
    const p = m.pipes[0], next = M.clone(p);
    p.down = 9; Object.assign(next, { id: 9, up: 9, down: 2 });
    m.pipes.push(next);
    return steady(m);
  };
  const head = t('junctions.control.warn.beyondOpen', { id: 9, open: '', dp: '' }).split(':')[0];
  const beyond = (s) => s.ok && s.warnings.filter((w) => w.obj === 'j:9' && w.level === 'warning' && w.text.startsWith(head)).map((w) => w.text);
  const p5 = pdcv(5, 5), p100 = pdcv(100, 5), pOpen = pdcv(5, 50, 'open'), pChoke = pdcv(5, 5000), p0 = pdcv(5, 0);
  ok('a952425-8 gas PDCV: holding 5 kPa beyond what its fully open K of 5 passes, it keeps controlling and warns with the loss of the open valve',
    p5.ok && p5.states[9] === 'control' && beyond(p5).length === 1 && /kgf\/cm², /.test(beyond(p5)[0]), (beyond(p5) || []).join(' | '));
  ok('a952425-8 … with a set drop of 100 kPa, within what it passes, and forced fully open, no such warning',
    p100.ok && p100.states[9] === 'control' && !beyond(p100).length && pOpen.ok && pOpen.states[9] === 'open' && !beyond(pOpen).length);
  ok('a952425-8 … a fully open valve that would choke at the flow says so; a fully open K of 0 never warns',
    pChoke.ok && beyond(pChoke).join() === t('junctions.control.warn.beyondChoke', { id: 9, dp: fmtSI(5e3 / KGF) }) && p0.ok && !beyond(p0).length, (beyond(pChoke) || []).join(' | '));

  // item 9: J3 of the air example, a static pressure, with K in 4 at its pipe or none, in both models of the gas: the
  // same flow and the end of the pipe at its pressure, the K left out with a caution; a stagnation pressure keeps its K
  for (const mode of ['isothermal', 'adiabatic']) {
    const at3 = (ptype, kIn) => {
      const m = PumpIt.examples.get('air').build();
      m.system.gasMode = mode;
      Object.assign(m.junctions.find((j) => j.id === 3), { ptype, pipeK: { 2: { kIn, kOut: 0 } } });
      return steady(m);
    };
    const caution = (s) => s.ok && s.warnings.some((w) => w.text === t('core.solver.endKLeftOut', { id: 3, pipe: 2 }));
    const s4 = at3('static', 4), s0 = at3('static', 0), g4 = at3('stagnation', 4), g0 = at3('stagnation', 0);
    // 2.5 bar(g) over the atmospheric pressure of the model
    const P3 = s4.ok ? 2.5e5 + s4.patm : NaN;
    ok(`a952425-9 gas (${mode}): a static pressure with K in 4 gives the flow without it, the end of the pipe at its 351.325 kPa(a), and a caution`,
      s4.ok && s0.ok && Math.abs(s4.pipes[2].m - s0.pipes[2].m) < 1e-12 && Math.abs(s4.pipes[2].Pout - P3) < 1e-9 * P3 && caution(s4) && !caution(s0),
      `${s4.ok && s4.pipes[2].m} ${s0.ok && s0.pipes[2].m}, ${s4.ok && s4.pipes[2].Pout} Pa(a)`);
    ok(`a952425-9 gas (${mode}): a stagnation pressure keeps its K in 4 (a smaller flow), without the caution`,
      g4.ok && g0.ok && g4.pipes[2].m < g0.pipes[2].m - 1e-3 && !caution(g4), `${g4.ok && g4.pipes[2].m} ${g0.ok && g0.pipes[2].m}`);
  }
}

console.log('\nReview of a952425, items 10 and 11 in the compressible mode: an FCV closed by a failure, a PRV and a PSV against a reverse flow');
if (PumpIt) {
  const M = PumpIt.model, q = M.q;
  // a control valve J9 between pipe P1 and a new pipe to J2 in the air example (fully open K 5), the surface pressure of
  // J1 following the steps of vals (bar(g)), one every 30 s, the first that of the steady state
  const net = (mode, props, vals) => {
    const m = PumpIt.examples.get('air').build();
    m.system.gasMode = mode;
    m.junctions.push(Object.assign(M.newJunction('control', 9, 0, 0), { elevation: q(0, 'm'), setP: q(4.5, 'bar(g)'), setQ: q(1, 'kg/s'), basis: 'static', kOpen: 5, alwaysControl: false, failAction: 'closed', special: 'none' }, props));
    const p = m.pipes[0], next = M.clone(p);
    p.down = 9; Object.assign(next, { id: 9, up: 9, down: 2 });
    m.pipes.push(next);
    const j1 = m.junctions.find((j) => j.id === 1);
    j1.surfP = q(vals[0], 'bar(g)');
    j1.time = { use: true, what: 'surfP', basis: 'absolute', start: 'time', when: [], interp: 'step', repeat: false, tables: [{ t: vals.map((_, i) => 30 * i), v: vals, tUnit: 's', vUnit: 'bar(g)' }] };
    Object.assign(m.solution.time, { on: true, start: q(0, 's'), stop: q(30 * (vals.length - 1), 's'), step: q(30, 's') });
    return PumpIt.time.run(M.effective(m, 'base'));
  };
  const series = (r) => (r.ok ? [...r.series.valves[9].m] : []);
  const events = (r) => (r.ok ? r.events.filter((e) => e.obj === 'j:9').map((e) => e.t + ':' + e.key.split('.').pop()).join(' ') : '');
  const show = (r) => (r.ok ? `${series(r).map((x) => x.toFixed(5)).join(', ')} kg/s; ${events(r)}` : r.errors.join('; '));
  for (const mode of ['isothermal', 'adiabatic']) {
    // an FCV of 1 kg/s cannot pass it from 3 bar(g), and can from 5 bar(g)
    const f = net(mode, { ctype: 'FCV' }, [3, 5, 3, 5]), xs = series(f);
    ok(`a952425-10 gas (${mode}): an FCV closed for lack of pressure controls again when the supply recovers, and closes again when it falls (0, 1, 0, 1 kg/s)`,
      xs.length === 4 && xs[0] === 0 && xs[2] === 0 && Math.abs(xs[1] - 1) < 1e-9 && Math.abs(xs[3] - 1) < 1e-9 && events(f) === '30:control 60:closed 90:control', show(f));
    // a PRV of 4.5 bar(g), fully open from 5 bar(g); at 1 bar(g) the flow would turn back from J3 and J4
    const p = net(mode, { ctype: 'PRV' }, [5, 1, 5]), ys = series(p);
    ok(`a952425-11 gas (${mode}): a fully open PRV closes against the reverse flow, and opens again when the supply is back`,
      ys.length === 3 && ys[0] > 1.3 && ys[1] === 0 && Math.abs(ys[2] - ys[0]) < 1e-9 * ys[0] && events(p) === '30:closed 60:open', show(p));
    const o = net(mode, { ctype: 'PRV', special: 'open' }, [5, 1]), zs = series(o);
    ok(`a952425-11 gas (${mode}): forced fully open by its special condition, it lets the reverse flow through`, zs.length === 2 && zs[1] < -0.6, show(o));
    const s = net(mode, { ctype: 'PSV', setP: q(1, 'bar(g)') }, [5, 1, 1]), ws = series(s);
    ok(`a952425-11 gas (${mode}): a fully open PSV closes against a reverse flow too`, ws.length === 3 && ws[0] > 1.3 && ws[1] === 0 && ws[2] === 0 && events(s) === '30:closed', show(s));
  }
}

console.log('\nShort pipes between a static and a stagnation end (a gas issue left open by the review of a952425): pipes of fL/D up to 1');
if (PumpIt) {
  const M = PumpIt.model, q = M.q;
  const node = (type, id, props) => Object.assign(M.newJunction(type, id, id * 100, 0), { elevation: q(0, 'm') }, props);
  const tank = (id, bar, pipeK = {}) => node('reservoir', id, { liquidElev: q(0, 'm'), surfP: q(bar, 'bar(a)'), pipeK });
  const stat = (id, bar) => node('pressure', id, { P: q(bar, 'bar(a)'), ptype: 'static' });
  // pipes of 100 mm with f = 0.02, fL/D = F at a length of 5·F m, drawn from `up` to `down` or the other way round
  const tube = (id, up, down, F, flip) => Object.assign(M.newPipe(id, flip ? down : up, flip ? up : down),
    { length: q(5 * F, 'm'), geometry: { kind: 'circular', d: q(100, 'mm') }, friction: { model: 'explicitF', f: 0.02 } });
  const gasModel = (mode, junctions, pipes) => {
    const m = M.newModel();
    Object.assign(m.system, { regime: 'compressible', gasMode: mode });
    Object.assign(m, { junctions, pipes });
    return m;
  };
  const run = (m) => PumpIt.solver.run(M.effective(m, 'base'));
  // the flow of pipe id from `up` to `down` whichever way it is drawn, and whether pipe cid chokes; null when the run fails
  const flowOf = (s, id, flip, cid = id) => (s.ok && s.converged !== false ? { m: (flip ? -1 : 1) * s.pipes[id].m, choked: s.pipes[cid].choked } : null);
  const show = (r) => r.map((x) => (x ? x.m.toFixed(5) + (x.choked ? ' choked' : '') : 'failed')).join(', ');
  // the same in both drawings (a pipe marched from one end or from the other, within 1e-6), decreasing with F, without a
  // jump at F = 1 (the step from 1 to 1.01 below 0.5 %)
  const smooth = (a, b) => a.every((x, i) => x && b[i] && Math.abs(x.m - b[i].m) <= 1e-6 * x.m && (i === 0 || x.m < a[i - 1].m))
    && Math.abs(a.at(-2).m - a.at(-1).m) < 5e-3 * a.at(-1).m;
  const Fs = [0.5, 0.9, 1, 1.01];
  for (const mode of ['isothermal', 'adiabatic']) {
    // a reservoir into a static pressure of 1 bar(a): singular below fL/D 1 before; at 3 bar(a) the pipe chokes
    for (const P1 of [1.05, 3]) {
      const [a, b] = [false, true].map((flip) => Fs.map((F) => flowOf(run(gasModel(mode, [tank(1, P1), stat(2, 1)], [tube(1, 1, 2, F, flip)])), 1, flip)));
      ok(`short pipe (${mode}): from ${P1} bar(a) into a static pressure of 1 bar(a), fL/D 0.5 to 1.01, the same flow drawn either way, continuous across 1` + (P1 > 2 ? ', choked' : ''),
        smooth(a, b) && a.every((x) => x.choked === (P1 > 2)), show(a));
    }
    // at a drop of 50 Pa the flow approaches the incompressible ΔP = (1 + F)·ρV²/2, the velocity head of the static end
    // included (gas at 1 bar(a) and 20 °C)
    const rho = 1e5 * PumpIt.fluids.evaluateGas(M.newModel().system).MW / (8314.462618 * 293.15), A = Math.PI * 0.1 ** 2 / 4;
    const drop = [0.5, 1, 2].flatMap((F) => [false, true].map((flip) => {
      const m = gasModel(mode, [tank(1, 1), stat(2, 1)], [tube(1, 1, 2, F, flip)]);
      m.junctions[0].surfP = q(100050, 'Pa(a)');
      const x = flowOf(run(m), 1, flip);
      return x ? x.m / (rho * A * Math.sqrt(2 * 50 / ((1 + F) * rho))) - 1 : NaN;
    }));
    ok(`short pipe (${mode}): at a drop of 50 Pa the flow is that of ΔP = (1 + F)·ρV²/2 within 1e-4, fL/D 0.5, 1 and 2, drawn either way`,
      drop.every((d) => Math.abs(d) < 1e-4), drop.map((d) => (d * 1e6).toFixed(1) + ' ppm').join(', '));
    // a valve of K 2 between reservoirs at 2 and 1.5 bar(a): the isothermal model diverged with pipes of fL/D 0.8 to 1
    // (the flow of the inlet pipe, whether the outlet pipe chokes)
    const valve = (P1, P3, F, flip) => flowOf(run(gasModel(mode, [tank(1, P1), node('valve', 2, { lossModel: 'K', K: 2 }), tank(3, P3)], [tube(1, 1, 2, F, flip), tube(2, 2, 3, F, flip)])), 1, flip, 2);
    const [va, vb] = [false, true].map((flip) => [0.8, 0.9, 1, 1.01].map((F) => valve(2, 1.5, F, flip)));
    ok(`short pipe (${mode}): a valve between reservoirs at 2 and 1.5 bar(a), pipes of fL/D 0.8 to 1.01, the same flow drawn either way, continuous across 1`,
      smooth(va, vb) && va.every((x) => !x.choked), show(va));
    // from 3 to 1 bar(a) the outlet pipe chokes (failed before in the isothermal model, where its inlet is a free node of
    // static pressure)
    const [ca, cb] = [false, true].map((flip) => Fs.map((F) => valve(3, 1, F, flip)));
    ok(`short pipe (${mode}): the same valve from 3 to 1 bar(a), choked, the same flow drawn either way, continuous across 1`,
      smooth(ca, cb) && ca.every((x) => x.choked), show(ca));
    // a static pressure of 1.05 bar(a) feeding a reservoir at 1 bar(a): with an exit K of 2 below fL/D 1 as above it; without
    // it the losses fall below the velocity head the static end gives, and the gas accelerates until the pipe chokes
    const feed = (F, kIn) => flowOf(run(gasModel(mode, [stat(1, 1.05), tank(2, 1, { 1: { kIn, kOut: 0 } })], [tube(1, 1, 2, F, false)])), 1, false);
    const fk = Fs.map((F) => feed(F, 2)), f0 = feed(0.5, 0);
    ok(`short pipe (${mode}): a static pressure feeding a reservoir with an exit K of 2, fL/D 0.5 to 1.01, continuous across 1; without the exit K, choked at fL/D 0.5`,
      fk.every((x, i) => x && !x.choked && (i === 0 || x.m < fk[i - 1].m)) && Math.abs(fk[2].m - fk[3].m) < 5e-3 * fk[3].m && !!f0 && f0.choked,
      `${show(fk)}; ${show([f0])}`);
    // over time: 1.05, 3, 1.0 and 1.5 bar(a) into a static pressure of 1 bar(a) through a pipe of fL/D 0.5, drawn from it
    const tm = gasModel(mode, [tank(1, 1.05), stat(2, 1)], [tube(1, 1, 2, 0.5, true)]);
    tm.junctions[0].time = { use: true, what: 'surfP', basis: 'absolute', start: 'time', when: [], interp: 'step', repeat: false, tables: [{ t: [0, 30, 60, 90], v: [1.05, 3, 1, 1.5], tUnit: 's', vUnit: 'bar(a)' }] };
    Object.assign(tm.solution.time, { on: true, start: q(0, 's'), stop: q(90, 's'), step: q(30, 's') });
    const tr = PumpIt.time.run(M.effective(tm, 'base'));
    const series = tr.ok ? [...tr.series.pipes[1].m].map((x) => -x) : [];
    const steady = [1.05, 3, 1, 1.5].map((P1) => flowOf(run(gasModel(mode, [tank(1, P1), stat(2, 1)], [tube(1, 1, 2, 0.5, true)])), 1, true));
    ok(`short pipe (${mode}): over time, 1.05, 3, 1 and 1.5 bar(a) into the static pressure, each step as its steady state, no flow at equal pressures`,
      series.length === 4 && steady.every((x) => x) && series.every((x, i) => Math.abs(x - steady[i].m) <= 1e-9 * Math.max(steady[i].m, 1e-9)) && series[2] === 0,
      tr.ok ? series.map((x) => x.toFixed(5)).join(', ') : tr.errors.join('; '));
  }
}

console.log('\nControl valves that cannot control (a gas issue left open by the review of a952425): PRV, PSV and FCV from scratch');
if (PumpIt) {
  const M = PumpIt.model, q = M.q;
  const node = (type, id, props) => Object.assign(M.newJunction(type, id, id * 100, 0), { elevation: q(0, 'm') }, props);
  const tank = (id, bar) => node('reservoir', id, { liquidElev: q(0, 'm'), surfP: q(bar, 'bar(a)') });
  // a valve between a supply and a reservoir at 1.5 bar(a), pipes of 20 m and 100 mm with f = 0.02
  const valveModel = (mode, P1, props) => {
    const m = M.newModel();
    Object.assign(m.system, { regime: 'compressible', gasMode: mode });
    m.solution.maxIter = 50; // these networks converge in a few iterations; a lower limit shortens the attempts without a solution
    m.junctions = [tank(1, P1), node('control', 2, Object.assign({ basis: 'stagnation', alwaysControl: false, kOpen: 2, special: 'none', failAction: 'open' }, props)), tank(3, 1.5)];
    m.pipes = [1, 2].map((id) => Object.assign(M.newPipe(id, id, id + 1), { length: q(20, 'm'), geometry: { kind: 'circular', d: q(100, 'mm') }, friction: { model: 'explicitF', f: 0.02 } }));
    return m;
  };
  const run = (m) => PumpIt.solver.run(M.effective(m, 'base'));
  const prv = { ctype: 'PRV', setP: q(2.5, 'bar(a)') }, psv = { ctype: 'PSV', setP: q(2.5, 'bar(a)') };
  const fcv = { ctype: 'FCV', setQ: q(3, 'kg/s') }, fcvClosed = Object.assign({}, fcv, { failAction: 'closed' });
  // the state and flow of the valve, and whether they are those of the valve held in that state by its special condition
  const check = (mode, props, P1) => {
    const s = run(valveModel(mode, P1, props));
    if (!s.ok || s.converged === false) return { text: s.ok ? 'not converged' : s.errors.join('; '), good: false };
    const st = s.states[2], m = s.pipes[1].m;
    let good = true;
    if (st !== 'control') {
      const r = run(valveModel(mode, P1, Object.assign({}, props, { special: st })));
      good = r.ok && Math.abs(r.pipes[1].m - m) <= 1e-6 * Math.max(Math.abs(m), 1e-3);
    }
    return { st, m, good, text: `${st} ${m.toFixed(5)}` };
  };
  const cases = [
    ['a PRV of 2.5 bar(a)', prv, [[1, 'closed'], [2, 'open'], [5, 'control']]],
    ['a PSV of 2.5 bar(a)', psv, [[1, 'closed'], [2, 'closed'], [5, 'open']]],
    ['an FCV of 3 kg/s failing open', fcv, [[2, 'open'], [5, 'control']]],
    ['an FCV of 3 kg/s failing closed', fcvClosed, [[2, 'closed'], [5, 'control']]],
  ];
  for (const mode of ['isothermal', 'adiabatic']) {
    // a singular system (PRV, PSV) or a result not converged with absurd flows (FCV) before; the PSV at 5 bar(a) did not
    // converge from the pressures it held controlling
    for (const [name, props, list] of cases) {
      const r = list.map(([P1]) => check(mode, props, P1));
      ok(`valve that cannot control (${mode}): ${name}, supplies of ${list.map((x) => x[0]).join(', ')} bar(a) give ${list.map((x) => x[1]).join(', ')}, each as the valve held in that state`,
        r.every((x, i) => x.good && x.st === list[i][1]), r.map((x) => x.text).join(', '));
    }
    // "always control": the network has no solution with the valve controlling; the message names it and its state
    const a = run(valveModel(mode, 2, Object.assign({}, prv, { alwaysControl: true })));
    ok(`valve that cannot control (${mode}): a PRV with "always control" and a supply of 2 bar(a) stops with a message naming it and its state`,
      !a.ok && a.errors.length === 1 && /J2 \(PRV\)/.test(a.errors[0]) && a.errors[0].includes(PumpIt.i18n.t('junctions.states.fullyOpen')), a.ok ? 'solved' : a.errors[0]);
    // over time ("always control" off, T-15): supplies of 1, 2, 5 and 3 bar(a), each step as its steady state
    for (const [name, props] of [['PRV', prv], ['PSV', psv], ['FCV', fcv]]) {
      const tm = valveModel(mode, 1, props);
      tm.junctions[0].time = { use: true, what: 'surfP', basis: 'absolute', start: 'time', when: [], interp: 'step', repeat: false, tables: [{ t: [0, 30, 60, 90], v: [1, 2, 5, 3], tUnit: 's', vUnit: 'bar(a)' }] };
      Object.assign(tm.solution.time, { on: true, start: q(0, 's'), stop: q(90, 's'), step: q(30, 's') });
      const tr = PumpIt.time.run(M.effective(tm, 'base'));
      const series = tr.ok ? [...tr.series.pipes[1].m] : [];
      const steady = [1, 2, 5, 3].map((P1) => run(valveModel(mode, P1, props))).map((s) => (s.ok && s.converged !== false ? s.pipes[1].m : NaN));
      ok(`valve that cannot control (${mode}): a ${name} over time, supplies of 1, 2, 5 and 3 bar(a), each step as its steady state`,
        series.length === 4 && series.every((x, i) => Math.abs(x - steady[i]) <= 1e-6 * Math.max(Math.abs(steady[i]), 1e-3)),
        tr.ok ? series.map((x) => x.toFixed(5)).join(', ') + ' / ' + steady.map((x) => x.toFixed(5)).join(', ') : tr.errors.join('; '));
    }
  }
}

console.log('\nReview of e6b8f15, item 21: the fixed volume flow of an adiabatic compressor, converted there and back');
if (PumpIt) {
  const M = PumpIt.model, q = M.q, U = PumpIt.units;
  // the compressed air plant cut to J1, the compressor J2 and a reservoir at 1 bar(g) at the end of P2, pipes of 1 m
  const build = (flow) => {
    const m = PumpIt.examples.get('airPlant').build();
    const j1 = m.junctions.find((j) => j.id === 1), j2 = m.junctions.find((j) => j.id === 2), old = m.junctions.find((j) => j.id === 3);
    const j3 = Object.assign(M.clone(j1), { id: 3, x: old.x, y: old.y, pipeK: {}, surfP: q(1, 'bar(g)') });
    j1.pipeK = {};
    m.junctions = [j1, j2, j3];
    m.pipes = m.pipes.filter((p) => p.id === 1 || p.id === 2);
    m.pipes.forEach((p) => { p.length = q(1, 'm'); });
    m.system.gasMode = 'adiabatic';
    Object.assign(j2, { mode: 'fixedFlow', fixedFlow: flow });
    return m;
  };
  const run = (m) => { const e = M.effective(m, 'base'); return { v: M.validate(e), s: PumpIt.solver.run(e) }; };
  // the conversion of the field, with the density its converter reads (the result of the junction)
  const conv = (v, from, to, jr) => U.fromSI(U.toSI(v, from, 'flow', { rho: jr.rho }), to, 'flow', { rho: jr.rho });
  const a = run(build(q(1.5, 'kg/s'))), ja = a.s.junctions[2], pa = a.s.pumps[2];
  const Q = conv(1.5, 'kg/s', 'm³/s', ja);
  const b = run(JSON.parse(JSON.stringify(build(q(Q, 'm³/s'))))), jb = b.s.junctions[2];
  const back = conv(Q, 'm³/s', 'kg/s', jb);
  const c = run(build(q(back, 'kg/s'))), jc = c.s.junctions[2];
  ok('e6b8f15-21 1.5 kg/s: the volume flow of the junction and of the compressor is the mass flow over the density of the suction at rest',
    a.v.ok && a.s.ok && near(ja.m, 1.5, 1e-9) && near(ja.Q * ja.rho, ja.m, 1e-12) && near(pa.Q, ja.Q, 1e-12), `${ja.m} ${ja.rho} ${ja.Q} ${pa.Q}`);
  ok('e6b8f15-21 … converted to m³/s (and saved and opened again) it is still 1.5 kg/s, and converted back 1.5 kg/s again',
    b.v.ok && b.s.ok && near(jb.m, 1.5, 1e-9) && near(back, 1.5, 1e-9) && c.s.ok && near(jc.m, 1.5, 1e-9), `${Q} m³/s → ${jb.m} kg/s → ${back}`);
}

console.log(fails ? `\n${fails} failed` : '\nAll tests passed.');
process.exit(fails ? 1 : 0);
