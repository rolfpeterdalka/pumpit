// Finite gas vessels of the time simulation in the compressible mode (docs/time-simulation.md, §11 and item 1, 2 and 4
// of Annex D.10 of its specification): a reservoir whose gas the simulation follows by its mass and its internal energy
// (an ideal gas with the Z of the system). At every step the vessel is the gas reservoir of today: a node at the
// stagnation pressure and the temperature of its gas. The gas that leaves takes the temperature of the vessel, and the gas
// that comes in brings the stagnation temperature of its pipe.
//
//   j.vessel = { model: 'infinite' | 'finite', volume, thermal: 'system' | 'adiabatic' | 'isothermal' | 'heatVolume',
//                known, time }
//
// thermal: the thermal model of the vessel; 'system' follows the model of the system (gasMode). An adiabatic vessel
// exchanges no heat; an isothermal one keeps its temperature; with 'heatVolume' a table by the clock (time, the time
// data of §4.1 with two columns) gives the heat it takes (W, positive into the gas) and its volume (m³), whose change
// does work on the gas. known: false finds the pressure and the temperature at the start from the first step, where the
// vessel is a free node without a flow of its own.
(function (root) {
  const PumpIt = root.PumpIt;
  const M = PumpIt.model, U = PumpIt.units;
  const q = M.q;

  const MODELS = ['infinite', 'finite'];
  const THERMAL = ['system', 'adiabatic', 'isothermal', 'heatVolume'];
  const isFinite = (j) => !!(j && j.vessel && typeof j.vessel === 'object' && j.vessel.model === 'finite');
  // the table of the heat and the volume of a vessel, by the clock, from a volume V (m³)
  const newHeatTable = (V = 1) => ({ use: true, what: 'heatVolume', basis: 'absolute', start: 'time', when: [], tables: [{ t: [0], v: [0], tUnit: 's', vUnit: 'kW', v2: [V], v2Unit: 'm³' }], repeat: false, interp: 'linear' });
  const newVessel = () => ({ model: 'finite', volume: q(1, 'm³'), thermal: 'system', known: true, time: newHeatTable() });
  // the quantity of the table of heat and volume: a heat rate, and a volume above zero
  const HEAT = { cat: 'power', second: { cat: 'volume', min: 0 } };

  // the thermal model of a vessel, the model of the system resolved
  const thermalOf = (v, adiabatic) => (v.thermal === 'adiabatic' || v.thermal === 'isothermal' || v.thermal === 'heatVolume' ? v.thermal : adiabatic ? 'adiabatic' : 'isothermal');

  // what is missing in a finite vessel, as keys under core.checklist.vessel
  function check(j) {
    const v = j.vessel, out = [];
    if (!MODELS.includes(v.model)) { out.push('model'); return out; }
    if (!(v.volume && Number.isFinite(v.volume.value) && v.volume.value > 0 && U.has('volume', v.volume.unit))) out.push('volume');
    if (v.thermal !== undefined && !THERMAL.includes(v.thermal)) out.push('thermal');
    if (v.known !== undefined && typeof v.known !== 'boolean') out.push('known');
    if (v.thermal === 'heatVolume') for (const k of checkHeat(v.time)) out.push(k);
    return out;
  }
  // the table of heat and volume: a time each row from 0 on, never decreasing, a heat rate and a volume above zero in
  // their units; repeated, a period above zero and its first values at its end (rule 4 of D.3)
  function checkHeat(d) {
    const tb = d && Array.isArray(d.tables) ? d.tables[0] : null;
    const ok = tb && Array.isArray(tb.t) && tb.t.length >= 1 && Array.isArray(tb.v) && Array.isArray(tb.v2) && tb.v.length === tb.t.length && tb.v2.length === tb.t.length
      && tb.t.every(Number.isFinite) && tb.v.every(Number.isFinite) && tb.v2.every(Number.isFinite)
      && U.has('time', tb.tUnit) && U.has('power', tb.vUnit) && U.has('volume', tb.v2Unit);
    if (!ok) return ['heatTable'];
    const out = [];
    if (!(tb.t[0] >= 0) || !tb.t.every((x, k) => k === 0 || x >= tb.t[k - 1])) out.push('heatOrder');
    if (!tb.v2.every((x) => x > 0)) out.push('heatVolume');
    if (!['linear', 'step'].includes(d.interp)) out.push('heatTable');
    const n = tb.t.length;
    if (d.repeat && n > 1) {
      if (!(tb.t[n - 1] > tb.t[0])) out.push('heatPeriod');
      else if (tb.v[0] !== tb.v[n - 1] || tb.v2[0] !== tb.v2[n - 1]) out.push('heatRepeat');
    }
    return out;
  }

  // a finite vessel in SI: its thermal model, its volume, the table of its heat and volume, the pipes that reach it (the
  // end of each one at the vessel) and its gas at the start (the pressure of the reservoir, absolute, and the
  // temperature of the gas it supplies in the adiabatic model of the system, or the one of the system otherwise; with
  // known false, the first step finds them). gp = { R, Z, cv, adiabatic, T } of the gas of the model; o: how the table
  // ends; t0: the start of the simulation
  function prepare(j, eff, si, gp, { ctx, dataEnd, t0 }) {
    const v = j.vessel;
    const thermal = thermalOf(v, gp.adiabatic);
    const Vfield = si(v.volume, 'volume');
    const Vs = { jid: j.id, thermal, Vfield, heat: null, o: null, free: v.known === false, zref: si(j.liquidElev, 'length') };
    if (thermal === 'heatVolume') {
      Vs.heat = PumpIt.time.tables.prepare(v.time.tables[0], HEAT, { basis: 'absolute', ctx });
      Vs.o = { repeat: !!v.time.repeat, interp: v.time.interp, dataEnd };
    }
    // the volume at the start: the one of the table, for a vessel whose volume follows one
    Vs.V0 = heatAt(Vs, t0).V;
    Vs.T0 = gp.adiabatic && j.gasT && Number.isFinite(j.gasT.value) ? si(j.gasT, 'temperature') : gp.T;
    Vs.P0 = si(j.surfP, 'pressure');
    start(Vs, gp, Vs.P0, Vs.T0);
    Vs.conns = M.pipesAt(eff, j.id).map((p) => ({ pid: p.id, up: p.up === j.id }));
    return Vs;
  }
  // the mass and the energy of a vessel at the pressure P and the temperature T of its start
  function start(Vs, gp, P, T) {
    Vs.P0 = P; Vs.T0 = T;
    Vs.M0 = (P * Vs.V0) / (gp.Z * gp.R * T);
    Vs.U0 = Vs.M0 * gp.cv * T;
  }

  // the heat (W) and the volume (m³) of a vessel at the time t: those of its table by the clock, or no heat and the volume
  // of the vessel
  function heatAt(Vs, t) {
    if (!Vs.heat) return { Q: 0, V: Vs.Vfield, past: '' };
    const r = PumpIt.time.tables.valueAt(Vs.heat, t, Vs.o);
    return { Q: r.v, V: r.v2, past: r.past };
  }

  // the mass flows of a vessel in a solution (kg/s): what comes in (and its enthalpy as Σ ṁ·T0, with the stagnation
  // temperature of each pipe at the vessel), what goes out, and the net flow in
  function flows(Vs, sol) {
    let min = 0, mout = 0, hin = 0;
    for (const c of Vs.conns) {
      const r = sol.pipes[c.pid];
      if (!r || !Number.isFinite(r.m)) continue;
      const into = c.up ? -r.m : r.m;
      if (into > 0) { min += into; hin += into * (c.up ? r.T0in : r.T0out); } else mout -= into;
    }
    return { min, mout, hin, mnet: min - mout };
  }

  // the gas after an interval dt with the flows f, from its state s = { M, U, T, P, V } (§11, item 1 of D.10): the mass
  // by its balance; the energy by its balance, with the heat Qh and the work of the boundary as the volume goes from s.V
  // to Vn; the temperature from the energy, or kept by an isothermal vessel; the pressure from the law of the gas. at =
  // { T, P }: the temperature of the gas that leaves and the pressure of the work, those of the start of the interval
  // (forward) or of its end (implicit). Null when the vessel would empty, or lose all its energy, in the interval
  function after(Vs, gp, s, f, dt, Qh = 0, Vn = s.V, at = s) {
    const Mn = s.M + dt * f.mnet;
    if (!(Mn > 0)) return null;
    let Un, Tn;
    if (Vs.thermal === 'isothermal') { Tn = s.T; Un = Mn * gp.cv * Tn; }
    else {
      Un = s.U + dt * gp.cp * (f.hin - f.mout * at.T);
      if (Qh) Un += dt * Qh;
      if (Vn !== s.V) Un -= at.P * (Vn - s.V);
      Tn = Un / (Mn * gp.cv);
      if (!(Tn > 0)) return null;
    }
    return { M: Mn, U: Un, T: Tn, P: (Mn * gp.Z * gp.R * Tn) / Vn, V: Vn };
  }

  PumpIt.time = Object.assign(PumpIt.time || {}, { vessels: { MODELS, THERMAL, isFinite, newVessel, newHeatTable, thermalOf, check, checkHeat, prepare, start, heatAt, flows, after } });
})(typeof window !== 'undefined' ? window : globalThis);
