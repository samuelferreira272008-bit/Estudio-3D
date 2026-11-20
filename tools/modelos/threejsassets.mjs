// Cliente da API do Three.js Assets (https://threejsassets.com/api/v1).
// O catálogo público (/v1/catalog/assets) funciona sem chave.
// O download direto de arquivos .glb (/v1/assets/:slug/download) usa TJA_API_KEY opcional no .env.

import { slugSeguro } from './polyfork.mjs';

const BASE_URL = 'https://threejsassets.com/api/v1';

export function normalizarItemThreeJsAssets(raw, temChave = false) {
  const id = String(raw?.slug || raw?.id || '').trim();
  const slug = slugSeguro(id);
  const tier = String(raw?.tier || 'free').toLowerCase();
  const gratis = tier === 'free';
  const entitled = typeof raw?.entitled === 'boolean' ? raw.entitled : (temChave && gratis);
  const podeBaixar = temChave && (entitled || gratis);

  return {
    chave: `threejsassets:${id}`,
    id,
    fonte: 'threejsassets',
    fonteLabel: 'ThreeJS Assets',
    titulo: raw?.name || id,
    descricao: raw?.description || '',
    categoria: raw?.category || 'props',
    kit: raw?.pack_slug || null,
    triangulos: Number.isFinite(Number(raw?.triangles)) ? Number(raw.triangles) : null,
    tamanhoBytes: Number.isFinite(Number(raw?.file_size_bytes)) ? Number(raw.file_size_bytes) : null,
    gratis,
    tier,
    baixavelSemChave: false,
    requerChave: !temChave,
    autorizadoDownload: podeBaixar,
    tamanhoM: null,
    temRig: false,
    temEsqueleto: false,
    thumbnail: raw?.poster_url || null,
    paginaUrl: raw?.url || `https://threejsassets.com/assets/${encodeURIComponent(id)}`,
    glbUrl: raw?.download_url || (temChave ? `${BASE_URL}/assets/${encodeURIComponent(id)}/download?edition=glb` : null),
    arquivoSugerido: `assets/modelos/tja-${slug}.glb`,
    credito: 'by ThreeJS Assets',
  };
}

export async function buscarThreeJsAssets({
  q = '',
  apenasGratis = true,
  categoria = '',
  limite = 18,
  offset = 0,
  apiKey = process.env.TJA_API_KEY || '',
} = {}) {
  const temChave = Boolean(apiKey && String(apiKey).trim());
  const params = new URLSearchParams();
  if (q && String(q).trim()) params.set('q', String(q).trim());
  if (categoria && String(categoria).trim()) params.set('category', String(categoria).trim());
  // Quando filtrando grátis no catálogo público, pedimos mais itens para não retornar página vazia.
  const pedir = apenasGratis && !temChave ? Math.min(100, Math.max(40, (Number(limite) || 18) * 3)) : Math.min(100, Math.max(1, Number(limite) || 18));
  params.set('limit', String(pedir));
  params.set('offset', String(Math.max(0, Number(offset) || 0)));

  const endpoint = temChave ? `${BASE_URL}/assets` : `${BASE_URL}/catalog/assets`;
  if (temChave) params.set('owned', 'all');

  const headers = { Accept: 'application/json', 'User-Agent': 'Estudio-3D/1.0' };
  if (temChave) headers.Authorization = `Bearer ${apiKey}`;

  const res = await fetch(`${endpoint}?${params.toString()}`, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`ThreeJS Assets respondeu HTTP ${res.status} ao buscar catálogo.`);
  }
  const json = await res.json();
  let lista = Array.isArray(json.data) ? json.data : [];
  if (apenasGratis) {
    lista = lista.filter((item) => String(item?.tier || '').toLowerCase() === 'free' || item?.entitled === true);
  }
  const itens = lista.slice(0, Number(limite) || 18).map((raw) => normalizarItemThreeJsAssets(raw, temChave));
  return {
    total: Number(json.pagination?.total ?? itens.length),
    itens,
  };
}

export async function detalhesThreeJsAssets(slug, apiKey = process.env.TJA_API_KEY || '') {
  const clean = String(slug || '').trim();
  if (!clean) throw new Error('Informe o slug do modelo no ThreeJS Assets.');
  const temChave = Boolean(apiKey && String(apiKey).trim());
  const res = await fetch(`${BASE_URL}/catalog/assets/${encodeURIComponent(clean)}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'Estudio-3D/1.0' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`Modelo "${clean}" não encontrado no ThreeJS Assets (HTTP ${res.status}).`);
  }
  const json = await res.json();
  const raw = json.data || json;
  return {
    item: normalizarItemThreeJsAssets(raw, temChave),
    raw,
  };
}

export async function baixarGlbThreeJsAssets(slug, apiKey = process.env.TJA_API_KEY || '') {
  const clean = String(slug || '').trim();
  if (!apiKey || !String(apiKey).trim()) {
    throw new Error(
      `O download direto do ThreeJS Assets requer a chave TJA_API_KEY no arquivo .env (ou nas Secrets do servidor). Para baixar modelos 3D 100% grátis sem chave, use a fonte Polyfork.`,
    );
  }
  const { item } = await detalhesThreeJsAssets(clean, apiKey);
  const url = `${BASE_URL}/assets/${encodeURIComponent(clean)}/download?edition=glb`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'User-Agent': 'Estudio-3D/1.0',
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    let detalhe = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson?.error?.message) detalhe = errJson.error.message;
    } catch { /* resposta não JSON */ }
    throw new Error(`Não foi possível baixar "${clean}" no ThreeJS Assets: ${detalhe}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, item };
}
