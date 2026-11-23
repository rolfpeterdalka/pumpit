// Water hammer: its control in the system window, the wave of a pipe, the time data of a junction, its run and its results.
PumpIt.i18n.add('es', {
  surge: {
    states: {
      open: 'abierta', closed: 'cerrada', control: 'controlando', run: 'bombeando', shut: 'cerrada por la retención',
      normal: 'normal', full: 'lleno', empty: 'vacío', admit: 'admitiendo aire', expel: 'expulsando aire', hold: 'con aire retenido',
    },
    error: {
      steady: 'Golpe de ariete: el régimen permanente no se calculó ({message}).',
      steadyNotConverged: 'Golpe de ariete: el régimen permanente no convergió, y el transitorio no puede partir de él.',
      noPipes: 'Golpe de ariete: ningún tubo abierto lleva el transitorio.',
      waveSpeed: 'Golpe de ariete: el tubo P{id} no tiene velocidad de onda.',
      timeStep: 'Golpe de ariete: no se pudo hallar un paso de tiempo para los tubos.',
      boundary: 'Golpe de ariete: no se pudo preparar la unión J{id} ({message}).',
      data: 'Golpe de ariete: no se pudieron preparar los datos de la unión J{id} ({message}).',
      artificial: 'El golpe de ariete se detuvo: el paso de prueba desde el régimen permanente movió la red en más de {criterion} % (un transitorio artificial). Vea los avisos.',
      notFinite: 'El golpe de ariete se detuvo en {t} s: un valor de la red dejó de ser un número.',
      infiniteSections: 'el tubo infinito necesita al menos 2 secciones en el tubo P{pid}',
      tankUncovered: 'su tanque finito empieza con el extremo del tubo P{pid} descubierto, con el nivel del líquido sin pasar de él, mientras el régimen permanente saca líquido por él: suba el nivel del líquido por encima del tubo',
      vesselGas: 'el gas del calderín no tiene volumen o presión en el régimen permanente',
      vesselTooSmall: 'el gas del régimen permanente no cabe en el calderín',
      gasSteady: 'Golpe de ariete: el tubo P{id} no está por encima de la presión de vapor en la estación {i} en el régimen permanente, así que no puede guardar el gas libre de las cavidades de gas.',
      gasNode: 'su presión en el régimen permanente no está por encima de la presión de vapor, así que no puede guardar el gas libre de las cavidades de gas',
      force: 'Golpe de ariete: el conjunto de fuerzas {name} no está completo (sus tubos, sus distancias y un camino entre sus estaciones).',
      forcePipe: 'Golpe de ariete: el tubo P{id} del conjunto de fuerzas {name} no forma parte del transitorio (cerrado o aislado).',
      fourTable: 'su tabla de cuatro cuadrantes no está completa',
      fourSteady: 'el punto de referencia del régimen permanente necesita la bomba bombeando en el régimen permanente',
      fourBep: 'no se pudo hallar el punto de mejor rendimiento en las curvas de la bomba',
      fourRef: 'el punto de referencia de los datos de cuatro cuadrantes necesita caudal, altura y velocidad por encima de cero',
      fourScale: 'su tabla de cuatro cuadrantes no encuentra el régimen permanente (allí la altura o el par de la tabla es cero o tiene el signo contrario)',
    },
    warn: {
      notRefined: 'No se pudo refinar el régimen permanente hasta la tolerancia relativa de 10⁻¹⁰; el transitorio parte de él tal como estaba.',
      zeroFlow: 'El tubo P{id} no tiene caudal en el régimen permanente: su fricción en el transitorio es la del flujo turbulento pleno en su rugosidad.',
      frozenNegative: 'La válvula de control J{id} sumaba presión en el régimen permanente; congelada, entra sin pérdida.',
      pumpSpeedUnknown: 'Bomba J{id}: la velocidad de su control en el régimen permanente es desconocida; el transitorio usa la velocidad escrita.',
      pumpSpeedIteration: 'Bomba J{id}: la velocidad no se ajustó en {t} s (50 iteraciones); la corrida sigue con el último valor.',
      pumpBeyondCurve: 'La bomba J{id} pasa del final de su curva desde {t} s (sus datos de cuatro cuadrantes, en la sección del golpe de ariete de la bomba, cubren cualquier caudal y velocidad).',
      motorBeyond: 'Bomba J{id}: su velocidad pasa del último punto de la tabla de su motor en {t} s; desde allí el motor mantiene el último par de la tabla.',
      bigGas: 'Tubo P{id}: el gas libre pasa del 10 % del volumen de una sección en la estación {i} desde {t} s; el modelo de cavidades de gas discretas pierde precisión.',
      bigGasJunction: 'Unión J{id}: el gas libre pasa del 10 % del volumen de una sección vecina desde {t} s; el modelo de cavidades de gas discretas pierde precisión.',
      fourScale: 'Bomba J{id}: la tabla de cuatro cuadrantes se escala por c_H = {cH} y c_B = {cB} para encontrar el régimen permanente; por encima del 5 %, la tabla y las curvas de la bomba no concuerdan.',
      decelRange: 'Retención J{id}: la deceleración de {ad} m/s² en {t} s está fuera de su tabla; la válvula toma el valor del extremo de la tabla.',
      discNotOpen: 'Retención J{id}: la diferencia de presión del régimen permanente no mantiene el disco totalmente abierto, así que el disco se mueve desde el primer paso (un transitorio artificial).',
      root: 'Unión J{id}: una ecuación de su contorno no convergió en {t} s; el paso sigue con el último valor.',
      bigCavity: 'Tubo P{id}: una cavidad de vapor por encima del 10 % del volumen de su sección desde {t} s; el modelo de cavidades discretas pierde precisión.',
      cavityPipe: 'El tubo P{id} cavita desde {t} s.',
      cavityJunction: 'La unión J{id} cavita desde {t} s.',
      belowVapor: 'El tubo P{id} queda por debajo de la presión de vapor en {t} s (estación {i}); sin un modelo de cavitación, las presiones que siguen no son físicas.',
      variance: 'El seccionamiento no alcanzó el límite de varianza de {limit} %: el mayor ajuste de una velocidad de onda es de {worst} %.',
      thickWall: 'Tubo P{id}: pared más gruesa que D/25; las opciones de pared gruesa le sirven mejor.',
      shortDuration: 'La duración es menor que 4·L/a del tubo más largo ({t} s): la respuesta de un tubo tarda por lo menos eso.',
      manySections: 'Un tubo tiene {n} secciones: el paso de tiempo es muy corto para los tubos más largos. Revise el tubo más corto o dé su velocidad de onda.',
      noVapor: 'El fluido no tiene presión de vapor: la corrida sigue sin el modelo de cavitación.',
      fluidKRange: 'La temperatura del agua ({T} °C) está fuera del rango de la correlación de su velocidad del sonido ({min}–{max} °C).',
      memory: 'Las series guardadas ocupan unos {mb} MB. Guarde cada N pasos, o menos estaciones.',
      artificial: 'Transitorio artificial: el paso de prueba desde el régimen permanente movió estaciones en más de {criterion} %: {list}.',
      artificialItem: 'P{id} estación {i} ({what} {pct} %)',
      artificialWhat: { P: 'presión', m: 'caudal' },
      pMax: 'El tubo P{id} pasa de su presión máxima en la estación {i}: {p} kPa manométricos en {t} s, frente a {lim} kPa.',
      tankAboveTop: 'Tanque de alivio J{id}: el nivel del régimen permanente está por encima de su borde, así que empieza lleno.',
      tankBelowBottom: 'Tanque de alivio J{id}: el nivel del régimen permanente está por debajo de su fondo, así que empieza vacío.',
      tankFull: 'El tanque J{id} rebosa por su borde a partir de {t} s.',
      tankEmpty: 'El tanque J{id} se vacía a partir de {t} s.',
      vesselBelowMin: 'Calderín J{id}: el gas del régimen permanente está por debajo de su menor volumen.',
      vesselEmpty: 'Calderín J{id}: su gas ocupa todo el calderín en {t} s, sin líquido dentro.',
      vesselFull: 'Calderín J{id}: su gas llega a su menor volumen en {t} s, y no recibe más líquido.',
      reliefSteady: 'Válvula de alivio J{id}: la presión del régimen permanente ya pasa de su presión de tarado, así que abre al empezar la corrida.',
      bigAir: 'Ventosa J{id}: su aire es mayor que el volumen de una sección vecina a partir de {t} s; el modelo de aire retenido en un punto pierde precisión.',
      infiniteCavity: 'El tubo infinito de la unión J{id} queda por debajo de la presión de vapor en {t} s; su extremo no cavita.',
    },
    log: {
      cavityPipe: 'primera cavidad en el tubo P{id}',
      cavityJunction: 'primera cavidad en la unión J{id}',
      cavitiesAtEnd: 'quedan cavidades al final de la corrida',
      cavitiesEnded: 'la última cavidad de la red colapsó',
      tableStarted: 'la tabla {n} empezó por su evento',
      tableResumed: 'la tabla {n} empezó en {tau} s, donde da el valor en uso',
      pumpTrip: 'parada de la bomba: el par del motor desapareció',
      pumpStart: 'arranque de la bomba: el motor da el par de su tabla',
      pumpFlowReversed: 'el caudal por la bomba vuelve por primera vez',
      pumpSpeedReversed: 'la bomba gira al revés por primera vez',
      checkDecel: 'el caudal se invierte con una deceleración de {ad} m/s²: la válvula cierra con una velocidad inversa de {VR} m/s',
      discLeaves: 'el disco deja la apertura total',
      discFull: 'el disco vuelve a la apertura total',
      state: 'pasa de {from} a {to}',
    },
    stamp: {
      label: 'Golpe de ariete',
      running: 'Golpe de ariete · {pct} %',
      title: 'Golpe de ariete: haga clic para abrir su control en las propiedades del sistema',
    },
    bar: {
      aria: 'Cursor de tiempo del golpe de ariete',
      label: 'Golpe de ariete',
      first: 'Primer instante guardado',
      prev: 'Instante guardado anterior',
      play: 'Reproducir los instantes guardados',
      pause: 'Pausar',
      next: 'Siguiente instante guardado',
      last: 'Último instante guardado',
      slider: 'Instante del golpe de ariete mostrado',
      cancel: 'Detener el golpe de ariete (lo ya calculado se queda)',
      stopped: 'se detuvo en {t}',
      cancelled: 'detenido por usted en {t}',
    },
    system: {
      title: 'Golpe de ariete',
      hint: 'El transitorio de una red de líquido después de un cambio rápido: una válvula que cierra, una bomba que se para, un nivel o una presión que cambia. Parte del régimen permanente del escenario y se resuelve por el método de las características. Solo calcula mientras está activado.',
      on: 'Calcular el golpe de ariete',
      onHint: 'Activado, el golpe de ariete corre después del régimen permanente en cada cambio, y la simulación en el tiempo se desactiva (las dos no corren juntas). Desactivado, sus datos se quedan en el modelo y no se usan.',
      off: 'Desactivado: el modelo calcula solo el régimen permanente. Actívelo cuando un cambio rápido pueda causar un golpe de ariete.',
      offTime: 'Desactivado: este escenario hace la simulación en el tiempo. Activar el golpe de ariete desactiva la simulación en el tiempo; los datos de ambos se quedan en el modelo.',
      duration: 'Duración',
      durationHint: 'Cuánto tiempo se sigue el transitorio desde 0 s, el régimen permanente. Cubra por lo menos algunas veces 2·L/a del tubo más largo.',
      dtMode: 'Paso de tiempo',
      dtModes: { auto: 'Automático', given: 'Dado' },
      dtModeHint: 'Automático: el paso en el que cabe un número entero de secciones en cada tubo, ajustando cada velocidad de onda como mucho en el límite de varianza. Dado: el paso que usted escribe; cada tubo toma el número entero de secciones más cercano.',
      dt: 'Paso de tiempo',
      varianceMax: 'Límite de varianza',
      varianceHint: 'El mayor ajuste de la velocidad de onda de un tubo, para que sus secciones quepan en el paso de tiempo común.',
      ncMax: 'Máximo de secciones del tubo controlador',
      ncMaxHint: 'La búsqueda prueba desde el mínimo hasta este número de secciones, en pasos de 0,05, en el tubo de menor tiempo de recorrido L/a.',
      ncMin: 'Mínimo de secciones del tubo controlador',
      cavitation: 'Cavitación',
      cavitations: { dvcm: 'Cavidades de vapor', dgcm: 'Cavidades de gas', none: 'Ninguna' },
      cavitationHint: {
        dvcm: 'Cavidades de vapor discretas: una estación cuya presión cae hasta la presión de vapor se queda en ella y abre una cavidad, que crece y colapsa con los caudales a su alrededor. El colapso da los picos de presión.',
        dgcm: 'Cavidades de gas discretas: cada estación guarda una pequeña masa de gas libre, que crece cuando la presión baja, a temperatura constante. La presión nunca llega a la presión de vapor, y los colapsos son más suaves que con cavidades de vapor. El peso ψ usual es 0,95, que esta elección toma mientras ψ está en 0,5.',
        none: 'Sin modelo: la presión puede caer por debajo de la presión de vapor. Un aviso dice dónde y cuándo; las presiones que siguen no son físicas.',
      },
      friction: 'Fricción',
      frictions: { steady: 'La del régimen permanente (cuasi permanente)', variable: 'Variable con el número de Reynolds', brunone: 'Variable, con el término transitorio de Brunone' },
      frictionHint: 'La del régimen permanente: cada tubo mantiene el coeficiente de fricción de su caudal permanente. Variable: cada estación vuelve a calcular el factor de fricción de su caudal, con la correlación del régimen permanente, siempre que su velocidad cambia más de un 1 %; las pérdidas de los accesorios quedan las del régimen permanente. Con Brunone, la fricción variable toma además un término de la aceleración del líquido, (ρ·k/2)·(∂V/∂t + a·signo(V)·|∂V/∂x|), que amortigua las ondas como en las mediciones; k viene del número de Reynolds del caudal permanente de cada tubo, o el tubo lo da.',
      saveEvery: 'Guardar cada N pasos',
      saveEveryHint: 'Las estaciones se guardan cada N pasos, siempre el primero y el último. Los mayores y menores valores cubren todos los pasos.',
      stations: 'Estaciones de salida',
      stationsOf: { ends: 'Los extremos de cada tubo', all: 'Todas las estaciones' },
      stationsHint: 'Las estaciones cuyas presiones y caudales se guardan en el tiempo. Un tubo puede elegir las suyas. Las envolventes cubren todas las estaciones de cualquier forma.',
      fluidK: 'Módulo de compresibilidad del líquido',
      fluidKSource: 'de la velocidad del sonido en el agua a la temperatura del modelo',
      fluidKHint: 'El módulo de compresibilidad K del líquido, que define la velocidad de onda junto con la elasticidad de la pared del tubo. El agua tiene unos 2,2 GPa.',
      advanced: 'Golpe de ariete: avanzado',
      advancedHint: 'Opciones del método que rara vez hace falta cambiar.',
      psi: 'Peso ψ de las cavidades',
      psiHint: 'El volumen de una cavidad toma los caudales del paso nuevo con el peso ψ y los del paso anterior con 1 − ψ, de 0,5 a 1. El valor habitual es 0,5.',
      cavBasis: 'Las cavidades comparan',
      cavBases: { stagnation: 'La presión de estancamiento', static: 'La presión estática' },
      cavBasisHint: 'La presión de una estación que se compara con la presión de vapor para abrir una cavidad.',
      alpha0: 'Fracción de vacío del gas libre',
      alpha0Hint: 'La fracción del volumen del líquido ocupada por gas libre a la presión de abajo, la misma en toda la red. 10⁻⁷ es un valor usual.',
      p0: 'Presión de la fracción de vacío',
      p0Hint: 'La presión absoluta a la que vale la fracción de vacío de arriba: 1 atm por defecto.',
      criterion: 'Transitorio artificial: criterio',
      criterionHint: 'Antes de la corrida, un paso sin ningún cambio tiene que mantener cada estación dentro de este porcentaje de su presión y su caudal permanentes. Un cambio mayor significa que el régimen permanente y el modelo del transitorio no coinciden (un transitorio artificial).',
      minFlow: 'Transitorio artificial: menor caudal revisado',
      stop: 'Detener la corrida ante un transitorio artificial',
      sectioning: 'Secciones y paso de tiempo',
      sectioningHint: 'Cada tubo se divide en un número entero de secciones que la onda cruza en un paso de tiempo. Haga clic en una fila para ir a su tubo.',
      noWave: 'Dé la velocidad de onda de {pipes} para ver las secciones.',
      noSectioning: 'Complete el modelo y su régimen permanente para ver las secciones.',
      controller: 'controla',
      cols: { pipe: 'Tubo', L: 'Longitud (m)', a: 'Velocidad de onda (m/s)', n: 'Secciones', aAdj: 'Ajustada (m/s)', variance: 'Varianza (%)', R: 'R (Pa·s²/kg²)' },
      dtValue: 'Paso de tiempo',
      stationsTotal: 'Estaciones',
      steps: 'Pasos',
      estimate: 'Tamaño de la corrida',
      estimateValue: '{work} estaciones × pasos, unos {s} s',
      limitNotMet: 'Ningún paso de tiempo alcanzó el límite de varianza de {limit} %: el mayor ajuste es de {worst} %. Suba el límite o el número de secciones, o dé las velocidades de onda.',
      summary: '{duration} · cavitación: {cavitation}',
      forces: 'Fuerzas desequilibradas',
      forcesHint: 'La fuerza axial del líquido sobre los tubos a lo largo del tiempo, para el diseño de sus apoyos: en un tramo entre dos estaciones (los codos de sus extremos y el tramo recto entre ellos), en una estación o en una salida. Viene del balance de cantidad de movimiento: la presión estática por encima de la ambiente por el área y el flujo de cantidad de movimiento en los extremos, con la fricción del camino.',
      forceName: 'Nombre',
      forceKind: 'Tipo',
      forceKinds: { segment: 'Tramo entre dos estaciones', point: 'En una estación', exit: 'Salida al exterior' },
      forceKindHint: 'Tramo: la fuerza sobre los codos de sus dos extremos y el tramo recto entre ellos, positiva de la primera estación a la segunda, cero en un régimen permanente en un camino horizontal; entre tubos sigue el camino con menos tubos. En una estación: (p − p_amb)·A + ṁ²/(ρA), en el sentido del tubo. Salida: el tramo hasta el final del tubo que descarga, menos la cantidad de movimiento del chorro.',
      forcePipe: 'Tubo',
      forceFrom: 'Desde el tubo',
      forceTo: 'Hasta el tubo',
      forceExit: 'Tubo que descarga',
      forceX: 'Distancia desde el origen',
      forceAt: 'Estación tomada',
      forceStation: 'estación {i} de {n} · {x} m',
      forceAs: 'Área del chorro (vacío: la del tubo)',
      forceAmbient: 'Presión ambiente',
      ambients: { atm: 'Atmosférica', given: 'Dada' },
      forcePamb: 'Presión ambiente dada',
      forceBad: {
        set: 'Un conjunto incompleto.', kind: 'Elija el tipo.', pipe: 'Elija tubos abiertos.', distance: 'Dé distancias dentro de los tubos.',
        path: 'Ningún camino de tubos abiertos une los dos tubos.', ambient: 'Dé la presión ambiente.', area: 'El área del chorro debe ser mayor que cero.',
      },
      forceRemove: 'Quitar este conjunto de fuerzas',
      forceAdd: 'Añadir un conjunto de fuerzas',
    },
    pipe: {
      title: 'Onda del golpe de ariete',
      hint: 'La velocidad de las ondas de presión en este tubo, calculada a partir del líquido y de la pared, o dada, y las secciones que toma en la corrida.',
      closed: 'Un tubo cerrado no entra en el golpe de ariete.',
      wave: 'Velocidad de onda',
      waves: { calculated: 'Calculada por la pared', given: 'Dada' },
      a: 'Velocidad de onda',
      support: 'Cómo está sujeto el tubo',
      supports: {
        thinAnchored: 'Pared delgada, anclado en toda su longitud',
        thinUp: 'Pared delgada, anclado solo aguas arriba',
        thinJoints: 'Pared delgada, con juntas de expansión',
        thickAnchored: 'Pared gruesa, anclado en toda su longitud',
        thickUp: 'Pared gruesa, anclado solo aguas arriba',
        thickJoints: 'Pared gruesa, con juntas de expansión',
        tunnelUnlined: 'Túnel en roca, sin revestimiento',
        tunnelLined: 'Túnel en roca, revestido de acero',
        buried: 'Enterrado, por un aumento estimado',
        user: 'Coeficiente c₁ dado',
      },
      supportHint: 'Cómo está sujeto el tubo define el coeficiente c₁ de la fórmula de la velocidad de onda. Las fórmulas de pared delgada sirven para un diámetro de más de unas 25 veces la pared.',
      E: 'Módulo de elasticidad',
      EHint: 'Del material de la pared. Vacío, toma el valor típico del material del catálogo, mostrado en gris.',
      nu: 'Coeficiente de Poisson',
      wall: 'Espesor de la pared',
      wallHint: 'Vacío, toma la pared del tamaño del catálogo, mostrada en gris; un revestimiento no cuenta.',
      typical: 'Llenar E y ν con un material típico…',
      typicalLabel: 'Valores típicos',
      materials: { carbonSteel: 'Acero al carbono', stainless: 'Acero inoxidable', ductileIron: 'Fundición dúctil', hdpe: 'PEAD (carga corta, 20 °C)', pvc: 'PVC', copper: 'Cobre', concrete: 'Hormigón' },
      fromCatalog: 'Los campos vacíos toman los valores de {material} y la pared del catálogo.',
      G: 'Módulo de rigidez de la roca',
      GHint: 'El módulo de rigidez (de corte) G de la roca alrededor del túnel.',
      buriedPct: 'Aumento sobre el tubo anclado',
      buriedHint: 'Un tubo enterrado es más rígido que uno al aire libre: su velocidad de onda es la de una pared delgada anclada en toda su longitud, aumentada en este porcentaje.',
      c1: 'Coeficiente c₁',
      aCalc: 'Velocidad de onda a',
      plastic: 'El módulo de un plástico depende de su temperatura y de cuánto dura la carga: revise el valor para un transitorio rápido.',
      thick: 'La pared es más gruesa que 1/25 del diámetro: una opción de pared gruesa le sirve mejor.',
      sections: 'En la corrida',
      sectionsValue: '{n} secciones · {a} m/s · varianza {v} %',
      stations: 'Estaciones de salida',
      stationsOf: { default: 'Como en el sistema', ends: 'Los dos extremos', all: 'Todas las estaciones' },
      stationsHint: 'Las estaciones de este tubo cuyas presiones y caudales se guardan en el tiempo.',
      pMax: 'Presión máxima',
      pMaxHint: 'Opcional: la mayor presión que aguanta el tubo. Una corrida que la supere da un aviso con la estación y el instante.',
      k: 'Coeficiente k de Brunone',
      kHint: 'Opcional: el coeficiente de la fricción transitoria de este tubo. Vacío, viene del número de Reynolds de su caudal permanente, k = √C*/2 de Vardy y Brown, y un tubo sin caudal permanente toma el valor laminar.',
      kAuto: 'del número de Reynolds',
    },
    junction: {
      title: 'Golpe de ariete',
      hint: 'Lo que esta unión hace en el golpe de ariete: una tabla de una de sus magnitudes en el tiempo, o la parada o el arranque de una bomba. Estos datos se guardan aparte de los de la simulación en el tiempo.',
      add: { table: 'Añadir una tabla ({what})', trip: 'Añadir una parada de la bomba', start: 'Añadir un arranque de la bomba' },
      whats: {
        Q: 'Caudal', source: 'Caudal de la fuente', P: 'Presión', level: 'Nivel del líquido', surfP: 'Presión en la superficie', speed: 'Velocidad de giro',
        set: 'Consigna', K: 'K', Cv: 'Cv', Kv: 'Kv', area: 'Área efectiva (Cd·A)', pMax: 'Presión de alivio', open: 'Apertura',
        ratio: 'Relación de compresión', T: 'Temperatura del gas', trip: 'Parada de la bomba', start: 'Arranque de la bomba',
      },
      use: 'Usar estos datos',
      what: 'Magnitud',
      whatGone: 'La magnitud de estos datos no sirve para el modo actual de la unión: elija otra.',
      event: 'Evento {n}',
      eventOne: 'Evento',
      combinedNone: 'El modelo todavía no tiene eventos: créelos en la ventana del sistema, debajo del golpe de ariete.',
      combined: 'Evento del modelo',
      tripStart: 'La parada ocurre',
      tripStarts: { time: 'En un instante', single: 'En un evento', combined: 'En un evento del modelo' },
      tripHint: 'Desde la parada, el motor ya no da par: la bomba pierde velocidad por su inercia y, sin sus datos de cuatro cuadrantes, no deja volver el caudal. El paso que alcanza el instante de la parada, o en el que su evento se dispara, hace la parada; el par desaparece desde el paso siguiente.',
      tripAt: 'Instante de la parada',
      startWhen: 'El arranque ocurre',
      startPumpHint: 'Desde el arranque, el motor da el par de su tabla: la bomba gana velocidad por su inercia, sujeta por su retención hasta que su altura vence la presión contra ella, y sin sus datos de cuatro cuadrantes no deja volver el caudal. El paso que alcanza el instante del arranque, o en el que su evento se dispara, hace el arranque; el par existe desde el paso siguiente.',
      startAt: 'Instante del arranque',
      basis: 'Valores',
      start: 'Inicio',
      startHint: 'Por el reloj, el tiempo de la tabla es el tiempo de la corrida. Después de un evento, cuenta desde el paso en el que el evento se disparó, y la tabla vale desde el paso siguiente.',
      remove: 'Quitar los datos del golpe de ariete',
      pump: {
        notCurve: 'Una tabla de velocidad o una parada necesita la bomba en marcha sobre su curva, y un arranque, la bomba sobre su curva, parada y cerrada (su modo y estado, arriba). Los datos de cuatro cuadrantes sirven a cualquier bomba con curva.',
        inertia: 'Momento de inercia',
        inertiaHint: 'De la bomba, el motor y el eje juntos, con el líquido del rodete. Cuanto mayor, más despacio se para la bomba después de una parada, o gana velocidad después de un arranque.',
        rpm: 'Velocidad nominal',
        power: 'Potencia en el eje a la velocidad nominal',
        powerY: 'Potencia',
        powerFromEff: 'Sin una curva de potencia, la parada o el arranque toma la potencia en el eje de las curvas de altura y de rendimiento.',
        addPower: 'Añadir una curva de potencia',
        motor: 'Par del motor',
        motorHint: 'El par del motor según su velocidad, de su hoja de datos: el par de arranque en 0 %, en general un pico cerca de la velocidad nominal, y cero a la velocidad síncrona. Entre los puntos va en línea recta; después del último punto mantiene el último par.',
        motorSpeed: 'Velocidad (% de la nominal)',
        motorTorque: 'Par',
        four: 'Datos de cuatro cuadrantes',
        fourHint: 'La altura y el par de la bomba en todos los cuadrantes, de sus curvas de Suter WH(θ) y WB(θ), que da su fabricante. Con ellas, una parada o un arranque deja volver el caudal y la velocidad (solo una retención de la bomba sujeta el caudal), y una bomba parada y cerrada puede arrancar por una tabla de velocidad. Pump It no trae ninguna tabla publicada: los datos son suyos.',
        fourRef: 'Punto de referencia',
        fourRefs: { steady: 'El régimen permanente de la bomba', bep: 'Su mejor rendimiento a la velocidad nominal', user: 'Dado' },
        fourRefHint: 'El punto que da a la tabla sus dimensiones: Q_R, H_R, el par T_R y N_R. El régimen permanente de la bomba la necesita en marcha. La tabla se escala para encontrar el régimen permanente, con una precaución por encima del 5 %.',
        fourQ: 'Caudal Q_R (por bomba)',
        fourH: 'Altura H_R',
        fourN: 'Velocidad N_R',
        fourP: 'Potencia en el eje P_R',
        fourTable: 'Curvas de Suter',
        fourTheta: 'θ (°)',
        fourTableHint: 'WH = h/(α² + v²) y WB = β/(α² + v²) contra θ = π + atan2(v, α), con α = N/N_R, v = Q/Q_R, h = H/H_R y β = T/T_R: de 0 a 360°, al menos 9 puntos, los valores de 360° iguales a los de 0°. Entre los puntos, en línea recta.',
        fourReverse: 'Sin una retención propia (en sus datos del régimen permanente), el caudal y la velocidad pueden volver en el transitorio.',
      },
      control: {
        mode: 'En el golpe de ariete',
        modes: { frozen: 'Congelada en la pérdida del permanente', ideal: 'Controlando en cada paso' },
        hint: 'Congelada: la válvula mantiene la pérdida del régimen permanente, como una válvula fija. Controlando: mantiene su consigna en cada paso, como lo haría un controlador ideal, y una tabla puede cambiar la consigna.',
        rate: 'Velocidad máxima de la apertura',
        rateHint: 'Opcional, en % de la apertura total por segundo, al abrir y al cerrar: la válvula sigue la apertura que pide su control sin ir más rápido que esto, y mientras se queda atrás es una válvula fija en la apertura a la que llegó. Necesita la característica de la válvula (arriba). Vacío: sin límite.',
      },
      check: {
        model: 'Modelo en el golpe de ariete',
        models: { none: 'Instantánea', decel: 'Por deceleración', swing: 'Clapeta con su inercia', nozzle: 'Disco deslizante' },
        modelHints: {
          none: 'La válvula del régimen permanente: cierra en el paso en que la velocidad a su entrada baja de su velocidad de cierre, y abre de nuevo cuando la diferencia de presión alcanza su diferencia de reapertura.',
          decel: 'Por una tabla de la válvula: la velocidad inversa a la que cierra contra la deceleración del líquido cuando el caudal se invierte. Hasta entonces queda abierta con el caudal inverso.',
          swing: 'Un disco sobre una bisagra, movido por la presión a su través, su peso y un contrapeso, un muelle y un amortiguador opcionales: la válvula cierra cuando el disco llega a su asiento, y su pérdida sigue la fracción del Cv en su ángulo.',
          nozzle: 'Un disco que se desliza a lo largo del eje contra un muelle: la válvula cierra cuando el disco llega a su asiento, y su pérdida sigue la fracción del Cv en su carrera.',
        },
        quadratic: 'Los modelos dinámicos necesitan una pérdida cuadrática en apertura total: K, Cv o Kv (la pérdida de la válvula, arriba).',
        decel: 'Velocidad inversa al cierre',
        decelAd: 'Deceleración',
        decelVR: 'Velocidad inversa',
        decelHint: 'De la hoja de datos de la válvula: la velocidad inversa del líquido a la que cierra, contra la deceleración del caudal. Entre los puntos en línea recta; fuera de la tabla, los valores de sus extremos, con una precaución.',
        window: 'Ventana de la deceleración',
        windowHint: 'Cuando el caudal se invierte, la deceleración es la pendiente de la velocidad en los pasos de este último tramo de tiempo, por mínimos cuadrados. 0,1 s por defecto.',
        fields: {
          thetaMax: 'Ángulo de apertura total', seat: 'Inclinación del asiento', I: 'Momento de inercia', md: 'Masa del disco y su brazo', rcg: 'Distancia de la bisagra al centro de masa',
          Ad: 'Área del disco', rp: 'Brazo de la fuerza de presión', Ts0: 'Par del muelle con la válvula cerrada', ks: 'Rigidez del muelle', c: 'Amortiguamiento', Wc: 'Peso del contrapeso',
          rc: 'Brazo del contrapeso', delta: 'Ángulo del contrapeso respecto al brazo', xMax: 'Carrera de apertura total', m: 'Masa del disco', F0: 'Fuerza del muelle con la válvula cerrada',
          k: 'Rigidez del muelle', cLinear: 'Amortiguamiento', mf: 'Masa de líquido desplazada', rhoM: 'Densidad del material del disco', phi: 'Ángulo de la válvula',
        },
        hints: {
          thetaMax: 'Desde el asiento (0) hasta el tope del disco totalmente abierto.',
          seat: 'La inclinación del asiento: con la posición de la válvula, fija cómo el peso del disco la cierra.',
          I: 'Del disco, su brazo y el contrapeso alrededor de la bisagra, con el líquido que arrastra si usted lo cuenta.',
          rcg: 'El peso del disco y su brazo actúa a esta distancia de la bisagra.',
          Ad: 'Vacío: el área del tubo de entrada.',
          rp: 'Donde la diferencia de presión actúa sobre el disco. Vacío: en el centro de masa.',
          Ts0: 'Opcional (vacío: sin muelle): el par del muelle en el asiento, que crece con el ángulo por su rigidez.',
          c: 'Opcional (vacío: ninguno): una resistencia contra la velocidad del disco.',
          Wc: 'Opcional (vacío: ninguno), con su brazo y su ángulo respecto al brazo del disco.',
          xMax: 'Desde el asiento hasta el tope del disco totalmente abierto.',
          m: 'Del disco que se mueve: su inercia y su peso.',
          F0: 'Opcional (vacío: sin muelle): la fuerza del muelle en el asiento, que crece con la carrera por su rigidez.',
        },
        fluidMass: 'Empuje',
        fluidMasses: { none: 'Ninguno', user: 'Una masa de líquido dada', calculated: 'Por la densidad del disco' },
        fluidMassHint: 'El líquido que desplaza el disco le quita parte de su peso: m_f = ρ·m/ρ_m con la densidad del disco (7850 kg/m³, acero, por defecto), o una masa que usted da.',
        orient: 'Posición de la válvula',
        orients: { horizontal: 'Horizontal', vertical: 'Vertical, con el flujo hacia arriba', angle: 'Con un ángulo' },
        orientHint: 'Cómo actúa el peso del disco: horizontal (0°), vertical con el flujo hacia arriba (90°) o un ángulo de −90° a 90°.',
        cvTable: 'Fracción del Cv',
        cvAngle: 'Ángulo desde el asiento',
        cvTravel: 'Carrera desde el asiento',
        cvFrac: 'Fracción del Cv en apertura total',
        cvHint: 'Desde (0, 0 %) en el asiento hasta (apertura total, 100 %), en línea recta. La pérdida en una posición es la de la válvula totalmente abierta dividida por el cuadrado de la fracción.',
      },
    },
    // los datos de los dispositivos de protección y de los extremos especiales, en la sección de golpe de ariete de una unión
    device: {
      shape: 'Forma',
      shapes: { none: 'Sin geometría: el gas a la presión del nodo', constant: 'Sección constante', table: 'Volumen por altura' },
      shapeHint: 'La sección del tanque, constante o dada por una tabla de volumen según la altura sobre su fondo.',
      shapeVesselHint: 'Sin geometría, el gas está a la presión del nodo. Con ella, el nivel del líquido en el calderín suma su columna a la presión del gas.',
      area: 'Sección',
      h: 'Altura sobre el fondo',
      V: 'Volumen',
      bottom: 'Cota del fondo',
      bottomHint: 'Vacío: a la cota de la unión.',
      height: 'Altura hasta el borde',
      heightHint: 'Por encima de ella el tanque rebosa y su nivel queda en el borde. Opcional con sección constante (vacío: sin borde); una tabla llega hasta ella.',
      heightVessel: 'Altura del calderín',
      heightVesselHint: 'De su fondo a su parte superior: con la forma, da el volumen del calderín.',
      oneWay: 'Unidireccional: solo alimenta la red',
      oneWayHint: 'Una retención deja que el líquido solo salga del tanque: alimenta la red cuando la presión baja, y queda cerrado mientras la presión está por encima de su nivel.',
      orifice: 'Un orificio en la conexión',
      orificeHint: 'Una pérdida entre el nodo y el tanque o el calderín, propia en cada sentido: ΔP = ṁ|ṁ|/(2ρ(Cd·A)²).',
      CdAin: 'Cd·A del caudal que entra',
      CdAout: 'Cd·A del caudal que sale',
      riser: 'Un tubo corto con su inercia',
      riserHint: 'Un tubo corto entre el nodo y el tanque o el calderín, cuya columna acelera el caudal: (L/A)·dṁ/dt = la presión del nodo − la del dispositivo − sus pérdidas.',
      riserL: 'Longitud del tubo corto',
      riserD: 'Diámetro del tubo corto',
      riserF: 'Factor de fricción del tubo corto',
      n: 'Exponente politrópico n',
      nHint: 'P·Vⁿ queda constante para el gas: 1 para un gas isotérmico, 1,4 para el aire sin intercambio de calor. El valor habitual es 1,2.',
      gasInit: 'Gas en el régimen permanente',
      gasInits: { given: 'Su volumen', precharge: 'Por la precarga' },
      gasInitHint: 'El volumen del gas a la presión del régimen permanente, o la precarga del calderín (la presión y el volumen de su gas antes de llenarlo), de la que el volumen sale a temperatura constante.',
      Vg0: 'Volumen de gas en el régimen permanente',
      Ppre: 'Presión de precarga',
      Vpre: 'Volumen de precarga',
      vol: 'Volumen del calderín',
      volHint: 'Opcional: el gas no pasa de él. Un calderín cuyo gas lo ocupa todo da un aviso, y el nodo mantiene la presión del gas.',
      vgMin: 'Menor volumen de gas',
      vgMinHint: 'Opcional: el calderín no recibe más líquido cuando su gas baja a este volumen.',
      mode: 'Apertura',
      modes: { pressure: 'Con la presión', instant: 'De una vez' },
      modeHint: 'Con la presión: cerrada, abre cuando la presión del nodo pasa de la presión de tarado; abierta, su Cv crece en línea recta desde 0 a la presión de cierre hasta el total a la presión de apertura total, y cierra a la presión de cierre. De una vez: totalmente abierta por encima de la presión de tarado, cerrada por debajo de la presión de cierre. Una tabla de su apertura, en los datos de abajo, la manda en su lugar, como una válvula piloto.',
      Pset: 'Presión de tarado (abre)',
      Pfull: 'Presión de apertura total',
      Pclose: 'Presión de cierre',
      PcloseHint: 'No por encima de la presión de tarado. Vacío: la presión de tarado.',
      capacity: 'Capacidad totalmente abierta',
      capacities: { Cv: 'Cv (EE. UU.)', Kv: 'Kv (métrico)', CdA: 'Cd·A' },
      Pext: 'Presión exterior',
      rate: 'Mayor velocidad de la apertura',
      rateHint: 'Opcional, en % de la apertura total por segundo, al abrir y al cerrar. Vacío: sin límite.',
      avType: 'Tipo',
      avTypes: { both: 'Admite y expulsa aire', in: 'Solo admite aire', out: 'Solo expulsa aire', twoStage: 'Admite y expulsa, con una salida menor en una segunda etapa' },
      airIn: 'Cd·A de la entrada de aire',
      airOut: 'Cd·A de la salida de aire',
      airOut2: 'Cd·A de la salida menor',
      switchBy: 'La salida menor entra',
      switchBys: { dP: 'Por encima de una diferencia de presión', flow: 'Por encima de un caudal de aire' },
      switchHint: 'Mientras el aire sale, la salida grande cierra y la pequeña entra cuando la diferencia con el exterior, o el caudal de aire, pasa de este valor; sigue así hasta que el aire sale del todo.',
      switchDP: 'Diferencia de presión',
      switchFlow: 'Caudal de aire',
      Popen: 'Presión de apertura',
      PopenHint: 'La ventosa admite aire cuando la presión del nodo baja por debajo de ella. Vacío: la presión atmosférica.',
      Tair: 'Temperatura del aire',
      TairHint: 'Del aire de fuera y del aire en la ventosa. Vacío: la del líquido.',
      mAir0: 'Aire en el régimen permanente',
      mAir0Hint: 'Aire ya retenido en el nodo cuando empieza la corrida, en general ninguno.',
      special: 'Su extremo en el golpe de ariete',
      specials: { none: 'Como está (una tabla puede mandarlo)', infinitePipe: 'Un tubo infinito: sin reflexión' },
      specialHint: 'Un tubo infinito deja salir las ondas de la red por este extremo, como si el tubo siguiera sin fin: el extremo mantiene la característica del régimen permanente. Sus tablas no se usan, y su tubo necesita al menos 2 secciones.',
    },
    overlay: {
      P: 'Golpe de ariete: presión estática en el cursor',
      HGL: 'Golpe de ariete: HGL en el cursor',
      Pmax: 'Golpe de ariete: mayor presión estática',
      Pmin: 'Golpe de ariete: menor presión estática',
      titleP: 'Presión estática media en el cursor',
      titleHGL: 'HGL media en el cursor',
      titlePmax: 'Mayor presión estática de la corrida',
      titlePmin: 'Menor presión estática de la corrida',
    },
    charts: {
      tabs: { time: 'Golpe de ariete en el tiempo', profile: 'Envolventes del golpe' },
      noRun: 'Active el golpe de ariete y complete la lista de verificación para ver sus gráficos.',
      object: 'Objeto',
      stations: 'Estaciones de tubos',
      junctions: 'Uniones',
      station: '{pipe} · estación {i} de {n}',
      quantity: 'Magnitud',
      q: { p: 'Presión estática', P0: 'Presión de estancamiento', HGL: 'Línea piezométrica', m: 'Caudal másico', Q: 'Caudal volumétrico', V: 'Volumen de vapor', Vg: 'Volumen de gas', F: 'Fuerza' },
      force: 'Fuerza {name}',
      forces: 'Conjuntos de fuerzas',
      add: 'Añadir al gráfico',
      remove: 'Quitar la serie',
      choose: 'Elija un objeto y una magnitud y añádalos al gráfico.',
      unit: 'Unidad',
      timeAxis: 'Tiempo (s)',
      cursorNote: 'Las marcas muestran el instante del cursor: {t}.',
      pressures: 'Presiones estáticas',
      pathOff: 'El camino pasa por {pipe}, que no entra en el golpe de ariete (cerrado o aislado).',
      hglMax: 'Mayor HGL',
      hglMin: 'Menor HGL',
      pMax: 'Mayor presión estática',
      pMin: 'Menor presión estática',
      steady: 'Régimen permanente',
      atCursor: 'En {t}',
      envelopes: 'Envolventes del golpe de ariete',
      profileNotes: 'Camino: {path} · {length} {u}. Los mayores y menores valores cubren todas las estaciones y todos los pasos; la línea del cursor pasa por las estaciones de salida. Las líneas piezométricas usan presión absoluta.',
      vaporReached: 'La menor presión llega a la presión de vapor en {pipes}.',
    },
    results: {
      tabs: { surge: 'Golpe de ariete', surgeEnv: 'Envolventes', surgeLog: 'Registro de eventos' },
      summary: 'Golpe de ariete',
      summaryHint: 'El régimen permanente sigue siendo el instante 0 s de las demás tablas.',
      dt: 'Paso de tiempo',
      steps: 'Pasos',
      recorded: '{n} guardados',
      duration: 'Duración',
      elapsed: 'Calculado en',
      test: 'Paso de prueba',
      testOk: 'superado (mayor cambio de {p} % en la presión, {m} % en el caudal)',
      testFailed: 'transitorio artificial por encima de {criterion} %: vea los avisos',
      cavitation: 'Cavitación',
      noModel: 'sin modelo',
      cavitated: '{n} lugares cavitaron, el primero en {t}',
      noCavity: 'ninguna cavidad',
      gasModel: 'cavidades de gas: la presión queda por encima de la presión de vapor (los mayores volúmenes de gas están en las envolventes)',
      stoppedAt: 'Se detuvo en',
      sectioning: 'Secciones',
      sectioningHint: 'Por tubo: longitud, velocidad de onda, secciones, velocidad ajustada, varianza y coeficiente de fricción.',
      junctions: 'Uniones',
      junctionsHint: 'El mayor y el menor valor de cada magnitud, con el primer instante en que se alcanza.',
      four: {
        QR: 'Cuatro cuadrantes ({ref}): caudal Q_R por bomba', HR: 'Cuatro cuadrantes ({ref}): altura H_R', TR: 'Cuatro cuadrantes ({ref}): par T_R', NR: 'Cuatro cuadrantes ({ref}): velocidad N_R',
        cH: 'Cuatro cuadrantes: escala c_H de la altura', cB: 'Cuatro cuadrantes: escala c_B del par',
        refs: { steady: 'régimen permanente', bep: 'mejor rendimiento', user: 'dado' },
      },
      forces: 'Fuerzas desequilibradas',
      forcesHint: 'La fuerza axial de cada conjunto de fuerzas: su valor en el régimen permanente, la mayor y la menor con el primer instante, y su variación de pico a pico.',
      envelopes: 'Envolventes de los tubos',
      envelopesHint: 'La mayor y la menor presión estática de cada tubo, en todas sus estaciones y todos los pasos, con dónde y cuándo. En rojo: hasta la presión de vapor.',
      stations: 'Estaciones de un tubo',
      pipe: 'Tubo',
      log: 'Registro de eventos',
      logHint: 'Eventos, estados de dispositivos y cavidades, en el orden del tiempo.',
      noEvents: 'No ocurrió nada aparte del propio transitorio.',
      warnings: 'Golpe de ariete',
      noWarnings: 'El golpe de ariete no dio ningún aviso.',
      warningsHint: 'Avisos de la corrida del golpe de ariete.',
      kinds: { event: 'evento', info: 'información', warning: 'aviso' },
      fields: {
        P: 'Presión', P1: 'Presión de entrada', P2: 'Presión de salida', net: 'Caudal másico neto hacia la red', m: 'Caudal másico', s: 'Velocidad de giro', dH: 'Altura', T: 'Par', V: 'Volumen de la cavidad',
        level: 'Nivel del líquido', mt: 'Caudal hacia el tanque o el calderín', Pg: 'Presión del gas', Vg: 'Volumen del gas', mr: 'Caudal aliviado', x: 'Apertura', Va: 'Volumen de aire', ma: 'Masa de aire', mair: 'Caudal de aire que entra',
        th: 'Ángulo del disco', Td: 'Par sobre el disco', xd: 'Carrera del disco', Fd: 'Fuerza sobre el disco',
      },
      totals: { over: 'Volumen rebosado', deficit: 'Volumen que faltó (vacío)' },
      cols: {
        junction: 'Unión', quantity: 'Magnitud', max: 'Mayor', tmax: 'En', min: 'Menor', tmin: 'En',
        pipe: 'Tubo', pmax: 'Mayor presión estática', pmin: 'Menor presión estática', station: 'Estación', vmax: 'Mayor cavidad', tV: 'En',
        i: 'Estación', x: 'Distancia', steady: 'Permanente', hglMax: 'Mayor HGL', hglMin: 'Menor HGL',
        time: 'Tiempo', object: 'Objeto', message: 'Qué ocurrió',
        P0: 'presión de estancamiento', flow: 'caudal másico', timeS: 'Tiempo (s)', xm: 'Distancia (m)', tmaxS: 'Instante del mayor (s)', tminS: 'Instante del menor (s)',
        hglMaxM: 'Mayor HGL (m)', hglMinM: 'Menor HGL (m)', vmaxL: 'Mayor cavidad (L)',
        force: 'Fuerza', kind: 'Tipo', from: 'Desde', to: 'Hasta', p2p: 'Pico a pico', vmaxGas: 'Mayor volumen de gas',
      },
      sheets: { series: 'Series del golpe', envelopes: 'Envolventes del golpe', log: 'Eventos del golpe' },
    },
    checklist: {
      item: 'Golpe de ariete',
      control: {
        gas: 'el golpe de ariete es para líquidos (régimen incompresible)',
        time: 'el golpe de ariete y la simulación en el tiempo no corren juntos: desactive uno de ellos',
        duration: 'una duración mayor que cero',
        dtMode: 'paso de tiempo automático o dado',
        dt: 'un paso de tiempo mayor que cero',
        variance: 'un límite de varianza mayor que cero',
        nc: 'secciones ideales del tubo controlador: un mínimo mayor que cero y un máximo no menor que él',
        cavitation: 'un modelo de cavitación',
        vapor: 'la presión de vapor del fluido (el modelo de cavitación la necesita)',
        psi: 'peso ψ de las cavidades entre 0,5 y 1',
        cavBasis: 'la presión con la que comparan las cavidades',
        friction: 'la fricción del transitorio',
        criterion: 'un criterio del transitorio artificial de 0 o más',
        minFlow: 'un menor caudal del transitorio artificial de 0 o más',
        saveEvery: 'guardar cada N pasos (un número entero, 1 o más)',
        stations: 'las estaciones de salida de los tubos',
        size: 'estaciones × pasos por debajo de 2·10⁹ (menos secciones o una corrida más corta)',
        alpha0: 'una fracción de vacío de las cavidades de gas por encima de 0 y por debajo de 1',
        p0: 'la presión de la fracción de vacío, por encima de la presión de vapor',
        forces: 'conjuntos de fuerzas con tubos abiertos del modelo, distancias dentro de ellos y un camino entre sus estaciones',
      },
      pipe: {
        wave: 'golpe de ariete: velocidad de onda calculada o dada',
        speed: 'golpe de ariete: una velocidad de onda mayor que cero',
        support: 'golpe de ariete: cómo está sujeto el tubo',
        circular: 'golpe de ariete: una velocidad de onda dada (el cálculo necesita una sección circular)',
        fluidK: 'golpe de ariete: el módulo de compresibilidad del fluido (propiedades del sistema)',
        E: 'golpe de ariete: el módulo de elasticidad de la pared',
        wall: 'golpe de ariete: el espesor de la pared',
        nu: 'golpe de ariete: coeficiente de Poisson de 0 a menos de 0,5',
        c1: 'golpe de ariete: un coeficiente c₁ mayor que cero',
        G: 'golpe de ariete: el módulo de rigidez de la roca',
        buriedPct: 'golpe de ariete: el aumento del tubo enterrado',
        diameter: 'golpe de ariete: el diámetro interior',
        stations: 'golpe de ariete: las estaciones de salida',
        pMax: 'golpe de ariete: la presión máxima como una presión',
        k: 'golpe de ariete: un coeficiente de Brunone de 0 o más (vacío: por el número de Reynolds)',
      },
      data: {
        what: 'datos del golpe de ariete: una magnitud que esta unión acepta',
        tripStart: 'datos del golpe de ariete: la parada o el arranque en un instante o en un evento',
        tripAt: 'datos del golpe de ariete: el instante de la parada o del arranque, 0 o después',
        basis: 'datos del golpe de ariete: valores absolutos o relativos',
        start: 'datos del golpe de ariete: cómo empieza la tabla',
        interp: 'datos del golpe de ariete: interpolación',
        resume: 'datos del golpe de ariete: dónde empieza una tabla después de su evento',
        conditions: 'datos del golpe de ariete: la condición de cada evento',
        combined: 'datos del golpe de ariete: un evento completo del modelo',
        tables: 'datos del golpe de ariete: una tabla por evento',
        table: 'datos del golpe de ariete: tablas con números y unidades',
        order: 'datos del golpe de ariete: tiempos de la tabla desde 0, nunca decrecientes',
        eventStart: 'datos del golpe de ariete: una tabla iniciada por un evento empieza en el tiempo 0',
        period: 'datos del golpe de ariete: una tabla repetida necesita su último tiempo después del primero',
        negative: 'datos del golpe de ariete: ningún valor negativo',
        relStart: 'datos del golpe de ariete: una tabla relativa empieza en 100 % (el valor permanente)',
        repeatEnds: 'datos del golpe de ariete: una tabla repetida termina con el valor con el que empieza',
        relSpecial: 'datos del golpe de ariete: ninguna tabla relativa en una unión que su condición especial cierra',
        specialStart: 'datos del golpe de ariete: cerrada por su condición especial, la primera tabla empieza cerrada',
        range: 'datos del golpe de ariete: una apertura entre 0 y 100 %',
        noSteady: 'datos del golpe de ariete: un valor permanente de la magnitud de la tabla',
      },
      pump: {
        mode: 'golpe de ariete: una tabla o una parada necesita la bomba en marcha sobre su curva (con los datos de cuatro cuadrantes, una tabla de velocidad también puede arrancarla desde el reposo)',
        inertia: 'golpe de ariete: el momento de inercia de la bomba (parada o arranque)',
        rpm: 'golpe de ariete: la velocidad nominal de la bomba (parada o arranque)',
        power: 'golpe de ariete: una curva de potencia en el eje o de rendimiento (parada o arranque)',
        startState: 'golpe de ariete: un arranque necesita la bomba sobre su curva, parada y cerrada',
        curve: 'golpe de ariete: la curva de altura de la bomba (arranque)',
        motor: 'golpe de ariete: la tabla del par del motor, desde 0 %, con velocidades crecientes y un par de arranque por encima de cero (arranque)',
        fourTable: 'golpe de ariete: una tabla de cuatro cuadrantes de θ, WH y WB de 0 a 360°, al menos 9 puntos, los valores de 360° iguales a los de 0°',
        fourRef: 'golpe de ariete: el punto de referencia de los datos de cuatro cuadrantes',
        fourSteady: 'golpe de ariete: la referencia del régimen permanente necesita la bomba en marcha',
        fourBep: 'golpe de ariete: una curva de rendimiento o de potencia en el eje, para el punto de mejor rendimiento',
        fourUser: 'golpe de ariete: el caudal, la altura, la velocidad y la potencia en el eje del punto de referencia',
      },
      valve: {
        rate: 'golpe de ariete: una velocidad máxima de la apertura por encima de cero',
        char: 'golpe de ariete: la característica de la válvula, que su velocidad máxima necesita',
      },
      check: {
        model: 'golpe de ariete: un modelo de la retención',
        loss: 'golpe de ariete: una pérdida cuadrática en apertura total (K, Cv o Kv) para su modelo dinámico',
        decel: 'golpe de ariete: una tabla de la velocidad inversa contra la deceleración, al menos 2 puntos, las deceleraciones creciendo desde 0',
        window: 'golpe de ariete: una ventana de la deceleración por encima de cero',
        disc: 'golpe de ariete: los datos del disco',
        stop: 'golpe de ariete: la apertura total del disco por encima de cero (un ángulo hasta 180°)',
        inertia: 'golpe de ariete: el momento de inercia o la masa del disco por encima de cero',
        weight: 'golpe de ariete: la masa del disco y la distancia a su centro de masa',
        optional: 'golpe de ariete: los campos opcionales del disco como números (muelles, amortiguadores y pesos de 0 o más), o vacíos',
        cvTable: 'golpe de ariete: una tabla de la fracción del Cv desde (0, 0 %) hasta (apertura total, 100 %), con las posiciones crecientes',
        fluidMass: 'golpe de ariete: el empuje del disco',
        orient: 'golpe de ariete: la posición de la válvula, un ángulo de −90° a 90°',
      },
      belowVapor: 'golpe de ariete: una presión fija por encima de la presión de vapor del fluido',
      device: {
        area: 'golpe de ariete: la sección del tanque',
        table: 'golpe de ariete: una tabla de volumen por altura desde 0, las dos crecientes',
        tableShort: 'golpe de ariete: una tabla de volumen por altura hasta el borde',
        bottom: 'golpe de ariete: la cota del fondo como una longitud',
        height: 'golpe de ariete: una altura mayor que cero',
        orifice: 'golpe de ariete: el Cd·A del orificio en cada sentido',
        riser: 'golpe de ariete: la longitud, el diámetro y el factor de fricción del tubo corto',
        n: 'golpe de ariete: un exponente politrópico de 1 a 1,4',
        precharge: 'golpe de ariete: la presión y el volumen de la precarga',
        Vg0: 'golpe de ariete: el volumen de gas del régimen permanente',
        vol: 'golpe de ariete: el volumen del calderín',
        vgMin: 'golpe de ariete: un menor volumen de gas de 0 o más',
        Pset: 'golpe de ariete: la presión de tarado',
        Pext: 'golpe de ariete: la presión exterior',
        capacity: 'golpe de ariete: la capacidad de la válvula totalmente abierta',
        rate: 'golpe de ariete: una mayor velocidad de la apertura mayor que cero',
        Pclose: 'golpe de ariete: una presión de cierre no mayor que la presión de tarado',
        Pfull: 'golpe de ariete: una presión de apertura total mayor que la presión de tarado',
        avType: 'golpe de ariete: el tipo de la ventosa',
        CdAin: 'golpe de ariete: el Cd·A de la entrada de aire',
        CdAout: 'golpe de ariete: el Cd·A de la salida de aire',
        CdAout2: 'golpe de ariete: el Cd·A de la salida menor',
        switch: 'golpe de ariete: cuándo entra la salida menor',
        Popen: 'golpe de ariete: la presión de apertura como una presión',
        Tair: 'golpe de ariete: la temperatura del aire (el fluido no tiene una)',
        mAir0: 'golpe de ariete: el aire del régimen permanente, 0 o más',
      },
    },
  },
  // the chapter of the help (src/ui/help/help.js), with the module
  help: {
    chapters: {
      surge: {
        title: 'Golpe de ariete',
        sections: {
          concept: {
            title: 'Cómo funciona',
            body: `<p>Un cambio rápido en una red de líquido, como una válvula que cierra, una bomba que se para o un nivel que salta, manda ondas de presión por los tubos a la velocidad del sonido en el tubo, a menudo cerca de 1000 m/s. El golpe de ariete sigue esas ondas desde el régimen permanente del escenario. Es un módulo propio: solo calcula mientras está activado, y el resto del programa funciona igual sin él.</p>
<ul>
<li>Es para líquidos, en el régimen incompresible. Él y la [[go:time.concept|simulación en el tiempo]] no corren juntos: activar uno desactiva el otro.</li>
<li>El régimen permanente queda como está en todas las tablas, tarjetas y gráficos, y es el instante 0 s del golpe de ariete.</li>
<li>Después de cada cambio, el régimen permanente llega enseguida y el golpe de ariete sigue en segundo plano. El sello [[t:surge.stamp.label]], junto al título del modelo, muestra su progreso; el botón de al lado detiene la corrida, y lo ya calculado se queda.</li>
</ul>
<p class="tip"><b>Cuándo usarlo:</b> cuando algo cambia en un tiempo comparable con 2·L/a de los tubos, unos segundos para un tubo de algunos kilómetros: una válvula que cierra deprisa, una bomba que se para sin volante, una retención que golpea.</p>`,
          },
          control: {
            title: 'Control de la corrida',
            body: `<p>En la ventana [[t:inspector.system.title]], sección [[t:surge.system.title]]:</p>
<ul>
<li>[[t:surge.system.on]]: activa el módulo en el escenario. Desactivado, sus datos se quedan en el modelo y no se usan.</li>
<li>[[t:surge.system.duration]]: cuánto tiempo se sigue el transitorio.</li>
<li>[[t:surge.system.dtMode]]: [[t:surge.system.dtModes.auto]] halla el paso en el que cabe un número entero de secciones en cada tubo, ajustando cada velocidad de onda como mucho en el [[t:surge.system.varianceMax]]; [[t:surge.system.dtModes.given]] usa el paso que usted escribe.</li>
<li>[[t:surge.system.cavitation]]: [[t:surge.system.cavitations.dvcm]], [[t:surge.system.cavitations.dgcm]] (cada estación guarda un poco de gas libre; elegirlas lleva ψ a 0,95, y la fracción de vacío y su presión están en las opciones avanzadas), o [[t:surge.system.cavitations.none]].</li>
<li>[[t:surge.system.friction]]: [[t:surge.system.frictions.steady]], [[t:surge.system.frictions.variable]], que vuelve a calcular el factor de fricción de cada estación por su caudal, con la correlación del régimen permanente, cuando su velocidad cambia más de un 1 %, o [[t:surge.system.frictions.brunone]], que suma la fricción transitoria de la aceleración del líquido.</li>
<li>[[t:surge.system.saveEvery]] y [[t:surge.system.stations]]: lo que se guarda en el tiempo. Las mayores y menores presiones cubren siempre todas las estaciones y todos los pasos.</li>
<li>[[t:surge.system.fluidK]]: para el agua, sale de su temperatura; un fluido propio lo necesita.</li>
</ul>
<p>La tabla [[t:surge.system.sectioning]] muestra, para cada tubo, la longitud, la velocidad de onda, las secciones, la velocidad ajustada y la varianza, y debajo el paso de tiempo, las estaciones, los pasos y una estimación del tiempo de la corrida. Sigue cada cambio, y una fila lleva a su tubo.</p>
<p>La sección [[t:surge.system.forces]] guarda los conjuntos de fuerzas: la fuerza axial del líquido en un tramo entre dos estaciones, en una estación o en una salida, para el diseño de los apoyos. Cada conjunto muestra la estación que toma su distancia, y su fuerza aparece en los resultados y en los gráficos.</p>
<p>La sección [[t:surge.system.advanced]] guarda el peso ψ de las cavidades, la presión con la que comparan y la prueba del [[go:surge.method|transitorio artificial]]. Debajo vienen los eventos del modelo, con los que puede empezar una tabla o una parada.</p>
<p>El control pertenece a la solución del escenario, así que un [[go:scenarios.concept|escenario hijo]] puede cambiarlo, por ejemplo para probar un cierre más lento.</p>`,
          },
          wave: {
            title: 'Velocidad de onda de un tubo',
            body: `<p>Con el golpe de ariete activado, cada tubo muestra la sección [[t:surge.pipe.title]] en el panel de propiedades. La velocidad de onda es [[t:surge.pipe.waves.calculated]], a partir del líquido y de la pared:</p>
[[eq:waveSpeed]]
<p>K es el módulo de compresibilidad del líquido, D el diámetro interior, e el espesor de la pared y E su módulo de elasticidad. El coeficiente c₁ sigue [[t:surge.pipe.support]], con el coeficiente de Poisson ν de la pared. Para pared delgada:</p>
[[eq:waveC1]]
<p>Para pared gruesa, con k el término de la pared delgada sujeta de la misma forma:</p>
[[eq:waveC1Thick]]
<p>Para un túnel, con G el módulo de rigidez de la roca:</p>
[[eq:waveTunnel]]
<ul>
<li>Vacíos, E, ν y la pared toman los valores típicos del material del catálogo y la pared de su tamaño, mostrados en gris. [[t:surge.pipe.typical]] llena E y ν con otro material.</li>
<li>Un tubo enterrado toma la velocidad de la pared delgada anclada en toda su longitud, aumentada en el porcentaje que usted dé.</li>
<li>[[t:surge.pipe.waves.given]]: escriba la velocidad. Es el único camino para un tubo que no es circular.</li>
</ul>
<p>Debajo, el tubo muestra las secciones que toma en la corrida con su velocidad ajustada y su varianza, sus [[t:surge.pipe.stations]], y una [[t:surge.pipe.pMax]] opcional, que da un aviso cuando la corrida la supera. Con la fricción [[t:surge.system.frictions.brunone]] también toma su [[t:surge.pipe.k]], vacío para que venga del número de Reynolds de su caudal permanente.</p>`,
          },
          data: {
            title: 'Datos de las uniones',
            body: `<p>Con el golpe de ariete activado, una unión muestra la sección [[t:surge.junction.title]] en el panel de propiedades, con lo que la mueve en el transitorio. Estos datos se guardan aparte de los [[go:time.data|datos en el tiempo]] de la simulación en el tiempo, así que un modelo guarda los dos.</p>
<ul>
<li>Una tabla de una de sus magnitudes en el tiempo, como en la simulación en el tiempo: la apertura, el K, el Cv o el Kv de una válvula; el caudal o la presión impuestos; el nivel o la presión en la superficie de un reservorio; la velocidad de una bomba; la consigna de una válvula de control que esté [[t:surge.junction.control.modes.ideal]].</li>
<li>La parada de una bomba: desde entonces el motor no da par, y la bomba pierde velocidad por su inercia. Necesita el [[t:surge.junction.pump.inertia]], la [[t:surge.junction.pump.rpm]] y la potencia en el eje a esa velocidad, por una curva de potencia o por las curvas de altura y de rendimiento.</li>
<li>El arranque de una bomba sobre su curva, parada y cerrada en el régimen permanente: desde entonces el motor da el par de su tabla, [[t:surge.junction.pump.motor]], según su velocidad, y la bomba gana velocidad por su inercia. Necesita los mismos datos que la parada y esa tabla.</li>
<li>Los [[t:surge.junction.pump.four]] de una bomba con curva: sus curvas de Suter, del fabricante, que dan la altura y el par en todos los cuadrantes. Una parada o un arranque deja entonces volver el caudal y la velocidad, y una bomba parada y cerrada también puede arrancar por una tabla de velocidad.</li>
<li>Para una retención, un [[t:surge.junction.check.model]] distinto de [[t:surge.junction.check.models.none]]: [[t:surge.junction.check.models.decel]] (una tabla de la válvula), [[t:surge.junction.check.models.swing]] o [[t:surge.junction.check.models.nozzle]], con los datos de su disco.</li>
</ul>
<p>Una tabla empieza por el reloj o después de un evento, con el mismo editor de condiciones de la simulación en el tiempo; una parada o un arranque ocurre en un instante o en un evento. Los eventos del modelo se editan en la ventana del sistema, debajo del golpe de ariete.</p>
<ul>
<li>Una presión o un caudal impuesto puede ser [[t:surge.device.specials.infinitePipe]] ([[t:surge.device.special]]): las ondas salen de la red por allí, como si su tubo siguiera sin fin. El extremo mantiene la característica del régimen permanente, P = C<sub>E</sub> − B·ṁ con C<sub>E</sub> = P<sub>0</sub> + B·ṁ<sub>0</sub>, y sus tablas no se usan.</li>
<li>Un depósito que es un tanque finito (los datos de su tanque, como en la [[go:time.tanks|simulación en el tiempo]]) tiene su nivel calculado por el caudal que entra y sale, con la regla del trapecio; rebosa por su borde, y una vez vacío se cuenta el líquido que falta. Solo la presión en la superficie de un tanque abierto admite una tabla; un tanque cerrado tiene la presión de su gas. Su sección en el inspector aparece con el golpe de ariete activado; la corrida parte del nivel del régimen permanente, que tiene que quedar por encima del extremo de un tubo por el que el régimen permanente saca líquido.</li>
</ul>
<h4>Dispositivos</h4>
<ul>
<li>Una válvula de retención cierra cuando el caudal volvería, y abre de nuevo cuando la presión empuja hacia delante; sus modelos dinámicos la cierran por la deceleración del líquido o por el movimiento de su disco.</li>
<li>Una válvula de control queda [[t:surge.junction.control.modes.frozen]], una válvula fija con la pérdida del régimen permanente, o [[t:surge.junction.control.modes.ideal]], manteniendo su consigna en cada paso, con una [[t:surge.junction.control.rate]] opcional, que necesita su característica.</li>
<li>Una bomba que se paró o arrancó no deja volver el caudal, como una retención, salvo que tenga sus [[t:surge.junction.pump.four]].</li>
<li>Una boquilla solo descarga hacia fuera.</li>
</ul>`,
          },
          devices: {
            title: 'Dispositivos de protección',
            body: `<p>El grupo [[t:junctions.groups.protection]] de la paleta tiene cuatro uniones hechas para amortiguar un golpe de ariete. En el régimen permanente cada una es un nodo sin pérdidas (la válvula de alivio cerrada, la ventosa sin aire); sus datos están en la sección [[t:surge.junction.title]] del inspector, con el golpe de ariete activado.</p>
<h4>[[t:junctions.surgeTank.label]]</h4>
<p>Un tanque abierto sobre el nodo. Su nivel oscila con el líquido que entra y sale, que la regla del trapecio integra junto con el nodo en cada paso:</p>
[[eq:surgeTank]]
<p>Su nivel en el régimen permanente es el de la presión del nodo, o uno dado (el tanque es entonces una referencia de presión). Su sección es constante o una tabla de volumen por altura; por encima de su borde rebosa, y en su fondo se vacía y solo deja que el líquido vuelva. Un orificio suma una pérdida propia en cada sentido, y un tubo corto la inercia de su columna:</p>
[[eq:surgeRiser]]
<p>Unidireccional, una retención deja que solo alimente la red.</p>
<h4>[[t:junctions.airVessel.label]]</h4>
<p>Un recipiente cerrado cuyo gas el líquido comprime y expande, politrópico con el exponente n (1,2 por defecto):</p>
[[eq:airVessel]]
<p>El gas del régimen permanente se da, o sale de la precarga a temperatura constante. Con una geometría, el nivel del líquido suma su columna a la presión del gas. El volumen del calderín y un menor volumen de gas limitan el gas; el orificio y el tubo corto son los del tanque de alivio.</p>
<h4>[[t:junctions.reliefValve.label]]</h4>
<p>Cerrada, abre cuando la presión del nodo pasa de su presión de tarado P<sub>a</sub>; abierta, su Cv crece en línea recta desde la presión de cierre hasta la presión de apertura total, y cierra a la presión de cierre:</p>
[[eq:reliefValve]]
<p>El caudal aliviado se resuelve junto con el nodo. También puede abrir de una vez, tener una mayor velocidad de apertura, o seguir una tabla de su apertura (una válvula piloto).</p>
<h4>[[t:junctions.airValve.label]]</h4>
<p>Cuando la presión del nodo baja por debajo de su presión de apertura, la ventosa admite aire, y lo expulsa de nuevo cuando la presión sube, como la modelan Wylie y Streeter: el aire queda en el nodo, ideal (R = 287,05 J/(kg·K), k = 1,4) y a temperatura constante. El caudal de aire es sónico por debajo de la razón crítica 0,52828 y subsónico por encima de ella, y a la salida igual, con los papeles cambiados:</p>
[[eq:airFlowSonic]]
[[eq:airFlowSubsonic]]
[[eq:airValveGas]]
<p>Cuando el aire termina de salir, la ventosa cierra y el nodo vuelve a ser solo líquido. Una ventosa de dos etapas expulsa el aire por un orificio menor por encima de una diferencia de presión o de un caudal de aire, lo que suaviza el último instante.</p>`,
          },
          results: {
            title: 'Resultados',
            body: `<p>Cuando termina la corrida, la vista [[t:app.tabs.out]] gana tres pestañas:</p>
<ul>
<li>[[t:surge.results.tabs.surge]]: el resumen de la corrida (paso de tiempo, pasos, paso de prueba, cavitación), las secciones de cada tubo, los extremos de las uniones, como la menor velocidad de una bomba, con la referencia de sus datos de cuatro cuadrantes, y las [[t:surge.results.forces]] de los conjuntos de fuerzas.</li>
<li>[[t:surge.results.tabs.surgeEnv]]: la mayor y la menor presión estática de cada tubo, con dónde y cuándo, y lo mismo para cada estación de un tubo que usted elija.</li>
<li>[[t:surge.results.tabs.surgeLog]]: los eventos, los cambios de estado de los dispositivos y las cavidades, en el orden del tiempo.</li>
</ul>
<p>Los avisos de la corrida se suman a los del régimen permanente. El cursor de tiempo, en la fila de las pestañas, elige el instante guardado que se muestra: [[t:surge.overlay.P]] y las demás magnitudes del golpe de ariete colorean el dibujo en ese instante, o por las envolventes de la corrida.</p>
<p>En la vista [[t:app.tabs.charts]], [[t:surge.charts.tabs.time]] dibuja series de las estaciones, de las uniones y de los conjuntos de fuerzas, y [[t:surge.charts.tabs.profile]] dibuja las mayores y menores líneas piezométricas a lo largo de un camino, con el régimen permanente, la cota de los tubos y la presión de vapor. Las series, las envolventes y el registro van al archivo de Excel con los demás resultados.</p>`,
          },
          method: {
            title: 'Método',
            body: `<p>Los tubos se resuelven por el <b>método de las características</b>. A lo largo de un tubo, con P la presión de estancamiento (absoluta) y ṁ el caudal másico, las ecuaciones de cantidad de movimiento y de continuidad del líquido:</p>
[[eq:surgeEquations]]
<p>valen a lo largo de las rectas dx/dt = ±a. Cada tubo se divide en n secciones que la onda cruza en un paso de tiempo Δt, el mismo en toda la red, y su velocidad de onda se ajusta a a′ para que esto encaje exactamente:</p>
[[eq:surgeSections]]
<p>En una estación i, las estaciones A (aguas arriba) y B (aguas abajo) del paso anterior dan dos ecuaciones de compatibilidad, con la fricción linealizada como lo hacen Wylie y Streeter:</p>
[[eq:surgeCplus]]
[[eq:surgeCminus]]
[[eq:surgeCoefficients]]
<p>R toma la pérdida del tubo en el régimen permanente, para que el régimen permanente sea una solución del método y nada se mueva mientras nada cambia. Con la fricción [[t:surge.system.frictions.variable]], cada estación tiene su propio R, la fricción de su caudal por la correlación del régimen permanente más los accesorios del régimen permanente, que se vuelve a calcular cuando su velocidad cambia más de un 1 %:</p>
[[eq:frictionVariable]]
<p>Con [[t:surge.system.frictions.brunone]], la pérdida por unidad de longitud toma además el término transitorio de Brunone en la forma de Vítkovský, con el coeficiente k de Vardy y Brown por el número de Reynolds del caudal permanente de cada tubo (o su [[t:surge.pipe.k]]):</p>
[[eq:brunone]]
<p>El término es explícito, por los caudales de los dos pasos anteriores, en la estación del pie de cada característica: la C<sup>+</sup> desde A toma CP − ΔP<sub>A</sub> y la C<sup>−</sup> desde B toma CM + ΔP<sub>B</sub>, con U<sub>j</sub> el mayor de D<sup>+</sup> y D<sup>−</sup> para un caudal hacia delante, el menor para un caudal de vuelta y su media sin caudal:</p>
[[eq:brunoneStep]]
<p>Dentro de un tubo, las dos ecuaciones dan la estación:</p>
[[eq:surgeInterior]]
<p>En los extremos, cada unión suma su propia ley a las ecuaciones de sus tubos: una presión fija, un caudal, una pérdida, la curva de una bomba o el estado de un dispositivo.</p>
<h4>Cavidades</h4>
<p>Con [[t:surge.system.cavitations.dvcm]], una estación cuya presión caería por debajo de la presión de vapor P<sub>v</sub> se queda en P<sub>v</sub>, sus dos caudales se separan, y el volumen de su cavidad los sigue:</p>
[[eq:cavityFlows]]
[[eq:cavityVolume]]
<p>Con [[t:surge.system.cavitations.dgcm]], cada estación guarda un poco de gas libre a temperatura constante, con su fracción de vacío α<sub>0</sub> dada a la presión p<sub>0</sub> (10⁻⁷ a 1 atm por defecto), media sección en los extremos de un tubo:</p>
[[eq:gasCavity]]
<p>El volumen del gas sigue los dos caudales de la estación como una cavidad de vapor, lo que da su presión por la raíz positiva de una ecuación de segundo grado; la presión nunca llega a P<sub>v</sub>. Los dispositivos de protección y las presiones fijas no guardan gas, y los lados de válvulas y bombas mantienen las cavidades de vapor.</p>
<h4>Parada de una bomba</h4>
<p>La altura de una bomba a la velocidad relativa s sigue su curva por las leyes de semejanza:</p>
[[eq:pumpCurve]]
<p>Después de una parada, la velocidad cae por el par del líquido, con I el momento de inercia, ω<sub>r</sub> la velocidad nominal y P<sub>1</sub> la potencia en el eje a la velocidad nominal:</p>
[[eq:pumpTrip]]
<p>La velocidad de cada paso sale por la regla de los trapecios, iterada con la solución del paso:</p>
[[eq:pumpTripStep]]
<h4>Arranque de una bomba</h4>
<p>Una bomba sobre su curva, parada y cerrada en el régimen permanente, puede arrancar: desde entonces el motor da el par T<sub>m</sub>(s) de su tabla, [[t:surge.junction.pump.motor]], y la velocidad sube por la diferencia con el par del líquido:</p>
[[eq:pumpStart]]
<p>La velocidad de cada paso es la raíz de la regla de los trapecios, resuelta junto con el paso, y la retención de la bomba la mantiene cerrada hasta que su altura vence la presión contra ella:</p>
[[eq:pumpStartStep]]
<h4>Bombas en cuatro cuadrantes</h4>
<p>Con sus [[t:surge.junction.pump.four]], la altura y el par de una bomba vienen de sus curvas de Suter en todos los cuadrantes (bombeando, frenando, como turbina, girando al revés), en línea recta en θ:</p>
[[eq:suter]]
[[eq:suterVars]]
<p>El punto de referencia es el régimen permanente de la bomba, su mejor rendimiento a la velocidad nominal o uno dado; c<sub>H</sub> y c<sub>B</sub> escalan la tabla para que encuentre el régimen permanente. Después de una parada o de un arranque, el caudal y la velocidad se resuelven juntos en cada paso:</p>
[[eq:fourStep]]
<p>El caudal y la velocidad pueden entonces volver, y solo una retención de la bomba sujeta el caudal. El registro guarda la primera inversión de cada uno.</p>
<h4>Velocidad máxima de una válvula de control</h4>
<p>Una válvula de control en [[t:surge.junction.control.modes.ideal]] puede tener una [[t:surge.junction.control.rate]] r. Su apertura x sigue entonces la apertura x* que pide su control, que sale del Cv de la solución ideal por la inversa c<sup>−1</sup> de su característica, avanzando como mucho r·Δt en un paso; mientras se queda atrás, es una válvula fija con el Cv de la apertura a la que llegó:</p>
[[eq:controlRate]]
<h4>Retenciones dinámicas</h4>
<p>[[t:surge.junction.check.models.decel]]: cuando el caudal se invierte, la deceleración a<sub>d</sub> del líquido en su [[t:surge.junction.check.window]] da, por la tabla de la válvula, la velocidad inversa V<sub>R</sub> a la que cierra:</p>
[[eq:checkDecel]]
<p>[[t:surge.junction.check.models.swing]] y [[t:surge.junction.check.models.nozzle]]: el disco se mueve por las fuerzas sobre él (Thorley, 2004; Li y Liou, 2003), y la pérdida en su posición es la de la válvula totalmente abierta dividida por el cuadrado de la fracción de su Cv:</p>
[[eq:checkSwing]]
[[eq:checkNozzle]]
<p>Cada paso es la regla del trapecio implícita en la posición y su velocidad, con la válvula resuelta en cada posición probada; en un tope el disco queda sin rebote, y en el asiento la válvula queda cerrada hasta que el par allí la abre:</p>
[[eq:checkStep]]
<h4>Fuerzas desequilibradas</h4>
<p>La fuerza axial de un conjunto de fuerzas viene del balance de cantidad de movimiento del líquido entre dos estaciones a y b, con p la presión estática y p<sub>amb</sub> la ambiente, y la fricción de cada sección del camino:</p>
[[eq:forceSegment]]
<p>Es la fuerza sobre los dos codos y el tramo recto entre ellos, y en un régimen permanente en un camino horizontal vale cero. En una estación la fuerza es (p − p<sub>amb</sub>)·A + ṁ²/(ρA); en una salida, el tramo hasta el final del tubo menos la cantidad de movimiento del chorro, ṁ²/(ρA<sub>s</sub>).</p>
<h4>Paso de prueba</h4>
<p>Antes de la corrida, un paso sin ningún cambio tiene que dejar cada estación dentro del [[t:surge.system.criterion]] de su presión y su caudal permanentes. Un cambio mayor significa que el régimen permanente y el modelo del transitorio no coinciden, un transitorio artificial: un aviso nombra las estaciones, y la corrida se detiene cuando [[t:surge.system.stop]] está marcado.</p>`,
          },
          limits: {
            title: 'Límites y referencias',
            body: `<ul>
<li>Las cavidades discretas dan el momento y el orden de magnitud de los picos después de un colapso, no su valor exacto; una cavidad mayor que una décima parte de su sección da un aviso.</li>
<li>La velocidad de onda es constante en cada tubo; el gas libre de las cavidades de gas queda en su estación y no la cambia.</li>
<li>Sin Brunone la fricción es cuasi permanente, así que las ondas se amortiguan más despacio que en la realidad; el término de Brunone las amortigua como en las mediciones, con un coeficiente por tubo para toda la corrida.</li>
<li>Sin sus datos de cuatro cuadrantes, una bomba no tiene caudal inverso y no trabaja como turbina; con ellos, los datos son suyos: Pump It no trae ninguna tabla publicada.</li>
<li>El aire de una ventosa y el gas de un calderín quedan donde están: ninguno de los dos avanza por los tubos, y un calderín o un tanque que se vacía mantiene su presión en el nodo.</li>
<li>Los tubos no se mueven: las fuerzas sobre ellos se calculan, pero no su respuesta. La malla escalonada de algunos programas no se ofrece.</li>
</ul>
<h4>Referencias</h4>
<ul>
<li>Wylie, E. B.; Streeter, V. L.; Suo, L. <i>Fluid Transients in Systems</i>. Prentice Hall, 1993.</li>
<li>Chaudhry, M. H. <i>Applied Hydraulic Transients</i>. 3.ª ed., Springer, 2014.</li>
<li>Thorley, A. R. D. <i>Fluid Transients in Pipeline Systems</i>. 2.ª ed., Professional Engineering Publishing, 2004.</li>
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
