// Field builders of the inspector. Every field reads the effective value of the current scenario and writes
// through app.setVal, which applies the scenario inheritance rule. Quantities are stored as { value, unit },
// as typed.
(function (root) {
  const PumpIt = root.PumpIt;
  const U = PumpIt.units, UI = PumpIt.ui;
  const F = UI.format;
  const { el } = UI.dom;
  const app = PumpIt.app;
  const { t } = PumpIt.i18n;

  const idOf = (objKey, path) => ('f-' + objKey + '-' + path).replace(/[^a-zA-Z0-9_-]/g, '_');
  // what a field writes, into the model it was drawn for: a field left after another model came in (its change fires
  // as it loses the focus) writes nothing into the new one (review of e81e282, item 2)
  function writer() {
    const gen = app.modelGen;
    return (objKey, path, value) => { if (gen === app.modelGen) app.setVal(objKey, path, value); };
  }

  // The fields built while describe() runs, by 'objKey|path': their label and what reads their value (the category of a
  // quantity, the options of a list, a check box, the suffix of a number, the axes of a curve). The table of the
  // differences of a scenario (src/ui/topbar/scenarios.js) names and writes its values as the inspector does.
  let rec = null;
  function remember(objKey, path, meta) {
    if (!rec || !objKey) return;
    const k = objKey + '|' + path;
    rec[k] = Object.assign(rec[k] || {}, meta);
  }
  // build: draws a panel (off the page); returns what its fields were
  function describe(build) {
    const prev = rec;
    const got = (rec = {});
    try { build(); } catch (e) { /* a panel that fails off the page still gives the fields built before */ } finally { rec = prev; }
    return got;
  }

  // a note on a field or a section: an "i" in a circle that shows the text (HTML from the catalogs) while the pointer
  // rests on it or it has the focus (the bubble: src/ui/common/tips.js)
  const INFO_ICON = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="4.9" r="1" fill="currentColor"/><path d="M8 7.3v4.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  let notes = 0;
  function info(html) {
    const id = 'note-' + ++notes;
    const b = el('button', { type: 'button', class: 'info', 'aria-label': t('inspector.fields.info'), 'aria-describedby': id }, INFO_ICON);
    b.appendChild(el('span', { class: 'info-text', id, hidden: true }, html));
    return b;
  }
  // adds a note to a section (its title gets the "i"; a second note joins the first one)
  function note(sec, html) {
    const h = sec.querySelector(':scope > h4');
    if (!h) { sec.appendChild(hint(html)); return; }
    const old = h.querySelector('.info-text');
    if (old) old.insertAdjacentHTML('beforeend', `<br><br>${html}`); else h.appendChild(info(html));
  }

  // opts.info: a note on the section, by its title
  function section(title, opts = {}) {
    const s = el('div', { class: 'insp-sec' });
    if (title) s.appendChild(el('h4', {}, F.esc(title)));
    if (opts.info) note(s, opts.info);
    return s;
  }

  // label + control; an overridden attribute gets a dot that restores the inherited value; opts.info: a note, whose
  // "i" stands next to the label (outside it, so the label alone stays the name of the control)
  function wrap(objKey, path, label, ctl, opts = {}) {
    if (!(rec && rec[objKey + '|' + path] && rec[objKey + '|' + path].label)) remember(objKey, path, { label });
    const f = el('div', { class: 'field' + (opts.check ? ' check' : '') + (opts.wide ? ' wide' : '') });
    const lab = el('label', { for: ctl.id || null });
    lab.textContent = label;
    // bare: the section title already names the field; the label stays for screen readers (and the override dot)
    if (opts.bare) lab.classList.add('sr-label');
    if (opts.title) lab.title = opts.title;
    // derived: a value that follows from other fields (the section of a catalogue pipe), with no restore of its own
    if (objKey && !opts.derived && app.isOv(objKey, path)) {
      f.classList.add('overridden');
      const dot = el('button', { class: 'ov-dot', type: 'button', title: t('inspector.fields.overridden'), 'aria-label': t('inspector.fields.restore') });
      dot.addEventListener('click', () => app.clearOv(objKey, path));
      lab.prepend(dot);
    }
    const c = el('div', { class: 'ctl' });
    c.appendChild(ctl);
    if (opts.after) c.appendChild(opts.after);
    let head = lab;
    if (opts.info) { head = el('div', { class: 'lab' }); head.append(lab, info(opts.info)); }
    if (opts.check) { f.appendChild(c); f.appendChild(head); } else { f.appendChild(head); f.appendChild(c); }
    return f;
  }

  // only (optional): a test of the units offered (the flows of a gas over time leave out the volumes at the conditions of
  // the pipe)
  function unitOptions(cat, current, only) {
    // a flow: mass or volume; for a gas (compressible mode) also a normal volume (§8.4)
    const gas = cat === 'flow' && PumpIt.model.isCompressible(app.eff());
    let units = cat === 'flow' ? U.list('massFlow').concat(U.list('volFlow'), gas ? U.list('normFlow') : []) : U.list(cat);
    if (only) units = units.filter(only);
    if (current && !units.includes(current)) units.unshift(current);
    return units.map((u) => `<option value="${F.esc(u)}"${u === current ? ' selected' : ''}>${F.esc(F.unit(u))}</option>`).join('');
  }

  // quantity with a unit
  function qty(objKey, path, label, cat, opts = {}) {
    remember(objKey, path, { cat });
    const v = app.getVal(objKey, path) || { value: NaN, unit: U.list(cat)[0] };
    const id = idOf(objKey, path), set = writer();
    const inp = el('input', { type: 'text', id, inputmode: 'decimal', autocomplete: 'off', disabled: opts.disabled });
    inp.value = F.inputStr(v.value);
    // the input unit: changing it keeps the number (15 m becomes 15 mm), as its note says when it gets the focus
    const us = el('select', {
      class: 'unit has-tip', 'aria-label': t('inspector.fields.unitOf', { label }), 'aria-describedby': unitTip(),
      id: id + '-u', disabled: opts.disabled,
    }, unitOptions(cat, v.unit));
    inp.addEventListener('change', () => {
      if (badNumber(inp)) return;
      const n = F.parseNum(inp.value);
      set(objKey, path, { value: Number.isFinite(n) ? n : null, unit: us.value });
    });
    // the number in the field, which a click on the selector may have just confirmed
    us.addEventListener('change', () => { if (badNumber(inp)) { us.value = v.unit; return; } const n = F.parseNum(inp.value); set(objKey, path, { value: Number.isFinite(n) ? n : null, unit: us.value }); });
    return wrap(objKey, path, label, inp, Object.assign({}, opts, { after: unitCtl(objKey, path, label, cat, inp, us, opts.disabled) }));
  }

  // the unit selector of a quantity and, beside it, the button that converts the value to another unit (a command of
  // its own: src/ui/inspector/value-convert.js); a number typed and not yet confirmed is confirmed first, as leaving
  // the field would
  function unitCtl(objKey, path, label, cat, inp, us, disabled) {
    const cv = el('button', {
      type: 'button', class: 'conv-btn', id: us.id.replace(/-u$/, '-c'), disabled,
      title: t('inspector.fields.convert'), 'aria-label': t('inspector.fields.convertOf', { label }),
    }, CONVERT_ICON);
    cv.addEventListener('click', () => {
      const q = app.getVal(objKey, path), n = F.parseNum(inp.value);
      const stored = q && Number.isFinite(q.value) ? q.value : NaN;
      if (!(n === stored || (Number.isNaN(n) && Number.isNaN(stored)))) inp.dispatchEvent(new Event('change'));
      UI.valueConvert.open(objKey, path, label, cat, cv);
    });
    const span = el('span', { class: 'unit-ctl' });
    span.append(us, cv);
    return span;
  }

  // the note of every input unit selector: one hidden text in the page, kept in the current language
  const CONVERT_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2.5 5.5h10M10 3l2.5 2.5L10 8M13.5 10.5h-10M6 8l-2.5 2.5L6 13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function unitTip() {
    const id = 'tip-input-unit';
    if (!document.getElementById(id)) {
      const s = el('span', { id, class: 'info-text', hidden: true, 'data-i18n': 'inspector.fields.unitTip' });
      s.textContent = t('inspector.fields.unitTip');
      document.body.appendChild(s);
    }
    return id;
  }

  // A text typed in a number field that is not a number (one with the decimal mark not in use, as "1.5" with a decimal
  // comma) changes nothing: the field keeps the text, is marked invalid and a message says which mark is in use. The
  // model keeps its value, shown again when the field is drawn again. An empty field still clears the value.
  function badNumber(inp) {
    const text = String(inp.value).trim();
    if (text === '' || Number.isFinite(F.parseNum(text))) { inp.removeAttribute('aria-invalid'); return false; }
    inp.setAttribute('aria-invalid', 'true');
    // a space, a tab or a line break inside: cells of a spreadsheet pasted together, and the field takes one value
    if (/\s/.test(text)) { app.toast(t('app.numberOneValue', { text: text.replace(/\s+/g, ' ') })); return true; }
    app.toast(t('app.numberInvalid',{ text, mark: t(F.decimalSep() === ',' ? 'app.menu.decimalComma' : 'app.menu.decimalPoint') }));
    return true;
  }

  // plain number
  function num(objKey, path, label, opts = {}) {
    remember(objKey, path, { suffix: opts.suffix });
    const v = app.getVal(objKey, path);
    const id = idOf(objKey, path), set = writer();
    const inp = el('input', { type: 'text', id, inputmode: 'decimal', autocomplete: 'off', disabled: opts.disabled });
    inp.value = F.inputStr(v);
    inp.addEventListener('change', () => {
      if (badNumber(inp)) return;
      let n = F.parseNum(inp.value);
      if (opts.int && Number.isFinite(n)) n = Math.round(n);
      set(objKey, path, Number.isFinite(n) ? n : null);
    });
    const after = opts.suffix ? el('span', { class: 'muted small', style: 'align-self:center;padding:0 2px' }, F.esc(opts.suffix)) : null;
    return wrap(objKey, path, label, inp, Object.assign({}, opts, { after }));
  }

  // list of options: [[value, label], ...]
  function sel(objKey, path, label, options, opts = {}) {
    remember(objKey, path, { options });
    const v = app.getVal(objKey, path);
    const id = idOf(objKey, path), set = writer();
    const s = el('select', { id, disabled: opts.disabled },
      options.map(([val, lab]) => `<option value="${F.esc(val)}"${String(val) === String(v) ? ' selected' : ''}>${F.esc(lab)}</option>`).join(''));
    s.addEventListener('change', () => {
      const raw = s.value;
      const opt = options.find(([val]) => String(val) === raw);
      set(objKey, path, opt ? opt[0] : raw);
    });
    return wrap(objKey, path, label, s, opts);
  }

  // a choice among a few options shown side by side, as buttons (regime, thermal model): [[value, label], ...]
  function seg(objKey, path, label, options, opts = {}) {
    remember(objKey, path, { options });
    const v = app.getVal(objKey, path);
    const id = idOf(objKey, path), set = writer();
    const g = el('div', { class: 'seg', role: 'radiogroup', id, 'aria-label': label });
    for (const [val, lab] of options) {
      const on = String(val) === String(v);
      const b = el('button', { type: 'button', role: 'radio', 'aria-checked': String(on), class: on ? 'on' : null, 'data-v': val, id: (id + '-' + val).replace(/[^a-zA-Z0-9_-]/g, '_') }, F.esc(lab));
      b.addEventListener('click', () => { if (!on) set(objKey, path, val); });
      g.appendChild(b);
    }
    return wrap(objKey, path, label, g, Object.assign({ wide: true }, opts));
  }

  function chk(objKey, path, label, opts = {}) {
    remember(objKey, path, { check: true });
    const v = !!app.getVal(objKey, path);
    const id = idOf(objKey, path), set = writer();
    const c = el('input', { type: 'checkbox', id });
    c.checked = v;
    c.addEventListener('change', () => set(objKey, path, c.checked));
    return wrap(objKey, path, label, c, Object.assign({ check: true }, opts));
  }

  function text(objKey, path, label, opts = {}) {
    const v = app.getVal(objKey, path) ?? '';
    const id = idOf(objKey, path), set = writer();
    const inp = el('input', { type: 'text', id, class: 'txt', autocomplete: 'off', placeholder: opts.placeholder });
    inp.value = v;
    inp.addEventListener('change', () => set(objKey, path, inp.value));
    return wrap(objKey, path, label, inp, opts);
  }

  // read-only label/value row
  function readout(label, value, title) {
    const r = el('div', { class: 'readout', title });
    r.innerHTML = `<span>${F.esc(label)}</span><b>${F.esc(value)}</b>`;
    return r;
  }
  // a line of text that stays in sight: a state (an isolated pipe, the fitted curve) or an error; notes go in info()
  function hint(t) { return el('p', { class: 'hint' }, t); }

  PumpIt.ui.forms = { el, section, qty, num, sel, seg, chk, text, readout, hint, info, note, unitOptions, unitCtl, unitTip, idOf, badNumber, wrap, remember, describe };
})(typeof window !== 'undefined' ? window : globalThis);
