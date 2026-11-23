// The wave of a pipe in the inspector, with the water hammer on (§3 and §11.4 of its specification): its wave speed
// calculated from its wall or given; how it is held; the modulus of elasticity, Poisson's ratio and the wall, which empty
// take the material and the wall of its catalogue (shown as the hint of the fields), with typical values of other
// materials; the wave speed, and the sections, adjusted speed and variance the run will take; its output stations and
// its maximum pressure for the warnings; with the friction of Brunone (phase G3), its coefficient k, empty to take it
// from the Reynolds number of the steady flow.
(function (root) {
  const PumpIt = root.PumpIt;
  const UI = PumpIt.ui, I = UI.inspector;
  const app = PumpIt.app;
  const F = UI.format;
  const { el } = UI.dom;
  const { t } = PumpIt.i18n;
  const tx = (key, params) => t('surge.pipe.' + key, params);
  const W = () => PumpIt.surge.wavespeed;

  // a quantity that may stay empty (null): the unit it starts with, and a hint of the value it takes then
  function optQty(key, path, label, cat, unit0, opts = {}) {
    const v = app.getVal(key, path);
    const val = v && typeof v === 'object' ? v : { value: null, unit: unit0 };
    const id = UI.forms.idOf(key, path);
    const inp = el('input', { type: 'text', id, inputmode: 'decimal', autocomplete: 'off', placeholder: opts.placeholder || null });
    inp.value = F.inputStr(val.value);
    const us = el('select', { class: 'unit has-tip', 'aria-label': t('inspector.fields.unitOf', { label }), 'aria-describedby': UI.forms.unitTip(), id: id + '-u' }, UI.forms.unitOptions(cat, val.unit || unit0));
    inp.addEventListener('change', () => { const n = F.parseNum(inp.value); app.setVal(key, path, Number.isFinite(n) ? { value: n, unit: us.value } : null); });
    us.addEventListener('change', () => { const n = F.parseNum(inp.value); app.setVal(key, path, { value: Number.isFinite(n) ? n : null, unit: us.value }); });
    return UI.forms.wrap(key, path, label, inp, Object.assign({}, opts, { after: UI.forms.unitCtl(key, path, label, cat, inp, us) }));
  }
  // a choice whose stored value may be missing (the default of the data of the pipe)
  function choice(key, path, label, options, value, opts = {}) {
    const id = UI.forms.idOf(key, path);
    const s = el('select', { id }, options.map(([v, l]) => F.option(v, l, String(v) === String(value))).join(''));
    s.addEventListener('change', () => app.setVal(key, path, s.value));
    return UI.forms.wrap(key, path, label, s, opts);
  }

  I.addSection('pipe', (host, id) => {
    if (!app.surgeOn || !app.surgeOn()) return;
    const key = 'p:' + id;
    const p = app.effObj(key);
    if (!p) return;
    const { section, num, readout, hint } = UI.forms;
    const d = W().dataOf(p);
    const s = section(tx('title'), { info: tx('hint') });
    host.appendChild(s);
    if (p.closed) { s.appendChild(hint(F.esc(tx('closed')))); return; }
    s.appendChild(choice(key, 'surge.wave', tx('wave'), W().WAVES.map((w) => [w, tx('waves.' + w)]), d.wave));
    const eff = app.eff();
    let K = NaN, rho = NaN;
    try { K = W().fluidK(eff.system); rho = PumpIt.fluids.evaluate(eff.system).rho; } catch (e) { /* the system checks it */ }
    if (d.wave === 'given') s.appendChild(optQty(key, 'surge.a', tx('a'), 'velocity', 'm/s'));
    else {
      s.appendChild(choice(key, 'surge.support', tx('support'), W().SUPPORTS.map((x) => [x, tx('supports.' + x)]), d.support, { info: tx('supportHint') }));
      const mat = W().catalogMaterial(p);
      const wall = W().catalogWall(p);
      const tunnel = d.support === 'tunnelUnlined' || d.support === 'tunnelLined';
      if (d.support !== 'tunnelUnlined') {
        s.appendChild(optQty(key, 'surge.E', tx('E'), 'modulus', 'GPa', { placeholder: mat ? F.fmt(mat.E / 1e9, 4) : null, info: tx('EHint') }));
        if (!tunnel && d.support !== 'thinJoints' && d.support !== 'user') {
          const nu = num(key, 'surge.nu', tx('nu'));
          if (mat) nu.querySelector('input').placeholder = F.fmt(mat.nu, 3);
          s.appendChild(nu);
        }
        s.appendChild(optQty(key, 'surge.wall', tx('wall'), 'length', 'mm', { placeholder: Number.isFinite(wall) ? F.fmt(wall * 1000, 4) : null, info: tx('wallHint') }));
        // typical values of a material: E and ν
        const pick = el('select', { id: `sp-mat-${id}` }, `<option value="">${F.esc(tx('typical'))}</option>` + Object.entries(W().MATERIALS).map(([m, x]) => `<option value="${m}">${F.esc(tx('materials.' + m))} · ${F.fmt(x.E / 1e9, 3)} GPa · ν ${F.fmt(x.nu, 2)}</option>`).join(''));
        pick.addEventListener('change', () => {
          const x = W().MATERIALS[pick.value];
          if (x) app.setVals(key, [['surge.E', { value: x.E / 1e9, unit: 'GPa' }], ['surge.nu', x.nu]]);
        });
        s.appendChild(UI.forms.wrap(null, '', tx('typicalLabel'), pick));
        if (mat) s.appendChild(hint(F.esc(tx('fromCatalog', { material: tx('materials.' + mat.id) }))));
      }
      if (tunnel) s.appendChild(optQty(key, 'surge.G', tx('G'), 'modulus', 'GPa', { info: tx('GHint') }));
      if (d.support === 'buried') s.appendChild(num(key, 'surge.buriedPct', tx('buriedPct'), { suffix: '%', info: tx('buriedHint') }));
      if (d.support === 'user') s.appendChild(num(key, 'surge.c1', tx('c1')));
    }
    // the wave speed and the sections of the run
    const w = W().pipeSpeed(p, K, rho);
    if (w.a > 0) {
      s.appendChild(readout(tx('aCalc'), `${F.fmt(w.a, 5)} m/s${Number.isFinite(w.c1) ? ` · c₁ ${F.fmt(w.c1, 4)}` : ''}`));
      if (!w.x.given && w.x.plastic) s.appendChild(hint(F.esc(tx('plastic'))));
      if (!w.x.given && !w.x.thin && w.x.support && w.x.support.startsWith('thin')) s.appendChild(hint(F.esc(tx('thick'))));
      const size = PumpIt.surge.network.sizeOf(eff);
      const sp = size && size.sec.pipes.find((x) => x.id === id);
      if (sp) s.appendChild(readout(tx('sections'), tx('sectionsValue', { n: sp.n, a: F.fmt(sp.aAdj, 5), v: F.fixed(100 * sp.variance, 3) })));
    }
    s.appendChild(choice(key, 'surge.stations', tx('stations'), PumpIt.surge.inputs.PIPE_STATIONS.map((x) => [x, tx('stationsOf.' + x)]), Array.isArray(d.stations) ? 'default' : d.stations, { info: tx('stationsHint') }));
    s.appendChild(optQty(key, 'surge.pMax', tx('pMax'), 'pressure', 'kgf/cm²(g)', { info: tx('pMaxHint') }));
    if (PumpIt.surge.inputs.controlOf(eff).friction === 'brunone') {
      const kf = num(key, 'surge.k', tx('k'), { info: tx('kHint') });
      kf.querySelector('input').placeholder = tx('kAuto');
      s.appendChild(kf);
    }
  });
})(window);
