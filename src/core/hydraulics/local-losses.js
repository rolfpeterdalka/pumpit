// Local loss coefficients (K referred to the upstream area) — specification section 6.
(function (root) {
  const PumpIt = root.PumpIt;

  // orifice (Idelchik) between an upstream and a downstream pipe, sharp-edged or rounded (r = edge radius, Do = orifice
  // diameter): K = (Aup/Ao)²·(√ζ'·(1 − Ao/Aup)^0.375 + 1 − Ao/Adown)², where ζ' is the loss of the inlet edge: 0.5 for a
  // sharp edge (√ζ' = 0.707) and 0.03 + 0.47·10^(−7.7·r/Do) for a rounded one, which is the sharp edge again at r = 0.
  // One expression for any two areas, so K is continuous as the downstream area passes the upstream one. An orifice as
  // large as the upstream pipe is the sudden expansion of Borda-Carnot, (1 − Aup/Adown)²; one as large as the downstream
  // pipe is the contraction ζ'·(1 − Ao/Aup)^0.75 on the area of the hole (review of a952425: the rounded edge had two
  // expressions, neither of them the sharp one at r = 0, with a jump of 3.7 times between equal and nearly equal areas)
  function orificeK(Aup, Adown, Ao, kind, r, Do) {
    const ru = Ao / Aup, rd = Ao / Adown, s = (Aup / Ao) ** 2;
    const edge = kind === 'sharp' ? 0.707 : Math.sqrt(0.03 + 0.47 * 10 ** (-7.7 * (r / Do)));
    return s * (edge * (1 - ru) ** 0.375 + 1 - rd) ** 2;
  }

  PumpIt.hyd = Object.assign(PumpIt.hyd || {}, { orificeK });
})(typeof window !== 'undefined' ? window : globalThis);
