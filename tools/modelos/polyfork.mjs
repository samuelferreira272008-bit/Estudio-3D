// Cliente da API pública e gratuita do Polyfork (https://polyfork.dev/api).
// Modelos low-poly gratuitos não exigem chave; POLYFORK_KEY é opcional para itens pagos da conta.

const BASE_URL = 'https://polyfork.dev';

export function slugSeguro(valor) {
  return String(valor || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

function authHeaders(apiKey) {
  const h = { Accept: 'application/json', 'User-Agent': 'Estudio-3D/1.0' };
  if (apiKey) h.Authorization = `Bearer ${apiKey}`;
  return h;
}

export function normalizarItemPolyfork(raw) {
  const id = String(raw?.id || '').trim();
  const slug = slugSeguro(id);
  const gratis = raw?.free !== false && Number(raw?.price_usd || 0) === 0;
  const glbUrl = raw?.download?.glb || (id ? `${BASE_URL}/cdn/${encodeURIComponent(id)}.glb` : null);
  const auth = raw?.download?.auth || 'none';
  const baixavelSemChave = Boolean(glbUrl) && (auth === 'none' || gratis);

  return {
    chave: `polyfork:${id}`,
    id,
    fonte: 'polyfork',
    fonteLabel: 'Polyfork',
    titulo: raw?.title || id,
    descricao: raw?.description || '',
    categoria: raw?.class || 'prop',
    kit: raw?.kit || null,
    triangulos: Number.isFinite(Number(raw?.triangles)) ? Number(raw.triangles) : null,
    gratis,
    precoUsd: Number(raw?.price_usd || 0),
    baixavelSemChave,
    requerChave: !baixavelSemChave,
    tamanhoM: raw?.size_m || null,
    temRig: Boolean(raw?.has_rig),
    temEsqueleto: Boolean(raw?.has_skeleton),
    thumbnail: raw?.thumbnail || null,
    paginaUrl: raw?.page || `${BASE_URL}/asset/${encodeURIComponent(id)}`,
    glbUrl,
    arquivoSugerido: `assets/modelos/polyfork-${slug}.glb`,
    credito: 'Polyfork',
  };
}

export async function buscarPolyfork({
  q = '',
  apenasGratis = true,
  categoria = '',
  maxTriangulos = 0,
  pagina = 1,
  limite = 18,
  apiKey = process.env.POLYFORK_KEY || '',
} = {}) {
  const params = new URLSearchParams();
  if (q && String(q).trim()) params.set('q', String(q).trim());
  if (apenasGratis) params.set('free', '1');
  if (categoria && String(categoria).trim()) params.set('class', String(categoria).trim());
  if (Number(maxTriangulos) > 0) params.set('max_triangles', String(Math.round(Number(maxTriangulos))));
  params.set('page', String(Math.max(1, Number(pagina) || 1)));
  params.set('per_page', String(Math.min(50, Math.max(1, Number(limite) || 18))));

  const res = await fetch(`${BASE_URL}/api/assets?${params.toString()}`, {
    headers: authHeaders(apiKey),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`Polyfork respondeu HTTP ${res.status} ao buscar modelos.`);
  }
  const json = await res.json();
  const lista = Array.isArray(json.assets) ? json.assets : [];
  const itens = lista.slice(0, Number(limite) || 18).map(normalizarItemPolyfork);
  return {
    total: Number(json.total ?? itens.length),
    itens,
  };
}

export async function detalhesPolyfork(id, apiKey = process.env.POLYFORK_KEY || '') {
  const clean = String(id || '').trim();
  if (!clean) throw new Error('Informe o ID do modelo no Polyfork.');
  const res = await fetch(`${BASE_URL}/api/assets/${encodeURIComponent(clean)}`, {
    headers: authHeaders(apiKey),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`Modelo "${clean}" não encontrado no Polyfork (HTTP ${res.status}).`);
  }
  const raw = await res.json();
  return {
    item: normalizarItemPolyfork(raw),
    raw,
  };
}

export async function baixarGlbPolyfork(id, apiKey = process.env.POLYFORK_KEY || '') {
  const { item } = await detalhesPolyfork(id, apiKey);
  if (!item.glbUrl) {
    throw new Error(`O modelo "${id}" no Polyfork não possui link direto .glb.`);
  }
  const headers = { 'User-Agent': 'Estudio-3D/1.0' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const res = await fetch(item.glbUrl, {
    headers,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error(`O modelo "${id}" exige chave POLYFORK_KEY ou compra na conta Polyfork.`);
    }
    throw new Error(`Falha ao baixar ${item.glbUrl} (HTTP ${res.status}).`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, item };
}
