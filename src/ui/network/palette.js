// Palette: the select and pipe tools plus one button per junction type, grouped and ordered as in the
// junction type registry. Click a type and then the drawing, or drag it onto the drawing. Each group opens and closes
// from its title (a button, so the keyboard reaches it); the boundaries, connections, equipment and valves start open,
// the losses and the protection against water hammer closed, and the choice of each group is kept with the
// preferences. A closed group still shows its tool in use. The arrow on the left edge of the drawing collapses the
// whole palette, to give the drawing more room, and brings it back; that choice is kept too.
(function (root) {
  const PumpIt = root.PumpIt;
  const UI = PumpIt.ui;
  const F = UI.format;
  const { $, $$ } = UI.dom;
  const app = PumpIt.app;
  const { t } = PumpIt.i18n;

  function bindTool(b) {
    b.addEventListener('click', () => UI.canvas.setTool(UI.canvas.tool === b.dataset.tool && b.dataset.tool !== 'select' ? 'select' : b.dataset.tool));
    b.addEventListener('dragstart', (e) => { if (b.dataset.tool.startsWith('place:')) e.dataTransfer.setData('text/plain', b.dataset.tool.slice(6)); });
  }

  // the groups open at first; the others (losses, protection against water hammer) start closed
  const OPEN = new Set(['boundary', 'connection', 'equipment', 'valves']);
  const isOpen = (g) => { const p = app.prefs.paletteGroups; return p && g in p ? !!p[g] : OPEN.has(g); };
  const CHEVRON = '<svg class="chev" viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M3 4.5L6 7.5L9 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // one button per junction type, in its group under the group's title (texts in the current language); a type that
  // depends on a module (offered) only while the module is in the page
  function render() {
    labelToggle(); // its texts follow the language
    const groups = {};
    for (const def of PumpIt.junctionTypes.list()) if (!def.offered || def.offered()) (groups[def.group] = groups[def.group] || []).push([def.type, def]);
    $('#palette-junctions').innerHTML = Object.entries(groups).map(([g, items]) => {
      const open = isOpen(g), label = F.esc(t('junctions.groups.' + g));
      return `<button type="button" class="palette-group" data-group="${g}" aria-expanded="${open}" aria-controls="pal-g-${g}">${CHEVRON}<span>${label}</span></button>`
        + `<div class="palette-items${open ? '' : ' shut'}" id="pal-g-${g}" role="group" aria-label="${label}">`
        + items.map(([k, def]) => `<button class="tool" data-tool="place:${k}" draggable="true" title="${F.esc(t('network.palette.toolTitle', { label: def.label }))}">${UI.junctionTypes.icon(k, 24)}<span>${F.esc(def.label)}</span></button>`).join('')
        + '</div>';
    }).join('');
    $$('#palette-junctions .tool').forEach((b) => {
      bindTool(b);
      b.classList.toggle('active', b.dataset.tool === UI.canvas.tool);
    });
    $$('#palette-junctions .palette-group').forEach((b) => b.addEventListener('click', () => toggleGroup(b.dataset.group)));
  }

  // a group opened or closed from its title; the title keeps the focus
  function toggleGroup(g) {
    app.prefs.paletteGroups = Object.assign({}, app.prefs.paletteGroups, { [g]: !isOpen(g) });
    app.savePrefs();
    render();
    const b = document.querySelector(`.palette-group[data-group="${g}"]`);
    if (b) b.focus();
  }

  function bind() {
    render();
    $$('.palette > .tool').forEach(bindTool);
    $('#palette-toggle').addEventListener('click', () => setCollapsed(!isCollapsed()));
    setCollapsed(!!app.prefs.paletteCollapsed);
    new ResizeObserver(centre).observe($('#palette'));
  }

  // ------------------------------------------------------------ collapsing the palette

  const isCollapsed = () => $('#view-net').classList.contains('pal-off');
  function setCollapsed(on) {
    $('#view-net').classList.toggle('pal-off', on);
    labelToggle();
    if (!!app.prefs.paletteCollapsed !== on) { app.prefs.paletteCollapsed = on; app.savePrefs(); }
  }
  // the arrow says what it does: collapse the palette, or show it again
  function labelToggle() {
    const b = $('#palette-toggle');
    const on = isCollapsed();
    const label = t(on ? 'network.palette.toggle.show' : 'network.palette.toggle.hide');
    b.title = label;
    b.setAttribute('aria-label', label);
    b.setAttribute('aria-expanded', String(!on));
  }

  // the scroll bar of a short window takes room between the tools and the right border: half its width, at most 6 px,
  // goes to --bar, which moves that much from the right padding (6 px) to the left one (network.css). The sum of the
  // paddings stays the same, so the room of the tools does not change and the observer is not called again
  function centre() {
    const p = $('#palette'), cs = getComputedStyle(p);
    const bar = p.offsetWidth - p.clientWidth - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
    p.style.setProperty('--bar', Math.min(Math.max(bar, 0), 12) / 2 + 'px');
  }

  PumpIt.ui.palette = { bind, render, isCollapsed, setCollapsed };
})(typeof window !== 'undefined' ? window : globalThis);
