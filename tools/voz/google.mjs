// Voz GRATUITA sem chave: Google Translate TTS (endpoint público HTTP em pt-BR).
// Útil como alternativa rápida e sem dependências quando Edge/Gemini não forem escolhidos.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { dividirTextoEmBlocos, estimarTemposPorPalavras } from './alinhar.mjs';

export const VOZ_GOOGLE_PADRAO = 'pt-BR';

export const VOZES_GOOGLE = [
  { id: 'pt-BR', nome: 'Português (Brasil)', genero: 'Feminina', idioma: 'pt-BR', descricao: 'Voz padrão do Google Tradutor (grátis, sem chave)' },
  { id: 'pt-PT', nome: 'Português (Portugal)', genero: 'Feminina', idioma: 'pt-PT', descricao: 'Português europeu (grátis, sem chave)' },
];

function duracaoArquivo(arq) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', arq], { encoding: 'utf8' });
  const d = parseFloat(r.stdout);
  return Number.isFinite(d) ? d : null;
}

export async function gerarGoogleTTS({ texto, voz = VOZ_GOOGLE_PADRAO, velocidade = 1.0, saida }) {
  const blocos = dividirTextoEmBlocos(texto, 180);
  if (!blocos.length) throw new Error('Texto vazio para gerar voz.');

  const lang = voz || VOZ_GOOGLE_PADRAO;
  const ttsspeed = Number(velocidade) < 0.8 ? '0.24' : '1';
  const partes = [];

  for (const bloco of blocos) {
    const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(lang)}&ttsspeed=${ttsspeed}&q=${encodeURIComponent(bloco)}`;
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!r.ok) {
      throw new Error(`Google TTS respondeu HTTP ${r.status}. Tente usar o provedor "edge" ou "gemini".`);
    }
    partes.push(Buffer.from(await r.arrayBuffer()));
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'google-tts-'));
  try {
    if (partes.length === 1 && Math.abs((Number(velocidade) || 1) - 1) < 0.05) {
      fs.writeFileSync(saida, partes[0]);
    } else {
      const listaArq = path.join(tmpDir, 'lista.txt');
      const linhas = [];
      partes.forEach((buf, idx) => {
        const p = path.join(tmpDir, `p_${idx}.mp3`);
        fs.writeFileSync(p, buf);
        linhas.push(`file '${p.replace(/'/g, "'\\''")}'`);
      });
      fs.writeFileSync(listaArq, linhas.join('\n'));
      const v = Math.min(2.0, Math.max(0.5, Number(velocidade) || 1.0));
      const filtro = Math.abs(v - 1) >= 0.05 ? ['-af', `atempo=${v.toFixed(2)}`] : ['-c', 'copy'];
      const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listaArq, ...filtro, saida], { encoding: 'utf8' });
      if (ff.status !== 0) {
        fs.writeFileSync(saida, Buffer.concat(partes));
      }
    }

    const tokens = String(texto).trim().split(/\s+/).filter(Boolean);
    const duracaoTotal = duracaoArquivo(saida) || 0.42 * tokens.length;
    const palavras = estimarTemposPorPalavras(tokens, duracaoTotal);
    return { palavras, duracaoAudio: +duracaoTotal.toFixed(3), cobertura: 1 };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
