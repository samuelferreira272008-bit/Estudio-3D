// Auditor completo de retenção, ritmo e pacote de publicação no YouTube para projetos do Estúdio 3D.
// Combina regras de Shorts/Long-form (claude-youtube, youtube-agent-skill, youtube-automation-agent).

import fs from 'node:fs';
import path from 'node:path';
import { avaliarGancho } from './ganchos.mjs';
import { avaliarTituloCapa } from './pacote.mjs';

function clamp(v, a = 0, b = 100) {
  return Math.max(a, Math.min(b, Math.round(v)));
}

export function extrairPrimeiraFrase(narracao = '') {
  const limpo = String(narracao || '').replace(/\s+/g, ' ').trim();
  if (!limpo) return '';
  const m = limpo.match(/^(.+?[.!?])(\s|$)/);
  return (m ? m[1] : limpo.split(/\s+/).slice(0, 18).join(' ')).trim();
}

export function extrairUltimaFrase(narracao = '') {
  const limpo = String(narracao || '').replace(/\s+/g, ' ').trim();
  if (!limpo) return '';
  const partes = limpo.split(/(?<=[.!?])\s+/).filter(Boolean);
  return (partes[partes.length - 1] || limpo).trim();
}

export function analisarPostagemMd(conteudo = '') {
  const txt = String(conteudo || '');
  if (!txt.trim()) return { existe: false, titulo: '', descricao: '', hashtags: [], comentarioFixado: '' };

  const secao = (nome) => {
    const re = new RegExp(`^##\\s+${nome}[^\\n]*\\n([\\s\\S]*?)(?=^##\\s+|$(?![\\r\\n]))`, 'mi');
    const m = txt.match(re);
    return m ? m[1].trim() : '';
  };

  const blocoTitulo = secao('Título');
  const primeiraLinhaTitulo = blocoTitulo
    .split('\n')
    .map((l) => l.replace(/^[-*\d.)\s]+/, '').trim())
    .find((l) => l && !l.startsWith('{')) || '';

  const descricao = secao('Descrição');
  const textoCapa = secao('Texto sugerido para capa')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('(')) || '';
  const blocoHash = secao('Hashtags');
  const hashtags = (blocoHash.match(/#[\p{L}0-9_]+/gu) || []).map((h) => h.slice(1));
  const blocoTags = secao('Tags');
  const tags = blocoTags && !blocoTags.startsWith('(')
    ? blocoTags.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean)
    : [];
  const comentarioFixado = secao('Comentário fixado');

  return {
    existe: true,
    titulo: primeiraLinhaTitulo,
    textoCapa,
    descricao,
    hashtags,
    tags,
    comentarioFixado,
  };
}

export function avaliarAuditoriaYoutube({
  storyboard,
  narracao = '',
  palavras = [],
  postagemTexto = '',
  tituloOverride = '',
  capaOverride = '',
  descricaoOverride = '',
  tagsOverride = [],
} = {}) {
  const sb = storyboard || {};
  const cenas = Array.isArray(sb.cenas) ? sb.cenas : [];
  const fmt = sb.formato || { largura: 1080, altura: 1920, fps: 30 };
  const isShort = (fmt.altura || 1920) >= (fmt.largura || 1080) && (Number(sb.duracao) || 0) <= 185;
  const duracao = Number(sb.duracao) || (cenas.length ? cenas[cenas.length - 1].fim : 0);

  // 1) Gancho (primeiros 3 segundos)
  const primeiraFrase = extrairPrimeiraFrase(narracao);
  const hookEval = avaliarGancho(primeiraFrase);
  const primeiraCena = cenas[0] || {};
  const textoAbertura = (primeiraCena.textos || []).find((t) => (t.de ?? primeiraCena.inicio ?? 0) <= 2.5)?.texto || '';
  const inicioFala = palavras.length ? Number(palavras[0].inicio) || 0 : 0;

  let ganchoScore = hookEval.nota;
  const ganchoDicas = [...hookEval.problemas];
  if (!textoAbertura) {
    ganchoScore -= 18;
    ganchoDicas.push('Coloque um texto curto de gancho na tela nos primeiros 2 s (estilo "titulo").');
  }
  if (palavras.length && inicioFala > 0.9) {
    ganchoScore -= 12;
    ganchoDicas.push(`A narração começa só em ${inicioFala.toFixed(1)}s; em Shorts o áudio deve abrir nos primeiros 0,5 s.`);
  }
  ganchoScore = clamp(ganchoScore);

  // 2) Ritmo e Quebras Visuais (Pattern Interrupts)
  const duracoes = cenas.map((c) => Math.max(0, (Number(c.fim) || 0) - (Number(c.inicio) || 0)));
  const mediaCena = duracoes.length ? duracoes.reduce((a, b) => a + b, 0) / duracoes.length : 0;
  const cenasLentas = duracoes.filter((d) => d > (isShort ? 5.2 : 7.0)).length;
  let cortesRepetidos = 0;
  for (let i = 1; i < cenas.length; i++) {
    const a = cenas[i - 1].camera || {};
    const b = cenas[i].camera || {};
    if (JSON.stringify([a.tipo, a.alvo, a.plano, a.angulo]) === JSON.stringify([b.tipo, b.alvo, b.plano, b.angulo])) {
      cortesRepetidos++;
    }
  }
  const cenasComMovOuFluxo = cenas.filter((c) => {
    const hasFlux = (c.fluxos || []).length > 0 || (c.rastros || []).length > 0;
    const hasMov = (c.objetos || []).some((o) => (o.movimentos || []).length || o.anim || o.etapa || o.aparece !== undefined);
    const hasChar = (c.personagens || []).some((p) => (p.movimentos || []).length || (p.acoes || []).some((a) => a.clip !== 'talk' && a.clip !== 'idle'));
    return hasFlux || hasMov || hasChar;
  }).length;
  const pctAnimadas = cenas.length ? cenasComMovOuFluxo / cenas.length : 0;

  let ritmoScore = 88;
  const ritmoDicas = [];
  if (!cenas.length) {
    ritmoScore = 0;
    ritmoDicas.push('Storyboard sem cenas.');
  } else {
    if (isShort && mediaCena > 4.6) {
      ritmoScore -= 15;
      ritmoDicas.push(`Média de ${mediaCena.toFixed(1)}s por cena — para Shorts, mire em 2,5–4,2 s por cena.`);
    }
    if (cenasLentas > 0) {
      ritmoScore -= Math.min(24, cenasLentas * 8);
      ritmoDicas.push(`${cenasLentas} cena(s) ultrapassam ${isShort ? '5,2' : '7,0'}s sem troca visual — divida ou adicione corte de câmera.`);
    }
    if (cortesRepetidos > 0) {
      ritmoScore -= Math.min(20, cortesRepetidos * 10);
      ritmoDicas.push(`${cortesRepetidos} corte(s) seguido(s) com o mesmo plano/ângulo — alterne geral, médio e close.`);
    }
    if (pctAnimadas < 0.8) {
      ritmoScore -= Math.round((0.8 - pctAnimadas) * 40);
      ritmoDicas.push('Nem todas as cenas mostram processo/movimento visual ativo (adicione fluxos, anim ou ações).');
    }
  }
  ritmoScore = clamp(ritmoScore);

  // 3) Fala, Cadência e Silêncios (Dead Air)
  let falaScore = 85;
  const falaDicas = [];
  const totalPalavras = palavras.length || (narracao ? narracao.trim().split(/\s+/).length : 0);
  const wpm = duracao > 0 && totalPalavras > 0 ? Math.round((totalPalavras / duracao) * 60) : 0;
  let pausasLongas = 0;
  for (let i = 1; i < palavras.length; i++) {
    const gap = (Number(palavras[i].inicio) || 0) - (Number(palavras[i - 1].fim) || 0);
    if (gap > 0.75) pausasLongas++;
  }
  if (!totalPalavras) {
    falaScore = 30;
    falaDicas.push('Sem narração/palavras sincronizadas.');
  } else {
    if (wpm > 0 && wpm < 125) {
      falaScore -= 18;
      falaDicas.push(`Ritmo lento (${wpm} palavras/min). Em vídeos curtos, 145–175 ppm retém muito melhor.`);
    } else if (wpm > 195) {
      falaScore -= 10;
      falaDicas.push(`Ritmo muito acelerado (${wpm} palavras/min): pode dificultar leitura da legenda.`);
    }
    if (pausasLongas > 0) {
      falaScore -= Math.min(24, pausasLongas * 8);
      falaDicas.push(`${pausasLongas} silêncio(s) > 0,75 s detectado(s) — evite "ar morto" em Shorts.`);
    }
    const temPerguntaMeio = /\?/.test(narracao.slice(primeiraFrase.length, Math.max(primeiraFrase.length, narracao.length - 80)));
    if (duracao >= 25 && !temPerguntaMeio) {
      falaScore -= 8;
      falaDicas.push('Adicione uma micro-pergunta ou quebra de curiosidade no meio da narração.');
    }
  }
  falaScore = clamp(falaScore);

  // 4) Pacote Clique & SEO (Título + Texto da Capa + Descrição + Tags/Hashtags)
  const post = analisarPostagemMd(postagemTexto);
  const tituloFinal = tituloOverride || post.titulo || sb.titulo || '';
  const capaFinal = capaOverride || post.textoCapa || textoAbertura;
  const descFinal = descricaoOverride || post.descricao || '';
  const tagsFinal = tagsOverride.length ? tagsOverride : (post.tags?.length ? post.tags : post.hashtags);

  const pkgEval = avaliarTituloCapa({
    titulo: tituloFinal,
    textoCapa: capaFinal,
    descricao: descFinal,
    tags: tagsFinal,
  });
  const pacoteScore = clamp(pkgEval.nota - (post.existe || tituloOverride ? 0 : 12));
  const pacoteDicas = pkgEval.issues.map((i) => i.mensagem);
  if (!post.existe && !tituloOverride) {
    pacoteDicas.push('Crie postagem.md (título, descrição, hashtags e comentário fixado) com node tools/youtube.mjs preparar.');
  }

  // 5) Fechamento, Comentário e Loop
  const ultimaCena = cenas[cenas.length - 1] || {};
  const ultimaFrase = extrairUltimaFrase(narracao);
  const trechoFinal = String(narracao || '').trim().slice(-180);
  const painelFinal = (ultimaCena.textos || []).find((t) => t.estilo === 'pergunta' || /\?/.test(t.texto || ''))?.texto || '';
  let fechamentoScore = 40;
  const fechamentoDicas = [];
  if (painelFinal) fechamentoScore += 25;
  else fechamentoDicas.push('Adicione painel "pergunta" com "?" na última cena.');
  if (/\?/.test(trechoFinal)) fechamentoScore += 20;
  else fechamentoDicas.push('Termine a narração com uma pergunta específica e fácil de responder.');
  if (post.comentarioFixado) fechamentoScore += 15;
  else fechamentoDicas.push('Preencha o Comentário Fixado no postagem.md espelhando a pergunta final.');
  fechamentoScore = clamp(fechamentoScore);

  const notaGeral = clamp(
    ganchoScore * 0.28
    + ritmoScore * 0.25
    + falaScore * 0.17
    + pacoteScore * 0.18
    + fechamentoScore * 0.12,
  );

  return {
    notaGeral,
    formato: isShort ? 'YouTube Shorts (9:16)' : 'YouTube Padrão',
    duracao,
    cenas: cenas.length,
    wpm,
    pilares: {
      gancho: { nota: ganchoScore, formula: hookEval.formula, dicas: ganchoDicas, textoAnalisado: primeiraFrase },
      ritmo: { nota: ritmoScore, mediaCena: Number(mediaCena.toFixed(2)), cenasLentas, cortesRepetidos, dicas: ritmoDicas },
      fala: { nota: falaScore, wpm, pausasLongas, dicas: falaDicas },
      pacote: { nota: pacoteScore, titulo: tituloFinal, textoCapa: capaFinal, dicas: pacoteDicas, detalhes: pkgEval },
      fechamento: { nota: fechamentoScore, painelFinal, ultimaFrase, dicas: fechamentoDicas },
    },
    proximasAcoes: [...ganchoDicas, ...ritmoDicas, ...falaDicas, ...pacoteDicas, ...fechamentoDicas].slice(0, 8),
  };
}

export function auditarProjetoYoutube(root, projetoRel, overrides = {}) {
  const pasta = path.resolve(root, String(projetoRel || '').replace(/^\/+/, ''));
  const sbArq = path.join(pasta, 'storyboard.json');
  if (!fs.existsSync(sbArq)) throw new Error(`Projeto sem storyboard.json: ${projetoRel}`);
  const storyboard = JSON.parse(fs.readFileSync(sbArq, 'utf8'));

  const narArq = path.join(pasta, 'narracao.txt');
  const narracao = fs.existsSync(narArq) ? fs.readFileSync(narArq, 'utf8') : '';

  const palArq = path.join(pasta, storyboard.palavras || 'palavras.json');
  let palavras = [];
  if (fs.existsSync(palArq)) {
    try { palavras = JSON.parse(fs.readFileSync(palArq, 'utf8')); } catch { palavras = []; }
  }

  const postArq = path.join(pasta, 'postagem.md');
  const postagemTexto = fs.existsSync(postArq) ? fs.readFileSync(postArq, 'utf8') : '';

  return avaliarAuditoriaYoutube({
    storyboard,
    narracao,
    palavras,
    postagemTexto,
    ...overrides,
  });
}
