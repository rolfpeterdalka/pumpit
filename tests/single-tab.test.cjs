// One tab edits the study at a time (src/ui/app/single-tab.js), checked with tabs that share one browser storage.
// Usage: node tests/single-tab.test.cjs
// Each tab is a context of its own with the module, a stand-in of the app and of the page; the shared storage
// delivers a "storage" event to the other tabs after each write, as the browser does.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { ROOT } = require('./load-core');

let pass = 0, fail = 0;
function ok(name, cond, detail = '') {
  if (cond) pass++; else fail++;
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (detail ? '  ' + detail : ''));
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------ the storage of the browser, shared by the tabs
const data = new Map();
const tabs = new Set();
function storageFor(win) {
  const write = (k, v) => {
    const old = data.has(k) ? data.get(k) : null;
    if (v === null) data.delete(k); else data.set(k, String(v));
    // a page kept by the browser (frozen) gets its events when it is shown again, after its pageshow
    for (const w of tabs) if (w !== win && w.open) {
      const e = { key: k, oldValue: old, newValue: v === null ? null : String(v) };
      if (w.frozen) w.queue.push(e); else setTimeout(() => w.fire('storage', e), 0);
    }
  };
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => write(k, v),
    removeItem: (k) => write(k, null),
  };
}

// ------------------------------------------------------------ a tab
function el(id, tag = 'DIV') {
  return { id, tagName: tag, hidden: true, inert: false, textContent: '', listeners: {}, children: [], parentElement: null,
    addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }, click() { (this.listeners.click || []).forEach((f) => f({})); },
    focus() { page.focused = this; }, contains(n) { return n === this || this.children.includes(n); }, matches: () => false };
}
let page = {};
function openTab(name, stored) {
  const body = el('body', 'BODY'), appBox = el('app'), lock = el('tab-lock'), offer = el('tour-offer');
  const parts = { title: el('tab-lock-title'), text: el('tab-lock-text'), hint: el('tab-lock-hint'), use: el('tab-lock-use', 'BUTTON') };
  lock.children = Object.values(parts);
  appBox.children = [lock]; lock.parentElement = appBox;
  body.children = [appBox, offer]; appBox.parentElement = body; offer.parentElement = body;
  const byId = { 'tab-lock': lock, 'tab-lock-title': parts.title, 'tab-lock-text': parts.text, 'tab-lock-hint': parts.hint, 'tab-lock-use': parts.use };
  const win = { name, open: true, frozen: false, queue: [], listeners: {},
    addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
    fire(t, extra = {}) { let stop = false; const e = Object.assign({ type: t, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { stop = true; } }, extra); (this.listeners[t] || []).forEach((f) => { if (!stop) f(e); }); this.lastPrevented = !!e.prevented; return stop; } };
  const saved = [];
  const field = { typed: null };
  const dialogs = { open: false, isModalOpen: () => dialogs.open, closeModal() { dialogs.open = false; } };
  const app = {
    model: stored ? JSON.parse(stored) : { pipes: [] },
    undoStack: [], redoStack: [], menusHidden: 0, hideMenus() { app.menusHidden++; },
    save() { storageFor(win).setItem('pumpit.model', JSON.stringify(app.model)); saved.push(JSON.stringify(app.model)); },
    savePrefs() {},
    storedModel: () => (data.has('pumpit.model') ? JSON.parse(data.get('pumpit.model')) : null),
    loadModel(m, o) { app.model = m; app.loadNote = o && o.note; },
    // as in src/ui/app/files.js
    closeTransient() { if (dialogs.isModalOpen()) dialogs.closeModal(); app.hideMenus(); },
    // a field of the inspector being edited writes its value when it loses the focus (as app.commitPending, files.js)
    commitPending() { if (field.typed !== null) { const v = field.typed; field.typed = null; app.model = Object.assign({}, app.model, { len: v }); app.save(); } },
  };
  const ctx = vm.createContext({
    console, setTimeout, clearTimeout, Math, Date, JSON,
    localStorage: storageFor(win),
    document: { body, get activeElement() { return body; } },
  });
  Object.assign(ctx, { window: ctx, addEventListener: win.addEventListener.bind(win) });
  ctx.PumpIt = { app, ui: { dom: { $: (s) => byId[s.slice(1)] }, tips: null, dialogs }, i18n: { t: (k) => k } };
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/ui/app/single-tab.js'), 'utf8'), ctx, { filename: 'single-tab.js' });
  tabs.add(win);
  const tab = { name, win, app, lock, offer, use: parts.use, title: parts.title, saved, dialogs,
    single: ctx.PumpIt.ui.singleTab,
    edit(len) { app.model = Object.assign({}, app.model, { len }); app.save(); },
    type(len) { field.typed = len; },
    // the page goes to another address of the site and the browser keeps it; shown again, pageshow comes before the
    // events of while it was kept
    keep() { win.fire('pagehide'); win.frozen = true; },
    showAgain() { win.frozen = false; win.fire('pageshow', { persisted: true }); const q = win.queue.splice(0); setTimeout(() => q.forEach((e) => win.fire('storage', e)), 0); },
    close() { win.fire('pagehide'); win.open = false; tabs.delete(win); },
    crash() { win.open = false; tabs.delete(win); } };
  tab.single.start();
  return tab;
}

(async () => {
  console.log('\nOne tab edits the study at a time');
  data.set('pumpit.model', JSON.stringify({ len: 300 }));
  const A = openTab('A');
  ok('the first tab edits at once and is the owner', A.app.tabActive() && data.get('pumpit.owner') === A.single.id() && A.lock.hidden);
  A.edit(1200);
  ok('… and saves (1200)', JSON.parse(data.get('pumpit.model')).len === 1200);

  const B = openTab('B', data.get('pumpit.model'));
  ok('a second tab saves nothing while the owner is asked', !B.app.tabActive());
  await wait(900);
  ok('the owner answers: the second tab is locked, with its text and the button focused',
    B.single.state() === 'busy' && !B.lock.hidden && B.title.textContent === 'app.tabLock.busyTitle' && page.focused === B.use, B.single.state());
  ok('… everything else on its page is inert, up to the body (a card of the tour outside the app too)', B.offer.inert && !B.lock.inert);
  B.edit(30);
  ok('… an edit in the locked tab is not saved', JSON.parse(data.get('pumpit.model')).len === 1200 && !B.saved.length);
  ok('… and it takes no key', B.win.fire('keydown', { target: {} }) === true && B.win.lastPrevented);
  ok('… a key on its button (Delete) reaches no shortcut of the app, and Enter keeps pressing the button', B.win.fire('keydown', { key: 'Delete', target: B.use }) === true && !B.win.lastPrevented);
  ok('the owner still edits', A.app.tabActive() && A.single.state() === null);

  // review of e6b8f15, items 17 and 18: B had a history and a window open before, and A has a conversion open
  B.app.undoStack = ['{"len":300}']; B.app.redoStack = ['{"len":5}']; B.dialogs.open = true;
  A.dialogs.open = true; const menusA = A.app.menusHidden;
  B.use.click();
  await wait(50);
  ok('"Use here" drops the undo and redo of the revision left behind, and closes what was open', !B.app.undoStack.length && !B.app.redoStack.length && !B.dialogs.open);
  ok('"Use here" opens the study as last saved (1200) and takes over', B.app.tabActive() && B.app.model.len === 1200 && data.get('pumpit.owner') === B.single.id() && B.lock.hidden);
  ok('… the other tab is told and locks itself', !A.app.tabActive() && A.single.state() === 'lost' && A.title.textContent === 'app.tabLock.lostTitle');
  ok('… and its conversion and menus open are closed: nothing applies a value read before', !A.dialogs.open && A.app.menusHidden > menusA);
  B.app.model = Object.assign({}, B.app.model, { p1: 30 }); B.app.save();
  A.edit(300);
  const st = JSON.parse(data.get('pumpit.model'));
  ok('the report of d05430d, item 12: P1 changed in B keeps P3 changed in A (1200), and A can no longer write back 300', st.len === 1200 && st.p1 === 30, JSON.stringify(st));

  // an owner told of another one only when it saves (an event missed)
  data.set('pumpit.owner', 'someone-else');
  const n = B.saved.length;
  B.edit(5);
  ok('an owner whose id was replaced stops saving at its next save and locks', B.saved.length === n && B.single.state() === 'lost' && JSON.parse(data.get('pumpit.model')).len === 1200);

  // the owner closes: the next tab edits at once
  data.set('pumpit.owner', B.single.id()); B.use.click();
  ok('"Use here" with this tab stored as the owner takes over at once', B.app.tabActive() && B.single.state() === null);
  B.close();
  ok('closing the owner gives the study back', !data.has('pumpit.owner'));
  const C = openTab('C', data.get('pumpit.model'));
  ok('… and the next tab edits at once', C.app.tabActive() && C.single.state() === null);

  // a tab that ended without giving the study back (a crash): no answer, so the next tab takes over after the wait
  C.crash();
  ok('a crashed owner leaves its id', data.get('pumpit.owner') === C.single.id());
  const D = openTab('D', data.get('pumpit.model'));
  await wait(900);
  ok('… nobody answers, and the new tab edits after the wait', D.app.tabActive() && D.single.state() === null && data.get('pumpit.owner') === D.single.id());
  ok('… the locked tab A takes no part (it does not answer for the owner)', A.single.state() === 'lost');

  // a page the browser keeps when it is left (back or forward) and shows again: it gave the study back when it went
  D.win.fire('pagehide'); D.win.open = false;
  ok('a page kept by the browser gives the study back as it goes', !data.has('pumpit.owner'));
  D.win.open = true; D.win.fire('pageshow', { persisted: true });
  ok('… shown again with nobody else editing, it takes the study back', data.get('pumpit.owner') === D.single.id() && D.app.tabActive() && D.single.state() === null);
  D.win.fire('pagehide'); D.win.open = false;
  const G = openTab('G', data.get('pumpit.model'));
  D.win.open = true; D.win.fire('pageshow', { persisted: true });
  ok('… shown again after another tab took over, it locks itself', G.app.tabActive() && !D.app.tabActive() && D.single.state() === 'lost' && data.get('pumpit.owner') === G.single.id());

  // two tabs that open at the same moment, the first one edits, the other is locked
  G.close(); D.close(); A.close();
  const E = openTab('E'), F = openTab('F');
  await wait(900);
  ok('two tabs opened together: one edits and the other is locked', [E, F].filter((x) => x.app.tabActive()).length === 1 && [E, F].some((x) => x.single.state() !== null && !x.lock.hidden));

  // review of c3b3ec4, item 1: 1600 typed in A (the cursor still in the field), then "Use here" in B
  console.log('\n"Use here" asks the owner for the study (review of c3b3ec4, item 1)');
  E.close(); F.close();
  data.clear(); data.set('pumpit.model', JSON.stringify({ len: 800 }));
  const A3 = openTab('A3', data.get('pumpit.model'));
  const B3 = openTab('B3', data.get('pumpit.model'));
  await wait(900);
  A3.type(1600);
  B3.use.click();
  B3.use.click();
  ok('B asks and waits: still locked, nothing opened yet', !B3.app.tabActive() && B3.app.model.len === 800);
  await wait(50);
  ok('A writes the field and saves before it hands over: B opens 1600 (was 800)',
    B3.app.tabActive() && B3.app.model.len === 1600 && JSON.parse(data.get('pumpit.model')).len === 1600 && data.get('pumpit.owner') === B3.single.id(), String(B3.app.model.len));
  ok('… A is locked, and a second click in B asked nothing more', !A3.app.tabActive() && A3.single.state() === 'lost' && B3.single.state() === null);
  A3.use.click();
  await wait(50);
  ok('back to A with "Use here": 1600 there too (was 800)', A3.app.tabActive() && A3.app.model.len === 1600 && !B3.app.tabActive());
  const reopened = openTab('R3', data.get('pumpit.model'));
  ok('… and in a page opened afterwards', reopened.app.model.len === 1600);
  await wait(900);
  reopened.close();
  // a request for another owner, or an old one, is not answered
  const stale = (extra) => { data.set('pumpit.handover', JSON.stringify(Object.assign({ from: 'x', to: A3.single.id(), n: 1, at: Date.now() }, extra))); A3.win.fire('storage', { key: 'pumpit.handover', newValue: data.get('pumpit.handover') }); };
  stale({ to: 'someone' }); stale({ at: Date.now() - 60000 });
  ok('a request for another tab, or an old one, is not answered', A3.app.tabActive() && data.get('pumpit.owner') === A3.single.id());
  // the owner does not answer (a crash): the asking tab takes over after the wait
  const B4 = openTab('B4', data.get('pumpit.model'));
  await wait(900);
  A3.crash();
  B4.use.click();
  await wait(100);
  ok('an owner that does not answer: the asking tab still locked during the wait', !B4.app.tabActive());
  await wait(800);
  ok('… and takes over after it', B4.app.tabActive() && data.get('pumpit.owner') === B4.single.id() && B4.app.model.len === 1600);
  B4.close();

  // review of c3b3ec4, TODO b: A leaves for another page of the site, B opens, saves 1600 and closes, A comes back
  console.log('\nA page shown again from the cache of the browser (review of c3b3ec4, TODO b)');
  data.clear(); data.set('pumpit.model', JSON.stringify({ len: 800 }));
  const A5 = openTab('A5', data.get('pumpit.model'));
  A5.keep();
  const B5 = openTab('B5', data.get('pumpit.model'));
  ok('B opens at once while A is kept by the browser', B5.app.tabActive());
  B5.edit(1600);
  B5.close();
  A5.showAgain();
  await wait(30);
  ok('A comes back as the owner and is not locked by the events of while it was kept (was locked)',
    A5.app.tabActive() && A5.single.state() === null && data.get('pumpit.owner') === A5.single.id() && A5.lock.hidden, String(A5.single.state()));
  ok('… with the study as B saved it (1600; was 800), without the history, and says so',
    A5.app.model.len === 1600 && !A5.app.undoStack.length && A5.app.loadNote === 'app.tabLock.reloaded', String(A5.app.model.len));
  A5.edit(1700);
  ok('… and it saves', JSON.parse(data.get('pumpit.model')).len === 1700);
  // nothing changed while it was kept: the page stays as it is
  A5.app.undoStack = ['{"len":1}']; A5.app.loadNote = null;
  A5.keep(); A5.showAgain();
  await wait(30);
  ok('a page shown again when nobody saved meanwhile keeps its model and history', A5.app.model.len === 1700 && A5.app.undoStack.length === 1 && !A5.app.loadNote);
  A5.close();

  console.log(`\n${pass} checks passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
