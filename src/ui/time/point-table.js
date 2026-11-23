// A table of points in the inspector (the time data of a junction, the volume of a tank by its height, the heat and the
// volume of a gas vessel): two or three columns of numbers, each with its unit, points added, removed or pasted from a
// spreadsheet, and a small plot of the first column of values, in steps or in lines. The table is handed back whole to
// the caller, which writes it into the model.
//
//   build({ id, x: { label, cat, unit, only }, y: { label, cat, unit, only }, y2 (optional, the same), xs, ys, ys2, steps,
//           xEnd, onChange({ xs, ys, ys2, xUnit, yUnit, y2Unit }) })
//   only (optional): a test of the units offered for a column
//   xEnd (optional): where the plot ends, its last value held up to there (the end of the day of a tariff)
//   cat 'none': a number without unit; cat '%': a percentage (no choice of unit)
(function (root) {
  const PumpIt = root.PumpIt;
  const UI = PumpIt.ui;
  const F = UI.format;
  const { el } = UI.dom;
  const NC = UI.numCell;
  const { t } = PumpIt.i18n;
  const tx = (key, params) => t('time.points.' + key, params);

  function build(o) {
    const xs = o.xs.slice(), ys = o.ys.slice();
    const two = !!o.y2;
    const ys2 = two ? (o.ys2 || []).slice() : null;
    if (two) while (ys2.length < xs.length) ys2.push(ys2.length ? ys2[ys2.length - 1] : 0);
    let xUnit = o.x.unit, yUnit = o.y.unit, y2Unit = two ? o.y2.unit : undefined;
    const save = () => o.onChange(two ? { xs, ys, ys2, xUnit, yUnit, y2Unit } : { xs, ys, xUnit, yUnit });
    const wrap = el('div', { class: 'pt-table' });
    const unitSel = (axis, cat, unit, label) => {
      if (cat === 'none' || cat === '%') return null;
      const s = el('select', { class: 'pt-unit', id: `${o.id}-${axis}u`, 'aria-label': t('inspector.fields.unitOf', { label }) }, UI.forms.unitOptions(cat, unit, o[axis].only));
      s.addEventListener('change', () => { if (axis === 'x') xUnit = s.value; else if (axis === 'y') yUnit = s.value; else y2Unit = s.value; save(); });
      return s;
    };
    const table = el('table', { class: 'mini-table' });
    const hr = el('tr');
    const th = (label, sel, suffix) => { const c = el('th', {}, F.esc(label) + (suffix ? ` <span class="muted">${F.esc(suffix)}</span>` : '') + ' '); if (sel) c.appendChild(sel); return c; };
    hr.append(th(o.x.label, unitSel('x', o.x.cat, xUnit, o.x.label)), th(o.y.label, unitSel('y', o.y.cat, yUnit, o.y.label), o.y.cat === '%' ? '%' : ''));
    if (two) hr.appendChild(th(o.y2.label, unitSel('y2', o.y2.cat, y2Unit, o.y2.label), o.y2.cat === '%' ? '%' : ''));
    hr.appendChild(el('th'));
    const thead = el('thead'); thead.appendChild(hr); table.appendChild(thead);
    const tb = el('tbody');
    // a text that is not a number stays in its cell, with its message under the table, and the table keeps its point
    const errs = NC.errors();
    const unitOf = (axis) => {
      const cat = o[axis].cat;
      if (cat === '%') return '%';
      if (cat === 'none') return '';
      return F.unit(axis === 'x' ? xUnit : axis === 'y' ? yUnit : y2Unit);
    };
    xs.forEach((_, i) => {
      const tr = el('tr');
      const cell = (arr, axis, aria) => {
        const inp = NC.input({
          id: `${o.id}-${axis}-${i}`, aria, value: arr[i], errs,
          where: NC.where(NC.row(i + 1), o[axis].label, unitOf(axis)),
          onCommit: (n) => { arr[i] = n; save(); },
        });
        const td = el('td'); td.appendChild(inp); return td;
      };
      const x = el('button', { class: 'row-btn', type: 'button', 'aria-label': tx('remove', { n: i + 1 }) }, '×');
      x.addEventListener('click', () => { xs.splice(i, 1); ys.splice(i, 1); if (two) ys2.splice(i, 1); save(); });
      const tdx = el('td', { class: 'x' }); tdx.appendChild(x);
      tr.append(cell(xs, 'x', tx('pointX', { name: o.x.label, n: i + 1 })), cell(ys, 'y', tx('pointY', { name: o.y.label, n: i + 1 })));
      if (two) tr.appendChild(cell(ys2, 'y2', tx('pointY', { name: o.y2.label, n: i + 1 })));
      tr.appendChild(tdx);
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    wrap.append(table, errs);
    const row = el('div', { class: 'btn-row' });
    const add = el('button', { class: 'btn small', type: 'button' }, F.esc(tx('add')));
    add.addEventListener('click', () => {
      const n = xs.length;
      xs.push(n ? xs[n - 1] + (n > 1 ? xs[n - 1] - xs[n - 2] || 1 : 1) : 0);
      ys.push(n ? ys[n - 1] : 0);
      if (two) ys2.push(n ? ys2[n - 1] : 0);
      save();
    });
    const paste = el('button', { class: 'btn small', type: 'button' }, F.esc(tx('paste')));
    paste.addEventListener('click', () => pasteBox(o, (cols) => {
      xs.splice(0, xs.length, ...cols[0]); ys.splice(0, ys.length, ...cols[1]);
      if (two) ys2.splice(0, ys2.length, ...cols[2]);
      save();
    }));
    row.append(add, paste);
    if (xs.length) {
      const clr = el('button', { class: 'btn small', type: 'button' }, F.esc(tx('clear')));
      clr.addEventListener('click', () => { xs.length = 0; ys.length = 0; if (two) ys2.length = 0; save(); });
      row.appendChild(clr);
    }
    wrap.appendChild(row);
    if (xs.length) wrap.appendChild(plot(xs, ys, o.steps, o.xEnd));
    return wrap;
  }

  // The columns of a text copied from a spreadsheet: one point per line. The separator is the same for the whole text: a
  // tab when there is one (a spreadsheet copies its cells so, and an empty cell stays empty in its column), else a
  // semicolon, else spaces (or a comma, when no line has its n numbers between spaces and the numbers use a point).
  // Blank lines are skipped, wherever they are. Every line is checked before anything is taken: a missing value, a
  // text that is not a number or a value beyond the n columns refuses the whole text, and tells where, by the number of
  // its line in the text (from 1) and its column (from 0).
  //   → { cols } | { none: true } | { error: { line, col, kind: 'missing' | 'invalid' | 'columns', text, has } }
  function parsePaste(text, n) {
    const lines = String(text).split(/\r?\n/).map((s, i) => ({ s, line: i + 1 })).filter((x) => x.s.trim());
    if (!lines.length) return { none: true };
    const tab = lines.some((x) => x.s.includes('\t'));
    const semi = !tab && lines.some((x) => x.s.includes(';'));
    const comma = !tab && !semi && lines.some((x) => x.s.includes(','))
      && lines.every((x) => x.s.trim().split(/\s+/).length < n);
    const split = (s) => (tab ? s.split('\t') : semi ? s.split(';') : comma ? s.split(',') : s.trim().split(/\s+/)).map((c) => c.trim());
    const cols = Array.from({ length: n }, () => []);
    for (const { s, line } of lines) {
      const cells = split(s);
      // empty cells after the last column (a row copied wider than the table) say nothing
      while (cells.length > n && cells[cells.length - 1] === '') cells.pop();
      if (cells.length > n) return { error: { line, col: n, kind: 'columns', has: cells.length } };
      for (let c = 0; c < n; c++) {
        const v = cells[c];
        if (v === undefined || v === '') return { error: { line, col: c, kind: 'missing' } };
        const x = F.parseNum(v);
        if (!Number.isFinite(x)) return { error: { line, col: c, kind: 'invalid', text: v } };
        cols[c].push(x);
      }
    }
    return { cols };
  }

  // the message of a refused paste, with the names of the columns
  function pasteMessage(err, labels) {
    if (err.kind === 'columns') return tx('pasteColumns', { line: err.line, has: err.has, n: labels.length });
    const where = UI.numCell.where(t('inspector.fields.cellRow', { n: err.line }), labels[err.col]);
    return err.kind === 'missing' ? tx('pasteMissing', { where }) : tx('pasteInvalid', { where, text: err.text });
  }

  // a box where two (or three) columns copied from a spreadsheet are pasted: the table is replaced only when every line
  // is right (parsePaste); otherwise the text stays in the box, with a message that says where it is wrong
  function pasteBox(o, done) {
    const n = o.y2 ? 3 : 2;
    const labels = [o.x.label, o.y.label].concat(n === 3 ? [o.y2.label] : []);
    const area = el('textarea', { id: 'pt-paste', rows: '8', style: 'width:100%' });
    const msg = el('p', { id: 'pt-paste-err', class: 'cell-err', role: 'alert', hidden: true });
    const body = el('div');
    const hint = n === 3 ? tx('pasteHint3', { x: o.x.label, y: o.y.label, z: o.y2.label }) : tx('pasteHint', { x: o.x.label, y: o.y.label });
    body.append(el('p', { class: 'muted small', style: 'margin:0 0 6px' }, F.esc(hint)), area, msg);
    const refuse = (text) => {
      msg.textContent = text + ' ' + tx('pasteKept');
      msg.hidden = false;
      area.setAttribute('aria-invalid', 'true');
      area.setAttribute('aria-describedby', 'pt-paste-err');
      area.focus();
      return false;
    };
    area.addEventListener('input', () => { msg.hidden = true; area.removeAttribute('aria-invalid'); area.removeAttribute('aria-describedby'); });
    UI.dialogs.modal({
      title: tx('pasteTitle'), body,
      actions: [{ label: t('app.dialog.cancel') }, {
        label: t('app.dialog.ok'), primary: true,
        onClick() {
          const r = parsePaste(area.value, n);
          if (r.none) return refuse(tx('pasteNone'));
          if (r.error) return refuse(pasteMessage(r.error, labels));
          done(r.cols);
        },
      }],
    });
  }

  // the points, joined in lines or in steps
  function plot(xs, ys, steps, xEnd) {
    const W = 300, Hh = 110, pad = 26;
    const fin = xs.map((x, i) => [x, ys[i]]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
    if (!fin.length) return el('div');
    // one point, or points all at one time or one value, get a span of one unit
    const x0 = Math.min(...fin.map((p) => p[0]));
    let x1 = Math.max(...fin.map((p) => p[0]), Number.isFinite(xEnd) ? xEnd : -Infinity);
    if (!(x1 > x0)) x1 = x0 + 1;
    const y0 = Math.min(0, ...fin.map((p) => p[1]));
    let y1 = Math.max(0, ...fin.map((p) => p[1]));
    if (!(y1 > y0)) y1 = y0 + 1;
    const X = (x) => pad + ((x - x0) / (x1 - x0)) * (W - pad - 8);
    const Y = (y) => Hh - 16 - ((y - y0) / (y1 - y0)) * (Hh - 24);
    let d = '';
    fin.forEach(([x, y], i) => {
      if (!i) d += `M${X(x).toFixed(1)} ${Y(y).toFixed(1)}`;
      else if (steps) d += `H${X(x).toFixed(1)}V${Y(y).toFixed(1)}`;
      else d += `L${X(x).toFixed(1)} ${Y(y).toFixed(1)}`;
    });
    if (Number.isFinite(xEnd) && xEnd > fin[fin.length - 1][0]) d += `H${X(xEnd).toFixed(1)}`;
    const pts = fin.map(([x, y]) => `<circle cx="${X(x).toFixed(1)}" cy="${Y(y).toFixed(1)}" r="2.6" style="fill:var(--sel)"/>`).join('');
    return el('div', {}, `<svg viewBox="0 0 ${W} ${Hh}" width="100%" class="curve-chart" role="img" aria-label="${F.esc(tx('plot'))}">
      <line x1="${pad}" y1="${Y(Math.max(y0, 0))}" x2="${W - 6}" y2="${Y(Math.max(y0, 0))}" style="stroke:var(--line)"/>
      <line x1="${pad}" y1="6" x2="${pad}" y2="${Hh - 16}" style="stroke:var(--line)"/>
      <path d="${d}" fill="none" style="stroke:var(--accent)" stroke-width="2"/>${pts}
      <text x="${pad - 4}" y="12" text-anchor="end" style="font:10px var(--f-mono);fill:var(--ink-3)">${F.fmt(y1, 3)}</text>
      <text x="${W - 6}" y="${Hh - 3}" text-anchor="end" style="font:10px var(--f-mono);fill:var(--ink-3)">${F.fmt(x1, 3)}</text>
    </svg>`);
  }

  UI.pointTable = { build, parsePaste, pasteMessage };
})(window);
