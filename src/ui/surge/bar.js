// The water hammer at the top of the page: the stamp "Water hammer" next to the stamp of the regime while it is on (with
// the progress of its run and the button that stops it), and its time cursor in the row of the tabs: the time whose
// state colours the drawing, and the buttons and the slider that go through the recorded times. The elements are made
// here, so the page has none of them without the module.
(function (root) {
  const PumpIt = root.PumpIt;
  const UI = PumpIt.ui;
  const app = PumpIt.app;
  const { el } = UI.dom;
  const F = UI.format;
  const { t } = PumpIt.i18n;
  const tx = (key, params) => t('surge.bar.' + key, params);

  const ICON = {
    first: '<path d="M4 3v10M13 3L6 8l7 5z" fill="currentColor"/>',
    prev: '<path d="M11 3L4 8l7 5z" fill="currentColor"/>',
    play: '<path d="M5 3l8 5-8 5z" fill="currentColor"/>',
    pause: '<path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor"/>',
    next: '<path d="M5 3l7 5-7 5z" fill="currentColor"/>',
    last: '<path d="M12 3v10M3 3l7 5-7 5z" fill="currentColor"/>',
    stop: '<path d="M4 4h8v8H4z" fill="currentColor"/>',
  };
  const icon = (k) => `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">${ICON[k]}</svg>`;
  const STEP_MS = 80; // a recorded time of the playback

  let built = false, playing = null, pendingI = null;
  let stamp, cancel, bar;

  function ensure() {
    if (built) return;
    built = true;
    stamp = el('button', { id: 'surge-stamp', class: 'stamp surge', type: 'button', hidden: true });
    cancel = el('button', { id: 'surge-cancel', class: 'btn ghost icon time-cancel', type: 'button', hidden: true }, icon('stop'));
    const after = document.getElementById('time-cancel');
    after.after(stamp, cancel);
    bar = el('div', { class: 'timebar surgebar', id: 'surgebar', role: 'group', hidden: true });
    const b = (k) => `<button type="button" class="btn ghost icon" data-sc="${k}">${icon(k)}</button>`;
    bar.innerHTML = `${b('first')}${b('prev')}${b('play')}${b('next')}${b('last')}
      <input type="range" id="sc-range" min="0" max="0" step="1" value="0">
      <span class="tc-time" id="sc-time" aria-live="polite"></span>`;
    document.getElementById('timebar').after(bar);
    bar.addEventListener('click', (e) => {
      const k = e.target.closest('[data-sc]');
      if (!k) return;
      const run = app.surgeRun();
      if (!run) return;
      const i = app.surgeCursor(), n = run.times.length;
      if (k.dataset.sc !== 'play') stop();
      ({ first: () => app.setSurgeCursor(0), prev: () => app.setSurgeCursor(i - 1), next: () => app.setSurgeCursor(i + 1), last: () => app.setSurgeCursor(n - 1), play: () => (playing ? stop() : play()) })[k.dataset.sc]();
    });
    bar.querySelector('#sc-range').addEventListener('input', (e) => {
      stop();
      const first = pendingI === null;
      pendingI = Number(e.target.value);
      if (first) requestAnimationFrame(() => { const i = pendingI; pendingI = null; app.setSurgeCursor(i); });
    });
    stamp.addEventListener('click', () => UI.systemWindow.open());
    cancel.addEventListener('click', () => app.cancelSurge());
  }

  function play() {
    const run = app.surgeRun();
    if (!run) return;
    if (app.surgeCursor() >= run.times.length - 1) app.setSurgeCursor(0);
    // about two hundred frames for the whole run
    const jump = Math.max(1, Math.round(run.times.length / 200));
    playing = setInterval(() => {
      const r = app.surgeRun();
      if (!r || app.surgeCursor() >= r.times.length - 1) { stop(); return; }
      app.setSurgeCursor(app.surgeCursor() + jump);
    }, STEP_MS);
    labels();
  }
  function stop() {
    if (!playing) return;
    clearInterval(playing);
    playing = null;
    labels();
  }

  function labels() {
    const set = (k, txt) => { const e = bar.querySelector(`[data-sc="${k}"]`); e.title = txt; e.setAttribute('aria-label', txt); };
    for (const k of ['first', 'prev', 'next', 'last']) set(k, tx(k));
    set('play', tx(playing ? 'pause' : 'play'));
    bar.querySelector('[data-sc="play"]').innerHTML = icon(playing ? 'pause' : 'play');
    bar.querySelector('#sc-range').setAttribute('aria-label', tx('slider'));
    bar.setAttribute('aria-label', tx('aria'));
    cancel.title = tx('cancel');
    cancel.setAttribute('aria-label', tx('cancel'));
  }

  // the stamp: off, running (its progress) or on
  function renderProgress() {
    ensure();
    const on = app.surgeOn();
    const p = app.surgeProgress();
    stamp.hidden = !on;
    cancel.hidden = !(on && p);
    if (!on) return;
    stamp.textContent = p ? t('surge.stamp.running', { pct: Math.min(99, Math.floor((100 * p.k) / (p.N + 1))) }) : t('surge.stamp.label');
    stamp.title = t('surge.stamp.title');
    stamp.classList.toggle('running', !!p);
  }

  function render() {
    ensure();
    renderProgress();
    labels();
    const run = app.surgeRun();
    bar.hidden = !run || !app.surgeOn();
    if (bar.hidden) { stop(); return; }
    const i = app.surgeCursor(), n = run.times.length;
    const range = bar.querySelector('#sc-range');
    range.max = String(n - 1);
    if (pendingI === null) range.value = String(i);
    const stopped = run.stopped ? ` · ${F.esc(t(run.stopped.reason === 'cancel' ? 'surge.bar.cancelled' : 'surge.bar.stopped', { t: UI.surgeFormat.time(run.stopped.t) }))}` : '';
    bar.querySelector('#sc-time').innerHTML = `<b>${F.esc(t('surge.bar.label'))} ${F.esc(UI.surgeFormat.time(run.times[i]))}</b>${stopped ? `<span class="tc-stop">${stopped}</span>` : ''}`;
    for (const k of ['first', 'prev']) bar.querySelector(`[data-sc="${k}"]`).disabled = i <= 0;
    for (const k of ['next', 'last']) bar.querySelector(`[data-sc="${k}"]`).disabled = i >= n - 1;
  }

  PumpIt.ui.surgeBar = { render, renderProgress, stop };
})(window);
