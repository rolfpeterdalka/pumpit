// Air vessel: a closed vessel with gas over the liquid on a node, which protects the network from a water hammer (§6.2
// of the specification of the water hammer, docs/water-hammer.md). In the steady state it is a node without losses. Its
// data for the transient (its gas, geometry, limits, orifice and riser) are read by the water hammer only
// (src/core/surge/devices.js), and the type is offered while that module is in the page.
(function (root) {
  const PumpIt = root.PumpIt;
  const q = PumpIt.model.q;
  const SD = () => PumpIt.surge && PumpIt.surge.devices;

  PumpIt.junctionTypes.register({
    type: 'airVessel', order: 130, group: 'protection',
    pipes: [1, 25], multi: true,
    offered: () => !!SD(),

    defaults: () => ({
      n: 1.2, gasInit: 'given', Vg0: q(1, 'm³'), Ppre: q(1, 'kgf/cm²(g)'), Vpre: q(2, 'm³'),
      vol: q(null, 'm³'), vgMin: q(null, 'm³'),
      shape: 'none', area: q(1, 'm²'), table: { h: [0, 2], V: [0, 2], hUnit: 'm', vUnit: 'm³' }, bottom: q(null, 'm'), height: q(2, 'm'),
      orifice: false, CdAin: q(0.01, 'm²'), CdAout: q(0.01, 'm²'),
      riser: false, riserL: q(2, 'm'), riserD: q(0.2, 'm'), riserF: 0.015,
      pipeK: {},
    }),

    validate() {},

    buildNode: (j, net, z) => net.addNode({ z, jid: j.id }),

    // water hammer: its own boundary, no table
    surge: {
      quantities: () => [],
      boundary: (j, ctx) => SD().airVessel(j, ctx),
      validate: (j, miss, v) => SD().validateAirVessel(j, miss, v),
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
