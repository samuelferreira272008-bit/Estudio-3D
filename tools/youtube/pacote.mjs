// Linter de pareamento Título + Capa (Thumbnail) e validador de metadados YouTube.
// Inspirado em yt-package/title.py (Jakeschincariol) e youtube-metadata-validator.js (darkzOGx).

export const LIMITES_YOUTUBE = {
  TITULO_MOBILE: 40,
  TITULO_DESKTOP: 60,
  TITULO_MAX: 100,
  DESCRICAO_MAX: 5000,
  TAGS_BYTES_MAX: 450,
  TAGS_QTD_MAX: 30,
};

const PALAVRAS_VAGAS = new Set([
  'incrível', 'incrivel', 'insano', 'surreal', 'absurdo', 'épico', 'epico', 'definitivo',
  'melhor', 'tudo', 'segredo', 'chocante', 'inacreditável', 'inacreditavel',
  'amazing', 'incredible', 'insane', 'crazy', 'huge', 'ultimate', 'everything', 'mindblowing',
]);

const STOPWORDS = new Set([
  'o', 'a', 'os', 'as', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas',
  'por', 'para', 'com', 'sem', 'que', 'como', 'porque', 'porquê', 'e', 'ou', 'se', 'ao', 'aos', 'à',
  'às', 'você', 'voce', 'isso', 'este', 'esta', 'esse', 'essa', 'the', 'an', 'of', 'for', 'to', 'in',
  'on', 'and', 'or', 'is', 'are', 'with', 'your', 'you', 'this', 'that', 'it', 'how', 'what', 'why',
]);

function removeCaracteresControle(val, sub = '') {
  return Array.from(String(val ?? '')).map((ch) => {
    const code = ch.charCodeAt(0);
    return code <= 31 || code === 127 ? sub : ch;
  }).join('');
}

function limparLinha(val) {
  return removeCaracteresControle(val, ' ').replace(/\s+/g, ' ').trim();
}

function palavrasDe(texto) {
  return (String(texto || '').toLowerCase().match(/[\p{L}0-9']+/gu) || []);
}

export function normalizarTags(input) {
  const lista = Array.isArray(input) ? input : String(input || '').split(',');
  const unicas = [];
  const vistas = new Set();
  let tamanhoTotal = 0;

  for (const item of lista) {
    const tag = limparLinha(item).replace(/^#+/, '').replaceAll('"', '').slice(0, 100).trim();
    const chave = tag.toLowerCase();
    if (!tag || vistas.has(chave)) continue;
    const proximo = tamanhoTotal + tag.length + (unicas.length ? 1 : 0);
    if (proximo > LIMITES_YOUTUBE.TAGS_BYTES_MAX || unicas.length >= LIMITES_YOUTUBE.TAGS_QTD_MAX) break;
    unicas.push(tag);
    vistas.add(chave);
    tamanhoTotal = proximo;
  }
  return unicas;
}

export function normalizarMetadadosYoutube(meta = {}) {
  const s = meta.snippet || meta.seo || meta;
  return {
    titulo: limparLinha(s.titulo ?? s.title ?? '').slice(0, LIMITES_YOUTUBE.TITULO_MAX),
    textoCapa: limparLinha(s.textoCapa ?? s.thumb ?? s.capaTexto ?? '').slice(0, 80),
    descricao: removeCaracteresControle(s.descricao ?? s.description ?? '', '\n').trim().slice(0, LIMITES_YOUTUBE.DESCRICAO_MAX),
    tags: normalizarTags(s.tags),
    hashtags: normalizarTags(s.hashtags).slice(0, 5).map((h) => `#${h.replace(/\s+/g, '')}`),
    categoriaId: String(s.categoriaId ?? s.categoryId ?? '27').trim(), // 27 = Education / Explicativo
    idioma: String(s.idioma ?? s.defaultLanguage ?? 'pt-BR').trim(),
  };
}

export function avaliarTituloCapa({ titulo = '', textoCapa = '', descricao = '', tags = [] } = {}) {
  const t = limparLinha(titulo);
  const c = limparLinha(textoCapa);
  const issues = [];
  const bons = [];

  if (!t) {
    return {
      titulo: '',
      textoCapa: c,
      caracteres: 0,
      nota: 0,
      issues: [{ tipo: 'vazio', severidade: 'erro', mensagem: 'Falta o título do vídeo.' }],
      bons: [],
    };
  }

  const len = t.length;
  if (len > LIMITES_YOUTUBE.TITULO_MAX) {
    issues.push({ tipo: 'tamanho-max', severidade: 'erro', mensagem: `${len} caracteres — passa do limite máximo do YouTube (${LIMITES_YOUTUBE.TITULO_MAX}).` });
  } else if (len > LIMITES_YOUTUBE.TITULO_DESKTOP) {
    issues.push({ tipo: 'corte-desktop', severidade: 'aviso', mensagem: `${len} caracteres — busca no computador costuma cortar perto de ${LIMITES_YOUTUBE.TITULO_DESKTOP}.` });
  } else {
    bons.push(`${len} caracteres: cabe inteiro no resultado do computador (≤ ${LIMITES_YOUTUBE.TITULO_DESKTOP}).`);
  }

  if (len > LIMITES_YOUTUBE.TITULO_MOBILE) {
    const corte = t.slice(0, LIMITES_YOUTUBE.TITULO_MOBILE).replace(/\s+\S*$/, '');
    issues.push({ tipo: 'corte-mobile', severidade: 'aviso', mensagem: `No feed do celular aparece só "${corte}..." — garanta que o assunto principal esteja no começo.` });
  } else {
    bons.push(`Cabe inteiro até no feed do celular (≤ ${LIMITES_YOUTUBE.TITULO_MOBILE} caracteres).`);
  }

  const caps = t.split(/\s+/).filter((w) => w.length > 2 && w === w.toUpperCase() && /[\p{L}]/u.test(w));
  if (caps.length > 2) {
    issues.push({ tipo: 'caixa-alta', severidade: 'aviso', mensagem: `${caps.length} palavras em MAIÚSCULAS — no máximo 2 para não parecer spam.` });
  } else if (caps.length >= 1) {
    bons.push(`Usa ${caps.length} palavra(s) em destaque sem exagero.`);
  }

  const pw = palavrasDe(t);
  const vagas = [...new Set(pw.filter((w) => PALAVRAS_VAGAS.has(w)))];
  if (vagas.length) {
    issues.push({ tipo: 'vago', severidade: 'aviso', mensagem: `Termo(s) vago(s): "${vagas.join(', ')}" — troque por número, peça ou resultado concreto.` });
  }

  const nums = t.match(/\d+([.,]\d+)?%?/g) || [];
  if (nums.length) bons.push(`Tem dado concreto (${nums.slice(0, 3).join(', ')}).`);
  else issues.push({ tipo: 'sem-numero', severidade: 'dica', mensagem: 'Considere incluir um número, medida ou contraste concreto se couber.' });

  if (/\?$/.test(t)) bons.push('Termina com pergunta aberta que convida ao clique.');

  const frente = pw.slice(0, 3).filter((w) => !STOPWORDS.has(w));
  if (!frente.length) {
    issues.push({ tipo: 'frente-fraca', severidade: 'aviso', mensagem: 'As 3 primeiras palavras são só conectores — puxe o assunto para a frente.' });
  }

  if (c) {
    const tw = new Set(pw.filter((w) => !STOPWORDS.has(w)));
    const cw = new Set(palavrasDe(c).filter((w) => !STOPWORDS.has(w)));
    const repetidas = [...tw].filter((w) => cw.has(w));
    if (repetidas.length) {
      issues.push({
        tipo: 'duplicacao-capa',
        severidade: 'aviso',
        mensagem: `A capa repete palavra(s) do título (${repetidas.join(', ')}): use a capa para complementar, não repetir.`,
      });
    } else {
      bons.push('Título e texto da capa se complementam sem repetir palavras-chave.');
    }

    const qCapa = palavrasDe(c).length;
    if (qCapa > 5) {
      issues.push({ tipo: 'capa-longa', severidade: 'aviso', mensagem: `${qCapa} palavras na capa — mire em 2 a 5 palavras grandes para leitura rápida no celular.` });
    } else {
      bons.push(`Texto de capa enxuto (${qCapa} palavra(s)).`);
    }
  }

  const norm = normalizarMetadadosYoutube({ titulo: t, textoCapa: c, descricao, tags });
  if (descricao !== undefined) {
    if (!norm.descricao) {
      issues.push({ tipo: 'descricao-vazia', severidade: 'aviso', mensagem: 'Descrição vazia — escreva a promessa já nas 2 primeiras linhas (visíveis antes do "Mostrar mais").' });
    } else if (norm.descricao.length >= 60) {
      bons.push(`Descrição preenchida (${norm.descricao.length} caracteres).`);
    }
  }
  if (Array.isArray(tags) ? tags.length > 0 : Boolean(tags)) {
    if (norm.tags.length < 3) {
      issues.push({ tipo: 'poucas-tags', severidade: 'dica', mensagem: 'Adicione ao menos 3–8 tags específicas para ajudar na indexação.' });
    } else {
      bons.push(`${norm.tags.length} tag(s) válidas.`);
    }
  }

  let penal = 0;
  for (const iss of issues) {
    penal += iss.severidade === 'erro' ? 25 : iss.severidade === 'aviso' ? 12 : 5;
  }
  const nota = Math.max(0, Math.min(100, 92 - penal + Math.min(12, bons.length * 3)));

  return {
    titulo: t,
    textoCapa: c,
    caracteres: len,
    nota,
    issues,
    bons,
    normalizado: norm,
  };
}

export function gerarPostagemMarkdown({
  projetoTitulo = '',
  titulo = '',
  opcoesTitulo = [],
  textoCapa = '',
  descricao = '',
  hashtags = [],
  tags = [],
  comentarioFixado = '',
  fontes = [],
} = {}) {
  const norm = normalizarMetadadosYoutube({ titulo, textoCapa, descricao, tags, hashtags });
  const listaTitulos = [norm.titulo, ...opcoesTitulo.map((o) => limparLinha(o)).filter(Boolean)]
    .filter((v, i, arr) => v && arr.indexOf(v) === i)
    .slice(0, 3);
  const blocoTitulos = listaTitulos.length
    ? listaTitulos.map((t, i) => `${i + 1}. ${t}`).join('\n')
    : '1. (preencha um título de até 60 caracteres)';

  const hashOut = norm.hashtags.length ? norm.hashtags.join(' ') : '#shorts #curiosidades #explicacao';
  const tagsOut = norm.tags.length ? norm.tags.join(', ') : '(adicione 5 a 12 termos de busca separados por vírgula)';
  const fontesOut = Array.isArray(fontes) && fontes.length
    ? fontes.map((f) => `- ${f}`).join('\n')
    : '- (registre aqui as referências conferidas em ideia.md)';

  return [
    `# Postagem — ${limparLinha(projetoTitulo || norm.titulo || 'Vídeo 3D')}`,
    '',
    '## Título (até ~60 caracteres; principal no topo para celular)',
    blocoTitulos,
    '',
    '## Texto sugerido para capa',
    norm.textoCapa || '(2 a 5 palavras complementares ao título — sem repetir palavras-chave)',
    '',
    '## Descrição',
    norm.descricao || '(1ª linha: promessa/pergunta do vídeo. 2ª linha: resumo em uma frase. Fontes e vídeo relacionado.)',
    '',
    '## Hashtags',
    hashOut,
    '',
    '## Tags (YouTube Studio)',
    tagsOut,
    '',
    '## Comentário fixado',
    limparLinha(comentarioFixado) || '(a mesma pergunta do final do vídeo para gerar respostas)',
    '',
    '## Fontes',
    fontesOut,
    '',
  ].join('\n');
}

