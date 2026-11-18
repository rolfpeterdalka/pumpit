// Surge tank: an open tank on a node, which protects the network from a water hammer (§6.1 of the specification of the
// water hammer, docs/water-hammer.md). In the steady state it is a node without losses whose level is that of the
// pressure of the node, or it has a given level and is then a pressure reference. Its data for the transient (its
// shape, bottom and top, orifice, riser and check) are read by the water hammer only (src/core/surge/devices.js), and
// the type is offered while that module is in the page.
(function (root) {
  const PumpIt = root.PumpIt;
  const { t } = PumpIt.i18n;
  const q = PumpIt.model.q;
  const SD = () => PumpIt.surge && PumpIt.surge.devices;

  PumpIt.junctionTypes.register({
    type: 'surgeTank', order: 120, group: 'protection',
    pipes: [1, 25], multi: true,
    offered: () => !!SD(),

    defaults: () => ({
      level: 'steady', liquidElev: q(10, 'm'),
      shape: 'constant', area: q(10, 'm²'), table: { h: [0, 10], V: [0, 100], hUnit: 'm', vUnit: 'm³' },
      bottom: q(null, 'm'), height: q(null, 'm'),
      orifice: false, CdAin: q(0.1, 'm²'), CdAout: q(0.1, 'm²'),
      riser: false, riserL: q(5, 'm'), riserD: q(0.5, 'm'), riserF: 0.015,
      oneWay: false, pipeK: {},
    }),

    validate(j, miss, { fin }) {
      if (j.level === 'given' && !fin(j.liquidElev)) miss.push(t('junctions.surgeTank.check.liquidElev'));
    },

    // a given level makes it a pressure reference at the elevation of the junction: the atmosphere and the liquid over it
    buildNode(j, net, z) {
      if (j.level === 'given') return net.addNode({ kind: 'fixed', value: net.env.patm + net.rho * net.g * (net.si(j.liquidElev, 'length') - z), z, jid: j.id });
      return net.addNode({ z, jid: j.id });
    },

    // the level of the steady state: the pressure of the node as a column of liquid over the atmosphere
    nodeResults(j, jr, rc) {
      const { rho, g, patm } = rc.env;
      jr.level = rc.nd.isolated ? NaN : jr.z + (rc.P0 - patm) / (rho * g);
    },

    // water hammer: its own boundary, no table
    surge: {
      quantities: () => [],
      boundary: (j, ctx) => SD().surgeTank(j, ctx),
      validate: (j, miss, v) => SD().validateSurgeTank(j, miss, v),
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
