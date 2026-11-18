# Import of .fth files

*File → Open* (or a file dropped on the window) reads a `.fth` model and turns one of its scenarios into a Pump It model. The reader is `src/core/import/fth.js` (`PumpIt.importers.fth`), with the parts it shares with the reader of `.aro` files in `src/core/import/shared.js`; the choice of the scenario and the report shown after the import are `src/ui/app/import-report.js`; the checks are `tests/fth-import.test.cjs`.

## Clean room

**F-01 Sources.** The importer follows only the descriptions of the format written by the specification team, and this repository:

- Annex A of the specification `Clean Room.md`, the first layout of the records (October 2026);
- the format description of 20 October 2026 (`formato-fth.md`), which completes it: scenarios, valves, control valves, open and closed states, pumps, nozzles, fluid and units. The specification team wrote it from data files only; it states that no program, help or installer was inspected.

The description came with a reference reader and synthetic tests written for another code base. They were read as part of the description. The importer of Pump It is its own code, written for the model of Pump It, and its tests adapt the same synthetic cases. No file of another program was opened during this work. The repository holds no `.fth` file: the tests write their files in code. The product names no other program: the menu says ".fth", the notes speak of "the program it came from", and the first line of a file is recognised by a hash of its program word (F-02).

## File

**F-02 First line.** The first line has the form "maker program VERSION n INPUT FILE". The version is read. A file whose program word is that of another program of the same family is refused with a message: a transient model saved with this extension, for example. The word is compared by a hash (FNV-1a), so that the code does not hold it. A file without such a line is read anyway.

**F-03 Text.** Windows-1252. Inside texts, the byte 0x15 stands for a comma, 0x16 for a line break and 0x14 separates subfields (read as a space).

**F-04 Sections and keys.** The sections are "[NAME]" lines. The sections of a scenario are named "NAME -- SCENARIO #n -- scenario name", or just "NAME -- SCENARIO #n", so that #1 is not taken for #10. A file without scenarios has the plain "NAME". Section names and keys are read in any case. Records are the lines that start with an integer and a comma.

**F-05 Values.** A key of the form "value,unit" has the unit in its last field. The rest, joined with a point, is the number, which reads a file saved with a decimal comma. In records, an empty field and the markers −9999 and −999999 mean "not given", and −9E+29 is an empty result. A record too short to reach the section of a pipe (b+16) or the special condition of a junction (b+24) is left out, with a note.

**F-06 Add-on modules and settings.** These settings make the program adjust or replace the input while it calculates:

- an add-on module switched on (a key "XYZ Use" other than 0);
- goal seek and control (variables applied in a three-letter control section);
- automatic sizing (OptimizationLevel above 0).

Their data are not imported, and each one has a note. The time simulation (AnalysisType 2) is read, from Annex A of its own specification (F-34 to F-41). With sizing, the stored results may belong to other diameters, so they are not used for the losses of F-21 and F-23.

## Units

**F-07 Units.** A value keeps the unit of the file when Pump It has it (feet, inches, gal/min, m³/h, kg/h, psig, bar(g), kPa(a)…). Any other unit becomes a near unit of Pump It: m³/h for volume flows, kg/s for mass flows, kPa for pressures, cP for viscosities.

- A gauge unit (barG, psig, "kPa (g)"…) is relative to the ambient pressure of the file, which becomes the atmospheric pressure of the system.
- Water columns ("m H2O std." and the like) use 1000 kg/m³ and standard gravity.
- "S.G. water" is relative to 62.375 lbm/ft³ (about 999.15 kg/m³).
- A curve given in head of liquid becomes a pressure through the density of the fluid.
- A unit that is not known leaves the value blank, with a note. The unit "None" leaves a value undefined: blank, with a note when the model needs the value.

## Scenarios

**F-08 One scenario.** The scenario manager lists the scenarios with their parent path and a description read by its length. When a file has more than one, the import first asks which one to bring in (the base scenario is chosen by default).

- The scenario is rebuilt from the base scenario through its chain of ancestors. Each child deletes records, adds whole ones and changes others field by field: an empty field inherits.
- A list with a count holds a new list (count n), keeps the n items of the parent and changes the filled ones (−n), or is left out (0).
- The fields after a list are realigned by the end of the list. The fields per pipe of a branch, reservoir or imposed pressure are realigned by their pipe. Each configuration of a pump has three lists of its own.
- The fluid data of the base are replaced by those of each child of the chain.

The scenario becomes the base scenario of a Pump It model, named after it, and the title takes its name. The scenarios of Pump It cannot add or delete objects, which the children of the file do, so the other scenarios are imported one at a time, by opening the file again.

**F-33 A base scenario without a network.** The description has the base scenario hold the whole network. A file refused because its base scenario had no network suggested files whose base scenario is empty, with the network only in the scenarios derived from it; no such file has been confirmed yet. Such a file is read: it is a model when it has a section of pipes or of junctions of any scenario, and the records of a child that its parents do not have are new records, whole by the rules of F-08. Which scenarios have a network is worked out from the IDs left along each chain (the deletions, then the records). The choice of F-08 shows every scenario but lets only those with a network be chosen, the first of them by default. The import of such a scenario carries a note, since no description has confirmed this layout yet. A file in which no scenario has a network is refused with a message that names its scenarios, and so is a scenario without a network asked for by name or number. A file whose first line is that of a model (F-02) but which has no section of pipes or junctions at all is such a file, a model without a network; without that line, it is not a model. A section of pipes or junctions counts by the rule that finds it (F-04): its plain name, "NAME -- SCENARIO #n", or a name that starts with "NAME -- SCENARIO #n --". The `.aro` file that led to this decision (A-28) was refused again with no section of pipes or junctions in any scenario. It is most likely a model without a network, like the file without a network that the survey of each description met (§15.3), and the message now says so.

## Pipes

**F-09 Record.** Field 5 counts the segments of the pipe, each a pair (length, elevation at its end). After the segments come one field, the count of drawing points and 3 fields per point; the block b starts after them. The length is the sum of the segments, and the outlet elevation is that of the last one. The intermediate elevations and the drawing points are not read.

**F-10 Special condition (b+38).** Condition 1 is a pipe closed by the user. Conditions 3 and 4 are pipes the program found stopped by a closed junction or isolated, saved with the scenario: they come in closed too, so that their flow stays at zero, with a note asking to open them again if the junctions that closed them are opened. A junction left without an open pipe on its path stops, as in the file: its imposed flow or source becomes zero, a fixed-flow pump turns off, and a control valve closes. Pump It would otherwise refuse a flow with no pressure reference.

**F-11 Missing length.** A pipe without a length that is frictionless or closed loses nothing by its length: it takes 1 mm. Any other one is left blank for the user.

**F-12 Section.** Geometry code 0 is circular, by the (hydraulic) diameter at b+5. Code 2 is a section given by its area (b+7) and wetted perimeter (b+9). Any other code is read by its area and perimeter when both are given, or else by the diameter, and reported.

**F-13 Friction (b+12).** Codes 0 (absolute roughness), 1 (relative roughness), 2 (smooth), 3 (Hazen-Williams C), 4 (Darcy f in every regime) and 7 (frictionless) are the models of Pump It of the same names. Any other code leaves the roughness blank, with a note.

**F-14 Fittings and design factor.** The sum of the K values of the fittings (b+20) becomes one item. A design factor other than 1 (b+22 of a pipe, b+15 of a junction) is not applied, since Pump It has none, and is reported.

## Junctions

**F-15 Record.** Field 5 counts the pipes of the junction, listed with a sign: − the pipe leaves the junction, + it arrives. The fields of the type are read from the pipes connected to the junction in the pipe records, and a list that differs is reported. The common block starts at b = 6 + np: the drawing position (b+0, b+1), the elevation (b+7, unit b+9) and the special condition (b+24: −1 does not apply, 0 none, 1 closed, 2 open without control). It ends with tables closed by the anchor −999, its first occurrence from b+46. The block of the type starts after it, at t. The state the program worked out (b+25) is not read.

**F-16 Branch (1).** The K of each connection (3 fields per pipe from t, the second one) uses the velocity of its own pipe in both directions. It goes into the per-pipe table of the junction, where Pump It reports the pressure of the pipe on the pipe side, as the file does. The source (t+3np+1, + enters the network) is the source of the branch. With one pipe, the branch is an imposed flow. A closed branch closes its pipes.

**F-17 Reservoir (2).** The liquid surface is at t+21+o and the surface pressure at t+7+o, with o = 5·(np − 1). Each pipe has 5 fields from t: the K of the flow entering the pipe, the K of the flow entering the reservoir, two fields that are not described, and the depth of the connection below the surface, in the unit at t+6+o (a probable reading). Each pipe connects at the elevation of its end, the confirmed reading:

- Pump It keeps that connection as a depth below the surface (`connBy: 'depth'`), in the unit of the level, so the reservoir shows how deep each pipe is. The reservoir switches to elevations without moving any connection.
- The depth kept in the file only checks it. When the two differ by more than 1 mm per metre of depth, the end of the pipe is used and the report gives both values. A pipe above the surface is not checked.
- Whether the file entered a connection as a depth or as an elevation is not described, so it is not read; a note per import says so.
- The bottom of the reservoir, the junction elevation of Pump It, is its lowest connection, never above the surface. The elevation of the junction in the file (b+7) usually is that of the surface, and it would read as a bottom at the surface.
- A pipe above the surface has a negative depth and discharges at the surface pressure, which Pump It already does.

So a reservoir with pipes at several depths or with several losses stays one reservoir. A surface that cannot be read takes the elevation of the junction, with a note; if neither can be read, the pipes connect by the elevations of their ends. The elevation of the junction only stands in for the surface and the bottom: when it is undefined or in an unknown unit, the report asks for it only if the reservoir is left without one of them.

**F-18 Imposed flow (3) and imposed pressure (4).**

- Imposed flow: the flow at t+1 (volume or mass, kept as such) and t+3 (1 leaves the network, 0 enters). A negative flow turns around. The K of the connection (t+6) changes only the pressure of the junction. Closed, the flow is zero.
- Imposed pressure: 3 fields per pipe (the K entering the pipe and the K entering the junction), then at t+3np the kind (1 static, 0 stagnation) and the pressure. A static pressure needs a single pipe and no losses at its connection: otherwise it becomes a stagnation pressure, or its losses are left out, with notes.

**F-19 Valve (8).** t+1 is the loss model: 1 K, 0 Cv, 3 a loss curve. The curve has its units at t+3 and t+5, its largest flow at t+6 and its coefficients counted at t+8. After them (u = t+9+nc) come the outlet pressure (u+1) and the K or Cv (u+7).

- Between two pipes, it is a valve, closed when the file says so. Cv follows the convention of Pump It (water at 999 kg/m³).
- On a single pipe, it is an exit valve to its outlet pressure, with the K or Cv of the valve; closed, a closed end.
- Any other loss model leaves K = 0, with a note.

**F-20 Control valve (9).** t+0 is the kind (2 flow, 0 pressure reducing, 3 pressure drop, 1 pressure sustaining) and t+3, t+4 the set point. The kinds 0, 1 and 3 are readings the specification team still has to confirm, and have a note. They become the control valves of Pump It (FCV, PRV, PDCV, PSV).

- A valve that cannot reach its set point opens fully, as the program does: always control off, opening on failure, open K = 0.
- The special conditions become the fixed states of Pump It: 1 closed, 2 open without control.
- A pressure set point is read as a static pressure, unless the stored results show the valve controlling a stagnation pressure: the pressure next to it falls on one basis or the other, within a quarter of the dynamic pressure.

**F-21 Loss curves.** A curve ΔP = Σ cᵢ·Qⁱ that is a pure square law becomes an exact K at the area of the inlet pipe. Between two pipes, another curve that starts from zero becomes a generic component with that curve. Points from zero to the largest flow of the curve (or twice the stored flow) are fitted with its degree, which gives the polynomial back. Otherwise, as for an exit valve or a nozzle, the K is taken at the stored flow, or at half of the largest flow of the curve (an approximation), with a note.

**F-22 Other components with a loss.**

- Bend (6) and area change (5): the K at t+3. The K of an area change is referred to the inlet pipe, as in Pump It.
- Orifice (12): its K at u+6 and its diameter at u+3 (u = t+9+nc).
- Heat exchanger (15) and generic component (20): the loss curve, as the valve. The heat transfer is not calculated.

They become generic components (an orifice, an orifice by its K). Closed, they become closed valves.

**F-23 Tee or wye (7).** t+3 = 2 is a simple tee, a node without losses. t+3 = 1 has detailed losses, which the program works out from correlations that Pump It does not have. They are taken from the stored results:

- the node takes the stagnation pressure of its only inflow (or only outflow);
- the loss of each path becomes a K at the end of its pipe, in the per-pipe table.

A path that gains pressure gets a negative K, which goes into the fittings of its pipe, within their K. The stored pressure of that end then moves to the junction side, where Pump It reports it, so that the comparison of F-31 holds. Without stored results, the tee has no losses of its own, with a note.

**F-24 Nozzle (16).** t+4 is the model: 1 a K factor, with Q = K·√ΔP; 3 a loss curve. The units of ΔP and flow are at t+6 and t+8 and the coefficients are counted at t+11. After them (v = t+12+nc) come the K factor (v+3) and the outlet pressure (v+5). The file applies ΔP = (Q/K)² to any fluid. Pump It refers a K factor to water (1000 kg/m³), so the K factor is multiplied by √(ρ/1000) to keep the same loss, with a note. A curve that is not a square law gives the K factor of the stored flow, or of half of its largest flow. A closed nozzle is a closed end.

**F-25 Pump (17).** t+0 is the mode: 0 curve, 1 fixed flow (t+2, t+3); other modes are not known. The head and flow units of the curve are at t+6 and t+8. The configurations (impellers or speeds) are counted at t+12 and the one in use is at t+11. Each configuration has its largest flow and the coefficients of head, NPSHR and efficiency. After them comes the relative speed (1 = 100 %), applied by the affinity laws.

- The curve of the configuration in use becomes 11 points from zero to its largest flow, fitted with its degree (above degree 4, 41 points with linear interpolation). A curve without a largest flow ends at zero head.
- The efficiency curve (%) is imported. The NPSHR curve is read in the unit of the head, with a note.
- A control by speed of kind 1 with a flow unit, about 10 fields after the speed, is a flow control of Pump It. Its place moves in the records of children, so it is searched in a short window. Other controls are not read: the pump runs on its curve, with a note.
- On a single pipe, a fixed flow is an imposed flow. With a curve, the missing end becomes an imposed pressure through a frictionless pipe of 1 mm. The pressure is the one the file gives after the configurations (a pressure, or a height of liquid), or the ambient pressure. New IDs follow the largest of the file.
- Closed, the pump is off without flow. An unknown mode without a curve leaves the flow blank.

**F-26 Other kinds.** Kinds without data in the description become a generic component with K = 0 between two pipes, with a note: check valve, venturi, screen and unknown codes. Otherwise they become a plain node (or a closed end on one pipe), with a note. The three-way valve, relief valve, ejector, volume balance and weir are among them.

**F-27 Elevations at a junction.** A junction of Pump It has one elevation (a reservoir excepted, F-17). When the end of a pipe is at another elevation, the junction elevation is used and the report names the junction.

## System

**F-28 Fluid.** The fluid comes from the keys of the fluid data, already evaluated by the program at its temperature: the name (Fluid 1), Density, Viscosity and Vapor Pressure. The vapour pressure may be gauge and negative; it becomes absolute.

- Without them, the average density and viscosity of the stored results are used; without those either, water at 20 °C, with a note asking for the fluid.
- Properties that vary with the temperature, a non-Newtonian or slurry model and several fluids are reported. Pump It calculates a Newtonian liquid with the constant properties of the keys.
- Gravity, the Reynolds numbers of the transition and the ambient pressure (F-07) come from the same section.
- The laminar correction code 0 means no correction (inferred, README "Clean-room record"); any other code keeps the default of Pump It and is reported.

## Stored results

**F-29 Stored results.** The pipe results of the imported scenario, always in US units: mass flow (lbm/s), stagnation pressure at the inlet and outlet (psia), density (lbm/ft³) and viscosity. They serve for the comparison of the report, the losses of F-21 and F-23, and the basis of F-20. `read(text, { calibrate: false })` keeps them out of the model (the tee without losses, curves at half of their largest flow).

## Drawing and report

**F-30 Drawing.** The coordinates of the junctions (b+0, b+1) are scaled so that neighbouring junctions sit about 160 units apart, snapped to the 20-unit grid and moved to a 100-unit margin; the axes of the screen (y downwards) are assumed. Two junctions on the same point of the grid are set one step apart. Without usable coordinates, the junctions go on a grid, with a note. A junction the import creates stands beside its pump.

**F-31 Report.** After the first calculation, the report compares it with the stored results by the measure of section 10 of the specification: the mass flow of each pipe relative to the largest stored flow, and the stagnation pressure at both ends relative to the largest stored pressure drop in a pipe. Below 0.1 % on both, it says that the results match. The notes follow, by level: what needs the user, what was assumed, what was left out and what was read.

**F-32 Opening.** *File → Open* accepts `.json`, `.fth` and `.aro` (docs/aro-import.md); a file dropped anywhere on the window opens the same way. A `.fth` file with several scenarios first shows them to choose from. Undo brings back the model that was open before.

## Time simulation

The time control, the time data of the junctions and the finite tanks follow Annex A of the specification of the time simulation (*Simulação no tempo*, version 1.0 of 2 November 2026; [time-simulation.md](time-simulation.md)), under the rules of F-01: the specification team wrote it from the example files of the reference, and nothing here was taken from a file. The time data of the junctions follow its version 1.1 of 4 November 2026: the correction of Annex A.2, the event codes of Annex D.4 and item 7 of Annex D.10. The specification team took those facts from the structure of the program, as its section 0.2 records; this work used only the text of the specification. The finite tanks follow the complement of Annex A.3 in the same version (F-40).

**F-34 Time control.** `AnalysisType` 2 in the settings (`ANALYSISTYPE` in the settings of a child scenario) turns the time simulation on, with a note; 1 leaves it off and its control is still read. The section `[TRANSIENT CONTROL]` gives the start, the end and the step in their units of time (seconds, minutes and hours, also days, weeks and years, a year taken as 365 days), `Frequency` as the recording interval and `DifferenceMethod` 0 as the forward method and 1 as the central one (both inferred by the specification; another code is the forward method, with a note), with the tolerances, the iterations and the relaxation of the central method. A child scenario adds the keys its own section changes, in capitals. An end of −1 is not set: it is left blank, with a note that asks for it. `TotalSteps` is only a check of the file and is not read.

**F-35 Place of the time data.** The block of the time data of a junction is [rel] [ign] [rep1] [rep2] [trigger] [event 1] [event 2] [table 1] [table 2] (Annex A.2 as version 1.1 corrects it: what version 1.0 read as the name of a combined event is the key of the first table, and the marker 1 of a table is its number of columns of values). A reservoir has one more field before rel, the model of its transient, which is not read. The block moves with the kind of the junction, its number of pipes and, in a pump, the size of its curves, so it is found by its shape: four numbers; a trigger from 0 to 3; two events of eight fields, each with an integer code and comparison, a numeric value and a unit written out; and a first table with a key written as a text, at least one column of values, a count of rows and a unit of time. The search starts two fields before the first place of the trigger seen for the kind (b+81 for an imposed flow, b+110 for a valve, b+97 for a control valve, b+138 for a pump; b+89, b+92, b+103 and b+111 for a branch with two pipes, an imposed pressure, a nozzle and a reservoir with one pipe, plus 3 or 5 fields for each further pipe) and goes 60 fields on. A record without such a block, or whose first table is empty and kept in the record, has no time data. The trigger is 0 by the clock, 1 one event, 2 two cyclic events and 3 two events in sequence, all four confirmed by version 1.1.

**F-36 Events.** An event is [code, comparison, value, unit, end 1, object 1, end 2, object 2] (Annexes A.2 and D.4). The codes that have a condition in Pump It (§5.2 of the specification, adapted to a liquid as item 6 of D.10 does for a gas) come in as that condition:

| Code | Condition of Pump It |
|---|---|
| 0 | the clock (`time`) |
| 23 | the time since the last event of the junction (`elapsed`) |
| 1, 2 | the static and the stagnation pressure at an end of a pipe |
| 3, 4 | the mass and the volume flow of a pipe |
| 5, 6 | the hydraulic and the energy grade line at an end of a pipe |
| 22 | the velocity in a pipe |
| 7 | the speed of a pump (%) |
| 10 | the state of a control valve: 0 controlling, 1 fully open, 2 closed |
| 11, 12 | the static and the stagnation pressure across a junction |
| 15 to 18 | the static and the stagnation pressure and the two grade lines, between two pipes |
| 21 | the level of a reservoir over its bottom |
| 24 | the pressure of a tank, read as the pressure at its surface (the pressure of the gas in a closed tank) |
| 25 | the opening of a valve (%) |
| 28 | the Cv of a valve |
| 29 | a Kv, compared as the Cv of the same loss |

- **Places.** Object 1 is the ID of the pipe or of the junction. End 1 is the end of a pipe: 1 its inlet, 2 its outlet. A pressure or a grade line takes it; a flow or a velocity does not need it, since a liquid has one flow along a pipe. Another value leaves the end of the condition blank, with a note, and the checklist asks for it. End 2 and object 2 serve only the events between two pipes.
- **Differences.** The description does not give the order of a difference (11, 12, 15 to 18). It is read as the first place less the second: the inlet side of the junction less its outlet side, or end 1 of object 1 less end 2 of object 2. A note asks to check it. A difference of pressures is in a unit of pressure difference (psid, bar, kPa…).
- **Comparisons.** 0 is >, 1 ≥, 2 "equal to", 3 ≤, 4 < and 5 "state equal to". Version 1.0 had taken 2 as "<"; version 1.1 corrects it and adds 4 and 5. A number takes the four inequalities. "Equal to" on a number almost never holds, since the reference compares exactly, and Pump It does not offer it: such an event, like "state equal to" on a number, leaves out the time data of its junction, with a note. A state takes 5, which rounds the value to a whole code, and 2, an exact comparison of codes; both become "=" of Pump It. An inequality on a state, or a value that is not one of its codes, leaves the time data out, with a note.
- **Values.** The value keeps the unit of the file in its category, as everywhere (F-07): a gauge pressure stays gauge, and the ambient pressure of the system converts it. A velocity is a length per second, minute or hour, written as the units of flow are; the description lists no units of velocity, so this is an assumption, and another spelling is a unit that does not fit. A percentage and a coefficient (7, 25, 28, 29) are read whatever their unit. A Kv becomes the Cv of the same loss by the definitions of Pump It, a Cv of water at 999 kg/m³ in gpm and psi and a Kv of water at 1000 kg/m³ in m³/h and bar: Cv ≈ 1.157·Kv. A unit that does not fit the quantity leaves out the time data of the junction, with a note.
- **Other codes.** They leave out the time data of the junction, with a note: 8 and 9, the state of a check valve and of a relief valve, which the import does not bring in as such (F-26); 13 and 14, the grade lines across a junction, which Pump It reads only at the ends of pipes; 19, the flow out of a nozzle; 31, a combined event, whose definition the description does not locate; 20, 26, 27, 30 and 32, of reservoirs, surge tanks and accumulators, not described one by one; and any unknown code. So does a comparison of an unknown code.
- **Objects.** Once every junction is read, an event on a pipe or a junction that is not in the model keeps its object, with a note that asks for another one. An event on the level of a reservoir that is not a finite tank keeps it too (F-38). An event on the opening of a valve has a note that asks for the characteristic of the valve, which the file does not give and an opening needs (the checklist asks for it too; T-26 of [time-simulation.md](time-simulation.md)).

**F-37 Quantity of a table.** A table is [key, nY, n, unit of time, nY units of value, n rows of τ and nY values] (Annex A.2, version 1.1).

- The key "None" keeps the table in the record. Another key points to a set of data of the file, a layout the description does not decode: the time data of the junction are left out, with a note that names the set.
- Every row is read whole, with its nY values. Pump It drives one quantity per junction, so the first column of values is read and the others are left out, with a note. In the files of a liquid, nY is 1.
- When a junction takes more than one quantity, the file does not say which one a table drives, so it is chosen by the mode of the junction and the unit of its first column (Annex A.2): a unit of the category of a quantity of the junction makes the table that quantity (the first in the order of its type: a length is the level of a reservoir, a pressure its surface pressure); "None" is the K, Cv or Kv of the loss model of a valve, where K = −1 is closed; "Percent" is the speed of a pump on its curve.
- A relative table (F-39) holds % of the steady value, whatever its unit. "Percent" or "None" then gives the only quantity of the junction; a unit of a quantity gives that quantity, and its values are still read as %, with a note.
- Version 1.0 read a table in "Percent" of a quantity that is not a percentage as relative values. That rule now only checks the field of the file: an absolute table in percent of such a quantity contradicts it, and the time data of the junction are left out, with a note.
- A table in a unit that fits no quantity of the junction, a table in an unknown unit of time, or a second table of another quantity, leaves out the time data of the junction, with a note.

**F-38 An event on a level.** An event on the level of a reservoir that is not imported as a finite tank is kept, with a note that asks to check it; with the simulation on, the checklist then asks for a finite tank or another object.

**F-39 Options of the time data.** The four fields before the trigger are read (Annex A.2, version 1.1; in the files of a liquid the specification team saw, all four are 0). The fields after the second table belong to the kind of the junction and do not hold these options.

- rel other than 0: the values are relative, in % of the steady value of the same quantity (`basis: 'relative'`); 0, absolute.
- ign 1: the data come in kept and unused (`use: false`), with a note; 0, in use. Another code is not described for a liquid: the data come in use, with a note.
- rep1 other than 0: the tables repeat (`repeat: true`). Pump It has one choice for both tables, so with two events it is that of the first table, with a note when rep2 says otherwise (Annex B). With one table, rep2 is not used.
- The points of a table are joined by straight lines (`interp: 'linear'`; inferred by the specification). The note of the data read is now only information.
- After an event, the reference starts a table from the value the junction has at that moment (Annex D.5). The time data come in with `resume: 'current'`, which does the same (item 7 of D.10; T-35 of [time-simulation.md](time-simulation.md)).

**F-40 Finite tank.** In the record of a reservoir (Annex A.3, with the complement of its version 1.1), from b+88 with one pipe and five fields further for each further pipe: the model (0 infinite, 1 open, 2 closed, confirmed by version 1.1), whether the level is an elevation (0) or a height over the bottom (1), its value and unit, what is known at the start (b+92), the bottom, the height of the tank, the section (b+97: 0 constant, with its area at b+98 and b+99; another value, the table of volume by height), the exponent of the gas of a closed tank (b+100) and the table of volume by height from b+101, in the layout of the tables of A.2 [key, nY, n, unit of the height, unit of the volume, rows (h, V)], five fields when empty. The model of its transient and its time data come after that table, which moves them when it has rows (F-35). An open tank is imported with a note: the level becomes the elevation of the surface, and connections by depth (F-17) keep the elevations of the ends of their pipes.

- **Known at the start.** 0 is the level and the pressure, 1 the pressure only (the level is calculated, §6.6), 2 the level only (the pressure of the gas is calculated). An open tank always knows the pressure at its surface: with 2, or with another code, both are taken as known, with a note.
- **Table of volume by height.** The descriptions spell no unit of volume on its own, so the spellings of the volumes in the units of flow (m3, ft3, gal, liters…) and of the units of area (meters3, feet3…) are taken, an assumption; another unit, or a table that does not read, imports the reservoir as infinite, with a note.
- **Closed tank.** The surface pressure of the reservoir is the pressure of its gas at the start. Its exponent comes from b+100; one that is not above zero is left blank for the user, with a note. Its relief and vent pressures, each with its unit, are the first four fields after the second table of its time data; a pressure at or below vacuum is no relief or vent, an assumption, since the description does not say how a missing one is written.
- Another model is imported as an infinite reservoir, with a note.

**F-41 Scenarios and other files.** The time control of a child scenario takes its own sections over those of its parents (F-34). The time data and the tank of a junction are read from its record as rebuilt for the scenario (F-08); where a child changes them, the layout of its sparse fields is not decoded (Annex A.3), so the data may come out as those of its parent. The time data of `.aro` files, which version 1.1 describes (Annex D.9), are read by the `.aro` importer, with the readers of the time control, of the blocks and of the events it shares with this one (`src/core/import/shared.js`; A-29 to A-35 of [aro-import.md](aro-import.md)).

## Known gaps

What the description leaves open, and how the importer treats it:

| Gap | Treatment |
|---|---|
| Correlations of the detailed tee | the stored point (F-23); without it, no losses |
| Whether a reservoir connection was entered as a depth or as an elevation; the two fields of each pipe before its depth | a depth below the surface, from the end of the pipe, with a note (F-17) |
| Kinds 0, 1 and 3 of the control valve; the basis of a pressure set point | read as such, with notes (F-20) |
| Heat transfer, variable properties, slurries, non-Newtonian fluids | constant Newtonian properties, with notes (F-28) |
| Design factors | not applied (F-14) |
| Valve loss model 10 and other unknown loss models | K = 0, with a note |
| Pump modes 2 and 3, controls other than flow | the curve, or the flow left blank (F-25) |
| NPSHR unit | that of the head, with a note (F-25) |
| Thermal data of the heat exchanger, three-way valve | not read (F-22, F-26) |
| Check valves, relief valves and the kinds not seen in files | K = 0 or a node (F-26) |
| Result columns after the ninth | not read |
| A base scenario without a network | read: the network of the children as new records, with a note (F-33) |
| Time simulation: event codes 8, 9, 13, 14, 19, 20, 26, 27, 30, 31 and 32, and tables kept in a set of data of the file | the time data of the junction left out, with a note (F-36, F-37) |
| Time simulation: the order of a difference in an event, the units of velocity, the columns of values after the first, a code of ign other than 0 and 1, the characteristic of a valve watched by an event | the first place less the second; a length per second, minute or hour; the first column; in use; left for the user; with notes (F-36, F-37, F-39) |
| Time simulation: a table started by an event from the current value of the junction (Annex D.5) | from the first point of the table, until the option `resume` of phase F4 (F-39) |
| Time simulation: the gas of a closed tank, the table of volume by height, the flags of a known level and pressure, the sparse records of a child | the exponent left blank, an infinite reservoir, or the data of the parent, with notes (F-40, F-41) |
| Writing .fth files | out of scope |

A gap is closed only by a new description from the specification team, never by studying files of other programs here (CONTRIBUTING, clean-room rules).
