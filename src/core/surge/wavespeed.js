// Wave speed of the water hammer (docs/water-hammer.md; §3 of its specification): the bulk modulus K of the liquid, the
// support coefficient c1 of the pipe wall and the wave speed a of each pipe, calculated from its wall or given.
//
//   pipe.surge = { wave: 'calculated' | 'given', a, support, c1, E, nu, wall, G, buriedPct, stations, pMax }
//
// E, nu and wall left empty (null) take the elastic material of the catalogue of the pipe (the `elastic` of its
// definition, src/core/data/pipe-library.js) and the wall of its size (PumpIt.data.pipeDims); an inner lining is left
// out (decision W-06). The calculation holds for a circular section only: any other section needs a given speed.
(function (root) {
  const PumpIt = root.PumpIt;
  const U = PumpIt.units;

  // elastic materials: modulus of elasticity (Pa) and Poisson's ratio, typical values of the public literature (Wylie,
  // Streeter and Suo 1993; Chaudhry 2014; Thorley 2004). plastic: E depends on the temperature and on how long the load
  // lasts (the short-term modulus at 20 °C)
  const MATERIALS = {
    carbonSteel: { E: 207e9, nu: 0.30 },
    stainless: { E: 193e9, nu: 0.30 },
    ductileIron: { E: 166e9, nu: 0.28 },
    hdpe: { E: 0.9e9, nu: 0.45, plastic: true },
    pvc: { E: 3.0e9, nu: 0.40, plastic: true },
    copper: { E: 117e9, nu: 0.34 },
    concrete: { E: 25e9, nu: 0.15 },
  };
  // how the pipe is held: thin or thick wall, anchored upstream only, along its length or with expansion joints; tunnels
  // without or with a steel lining; buried (a percentage over the anchored thin wall); a c1 of the user
  const SUPPORTS = ['thinAnchored', 'thinUp', 'thinJoints', 'thickAnchored', 'thickUp', 'thickJoints', 'tunnelUnlined', 'tunnelLined', 'buried', 'user'];
  const DEFAULT_SUPPORT = 'thinAnchored';
  const THIN_LIMIT = 25; // D/e above which the thin wall formulas hold (below it the thick wall ones are suggested)
  const WAVES = ['calculated', 'given'];

  // the water hammer data of a pipe, with the defaults of the fields left out
  const DEFAULTS = { wave: 'calculated', a: null, support: DEFAULT_SUPPORT, c1: null, E: null, nu: null, wall: null, G: null, buriedPct: null, stations: 'default', pMax: null, k: null };
  const dataOf = (p) => Object.assign({}, DEFAULTS, p && p.surge && typeof p.surge === 'object' && !Array.isArray(p.surge) ? p.surge : {});

  // c1 of a support: Halliwell (1963), as given by Wylie, Streeter and Suo (1993) and Chaudhry (2014)
  function c1Of(support, nu, D, e, c1user) {
    const thick = 2 * (e / D) * (1 + nu);
    switch (support) {
      case 'thinUp': return 1 - nu / 2;
      case 'thinAnchored': case 'buried': return 1 - nu * nu;
      case 'thinJoints': return 1;
      case 'thickUp': return thick + D * (1 - nu / 2) / (D + e);
      case 'thickAnchored': return thick + D * (1 - nu * nu) / (D + e);
      case 'thickJoints': return thick + D / (D + e);
      case 'user': return c1user;
      default: return NaN;
    }
  }

  // a = √((K/ρ) / (1 + c1·K·D/(E·e))); a tunnel by the rigidity G of the rock; buried, the anchored thin wall plus a
  // percentage. o = { support, K, rho, D, e, E, nu, c1 (user), G, buriedPct } in SI
  function speed(o) {
    const base = o.K / o.rho;
    if (o.support === 'tunnelUnlined') return Math.sqrt(base / (1 + o.K / o.G));
    if (o.support === 'tunnelLined') return Math.sqrt(base / (1 + o.K * o.D / (o.G * o.D + o.E * o.e)));
    const c1 = c1Of(o.support, o.nu, o.D, o.e, o.c1);
    const a = Math.sqrt(base / (1 + c1 * o.K * o.D / (o.E * o.e)));
    return o.support === 'buried' ? a * (1 + o.buriedPct / 100) : a;
  }
  const needsWall = (support) => support !== 'tunnelUnlined';
  const needsG = (support) => support === 'tunnelUnlined' || support === 'tunnelLined';

  // the bulk modulus of the liquid of a model (Pa): a library fluid by its correlation (water: Marczak 1997, decision
  // W-07), a fluid of the user by its field K; NaN when the fluid has none. ctx: { rho } of the fluid
  function fluidK(sys) {
    const fl = sys && sys.fluid;
    if (!fl) return NaN;
    const lib = PumpIt.fluids.LIBRARY[fl.kind];
    try {
      if (lib) return lib.K ? lib.K(U.toSI(fl.T.value, fl.T.unit, 'temperature') - 273.15) : NaN;
      return fl.K && Number.isFinite(fl.K.value) && U.has('modulus', fl.K.unit) ? U.toSI(fl.K.value, fl.K.unit, 'modulus') : NaN;
    } catch (e) { return NaN; }
  }
  // a library fluid whose correlation of K is used out of its range of temperature
  function fluidKRange(sys) {
    const fl = sys && sys.fluid, lib = fl && PumpIt.fluids.LIBRARY[fl.kind];
    if (!lib || !lib.K || !lib.rangeK) return null;
    let Tc = NaN;
    try { Tc = U.toSI(fl.T.value, fl.T.unit, 'temperature') - 273.15; } catch (e) { /* the system checks it */ }
    return Tc < lib.rangeK[0] || Tc > lib.rangeK[1] ? { T: Tc, min: lib.rangeK[0], max: lib.rangeK[1] } : null;
  }

  // the elastic material of the catalogue of a pipe ({ id, E, nu, plastic }), or null
  function catalogMaterial(p) {
    const c = p && p.material && PumpIt.data.pipeCatalog(p.material.kind);
    const id = c && c.elastic;
    return id && MATERIALS[id] ? Object.assign({ id }, MATERIALS[id]) : null;
  }
  // the wall of the catalogue of a pipe (m), or NaN
  function catalogWall(p) {
    const d = p && p.material && PumpIt.data.pipeDims(p.material);
    return d && d.wall > 0 ? d.wall / 1000 : NaN;
  }

  const fin = (x) => x && typeof x === 'object' && Number.isFinite(x.value);
  const siOr = (x, cat, fallback) => (fin(x) && U.has(cat, x.unit) ? U.toSI(x.value, x.unit, cat) : fallback);

  // what the calculation of the wave speed of a pipe takes, in SI, and what is missing (keys of surge.checklist.pipe):
  // { given, a (a given speed), support, D, e, E, nu, c1, G, buriedPct, plastic, thin (D/e above THIN_LIMIT), miss }
  function inputs(p, K) {
    const d = dataOf(p), miss = [];
    const out = { given: d.wave === 'given', support: SUPPORTS.includes(d.support) ? d.support : null, miss };
    if (!WAVES.includes(d.wave)) miss.push('wave');
    if (out.given) {
      out.a = siOr(d.a, 'velocity', NaN);
      if (!(out.a > 0)) miss.push('speed');
      return out;
    }
    if (!out.support) { miss.push('support'); return out; }
    const g = p.geometry || {};
    if (g.kind !== 'circular') { miss.push('circular'); return out; }
    out.D = siOr(g.d, 'length', NaN);
    const mat = catalogMaterial(p);
    out.E = siOr(d.E, 'modulus', mat ? mat.E : NaN);
    out.nu = Number.isFinite(d.nu) ? d.nu : mat ? mat.nu : NaN;
    out.e = siOr(d.wall, 'length', catalogWall(p));
    out.plastic = !!(mat && mat.plastic && !fin(d.E));
    out.c1 = d.c1;
    out.G = siOr(d.G, 'modulus', NaN);
    out.buriedPct = d.buriedPct;
    if (!(K > 0)) miss.push('fluidK');
    if (out.support !== 'tunnelUnlined') {
      if (!(out.E > 0)) miss.push('E');
      if (!(out.e > 0)) miss.push('wall');
    }
    if (!(out.support === 'tunnelUnlined' || out.support === 'tunnelLined') && !(out.nu >= 0 && out.nu < 0.5) && out.support !== 'user' && out.support !== 'thinJoints') miss.push('nu');
    if (out.support === 'user' && !(out.c1 > 0)) miss.push('c1');
    if (needsG(out.support) && !(out.G > 0)) miss.push('G');
    if (out.support === 'buried' && !(Number.isFinite(out.buriedPct) && out.buriedPct > -100)) miss.push('buriedPct');
    if (!(out.D > 0)) miss.push('diameter');
    out.thin = out.D > 0 && out.e > 0 ? out.D / out.e > THIN_LIMIT : true;
    return out;
  }

  // the wave speed of a pipe (m/s) from its inputs, with the liquid of density rho and bulk modulus K; NaN when incomplete
  function pipeSpeed(p, K, rho) {
    const x = inputs(p, K);
    if (x.miss.length) return { a: NaN, x };
    if (x.given) return { a: x.a, x };
    const c1 = x.support === 'tunnelUnlined' || x.support === 'tunnelLined' ? NaN : c1Of(x.support, x.nu, x.D, x.e, x.c1);
    return { a: speed(Object.assign({ K, rho }, x)), c1, x };
  }

  PumpIt.surge = Object.assign(PumpIt.surge || {}, {
    wavespeed: { MATERIALS, SUPPORTS, DEFAULT_SUPPORT, THIN_LIMIT, WAVES, DEFAULTS, dataOf, c1Of, speed, needsWall, needsG, fluidK, fluidKRange, catalogMaterial, catalogWall, inputs, pipeSpeed },
  });
})(typeof window !== 'undefined' ? window : globalThis);
