// Import of .fth model files: Windows-1252 text in INI-style sections, with positional CSV records for pipes,
// junctions and stored results. The layout follows only the descriptions written by the specification team (Annex A of
// the specification and the format description of 20 October 2026) and this repository. One scenario of the file (the
// base one, or a child rebuilt from the differences it keeps) becomes a Pump It model. What has no counterpart in Pump
// It is approximated or left out, and every such case goes into the import notes. The decisions are recorded in
// docs/fth-import.md (F-xx). The data of the time simulation (its control, the time data of the junctions and the finite
// tanks) follow Annex A of its specification ("Simulação no tempo", 2 November 2026), the time data of the junctions as
// its version 1.1 of 4 November 2026 corrects them, with the event codes of its Annex D.4 (F-34 to F-41).
//
// The network of the liquid is read by liquid.js, which the importer of .imp files shares (I-02 of docs/imp-import.md);
// this file gives it what is proper to the .fth format.
(function (root) {
  const PumpIt = root.PumpIt;
  const { t } = PumpIt.i18n;
  // sections, records and scenarios, the units written out in full, the notes and the drawing positions are shared with
  // the importers of .aro and .imp files (shared.js)
  const {
    readSections, scenarioKey, scenarioSection, records, keyValues, kv, addOns, header, PROGRAMS, num, unesc, pipeLayout,
    junctionLayout, pumpConfigs, listScenarios, scenarios, compare, noteText, LEVELS,
  } = PumpIt.importShared;

  // the place of the count of the curve coefficients in the block of the types: valve, orifice, heat exchanger and
  // generic component t+8, nozzle t+11 (F-08)
  const COUNTED = { 8: 8, 12: 8, 15: 8, 20: 8, 16: 11 };
  // kinds of junction of the format by their code, for the notes
  const KINDS = {
    1: 'branch', 2: 'reservoir', 3: 'flow', 4: 'pressure', 5: 'areaChange', 6: 'bend', 7: 'tee', 8: 'valve',
    9: 'controlValve', 10: 'checkValve', 11: 'deadEnd', 12: 'orifice', 13: 'venturi', 14: 'screen', 15: 'heatExchanger',
    16: 'spray', 17: 'pump', 18: 'ejector', 19: 'volumeBalance', 20: 'generic', 21: 'reliefValve', 27: 'threeWayValve',
    28: 'weir',
  };
  const FORMAT = {
    // the first line of a model of another program of the family is refused (F-02); the word of the program is read
    // when the file is, so that the tests can give their own
    refuse: (hd) => (hd.program !== PROGRAMS.liquid ? t('core.fth.otherProgram') : null),
    notModel: 'core.fth.notFth',
    counted: COUNTED,
    kinds: KINDS,
  };

  // text of a .fth file → { model, notes, stored, counts, version, scenario, scenarios } (liquid.js)
  const read = (text, opts = {}) => PumpIt.importLiquid.read(text, opts, FORMAT);

  PumpIt.importers = Object.assign(PumpIt.importers || {}, {
    fth: {
      encoding: 'windows-1252', read, scenarios, compare, noteText, LEVELS,
      parse: { readSections, records, keyValues, kv, scenarioKey, scenarioSection, addOns, num, unesc, header, pipeLayout, junctionLayout, pumpConfigs, listScenarios },
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
