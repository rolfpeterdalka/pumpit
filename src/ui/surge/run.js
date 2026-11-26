// The water hammer in the app (docs/water-hammer.md). It is a module the user turns on (solution.surge.on, in the system
// window): only then, after the steady state of the current scenario, its run goes on in slices of about 30 ms, so that
// the page keeps answering; any edit cancels it and starts it again. The steady results stay those of the tables, the
// cards and the drawing (the instant zero); the water hammer has its own results, charts and colours of the drawing at
// the time of its cursor. The results of a run are not saved with the model.
(function (root) {
  const PumpIt = root.PumpIt;
  const UI = PumpIt.ui;
  const app = PumpIt.app;

  const SLICE_MS = 30;
  app.surgeRuns = {}; // scenario id → its run (complete or stopped), for the version runsOf
  let runsOf = -1; // the version of the model the runs belong to
  let job = null; // the run going on: { sid, version, job, started }
  let cursor = { sid: null, i: 0 }; // the recorded time shown, by its index

  const current = () => app.model.scenarios.current;
  app.surgeOn = () => !!(PumpIt.surge && PumpIt.surge.inputs.isOn(app.eff()));

  // ------------------------------------------------------------ the run
  // starts the run of the current scenario (app.recalc calls it after the steady state)
  app.startSurge = () => {
    if (runsOf !== app.version) { app.surgeRuns = {}; runsOf = app.version; }
    drop();
    const sid = current();
    delete app.surgeRuns[sid];
    if (!app.surgeOn() || !app.validation().ok) return;
    const steady = app.results[sid];
    if (!steady || !steady.ok) return;
    job = { sid, version: app.version, job: PumpIt.surge.start(app.eff(), { steady }), started: performance.now() };
    setTimeout(slice, 0);
  };
  function slice() {
    if (!job) return;
    if (job.version !== app.version || job.sid !== current()) { drop(); return; }
    const st = job.job.step(SLICE_MS);
    if (st.done) finish();
    else { UI.surgeBar.renderProgress(); setTimeout(slice, 0); }
  }
  function finish() {
    const run = job.job.result();
    run.elapsedApp = performance.now() - job.started;
    app.surgeRuns[job.sid] = run;
    job = null;
    if (cursor.sid !== current() || !run.times || cursor.i >= run.times.length) cursor = { sid: current(), i: 0 };
    app.renderAll();
  }
  // a run dropped without results (a new one replaces it)
  function drop() { if (job) { job.job.cancel(); job = null; } }
  // the user stops the run: what was calculated stays, marked as stopped
  app.cancelSurge = () => { if (job) { job.job.cancel(); finish(); } };
  // { k, N } of the run going on in the current scenario, or null
  app.surgeProgress = () => (job && job.sid === current() ? { k: job.job.k, N: job.job.N } : null);
  // the run of the current scenario, when it has recorded times, and the result as it came (an error too)
  app.surgeRun = () => { if (runsOf !== app.version) return null; const r = app.surgeRuns[current()]; return r && r.ok && r.times && r.times.length ? r : null; };
  app.surgeResult = () => (runsOf === app.version ? app.surgeRuns[current()] || null : null);

  // ------------------------------------------------------------ the cursor
  app.surgeCursor = () => {
    const run = app.surgeRun();
    if (!run) return 0;
    if (cursor.sid !== current()) cursor = { sid: current(), i: 0 };
    return Math.min(cursor.i, run.times.length - 1);
  };
  app.setSurgeCursor = (i) => {
    const run = app.surgeRun();
    if (!run) return;
    cursor = { sid: current(), i: Math.max(0, Math.min(run.times.length - 1, i)) };
    app.renderAll();
  };
  app.surgeCursorTime = () => { const run = app.surgeRun(); return run ? run.times[app.surgeCursor()] : NaN; };

  // a time of the water hammer on the screen: seconds with up to six significant digits ("2,35 s")
  function time(sec) {
    if (!Number.isFinite(sec)) return '—';
    return `${PumpIt.ui.format.num(+sec.toPrecision(6), { maximumFractionDigits: 6 })} s`;
  }

  UI.surgeFormat = { time };
})(window);
