// Unbalanced forces of the water hammer (phase G3; decision G3-11 of the addendum of its specification): the axial force
// of the liquid on the pipes, from the balance of momentum of a control volume (Thorley, 2004; Wylie, Streeter and Suo,
// 1993). A force set of the control (solution.surge.forces) is one of:
//
//   segment  between two stations, in one pipe or in pipes in sequence (the path with the fewest pipes between them,
//            as the profile takes): the force on the two bends at its ends and the straight run between them, positive
//            from a to b:
//              F = [(p_b − p_amb)·A_b + ṁ_b²/(ρ·A_b)] − [(p_a − p_amb)·A_a + ṁ_a²/(ρ·A_a)] + Σ F_friction + Σ F_junction
//            with ṁ_a and ṁ_b the flows on the side of the segment at a and b, F_friction = A·R·m̄_s·|m̄_s| of each section
//            (m̄_s the mean of the flows of its two stations, in the direction of the path; R of the section, or of its
//            station on the up side with a friction that varies) and F_junction the same pair of terms of the inlet minus
//            that of the outlet of each junction in line. Summing it piece by piece along the path gives the junctions too.
//            In a steady state on a horizontal path it is zero; it equals −dM/dt, M = ∫ṁ·dx over the segment
//   point    (p − p_amb)·A + ṁ²/(ρ·A) at a station, in the direction of its pipe
//   exit     the segment from a to the last station of the pipe that discharges, minus ṁ²/(ρ·A_s) of the jet (A_s: its
//            area, by default that of the pipe)
//
// p is the static pressure, P − m̄²/(2ρA²) with the mean of the two flows of the station; p_amb the atmospheric pressure or
// one given per set. The weight of the liquid enters only through the hydrostatic pressure. A station is given by its pipe
// and its distance from the up end, rounded to the nearest station (half up).
(function (root) {
  const PumpIt = root.PumpIt;
  const U = PumpIt.units;
  const { t } = PumpIt.i18n;
  const SI = () => PumpIt.surge.inputs;

  const isQty = (v) => !!(v && typeof v === 'object' && 'value' in v && 'unit' in v);
  const lengthOk = (x) => isQty(x) && Number.isFinite(x.value) && x.value >= 0 && U.has('length', x.unit);
  const pipeLength = (p) => (isQty(p.length) && Number.isFinite(p.length.value) && U.has('length', p.length.unit) ? U.toSI(p.length.value, p.length.unit, 'length') : NaN);

  // the station of a distance x (m) from the up end of a pipe of n sections and length L: the nearest, half up
  const stationOf = (x, L, n) => Math.min(n, Math.max(0, Math.floor((x / L) * n + 0.5)));

  // the path between two different pipes A and B of a model: leaving A by one of its ends, through the fewest pipes,
  // entering B by one of its ends. → { leaveFwd (A left by its down end), enterFwd (B entered by its up end), mid: [{ pipe,
  // fwd }] } or null. Ties go to the first of: A by its down end, then by its up end; B by its up end, then by its down end
  function pathOf(eff, A, B) {
    const adj = new Map();
    const add = (j, x) => { if (!adj.has(j)) adj.set(j, []); adj.get(j).push(x); };
    for (const p of eff.pipes) {
      if (p.closed || p.id === A.id || p.id === B.id) continue;
      add(p.up, [p, p.down, true]);
      add(p.down, [p, p.up, false]);
    }
    const bfs = (a, b) => {
      if (a === b) return [];
      const prev = new Map([[a, null]]), queue = [a];
      while (queue.length) {
        const u = queue.shift();
        if (u === b) break;
        for (const [p, v, fwd] of adj.get(u) || []) {
          if (prev.has(v)) continue;
          prev.set(v, [u, p, fwd]);
          queue.push(v);
        }
      }
      if (!prev.has(b)) return null;
      const out = [];
      for (let v = b; prev.get(v); v = prev.get(v)[0]) out.unshift({ pipe: prev.get(v)[1], fwd: prev.get(v)[2] });
      return out;
    };
    let best = null;
    for (const [ja, leaveFwd] of [[A.down, true], [A.up, false]]) {
      for (const [jb, enterFwd] of [[B.up, true], [B.down, false]]) {
        const mid = bfs(ja, jb);
        if (mid && (!best || mid.length < best.mid.length)) best = { leaveFwd, enterFwd, mid };
      }
    }
    return best;
  }

  // what is wrong with a force set, as keys (an empty list: complete). The checklist names them all in one item
  function check(eff, f) {
    const out = [];
    if (!f || typeof f !== 'object') return ['set'];
    if (!SI().FORCE_KINDS.includes(f.kind)) return ['kind'];
    const pipeOf = (o) => (o && eff.pipes.find((p) => p.id === o.pipe)) || null;
    const A = pipeOf(f.a);
    if (!A || A.closed) out.push('pipe');
    else if (!lengthOk(f.a.x) || U.toSI(f.a.x.value, f.a.x.unit, 'length') > pipeLength(A) * (1 + 1e-9)) out.push('distance');
    if (f.kind !== 'point') {
      const B = pipeOf(f.b);
      if (!B || B.closed) out.push('pipe');
      else {
        if (f.kind === 'segment' && (!lengthOk(f.b.x) || U.toSI(f.b.x.value, f.b.x.unit, 'length') > pipeLength(B) * (1 + 1e-9))) out.push('distance');
        if (A && !A.closed && A.id !== B.id && !pathOf(eff, A, B)) out.push('path');
      }
    }
    if (f.ambient === 'given' && !(isQty(f.pamb) && Number.isFinite(f.pamb.value) && U.has('pressure', f.pamb.unit))) out.push('ambient');
    if (f.kind === 'exit' && f.As && f.As.value !== null && f.As.value !== undefined && f.As.value !== '' && !(isQty(f.As) && f.As.value > 0 && U.has('area', f.As.unit))) out.push('area');
    return [...new Set(out)];
  }

  // the force sets of a run: each with value() at the state of the network after a step, and describe()
  function prepare(net, sets) {
    const rho = net.env.rho, eff = net.eff;
    return sets.map((f, k) => {
      const name = typeof f.name === 'string' && f.name.trim() ? f.name.trim() : 'F' + (k + 1);
      const bad = check(eff, f);
      if (bad.length) throw new Error(t('surge.error.force', { name }));
      const mocOf = (id) => {
        const p = net.pipes.get(id);
        if (!p) throw new Error(t('surge.error.forcePipe', { name, id }));
        return p;
      };
      const effOf = (id) => eff.pipes.find((p) => p.id === id);
      const at = (o) => { const p = mocOf(o.pipe); return { p, i: stationOf(U.toSI(o.x.value, o.x.unit, 'length'), p.L, p.n) }; };
      const pamb = f.ambient === 'given' ? net.si(f.pamb, 'pressure') : net.env.patm;
      const a = at(f.a);
      // the pieces of the path: a pipe, its first and last stations, and its direction along the path
      const pieces = [];
      let b = null;
      if (f.kind === 'segment' || f.kind === 'exit') {
        const pb = mocOf(f.b.pipe);
        b = f.kind === 'exit' ? { p: pb, i: pb.n } : at(f.b);
        if (a.p === b.p) pieces.push({ p: a.p, s: a.i, e: b.i, dir: b.i >= a.i ? 1 : -1 });
        else {
          const path = pathOf(eff, effOf(a.p.id), effOf(b.p.id));
          pieces.push({ p: a.p, s: a.i, e: path.leaveFwd ? a.p.n : 0, dir: path.leaveFwd ? 1 : -1 });
          for (const x of path.mid) { const p = mocOf(x.pipe.id); pieces.push({ p, s: x.fwd ? 0 : p.n, e: x.fwd ? p.n : 0, dir: x.fwd ? 1 : -1 }); }
          pieces.push({ p: b.p, s: path.enterFwd ? 0 : b.p.n, e: b.i, dir: path.enterFwd ? 1 : -1 });
        }
      }
      const As = f.kind === 'exit' ? (isQty(f.As) && f.As.value > 0 ? net.si(f.As, 'area') : b.p.A) : NaN;
      // the pressure and momentum term of a station with the flow m on one side
      const term = (p, i, m) => {
        const mm = (p.mU[i] + p.mD[i]) / 2, A = p.A;
        return (p.P[i] - mm * mm / (2 * rho * A * A) - pamb) * A + m * m / (rho * A);
      };
      const piece = (x) => {
        const p = x.p, s = x.s, e = x.e, d = x.dir, mU = p.mU, mD = p.mD, A = p.A, Rs = p.Rs, R = p.R;
        // the flows on the side of the piece at its first and last stations
        const m0 = d > 0 ? mD[s] : mU[s], m1 = d > 0 ? mU[e] : mD[e];
        let F = term(p, e, m1) - term(p, s, m0);
        const lo = Math.min(s, e), hi = Math.max(s, e);
        for (let i = lo; i < hi; i++) {
          const ms = (mD[i] + mU[i + 1]) / 2;
          F += A * (Rs ? Rs[i] : R) * d * ms * Math.abs(ms);
        }
        return F;
      };
      let value;
      if (f.kind === 'point') value = () => term(a.p, a.i, (a.p.mU[a.i] + a.p.mD[a.i]) / 2);
      else {
        const jet = f.kind === 'exit';
        value = () => {
          let F = 0;
          for (const x of pieces) F += piece(x);
          if (jet) { const m = b.p.mD[b.p.n]; F -= m * m / (rho * As); }
          return F;
        };
      }
      const where = (o) => (o ? { pipe: o.p.id, i: o.i, x: o.p.L * o.i / o.p.n } : null);
      return { value, describe: () => ({ name, kind: f.kind, a: where(a), b: where(b), pamb, As: f.kind === 'exit' ? As : NaN, path: pieces.map((x) => x.p.id) }) };
    });
  }

  PumpIt.surge = Object.assign(PumpIt.surge || {}, { forces: { stationOf, pathOf, check, prepare } });
})(typeof window !== 'undefined' ? window : globalThis);
