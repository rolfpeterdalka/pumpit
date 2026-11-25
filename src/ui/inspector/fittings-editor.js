// Fittings of a pipe: list with quantity and K (or K/f_T, Crane TP-410), ΣK and the Crane f_T of the pipe.
(function (root) {
  const PumpIt = root.PumpIt;
  const D = PumpIt.data, H = PumpIt.hyd, UI = PumpIt.ui;
  const F = UI.format;
  const { el, section, readout } = UI.forms;
  const NC = UI.numCell;
  const app = PumpIt.app;
  const { t } = PumpIt.i18n;
  const tx = (key, params) => t('inspector.fittings.' + key, params);

  function build(key, p, gm) {
    const s = section(tx('title'), { info: tx('hint') });
    const fT = gm ? H.craneFT(gm.Dh) : NaN;
    const list = (p.fittings || []).map((x) => Object.assign({}, x));
    const save = () => app.setVal(key, 'fittings', list);
    if (list.length) {
      const table = el('table', { class: 'mini-table' });
      table.innerHTML = `<thead><tr><th>${tx('qty')}</th><th>${tx('item')}</th><th>${tx('value')}</th><th></th></tr></thead>`;
      const tb = el('tbody');
      // a text that is not a number stays in its cell, with its message under the table, and the fitting keeps its value
      const errs = NC.errors();
      list.forEach((it, i) => {
        const tr = el('tr');
        const name = D.fittingName(it) || ''; // a fitting of a file may have no name
        const at = name ? `${NC.row(i + 1)} · ${name}` : NC.row(i + 1);
        const qn = NC.input({
          id: `fit-q-${key}-${i}`, aria: tx('qtyAria'), value: it.qty, errs, attrs: { style: 'width:44px' },
          // a quantity not given counts one (the core reads it so), and is not marked
          check: (n) => (n >= 0 ? '' : tx('qtyRule')), markStored: it.qty !== undefined && it.qty !== null,
          where: NC.where(at, tx('qtyAria')), onCommit: (n) => { it.qty = n; save(); },
        });
        // a coefficient of zero or more; only the calibrated tee of the .fth importer may be negative (F-23), within the
        // K of the other fittings, which the checklist sums
        const tee = it.id === 'imported-tee' && it.model === 'K';
        const vn = NC.input({
          id: `fit-v-${key}-${i}`, aria: tx('value'), value: it.value, errs, attrs: { style: 'width:64px' },
          check: (n) => (n >= 0 || tee ? '' : tx('valueRule')), markStored: true,
          where: NC.where(at, it.model === 'KfT' ? 'K/fT' : 'K'), onCommit: (n) => { it.value = n; save(); },
        });
        const x = el('button', { class: 'row-btn', type: 'button', 'aria-label': tx('remove') }, '×');
        x.addEventListener('click', () => { list.splice(i, 1); save(); });
        const td1 = el('td'); td1.appendChild(qn);
        const td2 = el('td', {}, `<span style="font-size:12.5px">${F.esc(name)}</span>`);
        const td3 = el('td'); td3.appendChild(vn); td3.insertAdjacentHTML('beforeend', ` <span class="muted small">${it.model === 'KfT' ? '·f<sub>T</sub>' : 'K'}</span>`);
        const td4 = el('td', { class: 'x' }); td4.appendChild(x);
        tr.append(td1, td2, td3, td4);
        tb.appendChild(tr);
      });
      table.appendChild(tb);
      s.append(table, errs);
    }
    const add = el('select', { id: 'fit-add-' + key, 'aria-label': tx('addAria') },
      `<option value="">${tx('add')}</option><option value="custom">${F.esc(t('core.data.fittings.custom'))}</option>` +
      D.FITTINGS.map((f, i) => `<option value="${i}">${F.esc(f.name)} (${f.model === 'KfT' ? f.value + '·f_T' : 'K = ' + F.fmt(f.value, 3)})</option>`).join(''));
    add.addEventListener('change', () => {
      if (add.value === '') return;
      list.push(add.value === 'custom' ? D.customFitting() : Object.assign({ qty: 1 }, D.FITTINGS[+add.value]));
      save();
    });
    s.appendChild(add);
    // ΣK only when every fitting is valid (an invalid one would make it look like a result)
    let Ksum = 0;
    for (const it of list) Ksum += (it.qty ?? 1) * (it.model === 'KfT' ? it.value * fT : it.value);
    s.appendChild(readout(tx('sumK'), PumpIt.model.fittingIssues({ fittings: list }, fT).length ? '—' : F.fmt(Ksum, 4)));
    s.appendChild(readout(tx('craneFT'), F.fmt(fT, 3)));
    return s;
  }

  PumpIt.ui.fittingsEditor = { build };
})(typeof window !== 'undefined' ? window : globalThis);
