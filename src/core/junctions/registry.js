// Junction type registry.
//
// Every junction type lives in its own file under src/core/junctions/ and registers one definition here;
// its interface side (symbol, inspector form, summaries, result rows) lives under src/ui/junctions/. Adding a
// type means adding those two files and their <script> tags in index.html — no other file has to change.
// Helpers shared by several types are in junctions/shared.js (PumpIt.junctionTypes.shared).
//
// Definition contract (core):
//   type, order                 id and display order (palette, type selector)
//   group                       palette group: 'boundary' | 'connection' | 'equipment' | 'valves' | 'losses' | 'protection'
//   label                       name shown in the UI; read from the language catalogs (junctions.<type>.label)
//   offered()                   optional: whether the palette and the type selector offer the type (the protection devices
//                               of the water hammer, while that module is in the page); a model that has one keeps it
//   pipes: [min, max]           accepted number of connected pipes
//   multi                       true: one network node; false: an element between an inlet and an outlet node
//   directional                 two-port only: one pipe must arrive and the other leave
//   ref                         the junction can act as a pressure reference
//   defaults()                  → type-specific fields of a new junction
//   validate(j, miss, v)        pushes missing-input texts (from the catalogs); v = { fin, pos, curveOk, pipeCount, gas,
//                               gasP }: gas, the model is compressible; gasP(x, key), a pressure the gas takes must be
//                               above vacuum (key: the catalog name of the field)
//   pipeEndElevation(j, pk, si) optional; elevation (m) where a pipe connects (undefined = junction elevation)
//   buildNode(j, net, z)        multi: creates the node (and any discharge link) through the network builder
//   buildElement(j, lk, net)    two-port: fills the element link (loss function, modes, device behaviour)
//   nodeResults(j, jr, rc)      multi, optional: adds type-specific results (before HGL and isolation masking)
//   elementResults(j, jr, rc)   two-port, optional: adds pump/valve results and warnings
//   reverseFlowCaution          two-port: caution when the flow runs against the reference direction (default true)
//   gas                         compressible mode (src/core/gas/); without it the type is refused in that mode:
//     node(j, net, z)           multi: creates the node of the gas network (and any discharge link)
//     element(j, lk, net)       two-port: fills the element link of the gas network (relation, modes, device)
//     results(j, jr, rc)        optional: type-specific results in the compressible mode
//   time                        time simulation (docs/time-simulation.md); without it a junction has no time data:
//     quantities(j, ctx)        optional (without it, no time data); ctx = { gas: the compressible mode }: what a table can drive in the current mode of the junction: [{ what, cat (unit category
//                               of the values), min (domain of an extrapolation), steady(j, si) (the steady value in SI,
//                               base of the relative tables), apply(jc, v) (writes v, in SI, into the copy of a step),
//                               space (optional: { to, from }, where the table is interpolated), noNegative (a table
//                               may not hold negative values) }]
//     results                   'pumps' | 'valves': the result table of the junction (conditions on pumps and valves)
//     states, stateOf(jc, sol)  the states a condition can test, and the state of the junction in a step
//     log                       the catalog group of its changes of state in the event log (core.time.log.<log>.<state>)
//     isOn(jc)                  a pump: running in a step (starts, time running, energy)
//     isClosed(jc)              a valve: closed in a step (the event log)
//     opening(j)                a valve whose opening (%) its results give (conditions on the opening)
//     checkOf(jc, sol)          a pump with a check valve: 'open' or 'closed' in a step (the event log)
//     tank                      a reservoir that may be a finite tank (j.tank) or, in the compressible mode, a finite gas
//                               vessel (j.vessel); conditions on levels, volumes and surface pressures
//     imposedFlow               an imposed flow or source: the volume delivered and the one left without supply
//   surge                       water hammer (src/core/surge/, docs/water-hammer.md); optional: without it a junction takes
//                               the generic boundary of its shape, a node (fixed or free, with its discharges) or an element
//                               with the loss law, the modes and the device of the steady state, and the quantities of its
//                               time hook:
//     quantities(j)             what a table of the water hammer can drive (as time.quantities; [] for none)
//     boundary(j, ctx)          the boundary object of the junction, instead of the generic one (src/core/surge/boundaries.js)
//     validate(j, miss, v)      its own fields of the water hammer; v = { fin, pos, curveOk, data (its j.surge, in use) }
//     outflowOnly               a discharge to the outside that takes no liquid in (a nozzle)
//     frozen(j)                 a control device that keeps the loss of its steady state instead of controlling
//     reopens                   a device closed by its special condition may open in the transient: the state it starts in
//
// Network links may carry, for the solver stages:
//   phi(m), mref                pressure loss function and flow scale (mode 'loss')
//   mode, value                 'loss' | 'closed' | 'fixedFlow' | 'pDown' | 'pUp' | 'dP' and its set value
//   controlMode                 mode used while a control device is controlling
//   device                      state machine of a control device (see solver/devices.js)
//   Hof(Q)                      head curve; its shutoff head enters the pressure scale
//   m0                          initial mass flow of a discharge link
(function (root) {
  const PumpIt = root.PumpIt;

  const defs = new Map();
  let table = null;

  function register(def) {
    if (!def || !def.type) throw new Error('A junction type definition needs a "type".');
    if (!Object.getOwnPropertyDescriptor(def, 'label')) {
      Object.defineProperty(def, 'label', { get: () => PumpIt.i18n.t('junctions.' + def.type + '.label'), enumerable: true });
    }
    defs.set(def.type, def);
    table = null;
  }
  const get = (type) => defs.get(type);
  const list = () => [...defs.values()].sort((a, b) => a.order - b.order);

  // { type: definition } in display order — what the rest of the app reads as PumpIt.model.JT
  function asTable() {
    if (!table) {
      table = {};
      for (const d of list()) table[d.type] = d;
    }
    return table;
  }

  PumpIt.junctionTypes = { register, get, list, table: asTable };
})(typeof window !== 'undefined' ? window : globalThis);
