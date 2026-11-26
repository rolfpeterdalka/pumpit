// Scenarios: the base scenario defines everything; each child stores only what differs from its parent
// (specification section 2). Changes flow down to descendants that did not override the attribute.
(function (root) {
  const PumpIt = root.PumpIt;
  const M = PumpIt.model;

  const scen = (m, sid) => m.scenarios.list.find((s) => s.id === sid);
  function chain(m, sid) {
    const out = [];
    for (let s = scen(m, sid); s; s = s.parent ? scen(m, s.parent) : null) out.unshift(s);
    return out;
  }

  // effective model of a scenario: a copy of the base with the overrides applied from the root to the leaf
  function effective(m, sid) {
    // the named events of the time simulation belong to the model, the same in every scenario (§5.4 of its specification)
    const e = M.clone({ system: m.system, solution: m.solution, pipes: m.pipes, junctions: m.junctions, title: m.title, events: m.events || [] });
    for (const s of chain(m, sid)) {
      const keys = Object.keys(s.overrides).sort((a, b) => a.length - b.length);
      for (const k of keys) {
        const [objKey, path] = k.split('|');
        const o = M.getObj(e, objKey);
        if (o) M.setPath(o, path, M.clone(s.overrides[k]));
      }
      if (s.parent) exclusiveMode(s, e);
    }
    return e;
  }

  // The mode of calculation of a scenario is one choice: the time simulation (sol|time.on) or the water hammer
  // (sol|surge.on), never both (decision W-19). A scenario that turns one on turns the other off at its own level, so
  // that its choice holds whatever its parent chooses later; a scenario that sets both on is left as it is (the
  // checklist tells). The base is what it is.
  const MODE = { 'time.on': 'surge.on', 'surge.on': 'time.on' };
  function modeSet(s, what) {
    if (('sol|' + what + '.on') in s.overrides) return s.overrides['sol|' + what + '.on'];
    const b = s.overrides['sol|' + what];
    return b && typeof b === 'object' ? b.on : undefined;
  }
  function exclusiveMode(s, e) {
    const tOn = modeSet(s, 'time'), sOn = modeSet(s, 'surge'), sol = e.solution;
    if (tOn === true && sOn !== true && sol.surge && typeof sol.surge === 'object') sol.surge.on = false;
    if (sOn === true && tOn !== true && sol.time && typeof sol.time === 'object') sol.time.on = false;
  }

  function effValue(m, sid, objKey, path) {
    const o = M.getObj(effective(m, sid), objKey);
    return o ? M.getPath(o, path) : undefined;
  }

  // a block of fields: a plain object, not a quantity { value, unit } nor a list
  const isBlock = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && !('value' in v && 'unit' in v);

  // An override of a whole block (objKey|path) split into overrides of the fields of the block that differ from the
  // parent: the scenario sees the same model, and the fields it did not change follow the parent again. Not possible
  // when the block or the parent's is not a block of fields, or when the parent has a field the override lacks (it would
  // come back); returns whether it was split.
  function splitBlock(m, s, objKey, path) {
    const k = objKey + '|' + path;
    const mine = effValue(m, s.id, objKey, path), theirs = effValue(m, s.parent, objKey, path);
    if (!isBlock(mine) || !isBlock(theirs) || Object.keys(theirs).some((f) => !(f in mine))) return false;
    for (const ok of Object.keys(s.overrides)) if (ok === k || ok.startsWith(k + '.')) delete s.overrides[ok];
    for (const f of Object.keys(mine)) if (!M.deepEqual(mine[f], theirs[f])) s.overrides[k + '.' + f] = M.clone(mine[f]);
    return true;
  }
  // the overrides of whole blocks above a field (objKey|a for objKey|a.b.c, then objKey|a.b), split down to the field;
  // returns false when one of them cannot be
  function splitAbove(m, s, objKey, path) {
    const ps = path.split('.');
    for (let n = 1; n < ps.length; n++) {
      const up = ps.slice(0, n).join('.');
      if ((objKey + '|' + up) in s.overrides && !splitBlock(m, s, objKey, up)) return false;
    }
    return true;
  }

  // edit: equal to the inherited value = relink to the parent; different = break the link of that attribute only
  function setField(m, sid, objKey, path, value) {
    const s = scen(m, sid);
    if (!s.parent) {
      const o = M.getObj(m, objKey);
      M.setPath(o, path, M.clone(value));
      return;
    }
    const k = objKey + '|' + path;
    // a field of a block the scenario overrides as a whole: the block first becomes overrides of its own fields
    const split = splitAbove(m, s, objKey, path);
    // more specific overrides of this scenario inside the path no longer apply
    for (const ok of Object.keys(s.overrides)) if (ok.startsWith(k + '.')) delete s.overrides[ok];
    const inherited = effValue(m, s.parent, objKey, path);
    // (a block that could not be split still holds the field: the value stays an override of its own)
    if (split && M.deepEqual(inherited, value)) delete s.overrides[k];
    else s.overrides[k] = M.clone(value);
  }

  // (the two switches of the mode of calculation are one choice: either marks both)
  function isOverridden(m, sid, objKey, path, unit = true) {
    const s = scen(m, sid);
    if (!s || !s.parent) return false;
    const k = objKey + '|' + path;
    if (unit && objKey === 'sol' && MODE[path] && isOverridden(m, sid, objKey, MODE[path], false)) return true;
    return Object.keys(s.overrides).some((ok) => ok === k || ok.startsWith(k + '.') || k.startsWith(ok + '.'));
  }
  // the value of the parent back. A field of a block the scenario overrides as a whole: the block is split first, so
  // that only that field follows the parent (a block that cannot be split takes the parent's value of the field)
  function clearOverride(m, sid, objKey, path, unit = true) {
    const s = scen(m, sid);
    if (!s || !s.parent) return;
    // the mode of calculation comes back whole: both switches follow the parent again
    if (unit && objKey === 'sol' && MODE[path]) clearOverride(m, sid, objKey, MODE[path], false);
    const k = objKey + '|' + path;
    const split = splitAbove(m, s, objKey, path);
    for (const ok of Object.keys(s.overrides)) if (ok === k || ok.startsWith(k + '.')) delete s.overrides[ok];
    if (!split) s.overrides[k] = M.clone(effValue(m, s.parent, objKey, path));
  }

  // A file written before the fields of these blocks were saved one by one: the overrides of a whole block of the
  // friction of a pipe or of the losses at the pipes of a junction become overrides of the fields that differ from the
  // parent, from the base to the leaves; no effective value changes.
  const SPLIT_ON_LOAD = /^(friction|pipeK|pipeK\.[^.]+)$/;
  function splitBlocksOnLoad(m) {
    const order = [];
    const walk = (id) => m.scenarios.list.filter((s) => s.parent === id).forEach((s) => { order.push(s); walk(s.id); });
    for (const r of m.scenarios.list.filter((s) => !s.parent)) walk(r.id);
    for (const s of order) {
      if (!s.overrides) continue;
      const keys = Object.keys(s.overrides).filter((k) => SPLIT_ON_LOAD.test(k.split('|')[1] || '')).sort((a, b) => a.length - b.length);
      for (const k of keys) if (k in s.overrides) { const [objKey, path] = k.split('|'); splitBlock(m, s, objKey, path); }
    }
  }

  function removeObjectOverrides(m, objKey) {
    for (const s of m.scenarios.list) {
      for (const k of Object.keys(s.overrides)) if (k.split('|')[0] === objKey) delete s.overrides[k];
    }
  }

  function addScenario(m, parentId, name) {
    let n = 1;
    while (m.scenarios.list.some((s) => s.id === 's' + n)) n++;
    const s = { id: 's' + n, name, parent: parentId, overrides: {}, notes: '' };
    m.scenarios.list.push(s);
    return s;
  }
  function descendants(m, sid) {
    const out = [];
    const walk = (id) => m.scenarios.list.filter((s) => s.parent === id).forEach((s) => { out.push(s.id); walk(s.id); });
    walk(sid);
    return out;
  }
  // Fields set in a scenario while every descendant keeps what it sees: measure(obj) gives, for the object as a
  // scenario sees it, the values that must not move (NaN where unknown); keep(obj, i, v) gives the [path, value] pairs
  // that put value i back to v in a descendant whose value moved. A descendant that inherits everything follows the
  // scenario as before, since its values move with it only when they were the scenario's own.
  function setKeeping(m, sid, objKey, pairs, measure, keep) {
    const desc = descendants(m, sid);
    const seen = (id) => { const o = M.getObj(effective(m, id), objKey); return o ? measure(o) : []; };
    const before = desc.map(seen);
    for (const [path, v] of pairs) setField(m, sid, objKey, path, v);
    desc.forEach((id, n) => {
      const o = M.getObj(effective(m, id), objKey);
      if (!o) return;
      measure(o).forEach((v, i) => {
        const was = before[n][i];
        if (Number.isFinite(was) && !(Math.abs(v - was) <= 1e-9 * Math.max(1, Math.abs(was)))) {
          for (const [path, value] of keep(o, i, was)) setField(m, id, objKey, path, value);
        }
      });
    });
  }
  function deleteScenario(m, sid) {
    const s = scen(m, sid);
    if (!s || !s.parent) return false;
    const kill = new Set([sid, ...descendants(m, sid)]);
    m.scenarios.list = m.scenarios.list.filter((x) => !kill.has(x.id));
    if (kill.has(m.scenarios.current)) m.scenarios.current = s.parent;
    return true;
  }

  Object.assign(M, {
    chain, effective, effValue, setField, isOverridden, clearOverride, splitBlocksOnLoad, removeObjectOverrides,
    addScenario, deleteScenario, descendants, setKeeping,
  });
})(typeof window !== 'undefined' ? window : globalThis);
