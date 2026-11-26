// Stateful devices (specification section 7). After each hydraulic convergence the solver reviews the
// device states; if any changes, the network is solved again. A link opts in by carrying a `device`
// object provided by its junction type:
//   device.initial(lk)                          → initial state
//   device.resume(lk, state)                    → optional: the state to start from when one is given (the state of the
//                                                 step before, in the time simulation); without it, the given state
//   device.configure(lk, state)                 → sets the link mode for that state
//   device.review(lk, sol, states, next, env)   → writes the next state into `next`
//   device.anyway                               → optional: reviewed also after a solution that did not converge (check
//                                                 valves, whose closing can be what lets it converge)
// The state of a device is kept under the id of its junction, or under lk.stateKey when the link has one (a pipe with an
// end above the liquid of a reservoir: 'P' + its id, src/core/solver/network.js).
(function (root) {
  const PumpIt = root.PumpIt;

  const keyOf = (lk) => (lk.stateKey !== undefined ? lk.stateKey : lk.jid);

  // given: states to start from (opts.states of the solver), by key
  function initialStates(prep, given) {
    const st = {};
    for (const lk of prep.links) {
      if (!lk.device) continue;
      const k = keyOf(lk), s = given ? given[k] : undefined;
      st[k] = s === undefined ? lk.device.initial(lk) : lk.device.resume ? lk.device.resume(lk, s) : s;
    }
    return st;
  }

  function configure(prep, st) {
    for (const lk of prep.links) if (lk.device) lk.device.configure(lk, st[keyOf(lk)]);
  }

  // anyway: only the devices reviewed after a solution that did not converge
  function review(prep, sol, st, anyway) {
    const next = Object.assign({}, st);
    for (const lk of prep.links) {
      if (!lk.device || lk.isolated || (anyway && !lk.device.anyway)) continue;
      lk.device.review(lk, sol, st, next, prep.env);
    }
    return next;
  }

  PumpIt.solver = Object.assign(PumpIt.solver || {}, { initialStates, configure, review });
})(typeof window !== 'undefined' ? window : globalThis);
