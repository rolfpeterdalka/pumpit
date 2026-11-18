// Relief valve view: closed in the steady state (a node without losses); its data for the water hammer (how it opens,
// its pressures, its capacity, the outside pressure) in the water hammer section of the inspector.
(function (root) {
  const PumpIt = root.PumpIt;
  const JT = PumpIt.ui.junctionTypes;
  const S = PumpIt.view3d.solid;
  const { stroke } = JT.SVG;
  const { t } = PumpIt.i18n;
  const ds = (key, params) => t('surge.device.' + key, params);

  JT.register('reliefValve', {
    // a valve with its spring over it and the discharge to the side
    symbol: `<path d="M-13 -5L0 2L-13 9z M13 -5L0 2L13 9z" ${stroke}/><path d="M0 2V-3L-4 -5L4 -8L-4 -11L4 -14" ${stroke}/>`,
    // 3D views: the body of a valve with the bonnet of its spring
    solid: {
      parts: [
        S.rev([-12, 0, 0], [0, 0, 0], 6.5, 2.2, 'valve', { cap1: false }), S.rev([0, 0, 0], [12, 0, 0], 2.2, 6.5, 'valve', { cap0: false }),
        S.cyl([0, 0, 1.5], [0, 0, 6], 4, 'valve', { cap0: false }),
        S.rev([0, 0, 6], [0, 0, 14], 3.4, 2, 'brass'),
      ],
      reach: [S.cyl([-12, 0, 0], [12, 0, 0], 6.5)],
    },

    form(s, { f }) { JT.shared.deviceNote(s, f, 'reliefValve'); },

    // the water hammer section: how it opens, its pressures, its capacity
    surge(s, { key, j, f }) {
      s.appendChild(f.sel(key, 'mode', ds('mode'), [['pressure', ds('modes.pressure')], ['instant', ds('modes.instant')]], { info: ds('modeHint') }));
      s.appendChild(f.qty(key, 'Pset', ds('Pset'), 'pressure'));
      if (j.mode !== 'instant') s.appendChild(f.qty(key, 'Pfull', ds('Pfull'), 'pressure'));
      s.appendChild(f.qty(key, 'Pclose', ds('Pclose'), 'pressure', { info: ds('PcloseHint') }));
      s.appendChild(f.sel(key, 'lossModel', ds('capacity'), [['Cv', ds('capacities.Cv')], ['Kv', ds('capacities.Kv')], ['CdA', ds('capacities.CdA')]]));
      if (j.lossModel === 'Kv') s.appendChild(f.num(key, 'Kv', 'Kv', { info: t('junctions.lossModel.KvHint') }));
      else if (j.lossModel === 'CdA') s.appendChild(f.qty(key, 'CdA', 'Cd·A', 'area'));
      else s.appendChild(f.num(key, 'Cv', 'Cv', { info: t('junctions.lossModel.CvHint') }));
      s.appendChild(f.qty(key, 'Pext', ds('Pext'), 'pressure'));
      s.appendChild(f.num(key, 'rate', ds('rate'), { suffix: '%/s', info: ds('rateHint') }));
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
