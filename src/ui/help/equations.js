// Help: the formulas of the technical reference. They are the same in every language, so they live here once, as
// HTML; a help body writes [[eq:id]] to show one. The few words inside them are written «id» and come from WORDS in
// the language of the help, and English gets the decimal point. Every formula matches the code it documents
// (src/core/solver/, src/core/hydraulics/, src/core/junctions/, src/core/fluids/, src/core/surge/).
(function (root) {
  const PumpIt = root.PumpIt;

  const v = (s) => `<i>${s}</i>`; // a variable
  const sub = (x, i) => `${x}<sub>${i}</sub>`;
  const sup = (x, e) => `${x}<sup>${e}</sup>`;
  const frac = (a, b) => `<span class="fr"><span>${a}</span><span>${b}</span></span>`;
  const sqrt = (x) => `<span class="sq">√<span>${x}</span></span>`;
  const row = (...parts) => `<span class="eq-row">${parts.join('')}</span>`;
  const gap = '<span class="eq-gap"></span>';
  // parts of a long formula, each kept whole, that wrap between them on a narrow screen
  const rows = (...parts) => parts.map((p) => row(p)).join(gap);
  const SP = ' ';

  const rho = v('ρ'), mu = v('μ'), V = v('V'), g = v('g'), m = v('ṁ'), Q = v('Q'), K = v('K'), f = v('f'), L = v('L');
  const Dh = sub(v('D'), 'h'), P0 = sub(v('P'), '0'), Re = v('Re'), A = v('A'), N = v('N'), s = v('s'), z = v('z');
  const dp = (i) => `Δ${i ? sub(v('p'), i) : v('p')}`;
  const half = `½${SP}${rho}${SP}${sup(V, 2)}`;
  const vv = (x) => `${rho}${SP}${x}|${x}|`;

  const BLOCK = {
    // the network
    continuity: row(`Σ ${sub(m, '«in»')} − Σ ${sub(m, '«out»')} − ${sub(m, '«dem»')} = 0`),
    linkLoss: row(`${sub(P0, 'a')} − ${sub(P0, 'b')} + ${rho} ${g} (${sub(z, 'a')} − ${sub(z, 'b')}) − ${dp()}(${m}) = 0`),
    fixedNode: row(`${P0} = ${sub(v('P'), 'fix')}`, gap, '«or»', gap, `${P0} − ${half} = ${sub(v('p'), 'fix')}`),
    newtonStep: row(`${v('J')}(${sub(v('x'), v('k'))}) · Δ${v('x')} = −${v('R')}(${sub(v('x'), v('k'))})`, gap, `${sub(v('x'), v('k') + '+1')} = ${sub(v('x'), v('k'))} + ${v('α')} Δ${v('x')}`),
    jacobian: row(`${frac(`∂${dp()}`, `∂${m}`)} ≈ ${frac(`${dp()}(${m} + ${v('h')}) − ${dp()}(${m} − ${v('h')})`, `2${v('h')}`)}`, gap, `${v('h')} = 10<sup>−6</sup> · max(|${m}|, ${sub(m, 'ref')})`),
    lineSearch: row(`‖${v('R')}(${v('x')} + ${v('α')} Δ${v('x')})‖ ≤ (1 − 10<sup>−4</sup> ${v('α')}) · ‖${v('R')}(${v('x')})‖`),
    convergence: row(`max<sub>${v('i')}</sub> ${frac(`|Δ${sub(v('x'), v('i'))}|`, `max(|${sub(v('x'), v('i'))} + Δ${sub(v('x'), v('i'))}| ; ${sub(v('ε'), v('i'))} / tol)`)} ≤ tol`),
    // pipes
    velocity: row(`${V} = ${frac(m, `${N} ${rho} ${A}`)}`, gap, `${Re} = ${frac(`${rho} |${V}| ${Dh}`, mu)}`),
    darcy: row(`${dp('f')} = ${f} ${frac(L, Dh)} ${frac(vv(V), '2')}`),
    laminar: row(`${dp('f')} = ${frac(`32 ${mu} ${L} ${V}`, sup(Dh, 2))}`, gap, '⇔', gap, `${f} = ${frac('64', Re)}`),
    colebrook: row(`${frac('1', sqrt(f))} = 1,14 − 2 log<sub>10</sub> ( ${frac(v('ε'), Dh)} + ${frac('9,35', `${Re} ${sqrt(f)}`)} )`),
    transition: row(`${f} = (1 − ${v('w')}) ${frac('64', sub(Re, 'lam'))} + ${v('w')} · ${sub(f, 'C')}(${sub(Re, 'turb')})`, gap, `${v('w')} = ${frac(`${Re} − ${sub(Re, 'lam')}`, `${sub(Re, 'turb')} − ${sub(Re, 'lam')}`)}`),
    hazen: row(`${V} = ${v('k')} ${v('C')} ${sup(sub(v('R'), 'h'), '0,63')} ${sup(v('S'), '0,54')}`, gap, `${v('k')} = 0,848684`, gap, `${sub(v('R'), 'h')} = ${Dh} / 4`, gap, `${dp('f')} = ${rho} ${sub(g, '0')} ${v('S')} ${L}`),
    hydraulicDiameter: row(`${Dh} = ${frac(`4 ${A}`, v('P'))}`, gap, `○ ${v('D')}`, gap, `◎ ${sub(v('D'), 'e')} − ${sub(v('D'), 'i')}`, gap, `▭ ${frac(`2 ${v('a')} ${v('b')}`, `${v('a')} + ${v('b')}`)}`),
    fouling: row(`${Dh}′ = ${Dh} (1 − ${v('r')})`, gap, `${A}′ = ${A} (1 − ${v('r')})<sup>2</sup>`),
    minor: row(`${dp('K')} = ${K} ${frac(vv(V), '2')}`),
    fittingsSum: row(`${sub(K, '«pipe»')} = Σ ${sub(v('n'), v('i'))} ${sub(K, v('i'))}`, gap, `${sub(K, v('i'))} = (${K}/${sub(f, 'T')})<sub>${v('i')}</sub> · ${sub(f, 'T')}`),
    craneFT: row(`${sub(f, 'T')} = [ 1,14 − 2 log<sub>10</sub>(${sub(v('ε'), 'c')} / ${Dh}) ]<sup>−2</sup>`, gap, `${sub(v('ε'), 'c')} = 0,0018 in = 0,04572 mm`),
    laminarK: row(`${sub(K, 'lam')} = ${K} · max ( 1 ; ${frac(`64 / ${Re}`, sub(f, 'ref'))} )`, gap, `${Re} < ${sub(Re, 'lam')}`),
    laminarKTransition: row(`${sub(K, '«eff»')} = ${K} · [ (1 − ${v('w')}) · max ( 1 ; ${frac(`64 / ${sub(Re, 'lam')}`, sub(f, 'ref'))} ) + ${v('w')} ]`, gap, `${sub(Re, 'lam')} ≤ ${Re} < ${sub(Re, 'turb')}`),
    // pumps
    pumpCurve: row(`${v('H')}(${Q}) = ${sup(s, 2)} · ${sub(v('H'), '1')} ( ${frac(Q, `${N} ${s}`)} )`, gap, `${s} = ${frac('«speed»', '«ratedSpeed»')}`),
    pumpLink: row(`${dp()}(${m}) = −${rho} ${g} ${v('H')}(${m} / ${rho})`),
    pumpSpeed: row(`${sup(s, 2)} · ${sub(v('H'), '1')} ( ${frac(Q, `${N} ${s}`)} ) = Δ${v('H')}`, gap, `0,01 ≤ ${s} ≤ 3`),
    pumpPower: row(`Δ${v('H')} = ${frac(`Δ${P0}`, `${rho} ${g}`)}`, gap, `${sub(v('P'), '«hyd»')} = ${Q} · Δ${P0}`, gap, `${sub(v('P'), '«shaft»')} = ${frac(sub(v('P'), '«hyd»'), v('η'))}`),
    npsh: row(`NPSH<sub>«available»</sub> = ${frac(`${sub(P0, '«suction»')} − ${sub(v('p'), 'v')}`, `${rho} ${g}`)}`, gap, `NPSH<sub>«required»</sub>(${Q}) = ${sup(s, 2)} · NPSH<sub>«required»,1</sub> ( ${frac(Q, `${N} ${s}`)} )`),
    polyfit: row(`${v('y')}(${v('x')}) = ${sub(v('a'), '0')} + ${sub(v('a'), '1')} ${v('x')} + … + ${sub(v('a'), v('n'))} ${sup(v('x'), v('n'))}`, gap, `${v('n')} ≤ 4`, gap, `min Σ [ ${sub(v('y'), v('i'))} − ${v('y')}(${sub(v('x'), v('i'))}) ]<sup>2</sup>`),
    // valves and other elements
    valveK: row(`${dp()} = ${K} ${frac(vv(sub(V, '1')), '2')}`, gap, `${sub(V, '1')}: «upstreamVelocity»`),
    cv: row(`${dp()}[psi] = ${frac(rho, '999,0')} ( ${frac(`${Q}[gpm]`, v('Cv'))} )<sup>2</sup>`, gap, `${dp()}[bar] = ${frac(rho, '1000')} ( ${frac(`${Q}[m³/h]`, v('Kv'))} )<sup>2</sup>`),
    cvEquivalent: row(`${sub(v('Cv'), 'eq')} = ${Q}[gpm] · ${sqrt(`${frac(rho, '999,0')} / ${dp()}[psi]`)}`),
    orificeCd: row(`${K} = ${frac(`1 − ${sup('β', 4)}`, sup(sub(v('C'), 'd'), 2))} · ( ${frac(sub(A, '1'), sub(A, 'o'))} )<sup>2</sup>`, gap, `β = ${frac(sub(v('d'), 'o'), sub(v('D'), '1'))}`),
    orificeSharp: row(`${K} = ( ${frac(sub(A, '1'), sub(A, 'o'))} )<sup>2</sup> [ 0,707 ( 1 − ${frac(sub(A, 'o'), sub(A, '1'))} )<sup>0,375</sup> + 1 − ${frac(sub(A, 'o'), sub(A, '2'))} ]<sup>2</sup>`),
    orificeRounded: row(`${K}′ = 0,03 + 0,47 · 10<sup>−7,7 ${v('r')} / ${sub(v('d'), 'o')}</sup>`, gap, `${K} = ( ${frac(sub(A, '1'), sub(A, 'o'))} )<sup>2</sup> [ 1 − ${frac(sub(A, 'o'), sub(A, '1'))} + ${sqrt(`${K}′`)} ( 1 − ${frac(sub(A, 'o'), sub(A, '1'))} )<sup>0,75</sup> ]<sup>2</sup>`),
    spray: row(`${dp()} = ${frac(`${m}|${m}|`, `2 ${rho} (${sub(v('C'), 'd')}${A})<sup>2</sup>`)}`, gap, '⇔', gap, `${Q} = ${sub(v('C'), 'd')}${A} ${sqrt(`2 ${dp()} / ${rho}`)}`),
    sprayArea: row(`${sub(v('C'), 'd')}${A} = ${sub(v('C'), 'd')} · ${v('n')} · ${frac(`π ${sup(v('d'), 2)}`, '4')}`, gap, '«or»', gap, `${sub(v('C'), 'd')}${A} = ${K} ${sqrt(`${sub(rho, '«water»')} / 2`)}`, gap, `${Q} = ${K} ${sqrt(dp())}`),
    exitValve: row(`${sub(P0, '«end»')} = ${sub(v('p'), '«residual»')} + ${dp('«valve»')}`),
    genericCurve: row(`${dp()} = «sign»(${m}) · ${sub(v('F'), '«fit»')}( |${Q}| )`),
    // results
    stagnation: row(`${P0} = ${v('p')} + ${half}`),
    heads: row(`HGL = ${frac(v('p'), `${rho} ${g}`)} + ${z}`, gap, `EGL = ${frac(P0, `${rho} ${g}`)} + ${z}`, gap, `${sub(v('h'), 'L')} = ${frac(dp('«losses»'), `${rho} ${g}`)}`),
    gauge: row(`${sub(v('p'), 'abs')} = ${sub(v('p'), '«gauge»')} + ${sub(v('p'), '«amb»')}`),
    effectiveK: row(`${sub(K, '«eff»')} = ${frac(`Δ${P0}`, `½ ${rho} ${sup(sub(V, '1'), 2)}`)}`),
    // compressible mode (src/core/gas/, src/core/fluids/gases.js)
    gasLaw: row(`${rho} = ${frac(`${v('P')} · MW`, `${v('Z')} ${sub(v('R'), 'u')} ${v('T')}`)}`, gap, `${v('R')} = ${frac(sub(v('R'), 'u'), 'MW')}`, gap, `${sub(v('R'), 'u')} = 8314,462618 J/(kmol·K)`),
    machGas: row(`${v('a')} = ${sqrt(`${v('Z')} ${v('k')} ${v('R')} ${v('T')}`)}`, gap, `${v('G')} = ${frac(m, A)} = ${rho} ${V}`, gap, `${v('M')} = ${frac(V, v('a'))}`),
    stagnationGas: row(`${sub(v('T'), '0')} = ${v('T')} ( 1 + ${frac(`${v('k')} − 1`, '2')} ${sup(v('M'), 2)} )`, gap, `${sub(v('P'), '0')} = ${v('P')} ( 1 + ${frac(`${v('k')} − 1`, '2')} ${sup(v('M'), 2)} )<sup>${v('k')}/(${v('k')}−1)</sup>`),
    sutherland: row(`${mu} = ${sub(mu, '0')} ( ${frac(v('T'), sub(v('T'), '0'))} )<sup>3/2</sup> ${frac(`${sub(v('T'), '0')} + ${v('S')}`, `${v('T')} + ${v('S')}`)}`, gap, `${sub(v('T'), '0')} = 273,15 K`),
    normalFlow: row(`${sub(rho, 'N')} = ${frac(`${sub(v('P'), 'N')} · MW`, `${sub(v('R'), 'u')} ${sub(v('T'), 'N')}`)}`, gap, `${sub(v('P'), 'N')} = 101,325 kPa`, gap, `${sub(v('T'), 'N')} = 273,15 K`, gap, `${m} = ${sub(rho, 'N')} ${sub(Q, 'N')}`),
    isoClosed: row(`${sup(sub(v('P'), '1'), 2)} − ${sup(sub(v('P'), '2'), 2)} = ${sup(v('G'), 2)} ${v('Z')} ${v('R')} ${v('T')} [ ${f} ${frac(L, Dh)} + Σ${K} + 2 ln ${frac(sub(v('P'), '1'), sub(v('P'), '2'))} ]`),
    fannoRel: row(`${frac(v('T'), `${v('T')}*`)} = ${frac(`${v('k')} + 1`, `2 + (${v('k')} − 1) ${sup(v('M'), 2)}`)}`, gap, `${frac(v('P'), `${v('P')}*`)} = ${frac('1', v('M'))} ${sqrt(frac(`${v('k')} + 1`, `2 + (${v('k')} − 1) ${sup(v('M'), 2)}`))}`),
    fannoLength: row(`${frac(`${f} ${L}*`, Dh)} = ${frac(`1 − ${sup(v('M'), 2)}`, `${v('k')} ${sup(v('M'), 2)}`)} + ${frac(`${v('k')} + 1`, `2${v('k')}`)} ln ${frac(`(${v('k')} + 1) ${sup(v('M'), 2)}`, `2 + (${v('k')} − 1) ${sup(v('M'), 2)}`)}`, gap, `${f} ${frac(`${sub(v('x'), '2')} − ${sub(v('x'), '1')}`, Dh)} = ${frac(`${f}${L}*`, Dh)}(${sub(v('M'), '1')}) − ${frac(`${f}${L}*`, Dh)}(${sub(v('M'), '2')})`),
    marchMomentum: row(`(${v('P')}′ − ${v('P')}) + ${v('G')} (${V}′ − ${V}) + ${frac(f, Dh)} ${frac(`${rho}̄ ${V}̄<sup>2</sup>`, '2')} Δ${v('x')} + ${rho}̄ ${g} Δ${z} = 0`, gap, `${rho}′ ${V}′ = ${v('G')}`),
    marchEnergy: row(`«iso»: ${v('T')}′ = ${v('T')}`, gap, `«adiab»: ${sub(v('c'), 'p')} (${v('T')}′ − ${v('T')}) + ${frac(`${V}′<sup>2</sup> − ${sup(V, 2)}`, '2')} = 0`, gap, `${sub(v('c'), 'p')} = ${frac(`${v('k')} ${v('R')}`, `${v('k')} − 1`)}`),
    equivalentF: row(`${sub(f, '«eq»')} = ${f} + Σ${K} ${frac(Dh, L)}`),
    chokeLimits: row(`${sub(v('M'), 'max')} = ${frac('1', sqrt(v('k')))} («iso»)`, gap, `${sub(v('M'), 'max')} = 1 («adiab»)`),
    entranceGas: row(`${v('G')} = ${P0} ${sqrt(frac(v('k'), `${v('Z')} ${v('R')} ${sub(v('T'), '0')}`))} ${v('M')} ( 1 + ${frac(`${v('k')} − 1`, '2')} ${sup(v('M'), 2)} )<sup>−(${v('k')}+1)/(2(${v('k')}−1))</sup>`),
    nozzleGas: row(`${m} = ${sub(v('C'), 'd')}${A} ${P0} ${sqrt(`${frac(`2${v('k')}`, `(${v('k')} − 1) ${v('Z')} ${v('R')} ${sub(v('T'), '0')}`)} ( ${sup(v('r'), `2/${v('k')}`)} − ${sup(v('r'), `(${v('k')}+1)/${v('k')}`)} )`)}`, gap, `${v('r')} = max ( ${frac(sub(v('p'), '«ext»'), P0)} ; ${v('r')}* )`, gap, `${v('r')}* = ( ${frac('2', `${v('k')} + 1`)} )<sup>${v('k')}/(${v('k')}−1)</sup>`),
    criticalFlux: row(`${sub(m, 'max')} = ${sub(v('C'), 'c')} ${sub(A, 'o')} ${P0} ${sqrt(frac(v('k'), `${v('Z')} ${v('R')} ${sub(v('T'), '0')}`))} ( ${frac('2', `${v('k')} + 1`)} )<sup>(${v('k')}+1)/(2(${v('k')}−1))</sup>`),
    gasMixing: row(`${sub(v('T'), '0,«node»')} = ${frac(`Σ ${sub(m, v('i'))} ${sub(v('T'), `0,${v('i')}`)}`, `Σ ${sub(m, v('i'))}`)}`, gap, `«enteringFlows»`),
    compRatio: row(`${sub(P0, '«out»')} = ${v('r')} · ${sub(P0, '«in»')}`),
    compHead: row(`${v('r')} = [ 1 + ${frac(`${g} ${v('H')} (${v('k')} − 1)`, `${v('k')} ${v('Z')} ${v('R')} ${sub(v('T'), '0,«in»')}`)} ]<sup>${v('k')}/(${v('k')}−1)</sup>`, gap, `${v('H')} = ${sup(s, 2)} · ${sub(v('H'), '1')} ( ${frac(Q, `${N} ${s}`)} )`),
    compHeat: row(`${sub(v('T'), '0,«out»')} = ${sub(v('T'), '0,«in»')} · ${v('r')}<sup>(${v('k')}−1)/(${v('k')} ${v('η')})</sup>`, gap, `${sub(v('P'), '«gas»')} = ${m} ${sub(v('c'), 'p')} (${sub(v('T'), '0,«out»')} − ${sub(v('T'), '0,«in»')})`),
    gasValveK: row(`${K} = ${frac(`2 ${sup(A, 2)} · psi`, `999,0 · gpm<sup>2</sup> · ${sup(v('Cv'), 2)}`)}`, gap, `${K} = 200 ( ${frac(`3600 ${A}`, v('Kv'))} )<sup>2</sup>`),
    // water hammer (src/core/surge/): the method of characteristics, the wave speed, the cavities and the trip of a pump
    surgeEquations: row(`${frac('1', A)} ${frac(`∂${m}`, `∂${v('t')}`)} + ${frac(`∂${v('P')}`, `∂${v('x')}`)} + ${rho} ${g} ${frac(`d${z}`, `d${v('x')}`)} + ${frac(`${f} ${m}|${m}|`, `2 ${rho} ${v('D')} ${sup(A, 2)}`)} = 0`, gap, `${frac(`∂${v('P')}`, `∂${v('t')}`)} + ${frac(sup(v('a'), 2), A)} ${frac(`∂${m}`, `∂${v('x')}`)} = 0`),
    surgeSections: row(`${v('a')}′ = ${frac(L, `${v('n')} Δ${v('t')}`)}`, gap, `${v('n')} = max ( 1 ; round ${frac(L, `${v('a')} Δ${v('t')}`)} )`, gap, `«variance» = ${frac(`${v('a')}′`, v('a'))} − 1`),
    surgeCplus: row(`${sub(v('P'), v('i'))} = ${sub(v('C'), 'P')} − ${sub(v('B'), 'P')} ${sub(m, v('i'))}`, gap, `${sub(v('C'), 'P')} = ${sub(v('P'), 'A')} + ${v('B')} ${sub(m, 'A')} − ${rho} ${g} (${sub(z, v('i'))} − ${sub(z, 'A')})`, gap, `${sub(v('B'), 'P')} = ${v('B')} + ${v('R')} |${sub(m, 'A')}|`),
    surgeCminus: row(`${sub(v('P'), v('i'))} = ${sub(v('C'), 'M')} + ${sub(v('B'), 'M')} ${sub(m, v('i'))}`, gap, `${sub(v('C'), 'M')} = ${sub(v('P'), 'B')} − ${v('B')} ${sub(m, 'B')} + ${rho} ${g} (${sub(z, 'B')} − ${sub(z, v('i'))})`, gap, `${sub(v('B'), 'M')} = ${v('B')} + ${v('R')} |${sub(m, 'B')}|`),
    surgeCoefficients: row(`${v('B')} = ${frac(`${v('a')}′`, A)}`, gap, `${v('R')} = ${frac(`Δ${sub(v('P'), '«losses»')}`, `${v('n')} · ${sub(m, '0')}|${sub(m, '0')}|`)}`),
    surgeInterior: row(`${sub(m, v('i'))} = ${frac(`${sub(v('C'), 'P')} − ${sub(v('C'), 'M')}`, `${sub(v('B'), 'P')} + ${sub(v('B'), 'M')}`)}`, gap, `${sub(v('P'), v('i'))} = ${frac(`${sub(v('C'), 'P')} ${sub(v('B'), 'M')} + ${sub(v('C'), 'M')} ${sub(v('B'), 'P')}`, `${sub(v('B'), 'P')} + ${sub(v('B'), 'M')}`)}`),
    waveSpeed: row(`${v('a')} = ${sqrt(frac(`${K} / ${rho}`, `1 + ${sub(v('c'), '1')} ${frac(`${K} ${v('D')}`, `${v('E')} ${v('e')}`)}`))}`, gap, `${sub(K, '«water»')} = ${rho} ${sup(v('c'), 2)}`),
    waveC1: row(`${sub(v('c'), '1')} = 1 − ${sup(v('ν'), 2)} («anchored»)`, gap, `1 − ${v('ν')}/2 («upEnd»)`, gap, `1 («joints»)`),
    waveC1Thick: row(`${sub(v('c'), '1')} = 2 ${frac(v('e'), v('D'))} (1 + ${v('ν')}) + ${frac(`${v('D')} · ${v('k')}`, `${v('D')} + ${v('e')}`)}`, gap, `${v('k')} = 1 − ${sup(v('ν'), 2)} ; 1 − ${v('ν')}/2 ; 1`),
    waveTunnel: row(`${v('a')} = ${sqrt(frac(`${K} / ${rho}`, `1 + ${K} / ${v('G')}`))} («unlined»)`, gap, `${v('a')} = ${sqrt(frac(`${K} / ${rho}`, `1 + ${frac(`${K} ${v('D')}`, `${v('G')} ${v('D')} + ${v('E')} ${v('e')}`)}`))} («lined»)`),
    cavityFlows: row(`${sub(m, '−')} = ${frac(`${sub(v('C'), 'P')} − ${sub(v('P'), 'v')}`, sub(v('B'), 'P'))}`, gap, `${sub(m, '+')} = ${frac(`${sub(v('P'), 'v')} − ${sub(v('C'), 'M')}`, sub(v('B'), 'M'))}`),
    cavityVolume: rows(`${sub(v('V'), v('k'))} = ${sub(v('V'), `${v('k')}−1`)} + ${frac(`Δ${v('t')}`, rho)} [ ${v('ψ')} (${sub(m, '+')} − ${sub(m, '−')})<sub>${v('k')}</sub> + (1 − ${v('ψ')}) (${sub(m, '+')} − ${sub(m, '−')})<sub>${v('k')}−1</sub> ]`, `${v('V')} ≤ 0 : «collapse»`),
    pumpTrip: row(`${v('I')} ${sub(v('ω'), 'r')} ${frac(`d${s}`, `d${v('t')}`)} = −${v('T')}(${Q}, ${s})`, gap, `${v('T')}(${Q}, ${s}) = ${frac(`${sup(s, 2)} · ${sub(v('P'), '1')}( ${Q} / (${N} ${s}) )`, sub(v('ω'), 'r'))}`),
    pumpTripStep: row(`${sub(s, v('k'))} = ${sub(s, `${v('k')}−1`)} − ${frac(`Δ${v('t')}`, `2 ${v('I')} ${sub(v('ω'), 'r')}`)} ( ${sub(v('T'), `${v('k')}−1`)} + ${sub(v('T'), v('k'))} )`, gap, `${s} ≥ 0`),
    // water hammer, phase G3 (src/core/surge/pumps.js, boundaries.js): the start of a pump, the largest speed of a control valve
    pumpStart: row(`${v('I')} ${sub(v('ω'), 'r')} ${frac(`d${s}`, `d${v('t')}`)} = ${sub(v('T'), 'm')}(${s}) − ${v('T')}(${Q}, ${s})`),
    pumpStartStep: row(`${sub(s, v('k'))} = ${sub(s, `${v('k')}−1`)} + ${frac(`Δ${v('t')}`, `2 ${v('I')} ${sub(v('ω'), 'r')}`)} [ ${sub(v('T'), 'm')}(${sub(s, `${v('k')}−1`)}) − ${sub(v('T'), `${v('k')}−1`)} + ${sub(v('T'), 'm')}(${sub(s, v('k'))}) − ${sub(v('T'), v('k'))} ]`),
    controlRate: row(`${sub(v('x'), v('k'))} = ${sub(v('x'), `${v('k')}−1`)} + max ( −${v('r')} Δ${v('t')} ; min ( ${v('r')} Δ${v('t')} ; ${v('x')}* − ${sub(v('x'), `${v('k')}−1`)} ) )`, gap, `${v('x')}* = ${sup(v('c'), '−1')}(${v('Cv')}*)`),
    // water hammer, phase G3 after its addendum (src/core/surge/moc.js, pumps.js, checks.js, forces.js): the unsteady friction
    // of Brunone, the gas cavities, the pumps in four quadrants, the dynamic check valves and the unbalanced forces
    brunone: rows(`Δ${sub(v('p'), '«brunone»')} = ${frac(`${rho} ${v('k')}`, '2')} ( ${frac(`∂${V}`, `∂${v('t')}`)} + ${v('a')} · «sign»(${V}) · |${frac(`∂${V}`, `∂${v('x')}`)}| ) Δ${v('x')}`, `${v('k')} = ${frac(sqrt(`${v('C')}*`), '2')}`, `${v('C')}* = 0,00476 (${Re} &lt; 2000) «or» ${frac('7,41', `${Re}<sup>log₁₀(14,3/${Re}<sup>0,05</sup>)</sup>`)}`),
    brunoneStep: rows(`${sub(v('D'), '+')} = ${sub(sub(m, '−'), v('j'))}(${v('k')}−1) − ${sub(sub(m, '+'), `${v('j')}−1`)}(${v('k')}−2)`, `${sub(v('D'), '−')} = ${sub(sub(m, '+'), v('j'))}(${v('k')}−1) − ${sub(sub(m, '−'), `${v('j')}+1`)}(${v('k')}−2)`, `${sub(v('U'), v('j'))} = max | min ( ${sub(v('D'), '+')} ; ${sub(v('D'), '−')} )`, `Δ${sub(v('P'), v('j'))} = ${frac(`${v('k')} ${v('B')}`, '2')} ${sub(v('U'), v('j'))}`),
    gasCavity: rows(`${sub(v('V'), 'g')} = ${frac(sub(v('C'), 'g'), `${v('P')} − ${sub(v('P'), 'v')}`)}`, `${sub(v('C'), 'g')} = ${sub(v('α'), '0')} (${sub(v('p'), '0')} − ${sub(v('P'), 'v')}) ${A} Δ${v('x')}`, `${v('a')} ${sup(v('u'), 2)} + ${v('E')} ${v('u')} − ${sub(v('C'), 'g')} = 0, ${v('u')} = ${v('P')} − ${sub(v('P'), 'v')}`),
    suter: rows(`${v('h')} = (${sup(v('α'), 2)} + ${sup(v('v'), 2)}) ${sub(v('c'), 'H')} ${v('WH')}(${v('θ')})`, `${v('β')} = (${sup(v('α'), 2)} + ${sup(v('v'), 2)}) ${sub(v('c'), 'B')} ${v('WB')}(${v('θ')})`, `${v('θ')} = π + atan2(${v('v')}, ${v('α')})`),
    suterVars: rows(`${v('α')} = ${frac(N, sub(N, 'R'))}`, `${v('v')} = ${frac(Q, sub(Q, 'R'))}`, `${v('h')} = ${frac(v('H'), sub(v('H'), 'R'))}`, `${v('β')} = ${frac(v('T'), sub(v('T'), 'R'))}`),
    fourStep: row(`${sub(v('α'), v('k'))} = ${sub(v('α'), `${v('k')}−1`)} + ${frac(`Δ${v('t')}`, `2 ${v('I')} ${sub(v('ω'), 'R')}`)} [ ${sub(v('T'), `m,${v('k')}`)} − ${sub(v('T'), 'R')} ${sub(v('β'), v('k'))} + ${sub(v('T'), `m,${v('k')}−1`)} − ${sub(v('T'), 'R')} ${sub(v('β'), `${v('k')}−1`)} ]`),
    checkDecel: rows(`${sub(v('a'), 'd')} = − ${frac(`d${V}`, `d${v('t')}`)} «leastSquares»`, `${V} &lt; −${sub(V, 'R')}(${sub(v('a'), 'd')}) : «closes»`),
    checkSwing: rows(`${v('I')} ${frac(`d<sup>2</sup>${v('θ')}`, `d${sup(v('t'), 2)}`)} = ${sub(v('T'), 'h')} + ${sub(v('T'), 'w')} + ${sub(v('T'), 'c')} + ${sub(v('T'), 's')} + ${sub(v('T'), 'd')}`, `${sub(v('T'), 'h')} = Δ${v('P')} ${sub(A, 'd')} ${sub(v('r'), 'p')}`, `${sub(v('T'), 'w')} = −(${sub(v('m'), 'd')} − ${sub(v('m'), 'f')}) ${g} ${sub(v('r'), 'cg')} sin(${v('θ')} + ${sub(v('γ'), 'c')} + ${v('φ')})`, `${sub(v('T'), 'c')} = −${sub(v('W'), 'c')} ${sub(v('r'), 'c')} sin(${v('θ')} + ${sub(v('γ'), 'c')} + ${v('φ')} + ${v('δ')})`, `${sub(v('T'), 's')} = −(${sub(v('T'), 's0')} + ${sub(v('k'), 's')} ${v('θ')})`, `${sub(v('T'), 'd')} = −${v('c')} ${frac(`d${v('θ')}`, `d${v('t')}`)}`),
    checkNozzle: row(`${v('m')} ${frac(`d<sup>2</sup>${v('x')}`, `d${sup(v('t'), 2)}`)} = Δ${v('P')} ${sub(A, 'd')} − (${sub(v('F'), 's0')} + ${v('k')} ${v('x')}) − (${v('m')} − ${sub(v('m'), 'f')}) ${g} sin ${v('φ')} − ${v('c')} ${frac(`d${v('x')}`, `d${v('t')}`)}`),
    checkStep: rows(`${frac(`2 (${sub(v('θ'), v('k'))} − ${sub(v('θ'), `${v('k')}−1`)})`, `Δ${v('t')}`)} − 2 ${sub(v('ω'), `${v('k')}−1`)} − ${frac(`Δ${v('t')}`, `2 ${v('I')}`)} ( ${sub(v('T'), `${v('k')}−1`)} + ${sub(v('T'), v('k'))}(${sub(v('θ'), v('k'))}) ) = 0`, `${v('k')}(${v('θ')}) = ${frac(sub(v('k'), '«fullOpen»'), `${v('c')}(${v('θ')})<sup>2</sup>`)}`),
    forceSegment: rows(`${v('F')} = ${sub(v('Π'), 'b')} − ${sub(v('Π'), 'a')} + Σ ${A} ${v('R')} ${sub(v('m̄'), 's')} |${sub(v('m̄'), 's')}|`, `${v('Π')} = (${v('p')} − ${sub(v('p'), 'amb')}) ${A} + ${frac(sup(m, 2), `${rho} ${A}`)}`),
    // water hammer, phase G2 (src/core/surge/devices.js, moc.js): the friction that varies, the protection devices
    frictionVariable: row(`${sub(v('R'), v('i'))} = ${frac(`Δ${sub(v('p'), 'f')}(${sub(m, v('i'))})`, `${v('n')} · ${sub(m, v('i'))}|${sub(m, v('i'))}|`)} + ${sub(v('R'), 'K')}`, gap, `|Δ${sub(V, v('i'))}| > 1 % : «recalculated»`),
    surgeTank: row(`${sub(v('V'), v('k'))} = ${sub(v('V'), `${v('k')}−1`)} + ${frac(`Δ${v('t')}`, `2 ${rho}`)} ( ${sub(m, v('k'))} + ${sub(m, `${v('k')}−1`)} )`, gap, `${sub(v('P'), '«node»')} = ${sub(v('p'), 'atm')} + ${rho} ${g} (${sub(z, 's')} − ${sub(z, '«node»')}) + Δ${sub(v('p'), '«conn»')}(${m})`),
    surgeRiser: row(`${frac(sub(L, 'c'), sub(A, 'c'))} ${frac(`d${m}`, `d${v('t')}`)} = ${sub(v('P'), '«node»')} − ${sub(v('P'), '«tank»')} − ${f} ${frac(sub(L, 'c'), sub(v('D'), 'c'))} ${frac(`${m}|${m}|`, `2 ${rho} ${sup(sub(A, 'c'), 2)}`)} − ${frac(`${m}|${m}|`, `2 ${rho} (${sub(v('C'), 'd')}${A})<sup>2</sup>`)}`),
    airVessel: row(`${sub(v('P'), 'g')} ${sup(sub(v('V'), 'g'), v('n'))} = ${sub(v('P'), 'g,0')} ${sup(sub(v('V'), 'g,0'), v('n'))}`, gap, `${sub(v('V'), `g,${v('k')}`)} = ${sub(v('V'), `g,${v('k')}−1`)} − ${frac(`Δ${v('t')}`, `2 ${rho}`)} ( ${sub(m, v('k'))} + ${sub(m, `${v('k')}−1`)} )`, gap, `${sub(v('P'), '«precharge»')} ${sub(v('V'), '«precharge»')} = ${sub(v('P'), 'g,0')} ${sub(v('V'), 'g,0')}`),
    reliefValve: row(`${v('x')} = ${frac(`${v('P')} − ${sub(v('P'), 'f')}`, `${sub(v('P'), 't')} − ${sub(v('P'), 'f')}`)}`, gap, `0 ≤ ${v('x')} ≤ 1`, gap, `${sub(m, '«relief»')} = ${v('x')} · ${sub(m, '«fullOpen»')}(${v('P')} − ${sub(v('p'), '«ext»')})`),
    airFlowSonic: row(`${sub(m, '«air»')} = ${sub(v('C'), 'd')}${A} ${sub(v('p'), '0')} ${sqrt(frac(v('k'), `${v('R')} ${sub(v('T'), '0')}`))} ( ${frac('2', `${v('k')} + 1`)} )<sup>(${v('k')}+1)/(2(${v('k')}−1))</sup>`, gap, `${v('p')} ≤ 0,52828 ${sub(v('p'), '0')}`),
    airFlowSubsonic: row(`${sub(m, '«air»')} = ${sub(v('C'), 'd')}${A} ${sqrt(`${frac(`2 ${v('k')}`, `${v('k')} − 1`)} ${sub(v('p'), '0')} ${sub(rho, '0')} [ (${v('p')}/${sub(v('p'), '0')})<sup>2/${v('k')}</sup> − (${v('p')}/${sub(v('p'), '0')})<sup>(${v('k')}+1)/${v('k')}</sup> ]`)}`, gap, `${sub(rho, '0')} = ${frac(sub(v('p'), '0'), `${v('R')} ${sub(v('T'), '0')}`)}`),
    airValveGas: row(`${v('p')} ${v('V')} = ${sub(v('m'), 'a')} ${v('R')} ${v('T')}`, gap, `${sub(v('m'), `a,${v('k')}`)} = ${sub(v('m'), `a,${v('k')}−1`)} + ${frac(`Δ${v('t')}`, '2')} ( ${sub(m, `«air»,${v('k')}`)} + ${sub(m, `«air»,${v('k')}−1`)} )`, gap, `${sub(v('V'), v('k'))} = ${sub(v('V'), `${v('k')}−1`)} − ${frac(`Δ${v('t')}`, `2 ${rho}`)} ( ${sub(m, v('k'))} + ${sub(m, `${v('k')}−1`)} )`),
    // water
    kell: row(`${rho}(${v('t')}) = ${frac(`999,83952 + 16,945176 ${v('t')} − 7,9870401·10<sup>−3</sup> ${sup(v('t'), 2)} − 46,170461·10<sup>−6</sup> ${sup(v('t'), 3)} + 105,56302·10<sup>−9</sup> ${sup(v('t'), 4)} − 280,54253·10<sup>−12</sup> ${sup(v('t'), 5)}`, `1 + 16,879850·10<sup>−3</sup> ${v('t')}`)}`),
    vogel: row(`${mu} [mPa·s] = exp ( −3,7188 + ${frac('578,919', `${v('T')} − 137,546`)} )`),
    iapws: row(`${v('θ')} = ${v('T')} + ${frac(sub(v('n'), '9'), `${v('T')} − ${sub(v('n'), '10')}`)}`, gap, `${sub(v('p'), 's')} = [ ${frac(`2 ${v('C')}`, `−${v('B')} + ${sqrt(`${sup(v('B'), 2)} − 4 ${v('A')} ${v('C')}`)}`)} ]<sup>4</sup> MPa`),
  };

  // words inside the formulas: [pt-BR, en, es]
  const WORDS = {
    in: ['entra', 'in', 'entra'], out: ['sai', 'out', 'sale'], dem: ['dem', 'dem', 'dem'], or: ['ou', 'or', 'o'],
    pipe: ['tubo', 'pipe', 'tubo'], eff: ['ef', 'eff', 'ef'], speed: ['rotação', 'speed', 'velocidad'],
    ratedSpeed: ['rotação nominal', 'rated speed', 'velocidad nominal'], hyd: ['hid', 'hyd', 'hid'], shaft: ['eixo', 'shaft', 'eje'],
    available: ['D', 'A', 'D'], required: ['R', 'R', 'R'], suction: ['suc', 'suc', 'suc'],
    upstreamVelocity: ['velocidade no tubo de montante', 'velocity in the upstream pipe', 'velocidad en el tubo aguas arriba'],
    water: ['água', 'water', 'agua'], end: ['ponta', 'end', 'extremo'], residual: ['residual', 'residual', 'residual'],
    valve: ['válvula', 'valve', 'válvula'], sign: ['sinal', 'sign', 'signo'], fit: ['ajuste', 'fit', 'ajuste'],
    losses: ['perdas', 'losses', 'pérdidas'], gauge: ['man', 'g', 'man'], amb: ['amb', 'amb', 'amb'],
    iso: ['isotérmico', 'isothermal', 'isotérmico'], adiab: ['adiabático', 'adiabatic', 'adiabático'], eq: ['eq', 'eq', 'eq'],
    ext: ['ext', 'ext', 'ext'], node: ['nó', 'node', 'nodo'], gas: ['gás', 'gas', 'gas'],
    enteringFlows: ['vazões que chegam ao nó', 'flows that reach the node', 'caudales que llegan al nodo'],
    variance: ['variância', 'variance', 'varianza'], anchored: ['ancorado', 'anchored', 'anclado'],
    upEnd: ['ancorado só a montante', 'anchored upstream only', 'anclado solo aguas arriba'], joints: ['juntas de expansão', 'expansion joints', 'juntas de expansión'],
    unlined: ['sem revestimento', 'unlined', 'sin revestimiento'], lined: ['revestido de aço', 'steel lined', 'revestido de acero'],
    collapse: ['a cavidade colapsa', 'the cavity collapses', 'la cavidad colapsa'],
    recalculated: ['recalculado', 'taken again', 'recalculado'], conn: ['lig', 'conn', 'con'], tank: ['tanque', 'tank', 'tanque'],
    precharge: ['pré', 'pre', 'pre'], relief: ['alívio', 'relief', 'alivio'], fullOpen: ['aberta', 'open', 'abierta'], air: ['ar', 'air', 'aire'],
    brunone: ['Brunone', 'Brunone', 'Brunone'], closes: ['fecha', 'closes', 'cierra'],
    leastSquares: ['(mínimos quadrados sobre τ<sub>d</sub>)', '(least squares over τ<sub>d</sub>)', '(mínimos cuadrados sobre τ<sub>d</sub>)'],
  };
  const LANGS = { 'pt-BR': 0, en: 1, es: 2 };

  // a formula in a language (undefined for an unknown id)
  function formula(id, lang) {
    const html = BLOCK[id];
    if (html === undefined) return undefined;
    const k = LANGS[lang] ?? 0;
    let out = html.replace(/«(\w+)»/g, (w, key) => (WORDS[key] ? WORDS[key][k] : w));
    if (k === 1) out = out.replace(/(\d),(\d)/g, '$1.$2');
    return out;
  }

  PumpIt.ui.helpEquations = { BLOCK, WORDS, formula };
})(typeof window !== 'undefined' ? window : globalThis);
