// View pieces shared by several junction types: valve loss model fields (with the opening and the characteristic of a
// valve) and summary, discharge results.
(function (root) {
  const PumpIt = root.PumpIt;
  const F = PumpIt.ui.format;
  const { t } = PumpIt.i18n;

  // loss model of a valve: K, Cv, Kv or, unless opts.opening is false, an opening with its characteristic
  function lossModelFields(s, key, j, f, opts = {}) {
    const models = [['K', t('junctions.lossModel.K')], ['Cv', t('junctions.lossModel.Cv')], ['Kv', t('junctions.lossModel.Kv')]];
    if (opts.opening !== false) models.push(['opening', t('junctions.lossModel.opening')]);
    s.appendChild(f.sel(key, 'lossModel', t('junctions.lossModel.label'), models));
    if (j.lossModel === 'K') s.appendChild(f.num(key, 'K', 'K'));
    if (j.lossModel === 'Cv') s.appendChild(f.num(key, 'Cv', 'Cv', { info: t('junctions.lossModel.CvHint') }));
    if (j.lossModel === 'Kv') s.appendChild(f.num(key, 'Kv', 'Kv', { info: t('junctions.lossModel.KvHint') }));
    if (j.lossModel === 'opening') {
      characteristicFields(s, key, j, f);
      s.appendChild(f.num(key, 'open', t('junctions.lossModel.open'), { suffix: '%', info: t('junctions.lossModel.openHint') }));
    }
  }
  // the characteristic of a valve: its Cv fully open, linear or of equal percentage (with its rangeability)
  function characteristicFields(s, key, j, f) {
    s.appendChild(f.num(key, 'CvMax', t('junctions.lossModel.CvMax'), { info: t('junctions.lossModel.CvHint') }));
    s.appendChild(f.sel(key, 'char', t('junctions.lossModel.char'), [['linear', t('junctions.lossModel.chars.linear')], ['equalPct', t('junctions.lossModel.chars.equalPct')]]));
    if (j.char === 'equalPct') s.appendChild(f.num(key, 'R', t('junctions.lossModel.R')));
  }

  function lossSummary(j) {
    if (j.lossModel === 'opening') return `${t('junctions.lossModel.open')} ${F.fmt(j.open, 3)} % · Cv ${F.fmt(j.CvMax, 4)}`;
    return j.lossModel === 'K' ? `K ${F.fmt(j.K, 4)}` : j.lossModel === 'Cv' ? `Cv ${F.fmt(j.Cv, 4)}` : `Kv ${F.fmt(j.Kv, 4)}`;
  }

  // right-click card of a junction that discharges out of the network (nozzle, exit valve)
  const dischargeInfo = (lossKey) => (add, r, c) => {
    add(t('network.info.discharged'), c.out(Math.abs(r.Q), 'volFlow'), true);
    add(t('network.info.inletStagnation'), c.out(r.P0in, 'pressure'), true);
    add(t(lossKey), c.out(r.dP, 'dp'));
    if (c.vr && Number.isFinite(c.vr.Cv)) add(t('network.info.cvEquivalent'), F.fmt(c.vr.Cv, 4));
  };

  // temperature of the gas a junction supplies, in the adiabatic model of the compressible mode (R-12); empty means the
  // temperature of the sources given with the gas
  function sourceTemperature(s, ctx) {
    if (!ctx.adiabatic) return;
    s.appendChild(ctx.f.qty(ctx.key, 'gasT', t('junctions.gasT.label'), 'temperature', { info: t('junctions.gasT.hint') }));
  }

  // ---------- the protection devices of the water hammer (src/core/surge/devices.js), in its section of the inspector;
  // their texts come with the module (surge.device)
  const ds = (key, params) => t('surge.device.' + key, params);
  // the shape of a surge tank or of an air vessel: a constant section or a table of volume by height, its bottom and
  // its height (opts.vessel: the vessel may have no geometry, and its height is required)
  function deviceShape(s, key, j, f, opts = {}) {
    const shapes = (opts.vessel ? ['none'] : []).concat(['constant', 'table']);
    s.appendChild(f.sel(key, 'shape', ds('shape'), shapes.map((x) => [x, ds('shapes.' + x)]), { info: ds(opts.vessel ? 'shapeVesselHint' : 'shapeHint') }));
    if (j.shape === 'constant') s.appendChild(f.qty(key, 'area', ds('area'), 'area'));
    else if (j.shape === 'table') {
      const tb = j.table && Array.isArray(j.table.h) ? j.table : { h: [], V: [], hUnit: 'm', vUnit: 'm³' };
      s.appendChild(PumpIt.ui.pointTable.build({
        id: `dv-${key.replace(/\W/g, '_')}-tb`,
        x: { label: ds('h'), cat: 'length', unit: tb.hUnit || 'm' },
        y: { label: ds('V'), cat: 'volume', unit: tb.vUnit || 'm³' },
        xs: tb.h, ys: tb.V, steps: false,
        onChange: (x) => PumpIt.app.setVal(key, 'table', { h: x.xs, V: x.ys, hUnit: x.xUnit, vUnit: x.yUnit }),
      }));
    }
    if (j.shape === 'constant' || j.shape === 'table') {
      s.appendChild(f.qty(key, 'bottom', ds('bottom'), 'length', { info: ds('bottomHint') }));
      s.appendChild(f.qty(key, 'height', ds(opts.vessel ? 'heightVessel' : 'height'), 'length', { info: ds(opts.vessel ? 'heightVesselHint' : 'heightHint') }));
    }
  }
  // the connection of a tank or a vessel to its node: an orifice with a Cd·A each way, a short riser with its inertia
  function deviceConnection(s, key, j, f) {
    s.appendChild(f.chk(key, 'orifice', ds('orifice'), { info: ds('orificeHint') }));
    if (j.orifice) {
      s.appendChild(f.qty(key, 'CdAin', ds('CdAin'), 'area'));
      s.appendChild(f.qty(key, 'CdAout', ds('CdAout'), 'area'));
    }
    s.appendChild(f.chk(key, 'riser', ds('riser'), { info: ds('riserHint') }));
    if (j.riser) {
      s.appendChild(f.qty(key, 'riserL', ds('riserL'), 'length'));
      s.appendChild(f.qty(key, 'riserD', ds('riserD'), 'length'));
      s.appendChild(f.num(key, 'riserF', ds('riserF')));
    }
  }
  // the inspector data of a device: in the steady state a node without losses, its data in the water hammer section
  const deviceNote = (s, f, type) => f.note(s, F.esc(t('junctions.' + type + '.form.hint')));

  PumpIt.ui.junctionTypes.shared = { lossModelFields, characteristicFields, lossSummary, dischargeInfo, sourceTemperature, deviceShape, deviceConnection, deviceNote };
})(typeof window !== 'undefined' ? window : globalThis);
