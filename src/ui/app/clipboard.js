// Copy and paste (Ctrl+C / Ctrl+V). Copies the selected junctions, the end junctions of the selected pipes and
// the pipes between them, with the effective values of the current scenario; a selected pipe with a loose end goes
// with its loose spot (docs/pipe-ends.md). Each paste is shifted a little, and the conditions of the pasted junctions
// watch the copies of the objects they watched. The named events that the copied junctions start with ('combined'),
// and the events those lead to, go with the copy (review of c3b3ec4, item 2).
(function (root) {
  const PumpIt = root.PumpIt;
  const M = PumpIt.model;
  const app = PumpIt.app;
  const { toast } = PumpIt.ui.dialogs;
  const { t } = PumpIt.i18n;

  app.copySelection = () => {
    if (!app.selSet.size) { toast(t('app.clipboard.selectFirst')); return; }
    const eff = app.eff();
    const jIds = new Set([...app.selSet].filter((k) => k[0] === 'j').map((k) => Number(k.slice(2))));
    const picked = new Set([...app.selSet].filter((k) => k[0] === 'p').map((k) => Number(k.slice(2))));
    for (const p of eff.pipes) if (picked.has(p.id)) for (const end of M.PIPE_ENDS) if (!M.isLoose(p, end)) jIds.add(p[end]);
    const junctions = eff.junctions.filter((j) => jIds.has(j.id));
    const pipes = eff.pipes.filter((p) => M.PIPE_ENDS.every((end) => (M.isLoose(p, end) ? picked.has(p.id) : jIds.has(p[end]))));
    const events = namedOfCopy(eff, junctions);
    app.clipboard = { junctions: M.clone(junctions), pipes: M.clone(pipes), events: M.clone(events), pastes: 0 };
    try { navigator.clipboard.writeText(JSON.stringify({ pumpit: 1, junctions, pipes, events })).catch(() => {}); } catch (e) { /* internal clipboard only */ }
    toast(t('app.clipboard.copied', { junctions: junctions.length, pipes: pipes.length }));
  };

  // The conditions of the time data and of the water hammer data of a pasted junction follow the objects they watch
  // when those were copied with it: P1 copied as P4 makes a condition on P1 watch P4. A condition on an object left out
  // of the copy keeps watching it, as it did in the model it came from.
  const CONDITIONS = ['time', 'surge'];
  function retarget(j, jMap, pMap) {
    const map = keyMap(jMap, pMap);
    for (const f of CONDITIONS) {
      const d = j[f];
      if (!d || typeof d !== 'object' || !Array.isArray(d.when)) continue;
      for (const c of d.when) if (c && typeof c === 'object') retargetCondition(c, jMap, pMap, map);
    }
  }
  function retargetCondition(c, jMap, pMap, map = keyMap(jMap, pMap)) {
    for (const k of ['obj', 'obj2']) if (k in c) c[k] = map(c[k]);
  }
  const keyMap = (jMap, pMap) => (key) => {
    if (typeof key !== 'string') return key;
    const id = Number(key.slice(2));
    if (key.startsWith('p:') && pMap.has(id)) return 'p:' + pMap.get(id);
    if (key.startsWith('j:') && jMap.has(id)) return 'j:' + jMap.get(id);
    return key;
  };

  // the named events a set of junctions starts with, and every event those lead to, once each, in the order of the model
  const CONDITIONS_NAMED = ['time', 'surge'];
  const eventsOf = (m) => (Array.isArray(m.events) ? m.events : []);
  const findEvent = (m, name) => eventsOf(m).find((e) => e && e.name === name) || null;
  function namedOfCopy(eff, junctions) {
    const names = new Set();
    const add = (name) => {
      const e = findEvent(eff, name);
      if (!e || names.has(name)) return;
      names.add(name);
      if (Array.isArray(e.of)) e.of.forEach(add);
    };
    for (const j of junctions) for (const f of CONDITIONS_NAMED) {
      const d = j[f];
      if (d && typeof d === 'object' && d.start === 'combined' && typeof d.combined === 'string') add(d.combined);
    }
    return eventsOf(eff).filter((e) => names.has(e.name));
  }
  // a definition compared whatever the order of its keys and its name
  const canon = (v) => (Array.isArray(v) ? '[' + v.map(canon).join(',') + ']'
    : v && typeof v === 'object' ? '{' + Object.keys(v).filter((k) => k !== 'name').sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}'
      : JSON.stringify(v));
  // the copied events in the model: their conditions watch the copies of their objects, as the conditions of the
  // junctions do; an event of the model with the same name and the same definition is used as it is, a name the model
  // lacks is added, and a name the model gives to another definition is added under a free name, "Name (2)". Gives the
  // name of each copied event in the model, and the names added and renamed (for the note of the paste)
  function placeEvents(list, jMap, pMap) {
    const byName = new Map(list.map((e) => [e.name, e]));
    const names = new Map(), added = [], renamed = [];
    if (!Array.isArray(app.model.events)) app.model.events = [];
    const place = (name, path = new Set()) => {
      if (names.has(name)) return names.get(name);
      const e0 = byName.get(name);
      if (!e0 || path.has(name)) return name;
      path.add(name);
      const e = M.clone(e0);
      if (e.cond && typeof e.cond === 'object') retargetCondition(e.cond, jMap, pMap);
      if (Array.isArray(e.of)) e.of = e.of.map((n) => place(n, path));
      path.delete(name);
      const def = canon(e);
      let k = 1, out = name;
      for (;;) {
        out = k === 1 ? name : `${name} (${k})`;
        const there = findEvent(app.model, out);
        if (!there) { e.name = out; app.model.events.push(e); added.push(out); if (out !== name) renamed.push([name, out]); break; }
        if (canon(there) === def) break;
        k++;
      }
      names.set(name, out);
      return out;
    };
    list.forEach((e) => place(e.name));
    return { names, added, renamed };
  }

  app.paste = () => {
    const cb = app.clipboard;
    if (!cb || !(cb.junctions.length || cb.pipes.length)) { toast(t('app.clipboard.empty')); return; }
    app.pushUndo();
    cb.pastes++;
    const off = 40 * cb.pastes;
    const jMap = new Map(), pMap = new Map();
    for (const j of cb.junctions) jMap.set(j.id, app.model.nextId.j++);
    for (const p of cb.pipes) pMap.set(p.id, app.model.nextId.p++);
    const placed = placeEvents(cb.events || [], jMap, pMap);
    const keys = [];
    for (const j0 of cb.junctions) {
      const j = M.clone(j0);
      j.id = jMap.get(j0.id); j.x += off; j.y += off;
      if (j.pipeK) j.pipeK = Object.fromEntries(Object.entries(j.pipeK).filter(([pid]) => pMap.has(Number(pid))).map(([pid, v]) => [pMap.get(Number(pid)), v]));
      retarget(j, jMap, pMap);
      for (const f of CONDITIONS_NAMED) {
        const d = j[f];
        if (d && typeof d === 'object' && typeof d.combined === 'string' && placed.names.has(d.combined)) d.combined = placed.names.get(d.combined);
      }
      app.model.junctions.push(j);
      keys.push('j:' + j.id);
    }
    for (const p0 of cb.pipes) {
      const p = M.clone(p0);
      p.id = pMap.get(p0.id);
      for (const end of M.PIPE_ENDS) p[end] = M.isLoose(p0, end) ? null : jMap.get(p0[end]); // its route follows the new ends
      if (p.loose) for (const s of Object.values(p.loose)) { s.x += off; s.y += off; }
      app.model.pipes.push(p);
      keys.push('p:' + p.id);
    }
    app.selSet = new Set(keys);
    app.sel = app.hitOf(keys[0]);
    app.changed();
    const moved = new Set(placed.renamed.map(([, b]) => b)), plain = placed.added.filter((n) => !moved.has(n));
    let note = '';
    if (plain.length) note += ' ' + t('app.clipboard.eventsAdded', { list: plain.map((n) => `"${n}"`).join(', ') });
    if (placed.renamed.length) note += ' ' + t('app.clipboard.eventsRenamed', { list: placed.renamed.map(([a, b]) => `"${a}" → "${b}"`).join(', ') });
    toast(t('app.clipboard.pasted', { junctions: cb.junctions.length, pipes: cb.pipes.length }) + note);
  };
})(window);
