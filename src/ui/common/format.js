// Number formatting in the number locale of the current language, parsing of typed numbers, unit labels and
// default output units.
(function (root) {
  const PumpIt = root.PumpIt;
  const U = PumpIt.units;
  const i18n = PumpIt.i18n;

  // The number locale of the current language gives the grouping of digits; the decimal mark is a choice of the
  // Options menu (app.prefs.decimal: ',' or '.'), by default the one of the language (a comma in Portuguese and
  // Spanish, a point in English). The other mark groups the thousands.
  const locale = () => i18n.numberLocale();
  let chosen = null;
  const setDecimal = (m) => { chosen = m === ',' || m === '.' ? m : null; };
  const marks = { locale: null, dec: '.', group: ',' };
  function localeMarks() {
    const loc = locale();
    if (marks.locale !== loc) {
      marks.locale = loc;
      marks.dec = (1.5).toLocaleString(loc).charAt(1);
      const g = (1234567.5).toLocaleString(loc).replace(/[0-9]/g, '').charAt(0);
      marks.group = g && g !== marks.dec ? g : marks.dec === ',' ? '.' : ',';
    }
    return marks;
  }
  const languageDecimal = () => localeMarks().dec;
  const decimalSep = () => chosen || languageDecimal();
  const groupSep = () => (decimalSep() === ',' ? '.' : ',');
  // a number written by the locale, with the decimal mark in use (and the other mark for the thousands)
  function marked(s) {
    const m = localeMarks(), d = decimalSep();
    if (d === m.dec && groupSep() === m.group) return s;
    return s.split('').map((c) => (c === m.dec ? d : c === m.group ? groupSep() : c)).join('');
  }
  // a number in the locale of the language, with the marks in use: num(v, options of toLocaleString)
  const num = (v, opts) => marked(v.toLocaleString(locale(), opts)).replace(/-/g, '−');

  function fmt(v, sig = 4) {
    if (v === null || v === undefined || Number.isNaN(v)) return '—';
    if (!Number.isFinite(v)) return v > 0 ? '∞' : '−∞';
    if (v === 0) return '0';
    const a = Math.abs(v);
    if (a >= 1e7 || a < 1e-4) return v.toExponential(sig - 1).replace('.', decimalSep()).replace('e+', 'e').replace(/-/g, '−');
    const dec = Math.max(0, Math.min(6, sig - 1 - Math.floor(Math.log10(a))));
    return num(v, { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }

  // number with a fixed count of decimals (grouped digits, the decimal mark in use)
  const fixed = (v, d) => num(v, { minimumFractionDigits: d, maximumFractionDigits: d });

  // value of an input field: as stored, without grouping, with the decimal mark in use. It reads back to the same
  // number, so a value copied from the model data can be typed again (review of d05430d, item 13)
  const inputStr = (v) => (v === null || v === undefined || Number.isNaN(v) ? '' : String(v).replace('.', decimalSep()));

  // A typed number. Only the decimal mark in use is a decimal mark; the other one is taken only as the grouping of
  // the thousands, in groups of three ("12.000" is 12000 with a decimal comma). Anywhere else ("1.5" with a decimal
  // comma) the text is not a number, and the field asks for a correction instead of guessing. The typographic minus
  // signs (of the sign and of the exponent) are read as minus signs.
  // A space, a tab or a line break inside the text is not a number either: two cells of a spreadsheet pasted in one
  // field ("300\t12") were read as 30012 (review of e6b8f15, item 20). The spaces around it are dropped.
  function parseNum(s) {
    const t = String(s).trim().replace(/−/g, '-');
    if (t === '' || /\s/.test(t)) return NaN;
    const d = decimalSep(), g = groupSep();
    const m = /^([+-]?)([0-9.,]*)(?:[eE]([+-]?[0-9]+))?$/.exec(t);
    if (!m || !/[0-9]/.test(m[2])) return NaN;
    const parts = m[2].split(d);
    if (parts.length > 2) return NaN;
    let int = parts[0];
    const frac = parts.length > 1 ? parts[1] : null;
    if (frac !== null && frac.includes(g)) return NaN;
    if (int.includes(g)) {
      const groups = int.split(g);
      if (!/^[0-9]{1,3}$/.test(groups[0]) || groups.slice(1).some((x) => !/^[0-9]{3}$/.test(x))) return NaN;
      int = groups.join('');
    }
    const n = Number(m[1] + (int || '0') + (frac !== null ? '.' + (frac || '0') : '') + (m[3] !== undefined ? 'e' + m[3] : ''));
    return Number.isFinite(n) ? n : NaN;
  }

  // text shown for a unit (some symbols change with the language)
  const unit = (u) => U.label(u);

  const DEFAULT_OUT = {
    pressure: 'kgf/cm²(g)', dp: 'kgf/cm²', head: 'm', massFlow: 'kg/s', volFlow: 'm³/h', normFlow: 'Nm³/h', velocity: 'm/s',
    power: 'kW', length: 'm', density: 'kg/m³', viscosity: 'cP', temperature: '°C',
    volume: 'm³', headGradient: 'm/100 m', dpGradient: 'kgf/cm²/100 m',
    energy: 'kWh', mass: 'kg', time: 'h', flow: 'm³/h', area: 'cm²',
  };

  function conv(vSI, cat, unit, ctx) {
    if (!cat || !Number.isFinite(vSI)) return vSI;
    return U.fromSI(vSI, unit, cat, ctx);
  }

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // The identifier of an object in a table (P1, J2 and its name): a button, reached with Tab, that finds the object on
  // the drawing as a click on its row does (the row carries data-key). Tables of objects have the class "objects": their
  // first column stays at the left edge while the table scrolls across (documents.css).
  const objId = (text) => `<button type="button" class="obj-id" title="${esc(i18n.t('app.showObjectTitle'))}">${esc(text)}</button>`;

  // <option> of a select; the value attribute is only needed when the text differs from it
  const option = (value, text, selected) => `<option${String(value) !== String(text) ? ` value="${esc(value)}"` : ''}${selected ? ' selected' : ''}>${esc(text)}</option>`;

  PumpIt.ui.format = { fmt, fixed, num, inputStr, parseNum, setDecimal, languageDecimal, decimalMark: () => chosen, groupSep, unit, option, locale, decimalSep, DEFAULT_OUT, conv, objId, esc };
})(typeof window !== 'undefined' ? window : globalThis);
