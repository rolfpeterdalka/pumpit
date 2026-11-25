// Checklist: the model only runs when the solution control, the fluid and every pipe and junction are
// defined (specification section 2). Junction-type specific checks live in each type's validate().
(function (root) {
  const PumpIt = root.PumpIt;
  const M = PumpIt.model;
  const types = PumpIt.junctionTypes;
  const { t } = PumpIt.i18n;

  // unknown units (corrupted file or a file from another version)
  const known = (u) => Object.values(PumpIt.units.CATS).some((c) => u in c);
  function badUnits(o, out = new Set()) {
    if (!o || typeof o !== 'object') return out;
    for (const [k, v] of Object.entries(o)) {
      if ((k === 'unit' || k === 'xUnit' || k === 'yUnit') && typeof v === 'string' && v !== '' && !known(v)) out.add(v);
      else if (v && typeof v === 'object') badUnits(v, out);
    }
    return out;
  }
  const unitMiss = (o) => { const b = badUnits(o); return b.size ? [t('core.checklist.unknownUnit', { units: [...b].join(', ') })] : []; };

  const pos = (x) => x && Number.isFinite(x.value) && x.value > 0;
  const fin = (x) => x && Number.isFinite(x.value);
  const curveOk = (c, min = 1) => c && c.x.length >= min && c.x.every(Number.isFinite) && c.y.every(Number.isFinite);

  function checkPipe(m, p) {
    const miss = unitMiss(p);
    const need = (k) => miss.push(t('core.checklist.pipe.' + k));
    if (!m.junctions.some((j) => j.id === p.up) || !m.junctions.some((j) => j.id === p.down)) need('connect');
    if (p.up !== null && p.up !== undefined && p.up === p.down) need('sameEnds');
    if (!pos(p.length)) need('length');
    const g = p.geometry;
    if (g.kind === 'circular' && !pos(g.d)) need('diameter');
    // an annulus: an outer diameter above zero, and an inner one from zero to less than it, compared in the same unit
    if (g.kind === 'annulus') {
      const len = (x) => { try { return fin(x) ? PumpIt.units.toSI(x.value, x.unit, 'length') : NaN; } catch (e) { return NaN; } };
      const a = len(g.dOuter), b = len(g.dInner);
      if (!(a > 0)) need('annulus');
      else if (!(b >= 0 && b < a)) need('annulusInner');
    }
    if (g.kind === 'rectangular' && !(pos(g.width) && pos(g.height))) need('rectangle');
    if (g.kind === 'noncircular' && !(pos(g.area) && pos(g.perim))) need('noncircular');
    // the friction model: one of the list (a missing or unknown one would calculate as a pipe without friction)
    const f = p.friction && typeof p.friction === 'object' ? p.friction : {};
    if (!M.frictionKnown(p.friction)) {
      if (f.model === undefined || f.model === null || f.model === '') need('frictionMissing');
      else miss.push(t('core.checklist.pipe.frictionUnknown', { model: String(f.model) }));
    }
    if (f.model === 'roughness' && !(fin(f.eps) && f.eps.value >= 0)) need('roughness');
    if (f.model === 'relRoughness' && !(f.rel >= 0)) need('relRoughness');
    if (f.model === 'explicitF' && !(f.f > 0)) need('frictionFactor');
    if (f.model === 'hw' && !(f.C > 0)) need('hwC');
    if (!(Number.isInteger(p.nParallel) && p.nParallel >= 1)) need('nParallel');
    if (!(p.idReduction >= 0 && p.idReduction < 100)) need('idReduction');
    // the fittings: a quantity of zero or more (none given counts one) and a coefficient of zero or more, each named
    const fi = M.fittingIssues(p);
    if (fi.some((x) => x.what === 'qty')) need('fittingQty');
    for (const x of fi) {
      if (x.what === 'value') {
        let name = '';
        try { name = PumpIt.data.fittingName(x.it) || ''; } catch (e) { /* a damaged item: its row is enough */ }
        const v = x.it.value;
        miss.push(t('core.checklist.pipe.fittingValue', { n: x.n, name: name ? ` (${name})` : '', coef: x.it.model === 'KfT' ? 'K/fT' : 'K', value: v === undefined || v === null || v === '' ? '—' : typeof v === 'string' ? `"${v}"` : String(v) }));
      } else if (x.what === 'sum') miss.push(t('core.checklist.pipe.fittingSum', { sum: +x.sum.toPrecision(6) }));
    }
    if (surgeOn(m)) for (const k of PumpIt.surge.inputs.checkPipe(m, p)) miss.push(t('surge.checklist.pipe.' + k));
    return miss;
  }

  // the water hammer (docs/water-hammer.md), a module of its own: with it on, the wave data of the pipes, the water hammer
  // data of the junctions and its control are checked too; with it off (or without its scripts) nothing of it is
  const surgeOn = (m) => !!(PumpIt.surge && PumpIt.surge.inputs && PumpIt.surge.inputs.isOn(m));
  // a key of the water hammer checklist: its own texts, and those of the conditions of the time simulation
  // the texts of the water hammer, and those of the time simulation it shares (the conditions of events, a finite tank)
  const surgeText = (k) => (k.startsWith('condition.') ? t('core.checklist.time.' + k) : k.startsWith('tank.') ? t('core.checklist.' + k) : t('surge.checklist.' + k));

  function checkJunction(m, j) {
    const miss = unitMiss(j);
    const def = types.get(j.type);
    const n = M.pipesAt(m, j.id).length;
    const [min, max] = def.pipes;
    if (n < min || n > max) {
      miss.push(min === max ? t('core.checklist.junction.pipesExact', { n: min, has: n }) : t('core.checklist.junction.pipesRange', { min, max, has: n }));
    }
    if (!fin(j.elevation)) miss.push(t('core.checklist.junction.elevation'));
    // temperature of the gas a source supplies (compressible mode, adiabatic model): empty, or above absolute zero
    if (fin(j.gasT) && !(PumpIt.units.toSI(j.gasT.value, j.gasT.unit, 'temperature') > 0)) miss.push(t('core.checklist.junction.gasT'));
    if (!def.multi && n === 2) {
      const pr = M.ports(m, j);
      if (def.directional && pr && !pr.consistent) miss.push(t('core.checklist.junction.direction'));
    }
    // the losses at the pipes of a single-node junction are losses: a negative one would give energy to a passive pipe.
    // Only those of the pipes connected to it, which the calculation reads and its table shows (a pipe whose end moved
    // to another junction may leave its entry behind)
    const connected = new Set(M.pipesAt(m, j.id).map((p) => String(p.id)));
    for (const [pid, pk] of Object.entries(j.pipeK || {})) {
      if (!pk || !connected.has(String(pid))) continue;
      if (Number.isFinite(pk.kOut) && pk.kOut < 0) miss.push(t('core.checklist.junction.pipeKOutNegative', { pipe: pid, value: pk.kOut }));
      if (Number.isFinite(pk.kIn) && pk.kIn < 0) miss.push(t('core.checklist.junction.pipeKInNegative', { pipe: pid, value: pk.kIn }));
    }
    if (def.validate) def.validate(j, miss, { fin, pos, curveOk, pipeCount: n, gas: M.isCompressible(m), gasP: gasPressure(m, miss) });
    if (timeOn(m)) checkTime(m, j, def, miss);
    if (surgeOn(m)) for (const k of PumpIt.surge.inputs.checkJunction(m, j)) miss.push(surgeText(k));
    return miss;
  }

  // the time simulation (docs/time-simulation.md): with it on, the time data of a junction and the geometry of a finite
  // tank (or, for a gas, the volume of a finite vessel) are checked too; with it off they are kept and not used
  const timeOn = (m) => !!(m.solution && m.solution.time && m.solution.time.on && PumpIt.time);
  function checkTime(m, j, def, miss) {
    const T = PumpIt.time;
    if (T.inputs.active(j)) for (const k of T.inputs.check(j, m)) miss.push(t('core.checklist.time.' + k));
    // a finite gas vessel in the compressible mode, a finite tank for a liquid (each regime keeps its own)
    if (def.time && def.time.tank && M.isCompressible(m)) {
      if (T.vessels.isFinite(j)) for (const k of T.vessels.check(j)) miss.push(t('core.checklist.vessel.' + k));
    } else if (def.time && def.time.tank && T.tanks.isFinite(j)) {
      let patm;
      try { patm = PumpIt.units.toSI(m.system.patm.value, m.system.patm.unit, 'pressure'); } catch (e) { /* the system checks it */ }
      for (const k of T.tanks.check(j, { patm })) miss.push(t('core.checklist.tank.' + k));
    }
  }

  // compressible mode (R-13): a pressure is gauge or absolute by its unit, and the gas is calculated in absolute pressure,
  // so a pressure the calculation takes must be above vacuum once a gauge value is added to the atmospheric pressure of
  // the system. gasP(x, key) checks one such field of a junction; key names the field in the catalogs. A liquid is not
  // checked, nor a field another item already reports (empty, a unit that is not a pressure, no valid atmospheric pressure).
  function gasPressure(m, miss) {
    const U = PumpIt.units, pa = m.system.patm;
    const patm = M.isCompressible(m) && fin(pa) && U.has('pressure', pa.unit) ? U.toSI(pa.value, pa.unit, 'pressure') : NaN;
    return (x, key) => {
      if (!(patm > 0) || !fin(x) || !U.has('pressure', x.unit)) return;
      if (!(U.toSI(x.value, x.unit, 'pressure', { patm }) > 0)) miss.push(t('core.checklist.junction.vacuum', { what: t(key) }));
    };
  }

  // the gas of the compressible mode (§8.5): temperature above absolute zero and Z > 0; a custom gas also MW > 0,
  // k > 1 and μ > 0. The design limits of the warnings too.
  function checkGas(sys) {
    const g = sys.fluidGas || {};
    const miss = [];
    const T = fin(g.T) ? PumpIt.units.toSI(g.T.value, g.T.unit, 'temperature') : NaN;
    if (!(T > 0)) miss.push(t('core.checklist.gas.temperature'));
    if (!(g.Z > 0)) miss.push(t('core.checklist.gas.Z'));
    if (!PumpIt.fluids.gasById(g.gas)) {
      if (!(g.MW > 0)) miss.push(t('core.checklist.gas.molarMass'));
      if (!(g.k > 1)) miss.push(t('core.checklist.gas.kRatio'));
      if (!pos(g.mu)) miss.push(t('core.checklist.gas.viscosity'));
    }
    if (!(sys.machLimit > 0)) miss.push(t('core.checklist.gas.machLimit'));
    if (!pos(sys.gasVelLimit)) miss.push(t('core.checklist.gas.velocityLimit'));
    return miss;
  }

  // the Reynolds numbers of the transition, in both regimes: finite, above zero and in order (the friction and the
  // laminar correction interpolate between them)
  const reynoldsOk = (sys) => Number.isFinite(sys.reLam) && Number.isFinite(sys.reTurb) && sys.reLam > 0 && sys.reLam < sys.reTurb;
  function checkFluid(sys) {
    const out = checkFluidOnly(sys);
    if (!unitMiss(sys).length && !reynoldsOk(sys)) out.push(t('core.checklist.fluid.reynolds'));
    return out;
  }
  // the fluid of the regime, and in both regimes the atmospheric pressure: a number in a unit of pressure, above zero
  // once absolute (R-13 for a gas; for a liquid it gives the absolute pressures of the NPSH and of the vapour pressure)
  function checkFluidOnly(sys) {
    const um = unitMiss(sys);
    if (um.length) return um;
    const miss = sys.regime === 'compressible' ? checkGas(sys) : checkLiquid(sys);
    if (!(M.patmOf(sys) > 0)) miss.push(t('core.checklist.fluid.patm'));
    return miss;
  }
  function checkLiquid(sys) {
    const f = sys.fluid;
    if (PumpIt.fluids.LIBRARY[f.kind]) return fin(f.T) ? [] : [t('core.checklist.fluid.temperature')]; // library fluid: by temperature
    const miss = [];
    if (!pos(f.rho)) miss.push(t('core.checklist.fluid.density'));
    if (!pos(f.mu)) miss.push(t('core.checklist.fluid.viscosity'));
    const pv = vaporIssue(sys);
    if (pv) miss.push(t('core.checklist.fluid.' + pv.key, pv));
    return miss;
  }
  // what is wrong with the vapour pressure of a user liquid, or null: { key: 'vapor' } (not a pressure) or
  // { key: 'vaporVacuum', and the parameters of its message } (below zero once absolute, a gauge value with the
  // atmospheric pressure of the system). Empty, it is not known and the cavitation warnings are not given. The system
  // window marks its field by it.
  function vaporIssue(sys) {
    const f = sys.fluid, pv = f && f.kind === 'user' ? f.pv : null;
    if (!pv || pv.value === null || pv.value === undefined || pv.value === '') return null;
    if (!Number.isFinite(pv.value) || !PumpIt.units.has('pressure', pv.unit)) return { key: 'vapor' };
    const patm = M.patmOf(sys);
    if (!(patm > 0) && PumpIt.units.isGauge(pv.unit)) return null; // the atmospheric pressure is what the checklist asks for
    const abs = PumpIt.units.toSI(pv.value, pv.unit, 'pressure', patm > 0 ? { patm } : {});
    return abs < 0 ? Object.assign({ key: 'vaporVacuum' }, M.vaporText(pv, abs)) : null;
  }

  function validate(eff) {
    const undef = new Map();
    eff.pipes.forEach((p) => { const mm = checkPipe(eff, p); if (mm.length) undef.set('p:' + p.id, mm); });
    eff.junctions.forEach((j) => { const mm = checkJunction(eff, j); if (mm.length) undef.set('j:' + j.id, mm); });
    const fluidMiss = checkFluid(eff.system);
    const s = eff.solution;
    const solOk = s.tolRel > 0 && s.maxIter >= 1 && s.relax > 0 && s.relax <= 1;
    const pipesBad = [...undef.keys()].filter((k) => k[0] === 'p').length;
    const jBad = [...undef.keys()].filter((k) => k[0] === 'j').length;
    // an id given to two pipes or two junctions (a file edited by hand): the item of its collection names it
    const dup = M.duplicateIds(eff);
    const dupOf = (what) => dup.filter((d) => d.what === what).map(M.duplicateText);
    const dupP = dupOf('pipe'), dupJ = dupOf('junction');
    const withDup = (detail, d, bad) => (!d.length ? detail : (bad ? [detail, ...d] : d).join(' '));
    // key: the object the item checks, where it has one (the solution control and the system); net: the item of the
    // pipes or of the junctions, empty when the network has none (the undefined objects are counted in undef)
    const items = [
      { key: 'sol', label: t('core.checklist.items.solution'), ok: solOk },
      { key: 'sys', label: t('core.checklist.items.system'), ok: fluidMiss.length === 0, detail: fluidMiss.join(', ') },
      { net: 'pipes', empty: !eff.pipes.length, label: t('core.checklist.items.pipes'), ok: eff.pipes.length > 0 && pipesBad === 0 && !dupP.length, detail: withDup(eff.pipes.length ? t('core.checklist.items.pipesIncomplete', { bad: pipesBad, n: eff.pipes.length }) : t('core.checklist.items.noPipes'), dupP, pipesBad) },
      { net: 'junctions', empty: !eff.junctions.length, label: t('core.checklist.items.junctions'), ok: eff.junctions.length > 0 && jBad === 0 && !dupJ.length, detail: withDup(eff.junctions.length ? t('core.checklist.items.junctionsIncomplete', { bad: jBad, n: eff.junctions.length }) : t('core.checklist.items.noJunctions'), dupJ, jBad) },
    ];
    // the time control, when the time simulation is on (§3 of its specification)
    if (timeOn(eff)) {
      const tm = PumpIt.time.checkControl(eff.solution.time, eff).map((k) => t('core.checklist.time.' + k));
      items.splice(1, 0, { key: 'time', label: t('core.checklist.items.time'), ok: tm.length === 0, detail: tm.join(', ') });
    }
    // the control of the water hammer, when it is on (§11.6 of its specification)
    if (surgeOn(eff)) {
      const sm = PumpIt.surge.inputs.checkControl(eff).map((k) => t('surge.checklist.' + k));
      items.splice(1, 0, { key: 'surge', label: t('surge.checklist.item'), ok: sm.length === 0, detail: sm.join(', ') });
    }
    return { ok: items.every((i) => i.ok), items, undef };
  }

  Object.assign(M, { validate, checkPipe, checkJunction, reynoldsOk, vaporIssue });
})(typeof window !== 'undefined' ? window : globalThis);
