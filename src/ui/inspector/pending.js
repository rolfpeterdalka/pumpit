// Pending items of an object: the messages of the checklist (src/core/model/validation.js), each tied to the field of
// the inspector it asks for, so that choosing it in the checklist takes the focus to that field, and the inspector
// marks the field as invalid. A message is tied by the catalog key it comes from (i18n.keyOfText): the last part of
// the key names the field (junctions.reservoir.check.liquidElev → liquidElev), or a table below says which one. A
// connection message is tied to the connections of the object; any other one (a curve, a table of the time
// simulation, the water hammer) only to the box that lists what is missing.
(function (root) {
  const PumpIt = root.PumpIt;
  const UI = PumpIt.ui, M = PumpIt.model, app = PumpIt.app;
  const i18n = PumpIt.i18n;
  const { t } = i18n;

  // the field of each pipe message (core.checklist.pipe.*)
  const PIPE = {
    length: 'length', diameter: 'geometry.d', annulus: 'geometry.dOuter', annulusInner: 'geometry.dInner', rectangle: 'geometry.width',
    noncircular: 'geometry.area', roughness: 'friction.eps', relRoughness: 'friction.rel', frictionFactor: 'friction.f',
    hwC: 'friction.C', nParallel: 'nParallel', idReduction: 'idReduction',
  };
  const PIPE_CONNECT = ['connect', 'sameEnds'];
  // junction messages whose last key part is not the field: a connection, or another field
  const JUNCTION = { direction: null, staticOnePipe: null, holes: 'dHole', ratioGasOnly: 'mode' };
  const CONNECT = Symbol('connect');

  const last = (k) => k.slice(k.lastIndexOf('.') + 1);

  // a junction message: the core checks (elevation, gas temperature, pipe count, direction), those of its type and
  // those of the valves that share a loss model
  function junctionPath(j, text) {
    const def = PumpIt.junctionTypes.get(j.type);
    const n = M.pipesAt(app.eff(), j.id).length;
    const [min, max] = def.pipes;
    if (text === t('core.checklist.junction.pipesExact', { n: min, has: n }) || text === t('core.checklist.junction.pipesRange', { min, max, has: n })) return CONNECT;
    for (const prefix of ['core.checklist.junction.', `junctions.${j.type}.check.`, 'junctions.lossModel.check.']) {
      const k = i18n.keyOfText(prefix, text);
      if (!k) continue;
      const part = last(k);
      if (part in JUNCTION) return JUNCTION[part] === null ? CONNECT : JUNCTION[part];
      return part;
    }
    return null;
  }

  function pipePath(text) {
    const k = i18n.keyOfText('core.checklist.pipe.', text);
    if (!k) return null;
    return PIPE_CONNECT.includes(last(k)) ? CONNECT : PIPE[last(k)] || null;
  }

  // the pending items of an object: [{ text, path, connect }] (path: the field, or null)
  function of(key) {
    const miss = app.validation().undef.get(key) || [];
    const o = app.effObj(key);
    if (!o) return [];
    return miss.map((text) => {
      const p = key[0] === 'p' ? pipePath(text) : junctionPath(o, text);
      return { text, path: typeof p === 'string' ? p : null, connect: p === CONNECT };
    });
  }

  const control = (key, path) => document.getElementById(UI.forms.idOf(key, path));

  // marks the controls of the inspector the pending items ask for (aria-invalid and the class of their field)
  function mark(host, key) {
    for (const it of of(key)) {
      const c = it.path && control(key, it.path);
      if (!c || !host.contains(c)) continue;
      c.setAttribute('aria-invalid', 'true');
      const f = c.closest('.field');
      if (f) f.classList.add('invalid');
    }
  }

  // after the object was opened in the inspector: the focus goes to the first field it lacks, or, for a connection or
  // a value without a field of its own, to the box that says what is missing
  function focusFirst(key) {
    const host = document.getElementById('inspector');
    const items = of(key);
    for (const it of items) {
      const c = it.path && control(key, it.path);
      if (c && !c.disabled && c.offsetParent !== null) { c.scrollIntoView({ block: 'center' }); c.focus({ preventScroll: true }); return c; }
    }
    const box = host && host.querySelector('.missing');
    if (box) { box.tabIndex = -1; box.scrollIntoView({ block: 'center' }); box.focus({ preventScroll: true }); }
    return box || null;
  }

  // opens a pending object: selected on the drawing, on the Properties tab of the inspector, and the focus where it is
  // missing
  function open(key) {
    app.gotoKey(key);
    UI.inspector.showTab('props');
    return focusFirst(key);
  }

  PumpIt.ui.pending = { of, mark, focusFirst, open };
})(window);
