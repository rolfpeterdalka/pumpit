// Checklist pop-up: what is still missing before the model can be calculated, with links to the system window and to
// every undefined object, and the error when the calculation was refused. The list of objects scrolls inside the
// pop-up, which never grows past the window; the arrow keys move along it. Choosing an object selects it, opens its
// properties and takes the focus to the field it lacks (src/ui/inspector/pending.js).
(function (root) {
  const PumpIt = root.PumpIt;
  const UI = PumpIt.ui;
  const app = PumpIt.app;
  const F = UI.format;
  const { $ } = UI.dom;
  const { t } = PumpIt.i18n;

  // what is pending: the items other than the pipes and junctions (solution, system, time simulation, water hammer),
  // each undefined object, and a network without pipes or without junctions
  function count(v) {
    return v.items.filter((i) => !i.ok && !i.net).length + v.undef.size + v.items.filter((i) => i.net && i.empty).length;
  }

  function fill() {
    const v = app.validation();
    const pop = $('#checklist-pop');
    let html = `<div class="eyebrow" style="margin-bottom:6px">${t('app.checklist.title')}</div><div class="check-items">`;
    html += v.items.map((i) => {
      const inner = `<span class="dot ${i.ok ? 'ok' : 'bad'}"></span><div>${F.esc(i.label)}${i.detail && !i.ok ? `<small>${F.esc(i.detail)}</small>` : ''}</div>`;
      // the system and the solution control open the system window, where they are edited
      return i.key ? `<button type="button" class="check-item" data-system${i.ok ? '' : ' data-bad'}>${inner}</button>` : `<div class="check-item">${inner}</div>`;
    }).join('');
    html += '</div>';
    if (v.undef.size) {
      html += `<div class="menu-sep"></div><div class="eyebrow" id="undef-title" style="margin:6px 0 4px">${t('app.checklist.undefined')} (${v.undef.size})</div>`;
      html += `<div class="undef-list" role="group" aria-labelledby="undef-title">` + [...v.undef].map(([k, miss]) => `<button type="button" data-goto="${k}"><b class="num">${k[0] === 'p' ? 'P' : 'J'}${k.slice(2)}</b><small class="muted">${F.esc(miss.join('; '))}</small></button>`).join('') + '</div>';
    }
    const r = app.currentResults();
    if (v.ok && r && !r.ok) html += `<div class="menu-sep"></div><p class="small" style="margin:6px 0 0;color:var(--crit)">${F.esc(r.errors[0])}</p>`;
    // the focus stays on the same entry when the list is drawn again (an edit while it is open)
    const had = pop.contains(document.activeElement) ? document.activeElement.dataset.goto : null;
    const scroll = pop.querySelector('.undef-list') ? pop.querySelector('.undef-list').scrollTop : 0;
    pop.innerHTML = html;
    const list = pop.querySelector('.undef-list');
    if (list) list.scrollTop = scroll;
    if (had) { const b = pop.querySelector(`[data-goto="${had}"]`); if (b) b.focus({ preventScroll: true }); }
    fit();
  }

  // the pop-up ends above the bottom of the window; the list of objects takes the room left and scrolls
  function fit() {
    const pop = $('#checklist-pop');
    if (pop.hidden) return;
    pop.style.maxHeight = Math.max(160, innerHeight - pop.getBoundingClientRect().top - 12) + 'px';
  }

  // focus: the first entry that needs something gets the focus (opened from the keyboard or from Results)
  function open(opts = {}) {
    app.hideMenus();
    $('#checklist-pop').hidden = false;
    $('#btn-checklist').setAttribute('aria-expanded', 'true');
    fill();
    if (opts.focus) {
      const first = $('#checklist-pop').querySelector('button[data-bad]') || $('#checklist-pop').querySelector('[data-goto]');
      if (first) first.focus();
    }
  }
  function close(refocus) {
    $('#checklist-pop').hidden = true;
    $('#btn-checklist').setAttribute('aria-expanded', 'false');
    if (refocus) $('#btn-checklist').focus();
  }

  function bind() {
    const pop = $('#checklist-pop');
    $('#btn-checklist').setAttribute('aria-expanded', 'false');
    $('#btn-checklist').addEventListener('click', (e) => { e.stopPropagation(); if (pop.hidden) open({ focus: e.detail === 0 }); else close(); });
    pop.addEventListener('click', (e) => {
      if (e.target.closest('[data-system]')) { UI.systemWindow.open(); return; }
      const b = e.target.closest('[data-goto]');
      if (!b) return;
      app.hideMenus();
      UI.pending.open(b.dataset.goto);
    });
    // the arrow keys, Home and End move along the entries; Esc closes and gives the focus back to the button
    pop.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(true); return; }
      const all = [...pop.querySelectorAll('button')];
      const i = all.indexOf(document.activeElement);
      let to = null;
      if (e.key === 'ArrowDown') to = all[Math.min(all.length - 1, i + 1)];
      else if (e.key === 'ArrowUp') to = all[Math.max(0, i - 1)];
      else if (e.key === 'Home') to = all[0];
      else if (e.key === 'End') to = all[all.length - 1];
      if (to) { e.preventDefault(); to.focus(); }
    });
    root.addEventListener('resize', fit);
  }

  PumpIt.ui.checklist = { fill, open, close, count, bind };
})(window);
