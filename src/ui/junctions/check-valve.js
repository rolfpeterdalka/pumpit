// Check valve view.
(function (root) {
  const PumpIt = root.PumpIt;
  const JT = PumpIt.ui.junctionTypes;
  const S = PumpIt.view3d.solid;
  const { stroke, fill } = JT.SVG;
  const { t } = PumpIt.i18n;
  const tx = (key, params) => t('junctions.check.' + key, params);

  JT.register('check', {
    // the valve with the half that faces the flow filled: the flow passes from the open half to the filled one
    symbol: `<path d="M-12 -7L12 7V-7L-12 7z" ${stroke}/><path d="M0 0L12 -7V7z" ${fill}/>`,
    orient: 'ports',
    // 3D views: two cones meeting in the middle under the round cover of a swing check, without a stem; red when closed
    solid: {
      parts: [
        S.rev([-12, 0, 0], [0, 0, 0], 6.5, 2.2, 'valve', { cap1: false }), S.rev([0, 0, 0], [12, 0, 0], 2.2, 6.5, 'valve', { cap0: false }),
        S.cyl([0, 0, 1.4], [0, 0, 5], 4.2, 'valve', { cap0: false }),
        S.cyl([0, 0, 5], [0, 0, 6.4], 5.2, 'steel'),
      ],
      reach: [S.cyl([-12, 0, 0], [12, 0, 0], 6.5)],
    },
    closed: (j) => !!j.closed,

    form(s, { key, j, f }) {
      f.note(s, PumpIt.ui.format.esc(tx('form.hint')));
      JT.shared.lossModelFields(s, key, j, f);
      s.appendChild(f.qty(key, 'vClose', tx('form.vClose'), 'velocity', { info: tx('form.vCloseHint') }));
      s.appendChild(f.qty(key, 'dPopen', tx('form.dPopen'), 'dp', { info: tx('form.dPopenHint') }));
      s.appendChild(f.chk(key, 'closed', tx('form.closed')));
    },

    // water hammer (src/ui/surge/junction-section.js; phase G3, decisions G3-04 to G3-06): the model of the valve in the
    // transient, instantaneous (phase G1), by the deceleration of the liquid, a swinging disc or a sliding disc, and the
    // data of each. Choosing a model the first time brings its data, new
    surge(s, { key, j, f }) {
      const sx = (k, p) => t('surge.junction.check.' + k, p);
      const CH = PumpIt.surge.checks, F = PumpIt.ui.format, app = PumpIt.app;
      const { el } = PumpIt.ui.dom;
      const m = CH.MODELS.includes(j.dynamic) ? j.dynamic : 'none';
      const pick = el('select', { id: f.idOf(key, 'dynamic') }, CH.MODELS.map((x) => F.option(x, sx('models.' + x), x === m)).join(''));
      pick.addEventListener('change', () => {
        const v = pick.value, pairs = [['dynamic', v]];
        if (v === 'decel' && !(j.decel && Array.isArray(j.decel.x))) pairs.push(['decel', CH.newDecel()]);
        if (v === 'swing' && !(j.swing && typeof j.swing === 'object')) pairs.push(['swing', CH.newSwing()]);
        if (v === 'nozzle' && !(j.nozzle && typeof j.nozzle === 'object')) pairs.push(['nozzle', CH.newNozzle()]);
        app.setVals(key, pairs);
      });
      s.appendChild(f.wrap(key, 'dynamic', sx('model'), pick, { info: CH.MODELS.map((x) => `<b>${F.esc(sx('models.' + x))}</b><br>${sx('modelHints.' + x)}`).join('<br><br>') }));
      if (m === 'none') return;
      if (!CH.QUADRATIC.includes(j.lossModel)) s.appendChild(f.hint(F.esc(sx('quadratic'))));
      const table = (id, title, o) => {
        const box = el('div', { class: 'td-block' });
        box.appendChild(el('div', { class: 'td-title' }, F.esc(title)));
        box.appendChild(PumpIt.ui.pointTable.build(Object.assign({ id: `ck-${key.replace(/\W/g, '_')}-${id}`, steps: false }, o)));
        return box;
      };
      if (m === 'decel') {
        const d = j.decel && Array.isArray(j.decel.x) ? j.decel : CH.newDecel();
        const box = table('decel', sx('decel'), {
          x: { label: sx('decelAd'), cat: 'accel', unit: d.xUnit || 'm/s²' }, y: { label: sx('decelVR'), cat: 'velocity', unit: d.yUnit || 'm/s' }, xs: d.x, ys: d.y,
          onChange: (x) => app.setVal(key, 'decel', { x: x.xs, y: x.ys, xUnit: x.xUnit, yUnit: x.yUnit }),
        });
        box.appendChild(f.hint(F.esc(sx('decelHint'))));
        s.appendChild(box);
        s.appendChild(f.qty(key, 'decelWindow', sx('window'), 'time', { info: sx('windowHint') }));
        return;
      }
      // a disc: its fields, empty optional ones being none
      const swing = m === 'swing', o = (swing ? j.swing : j.nozzle) || {};
      const qf = (path, cat, info) => s.appendChild(f.qty(key, m + '.' + path, sx('fields.' + path + (path === 'c' && !swing ? 'Linear' : '')), cat, info ? { info: sx('hints.' + path) } : {}));
      if (swing) {
        qf('thetaMax', 'angle', true); qf('seat', 'angle', true); qf('I', 'inertia', true); qf('md', 'mass'); qf('rcg', 'length', true);
        qf('Ad', 'area', true); qf('rp', 'length', true); qf('Ts0', 'torque', true); qf('ks', 'rotStiffness'); qf('c', 'rotDamping', true);
        qf('Wc', 'force', true); qf('rc', 'length'); qf('delta', 'angle');
      } else {
        qf('xMax', 'length', true); qf('m', 'mass', true); qf('Ad', 'area', true); qf('F0', 'force', true); qf('k', 'stiffness'); qf('c', 'damping', true);
      }
      s.appendChild(f.sel(key, m + '.fluidMass', sx('fluidMass'), CH.FLUID_MASS.map((x) => [x, sx('fluidMasses.' + x)]), { info: sx('fluidMassHint') }));
      if (o.fluidMass === 'user') qf('mf', 'mass');
      if (o.fluidMass === 'calculated') qf('rhoM', 'density');
      s.appendChild(f.sel(key, m + '.orient', sx('orient'), CH.ORIENTS.map((x) => [x, sx('orients.' + x)]), { info: sx('orientHint') }));
      if (o.orient === 'angle') qf('phi', 'angle');
      const c = o.cv && Array.isArray(o.cv.x) ? o.cv : { x: [], y: [], xUnit: swing ? '°' : 'mm' };
      const box = table('cv', sx('cvTable'), {
        x: { label: sx(swing ? 'cvAngle' : 'cvTravel'), cat: swing ? 'angle' : 'length', unit: c.xUnit || (swing ? '°' : 'mm') }, y: { label: sx('cvFrac'), cat: '%' }, xs: c.x, ys: c.y,
        onChange: (x) => app.setVal(key, m + '.cv', { x: x.xs, y: x.ys, xUnit: x.xUnit }),
      });
      box.appendChild(f.hint(F.esc(sx('cvHint'))));
      s.appendChild(box);
    },

    summary: (j) => JT.shared.lossSummary(j) + (j.closed ? tx('summaryClosed') : ''),
  });
})(typeof window !== 'undefined' ? window : globalThis);
