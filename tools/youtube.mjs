// Ferramenta YouTube para agentes de IA: ganchos, pacote Título+Capa/SEO, auditoria de retenção e pesquisa de nicho.
// Uso:
//   node tools/youtube.mjs auditar projects/<nome> [--json]
//   node tools/youtube.mjs gancho "<frase inicial>" [--json]
//   node tools/youtube.mjs pacote --titulo "..." [--capa "..."] [--descricao "..."] [--tags "a,b"] [--json]
//   node tools/youtube.mjs pesquisar "<tema>" [--limite 10] [--json]
//   node tools/youtube.mjs preparar projects/<nome> [--titulo "..."] [--capa "..."] [--json]
//   node tools/youtube.mjs formulas [--json]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerEnv } from './voz/gerar.mjs';
import { FORMULAS_GANCHO, avaliarGancho } from './youtube/ganchos.mjs';
import { avaliarTituloCapa, gerarPostagemMarkdown, normalizarMetadadosYoutube } from './youtube/pacote.mjs';
import { auditarProjetoYoutube, extrairPrimeiraFrase, extrairUltimaFrase } from './youtube/retencao.mjs';
import { pesquisarYoutube } from './youtube/pesquisa.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
lerEnv(root);

const args = process.argv.slice(2);
const cmd = args[0] || '';
const asJson = args.includes('--json');

function getFlag(nome, fallback = '') {
  const i = args.indexOf(nome);
  if (i >= 0 && args[i + 1] && !args[i + 1].startsWith('--')) return args[i + 1];
  const eq = args.find((a) => a.startsWith(`${nome}=`));
  return eq ? eq.slice(nome.length + 1) : fallback;
}

function erro(msg) {
  if (asJson) console.log(JSON.stringify({ ok: false, error: msg }));
  else console.error('Erro:', msg);
  process.exit(1);
}

function imprimirAuditoria(proj, res) {
  console.log(`\nAuditoria YouTube — ${proj}`);
  console.log(`Nota geral: ${res.notaGeral}/100 · Formato: ${res.formato} · ${res.cenas} cenas (${res.duracao.toFixed(1)}s) · ${res.wpm} ppm`);
  console.log('\nPilares:');
  console.log(`  - Gancho (0-3s):       ${res.pilares.gancho.nota}/100  [${res.pilares.gancho.formula.nome}]`);
  console.log(`  - Ritmo visual:        ${res.pilares.ritmo.nota}/100  (média ${res.pilares.ritmo.mediaCena}s/cena, lentas: ${res.pilares.ritmo.cenasLentas})`);
  console.log(`  - Fala e silêncios:    ${res.pilares.fala.nota}/100  (${res.pilares.fala.wpm} ppm, pausas >0,75s: ${res.pilares.fala.pausasLongas})`);
  console.log(`  - Pacote Clique & SEO: ${res.pilares.pacote.nota}/100`);
  console.log(`  - Fechamento e loop:   ${res.pilares.fechamento.nota}/100`);
  if (res.proximasAcoes.length) {
    console.log('\nPrioridades de melhoria:');
    res.proximasAcoes.forEach((d, idx) => console.log(`  ${idx + 1}. ${d}`));
  } else {
    console.log('\nTudo ótimo — pronto para renderizar e postar!');
  }
}

async function run() {
  if (!cmd || cmd === '--help' || cmd === '-h') {
    console.log(`Uso:
  node tools/youtube.mjs auditar projects/<nome> [--json]
  node tools/youtube.mjs gancho "<texto>" [--json]
  node tools/youtube.mjs pacote --titulo "..." [--capa "..."] [--descricao "..."] [--tags "a,b"] [--json]
  node tools/youtube.mjs pesquisar "<tema>" [--limite 10] [--json]
  node tools/youtube.mjs preparar projects/<nome> [--titulo "..."] [--capa "..."] [--forcar] [--json]
  node tools/youtube.mjs formulas [--json]`);
    return;
  }

  if (cmd === 'formulas') {
    if (asJson) return console.log(JSON.stringify({ ok: true, formulas: FORMULAS_GANCHO }, null, 2));
    console.log(`${FORMULAS_GANCHO.length} fórmulas de gancho:`);
    FORMULAS_GANCHO.forEach((f, i) => console.log(`${i + 1}. ${f.nome} (${f.id}) — ${f.formato}\n   Ex.: ${f.exemplo}`));
    return;
  }

  if (cmd === 'gancho') {
    const texto = args.slice(1).filter((a) => !a.startsWith('--')).join(' ').trim();
    if (!texto) erro('Informe o texto do gancho entre aspas.');
    const res = avaliarGancho(texto);
    if (asJson) return console.log(JSON.stringify({ ok: true, ...res }, null, 2));
    console.log(`Nota do gancho: ${res.nota}/100 (Grau ${res.grau}) · Fórmula: ${res.formula.nome}`);
    console.log('Subnotas:', JSON.stringify(res.subnotas));
    res.pontosFortes.forEach((p) => console.log('  ✓', p));
    res.problemas.forEach((p) => console.log('  !', p));
    return;
  }

  if (cmd === 'pacote') {
    const titulo = getFlag('--titulo');
    const textoCapa = getFlag('--capa');
    const descricao = getFlag('--descricao');
    const tags = getFlag('--tags');
    const res = avaliarTituloCapa({ titulo, textoCapa, descricao, tags });
    if (asJson) return console.log(JSON.stringify({ ok: true, ...res }, null, 2));
    console.log(`Nota do pacote: ${res.nota}/100 · ${res.caracteres} caracteres no título`);
    res.bons.forEach((b) => console.log('  ✓', b));
    res.issues.forEach((i) => console.log(`  [${i.severidade}]`, i.mensagem));
    return;
  }

  if (cmd === 'pesquisar') {
    const q = args.slice(1).filter((a) => !a.startsWith('--') && !/^\d+$/.test(a)).join(' ').trim() || getFlag('--q');
    if (!q) erro('Informe o tema da pesquisa.');
    const limite = Number(getFlag('--limite', '10')) || 10;
    const res = await pesquisarYoutube(q, { limite, apiKey: process.env.YOUTUBE_API_KEY });
    if (asJson) return console.log(JSON.stringify({ ok: true, ...res }, null, 2));
    console.log(`Pesquisa "${res.query}" (${res.modo}) — ${res.total} vídeo(s)`);
    console.log(`Padrões: média ${res.mediaCaracteres} caracteres · ${res.porcentagemPergunta}% pergunta · ${res.porcentagemComNumero}% com número · mediana ${res.medianaViews ?? '-'} views`);
    if (res.palavrasFrequentes.length) {
      console.log('Palavras recorrentes:', res.palavrasFrequentes.map((p) => `${p.palavra}(${p.qtd})`).join(', '));
    }
    res.videos.slice(0, limite).forEach((v, i) => {
      const ratio = v.outlierVsBusca ? ` · ${v.outlierVsBusca}x` : '';
      console.log(`${i + 1}. ${v.titulo} (${v.titulo.length}ch)${v.viewsTexto ? ` — ${v.viewsTexto}` : ''}${ratio}`);
    });
    return;
  }

  if (cmd === 'auditar') {
    const proj = args[1];
    if (!proj) erro('Informe o caminho do projeto (ex.: projects/exemplo-asfalto).');
    const res = auditarProjetoYoutube(root, proj, {
      tituloOverride: getFlag('--titulo'),
      capaOverride: getFlag('--capa'),
    });
    if (asJson) return console.log(JSON.stringify({ ok: true, projeto: proj, ...res }, null, 2));
    imprimirAuditoria(proj, res);
    return;
  }

  if (cmd === 'preparar') {
    const proj = args[1];
    if (!proj) erro('Informe o caminho do projeto (ex.: projects/exemplo-asfalto).');
    const pasta = path.resolve(root, proj);
    const sbArq = path.join(pasta, 'storyboard.json');
    if (!fs.existsSync(sbArq)) erro(`Storyboard não encontrado em ${proj}`);

    const sb = JSON.parse(fs.readFileSync(sbArq, 'utf8'));
    const nar = fs.existsSync(path.join(pasta, 'narracao.txt')) ? fs.readFileSync(path.join(pasta, 'narracao.txt'), 'utf8') : '';
    const primeira = extrairPrimeiraFrase(nar);
    const ultima = extrairUltimaFrase(nar);
    const painelHook = (sb.cenas?.[0]?.textos || []).find((t) => t.estilo === 'titulo')?.texto || '';
    const painelPergunta = (sb.cenas?.slice(-1)[0]?.textos || []).find((t) => t.estilo === 'pergunta' || /\?/.test(t.texto || ''))?.texto || '';

    const titulo = getFlag('--titulo') || sb.titulo || primeira.slice(0, 58);
    const textoCapa = getFlag('--capa') || painelHook || 'O segredo oculto';
    const meta = normalizarMetadadosYoutube({
      titulo,
      textoCapa,
      descricao: getFlag('--descricao') || `${primeira}\n\nExplicação visual passo a passo em 3D.`,
      tags: getFlag('--tags') || (sb.titulo || '').split(/\s+/).filter((w) => w.length > 3).join(','),
      hashtags: ['#shorts', '#explicacao', '#curiosidades'],
    });

    const md = gerarPostagemMarkdown({
      projetoTitulo: sb.titulo || path.basename(pasta),
      titulo: meta.titulo,
      textoCapa: meta.textoCapa,
      descricao: meta.descricao,
      hashtags: meta.hashtags,
      tags: meta.tags,
      comentarioFixado: /\?/.test(ultima) ? ultima : painelPergunta,
    });

    const postArq = path.join(pasta, 'postagem.md');
    const jsonArq = path.join(pasta, 'youtube.json');
    if (fs.existsSync(postArq) && !args.includes('--forcar')) {
      erro(`${proj}/postagem.md já existe. Use --forcar se quiser sobrescrever.`);
    }
    fs.writeFileSync(postArq, md, 'utf8');
    fs.writeFileSync(jsonArq, JSON.stringify({ ...meta, atualizadoEm: new Date().toISOString() }, null, 2) + '\n', 'utf8');
    const aud = auditarProjetoYoutube(root, proj);
    if (asJson) return console.log(JSON.stringify({ ok: true, projeto: proj, postagem: `${proj}/postagem.md`, auditoria: aud }, null, 2));
    console.log(`Gerado: ${proj}/postagem.md e ${proj}/youtube.json`);
    imprimirAuditoria(proj, aud);
    return;
  }

  erro(`Subcomando desconhecido: ${cmd}`);
}

run().catch((e) => erro(e?.message || String(e)));
