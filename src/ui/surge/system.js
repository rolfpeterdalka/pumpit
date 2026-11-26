// The water hammer in the system window (§9.1, §4.4 and §11.4 of its specification): on or off (turning it on turns the
// time simulation off: the analyses are exclusive, decision W-19), the duration, the time step (automatic with its
// variance limit, or given), the cavitation, how often a time is recorded and the output stations; in a section of its
// own the advanced options. A table shows the sectioning the run will take, recalculated at every change: per pipe its
// length, wave speed, sections, adjusted speed and variance, and below it the time step, the controlling pipe, the
// stations and the steps. Phase G3 adds the gas cavities (with their void fraction), the friction of Brunone and the force
// sets, each a segment, a point or an exit with the stations it takes. The control is a field of the solution, so a child
// scenario changes it field by field.
(function (root) {
  const PumpIt = root.PumpIt;
  const UI = PumpIt.ui, U = PumpIt.units;
  const app = PumpIt.app;
  const F = UI.format;
  const { el } = UI.dom;
  const { t } = PumpIt.i18n;
  const tx = (key, params) => t('surge.system.' + key, params);
  const SG = () => PumpIt.surge;

  // for the estimate of the time of a run: station-steps per second of the method, and the time of a step besides its
  // stations (junctions, tables, events), measured on a 200-pipe grid with 4 198 stations (about 1.1 s for 2 000 steps on
  // a desktop of 2017) and on the example of a pump between tanks
  const RATE = 7e6, STEP_S = 2e-5;
  const estimate = (size) => size.steps * (size.stations / RATE + STEP_S);

  function section() {
    const { section: sec, qty, num, seg, chk, sel, readout, hint, wrap } = UI.forms;
    const k = 'sol';
    const eff = app.eff();
    const c = SG().inputs.controlOf(eff);
    const box = el('div', { class: 'sys-col sys-wide' });
    const s = sec(tx('title'), { info: tx('hint') });
    box.appendChild(s);
    // on: the whole control is written (a model without it gets its defaults), and the time simulation goes off
    const onBox = el('input', { type: 'checkbox', id: UI.forms.idOf(k, 'surge.on') });
    onBox.checked = c.on;
    onBox.addEventListener('change', () => {
      if (!onBox.checked) { app.setVal(k, 'surge.on', false); return; }
      const stored = app.getVal(k, 'surge');
      const pairs = [stored && typeof stored === 'object' ? ['surge.on', true] : ['surge', Object.assign(SG().inputs.newControl(), { on: true })]];
      if (eff.solution.time && eff.solution.time.on) pairs.push(['time.on', false]);
      app.setVals(k, pairs);
    });
    s.appendChild(wrap(k, 'surge.on', tx('on'), onBox, { check: true, info: tx('onHint') }));
    // off: which calculation the scenario does instead (the time simulation, or the steady state only)
    if (!c.on) { s.appendChild(hint(F.esc(tx(eff.solution.time && eff.solution.time.on ? 'offTime' : 'off')))); return box; }
    // what the control still needs
    const item = app.validation().items.find((i) => i.key === 'surge');
    if (item && !item.ok) s.appendChild(el('div', { class: 'missing' }, t('inspector.missing', { items: F.esc(item.detail) })));

    const cols = el('div', { class: 'surge-cols' });
    const a = el('div'), b = el('div');
    cols.append(a, b);
    s.appendChild(cols);
    a.appendChild(qty(k, 'surge.duration', tx('duration'), 'time', { info: tx('durationHint') }));
    a.appendChild(seg(k, 'surge.dtMode', tx('dtMode'), SG().inputs.DT_MODES.map((m) => [m, tx('dtModes.' + m)]), { info: tx('dtModeHint') }));
    if (c.dtMode === 'given') a.appendChild(qty(k, 'surge.dt', tx('dt'), 'time'));
    else {
      a.appendChild(num(k, 'surge.varianceMax', tx('varianceMax'), { suffix: '%', info: tx('varianceHint') }));
      a.appendChild(num(k, 'surge.ncMax', tx('ncMax'), { info: tx('ncMaxHint') }));
    }
    // the cavitation: choosing the gas cavities takes ψ to 0.95 while it is at its default of 0.5 (decision G3-10)
    const cavSeg = seg(k, 'surge.cavitation', tx('cavitation'), SG().inputs.CAVITATION.map((m) => [m, tx('cavitations.' + m)]), { info: SG().inputs.CAVITATION.map((m) => `<b>${F.esc(tx('cavitations.' + m))}</b><br>${tx('cavitationHint.' + m)}`).join('<br><br>') });
    cavSeg.querySelectorAll('[data-v]').forEach((btn) => btn.addEventListener('click', (e) => {
      if (btn.dataset.v !== 'dgcm' || c.cavitation === 'dgcm' || c.psi !== 0.5) return;
      e.stopImmediatePropagation();
      app.setVals(k, [['surge.cavitation', 'dgcm'], ['surge.psi', 0.95]]);
    }, true));
    b.appendChild(cavSeg);
    b.appendChild(sel(k, 'surge.friction', tx('friction'), SG().inputs.FRICTION.map((m) => [m, tx('frictions.' + m)]), { info: tx('frictionHint') }));
    b.appendChild(num(k, 'surge.saveEvery', tx('saveEvery'), { int: true, info: tx('saveEveryHint') }));
    b.appendChild(sel(k, 'surge.stations', tx('stations'), SG().inputs.STATIONS.map((m) => [m, tx('stationsOf.' + m)]), { info: tx('stationsHint') }));
    // the bulk modulus of the liquid: that of the library fluid, or a field of a fluid of the user
    const fl = eff.system.fluid;
    if (PumpIt.fluids.LIBRARY[fl.kind]) {
      const K = SG().wavespeed.fluidK(eff.system);
      b.appendChild(readout(tx('fluidK'), Number.isFinite(K) ? `${F.fmt(K / 1e9, 5)} GPa` : '—', tx('fluidKSource')));
    } else b.appendChild(qty('sys', 'fluid.K', tx('fluidK'), 'modulus', { info: tx('fluidKHint') }));

    // the advanced options
    const s2 = sec(tx('advanced'), { info: tx('advancedHint') });
    box.appendChild(s2);
    const cols2 = el('div', { class: 'surge-cols' });
    const a2 = el('div'), b2 = el('div');
    cols2.append(a2, b2);
    s2.appendChild(cols2);
    a2.appendChild(num(k, 'surge.psi', tx('psi'), { info: tx('psiHint') }));
    a2.appendChild(sel(k, 'surge.cavBasis', tx('cavBasis'), SG().inputs.CAV_BASES.map((m) => [m, tx('cavBases.' + m)]), { info: tx('cavBasisHint') }));
    // the free gas of the gas cavities: its void fraction at a pressure, the same in the whole network
    if (c.cavitation === 'dgcm') {
      a2.appendChild(num(k, 'surge.alpha0', tx('alpha0'), { info: tx('alpha0Hint') }));
      a2.appendChild(qty(k, 'surge.p0', tx('p0'), 'pressure', { info: tx('p0Hint') }));
    }
    if (c.dtMode === 'auto') a2.appendChild(num(k, 'surge.ncMin', tx('ncMin')));
    b2.appendChild(num(k, 'surge.artificial.criterion', tx('criterion'), { suffix: '%', info: tx('criterionHint') }));
    b2.appendChild(qty(k, 'surge.artificial.minFlow', tx('minFlow'), 'flow'));
    b2.appendChild(chk(k, 'surge.artificial.stop', tx('stop')));

    box.appendChild(sectioningSection(eff, c));
    box.appendChild(forcesSection(eff, c));
    // the events of the model, which a table or a trip may start with (those of the time simulation, which is off)
    if (UI.timeEvents) box.appendChild(UI.timeEvents.section());
    return box;
  }

  // the sectioning the run will take (§4.4)
  function sectioningSection(eff, c) {
    const s = UI.forms.section(tx('sectioning'), { info: tx('sectioningHint') });
    const size = SG().network.sizeOf(eff);
    if (!size) {
      let missing = [];
      try { missing = SG().network.waves(eff, SG().network.envOf(eff)).missing; } catch (e) { /* the system is incomplete */ }
      s.appendChild(UI.forms.hint(F.esc(missing.length ? tx('noWave', { pipes: missing.map((id) => 'P' + id).join(', ') }) : tx('noSectioning'))));
      return s;
    }
    const sec = size.sec, lim = c.varianceMax;
    const rows = sec.pipes.map((p) => {
      const v = 100 * p.variance, over = Math.abs(v) > lim + 1e-7;
      return `<tr data-key="p:${p.id}"><td class="txt">P${p.id}${p.id === sec.controller ? ` <span class="muted small">${F.esc(tx('controller'))}</span>` : ''}</td><td class="num">${F.fmt(p.L, 5)}</td><td class="num">${F.fmt(p.a, 5)}</td><td class="num">${p.n}</td><td class="num">${F.fmt(p.aAdj, 5)}</td><td class="num${over ? ' bad' : ''}">${F.fixed(v, 3)}</td></tr>`;
    }).join('');
    const th = ['pipe', 'L', 'a', 'n', 'aAdj', 'variance'].map((x, i) => `<th class="${i ? '' : 'txt'}">${F.esc(tx('cols.' + x))}</th>`).join('');
    const tbl = el('div', { class: 'table-scroll surge-table' }, `<table class="grid"><thead><tr>${th}</tr></thead><tbody>${rows}</tbody></table>`);
    tbl.addEventListener('click', (e) => { const r = e.target.closest('[data-key]'); if (r) { UI.systemWindow.close(); app.gotoKey(r.dataset.key); } });
    s.appendChild(tbl);
    const work = size.stations * size.steps;
    const kv = [
      [tx('dtValue'), UI.surgeFormat.time(size.dt) + (c.dtMode === 'auto' && Number.isFinite(sec.nc) ? ` · N_c ${F.fixed(sec.nc, 2)}` : '')],
      [tx('stationsTotal'), String(size.stations)],
      [tx('steps'), String(size.steps)],
      [tx('estimate'), tx('estimateValue', { work: F.fmt(work, 3), s: F.fmt(Math.max(estimate(size), 0.01), 2) })],
    ];
    for (const [k, v] of kv) s.appendChild(UI.forms.readout(k, v));
    if (!sec.ok) s.appendChild(UI.forms.hint(F.esc(tx('limitNotMet', { worst: F.fixed(100 * sec.worst, 3), limit: lim }))));
    return s;
  }

  // the force sets (phase G3, decision G3-11): each a segment between two stations, the force at a station or that of an
  // exit, its pipes and distances from their up ends, the station each distance takes, the ambient pressure and the area
  // of the jet of an exit. The list is written whole at every change (one undo step)
  function forcesSection(eff, c) {
    const s = UI.forms.section(tx('forces'), { info: tx('forcesHint') });
    const list = Array.isArray(c.forces) ? c.forces : [];
    const pipes = eff.pipes.filter((p) => !p.closed);
    const write = (fn) => { const next = PumpIt.model.clone(list); fn(next); app.setVal('sol', 'surge.forces', next); };
    const size = SG().network.sizeOf(eff);
    const nOf = (pid) => { const sp = size && size.sec.pipes.find((x) => x.id === pid); return sp ? sp.n : NaN; };
    const select = (id, options, value, onChange) => {
      const sel2 = el('select', { id }, options.map(([v, l]) => F.option(v, l, String(v) === String(value))).join(''));
      sel2.addEventListener('change', () => onChange(sel2.value));
      return sel2;
    };
    const field = (label, ctl, opts) => UI.forms.wrap(null, '', label, ctl, opts);
    // a quantity of a set, its value and its unit
    const qtyIn = (id, label, cat, v, onChange) => {
      const val = v && typeof v === 'object' ? v : { value: null, unit: U.list(cat)[0] };
      const inp = el('input', { type: 'text', id, inputmode: 'decimal', autocomplete: 'off' });
      inp.value = F.inputStr(val.value);
      const us = el('select', { class: 'unit has-tip', id: id + '-u', 'aria-label': t('inspector.fields.unitOf', { label }), 'aria-describedby': UI.forms.unitTip() }, UI.forms.unitOptions(cat, val.unit));
      inp.addEventListener('change', () => { if (PumpIt.ui.forms.badNumber(inp)) return; const n = F.parseNum(inp.value); onChange({ value: Number.isFinite(n) ? n : null, unit: us.value }); });
      us.addEventListener('change', () => { if (PumpIt.ui.forms.badNumber(inp)) return; const n = F.parseNum(inp.value); onChange({ value: Number.isFinite(n) ? n : null, unit: us.value }); });
      return field(label, inp, { after: us });
    };
    const pipeOptions = pipes.map((p) => [p.id, 'P' + p.id + (p.name ? ' ' + p.name : '')]);
    // the station a distance takes, and its own distance
    const stationText = (o) => {
      const p = pipes.find((x) => x.id === (o && o.pipe));
      const n = p ? nOf(p.id) : NaN;
      if (!p || !(n > 0) || !(o.x && Number.isFinite(o.x.value) && U.has('length', o.x.unit))) return '—';
      const L = U.toSI(p.length.value, p.length.unit, 'length'), i = SG().forces.stationOf(U.toSI(o.x.value, o.x.unit, 'length'), L, n);
      return tx('forceStation', { i, n, x: F.fmt(L * i / n, 5) });
    };
    list.forEach((fs, k) => {
      const box = el('div', { class: 'td-block' });
      const id = 'sf-' + k;
      box.appendChild(el('div', { class: 'td-title' }, F.esc(fs.name || 'F' + (k + 1))));
      const nameIn = el('input', { type: 'text', id: id + '-name', class: 'txt', autocomplete: 'off' });
      nameIn.value = fs.name || '';
      nameIn.addEventListener('change', () => write((x) => { x[k].name = nameIn.value; }));
      box.appendChild(field(tx('forceName'), nameIn));
      box.appendChild(field(tx('forceKind'), select(id + '-kind', SG().inputs.FORCE_KINDS.map((x) => [x, tx('forceKinds.' + x)]), fs.kind, (v) => write((x) => { x[k].kind = v; })), { info: tx('forceKindHint') }));
      const end = (which, label) => {
        const o = fs[which] || {};
        box.appendChild(field(label, select(id + '-' + which + 'p', (pipeOptions.some(([v]) => v === o.pipe) ? [] : [['', '—']]).concat(pipeOptions), o.pipe ?? '', (v) => write((x) => { x[k][which] = Object.assign({}, x[k][which], { pipe: Number(v) }); }))));
        if (which === 'a' || fs.kind === 'segment') {
          box.appendChild(qtyIn(id + '-' + which + 'x', tx('forceX'), 'length', o.x, (v) => write((x) => { x[k][which] = Object.assign({}, x[k][which], { x: v }); })));
          box.appendChild(UI.forms.readout(tx('forceAt'), stationText(o)));
        }
      };
      end('a', fs.kind === 'point' ? tx('forcePipe') : tx('forceFrom'));
      if (fs.kind === 'segment') end('b', tx('forceTo'));
      if (fs.kind === 'exit') {
        end('b', tx('forceExit'));
        box.appendChild(qtyIn(id + '-As', tx('forceAs'), 'area', fs.As, (v) => write((x) => { x[k].As = v; })));
      }
      box.appendChild(field(tx('forceAmbient'), select(id + '-amb', SG().inputs.AMBIENTS.map((x) => [x, tx('ambients.' + x)]), fs.ambient || 'atm', (v) => write((x) => { x[k].ambient = v; }))));
      if (fs.ambient === 'given') box.appendChild(qtyIn(id + '-pamb', tx('forcePamb'), 'pressure', fs.pamb, (v) => write((x) => { x[k].pamb = v; })));
      const bad = SG().forces.check(eff, fs);
      if (bad.length) box.appendChild(UI.forms.hint(F.esc(bad.map((b) => tx('forceBad.' + b)).join(' '))));
      const rm = el('button', { class: 'btn small', type: 'button' }, F.esc(tx('forceRemove')));
      rm.addEventListener('click', () => write((x) => { x.splice(k, 1); }));
      const row = el('div', { class: 'btn-row' });
      row.appendChild(rm);
      box.appendChild(row);
      s.appendChild(box);
    });
    if (!pipes.length) return s;
    const add = el('button', { class: 'btn small', type: 'button' }, F.esc(tx('forceAdd')));
    add.addEventListener('click', () => {
      const p = pipes[0];
      write((x) => { x.push(SG().inputs.newForce(p.id, 'F' + (x.length + 1), p.length)); });
    });
    const row = el('div', { class: 'btn-row' });
    row.appendChild(add);
    s.appendChild(row);
    return s;
  }

  // the line of the summary in the inspector with nothing selected
  function summary(host) {
    const eff = app.eff();
    if (!SG().inputs.isOn(eff)) return;
    const c = SG().inputs.controlOf(eff);
    const q = (x) => (x && Number.isFinite(x.value) ? `${F.inputStr(x.value)} ${F.unit(x.unit)}` : '—');
    host.appendChild(UI.forms.readout(tx('title'), tx('summary', { duration: q(c.duration), cavitation: tx('cavitations.' + c.cavitation) })));
  }

  UI.surgeSystem = { section, summary, estimate };
})(window);
