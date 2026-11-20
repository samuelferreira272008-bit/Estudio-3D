// Central da voz do pack. Uso: node tools/voz.mjs <comando>
//
//   diagnostico [--json]                  vê opções de voz (APIs gratuitas e voz local) e o que falta
//   configurar-edge [--voz NOME]          usa Edge TTS (GRÁTIS, sem chave de API, com tempos por palavra)
//   configurar-gemini [--voz NOME]        usa Gemini TTS / Google AI Studio (GRÁTIS, usa GEMINI_API_KEY)
//   configurar-google [--voz pt-BR]       usa Google Tradutor TTS (GRÁTIS, sem chave de API)
//   instalar [--forcar]                   instala a voz GRÁTIS local (Kokoro + Whisper) em .voz/
//   configurar-paga [--voz ID]            usa o ElevenLabs (ELEVENLABS_API_KEY no .env)
//   vozes [--provedor NOME]               lista as vozes disponíveis do provedor
//   gerar projects/<nome> [--provedor P]  gera a narração + tempos por palavra do projeto
//   testar [--provedor P] [--voz V]       gera uma frase curta com a voz configurada (ou Edge TTS)
//   status                                mostra a configuração atual e os provedores disponíveis

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { diagnosticar, relatorio } from './voz/diagnostico.mjs';
import { instalarVozGratis } from './voz/instalar.mjs';
import { listarVozes } from './voz/elevenlabs.mjs';
import { listarVozesEdge, VOZ_EDGE_PADRAO } from './voz/edge.mjs';
import { MODELO_GEMINI_TTS_PADRAO, VOZES_GEMINI, VOZ_GEMINI_PADRAO } from './voz/gemini.mjs';
import { VOZES_GOOGLE, VOZ_GOOGLE_PADRAO } from './voz/google.mjs';
import { gerarNarracao, lerEnv, lerConfigVoz } from './voz/gerar.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [cmd, ...resto] = process.argv.slice(2);
const flag = (n) => resto.includes(`--${n}`);
const valor = (n) => { const i = resto.indexOf(`--${n}`); return i >= 0 ? resto[i + 1] : undefined; };
lerEnv(raiz);

function salvarConfig(mudar) {
  const arq = path.join(raiz, 'config', 'voz.json');
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  const cfg = mudar(lerConfigVoz(raiz));
  fs.writeFileSync(arq, JSON.stringify(cfg, null, 2) + '\n');
  return cfg;
}

try {
  switch (cmd) {
    case 'diagnostico': {
      const d = diagnosticar(raiz);
      console.log(flag('json') ? JSON.stringify(d, null, 2) : relatorio(d));
      break;
    }
    case 'instalar':
      await instalarVozGratis(raiz, { forcar: flag('forcar') });
      break;
    case 'configurar-edge': {
      const voz = valor('voz') || VOZ_EDGE_PADRAO;
      const velocidade = valor('velocidade') ? Number(valor('velocidade')) : undefined;
      const cfg = salvarConfig((c) => ({
        ...c,
        provedor: 'edge',
        edge: { ...c.edge, voz, ...(velocidade ? { velocidade } : {}) },
      }));
      console.log(`Voz gratuita (Edge TTS) ativada. Voz: ${cfg.edge.voz}.`);
      break;
    }
    case 'configurar-gemini': {
      const voz = valor('voz') || VOZ_GEMINI_PADRAO;
      const modelo = valor('modelo') || MODELO_GEMINI_TTS_PADRAO;
      const estilo = valor('estilo');
      const velocidade = valor('velocidade') ? Number(valor('velocidade')) : undefined;
      const cfg = salvarConfig((c) => ({
        ...c,
        provedor: 'gemini',
        gemini: {
          ...c.gemini,
          voz,
          modelo,
          ...(estilo ? { estilo } : {}),
          ...(velocidade ? { velocidade } : {}),
        },
      }));
      const avisoChave = process.env.GEMINI_API_KEY
        ? 'GEMINI_API_KEY detectada.'
        : 'Defina GEMINI_API_KEY no ambiente ou no .env para gerar áudio.';
      console.log(`Voz gratuita (Gemini TTS / Google AI Studio) ativada. Voz: ${cfg.gemini.voz} (${cfg.gemini.modelo}). ${avisoChave}`);
      break;
    }
    case 'configurar-google': {
      const voz = valor('voz') || VOZ_GOOGLE_PADRAO;
      const velocidade = valor('velocidade') ? Number(valor('velocidade')) : undefined;
      const cfg = salvarConfig((c) => ({
        ...c,
        provedor: 'google',
        google: { ...c.google, voz, ...(velocidade ? { velocidade } : {}) },
      }));
      console.log(`Voz gratuita (Google Tradutor TTS) ativada. Voz: ${cfg.google.voz}.`);
      break;
    }
    case 'configurar-paga': {
      if (!process.env.ELEVENLABS_API_KEY) {
        console.error('Não achei ELEVENLABS_API_KEY. Copie .env.example para .env, cole a chave depois do "=" e rode de novo.');
        process.exit(1);
      }
      const voz = valor('voz');
      const cfg = salvarConfig((c) => ({ ...c, provedor: 'elevenlabs', elevenlabs: { ...c.elevenlabs, ...(voz ? { voiceId: voz } : {}) } }));
      console.log(`Voz paga (ElevenLabs) ativada.${cfg.elevenlabs?.voiceId ? ` Voz: ${cfg.elevenlabs.voiceId}.` : ' Falta escolher a voz: rode `node tools/voz.mjs vozes --provedor elevenlabs`.'}`);
      break;
    }
    case 'vozes': {
      const cfg = lerConfigVoz(raiz);
      const provedor = valor('provedor') || cfg.provedor || 'edge';
      if (provedor === 'edge') {
        const lista = await listarVozesEdge(valor('idioma') || 'pt');
        for (const v of lista) console.log(`${v.id}  ${v.nome}  [${v.genero}] ${v.idioma}`.trim());
        console.log(`\n${lista.length} voz(es) Edge TTS. Para usar: node tools/voz.mjs configurar-edge --voz <id>`);
      } else if (provedor === 'gemini') {
        for (const v of VOZES_GEMINI) console.log(`${v.id}  ${v.nome}  [${v.genero}] ${v.descricao}`.trim());
        console.log(`\n${VOZES_GEMINI.length} voz(es) Gemini TTS. Para usar: node tools/voz.mjs configurar-gemini --voz <id>`);
      } else if (provedor === 'google') {
        for (const v of VOZES_GOOGLE) console.log(`${v.id}  ${v.nome}  ${v.descricao}`.trim());
        console.log(`\n${VOZES_GOOGLE.length} voz(es) Google TTS. Para usar: node tools/voz.mjs configurar-google --voz <id>`);
      } else if (provedor === 'kokoro') {
        console.log('pf_dora (feminina pt-BR)\npm_alex (masculina pt-BR)\npm_santa (masculina pt-BR)');
      } else {
        const lista = await listarVozes(process.env.ELEVENLABS_API_KEY);
        for (const v of lista) console.log(`${v.id}  ${v.nome}  [${v.categoria}] ${v.idioma} ${v.descricao}`.trim());
        console.log(`\n${lista.length} voz(es) ElevenLabs. Para usar: node tools/voz.mjs configurar-paga --voz <id>`);
      }
      break;
    }
    case 'gerar': {
      const flagsComValor = new Set([valor('voz'), valor('velocidade'), valor('provedor'), valor('modelo'), valor('estilo')]);
      const projeto = resto.find((a) => !a.startsWith('--') && !flagsComValor.has(a));
      if (!projeto) {
        console.error('Uso: node tools/voz.mjs gerar projects/<nome> [--provedor edge|gemini|google|kokoro|elevenlabs] [--voz ID] [--velocidade 1.0]');
        process.exit(1);
      }
      const r = await gerarNarracao(raiz, projeto.replace(/\\/g, '/'), {
        provedor: valor('provedor'),
        voz: valor('voz'),
        modelo: valor('modelo'),
        estilo: valor('estilo'),
        velocidade: valor('velocidade') ? Number(valor('velocidade')) : undefined,
      });
      console.log(JSON.stringify(r, null, 2));
      console.log(`\nPróximo passo: ajuste duracao e audio ("${r.audio}") no storyboard e alinhe as cenas com ${projeto}/frases.json.`);
      break;
    }
    case 'testar': {
      const pasta = path.join(raiz, 'projects', '_teste-voz');
      fs.mkdirSync(pasta, { recursive: true });
      fs.writeFileSync(path.join(pasta, 'narracao.txt'), 'Olá! Este é um teste de voz. Se você está me ouvindo, está tudo certo.\n');
      const cfg = lerConfigVoz(raiz);
      const provedor = valor('provedor') || cfg.provedor || 'edge';
      const r = await gerarNarracao(raiz, 'projects/_teste-voz', {
        provedor,
        voz: valor('voz'),
        modelo: valor('modelo'),
        estilo: valor('estilo'),
        velocidade: valor('velocidade') ? Number(valor('velocidade')) : undefined,
      });
      console.log(JSON.stringify(r, null, 2));
      console.log(`Ouça: projects/_teste-voz/${r.audio}`);
      break;
    }
    case 'status': {
      const c = lerConfigVoz(raiz);
      console.log(Object.keys(c).length ? JSON.stringify(c, null, 2) : 'Nenhuma voz configurada ainda (Edge TTS funciona sem configuração prévia).');
      console.log(`APIs gratuitas: Edge TTS (disponível, sem chave), Gemini TTS / AI Studio (${process.env.GEMINI_API_KEY ? 'GEMINI_API_KEY definida' : 'falta GEMINI_API_KEY'}), Google TTS (disponível, sem chave)`);
      console.log(`Voz grátis local (Kokoro): ${fs.existsSync(path.join(raiz, '.voz', 'venv')) ? 'instalada' : 'não instalada'}`);
      console.log(`Chave ElevenLabs: ${process.env.ELEVENLABS_API_KEY ? 'definida no .env' : 'não definida'}`);
      break;
    }
    default:
      console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(0, 12).join('\n'));
      process.exit(cmd ? 1 : 0);
  }
} catch (e) {
  console.error(`\nErro: ${e.message}`);
  process.exit(e.codigo || 1);
}
