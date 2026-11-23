// Relief valve: a discharge from a node to an outside pressure, which opens when the pressure of the node passes its set
// pressure (§6.3 of the specification of the water hammer, docs/water-hammer.md). With one pipe it is a relief at the end
// of a line; with two, a relief in the line. In the steady state it is closed: a node without losses. Its data for the
// transient are read by the water hammer only (src/core/surge/devices.js), and the type is offered while that module
// is in the page.
(function (root) {
  const PumpIt = root.PumpIt;
  const q = PumpIt.model.q;
  const SD = () => PumpIt.surge && PumpIt.surge.devices;

  PumpIt.junctionTypes.register({
    type: 'reliefValve', order: 140, group: 'protection',
    pipes: [1, 2], multi: true,
    lossModels: ['Cv', 'Kv', 'CdA'],
    offered: () => !!SD(),

    defaults: () => ({
      mode: 'pressure', Pset: q(10, 'kgf/cm²(g)'), Pfull: q(11, 'kgf/cm²(g)'), Pclose: q(null, 'kgf/cm²(g)'),
      lossModel: 'Cv', Cv: 100, Kv: 86, CdA: q(10, 'cm²'), Pext: q(0, 'kgf/cm²(g)'), rate: null, pipeK: {},
    }),

    validate() {},

    buildNode: (j, net, z) => net.addNode({ z, jid: j.id }),

    // water hammer: its own boundary; a table of its opening makes it a pilot valve (§8.2)
    surge: {
      quantities: () => [{
        what: 'open', cat: 'percent', min: 0, noNegative: true, range: [0, 100], steady: () => 0,
        apply() {},
      }],
      boundary: (j, ctx) => SD().reliefValve(j, ctx),
      validate: (j, miss, v) => SD().validateRelief(j, miss, v),
    },

    // its state, for the conditions of the events of the water hammer (open or closed); always closed in a steady state
    time: {
      states: ['open', 'closed'],
      stateOf: (jc, sol) => (sol && sol.states && sol.states[jc.id]) || 'closed',
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
