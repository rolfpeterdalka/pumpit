// Air vessel view: in the steady state a node without losses; its data for the water hammer (the gas, the geometry, the
// limits, the orifice and the riser) in the water hammer section of the inspector.
(function (root) {
  const PumpIt = root.PumpIt;
  const JT = PumpIt.ui.junctionTypes;
  const S = PumpIt.view3d.solid;
  const { stroke } = JT.SVG;
  const { t } = PumpIt.i18n;
  const ds = (key, params) => t('surge.device.' + key, params);

  JT.register('airVessel', {
    // a closed vessel, its gas over the liquid
    symbol: `<rect x="-7" y="-14" width="14" height="24" rx="6" ${stroke}/><path d="M-7 1h14v3a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6z" style="fill:var(--accent)" opacity=".28"/><path d="M-7 1h14" ${stroke} style="stroke:var(--accent)"/><path d="M0 10V14" ${stroke}/>`,
    // 3D views: a closed vessel with domed ends
    solid: {
      parts: [
        S.rev([0, 0, -7], [0, 0, -3], 3, 8, 'steel', { cap1: false }), S.cyl([0, 0, -3], [0, 0, 14], 8, 'steel', { cap0: false, cap1: false }),
        S.rev([0, 0, 14], [0, 0, 19], 8, 2, 'steel', { cap0: false }),
      ],
      reach: [S.cyl([0, 0, -7], [0, 0, 19], 8)],
    },

    form(s, { f }) { JT.shared.deviceNote(s, f, 'airVessel'); },

    // the water hammer section: its gas, its geometry and limits, its connection
    surge(s, { key, j, f }) {
      s.appendChild(f.num(key, 'n', ds('n'), { info: ds('nHint') }));
      s.appendChild(f.sel(key, 'gasInit', ds('gasInit'), [['given', ds('gasInits.given')], ['precharge', ds('gasInits.precharge')]], { info: ds('gasInitHint') }));
      if (j.gasInit === 'precharge') {
        s.appendChild(f.qty(key, 'Ppre', ds('Ppre'), 'pressure'));
        s.appendChild(f.qty(key, 'Vpre', ds('Vpre'), 'volume'));
      } else s.appendChild(f.qty(key, 'Vg0', ds('Vg0'), 'volume'));
      JT.shared.deviceShape(s, key, j, f, { vessel: true });
      if (!(j.shape === 'constant' || j.shape === 'table')) s.appendChild(f.qty(key, 'vol', ds('vol'), 'volume', { info: ds('volHint') }));
      s.appendChild(f.qty(key, 'vgMin', ds('vgMin'), 'volume', { info: ds('vgMinHint') }));
      JT.shared.deviceConnection(s, key, j, f);
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
