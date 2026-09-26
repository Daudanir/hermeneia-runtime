window.HermeneiaLexicon = (() => {
  const canon = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const set = s => new Set(String(s).split(/\s+/).filter(Boolean).map(canon));

  const POS = {
    articles: set('o a os as um uma uns umas'),
    demonstratives: set('este esta estes estas isto esse essa esses essas isso aquele aquela aqueles aquelas aquilo tal tais'),
    pronouns: set('eu tu ele ela nós nos vós vos vocês voces eles elas me te se si lhe lhes mim ti conosco convosco quem que qual quais cujo cuja cujos cujas'),
    possessives: set('meu minha meus minhas teu tua teus tuas seu sua seus suas nosso nossa nossos nossas vosso vossa vossos vossas'),
    prepositions: set('a à às ao aos ante após apos até ate com contra de desde em entre para perante por sem sob sobre trás tras de do da dos das em no na nos nas pelo pela pelos pelas'),
    conjunctions: set('e nem mas porém porem contudo todavia entretanto ou logo portanto pois porque embora quando enquanto conforme caso se como assim contudo'),
    negation: set('não nao nem nunca jamais nenhum nenhuma nenhuns nenhumas nada tampouco'),
    modal: set('certamente provavelmente possivelmente talvez necessariamente aparentemente presumivelmente evidentemente realmente possivel possível provável provavel'),
    time: set('hoje ontem amanhã amanha agora depois antes então entao logo cedo tarde finalmente inicialmente posteriormente anteriormente outrora ainda já ja sempre nunca'),
    imperative: set('vê ve veja vejam vede observe observa observem considere considera considerem leia le lê leiam contemple contemplai notai note perceba percebam'),
    reporting: set('dizer disse dizia dizendo responder respondeu respondia relatar relatou relatava comentar comentou comentava perguntar perguntou perguntava afirmar afirmou explicava explicou declarar declarou ensinar ensinou'),
    cognition: set('pensar pensava pensou cogitar cogitava cogitou saber sabia soube conhecer conhecia compreender compreendeu crer cria creu suspeitar suspeitava perceber percebeu lembrar lembrava esquecer esqueceu perguntar questionar duvidar imaginar considerar'),
    affect: set('amar amava amou amor gostar gostava desejar desejava querer queria temer temia medo alegria tristeza paixão paixao esperança esperanca odiar ódio odio amizade amigo'),
    evaluation: set('bom boa bons boas ruim ruins melhor melhores pior piores excelente excelentes importante importantes justo justa injusto injusta correto correta errado errada verdadeiro verdadeira falso falsa belo bela útil util necessário necessaria valioso valiosa avaliar avalia avaliou julgamento julgar julga'),
    obligation: set('dever deve devem deveria deveriam precisar precisa precisam necessário necessaria obrigação obrigacao convém convem importa'),
    copulas: set('ser estar parecer permanecer tornar ficar continuar resultar significar representar constituir'),
    motion: set('ir vir sair entrar chegar partir voltar subir descer caminhar correr levar trazer passar mover'),
    agency: set('fazer agir realizar produzir criar decidir escolher optar tentar buscar procurar trabalhar esforçar esforcar obter alcançar alcancar manter impedir permitir'),
    existence: set('haver existir ocorrer acontecer surgir permanecer desaparecer'),
    causation: set('causar provocar produzir gerar levar resultar determinar impedir permitir favorecer'),
    relation: set('ter pertencer relacionar unir separar acompanhar seguir anteceder depender associar ligar'),
    commonVerbs: set('ver ser estar ficar ter haver existir fazer dizer responder perguntar afirmar explicar ensinar poder querer dever precisar dar receber tomar colocar deixar encontrar chamar viver morrer tornar manter mostrar usar começar comecar terminar seguir abrir fechar formar selecionar avaliar converter participar armazenar absorver depender ocorrer tratar transmitir aprender escolher julgar procurar encontrar permanecer chegar decidir ensinar produzir relacionar descrever apresentar indicar revelar limitar desenvolver acrescentar concluir reformular comparar considerar doar chamar conduzir aumentar purificar frutificar multiplicar associar obter esquecer amar expiar evitar pertencer preservar adquirir dirigir pesar confiar traçar reconciliar apaziguar significar guardar desviar estabelecer julgar transgredir reter possuir')
  };

  const IRREGULAR = {
    'é':'ser','era':'ser','eram':'ser','foi':'ser/ir','foram':'ser/ir','fora':'ser/ir','somos':'ser','são':'ser','sao':'ser',
    'está':'estar','esta':'estar','estão':'estar','estao':'estar','estava':'estar','estavam':'estar','ficou':'ficar','ficaram':'ficar','sido':'ser','seja':'ser','sejam':'ser','sejais':'ser',
    'tem':'ter','tinha':'ter','tinham':'ter','teve':'ter','tiveram':'ter','há':'haver','ha':'haver','havia':'haver',
    'vê':'ver','ve':'ver','viu':'ver','viram':'ver','disse':'dizer','diz':'dizer','dizia':'dizer','respondeu':'responder','perguntou':'perguntar',
    'fez':'fazer','faz':'fazer','fizeram':'fazer','deu':'dar','deram':'dar','pôde':'poder','pode':'poder','podem':'poder','podia':'poder',
    'quis':'querer','quer':'querer','queria':'querer','deve':'dever','devem':'dever','devia':'dever','precisa':'precisar','precisam':'precisar',
    'soube':'saber','sabia':'saber','sabiam':'saber','creu':'crer','cria':'crer','pensou':'pensar','pensava':'pensar','cogitava':'cogitar',
    'optou':'optar','decidiu':'decidir','escolheu':'escolher','ocorreu':'ocorrer','ocorria':'ocorrer','ocorrerá':'ocorrer','ocorrera':'ocorrer','ocorreria':'ocorrer',
    'irá':'ir','ira':'ir','vai':'ir','ia':'ir','veio':'vir','vinha':'vir','vieram':'vir','saiu':'sair','entrou':'entrar','chegou':'chegar',
    'produziu':'produzir','criou':'criar','gerou':'gerar','causou':'causar','levou':'levar','resultou':'resultar','impediu':'impedir','permitiu':'permitir',
    'recebeu':'receber','receberam':'receber','obtiveram':'obter','obteve':'obter','mostrou':'mostrar','afirmou':'afirmar','explicou':'explicar','ensinou':'ensinar','chamou':'chamar','conduzem':'conduzir','existindo':'existir','aumentando':'aumentar','tornem':'tornar','doado':'doar','doada':'doar','doados':'doar','doadas':'doar'
  };

  const DISCOURSE = {
    contrast: [
      {re:/\bmas\b/i, marker:'mas', conf:.98},{re:/\bporém\b|\bporem\b/i, marker:'porém', conf:.98},{re:/\bcontudo\b/i, marker:'contudo', conf:.99},
      {re:/\btodavia\b/i, marker:'todavia', conf:.98},{re:/\bentretanto\b/i, marker:'entretanto', conf:.98},{re:/\bao contrário\b|\bao contrario\b/i, marker:'ao contrário', conf:.95}
    ],
    concession: [
      {re:/\bembora\b/i, marker:'embora', conf:.97},{re:/\bainda que\b/i, marker:'ainda que', conf:.97},{re:/\bmesmo que\b/i, marker:'mesmo que', conf:.94},
      {re:/\bapesar de\b/i, marker:'apesar de', conf:.94},{re:/\bnão obstante\b|\bnao obstante\b/i, marker:'não obstante', conf:.97}
    ],
    cause: [
      {re:/\bporque\b/i, marker:'porque', conf:.96},{re:/\bpois\b/i, marker:'pois', conf:.76},{re:/\bjá que\b|\bja que\b/i, marker:'já que', conf:.96},
      {re:/\bvisto que\b/i, marker:'visto que', conf:.96},{re:/\bvisto como\b/i, marker:'visto como', conf:.91},{re:/\buma vez que\b/i, marker:'uma vez que', conf:.95},{re:/\bpor causa de\b/i, marker:'por causa de', conf:.98}
    ],
    consequence: [
      {re:/\bportanto\b/i, marker:'portanto', conf:.98},{re:/\bpor isso mesmo\b/i, marker:'por isso mesmo', conf:.99},{re:/\bpor isso\b/i, marker:'por isso', conf:.98},{re:/\bdessa forma\b/i, marker:'dessa forma', conf:.95},
      {re:/\bassim\b/i, marker:'assim', conf:.78},{re:/\bde modo que\b/i, marker:'de modo que', conf:.96},{re:/\bde sorte que\b/i, marker:'de sorte que', conf:.94}
    ],
    condition: [
      {re:/(?:^|[,;:]\s*)se\s+/i, marker:'se', conf:.96},{re:/\bcaso\b/i, marker:'caso', conf:.95},{re:/\bcontanto que\b/i, marker:'contanto que', conf:.97},
      {re:/\bdesde que\b/i, marker:'desde que', conf:.90},{re:/\ba menos que\b/i, marker:'a menos que', conf:.97}
    ],
    purpose: [
      {re:/\bpara\s+(?:\w+\s+){0,3}\w+(?:ar|er|ir)\b/i, marker:'para + infinitivo', conf:.91},{re:/\bpara que\b/i, marker:'para que', conf:.97},
      {re:/\ba fim de\b/i, marker:'a fim de', conf:.96},{re:/\bcom o objetivo de\b/i, marker:'com o objetivo de', conf:.96}
    ],
    explanation: [
      {re:/\bou seja\b/i, marker:'ou seja', conf:.98},{re:/\bisto é\b|\bisto e\b/i, marker:'isto é', conf:.98},{re:/\bem outras palavras\b/i, marker:'em outras palavras', conf:.97}
    ],
    example: [
      {re:/\bpor exemplo\b/i, marker:'por exemplo', conf:.99},{re:/\bcomo no caso de\b/i, marker:'como no caso de', conf:.95},{re:/\btais como\b/i, marker:'tais como', conf:.92}
    ],
    addition: [
      {re:/\balém disso\b|\balem disso\b/i, marker:'além disso', conf:.96},{re:/\btambém\b|\btambem\b/i, marker:'também', conf:.80},{re:/\bbem como\b/i, marker:'bem como', conf:.94}
    ],
    temporal: [
      {re:/\bdepois\b/i, marker:'depois', conf:.90},{re:/\bantes\b/i, marker:'antes', conf:.90},{re:/\bentão\b|\bentao\b/i, marker:'então', conf:.86},
      {re:/\bem seguida\b/i, marker:'em seguida', conf:.94},{re:/\bno dia seguinte\b|\bno outro dia\b/i, marker:'no dia seguinte', conf:.95},{re:/\bquando\b/i, marker:'quando', conf:.82}
    ],
    comparison: [
      {re:/\bassim como\b/i, marker:'assim como', conf:.94},{re:/\btal como\b/i, marker:'tal como', conf:.94},{re:/\bdo mesmo modo\b/i, marker:'do mesmo modo', conf:.95},
      {re:/\bmais .* que\b/i, marker:'mais...que', conf:.75},{re:/\bmenos .* que\b/i, marker:'menos...que', conf:.75}
    ]
  };

  const REGISTRY = [
    {lemma:'optar', prep:'por', re:/\bopt(?:ar|ou|ava|ando|ado)\s+por\b/i, role:'complemento regido'},
    {lemma:'depender', prep:'de', re:/\bdepend(?:er|e|ia|eu|endo)\s+de\b/i, role:'complemento regido'},
    {lemma:'consistir', prep:'em', re:/\bconsist(?:ir|e|ia|iu|indo)\s+em\b/i, role:'complemento regido'},
    {lemma:'pensar', prep:'em', re:/\bpens(?:ar|a|ou|ava|ando)\s+em\b/i, role:'complemento regido'},
    {lemma:'acreditar', prep:'em', re:/\bacredit(?:ar|a|ou|ava|ando)\s+em\b/i, role:'complemento regido'},
    {lemma:'pertencer', prep:'a', re:/\bpertenc(?:er|e|ia|eu|endo)\s+a\b/i, role:'complemento regido'},
    {lemma:'tratar', prep:'de', re:/\btrat(?:ar|a|ou|ava|ando)-?se\s+de\b/i, role:'complemento regido'},
    {lemma:'referir', prep:'a', re:/\brefer(?:ir|e|iu|ia|indo)-?se\s+a\b/i, role:'complemento regido'}
  ];

  const WORDS = {
    ver:{pos:'verb',defs:['perceber pelos sentidos','observar ou examinar','considerar intelectualmente'],syn:['observar','examinar','considerar']},
    pensar:{pos:'verb',defs:['formar ou relacionar ideias','considerar uma possibilidade'],syn:['considerar','ponderar','refletir']},
    saber:{pos:'verb',defs:['ter conhecimento de algo'],syn:['conhecer','ter ciência de']},
    valor:{pos:'noun',defs:['qualidade pela qual algo é considerado bom, digno ou desejável'],syn:['mérito','importância','qualidade']},
    relação:{pos:'noun',defs:['vínculo ou conexão entre entidades, fatos ou conceitos'],syn:['vínculo','nexo','conexão']},
    relacao:{pos:'noun',defs:['vínculo ou conexão entre entidades, fatos ou conceitos'],syn:['vínculo','nexo','conexão']},
    esforço:{pos:'noun',defs:['aplicação de energia ou ação para alcançar um fim'],syn:['empenho','aplicação','tentativa']},
    esforco:{pos:'noun',defs:['aplicação de energia ou ação para alcançar um fim'],syn:['empenho','aplicação','tentativa']},
    disposição:{pos:'noun',defs:['inclinação ou prontidão para agir'],syn:['prontidão','inclinação','ânimo']},
    disposicao:{pos:'noun',defs:['inclinação ou prontidão para agir'],syn:['prontidão','inclinação','ânimo']},
    causa:{pos:'noun',defs:['fator apresentado como fundamento de um efeito'],syn:['razão','fundamento','motivo']},
    resultado:{pos:'noun',defs:['efeito ou estado produzido ao fim de um processo'],syn:['efeito','desfecho','consequência']},
    verdade:{pos:'noun',defs:['qualidade atribuída ao que corresponde ao que se afirma ou ao que é'],syn:['veracidade','correspondência']},
    justiça:{pos:'noun',defs:['qualidade ou princípio relativo ao que é devido, reto ou equitativo'],syn:['retidão','equidade']},
    justica:{pos:'noun',defs:['qualidade ou princípio relativo ao que é devido, reto ou equitativo'],syn:['retidão','equidade']},
    amor:{pos:'noun',defs:['afeição ou vínculo valorativo cuja determinação concreta depende do contexto'],syn:['afeição','estima','vínculo']},
    conhecimento:{pos:'noun',defs:['estado ou conteúdo de conhecer'],syn:['saber','compreensão']},
    fé:{pos:'noun',defs:['confiança, crença ou adesão; o sentido concreto deve ser delimitado pelo contexto'],syn:['confiança','crença']},
    fe:{pos:'noun',defs:['confiança, crença ou adesão; o sentido concreto deve ser delimitado pelo contexto'],syn:['confiança','crença']},
    poder:{pos:'noun',defs:['capacidade, autoridade ou possibilidade de agir, conforme o contexto'],syn:['capacidade','autoridade','faculdade']},
    lei:{pos:'noun',defs:['regra, norma ou princípio vinculante conforme o contexto'],syn:['norma','regra']},
    homem:{pos:'noun',defs:['ser humano ou indivíduo masculino, conforme o contexto'],syn:['ser humano','indivíduo']},
    deus:{pos:'noun',defs:['termo cujo referente e predicados devem ser determinados pelo texto em análise'],syn:[]},
    igreja:{pos:'noun',defs:['assembleia, comunidade ou instituição religiosa conforme o contexto'],syn:['comunidade','assembleia']},
    rei:{pos:'noun',defs:['governante monárquico'],syn:['monarca','soberano']},
    povo:{pos:'noun',defs:['coletividade humana definida por vínculo social, político ou cultural'],syn:['população','comunidade']},
    bom:{pos:'adj',defs:['avaliado positivamente segundo algum critério'],syn:['favorável','positivo','desejável']},
    justo:{pos:'adj',defs:['avaliado como conforme à justiça ou ao que é devido'],syn:['reto','equitativo']},
    verdadeiro:{pos:'adj',defs:['avaliado como correspondente à verdade'],syn:['verídico','real']}
  };

  const CONCEPT_FAMILIES = {
    cognition:{label:'Cognição',words:set('pensar cogitar saber conhecer compreender crer suspeitar perceber lembrar imaginar considerar perguntar questionar dúvida duvida certeza conhecimento entendimento mente razão razao')},
    evaluation:{label:'Valor e avaliação',words:set('bom boa melhor pior ruim valor valioso justo injusto correto errado verdadeiro falso belo útil util importante mérito merito qualidade avaliar julgamento julgar critério criterio critérios criterios')},
    affect:{label:'Afeto e desejo',words:set('amor amar paixão paixao desejo desejar querer medo temer alegria tristeza esperança esperanca amizade odiar ódio odio')},
    agency:{label:'Ação e disposição',words:set('fazer agir ação acao realizar criar produzir decidir escolher optar tentar esforço esforco disposição disposicao buscar procurar obter alcançar alcancar manter impedir permitir')},
    relation:{label:'Relação',words:set('relação relacao vínculo vinculo união uniao amizade amigo povo família familia comunidade aliança alianca pertencer acompanhar unir separar')},
    causality:{label:'Causalidade',words:set('causa causar motivo razão razao porque efeito consequência consequencia resultado gerar produzir levar determinar impedir permitir fundamento')},
    temporality:{label:'Tempo e progressão',words:set('tempo hoje ontem amanhã amanha antes depois agora então entao logo início inicio fim começo comeco término termino permanecer continuar')},
    normativity:{label:'Norma e obrigação',words:set('dever deve lei regra norma mandamento obrigação obrigacao necessário necessario permitido proibido justo justiça justica correto')},
    identity:{label:'Identidade e atribuição',words:set('ser identidade nome chamar tornar parecer permanecer atributo qualidade natureza essência essencia')},
    speech:{label:'Fala e testemunho',words:set('dizer falar afirmar responder perguntar declarar ensinar testemunho palavra voz discurso explicar')},
    conflict:{label:'Conflito e oposição',words:set('contra conflito guerra combater oposição oposicao inimigo resistir dividir separar disputa atacar defender')},
    space:{label:'Espaço e movimento',words:set('lugar casa cidade terra região regiao entrar sair ir vir chegar partir subir descer caminho perto longe')}
  };

  const CONNECTORS = {
    cause:['porque','uma vez que','já que','visto que','porquanto','em razão disso','por esse motivo','na medida em que','considerando que','dado que','tendo em vista que','sendo essa a razão pela qual'],
    consequence:['por isso','por conseguinte','desse modo','dessa forma','assim','de modo que','o que leva a','o que produz','razão pela qual','em consequência','daí resulta que','com isso'],
    contrast:['mas','contudo','entretanto','todavia','não obstante','apesar disso','ainda assim','mesmo assim','por outro lado','em contrapartida','ao contrário','com tudo isso'],
    concession:['embora','ainda que','mesmo que','apesar de','não obstante','por mais que','conquanto','a despeito de'],
    condition:['se','caso','desde que','contanto que','na hipótese de','sempre que','a menos que','sob a condição de que'],
    purpose:['para','a fim de','com o propósito de','com o objetivo de','de modo a','visando a','para que','com vistas a'],
    addition:['além disso','também','do mesmo modo','ainda','bem como','somado a isso','ao mesmo tempo','igualmente','não apenas isso','por sua vez'],
    example:['por exemplo','como ocorre em','tal como','a exemplo de','isso se vê em','um caso disso é'],
    explanation:['ou seja','isto é','em outras palavras','mais precisamente','dito de outro modo','o que significa que','vale dizer'],
    temporal:['então','em seguida','depois disso','posteriormente','antes disso','a partir daí','na sequência','nesse momento','mais tarde','desde então'],
    resumption:['nesse ponto','aqui','quanto a isso','diante disso','por esse aspecto','nesse sentido','a esse respeito','considerado o conjunto'],
    emphasis:['de fato','sobretudo','especialmente','mais ainda','convém notar que','vale observar que','é justamente aqui que','em particular']
  };

  const META_TERMS = [
    /\bEquídeque\b/gi,/\bEquideque\b/gi,/\bAuteirética\b/gi,/\bAuteiretica\b/gi,/\bAposiníca\b/gi,/\bAposinica\b/gi,
    /\bProrrelação\b/gi,/\bProrrelacao\b/gi,/\bSchesis\b/gi,/\bHermeneia profundo\b/gi,/\bMME\b/g,
    /\bunidade discursiva\b/gi,/\bcamada\b/gi,/\bscore\b/gi,/\bconfiança\s+\d+%/gi,/\bepistêmic[oa]\b/gi,/\bΣ?Cs\b/g,/\bIs\s*\d+(?:[.,]\d+)?\b/g
  ];

  return { POS, IRREGULAR, DISCOURSE, REGISTRY, WORDS, CONCEPT_FAMILIES, CONNECTORS, META_TERMS };
})();
/*
 * HermeneiaCore
 * Camada 1: compreensão
 * Camada 2: planejamento de conteúdo
 * Nenhuma função deste módulo redige a prosa destinada ao leitor.
 */

/* ================================================================
 * CACHE LOCAL 4.4 — IndexedDB, com falha graciosa.
 * Mantém verbetes e recursos já recebidos do Apps Script. O cache
 * nunca interpreta: só evita voltar à heurística pobre quando o
 * backend está temporariamente indisponível.
 * ================================================================ */
