// Servidor estático e API local de voz. Uso: npm run dev (ou npm run preview)
// Também é importado pelo render (tools/render.mjs) com startServer(0) para usar uma porta livre.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gerarNarracao, lerConfigVoz, lerEnv } from './voz/gerar.mjs';
import { listarVozesEdge, VOZES_EDGE_CURADAS, VOZ_EDGE_PADRAO } from './voz/edge.mjs';
import { MODELO_GEMINI_TTS_PADRAO, VOZES_GEMINI, VOZ_GEMINI_PADRAO } from './voz/gemini.mjs';
import { VOZES_GOOGLE, VOZ_GOOGLE_PADRAO } from './voz/google.mjs';
import { listarVozes as listarVozesElevenLabs } from './voz/elevenlabs.mjs';
import {
  baixarModelo, buscarModelos, detalhesModelo, listarModelosLocais,
} from './modelos/catalogo.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
lerEnv(root);

const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
};

const PROVEDORES_VALIDOS = new Set(['edge', 'gemini', 'google', 'kokoro', 'elevenlabs']);
const VOZES_KOKORO = [
  { id: 'pf_dora', nome: 'Dora (BR)', genero: 'Feminina', idioma: 'pt-BR', descricao: 'Preset local Kokoro' },
  { id: 'pm_alex', nome: 'Alex (BR)', genero: 'Masculina', idioma: 'pt-BR', descricao: 'Preset local Kokoro' },
  { id: 'pm_santa', nome: 'Santa (BR)', genero: 'Masculina', idioma: 'pt-BR', descricao: 'Preset local Kokoro' },
];

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

async function readJsonBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 1024 * 1024) throw new Error('Corpo da requisição muito grande.');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : {};
}

function listarProjetos() {
  const dir = path.join(root, 'projects');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .map((d) => {
      const narArq = path.join(dir, d.name, 'narracao.txt');
      const temNar = fs.existsSync(narArq);
      return {
        id: `projects/${d.name}`,
        nome: d.name,
        temNarracao: temNar,
        narracao: temNar ? fs.readFileSync(narArq, 'utf8').trim() : '',
      };
    });
}

async function handleApi(req, res, urlObj) {
  const pathname = urlObj.pathname;

  if (req.method === 'GET' && pathname === '/api/voz/status') {
    lerEnv(root);
    const config = lerConfigVoz(root);
    return sendJson(res, 200, {
      ok: true,
      config,
      disponiveis: {
        edge: true,
        google: true,
        gemini: Boolean(process.env.GEMINI_API_KEY),
        kokoro: fs.existsSync(path.join(root, '.voz', 'venv')),
        elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY),
      },
      projetos: listarProjetos(),
      vozesPadrao: {
        edge: VOZES_EDGE_CURADAS,
        gemini: VOZES_GEMINI,
        google: VOZES_GOOGLE,
        kokoro: VOZES_KOKORO,
      },
    });
  }

  if (req.method === 'GET' && pathname === '/api/voz/vozes') {
    lerEnv(root);
    const provedor = urlObj.searchParams.get('provedor') || 'edge';
    if (provedor === 'edge') return sendJson(res, 200, { ok: true, vozes: await listarVozesEdge(urlObj.searchParams.get('idioma') || 'pt') });
    if (provedor === 'gemini') return sendJson(res, 200, { ok: true, vozes: VOZES_GEMINI });
    if (provedor === 'google') return sendJson(res, 200, { ok: true, vozes: VOZES_GOOGLE });
    if (provedor === 'kokoro') return sendJson(res, 200, { ok: true, vozes: VOZES_KOKORO });
    if (provedor === 'elevenlabs') {
      if (!process.env.ELEVENLABS_API_KEY) return sendJson(res, 400, { ok: false, error: 'Chave ELEVENLABS_API_KEY não definida no .env.' });
      return sendJson(res, 200, { ok: true, vozes: await listarVozesElevenLabs(process.env.ELEVENLABS_API_KEY) });
    }
    return sendJson(res, 400, { ok: false, error: `Provedor inválido: ${provedor}` });
  }

  if (req.method === 'POST' && pathname === '/api/voz/configurar') {
    const body = await readJsonBody(req);
    const provedor = String(body.provedor || '');
    if (!PROVEDORES_VALIDOS.has(provedor)) {
      return sendJson(res, 400, { ok: false, error: `Provedor inválido: "${provedor}".` });
    }
    const cfgArq = path.join(root, 'config', 'voz.json');
    fs.mkdirSync(path.dirname(cfgArq), { recursive: true });
    const atual = lerConfigVoz(root);
    const velocidade = Number(body.velocidade);
    const velOk = Number.isFinite(velocidade) && velocidade >= 0.5 && velocidade <= 2.0 ? velocidade : 1.0;

    let novo = { ...atual, provedor };
    if (provedor === 'edge') {
      novo.edge = { ...atual.edge, voz: body.voz || VOZ_EDGE_PADRAO, velocidade: velOk };
    } else if (provedor === 'gemini') {
      novo.gemini = {
        ...atual.gemini,
        voz: body.voz || VOZ_GEMINI_PADRAO,
        modelo: body.modelo || MODELO_GEMINI_TTS_PADRAO,
        ...(body.estilo ? { estilo: String(body.estilo).trim() } : {}),
        velocidade: velOk,
      };
    } else if (provedor === 'google') {
      novo.google = { ...atual.google, voz: body.voz || VOZ_GOOGLE_PADRAO, velocidade: velOk };
    } else if (provedor === 'kokoro') {
      novo.kokoro = { ...atual.kokoro, voz: body.voz || 'pf_dora', velocidade: velOk };
    } else if (provedor === 'elevenlabs') {
      novo.elevenlabs = { ...atual.elevenlabs, ...(body.voz ? { voiceId: body.voz } : {}), velocidade: velOk };
    }
    fs.writeFileSync(cfgArq, JSON.stringify(novo, null, 2) + '\n');
    return sendJson(res, 200, { ok: true, config: novo });
  }

  if (req.method === 'POST' && pathname === '/api/voz/gerar') {
    const body = await readJsonBody(req);
    const provedor = body.provedor ? String(body.provedor) : undefined;
    if (provedor && !PROVEDORES_VALIDOS.has(provedor)) {
      return sendJson(res, 400, { ok: false, error: `Provedor inválido: "${provedor}".` });
    }
    const projeto = body.projeto && body.projeto !== '_teste-voz' ? String(body.projeto) : 'projects/_teste-voz';
    if (!/^projects\/[a-zA-Z0-9_-]+$/.test(projeto)) {
      return sendJson(res, 400, { ok: false, error: 'Nome de projeto inválido.' });
    }
    const pasta = path.join(root, projeto);
    fs.mkdirSync(pasta, { recursive: true });
    if (typeof body.texto === 'string' && body.texto.trim()) {
      fs.writeFileSync(path.join(pasta, 'narracao.txt'), body.texto.trim() + '\n', 'utf8');
    } else if (!fs.existsSync(path.join(pasta, 'narracao.txt'))) {
      return sendJson(res, 400, { ok: false, error: 'Digite o texto da narração antes de gerar.' });
    }

    const velocidade = body.velocidade !== undefined ? Number(body.velocidade) : undefined;
    const resumo = await gerarNarracao(root, projeto, {
      provedor,
      voz: body.voz ? String(body.voz) : undefined,
      modelo: body.modelo ? String(body.modelo) : undefined,
      estilo: body.estilo ? String(body.estilo) : undefined,
      velocidade: Number.isFinite(velocidade) ? velocidade : undefined,
    });
    const palavras = JSON.parse(fs.readFileSync(path.join(pasta, 'palavras.json'), 'utf8'));
    const frases = JSON.parse(fs.readFileSync(path.join(pasta, 'frases.json'), 'utf8'));
    return sendJson(res, 200, {
      ok: true,
      projeto,
      resumo,
      audioUrl: `/${projeto}/${resumo.audio}?t=${Date.now()}`,
      palavras,
      frases,
    });
  }

  return sendJson(res, 404, { ok: false, error: 'Rota de API não encontrada.' });
}

async function handleModelosApi(req, res, urlObj) {
  const pathname = urlObj.pathname;
  lerEnv(root);

  if (req.method === 'GET' && pathname === '/api/modelos/status') {
    const locais = listarModelosLocais(root);
    return sendJson(res, 200, {
      ok: true,
      locaisTotal: locais.length,
      fontes: {
        polyfork: { nome: 'Polyfork', gratisSemChave: true, chaveConfigurada: Boolean(process.env.POLYFORK_KEY) },
        threejsassets: { nome: 'ThreeJS Assets', catalogoSemChave: true, downloadComChave: Boolean(process.env.TJA_API_KEY) },
      },
    });
  }

  if (req.method === 'GET' && pathname === '/api/modelos/locais') {
    return sendJson(res, 200, { ok: true, modelos: listarModelosLocais(root) });
  }

  if (req.method === 'GET' && pathname === '/api/modelos/buscar') {
    const q = urlObj.searchParams.get('q') || '';
    const fonte = urlObj.searchParams.get('fonte') || 'todas';
    const apenasGratis = urlObj.searchParams.get('gratis') !== '0';
    const maxTriangulos = Number(urlObj.searchParams.get('maxTriangulos')) || 0;
    const limite = Number(urlObj.searchParams.get('limite')) || 18;
    const pagina = Number(urlObj.searchParams.get('pagina')) || 1;
    const resBusca = await buscarModelos({
      root,
      q,
      fonte,
      apenasGratis,
      maxTriangulos,
      limite,
      pagina,
      env: process.env,
    });
    return sendJson(res, 200, { ok: true, ...resBusca });
  }

  if (req.method === 'GET' && pathname === '/api/modelos/detalhes') {
    const spec = urlObj.searchParams.get('id') || '';
    const det = await detalhesModelo(spec, process.env);
    return sendJson(res, 200, { ok: true, item: det.item });
  }

  if (req.method === 'POST' && pathname === '/api/modelos/baixar') {
    const body = await readJsonBody(req);
    const spec = body.chave || (body.fonte && body.id ? `${body.fonte}:${body.id}` : body.id);
    const meta = await baixarModelo(root, spec, process.env);
    return sendJson(res, 200, { ok: true, modelo: meta });
  }

  return sendJson(res, 404, { ok: false, error: 'Rota de modelos não encontrada.' });
}

export function startServer(port = 3000, host = '0.0.0.0') {
  const server = http.createServer((req, res) => {
    const urlObj = new URL(req.url, 'http://x');
    if (urlObj.pathname.startsWith('/api/voz/')) {
      handleApi(req, res, urlObj).catch((err) => {
        sendJson(res, 500, { ok: false, error: err?.message || 'Erro ao processar solicitação de voz.' });
      });
      return;
    }
    if (urlObj.pathname.startsWith('/api/modelos/')) {
      handleModelosApi(req, res, urlObj).catch((err) => {
        sendJson(res, 500, { ok: false, error: err?.message || 'Erro ao consultar modelos 3D.' });
      });
      return;
    }

    let rel = decodeURIComponent(urlObj.pathname);
    // Redireciona (em vez de servir direto) para que os caminhos relativos da página (./main.js) funcionem.
    if (rel === '/' || rel === '/preview') { res.writeHead(302, { Location: '/preview/index.html' }).end(); return; }
    const file = path.resolve(root, '.' + (rel.startsWith('/') ? rel : '/' + rel));
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end('forbidden'); return; }
    // Segredos nunca são servidos.
    if (/(^|[\\/])(\.env|\.voz)([\\/]|$)/.test(path.relative(root, file))) { res.writeHead(403).end('forbidden'); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve({ server, port: server.address().port }));
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '0.0.0.0';
  startServer(port, host)
    .then(({ port: p }) => console.log(`Preview em http://${host}:${p}`))
    .catch((e) => { console.error(e.code === 'EADDRINUSE' ? `A porta ${port} já está em uso (talvez o preview já esteja aberto).` : e.message); process.exit(1); });
}
