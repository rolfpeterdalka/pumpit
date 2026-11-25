# TODO

- [x] 3D workspace.
- [x] English support.
- [x] Spanish support.
- [ ] Transient support.
- [x] Add time simulation support.
- [ ] Add goal seek support.
- [ ] Upgrade the 3D model.
- [ ] Import .xlsx files.
- [x] Import .fth files.
- [x] Import .aro files.
- [x] Add HDPE piping library.
- [ ] Add fluids.
- [ ] Make the interface look cleaner.

## Interface (from the UX review of d5fa5e9)

- [ ] Results: a button on each event of the log that shows the network at that instant (time cursor, object and its results).
- [ ] Results: sort the object tables by a numeric column (ascending, descending, original order), with the copy and the Excel sheet in the same order.
- [ ] Charts: a profile that passes through a chosen junction, to pick one of two parallel branches.
- [ ] Network: find a pipe or a junction by its ID or name, in the schematic and in 3D.
- [ ] Import report: the whole list of objects of a note (it stops at 12, then "(+n)"), each one shown on the drawing at a click.
- [ ] Keyboard: arrows, Home and End on the main, Results and Charts tabs, with their state for screen readers, as on the tabs of the properties panel.

## Calculation (from the review of 6043c80)

- [ ] Gas, adiabatic model: with Z ≠ 1 the stagnation temperature is not kept along a level pipe (Z 0.9, Mach 0.31: 300 K in, 300.46 K out). The march balances energy with cp = k·R/(k−1), while T₀ and the Mach number use Z·R. Make the two consistent.
- [ ] Units: `units.toSI` turns an empty value (`null`) into zero, or into the standard atmosphere for a gauge pressure, in any field. Audit the fields that reach the calculation and report an empty one instead of taking it as zero.

## Calculation (from the review of 319654f)

- [ ] Laminar flow in a rectangular duct: the friction is 64/Re on the hydraulic diameter, while f·Re goes from about 57 (a square) to 96 (flat plates). Use the factor of the aspect ratio (Shah and London), as the annulus does now. Four imported models have rectangular pipes; check them against their reference results first.
- [ ] Pump: an efficiency curve that cannot be fitted (for example, its points at one flow) stops the whole calculation. Leave the efficiency and the shaft power unknown with a warning, as the NPSH required curve does now; in the compressible mode the compressor needs a fallback for its discharge temperature.
