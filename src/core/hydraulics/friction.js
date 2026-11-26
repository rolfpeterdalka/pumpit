// Friction correlations (specification section 5).
(function (root) {
  const PumpIt = root.PumpIt;

  // Colebrook in its original form (constants 1.14 and 9.35); returns the Darcy f
  function colebrook(Re, eD) {
    let x = 1.14 - 2 * Math.log10(eD + 9.35 / (Re * Math.sqrt(0.02))); // x = 1/√f, starting from f = 0.02
    for (let i = 0; i < 60; i++) {
      const xn = 1.14 - 2 * Math.log10(eD + (9.35 * x) / Re);
      if (Math.abs(xn - x) < 1e-13 * xn) return 1 / (xn * xn);
      x = xn;
    }
    return 1 / (x * x);
  }

  // Darcy f: phi·64/Re below Re_lam, Colebrook above Re_turb, linear interpolation between f_lam(Re_lam) and f_turb(Re_turb).
  // phi: the laminar factor of the section (1 for a circle, annulusLaminar for an annulus, rectLaminar for a rectangle)
  function frictionFactor(Re, eD, reLam = 2300, reTurb = 4000, phi = 1) {
    if (Re < reLam) return phi * 64 / Re;
    if (Re > reTurb) return colebrook(Re, eD);
    const w = (Re - reLam) / (reTurb - reLam);
    return (1 - w) * (phi * 64 / reLam) + w * colebrook(reTurb, eD);
  }

  // The laminar factor of a concentric annulus of diameter ratio k = inner/outer: f·Re = 64·phi on its hydraulic diameter
  // (outer − inner), phi = (1 − k)² / (1 + k² + (1 − k²)/ln k). It is 1 for k = 0 (a circle) and rises to 1.5 as k → 1
  // (two parallel plates, f·Re = 96). Near k = 1 the denominator is the difference of two numbers close to 2, so there
  // its series is used below e = 1 − k = 0.05: the denominator is 2e²/3 + e⁴/90 + e⁵/90 + 37e⁶/3780 + 8e⁷/945 +
  // 119e⁸/16200 + O(e⁹) (from ln k = −Σ eⁿ/n), and the two agree to about 1e-11 there.
  function annulusLaminar(k) {
    if (!(k > 0)) return 1;
    if (!(k < 1)) return 1.5;
    const e = 1 - k;
    if (e < 0.05) return 1.5 / (1 + e * e * (1 / 60 + e * (1 / 60 + e * (37 / 2520 + e * (4 / 315 + e * 119 / 10800)))));
    return e * e / (1 + k * k + (1 - k * k) / Math.log(k));
  }

  // The laminar factor of a rectangular duct of side ratio a = short/long: f·Re = 64·phi on its hydraulic diameter
  // 2wh/(w + h), from the series of fully developed laminar flow between four fixed walls (Shah and London):
  // phi = 1.5 / ((1 + a)²·(1 − (192a/π⁵)·Σ tanh(nπ/(2a))/n⁵)), over the odd n. It is 0.8892 for a square (f·Re = 56.91)
  // and rises to 1.5 as a → 0 (two parallel plates, f·Re = 96); a and 1/a are the same duct. The sum is that of 1/n⁵,
  // (31/32)·ζ(5), less that of (1 − tanh)/n⁵ = 2/((e^(nπ/a) + 1)·n⁵), whose terms fall as e^(−nπ): a few of them
  const ODD5 = 31 / 32 * 1.0369277551433699; // Σ 1/n⁵ over the odd n = (1 − 2⁻⁵)·ζ(5)
  function rectLaminar(a) {
    if (a > 1) a = 1 / a;
    if (!(a > 0)) return 1.5;
    let tail = 0;
    for (let n = 1; n < 200; n += 2) {
      const term = 2 / ((Math.exp(n * Math.PI / a) + 1) * n ** 5);
      tail += term;
      if (term < 1e-17) break;
    }
    return 1.5 / ((1 + a) * (1 + a) * (1 - 192 * a / Math.PI ** 5 * (ODD5 - tail)));
  }

  // fully turbulent limit (Re → ∞) of the original Colebrook
  function fullyTurbulent(eD) {
    if (eD <= 0) return NaN;
    const x = 1.14 - 2 * Math.log10(eD);
    return 1 / (x * x);
  }

  // Crane f_T for any inside diameter: clean commercial steel (ε = 0.0018 in), fully turbulent
  const EPS_CRANE = 0.0018 * 0.0254;
  const craneFT = (Dm) => fullyTurbulent(EPS_CRANE / Dm);

  // Hazen-Williams: V = k·C·Rh^0.63·S^0.54 (SI) → S (m/m). Classic exponents; k = 0.848684 was calibrated
  // against recorded reference results (inferred; the classic 0.8492 gives a loss about 0.1% lower)
  const HW_K = 0.848684;
  function hazenWilliamsS(V, C, Dh) {
    const Rh = Dh / 4;
    return Math.pow(Math.abs(V) / (HW_K * C * Math.pow(Rh, 0.63)), 1 / 0.54);
  }

  PumpIt.hyd = Object.assign(PumpIt.hyd || {}, { colebrook, frictionFactor, annulusLaminar, rectLaminar, fullyTurbulent, craneFT, EPS_CRANE, hazenWilliamsS, HW_K });
})(typeof window !== 'undefined' ? window : globalThis);
