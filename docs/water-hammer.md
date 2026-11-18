# Water hammer

Pump It can follow the elastic transient of a liquid network: the pressure waves that a valve closing, a pump tripping or a level changing sends along the pipes, with the largest and smallest pressures of every point (the envelopes), the times they are reached and the series of chosen points over time. The pipes are solved by the method of characteristics, from the steady state of the scenario. It is a module of its own: it calculates only while the user turns it on, in the system window, and the rest of the program works the same without its files. In the interface the feature is called "Water hammer" ("Golpe de aríete", "Golpe de ariete").

It follows its own clean-room specification, *Golpe de aríete* (version 1.0, 5 November 2026), written by the specification team as a complement of `Clean Room.md`, and the addendum of that team for phase G3 (*Golpe de aríete: respostas para a fase G3*, 16 November 2026), which answers the questions the implementation asked before deciding the open points of its Annex A, confirms decisions W-49 and W-50 and gives the cases T19 to T31. This file maps them onto Pump It and records the decisions of the Annex A and of the addendum, with the place where the code applies them, and those the adaptation required (§11.7 asks for this record).

Clean room (§0.3): only that specification and its addendum, `Clean Room.md`, the specification of the time simulation (for its tables, triggers and events), the public references of its Annex B and of the addendum, and the test cases of its §12 and of the addendum were used, with the code of this repository. No executable, help, screen, text, embedded table or model file of another program was opened, and nothing of the working folder of the specification team. The four-quadrant data of pumps and the deceleration tables of check valves come only from the user (W-51); the four-quadrant table of the tests is the synthetic one of the addendum, made by its team from simple formulas. Neither the reference program nor its maker is named anywhere.

## Progress

| Phase | Content | State |
| --- | --- | --- |
| G1. Core | The control of the run; wave speed calculated or given; automatic sectioning with the adjustment of the wave speeds, or a given time step; the method of characteristics with the friction of the steady state; the boundaries of the existing junctions (reservoir, imposed pressure, imposed flow and dead end, branch, valve, exit valve, orifice, generic component, nozzle, instantaneous check valve, control valve frozen or ideal, pump with a speed table or a trip without reverse flow); discrete vapour cavities; the test of the artificial transient; tables, trips and events; results, envelopes, profiles, event log and warnings; the interface | Done |
| G2. Protection | Surge tank, air vessel, relief valve, air valve, infinite pipe, finite reservoir, friction varying with the Reynolds number | Done |
| G3. Advanced | Four-quadrant pumps from the user's data, pump start with a motor torque curve, dynamic check valves, discrete gas cavities, unsteady friction, unbalanced forces, rate limit of a control valve, staggered grid | Done after the addendum of 16 November 2026: everything but the staggered grid, which the addendum leaves out (G3-07) |

## Where things are

| Specification | Pump It |
| --- | --- |
| Module (§11.1) | `src/core/surge/` (`PumpIt.surge`) after `src/core/time/` in `index.html`, `src/ui/surge/`, `src/ui/styles/surge.css`, `src/i18n/<language>/surge.js`; every hook in the rest of the app is guarded, so the page works without these files |
| Wave speed (§3) | `src/core/surge/wavespeed.js`, `PumpIt.surge.wavespeed`; the bulk modulus of water in `src/core/fluids/water.js` (`waterSoundSpeed`, `waterBulkModulus`); the material of a catalogue in its `elastic` id (`src/core/data/*-pipe.js`) |
| Sectioning (§4) | `src/core/surge/sectioning.js`, `PumpIt.surge.sectioning.section` |
| Network of a run (§2.5, §9.2) | `src/core/surge/network.js`: the refined steady state, the pipes, their R, the boundaries; `sizeOf` for the checklist and the system window |
| Pipes and cavities (§2, §7) | `src/core/surge/moc.js`: `makePipe`, `ends`, `interior`, the ports of the pipes |
| Boundaries (§5) | `src/core/surge/boundaries.js`: the generic node and element, the scalar roots; the `surge` hook of a junction type may give its own boundary (`src/core/junctions/registry.js`) |
| Pumps (§5.11) | `src/core/surge/pumps.js`, the boundary of the pump type (`src/core/junctions/pump.js`) |
| Protection devices (§6.1 to §6.4) | the boundaries in `src/core/surge/devices.js` (`PumpIt.surge.devices`); the junction types `surgeTank`, `airVessel`, `reliefValve` and `airValve` in `src/core/junctions/` (`surge-tank.js`, `air-vessel.js`, `relief-valve.js`, `air-valve.js`), their drawings, solids and fields in `src/ui/junctions/` (the shared fields of a tank or a vessel in `shared.js`) |
| Infinite pipe (§6.5) | the condition `surgeSpecial: 'infinitePipe'` of the `pressure` and `flow` types (their `surge` hook), its boundary in `devices.js` |
| Finite reservoir (§6.6) | the `surge` hook of `src/core/junctions/reservoir.js`, its boundary in `devices.js` with the tank of the time simulation (`PumpIt.time.tanks`); the tank section of the inspector (`src/ui/time/tank-section.js`) |
| Friction that varies (§2.7) | `variableFriction`, `updateFriction` and `interiorVariable` in `moc.js`; the friction of a station at its flow, `frictionOf` in `network.js` |
| Rate limit of a control valve (G3) | the `surge` hook of `src/core/junctions/control-valve.js` (`tracks`, `rate`, `openingOf`, `cvAt`, `validate`), applied in `elementBoundary` (`boundaries.js`); its field in `src/ui/junctions/control-valve.js` |
| Start of a pump (G3) | the start in the boundary of `src/core/surge/pumps.js`, the table of the motor in `motorCurve`; the table in the inspector (`src/ui/junctions/pump.js`) |
| Pumps in four quadrants (G3, addendum §1.1) | `j.fourQuad` (`use`, `ref`, `theta`, `wh`, `wb`, `Q`, `H`, `N`, `P`); `suterTable`, `bepOf`, `validateFour` and `fourOf` in the boundary of `src/core/surge/pumps.js`; the table of speed from rest in the `surge` hook of `src/core/junctions/pump.js`; the block of the inspector in `src/ui/junctions/pump.js` (`fourBlock`) |
| Dynamic check valves (G3, addendum §1.2) | `src/core/surge/checks.js` (`PumpIt.surge.checks`), reached through the `surge` hook of `src/core/junctions/check-valve.js`: `j.dynamic`, `j.decel`, `j.decelWindow`, `j.swing`, `j.nozzle`; its fields in `src/ui/junctions/check-valve.js` |
| Unsteady friction of Brunone (G3, addendum §1.4) | `brunone`, `brunoneTerms`, `brunoneShift` and `interiorGeneral` in `moc.js`; the coefficient of each pipe (`brunoneK`) in `network.js`; `pipe.surge.k` in `wavespeed.js` and the pipe section |
| Gas cavities (G3, addendum §1.5) | `gasInit`, `gasU` and `interiorGeneral` in `moc.js`; the gas of the nodes in `nodeBoundary` (`boundaries.js`, with `gasRoot`); `solution.surge.alpha0` and `p0` in `inputs.js` and the system window |
| Unbalanced forces (G3, addendum §1.6) | `src/core/surge/forces.js` (`PumpIt.surge.forces`), `solution.surge.forces`; their records in `record.js` (`forcesCreate`, `forcesStep`, `forcesOf`); the editor in the system window (`forcesSection` in `src/ui/surge/system.js`), the card of the results and the objects of the charts |
| New unit categories (G3) | `force`, `accel`, `angle`, `rotStiffness`, `stiffness`, `rotDamping` and `damping` in `src/core/units.js` |
| Control, data and checklist (§8, §9.1, §11.6) | `src/core/surge/inputs.js`; the checklist item `surge` in `src/core/model/validation.js` |
| Results (§10) | `src/core/surge/record.js`, `PumpIt.surge.record` |
| Main loop (§9) | `src/core/surge/simulate.js`: `PumpIt.surge.run`, `start`, `prepare` |
| Interface (§11.4) | the run in slices and the time cursor (`run.js`, `bar.js`), the system window (`system.js`), the pipe and the junction in the inspector (`pipe-section.js`, `junction-section.js`), the results (`results.js`), the colours of the drawing (`overlay.js`) and the charts (`charts.js`), all in `src/ui/surge/` |
| Formulas of the help (§11.7) | `src/ui/help/equations.js` (`surgeEquations` to `pumpTripStep`), the chapter `surge` of the help in the catalogs of the module |

## Decisions of the specification

The decisions of Annex A are followed as written. They are repeated here with the place where the code applies them.

**W-01 Module.** `PumpIt.surge` and `src/ui/surge/`. The app reaches them only through guarded hooks: `app.startSurge` after the steady state (`calculation.js`), the stamp (`header.js`), the system window (`system-panel.js`), the sections of the inspector (`I.addSection`), the tabs of the results (`results.js`, `export.js`), the extension points of the drawing (`addOverlay` in `color-scales.js`) and of the charts (`register` in `charts.js`), and the chapter of the help, left out when its texts are missing.

**W-02 Variables.** Stagnation pressure and mass flow, those of the steady solver; the static pressure is derived (`staticAt`). The steady state is refined to a relative tolerance of 10⁻¹⁰ (`steadyState` in `network.js`); without it, the run starts from it as it was, with a caution.

**W-03 Friction.** Linearized as Wylie and Streeter do. R of a pipe takes its steady loss, friction and fittings, R = ΔP/(ṁ₀|ṁ₀|), shared equally by its sections (`network.js`, `makePipe`).

**W-04 Pipe without steady flow.** Below 10⁻⁶ of the largest steady flow, R takes the fully turbulent friction factor of its roughness, 1/√f = −2·log₁₀(ε/(3.7D)), or 0.01 for a smooth pipe or Hazen-Williams, with an information.

**W-05 Closed pipes** stay out of the transient; their ends are dead ends for the junctions.

**W-06 Supports and materials.** `thinAnchored` by default; no buried option with the stiffness of the soil; the lining is ignored; the table of E and ν of §3.3 (`MATERIALS` in `wavespeed.js`).

**W-07 Bulk modulus.** Water from the sound speed of Marczak (1997), K = ρc², from 0 to 95 °C with a caution outside; a fluid of the user gives `system.fluid.K`. Without K only given wave speeds can run (checklist).

**W-08 Sectioning.** N_c from 1 to 20 in steps of 0.05 (by multiplication), a limit of 10 %, a tolerance of 10⁻⁹, rounding half up; without a solution the smallest variance with a warning; the option of a given time step.

**W-09 Duration** shorter than 4·L/a of the longest pipe: an information.

**W-10 Nozzle** with no liquid coming in from outside (`outflowOnly` of its hook).

**W-11 Check valve** instantaneous, in the step of the detection (`reopens: 'closed'` of its hook and the review of the device states in `elementBoundary`).

**W-12 Control valve** frozen by default, ideal as an option (`surgeControl`, a field of the valve).

**W-13 Pump.** The speed of the control is frozen; sizing keeps its flow; s = 0 leaves of a polynomial curve its term in Q²; a trip removes the torque of the motor, the speed follows the trapezoid rule iterated with the step, the shaft power comes from a power curve or from the efficiency data, there is no reverse flow and s ≥ 0 (`pumps.js`).

**W-14 Data** in `j.surge`, apart from `j.time`, with the same structure.

**W-15 Events** with the rules of the time simulation (`PumpIt.time.events` unchanged, fed with a row of results built from the state of the method). A trip at an event happens at the step of the event.

**W-16 Cavities.** ψ = 0.5 by default, from 0.5 to 1; the stagnation basis by default; with the static basis a cavity holds its static pressure at P_v.

**W-17 Large cavity** above 10 % of the volume of its section: a warning.

**W-18 Artificial transient.** 0.5 % of the absolute pressure, and of the flows above the limit; the run stops by default.

**W-19 Exclusive** with the time simulation (turning one on turns the other off); refused in the compressible mode.

**W-20 Relief valve.** Its pressures are those of its node, stagnation; Cv grows in a straight line from the closing pressure to the full opening pressure, and the closing pressure is at most the set pressure (checklist), the set pressure itself when left empty (`reliefValve` in `devices.js`).

**W-21 Air vessel.** n = 1.2 by default, from 1 to 1.4 (checklist); the pre-charge only at constant temperature, P₀V₀ = P_g,0·V_g,0.

**W-22 Air valve.** Ideal air at constant temperature in the cavity, R = 287.05 J/(kg·K), k = 1.4, critical ratio 0.52828 (`AIR`, `RC` and `airFlow` in `devices.js`).

**W-23 Surge tank and finite reservoir.** The level by the implicit trapezoid rule, solved with the node in the same step; above the top the level stays there and the excess leaves the system (a warning, the volume in the totals); at the bottom the tank only takes liquid in (a warning).

**W-24 Scalar roots.** Newton protected by a bracket, false position and bisection, relative tolerance 10⁻¹², at most 100 iterations (`solveRoot` in `boundaries.js`).

**W-25 Output stations** at the ends by default, `all` or a list per pipe; the extremes always cover every station.

**W-26 Maximum pressure** of a pipe, optional, for a warning only.

**W-27 Performance** is a target, not a test (see Performance below).

## Decisions of the addendum (phase G3)

The decisions of §4 of the addendum are followed as written. Where it and the specification speak of the same thing, the addendum holds; its §1.4 replaces the discretization of Brunone of §2.7.

**G3-01 Four quadrants.** Only the curves of Suter, WH(θ) = h/(α² + v²) and WB(θ) = β/(α² + v²) with θ = π + atan2(v, α), as a periodic table of θ in degrees from 0 to 360°, at least 9 points, the values at 360° those of 0°, in straight lines (`suterTable` in `pumps.js`; checklist `pump.fourTable`).

**G3-02 Reference point.** The steady state of each pump (the default), its best efficiency at the rated speed, or one given (Q_R per pump, H_R, N_R and the shaft power P_R). The table is scaled by c_H = h₀/h₄ and c_B = β₀/β₄ so that it meets the steady state, with a caution beyond 5 %; a pump at rest takes 1 (`fourOf` in `pumps.js`).

**G3-03 Reverse flow.** With the four-quadrant data a trip or a start lets the flow and the speed go back; only `noReverse` holds the flow, and a pump that starts off and closed stays shut until its head at no flow overcomes the difference across it (`solveAt` in `pumps.js`).

**G3-04 Check valve by deceleration.** The deceleration by least squares over the window τ_d (0.1 s by default) at each reversal, the closure when V ≤ −V_R, a dimensional table only (`checks.js`).

**G3-05 Swinging and sliding discs.** The torque of the pressure ΔP·A_d·r_p, the weight less the buoyancy, an optional counterweight, spring and damper, the loss by the fraction of the Cv fully open, the implicit trapezoid rule, stops without rebound (`checks.js`).

**G3-06 Buoyancy and position.** The mass of the liquid displaced (none, given, or from the density of the disc, 7850 kg/m³ by default) and the position of the valve by an angle from −90° to 90° (`checks.js`).

**G3-07 Staggered grid.** Left out of Pump It, as the implementation suggested.

**G3-08 Brunone.** The form of Vítkovský with the explicit characteristic discretization of §1.4 of the addendum (`brunoneTerms` in `moc.js`).

**G3-09 Coefficient of Brunone.** k per pipe from the Reynolds number of the steady state, fixed for the run, which the pipe may replace; the quasi-steady part is the friction that varies of W-47 (`network.js`).

**G3-10 Gas cavities.** Isothermal gas, α₀ and p₀ of the whole network, half a section at the ends of a pipe, the vapour cavities of §7.3 at the sides of the elements (`moc.js`, `boundaries.js`).

**G3-11 Forces.** Segments, points and exits, by the static pressure, with the flow of momentum and the friction (`forces.js`).

**G3-12 W-49 and W-50** confirmed as they were.

## Decisions of the implementation

**W-28 Material of a catalogue.** The catalogues of pipes name their material for the wave speed with an `elastic` id: carbon steel, stainless steel, HDPE and ductile iron. A pipe out of the catalogues needs E, ν and its wall typed, or a given wave speed.

**W-29 Frozen valve that added pressure.** A control valve whose steady loss is negative (it added pressure) is frozen without a loss, with a warning.

**W-30 End of a table.** Past its last point a table keeps its last value, the usual end of a manoeuvre, without the caution of the time simulation.

**W-31 Discharge of a node.** A free node with exactly one open discharge solves for the flow of the discharge, with P = P_ext + φ(ṁ); an exit valve with K = 0 then fixes the pressure of its node instead of leaving it undefined.

**W-32 Cavity at a junction.** A free node with one pipe holds its cavity at the station of the pipe, on the basis chosen; with two pipes or more, at the node, on the stagnation pressure. Fixed pressures never cavitate.

**W-33 Trips.** A trip happens at a time (the first step with t_k ≥ τ, within 10⁻⁹·Δt), at an event written in the junction, or at an event of the model. The torque is gone from the next step on, as §8.3 says. A table of speed or a trip needs the pump running on its curve (checklist). The start of a pump (W-50) happens the same way.

**W-34 A model without the module.** A model that never used the water hammer carries nothing of it: `solution.surge` is written when the user turns it on, and a loaded model without it stays without it (`normalize` only repairs a control the file has). Its defaults are read by `controlOf`. So an example stays equal to itself and follows the language.

**W-35 Net flow of a junction.** The series and extremes of a node record the flow it gives the network, as the steady results do; at 0 s it is the flow of the steady state (until phase G2 the first row held 0, and a finite reservoir integrated its first step from 0).

**W-36 Grade lines** use the absolute pressure, as those of the steady state. The profile of the envelopes therefore draws the line of the vapour pressure, z + P_v/(ρg), where the specification speaks of the pipe line.

**W-37 Colours of the drawing.** At the cursor, the mean of the output stations of a pipe, on the range of the whole run so that two times compare; the envelopes over every station. Beside a junction, its pressure (the inlet of a device).

**W-38 Recording.** During a run the extremes of a pipe are kept station by station in one array, and the series go through a block of 32 rows copied into the series of each station; the result is laid out by station and quantity at the end (`finish` in `record.js`). The values are the same, bit for bit, as recording them one by one.

**W-39 Devices as junction types.** The four devices are junction types of their own, in the palette group "Surge protection", offered while the module is in the page (`offered` in the registry of the junction types). In the steady state each is a node without losses: the relief valve closed, the air valve without air, the surge tank at the level of its node (or, with a known level, a fixed pressure, as a reservoir). Their data are fields of the junction, edited in the water hammer section of the inspector, and the checklist asks for them only with the water hammer on.

**W-40 A device and its node in one step.** Each device is solved with its node at the end of the step, by the trapezoid rule, with one scalar root (W-24). The air valve searches its pressure from below with Newton's method and a bisection on a bracket (`rootUp`), since its air flow is a square root near the outside pressure.

**W-41 Connection of a tank or a vessel.** An orifice has its own Cd·A each way, ΔP = ṁ|ṁ|/(2ρ(Cd·A)²); a riser adds the inertia of its column, by the trapezoid rule on its momentum, F_k = 2(L/A)(ṁ_k − ṁ_k−1)/Δt − F_k−1, with its friction f·L/D. A one-way surge tank only feeds the network: while the liquid would go in, its check valve closes and the node is a node of its pipes.

**W-42 Shape of a tank.** A constant section or a table of volume by height from 0. A table needs the top and reaches it, as the finite tank of the time simulation does; a constant section may go without a top, and then never overflows. In an air vessel with a geometry the column of liquid over the node adds to the pressure of the gas; without one the gas is at the pressure of the node.

**W-43 Relief valve at work.** Closed, it is the node of its pipes with their cavities. The opening goes into the results in %, and its largest rate (%/s), above zero or empty for no limit (checklist), limits it both ways. A table of its opening makes it a pilot valve that follows the table. Its openings and closings go into the event log, with the time; §10.4 asks no warning for them. A steady pressure above the set pressure gives a warning, and the valve opens in the first step.

**W-44 Air valve at work.** Its opening pressure is the atmospheric pressure by default, the temperature of its air that of the liquid. Its states (closed, admitting, expelling, holding) go into the event log. A two-stage valve expels through its smaller orifice once the pressure difference or the air flow passes its limit, and through the larger one again when air comes in. When its air is gone the valve closes and the node is liquid again.

**W-45 Infinite pipe.** The tables of its junction are not used in the transient, its pipe needs at least two sections (an error) and its end does not cavitate (a warning when its pressure falls below the vapour pressure).

**W-46 Finite reservoir.** The tank is that of the time simulation (`j.tank`). With the water hammer on, the inspector shows its tank section without the choice of what is known at the start: the run starts from the level of the steady state. Only its surface pressure takes a table. A pipe end the tank leaves uncovered is closed while it would draw liquid, as in the time simulation, so a run cannot start when the steady state draws through an uncovered end (an error that says so). The volumes overflowed and lacking are totals of the results.

**W-47 Friction that varies.** Each station has its own R, the friction of the steady correlation at its flow (Darcy with its laminar and transition parts, or Hazen-Williams) plus the fittings of the steady state. It is calculated again after a step in which the mean flow of the station changed by more than 1 % since its last calculation; below a velocity of 10⁻⁶ m/s it takes that velocity. Colebrook is solved by Newton's method from its last value, the same equation as the steady solver within 3·10⁻¹⁴. A given friction factor, or no friction, does not vary. Every station starts with the R of the steady state, so the steady state holds.

**W-48 Case T9 without cavities.** The values of T9 come without the cavitation model: with vapour cavities the column of the penstock separates after the closure, and its collapses go above the first peak. The test runs it with `cavitation: 'none'`.

**W-49 Rate limit of a control valve** (phase G3, before its addendum). A control valve that controls at every step may have a largest speed of its opening, `surgeRate`, in % of the full opening per second, the same opening and closing, as the relief valve has (W-43); empty, there is none. It needs the characteristic of the valve (linear or of equal percentage, with its Cv fully open), the fields that already give its opening in the steady results. In each step the valve is first solved as the ideal valve, with the states of §5.10; the opening that solution asks for comes from its Cv by the inverse of the characteristic (closed 0 %, fully open 100 %). Further than the speed times Δt from the opening of the step before, the opening goes only that far towards it, and the valve is solved again as a fixed valve with the Cv of that opening; otherwise the ideal solution stands, so a speed the valve never reaches gives the run of the ideal valve, bit for bit. The opening starts from the Cv of the steady state and joins the series of the junction. Its state, in the log and the conditions, stays that of its control, which the opening follows. A frozen valve does not move, so the speed changes nothing there.

**W-50 Start of a pump** (phase G3, before its addendum). A pump on its curve that is off and closed in the steady state may start, at a time or at an event as a trip (W-33). From then on its motor gives the torque of a table of torque against speed (% of the rated speed), `j.motor`, given by the user: in straight lines between its points and its end values held beyond them, with a caution when the speed passes its last point. The speed follows I·ω_r·ds/dt = T_m(s) − T(Q, s), with the torque of the pump of §5.11, by the trapezoid rule; the speed of each step is the scalar root of that rule with the solution of the step at that speed (W-24), since successive substitutions, as in a trip, diverge with a large Δt where the torque of a motor falls fast near its synchronous speed. The pump lets no flow back: its check valve holds it until Δp(0, s) overcomes the difference across it. A start needs the inertia, the rated speed, the shaft power (a curve of power or of efficiency), the curve of the head and a table of at least two points, its speeds rising from 0 % and a starting torque above zero (checklist). A pump that is off with free passage does not start: at no speed with flow its torque would need the four-quadrant data.

**W-51 Data of phase G3 from the user only.** Points 1 and 2 of Annex A left open where the four-quadrant data of pumps and the deceleration curves of check valves come from. The owner of the project decided on 16 November 2026 that they come only from the user: Pump It embeds no published table. The rest of phase G3 waited for the addendum of the specification, which its team gave the same day with the confirmation of W-49 and W-50 (G3-12) and the cases T19 to T31.

**W-52 Opening of an ideal control valve.** A control valve that controls at every step with its characteristic records its opening in the results whether or not it has a largest speed (case T19 gives the openings of the valve without a limit). Without the limit it is the opening its control asks for, so a speed the valve never reaches still gives the ideal run bit for bit, its opening included.

**W-53 Pumps in four quadrants at work.** The addendum leaves the method of the step free when it converges to 10⁻¹² relative in the flow and the speed. Pump It nests two scalar roots, as its starts already did (W-50): the flow for each speed tried, inside the root of the trapezoid rule on the speed, both by the protected Newton of W-24, so the sides of the pump keep their vapour cavities and the losses at the ends of its pipes. A trip in four quadrants takes the same root as a start, without the clamp at zero speed. The reference of the steady state needs the pump pumping in it (an error otherwise); the best efficiency point is the largest efficiency over the range of the efficiency data (its fitted curve), or of the curve of power through ρg·Q·H₁/P₁; the given and the best efficiency references need the rated speed. Without a curve of power the scale of the torque stays 1 and the torque has no value, which only a trip or a start would need. With the four-quadrant data a pump off and closed takes a table of its speed from 0 % (a start with a known speed), shut until its head at no flow overcomes the difference across it; without them only its start by the motor. The log keeps the first reversal of the flow and of the speed, the results the reference point and the two scales, and the warning that a pump goes past its curve is not given, since the periodic table has no end.

**W-54 Dynamic check valves at work.** The swinging and the sliding discs take the quadratic loss of the valve fully open, k·ṁ|ṁ| (a K without the laminar correction of the steady state, which would make the loss linear as the flow through a nearly closed disc vanishes), over the square of the fraction of its Cv, as §1.2 of the addendum writes k(θ) = k_open/c(θ)². The torque of the liquid grows so fast as a disc nears its seat that the function of the trapezoid rule may turn back there, with two roots below the position before; the position of each step is the root that the protected Newton of W-24 finds from the position of the step before, over the whole line (the table keeping its end values past the stops), which continues the motion and gives the closure of case T26. The deceleration model rounds τ_d/Δt half up, measures again at every new reversal (the flow forward again re-arms it), ignores the closing velocity of the valve of phase G1 and keeps its reopening difference. A disc starts at its seat when the steady state has the valve closed. The log keeps the inversion with a_d and V_R, and the moments a disc leaves and reaches its full opening; its angle or travel and the torque or force on it join the results.

**W-55 Unsteady friction of Brunone at work.** The term follows the characteristic form of §1.4 of the addendum, with the flows of step k−2 kept in arrays of their own (the test step does not move them). A flow within 10⁻¹² of the scale of the flows of its pipe counts as zero: the flow at a dead end carries the rounding of the pressure there, and its sign would choose between D⁺ and D⁻ where the addendum takes their mean (case T28 depends on it). With the coefficient k = 0 the run is that of the friction of the steady state, bit for bit. The coefficient of each pipe comes from the Reynolds number of its steady flow over its hydraulic diameter, the laminar value below the flow of W-04, unless the pipe gives it.

**W-56 Gas cavities at work.** A free node with one pipe holds the gas of its end at that station, with the junction side at the pressure of the station less its elevation and the loss of the end of the pipe at the flow of the junction side; with several pipes, at the node, on the stagnation basis, with the half sections of all its ends. Without discharges and losses the pressure is the stable root of the quadratic of the addendum, otherwise a scalar root on the volume of the gas (`gasRoot`). The protection devices and the fixed pressures hold no gas (the relief valve and the air valve keep the vapour cavities of their nodes), and the sides of the two-port elements keep the vapour cavities, as §1.5 says. A steady pressure not above the vapour pressure stops the run with an error. The volume of the gas takes the place of that of the vapour in the series and the envelopes, with a warning above 10 % of the volume of a section (as W-17); there are no cavitation entries in the log, since every station always holds gas.

**W-57 Unbalanced forces at work.** Between two pipes a segment takes the path with the fewest pipes, as the profile does; between paths of the same length, it leaves the first pipe by its down end before its up end, and enters the second by its up end before its down end. Along the path the force is summed pipe by pipe, the pair of terms of the ends of each piece with the flows on its side, which gives the terms of the junctions in line of §1.6. The friction of a section takes its R, or with the friction that varies that of its station on the up side of the pipe, and not the term of Brunone, which §1.6 leaves out. An exit takes the flow that leaves the last station. The force of every set is calculated at every step for its extremes and recorded with the series; its unit category is `force` (kN, N, lbf).

**W-58 Friction that varies with a given friction factor.** A run with the friction that varies stopped with an error when a pipe had a given friction factor or none, which keeps the R of the steady state: the update of the friction after each step now skips such pipes (a defect of phase G2, found with case T28).

**W-59 Hint of the start of a pump.** The texts of the junction held the hint of the start of a pump and that of the start of a table under one key, so the inspector showed the second for both; the start of a pump has its own key now.

## Performance

The target of §9.5 is 200 pipes, 4 000 stations and 20 000 steps in less than 10 s in a current browser. A grid of 201 pipes and 4 198 stations, closing its outlet in 1 s, takes 1.1 to 1.3 s for 2 000 steps in Node (main context, a desktop processor of 2017): 11 to 13 s for 20 000 steps. A current processor should reach the target; this one does not quite. Phase G2 left these times as they were. The friction that varies costs more: the same grid with pipes of 0.05 mm of roughness takes 2.6 s for 2 000 steps with it, against 1.0 to 1.3 s with the friction of the steady state, since most stations take their friction again in most steps of that run. The run goes in slices of 30 ms in the browser, so the page keeps answering, and the system window shows an estimate of the time from the stations and the steps. Phase G3 left the loops of phases G1 and G2 as they were (the grid gives the same numbers, bit for bit); the unsteady friction of Brunone and the gas cavities take a general loop of their own over the inner stations.

## Tests

`node tests/surge.test.cjs` checks the cases of §12 and of the addendum with the values of the specification team. For phases G1 and G2: the wave speeds of §3 (T1), the sectioning (T2), an instantaneous closure without and with friction (T3, T4), the linear closure of an exit valve (T5), the wave transmitted at a tee (T6), column separation with vapour cavities, ψ = 0.5 and 1 (T7), the trip of a pump by its inertia without reverse flow (T8), the mass oscillation of a surge tank (T9, W-48), an air vessel (T10), an infinite pipe (T11), the steady state holding in every example (T12), a closure started by an event (T13), the envelopes and extremes of every station (T14), a relief valve (T15), the air flows of an air valve, sonic and subsonic, in and out (T16), the same results twice, bit for bit, at once and in slices (T17), and a child scenario (T18).

Then what the specification asks without values of its own: the orifice, the riser, the one-way check and the top of a surge tank; a finite reservoir whose volume follows its flows exactly, whose net flow at 0 s is that of the steady state, and which says why it cannot start with a pipe end uncovered; an air valve against a plain node on a line whose flow stops at once; the friction that varies, which holds the steady state and then decays differently; the checklists of the devices; the module off by default, the repair of a damaged control and the checklist.

The two parts of phase G3 done before its addendum are also checked against what they must do. The rate limit of a control valve (W-49): a speed never reached gives the ideal valve bit for bit, its opening included; the opening starts from the Cv of the steady state, never moves faster than its speed and moves at it while it lags; a frozen valve does not change; the checklist. The start of a pump (W-50): against a pressure it cannot overcome its flow stays zero and, with a motor of constant torque, its speed follows tanh(a·t/(I·ω_r)) within 10⁻⁶; a start that pumps opens its check valve once its head at no flow passes the pressure against it, ends where the torque of the motor meets that of the pump, and with the flow of the steady state at that speed; nothing moves before a later start; a speed past the table of the motor gives a caution; the checklist.

Then the cases of the addendum, with the values of its team: the largest speed of a control valve without a limit, at 3 %/s and at 10 %/s (T19); the start of a pump by the torque of its motor that overcomes the pressure against it (T20) and one that does not (T21); the trip of a pump in four quadrants with the reference of its steady state, through the reversal of its flow and of its speed (T22), and its start with a given reference (T23); the instantaneous check valve (T24), the one by deceleration (T25), the swinging disc (T26) and the sliding disc (T27), each equal to the instantaneous one until it leaves its stop; the unsteady friction of Brunone, equal to T4 bit for bit with k = 0 (T28); the gas cavities with ψ = 0.95 and 1 (T29); the forces of a segment, a point and an exit (T30); and the steady state holding with all of them (T31). Their checklists close the file.
