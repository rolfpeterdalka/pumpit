// Models in and out of the editor: normalization of loaded files (missing defaults, ids, migration of removed
// junction types), loading into the editor, saving as .json, and opening a file — .json, or another format through the
// importer of its extension (PumpIt.importers: .fth, .aro) — from the hidden file input or dropped on the page.
(function (root) {
  const PumpIt = root.PumpIt;
  const M = PumpIt.model, UI = PumpIt.ui;
  const app = PumpIt.app;
  const { $ } = UI.dom;
  const { toast } = UI.dialogs;
  const { t } = PumpIt.i18n;

  function normalize(m) {
    if (!m || !Array.isArray(m.pipes) || !Array.isArray(m.junctions) || !M.idsWellFormed(m)) throw new Error(t('app.files.notAModel'));
    // an id given to two objects of one collection: the file is refused, naming them (the study open stays as it is)
    const dup = M.duplicateIds(m);
    if (dup.length) throw new Error(t('app.files.duplicateIds', { list: dup.map(M.duplicateText).join(' ') }));
    // a scenario whose parent is not in the file, or that comes from itself through its parents, is refused the same way
    const tree = M.scenarioTreeIssues(m);
    if (tree.length) throw new Error(t('app.files.duplicateIds', { list: tree.map(M.scenarioTreeText).join(' ') }));
    const base = M.newModel();
    m.system = Object.assign(base.system, m.system || {});
    m.solution = Object.assign(base.solution, m.solution || {});
    if (!m.scenarios || !m.scenarios.list || !m.scenarios.list.length) m.scenarios = base.scenarios;
    if (!m.scenarios.list.some((s) => s.id === m.scenarios.current)) m.scenarios.current = m.scenarios.list[0].id;
    // a scenario saved without its overrides has none
    for (const s of m.scenarios.list) if (!s.overrides || typeof s.overrides !== 'object' || Array.isArray(s.overrides)) s.overrides = {};
    m.nextId = m.nextId || {};
    m.nextId.p = Math.max(m.nextId.p || 1, 1 + Math.max(0, ...m.pipes.map((p) => p.id)));
    m.nextId.j = Math.max(m.nextId.j || 1, 1 + Math.max(0, ...m.junctions.map((j) => j.id)));
    m._notes = M.migrate(m);
    M.normalizeRegime(m);
    M.normalizeTime(m);
    // the water hammer, a module of its own: its control, when the file has one
    if (PumpIt.surge) PumpIt.surge.inputs.normalize(m);
    M.normalizeLayout(m);
    M.normalizeEnds(m);
    // overrides of a whole block of friction or of losses at the pipes: one per field that differs from the parent
    M.splitBlocksOnLoad(m);
    // a catalogue pipe of a scenario whose section is not that of its size and series (docs/pipe-library.md, P-09 to P-11)
    m._fitted = M.fitCataloguePipesOnLoad(m);
    return m;
  }

  // ------------------------------------------------------------ one model in place of another
  // What the model open still has pending when another one comes (review of e81e282, items 2, 3 and 9): the field being
  // edited is confirmed into it first, as leaving the field would, and is part of its history; once the new model is
  // in, the dialogs and menus opened for the model before are closed (each one is also stamped with the model it was
  // opened for, src/ui/common/dialogs.js), and only the latest request to open a file applies.
  app.commitPending = () => {
    const a = document.activeElement;
    if (a && a !== document.body && a.matches && a.matches('input, select, textarea')) a.blur();
  };
  app.closeTransient = () => {
    const D = UI.dialogs;
    if (D.isModalOpen && D.isModalOpen()) D.closeModal();
    if (app.hideMenus) app.hideMenus();
  };
  // the requests to open a file: a reading that ends after a later request, or after another model came in, is dropped
  let opens = 0;
  function request() {
    const n = ++opens;
    return () => n === opens;
  }

  // note: what the caller says of the model ("Opened: name"), in one message with what the opening changed in it
  app.loadModel = (m, { fit = true, note = '' } = {}) => {
    const before = { model: app.model, results: app.results, timeRuns: app.timeRuns, selSet: app.selSet, sel: app.sel, modelGen: app.modelGen };
    app.model = normalize(m);
    const notes = app.model._notes, fitted = app.model._fitted;
    delete app.model._notes; delete app.model._fitted;
    app.selSet = new Set(); app.sel = null;
    app.modelGen++;
    app.version++;
    app.results = {};
    app.timeRuns = {};
    // the texts left in cells of the model before (num-cell.js) mean nothing in this one, nor the pipe being drawn
    UI.numCell.clearDrafts();
    UI.canvas.dropDraft();
    // a damaged file whose model fails to calculate or to draw is refused, and the model before stays; a model is saved
    // only once it works, so the page never opens again on a broken one
    try {
      app.recalc();
      app.renderAll();
    } catch (e) {
      Object.assign(app, before);
      app.version++;
      if (app.model) app.renderAll();
      throw new Error(t('app.files.notAModel'));
    }
    opens++;
    app.closeTransient();
    app.save();
    // the schematic is framed; the cameras of the 3D views were saved with the model (3D views R-02), and are framed
    // again only when the scene is out of their sight
    if (fit) requestAnimationFrame(() => { UI.scene3d.ensureVisible(); UI.canvas.fitSchematic(); });
    const said = [];
    if (notes && notes.length) said.push(t('app.files.converted', { notes: notes.join('; ') }));
    if (fitted && fitted.length) said.push(t('app.files.pipesFitted', { pipes: fitted.join(', ') }));
    const msg = [note, said.join(' ')].filter(Boolean).join(' · ');
    if (msg) toast(msg);
  };

  // Another model in place of the one in the editor, as one step of the history: the model before goes to the undo
  // stack and the redo stack empties only once the new model is accepted. A refused model throws, with the model, the
  // undo and the redo stacks as they were.
  app.replaceModel = (m, opts) => {
    app.commitPending();
    const before = JSON.stringify(app.model);
    app.loadModel(m, opts);
    app.pushUndo(before);
  };

  // The profile of the result columns (results/column-setup.js) is a JSON file too: opened as a model, it is pointed
  // to where it belongs. Returns true when obj is one (the message is shown).
  function profileRefused(obj) {
    if (!UI.columnSetup || !UI.columnSetup.isProfile(obj)) return false;
    const plain = (s) => s.replace(/…$/, '');
    toast(t('app.files.isProfile', { path: [t('app.tabs.out'), t('results.columnsButton'), t('results.setup.import')].map(plain).join(' → ') }));
    return true;
  }

  app.downloadModel = () => UI.download.saveFile(`${UI.download.safeName(app.model.title)}.pumpit.json`, new Blob([JSON.stringify(app.model, null, 1)], { type: 'application/json' }));

  // the importers by extension (src/core/import/): each reads the text of its files, in their encoding, into a model
  const importers = () => PumpIt.importers || {};
  function importerOf(name) {
    const m = /\.(\w+)$/.exec(name);
    const ext = m && m[1].toLowerCase();
    return ext && Object.prototype.hasOwnProperty.call(importers(), ext) ? importers()[ext] : null;
  }

  // a file of another format becomes a model, and the import report tells what was read; a file with several scenarios
  // first asks which one to import (a file whose scenarios have no network is refused by the importer at once)
  function importFile(f, imp, latest) {
    const rd = new FileReader();
    rd.onload = () => {
      if (!latest()) return;
      const text = new TextDecoder(imp.encoding || 'utf-8').decode(rd.result);
      const load = (opts) => {
        if (!latest()) return;
        let res;
        try { res = imp.read(text, Object.assign({ name: f.name }, opts)); }
        catch (err) { toast(t('app.importReport.cannotRead', { message: err.message })); return; }
        try { app.replaceModel(res.model); }
        catch (err) { toast(t('app.importReport.cannotRead', { message: err.message })); return; }
        UI.importReport.show(f.name, res, app.results[app.model.scenarios.current] || null, imp);
      };
      let list = [];
      try { list = imp.scenarios ? imp.scenarios(text) : []; } catch (err) { list = []; }
      if (list.length > 1 && list.some((s) => s.network !== false)) UI.importReport.pickScenario(f.name, list, (n) => load({ scenario: n }));
      else load({});
    };
    rd.readAsArrayBuffer(f);
  }

  function openFile(f) {
    if (!f) return;
    const imp = importerOf(f.name), latest = request();
    if (imp) { importFile(f, imp, latest); return; }
    const rd = new FileReader();
    rd.onload = () => {
      if (!latest()) return;
      let model;
      try { model = JSON.parse(rd.result); } catch (err) { toast(t('app.files.cannotOpen', { message: err.message })); return; }
      if (profileRefused(model)) return;
      try { app.replaceModel(model, { note: t('app.files.opened', { name: f.name }) }); }
      catch (err) { toast(t('app.files.cannotOpen', { message: err.message })); }
    };
    rd.readAsText(f);
  }

  function bind() {
    $('#file-input').accept = ['.json', ...Object.keys(importers()).map((ext) => '.' + ext), 'application/json'].join(',');
    $('#file-input').addEventListener('change', (e) => {
      openFile(e.target.files[0]);
      e.target.value = '';
    });
    // a file dragged onto the page opens like File → Open (the drawing lets file drops through to here)
    const hasFiles = (e) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');
    document.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
    document.addEventListener('drop', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      openFile(e.dataTransfer.files[0]);
    });
  }

  PumpIt.ui.files = { normalize, bind, openFile, profileRefused };
})(window);
