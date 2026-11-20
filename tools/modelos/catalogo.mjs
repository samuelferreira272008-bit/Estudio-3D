// Gerenciador unificado de modelos 3D externos (.glb) para o Estúdio 3D:
// busca no Polyfork e no ThreeJS Assets, baixa com validação binária e salva em assets/modelos/.

import fs from 'node:fs';
import path from 'node:path';
import { buscarPolyfork, baixarGlbPolyfork, detalhesPolyfork, slugSeguro } from './polyfork.mjs';
import {
  buscarThreeJsAssets, baixarGlbThreeJsAssets, detalhesThreeJsAssets,
} from './threejsassets.mjs';

export const PASTA_MODELOS = 'assets/modelos';

export function caminhoLocalModelo(fonte, id) {
  const prefixo = fonte === 'threejsassets' ? 'tja' : slugSeguro(fonte) || 'modelo';
  const slug = slugSeguro(id);
  if (!slug) throw new Error('ID de modelo inválido.');
  return `${PASTA_MODELOS}/${prefixo}-${slug}.glb`;
}

export function resolverCaminhoModeloSeguro(root, relPath) {
  const clean = String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!clean || clean.includes('..')) throw new Error(`Caminho de modelo inválido: "${relPath}".`);
  const abs = path.resolve(root, clean);
  const modelosDir = path.resolve(root, PASTA_MODELOS);
  if (abs !== modelosDir && !abs.startsWith(modelosDir + path.sep)) {
    throw new Error(`Os modelos externos devem ficar dentro de ${PASTA_MODELOS}/.`);
  }
  if (!/\.(glb|gltf)$/i.test(abs)) {
    throw new Error('O arquivo do modelo precisa ter extensão .glb ou .gltf.');
  }
  return { abs, rel: path.relative(root, abs).replace(/\\/g, '/') };
}

export function validarArquivoGlb(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 20) {
    throw new Error('Arquivo .glb vazio ou corrompido.');
  }
  const magic = buffer.toString('ascii', 0, 4);
  if (magic !== 'glTF') {
    throw new Error(`O arquivo baixado não é um .glb binário válido (assinatura "${magic}").`);
  }
  const versao = buffer.readUInt32LE(4);
  const totalLength = buffer.readUInt32LE(8);
  const info = { versao, totalLength, meshes: 0, animacoes: [] };

  // Lê o primeiro chunk JSON do GLB para extrair metadados reais sem precisar de DOM/WebGL.
  if (buffer.length >= 20) {
    const chunkLen = buffer.readUInt32LE(12);
    const chunkType = buffer.toString('ascii', 16, 20);
    if (chunkType === 'JSON' && 20 + chunkLen <= buffer.length) {
      try {
        const json = JSON.parse(buffer.toString('utf8', 20, 20 + chunkLen));
        info.meshes = Array.isArray(json.meshes) ? json.meshes.length : 0;
        info.animacoes = Array.isArray(json.animations)
          ? json.animations.map((a, idx) => a?.name || `Animacao_${idx + 1}`)
          : [];
        if (json.asset?.generator) info.gerador = String(json.asset.generator);
      } catch { /* JSON chunk opcional */ }
    }
  }
  return info;
}

export function calcularEscalaNormalizada(rawSize, { altura, escala } = {}) {
  const sx = Number(rawSize?.x) || 0;
  const sy = Number(rawSize?.y) || 0;
  const sz = Number(rawSize?.z) || 0;
  const fatorAltura = Number(altura) > 0 && sy > 1e-5 ? Number(altura) / sy : 1;
  const fatorEscala = Number(escala) > 0 ? Number(escala) : 1;
  const factor = fatorAltura * fatorEscala;
  return {
    factor,
    size: {
      x: sx * factor,
      y: sy * factor,
      z: sz * factor,
    },
  };
}

export function snippetStoryboard(caminho, item = {}) {
  const idBase = slugSeguro(item.id || path.basename(caminho, path.extname(caminho))).replace(/-/g, '_').slice(0, 24) || 'modelo_3d';
  const obj = {
    id: idBase,
    modelo: caminho,
    pos: [0, 0],
    giro: 0,
  };
  if (item.tamanhoM?.y && item.tamanhoM.y > 0) {
    obj.altura = Number(item.tamanhoM.y.toFixed(2));
  } else {
    obj.escala = 1;
  }
  return obj;
}

export function parseSpecModelo(spec) {
  if (spec && typeof spec === 'object') {
    return { fonte: String(spec.fonte || '').toLowerCase(), id: String(spec.id || '').trim() };
  }
  const s = String(spec || '').trim();
  const idx = s.indexOf(':');
  if (idx > 0) {
    return { fonte: s.slice(0, idx).toLowerCase(), id: s.slice(idx + 1).trim() };
  }
  return { fonte: 'polyfork', id: s };
}

export function listarModelosLocais(root) {
  const dir = path.join(root, PASTA_MODELOS);
  if (!fs.existsSync(dir)) return [];
  const arquivos = fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && /\.(glb|gltf)$/i.test(d.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  return arquivos.map((d) => {
    const abs = path.join(dir, d.name);
    const rel = `${PASTA_MODELOS}/${d.name}`;
    const stat = fs.statSync(abs);
    const metaArq = abs.replace(/\.(glb|gltf)$/i, '.meta.json');
    let meta = {};
    if (fs.existsSync(metaArq)) {
      try { meta = JSON.parse(fs.readFileSync(metaArq, 'utf8')); } catch { meta = {}; }
    }
    return {
      arquivo: d.name,
      caminho: rel,
      tamanhoBytes: stat.size,
      modificadoEm: stat.mtime.toISOString(),
      fonte: meta.fonte || 'local',
      fonteLabel: meta.fonteLabel || 'Local',
      id: meta.id || path.basename(d.name, path.extname(d.name)),
      chave: meta.chave || `local:${d.name}`,
      titulo: meta.titulo || path.basename(d.name, path.extname(d.name)),
      categoria: meta.categoria || 'prop',
      triangulos: meta.triangulos ?? null,
      tamanhoM: meta.tamanhoM || null,
      animacoes: Array.isArray(meta.animacoes) ? meta.animacoes : [],
      thumbnail: meta.thumbnail || null,
      paginaUrl: meta.paginaUrl || null,
      credito: meta.credito || '',
      local: true,
      caminhoLocal: rel,
      snippet: snippetStoryboard(rel, meta),
    };
  });
}

export async function buscarModelos({
  root,
  q = '',
  fonte = 'todas',
  apenasGratis = true,
  maxTriangulos = 0,
  limite = 18,
  pagina = 1,
  env = process.env,
} = {}) {
  const locais = root ? listarModelosLocais(root) : [];
  const locaisPorChave = new Map(locais.map((l) => [l.chave, l.caminho]));
  const locaisPorCaminho = new Set(locais.map((l) => l.caminho));

  const fonteNorm = String(fonte || 'todas').toLowerCase();
  if (fonteNorm === 'local' || fonteNorm === 'locais') {
    const qLow = String(q || '').trim().toLowerCase();
    const filtrados = qLow
      ? locais.filter((l) => `${l.titulo} ${l.id} ${l.categoria}`.toLowerCase().includes(qLow))
      : locais;
    return { itens: filtrados, avisos: [], totalPorFonte: { local: filtrados.length } };
  }

  const queries = [];
  const usarPolyfork = fonteNorm === 'todas' || fonteNorm === 'polyfork';
  const usarTja = fonteNorm === 'todas' || fonteNorm === 'threejsassets' || fonteNorm === 'tja';
  const limitePorFonte = fonteNorm === 'todas' ? Math.max(6, Math.ceil(Number(limite) / 2)) : Number(limite) || 18;

  if (usarPolyfork) {
    queries.push(
      buscarPolyfork({
        q,
        apenasGratis,
        maxTriangulos,
        pagina,
        limite: limitePorFonte,
        apiKey: env.POLYFORK_KEY || '',
      }).then((r) => ({ fonte: 'polyfork', ...r })),
    );
  }
  if (usarTja) {
    queries.push(
      buscarThreeJsAssets({
        q,
        apenasGratis,
        limite: limitePorFonte,
        offset: ((Number(pagina) || 1) - 1) * limitePorFonte,
        apiKey: env.TJA_API_KEY || '',
      }).then((r) => ({ fonte: 'threejsassets', ...r })),
    );
  }

  const results = await Promise.allSettled(queries);
  const avisos = [];
  const buckets = [];
  const totalPorFonte = {};

  for (const r of results) {
    if (r.status === 'fulfilled') {
      totalPorFonte[r.value.fonte] = r.value.total;
      buckets.push(r.value.itens);
    } else {
      avisos.push(r.reason?.message || 'Falha ao consultar uma fonte de modelos.');
    }
  }

  // Intercala resultados das fontes para que ambas fiquem visíveis logo no topo.
  const intercalados = [];
  const maxLen = buckets.reduce((m, b) => Math.max(m, b.length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const b of buckets) if (b[i]) intercalados.push(b[i]);
  }

  const filtradosMax = Number(maxTriangulos) > 0
    ? intercalados.filter((it) => !it.triangulos || it.triangulos <= Number(maxTriangulos))
    : intercalados;

  const itens = filtradosMax.slice(0, Number(limite) || 18).map((it) => {
    const caminhoLocal = locaisPorChave.get(it.chave)
      || (locaisPorCaminho.has(it.arquivoSugerido) ? it.arquivoSugerido : null);
    return {
      ...it,
      local: Boolean(caminhoLocal),
      caminhoLocal,
      snippet: snippetStoryboard(caminhoLocal || it.arquivoSugerido, it),
    };
  });

  return { itens, avisos, totalPorFonte };
}

export async function detalhesModelo(spec, env = process.env) {
  const { fonte, id } = parseSpecModelo(spec);
  if (fonte === 'threejsassets' || fonte === 'tja') {
    return detalhesThreeJsAssets(id, env.TJA_API_KEY || '');
  }
  if (fonte === 'polyfork') {
    return detalhesPolyfork(id, env.POLYFORK_KEY || '');
  }
  throw new Error(`Fonte desconhecida: "${fonte}". Use polyfork:<id> ou threejsassets:<slug>.`);
}

export async function baixarModelo(root, spec, env = process.env) {
  const { fonte, id } = parseSpecModelo(spec);
  if (!id) throw new Error('Informe o modelo no formato polyfork:<id> ou threejsassets:<slug>.');

  let downloaded;
  if (fonte === 'polyfork') {
    downloaded = await baixarGlbPolyfork(id, env.POLYFORK_KEY || '');
  } else if (fonte === 'threejsassets' || fonte === 'tja') {
    downloaded = await baixarGlbThreeJsAssets(id, env.TJA_API_KEY || '');
  } else {
    throw new Error(`Fonte desconhecida: "${fonte}". Use polyfork:<id> ou threejsassets:<slug>.`);
  }

  const glbInfo = validarArquivoGlb(downloaded.buffer);
  const relSugerido = caminhoLocalModelo(downloaded.item.fonte, downloaded.item.id);
  const { abs, rel } = resolverCaminhoModeloSeguro(root, relSugerido);

  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, downloaded.buffer);

  const meta = {
    ...downloaded.item,
    caminho: rel,
    tamanhoBytes: downloaded.buffer.length,
    meshes: glbInfo.meshes,
    animacoes: glbInfo.animacoes,
    baixadoEm: new Date().toISOString(),
  };
  fs.writeFileSync(abs.replace(/\.(glb|gltf)$/i, '.meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');

  return {
    ...meta,
    local: true,
    caminhoLocal: rel,
    snippet: snippetStoryboard(rel, meta),
  };
}
