// Pipes of a catalogue across scenarios (decisions P-09 to P-11 of docs/pipe-library.md). A pipe whose material is of
// a catalogue (src/core/data/pipe-library.js) has the circular section and the bore of its nominal size and series, in
// every scenario. A scenario that only inherits that material keeps the section it had of its own as a dormant one
// (scenario.parked), which comes back once the material it sees is user-defined again.
(function (root) {
  const PumpIt = root.PumpIt;
  const M = PumpIt.model;
  const D = () => PumpIt.data;

  const scen = (m, sid) => m.scenarios.list.find((s) => s.id === sid);
  const pipeIn = (m, sid, key) => M.getObj(M.effective(m, sid), key);
  const isCatalogue = (mat) => !!mat && D().PIPE_KINDS.includes(mat.kind);
  // the bore of a catalogue material, in mm rounded to 0.01 mm as the diameter field holds it (P-05), or NaN
  function catalogueBore(mat) {
    const d = isCatalogue(mat) && D().pipeDims(mat);
    return d ? +d.id.toFixed(2) : NaN;
  }
  // a geometry that is the one the catalogue gives the material
  function fitsCatalogue(g, mat) {
    const b = catalogueBore(mat);
    if (!g || g.kind !== 'circular' || !g.d || !Number.isFinite(g.d.value) || !Number.isFinite(b)) return false;
    return Math.abs(PumpIt.units.toSI(g.d.value, g.d.unit, 'length') * 1000 - b) < 0.005;
  }

  // the overrides of a scenario on a field and inside it (key|geometry, key|geometry.d, ...)
  const ownKeys = (s, key, path) => Object.keys(s.overrides).filter((k) => k === key + '|' + path || k.startsWith(key + '|' + path + '.'));

  // the section a scenario holds of its own goes dormant: its overrides move to scenario.parked
  function park(m, sid, key) {
    const s = scen(m, sid);
    const ks = s && s.parent ? ownKeys(s, key, 'geometry') : [];
    if (!ks.length) return false;
    s.parked = s.parked && typeof s.parked === 'object' ? s.parked : {};
    s.parked[key] = {};
    for (const k of ks) { s.parked[key][k.split('|')[1]] = s.overrides[k]; delete s.overrides[k]; }
    return true;
  }
  // the dormant section back, field by field: a field equal to the parent's stays inherited
  function unpark(m, sid, key) {
    const s = scen(m, sid);
    const kept = s && s.parked && s.parked[key];
    if (!kept) return;
    delete s.parked[key];
    if (!Object.keys(s.parked).length) delete s.parked;
    for (const path of Object.keys(kept).sort((a, b) => a.length - b.length)) M.setField(m, sid, key, path, kept[path]);
  }
  // The nominal size, series and grade a scenario holds of its own that the catalogue `to` does not have go back to the
  // parent: a size of a catalogue with other sizes (from `from`, when it is known) means nothing in this one.
  function dropForeign(m, sid, key, from, to) {
    const c = D().pipeCatalog(to);
    const mat = pipeIn(m, sid, key).material;
    const own = (f) => M.isOverridden(m, sid, key, 'material.' + f);
    const foreign = {
      nps: !D().pipeSizes(to).includes(String(mat.nps)) || (isCatalogue({ kind: from }) && !D().sameSizes(from, to)),
      sch: !c.all.includes(String(mat.sch)),
      grade: mat.grade !== undefined && !D().pipeGrades(to).includes(mat.grade),
    };
    for (const f of ['nps', 'sch', 'grade']) if (own(f) && foreign[f]) M.clearOverride(m, sid, key, 'material.' + f);
  }

  // the size and series of the catalogue material a scenario sees made valid, and its section circular with their bore
  function fitHere(m, sid, key) {
    const mat = pipeIn(m, sid, key).material;
    const fit = D().fitMaterial(mat);
    for (const f of ['nps', 'sch', 'grade']) if (fit[f] !== undefined && String(fit[f]) !== String(mat[f])) M.setField(m, sid, key, 'material.' + f, fit[f]);
    M.setField(m, sid, key, 'geometry.kind', 'circular');
    const b = catalogueBore(fit);
    if (Number.isFinite(b)) M.setField(m, sid, key, 'geometry.d', { value: b, unit: 'mm' });
  }

  // The pipe `key` as the scenario sid and each scenario below it see it, before an edit in sid.
  function pipeStates(m, sid, key) {
    return new Map([sid, ...M.descendants(m, sid)].map((id) => [id, pipeIn(m, id, key)]));
  }

  // After an edit of the material or the section of a pipe in sid: each scenario below it whose pipe moved, from the
  // top down, so that each one compares with its parent already set (`before`: pipeStates of the edit).
  // - It sees a catalogue material: its own size, series and grade that the catalogue lacks follow the parent, and it
  //   takes the circular section and the bore of its own combination, also when it inherited the diameter (P-09). A
  //   section of its own, from a user-defined material it saw before, goes dormant (P-10).
  // - It sees a user-defined material after a catalogue one: the section the catalogue gave it follows the parent, and
  //   its dormant section comes back.
  function fitPipesBelow(m, sid, key, before) {
    for (const d of M.descendants(m, sid)) {
      const B = before.get(d), A = pipeIn(m, d, key);
      if (!A || !B || (M.deepEqual(A.material, B.material) && M.deepEqual(A.geometry, B.geometry))) continue;
      if (isCatalogue(A.material)) {
        if (!isCatalogue(B.material)) park(m, d, key);
        dropForeign(m, d, key, B.material.kind, A.material.kind);
        fitHere(m, d, key);
      } else if (isCatalogue(B.material)) {
        const s = scen(m, d);
        if (fitsCatalogue(B.geometry, B.material)) for (const k of ownKeys(s, key, 'geometry')) delete s.overrides[k];
        unpark(m, d, key);
      }
    }
  }

  // A file saved before P-09 and P-10 held: a scenario with a catalogue material whose section is not that of its size
  // and series, because it chose the size or the series and inherited the diameter, or held a section of its own and
  // inherited the material. Its section is set from the catalogue (the one of its own goes dormant), from the base to
  // the leaves; a scenario that holds both or neither is left as it is. A dormant section of a pipe that is not in the
  // model, or of the base scenario, goes, and so does a field of one that is not of the section. Returns the pipes set,
  // as 'P1 (scenario)'.
  function fitCataloguePipesOnLoad(m) {
    const set = [];
    const ids = new Set(m.pipes.map((p) => 'p:' + p.id));
    // a dormant section belongs to a child scenario and to a pipe of the model, and holds fields of the section only
    const plain = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
    for (const s of m.scenarios.list) {
      if (s.parked === undefined) continue;
      if (!s.parent || !plain(s.parked)) { delete s.parked; continue; }
      for (const k of Object.keys(s.parked)) {
        const kept = s.parked[k];
        if (!ids.has(k) || !plain(kept)) { delete s.parked[k]; continue; }
        for (const path of Object.keys(kept)) if (!/^geometry(\.|$)/.test(path)) delete kept[path];
        if (!Object.keys(kept).length) delete s.parked[k];
      }
      if (!Object.keys(s.parked).length) delete s.parked;
    }
    const order = [];
    const walk = (id) => m.scenarios.list.filter((s) => s.parent === id).forEach((s) => { order.push(s); walk(s.id); });
    for (const r of m.scenarios.list.filter((s) => !s.parent)) walk(r.id);
    for (const s of order) {
      if (!s.overrides) continue;
      // only a pipe whose material or section the scenario holds can be out of step; the scenario is seen once, since
      // setting one pipe moves no other
      const held = new Set(Object.keys(s.overrides).filter((k) => /^p:[^|]*\|(material|geometry)(\.|$)/.test(k)).map((k) => k.split('|')[0]));
      if (!held.size) continue;
      const eff = M.effective(m, s.id);
      for (const p of m.pipes) {
        const key = 'p:' + p.id;
        if (!held.has(key)) continue;
        const A = M.getObj(eff, key);
        if (!A || !isCatalogue(A.material) || !D().pipeDims(D().fitMaterial(A.material)) || fitsCatalogue(A.geometry, A.material)) continue;
        const ownMat = M.isOverridden(m, s.id, key, 'material'), ownGeo = M.isOverridden(m, s.id, key, 'geometry');
        if (ownMat === ownGeo) continue;
        if (ownGeo) park(m, s.id, key);
        fitHere(m, s.id, key);
        set.push(`P${p.id} (${s.name || s.id})`);
      }
    }
    return set;
  }

  Object.assign(M, { isCatalogue, catalogueBore, fitsCatalogue, parkSection: park, unparkSection: unpark, dropForeign, fitCatalogueHere: fitHere, pipeStates, fitPipesBelow, fitCataloguePipesOnLoad });
})(typeof window !== 'undefined' ? window : globalThis);
