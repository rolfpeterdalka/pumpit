// Charts view: chart tabs (pump × system, profile, and over time with a run of the time simulation) and their controls.
// A module adds charts of its own with register (the water hammer: src/ui/surge/charts.js), each with its tab.
(function (root) {
  const PumpIt = root.PumpIt;
  const UI = PumpIt.ui;
  const { $, $$ } = UI.dom;
  const app = PumpIt.app;
  const { t } = PumpIt.i18n;

  const CHARTS = { pump: () => UI.pumpChart.render, profile: () => UI.profileChart.render, time: () => UI.timeChart.render };

  // the charts of the modules: kind → { render(box, ctl, notes), visible() (whether its tab shows), label (the key of the
  // text of its tab), bind() (optional, once at the start) }
  const EXTRA = new Map();
  function register(kind, o) {
    EXTRA.set(kind, o);
    CHARTS[kind] = () => o.render;
    const tabs = document.getElementById('chart-tabs');
    if (!tabs || tabs.querySelector(`[data-chart="${kind}"]`)) return;
    // its text follows the language with the other texts of the page (data-i18n)
    const b = document.createElement('button');
    b.dataset.chart = kind;
    b.dataset.i18n = o.label;
    b.textContent = t(o.label);
    b.hidden = true;
    tabs.appendChild(b);
  }

  // the notes under a chart start empty at every drawing: a chart that stops early (no network, no results, a curve that
  // failed) never leaves those of another model or another choice
  function render(kind, box, ctl, notes) {
    notes.textContent = '';
    (CHARTS[kind] || CHARTS.pump)()(box, ctl, notes);
  }

  // marks the chosen tab and draws its chart (the first one when the chosen tab is not there)
  function renderView() {
    // the chart over time is there with the time simulation on, those of a module when it says so
    $('#chart-tabs [data-chart="time"]').hidden = !app.timeOn();
    for (const [kind, o] of EXTRA) $(`#chart-tabs [data-chart="${kind}"]`).hidden = !o.visible();
    const tab = $$('#chart-tabs button').find((b) => b.dataset.chart === app.prefs.chart);
    const kind = tab && !tab.hidden ? app.prefs.chart : 'pump';
    $$('#chart-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.chart === kind));
    render(kind, $('#chart-box'), $('#chart-controls'), $('#chart-notes'));
  }

  function bind() {
    UI.timeChart.bind();
    for (const o of EXTRA.values()) if (o.bind) o.bind();
    $('#chart-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-chart]');
      if (!b) return;
      app.prefs.chart = b.dataset.chart; app.savePrefs(); app.renderView();
    });
    // chart controls (the unit selectors are handled with the other .unit-sel in layout.js)
    document.addEventListener('change', (e) => {
      if (e.target.id === 'ch-pump') { app.prefs.chartPump = Number(e.target.value); app.savePrefs(); app.renderView(); }
      if (e.target.id === 'pf-a' || e.target.id === 'pf-b' || e.target.id === 'pf-what') {
        app.prefs.profile = { a: Number($('#pf-a').value), b: Number($('#pf-b').value), what: $('#pf-what').value };
        app.savePrefs(); app.renderView();
      }
    });
  }

  PumpIt.ui.charts = { render, renderView, bind, register };
})(typeof window !== 'undefined' ? window : globalThis);
