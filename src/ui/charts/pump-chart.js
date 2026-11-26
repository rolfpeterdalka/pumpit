// Pump × system chart: pump curve at the current speed against the system curve, which is obtained by
// running the solver with a fixed flow in the pump; the operating point comes from the current results. With a run of the
// time simulation all three are those of the step of the time cursor.
(function (root) {
  const PumpIt = root.PumpIt;
  const U = PumpIt.units, UI = PumpIt.ui;
  const F = UI.format;
  const { lineChart } = UI.lineChart;
  const app = PumpIt.app;
  const { t } = PumpIt.i18n;
  const tx = (key, params) => t('charts.pump.' + key, params);
  // The curves of a pump, by the version of the model, the scenario, the pump, the recorded step of the time cursor
  // (-1: the steady state) and the speed of its curve. Playing the run fills it a step at a time: it keeps the last few,
  // and it is emptied when the run changes. A change of unit only converts what is drawn.
  const cache = { run: null, map: new Map() };
  const KEEP = 12;
  // the modes in which the control finds the speed of the pump
  const CONTROLLED = ['controlFlow', 'controlDischarge', 'controlSuction'];
  function curvesOf(model, pid, step, run, speed) {
    if (cache.run !== run) { cache.run = run; cache.map.clear(); }
    const key = app.version + '|' + app.scenario().id + '|' + pid + '|' + step + '|' + speed;
    if (!cache.map.has(key)) {
      cache.map.set(key, PumpIt.solver.systemCurve(model, pid, 20, { speed }));
      if (cache.map.size > KEEP) cache.map.delete(cache.map.keys().next().value);
    }
    return cache.map.get(key);
  }

  function pumpChart(box, ctl, notes) {
    const eff = app.eff();
    const pumps = eff.junctions.filter((j) => j.type === 'pump');
    if (!pumps.length) { ctl.innerHTML = ''; box.innerHTML = `<div class="empty">${tx('noPumps')}</div>`; notes.textContent = ''; return; }
    // a head curve against a liquid system: not drawn for a gas
    if (PumpIt.model.isCompressible(eff)) { ctl.innerHTML = ''; box.innerHTML = `<div class="empty">${tx('gasMode')}</div>`; notes.textContent = ''; return; }
    let pid = app.prefs.chartPump;
    if (!pumps.some((p) => p.id === pid)) pid = pumps[0].id;
    app.prefs.chartPump = pid;
    const qu = app.outUnit('chart.Q', 'volFlow'), hu = app.outUnit('chart.H', 'head');
    ctl.innerHTML = `<label>${tx('pump')}<select id="ch-pump">${pumps.map((p) => `<option value="${p.id}"${p.id === pid ? ' selected' : ''}>J${p.id} ${F.esc(p.name)}</option>`).join('')}</select></label>
      <label>${tx('flow')}<select id="ch-qu" class="unit-sel" data-t="chart" data-c="Q" data-cat="volFlow">${U.list('volFlow').map((u) => F.option(u, F.unit(u), u === qu)).join('')}</select></label>
      <label>${tx('head')}<select id="ch-hu" class="unit-sel" data-t="chart" data-c="H" data-cat="head">${U.list('head').map((u) => F.option(u, F.unit(u), u === hu)).join('')}</select></label>`;
    if (!app.validation().ok) { box.innerHTML = `<div class="empty">${tx('needsChecklist')}</div>`; notes.textContent = ''; return; }
    // with a run of the time simulation, the curves, the speed and the operating point are those of the step of the
    // cursor: its model has the tables over time applied (a speed, a valve opening) and the levels of its tanks
    const run = app.timeRun();
    const step = run ? app.cursorIndex() : -1;
    const model = run ? app.cursorModel() : eff;
    // the speed of the curve: the one typed, or for a pump whose control finds its speed the one of its result in the
    // scenario and the step shown (none when the control could not find it, or without a result)
    const res = app.currentResults();
    const pr = res && res.ok && res.pumps[pid];
    const j = model.junctions.find((p) => p.id === pid);
    const controlled = CONTROLLED.includes(j.mode);
    // a stopped pump (off, or a fixed flow of zero) has no speed and no operating point on its curve: its curve is drawn
    // at the speed typed (100 % for one its control drives) as a reference, and its point is that of the stopped pump
    const stopped = j.state !== 'on' || (j.mode === 'fixedFlow' && !(j.fixedFlow && j.fixedFlow.value > 0));
    const checkShut = !stopped && pr && pr.checkClosed;
    const speed = stopped ? (!controlled && j.speed > 0 ? j.speed : 100)
      : controlled ? (pr && Number.isFinite(pr.speed) ? pr.speed : NaN) : j.speed;
    const d = curvesOf(model, pid, step, run, speed);
    if (!d || !d.sys.length) { box.innerHTML = `<div class="empty">${tx('failed')}</div>`; return; }
    const cq = (Q) => U.fromSI(Q, qu, 'volFlow'), ch = (h) => U.fromSI(h, hu, 'head');
    const opKey = stopped ? 'operationStopped' : checkShut ? 'operationCheck' : 'operation';
    const op = pr ? [{ x: cq(pr.Q), y: ch(pr.dH), color: stopped ? 'var(--ink-3)' : 'var(--sel)', label: tx(opKey, { q: F.fmt(cq(pr.Q), 4), qu: F.unit(qu), h: F.fmt(ch(pr.dH), 4), hu: F.unit(hu) }) }] : [];
    const speedText = controlled && !stopped ? F.fmt(speed, 5) : F.inputStr(speed);
    box.innerHTML = lineChart({
      title: tx('title'), xLabel: tx('xLabel', { u: F.unit(qu) }), yLabel: tx('yLabel', { u: F.unit(hu) }), xMin: 0, yMin: 0,
      series: (d.pump.length ? [
        stopped
          ? { name: tx('pumpReference', { speed: speedText }) + (j.nPumps > 1 ? tx('parallel', { n: j.nPumps }) : ''), pts: d.pump.map(([q, h]) => [cq(q), ch(h)]), color: 'var(--ink-3)', dash: '3 4', width: 1.6 }
          : { name: tx('pumpSeries', { speed: speedText }) + (j.nPumps > 1 ? tx('parallel', { n: j.nPumps }) : ''), pts: d.pump.map(([q, h]) => [cq(q), ch(h)]), color: 'var(--accent)' },
      ] : []).concat([
        { name: j.mode === 'fixedFlow' ? tx('systemRequired') : tx('system'), pts: d.sys.map(([q, h]) => [cq(q), ch(h)]), color: '#c0612b', dash: '7 5' },
      ]),
      points: op,
    });
    notes.innerHTML = tx('notes', { n: d.sys.length, name: F.esc(app.scenario().name) }) + (pr ? '' : tx('notesNoPoint'))
      + (controlled && pr && !Number.isFinite(speed) ? tx('notesNoSpeed') : '')
      + (!stopped ? (checkShut ? tx('notesCheck') : '')
        : j.mode === 'fixedFlow' ? tx('notesStoppedFixed')
          : tx(j.state === 'offOpen' ? 'notesStoppedOpen' : 'notesStoppedClosed', { speed: speedText }));
  }

  PumpIt.ui.pumpChart = { render: pumpChart };
})(typeof window !== 'undefined' ? window : globalThis);
