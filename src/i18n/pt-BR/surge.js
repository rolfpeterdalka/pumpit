// Water hammer: its control in the system window, the wave of a pipe, the time data of a junction, its run and its results.
PumpIt.i18n.add('pt-BR', {
  surge: {
    states: {
      open: 'aberta', closed: 'fechada', control: 'controlando', run: 'bombeando', shut: 'fechada pela retenção',
      normal: 'normal', full: 'cheio', empty: 'vazio', admit: 'admitindo ar', expel: 'expulsando ar', hold: 'com ar retido',
    },
    error: {
      steady: 'Golpe de aríete: o regime permanente não calculou ({message}).',
      steadyNotConverged: 'Golpe de aríete: o regime permanente não convergiu, e o transiente não pode partir dele.',
      noPipes: 'Golpe de aríete: nenhum tubo aberto leva o transiente.',
      waveSpeed: 'Golpe de aríete: o tubo P{id} não tem velocidade de onda.',
      timeStep: 'Golpe de aríete: não foi possível achar um passo de tempo para os tubos.',
      boundary: 'Golpe de aríete: não foi possível preparar a junção J{id} ({message}).',
      data: 'Golpe de aríete: não foi possível preparar os dados da junção J{id} ({message}).',
      artificial: 'O golpe de aríete parou: o passo de teste a partir do regime permanente mexeu a rede em mais de {criterion} % (um transiente artificial). Veja os avisos.',
      notFinite: 'O golpe de aríete parou em {t} s: um valor da rede deixou de ser um número.',
      infiniteSections: 'o tubo infinito precisa de pelo menos 2 seções no tubo P{pid}',
      tankUncovered: 'o seu tanque finito começa com a ponta do tubo P{pid} descoberta, com o nível do líquido sem passar dela, enquanto o regime permanente tira líquido por ela: suba o nível do líquido acima do tubo',
      vesselGas: 'o gás do vaso de ar não tem volume ou pressão no regime permanente',
      vesselTooSmall: 'o gás do regime permanente não cabe no vaso',
      gasSteady: 'Golpe de aríete: o tubo P{id} não está acima da pressão de vapor na estação {i} no regime permanente, então não pode guardar o gás livre das cavidades de gás.',
      gasNode: 'a sua pressão no regime permanente não está acima da pressão de vapor, então não pode guardar o gás livre das cavidades de gás',
      force: 'Golpe de aríete: o conjunto de forças {name} não está completo (os seus tubos, as suas distâncias e um caminho entre as suas estações).',
      forcePipe: 'Golpe de aríete: o tubo P{id} do conjunto de forças {name} não faz parte do transiente (fechado ou isolado).',
      fourTable: 'a sua tabela de quatro quadrantes não está completa',
      fourSteady: 'o ponto de referência do regime permanente precisa da bomba bombeando no regime permanente',
      fourBep: 'não foi possível achar o ponto de melhor eficiência nas curvas da bomba',
      fourRef: 'o ponto de referência dos dados de quatro quadrantes precisa de vazão, altura e rotação acima de zero',
      fourScale: 'a sua tabela de quatro quadrantes não encontra o regime permanente (ali a altura ou o torque da tabela é zero ou tem o sinal contrário)',
    },
    warn: {
      notRefined: 'Não foi possível refinar o regime permanente até a tolerância relativa de 10⁻¹⁰; o transiente parte dele como estava.',
      zeroFlow: 'O tubo P{id} não tem vazão no regime permanente: o seu atrito no transiente é o de escoamento turbulento pleno na sua rugosidade.',
      frozenNegative: 'A válvula de controle J{id} somava pressão no regime permanente; congelada, ela entra sem perda.',
      pumpSpeedUnknown: 'Bomba J{id}: a rotação do seu controle no regime permanente é desconhecida; o transiente usa a rotação digitada.',
      pumpSpeedIteration: 'Bomba J{id}: a rotação não se acertou em {t} s (50 iterações); a corrida segue com o último valor.',
      pumpBeyondCurve: 'A bomba J{id} passa do fim da sua curva a partir de {t} s (os seus dados de quatro quadrantes, na seção do golpe de aríete da bomba, cobrem qualquer vazão e rotação).',
      motorBeyond: 'Bomba J{id}: a rotação passa do último ponto da tabela do motor em {t} s; dali em diante o motor mantém o último torque da tabela.',
      bigGas: 'Tubo P{id}: o gás livre passa de 10 % do volume de uma seção na estação {i} a partir de {t} s; o modelo de cavidades de gás discretas perde precisão.',
      bigGasJunction: 'Junção J{id}: o gás livre passa de 10 % do volume de uma seção vizinha a partir de {t} s; o modelo de cavidades de gás discretas perde precisão.',
      fourScale: 'Bomba J{id}: a tabela de quatro quadrantes é escalada por c_H = {cH} e c_B = {cB} para encontrar o regime permanente; acima de 5 %, a tabela e as curvas da bomba discordam.',
      decelRange: 'Retenção J{id}: a desaceleração de {ad} m/s² em {t} s está fora da sua tabela; a válvula usa o valor da ponta da tabela.',
      discNotOpen: 'Retenção J{id}: a diferença de pressão do regime permanente não mantém o disco totalmente aberto, então o disco se move desde o primeiro passo (um transiente artificial).',
      root: 'Junção J{id}: uma equação do seu contorno não convergiu em {t} s; o passo segue com o último valor.',
      bigCavity: 'Tubo P{id}: uma cavidade de vapor acima de 10 % do volume da sua seção a partir de {t} s; o modelo de cavidades discretas perde precisão.',
      cavityPipe: 'O tubo P{id} cavita a partir de {t} s.',
      cavityJunction: 'A junção J{id} cavita a partir de {t} s.',
      belowVapor: 'O tubo P{id} fica abaixo da pressão de vapor em {t} s (estação {i}); sem um modelo de cavitação, as pressões que se seguem não são físicas.',
      variance: 'O seccionamento não atingiu o limite de variância de {limit} %: o maior ajuste de uma velocidade de onda é de {worst} %.',
      thickWall: 'Tubo P{id}: parede mais grossa que D/25; as opções de parede grossa servem melhor.',
      shortDuration: 'A duração é menor que 4·L/a do tubo mais longo ({t} s): a resposta de um tubo leva pelo menos isso.',
      manySections: 'Um tubo tem {n} seções: o passo de tempo é muito curto para os tubos mais longos. Confira o tubo mais curto ou dê a sua velocidade de onda.',
      noVapor: 'O fluido não tem pressão de vapor: a corrida segue sem o modelo de cavitação.',
      fluidKRange: 'A temperatura da água ({T} °C) está fora da faixa da correlação da sua velocidade do som ({min}–{max} °C).',
      memory: 'As séries gravadas ocupam cerca de {mb} MB. Grave a cada N passos, ou menos estações.',
      artificial: 'Transiente artificial: o passo de teste a partir do regime permanente mexeu estações em mais de {criterion} %: {list}.',
      artificialItem: 'P{id} estação {i} ({what} {pct} %)',
      artificialWhat: { P: 'pressão', m: 'vazão' },
      pMax: 'O tubo P{id} passa da sua pressão máxima na estação {i}: {p} kPa manométricos em {t} s, contra {lim} kPa.',
      tankAboveTop: 'Tanque de alívio J{id}: o nível do regime permanente está acima do topo, então ele começa cheio.',
      tankBelowBottom: 'Tanque de alívio J{id}: o nível do regime permanente está abaixo do fundo, então ele começa vazio.',
      tankFull: 'O tanque J{id} transborda pelo topo a partir de {t} s.',
      tankEmpty: 'O tanque J{id} fica vazio a partir de {t} s.',
      vesselBelowMin: 'Vaso de ar J{id}: o gás do regime permanente está abaixo do menor volume.',
      vesselEmpty: 'Vaso de ar J{id}: o gás ocupa todo o vaso em {t} s, sem líquido dentro.',
      vesselFull: 'Vaso de ar J{id}: o gás chega ao menor volume em {t} s, e o vaso não recebe mais líquido.',
      reliefSteady: 'Válvula de alívio J{id}: a pressão do regime permanente já passa da pressão de ajuste, então ela abre no início da corrida.',
      bigAir: 'Ventosa J{id}: o ar fica maior que o volume de uma seção vizinha a partir de {t} s; o modelo de ar retido num ponto perde precisão.',
      infiniteCavity: 'O tubo infinito da junção J{id} fica abaixo da pressão de vapor em {t} s; a sua ponta não cavita.',
    },
    log: {
      cavityPipe: 'primeira cavidade no tubo P{id}',
      cavityJunction: 'primeira cavidade na junção J{id}',
      cavitiesAtEnd: 'há cavidades no fim da corrida',
      cavitiesEnded: 'a última cavidade da rede colapsou',
      tableStarted: 'a tabela {n} começou pelo seu evento',
      tableResumed: 'a tabela {n} começou em {tau} s, onde dá o valor em uso',
      pumpTrip: 'parada da bomba: o torque do motor acabou',
      pumpStart: 'partida da bomba: o motor passa a dar o torque da sua tabela',
      pumpFlowReversed: 'a vazão pela bomba volta pela primeira vez',
      pumpSpeedReversed: 'a bomba gira ao contrário pela primeira vez',
      checkDecel: 'a vazão inverte com desaceleração de {ad} m/s²: a válvula fecha com velocidade reversa de {VR} m/s',
      discLeaves: 'o disco sai da abertura total',
      discFull: 'o disco volta à abertura total',
      state: 'passa de {from} para {to}',
    },
    stamp: {
      label: 'Golpe de aríete',
      running: 'Golpe de aríete · {pct} %',
      title: 'Golpe de aríete: clique para abrir o controle nas propriedades do sistema',
    },
    bar: {
      aria: 'Cursor de tempo do golpe de aríete',
      label: 'Golpe de aríete',
      first: 'Primeiro instante gravado',
      prev: 'Instante gravado anterior',
      play: 'Tocar os instantes gravados',
      pause: 'Pausar',
      next: 'Próximo instante gravado',
      last: 'Último instante gravado',
      slider: 'Instante do golpe de aríete mostrado',
      cancel: 'Parar o golpe de aríete (o que já foi calculado fica)',
      stopped: 'parou em {t}',
      cancelled: 'interrompido por você em {t}',
    },
    system: {
      title: 'Golpe de aríete',
      hint: 'O transiente de uma rede de líquido depois de uma mudança rápida: uma válvula que fecha, uma bomba que para, um nível ou uma pressão que muda. Ele parte do regime permanente do cenário e é resolvido pelo método das características. Só calcula enquanto estiver ligado.',
      on: 'Calcular o golpe de aríete',
      onHint: 'Ligado, o golpe de aríete corre depois do regime permanente a cada mudança, e a simulação no tempo é desligada (as duas não correm juntas). Desligado, os seus dados ficam no modelo e não são usados.',
      off: 'Desligado: o modelo calcula só o regime permanente. Ligue quando uma mudança rápida puder causar um golpe de aríete.',
      duration: 'Duração',
      durationHint: 'Por quanto tempo o transiente é acompanhado a partir de 0 s, o regime permanente. Cubra pelo menos algumas vezes 2·L/a do tubo mais longo.',
      dtMode: 'Passo de tempo',
      dtModes: { auto: 'Automático', given: 'Dado' },
      dtModeHint: 'Automático: o passo em que cabe um número inteiro de seções em cada tubo, ajustando cada velocidade de onda em no máximo o limite de variância. Dado: o passo que você digita; cada tubo fica com o número inteiro de seções mais próximo.',
      dt: 'Passo de tempo',
      varianceMax: 'Limite de variância',
      varianceHint: 'O maior ajuste da velocidade de onda de um tubo, para que as suas seções caibam no passo de tempo comum.',
      ncMax: 'Máximo de seções do tubo controlador',
      ncMaxHint: 'A busca tenta do mínimo até este número de seções, em passos de 0,05, no tubo de menor tempo de percurso L/a.',
      ncMin: 'Mínimo de seções do tubo controlador',
      cavitation: 'Cavitação',
      cavitations: { dvcm: 'Cavidades de vapor', dgcm: 'Cavidades de gás', none: 'Nenhuma' },
      cavitationHint: {
        dvcm: 'Cavidades de vapor discretas: uma estação cuja pressão cai até a pressão de vapor fica nela e abre uma cavidade, que cresce e colapsa com as vazões ao redor. O colapso dá os picos de pressão.',
        dgcm: 'Cavidades de gás discretas: cada estação guarda uma pequena massa de gás livre, que cresce quando a pressão cai, a temperatura constante. A pressão nunca chega à pressão de vapor, e os colapsos são mais suaves que com cavidades de vapor. O peso ψ usual é 0,95, que esta escolha usa enquanto ψ está em 0,5.',
        none: 'Sem modelo: a pressão pode cair abaixo da pressão de vapor. Um aviso diz onde e quando; as pressões que se seguem não são físicas.',
      },
      friction: 'Atrito',
      frictions: { steady: 'Do regime permanente (quase permanente)', variable: 'Variando com o número de Reynolds', brunone: 'Variando, com o termo transitório de Brunone' },
      frictionHint: 'Do regime permanente: cada tubo mantém o coeficiente de atrito da sua vazão permanente. Variando: cada estação recalcula o fator de atrito da sua vazão, pela correlação do regime permanente, sempre que a sua velocidade muda mais de 1 %; as perdas dos acessórios ficam as do regime permanente. Com Brunone, o atrito variável ganha também um termo da aceleração do líquido, (ρ·k/2)·(∂V/∂t + a·sinal(V)·|∂V/∂x|), que amortece as ondas como nas medições; k vem do número de Reynolds da vazão permanente de cada tubo, ou o tubo o informa.',
      saveEvery: 'Gravar a cada N passos',
      saveEveryHint: 'As estações são gravadas a cada N passos, sempre o primeiro e o último. Os maiores e menores valores cobrem todos os passos.',
      stations: 'Estações de saída',
      stationsOf: { ends: 'As pontas de cada tubo', all: 'Todas as estações' },
      stationsHint: 'As estações cujas pressões e vazões são gravadas no tempo. Um tubo pode escolher as suas. As envoltórias cobrem todas as estações de qualquer forma.',
      fluidK: 'Módulo de compressibilidade do líquido',
      fluidKSource: 'da velocidade do som na água à temperatura do modelo',
      fluidKHint: 'O módulo de compressibilidade K do líquido, que define a velocidade de onda junto com a elasticidade da parede do tubo. A água tem cerca de 2,2 GPa.',
      advanced: 'Golpe de aríete: avançado',
      advancedHint: 'Opções do método que raramente precisam mudar.',
      psi: 'Peso ψ das cavidades',
      psiHint: 'O volume de uma cavidade toma as vazões do passo novo com o peso ψ e as do passo anterior com 1 − ψ, de 0,5 a 1. O valor usual é 0,5.',
      cavBasis: 'As cavidades comparam',
      cavBases: { stagnation: 'A pressão de estagnação', static: 'A pressão estática' },
      cavBasisHint: 'A pressão de uma estação que é comparada com a pressão de vapor para abrir uma cavidade.',
      alpha0: 'Fração de vazio do gás livre',
      alpha0Hint: 'A fração do volume do líquido ocupada por gás livre na pressão abaixo, a mesma em toda a rede. 10⁻⁷ é um valor usual.',
      p0: 'Pressão da fração de vazio',
      p0Hint: 'A pressão absoluta em que vale a fração de vazio acima: 1 atm por padrão.',
      criterion: 'Transiente artificial: critério',
      criterionHint: 'Antes da corrida, um passo sem nada mudando precisa manter cada estação dentro desta porcentagem da sua pressão e da sua vazão permanentes. Uma mudança maior quer dizer que o regime permanente e o modelo do transiente discordam (um transiente artificial).',
      minFlow: 'Transiente artificial: menor vazão verificada',
      stop: 'Parar a corrida num transiente artificial',
      sectioning: 'Seções e passo de tempo',
      sectioningHint: 'Cada tubo é dividido num número inteiro de seções que a onda atravessa num passo de tempo. Clique numa linha para ir ao tubo.',
      noWave: 'Dê a velocidade de onda de {pipes} para ver as seções.',
      noSectioning: 'Complete o modelo e o seu regime permanente para ver as seções.',
      controller: 'controla',
      cols: { pipe: 'Tubo', L: 'Comprimento (m)', a: 'Velocidade de onda (m/s)', n: 'Seções', aAdj: 'Ajustada (m/s)', variance: 'Variância (%)', R: 'R (Pa·s²/kg²)' },
      dtValue: 'Passo de tempo',
      stationsTotal: 'Estações',
      steps: 'Passos',
      estimate: 'Tamanho da corrida',
      estimateValue: '{work} estações × passos, cerca de {s} s',
      limitNotMet: 'Nenhum passo de tempo atingiu o limite de variância de {limit} %: o maior ajuste é de {worst} %. Aumente o limite ou o número de seções, ou dê as velocidades de onda.',
      summary: '{duration} · cavitação: {cavitation}',
      forces: 'Forças desbalanceadas',
      forcesHint: 'A força axial do líquido sobre os tubos ao longo do tempo, para o projeto dos apoios: num trecho entre duas estações (as curvas das pontas e o trecho reto entre elas), numa estação ou numa saída. Ela vem do balanço de quantidade de movimento: a pressão estática acima da ambiente vezes a área e o fluxo de quantidade de movimento nas pontas, com o atrito no caminho.',
      forceName: 'Nome',
      forceKind: 'Tipo',
      forceKinds: { segment: 'Trecho entre duas estações', point: 'Numa estação', exit: 'Saída para fora' },
      forceKindHint: 'Trecho: a força sobre as curvas das duas pontas e o trecho reto entre elas, positiva da primeira estação para a segunda, zero num regime permanente num caminho horizontal; entre tubos, segue o caminho com menos tubos. Numa estação: (p − p_amb)·A + ṁ²/(ρA), no sentido do tubo. Saída: o trecho até o fim do tubo que descarrega, menos a quantidade de movimento do jato.',
      forcePipe: 'Tubo',
      forceFrom: 'Do tubo',
      forceTo: 'Ao tubo',
      forceExit: 'Tubo que descarrega',
      forceX: 'Distância desde a origem',
      forceAt: 'Estação usada',
      forceStation: 'estação {i} de {n} · {x} m',
      forceAs: 'Área do jato (vazio: a do tubo)',
      forceAmbient: 'Pressão ambiente',
      ambients: { atm: 'Atmosférica', given: 'Dada' },
      forcePamb: 'Pressão ambiente dada',
      forceBad: {
        set: 'Um conjunto incompleto.', kind: 'Escolha o tipo.', pipe: 'Escolha tubos abertos.', distance: 'Informe distâncias dentro dos tubos.',
        path: 'Nenhum caminho de tubos abertos liga os dois tubos.', ambient: 'Informe a pressão ambiente.', area: 'A área do jato precisa ser maior que zero.',
      },
      forceRemove: 'Remover este conjunto de forças',
      forceAdd: 'Adicionar um conjunto de forças',
    },
    pipe: {
      title: 'Onda do golpe de aríete',
      hint: 'A velocidade das ondas de pressão neste tubo, calculada a partir do líquido e da parede, ou dada, e as seções que ele tem na corrida.',
      closed: 'Um tubo fechado não entra no golpe de aríete.',
      wave: 'Velocidade de onda',
      waves: { calculated: 'Calculada pela parede', given: 'Dada' },
      a: 'Velocidade de onda',
      support: 'Como o tubo é fixado',
      supports: {
        thinAnchored: 'Parede fina, ancorado em todo o comprimento',
        thinUp: 'Parede fina, ancorado só a montante',
        thinJoints: 'Parede fina, com juntas de expansão',
        thickAnchored: 'Parede grossa, ancorado em todo o comprimento',
        thickUp: 'Parede grossa, ancorado só a montante',
        thickJoints: 'Parede grossa, com juntas de expansão',
        tunnelUnlined: 'Túnel em rocha, sem revestimento',
        tunnelLined: 'Túnel em rocha, revestido de aço',
        buried: 'Enterrado, por um aumento estimado',
        user: 'Coeficiente c₁ dado',
      },
      supportHint: 'A fixação do tubo define o coeficiente c₁ da fórmula da velocidade de onda. As fórmulas de parede fina servem para um diâmetro acima de cerca de 25 vezes a parede.',
      E: 'Módulo de elasticidade',
      EHint: 'Do material da parede. Vazio, usa o valor típico do material do catálogo, mostrado em cinza.',
      nu: 'Coeficiente de Poisson',
      wall: 'Espessura da parede',
      wallHint: 'Vazia, usa a parede do tamanho do catálogo, mostrada em cinza; um revestimento não conta.',
      typical: 'Preencher E e ν com um material típico…',
      typicalLabel: 'Valores típicos',
      materials: { carbonSteel: 'Aço carbono', stainless: 'Aço inoxidável', ductileIron: 'Ferro fundido dúctil', hdpe: 'PEAD (carga curta, 20 °C)', pvc: 'PVC', copper: 'Cobre', concrete: 'Concreto' },
      fromCatalog: 'Os campos vazios usam os valores de {material} e a parede do catálogo.',
      G: 'Módulo de rigidez da rocha',
      GHint: 'O módulo de rigidez (de cisalhamento) G da rocha em volta do túnel.',
      buriedPct: 'Aumento sobre o tubo ancorado',
      buriedHint: 'Um tubo enterrado é mais rígido que um ao ar livre: a sua velocidade de onda é a de parede fina ancorada em todo o comprimento, aumentada desta porcentagem.',
      c1: 'Coeficiente c₁',
      aCalc: 'Velocidade de onda a',
      plastic: 'O módulo de um plástico depende da sua temperatura e de quanto tempo dura a carga: confira o valor para um transiente rápido.',
      thick: 'A parede é mais grossa que 1/25 do diâmetro: uma opção de parede grossa serve melhor.',
      sections: 'Na corrida',
      sectionsValue: '{n} seções · {a} m/s · variância {v} %',
      stations: 'Estações de saída',
      stationsOf: { default: 'Como no sistema', ends: 'As duas pontas', all: 'Todas as estações' },
      stationsHint: 'As estações deste tubo cujas pressões e vazões são gravadas no tempo.',
      pMax: 'Pressão máxima',
      pMaxHint: 'Opcional: a maior pressão que o tubo aguenta. Uma corrida que passar dela dá um aviso com a estação e o instante.',
      k: 'Coeficiente k de Brunone',
      kHint: 'Opcional: o coeficiente do atrito transitório deste tubo. Vazio, vem do número de Reynolds da sua vazão permanente, k = √C*/2 de Vardy e Brown, e um tubo sem vazão permanente usa o valor laminar.',
      kAuto: 'do número de Reynolds',
    },
    junction: {
      title: 'Golpe de aríete',
      hint: 'O que esta junção faz no golpe de aríete: uma tabela de uma das suas grandezas no tempo, ou a parada ou a partida de uma bomba. Estes dados ficam separados dos da simulação no tempo.',
      add: { table: 'Adicionar uma tabela ({what})', trip: 'Adicionar uma parada da bomba', start: 'Adicionar uma partida da bomba' },
      whats: {
        Q: 'Vazão', source: 'Vazão da fonte', P: 'Pressão', level: 'Nível do líquido', surfP: 'Pressão na superfície', speed: 'Rotação',
        set: 'Ajuste', K: 'K', Cv: 'Cv', Kv: 'Kv', area: 'Área efetiva (Cd·A)', pMax: 'Pressão de alívio', open: 'Abertura',
        ratio: 'Razão de compressão', T: 'Temperatura do gás', trip: 'Parada da bomba', start: 'Partida da bomba',
      },
      use: 'Usar estes dados',
      what: 'Grandeza',
      whatGone: 'A grandeza destes dados não serve para o modo atual da junção: escolha outra.',
      event: 'Evento {n}',
      eventOne: 'Evento',
      combinedNone: 'O modelo ainda não tem eventos: crie-os na janela do sistema, abaixo do golpe de aríete.',
      combined: 'Evento do modelo',
      tripStart: 'A parada acontece',
      tripStarts: { time: 'Num instante', single: 'Num evento', combined: 'Num evento do modelo' },
      tripHint: 'A partir da parada, o motor não dá mais torque: a bomba perde rotação pela sua inércia e, sem os seus dados de quatro quadrantes, não deixa a vazão voltar. O passo que chega ao instante da parada, ou em que o seu evento dispara, faz a parada; o torque some a partir do passo seguinte.',
      tripAt: 'Instante da parada',
      startWhen: 'A partida acontece',
      startPumpHint: 'A partir da partida, o motor dá o torque da sua tabela: a bomba ganha rotação pela sua inércia, presa pela sua retenção até que a sua altura vença a pressão contra ela, e sem os seus dados de quatro quadrantes não deixa a vazão voltar. O passo que chega ao instante da partida, ou em que o seu evento dispara, faz a partida; o torque existe a partir do passo seguinte.',
      startAt: 'Instante da partida',
      basis: 'Valores',
      start: 'Início',
      startHint: 'Pelo relógio, o tempo da tabela é o tempo da corrida. Depois de um evento, ele conta do passo em que o evento disparou, e a tabela vale a partir do passo seguinte.',
      remove: 'Remover os dados do golpe de aríete',
      pump: {
        notCurve: 'Uma tabela de rotação ou uma parada precisa da bomba ligada na sua curva, e uma partida, da bomba na sua curva, desligada e fechada (o seu modo e estado, acima). Os dados de quatro quadrantes servem a qualquer bomba com curva.',
        inertia: 'Momento de inércia',
        inertiaHint: 'Da bomba, do motor e do eixo juntos, com o líquido no rotor. Quanto maior, mais devagar a bomba para depois de uma parada, ou ganha rotação depois de uma partida.',
        rpm: 'Rotação nominal',
        power: 'Potência no eixo na rotação nominal',
        powerY: 'Potência',
        powerFromEff: 'Sem uma curva de potência, a parada ou a partida usa a potência no eixo calculada pelas curvas de altura e de eficiência.',
        addPower: 'Adicionar uma curva de potência',
        motor: 'Torque do motor',
        motorHint: 'O torque do motor contra a sua rotação, da folha de dados: o torque de partida em 0 %, em geral um pico perto da rotação nominal, e zero na rotação síncrona. Entre os pontos ele segue em linha reta; depois do último ponto mantém o último torque.',
        motorSpeed: 'Rotação (% da nominal)',
        motorTorque: 'Torque',
        four: 'Dados de quatro quadrantes',
        fourHint: 'A altura e o torque da bomba em todos os quadrantes, das suas curvas de Suter WH(θ) e WB(θ), que o fabricante fornece. Com elas, uma parada ou uma partida deixa a vazão e a rotação voltarem (só uma retenção da bomba segura a vazão), e uma bomba desligada e fechada pode partir por uma tabela de rotação. O Pump It não traz nenhuma tabela publicada: os dados são seus.',
        fourRef: 'Ponto de referência',
        fourRefs: { steady: 'O regime permanente da bomba', bep: 'A melhor eficiência na rotação nominal', user: 'Dado' },
        fourRefHint: 'O ponto que dá as dimensões da tabela: Q_R, H_R, o torque T_R e N_R. O regime permanente da bomba precisa dela ligada. A tabela é escalada para encontrar o regime permanente, com uma cautela acima de 5 %.',
        fourQ: 'Vazão Q_R (por bomba)',
        fourH: 'Altura H_R',
        fourN: 'Rotação N_R',
        fourP: 'Potência no eixo P_R',
        fourTable: 'Curvas de Suter',
        fourTheta: 'θ (°)',
        fourTableHint: 'WH = h/(α² + v²) e WB = β/(α² + v²) contra θ = π + atan2(v, α), com α = N/N_R, v = Q/Q_R, h = H/H_R e β = T/T_R: de 0 a 360°, pelo menos 9 pontos, os valores de 360° iguais aos de 0°. Entre os pontos, em linha reta.',
        fourReverse: 'Sem uma retenção própria (nos dados do regime permanente), a vazão e a rotação podem voltar no transiente.',
      },
      control: {
        mode: 'No golpe de aríete',
        modes: { frozen: 'Congelada na perda do permanente', ideal: 'Controlando a cada passo' },
        hint: 'Congelada: a válvula mantém a perda do regime permanente, como uma válvula fixa. Controlando: ela mantém o seu ajuste a cada passo, como um controlador ideal, e uma tabela pode mudar o ajuste.',
        rate: 'Velocidade máxima da abertura',
        rateHint: 'Opcional, em % da abertura total por segundo, abrindo e fechando: a válvula segue a abertura que o seu controle pede sem ir mais rápido que isso, e enquanto fica para trás é uma válvula fixa na abertura a que chegou. Precisa da característica da válvula (acima). Vazio: sem limite.',
      },
      check: {
        model: 'Modelo no golpe de aríete',
        models: { none: 'Instantâneo', decel: 'Por desaceleração', swing: 'Portinhola com inércia', nozzle: 'Disco deslizante' },
        modelHints: {
          none: 'A válvula do regime permanente: fecha no passo em que a velocidade na entrada cai abaixo da sua velocidade de fechamento, e reabre quando a diferença de pressão chega à sua diferença de reabertura.',
          decel: 'Por uma tabela da válvula: a velocidade reversa em que ela fecha contra a desaceleração do líquido quando a vazão inverte. Até lá ela fica aberta com a vazão reversa.',
          swing: 'Um disco numa articulação, movido pela pressão sobre ele, pelo seu peso e por um contrapeso, uma mola e um amortecedor opcionais: a válvula fecha quando o disco chega ao assento, e a perda segue a fração do Cv no seu ângulo.',
          nozzle: 'Um disco que desliza ao longo do eixo contra uma mola: a válvula fecha quando o disco chega ao assento, e a perda segue a fração do Cv no seu curso.',
        },
        quadratic: 'Os modelos dinâmicos precisam de uma perda quadrática de aberta: K, Cv ou Kv (a perda da válvula, acima).',
        decel: 'Velocidade reversa no fechamento',
        decelAd: 'Desaceleração',
        decelVR: 'Velocidade reversa',
        decelHint: 'Da folha de dados da válvula: a velocidade reversa do líquido em que ela fecha, contra a desaceleração da vazão. Entre os pontos em linha reta; fora da tabela, os valores das pontas, com uma cautela.',
        window: 'Janela da desaceleração',
        windowHint: 'Quando a vazão inverte, a desaceleração é a inclinação da velocidade nos passos deste último trecho de tempo, por mínimos quadrados. 0,1 s por padrão.',
        fields: {
          thetaMax: 'Ângulo de abertura total', seat: 'Inclinação do assento', I: 'Momento de inércia', md: 'Massa do disco e do braço', rcg: 'Distância da articulação ao centro de massa',
          Ad: 'Área do disco', rp: 'Braço da força de pressão', Ts0: 'Torque da mola com a válvula fechada', ks: 'Rigidez da mola', c: 'Amortecimento', Wc: 'Peso do contrapeso',
          rc: 'Braço do contrapeso', delta: 'Ângulo do contrapeso em relação ao braço', xMax: 'Curso de abertura total', m: 'Massa do disco', F0: 'Força da mola com a válvula fechada',
          k: 'Rigidez da mola', cLinear: 'Amortecimento', mf: 'Massa de líquido deslocada', rhoM: 'Massa específica do material do disco', phi: 'Ângulo da válvula',
        },
        hints: {
          thetaMax: 'Do assento (0) até o batente do disco totalmente aberto.',
          seat: 'A inclinação do assento: com a posição da válvula, define como o peso do disco o fecha.',
          I: 'Do disco, do braço e do contrapeso em torno da articulação, com o líquido que ele arrasta, se você o contar.',
          rcg: 'O peso do disco e do braço age a esta distância da articulação.',
          Ad: 'Vazio: a área do tubo de entrada.',
          rp: 'Onde a diferença de pressão age sobre o disco. Vazio: no centro de massa.',
          Ts0: 'Opcional (vazio: sem mola): o torque da mola no assento, que cresce com o ângulo pela sua rigidez.',
          c: 'Opcional (vazio: nenhum): uma resistência contra a velocidade do disco.',
          Wc: 'Opcional (vazio: nenhum), com o seu braço e o seu ângulo em relação ao braço do disco.',
          xMax: 'Do assento até o batente do disco totalmente aberto.',
          m: 'Do disco que se move: a sua inércia e o seu peso.',
          F0: 'Opcional (vazio: sem mola): a força da mola no assento, que cresce com o curso pela sua rigidez.',
        },
        fluidMass: 'Empuxo',
        fluidMasses: { none: 'Nenhum', user: 'Uma massa de líquido dada', calculated: 'Pela massa específica do disco' },
        fluidMassHint: 'O líquido que o disco desloca tira parte do seu peso: m_f = ρ·m/ρ_m com a massa específica do disco (7850 kg/m³, aço, por padrão), ou uma massa que você informa.',
        orient: 'Posição da válvula',
        orients: { horizontal: 'Horizontal', vertical: 'Vertical, com o escoamento para cima', angle: 'Num ângulo' },
        orientHint: 'Como o peso do disco age: horizontal (0°), vertical com o escoamento para cima (90°) ou um ângulo de −90° a 90°.',
        cvTable: 'Fração do Cv',
        cvAngle: 'Ângulo desde o assento',
        cvTravel: 'Curso desde o assento',
        cvFrac: 'Fração do Cv de aberta',
        cvHint: 'De (0, 0 %) no assento até (abertura total, 100 %), em linha reta. A perda numa posição é a da válvula totalmente aberta dividida pelo quadrado da fração.',
      },
    },
    // os dados dos dispositivos de proteção e das pontas especiais, na seção de golpe de aríete de uma junção
    device: {
      shape: 'Forma',
      shapes: { none: 'Sem geometria: o gás na pressão do nó', constant: 'Seção constante', table: 'Volume por altura' },
      shapeHint: 'A seção do tanque, constante ou dada por uma tabela de volume pela altura sobre o fundo.',
      shapeVesselHint: 'Sem geometria, o gás fica na pressão do nó. Com ela, o nível do líquido no vaso soma a sua coluna à pressão do gás.',
      area: 'Seção',
      h: 'Altura sobre o fundo',
      V: 'Volume',
      bottom: 'Cota do fundo',
      bottomHint: 'Vazio: na cota da junção.',
      height: 'Altura até o topo',
      heightHint: 'Acima dela o tanque transborda e o nível fica no topo. Opcional com seção constante (vazio: sem topo); uma tabela vai até ela.',
      heightVessel: 'Altura do vaso',
      heightVesselHint: 'Do fundo ao topo: com a forma, dá o volume do vaso.',
      oneWay: 'Unidirecional: só alimenta a rede',
      oneWayHint: 'Uma retenção deixa o líquido só sair do tanque: ele alimenta a rede quando a pressão cai, e fica fechado enquanto a pressão está acima do seu nível.',
      orifice: 'Um orifício na ligação',
      orificeHint: 'Uma perda entre o nó e o tanque ou o vaso, própria em cada sentido: ΔP = ṁ|ṁ|/(2ρ(Cd·A)²).',
      CdAin: 'Cd·A da vazão que entra',
      CdAout: 'Cd·A da vazão que sai',
      riser: 'Um tubo curto com a sua inércia',
      riserHint: 'Um tubo curto entre o nó e o tanque ou o vaso, cuja coluna a vazão acelera: (L/A)·dṁ/dt = a pressão do nó − a do dispositivo − as suas perdas.',
      riserL: 'Comprimento do tubo curto',
      riserD: 'Diâmetro do tubo curto',
      riserF: 'Fator de atrito do tubo curto',
      n: 'Expoente politrópico n',
      nHint: 'P·Vⁿ fica constante para o gás: 1 para um gás isotérmico, 1,4 para o ar sem troca de calor. O valor usual é 1,2.',
      gasInit: 'Gás no regime permanente',
      gasInits: { given: 'O seu volume', precharge: 'Pela pré-carga' },
      gasInitHint: 'O volume do gás na pressão do regime permanente, ou a pré-carga do vaso (a pressão e o volume do gás antes de enchê-lo), de onde o volume sai a temperatura constante.',
      Vg0: 'Volume de gás no regime permanente',
      Ppre: 'Pressão de pré-carga',
      Vpre: 'Volume de pré-carga',
      vol: 'Volume do vaso',
      volHint: 'Opcional: o gás não passa dele. Um vaso cujo gás o ocupa todo dá um aviso, e o nó mantém a pressão do gás.',
      vgMin: 'Menor volume de gás',
      vgMinHint: 'Opcional: o vaso não recebe mais líquido quando o gás desce a esse volume.',
      mode: 'Abertura',
      modes: { pressure: 'Com a pressão', instant: 'De uma vez' },
      modeHint: 'Com a pressão: fechada, ela abre quando a pressão do nó passa da pressão de ajuste; aberta, o seu Cv cresce em linha reta de 0 na pressão de fechamento até o total na pressão de abertura total, e ela fecha na pressão de fechamento. De uma vez: totalmente aberta acima da pressão de ajuste, fechada abaixo da pressão de fechamento. Uma tabela da abertura, nos dados abaixo, a comanda no lugar disso, como uma válvula piloto.',
      Pset: 'Pressão de ajuste (abre)',
      Pfull: 'Pressão de abertura total',
      Pclose: 'Pressão de fechamento',
      PcloseHint: 'Não acima da pressão de ajuste. Vazio: a pressão de ajuste.',
      capacity: 'Capacidade totalmente aberta',
      capacities: { Cv: 'Cv (EUA)', Kv: 'Kv (métrico)', CdA: 'Cd·A' },
      Pext: 'Pressão externa',
      rate: 'Maior velocidade da abertura',
      rateHint: 'Opcional, em % da abertura total por segundo, abrindo e fechando. Vazio: sem limite.',
      avType: 'Tipo',
      avTypes: { both: 'Admite e expulsa ar', in: 'Só admite ar', out: 'Só expulsa ar', twoStage: 'Admite e expulsa, com uma saída menor num segundo estágio' },
      airIn: 'Cd·A da entrada de ar',
      airOut: 'Cd·A da saída de ar',
      airOut2: 'Cd·A da saída menor',
      switchBy: 'A saída menor assume',
      switchBys: { dP: 'Acima de uma diferença de pressão', flow: 'Acima de uma vazão de ar' },
      switchHint: 'Enquanto o ar sai, a saída grande fecha e a pequena assume quando a diferença para fora, ou a vazão de ar, passa desse valor; fica assim até o ar acabar.',
      switchDP: 'Diferença de pressão',
      switchFlow: 'Vazão de ar',
      Popen: 'Pressão de abertura',
      PopenHint: 'A ventosa admite ar quando a pressão do nó cai abaixo dela. Vazio: a pressão atmosférica.',
      Tair: 'Temperatura do ar',
      TairHint: 'Do ar de fora e do ar na ventosa. Vazio: a do líquido.',
      mAir0: 'Ar no regime permanente',
      mAir0Hint: 'Ar já retido no nó quando a corrida começa, em geral nenhum.',
      special: 'A sua ponta no golpe de aríete',
      specials: { none: 'Como está (uma tabela pode comandá-la)', infinitePipe: 'Um tubo infinito: sem reflexão' },
      specialHint: 'Um tubo infinito deixa as ondas saírem da rede por esta ponta, como se o tubo seguisse sem fim: a ponta mantém a característica do regime permanente. As suas tabelas não são usadas, e o seu tubo precisa de pelo menos 2 seções.',
    },
    overlay: {
      P: 'Golpe de aríete: pressão estática no cursor',
      HGL: 'Golpe de aríete: HGL no cursor',
      Pmax: 'Golpe de aríete: maior pressão estática',
      Pmin: 'Golpe de aríete: menor pressão estática',
      titleP: 'Pressão estática média no cursor',
      titleHGL: 'HGL média no cursor',
      titlePmax: 'Maior pressão estática da corrida',
      titlePmin: 'Menor pressão estática da corrida',
    },
    charts: {
      tabs: { time: 'Golpe de aríete no tempo', profile: 'Envoltórias do golpe' },
      noRun: 'Ligue o golpe de aríete e complete a lista de verificação para ver os seus gráficos.',
      object: 'Objeto',
      stations: 'Estações de tubos',
      junctions: 'Junções',
      station: '{pipe} · estação {i} de {n}',
      quantity: 'Grandeza',
      q: { p: 'Pressão estática', P0: 'Pressão de estagnação', HGL: 'Linha piezométrica', m: 'Vazão mássica', Q: 'Vazão volumétrica', V: 'Volume de vapor', Vg: 'Volume de gás', F: 'Força' },
      force: 'Força {name}',
      forces: 'Conjuntos de forças',
      add: 'Adicionar ao gráfico',
      remove: 'Remover a série',
      choose: 'Escolha um objeto e uma grandeza e adicione-os ao gráfico.',
      unit: 'Unidade',
      timeAxis: 'Tempo (s)',
      cursorNote: 'As marcas mostram o instante do cursor: {t}.',
      pressures: 'Pressões estáticas',
      pathOff: 'O caminho passa por {pipe}, que não entra no golpe de aríete (fechado ou isolado).',
      hglMax: 'Maior HGL',
      hglMin: 'Menor HGL',
      pMax: 'Maior pressão estática',
      pMin: 'Menor pressão estática',
      steady: 'Regime permanente',
      atCursor: 'Em {t}',
      envelopes: 'Envoltórias do golpe de aríete',
      profileNotes: 'Caminho: {path} · {length} {u}. Os maiores e menores valores cobrem todas as estações e todos os passos; a linha do cursor passa pelas estações de saída. As linhas piezométricas usam pressão absoluta.',
      vaporReached: 'A menor pressão chega à pressão de vapor em {pipes}.',
    },
    results: {
      tabs: { surge: 'Golpe de aríete', surgeEnv: 'Envoltórias', surgeLog: 'Registro de eventos' },
      summary: 'Golpe de aríete',
      summaryHint: 'O regime permanente continua sendo o instante 0 s das outras tabelas.',
      dt: 'Passo de tempo',
      steps: 'Passos',
      recorded: '{n} gravados',
      duration: 'Duração',
      elapsed: 'Calculado em',
      test: 'Passo de teste',
      testOk: 'passou (maior mudança de {p} % na pressão, {m} % na vazão)',
      testFailed: 'transiente artificial acima de {criterion} %: veja os avisos',
      cavitation: 'Cavitação',
      noModel: 'sem modelo',
      cavitated: '{n} lugares cavitaram, o primeiro em {t}',
      noCavity: 'nenhuma cavidade',
      gasModel: 'cavidades de gás: a pressão fica acima da pressão de vapor (os maiores volumes de gás estão nas envoltórias)',
      stoppedAt: 'Parou em',
      sectioning: 'Seções',
      sectioningHint: 'Por tubo: comprimento, velocidade de onda, seções, velocidade ajustada, variância e coeficiente de atrito.',
      junctions: 'Junções',
      junctionsHint: 'O maior e o menor valor de cada grandeza, com o primeiro instante em que é atingido.',
      four: {
        QR: 'Quatro quadrantes ({ref}): vazão Q_R por bomba', HR: 'Quatro quadrantes ({ref}): altura H_R', TR: 'Quatro quadrantes ({ref}): torque T_R', NR: 'Quatro quadrantes ({ref}): rotação N_R',
        cH: 'Quatro quadrantes: escala c_H da altura', cB: 'Quatro quadrantes: escala c_B do torque',
        refs: { steady: 'regime permanente', bep: 'melhor eficiência', user: 'dado' },
      },
      forces: 'Forças desbalanceadas',
      forcesHint: 'A força axial de cada conjunto de forças: o seu valor no regime permanente, o maior e o menor com o primeiro instante, e a sua variação de pico a pico.',
      envelopes: 'Envoltórias dos tubos',
      envelopesHint: 'A maior e a menor pressão estática de cada tubo, em todas as suas estações e todos os passos, com onde e quando. Em vermelho: até a pressão de vapor.',
      stations: 'Estações de um tubo',
      pipe: 'Tubo',
      log: 'Registro de eventos',
      logHint: 'Eventos, estados de dispositivos e cavidades, na ordem do tempo.',
      noEvents: 'Nada aconteceu além do próprio transiente.',
      warnings: 'Golpe de aríete',
      noWarnings: 'O golpe de aríete não deu nenhum aviso.',
      warningsHint: 'Avisos da corrida do golpe de aríete.',
      kinds: { event: 'evento', info: 'informação', warning: 'aviso' },
      fields: {
        P: 'Pressão', P1: 'Pressão de entrada', P2: 'Pressão de saída', net: 'Vazão mássica líquida para a rede', m: 'Vazão mássica', s: 'Rotação', dH: 'Altura', T: 'Torque', V: 'Volume da cavidade',
        level: 'Nível do líquido', mt: 'Vazão para o tanque ou vaso', Pg: 'Pressão do gás', Vg: 'Volume do gás', mr: 'Vazão aliviada', x: 'Abertura', Va: 'Volume de ar', ma: 'Massa de ar', mair: 'Vazão de ar que entra',
        th: 'Ângulo do disco', Td: 'Torque sobre o disco', xd: 'Curso do disco', Fd: 'Força sobre o disco',
      },
      totals: { over: 'Volume transbordado', deficit: 'Volume que faltou (vazio)' },
      cols: {
        junction: 'Junção', quantity: 'Grandeza', max: 'Maior', tmax: 'Em', min: 'Menor', tmin: 'Em',
        pipe: 'Tubo', pmax: 'Maior pressão estática', pmin: 'Menor pressão estática', station: 'Estação', vmax: 'Maior cavidade', tV: 'Em',
        i: 'Estação', x: 'Distância', steady: 'Permanente', hglMax: 'Maior HGL', hglMin: 'Menor HGL',
        time: 'Tempo', object: 'Objeto', message: 'O que aconteceu',
        P0: 'pressão de estagnação', flow: 'vazão mássica', timeS: 'Tempo (s)', xm: 'Distância (m)', tmaxS: 'Instante do maior (s)', tminS: 'Instante do menor (s)',
        hglMaxM: 'Maior HGL (m)', hglMinM: 'Menor HGL (m)', vmaxL: 'Maior cavidade (L)',
        force: 'Força', kind: 'Tipo', from: 'De', to: 'Até', p2p: 'Pico a pico', vmaxGas: 'Maior volume de gás',
      },
      sheets: { series: 'Séries do golpe', envelopes: 'Envoltórias do golpe', log: 'Eventos do golpe' },
    },
    checklist: {
      item: 'Golpe de aríete',
      control: {
        gas: 'o golpe de aríete é para líquidos (regime incompressível)',
        time: 'o golpe de aríete e a simulação no tempo não correm juntos: desligue um deles',
        duration: 'uma duração acima de zero',
        dtMode: 'passo de tempo automático ou dado',
        dt: 'um passo de tempo acima de zero',
        variance: 'um limite de variância acima de zero',
        nc: 'seções ideais do tubo controlador: um mínimo acima de zero e um máximo não menor que ele',
        cavitation: 'um modelo de cavitação',
        vapor: 'a pressão de vapor do fluido (o modelo de cavitação precisa dela)',
        psi: 'peso ψ das cavidades entre 0,5 e 1',
        cavBasis: 'a pressão com que as cavidades comparam',
        friction: 'o atrito do transiente',
        criterion: 'um critério do transiente artificial de 0 ou mais',
        minFlow: 'uma menor vazão do transiente artificial de 0 ou mais',
        saveEvery: 'gravar a cada N passos (um número inteiro, 1 ou mais)',
        stations: 'as estações de saída dos tubos',
        size: 'estações × passos abaixo de 2·10⁹ (menos seções ou uma corrida mais curta)',
        alpha0: 'uma fração de vazio das cavidades de gás acima de 0 e abaixo de 1',
        p0: 'a pressão da fração de vazio, acima da pressão de vapor',
        forces: 'conjuntos de forças com tubos abertos do modelo, distâncias dentro deles e um caminho entre as suas estações',
      },
      pipe: {
        wave: 'golpe de aríete: velocidade de onda calculada ou dada',
        speed: 'golpe de aríete: uma velocidade de onda acima de zero',
        support: 'golpe de aríete: como o tubo é fixado',
        circular: 'golpe de aríete: uma velocidade de onda dada (o cálculo precisa de uma seção circular)',
        fluidK: 'golpe de aríete: o módulo de compressibilidade do fluido (propriedades do sistema)',
        E: 'golpe de aríete: o módulo de elasticidade da parede',
        wall: 'golpe de aríete: a espessura da parede',
        nu: 'golpe de aríete: coeficiente de Poisson de 0 a menos de 0,5',
        c1: 'golpe de aríete: um coeficiente c₁ acima de zero',
        G: 'golpe de aríete: o módulo de rigidez da rocha',
        buriedPct: 'golpe de aríete: o aumento do tubo enterrado',
        diameter: 'golpe de aríete: o diâmetro interno',
        stations: 'golpe de aríete: as estações de saída',
        pMax: 'golpe de aríete: a pressão máxima como uma pressão',
        k: 'golpe de aríete: um coeficiente de Brunone de 0 ou mais (vazio: pelo número de Reynolds)',
      },
      data: {
        what: 'dados do golpe de aríete: uma grandeza que esta junção aceita',
        tripStart: 'dados do golpe de aríete: a parada ou a partida num instante ou num evento',
        tripAt: 'dados do golpe de aríete: o instante da parada ou da partida, 0 ou depois',
        basis: 'dados do golpe de aríete: valores absolutos ou relativos',
        start: 'dados do golpe de aríete: como a tabela começa',
        interp: 'dados do golpe de aríete: interpolação',
        resume: 'dados do golpe de aríete: onde uma tabela começa depois do seu evento',
        conditions: 'dados do golpe de aríete: a condição de cada evento',
        combined: 'dados do golpe de aríete: um evento completo do modelo',
        tables: 'dados do golpe de aríete: uma tabela por evento',
        table: 'dados do golpe de aríete: tabelas com números e unidades',
        order: 'dados do golpe de aríete: tempos da tabela a partir de 0, nunca diminuindo',
        eventStart: 'dados do golpe de aríete: uma tabela iniciada por um evento começa no tempo 0',
        period: 'dados do golpe de aríete: uma tabela repetida precisa do último tempo depois do primeiro',
        negative: 'dados do golpe de aríete: nenhum valor negativo',
        relStart: 'dados do golpe de aríete: uma tabela relativa começa em 100 % (o valor permanente)',
        repeatEnds: 'dados do golpe de aríete: uma tabela repetida termina com o valor com que começa',
        relSpecial: 'dados do golpe de aríete: nenhuma tabela relativa numa junção que a sua condição especial fecha',
        specialStart: 'dados do golpe de aríete: fechada pela condição especial, a primeira tabela começa fechada',
        range: 'dados do golpe de aríete: uma abertura entre 0 e 100 %',
        noSteady: 'dados do golpe de aríete: um valor permanente da grandeza da tabela',
      },
      pump: {
        mode: 'golpe de aríete: uma tabela ou uma parada precisa da bomba ligada na sua curva (com os dados de quatro quadrantes, uma tabela de rotação também pode fazê-la partir do repouso)',
        inertia: 'golpe de aríete: o momento de inércia da bomba (parada ou partida)',
        rpm: 'golpe de aríete: a rotação nominal da bomba (parada ou partida)',
        power: 'golpe de aríete: uma curva de potência no eixo ou de eficiência (parada ou partida)',
        startState: 'golpe de aríete: uma partida precisa da bomba na sua curva, desligada e fechada',
        curve: 'golpe de aríete: a curva de altura da bomba (partida)',
        motor: 'golpe de aríete: a tabela do torque do motor, desde 0 %, com rotações crescentes e torque de partida acima de zero (partida)',
        fourTable: 'golpe de aríete: uma tabela de quatro quadrantes de θ, WH e WB de 0 a 360°, pelo menos 9 pontos, os valores de 360° iguais aos de 0°',
        fourRef: 'golpe de aríete: o ponto de referência dos dados de quatro quadrantes',
        fourSteady: 'golpe de aríete: a referência do regime permanente precisa da bomba ligada',
        fourBep: 'golpe de aríete: uma curva de eficiência ou de potência no eixo, para o ponto de melhor eficiência',
        fourUser: 'golpe de aríete: a vazão, a altura, a rotação e a potência no eixo do ponto de referência',
      },
      valve: {
        rate: 'golpe de aríete: uma velocidade máxima da abertura acima de zero',
        char: 'golpe de aríete: a característica da válvula, de que a velocidade máxima precisa',
      },
      check: {
        model: 'golpe de aríete: um modelo da retenção',
        loss: 'golpe de aríete: uma perda quadrática de aberta (K, Cv ou Kv) para o seu modelo dinâmico',
        decel: 'golpe de aríete: uma tabela da velocidade reversa contra a desaceleração, pelo menos 2 pontos, as desacelerações crescendo desde 0',
        window: 'golpe de aríete: uma janela da desaceleração acima de zero',
        disc: 'golpe de aríete: os dados do disco',
        stop: 'golpe de aríete: a abertura total do disco acima de zero (um ângulo até 180°)',
        inertia: 'golpe de aríete: o momento de inércia ou a massa do disco acima de zero',
        weight: 'golpe de aríete: a massa do disco e a distância ao seu centro de massa',
        optional: 'golpe de aríete: os campos opcionais do disco como números (molas, amortecedores e pesos de 0 ou mais), ou vazios',
        cvTable: 'golpe de aríete: uma tabela da fração do Cv de (0, 0 %) até (abertura total, 100 %), com as posições crescendo',
        fluidMass: 'golpe de aríete: o empuxo do disco',
        orient: 'golpe de aríete: a posição da válvula, um ângulo de −90° a 90°',
      },
      belowVapor: 'golpe de aríete: uma pressão fixa acima da pressão de vapor do fluido',
      device: {
        area: 'golpe de aríete: a seção do tanque',
        table: 'golpe de aríete: uma tabela de volume por altura a partir de 0, as duas crescentes',
        tableShort: 'golpe de aríete: uma tabela de volume por altura até o topo',
        bottom: 'golpe de aríete: a cota do fundo como um comprimento',
        height: 'golpe de aríete: uma altura acima de zero',
        orifice: 'golpe de aríete: o Cd·A do orifício em cada sentido',
        riser: 'golpe de aríete: o comprimento, o diâmetro e o fator de atrito do tubo curto',
        n: 'golpe de aríete: um expoente politrópico de 1 a 1,4',
        precharge: 'golpe de aríete: a pressão e o volume da pré-carga',
        Vg0: 'golpe de aríete: o volume de gás do regime permanente',
        vol: 'golpe de aríete: o volume do vaso',
        vgMin: 'golpe de aríete: um menor volume de gás de 0 ou mais',
        Pset: 'golpe de aríete: a pressão de ajuste',
        Pext: 'golpe de aríete: a pressão externa',
        capacity: 'golpe de aríete: a capacidade da válvula totalmente aberta',
        rate: 'golpe de aríete: uma maior velocidade da abertura acima de zero',
        Pclose: 'golpe de aríete: uma pressão de fechamento não acima da pressão de ajuste',
        Pfull: 'golpe de aríete: uma pressão de abertura total acima da pressão de ajuste',
        avType: 'golpe de aríete: o tipo da ventosa',
        CdAin: 'golpe de aríete: o Cd·A da entrada de ar',
        CdAout: 'golpe de aríete: o Cd·A da saída de ar',
        CdAout2: 'golpe de aríete: o Cd·A da saída menor',
        switch: 'golpe de aríete: quando a saída menor assume',
        Popen: 'golpe de aríete: a pressão de abertura como uma pressão',
        Tair: 'golpe de aríete: a temperatura do ar (o fluido não tem uma)',
        mAir0: 'golpe de aríete: o ar do regime permanente, 0 ou mais',
      },
    },
  },
  // the chapter of the help (src/ui/help/help.js), with the module
  help: {
    chapters: {
      surge: {
        title: 'Golpe de aríete',
        sections: {
          concept: {
            title: 'Como funciona',
            body: `<p>Uma mudança rápida numa rede de líquido, como uma válvula que fecha, uma bomba que para ou um nível que salta, manda ondas de pressão pelos tubos na velocidade do som no tubo, muitas vezes perto de 1000 m/s. O golpe de aríete acompanha essas ondas a partir do regime permanente do cenário. Ele é um módulo próprio: só calcula enquanto estiver ligado, e o resto do programa funciona igual sem ele.</p>
<ul>
<li>É para líquidos, no regime incompressível. Ele e a [[go:time.concept|simulação no tempo]] não correm juntos: ligar um desliga o outro.</li>
<li>O regime permanente fica como está em todas as tabelas, cartões e gráficos, e é o instante 0 s do golpe de aríete.</li>
<li>Depois de cada mudança, o regime permanente vem na hora e o golpe de aríete segue em segundo plano. O selo [[t:surge.stamp.label]], ao lado do título do modelo, mostra o progresso; o botão ao lado dele para a corrida, e o que já foi calculado fica.</li>
</ul>
<p class="tip"><b>Quando usar:</b> quando algo muda num tempo comparável a 2·L/a dos tubos, alguns segundos para um tubo de alguns quilômetros: uma válvula que fecha depressa, uma bomba que para sem volante, uma retenção que bate.</p>`,
          },
          control: {
            title: 'Controle da corrida',
            body: `<p>Na janela [[t:inspector.system.title]], seção [[t:surge.system.title]]:</p>
<ul>
<li>[[t:surge.system.on]]: liga o módulo no cenário. Desligado, os seus dados ficam no modelo e não são usados.</li>
<li>[[t:surge.system.duration]]: por quanto tempo o transiente é acompanhado.</li>
<li>[[t:surge.system.dtMode]]: [[t:surge.system.dtModes.auto]] acha o passo em que cabe um número inteiro de seções em cada tubo, ajustando cada velocidade de onda em no máximo o [[t:surge.system.varianceMax]]; [[t:surge.system.dtModes.given]] usa o passo que você digita.</li>
<li>[[t:surge.system.cavitation]]: [[t:surge.system.cavitations.dvcm]], [[t:surge.system.cavitations.dgcm]] (cada estação guarda um pouco de gás livre; escolhê-las leva ψ a 0,95, e a fração de vazio e a sua pressão ficam nas opções avançadas), ou [[t:surge.system.cavitations.none]].</li>
<li>[[t:surge.system.friction]]: [[t:surge.system.frictions.steady]], [[t:surge.system.frictions.variable]], que recalcula o fator de atrito de cada estação pela sua vazão, com a correlação do regime permanente, quando a sua velocidade muda mais de 1 %, ou [[t:surge.system.frictions.brunone]], que soma o atrito transitório da aceleração do líquido.</li>
<li>[[t:surge.system.saveEvery]] e [[t:surge.system.stations]]: o que é gravado no tempo. As maiores e menores pressões sempre cobrem todas as estações e todos os passos.</li>
<li>[[t:surge.system.fluidK]]: para a água, vem da sua temperatura; um fluido seu precisa dele.</li>
</ul>
<p>A tabela [[t:surge.system.sectioning]] mostra, para cada tubo, o comprimento, a velocidade de onda, as seções, a velocidade ajustada e a variância, e abaixo dela o passo de tempo, as estações, os passos e uma estimativa do tempo da corrida. Ela acompanha cada mudança, e uma linha leva ao seu tubo.</p>
<p>A seção [[t:surge.system.forces]] guarda os conjuntos de forças: a força axial do líquido num trecho entre duas estações, numa estação ou numa saída, para o projeto dos apoios. Cada conjunto mostra a estação que a sua distância usa, e a sua força aparece nos resultados e nos gráficos.</p>
<p>A seção [[t:surge.system.advanced]] guarda o peso ψ das cavidades, a pressão com que elas comparam e o teste do [[go:surge.method|transiente artificial]]. Abaixo delas vêm os eventos do modelo, com que uma tabela ou uma parada podem começar.</p>
<p>O controle pertence à solução do cenário, então um [[go:scenarios.concept|cenário filho]] pode mudá-lo, por exemplo para testar um fechamento mais lento.</p>`,
          },
          wave: {
            title: 'Velocidade de onda de um tubo',
            body: `<p>Com o golpe de aríete ligado, cada tubo mostra a seção [[t:surge.pipe.title]] no painel de propriedades. A velocidade de onda é [[t:surge.pipe.waves.calculated]], a partir do líquido e da parede:</p>
[[eq:waveSpeed]]
<p>K é o módulo de compressibilidade do líquido, D o diâmetro interno, e a espessura da parede e E o seu módulo de elasticidade. O coeficiente c₁ segue [[t:surge.pipe.support]], com o coeficiente de Poisson ν da parede. Para parede fina:</p>
[[eq:waveC1]]
<p>Para parede grossa, com k o termo da parede fina fixada do mesmo jeito:</p>
[[eq:waveC1Thick]]
<p>Para um túnel, com G o módulo de rigidez da rocha:</p>
[[eq:waveTunnel]]
<ul>
<li>Vazios, E, ν e a parede usam os valores típicos do material do catálogo e a parede do seu tamanho, mostrados em cinza. [[t:surge.pipe.typical]] preenche E e ν com outro material.</li>
<li>Um tubo enterrado usa a velocidade da parede fina ancorada em todo o comprimento, aumentada da porcentagem que você der.</li>
<li>[[t:surge.pipe.waves.given]]: digite a velocidade. É o único caminho para um tubo que não é circular.</li>
</ul>
<p>Abaixo, o tubo mostra as seções que ele tem na corrida com a velocidade ajustada e a variância, as suas [[t:surge.pipe.stations]], e uma [[t:surge.pipe.pMax]] opcional, que dá um aviso quando a corrida passa dela. Com o atrito [[t:surge.system.frictions.brunone]], ele também recebe o seu [[t:surge.pipe.k]], vazio para vir do número de Reynolds da sua vazão permanente.</p>`,
          },
          data: {
            title: 'Dados das junções',
            body: `<p>Com o golpe de aríete ligado, uma junção mostra a seção [[t:surge.junction.title]] no painel de propriedades, com o que a move no transiente. Estes dados ficam separados dos [[go:time.data|dados no tempo]] da simulação no tempo, então um modelo guarda os dois.</p>
<ul>
<li>Uma tabela de uma das suas grandezas no tempo, como na simulação no tempo: a abertura, o K, o Cv ou o Kv de uma válvula; a vazão ou a pressão impostas; o nível ou a pressão na superfície de um reservatório; a rotação de uma bomba; o ajuste de uma válvula de controle que esteja [[t:surge.junction.control.modes.ideal]].</li>
<li>A parada de uma bomba: dali em diante o motor não dá torque, e a bomba perde rotação pela sua inércia. Ela precisa do [[t:surge.junction.pump.inertia]], da [[t:surge.junction.pump.rpm]] e da potência no eixo nessa rotação, por uma curva de potência ou pelas curvas de altura e de eficiência.</li>
<li>A partida de uma bomba na sua curva, desligada e fechada no regime permanente: dali em diante o motor dá o torque da sua tabela, [[t:surge.junction.pump.motor]], contra a rotação, e a bomba ganha rotação pela sua inércia. Ela precisa dos mesmos dados da parada e dessa tabela.</li>
<li>Os [[t:surge.junction.pump.four]] de uma bomba com curva: as suas curvas de Suter, do fabricante, que dão a altura e o torque em todos os quadrantes. Uma parada ou uma partida deixa então a vazão e a rotação voltarem, e uma bomba desligada e fechada também pode partir por uma tabela de rotação.</li>
<li>Para uma retenção, um [[t:surge.junction.check.model]] diferente de [[t:surge.junction.check.models.none]]: [[t:surge.junction.check.models.decel]] (uma tabela da válvula), [[t:surge.junction.check.models.swing]] ou [[t:surge.junction.check.models.nozzle]], com os dados do seu disco.</li>
</ul>
<p>Uma tabela começa pelo relógio ou depois de um evento, com o mesmo editor de condições da simulação no tempo; uma parada ou uma partida acontece num instante ou num evento. Os eventos do modelo são editados na janela do sistema, abaixo do golpe de aríete.</p>
<ul>
<li>Uma pressão ou uma vazão imposta pode ser [[t:surge.device.specials.infinitePipe]] ([[t:surge.device.special]]): as ondas saem da rede por ali, como se o seu tubo seguisse sem fim. A ponta mantém a característica do regime permanente, P = C<sub>E</sub> − B·ṁ com C<sub>E</sub> = P<sub>0</sub> + B·ṁ<sub>0</sub>, e as suas tabelas não são usadas.</li>
<li>Um reservatório que é um tanque finito (os dados do seu tanque, como na [[go:time.tanks|simulação no tempo]]) tem o nível calculado pela vazão que entra e sai, pela regra do trapézio; ele transborda pelo topo, e depois de vazio o líquido que falta é contado. Só a pressão na superfície de um tanque aberto aceita uma tabela; um tanque fechado tem a pressão do seu gás. A sua seção no inspetor aparece com o golpe de aríete ligado; a corrida parte do nível do regime permanente, que tem de ficar acima da ponta de um tubo pela qual o regime permanente tira líquido.</li>
</ul>
<h4>Dispositivos</h4>
<ul>
<li>Uma válvula de retenção fecha quando a vazão voltaria, e abre de novo quando a pressão empurra para a frente; os seus modelos dinâmicos a fecham pela desaceleração do líquido ou pelo movimento do seu disco.</li>
<li>Uma válvula de controle fica [[t:surge.junction.control.modes.frozen]], uma válvula fixa com a perda do regime permanente, ou [[t:surge.junction.control.modes.ideal]], mantendo o seu ajuste a cada passo, com uma [[t:surge.junction.control.rate]] opcional, que precisa da sua característica.</li>
<li>Uma bomba que parou ou partiu não deixa a vazão voltar, como uma retenção, a menos que tenha os seus [[t:surge.junction.pump.four]].</li>
<li>Um bocal só descarrega para fora.</li>
</ul>`,
          },
          devices: {
            title: 'Dispositivos de proteção',
            body: `<p>O grupo [[t:junctions.groups.protection]] da paleta tem quatro junções feitas para amortecer um golpe de aríete. No regime permanente cada uma é um nó sem perdas (a válvula de alívio fechada, a ventosa sem ar); os seus dados ficam na seção [[t:surge.junction.title]] do inspetor, com o golpe de aríete ligado.</p>
<h4>[[t:junctions.surgeTank.label]]</h4>
<p>Um tanque aberto sobre o nó. O seu nível oscila com o líquido que entra e sai, que a regra do trapézio integra junto com o nó em cada passo:</p>
[[eq:surgeTank]]
<p>O nível no regime permanente é o da pressão do nó, ou um nível dado (o tanque vira então uma referência de pressão). A seção é constante ou uma tabela de volume por altura; acima do topo ele transborda, e no fundo ele fica vazio e só deixa o líquido voltar. Um orifício soma uma perda própria em cada sentido, e um tubo curto a inércia da sua coluna:</p>
[[eq:surgeRiser]]
<p>Unidirecional, uma retenção deixa que ele só alimente a rede.</p>
<h4>[[t:junctions.airVessel.label]]</h4>
<p>Um vaso fechado cujo gás o líquido comprime e expande, politrópico com o expoente n (1,2 por padrão):</p>
[[eq:airVessel]]
<p>O gás do regime permanente é dado, ou vem da pré-carga a temperatura constante. Com uma geometria, o nível do líquido soma a sua coluna à pressão do gás. O volume do vaso e um menor volume de gás limitam o gás; o orifício e o tubo curto são os do tanque de alívio.</p>
<h4>[[t:junctions.reliefValve.label]]</h4>
<p>Fechada, ela abre quando a pressão do nó passa da pressão de ajuste P<sub>a</sub>; aberta, o seu Cv cresce em linha reta da pressão de fechamento até a pressão de abertura total, e ela fecha na pressão de fechamento:</p>
[[eq:reliefValve]]
<p>A vazão aliviada é resolvida junto com o nó. Ela pode também abrir de uma vez, ter uma maior velocidade de abertura, ou seguir uma tabela da sua abertura (uma válvula piloto).</p>
<h4>[[t:junctions.airValve.label]]</h4>
<p>Quando a pressão do nó cai abaixo da pressão de abertura, a ventosa admite ar, e o expulsa de novo quando a pressão sobe, como Wylie e Streeter a modelam: o ar fica no nó, ideal (R = 287,05 J/(kg·K), k = 1,4) e a temperatura constante. A vazão de ar é sônica abaixo da razão crítica 0,52828 e subsônica acima dela, e na saída igual, com os papéis trocados:</p>
[[eq:airFlowSonic]]
[[eq:airFlowSubsonic]]
[[eq:airValveGas]]
<p>Quando o ar acaba de sair, a ventosa fecha e o nó volta a ser só líquido. Uma ventosa de dois estágios expulsa o ar por um orifício menor acima de uma diferença de pressão ou de uma vazão de ar, o que suaviza o último instante.</p>`,
          },
          results: {
            title: 'Resultados',
            body: `<p>Quando a corrida termina, a vista [[t:app.tabs.out]] ganha três abas:</p>
<ul>
<li>[[t:surge.results.tabs.surge]]: o resumo da corrida (passo de tempo, passos, passo de teste, cavitação), as seções de cada tubo, os extremos das junções, como a menor rotação de uma bomba, com a referência dos seus dados de quatro quadrantes, e as [[t:surge.results.forces]] dos conjuntos de forças.</li>
<li>[[t:surge.results.tabs.surgeEnv]]: a maior e a menor pressão estática de cada tubo, com onde e quando, e o mesmo para cada estação de um tubo que você escolher.</li>
<li>[[t:surge.results.tabs.surgeLog]]: os eventos, as mudanças de estado dos dispositivos e as cavidades, na ordem do tempo.</li>
</ul>
<p>Os avisos da corrida se juntam aos do regime permanente. O cursor de tempo, na linha das abas, escolhe o instante gravado mostrado: [[t:surge.overlay.P]] e as outras grandezas do golpe de aríete colorem o desenho nesse instante, ou pelas envoltórias da corrida.</p>
<p>Na vista [[t:app.tabs.charts]], [[t:surge.charts.tabs.time]] desenha séries das estações, das junções e dos conjuntos de forças, e [[t:surge.charts.tabs.profile]] desenha as maiores e menores linhas piezométricas ao longo de um caminho, com o regime permanente, a cota dos tubos e a pressão de vapor. As séries, as envoltórias e o registro vão para o arquivo do Excel com os outros resultados.</p>`,
          },
          method: {
            title: 'Método',
            body: `<p>Os tubos são resolvidos pelo <b>método das características</b>. Ao longo de um tubo, com P a pressão de estagnação (absoluta) e ṁ a vazão mássica, as equações da quantidade de movimento e da continuidade do líquido:</p>
[[eq:surgeEquations]]
<p>valem ao longo das retas dx/dt = ±a. Cada tubo é dividido em n seções que a onda atravessa num passo de tempo Δt, o mesmo em toda a rede, e a sua velocidade de onda é ajustada para a′ para que isso caiba exatamente:</p>
[[eq:surgeSections]]
<p>Numa estação i, as estações A (a montante) e B (a jusante) do passo anterior dão duas equações de compatibilidade, com o atrito linearizado como fazem Wylie e Streeter:</p>
[[eq:surgeCplus]]
[[eq:surgeCminus]]
[[eq:surgeCoefficients]]
<p>R usa a perda do tubo no regime permanente, para que o regime permanente seja uma solução do método e nada se mexa enquanto nada muda. Com o atrito [[t:surge.system.frictions.variable]], cada estação tem o seu próprio R, o atrito da sua vazão pela correlação do regime permanente mais os acessórios do regime permanente, recalculado quando a sua velocidade muda mais de 1 %:</p>
[[eq:frictionVariable]]
<p>Com [[t:surge.system.frictions.brunone]], a perda por unidade de comprimento ganha também o termo transitório de Brunone na forma de Vítkovský, com o coeficiente k de Vardy e Brown pelo número de Reynolds da vazão permanente de cada tubo (ou o seu [[t:surge.pipe.k]]):</p>
[[eq:brunone]]
<p>O termo é explícito, pelas vazões dos dois passos anteriores, na estação do pé de cada característica: a C<sup>+</sup> de A usa CP − ΔP<sub>A</sub> e a C<sup>−</sup> de B usa CM + ΔP<sub>B</sub>, com U<sub>j</sub> o maior de D<sup>+</sup> e D<sup>−</sup> para a vazão para a frente, o menor para a vazão de volta e a média deles sem vazão:</p>
[[eq:brunoneStep]]
<p>Dentro de um tubo, as duas equações dão a estação:</p>
[[eq:surgeInterior]]
<p>Nas pontas, cada junção soma a sua própria lei às equações dos seus tubos: uma pressão fixa, uma vazão, uma perda, a curva de uma bomba ou o estado de um dispositivo.</p>
<h4>Cavidades</h4>
<p>Com [[t:surge.system.cavitations.dvcm]], uma estação cuja pressão cairia abaixo da pressão de vapor P<sub>v</sub> fica em P<sub>v</sub>, as suas duas vazões se separam, e o volume da sua cavidade as acompanha:</p>
[[eq:cavityFlows]]
[[eq:cavityVolume]]
<p>Com [[t:surge.system.cavitations.dgcm]], cada estação guarda um pouco de gás livre a temperatura constante, com a sua fração de vazio α<sub>0</sub> dada na pressão p<sub>0</sub> (10⁻⁷ a 1 atm por padrão), meia seção nas pontas de um tubo:</p>
[[eq:gasCavity]]
<p>O volume do gás segue as duas vazões da estação como uma cavidade de vapor, o que dá a sua pressão pela raiz positiva de uma equação do segundo grau; a pressão nunca chega a P<sub>v</sub>. Os dispositivos de proteção e as pressões fixas não guardam gás, e os lados de válvulas e bombas mantêm as cavidades de vapor.</p>
<h4>Parada de uma bomba</h4>
<p>A altura de uma bomba na rotação relativa s segue a sua curva pelas leis de semelhança:</p>
[[eq:pumpCurve]]
<p>Depois de uma parada, a rotação cai pelo torque do líquido, com I o momento de inércia, ω<sub>r</sub> a rotação nominal e P<sub>1</sub> a potência no eixo na rotação nominal:</p>
[[eq:pumpTrip]]
<p>A rotação de cada passo vem pela regra dos trapézios, iterada com a solução do passo:</p>
[[eq:pumpTripStep]]
<h4>Partida de uma bomba</h4>
<p>Uma bomba na sua curva, desligada e fechada no regime permanente, pode partir: dali em diante o motor dá o torque T<sub>m</sub>(s) da sua tabela, [[t:surge.junction.pump.motor]], e a rotação sobe pela diferença com o torque do líquido:</p>
[[eq:pumpStart]]
<p>A rotação de cada passo é a raiz da regra dos trapézios, resolvida junto com o passo, e a retenção da bomba a mantém fechada até que a sua altura vença a pressão contra ela:</p>
[[eq:pumpStartStep]]
<h4>Bombas em quatro quadrantes</h4>
<p>Com os seus [[t:surge.junction.pump.four]], a altura e o torque de uma bomba vêm das suas curvas de Suter em todos os quadrantes (bombeando, freando, como turbina, girando ao contrário), em linha reta em θ:</p>
[[eq:suter]]
[[eq:suterVars]]
<p>O ponto de referência é o regime permanente da bomba, a sua melhor eficiência na rotação nominal ou um ponto dado; c<sub>H</sub> e c<sub>B</sub> escalam a tabela para que ela encontre o regime permanente. Depois de uma parada ou de uma partida, a vazão e a rotação são resolvidas juntas em cada passo:</p>
[[eq:fourStep]]
<p>A vazão e a rotação podem então voltar, e só uma retenção da bomba segura a vazão. O registro guarda a primeira inversão de cada uma.</p>
<h4>Velocidade máxima de uma válvula de controle</h4>
<p>Uma válvula de controle em [[t:surge.junction.control.modes.ideal]] pode ter uma [[t:surge.junction.control.rate]] r. A sua abertura x segue então a abertura x* que o controle pede, que vem do Cv da solução ideal pela inversa c<sup>−1</sup> da sua característica, andando no máximo r·Δt num passo; enquanto fica para trás, ela é uma válvula fixa com o Cv da abertura a que chegou:</p>
[[eq:controlRate]]
<h4>Retenções dinâmicas</h4>
<p>[[t:surge.junction.check.models.decel]]: quando a vazão inverte, a desaceleração a<sub>d</sub> do líquido na sua [[t:surge.junction.check.window]] dá, pela tabela da válvula, a velocidade reversa V<sub>R</sub> em que ela fecha:</p>
[[eq:checkDecel]]
<p>[[t:surge.junction.check.models.swing]] e [[t:surge.junction.check.models.nozzle]]: o disco se move pelas forças sobre ele (Thorley, 2004; Li e Liou, 2003), e a perda na sua posição é a da válvula totalmente aberta dividida pelo quadrado da fração do seu Cv:</p>
[[eq:checkSwing]]
[[eq:checkNozzle]]
<p>Cada passo é a regra do trapézio implícita na posição e na sua velocidade, com a válvula resolvida em cada posição tentada; num batente o disco fica sem rebote, e no assento a válvula fica fechada até que o torque ali a abra:</p>
[[eq:checkStep]]
<h4>Forças desbalanceadas</h4>
<p>A força axial de um conjunto de forças vem do balanço de quantidade de movimento do líquido entre duas estações a e b, com p a pressão estática e p<sub>amb</sub> a ambiente, e o atrito de cada seção no caminho:</p>
[[eq:forceSegment]]
<p>É a força sobre as duas curvas e o trecho reto entre elas, e num regime permanente num caminho horizontal ela é zero. Numa estação a força é (p − p<sub>amb</sub>)·A + ṁ²/(ρA); numa saída, o trecho até o fim do tubo menos a quantidade de movimento do jato, ṁ²/(ρA<sub>s</sub>).</p>
<h4>Passo de teste</h4>
<p>Antes da corrida, um passo sem nada mudando precisa deixar cada estação dentro do [[t:surge.system.criterion]] da sua pressão e da sua vazão permanentes. Uma mudança maior quer dizer que o regime permanente e o modelo do transiente discordam, um transiente artificial: um aviso cita as estações, e a corrida para quando [[t:surge.system.stop]] estiver marcado.</p>`,
          },
          limits: {
            title: 'Limites e referências',
            body: `<ul>
<li>As cavidades discretas dão o momento e a ordem de grandeza dos picos depois de um colapso, não o seu valor exato; uma cavidade maior que um décimo da sua seção dá um aviso.</li>
<li>A velocidade de onda é constante em cada tubo; o gás livre das cavidades de gás fica na sua estação e não a muda.</li>
<li>Sem Brunone o atrito é quase permanente, então as ondas se amortecem mais devagar que na realidade; o termo de Brunone as amortece como nas medições, com um coeficiente por tubo para a corrida toda.</li>
<li>Sem os seus dados de quatro quadrantes, uma bomba não tem vazão reversa e não trabalha como turbina; com eles, os dados são seus: o Pump It não traz nenhuma tabela publicada.</li>
<li>O ar de uma ventosa e o gás de um vaso ficam onde estão: nenhum dos dois anda pelos tubos, e um vaso ou um tanque que fica vazio mantém a sua pressão no nó.</li>
<li>Os tubos não se movem: as forças sobre eles são calculadas, mas não a resposta deles. A malha escalonada de alguns programas não é oferecida.</li>
</ul>
<h4>Referências</h4>
<ul>
<li>Wylie, E. B.; Streeter, V. L.; Suo, L. <i>Fluid Transients in Systems</i>. Prentice Hall, 1993.</li>
<li>Chaudhry, M. H. <i>Applied Hydraulic Transients</i>. 3ª ed., Springer, 2014.</li>
<li>Thorley, A. R. D. <i>Fluid Transients in Pipeline Systems</i>. 2ª ed., Professional Engineering Publishing, 2004.</li>
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
