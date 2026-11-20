// Catálogo de 21 fórmulas de gancho (inspirado em youtube-agent-skill / claude-youtube)
// e avaliador determinístico de ganchos em pt-BR e en-US.

export const FORMULAS_GANCHO = [
  {
    id: 'estatistica',
    nome: 'A Estatística Surpreendente',
    formato: 'Um dado numérico inesperado seguido da consequência prática.',
    exemplo: 'Noventa e sete por cento do asfalto racha pelo que está embaixo, não por cima.',
    padroes: [/\b\d+([.,]\d+)?\s?%/i, /\b(por cento|em cada|vezes mais|milh[õo]es|mil)\b/i],
  },
  {
    id: 'resultado-real',
    nome: 'Resultado Real / Caso Concreto',
    formato: 'Mostra um resultado verificável e depois explica o mecanismo.',
    exemplo: 'Essa ponte suportou cem anos de tempestades usando só pedras encaixadas.',
    padroes: [/\b(essa|esse|este|esta)\s+\w+\s+(durou|aguentou|cresceu|faturou|saiu de)\b/i, /\bwent from\b/i],
  },
  {
    id: 'o-erro',
    nome: 'O Erro Comum',
    formato: 'Nomeia o erro que o espectador provavelmente comete agora.',
    exemplo: 'Você provavelmente está perdendo metade do calor da sua casa por essa fresta.',
    padroes: [/\b(voc[êe].{0,20}(errando|fazendo errado|perdendo)|o erro que|pare de)\b/i, /\byou('re| are) (probably )?(doing|making)\b/i],
  },
  {
    id: 'inversao-contraria',
    nome: 'Inversão Contrária',
    formato: 'Apresenta a crença popular e a rejeita imediatamente com fatos.',
    exemplo: 'Todo mundo acha que o cimento seca ao ar, mas na verdade ele precisa de água.',
    padroes: [/\b(todo mundo (acha|pensa|diz)|quase ninguém sabe|ao contrário do que|everyone (says|thinks))\b/i, /\bmas na verdade\b/i],
  },
  {
    id: 'a-revelacao',
    nome: 'A Revelação Visual',
    formato: 'Promete mostrar um mecanismo oculto por dentro logo nos primeiros segundos.',
    exemplo: 'Olha por dentro o que acontece no motor quando você gira a chave.',
    padroes: [/\b(olha por dentro|vou te mostrar|veja exatamente|aqui está o|on screen)\b/i],
  },
  {
    id: 'o-superlativo',
    nome: 'O Superlativo Comprovado',
    formato: 'O maior, menor, mais rápido ou mais resistente com critério claro.',
    exemplo: 'Esse é o material mais leve capaz de segurar um prédio inteiro.',
    padroes: [/\b(o mais|a mais|o único|a única|o maior|o menor|o pior|o melhor|the (best|worst|fastest|only))\b/i],
  },
  {
    id: 'o-relogio',
    nome: 'Limite de Tempo',
    formato: 'Promete a explicação completa em poucos segundos.',
    exemplo: 'Em trinta segundos você vai entender por que o avião não cai de lado.',
    padroes: [/\bem\s+(\d+|trinta|vinte|quarenta|sessenta)\s+(segundos|minutos)\b/i, /\bin (the next )?\d+ (seconds|minutes)\b/i],
  },
  {
    id: 'experimento',
    nome: 'Experimento / Simulação',
    formato: 'Coloca o espectador dentro de um teste prático com custo ou risco.',
    exemplo: 'Se você tirar uma única peça dessa torre, tudo desaba em dois segundos.',
    padroes: [/\bse você (tirar|colocar|testar|desligar|mudar)\b/i, /\bi (tried|tested|spent)\b/i],
  },
  {
    id: 'a-pergunta',
    nome: 'Pergunta com Tensão',
    formato: 'Faz a pergunta exata que desperta curiosidade imediata.',
    exemplo: 'Por que uma rua recém-asfaltada aguenta caminhões pesados sem afundar?',
    padroes: [/^\s*(por que|como|o que|qual|quando|why|how|what)\b/i, /\?\s*$/],
  },
  {
    id: 'antes-depois',
    nome: 'Antes e Depois',
    formato: 'Contrasta dois estados extremos em uma frase curta.',
    exemplo: 'De barro mole a uma pista de alta velocidade em quatro camadas.',
    padroes: [/\bde .{3,30} (para|a) .{3,30}\b/i, /\bantes e depois\b/i],
  },
  {
    id: 'o-mecanismo-oculto',
    nome: 'O Segredo Invisível',
    formato: 'Aponta que o resultado visível depende de uma peça escondida.',
    exemplo: 'O segredo de um arranha-céu não afundar está cinquenta metros abaixo da terra.',
    padroes: [/\b(o segredo|o que ninguém vê|escondido|por baixo|invisível)\b/i],
  },
  {
    id: 'escala-absurda',
    nome: 'Comparação de Escala',
    formato: 'Compara algo gigante ou microscópico com um objeto do dia a dia.',
    exemplo: 'Uma única pá dessa escavadeira levanta o peso de quatro carros populares.',
    padroes: [/\b(o peso de|do tamanho de|equivale a|mesmo tamanho)\b/i],
  },
  {
    id: 'causa-consequencia',
    nome: 'Causa e Desastre',
    formato: 'Mostra o pequeno detalhe que evita uma falha catastrófica.',
    exemplo: 'Sem esse pequeno espaço entre os trilhos, o trem descarrila no calor.',
    padroes: [/\bsem (esse|essa|isso)\b/i, /\bsó por causa de\b/i],
  },
  {
    id: 'voce-protagonista',
    nome: 'Você no Comando',
    formato: 'Dá uma missão prática imediata para o espectador resolver.',
    exemplo: 'Imagine que você precisa erguer uma parede sobre areia movediça.',
    padroes: [/\b(imagine que você|você precisa|você vai construir)\b/i],
  },
  {
    id: 'mito-derrubado',
    nome: 'Mito Popular',
    formato: 'Desmonta um conselho ou crença repetida sem pensar.',
    exemplo: 'Não é a grossura do vidro que impede o prédio de quebrar no vento.',
    padroes: [/\b(não é (só )?o|não é (só )?a|mito|falso)\b/i],
  },
  {
    id: 'lista-enxuta',
    nome: 'Três Passos / Peças',
    formato: 'Estrutura simples e contável fácil de acompanhar até o fim.',
    exemplo: 'Existem três forças puxando essa ponte neste exato segundo.',
    padroes: [/\b(três|3|quatro|4|cinco|5)\s+(passos|peças|camadas|forças|erros|segredos)\b/i],
  },
  {
    id: 'paradoxo',
    nome: 'Paradoxo Físico',
    formato: 'Algo que parece impossível à primeira vista e pede explicação.',
    exemplo: 'Como um navio de aço de cem mil toneladas boia enquanto uma pedra afunda?',
    padroes: [/\bcomo .{3,40} se .{3,30}\b/i, /\benquanto .{3,30} (afunda|quebra|cai|voa)\b/i],
  },
  {
    id: 'custo-oculto',
    nome: 'O Custo Escondido',
    formato: 'Mostra quanto tempo, dinheiro ou energia se perde sem perceber.',
    exemplo: 'Cada curva errada nesse cano rouba trinta por cento da pressão da água.',
    padroes: [/\b(custa|rouba|desperdiça|consome|perde)\b/i],
  },
  {
    id: 'comparacao-direta',
    nome: 'A vs B',
    formato: 'Coloca duas soluções lado a lado para gerar escolha e comentário.',
    exemplo: 'Por que estradas antigas usavam pedra enquanto as novas escolhem asfalto?',
    padroes: [/\bvs\b|\bou\b.{3,25}\?/i],
  },
  {
    id: 'detalhe-historico',
    nome: 'Origem Inesperada',
    formato: 'Conecta um objeto moderno a uma invenção antiga surpreendente.',
    exemplo: 'Esse truque de engenharia romana ainda segura túneis de metrô hoje.',
    padroes: [/\bhá \d+ (anos|séculos)|romana|antiga|inventado\b/i],
  },
  {
    id: 'alerta-urgente',
    nome: 'Sinal de Alerta',
    formato: 'Identifica um sintoma visual que indica problema antes da quebra.',
    exemplo: 'Se você notar essa rachadura em diagonal na parede, o chão já cedeu.',
    padroes: [/\b(nunca ignore|se você notar|sinal de|perigo|antes que)\b/i],
  },
];

const VAGOS = new Set([
  'incrível', 'incrivel', 'insano', 'louco', 'surreal', 'absurdo', 'épico', 'epico',
  'melhor', 'definitivo', 'secreto', 'segredo', 'coisas', 'algo', 'tudo', 'muito',
  'amazing', 'incredible', 'insane', 'crazy', 'huge', 'ultimate', 'perfect', 'stuff', 'things',
]);

const ENCHIMENTO = new Set([
  'então', 'entao', 'tipo', 'assim', 'bom', 'olha', 'veja', 'pessoal', 'galera',
  'basicamente', 'literalmente', 'really', 'actually', 'basically', 'guys',
]);

const SAUDACAO_FRACA = /\b(oi pessoal|olá pessoal|fala galera|sejam bem[- ]vindos|neste vídeo vamos|no vídeo de hoje|hey guys|welcome back|in this video)\b/i;

function clamp(v, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(v)));
}

function tokens(texto) {
  return (String(texto || '').toLowerCase().match(/[\p{L}0-9%.,'-]+/gu) || []);
}

export function classificarFormulaGancho(texto) {
  const s = String(texto || '').trim();
  let melhor = null;
  let acertos = 0;
  for (const f of FORMULAS_GANCHO) {
    const n = f.padroes.reduce((acc, re) => acc + (re.test(s) ? 1 : 0), 0);
    if (n > acertos) {
      acertos = n;
      melhor = f;
    }
  }
  return {
    id: melhor?.id || 'aberta',
    nome: melhor?.nome || 'Abertura livre (sem fórmula marcada)',
    acertos,
  };
}

export function avaliarGancho(texto) {
  const s = String(texto || '').trim();
  const palavras = tokens(s);
  const n = palavras.length;
  if (!n) {
    return {
      texto: s,
      palavras: 0,
      nota: 0,
      grau: 'D',
      formula: { id: 'vazio', nome: 'Vazio', acertos: 0 },
      subnotas: { especificidade: 0, direcionamento: 0, aposta: 0, curiosidade: 0, concisao: 0 },
      pontosFortes: [],
      problemas: ['Escreva uma frase inicial (6 a 22 palavras) para abrir o gancho.'],
    };
  }

  const numeros = (s.match(/(?<![\p{L}0-9])\d+([.,]\d+)?%?(?![\p{L}0-9])/gu) || []).length
    + (s.match(/(?<![\p{L}])(cem|mil|milh[ãa]o|milh[õo]es|bilh[ãa]o|bilh[õo]es|dez|vinte|trinta|quarenta|cinquenta|noventa)(?![\p{L}])/giu) || []).length;
  const vagos = palavras.filter((w) => VAGOS.has(w)).length;
  const enchimentos = palavras.filter((w) => ENCHIMENTO.has(w)).length;
  const proprios = s.split(/\s+/).slice(1).filter((w) => /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\p{L}]{2,}/u.test(w)).length;
  const especificidade = clamp(36 + numeros * 22 + Math.min(18, proprios * 7) - vagos * 14 - enchimentos * 8);

  const reVoce = /(?<![\p{L}])(voc[êe]|sua|seu|suas|seus|te|you|your)(?![\p{L}])/giu;
  const mencoesVoce = (s.match(reVoce) || []).length;
  const nosPrimeiros6 = /(?<![\p{L}])(voc[êe]|sua|seu|suas|seus|te|you|your)(?![\p{L}])/iu.test(
    s.split(/\s+/).slice(0, 6).join(' '),
  );
  const direcionamento = clamp(24 + mencoesVoce * 22 + (nosPrimeiros6 ? 32 : 0));

  const reAposta = /(?<![\p{L}])(erro|errando|perde|perdendo|afunda|quebra|racha|desaba|custa|risco|perigo|nunca|sempre|segredo|problema|morre|falha|aguenta|mistake|wrong|lose|fail|danger|cost)(?![\p{L}])/giu;
  const mencoesAposta = (s.match(reAposta) || []).length;
  const aposta = clamp(24 + mencoesAposta * 26 + (numeros ? 12 : 0));

  const reCuriosidade = /(?<![\p{L}])(por que|como|qual|segredo|na verdade|ningu[ée]m|escondido|por dentro|mas|s[óo] que|why|how|secret|actually|nobody)(?![\p{L}])/giu;
  const mencoesCuriosidade = (s.match(reCuriosidade) || []).length;
  const pergunta = /\?\s*$/.test(s) ? 20 : 0;
  const fechadaAntesDaHora = /(?<![\p{L}])(porque|pois isso acontece|ou seja|which means)(?![\p{L}])/iu.test(s) ? -22 : 0;
  const curiosidade = clamp(26 + mencoesCuriosidade * 18 + pergunta + fechadaAntesDaHora);

  // Ideal para Shorts/abertura rápida falada: 7 a 20 palavras (~2,5 a 7,5 segundos).
  let concisao;
  if (n >= 7 && n <= 20) concisao = 100;
  else if (n < 7) concisao = clamp(100 - (7 - n) * 14);
  else concisao = clamp(100 - (n - 20) * 6);

  const saudacao = SAUDACAO_FRACA.test(s);
  const penalidadeSaudacao = saudacao ? 28 : 0;

  const nota = clamp(
    especificidade * 0.22
    + direcionamento * 0.20
    + aposta * 0.20
    + curiosidade * 0.23
    + concisao * 0.15
    - penalidadeSaudacao,
  );

  const grau = nota >= 85 ? 'S' : nota >= 72 ? 'A' : nota >= 56 ? 'B' : nota >= 40 ? 'C' : 'D';
  const formula = classificarFormulaGancho(s);

  const pontosFortes = [];
  const problemas = [];

  if (saudacao) problemas.push('Remova saudações genéricas ("oi pessoal", "neste vídeo"): comece direto na tensão.');
  if (nosPrimeiros6) pontosFortes.push('Fala diretamente com "você" já nos primeiros instantes.');
  else problemas.push('Fale com "você" nas primeiras 6 palavras para gerar conexão imediata.');

  if (numeros > 0) pontosFortes.push('Traz dado concreto/numérico (aumenta credibilidade e atenção).');
  else if (especificidade < 55) problemas.push('Adicione um número, dimensão ou fato específico em vez de adjetivo vago.');

  if (pergunta || curiosidade >= 65) pontosFortes.push('Mantém uma lacuna de curiosidade aberta para segurar a retenção.');
  else problemas.push('Abra uma pergunta ou contraste ("mas na verdade...") sem entregar a resposta já na 1ª frase.');

  if (n > 20) problemas.push(`Gancho longo (${n} palavras): corte para 7–18 palavras (~3–6 s).`);
  else if (n < 7) problemas.push(`Gancho curto demais (${n} palavras): dê mais contexto visual/aposta.`);
  else pontosFortes.push(`Tamanho ideal (${n} palavras) para prender nos primeiros 3–6 s.`);

  if (fechadaAntesDaHora < 0) problemas.push('Evite explicar o "porque" logo no gancho — guarde a explicação para a cena seguinte.');

  return {
    texto: s,
    palavras: n,
    nota,
    grau,
    formula,
    subnotas: { especificidade, direcionamento, aposta, curiosidade, concisao },
    pontosFortes,
    problemas,
  };
}
