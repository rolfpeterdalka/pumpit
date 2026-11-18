// Surge tank view: in the steady state a node whose level is that of its pressure, or a given level; its data for the
// water hammer (shape, bottom and top, check, orifice and riser) in the water hammer section of the inspector.
(function (root) {
  const PumpIt = root.PumpIt;
  const JT = PumpIt.ui.junctionTypes;
  const S = PumpIt.view3d.solid;
  const { stroke } = JT.SVG;
  const { t } = PumpIt.i18n;
  const tx = (key, params) => t('junctions.surgeTank.' + key, params);
  const ds = (key, params) => t('surge.device.' + key, params);

  JT.register('surgeTank', {
    // a tall open tank over the node, with its liquid
    symbol: `<path d="M-7 -14V9H7V-14" ${stroke}/><path d="M-7 -1h14V9H-7z" style="fill:var(--accent)" opacity=".28"/><path d="M-5 -1c1.4-1.2 2.8-1.2 4.2 0s2.8 1.2 4.2 0" ${stroke} style="stroke:var(--accent)"/><path d="M0 9V14" ${stroke}/>`,
    // 3D views: a tall open tank with its liquid
    solid: { parts: [S.tank(8, -8, 24, 8, { shell: 'steel', inside: 'inside', liquid: 'liquid' })], reach: [S.cyl([0, 0, -8], [0, 0, 24], 8)] },

    form(s, { key, j, f }) {
      JT.shared.deviceNote(s, f, 'surgeTank');
      s.appendChild(f.sel(key, 'level', tx('form.level'), [['steady', tx('form.levels.steady')], ['given', tx('form.levels.given')]], { info: tx('form.levelHint') }));
      if (j.level === 'given') s.appendChild(f.qty(key, 'liquidElev', tx('form.liquidElev'), 'length'));
    },

    summary: (j, q) => (j.level === 'given' ? tx('summaryGiven', { level: q(j.liquidElev) }) : tx('summary')),

    quickResults(row, r, c) {
      if (Number.isFinite(r.level)) row(tx('results.level'), c.out(r.level, 'length'));
    },

    // the water hammer section: its shape, its check, its connection
    surge(s, { key, j, f }) {
      JT.shared.deviceShape(s, key, j, f);
      s.appendChild(f.chk(key, 'oneWay', ds('oneWay'), { info: ds('oneWayHint') }));
      JT.shared.deviceConnection(s, key, j, f);
    },

    boundaryFlow: (r) => (Math.abs(r.net) > 1e-12 ? r.net : null),
  });
})(typeof window !== 'undefined' ? window : globalThis);
