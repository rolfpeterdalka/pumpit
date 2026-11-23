// A number typed in a cell of a table (the points of a curve, a table of points over time, the fittings of a pipe, the
// losses of a junction). The model keeps the last valid value until a number comes: a text that is not a number stays
// in the cell as a draft, marked invalid, with a message under the table that tells the row, the quantity and the unit,
// and nothing is written or calculated. Esc brings the last value back. A draft outlives a redraw of the panel (found
// again by the id of its cell) while the value it would replace is still the one in the model; opening another model
// drops them all.
//
//   const errs = numCell.errors();            // the list of messages, placed under the table by the caller
//   numCell.input({ id, aria, value, where, empty, onCommit(n), errs, attrs })
//     where: the cell in words, for the message (numCell.where(numCell.row(2), 'Head', 'm') → "Row 2 · Head (m)")
//     empty (optional): the value an empty cell stands for (null: the bottom of a reservoir); without it, an empty
//            cell is an error too
(function (root) {
  const PumpIt = root.PumpIt;
  const UI = PumpIt.ui;
  const F = UI.format;
  const { t } = PumpIt.i18n;
  const tx = (key, params) => t('inspector.fields.' + key, params);

  const drafts = new Map(); // id of the cell → { text, base: the value of the model when it was typed }
  const same = (a, b) => a === b || (a !== a && b !== b) || (a == null && b == null); // eslint-disable-line no-self-compare

  // what a text in a cell means: { value } or { error: 'empty' | 'invalid' }
  function read(text, opts = {}) {
    const s = String(text == null ? '' : text).trim();
    if (s === '') return 'empty' in opts ? { value: opts.empty } : { error: 'empty' };
    const n = F.parseNum(s);
    return Number.isFinite(n) ? { value: n } : { error: 'invalid' };
  }

  // the cell in words: its row ("Row 2", or the name of a pipe), the quantity and its unit
  const row = (n) => tx('cellRow', { n });
  const plain = (s) => String(s == null ? '' : s).replace(/<[^>]*>/g, '').trim();
  const where = (rowText, name, unit) => `${rowText} · ${plain(name)}${unit ? ` (${plain(unit)})` : ''}`;

  // the message of a refused text
  function message(o, text, error) {
    const head = error === 'empty' ? tx('cellEmpty', { where: o.where }) : tx('cellInvalid', { where: o.where, text: String(text).trim() });
    return Number.isFinite(o.value) ? `${head} ${tx('cellRestore', { value: F.inputStr(o.value) })}` : head;
  }

  // the list of messages of a table, read out when one appears
  const errors = () => UI.dom.el('div', { class: 'cell-errs', 'aria-live': 'polite' });

  function input(o) {
    const inp = UI.dom.el('input', Object.assign({ type: 'text', inputmode: 'decimal', autocomplete: 'off', id: o.id, 'aria-label': o.aria }, o.attrs || {}));
    const shown = () => (o.value === null || o.value === undefined ? '' : F.inputStr(o.value));
    const msgId = o.id + '-err';
    function clear() {
      drafts.delete(o.id);
      inp.removeAttribute('aria-invalid');
      inp.removeAttribute('aria-describedby');
      const m = o.errs && o.errs.querySelector(`[id="${CSS.escape(msgId)}"]`);
      if (m) m.remove();
    }
    function refuse(text, error) {
      drafts.set(o.id, { text, base: o.value });
      inp.setAttribute('aria-invalid', 'true');
      if (!o.errs) return;
      let m = o.errs.querySelector(`[id="${CSS.escape(msgId)}"]`);
      if (!m) { m = UI.dom.el('p', { id: msgId, class: 'cell-err' }); o.errs.appendChild(m); }
      m.textContent = message(o, text, error);
      inp.setAttribute('aria-describedby', msgId);
    }
    inp.value = shown();
    // a draft typed before the panel was drawn again
    const d = drafts.get(o.id);
    if (d && same(d.base, o.value)) { inp.value = d.text; refuse(d.text, read(d.text, o).error || 'invalid'); }
    else if (d) drafts.delete(o.id);
    inp.addEventListener('change', () => {
      const r = read(inp.value, o);
      if (r.error) { refuse(inp.value, r.error); return; }
      clear();
      if (same(r.value, o.value)) { inp.value = shown(); return; }
      o.onCommit(r.value);
    });
    // Esc: the last value back (and the window around the table stays open)
    inp.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || (inp.value === shown() && !inp.hasAttribute('aria-invalid'))) return;
      e.preventDefault();
      e.stopPropagation();
      inp.value = shown();
      clear();
    });
    return inp;
  }

  const clearDrafts = () => drafts.clear();

  UI.numCell = { read, row, where, message, errors, input, clearDrafts };
})(typeof window !== 'undefined' ? window : globalThis);
