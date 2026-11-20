// Voz via Google AI Studio / Gemini TTS (@google/genai, cota gratuita).
// Usa exclusivamente chamadas server-side com GEMINI_API_KEY e modelo gemini-3.8-flash-lite-tts / gemini-3.8-flash-tts.

import fs from 'node:fs';
import { GoogleGenAI, Type } from '@google/genai';
import {
  alinharComMarcadores,
  concatenarWavs,
  dividirTextoEmBlocos,
  estimarTemposPorPalavras,
  wavDuracaoSegundos,
} from './alinhar.mjs';

export const MODELO_GEMINI_TTS_PADRAO = 'gemini-3.8-flash-lite-tts';
export const VOZ_GEMINI_PADRAO = 'Kore';

export const VOZES_GEMINI = [
  { id: 'Kore', nome: 'Kore', genero: 'Neutra/Clara', idioma: 'multilíngue', descricao: 'Clara e equilibrada (padrão recomendada)' },
  { id: 'Puck', nome: 'Puck', genero: 'Animada', idioma: 'multilíngue', descricao: 'Energética e expressiva para vídeos virais' },
  { id: 'Charon', nome: 'Charon', genero: 'Grave', idioma: 'multilíngue', descricao: 'Firme e informativa' },
  { id: 'Fenrir', nome: 'Fenrir', genero: 'Forte', idioma: 'multilíngue', descricao: 'Intensa e envolvente' },
  { id: 'Zephyr', nome: 'Zephyr', genero: 'Suave', idioma: 'multilíngue', descricao: 'Leve e conversacional' },
  { id: 'Aoede', nome: 'Aoede', genero: 'Melódica', idioma: 'multilíngue', descricao: 'Fluida e narrativa' },
  { id: 'Leda', nome: 'Leda', genero: 'Jovem', idioma: 'multilíngue', descricao: 'Dinâmica e acessível' },
  { id: 'Orus', nome: 'Orus', genero: 'Assertiva', idioma: 'multilíngue', descricao: 'Direta e didática' },
];

export function criarClienteGemini(chave = process.env.GEMINI_API_KEY) {
  if (!chave) {
    throw new Error('Falta GEMINI_API_KEY para usar o Gemini TTS (Google AI Studio). Defina GEMINI_API_KEY no ambiente ou no .env.');
  }
  return new GoogleGenAI({
    apiKey: chave,
    apiVersion: 'v1beta',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function estiloEfetivo({ estilo, velocidade }) {
  const partes = [];
  if (estilo) partes.push(String(estilo).trim());
  else partes.push('Narrador claro, natural e envolvente em português do Brasil para vídeo curto explicativo');
  const v = Number(velocidade);
  if (Number.isFinite(v) && Math.abs(v - 1.0) >= 0.08) {
    partes.push(v > 1 ? `ritmo acelerado (${v.toFixed(2)}x)` : `ritmo pausado (${v.toFixed(2)}x)`);
  }
  return partes.join('; ');
}

async function alinharComGemini(ai, wavBuffer, texto, duracaoTotal) {
  const tokens = String(texto).trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return { palavras: [], cobertura: 1 };
  try {
    const resp = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'audio/wav',
              data: wavBuffer.toString('base64'),
            },
          },
          {
            text: `Ouça o áudio (duração total ${duracaoTotal.toFixed(2)}s) e retorne os tempos aproximados de início e fim em segundos para cada palavra falada desta transcrição exata: "${texto}"`,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              palavra: { type: Type.STRING },
              inicio: { type: Type.NUMBER },
              fim: { type: Type.NUMBER },
            },
            required: ['palavra', 'inicio', 'fim'],
          },
        },
      },
    });
    const bruto = JSON.parse((resp.text ?? '[]').trim());
    if (Array.isArray(bruto) && bruto.length >= Math.max(1, Math.floor(tokens.length * 0.35))) {
      const alinhado = alinharComMarcadores(tokens, bruto, duracaoTotal);
      if (alinhado.cobertura >= 0.35) return alinhado;
    }
  } catch {
    // Fallback determinístico proporcional caso o alinhamento multimodal não esteja disponível.
  }
  return {
    palavras: estimarTemposPorPalavras(tokens, duracaoTotal),
    cobertura: 1,
  };
}

function formatarErroGemini(err) {
  const raw = String(err?.message || err || 'Erro desconhecido no Gemini TTS.');
  try {
    const j = JSON.parse(raw);
    const msg = j?.error?.message || raw;
    const status = j?.error?.status || '';
    const reason = j?.error?.details?.find((d) => d.reason)?.reason || '';
    if (reason === 'API_KEY_INVALID' || /API key not valid/i.test(msg)) {
      return 'Chave GEMINI_API_KEY inválida ou não configurada. Confira a chave em Settings > Secrets (ou use Edge TTS / Google TTS sem chave).';
    }
    if (j?.error?.code === 429 || status === 'RESOURCE_EXHAUSTED') {
      return 'Limite de requisições da API Gemini TTS atingido no momento. Aguarde um pouco ou use o Edge TTS.';
    }
    return `Gemini TTS (${j?.error?.code || status || 'erro'}): ${msg}`;
  } catch {
    if (/API_KEY_INVALID|API key not valid/i.test(raw)) {
      return 'Chave GEMINI_API_KEY inválida ou não configurada. Confira a chave em Settings > Secrets (ou use Edge TTS / Google TTS sem chave).';
    }
    return raw;
  }
}

export async function gerarGeminiTTS({
  texto,
  voz = VOZ_GEMINI_PADRAO,
  modelo = MODELO_GEMINI_TTS_PADRAO,
  estilo,
  velocidade = 1.0,
  chave = process.env.GEMINI_API_KEY,
  saida,
}) {
  const ai = criarClienteGemini(chave);
  const blocos = dividirTextoEmBlocos(texto, 1200);
  if (!blocos.length) throw new Error('Texto vazio para gerar voz.');

  const style = estiloEfetivo({ estilo, velocidade });
  const wavPartes = [];

  for (const bloco of blocos) {
    let response;
    try {
      response = await ai.models.generateContent({
        model: modelo || MODELO_GEMINI_TTS_PADRAO,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: bloco,
                speechMetadata: { style },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voz || VOZ_GEMINI_PADRAO },
            },
          },
        },
      });
    } catch (err) {
      throw new Error(formatarErroGemini(err));
    }

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error('O Gemini TTS não retornou áudio na resposta.');
    }
    wavPartes.push(Buffer.from(base64Audio, 'base64'));
  }

  const wavFinal = concatenarWavs(wavPartes);
  fs.writeFileSync(saida, wavFinal);
  const duracaoTotal = wavDuracaoSegundos(wavFinal) || 0.4 * texto.split(/\s+/).length;
  const { palavras, cobertura } = await alinharComGemini(ai, wavFinal, texto, duracaoTotal);

  return {
    palavras,
    duracaoAudio: +duracaoTotal.toFixed(3),
    cobertura,
    modelo: modelo || MODELO_GEMINI_TTS_PADRAO,
  };
}
