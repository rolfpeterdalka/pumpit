// Air valve view: without air in the steady state (a node without losses); its data for the water hammer (its type,
// orifices, opening pressure, air) in the water hammer section of the inspector.
(function (root) {
  const PumpIt = root.PumpIt;
  const JT = PumpIt.ui.junctionTypes;
  const S = PumpIt.view3d.solid;
  const { stroke, fill } = JT.SVG;
  const { t } = PumpIt.i18n;
  const ds = (key, params) => t('surge.device.' + key, params);
  const TYPES = ['both', 'in', 'out', 'twoStage'];

  JT.register('airValve', {
    // a body on the node with its float, and the air going in and out
    symbol: `<circle r="3.2" ${fill}/><path d="M-6 1V-7a6 6 0 0 1 12 0V1" ${stroke}/><circle cy="-6" r="2.6" ${stroke}/><path d="M-3 -16l3 -3 3 3M0 -19V-13" ${stroke}/>`,
    // 3D views: the body of the valve over a node
    solid: {
      parts: [
        S.ball([0, 0, 0], 5.5, 'node'),
        S.cyl([0, 0, 3], [0, 0, 11], 4.6, 'valve'),
        S.rev([0, 0, 11], [0, 0, 15], 4.6, 1.8, 'valve', { cap0: false }),
        S.cyl([0, 0, 15], [0, 0, 17], 1.8, 'brass'),
      ],
      reach: [S.ball([0, 0, 0], 5.5)],
    },

    form(s, { f }) { JT.shared.deviceNote(s, f, 'airValve'); },

    // the water hammer section: its type, its orifices, when it opens, its air
    surge(s, { key, j, f }) {
      s.appendChild(f.sel(key, 'avType', ds('avType'), TYPES.map((x) => [x, ds('avTypes.' + x)])));
      if (j.avType !== 'out') s.appendChild(f.qty(key, 'CdAin', ds('airIn'), 'area'));
      if (j.avType !== 'in') s.appendChild(f.qty(key, 'CdAout', ds('airOut'), 'area'));
      if (j.avType === 'twoStage') {
        s.appendChild(f.qty(key, 'CdAout2', ds('airOut2'), 'area'));
        s.appendChild(f.sel(key, 'switchBy', ds('switchBy'), [['dP', ds('switchBys.dP')], ['flow', ds('switchBys.flow')]], { info: ds('switchHint') }));
        if (j.switchBy === 'flow') s.appendChild(f.qty(key, 'switchFlow', ds('switchFlow'), 'massFlow'));
        else s.appendChild(f.qty(key, 'switchDP', ds('switchDP'), 'dp'));
      }
      s.appendChild(f.qty(key, 'Popen', ds('Popen'), 'pressure', { info: ds('PopenHint') }));
      s.appendChild(f.qty(key, 'Tair', ds('Tair'), 'temperature', { info: ds('TairHint') }));
      s.appendChild(f.qty(key, 'mAir0', ds('mAir0'), 'mass', { info: ds('mAir0Hint') }));
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
