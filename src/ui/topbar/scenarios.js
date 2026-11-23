// Scenario controls in the top bar: switching (which calculates the chosen scenario), adding a child,
// renaming, deleting, and the table of differences from the parent, named and written as the inspector does, with the
// points of a curve that changed.
(function (root) {
  const PumpIt = root.PumpIt;
  const M = PumpIt.model, UI = PumpIt.ui;
  const app = PumpIt.app;
  const F = UI.format;
  const { $ } = UI.dom;
  const { toast, modal, askText, confirmBox } = UI.dialogs;
  const { t } = PumpIt.i18n;

  const U = PumpIt.units;
  const dx = (key, params) => t('app.diffs.' + key, params);
  const isCurve = (x) => !!(x && typeof x === 'object' && Array.isArray(x.x) && Array.isArray(x.y));

  // a value as the inspector writes it: a quantity as typed with its unit, the text of an option, yes or no, a number
  // with its suffix; meta: what the field of the inspector is (UI.forms.describe), or nothing
  function showValue(v, meta = {}) {
    if (v === undefined || v === null || (typeof v === 'number' && !Number.isFinite(v))) return '—';
    if (typeof v === 'object' && 'value' in v && 'unit' in v) return Number.isFinite(v.value) ? `${F.inputStr(v.value)} ${F.unit(v.unit)}`.trim() : '—';
    if (meta.options) { const o = meta.options.find(([val]) => String(val) === String(v)); if (o) return String(o[1]); }
    if (typeof v === 'boolean') return dx(v ? 'yes' : 'no');
    if (typeof v === 'number') return F.inputStr(v) + (meta.suffix ? (meta.suffix === '%' ? '%' : ' ' + meta.suffix) : '');
    if (isCurve(v)) return dx('points', { n: v.x.length });
    if (typeof v === 'object') return dx('table');
    return String(v);
  }

  // The points of a curve that differ from those of the parent: a point at the same flow with another value, a point
  // only here (added) or only in the parent (removed), and the units and the fit when they differ. The flows are
  // matched in SI, so that a curve typed in other units compares; each value keeps the units of its own curve.
  // o = { xCat, yCat, yName }; rows: [{ label, here, parent }]
  function curveDiff(c, p, o = {}) {
    const rows = [];
    const xCat = o.xCat || 'volFlow', yCat = o.yCat || 'head', yName = o.yName || dx('value');
    const si = (v, u, cat) => { if (!u || cat === 'pct') return v; try { return U.toSI(v, u, cat); } catch (e) { return v; } };
    const unitOf = (u) => (u ? F.unit(u) : yCat === 'pct' ? '%' : '');
    const yStr = (v, u) => (Number.isFinite(v) ? (unitOf(u) === '%' ? `${F.inputStr(v)}%` : `${F.inputStr(v)} ${unitOf(u)}`.trim()) : '—');
    const xStr = (v, u) => (Number.isFinite(v) ? `${F.inputStr(v)} ${F.unit(u || '')}`.trim() : '—');
    const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
    const px = p && isCurve(p) ? p : { x: [], y: [] };
    const used = new Set();
    c.x.forEach((x, i) => {
      const xs = si(x, c.xUnit, xCat);
      const j = px.x.findIndex((x2, k) => !used.has(k) && near(si(x2, px.xUnit, xCat), xs));
      if (j < 0) { rows.push({ label: dx('added', { x: xStr(x, c.xUnit) }), here: yStr(c.y[i], c.yUnit), parent: '—' }); return; }
      used.add(j);
      if (!near(si(c.y[i], c.yUnit, yCat), si(px.y[j], px.yUnit, yCat))) {
        rows.push({ label: dx('at', { y: yName, x: xStr(x, c.xUnit) }), here: yStr(c.y[i], c.yUnit), parent: yStr(px.y[j], px.yUnit) });
      }
    });
    px.x.forEach((x, k) => { if (!used.has(k)) rows.push({ label: dx('removed', { x: xStr(x, px.xUnit) }), here: '—', parent: yStr(px.y[k], px.yUnit) }); });
    const units = (q) => [F.unit(q.xUnit || ''), unitOf(q.yUnit)].filter(Boolean).join(' · ');
    if (p && isCurve(p) && units(c) !== units(p)) rows.push({ label: dx('units'), here: units(c), parent: units(p) });
    const fit = (f) => (f === undefined ? '—' : String(f) === 'xy' ? t('inspector.curve.linear') : t('inspector.curve.poly', { n: f }));
    if (p && isCurve(p) && String(c.fit) !== String(p.fit)) rows.push({ label: t('inspector.curve.fitType'), here: fit(c.fit), parent: fit(p.fit) });
    return rows;
  }

  // the name of an object in the table: J2, P1, the system or the solution control, with its name
  function objectLabel(ok) {
    if (ok === 'sys') return dx('system');
    if (ok === 'sol') return dx('solution');
    const o = app.effObj ? app.effObj(ok) : null;
    return (ok[0] === 'p' ? 'P' : 'J') + ok.slice(2) + (o && o.name ? ' ' + o.name : '');
  }

  app.showDiffs = () => {
    const s = app.scenario();
    const parent = s.parent;
    // the fields of each object as its panel shows them in this scenario (the system window for sys and sol)
    const fields = new Map();
    const fieldsOf = (ok) => {
      if (!fields.has(ok)) fields.set(ok, UI.inspector && UI.inspector.fieldsOf ? UI.inspector.fieldsOf(ok) : {});
      return fields.get(ok);
    };
    const cell = (x, cls = '') => `<td class="num${cls}">${F.esc(x)}</td>`;
    let n = 0;
    const rows = Object.entries(s.overrides).map(([k, v]) => {
      const [ok, path] = k.split('|');
      const meta = fieldsOf(ok)[ok + '|' + path] || {};
      const pv = M.effValue(app.model, parent, ok, path);
      const head = `<td class="txt">${F.esc(objectLabel(ok))}</td><td class="txt">${F.esc(meta.label || path)}</td>`;
      let html = `<tr>${head}${cell(showValue(v, meta))}${cell(showValue(pv, meta), ' muted')}</tr>`;
      // a curve: the points that changed, in a row that opens under it (by keyboard as well)
      if (isCurve(v)) {
        const d = curveDiff(v, pv, meta.curve);
        if (d.length) {
          const id = 'diff-pts-' + ++n;
          html += `<tr class="diff-detail"><td></td><td colspan="3"><details id="${id}"><summary>${F.esc(dx('showPoints', { n: d.length }))}</summary>
            <table class="grid diff-points"><thead><tr><th class="txt">${F.esc(dx('point'))}</th><th>${F.esc(dx('here'))}</th><th>${F.esc(dx('parent'))}</th></tr></thead>
            <tbody>${d.map((r) => `<tr><td class="txt">${F.esc(r.label)}</td>${cell(r.here)}${cell(r.parent, ' muted')}</tr>`).join('')}</tbody></table></details></td></tr>`;
        }
      }
      return html;
    }).join('');
    modal({
      title: t('app.diffs.title', { name: s.name, parent: app.scenarioById(parent).name }),
      body: `<div class="table-scroll"><table class="grid diffs"><thead><tr><th class="txt">${t('app.diffs.object')}</th><th class="txt">${t('app.diffs.attribute')}</th><th>${t('app.diffs.here')}</th><th>${t('app.diffs.parent')}</th></tr></thead><tbody>${rows}</tbody></table></div>`,
      actions: [{ label: t('app.dialog.close'), primary: true }],
    });
  };

  function bind() {
    $('#scenario-select').addEventListener('change', (e) => {
      app.model.scenarios.current = e.target.value;
      app.save();
      // The steady state of a scenario is kept, but its runs stop when the user leaves it: coming back, the time
      // simulation and the water hammer start again, each on its own, unless it has a result already (complete, stopped
      // by the user or refused with its error) or is still going.
      if (!app.steadyResults()) app.recalc();
      else {
        if (!app.timeResult() && !app.timeProgress()) app.startTime();
        if (app.startSurge && app.surgeOn() && !app.surgeResult() && !app.surgeProgress()) app.startSurge();
      }
      app.renderAll();
    });
    $('#btn-scn-add').addEventListener('click', () => askText(t('app.scenario.newTitle'), t('app.scenario.newLabel', { parent: app.scenario().name }), '', (name) => {
      app.pushUndo();
      const s = M.addScenario(app.model, app.model.scenarios.current, name);
      app.model.scenarios.current = s.id;
      app.changed();
      toast(t('app.scenario.created', { name }));
    }));
    $('#btn-scn-rename').addEventListener('click', () => askText(t('app.scenario.renameTitle'), t('app.scenario.renameLabel'), app.scenario().name, (name) => {
      app.pushUndo(); app.scenario().name = name; app.save(); app.renderAll();
    }));
    $('#btn-scn-del').addEventListener('click', () => {
      const s = app.scenario();
      if (!s.parent) return;
      const n = M.descendants(app.model, s.id).length;
      confirmBox(t('app.scenario.deleteTitle'), t(n ? 'app.scenario.deleteWithChildren' : 'app.scenario.deleteText', { name: s.name, n }), t('app.scenario.deleteOk'), () => {
        app.pushUndo(); M.deleteScenario(app.model, s.id); app.changed();
      });
    });
  }

  PumpIt.ui.scenarios = { bind, showValue, curveDiff };
})(window);
