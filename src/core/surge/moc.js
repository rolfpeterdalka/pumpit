// The method of characteristics of the water hammer (docs/water-hammer.md; §2 and §7 of its specification), in the
// unknowns of the steady solver: the stagnation pressure P and the mass flow ṁ, positive in the direction of the pipe.
//
// A pipe of n sections has n + 1 stations, 0 at its up end and n at its down end. Every station holds its pressure, the
// flow on its upstream side (mU) and on its downstream side (mD), and the volume V of a vapour cavity; the two flows
// differ only while the station has a cavity. Along the characteristics, with B = a'/A, R the loss coefficient of a
// section and z the elevation, linear between the ends of the pipe:
//
//   C+  (from station A = i − 1):  P_i = CP − BP·ṁ_i,  CP = P_A + B·ṁ_A − ρg(z_i − z_A),  BP = B + R·|ṁ_A|
//   C−  (from station B = i + 1):  P_i = CM + BM·ṁ_i,  CM = P_B − B·ṁ_B + ρg(z_B − z_i),  BM = B + R·|ṁ_B|
//
// with the friction linearized as in Wylie and Streeter (the new flow times the modulus of the old one). C+ takes the
// downstream-side flow of A and C− the upstream-side flow of B. A station with a cavity holds the pressure of the cavity
// and integrates its volume with the weight ψ (DVCM, §7.3); a cavity whose volume would not stay positive collapses and
// the station is solved as liquid in the same step. Phase G3 adds the unsteady friction of Brunone (a term at the foot
// of each characteristic) and the discrete gas cavities (DGCM: every station holds a small mass of free gas, whose
// volume V then holds), after the addendum of the specification.
//
// The ends of a pipe are ports of the junctions (src/core/surge/boundaries.js): a port gives the characteristic that
// leaves the pipe there, P = C − B·q with q the flow into the junction, and takes back the pressure and the two flows.
(function (root) {
  const PumpIt = root.PumpIt;

  // a pipe of the method: o = { id, n, L, a (adjusted), A (all parallel tubes), R (of the whole pipe), zUp, zDown, rho, g,
  // P0 (stagnation pressure at the up end), m0 (steady flow) }; its stations start at the steady state (§2.5)
  function makePipe(o) {
    const n = o.n, N1 = n + 1;
    const p = {
      id: o.id, n, L: o.L, a: o.a, A: o.A, rho: o.rho, g: o.g,
      B: o.a / o.A, R: o.R / n, Rpipe: o.R, zUp: o.zUp, zDown: o.zDown, dz: (o.zDown - o.zUp) / n,
      G: o.rho * o.g * (o.zDown - o.zUp) / n,
      P: new Float64Array(N1), mU: new Float64Array(N1), mD: new Float64Array(N1), V: new Float64Array(N1),
      Pn: new Float64Array(N1), mUn: new Float64Array(N1), mDn: new Float64Array(N1), Vn: new Float64Array(N1),
      cav: 0, // stations with a cavity after the last step
      up: null, down: null, // the ports at its two ends
    };
    const loss = p.R * o.m0 * Math.abs(o.m0);
    for (let i = 0; i <= n; i++) {
      p.P[i] = o.P0 - i * loss - o.rho * o.g * (p.dz * i);
      p.mU[i] = p.mD[i] = o.m0;
    }
    p.up = makePort(p, 'up');
    p.down = makePort(p, 'down');
    return p;
  }
  const zOf = (p, i) => p.zUp + p.dz * i;

  // a port: one end of a pipe at a junction. C, B: the characteristic of the step (set by ends()); hz = ρg(z_eff − z_end),
  // the elevation between the pressure of the junction and the end of the pipe (a reservoir); kIn, kOut: the loss of the
  // end of the pipe into and out of the junction (its pipeK), by the laminar correction of the steady state (kTerm)
  function makePort(p, end) {
    const down = end === 'down';
    return { pipe: p, end, down, i: down ? p.n : 0, C: 0, B: 0, hz: 0, kIn: 0, kOut: 0, kTerm: null, PP: null };
  }

  // the characteristics that leave a pipe at its two ends, from the state of the step before (with a friction that
  // varies, R of the station where each characteristic starts; with the friction of Brunone, its term at that station)
  function ends(p) {
    const n = p.n, P = p.P, mU = p.mU, mD = p.mD, B = p.B, G = p.G, Rs = p.Rs, dB = p.dPB;
    const mA = mD[n - 1];
    p.down.C = P[n - 1] + B * mA - G - (dB ? dB[n - 1] : 0);
    p.down.B = B + (Rs ? Rs[n - 1] : p.R) * Math.abs(mA);
    const mB = mU[1];
    p.up.C = P[1] - B * mB + G + (dB ? dB[1] : 0);
    p.up.B = B + (Rs ? Rs[1] : p.R) * Math.abs(mB);
  }

  // ---------- unsteady friction of Brunone (phase G3, decisions G3-08 and G3-09), in the form of Vítkovský: the loss per
  // unit length takes (ρ·k/2)·(∂V/∂t + a·sign(V)·|∂V/∂x|) on top of the quasi-steady one. The term is that of the station
  // at the foot of each characteristic, explicit, from the flows of the steps k−1 and k−2 (the characteristic form of the
  // addendum of phase G3):
  //   D⁺_j = ṁ⁻_j(k−1) − ṁ⁺_j−1(k−2),  D⁻_j = ṁ⁺_j(k−1) − ṁ⁻_j+1(k−2)   (at an end, the missing one is 2·(ṁ_j(k−1) − ṁ_j(k−2))
  //   minus the other, with the mean of the two flows of a station); U_j = max(D⁺, D⁻) for ṁ_j > 0, min for ṁ_j < 0, their
  //   mean for ṁ_j = 0; ΔP_j = (k·B/2)·U_j. C+ from A takes CP − ΔP_A, C− from B takes CM + ΔP_B.
  // The flows of step k−2 start as those of the steady state, which then holds (U = 0 with a uniform flow). A flow within
  // 10⁻¹² of the scale of the flows of the pipe counts as zero: the flow at a dead end carries the rounding of the pressure
  // there, and its sign would choose between D⁺ and D⁻
  function brunone(p, k) {
    p.kB = k;
    p.cB = k * p.B / 2;
    p.mZero = 1e-12 * Math.max(Math.abs(p.mU[0]), p.rho * p.A);
    p.mU2 = Float64Array.from(p.mU);
    p.mD2 = Float64Array.from(p.mD);
    p.dPB = new Float64Array(p.n + 1);
  }
  // the terms ΔP_j of the step, from the state of the step before (k−1) and the flows kept of the one before it (k−2)
  function brunoneTerms(p) {
    const n = p.n, mU = p.mU, mD = p.mD, mU2 = p.mU2, mD2 = p.mD2, d = p.dPB, c = p.cB, z = p.mZero;
    for (let j = 0; j <= n; j++) {
      const m1 = (mU[j] + mD[j]) / 2;
      let Dp = j > 0 ? mU[j] - mD2[j - 1] : NaN, Dm = j < n ? mD[j] - mU2[j + 1] : NaN;
      if (j === 0 || j === n) {
        const twice = 2 * (m1 - (mU2[j] + mD2[j]) / 2);
        if (j === 0) Dp = twice - Dm; else Dm = twice - Dp;
      }
      const U = m1 > z ? (Dp > Dm ? Dp : Dm) : m1 < -z ? (Dp < Dm ? Dp : Dm) : (Dp + Dm) / 2;
      d[j] = c * U;
    }
  }
  // after the swap of a step, the flows of the step before become those of step k−2 of the next one
  function brunoneShift(p) {
    p.mU2.set(p.mUn);
    p.mD2.set(p.mDn);
  }

  // ---------- discrete gas cavities (DGCM, phase G3, decision G3-10): every station holds a small mass of free gas at
  // constant temperature, Vg = Cg/(P − Pv), Cg = α₀·(p₀ − Pv)·A·Δx_e with Δx_e = Δx inside and Δx/2 at the ends (the
  // pressure on the basis of the cavities: the static basis adds the dynamic pressure of the step before to Pv). The
  // stations at the ports of the junctions that hold no gas (fixed pressures, two-port elements, protection devices) get
  // none (their boundaries say so after they are built)
  function gasInit(p, o) {
    const n = p.n, N1 = n + 1, dx = p.L / n;
    p.Cg = new Float64Array(N1);
    for (let i = 0; i <= n; i++) {
      p.Cg[i] = o.alpha0 * (o.p0 - o.Pv) * p.A * dx * (i === 0 || i === n ? 0.5 : 1);
      const Pc = o.staticBasis ? cavityP(p, i, { Pv: o.Pv, staticBasis: true }) : o.Pv;
      const u = p.P[i] - Pc;
      if (!(u > 0)) return { i };
      p.V[i] = p.Cg[i] / u;
    }
    p.cavEver = true; // the volumes of gas are recorded from the start
    return null;
  }
  // a station of gas without gas (a port of a junction that holds none)
  function gasNone(p, i) { if (p.Cg) { p.Cg[i] = 0; p.V[i] = 0; } }
  // the pressure of a station with gas from its characteristics, by the stable root of a·u² + E·u − Cg = 0 (u = P − Pc):
  // with S = 1/BP + 1/BM and Q₀ = CP/BP + CM/BM, a = Δt·ψ·S/ρ and E = Vg(k−1) + (Δt/ρ)·(1 − ψ)·(ṁ⁺ − ṁ⁻)(k−1) +
  // (Δt·ψ/ρ)·(Pc·S − Q₀). One characteristic with an imposed flow fits the same root (see gasRoot in boundaries.js)
  function gasU(a, E, Cg) {
    const d = Math.sqrt(E * E + 4 * a * Cg);
    return E > 0 ? 2 * Cg / (E + d) : (d - E) / (2 * a);
  }

  // ---------- friction that varies with the Reynolds number (§2.7, phase G2): each station keeps its own R, the friction
  // of its flow by the correlation of the steady state plus the fittings of the steady state, and takes it again when
  // its velocity changed by more than 1 % since the last time. o = { Rk (fittings, per section), Rf(m) (friction per
  // section at the flow m of the pipe), mFloor (a flow below which the friction is that of mFloor) }
  function variableFriction(p, o) {
    const N1 = p.n + 1;
    p.Rs = new Float64Array(N1).fill(p.R);
    p.mLast = new Float64Array(N1);
    for (let i = 0; i < N1; i++) p.mLast[i] = (p.mU[i] + p.mD[i]) / 2;
    p.Rk = o.Rk; p.Rf = o.Rf; p.mFloor = o.mFloor;
  }
  // after a step: the stations whose velocity changed by more than 1 % take their friction again. → stations updated
  function updateFriction(p) {
    const n = p.n, mU = p.mU, mD = p.mD, Rs = p.Rs, last = p.mLast, floor = p.mFloor;
    let k = 0;
    for (let i = 0; i <= n; i++) {
      const m = (mU[i] + mD[i]) / 2, m0 = last[i];
      if (Math.abs(m - m0) <= 0.01 * Math.max(Math.abs(m0), floor)) continue;
      const mm = Math.abs(m) < floor ? (m < 0 ? -floor : floor) : m;
      Rs[i] = p.Rf(mm) + p.Rk;
      last[i] = m;
      k++;
    }
    return k;
  }

  // the pressure of a cavity at station i (§7.2): the vapour pressure, or with the static basis the vapour pressure plus
  // the dynamic pressure of the mean of the two flows of the station in the step before (decision W-16)
  function cavityP(p, i, cv) {
    if (!cv.staticBasis) return cv.Pv;
    const m = (p.mU[i] + p.mD[i]) / 2;
    return cv.Pv + m * m / (2 * p.rho * p.A * p.A);
  }

  // the inner stations of a pipe in the new arrays (§2.4 and §7.3). cv = { on, Pv, psi, staticBasis, dt }. Returns the
  // number of stations with a cavity
  function interior(p, cv) {
    if (p.dPB || cv.gas) return interiorGeneral(p, cv);
    if (p.Rs) return interiorVariable(p, cv);
    const n = p.n, P = p.P, mU = p.mU, mD = p.mD, V = p.V, B = p.B, R = p.R, G = p.G;
    const Pn = p.Pn, mUn = p.mUn, mDn = p.mDn, Vn = p.Vn;
    let cavs = 0;
    if (!cv.on) {
      for (let i = 1; i < n; i++) {
        const mA = mD[i - 1], mB = mU[i + 1];
        const CP = P[i - 1] + B * mA - G, BP = B + R * (mA < 0 ? -mA : mA);
        const CM = P[i + 1] - B * mB + G, BM = B + R * (mB < 0 ? -mB : mB);
        const S = BP + BM, m = (CP - CM) / S;
        Pn[i] = (CP * BM + CM * BP) / S; mUn[i] = m; mDn[i] = m;
      }
      return 0;
    }
    const k = cv.dt / p.rho, psi = cv.psi, psi1 = 1 - psi, Pv = cv.Pv, sb = cv.staticBasis;
    for (let i = 1; i < n; i++) {
      const mA = mD[i - 1], mB = mU[i + 1];
      const CP = P[i - 1] + B * mA - G, BP = B + R * (mA < 0 ? -mA : mA);
      const CM = P[i + 1] - B * mB + G, BM = B + R * (mB < 0 ? -mB : mB);
      const S = BP + BM, m = (CP - CM) / S, pl = (CP * BM + CM * BP) / S;
      const Pc = sb ? cavityP(p, i, cv) : Pv;
      if (V[i] > 0 || pl < Pc) {
        const qU = (CP - Pc) / BP, qD = (Pc - CM) / BM;
        const vol = V[i] + k * (psi * (qD - qU) + psi1 * (mD[i] - mU[i]));
        if (vol > 0) { Pn[i] = Pc; mUn[i] = qU; mDn[i] = qD; Vn[i] = vol; cavs++; continue; }
      }
      Pn[i] = pl; mUn[i] = m; mDn[i] = m; Vn[i] = 0;
    }
    return cavs;
  }
  // the same with the R of each station (the friction that varies): C+ takes the R of A, C− that of B
  function interiorVariable(p, cv) {
    const n = p.n, P = p.P, mU = p.mU, mD = p.mD, V = p.V, B = p.B, Rs = p.Rs, G = p.G;
    const Pn = p.Pn, mUn = p.mUn, mDn = p.mDn, Vn = p.Vn;
    const on = cv.on, k = cv.dt / p.rho, psi = cv.psi, psi1 = 1 - psi, Pv = cv.Pv, sb = cv.staticBasis;
    let cavs = 0;
    for (let i = 1; i < n; i++) {
      const mA = mD[i - 1], mB = mU[i + 1];
      const CP = P[i - 1] + B * mA - G, BP = B + Rs[i - 1] * (mA < 0 ? -mA : mA);
      const CM = P[i + 1] - B * mB + G, BM = B + Rs[i + 1] * (mB < 0 ? -mB : mB);
      const S = BP + BM, m = (CP - CM) / S, pl = (CP * BM + CM * BP) / S;
      if (on) {
        const Pc = sb ? cavityP(p, i, cv) : Pv;
        if (V[i] > 0 || pl < Pc) {
          const qU = (CP - Pc) / BP, qD = (Pc - CM) / BM;
          const vol = V[i] + k * (psi * (qD - qU) + psi1 * (mD[i] - mU[i]));
          if (vol > 0) { Pn[i] = Pc; mUn[i] = qU; mDn[i] = qD; Vn[i] = vol; cavs++; continue; }
        }
      }
      Pn[i] = pl; mUn[i] = m; mDn[i] = m; Vn[i] = 0;
    }
    return cavs;
  }
  // the same with the unsteady friction of Brunone (its term at the foot of each characteristic) or the gas cavities
  // (phase G3): the R of each station or of the pipe, and the free gas of every station, the vapour cavities or none
  function interiorGeneral(p, cv) {
    const n = p.n, P = p.P, mU = p.mU, mD = p.mD, V = p.V, B = p.B, Rs = p.Rs, R = p.R, G = p.G, dB = p.dPB, Cg = p.Cg;
    const Pn = p.Pn, mUn = p.mUn, mDn = p.mDn, Vn = p.Vn;
    const on = cv.on, gas = !!(cv.gas && Cg), k = cv.dt / p.rho, psi = cv.psi, psi1 = 1 - psi, Pv = cv.Pv, sb = cv.staticBasis;
    let cavs = 0;
    for (let i = 1; i < n; i++) {
      const mA = mD[i - 1], mB = mU[i + 1];
      let CP = P[i - 1] + B * mA - G, CM = P[i + 1] - B * mB + G;
      if (dB) { CP -= dB[i - 1]; CM += dB[i + 1]; }
      const BP = B + (Rs ? Rs[i - 1] : R) * (mA < 0 ? -mA : mA);
      const BM = B + (Rs ? Rs[i + 1] : R) * (mB < 0 ? -mB : mB);
      if (gas) {
        const Pc = sb ? cavityP(p, i, cv) : Pv;
        const S = 1 / BP + 1 / BM, Q0 = CP / BP + CM / BM;
        const u = gasU(k * psi * S, V[i] + k * psi1 * (mD[i] - mU[i]) + k * psi * (Pc * S - Q0), Cg[i]);
        const Pi = Pc + u;
        Pn[i] = Pi; mUn[i] = (CP - Pi) / BP; mDn[i] = (Pi - CM) / BM; Vn[i] = Cg[i] / u;
        continue;
      }
      const S = BP + BM, m = (CP - CM) / S, pl = (CP * BM + CM * BP) / S;
      if (on) {
        const Pc = sb ? cavityP(p, i, cv) : Pv;
        if (V[i] > 0 || pl < Pc) {
          const qU = (CP - Pc) / BP, qD = (Pc - CM) / BM;
          const vol = V[i] + k * (psi * (qD - qU) + psi1 * (mD[i] - mU[i]));
          if (vol > 0) { Pn[i] = Pc; mUn[i] = qU; mDn[i] = qD; Vn[i] = vol; cavs++; continue; }
        }
      }
      Pn[i] = pl; mUn[i] = m; mDn[i] = m; Vn[i] = 0;
    }
    return cavs;
  }

  // ---------- the ports
  // the flow into the junction and the flow arriving from the pipe at a port, in the step before: [q junction side,
  // q pipe side]
  function portOld(pt) {
    const p = pt.pipe, i = pt.i;
    return pt.down ? [p.mD[i], p.mU[i]] : [-p.mU[i], -p.mD[i]];
  }
  // the new state of the station of a port: its pressure, the flow into the junction (qj), the flow arriving from the pipe
  // (qp, equal to qj without a cavity) and the volume of the cavity
  function portSet(pt, P, qj, qp, V) {
    const p = pt.pipe, i = pt.i;
    p.Pn[i] = P; p.Vn[i] = V;
    if (pt.down) { p.mUn[i] = qp; p.mDn[i] = qj; } else { p.mUn[i] = -qj; p.mDn[i] = -qp; }
  }
  // the loss at the end of a pipe (Pa) for a flow q into the junction, with the sign of q (the pipeK of the junction: kIn
  // into it, kOut out of it, by the steady relation with its laminar correction). Into a reservoir through a dry end (a
  // free jet, pt.dry), at least the kinetic energy of the jet, ρV|V|/2, as the steady state takes it (jetLoss in
  // src/core/solver/network.js)
  function portLoss(pt, q) {
    if (!hasLoss(pt)) return 0;
    const K = q >= 0 ? pt.kIn : pt.kOut, V = q / (pt.pipe.rho * pt.pipe.A);
    const loss = K ? pt.kTerm(K, pt.PP, V) : 0;
    if (!(pt.dry && q >= 0)) return loss;
    const dyn = pt.pipe.rho * V * Math.abs(V) / 2;
    return Math.abs(loss) < Math.abs(dyn) ? dyn : loss;
  }
  const hasLoss = (pt) => !!(pt.kTerm && (pt.kIn || pt.kOut || pt.dry));
  // the pressure of the cavity at the station of a port
  const portCavityP = (pt, cv) => cavityP(pt.pipe, pt.i, cv);

  // the new arrays become the state of the pipe
  function swap(p) {
    let x = p.P; p.P = p.Pn; p.Pn = x;
    x = p.mU; p.mU = p.mUn; p.mUn = x;
    x = p.mD; p.mD = p.mDn; p.mDn = x;
    x = p.V; p.V = p.Vn; p.Vn = x;
  }

  // the static pressure at a station: P − ṁ²/(2ρA²), with the mean of the two flows (§2.6)
  function staticAt(p, i, P, mU, mD) {
    const m = (mU[i] + mD[i]) / 2;
    return P[i] - m * m / (2 * p.rho * p.A * p.A);
  }

  PumpIt.surge = Object.assign(PumpIt.surge || {}, {
    moc: {
      makePipe, zOf, ends, interior, cavityP, portOld, portSet, portLoss, hasLoss, portCavityP, swap, staticAt, variableFriction, updateFriction,
      brunone, brunoneTerms, brunoneShift, gasInit, gasNone, gasU,
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
