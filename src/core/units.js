// Units: the core works in SI; conversion happens only on input and output.
// Every input quantity is stored as { value, unit }, exactly as typed.
(function (root) {
  const PumpIt = (root.PumpIt = root.PumpIt || {});
  const { t } = PumpIt.i18n;

  const G0 = 9.80665;          // m/s², standard gravity
  const PATM = 101325;         // Pa, 1 atm
  const PSI = 6894.757293168;  // Pa
  const LBM = 0.45359237;      // kg
  const FT = 0.3048;           // m
  const GAL = 3.785411784e-3;  // m³ (US gallon)
  const LBF = 4.4482216152605; // N

  // f = factor to SI; g = 1 marks a gauge pressure (the ambient pressure is added)
  const CATS = {
    length: { m: 1, mm: 1e-3, cm: 1e-2, km: 1e3, in: 0.0254, ft: FT, mi: 1609.344 },
    area: { 'm²': 1, 'cm²': 1e-4, 'mm²': 1e-6, 'in²': 6.4516e-4, 'ft²': FT * FT },
    pressure: {
      'kPa(a)': 1e3, 'kPa(g)': { f: 1e3, g: 1 },
      'bar(a)': 1e5, 'bar(g)': { f: 1e5, g: 1 },
      'MPa(a)': 1e6, 'MPa(g)': { f: 1e6, g: 1 },
      'Pa(a)': 1, 'Pa(g)': { f: 1, g: 1 },
      psia: PSI, psig: { f: PSI, g: 1 },
      atm: PATM,
      'kgf/cm²(a)': 98066.5, 'kgf/cm²(g)': { f: 98066.5, g: 1 },
      'mca(g)': { f: 9806.65, g: 1 },
      'mmHg(a)': 133.322387415,
    },
    dp: { Pa: 1, kPa: 1e3, MPa: 1e6, bar: 1e5, psi: PSI, 'kgf/cm²': 98066.5, mca: 9806.65, mmHg: 133.322387415 },
    head: { m: 1, ft: FT },
    massFlow: { 'kg/s': 1, 'kg/h': 1 / 3600, 't/h': 1000 / 3600, 'lbm/s': LBM, 'lbm/h': LBM / 3600 },
    volFlow: {
      'm³/s': 1, 'm³/h': 1 / 3600, 'L/s': 1e-3, 'L/min': 1e-3 / 60,
      gpm: GAL / 60, 'ft³/s': FT ** 3, 'bbl/d': 0.158987294928 / 86400,
    },
    // volume flow of a gas at the normal conditions (0 °C, 101.325 kPa; compressible mode §8.4): SI is Nm³/s, and a
    // mass flow needs the normal density (ctx.rhoN)
    normFlow: { 'Nm³/s': 1, 'Nm³/min': 1 / 60, 'Nm³/h': 1 / 3600, 'Nm³/d': 1 / 86400 },
    velocity: { 'm/s': 1, 'ft/s': FT },
    volume: { 'm³': 1, L: 1e-3, 'ft³': FT ** 3, gal: GAL },
    // what a pipe loses per length: head per length (the slope of the grade lines) and pressure per length
    headGradient: { 'm/m': 1, 'm/100 m': 0.01, 'm/km': 1e-3, 'ft/100 ft': 0.01 },
    dpGradient: {
      'Pa/m': 1, 'kPa/m': 1e3, 'kPa/100 m': 10, 'bar/km': 100, 'bar/100 m': 1e3,
      'kgf/cm²/km': 98.0665, 'kgf/cm²/100 m': 980.665, 'psi/100 ft': PSI / (100 * FT),
    },
    density: { 'kg/m³': 1, 'g/cm³': 1000, 'lbm/ft³': LBM / FT ** 3 },
    viscosity: { 'Pa·s': 1, cP: 1e-3, 'mPa·s': 1e-3, 'lbm/(ft·s)': LBM / FT },
    power: { W: 1, kW: 1e3, MW: 1e6, hp: 745.699872, cv: 735.49875 },
    energy: { J: 1, kJ: 1e3, MJ: 1e6, Wh: 3600, kWh: 3.6e6, MWh: 3.6e9 },
    mass: { kg: 1, t: 1000, lbm: LBM },
    kfactor: { 'gpm/psi½': GAL / 60 / Math.sqrt(PSI), 'L/min/bar½': 1e-3 / 60 / Math.sqrt(1e5), 'm³/h/bar½': 1 / 3600 / Math.sqrt(1e5) },
    temperature: { '°C': 0, K: 0, '°F': 0, '°R': 0 }, // handled separately (offsets)
    // time (the clock of the time simulation, its step and the axis of its tables; milliseconds for the water hammer) and
    // a percentage (the speed of a pump)
    time: { ms: 1e-3, s: 1, min: 60, h: 3600, d: 86400 },
    percent: { '%': 1 },
    // the water hammer (docs/water-hammer.md): the bulk modulus of a liquid and the modulus of elasticity of a pipe wall,
    // the moment of inertia of a pump, its rotational speed and its torque
    modulus: { Pa: 1, kPa: 1e3, MPa: 1e6, GPa: 1e9, bar: 1e5, psi: PSI, ksi: 1e3 * PSI },
    inertia: { 'kg·m²': 1, 'lb·ft²': LBM * FT * FT },
    rotation: { rpm: 2 * Math.PI / 60, 'rad/s': 1 },
    torque: { 'N·m': 1, 'lbf·ft': LBF * FT },
    // phase G3 of the water hammer: the unbalanced forces on the pipes; the dynamic check valves (the deceleration of the
    // liquid, the angle of a swinging disc, the springs and the dampers of a disc)
    force: { kN: 1e3, N: 1, lbf: LBF },
    accel: { 'm/s²': 1, 'ft/s²': FT },
    angle: { '°': Math.PI / 180, rad: 1 },
    rotStiffness: { 'N·m/rad': 1, 'N·m/°': 180 / Math.PI },
    stiffness: { 'N/m': 1, 'N/mm': 1e3, 'lbf/in': LBF / 0.0254 },
    rotDamping: { 'N·m·s/rad': 1 },
    damping: { 'N·s/m': 1 },
    none: { '': 1 },
  };
  // flow: mass, volumetric (needs the density) or normal volumetric (needs the normal density; a liquid takes its density)
  CATS.flow = Object.assign({}, CATS.massFlow, CATS.volFlow, CATS.normFlow);

  function spec(cat, unit) {
    const c = CATS[cat];
    if (!c) throw new Error(t('core.units.unknownCategory', { cat }));
    const s = c[unit];
    if (s === undefined) throw new Error(t('core.units.notInCategory', { unit, cat }));
    return typeof s === 'number' ? { f: s, g: 0 } : s;
  }

  function tempToK(v, unit) {
    switch (unit) {
      case '°C': return v + 273.15;
      case 'K': return v;
      case '°F': return (v - 32) * 5 / 9 + 273.15;
      case '°R': return v * 5 / 9;
    }
    throw new Error(t('core.units.unknownTemperature', { unit }));
  }
  function tempFromK(k, unit) {
    switch (unit) {
      case '°C': return k - 273.15;
      case 'K': return k;
      case '°F': return (k - 273.15) * 9 / 5 + 32;
      case '°R': return k * 9 / 5;
    }
    throw new Error(t('core.units.unknownTemperature', { unit }));
  }

  // ctx: { rho (kg/m³), patm (Pa), rhoN (kg/m³, normal density of a gas) }
  const normalRho = (ctx) => (ctx.rhoN > 0 ? ctx.rhoN : ctx.rho);
  function toSI(v, unit, cat, ctx = {}) {
    if (cat === 'temperature') return tempToK(v, unit);
    if (cat === 'flow' && unit in CATS.volFlow) {
      if (!(ctx.rho > 0)) throw new Error(t('core.units.needsDensity'));
      return v * CATS.volFlow[unit] * ctx.rho;
    }
    if (cat === 'flow' && unit in CATS.normFlow) {
      if (!(normalRho(ctx) > 0)) throw new Error(t('core.units.needsDensity'));
      return v * CATS.normFlow[unit] * normalRho(ctx);
    }
    const s = spec(cat, unit);
    return v * s.f + (s.g ? (ctx.patm ?? PATM) : 0);
  }
  function fromSI(v, unit, cat, ctx = {}) {
    if (cat === 'temperature') return tempFromK(v, unit);
    if (cat === 'flow' && unit in CATS.volFlow) {
      if (!(ctx.rho > 0)) throw new Error(t('core.units.needsDensity'));
      return v / ctx.rho / CATS.volFlow[unit];
    }
    if (cat === 'flow' && unit in CATS.normFlow) {
      if (!(normalRho(ctx) > 0)) throw new Error(t('core.units.needsDensity'));
      return v / normalRho(ctx) / CATS.normFlow[unit];
    }
    const s = spec(cat, unit);
    return (v - (s.g ? (ctx.patm ?? PATM) : 0)) / s.f;
  }

  const list = (cat) => Object.keys(CATS[cat] || {});
  const has = (cat, unit) => !!CATS[cat] && unit in CATS[cat];
  const isVolumetric = (unit) => unit in CATS.volFlow;
  const isNormal = (unit) => unit in CATS.normFlow;
  // text shown for a unit: the symbol itself, unless the language catalog gives another one (core.units.label)
  const label = (unit) => PumpIt.i18n.lookup('core.units.label.' + unit) ?? unit;

  // Conversion of a typed value to another unit of its category (the "Convert value" command of the inspector).
  // A flow converts directly within its family (mass, volume, normal volume) and needs a density only between
  // families; a pressure needs the ambient pressure only between a gauge and an absolute unit.
  const flowFamily = (unit) => (unit in CATS.massFlow ? 'massFlow' : unit in CATS.normFlow ? 'normFlow' : 'volFlow');
  const isGauge = (unit) => !!(CATS.pressure[unit] && CATS.pressure[unit].g);
  // what the conversion lacks in ctx: null when it can be done, 'patm', 'rho' (volume to mass or normal volume) or
  // 'rhoN' (normal volume to mass or volume)
  function convertNeeds(from, to, cat, ctx = {}) {
    if (cat === 'pressure') return isGauge(from) !== isGauge(to) && !(ctx.patm > 0) ? 'patm' : null;
    if (cat !== 'flow') return null;
    const a = flowFamily(from), b = flowFamily(to);
    if (a === b) return null;
    if ((a === 'volFlow' || b === 'volFlow') && !(ctx.rho > 0)) return 'rho';
    if ((a === 'normFlow' || b === 'normFlow') && !(normalRho(ctx) > 0)) return 'rhoN';
    return null;
  }
  function convert(v, from, to, cat, ctx = {}) {
    if (cat === 'flow' && flowFamily(from) === flowFamily(to)) return fromSI(toSI(v, from, flowFamily(from)), to, flowFamily(to));
    return fromSI(toSI(v, from, cat, ctx), to, cat, ctx);
  }

  PumpIt.units = {
    CATS, G0, PATM, PSI, toSI, fromSI, list, has, isVolumetric, isNormal, isGauge, flowFamily, convertNeeds, convert, label,
    q: (value, unit) => ({ value, unit }),
  };
})(typeof window !== 'undefined' ? window : globalThis);
