// Air valve: a valve on a high point of a line that lets air in when the pressure falls below its opening pressure and
// lets it out again (§6.4 of the specification of the water hammer, docs/water-hammer.md), on one pipe or between two.
// In the steady state it holds no air: a node without losses. Its data for the transient are read by the water hammer
// only (src/core/surge/devices.js), and the type is offered while that module is in the page.
(function (root) {
  const PumpIt = root.PumpIt;
  const q = PumpIt.model.q;
  const SD = () => PumpIt.surge && PumpIt.surge.devices;

  PumpIt.junctionTypes.register({
    type: 'airValve', order: 150, group: 'protection',
    pipes: [1, 2], multi: true,
    offered: () => !!SD(),

    defaults: () => ({
      avType: 'both', CdAin: q(20, 'cm²'), CdAout: q(20, 'cm²'), CdAout2: q(1, 'cm²'),
      switchBy: 'dP', switchDP: q(0.1, 'bar'), switchFlow: q(0.1, 'kg/s'),
      Popen: q(null, 'kgf/cm²(g)'), Tair: q(null, '°C'), mAir0: q(0, 'kg'), pipeK: {},
    }),

    validate() {},

    buildNode: (j, net, z) => net.addNode({ z, jid: j.id }),

    // water hammer: its own boundary, no table
    surge: {
      quantities: () => [],
      boundary: (j, ctx) => SD().airValve(j, ctx),
      validate: (j, miss, v) => SD().validateAirValve(j, miss, v),
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
