import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FORMULAS_GANCHO, classificarFormulaGancho, avaliarGancho } from './ganchos.mjs';
import {
  normalizarTags, normalizarMetadadosYoutube, avaliarTituloCapa, gerarPostagemMarkdown,
} from './pacote.mjs';
import {
  extrairPrimeiraFrase, extrairUltimaFrase, analisarPostagemMd, avaliarAuditoriaYoutube, auditarProjetoYoutube,
} from './retencao.mjs';
import {
  calcularOutlierRatio, parseContadorYoutube, extrairVideosYtInitialData, analisarPadroesTitulos,
} from './pesquisa.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('FORMULAS_GANCHO lista todas as 21 fórmulas com exemplo e formato', () => {
  assert.equal(FORMULAS_GANCHO.length, 21);
  for (const f of FORMULAS_GANCHO) {
    assert.ok(f.id && f.nome && f.formato && f.exemplo);
    assert.ok(Array.isArray(f.padroes) && f.padroes.length >= 1);
  }
});

test('avaliarGancho premia gancho forte com número e "você", e penaliza saudação vaga', () => {
  const forte = avaliarGancho('Por que você perde 30% de energia sem perceber esse erro?');
  assert.ok(forte.nota >= 72, `Nota inesperada para gancho forte: ${forte.nota}`);
  assert.ok(forte.subnotas.especificidade >= 50);
  assert.ok(forte.subnotas.direcionamento >= 70);

  const fraco = avaliarGancho('Oi pessoal tudo bem neste vídeo incrível vamos falar de coisas muito legais.');
  assert.ok(fraco.nota < 55, `Nota alta demais para saudação fraca: ${fraco.nota}`);
  assert.ok(fraco.problemas.some((p) => /saudaç/i.test(p)));
});

test('classificarFormulaGancho identifica estatistica e inversao-contraria', () => {
  assert.equal(classificarFormulaGancho('97% do asfalto falha pela base oculta').id, 'estatistica');
  assert.equal(classificarFormulaGancho('Todo mundo acha que cimento seca ao ar, mas na verdade precisa de água').id, 'inversao-contraria');
});

test('normalizarTags deduplica, remove hashtags e respeita limite de 450 bytes e 30 tags', () => {
  const tags = normalizarTags(['#asfalto', 'asfalto', 'engenharia civil', ' "rua" ', ...Array.from({ length: 40 }, (_, i) => `termo_longo_${i}_explicacao`)]);
  assert.equal(tags[0], 'asfalto');
  assert.ok(tags.length <= 30);
  assert.ok(tags.join(',').length <= 450);
});

test('avaliarTituloCapa detecta duplicação Título+Capa e corte mobile', () => {
  const repete = avaliarTituloCapa({
    titulo: 'Por que o asfalto aguenta caminhões pesados na sua rua todos os dias?',
    textoCapa: 'Asfalto aguenta caminhões',
  });
  assert.ok(repete.issues.some((i) => i.tipo === 'duplicacao-capa'));
  assert.ok(repete.issues.some((i) => i.tipo === 'corte-mobile'));
  assert.ok(repete.issues.some((i) => i.tipo === 'corte-desktop'));

  const limpo = avaliarTituloCapa({
    titulo: 'Por que o asfalto aguenta 40 toneladas?',
    textoCapa: 'O segredo embaixo',
    descricao: 'Descubra as quatro camadas escondidas debaixo da rua em uma animação 3D passo a passo.',
    tags: ['asfalto', 'engenharia', 'rua', 'como funciona'],
  });
  assert.ok(!limpo.issues.some((i) => i.tipo === 'duplicacao-capa'));
  assert.ok(limpo.nota >= 80, `Nota baixa para pacote bem montado: ${limpo.nota}`);
});

test('gerarPostagemMarkdown faz round-trip completo com analisarPostagemMd', () => {
  const md = gerarPostagemMarkdown({
    projetoTitulo: 'Como funciona o asfalto',
    titulo: 'Por que a rua aguenta 40 toneladas?',
    textoCapa: 'Quatro camadas ocultas',
    descricao: 'Entenda como subleito, sub-base e ligante seguram caminhões pesados.',
    hashtags: ['#shorts', '#engenharia', '#asfalto'],
    tags: ['asfalto', 'engenharia civil', 'pavimento'],
    comentarioFixado: 'Você já sabia das quatro camadas ou achava que era só asfalto?',
  });
  const parsed = analisarPostagemMd(md);
  assert.equal(parsed.existe, true);
  assert.equal(parsed.titulo, 'Por que a rua aguenta 40 toneladas?');
  assert.equal(parsed.textoCapa, 'Quatro camadas ocultas');
  assert.ok(parsed.hashtags.includes('engenharia'));
  assert.deepEqual(parsed.tags, ['asfalto', 'engenharia civil', 'pavimento']);
  assert.match(parsed.comentarioFixado, /quatro camadas/i);
});

test('avaliarAuditoriaYoutube calcula os 5 pilares e detecta projeto real exemplo-asfalto', () => {
  const aud = auditarProjetoYoutube(root, 'projects/exemplo-asfalto');
  assert.ok(aud.notaGeral >= 40 && aud.notaGeral <= 100);
  assert.equal(aud.formato, 'YouTube Shorts (9:16)');
  assert.ok(aud.cenas >= 10);
  assert.ok(aud.wpm > 80);

  const synthetic = avaliarAuditoriaYoutube({
    storyboard: {
      titulo: 'Como funciona o motor?',
      duracao: 10,
      formato: { largura: 1080, altura: 1920, fps: 30 },
      cenas: [
        {
          inicio: 0, fim: 3.5,
          camera: { tipo: 'enquadrar', alvo: 'motor', plano: 'geral', angulo: 20 },
          textos: [{ texto: 'O segredo oculto', estilo: 'titulo', de: 0, ate: 2 }],
          objetos: [{ id: 'motor', anim: 'girar' }],
        },
        {
          inicio: 3.5, fim: 7,
          camera: { tipo: 'enquadrar', alvo: 'motor', plano: 'close', angulo: 80 },
          objetos: [{ id: 'motor', movimentos: [{ de: 3.5, ate: 6, pos: [1, 0, 0] }] }],
        },
        {
          inicio: 7, fim: 10,
          camera: { tipo: 'enquadrar', alvo: 'motor', plano: 'medio', angulo: -40 },
          textos: [{ texto: 'Qual peça esquenta mais: A ou B?', estilo: 'pergunta', de: 7, ate: 10 }],
          objetos: [{ id: 'motor', etapa: { de: 7, ate: 9.5, inicio: 0, fim: 1 } }],
        },
      ],
    },
    narracao: 'Você sabia que 70% do calor do motor nunca vira movimento? Olhe o pistão agora. Qual peça esquenta mais?',
    palavras: [
      { palavra: 'Você', inicio: 0.1, fim: 0.3 },
      { palavra: 'sabia', inicio: 0.35, fim: 0.6 },
      { palavra: 'mais?', inicio: 9.2, fim: 9.6 },
    ],
    postagemTexto: gerarPostagemMarkdown({
      titulo: 'Por que 70% da energia do motor vira calor?',
      textoCapa: 'Veja por dentro',
      descricao: 'Mostramos em 3D para onde vai a energia do combustível dentro do cilindro.',
      tags: ['motor', 'combustao', 'engenharia'],
      comentarioFixado: 'Qual peça você acha que esquenta mais?',
    }),
  });
  assert.ok(synthetic.notaGeral >= 70, `Nota inesperada no sintético: ${synthetic.notaGeral}`);
});

test('pesquisa.mjs interpreta contadores pt-BR/en-US, ytInitialData e Outliers', () => {
  assert.equal(parseContadorYoutube('1,2 mi de visualizações'), 1_200_000);
  assert.equal(parseContadorYoutube('45 mil views'), 45_000);
  assert.equal(parseContadorYoutube('850K views'), 850_000);
  assert.equal(calcularOutlierRatio(300_000, 100_000), 3);

  const mockHtml = `<script>var ytInitialData = ${JSON.stringify({
    contents: {
      items: [
        {
          videoRenderer: {
            videoId: 'abc123',
            title: { runs: [{ text: 'Por que o asfalto racha?' }] },
            ownerText: { runs: [{ text: 'Canal Teste' }] },
            viewCountText: { simpleText: '500 mil visualizações' },
            lengthText: { simpleText: '0:52' },
          },
        },
        {
          videoRenderer: {
            videoId: 'def456',
            title: { runs: [{ text: 'Como fazem rodovias em 3 passos' }] },
            ownerText: { runs: [{ text: 'Obras TV' }] },
            viewCountText: { simpleText: '100 mil visualizações' },
            lengthText: { simpleText: '8:12' },
          },
        },
        {
          videoRenderer: {
            videoId: 'ghi789',
            title: { runs: [{ text: 'Asfalto permeável funciona?' }] },
            ownerText: { runs: [{ text: 'Engenharia' }] },
            viewCountText: { simpleText: '80 mil visualizações' },
            lengthText: { simpleText: '0:45' },
          },
        },
      ],
    },
  })};</script>`;

  const videos = extrairVideosYtInitialData(mockHtml);
  assert.equal(videos.length, 3);
  assert.equal(videos[0].tipo, 'short');
  assert.equal(videos[1].tipo, 'video');

  const padroes = analisarPadroesTitulos(videos);
  assert.equal(padroes.medianaViews, 100_000);
  assert.equal(padroes.outliers.length, 1);
  assert.equal(padroes.outliers[0].id, 'abc123');
  assert.equal(padroes.outliers[0].outlierVsBusca, 5);
  assert.equal(padroes.porcentagemPergunta, 67);
});

test('extrairPrimeiraFrase e extrairUltimaFrase isolam abertura e fechamento', () => {
  const txt = 'Noventa por cento erram isso! Aqui está o motivo. Qual você escolheria?';
  assert.equal(extrairPrimeiraFrase(txt), 'Noventa por cento erram isso!');
  assert.equal(extrairUltimaFrase(txt), 'Qual você escolheria?');
});
