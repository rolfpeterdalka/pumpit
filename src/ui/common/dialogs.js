// Transient messages and dialogs: toast, modal box, text prompt, confirmation and copy-to-clipboard.
(function (root) {
  const PumpIt = root.PumpIt;
  const F = PumpIt.ui.format;
  const { $ } = PumpIt.ui.dom;
  const { t } = PumpIt.i18n;

  function toast(msg) {
    const box = $('#toast');
    box.textContent = msg;
    box.hidden = false;
    clearTimeout(toast.h);
    toast.h = setTimeout(() => { box.hidden = true; }, 3800);
  }

  // The box keeps the focus while it is open: what is behind it (the page, and a window it was opened over) takes no
  // focus and no clicks, and Tab and Shift+Tab go round its visible and enabled controls. It opens on its first field,
  // or on its main action, and gives the focus back, when it closes, to the control that opened it (the same control
  // drawn again, found by its id), inside the window it was opened over.
  let opener = null, openerId = null;
  let inerted = []; // the elements the box made inert (those already inert, behind a window, stay as they were)

  // the model open in the editor (PumpIt.app.modelGen): a box opened for one model does nothing in another
  const modelGen = () => (PumpIt.app ? PumpIt.app.modelGen : 0);

  // actions: [{ label, primary, onClick }]; onClick returning false keeps the box open. opener: the control that opens
  // the box, when it is not the one with the focus. An action of a box opened before another model came in only closes
  // the box (review of e81e282, item 3)
  function modal({ title, body, actions, opener: from }) {
    const made = modelGen();
    if (PumpIt.ui.tips) PumpIt.ui.tips.hide(); // a note left open by the field behind would cover the box
    if (!isModalOpen()) {
      const o = from || document.activeElement;
      opener = o && o !== document.body ? o : null;
      openerId = opener && opener.id ? opener.id : null;
    }
    $('#modal-title').textContent = title;
    const b = $('#modal-body');
    b.innerHTML = '';
    if (typeof body === 'string') b.innerHTML = body; else if (body) b.appendChild(body);
    const a = $('#modal-actions');
    a.innerHTML = '';
    for (const act of actions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn' + (act.primary ? ' primary' : '');
      btn.textContent = act.label;
      btn.addEventListener('click', () => {
        if (made === modelGen() && act.onClick && act.onClick() === false) return;
        closeModal();
      });
      a.appendChild(btn);
    }
    if (isModalOpen()) { focusFirst(); return; }
    $('#modal').hidden = false;
    // everything else in the app, the windows included, keeps still behind the box
    const box = $('#modal');
    inerted = [...box.parentElement.children].filter((e) => e !== box && e.id !== 'toast' && !e.inert).map((e) => { e.inert = true; return e; });
    focusFirst();
  }
  // the first field of the box, or else its main action (or its first control that can take the focus)
  function focusFirst() {
    const box = $('#modal .modal');
    const reach = PumpIt.ui.focusKeep.tabbables(box);
    const first = reach.find((e) => e.matches('input, textarea, select')) || reach.find((e) => e.matches('.primary')) || reach[0];
    if (first) first.focus(); else box.focus();
  }
  function closeModal() {
    if (!isModalOpen()) return;
    $('#modal').hidden = true;
    inerted.forEach((e) => { e.inert = false; });
    inerted = [];
    // the control that opened the box, or its new copy; a menu item, hidden again, gives the focus to its menu
    let to = opener && opener.isConnected ? opener : openerId ? document.getElementById(openerId) : null;
    opener = null; openerId = null;
    if (to && !PumpIt.ui.focusKeep.tabbables(to.parentElement || document).includes(to)) {
      const menu = to.closest('.menu');
      to = menu ? menu.querySelector('[data-menu]') : null;
    }
    if (to) to.focus({ preventScroll: true });
  }
  const isModalOpen = () => !$('#modal').hidden;
  // Tab and Shift+Tab go round the controls of the box
  function trap(e) {
    if (e.key !== 'Tab' || !isModalOpen()) return;
    const reach = PumpIt.ui.focusKeep.tabbables($('#modal .modal'));
    e.preventDefault();
    if (!reach.length) return;
    const i = reach.indexOf(document.activeElement);
    const next = e.shiftKey ? reach[i <= 0 ? reach.length - 1 : i - 1] : reach[i < 0 || i === reach.length - 1 ? 0 : i + 1];
    next.focus();
  }

  function askText(title, label, initial, onOk) {
    const wrap = document.createElement('div');
    wrap.innerHTML = `<label class="muted small" for="ask-in">${F.esc(label)}</label>`;
    const inp = document.createElement('input');
    inp.type = 'text'; inp.id = 'ask-in'; inp.value = initial || '';
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#modal-actions .primary').click(); } });
    wrap.appendChild(inp);
    modal({ title, body: wrap, actions: [{ label: t('app.dialog.cancel') }, { label: t('app.dialog.ok'), primary: true, onClick: () => { const v = inp.value.trim(); if (!v) return false; onOk(v); } }] });
  }

  function confirmBox(title, text, okLabel, onOk) {
    modal({ title, body: `<p class="muted" style="margin:0">${F.esc(text)}</p>`, actions: [{ label: t('app.dialog.cancel') }, { label: okLabel, primary: true, onClick: onOk }] });
  }

  // copies text to the clipboard; when that is not allowed, shows it in a box to copy by hand
  function copyText(text, okMsg) {
    const fallback = () => modal({ title: t('app.dialog.copyTitle'), body: `<textarea id="copy-area" readonly>${F.esc(text)}</textarea>`, actions: [{ label: t('app.dialog.close'), primary: true }] });
    try {
      navigator.clipboard.writeText(text).then(() => toast(okMsg), () => { fallback(); setTimeout(() => $('#copy-area') && $('#copy-area').select(), 30); });
    } catch (e) { fallback(); }
  }

  // clicking the dimmed background closes the box
  function bind() {
    $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
    $('#modal').addEventListener('keydown', trap);
    $('#modal .modal').tabIndex = -1; // a box with nothing to focus takes the focus itself
  }

  PumpIt.ui.dialogs = { toast, modal, closeModal, isModalOpen, askText, confirmBox, copyText, bind };
})(typeof window !== 'undefined' ? window : globalThis);
