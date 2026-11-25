// Report of an imported model (File → Open with a file of another format, such as .fth): what was read, how the first
// calculation compares with the results stored in the file, and the notes of the importer — what needs the user, what
// was assumed and what was left out.
(function (root) {
  const PumpIt = root.PumpIt;
  const UI = PumpIt.ui, F = UI.format;
  const { t } = PumpIt.i18n;
  const tx = (key, params) => t('app.importReport.' + key, params);

  // a relative difference as a percentage; differences below 0.001 % read as such
  const pct = (x) => (x < 1e-5 ? '< ' + F.fmt(0.001, 1) + ' %' : F.fmt(x * 100, 2) + ' %');
  // an absolute difference (a scale of zero) in the default unit of its category
  const abs = (x, cat) => `${F.fmt(PumpIt.units.fromSI(x, F.DEFAULT_OUT[cat], cat), 3)} ${F.unit(F.DEFAULT_OUT[cat])}`;

  // The steady state against the results stored in the file (F-31). Results that match say so, with what was compared
  // under it; anything else is one warning: what kept the comparison from confirming them (nothing to compare, a partial
  // comparison, a calculation that did not converge; a plain difference needs no such line), then one line per quantity
  // with what it covered and its largest difference.
  function comparison(add, c) {
    if (c.verdict === 'match') add('p', 'ok', tx('match'));
    const box = add('div', 'cmp ' + (c.verdict === 'match' ? 'muted' : 'warn'), '');
    const el = (tag, text, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; e.textContent = text; return e; };
    const head = { none: 'none', partial: 'partial', notConverged: 'notConverged' }[c.verdict];
    if (head) box.appendChild(el('p', tx(head), 'head'));
    if (c.verdict === 'none') return;
    box.appendChild(el('p', tx('against')));
    const ul = box.appendChild(el('ul', ''));
    const li = (text) => ul.appendChild(el('li', text));
    const pipe = (id) => (id ? 'P' + id : '—');
    if (!c.n) li(tx('flowNone'));
    else li(tx('flow', { n: c.n, total: c.pipes, pipe: pipe(c.flowPipe), diff: c.flowAbs ? tx('noFlowScale', { value: abs(c.flow, 'massFlow') }) : tx('ofFlow', { pct: pct(c.flow) }) }));
    if (!c.pressureN) li(tx('pressureNone'));
    else li(tx('pressure', { n: c.pressureN, total: c.ends, pipe: pipe(c.pressurePipe), diff: c.pressureAbs ? tx('noDropScale', { value: abs(c.pressure, 'dp') }) : tx('ofDrop', { pct: pct(c.pressure) }) }));
  }

  // name: the file name; res: what the importer imp (one of PumpIt.importers) read; r: the calculation of the imported
  // model (null while its checklist is incomplete)
  function show(name, res, r, imp) {
    const box = document.createElement('div');
    box.className = 'import-report';
    const add = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; e.textContent = text; box.appendChild(e); return e; };
    add('p', '', tx('summary', res.counts));
    if (!r) add('p', 'warn', tx('incomplete'));
    else if (!r.ok) add('p', 'warn', tx('refused', { message: (r.errors || [])[0] || '' }));
    else if (res.stored) comparison(add, imp.compare(r, res.stored));
    else add('p', 'muted', tx('noStored'));
    if (!res.notes.length) add('p', 'muted', tx('clean'));
    for (const level of imp.LEVELS) {
      const notes = res.notes.filter((n) => n.level === level);
      if (!notes.length) continue;
      add('h4', 'level-' + level, tx('levels.' + level));
      const ul = add('ul', '', '');
      for (const n of notes) { const li = document.createElement('li'); li.textContent = imp.noteText(n); ul.appendChild(li); }
    }
    UI.dialogs.modal({ title: tx('title', { name }), body: box, actions: [{ label: t('app.dialog.close'), primary: true }] });
  }

  // choice of the scenario to import from a file that has several (list: [{ n, name, path, description, results,
  // network }], as the importer lists them); onPick(n) runs after the window closes. The base scenario comes first and
  // is chosen. A scenario without a network is shown but cannot be chosen; when the base scenario has none, the first
  // one with a network is chosen
  function pickScenario(name, list, onPick) {
    const box = document.createElement('div');
    box.className = 'import-report import-scenarios';
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
    box.appendChild(el('p', 'muted', tx('pick.intro', { n: list.length })));
    const can = (s) => s.network !== false;
    const first = list.find((s) => s.n === 1 && can(s)) || list.find(can) || list[0];
    for (const s of list) {
      const lab = el('label', can(s) ? '' : 'empty');
      const radio = el('input');
      Object.assign(radio, { type: 'radio', name: 'import-scenario', value: String(s.n), checked: s === first, disabled: !can(s) });
      const txt = el('span');
      txt.appendChild(el('b', '', s.path || s.name || '#' + s.n));
      if (!can(s)) txt.appendChild(el('span', 'tag empty', tx('pick.empty')));
      else if (s.results) txt.appendChild(el('span', 'tag', tx('pick.results')));
      if (s.description) txt.appendChild(el('small', '', s.description));
      lab.append(radio, txt);
      box.appendChild(lab);
    }
    const chosen = () => { const c = box.querySelector('input[name="import-scenario"]:checked'); return c ? Number(c.value) : first.n; };
    UI.dialogs.modal({
      title: tx('pick.title', { name }), body: box,
      actions: [{ label: t('app.dialog.cancel') }, { label: tx('pick.import'), primary: true, onClick: () => { const n = chosen(); setTimeout(() => onPick(n), 0); } }],
    });
  }

  PumpIt.ui.importReport = { show, pickScenario };
})(typeof window !== 'undefined' ? window : globalThis);
