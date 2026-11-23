// "Convert value…" beside the unit of a field: shows the quantity as stored, converts it to the unit chosen, with a
// preview, and writes the pair { value, unit } in one step (one undo snapshot, one recalculation). The unit selector
// itself stays an input unit: changing it keeps the number typed (15 m becomes 15 mm).
(function (root) {
  const PumpIt = root.PumpIt;
  const U = PumpIt.units, M = PumpIt.model, UI = PumpIt.ui;
  const F = UI.format;
  const { el } = UI.dom;
  const app = PumpIt.app;
  const { t } = PumpIt.i18n;
  const tx = (k, p) => t('inspector.convert.' + k, p);

  // What a conversion of the field of objKey may need, as the core reads the same quantities: the ambient pressure
  // of the scenario; for a liquid its density; for a gas the normal density and, for a volume at the conditions of
  // the point, the density at the junction from the results of the current scenario.
  function context(objKey) {
    const eff = app.eff(), sys = eff.system, ctx = {};
    try { ctx.patm = U.toSI(sys.patm.value, sys.patm.unit, 'pressure'); } catch (e) { /* no ambient pressure */ }
    if (M.isCompressible(eff)) {
      try { ctx.rhoN = PumpIt.fluids.normalDensity(PumpIt.fluids.evaluateGas(sys).MW); } catch (e) { /* incomplete gas */ }
      const res = app.okResults();
      const jr = res && objKey.startsWith('j:') ? res.junctions[objKey.slice(2)] : null;
      if (jr && jr.rho > 0) ctx.rho = jr.rho;
    } else {
      try { ctx.rho = PumpIt.fluids.evaluate(sys).rho; } catch (e) { /* incomplete fluid */ }
    }
    return { ctx, gas: M.isCompressible(eff) };
  }

  // a number for reading: grouped digits, up to 8 significant ones (the stored value keeps its precision)
  function show(v) {
    const a = Math.abs(v);
    if (a !== 0 && (a >= 1e9 || a < 1e-6)) return F.fmt(v, 8);
    return v.toLocaleString(F.locale(), { maximumSignificantDigits: 8 }).replace('-', '−');
  }

  // why the conversion cannot be done, or '' when it can
  function reason(v, from, to, cat, c) {
    if (!Number.isFinite(v)) return tx('why.empty');
    // a gas converts a normal volume only with its normal density (never the density at the point)
    const normal = cat === 'flow' && U.flowFamily(from) !== U.flowFamily(to) && (U.isNormal(from) || U.isNormal(to));
    if (c.gas && normal && !(c.ctx.rhoN > 0)) return tx('why.rhoN');
    const need = U.convertNeeds(from, to, cat, c.ctx);
    if (!need) return '';
    if (need === 'rho') return tx(c.gas ? 'why.rhoGas' : 'why.rho');
    return tx('why.' + need);
  }

  // opener: the button that opened the window, given the focus back when it closes
  function open(objKey, path, label, cat, opener) {
    const q = app.getVal(objKey, path) || {};
    const from = q.unit, v = q.value === null || q.value === undefined ? NaN : q.value;
    const c = context(objKey);
    const units = UI.forms.unitOptions(cat, from);
    const body = el('div', { class: 'conv' });
    body.innerHTML = `<p class="muted small conv-field">${F.esc(label)}</p>
      <div class="conv-row"><span>${F.esc(tx('current'))}</span><b class="num">${Number.isFinite(v) ? `${F.esc(show(v))} ${F.esc(F.unit(from))}` : '—'}</b></div>
      <div class="conv-row"><label for="conv-unit">${F.esc(tx('to'))}</label><select id="conv-unit" class="unit">${units}</select></div>
      <div class="conv-row"><span>${F.esc(tx('result'))}</span><b class="num" id="conv-out" aria-live="polite"></b></div>
      <p class="hint conv-why" id="conv-why" hidden></p>`;
    const sel = body.querySelector('#conv-unit');
    // the first unit other than the current one
    const other = [...sel.options].find((o) => o.value !== from);
    if (other) sel.value = other.value;
    let result = null;
    const update = () => {
      const to = sel.value;
      const why = reason(v, from, to, cat, c);
      result = why ? null : U.convert(v, from, to, cat, c.ctx);
      if (result !== null && !Number.isFinite(result)) result = null;
      body.querySelector('#conv-out').textContent = result === null ? '—' : `${show(result)} ${F.unit(to)}`;
      const w = body.querySelector('#conv-why');
      w.textContent = why; w.hidden = !why;
      const ok = document.querySelector('#modal-actions .primary');
      if (ok) ok.disabled = result === null || to === from;
    };
    sel.addEventListener('change', update);
    UI.dialogs.modal({
      title: tx('title'), body, opener,
      actions: [
        { label: t('app.dialog.cancel') },
        {
          label: tx('apply'), primary: true,
          onClick: () => {
            if (result === null) return false;
            // 12 significant digits drop the noise of the binary arithmetic (15 m → 15000.000000000002 mm)
            app.setVal(objKey, path, { value: Number(result.toPrecision(12)), unit: sel.value });
          },
        },
      ],
    });
    update();
  }

  PumpIt.ui.valueConvert = { open, context, reason };
})(window);
