// Water hammer: its control in the system window, the wave of a pipe, the time data of a junction, its run and its results.
PumpIt.i18n.add('en', {
  surge: {
    states: {
      open: 'open', closed: 'closed', control: 'controlling', run: 'pumping', shut: 'held by its check valve',
      normal: 'normal', full: 'full', empty: 'empty', admit: 'letting air in', expel: 'letting air out', hold: 'holding air',
    },
    error: {
      steady: 'Water hammer: the steady state did not calculate ({message}).',
      steadyNotConverged: 'Water hammer: the steady state did not converge, so the transient cannot start from it.',
      noPipes: 'Water hammer: no open pipe carries the transient.',
      waveSpeed: 'Water hammer: pipe P{id} has no wave speed.',
      timeStep: 'Water hammer: no time step could be found for the pipes.',
      boundary: 'Water hammer: junction J{id} could not be prepared ({message}).',
      data: 'Water hammer: the data of junction J{id} could not be prepared ({message}).',
      artificial: 'Water hammer stopped: the test step from the steady state moved the network by more than {criterion} % (an artificial transient). See the warnings.',
      notFinite: 'Water hammer stopped at {t} s: a value of the network is no longer a number.',
      infiniteSections: 'the infinite pipe needs at least 2 sections in pipe P{pid}',
      tankUncovered: 'its finite tank starts with the end of pipe P{pid} uncovered, with the liquid level not above it, while the steady state draws liquid through it: raise the liquid level above the pipe',
      vesselGas: 'the gas of the air vessel has no volume or no pressure in the steady state',
      vesselTooSmall: 'the gas of the steady state does not fit in the vessel',
      gasSteady: 'Water hammer: pipe P{id} is not above the vapour pressure at station {i} in the steady state, so it cannot hold the free gas of the gas cavities.',
      gasNode: 'its steady pressure is not above the vapour pressure, so it cannot hold the free gas of the gas cavities',
      force: 'Water hammer: the force set {name} is not complete (its pipes, its distances and a path between its stations).',
      forcePipe: 'Water hammer: pipe P{id} of the force set {name} takes no part in the transient (closed or isolated).',
      fourTable: 'its four-quadrant table is not complete',
      fourSteady: 'the reference point of the steady state needs the pump pumping in the steady state',
      fourBep: 'the best efficiency point could not be found from the curves of the pump',
      fourRef: 'the reference point of the four-quadrant data needs a flow, a head and a speed above zero',
      fourScale: 'its four-quadrant table does not meet its steady state (the head or the torque of the table there is zero or of the other sign)',
    },
    warn: {
      notRefined: 'The steady state could not be refined to a relative tolerance of 10⁻¹⁰; the transient starts from it as it was.',
      zeroFlow: 'Pipe P{id} carries no steady flow: its friction in the transient is that of fully turbulent flow in its roughness.',
      frozenNegative: 'Control valve J{id} added pressure in the steady state; frozen, it is taken without loss.',
      pumpSpeedUnknown: 'Pump J{id}: the speed of its control in the steady state is unknown; the transient takes its typed speed.',
      pumpSpeedIteration: 'Pump J{id}: the speed did not settle at {t} s (50 iterations); the run goes on with the last value.',
      pumpBeyondCurve: 'Pump J{id} goes past the end of its curve from {t} s on (its four-quadrant data, in the water hammer section of the pump, cover every flow and speed).',
      motorBeyond: 'Pump J{id}: its speed passes the last point of the table of its motor at {t} s; from there the motor keeps the last torque of the table.',
      bigGas: 'Pipe P{id}: its free gas passes 10 % of the volume of a section at station {i} from {t} s on; the discrete gas cavity model loses accuracy.',
      bigGasJunction: 'Junction J{id}: its free gas passes 10 % of the volume of a section next to it from {t} s on; the discrete gas cavity model loses accuracy.',
      fourScale: 'Pump J{id}: its four-quadrant table is scaled by c_H = {cH} and c_B = {cB} to meet its steady state; beyond 5 % the table and the curves of the pump disagree.',
      decelRange: 'Check valve J{id}: the deceleration of {ad} m/s² at {t} s is outside its table; the valve takes the end value of the table.',
      discNotOpen: 'Check valve J{id}: the pressure difference of the steady state does not hold its disc fully open, so the disc moves from the first step (an artificial transient).',
      root: 'Junction J{id}: an equation of its boundary did not converge at {t} s; the step goes on with the last value.',
      bigCavity: 'Pipe P{id}: a vapour cavity above 10 % of the volume of its section from {t} s on; the discrete cavity model loses accuracy.',
      cavityPipe: 'Pipe P{id} cavitates from {t} s on.',
      cavityJunction: 'Junction J{id} cavitates from {t} s on.',
      belowVapor: 'Pipe P{id} goes below the vapour pressure at {t} s (station {i}); without a cavitation model the pressures that follow are not physical.',
      variance: 'The sectioning did not reach the variance limit of {limit} %: the largest adjustment of a wave speed is {worst} %.',
      thickWall: 'Pipe P{id}: a wall thicker than D/25; the thick wall supports suit it better.',
      shortDuration: 'The duration is shorter than 4·L/a of the longest pipe ({t} s): the response of a pipe takes at least that.',
      manySections: 'A pipe has {n} sections: the time step is very short for the longer pipes. Check the shortest pipe or give its wave speed.',
      noVapor: 'The fluid has no vapour pressure: the run goes without the cavitation model.',
      fluidKRange: 'The temperature of the water ({T} °C) is outside the range of the correlation of its sound speed ({min}–{max} °C).',
      memory: 'The recorded series take about {mb} MB. Record every N steps, or fewer stations.',
      artificial: 'Artificial transient: the test step from the steady state moved stations by more than {criterion} %: {list}.',
      artificialItem: 'P{id} station {i} ({what} {pct} %)',
      artificialWhat: { P: 'pressure', m: 'flow' },
      pMax: 'Pipe P{id} goes above its maximum pressure at station {i}: {p} kPa(g) at {t} s, against {lim} kPa(g).',
      tankAboveTop: 'Surge tank J{id}: the level of the steady state is above its top, so it starts full.',
      tankBelowBottom: 'Surge tank J{id}: the level of the steady state is below its bottom, so it starts empty.',
      tankFull: 'Tank J{id} overflows at its top from {t} s on.',
      tankEmpty: 'Tank J{id} runs empty from {t} s on.',
      vesselBelowMin: 'Air vessel J{id}: the gas of the steady state is below its smallest volume.',
      vesselEmpty: 'Air vessel J{id}: its gas fills the vessel at {t} s, no liquid is left in it.',
      vesselFull: 'Air vessel J{id}: its gas reaches its smallest volume at {t} s, and it takes no more liquid.',
      reliefSteady: 'Relief valve J{id}: the pressure of the steady state is already above its set pressure, so it opens as the run starts.',
      bigAir: 'Air valve J{id}: its air is larger than the volume of a section next to it from {t} s on; the model of air held at a point loses accuracy.',
      infiniteCavity: 'The infinite pipe of junction J{id} goes below the vapour pressure at {t} s; its end does not cavitate.',
    },
    log: {
      cavityPipe: 'first cavity in pipe P{id}',
      cavityJunction: 'first cavity at junction J{id}',
      cavitiesAtEnd: 'cavities remain at the end of the run',
      cavitiesEnded: 'the last cavity of the network collapsed',
      tableStarted: 'table {n} started by its event',
      tableResumed: 'table {n} started at {tau} s, where it takes the value in use',
      pumpTrip: 'pump tripped: the torque of its motor is gone',
      pumpStart: 'pump started: its motor gives the torque of its table',
      pumpFlowReversed: 'the flow through the pump goes back for the first time',
      pumpSpeedReversed: 'the pump turns backwards for the first time',
      checkDecel: 'the flow reverses with a deceleration of {ad} m/s²: the valve closes at a reverse velocity of {VR} m/s',
      discLeaves: 'the disc leaves its full opening',
      discFull: 'the disc is back at its full opening',
      state: 'changes from {from} to {to}',
    },
    stamp: {
      label: 'Water hammer',
      running: 'Water hammer · {pct} %',
      title: 'Water hammer: click to open its control in the system properties',
    },
    bar: {
      aria: 'Time cursor of the water hammer',
      label: 'Water hammer',
      first: 'First recorded time',
      prev: 'Previous recorded time',
      play: 'Play the recorded times',
      pause: 'Pause',
      next: 'Next recorded time',
      last: 'Last recorded time',
      slider: 'Time of the water hammer shown',
      cancel: 'Stop the water hammer (what was calculated stays)',
      stopped: 'stopped at {t}',
      cancelled: 'stopped by you at {t}',
    },
    system: {
      title: 'Water hammer',
      hint: 'The transient of a liquid network after a fast change: a valve closing, a pump tripping, a level or a pressure changing. It starts from the steady state of the scenario and is solved by the method of characteristics. It runs only while it is on.',
      on: 'Calculate the water hammer',
      onHint: 'On, the water hammer runs after the steady state at every change, and the time simulation goes off (the two do not run together). Off, its data stay in the model and are not used.',
      off: 'Off: the model calculates the steady state only. Turn it on when a fast change may cause a water hammer.',
      duration: 'Duration',
      durationHint: 'How long the transient is followed from 0 s, the steady state. Cover at least a few times 2·L/a of the longest pipe.',
      dtMode: 'Time step',
      dtModes: { auto: 'Automatic', given: 'Given' },
      dtModeHint: 'Automatic: the step that fits a whole number of sections in every pipe, adjusting each wave speed by no more than the variance limit. Given: the step you type; each pipe takes the nearest whole number of sections.',
      dt: 'Time step',
      varianceMax: 'Variance limit',
      varianceHint: 'The largest adjustment of the wave speed of a pipe, so that its sections fit the common time step.',
      ncMax: 'Most sections of the controlling pipe',
      ncMaxHint: 'The search tries from the fewest to this number of sections, in steps of 0.05, in the pipe with the shortest travel time L/a.',
      ncMin: 'Fewest sections of the controlling pipe',
      cavitation: 'Cavitation',
      cavitations: { dvcm: 'Vapour cavities', dgcm: 'Gas cavities', none: 'None' },
      cavitationHint: {
        dvcm: 'Discrete vapour cavities: a station whose pressure falls to the vapour pressure stays there and opens a cavity, which grows and collapses with the flows around it. The collapse gives the pressure peaks.',
        dgcm: 'Discrete gas cavities: every station holds a small mass of free gas, which grows as the pressure falls, at constant temperature. The pressure never reaches the vapour pressure, and the collapses are softer than with vapour cavities. The usual weight ψ is 0.95, which this choice takes while ψ is at 0.5.',
        none: 'No model: the pressure may fall below the vapour pressure. A warning tells where and when; the pressures that follow are not physical.',
      },
      friction: 'Friction',
      frictions: { steady: 'Of the steady state (quasi-steady)', variable: 'Varying with the Reynolds number', brunone: 'Varying, with the unsteady term of Brunone' },
      frictionHint: 'Of the steady state: each pipe keeps the friction coefficient of its steady flow. Varying: each station takes the friction factor of its flow again, by the correlation of the steady state, whenever its velocity changes by more than 1 %; the losses of the fittings stay those of the steady state. With Brunone, the varying friction also takes a term from the acceleration of the liquid, (ρ·k/2)·(∂V/∂t + a·sign(V)·|∂V/∂x|), which damps the waves as measurements do; k comes from the Reynolds number of the steady flow of each pipe, or the pipe gives it.',
      saveEvery: 'Record every N steps',
      saveEveryHint: 'The stations are recorded every N steps, the first and the last always. The largest and smallest values cover every step.',
      stations: 'Output stations',
      stationsOf: { ends: 'The ends of each pipe', all: 'Every station' },
      stationsHint: 'The stations whose pressures and flows are recorded over time. A pipe can choose its own. The envelopes cover every station either way.',
      fluidK: 'Bulk modulus of the liquid',
      fluidKSource: 'from the sound speed of water at the temperature of the model',
      fluidKHint: 'The bulk modulus K of the liquid, which sets the wave speed together with the elasticity of the pipe wall. Water has about 2.2 GPa.',
      advanced: 'Water hammer: advanced',
      advancedHint: 'Options of the method that rarely need a change.',
      psi: 'Weight ψ of the cavities',
      psiHint: 'The volume of a cavity takes the flows of the new step with the weight ψ and those of the step before with 1 − ψ, from 0.5 to 1. The usual value is 0.5.',
      cavBasis: 'Cavities compare',
      cavBases: { stagnation: 'The stagnation pressure', static: 'The static pressure' },
      cavBasisHint: 'The pressure of a station that is compared with the vapour pressure to open a cavity.',
      alpha0: 'Void fraction of the free gas',
      alpha0Hint: 'The fraction of the volume of the liquid taken by free gas at the pressure below, the same in the whole network. 10⁻⁷ is a usual value.',
      p0: 'Pressure of the void fraction',
      p0Hint: 'The absolute pressure at which the void fraction above holds: 1 atm by default.',
      criterion: 'Artificial transient: criterion',
      criterionHint: 'Before the run, one step with nothing changing must keep every station within this percentage of its steady pressure and flow. A larger change means that the steady state and the model of the transient disagree (an artificial transient).',
      minFlow: 'Artificial transient: smallest flow checked',
      stop: 'Stop the run on an artificial transient',
      sectioning: 'Sections and time step',
      sectioningHint: 'Each pipe is cut into a whole number of sections that the wave crosses in one time step. Click a row to go to its pipe.',
      noWave: 'Give the wave speed of {pipes} to see the sections.',
      noSectioning: 'Complete the model and its steady state to see the sections.',
      controller: 'controls',
      cols: { pipe: 'Pipe', L: 'Length (m)', a: 'Wave speed (m/s)', n: 'Sections', aAdj: 'Adjusted (m/s)', variance: 'Variance (%)', R: 'R (Pa·s²/kg²)' },
      dtValue: 'Time step',
      stationsTotal: 'Stations',
      steps: 'Steps',
      estimate: 'Size of the run',
      estimateValue: '{work} station-steps, about {s} s',
      limitNotMet: 'No time step reached the variance limit of {limit} %: the largest adjustment is {worst} %. Raise the limit or the number of sections, or give the wave speeds.',
      summary: '{duration} · cavitation: {cavitation}',
      forces: 'Unbalanced forces',
      forcesHint: 'The axial force of the liquid on the pipes over time, for the design of their supports: on a segment between two stations (the bends at its ends and the straight run between them), at a station, or at an exit. It comes from the balance of momentum: the static pressure over the ambient times the area and the flow of momentum at the ends, with the friction along the way.',
      forceName: 'Name',
      forceKind: 'Kind',
      forceKinds: { segment: 'Segment between two stations', point: 'At a station', exit: 'Exit to the outside' },
      forceKindHint: 'Segment: the force on the bends at its two ends and the straight run between them, positive from the first station to the second, zero in a steady state on a horizontal path; between pipes it follows the path with the fewest pipes. At a station: (p − p_amb)·A + ṁ²/(ρA), in the direction of the pipe. Exit: the segment up to the end of the pipe that discharges, less the momentum of the jet.',
      forcePipe: 'Pipe',
      forceFrom: 'From pipe',
      forceTo: 'To pipe',
      forceExit: 'Pipe that discharges',
      forceX: 'Distance from its start',
      forceAt: 'Station taken',
      forceStation: 'station {i} of {n} · {x} m',
      forceAs: 'Area of the jet (empty: that of the pipe)',
      forceAmbient: 'Ambient pressure',
      ambients: { atm: 'Atmospheric', given: 'Given' },
      forcePamb: 'Ambient pressure given',
      forceBad: {
        set: 'An incomplete set.', kind: 'Choose its kind.', pipe: 'Choose open pipes.', distance: 'Give distances within the pipes.',
        path: 'No path of open pipes joins the two pipes.', ambient: 'Give the ambient pressure.', area: 'The area of the jet must be above zero.',
      },
      forceRemove: 'Remove this force set',
      forceAdd: 'Add a force set',
    },
    pipe: {
      title: 'Water hammer wave',
      hint: 'The speed of the pressure waves in this pipe, calculated from the liquid and the wall or given, and the sections it takes in the run.',
      closed: 'A closed pipe takes no part in the water hammer.',
      wave: 'Wave speed',
      waves: { calculated: 'Calculated from the wall', given: 'Given' },
      a: 'Wave speed',
      support: 'How the pipe is held',
      supports: {
        thinAnchored: 'Thin wall, anchored along its length',
        thinUp: 'Thin wall, anchored at the upstream end only',
        thinJoints: 'Thin wall, with expansion joints',
        thickAnchored: 'Thick wall, anchored along its length',
        thickUp: 'Thick wall, anchored at the upstream end only',
        thickJoints: 'Thick wall, with expansion joints',
        tunnelUnlined: 'Tunnel in rock, unlined',
        tunnelLined: 'Tunnel in rock, lined with steel',
        buried: 'Buried, by an estimated increase',
        user: 'Coefficient c₁ given',
      },
      supportHint: 'How the pipe is held sets the coefficient c₁ of the formula of the wave speed. The thin wall formulas suit a diameter above about 25 times the wall.',
      E: 'Modulus of elasticity',
      EHint: 'Of the wall material. Empty, it takes the typical value of the material of the catalogue, shown in grey.',
      nu: "Poisson's ratio",
      wall: 'Wall thickness',
      wallHint: 'Empty, it takes the wall of the catalogue size, shown in grey; a lining is not counted.',
      typical: 'Fill E and ν with a typical material…',
      typicalLabel: 'Typical values',
      materials: { carbonSteel: 'Carbon steel', stainless: 'Stainless steel', ductileIron: 'Ductile iron', hdpe: 'HDPE (short load, 20 °C)', pvc: 'PVC', copper: 'Copper', concrete: 'Concrete' },
      fromCatalog: 'Empty fields take the values of {material} and the wall of the catalogue.',
      G: 'Rigidity modulus of the rock',
      GHint: 'The modulus of rigidity (shear modulus) G of the rock around the tunnel.',
      buriedPct: 'Increase over the anchored pipe',
      buriedHint: 'A buried pipe is stiffer than one in the open: its wave speed is that of a thin wall anchored along its length, raised by this percentage.',
      c1: 'Coefficient c₁',
      aCalc: 'Wave speed a',
      plastic: 'The modulus of a plastic depends on its temperature and on how long the load lasts: check the value for a fast transient.',
      thick: 'The wall is thicker than a 25th of the diameter: a thick wall option suits it better.',
      sections: 'In the run',
      sectionsValue: '{n} sections · {a} m/s · variance {v} %',
      stations: 'Output stations',
      stationsOf: { default: 'As in the system', ends: 'The two ends', all: 'Every station' },
      stationsHint: 'The stations of this pipe whose pressures and flows are recorded over time.',
      pMax: 'Maximum pressure',
      pMaxHint: 'Optional: the largest pressure the pipe stands. A run that goes above it gives a warning with the station and the time.',
      k: 'Coefficient k of Brunone',
      kHint: 'Optional: the coefficient of the unsteady friction of this pipe. Empty, it comes from the Reynolds number of its steady flow, k = √C*/2 by Vardy and Brown, and a pipe without a steady flow takes the laminar value.',
      kAuto: 'from the Reynolds number',
    },
    junction: {
      title: 'Water hammer',
      hint: 'What this junction does in the water hammer: a table of one of its quantities over time, or the trip or the start of a pump. These data are kept apart from those of the time simulation.',
      add: { table: 'Add a table ({what})', trip: 'Add a trip of the pump', start: 'Add a start of the pump' },
      whats: {
        Q: 'Flow', source: 'Source flow', P: 'Pressure', level: 'Liquid level', surfP: 'Surface pressure', speed: 'Speed',
        set: 'Set point', K: 'K', Cv: 'Cv', Kv: 'Kv', area: 'Effective area (Cd·A)', pMax: 'Relief pressure', open: 'Opening',
        ratio: 'Pressure ratio', T: 'Gas temperature', trip: 'Trip of the pump', start: 'Start of the pump',
      },
      use: 'Use these data',
      what: 'Quantity',
      whatGone: 'The quantity of these data does not fit the current mode of the junction: choose another one.',
      event: 'Event {n}',
      eventOne: 'Event',
      combinedNone: 'The model has no events yet: add them in the system window, below the water hammer.',
      combined: 'Event of the model',
      tripStart: 'The trip happens',
      tripStarts: { time: 'At a time', single: 'At an event', combined: 'At an event of the model' },
      tripHint: 'From the trip on, the motor gives no torque: the pump slows down by its inertia and, without its four-quadrant data, lets no flow back. The step that reaches the time of the trip, or where its event fires, trips it; the torque is gone from the next step on.',
      tripAt: 'Time of the trip',
      startWhen: 'The start happens',
      startPumpHint: 'From the start on, the motor gives the torque of its table: the pump speeds up by its inertia, held by its check valve until its head overcomes the pressure against it, and without its four-quadrant data lets no flow back. The step that reaches the time of the start, or where its event fires, starts it; the torque is there from the next step on.',
      startAt: 'Time of the start',
      basis: 'Values',
      start: 'Start',
      startHint: 'By the clock, the time of the table is the time of the run. After an event, it counts from the step where the event fired, and the table applies from the next step on.',
      remove: 'Remove the water hammer data',
      pump: {
        notCurve: 'A table of speed or a trip needs the pump running on its curve, and a start the pump on its curve, off and closed (its mode and state, above). The four-quadrant data serve any pump with a curve.',
        inertia: 'Moment of inertia',
        inertiaHint: 'Of the pump, the motor and the shaft together, with the liquid in the impeller. The larger it is, the slower the pump stops after a trip, or gets up to speed after a start.',
        rpm: 'Rated speed',
        power: 'Shaft power at the rated speed',
        powerY: 'Power',
        powerFromEff: 'Without a curve of power, a trip or a start takes the shaft power from the curves of head and efficiency.',
        addPower: 'Add a curve of power',
        motor: 'Torque of the motor',
        motorHint: 'The torque of the motor against its speed, from its data sheet: the starting torque at 0 %, usually a peak near the rated speed, and zero at the synchronous speed. Between points it goes in straight lines; past the last point it keeps the last torque.',
        motorSpeed: 'Speed (% of the rated)',
        motorTorque: 'Torque',
        four: 'Four-quadrant data',
        fourHint: 'The head and the torque of the pump in every quadrant, from its curves of Suter WH(θ) and WB(θ), which its maker gives. With them a trip or a start lets the flow and the speed go back (only a check valve of the pump holds the flow), and a pump off and closed may start by a table of its speed. Pump It holds no published table: the data are yours.',
        fourRef: 'Reference point',
        fourRefs: { steady: 'The steady state of the pump', bep: 'Its best efficiency at the rated speed', user: 'Given' },
        fourRefHint: 'The point that gives the table its dimensions: Q_R, H_R, the torque T_R and N_R. The steady state of the pump needs it running. The table is scaled to meet the steady state, with a caution beyond 5 %.',
        fourQ: 'Flow Q_R (per pump)',
        fourH: 'Head H_R',
        fourN: 'Speed N_R',
        fourP: 'Shaft power P_R',
        fourTable: 'Curves of Suter',
        fourTheta: 'θ (°)',
        fourTableHint: 'WH = h/(α² + v²) and WB = β/(α² + v²) against θ = π + atan2(v, α), with α = N/N_R, v = Q/Q_R, h = H/H_R and β = T/T_R: from 0 to 360°, at least 9 points, the values at 360° those of 0°. Between points they go in straight lines.',
        fourReverse: 'Without a check valve of its own (in its data of the steady state), the flow and the speed may go back in the transient.',
      },
      control: {
        mode: 'In the water hammer',
        modes: { frozen: 'Frozen at its steady loss', ideal: 'Controlling at every step' },
        hint: 'Frozen: the valve keeps the loss of the steady state, as a fixed valve. Controlling: it holds its set point at every step, as an ideal controller would, and a table can change the set point.',
        rate: 'Largest speed of the opening',
        rateHint: 'Optional, in % of the full opening per second, opening and closing: the valve follows the opening its control asks for no faster than this, and while it lags it is a fixed valve at the opening it reached. It needs the characteristic of the valve (above). Empty: no limit.',
      },
      check: {
        model: 'Model in the water hammer',
        models: { none: 'Instantaneous', decel: 'By deceleration', swing: 'Swinging disc with its inertia', nozzle: 'Sliding disc' },
        modelHints: {
          none: 'The valve of the steady state: it closes in the step where the velocity at its inlet falls below its closing velocity, and opens again when the pressure difference reaches its reopening difference.',
          decel: 'From a table of the valve: the reverse velocity at which it closes against the deceleration of the liquid when the flow reverses. Until then it stays open with the reverse flow.',
          swing: 'A disc on a hinge, moved by the pressure across it, its weight, and an optional counterweight, spring and damper: the valve closes when the disc reaches its seat, and its loss follows the fraction of the Cv at its angle.',
          nozzle: 'A disc that slides along the axis against a spring: the valve closes when the disc reaches its seat, and its loss follows the fraction of the Cv at its travel.',
        },
        quadratic: 'The dynamic models need a quadratic loss fully open: K, Cv or Kv (the loss of the valve, above).',
        decel: 'Reverse velocity at closure',
        decelAd: 'Deceleration',
        decelVR: 'Reverse velocity',
        decelHint: 'From the data sheet of the valve: the reverse velocity of the liquid at which it closes, against the deceleration of the flow. Between points in straight lines; outside the table its end values, with a caution.',
        window: 'Window of the deceleration',
        windowHint: 'When the flow reverses, the deceleration is the slope of the velocity over the steps of this last stretch of time, by least squares. 0.1 s by default.',
        fields: {
          thetaMax: 'Angle fully open', seat: 'Inclination of the seat', I: 'Moment of inertia', md: 'Mass of the disc and its arm', rcg: 'Distance from the hinge to the centre of mass',
          Ad: 'Area of the disc', rp: 'Arm of the pressure force', Ts0: 'Torque of the spring when closed', ks: 'Stiffness of the spring', c: 'Damping', Wc: 'Weight of the counterweight',
          rc: 'Arm of the counterweight', delta: 'Angle of the counterweight to the arm', xMax: 'Travel fully open', m: 'Mass of the disc', F0: 'Force of the spring when closed',
          k: 'Stiffness of the spring', cLinear: 'Damping', mf: 'Mass of the liquid displaced', rhoM: 'Density of the material of the disc', phi: 'Angle of the valve',
        },
        hints: {
          thetaMax: 'From the seat (0) to the stop of the disc fully open.',
          seat: 'The inclination of the seat: with the position of the valve it sets how the weight of the disc closes it.',
          I: 'Of the disc, its arm and the counterweight around the hinge, with the liquid it drags if you count it.',
          rcg: 'The weight of the disc and its arm acts at this distance from the hinge.',
          Ad: 'Empty: the area of the inlet pipe.',
          rp: 'Where the pressure difference acts on the disc. Empty: at the centre of mass.',
          Ts0: 'Optional (empty: no spring): the torque of the spring at the seat, which grows with the angle by its stiffness.',
          c: 'Optional (empty: none): a resistance against the speed of the disc.',
          Wc: 'Optional (empty: none), with its arm and its angle to the arm of the disc.',
          xMax: 'From the seat to the stop of the disc fully open.',
          m: 'Of the disc that moves: its inertia and its weight.',
          F0: 'Optional (empty: no spring): the force of the spring at the seat, which grows with the travel by its stiffness.',
        },
        fluidMass: 'Buoyancy',
        fluidMasses: { none: 'None', user: 'A mass of liquid given', calculated: 'From the density of the disc' },
        fluidMassHint: 'The liquid the disc displaces takes off part of its weight: m_f = ρ·m/ρ_m with the density of the disc (7850 kg/m³, steel, by default), or a mass you give.',
        orient: 'Position of the valve',
        orients: { horizontal: 'Horizontal', vertical: 'Vertical, the flow going up', angle: 'At an angle' },
        orientHint: 'How the weight of the disc acts: horizontal (0°), vertical with the flow going up (90°) or an angle from −90° to 90°.',
        cvTable: 'Fraction of the Cv',
        cvAngle: 'Angle from the seat',
        cvTravel: 'Travel from the seat',
        cvFrac: 'Fraction of the Cv fully open',
        cvHint: 'From (0, 0 %) at the seat to (fully open, 100 %), in straight lines. The loss at a position is that of the valve fully open over the square of the fraction.',
      },
    },
    // the data of the protection devices and of the special ends, in the water hammer section of a junction
    device: {
      shape: 'Shape',
      shapes: { none: 'No geometry: the gas at the pressure of the node', constant: 'Constant section', table: 'Volume by height' },
      shapeHint: 'The section of the tank, constant or given by a table of volume against the height over its bottom.',
      shapeVesselHint: 'Without a geometry the gas is at the pressure of the node. With one, the level of the liquid in the vessel adds its column to the pressure of the gas.',
      area: 'Section',
      h: 'Height over the bottom',
      V: 'Volume',
      bottom: 'Bottom elevation',
      bottomHint: 'Empty: at the elevation of the junction.',
      height: 'Height up to the top',
      heightHint: 'Above it the tank overflows and its level stays at the top. Optional with a constant section (empty: no top); a table goes up to it.',
      heightVessel: 'Height of the vessel',
      heightVesselHint: 'From its bottom to its top: with the shape it gives the volume of the vessel.',
      oneWay: 'One-way: it only feeds the network',
      oneWayHint: 'A check valve lets the liquid only out of the tank: it feeds the network when the pressure falls, and stays shut while the pressure is above its level.',
      orifice: 'An orifice in the connection',
      orificeHint: 'A loss between the node and the tank or vessel, its own each way: ΔP = ṁ|ṁ|/(2ρ(Cd·A)²).',
      CdAin: 'Cd·A of the flow going in',
      CdAout: 'Cd·A of the flow coming out',
      riser: 'A short riser with its inertia',
      riserHint: 'A short pipe between the node and the tank or vessel, whose column the flow accelerates: (L/A)·dṁ/dt = the pressure of the node − that of the device − its losses.',
      riserL: 'Length of the riser',
      riserD: 'Diameter of the riser',
      riserF: 'Friction factor of the riser',
      n: 'Polytropic exponent n',
      nHint: 'P·Vⁿ stays constant for the gas: 1 for an isothermal gas, 1.4 for air without heat exchange. 1.2 is the usual value.',
      gasInit: 'Gas in the steady state',
      gasInits: { given: 'Its volume', precharge: 'From the pre-charge' },
      gasInitHint: 'The volume of the gas at the pressure of the steady state, or the pre-charge of the vessel (the pressure and volume of its gas before it is filled), from which the volume comes at constant temperature.',
      Vg0: 'Gas volume in the steady state',
      Ppre: 'Pre-charge pressure',
      Vpre: 'Pre-charge volume',
      vol: 'Volume of the vessel',
      volHint: 'Optional: the gas cannot pass it. A vessel whose gas fills it gives a warning, and the node keeps the pressure of the gas.',
      vgMin: 'Smallest gas volume',
      vgMinHint: 'Optional: the vessel takes no more liquid once its gas is down to this volume.',
      mode: 'It opens',
      modes: { pressure: 'With the pressure', instant: 'All at once' },
      modeHint: 'With the pressure: closed, it opens when the pressure of the node passes the set pressure; open, its Cv goes in a straight line from 0 at the closing pressure to the whole at the full opening pressure, and it closes at the closing pressure. All at once: fully open above the set pressure, closed below the closing pressure. A table of its opening in the data below drives it instead, as a pilot valve.',
      Pset: 'Set pressure (it opens)',
      Pfull: 'Full opening pressure',
      Pclose: 'Closing pressure',
      PcloseHint: 'Not above the set pressure. Empty: the set pressure.',
      capacity: 'Capacity fully open',
      capacities: { Cv: 'Cv (US)', Kv: 'Kv (metric)', CdA: 'Cd·A' },
      Pext: 'Outside pressure',
      rate: 'Largest speed of the opening',
      rateHint: 'Optional, in % of the full opening per second, opening and closing. Empty: no limit.',
      avType: 'Type',
      avTypes: { both: 'Lets air in and out', in: 'Lets air in only', out: 'Lets air out only', twoStage: 'In and out, a smaller outlet in a second stage' },
      airIn: 'Cd·A of the air inlet',
      airOut: 'Cd·A of the air outlet',
      airOut2: 'Cd·A of the small outlet',
      switchBy: 'The small outlet takes over',
      switchBys: { dP: 'Above a pressure difference', flow: 'Above an air flow' },
      switchHint: 'While the air goes out, the large outlet shuts and the small one takes over once the difference from the outside, or the air flow, passes this value; it stays until the air is out.',
      switchDP: 'Pressure difference',
      switchFlow: 'Air flow',
      Popen: 'Opening pressure',
      PopenHint: 'The valve lets air in when the pressure of the node falls below it. Empty: the atmospheric pressure.',
      Tair: 'Temperature of the air',
      TairHint: 'Of the air outside and in the valve. Empty: that of the liquid.',
      mAir0: 'Air in the steady state',
      mAir0Hint: 'Air already held at the node when the run starts, usually none.',
      special: 'Its end in the water hammer',
      specials: { none: 'As given (a table may drive it)', infinitePipe: 'An infinite pipe: no reflection' },
      specialHint: 'An infinite pipe lets the waves out of the network at this end, as if the pipe went on without end: the end keeps the characteristic of the steady state. Its tables are not used, and its pipe needs at least 2 sections.',
    },
    overlay: {
      P: 'Water hammer: static pressure at the cursor',
      HGL: 'Water hammer: HGL at the cursor',
      Pmax: 'Water hammer: largest static pressure',
      Pmin: 'Water hammer: smallest static pressure',
      titleP: 'Mean static pressure at the cursor',
      titleHGL: 'Mean HGL at the cursor',
      titlePmax: 'Largest static pressure of the run',
      titlePmin: 'Smallest static pressure of the run',
    },
    charts: {
      tabs: { time: 'Water hammer over time', profile: 'Water hammer envelopes' },
      noRun: 'Turn the water hammer on and complete the checklist to see its charts.',
      object: 'Object',
      stations: 'Stations of pipes',
      junctions: 'Junctions',
      station: '{pipe} · station {i} of {n}',
      quantity: 'Quantity',
      q: { p: 'Static pressure', P0: 'Stagnation pressure', HGL: 'Hydraulic grade line', m: 'Mass flow', Q: 'Volumetric flow', V: 'Vapour volume', Vg: 'Gas volume', F: 'Force' },
      force: 'Force {name}',
      forces: 'Force sets',
      add: 'Add to the chart',
      remove: 'Remove the series',
      choose: 'Choose an object and a quantity, then add them to the chart.',
      unit: 'Unit',
      timeAxis: 'Time (s)',
      cursorNote: 'The marks show the time of the cursor: {t}.',
      pressures: 'Static pressures',
      pathOff: 'The path goes through {pipe}, which takes no part in the water hammer (closed or isolated).',
      hglMax: 'Largest HGL',
      hglMin: 'Smallest HGL',
      pMax: 'Largest static pressure',
      pMin: 'Smallest static pressure',
      steady: 'Steady state',
      atCursor: 'At {t}',
      envelopes: 'Envelopes of the water hammer',
      profileNotes: 'Path: {path} · {length} {u}. The largest and smallest values cover every station and every step; the line at the cursor goes through the output stations. The grade lines use absolute pressure.',
      vaporReached: 'The smallest pressure reaches the vapour pressure in {pipes}.',
    },
    results: {
      tabs: { surge: 'Water hammer', surgeEnv: 'Envelopes', surgeLog: 'Event log' },
      summary: 'Water hammer',
      summaryHint: 'The steady state stays the instant 0 s of the other tables.',
      dt: 'Time step',
      steps: 'Steps',
      recorded: '{n} recorded',
      duration: 'Duration',
      elapsed: 'Calculated in',
      test: 'Test step',
      testOk: 'passed (largest change {p} % in pressure, {m} % in flow)',
      testFailed: 'artificial transient above {criterion} %: see the warnings',
      cavitation: 'Cavitation',
      noModel: 'no model',
      cavitated: '{n} places cavitated, the first at {t}',
      noCavity: 'no cavity',
      gasModel: 'gas cavities: the pressure stays above the vapour pressure (the largest volumes of gas are in the envelopes)',
      stoppedAt: 'Stopped at',
      sectioning: 'Sections',
      sectioningHint: 'Per pipe: length, wave speed, sections, adjusted speed, variance and friction coefficient.',
      junctions: 'Junctions',
      junctionsHint: 'The largest and the smallest value of each quantity, with the first time it is reached.',
      four: {
        QR: 'Four quadrants ({ref}): flow Q_R per pump', HR: 'Four quadrants ({ref}): head H_R', TR: 'Four quadrants ({ref}): torque T_R', NR: 'Four quadrants ({ref}): speed N_R',
        cH: 'Four quadrants: scale c_H of the head', cB: 'Four quadrants: scale c_B of the torque',
        refs: { steady: 'steady state', bep: 'best efficiency', user: 'given' },
      },
      forces: 'Unbalanced forces',
      forcesHint: 'The axial force of each force set: its value in the steady state, the largest and the smallest with the first time, and its swing from peak to peak.',
      envelopes: 'Envelopes of the pipes',
      envelopesHint: 'The largest and smallest static pressure of every pipe over its stations and every step, with where and when. In red: down to the vapour pressure.',
      stations: 'Stations of a pipe',
      pipe: 'Pipe',
      log: 'Event log',
      logHint: 'Events, states of devices and cavities, in the order of time.',
      noEvents: 'Nothing happened besides the transient itself.',
      warnings: 'Water hammer',
      noWarnings: 'The water hammer gave no warning.',
      warningsHint: 'Warnings of the run of the water hammer.',
      kinds: { event: 'event', info: 'info', warning: 'warning' },
      fields: {
        P: 'Pressure', P1: 'Inlet pressure', P2: 'Outlet pressure', net: 'Net mass flow into the network', m: 'Mass flow', s: 'Speed', dH: 'Head', T: 'Torque', V: 'Cavity volume',
        level: 'Level of the liquid', mt: 'Flow into the tank or vessel', Pg: 'Gas pressure', Vg: 'Gas volume', mr: 'Relieved flow', x: 'Opening', Va: 'Air volume', ma: 'Air mass', mair: 'Air flow in',
        th: 'Angle of the disc', Td: 'Torque on the disc', xd: 'Travel of the disc', Fd: 'Force on the disc',
      },
      totals: { over: 'Volume overflowed', deficit: 'Volume missing (empty)' },
      cols: {
        junction: 'Junction', quantity: 'Quantity', max: 'Largest', tmax: 'At', min: 'Smallest', tmin: 'At',
        pipe: 'Pipe', pmax: 'Largest static pressure', pmin: 'Smallest static pressure', station: 'Station', vmax: 'Largest cavity', tV: 'At',
        i: 'Station', x: 'Distance', steady: 'Steady', hglMax: 'Largest HGL', hglMin: 'Smallest HGL',
        time: 'Time', object: 'Object', message: 'What happened',
        P0: 'stagnation pressure', flow: 'mass flow', timeS: 'Time (s)', xm: 'Distance (m)', tmaxS: 'Time of the largest (s)', tminS: 'Time of the smallest (s)',
        hglMaxM: 'Largest HGL (m)', hglMinM: 'Smallest HGL (m)', vmaxL: 'Largest cavity (L)',
        force: 'Force', kind: 'Kind', from: 'From', to: 'To', p2p: 'Peak to peak', vmaxGas: 'Largest volume of gas',
      },
      sheets: { series: 'Water hammer series', envelopes: 'Water hammer envelopes', log: 'Water hammer log' },
    },
    checklist: {
      item: 'Water hammer',
      control: {
        gas: 'the water hammer is for liquids (incompressible regime)',
        time: 'the water hammer and the time simulation do not run together: turn one off',
        duration: 'a duration above zero',
        dtMode: 'automatic or given time step',
        dt: 'a time step above zero',
        variance: 'a variance limit above zero',
        nc: 'ideal sections of the controlling pipe: a minimum above zero and a maximum not below it',
        cavitation: 'a cavitation model',
        vapor: 'the vapour pressure of the fluid (the cavitation model needs it)',
        psi: 'weight ψ of the cavities between 0.5 and 1',
        cavBasis: 'the pressure the cavities compare with',
        friction: 'the friction of the transient',
        criterion: 'a criterion of the artificial transient of 0 or more',
        minFlow: 'a smallest flow of the artificial transient of 0 or more',
        saveEvery: 'record every N steps (a whole number, 1 or more)',
        stations: 'the output stations of the pipes',
        size: 'stations × steps under 2·10⁹ (fewer sections or a shorter run)',
        alpha0: 'a void fraction of the gas cavities above 0 and below 1',
        p0: 'the pressure of the void fraction, above the vapour pressure',
        forces: 'force sets with open pipes of the model, distances within them and a path between their stations',
      },
      pipe: {
        wave: 'water hammer: calculated or given wave speed',
        speed: 'water hammer: a wave speed above zero',
        support: 'water hammer: how the pipe is held',
        circular: 'water hammer: a given wave speed (the calculation needs a circular section)',
        fluidK: 'water hammer: the bulk modulus of the fluid (system properties)',
        E: 'water hammer: the modulus of elasticity of the wall',
        wall: 'water hammer: the thickness of the wall',
        nu: "water hammer: Poisson's ratio from 0 to under 0.5",
        c1: 'water hammer: a coefficient c₁ above zero',
        G: 'water hammer: the rigidity modulus of the rock',
        buriedPct: 'water hammer: the increase of the buried pipe',
        diameter: 'water hammer: the inner diameter',
        stations: 'water hammer: the output stations',
        pMax: 'water hammer: the maximum pressure as a pressure',
        k: 'water hammer: a coefficient of Brunone of 0 or more (empty: from the Reynolds number)',
      },
      data: {
        what: 'water hammer data: a quantity this junction takes',
        tripStart: 'water hammer data: the trip or the start by the clock or at an event',
        tripAt: 'water hammer data: the time of the trip or the start, 0 or later',
        basis: 'water hammer data: absolute or relative values',
        start: 'water hammer data: how the table starts',
        interp: 'water hammer data: interpolation',
        resume: 'water hammer data: where a table starts after its event',
        conditions: 'water hammer data: the condition of each event',
        combined: 'water hammer data: a complete event of the model',
        tables: 'water hammer data: one table per event',
        table: 'water hammer data: tables with numbers and units',
        order: 'water hammer data: table times from 0, never decreasing',
        eventStart: 'water hammer data: a table started by an event begins at time 0',
        period: 'water hammer data: a repeated table needs its last time after the first one',
        negative: 'water hammer data: no negative values',
        relStart: 'water hammer data: a relative table starts at 100 % (the steady value)',
        repeatEnds: 'water hammer data: a repeated table ends with the value it starts with',
        relSpecial: 'water hammer data: no relative table on a junction that its special condition closes',
        specialStart: 'water hammer data: closed by its special condition, the first table starts closed',
        range: 'water hammer data: an opening between 0 and 100 %',
        noSteady: 'water hammer data: a steady value of the quantity of the table',
      },
      pump: {
        mode: 'water hammer: a table or a trip needs the pump running on its curve (with the four-quadrant data a table of speed may also start it from rest)',
        inertia: 'water hammer: the moment of inertia of the pump (trip or start)',
        rpm: 'water hammer: the rated speed of the pump (trip or start)',
        power: 'water hammer: a curve of shaft power or of efficiency (trip or start)',
        startState: 'water hammer: a start needs the pump on its curve, off and closed',
        curve: 'water hammer: the curve of the head of the pump (start)',
        motor: 'water hammer: the table of the torque of the motor, from 0 % with rising speeds and a starting torque above zero (start)',
        fourTable: 'water hammer: a four-quadrant table of θ, WH and WB from 0 to 360°, at least 9 points, the values at 360° those of 0°',
        fourRef: 'water hammer: the reference point of the four-quadrant data',
        fourSteady: 'water hammer: the reference of the steady state needs the pump running',
        fourBep: 'water hammer: a curve of efficiency or of shaft power, for the best efficiency point',
        fourUser: 'water hammer: the flow, the head, the speed and the shaft power of the reference point',
      },
      valve: {
        rate: 'water hammer: a largest speed of the opening above zero',
        char: 'water hammer: the characteristic of the valve, which its largest speed needs',
      },
      check: {
        model: 'water hammer: a model of the check valve',
        loss: 'water hammer: a quadratic loss fully open (K, Cv or Kv) for its dynamic model',
        decel: 'water hammer: a table of the reverse velocity against the deceleration, at least 2 points, the decelerations rising from 0',
        window: 'water hammer: a window of the deceleration above zero',
        disc: 'water hammer: the data of the disc',
        stop: 'water hammer: the full opening of the disc above zero (an angle up to 180°)',
        inertia: 'water hammer: the moment of inertia or the mass of the disc above zero',
        weight: 'water hammer: the mass of the disc and the distance to its centre of mass',
        optional: 'water hammer: the optional fields of the disc as numbers (springs, dampers and weights of 0 or more), or empty',
        cvTable: 'water hammer: a table of the fraction of the Cv from (0, 0 %) to (fully open, 100 %), the positions rising',
        fluidMass: 'water hammer: the buoyancy of the disc',
        orient: 'water hammer: the position of the valve, an angle from −90° to 90°',
      },
      belowVapor: 'water hammer: a fixed pressure above the vapour pressure of the fluid',
      device: {
        area: 'water hammer: the section of the tank',
        table: 'water hammer: a table of volume by height from 0, both rising',
        tableShort: 'water hammer: a table of volume by height up to the top',
        bottom: 'water hammer: the bottom elevation as a length',
        height: 'water hammer: a height above zero',
        orifice: 'water hammer: the Cd·A of the orifice each way',
        riser: 'water hammer: the length, the diameter and the friction factor of the riser',
        n: 'water hammer: a polytropic exponent from 1 to 1.4',
        precharge: 'water hammer: the pressure and the volume of the pre-charge',
        Vg0: 'water hammer: the gas volume of the steady state',
        vol: 'water hammer: the volume of the vessel',
        vgMin: 'water hammer: a smallest gas volume of 0 or more',
        Pset: 'water hammer: the set pressure',
        Pext: 'water hammer: the outside pressure',
        capacity: 'water hammer: the capacity of the valve fully open',
        rate: 'water hammer: a largest speed of the opening above zero',
        Pclose: 'water hammer: a closing pressure not above the set pressure',
        Pfull: 'water hammer: a full opening pressure above the set pressure',
        avType: 'water hammer: the type of the air valve',
        CdAin: 'water hammer: the Cd·A of the air inlet',
        CdAout: 'water hammer: the Cd·A of the air outlet',
        CdAout2: 'water hammer: the Cd·A of the small outlet',
        switch: 'water hammer: when the small outlet takes over',
        Popen: 'water hammer: the opening pressure as a pressure',
        Tair: 'water hammer: the temperature of the air (the fluid has none)',
        mAir0: 'water hammer: the air of the steady state, 0 or more',
      },
    },
  },
  // the chapter of the help (src/ui/help/help.js), with the module
  help: {
    chapters: {
      surge: {
        title: 'Water hammer',
        sections: {
          concept: {
            title: 'How it works',
            body: `<p>A fast change in a liquid network, such as a valve that closes, a pump that trips or a level that jumps, sends pressure waves along the pipes at the speed of sound in the pipe, often around 1000 m/s. The water hammer follows these waves from the steady state of the scenario. It is a module of its own: it calculates only while it is on, and the rest of the program works the same without it.</p>
<ul>
<li>It is for liquids, in the incompressible regime. It and the [[go:time.concept|time simulation]] do not run together: turning one on turns the other off.</li>
<li>The steady state stays as it is in every table, card and chart, and it is the instant 0 s of the water hammer.</li>
<li>After every change the steady state comes at once and the water hammer follows in the background. The stamp [[t:surge.stamp.label]], next to the title of the model, shows its progress; the button beside it stops the run, and what was calculated stays.</li>
</ul>
<p class="tip"><b>When to use it:</b> when something changes in a time comparable with 2·L/a of the pipes, a few seconds for a pipe of some kilometres: a valve that closes quickly, a pump that stops without a flywheel, a check valve that slams.</p>`,
          },
          control: {
            title: 'Control of the run',
            body: `<p>In the [[t:inspector.system.title]] window, section [[t:surge.system.title]]:</p>
<ul>
<li>[[t:surge.system.on]]: turns the module on for the scenario. Off, its data stay in the model and are not used.</li>
<li>[[t:surge.system.duration]]: how long the transient is followed.</li>
<li>[[t:surge.system.dtMode]]: [[t:surge.system.dtModes.auto]] finds the step that fits a whole number of sections in every pipe, adjusting each wave speed by no more than the [[t:surge.system.varianceMax]]; [[t:surge.system.dtModes.given]] takes the step you type.</li>
<li>[[t:surge.system.cavitation]]: [[t:surge.system.cavitations.dvcm]], [[t:surge.system.cavitations.dgcm]] (every station holds a little free gas; choosing them takes ψ to 0.95, and the void fraction and its pressure are in the advanced options), or [[t:surge.system.cavitations.none]].</li>
<li>[[t:surge.system.friction]]: [[t:surge.system.frictions.steady]], [[t:surge.system.frictions.variable]], which takes the friction factor of each station again from its flow, by the correlation of the steady state, when its velocity changes by more than 1 %, or [[t:surge.system.frictions.brunone]], which adds the unsteady friction from the acceleration of the liquid.</li>
<li>[[t:surge.system.saveEvery]] and [[t:surge.system.stations]]: what is recorded over time. The largest and smallest pressures always cover every station and every step.</li>
<li>[[t:surge.system.fluidK]]: for water it comes from its temperature; a fluid of your own needs it.</li>
</ul>
<p>The table [[t:surge.system.sectioning]] shows, for every pipe, its length, wave speed, sections, adjusted speed and variance, and below it the time step, the stations, the steps and an estimate of the time of the run. It follows every change, and a row takes you to its pipe.</p>
<p>The section [[t:surge.system.forces]] holds the force sets: the axial force of the liquid on a segment between two stations, at a station or at an exit, for the design of the supports. Each set shows the station its distance takes, and its force comes in the results and the charts.</p>
<p>The section [[t:surge.system.advanced]] holds the weight ψ of the cavities, the pressure they compare with and the test of the [[go:surge.method|artificial transient]]. Below them come the events of the model, which a table or a trip may start with.</p>
<p>The control belongs to the solution of the scenario, so a [[go:scenarios.concept|child scenario]] can change it, for example to try a slower closing.</p>`,
          },
          wave: {
            title: 'Wave speed of a pipe',
            body: `<p>With the water hammer on, each pipe shows the section [[t:surge.pipe.title]] in the inspector. The wave speed is [[t:surge.pipe.waves.calculated]], from the liquid and the wall:</p>
[[eq:waveSpeed]]
<p>K is the bulk modulus of the liquid, D the inner diameter, e the thickness of the wall and E its modulus of elasticity. The coefficient c₁ follows [[t:surge.pipe.support]], with the Poisson's ratio ν of the wall. For a thin wall:</p>
[[eq:waveC1]]
<p>For a thick wall, with k the term of the thin wall held the same way:</p>
[[eq:waveC1Thick]]
<p>For a tunnel, with G the modulus of rigidity of the rock:</p>
[[eq:waveTunnel]]
<ul>
<li>Empty, E, ν and the wall take the typical values of the material of the catalogue and the wall of its size, shown in grey. [[t:surge.pipe.typical]] fills E and ν with another material.</li>
<li>A buried pipe takes the speed of a thin wall anchored along its length, raised by the percentage you give.</li>
<li>[[t:surge.pipe.waves.given]]: type the speed. It is the only way for a pipe that is not circular.</li>
</ul>
<p>Below, the pipe shows the sections it takes in the run with its adjusted speed and variance, its [[t:surge.pipe.stations]], and an optional [[t:surge.pipe.pMax]], which gives a warning when the run goes above it. With the friction [[t:surge.system.frictions.brunone]] it also takes its [[t:surge.pipe.k]], empty to take it from the Reynolds number of its steady flow.</p>`,
          },
          data: {
            title: 'Data of the junctions',
            body: `<p>With the water hammer on, a junction shows the section [[t:surge.junction.title]] in the inspector, with what drives it in the transient. These data are kept apart from the [[go:time.data|time data]] of the time simulation, so a model keeps both.</p>
<ul>
<li>A table of one of its quantities over time, as in the time simulation: the opening, K, Cv or Kv of a valve; the imposed flow or pressure; the level or the surface pressure of a reservoir; the speed of a pump; the set point of a control valve that is [[t:surge.junction.control.modes.ideal]].</li>
<li>The trip of a pump: from then on its motor gives no torque, and the pump slows down by its inertia. It needs the [[t:surge.junction.pump.inertia]], the [[t:surge.junction.pump.rpm]] and the shaft power at that speed, from a curve of power or from the curves of head and efficiency.</li>
<li>The start of a pump on its curve that is off and closed in the steady state: from then on its motor gives the torque of its table, [[t:surge.junction.pump.motor]], against its speed, and the pump speeds up by its inertia. It needs the same data as a trip and that table.</li>
<li>The [[t:surge.junction.pump.four]] of a pump with a curve: its curves of Suter from its maker, which give the head and the torque in every quadrant. A trip or a start then lets the flow and the speed go back, and a pump off and closed may also start by a table of its speed.</li>
<li>For a check valve, a [[t:surge.junction.check.model]] other than [[t:surge.junction.check.models.none]]: [[t:surge.junction.check.models.decel]] (a table of the valve), [[t:surge.junction.check.models.swing]] or [[t:surge.junction.check.models.nozzle]], with the data of its disc.</li>
</ul>
<p>A table starts by the clock or after an event, with the same editor of conditions as the time simulation; a trip or a start happens at a time or at an event. The events of the model are edited in the system window, below the water hammer.</p>
<ul>
<li>An imposed pressure or flow may be [[t:surge.device.specials.infinitePipe]] ([[t:surge.device.special]]): the waves leave the network there, as if its pipe went on without end. The end keeps the characteristic of the steady state, P = C<sub>E</sub> − B·ṁ with C<sub>E</sub> = P<sub>0</sub> + B·ṁ<sub>0</sub>, and its tables are not used.</li>
<li>A reservoir that is a finite tank (its tank data, as in the [[go:time.tanks|time simulation]]) has its level calculated from the flow that goes in and out, by the trapezoid rule; it overflows at its top, and once empty the liquid it lacks is counted. Only the surface pressure of an open tank takes a table; a closed tank takes the pressure of its gas. Its section in the inspector shows with the water hammer on; the run starts from the level of the steady state, which has to be above the end of a pipe the steady state draws liquid through.</li>
</ul>
<h4>Devices</h4>
<ul>
<li>A check valve closes when the flow would go back, and opens again when the pressure pushes forward; its dynamic models close it by the deceleration of the liquid or by the motion of its disc.</li>
<li>A control valve is [[t:surge.junction.control.modes.frozen]], a fixed valve with the loss of the steady state, or [[t:surge.junction.control.modes.ideal]], holding its set point at every step, with an optional [[t:surge.junction.control.rate]], which needs its characteristic.</li>
<li>A tripped or started pump lets no flow back, as a check valve would, unless it has its [[t:surge.junction.pump.four]].</li>
<li>A nozzle only discharges outwards.</li>
</ul>`,
          },
          devices: {
            title: 'Protection devices',
            body: `<p>The palette group [[t:junctions.groups.protection]] holds four junctions made to soften a water hammer. In the steady state each one is a node without losses (the relief valve closed, the air valve without air); their data are in the section [[t:surge.junction.title]] of the inspector, with the water hammer on.</p>
<h4>[[t:junctions.surgeTank.label]]</h4>
<p>An open tank on the node. Its level swings with the liquid that goes in and out, which the trapezoid rule integrates together with the node in each step:</p>
[[eq:surgeTank]]
<p>Its level in the steady state is that of the pressure of the node, or a given one (the tank is then a pressure reference). Its section is constant or a table of volume by height; above its top it overflows, and at its bottom it runs empty and lets only liquid come back. An orifice adds a loss of its own each way, and a short riser the inertia of its column:</p>
[[eq:surgeRiser]]
<p>One-way, a check valve lets it only feed the network.</p>
<h4>[[t:junctions.airVessel.label]]</h4>
<p>A closed vessel whose gas the liquid compresses and expands, polytropic with the exponent n (1.2 by default):</p>
[[eq:airVessel]]
<p>The gas of the steady state is given, or comes from the pre-charge at constant temperature. With a geometry the level of the liquid adds its column to the pressure of the gas. The volume of the vessel and a smallest gas volume limit the gas; the orifice and the riser are those of the surge tank.</p>
<h4>[[t:junctions.reliefValve.label]]</h4>
<p>Closed, it opens when the pressure of the node passes its set pressure P<sub>a</sub>; open, its Cv grows in a straight line from the closing pressure to the full opening pressure, and it closes at the closing pressure:</p>
[[eq:reliefValve]]
<p>The relieved flow is solved together with the node. It may open all at once instead, have a largest speed of its opening, or follow a table of its opening (a pilot valve).</p>
<h4>[[t:junctions.airValve.label]]</h4>
<p>When the pressure of the node falls below its opening pressure the valve lets air in, and lets it out again when the pressure rises, as Wylie and Streeter model it: the air stays at the node, ideal (R = 287.05 J/(kg·K), k = 1.4) and at constant temperature. The air flow is sonic below the critical ratio 0.52828 and subsonic above it, out the same way with the roles swapped:</p>
[[eq:airFlowSonic]]
[[eq:airFlowSubsonic]]
[[eq:airValveGas]]
<p>Once the air is out, the valve closes and the node is liquid again. A two-stage valve lets the air out through a smaller orifice above a pressure difference or an air flow, which softens the last moment.</p>`,
          },
          results: {
            title: 'Results',
            body: `<p>When the run ends, the [[t:app.tabs.out]] view gains three tabs:</p>
<ul>
<li>[[t:surge.results.tabs.surge]]: the summary of the run (time step, steps, test step, cavitation), the sections of every pipe, the extremes of the junctions, such as the smallest speed of a pump, with the reference of its four-quadrant data, and the [[t:surge.results.forces]] of the force sets.</li>
<li>[[t:surge.results.tabs.surgeEnv]]: the largest and smallest static pressure of every pipe, with where and when, and the same for each station of a pipe you choose.</li>
<li>[[t:surge.results.tabs.surgeLog]]: the events, the changes of state of the devices and the cavities, in the order of time.</li>
</ul>
<p>The warnings of the run join those of the steady state. The time cursor, in the row of the tabs, chooses the recorded time shown: [[t:surge.overlay.P]] and the other quantities of the water hammer colour the drawing at that time, or by the envelopes of the run.</p>
<p>In the [[t:app.tabs.charts]] view, [[t:surge.charts.tabs.time]] draws series of the stations, the junctions and the force sets, and [[t:surge.charts.tabs.profile]] draws the largest and smallest grade lines along a path, with the steady state, the elevation of the pipes and the vapour pressure. The series, the envelopes and the log go to the Excel file with the other results.</p>`,
          },
          method: {
            title: 'Method',
            body: `<p>The pipes are solved by the <b>method of characteristics</b>. Along a pipe, with P the stagnation pressure (absolute) and ṁ the mass flow, the equations of momentum and continuity of the liquid:</p>
[[eq:surgeEquations]]
<p>hold along the lines dx/dt = ±a. Each pipe is cut into n sections that the wave crosses in one time step Δt, the same in the whole network, and its wave speed is adjusted to a′ so that this fits exactly:</p>
[[eq:surgeSections]]
<p>At a station i, the stations A (upstream) and B (downstream) of the step before give two compatibility equations, with the friction linearized as Wylie and Streeter do:</p>
[[eq:surgeCplus]]
[[eq:surgeCminus]]
[[eq:surgeCoefficients]]
<p>R takes the loss of the pipe in the steady state, so that the steady state is a solution of the method and nothing moves while nothing changes. With the friction [[t:surge.system.frictions.variable]], each station keeps its own R, the friction of its flow by the correlation of the steady state plus the fittings of the steady state, taken again when its velocity changes by more than 1 %:</p>
[[eq:frictionVariable]]
<p>With [[t:surge.system.frictions.brunone]], the loss per unit length also takes the unsteady term of Brunone in the form of Vítkovský, with the coefficient k of Vardy and Brown from the Reynolds number of the steady flow of each pipe (or its [[t:surge.pipe.k]]):</p>
[[eq:brunone]]
<p>The term is explicit, from the flows of the two steps before, at the station at the foot of each characteristic: C<sup>+</sup> from A takes CP − ΔP<sub>A</sub> and C<sup>−</sup> from B takes CM + ΔP<sub>B</sub>, with U<sub>j</sub> the largest of D<sup>+</sup> and D<sup>−</sup> for a flow forward, the smallest for a flow back and their mean without flow:</p>
[[eq:brunoneStep]]
<p>Inside a pipe the two equations give the station:</p>
[[eq:surgeInterior]]
<p>At the ends, each junction adds its own law to the equations of its pipes: a fixed pressure, a flow, a loss, the curve of a pump or the state of a device.</p>
<h4>Cavities</h4>
<p>With [[t:surge.system.cavitations.dvcm]], a station whose pressure would fall below the vapour pressure P<sub>v</sub> holds P<sub>v</sub>, its two flows part, and the volume of its cavity follows them:</p>
[[eq:cavityFlows]]
[[eq:cavityVolume]]
<p>With [[t:surge.system.cavitations.dgcm]], every station holds a little free gas at constant temperature, its void fraction α<sub>0</sub> given at the pressure p<sub>0</sub> (10⁻⁷ at 1 atm by default), half a section at the ends of a pipe:</p>
[[eq:gasCavity]]
<p>The volume of the gas follows the two flows of the station as a vapour cavity does, which gives its pressure as the positive root of a quadratic; the pressure never reaches P<sub>v</sub>. The protection devices and the fixed pressures hold no gas, and the sides of valves and pumps keep the vapour cavities.</p>
<h4>Trip of a pump</h4>
<p>The head of a pump at the relative speed s follows its curve by the affinity laws:</p>
[[eq:pumpCurve]]
<p>After a trip the speed falls by the torque of the liquid, with I the moment of inertia, ω<sub>r</sub> the rated speed and P<sub>1</sub> the shaft power at the rated speed:</p>
[[eq:pumpTrip]]
<p>The speed of each step comes by the trapezoid rule, iterated with the solution of the step:</p>
[[eq:pumpTripStep]]
<h4>Start of a pump</h4>
<p>A pump on its curve that is off and closed in the steady state may start: from then on its motor gives the torque T<sub>m</sub>(s) of its table, [[t:surge.junction.pump.motor]], and the speed rises by the difference with the torque of the liquid:</p>
[[eq:pumpStart]]
<p>The speed of each step is the root of the trapezoid rule, solved together with the step, and its check valve keeps the pump shut until its head overcomes the pressure against it:</p>
[[eq:pumpStartStep]]
<h4>Pumps in four quadrants</h4>
<p>With its [[t:surge.junction.pump.four]], the head and the torque of a pump come from its curves of Suter in every quadrant (pumping, braking, as a turbine, turning backwards), in straight lines in θ:</p>
[[eq:suter]]
[[eq:suterVars]]
<p>The reference point is the steady state of the pump, its best efficiency at the rated speed, or one given; c<sub>H</sub> and c<sub>B</sub> scale the table so that it meets the steady state. After a trip or a start, the flow and the speed come together in each step:</p>
[[eq:fourStep]]
<p>The flow and the speed may then go back, and only a check valve of the pump holds the flow. The log keeps the first reversal of each.</p>
<h4>Largest speed of a control valve</h4>
<p>A control valve set to [[t:surge.junction.control.modes.ideal]] may have a [[t:surge.junction.control.rate]] r. Its opening x then follows the opening x* that its control asks for, which comes from the Cv of the ideal solution by the inverse c<sup>−1</sup> of its characteristic, at most r·Δt in a step; while it lags, it is a fixed valve with the Cv of the opening it reached:</p>
[[eq:controlRate]]
<h4>Dynamic check valves</h4>
<p>[[t:surge.junction.check.models.decel]]: when the flow reverses, the deceleration a<sub>d</sub> of the liquid over its [[t:surge.junction.check.window]] gives, by the table of the valve, the reverse velocity V<sub>R</sub> at which it closes:</p>
[[eq:checkDecel]]
<p>[[t:surge.junction.check.models.swing]] and [[t:surge.junction.check.models.nozzle]]: the disc moves by the forces on it (Thorley, 2004; Li and Liou, 2003), and the loss at its position is that of the valve fully open over the square of the fraction of its Cv:</p>
[[eq:checkSwing]]
[[eq:checkNozzle]]
<p>Each step is the implicit trapezoid rule on the position and its speed, with the valve solved for each position tried; at a stop the disc stays without rebound, and at its seat the valve is closed until the torque there opens it:</p>
[[eq:checkStep]]
<h4>Unbalanced forces</h4>
<p>The axial force of a force set comes from the balance of momentum of the liquid between two stations a and b, with p the static pressure and p<sub>amb</sub> the ambient one, and the friction of each section on the way:</p>
[[eq:forceSegment]]
<p>It is the force on the two bends and the straight run between them, and in a steady state on a horizontal path it is zero. At a station the force is (p − p<sub>amb</sub>)·A + ṁ²/(ρA); at an exit, the segment up to the end of the pipe less the momentum of the jet, ṁ²/(ρA<sub>s</sub>).</p>
<h4>Test step</h4>
<p>Before the run, one step with nothing changing must leave every station within the [[t:surge.system.criterion]] of its steady pressure and flow. A larger change means that the steady state and the model of the transient disagree, an artificial transient: a warning names the stations, and the run stops when [[t:surge.system.stop]] is on.</p>`,
          },
          limits: {
            title: 'Limits and references',
            body: `<ul>
<li>Discrete cavities give the timing and the order of the peaks after a collapse, not their exact value; a cavity larger than a tenth of its section gives a warning.</li>
<li>The wave speed is constant in each pipe; the free gas of the gas cavities stays at its station and does not change it.</li>
<li>Without Brunone the friction is quasi-steady, so the waves die out more slowly than in reality; the term of Brunone damps them as measurements do, with one coefficient per pipe for the whole run.</li>
<li>Without its four-quadrant data a pump has no reverse flow and does not work as a turbine; with them, the data are yours: Pump It embeds no published table.</li>
<li>The air of an air valve and the gas of a vessel stay where they are: neither moves along the pipes, and a vessel or a tank that runs empty keeps its pressure at the node.</li>
<li>The pipes do not move: the forces on them are calculated, not their response. The staggered grid of some programs is not offered.</li>
</ul>
<h4>References</h4>
<ul>
<li>Wylie, E. B.; Streeter, V. L.; Suo, L. <i>Fluid Transients in Systems</i>. Prentice Hall, 1993.</li>
<li>Chaudhry, M. H. <i>Applied Hydraulic Transients</i>. 3rd ed., Springer, 2014.</li>
<li>Thorley, A. R. D. <i>Fluid Transients in Pipeline Systems</i>. 2nd ed., Professional Engineering Publishing, 2004.</li>
<li>Halliwell, A. R. Velocity of a water-hammer wave in an elastic pipe. <i>Journal of the Hydraulics Division</i>, ASCE, 89(HY4), 1963.</li>
<li>Marczak, W. Water as a standard in the measurements of speed of sound in liquids. <i>Journal of the Acoustical Society of America</i>, 102(5), 1997.</li>
<li>Simpson, A. R.; Bergant, A. Numerical comparison of pipe-column-separation models. <i>Journal of Hydraulic Engineering</i>, ASCE, 120(3), 1994.</li>
<li>Bergant, A.; Simpson, A. R.; Tijsseling, A. S. Water hammer with column separation: a historical review. <i>Journal of Fluids and Structures</i>, 22(2), 2006.</li>
<li>Brunone, B.; Golia, U. M.; Greco, M. Some remarks on the momentum equation for fast transients. <i>International Meeting on Hydraulic Transients with Column Separation</i>, IAHR, Valencia, 1991.</li>
<li>Vardy, A. E.; Brown, J. M. B. Transient, turbulent, smooth pipe friction. <i>Journal of Hydraulic Research</i>, 33(4), 1995.</li>
<li>Vítkovský, J. P.; Bergant, A.; Simpson, A. R.; Lambert, M. F. Systematic evaluation of one-dimensional unsteady friction models in simple pipelines. <i>Journal of Hydraulic Engineering</i>, ASCE, 132(7), 2006.</li>
<li>Wylie, E. B. Simulation of vaporous and gaseous cavitation. <i>Journal of Fluids Engineering</i>, ASME, 106(3), 1984.</li>
<li>Marchal, M.; Flesch, G.; Suter, P. The calculation of waterhammer problems by means of the digital computer. <i>International Symposium on Waterhammer in Pumped Storage Projects</i>, ASME, 1965.</li>
<li>Thorley, A. R. D. Check valve behavior under transient flow conditions: a state-of-the-art review. <i>Journal of Fluids Engineering</i>, ASME, 111(2), 1989.</li>
<li>Li, G.; Liou, J. C. P. Swing check valve characterization and modeling during transients. <i>Journal of Fluids Engineering</i>, ASME, 125(6), 2003.</li>
</ul>`,
          },
        },
      },
    },
  },
});
