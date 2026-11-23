// Keeps the focus where the user sends it while a panel is drawn again from scratch. The inspector and the system
// window draw their fields again after every change (inspector.js, system-window.js), and a text field writes its value
// when it is left: its change comes while the browser is moving the focus, and the control the focus was going to is
// replaced under it. So:
//  - Tab and Shift+Tab out of a field that changed: once the panel is drawn again, the focus goes on from the new copy
//    of the field (found by its id) to the next or the previous control, as the key asked;
//  - a click on another control of the same panel: the field's change comes at the press, before the click; the panel
//    is drawn again only once the click has reached its control (a list opened by the press stays open until it
//    closes);
//  - any other redraw: the control that had the focus gets it back in its new copy (by its id), with its text
//    selection, and the panel keeps its scroll.
// It also lists the controls Tab reaches, for the dialogs that keep the focus inside them (dialogs.js).
(function (root) {
  const PumpIt = root.PumpIt;

  let nav = null;      // { id, back }: Tab pressed on a control with an id, while that key press lasts
  let press = null;    // the element pressed, until its click has been delivered
  let changing = null; // the text field whose change is being dispatched
  const waiting = new Map(); // panel host → its redraw, waiting for the press to end

  const isText = (el) => !!el && el.matches && el.matches('input[type="text"], textarea');

  // ------------------------------------------------------------ the controls Tab reaches
  const FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex]';
  function reachable(el) {
    if (el.disabled || el.tabIndex < 0 || el.type === 'hidden' || el.closest('[inert], [hidden]')) return false;
    if (!el.getClientRects().length) return false;
    return getComputedStyle(el).visibility !== 'hidden';
  }
  const tabbables = (scope = document) => [...scope.querySelectorAll(FOCUSABLE)].filter(reachable);
  // the control Tab (or Shift+Tab, back) reaches from el, in the order of the page
  function step(el, back) {
    const all = [...document.querySelectorAll(FOCUSABLE)].filter((e) => e === el || reachable(e));
    const i = all.indexOf(el);
    return i < 0 ? null : all[i + (back ? -1 : 1)] || null;
  }

  // ------------------------------------------------------------ what the user is doing
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || e.ctrlKey || e.altKey || e.metaKey) return;
    const a = document.activeElement;
    nav = a && a.id ? { id: a.id, back: e.shiftKey } : null;
    setTimeout(() => { nav = null; }, 0); // the focus moves within the key press
  }, true);
  document.addEventListener('change', (e) => {
    changing = isText(e.target) ? e.target : null;
    setTimeout(() => { changing = null; }, 0);
  }, true);
  root.addEventListener('change', () => { changing = null; }); // after the handlers of the field
  document.addEventListener('pointerdown', (e) => { press = e.target; }, true);
  const released = () => setTimeout(flush, 0); // after the click that follows the release
  document.addEventListener('pointerup', released, true);
  document.addEventListener('pointercancel', released, true);
  root.addEventListener('blur', released); // the window lost the focus during the press: no release comes

  // ------------------------------------------------------------ a press on another control of the panel
  // true when the redraw of host must wait: a text field of host is being left for a control of host just pressed
  function defer(host, redraw) {
    if (!changing || !press || !host.contains(changing) || !host.contains(press) || changing.contains(press)) return false;
    waiting.set(host, redraw);
    return true;
  }
  function flush() {
    press = null;
    if (!waiting.size) return;
    // a list opened by the press stays open: the panel is drawn again after its choice, or once it loses the focus
    const a = document.activeElement;
    if (a && a.tagName === 'SELECT' && [...waiting.keys()].some((h) => h.contains(a))) {
      const go = () => { a.removeEventListener('change', go); a.removeEventListener('blur', go); setTimeout(run, 0); };
      a.addEventListener('change', go);
      a.addEventListener('blur', go);
      return;
    }
    run();
  }
  function run() {
    const fns = [...waiting.values()];
    waiting.clear();
    fns.forEach((fn) => fn());
  }

  // ------------------------------------------------------------ around a redraw
  // before host is emptied: where the focus is and where it is going
  function save(host) {
    waiting.delete(host); // this redraw takes the place of one waiting
    const a = document.activeElement;
    const st = { host, scroll: host.scrollTop, id: null, sel: null, to: null, index: -1, tag: '', text: '' };
    if (a && a !== host && host.contains(a)) {
      st.id = a.id || null;
      if (isText(a)) st.sel = [a.selectionStart, a.selectionEnd, a.selectionDirection];
      if (!st.id) { st.index = tabbables(host).indexOf(a); st.tag = a.tagName; st.text = a.textContent; }
    }
    // a field left with Tab: its change is drawing the panel again while the browser moves the focus
    if (changing && nav && changing.id === nav.id && host.contains(changing)) st.to = { from: nav.id, back: nav.back };
    return st;
  }
  // after host is drawn again
  function restore(st) {
    st.host.scrollTop = st.scroll;
    if (st.to) {
      const from = document.getElementById(st.to.from);
      const next = from && step(from, st.to.back);
      if (next) {
        nav = null;
        next.focus({ preventScroll: true });
        next.scrollIntoView({ block: 'nearest' });
        return;
      }
    }
    let f = st.id ? document.getElementById(st.id) : null;
    // a control without an id: the one in the same place, when it is the same kind of control with the same text
    if (!f && st.index >= 0) {
      const c = tabbables(st.host)[st.index];
      if (c && c.tagName === st.tag && c.textContent === st.text) f = c;
    }
    if (!f || !st.host.contains(f)) return;
    f.focus({ preventScroll: true });
    if (st.sel && isText(f)) { try { f.setSelectionRange(...st.sel); } catch (e) { /* not a text control */ } }
  }

  PumpIt.ui.focusKeep = { defer, save, restore, tabbables, step };
})(window);
