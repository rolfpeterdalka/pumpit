// Results on the drawing: values per pipe, colour scales and the legend.
// Velocity uses a fixed water scale (PumpIt.data.WATER_VELOCITY, in m/s) for a liquid; every other quantity, and the
// velocity of a gas, is coloured from the smallest to the largest value in the model. Mass flow and Mach number are
// offered for a gas, the hydraulic grade line for a liquid (OVERLAY_FOR). A module adds quantities of its own with
// addOverlay (the water hammer: src/ui/surge/overlay.js), each with its option in the selector.
(function (root) {
  const PumpIt = root.PumpIt;
  const F = PumpIt.ui.format;
  const { t } = PumpIt.i18n;

  const RAMP = ['#2f6db5', '#2a9d8f', '#d9a53a', '#cf4a3c'];

  // quantities offered for results on the drawing; legend titles in network.legend.<key>
  const OVERLAY = {
    Q: { cat: 'volFlow' },
    m: { cat: 'massFlow', gas: true },
    V: { cat: 'velocity' },
    M: { cat: null, gas: true },
    dP0: { cat: 'dp' },
    P: { cat: 'pressure' },
    HGL: { cat: 'head', liquid: true },
  };
  // the quantities of the modules: key → { cat, label (the key of the text of its option), offered(gas), values(res) →
  // { vals: Map of pipe id → value in SI, min, max } or null (min and max left out: the range of the values), junction(id)
  // → the value written beside a junction or null, title() → the title of the legend }
  const EXTRA = new Map();
  function addOverlay(key, o) {
    EXTRA.set(key, o);
    OVERLAY[key] = { cat: o.cat, extra: true };
    const sel = typeof document !== 'undefined' ? document.getElementById('overlay-select') : null;
    if (!sel || sel.querySelector(`option[value="${key}"]`)) return;
    // its text follows the language with the other texts of the page (data-i18n)
    const op = document.createElement('option');
    op.value = key;
    op.dataset.i18n = o.label;
    op.textContent = t(o.label);
    sel.appendChild(op);
  }

  // whether a quantity is offered for a regime (a gas has no head, a liquid no Mach number)
  const offered = (key, gas) => key === 'none' || (EXTRA.has(key) ? !!EXTRA.get(key).offered(gas) : !!OVERLAY[key] && !(gas ? OVERLAY[key].liquid : OVERLAY[key].gas));
  const isGas = (res) => !!(res && res.regime === 'compressible');

  function rampColor(t) {
    t = Math.max(0, Math.min(1, t));
    const k = t * (RAMP.length - 1), i = Math.min(RAMP.length - 2, Math.floor(k)), w = k - i;
    const a = hex(RAMP[i]), b = hex(RAMP[i + 1]);
    return `rgb(${a.map((v, n) => Math.round(v + w * (b[n] - v))).join(',')})`;
  }
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

  // fixed water velocity scale (bands in PumpIt.data.WATER_VELOCITY, in m/s)
  const VEL = PumpIt.data.WATER_VELOCITY;
  function velColor(v) {
    v = Math.abs(v);
    if (v > VEL.max) return VEL.over;
    const st = VEL.stops;
    let i = 1;
    while (i < st.length - 1 && v > st[i][0]) i++;
    const [v0, c0] = st[i - 1], [v1, c1] = st[i];
    const w = v1 > v0 ? Math.max(0, Math.min(1, (v - v0) / (v1 - v0))) : 0;
    const a = hex(c0), b = hex(c1);
    return `rgb(${a.map((x, n) => Math.round(x + w * (b[n] - x))).join(',')})`;
  }
  function velLegend() {
    const pct = (v) => (v / VEL.max) * 100;
    const grad = VEL.stops.map(([v, c]) => `${c} ${pct(v).toFixed(1)}%`).join(',');
    const ticks = [0, 0.9, 1.5, 2, 3, 5].map((v) => `<span style="left:${pct(v)}%">${v.toLocaleString(F.locale(), { maximumFractionDigits: 1 })}</span>`).join('');
    return `<div class="eyebrow">${t('network.legend.velocityTitle')}</div>
      <div class="vel-bar"><div class="vel-ramp" style="background:linear-gradient(90deg,${grad})"></div><div class="vel-over" title="${t('network.legend.above', { max: VEL.max })}"></div></div>
      <div class="vel-ticks"><div class="vel-ticks-in">${ticks}</div><span class="vel-gt">&gt;${VEL.max}</span></div>
      <div class="vel-key"><i style="background:${VEL.stops[1][1]}"></i>${t('network.legend.low')}<i style="background:${VEL.stops[3][1]}"></i>${t('network.legend.economic')}<i style="background:${VEL.stops[7][1]}"></i>5 m/s<i style="background:${VEL.over};box-shadow:inset 0 0 0 1px var(--ink-3)"></i>${t('network.legend.aboveShort')}</div>`;
  }

  // value of the chosen quantity in every pipe with results, with its range
  function overlayValues(res, key) {
    if (!res || key === 'none' || !offered(key, isGas(res))) return null;
    if (EXTRA.has(key)) {
      const o = EXTRA.get(key).values(res);
      if (!o || !o.vals.size) return null;
      if (Number.isFinite(o.min) && Number.isFinite(o.max)) return o;
      const arr = [...o.vals.values()];
      return { vals: o.vals, min: Math.min(...arr), max: Math.max(...arr) };
    }
    const vals = new Map();
    for (const [id, r] of Object.entries(res.pipes)) {
      if (r.isolated) continue;
      let v;
      if (key === 'P') v = (r.Pin + r.Pout) / 2;
      else if (key === 'HGL') v = (r.HGLin + r.HGLout) / 2;
      else if (key === 'M') v = Math.max(r.Min || 0, r.Mout || 0);
      else if (key === 'Q' || key === 'V' || key === 'dP0' || key === 'm') v = Math.abs(r[key]);
      else v = r[key];
      if (Number.isFinite(v)) vals.set(Number(id), v);
    }
    if (!vals.size) return null;
    const arr = [...vals.values()];
    return { vals, min: Math.min(...arr), max: Math.max(...arr) };
  }

  // pipe colour: fixed scale for the velocity of a liquid, model range for the rest
  function pipeColor(ovKey, v, t, gas = false) { return ovKey === 'V' && !gas ? velColor(v) : rampColor(t); }
  const beyondScale = (ovKey, v, gas = false) => ovKey === 'V' && !gas && Math.abs(v) > VEL.max;

  // legend of the colour scale (lg = the legend element)
  function renderLegend(lg, ov, ovKey, unitOf, fmtOv, gas = false) {
    if (ov && ovKey === 'V' && !gas) {
      lg.hidden = false;
      lg.innerHTML = velLegend();
    } else if (ov) {
      const cat = OVERLAY[ovKey].cat;
      const title = EXTRA.has(ovKey) ? F.esc(EXTRA.get(ovKey).title()) : t('network.legend.' + ovKey);
      lg.hidden = false;
      lg.innerHTML = `<div class="eyebrow">${title}${cat ? ` (${F.esc(F.unit(unitOf(cat)))})` : ''}</div>
        <div class="ramp" style="background:linear-gradient(90deg,${RAMP.join(',')})"></div>
        <div class="ends"><span>${fmtOv(ov.min, cat)}</span><span>${fmtOv(ov.max, cat)}</span></div>`;
    } else lg.hidden = true;
  }

  // the options of the overlay selector offered for the regime of the results (or of the model); a choice not offered
  // shows as "none"
  function syncPicker(sel, gas, key) {
    for (const o of sel.options) o.hidden = !offered(o.value, gas);
    sel.value = offered(key, gas) ? key : 'none';
  }
  // value and unit of a quantity on the drawing (the Mach number has no unit)
  const labelOf = (fmtOv, unitOf, v, cat) => (cat ? `${fmtOv(v, cat)} ${F.unit(unitOf(cat))}` : F.fmt(v, 3));
  // the value written beside a junction with results on the drawing: its HGL with the HGL, its pressure with the other
  // quantities, or the value a module gives ('' for none)
  function junctionLabel(ovKey, jr, id, fmtOv, unitOf) {
    if (!jr || ovKey === 'none' || jr.isolated) return '';
    if (EXTRA.has(ovKey)) {
      const x = EXTRA.get(ovKey), v = x.junction ? x.junction(id) : null;
      return Number.isFinite(v) ? labelOf(fmtOv, unitOf, v, x.cat) : '';
    }
    return ovKey === 'HGL' ? labelOf(fmtOv, unitOf, jr.HGL, 'head') : labelOf(fmtOv, unitOf, jr.Pin, 'pressure');
  }

  PumpIt.ui.colorScales = { OVERLAY, RAMP, offered, isGas, rampColor, velColor, velLegend, overlayValues, pipeColor, beyondScale, renderLegend, syncPicker, labelOf, junctionLabel, addOverlay };
})(typeof window !== 'undefined' ? window : globalThis);
