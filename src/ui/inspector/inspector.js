// Inspector (properties panel): the summary of the system, the selected pipe or junction, or the multiple selection,
// with what is still missing for the object to be defined. Each panel lives in its own file and registers in
// PumpIt.ui.inspector.panels; this file dispatches and holds the helpers they share. The panel follows the selection:
// it opens when something is selected and collapses when nothing is. The arrow on its left edge collapses it or brings
// it back by hand, until the selection changes again. A pipe or a junction has two tabs under its title: Properties
// (its fields, curves, what it still lacks and the sections other blocks add) and Results (the quick read-outs of the
// calculation). A new object opens on Properties; the same one, drawn again after an edit or a recalculation, keeps
// the tab it was on.
(function (root) {
  const PumpIt = root.PumpIt;
  const U = PumpIt.units, UI = PumpIt.ui;
  const F = UI.format;
  const { el } = UI.dom;
  const app = PumpIt.app;
  const { t } = PumpIt.i18n;
  const panels = {};
  // sections that other blocks add after a panel: fn(host) for the system, fn(host, id) for a pipe or a junction
  const extras = { system: [], pipe: [], junction: [] };
  const addSection = (panel, fn) => extras[panel].push(fn);
  let host;

  function init(hostEl) {
    host = hostEl;
    document.getElementById('panel-toggle').addEventListener('click', () => setCollapsed(!isCollapsed()));
    delete app.prefs.inspectorCollapsed; // kept by older versions, whose arrow alone collapsed the panel
    root.addEventListener('pointerdown', () => { pressed = true; }, true);
    root.addEventListener('pointerup', released);
    root.addEventListener('pointercancel', released);
    root.addEventListener('blur', released); // the window lost the focus during the press: no release comes
  }

  // ------------------------------------------------------------ opening and collapsing the panel

  // The panel follows each change of the selection, and opens again at a click on an object that is already
  // selected (selection.js); between two of them the arrow decides. During a press on the page (a click or a drag on
  // the drawing) it waits for the button to be released, so that the drawing area never changes width under a drag.
  let followed = null; // the selection the panel last followed, as its keys
  let pressed = false, wanted = null; // wanted: the state waiting for the release (true: collapsed)
  const selected = () => [...app.selSet].sort().join(' ');
  function follow() {
    followed = selected();
    wanted = !app.selSet.size;
    if (!pressed) released();
  }
  function released() {
    pressed = false;
    if (wanted === null) return;
    setCollapsed(wanted);
    wanted = null;
  }

  const isCollapsed = () => document.getElementById('view-net').classList.contains('insp-off');
  function setCollapsed(on) {
    document.getElementById('view-net').classList.toggle('insp-off', on);
    labelToggle();
  }
  // the arrow says what it does: collapse the panel, or show it again
  function labelToggle() {
    const b = document.getElementById('panel-toggle');
    const on = isCollapsed();
    const label = t(on ? 'inspector.toggle.show' : 'inspector.toggle.hide');
    b.title = label;
    b.setAttribute('aria-label', label);
    b.setAttribute('aria-expanded', String(!on));
  }

  // the tab of the object on the panel: the object (its key), the tab shown and the scroll of each tab
  let tabbed = { key: null, tab: 'props', scroll: {} };

  function render() {
    // a field left for another control of the panel: drawn again once the click has reached that control
    if (UI.focusKeep.defer(host, render)) return;
    if (selected() !== followed) follow(); // a selection changed elsewhere: an object added, pasted or deleted, a load
    labelToggle(); // its texts follow the language
    const kept = UI.focusKeep.save(host); // the focus, where Tab sends it, and the scroll (src/ui/common/focus-keep.js)
    host.innerHTML = '';
    const s = app.sel;
    const key = s && app.selSet.size <= 1 ? (s.kind === 'pipe' ? 'p:' : 'j:') + s.id : null;
    if (key !== tabbed.key) tabbed = { key, tab: 'props', scroll: {} }; // a new object opens on its properties
    if (app.selSet.size > 1) panels.selection(host);
    else if (!s) { panels.system(host); extras.system.forEach((fn) => fn(host)); }
    else {
      // the panel of a pipe or a junction gives its two tabs (tabs below); the sections of other blocks go to Properties
      const kind = s.kind === 'pipe' ? 'pipe' : 'junction';
      const panes = panels[kind](host, s.id); // none when the object is gone (the summary of the system instead)
      const tabbedPanel = !!(panes && panes.props);
      extras[kind].forEach((fn) => fn(tabbedPanel ? panes.props : host, s.id));
      if (tabbedPanel && !panes.results.childElementCount) noResults(panes.results);
    }
    // the fields the checklist asks for (src/ui/inspector/pending.js)
    if (key && UI.pending) UI.pending.mark(host, key);
    UI.focusKeep.restore(kept);
  }

  // ------------------------------------------------------------ the tabs of a pipe or a junction

  const TABS = ['props', 'results'];
  // the tab bar at the foot of the last header of host, and the two panes after it, the one not shown hidden; returns
  // the panes, { props, results }, for the panel to fill. The tabs have classes of their own: .tab switches the views
  // of the app (layout.js).
  function tabs(host) {
    const heads = host.querySelectorAll('.insp-head');
    const bar = el('div', { class: 'insp-tabs', role: 'tablist', 'aria-label': t('inspector.tabs.aria') });
    const panes = {};
    for (const k of TABS) {
      const on = k === tabbed.tab;
      const b = el('button', { type: 'button', class: 'insp-tab', role: 'tab', id: 'insp-tab-' + k, 'aria-selected': String(on), 'aria-controls': 'insp-pane-' + k, tabindex: on ? '0' : '-1' }, F.esc(t('inspector.tabs.' + k)));
      b.addEventListener('click', () => showTab(k));
      bar.appendChild(b);
      // the read-outs have no control of their own: their pane takes the focus, so that the keyboard reaches them
      panes[k] = el('div', { class: 'insp-pane', role: 'tabpanel', id: 'insp-pane-' + k, 'aria-labelledby': 'insp-tab-' + k, tabindex: k === 'results' ? '0' : null, hidden: !on });
    }
    // the arrows, Home and End go from tab to tab, and the tab reached is shown
    bar.addEventListener('keydown', (e) => {
      const i = TABS.indexOf(tabbed.tab);
      const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      showTab(TABS[(to + TABS.length) % TABS.length], true);
    });
    (heads.length ? heads[heads.length - 1] : host).appendChild(bar);
    host.append(panes.props, panes.results);
    return panes;
  }

  // shows a tab of the object on the panel (focus: the tab takes the focus, as after an arrow key); each tab keeps its
  // own scroll
  function showTab(k, focus) {
    if (!TABS.includes(k) || !tabbed.key) return;
    if (k !== tabbed.tab) {
      tabbed.scroll[tabbed.tab] = host.scrollTop;
      tabbed.tab = k;
      render();
      host.scrollTop = tabbed.scroll[k] || 0;
    }
    const b = document.getElementById('insp-tab-' + k);
    if (focus && b) b.focus();
  }
  const tabOf = () => (tabbed.key ? tabbed.tab : null);

  // the Results tab of an object without results: the calculation was refused, or waits for the model to be complete
  // (the checklist says what is missing)
  function noResults(pane) {
    const cur = app.currentResults();
    const refused = !!(cur && !cur.ok);
    const s = UI.forms.section();
    s.appendChild(el('p', { class: 'hint' }, F.esc(t(refused ? 'inspector.tabs.refused' : 'inspector.tabs.noResults'))));
    if (!refused && !app.validation().ok) {
      const b = el('button', { type: 'button', class: 'btn small' }, F.esc(t('results.viewPending')));
      // the click must not reach the page, which closes the checklist (menus.js)
      b.addEventListener('click', (e) => { e.stopPropagation(); UI.checklist.open({ focus: true }); });
      const row = el('div', { class: 'btn-row' });
      row.appendChild(b);
      s.appendChild(row);
    }
    pane.appendChild(s);
  }

  // ------------------------------------------------------------ helpers shared by the panels

  function head(host, title, idTxt, meta) {
    const h = el('div', { class: 'insp-head' });
    h.innerHTML = `<h3>${idTxt ? `<span class="id">${F.esc(idTxt)}</span>` : ''}${F.esc(title)}</h3>${meta ? `<div class="meta">${meta}</div>` : ''}`;
    host.appendChild(h);
    return h;
  }

  // "undefined" box with what is missing
  function missingBox(host, key) {
    const miss = app.undefSet().get(key);
    if (!miss) return;
    const sct = UI.forms.section();
    sct.appendChild(el('div', { class: 'missing' }, t('inspector.missing', { items: F.esc(miss.join('; ')) })));
    host.appendChild(sct);
  }

  // a result value in the inspector's output unit
  const out = (v, cat) => {
    const res = app.okResults();
    const ctx = res ? { rho: res.fluid.rho, patm: res.patm } : {};
    const u = app.outUnit('insp', cat);
    return `${F.fmt(F.conv(v, cat, u, ctx))} ${F.unit(u)}`;
  };

  // SI geometry of an effective pipe (flow area of all parallel tubes, hydraulic diameter)
  function pipeGeom(p) {
    if (!p) return null;
    const si = (q, c) => U.toSI(q.value, q.unit, c);
    const g = p.geometry;
    let A, Dh;
    try {
      if (g.kind === 'circular') { const d = si(g.d, 'length'); A = Math.PI * d * d / 4; Dh = d; }
      else if (g.kind === 'annulus') { const a = si(g.dOuter, 'length'), b = si(g.dInner, 'length'); A = Math.PI * (a * a - b * b) / 4; Dh = a - b; }
      else if (g.kind === 'rectangular') { const w = si(g.width, 'length'), h = si(g.height, 'length'); A = w * h; Dh = 2 * w * h / (w + h); }
      else { A = si(g.area, 'area'); Dh = 4 * A / si(g.perim, 'length'); }
    } catch (e) { return null; }
    const red = 1 - (p.idReduction || 0) / 100;
    return { A: A * red * red * (p.nParallel || 1), Dh: Dh * red };
  }

  // the fields of the panel of an object in the current scenario ('j:2', 'p:1', or 'sys' and 'sol' for the system
  // window), drawn off the page: UI.forms.describe
  function fieldsOf(key) {
    return UI.forms.describe(() => {
      const box = el('div');
      if (key === 'sys' || key === 'sol') { UI.systemForm.build(box); return; }
      const kind = key[0] === 'p' ? 'pipe' : 'junction', id = Number(key.slice(2));
      const panes = panels[kind](box, id);
      extras[kind].forEach((fn) => fn(panes && panes.props ? panes.props : box, id));
    });
  }

  PumpIt.ui.inspector = { init, render, panels, addSection, fieldsOf, head, tabs, showTab, tabOf, missingBox, out, pipeGeom, follow, isCollapsed, setCollapsed };
})(typeof window !== 'undefined' ? window : globalThis);
