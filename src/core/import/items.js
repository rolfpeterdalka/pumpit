// The blocks of the kinds of junction of .imp files, read item by item (the description of the .imp format, 23 November
// 2026, section 12 and Annex A; decisions I-08 and I-09 of docs/imp-import.md). The block of a kind is a sequence of
// items: a field; a counted list ("L:"), its count and its values; a table ("T:"), [key, nY, n, unit of x, nY units of
// y, n rows of 1 + nY values], the table of Annex A.2 of the time simulation; an event ("E"), 8 fields; the fields of
// each pipe of the junction at the start of the block ("P3", "P5"); a group ("Gk:"), its count and k fields per element;
// the configurations of a pump ("CFG", as many as the field cfgCount before them); and the time data of the junction
// ("TEMPO"). Each item has the size its own counts give, so a block is walked from its start and every named item found
// by its place, whatever the lists and tables before it hold. The record of a child scenario is walked with the same
// items and its own counts, and merged with its parent item by item.
(function (root) {
  const PumpIt = root.PumpIt;
  const { str, n0, num, put, mergeList, mergePerPipe, junctionLayout, mergeJunction } = PumpIt.importShared;

  // the items of the block of each kind (Annex A of the description), in its notation: a name is a field, "-" a field
  // without use; the names are those of the description
  const TEMPO = 'rel, ign, rep1, rep2, trig, E, E, T:table1, T:table2';
  const SCHEMAS = {
    1: 'P3, srcType, src, srcU, -, -, -, -, dzU, -, costDesc, TEMPO',
    2: 'P5, -, depthU, surfP, surfPU, rho, rhoU, T, TU, -, -, usePipeElev, -, costDesc, -, tankType, levelType, level, levelU, known, bottom, bottomU, height, heightU, useVolTable, area, areaU, nGas, T:volTable, tModel, TEMPO, pMax, pMaxU, pMin, pMinU, heat, V0, V0U, thermo, rhoT, heatU, knownInit, hiAcc',
    3: 'qType, q, qU, out, T, TU, K, -, -, costDesc, TEMPO, -, periodic, chopped, freq, amp, ampU, useRef, refType, ref, refU, heat',
    4: 'P3, stag, p, pU, T, TU, -, -, rA, rAU, -, baType, ba, baU, dzU, -, costDesc, TEMPO, periodic, chopped, freq, amp, ampU, heat',
    5: 'acType, transition, angle, K, rA, rAU, baType, ba, baU, -, costDesc',
    6: 'elbowType, angle, rD, K, rA, rAU, baType, ba, baU, T:mult, -, L:cons, costDesc, darby, K2, K3, eqType, eqU',
    7: 'tyType, angle, rotation, lossType, -, costDesc, kCalc, kMax, diagram, flipped',
    8: 'exitType, lossType, pType, pU, qType, qU, qMax, fit, L:coef, backType, back, backU, backT, backTU, rA, rAU, loss, baType, ba, baU, special, source, addLoss, T:mult, -, L:cons, costDesc, TEMPO, cvFromTable, pctOpen, T:openTable, FD, FL, ID, IDU, xt, grove, redPort, redType, portDia, angIn, angOut, redU, angSame, rhoRefType, rhoRef, rhoRefU, darby, K2, K3, eqType, profile, xtSource, eqU',
    9: 'valveType, ctlType, stag, set, setU, remote, remoteInOut, closedType, state, lossType, openLoss, T:openTable, -, listName, link, L:cons, costDesc, always, defaultFail, failIn, failOut, TEMPO, xtOpen, FD, FL, ID, IDU, relFail, T:failTable, ovrFn, ovrType, ovrStag, ovr, ovrU, ovrSteady, cvFromTable, rateClose, rateOpen, G4:rates, profile, tParamCv',
    10: 'lossType, pType, pU, qType, qU, qMax, fit, L:coef, state, rA, rAU, loss, baType, ba, baU, T:mult, -, L:cons, costDesc, dpType, dpOpen, dpOpenU, FD, FL, ID, IDU, rel, ign, T:table1, T:table2, vClose, vCloseU, rhoRefType, rhoRef, rhoRefU, allowOpen, model, I, IU, rcg, rcgU, Ad, AdU, Wd, WdU, ks, ksU, Ts0, Ts0U, thMin, thMax, T:cvTheta, dynSource, orient, orientAngle, WdT, WdTU, AdT, AdTU, xMax, xMaxU, ksT, ksTU, Fs0, Fs0U, T:cvTravel, fluidMassType, fluidMass, fluidMassU, perfType, v0, v0U, decelQmax, decelFit, L:decelCoef, T:decelTable, decelWindow, cwL, cwLU, cwW, cwWU, cwI, cwIU, cwAngle',
    11: '',
    12: 'orType, lossType, pType, pU, qType, qU, qMax, fit, L:coef, rA, rAU, faType, fa, faU, rD, K, baType, ba, baU, T:mult, -, L:cons, costDesc, exitType, backType, back, backU, backT, backTU, rhoRefType, rhoRef, rhoRefU',
    16: 'P3, sprayType, lossType, pType, pU, qType, qU, qMax, fit, L:coef, fa, faU, holes, loss, exitType, pExit, pExitU, TExit, TExitU, dzU, -, L:cons, costDesc, rA, rAU, TEMPO, rhoRefType, rhoRef, rhoRefU',
    20: 'gcType, lossType, pType, pU, qType, qU, qMax, fit, L:coef, rA, rAU, loss, baType, ba, baU, T:mult, -, L:cons, costDesc, rhoRefType, rhoRef, rhoRefU',
    21: 'valveType, lossType, pType, pU, qType, qU, qMax, fit, L:coef, state, crackType, crack, crackU, back, backU, rA, rAU, loss, baType, ba, baU, T:mult, -, L:cons, costDesc, FD, FL, ID, IDU, rel, ign, T:table1, T:table2, rhoRefType, rhoRef, rhoRefU, openType, closeType, balanced, varType, over, overU, blowdown, blowdownU, preset, remoteUse, remotePipe, remoteLoc, rateClose, rateOpen, G4:rates, anticip, hiSet, hiSetU, loSet, loSetU, rateOpenAntOnly, cdaSource, api526, fa, faU, T:cvTable, TExit, TExitU',
    22: 'n, V, VU, restrictor, CdIn, CdOut, fa, faU, riser, riserF, riserD, riserDU, riserA, riserAU, riserL, riserLU, riserDz, riserDzU, useRef, refType, ref, refU, Vmax, Vmin, gasType, gasP, gasPU, relief, reliefP, reliefPU, gasT, gasTU, liqT, liqTU, liqTUser, geometry, caps, calcDim, vol, volU, diam, diamU, height, heightU, T:geoTable, geoHU, geoVU, VlimU',
    24: 'P3, dzU, height, heightU, area, areaU, surfP, surfPU, restrictor, CdIn, CdOut, fa, faU, riser, riserF, riserD, riserDU, riserA, riserAU, riserL, riserLU, riserDz, riserDzU, oneWay, dip, dipBottom, dipBottomU, nGas, useVolTable, T:volTable, useRef, refLevel, refLevelU, E, E, T:table1, T:table2, cvCv, dpType, dpOpen, dpOpenU, cvInit, rel, ign, rep1, rep2, trig',
    25: 'crackType, crack, crackU, CdAin, CdAinU, CdAout, CdAoutU, liqTType, liqT, liqTU, gasType, molWt, gamma, gasText, gasTextU, gasPext, gasPextU, m0, m0U, single, avType, CdAmid, CdAmidU, trigType, trig, trigU, delay',
    17: 'pumpType, -, dfh, dfhU, stag, hType, hU, qType, qU, pwType, pwU, cfgSel, cfgCount, CFG, speed, pumpState, sealSel, G3:seals, shaft, shaftU, dMax, dMin, dU, -, ctlType, ctl, ctlU, ctlIfExceeded, remote, remoteInOut, viscCorr, bepType, bepQ, bepQU, thermType, therm, rhoRefType, rhoRef, rhoRefU, -, listName, link, L:cons, npshRefZ, effNom, effNomU, npshNom, npshNomU, costDesc, ctlStag, T:motorEff, T:vfdEff, nPumps, impData, TEMPO, checkValve, thermU, ratedRpmSteady, slurry, -, -, -, -, -, -, -, submerged, subType, subP, subPU, periodic, chopped, freq, amp, ampU, tModel, I, IU, rpm, fqSource, fqIncr, fqAngleType, T:fqData, vClose, vCloseU, reverse, dpType, dpOpen, dpOpenU, cH, cQ, cE, ieRpm, ieH, ieHU, ieQ, ieQU, ieEff, ieEffU, ieRho, ieRhoU, ieSys, fqRated, subT, subTU, sMin, group, category, upJ, downJ, pdAcc, pdType, pdC, pdFluid, pdK, pdRpm, revFlow, inertiaType, pdFlowType, pdHeads, pdSpeed, patKnown, patQmin, patQminU, patT, patP, ieQType, iePType, ieCustom, ieStages, ieDmax, ieD, ieDU, fqTransform, fqTrQType, fqTrQ, fqTrPType, fqTrP, fqTrOp, pdBore, pdBoreU, pdStroke, pdStrokeU, pdRod, pdRodU, startSpeedType, syncRpm, refInType, refInP, refInT, refInPU, refInTU, fqAuto, subDepth, subDepthU, pdClear, pdClearU, svOpen, svClose, dvOpen, dvClose, pdCrank, pdRodDia, pdRodDiaU, pdCrankClear, pdCrankClearU, pdArr, pdDouble',
  };
  // a configuration of a pump: 15 fields after the list of the efficiency in .imp files (13 in .fth files, I-03)
  const CFG = 'cfgName, cfgRpm, cfgDia, cfgDiaU, cfgQmax, cfgFitH, L:cfgH, cfgFile, cfgFitN, L:cfgN, cfgNexp, cfgNmin, cfgFitE, L:cfgE, cfgRunType, cfgRun, cfgRunU, cfgBep, cfgBepU, cfgPorType, cfgPorUp, cfgPorLow, -, -, -, -, cfgAorU, cfgMap, cfgIgv';

  // a schema as a list of items { kind, name, w }: field, skip, list, table, event, perPipe (w fields per pipe), group (w
  // fields per element) and cfg (counted by the field before it). The two events of a block are ev1 and ev2
  function parse(text) {
    const out = [];
    let ev = 0;
    for (const tok of text.split(',').map((s) => s.trim()).filter(Boolean)) {
      let m;
      if (tok === 'TEMPO') out.push(...parse(TEMPO).map((x) => (x.kind === 'event' ? Object.assign({}, x, { name: 'ev' + ++ev }) : x)));
      else if (tok === '-') out.push({ kind: 'skip' });
      else if (tok === 'E') out.push({ kind: 'event', name: 'ev' + ++ev });
      else if (tok === 'CFG') out.push({ kind: 'cfg', name: 'cfg', count: 'cfgCount' });
      else if ((m = /^P(\d)$/.exec(tok))) out.push({ kind: 'perPipe', name: 'perPipe', w: Number(m[1]) });
      else if ((m = /^L:(\w+)$/.exec(tok))) out.push({ kind: 'list', name: m[1] });
      else if ((m = /^T:(\w+)$/.exec(tok))) out.push({ kind: 'table', name: m[1] });
      else if ((m = /^G(\d+):(\w+)$/.exec(tok))) out.push({ kind: 'group', name: m[2], w: Number(m[1]) });
      else out.push({ kind: 'field', name: tok });
    }
    return out;
  }
  const PARSED = Object.fromEntries(Object.entries(SCHEMAS).map(([k, s]) => [k, parse(s)]));
  const CFG_ITEMS = parse(CFG);
  const schemaOf = (type) => PARSED[type] || null;

  // a count: its absolute value (−n and −0 keep the size of the parent, whose items the child then holds); an empty one
  // is that of the parent (I-09)
  function count(v, parN) {
    const s = str(v);
    if (s === '') return parN || 0;
    const n = Number(s);
    return Number.isInteger(n) ? Math.abs(n) : parN || 0;
  }

  // the walk of a block of record f from place p: { items: [{ name, kind, at, size, n, nY, cfgs }], by: { name → item },
  // start, end }. np: the pipes of the junction; par: the walk of the parent record, for a child scenario
  function walk(f, p, items, np, par) {
    const out = { items: [], by: {}, start: p };
    let pos = p;
    items.forEach((it, k) => {
      const pi = par && par.items[k];
      const x = { name: it.name, kind: it.kind, at: pos };
      if (it.kind === 'field' || it.kind === 'skip') x.size = 1;
      else if (it.kind === 'event') x.size = 8;
      else if (it.kind === 'perPipe') { x.w = it.w; x.size = it.w * np; }
      else if (it.kind === 'list' || it.kind === 'group') { x.w = it.w || 1; x.n = count(f[pos], pi && pi.n); x.size = 1 + x.n * x.w; }
      else if (it.kind === 'table') {
        x.nY = count(f[pos + 1], pi && pi.nY);
        x.n = count(f[pos + 2], pi && pi.n);
        x.size = 4 + x.nY + x.n * (1 + x.nY);
      } else if (it.kind === 'cfg') {
        const c = out.by[it.count];
        x.n = c ? count(f[c.at], pi && pi.n) : 0;
        x.cfgs = [];
        let qp = pos;
        for (let i = 0; i < x.n; i++) { const w = walk(f, qp, CFG_ITEMS, np, pi && pi.cfgs && pi.cfgs[i]); x.cfgs.push(w); qp = w.end; }
        x.size = qp - pos;
      }
      out.items.push(x);
      if (it.name && !(it.name in out.by)) out.by[it.name] = x;
      pos += x.size;
    });
    out.end = pos;
    return out;
  }

  // what a walk of record f gives, by the names of its items: v(name) the field as written ('' when the record ends
  // before it), n(name) its number, at(name) its place, list(name) the values of a counted list, table(name) { key, nY,
  // tu, units, rows [[τ or x, v1 … vnY]] }, event(name) its 8 fields, perPipe(i) the fields of the pipe at place i of the
  // list, group(name) its elements, cfgs the walks of the configurations of a pump
  function reader(f, w, np) {
    const field = (i) => (i < f.length && f[i] !== undefined ? f[i] : '');
    const it = (name) => w.by[name] || null;
    const per = it('perPipe');
    return {
      walk: w,
      v: (name) => { const x = it(name); return x ? field(x.at) : ''; },
      n: (name) => { const x = it(name); return x ? num(field(x.at)) : NaN; },
      at: (name) => { const x = it(name); return x ? x.at : -1; },
      has: (name) => !!it(name),
      list: (name) => { const x = it(name); return x ? Array.from({ length: x.n }, (_, i) => field(x.at + 1 + i)) : []; },
      table: (name) => {
        const x = it(name);
        if (!x) return null;
        const r0 = x.at + 4 + x.nY, rows = [];
        for (let i = 0; i < x.n; i++) rows.push(Array.from({ length: 1 + x.nY }, (_, k) => num(field(r0 + i * (1 + x.nY) + k))));
        return { key: field(x.at), nY: x.nY, tu: field(x.at + 3), units: Array.from({ length: x.nY }, (_, k) => field(x.at + 4 + k)), rows, at: x.at, end: x.at + x.size };
      },
      event: (name) => { const x = it(name); return x ? Array.from({ length: 8 }, (_, k) => field(x.at + k)) : null; },
      perPipe: (i) => (per && i < np ? Array.from({ length: per.w }, (_, k) => field(per.at + i * per.w + k)) : []),
      group: (name) => {
        const x = it(name);
        return x ? Array.from({ length: x.n }, (_, e) => Array.from({ length: x.w }, (_, i) => field(x.at + 1 + e * x.w + i))) : [];
      },
      cfgs: (it('cfg') || { cfgs: [] }).cfgs.map((cw) => reader(f, cw, np)),
    };
  }
  // the items of the block of a junction record f of its kind, from its place tb (null for a kind without a schema)
  function itemsOf(f, tb, np) {
    const sch = schemaOf(n0(f[0]));
    return sch ? reader(f, walk(f, tb, sch, np), np) : null;
  }
  // whether a walk fits its record: it ends at the end of the record, or one field after it (the record may end one field
  // before, I-08)
  const fits = (w, f) => w.end === f.length || w.end === f.length + 1;

  // ---------- merge of the record of a child scenario with that of its parent, item by item (I-09)

  // a field: empty inherits, filled replaces
  const pick = (pv, dv) => (dv !== '' && dv !== undefined ? dv : pv === undefined ? '' : pv);
  // a count that is empty in the child: the list of the parent, as −n
  const signed = (dc, pn) => (str(dc) === '' ? '-' + pn : str(dc));
  // a counted list of the child over that of the parent (F-07): n > 0 a new list, each empty value inheriting the value
  // of the parent at its place; −n (or −0) the list of the parent, its values replaced by the filled ones of the child;
  // 0 the list of the parent. Unlike the fields of a .fth record, whose counts are not all known, a value is never taken
  // for a count here
  function listOf(pl, dl, dc) {
    if (n0(dc) > 0) return dl.map((v, i) => pick(i < pl.length ? pl[i] : '', v));
    const out = pl.slice();
    if (n0(dc) < 0 || str(dc) === '-0') dl.forEach((v, i) => { if (i < out.length) out[i] = pick(out[i], v); });
    return out;
  }
  function mergeBlock(pf, pw, df, dw, items, lists) {
    const out = [], outAt = {};
    const P = (i) => (i < pf.length && pf[i] !== undefined ? pf[i] : '');
    const D = (i) => (i < df.length && df[i] !== undefined ? df[i] : '');
    items.forEach((it, k) => {
      const px = pw.items[k], dx = dw.items[k];
      if (it.name) outAt[it.name] = out.length;
      const range = (get, x) => Array.from({ length: x.size }, (_, i) => get(x.at + i));
      switch (it.kind) {
        case 'field': case 'skip': out.push(pick(P(px.at), D(dx.at))); break;
        case 'event': for (let i = 0; i < 8; i++) out.push(pick(P(px.at + i), D(dx.at + i))); break;
        case 'perPipe': // realigned by the pipe each group belongs to, as in .fth files (F-08)
          out.push(...mergePerPipe(range(P, px), range(D, dx), it.w, lists.pList, lists.list, lists.dc, lists.nP, lists.nD));
          break;
        case 'list': case 'group': { // the rules of the counted lists (F-07), element by element for a group
          const l = listOf(range(P, px).slice(1), range(D, dx).slice(1), signed(D(dx.at), px.n));
          out.push(String(l.length / px.w), ...l);
          break;
        }
        case 'table': { // the key as a field, nY as a count; the units as fields; the rows as a list, row by row, each
          // empty value inheriting the value of the parent at its row and column
          const nY = n0(D(dx.at + 1)) > 0 ? dx.nY : px.nY;
          const units = Array.from({ length: 1 + nY }, (_, i) => pick(i <= px.nY ? P(px.at + 3 + i) : '', i <= dx.nY ? D(dx.at + 3 + i) : ''));
          const rowsOf = (get, x) => Array.from({ length: x.n }, (_, r) => Array.from({ length: 1 + x.nY }, (_, c) => get(x.at + 4 + x.nY + r * (1 + x.nY) + c)));
          const pr = rowsOf(P, px), dr = rowsOf(D, dx), dc = signed(D(dx.at + 2), px.n);
          let rows;
          if (n0(dc) > 0) rows = dr.map((row, r) => Array.from({ length: 1 + nY }, (_, c) => pick(pr[r] ? pr[r][c] : '', row[c])));
          else {
            rows = pr.map((row) => Array.from({ length: 1 + nY }, (_, c) => (c < row.length ? row[c] : '')));
            if (n0(dc) < 0 || dc === '-0') dr.forEach((row, r) => { if (r < rows.length) row.forEach((v, c) => { if (c < rows[r].length) rows[r][c] = pick(rows[r][c], v); }); });
          }
          out.push(pick(P(px.at), D(dx.at)), String(nY), String(rows.length), ...units, ...rows.flat());
          break;
        }
        case 'cfg': { // the configurations of a pump, as a list of structures, each merged item by item
          const dc = signed(D(dw.by[it.count].at), px.n);
          const one = (pc, dcf) => (!dcf ? range(P, { at: pc.start, size: pc.end - pc.start })
            : !pc ? range(D, { at: dcf.start, size: dcf.end - dcf.start }) : mergeBlock(pf, pc, df, dcf, CFG_ITEMS, lists));
          const cfgs = n0(dc) > 0 ? dx.cfgs.map((c, i) => one(px.cfgs[i], c)) : n0(dc) < 0 || dc === '-0' ? px.cfgs.map((c, i) => one(c, dx.cfgs[i])) : px.cfgs.map((c) => one(c, null));
          out.push(...cfgs.flat());
          out[outAt[it.count]] = String(cfgs.length);
          break;
        }
        default:
      }
    });
    return out;
  }
  // a junction record of a child scenario merged over that of its parent: the head, the list of pipes and the common
  // block as for .fth files (mergeJunction of shared.js), the block of a kind with a schema item by item; a kind without
  // one as for .fth files (I-09). note: the notes of the import, for a child record that does not fit its layout
  function mergeJunctionItems(par, d, counted, note) {
    const sch = schemaOf(n0(par[0]));
    if (!sch || n0(par[0]) !== n0(d[0])) return mergeJunction(par, d, counted);
    const P = junctionLayout(par), D = junctionLayout(d);
    const head = par.slice(0, 5);
    for (let i = 1; i < 5; i++) put(head, i, d[i]);
    const pList = par.slice(6, P.b), list = mergeList(pList, d.slice(6, D.b), d[5]);
    const common = par.slice(P.b, P.t);
    for (let k = 0; k < 46 && D.b + k < d.length; k++) put(common, k, d[D.b + k]);
    const pw = walk(par, P.t, sch, P.np), dw = walk(d, D.t, sch, D.np, pw);
    if (note && !fits(dw, d)) note('assumed', 'recordLength', 'J' + str(par[1]), { found: d.length - D.t, expected: dw.end - D.t });
    const block = mergeBlock(par, pw, d, dw, sch, { pList, list, dc: d[5], nP: P.np, nD: D.np });
    return [...head, String(list.length), ...list, ...common, ...block];
  }

  PumpIt.importItems = { SCHEMAS, CFG, parse, schemaOf, walk, reader, itemsOf, fits, mergeBlock, mergeJunctionItems };
})(typeof window !== 'undefined' ? window : globalThis);
