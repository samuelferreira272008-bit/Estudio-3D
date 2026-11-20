// Gera a narração de um projeto: lê projects/<nome>/narracao.txt e escreve o áudio, palavras.json e frases.json.
// Usa a voz configurada em config/voz.json (Kokoro grátis ou ElevenLabs pago).

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { normalizarNarracao } from './normalizar.mjs';
import { caminhosVoz, ambientePython } from './instalar.mjs';
import { gerarElevenLabs } from './elevenlabs.mjs';
import { gerarEdgeTTS, VOZ_EDGE_PADRAO } from './edge.mjs';
import { gerarGeminiTTS, MODELO_GEMINI_TTS_PADRAO, VOZ_GEMINI_PADRAO } from './gemini.mjs';
import { gerarGoogleTTS, VOZ_GOOGLE_PADRAO } from './google.mjs';

export function lerEnv(raiz) {
  const arq = path.join(raiz, '.env');
  if (!fs.existsSync(arq)) return;
  for (const linha of fs.readFileSync(arq, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

export function lerConfigVoz(raiz) {
  const arq = path.join(raiz, 'config', 'voz.json');
  return fs.existsSync(arq) ? JSON.parse(fs.readFileSync(arq, 'utf8')) : {};
}

export function duracaoAudio(arq) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', arq], { encoding: 'utf8' });
  const d = parseFloat(r.stdout);
  return Number.isFinite(d) ? d : null;
}

// Agrupa palavras em frases (para o agente alinhar as cenas com as frases da narração).
export function frasesDePalavras(palavras) {
  const frases = [];
  let atual = [];
  for (const w of palavras) {
    atual.push(w);
    if (/[.!?…]+["”')\]]*$/.test(w.palavra)) { frases.push(atual); atual = []; }
  }
  if (atual.length) frases.push(atual);
  return frases.map((ws, i) => ({
    n: i + 1, texto: ws.map((w) => w.palavra).join(' '), inicio: ws[0].inicio, fim: ws[ws.length - 1].fim,
  }));
}

export async function gerarNarracao(raiz, projeto, opcoes = {}) {
  lerEnv(raiz);
  const pasta = path.join(raiz, projeto);
  const arqTexto = path.join(pasta, 'narracao.txt');
  if (!fs.existsSync(arqTexto)) throw new Error(`Não achei ${path.join(projeto, 'narracao.txt')}. Escreva a narração nesse arquivo primeiro.`);
  const cfg = lerConfigVoz(raiz);
  const provedor = opcoes.provedor || cfg.provedor;
  if (!provedor) {
    throw new Error('Nenhuma voz configurada. Use `node tools/voz.mjs configurar-edge` (grátis, sem chave), `configurar-gemini` (Google AI Studio), `configurar-google`, `instalar` (Kokoro local) ou `configurar-paga` (ElevenLabs).');
  }

  const { texto, avisos } = normalizarNarracao(fs.readFileSync(arqTexto, 'utf8'));
  const falado = path.join(pasta, 'narracao.falado.txt');
  fs.writeFileSync(falado, texto + '\n', 'utf8');
  if (avisos.length) console.log(`Normalização: ${avisos.length} número(s) escrito(s) por extenso.`);

  let audio;
  let palavras;
  let duracaoRetornada = null;
  let extra = {};
  if (provedor === 'edge') {
    const e = { ...cfg.edge, ...(opcoes.voz ? { voz: opcoes.voz } : {}), ...(opcoes.velocidade ? { velocidade: opcoes.velocidade } : {}) };
    const voz = e.voz || VOZ_EDGE_PADRAO;
    const velocidade = e.velocidade || 1.0;
    audio = 'narracao.mp3';
    const r = await gerarEdgeTTS({ texto, voz, velocidade, saida: path.join(pasta, audio) });
    palavras = r.palavras;
    duracaoRetornada = r.duracaoAudio;
    fs.writeFileSync(path.join(pasta, 'palavras.json'), JSON.stringify(palavras, null, 1));
    extra = { voz, velocidade, coberturaTempos: r.cobertura };
  } else if (provedor === 'gemini') {
    const g = {
      ...cfg.gemini,
      ...(opcoes.voz ? { voz: opcoes.voz } : {}),
      ...(opcoes.modelo ? { modelo: opcoes.modelo } : {}),
      ...(opcoes.estilo ? { estilo: opcoes.estilo } : {}),
      ...(opcoes.velocidade ? { velocidade: opcoes.velocidade } : {}),
    };
    const voz = g.voz || VOZ_GEMINI_PADRAO;
    const modelo = g.modelo || MODELO_GEMINI_TTS_PADRAO;
    const velocidade = g.velocidade || 1.0;
    audio = 'narracao.wav';
    const r = await gerarGeminiTTS({
      texto, voz, modelo, estilo: g.estilo, velocidade, chave: process.env.GEMINI_API_KEY, saida: path.join(pasta, audio),
    });
    palavras = r.palavras;
    duracaoRetornada = r.duracaoAudio;
    fs.writeFileSync(path.join(pasta, 'palavras.json'), JSON.stringify(palavras, null, 1));
    extra = { voz, modelo: r.modelo, velocidade, coberturaTempos: r.cobertura };
  } else if (provedor === 'google') {
    const g = { ...cfg.google, ...(opcoes.voz ? { voz: opcoes.voz } : {}), ...(opcoes.velocidade ? { velocidade: opcoes.velocidade } : {}) };
    const voz = g.voz || VOZ_GOOGLE_PADRAO;
    const velocidade = g.velocidade || 1.0;
    audio = 'narracao.mp3';
    const r = await gerarGoogleTTS({ texto, voz, velocidade, saida: path.join(pasta, audio) });
    palavras = r.palavras;
    duracaoRetornada = r.duracaoAudio;
    fs.writeFileSync(path.join(pasta, 'palavras.json'), JSON.stringify(palavras, null, 1));
    extra = { voz, velocidade, coberturaTempos: r.cobertura };
  } else if (provedor === 'kokoro') {
    const c = caminhosVoz(raiz);
    const k = { ...cfg.kokoro, ...(opcoes.voz ? { voz: opcoes.voz } : {}), ...(opcoes.velocidade ? { velocidade: opcoes.velocidade } : {}) };
    if (!fs.existsSync(c.py) || !k.modelo) throw new Error('A voz grátis local (Kokoro) não está instalada. Rode `node tools/voz.mjs instalar` ou use `configurar-edge` / `configurar-gemini`.');
    audio = 'narracao.wav';
    const saidaWav = path.join(pasta, audio);
    const tts = spawnSync(c.py, [
      path.join(raiz, 'tools', 'voz', 'py', 'kokoro_tts.py'), '--modelo', path.join(c.modelos, k.modelo),
      '--vozes', path.join(c.modelos, k.vozes), '--texto', falado, '--saida', saidaWav, '--voz', k.voz, '--velocidade', String(k.velocidade || 1),
    ], { encoding: 'utf8', env: ambientePython(raiz), maxBuffer: 1 << 28 });
    if (tts.status !== 0) throw new Error(`Falha ao gerar a voz: ${(tts.stderr || tts.stdout).split('\n').slice(-12).join('\n')}`);
    const resumoTts = JSON.parse(tts.stdout.trim().split('\n').pop());
    const arqPal = path.join(pasta, 'palavras.json');
    const al = spawnSync(c.py, [
      path.join(raiz, 'tools', 'voz', 'py', 'alinhar.py'), '--audio', saidaWav, '--texto', falado, '--saida', arqPal, '--modelo', k.whisper || 'base',
    ], { encoding: 'utf8', env: ambientePython(raiz), maxBuffer: 1 << 28 });
    if (al.status !== 0) throw new Error(`Falha ao marcar o tempo das palavras: ${(al.stderr || al.stdout).split('\n').slice(-12).join('\n')}`);
    const resumoAl = JSON.parse(al.stdout.trim().split('\n').pop());
    palavras = JSON.parse(fs.readFileSync(arqPal, 'utf8'));
    extra = { voz: k.voz, coberturaTempos: resumoAl.cobertura, tempoSintese: resumoTts.tempoSintese };
  } else if (provedor === 'elevenlabs') {
    const e = { ...cfg.elevenlabs, ...(opcoes.voz ? { voiceId: opcoes.voz } : {}) };
    audio = 'narracao.mp3';
    const r = await gerarElevenLabs({
      texto, voiceId: e.voiceId || process.env.ELEVENLABS_VOICE_ID, chave: process.env.ELEVENLABS_API_KEY,
      modelId: e.modelId, velocidade: opcoes.velocidade || e.velocidade || 1.0, saida: path.join(pasta, audio),
    });
    palavras = r.palavras;
    duracaoRetornada = r.duracaoFala;
    fs.writeFileSync(path.join(pasta, 'palavras.json'), JSON.stringify(palavras, null, 1));
    extra = { voz: e.voiceId };
  } else {
    throw new Error(`Provedor de voz desconhecido: "${provedor}" (use "edge", "gemini", "google", "kokoro" ou "elevenlabs").`);
  }

  const frases = frasesDePalavras(palavras);
  fs.writeFileSync(path.join(pasta, 'frases.json'), JSON.stringify(frases, null, 1));
  const dur = duracaoAudio(path.join(pasta, audio)) ?? duracaoRetornada;
  const resumo = { provedor, audio, duracao: dur ? +dur.toFixed(2) : null, palavras: palavras.length, frases: frases.length, ...extra };
  fs.writeFileSync(path.join(pasta, 'voz.json'), JSON.stringify({ ...resumo, geradoEm: new Date().toISOString() }, null, 2));
  return resumo;
}
