// Alinhamento e temporização de palavras em Node.js puro (sem Python/Whisper).
// Usado pelos provedores de API gratuita (Edge TTS, Gemini TTS, Google TTS) para gerar palavras.json.

export function normalizarPalavra(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Divide um texto em blocos menores respeitando pontuação e espaços (para APIs com limite de caracteres).
export function dividirTextoEmBlocos(texto, maxChars = 180) {
  const limpo = String(texto || '').replace(/\s+/g, ' ').trim();
  if (!limpo) return [];
  if (limpo.length <= maxChars) return [limpo];

  const sentencas = limpo.match(/[^.!?…]+[.!?…]*|.+$/g) || [limpo];
  const blocos = [];
  let atual = '';

  const empurrar = (parte) => {
    const p = parte.trim();
    if (!p) return;
    if (!atual) {
      atual = p;
    } else if (atual.length + 1 + p.length <= maxChars) {
      atual += ' ' + p;
    } else {
      blocos.push(atual);
      atual = p;
    }
  };

  for (const s of sentencas) {
    const t = s.trim();
    if (!t) continue;
    if (t.length <= maxChars) {
      empurrar(t);
      continue;
    }
    // Sentença maior que maxChars: quebra por vírgula/ponto-e-vírgula ou por palavras.
    const clausulas = t.split(/(?<=[,;:])\s+/);
    for (const cl of clausulas) {
      if (cl.length <= maxChars) {
        empurrar(cl);
      } else {
        for (const w of cl.split(/\s+/)) {
          if (w.length > maxChars) {
            if (atual) { blocos.push(atual); atual = ''; }
            for (let i = 0; i < w.length; i += maxChars) blocos.push(w.slice(i, i + maxChars));
          } else {
            empurrar(w);
          }
        }
      }
    }
  }
  if (atual) blocos.push(atual);
  return blocos;
}

// Calcula a duração (em segundos) de um buffer WAV PCM linear (lendo o cabeçalho RIFF/fmt/data).
export function wavDuracaoSegundos(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 44) return null;
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return null;
  let offset = 12;
  let byteRate = null;
  let dataSize = null;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === 'fmt ' && offset + 24 <= buf.length) {
      byteRate = buf.readUInt32LE(offset + 16);
    } else if (id === 'data') {
      dataSize = Math.min(size, buf.length - (offset + 8));
      break;
    }
    offset += 8 + size + (size % 2);
  }
  if (!byteRate || !dataSize) return null;
  return dataSize / byteRate;
}

// Concatena vários buffers WAV compatíveis (mesmo formato PCM) em um único arquivo WAV válido.
export function concatenarWavs(wavBuffers) {
  const validos = wavBuffers.filter((b) => Buffer.isBuffer(b) && b.length > 44);
  if (!validos.length) throw new Error('Nenhum áudio WAV válido para concatenar.');
  if (validos.length === 1) return validos[0];

  const extrairDados = (buf) => {
    let offset = 12;
    let fmtChunk = null;
    while (offset + 8 <= buf.length) {
      const id = buf.toString('ascii', offset, offset + 4);
      const size = buf.readUInt32LE(offset + 4);
      if (id === 'fmt ') fmtChunk = buf.subarray(offset, offset + 8 + size);
      else if (id === 'data') {
        const end = Math.min(buf.length, offset + 8 + size);
        return { fmtChunk, pcm: buf.subarray(offset + 8, end) };
      }
      offset += 8 + size + (size % 2);
    }
    return { fmtChunk: buf.subarray(12, 36), pcm: buf.subarray(44) };
  };

  const primeiro = extrairDados(validos[0]);
  const pcms = [primeiro.pcm];
  for (let i = 1; i < validos.length; i++) pcms.push(extrairDados(validos[i]).pcm);

  const fmt = primeiro.fmtChunk || validos[0].subarray(12, 36);
  const totalData = pcms.reduce((s, p) => s + p.length, 0);
  const cabecalho = Buffer.alloc(12 + fmt.length + 8);
  cabecalho.write('RIFF', 0, 'ascii');
  cabecalho.writeUInt32LE(4 + fmt.length + 8 + totalData, 4);
  cabecalho.write('WAVE', 8, 'ascii');
  fmt.copy(cabecalho, 12);
  const dataOff = 12 + fmt.length;
  cabecalho.write('data', dataOff, 'ascii');
  cabecalho.writeUInt32LE(totalData, dataOff + 4);
  return Buffer.concat([cabecalho, ...pcms]);
}

// Estima tempos por palavra proporcionalmente ao peso fonético + pausas de pontuação.
export function estimarTemposPorPalavras(tokens, duracaoTotal) {
  if (!tokens.length) return [];
  const dur = Math.max(0.1 * tokens.length, Number(duracaoTotal) || 0.4 * tokens.length);
  const pesos = tokens.map((tok) => {
    const base = Math.max(1.5, normalizarPalavra(tok).length || tok.length || 1);
    const pausa = /[.!?…]+["”')\]]*$/.test(tok) ? 3.2 : /[,;:]+["”')\]]*$/.test(tok) ? 1.6 : 0;
    return { base, pausa };
  });
  const total = pesos.reduce((s, p) => s + p.base + p.pausa, 0);
  let cursor = 0;
  return tokens.map((tok, i) => {
    const { base, pausa } = pesos[i];
    const inicio = cursor;
    const durFala = (dur * base) / total;
    const durTotal = (dur * (base + pausa)) / total;
    cursor += durTotal;
    const fim = Math.max(inicio + 0.04, Math.min(dur, inicio + durFala));
    return {
      palavra: tok,
      inicio: +inicio.toFixed(3),
      fim: +fim.toFixed(3),
    };
  });
}

// Alinha tokens originais da narração com marcadores [{ palavra, inicio, fim }] via LCS.
// Tokens sem par são interpolados proporcionalmente entre as palavras vizinhas (como alinhar.py).
export function alinharComMarcadores(tokens, marcadores, duracaoTotal) {
  if (!tokens.length) return { palavras: [], casadas: 0, cobertura: 1 };
  const alvo = tokens.map(normalizarPalavra);
  const reco = (marcadores || [])
    .map((m) => ({ norm: normalizarPalavra(m.palavra), inicio: Number(m.inicio), fim: Number(m.fim) }))
    .filter((m) => m.norm && Number.isFinite(m.inicio) && Number.isFinite(m.fim) && m.fim >= m.inicio);

  const inicios = new Array(tokens.length).fill(null);
  const fins = new Array(tokens.length).fill(null);

  if (reco.length) {
    // LCS (Longest Common Subsequence) entre alvo e reco
    const n = alvo.length;
    const m = reco.length;
    const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        if (alvo[i] && alvo[i] === reco[j].norm) dp[i][j] = dp[i + 1][j + 1] + 1;
        else dp[i][j] = dp[i + 1][j] >= dp[i][j + 1] ? dp[i + 1][j] : dp[i][j + 1];
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (alvo[i] && alvo[i] === reco[j].norm) {
        inicios[i] = reco[j].inicio;
        fins[i] = reco[j].fim;
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        i++;
      } else {
        j++;
      }
    }
  }

  const casadas = inicios.filter((x) => x !== null).length;
  const maxRecoFim = reco.length ? reco[reco.length - 1].fim : 0;
  const duracao = Math.max(Number(duracaoTotal) || 0, maxRecoFim, 0.05 * tokens.length);

  // Interpola lacunas de palavras sem par
  let i = 0;
  while (i < tokens.length) {
    if (inicios[i] !== null) { i++; continue; }
    let j = i;
    while (j < tokens.length && inicios[j] === null) j++;
    const t0 = i > 0 ? fins[i - 1] : 0;
    const t1Raw = j < tokens.length ? inicios[j] : duracao;
    const t1 = Math.max(t1Raw, t0 + 0.05 * (j - i));
    const pesos = [];
    for (let k = i; k < j; k++) pesos.push(Math.max(1, alvo[k].length || 1));
    const soma = pesos.reduce((a, b) => a + b, 0);
    let c = t0;
    for (let k = i; k < j; k++) {
      const d = ((t1 - t0) * pesos[k - i]) / soma;
      inicios[k] = c;
      fins[k] = c + d;
      c += d;
    }
    i = j;
  }

  const palavras = [];
  for (let k = 0; k < tokens.length; k++) {
    let ini = inicios[k];
    let fim = fins[k];
    if (palavras.length && ini < palavras[palavras.length - 1].inicio) {
      ini = palavras[palavras.length - 1].inicio;
    }
    if (fim <= ini) fim = ini + 0.05;
    palavras.push({ palavra: tokens[k], inicio: +ini.toFixed(3), fim: +fim.toFixed(3) });
  }
  for (let k = 0; k < palavras.length - 1; k++) {
    if (palavras[k].fim > palavras[k + 1].inicio) {
      palavras[k].fim = +Math.max(palavras[k].inicio + 0.03, palavras[k + 1].inicio).toFixed(3);
    }
  }
  return {
    palavras,
    casadas,
    cobertura: +(casadas / tokens.length).toFixed(3),
  };
}
