// SVG line chart with "nice" axis steps, used by the pump and profile charts.
(function (root) {
  const PumpIt = root.PumpIt;
  const F = PumpIt.ui.format;
  const { t } = PumpIt.i18n;

  function niceStep(range, n = 6) {
    const raw = range / n;
    const p = 10 ** Math.floor(Math.log10(raw));
    const m = raw / p;
    return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
  }

  // the sample of a series in the legend: a short piece of its line, with its colour, width and dashes, and its marker
  // when it has one, so that a series can be told apart by its line alone (in grey, or for whoever does not see colour)
  function swatch(s) {
    const w = s.width || 2.4;
    const dash = s.dash ? ` stroke-dasharray="${s.dash}"` : '';
    const mark = s.marker ? `<circle cx="15" cy="6" r="3.2" style="fill:${s.color}"/>` : '';
    return `<svg class="swatch" viewBox="0 0 30 12" width="30" height="12" aria-hidden="true"><line x1="1" x2="29" y1="6" y2="6" style="stroke:${s.color}" stroke-width="${w}"${dash}/>${mark}</svg>`;
  }

  // the values of the series of a chart in a table that opens under it (a <details>, by keyboard as well): one row per
  // point, in the order drawn, with the name of its series, x and y in the units of the chart. Points at the same x
  // stay apart (a step at a junction); a point repeated exactly is shown once.
  // o = { summary, xHead, yHead, series, open (shown open), id (of the <details>) }
  function valuesTable(o) {
    const rows = [];
    for (const s of o.series) {
      if (!s.name) continue;
      let last = null;
      for (const p of s.pts) {
        if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
        if (last && last[0] === p[0] && last[1] === p[1]) continue;
        last = p;
        rows.push(`<tr><td class="txt">${F.esc(s.name)}</td><td class="num">${F.fmt(p[0], 5)}</td><td class="num">${F.fmt(p[1], 5)}</td></tr>`);
      }
    }
    if (!rows.length) return '';
    const head = `<tr><th class="txt">${F.esc(t('charts.values.series'))}</th><th>${F.esc(o.xHead)}</th><th>${F.esc(o.yHead)}</th></tr>`;
    return `<details class="chart-values"${o.id ? ` id="${o.id}"` : ''}${o.open ? ' open' : ''}><summary>${F.esc(o.summary)}</summary>`
      + `<div class="table-scroll"><table class="grid"><thead>${head}</thead><tbody>${rows.join('')}</tbody></table></div></details>`;
  }

  // generic line chart: o = { title, xLabel, yLabel, xMin, yMin, series: [{ name, pts, color, dash, width, marker }], points,
  // xTick (optional: the text of a tick of the x axis, from its value) }
  function lineChart(o) {
    const W = 880, Hh = 400, L = 70, R = 24, T = 18, B = 52;
    const all = o.series.flatMap((s) => s.pts).concat((o.points || []).map((p) => [p.x, p.y])).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if (!all.length) return `<div class="empty">${t('charts.noData')}</div>`;
    let x0 = o.xMin ?? Math.min(...all.map((p) => p[0])), x1 = Math.max(...all.map((p) => p[0]));
    let y0 = o.yMin ?? Math.min(...all.map((p) => p[1])), y1 = Math.max(...all.map((p) => p[1]));
    if (x1 === x0) x1 = x0 + 1;
    if (y1 === y0) { y1 += 1; y0 -= 1; }
    const xs = niceStep(x1 - x0), ys = niceStep(y1 - y0);
    x0 = Math.floor(x0 / xs) * xs; x1 = Math.ceil(x1 / xs) * xs;
    y0 = Math.floor(y0 / ys) * ys; y1 = Math.ceil(y1 / ys) * ys;
    const tick = (v, step) => { const d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9)); return F.fixed(+v.toFixed(d), d); };
    const X = (x) => L + ((x - x0) / (x1 - x0)) * (W - L - R);
    const Y = (y) => T + (1 - (y - y0) / (y1 - y0)) * (Hh - T - B);
    let g = '';
    for (let v = y0; v <= y1 + ys / 2; v += ys) g += `<line class="gridline" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end">${tick(v, ys)}</text>`;
    for (let v = x0; v <= x1 + xs / 2; v += xs) g += `<line class="gridline" y1="${T}" y2="${Hh - B}" x1="${X(v)}" x2="${X(v)}" opacity=".5"/><text x="${X(v)}" y="${Hh - B + 17}" text-anchor="middle">${o.xTick ? F.esc(o.xTick(v)) : tick(v, xs)}</text>`;
    g += `<line class="axis" x1="${L}" x2="${W - R}" y1="${Hh - B}" y2="${Hh - B}"/><line class="axis" x1="${L}" x2="${L}" y1="${T}" y2="${Hh - B}"/>`;
    g += `<text class="axis-label" x="${(L + W - R) / 2}" y="${Hh - 10}" text-anchor="middle">${F.esc(o.xLabel)}</text>`;
    g += `<text class="axis-label" transform="translate(16 ${(T + Hh - B) / 2}) rotate(-90)" text-anchor="middle">${F.esc(o.yLabel)}</text>`;
    for (const s of o.series) {
      const pts = s.pts.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
      if (!pts.length) continue;
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join('');
      g += `<path d="${d}" fill="none" style="stroke:${s.color}" stroke-width="${s.width || 2.4}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''} stroke-linejoin="round"/>`;
      if (s.marker) g += pts.map((p) => `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="3.2" style="fill:${s.color}"/>`).join('');
    }
    for (const p of o.points || []) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      g += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="6" style="fill:var(--panel);stroke:${p.color}" stroke-width="2.6"/>`;
      if (p.label) g += `<text x="${X(p.x) + 10}" y="${Y(p.y) - 10}" style="fill:var(--ink);font-weight:500">${F.esc(p.label)}</text>`;
    }
    const legend = o.series.filter((s) => s.name).map((s) => `<span>${swatch(s)}${F.esc(s.name)}</span>`).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${F.esc(o.title || t('charts.chart'))}">${g}</svg><div class="chart-legend">${legend}</div>`;
  }

  PumpIt.ui.lineChart = { niceStep, lineChart, swatch, valuesTable };
})(typeof window !== 'undefined' ? window : globalThis);
