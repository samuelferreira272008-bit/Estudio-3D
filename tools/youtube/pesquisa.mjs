// Pesquisa de concorrentes/nicho no YouTube e cálculo de "Outlier Ratio".
// Usa YOUTUBE_API_KEY (YouTube Data API v3) se configurada no .env,
// ou busca pública zero-chave no YouTube + extração de padrões de título vencedores.

export function calcularOutlierRatio(views, baseline) {
  const v = Number(views);
  const b = Number(baseline);
  if (!Number.isFinite(v) || !Number.isFinite(b) || b <= 0) return null;
  return Number((v / b).toFixed(2));
}

export function parseContadorYoutube(texto = '') {
  const s = String(texto || '').toLowerCase().replace(/\./g, '').replace(/,/g, '.').trim();
  if (!s) return null;
  const num = parseFloat(s.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(num)) return null;
  if (/(\d|\s)(mi|m)\b|milh/.test(s)) return Math.round(num * 1_000_000);
  if (/\bmil\b|(\d|\s)k\b/.test(s)) return Math.round(num * 1_000);
  return Math.round(num);
}

export function extrairVideosYtInitialData(html) {
  const m = String(html || '').match(/var ytInitialData\s*=\s*(\{[\s\S]*?\});<\/script>/);
  if (!m) return [];
  let data;
  try { data = JSON.parse(m[1]); } catch { return []; }

  const achados = [];
  const visitar = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) visitar(item);
      return;
    }
    if (node.videoRenderer?.videoId) {
      const vr = node.videoRenderer;
      const titulo = vr.title?.runs?.map((r) => r.text).join('') || vr.title?.simpleText || '';
      const canal = vr.ownerText?.runs?.[0]?.text || vr.longBylineText?.runs?.[0]?.text || '';
      const viewsTxt = vr.viewCountText?.simpleText || vr.shortViewCountText?.simpleText || '';
      const duracao = vr.lengthText?.simpleText || '';
      const publicado = vr.publishedTimeText?.simpleText || '';
      const thumb = vr.thumbnail?.thumbnails?.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`;
      achados.push({
        id: vr.videoId,
        titulo,
        canal,
        views: parseContadorYoutube(viewsTxt),
        viewsTexto: viewsTxt,
        duracao,
        publicado,
        url: `https://www.youtube.com/watch?v=${vr.videoId}`,
        thumbnail: thumb,
        tipo: duracao && /^0:[0-5]\d$|^1:00$/.test(duracao) ? 'short' : 'video',
      });
      return;
    }
    if (node.reelItemRenderer?.videoId) {
      const rr = node.reelItemRenderer;
      const titulo = rr.headline?.simpleText || '';
      const viewsTxt = rr.viewCountText?.simpleText || '';
      achados.push({
        id: rr.videoId,
        titulo,
        canal: '',
        views: parseContadorYoutube(viewsTxt),
        viewsTexto: viewsTxt,
        duracao: 'Short',
        publicado: '',
        url: `https://www.youtube.com/shorts/${rr.videoId}`,
        thumbnail: `https://i.ytimg.com/vi/${rr.videoId}/hqdefault.jpg`,
        tipo: 'short',
      });
      return;
    }
    for (const v of Object.values(node)) visitar(v);
  };
  visitar(data);
  const vistos = new Set();
  return achados.filter((v) => {
    if (!v.id || !v.titulo || vistos.has(v.id)) return false;
    vistos.add(v.id);
    return true;
  });
}

export function analisarPadroesTitulos(videos = []) {
  if (!videos.length) {
    return {
      total: 0,
      medianaViews: null,
      mediaCaracteres: 0,
      porcentagemPergunta: 0,
      porcentagemComNumero: 0,
      palavrasFrequentes: [],
      outliers: [],
    };
  }

  const viewsValidos = videos.map((v) => v.views).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  const medianaViews = viewsValidos.length ? viewsValidos[Math.floor(viewsValidos.length / 2)] : null;
  const mediaCaracteres = Math.round(videos.reduce((s, v) => s + v.titulo.length, 0) / videos.length);
  const comPergunta = videos.filter((v) => /\?/.test(v.titulo)).length;
  const comNumero = videos.filter((v) => /\d/.test(v.titulo)).length;

  const stop = new Set([
    'como', 'para', 'por', 'que', 'uma', 'com', 'dos', 'das', 'the', 'how', 'why', 'what',
    'and', 'for', 'with', 'this', 'from', 'your', 'you', 'shorts', 'video',
  ]);
  const freq = new Map();
  for (const v of videos) {
    for (const w of (v.titulo.toLowerCase().match(/[\p{L}0-9]{3,}/gu) || [])) {
      if (stop.has(w)) continue;
      freq.set(w, (freq.get(w) || 0) + 1);
    }
  }
  const palavrasFrequentes = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([palavra, qtd]) => ({ palavra, qtd }));

  const enriquecidos = videos.map((v) => ({
    ...v,
    outlierVsBusca: medianaViews ? calcularOutlierRatio(v.views, medianaViews) : null,
  }));

  const outliers = enriquecidos
    .filter((v) => v.outlierVsBusca !== null && v.outlierVsBusca >= 1.5)
    .sort((a, b) => b.outlierVsBusca - a.outlierVsBusca)
    .slice(0, 5);

  return {
    total: videos.length,
    medianaViews,
    mediaCaracteres,
    porcentagemPergunta: Math.round((comPergunta / videos.length) * 100),
    porcentagemComNumero: Math.round((comNumero / videos.length) * 100),
    palavrasFrequentes,
    outliers,
    videos: enriquecidos,
  };
}

async function pesquisarViaApiOficial(query, limite, apiKey) {
  const sUrl = new URL('https://www.googleapis.com/youtube/v3/search');
  sUrl.searchParams.set('part', 'snippet');
  sUrl.searchParams.set('type', 'video');
  sUrl.searchParams.set('maxResults', String(Math.min(25, Math.max(1, limite))));
  sUrl.searchParams.set('q', query);
  sUrl.searchParams.set('key', apiKey);

  const sr = await fetch(sUrl, { signal: AbortSignal.timeout(15000) });
  if (!sr.ok) throw new Error(`YouTube Data API respondeu HTTP ${sr.status}.`);
  const sj = await sr.json();
  const ids = (sj.items || []).map((i) => i.id?.videoId).filter(Boolean);
  if (!ids.length) return [];

  const vUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
  vUrl.searchParams.set('part', 'snippet,statistics,contentDetails');
  vUrl.searchParams.set('id', ids.join(','));
  vUrl.searchParams.set('key', apiKey);
  const vr = await fetch(vUrl, { signal: AbortSignal.timeout(15000) });
  if (!vr.ok) throw new Error(`YouTube Data API (videos) respondeu HTTP ${vr.status}.`);
  const vj = await vr.json();

  return (vj.items || []).map((it) => ({
    id: it.id,
    titulo: it.snippet?.title || '',
    canal: it.snippet?.channelTitle || '',
    views: Number(it.statistics?.viewCount) || null,
    viewsTexto: it.statistics?.viewCount ? `${Number(it.statistics.viewCount).toLocaleString('pt-BR')} views` : '',
    duracao: it.contentDetails?.duration || '',
    publicado: it.snippet?.publishedAt?.slice(0, 10) || '',
    url: `https://www.youtube.com/watch?v=${it.id}`,
    thumbnail: it.snippet?.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${it.id}/hqdefault.jpg`,
    tipo: 'video',
  }));
}

export async function pesquisarYoutube(query, { limite = 10, apiKey = process.env.YOUTUBE_API_KEY || '' } = {}) {
  const q = String(query || '').trim();
  if (!q) throw new Error('Informe um tema ou palavra-chave para pesquisar no YouTube.');

  let videos = [];
  let modo = 'publico';
  if (apiKey && String(apiKey).trim()) {
    videos = await pesquisarViaApiOficial(q, limite, apiKey.trim());
    modo = 'api_oficial';
  } else {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Busca pública no YouTube respondeu HTTP ${res.status}.`);
    const html = await res.text();
    videos = extrairVideosYtInitialData(html).slice(0, Math.min(25, Math.max(1, Number(limite) || 10)));
  }

  const analise = analisarPadroesTitulos(videos);
  return {
    query: q,
    modo,
    ...analise,
  };
}
