import test from 'node:test';
import assert from 'node:assert/strict';
import {
  alinharComMarcadores,
  concatenarWavs,
  dividirTextoEmBlocos,
  estimarTemposPorPalavras,
  normalizarPalavra,
  wavDuracaoSegundos,
} from './alinhar.mjs';
import { escaparXml, velocidadeParaRate } from './edge.mjs';
import { normalizarNarracao } from './normalizar.mjs';
import { frasesDePalavras } from './gerar.mjs';

function makePcmWav(numSamples, sampleRate = 24000) {
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataSize, 40);
  return buf;
}

test('normalizarPalavra remove acentos e pontuação', () => {
  assert.equal(normalizarPalavra('Olá!'), 'ola');
  assert.equal(normalizarPalavra('ação,'), 'acao');
});

test('dividirTextoEmBlocos respeita limite e não perde palavras', () => {
  const texto = 'Primeira frase bem curta. Segunda frase um pouco mais longa para testar a quebra correta. Terceira frase final!';
  const blocos = dividirTextoEmBlocos(texto, 55);
  assert.ok(blocos.length >= 2);
  assert.ok(blocos.every((b) => b.length <= 55));
  assert.equal(blocos.join(' '), texto);
});

test('wavDuracaoSegundos e concatenarWavs calculam duração exata', () => {
  const w1 = makePcmWav(24000); // 1.0s
  const w2 = makePcmWav(12000); // 0.5s
  assert.equal(wavDuracaoSegundos(w1), 1);
  const joined = concatenarWavs([w1, w2]);
  assert.equal(wavDuracaoSegundos(joined), 1.5);
});

test('alinharComMarcadores mantém tokens originais, interpola lacunas e garante monotonicidade', () => {
  const tokens = ['Olá!', 'Este', 'teste', 'funciona', 'bem.'];
  const marcadores = [
    { palavra: 'Olá', inicio: 0.1, fim: 0.4 },
    { palavra: 'teste', inicio: 0.8, fim: 1.1 },
    { palavra: 'bem', inicio: 1.5, fim: 1.9 },
  ];
  const { palavras, casadas, cobertura } = alinharComMarcadores(tokens, marcadores, 2.0);
  assert.equal(casadas, 3);
  assert.equal(cobertura, 0.6);
  assert.deepEqual(palavras.map((p) => p.palavra), tokens);
  for (let i = 0; i < palavras.length; i++) {
    assert.ok(palavras[i].fim > palavras[i].inicio);
    if (i > 0) assert.ok(palavras[i].inicio >= palavras[i - 1].inicio);
    if (i < palavras.length - 1) assert.ok(palavras[i].fim <= palavras[i + 1].inicio + 0.001);
  }
});

test('estimarTemposPorPalavras gera tempos proporcionais dentro da duração', () => {
  const tokens = ['Um', 'texto', 'curto.', 'Fim!'];
  const res = estimarTemposPorPalavras(tokens, 4.0);
  assert.equal(res.length, 4);
  assert.equal(res[0].inicio, 0);
  assert.ok(res[3].fim <= 4.0);
  assert.deepEqual(frasesDePalavras(res).length, 2);
});

test('velocidadeParaRate e escaparXml para Edge TTS', () => {
  assert.equal(velocidadeParaRate(1.0), '+0%');
  assert.equal(velocidadeParaRate(1.25), '+25%');
  assert.equal(velocidadeParaRate(0.85), '-15%');
  assert.equal(escaparXml('A & B < C'), 'A &amp; B &lt; C');
});

test('normalizarNarracao escreve números e símbolos por extenso', () => {
  const { texto } = normalizarNarracao('São 20 km/h e 50% de chance.');
  assert.equal(texto, 'São vinte quilômetros por hora e cinquenta por cento de chance.');
});
