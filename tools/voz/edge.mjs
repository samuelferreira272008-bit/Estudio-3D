// Voz GRATUITA em nuvem: Microsoft Edge Neural TTS (sem chave de API, vozes neurais pt-BR + tempos exatos por palavra).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { alinharComMarcadores, dividirTextoEmBlocos } from './alinhar.mjs';

export const VOZ_EDGE_PADRAO = 'pt-BR-AntonioNeural';

export const VOZES_EDGE_CURADAS = [
  { id: 'pt-BR-AntonioNeural', nome: 'Antonio (BR)', genero: 'Masculina', idioma: 'pt-BR', descricao: 'Voz masculina natural em português do Brasil' },
  { id: 'pt-BR-FranciscaNeural', nome: 'Francisca (BR)', genero: 'Feminina', idioma: 'pt-BR', descricao: 'Voz feminina natural em português do Brasil' },
  { id: 'pt-BR-ThalitaMultilingualNeural', nome: 'Thalita (BR)', genero: 'Feminina', idioma: 'pt-BR', descricao: 'Voz feminina multilíngue suave (pt-BR)' },
  { id: 'pt-PT-DuarteNeural', nome: 'Duarte (PT)', genero: 'Masculina', idioma: 'pt-PT', descricao: 'Voz masculina em português europeu' },
  { id: 'pt-PT-RaquelNeural', nome: 'Raquel (PT)', genero: 'Feminina', idioma: 'pt-PT', descricao: 'Voz feminina em português europeu' },
];

export function velocidadeParaRate(velocidade = 1.0) {
  const v = Number(velocidade);
  if (!Number.isFinite(v) || v <= 0) return '+0%';
  const pct = Math.round((Math.min(2.0, Math.max(0.5, v)) - 1) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

export function escaparXml(texto) {
  return String(texto || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function listarVozesEdge(idioma = 'pt') {
  try {
    const tts = new MsEdgeTTS({ connectionTimeoutMs: 10000 });
    const lista = await tts.getVoices();
    const filtro = idioma ? String(idioma).toLowerCase() : '';
    const filtradas = (lista || []).filter((v) => !filtro || String(v.Locale || '').toLowerCase().startsWith(filtro));
    return filtradas.map((v) => ({
      id: v.ShortName,
      nome: String(v.FriendlyName || v.ShortName)
        .replace(/^Microsoft\s+/i, '')
        .replace(/\s+Online\s*\(Natural\)\s*/i, ' ')
        .trim(),
      genero: v.Gender === 'Female' ? 'Feminina' : v.Gender === 'Male' ? 'Masculina' : v.Gender || '',
      idioma: v.Locale || '',
      descricao: `Edge Neural (${v.Status || 'GA'})`,
    }));
  } catch {
    return VOZES_EDGE_CURADAS;
  }
}

function duracaoArquivo(arq) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', arq], { encoding: 'utf8' });
  const d = parseFloat(r.stdout);
  return Number.isFinite(d) ? d : null;
}

async function sintetizarBlocoEdge({ bloco, voz, rate }) {
  const tts = new MsEdgeTTS({ connectionTimeoutMs: 15000, synthesisTimeoutMs: 45000 });
  try {
    await tts.setMetadata(voz, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, {
      wordBoundaryEnabled: true,
    });
    const { audioStream, metadataStream } = tts.toStream(escaparXml(bloco), { rate });
    const audioChunks = [];
    const marcadores = [];

    metadataStream?.on('data', (chunk) => {
      try {
        const j = JSON.parse(chunk.toString('utf8'));
        for (const item of j.Metadata || []) {
          if (item.Type === 'WordBoundary' && item.Data) {
            const inicio = Number(item.Data.Offset) / 1e7;
            const dur = Number(item.Data.Duration) / 1e7;
            const palavra = item.Data.text?.Text || '';
            if (palavra && Number.isFinite(inicio)) {
              marcadores.push({ palavra, inicio, fim: inicio + Math.max(0.04, dur || 0.05) });
            }
          }
        }
      } catch { /* ignora chunk parcial */ }
    });

    await new Promise((resolve, reject) => {
      audioStream.on('data', (d) => audioChunks.push(d));
      audioStream.once('end', resolve);
      audioStream.once('error', reject);
    });

    const buffer = Buffer.concat(audioChunks);
    if (!buffer.length) throw new Error('Edge TTS não retornou áudio.');
    return { buffer, marcadores };
  } finally {
    tts.close();
  }
}

export async function gerarEdgeTTS({ texto, voz = VOZ_EDGE_PADRAO, velocidade = 1.0, saida }) {
  const blocos = dividirTextoEmBlocos(texto, 1400);
  if (!blocos.length) throw new Error('Texto vazio para gerar voz.');
  const rate = velocidadeParaRate(velocidade);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-tts-'));
  try {
    const buffers = [];
    const todosMarcadores = [];
    let offsetAcumulado = 0;

    for (let i = 0; i < blocos.length; i++) {
      const { buffer, marcadores } = await sintetizarBlocoEdge({ bloco: blocos[i], voz, rate });
      const tmpArq = path.join(tmpDir, `parte_${i}.mp3`);
      fs.writeFileSync(tmpArq, buffer);
      buffers.push({ arq: tmpArq, buffer });

      for (const m of marcadores) {
        todosMarcadores.push({
          palavra: m.palavra,
          inicio: m.inicio + offsetAcumulado,
          fim: m.fim + offsetAcumulado,
        });
      }

      if (i < blocos.length - 1) {
        const durBloco = duracaoArquivo(tmpArq);
        const ultimoFim = marcadores.length ? marcadores[marcadores.length - 1].fim : 0;
        offsetAcumulado += durBloco ?? (ultimoFim + 0.15);
      }
    }

    if (buffers.length === 1) {
      fs.writeFileSync(saida, buffers[0].buffer);
    } else {
      const listaArq = path.join(tmpDir, 'lista.txt');
      fs.writeFileSync(listaArq, buffers.map((b) => `file '${b.arq.replace(/'/g, "'\\''")}'`).join('\n'));
      const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listaArq, '-c', 'copy', saida], { encoding: 'utf8' });
      if (ff.status !== 0) {
        fs.writeFileSync(saida, Buffer.concat(buffers.map((b) => b.buffer)));
      }
    }

    const duracaoTotal = duracaoArquivo(saida);
    const tokens = String(texto).trim().split(/\s+/).filter(Boolean);
    const { palavras, cobertura } = alinharComMarcadores(tokens, todosMarcadores, duracaoTotal);
    return { palavras, duracaoAudio: duracaoTotal, cobertura };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
