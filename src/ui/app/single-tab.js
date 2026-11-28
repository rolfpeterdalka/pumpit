// One tab edits the study at a time. Every tab of the same address shares the study kept in the browser
// (pumpit.model), and each one saved the whole model after every change, so the last tab to save erased what another
// had saved before. Now the tab that edits is the owner (pumpit.owner holds its id). A tab that opens asks whether an
// owner is alive (pumpit.ping; the owner answers on pumpit.pong, which the browser delivers even to a hidden tab). With
// an answer the new tab stays locked; without one, the owner is gone (closed or crashed) and the new tab takes over.
// "Use here" in a locked tab asks the owner for the study (pumpit.handover): the owner writes the field being edited,
// saves, names the asking tab as the owner and locks itself, and the asking tab then opens the study as saved. An owner
// that does not answer in time is gone, and the asking tab takes over (review of c3b3ec4, item 1: before it the asking
// tab opened the study before the owner had written the field, which was lost). A locked tab saves nothing. The owner
// gives the study back when its page goes away, after the field being edited is written (an edit confirms on change,
// and the reload would drop it).
(function (root) {
  const PumpIt = root.PumpIt;
  const app = PumpIt.app;
  const { $ } = PumpIt.ui.dom;
  const { t } = PumpIt.i18n;
  const KEY = { owner: 'pumpit.owner', ping: 'pumpit.ping', pong: 'pumpit.pong', handover: 'pumpit.handover', model: 'pumpit.model' };
  const WAIT = 700; // ms for the owner to answer
  const FRESH = 5000; // ms: an older request for the study is not answered (an event delivered late)

  const me = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  let active = true; // without browser storage there is nothing to share: the tab edits
  let state = null;  // null, 'busy' (an owner answered at the start) or 'lost' (another tab took over)
  let waiting = false, answered = false;
  let asking = null; // the request of "Use here" waiting for the owner: { n, timer }
  let seen = null;   // the study as stored when this tab last saved or took it: another tab changed it when it differs

  const get = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
  const del = (k) => { try { localStorage.removeItem(k); } catch (e) { /* nothing to give back */ } };
  const parse = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };

  app.tabActive = () => active;

  // a locked tab saves nothing; an owner whose id is no longer the one stored has been replaced
  const save0 = app.save, savePrefs0 = app.savePrefs;
  app.save = () => { if (stillOwner()) { save0(); seen = get(KEY.model); } };
  app.savePrefs = () => { if (stillOwner()) savePrefs0(); };
  function stillOwner() {
    if (!active) return false;
    const o = get(KEY.owner);
    if (o !== null && o !== me) { lock('lost'); return false; }
    return true;
  }

  let inerted = [];
  function lock(why) {
    active = false;
    state = why;
    const box = $('#tab-lock');
    if (!box) return;
    if (PumpIt.ui.tips) PumpIt.ui.tips.hide();
    closeOpen();
    $('#tab-lock-title').textContent = t(why === 'busy' ? 'app.tabLock.busyTitle' : 'app.tabLock.lostTitle');
    $('#tab-lock-text').textContent = t(why === 'busy' ? 'app.tabLock.busyText' : 'app.tabLock.lostText');
    $('#tab-lock-hint').textContent = t('app.tabLock.useHint');
    $('#tab-lock-use').textContent = t('app.tabLock.use');
    box.inert = false; // a box of the app open before the lock had made it inert
    if (box.hidden) {
      box.hidden = false;
      // everything else on the page, up to the body (a card of the tour sits outside the app), takes no focus or click
      for (let n = box; n && n !== document.body; n = n.parentElement) {
        inerted.push(...[...n.parentElement.children].filter((e) => e !== n && !e.inert && e.tagName !== 'SCRIPT').map((e) => { e.inert = true; return e; }));
      }
    }
    $('#tab-lock-use').focus();
  }
  function unlock() {
    const box = $('#tab-lock');
    if (box) box.hidden = true;
    inerted.forEach((e) => { e.inert = false; });
    inerted = [];
    state = null;
  }
  function claim() {
    seen = get(KEY.model);
    if (!set(KEY.owner, me)) { active = true; return; }
    active = true;
    unlock();
  }
  // A window or a menu open in this tab belongs to the study as it was here: a conversion would apply a value read
  // before (review of e6b8f15, item 18). Locking closes them, and so does taking the study over.
  // (the same closing as when another model comes in: app.closeTransient, files.js)
  const closeOpen = () => app.closeTransient();
  // "Use here": the study as the other tab last saved it. Its history stays in the other tab: the undo and redo of this
  // tab hold copies of a revision left behind, so they are dropped (review of e6b8f15, item 17)
  function takeOver(note) {
    if (asking) { clearTimeout(asking.timer); asking = null; }
    const m = app.storedModel();
    closeOpen();
    claim();
    if (m) {
      try {
        app.loadModel(m, note ? { note } : undefined);
        app.undoStack = [];
        app.redoStack = [];
        seen = get(KEY.model);
      } catch (e) { /* the model of this tab stays, with its history */ }
    }
  }
  // "Use here": the owner is asked to hand the study over; a second click while it is asked does nothing
  function useHere() {
    if (asking || active) return;
    const o = get(KEY.owner);
    if (o === null || o === me) { takeOver(); return; }
    const n = Math.random();
    if (!set(KEY.handover, JSON.stringify({ from: me, to: o, n, at: Date.now() }))) { takeOver(); return; }
    asking = { n, timer: setTimeout(() => { asking = null; takeOver(); }, WAIT) };
  }
  // the owner asked for the study: the field being edited is written and saved, then the asking tab is the owner
  function handOver(p) {
    app.commitPending();
    if (!stillOwner()) return;
    app.save();
    if (set(KEY.owner, p.from)) lock('lost');
  }

  window.addEventListener('storage', (e) => {
    if (e.key === KEY.ping && active && e.newValue) {
      const p = parse(e.newValue);
      if (p && p.from !== me) set(KEY.pong, JSON.stringify({ to: p.from, n: Math.random() }));
    } else if (e.key === KEY.pong && waiting && e.newValue) {
      const p = parse(e.newValue);
      if (p && p.to === me) answered = true;
    } else if (e.key === KEY.handover && active && e.newValue) {
      const p = parse(e.newValue);
      if (p && p.to === me && p.from !== me && Math.abs(Date.now() - p.at) < FRESH && get(KEY.owner) === me) handOver(p);
    } else if (e.key === KEY.owner) {
      // the owner stored now, not the value of the event: an event delivered late (a page shown again from the cache
      // of the browser gets the events of while it was kept) must not lock the owner (review of c3b3ec4, TODO b)
      const o = get(KEY.owner);
      if (asking && o === me) takeOver();
      else if (active && o !== null && o !== me) lock('lost');
    }
  });

  // a locked tab takes no keys (undo, delete, shortcuts) and no dropped or pasted files: only its own button works. A
  // key on that button still reaches no shortcut of the app (Delete there removed the selection: review of e6b8f15), but
  // keeps what the browser does with it (Enter and Space press the button, Tab moves the focus)
  for (const type of ['keydown', 'drop', 'dragover', 'paste']) {
    window.addEventListener(type, (e) => {
      if (state === null) return;
      const box = $('#tab-lock');
      if (!(type === 'keydown' && box && box.contains(e.target))) e.preventDefault();
      e.stopImmediatePropagation();
    }, true);
  }

  // the field being edited is written before the page goes, and the study is given back
  function leaving() {
    if (active) app.commitPending();
  }
  window.addEventListener('beforeunload', leaving);
  window.addEventListener('pagehide', () => {
    leaving();
    if (active && get(KEY.owner) === me) del(KEY.owner);
  });
  // a page the browser kept and shows again (back or forward): it took the study back unless another tab has it now.
  // When another tab saved the study meanwhile, the page opens it as saved, without the history of the revision left
  // behind (review of c3b3ec4, TODO b: the page kept its older model and saved it over the newer one)
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted || !active) return;
    const o = get(KEY.owner);
    if (o === null) set(KEY.owner, me); else if (o !== me) { lock('lost'); return; }
    const now = get(KEY.model);
    if (now !== null && seen !== null && now !== seen) takeOver(t('app.tabLock.reloaded'));
  });

  // at the start, before the model opens (it opens either way, to be seen behind the lock): with an owner stored,
  // nothing is saved until it answers or the wait ends
  function start() {
    $('#tab-lock-use').addEventListener('click', useHere);
    if (get(KEY.owner) === null) { claim(); return; }
    if (!set(KEY.ping, JSON.stringify({ from: me, n: Math.random() }))) return;
    waiting = true;
    active = false;
    setTimeout(() => {
      waiting = false;
      if (answered) lock('busy'); else claim();
    }, WAIT);
  }

  PumpIt.ui.singleTab = { start, state: () => state, id: () => me };
})(window);
