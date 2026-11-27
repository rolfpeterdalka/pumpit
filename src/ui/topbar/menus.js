// Top bar menus (File, Options, Edit, Help), their commands and the list of examples. Other blocks add their own
// commands to ACTIONS and, for a menu that shows a state, a function to ON_OPEN (src/ui/topbar/options.js).
(function (root) {
  const PumpIt = root.PumpIt;
  const M = PumpIt.model, UI = PumpIt.ui;
  const app = PumpIt.app;
  const F = UI.format;
  const { $, $$ } = UI.dom;
  const { toast, modal, confirmBox, copyText } = UI.dialogs;
  const { t } = PumpIt.i18n;

  app.hideMenus = () => {
    $$('.menu-pop').forEach((m) => { m.hidden = true; });
    $('#ctxmenu').hidden = true;
    $('#btn-checklist').setAttribute('aria-expanded', 'false');
  };

  // menu items, by their data-act attribute; each receives the item clicked
  const ACTIONS = {
    new: () => confirmBox(t('app.newModel.title'), t('app.newModel.text'), t('app.newModel.ok'), () => app.replaceModel(M.newModel())),
    open: () => $('#file-input').click(),
    save: () => app.downloadModel(),
    'copy-json': () => copyText(JSON.stringify(app.model), t('app.files.modelCopied')),
    'paste-json': () => {
      const ta = document.createElement('textarea');
      ta.id = 'paste-area';
      ta.placeholder = t('app.pasteModel.placeholder');
      modal({ title: t('app.pasteModel.title'), body: ta, actions: [{ label: t('app.dialog.cancel') }, { label: t('app.pasteModel.ok'), primary: true, onClick: () => {
        let model;
        try { model = JSON.parse(ta.value); } catch (e) { toast(t('app.pasteModel.cannotRead', { message: e.message })); return false; }
        if (UI.files.profileRefused(model)) return false;
        try { app.replaceModel(model, { note: t('app.pasteModel.opened') }); } catch (e) { toast(t('app.pasteModel.cannotRead', { message: e.message })); return false; }
      } }] });
    },
    'export-xlsx': () => app.exportResultsXlsx(),
    undo: () => app.undo(),
    redo: () => app.redo(),
    copy: () => app.copySelection(),
    paste: () => app.paste(),
    'select-all': () => { app.setView('net'); app.selectAll(); },
    reverse: () => { if (app.sel && app.sel.kind === 'pipe') app.reversePipe(app.sel.id); else toast(t('app.edit.selectPipe')); },
    delete: () => (app.selSet.size ? app.deleteSelection() : toast(t('app.edit.nothingSelected'))),
    fit: () => { app.setView('net'); requestAnimationFrame(() => UI.canvas.fit()); },
    'toggle-grid': () => {
      if (UI.scene3d.active()) { UI.hud3d.toggle('grid'); return; } // the grid of the 3D view on the screen
      app.prefs.grid = !app.prefs.grid; app.savePrefs(); UI.canvas.render(); toast(app.prefs.grid ? t('app.edit.gridOn') : t('app.edit.gridOff'));
    },
    'full-screen': () => UI.fullScreen.toggle(),
    system: () => UI.systemWindow.open(),
    help: () => UI.help.open(),
    'help-tour': () => UI.tour.start(),
    'help-start': () => UI.help.open('start.welcome'),
    'help-tech': () => UI.help.open('tech.overview'),
    'help-about': () => UI.help.open('about.about'),
    shortcuts: () => UI.shortcuts.show(),
  };

  // what a menu brings up to date as it opens, by the name of the menu (data-menu): fn(pop)
  const ON_OPEN = {};

  // opens an example in place of the current model (undo brings the model back)
  function openExample(id) {
    const ex = PumpIt.examples.get(id);
    if (!ex) return;
    app.replaceModel(ex.build(), { note: t('app.exampleLoaded', { name: ex.name }) });
  }

  // the examples list of the File menu (names in the current language)
  function renderExamples() {
    $('#menu-examples').innerHTML = PumpIt.examples.EXAMPLES.map((ex) => `<button type="button" data-ex="${ex.id}">${F.esc(ex.name)}</button>`).join('');
  }

  // opens the menu of that name (the others close), bringing its marks up to date
  function open(name) {
    const pop = $('#menu-' + name);
    app.hideMenus();
    pop.hidden = false;
    if (ON_OPEN[name]) ON_OPEN[name](pop);
  }

  function bind() {
    $$('[data-menu]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      if ($('#menu-' + b.dataset.menu).hidden) open(b.dataset.menu); else app.hideMenus();
    }));
    $$('.menu-pop [data-act]').forEach((b) => b.addEventListener('click', () => { app.hideMenus(); ACTIONS[b.dataset.act](b); }));
    renderExamples();
    $('#menu-examples').addEventListener('click', (e) => {
      const b = e.target.closest('[data-ex]');
      if (!b) return;
      app.hideMenus();
      openExample(b.dataset.ex);
    });
    // a click anywhere else closes the menus
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.menu') && !e.target.closest('.run') && !e.target.closest('.ctxmenu')) app.hideMenus();
    });
  }

  PumpIt.ui.menus = { ACTIONS, ON_OPEN, bind, open, renderExamples, openExample };
})(window);
