// Browser e importador de modelos 3D (.glb) do Polyfork e ThreeJS Assets para o Estúdio 3D.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { makePreset } from '../assets/index.js';

const $ = (id) => document.getElementById(id);

const statusEl = $('status-modelos');
const feedbackEl = $('feedback-modelos');
const resultadosEl = $('resultados');
const qtdLocaisEl = $('qtd-locais');

const formEl = $('form-busca');
const qEl = $('q');
const fonteEl = $('fonte');
const maxTriEl = $('max-tri');
const gratisEl = $('gratis');
const btnBuscar = $('btn-buscar');
const btnLocais = $('btn-locais');

const canvas = $('visor-3d');
const visorVazioEl = $('visor-vazio');
const viewerTituloEl = $('viewer-titulo');
const modeloDetalhesEl = $('modelo-detalhes');
const mostrarRefEl = $('mostrar-ref');
const btnCam = $('btn-cam');
const animBarEl = $('anim-bar');
const animClipEl = $('anim-clip');
const btnAnimPlay = $('btn-anim-play');
const snippetBoxEl = $('snippet-box');
const alturaEl = $('altura-desejada');
const snippetCodeEl = $('snippet-code');
const btnCopiar = $('btn-copiar');

let modeloAtual = null;
let rawSizeAtual = null;
let mixerAtual = null;
let animTocando = true;
let clipsAtual = [];
let precisaRender = true;

function setFeedback(msg, tipo = 'info') {
  feedbackEl.textContent = msg;
  feedbackEl.className = `feedback ${tipo}`;
}

function fmtBytes(b) {
  if (!Number.isFinite(b) || b <= 0) return '';
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDims(m) {
  if (!m) return '';
  return `${Number(m.x).toFixed(2)}×${Number(m.y).toFixed(2)}×${Number(m.z).toFixed(2)} m`;
}

// ---------- Visor Three.js ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
const gl = renderer.getContext();
const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
const glRendererStr = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '') : '';
const isSoftwareGl = /swiftshader|llvmpipe|software/i.test(glRendererStr);

renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = !isSoftwareGl;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#9fd3f2');

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.36;

const camera = new THREE.PerspectiveCamera(38, 4 / 3, 0.05, 500);
camera.position.set(4, 2.5, 5);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = !isSoftwareGl;
controls.addEventListener('change', () => { precisaRender = true; });

const hemi = new THREE.HemisphereLight('#d9f0ff', '#7aa356', 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff8e6', 2.0);
sun.position.set(8, 14, 9);
sun.castShadow = !isSoftwareGl;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 });
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(28, 40),
  new THREE.MeshStandardMaterial({ color: '#9fc977', roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.005;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(16, 16, '#5c7c40', '#7ea958');
grid.position.y = 0.002;
scene.add(grid);

const refChar = makePreset('construtor');
refChar.root.position.set(-2.2, 0, 0);
refChar.root.rotation.y = 0.35;
scene.add(refChar.root);

const modeloHolder = new THREE.Group();
scene.add(modeloHolder);

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/node_modules/three/examples/jsm/libs/draco/gltf/');
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

function resizeVisor() {
  const rect = canvas.parentElement.getBoundingClientRect();
  const w = Math.max(240, Math.round(rect.width));
  const h = Math.max(200, Math.round(rect.height));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  precisaRender = true;
}
new ResizeObserver(resizeVisor).observe(canvas.parentElement);
resizeVisor();

function enquadrarVisor() {
  if (!modeloHolder.children.length) {
    camera.position.set(3.5, 2.2, 4.5);
    controls.target.set(0, 0.9, 0);
    controls.update();
    precisaRender = true;
    return;
  }
  const box = new THREE.Box3().setFromObject(modeloHolder);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.8);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const dist = (maxDim / 2) / Math.tan(fov / 2) * 1.9;
  camera.position.set(center.x + dist * 0.65, center.y + dist * 0.42, center.z + dist * 0.82);
  controls.target.copy(center);
  controls.update();
  precisaRender = true;
}

btnCam.onclick = enquadrarVisor;
mostrarRefEl.onchange = () => {
  if (modeloHolder.children.length && rawSizeAtual) {
    const box = new THREE.Box3().setFromObject(modeloHolder);
    const size = box.getSize(new THREE.Vector3());
    refChar.root.position.set(-Math.max(1.2, size.x / 2 + 0.9), 0, 0);
  }
  refChar.root.visible = mostrarRefEl.checked;
  precisaRender = true;
};

function atualizarSnippet() {
  if (!modeloAtual) {
    snippetBoxEl.hidden = true;
    return;
  }
  const caminho = modeloAtual.caminhoLocal || modeloAtual.caminho || modeloAtual.arquivoSugerido;
  const baseId = String(modeloAtual.id || 'modelo_3d')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24) || 'modelo_3d';
  const alt = Number(alturaEl.value);
  const obj = {
    id: baseId,
    modelo: caminho,
    pos: [0, 0],
    giro: 0,
  };
  if (Number.isFinite(alt) && alt > 0) obj.altura = Number(alt.toFixed(2));
  if (clipsAtual.length) obj.animClip = animClipEl.value || clipsAtual[0].name;
  snippetCodeEl.textContent = JSON.stringify(obj, null, 2);
  snippetBoxEl.hidden = false;
}

alturaEl.oninput = () => {
  if (!modeloHolder.children.length || !rawSizeAtual) return;
  const alt = Number(alturaEl.value);
  if (Number.isFinite(alt) && alt > 0 && rawSizeAtual.y > 1e-5) {
    const fator = alt / rawSizeAtual.y;
    modeloHolder.scale.setScalar(fator);
    const scaledX = rawSizeAtual.x * fator;
    refChar.root.position.set(-Math.max(1.1, scaledX / 2 + 0.9), 0, 0);
    precisaRender = true;
  }
  atualizarSnippet();
};

animClipEl.onchange = () => {
  if (!mixerAtual || !clipsAtual.length) return;
  mixerAtual.stopAllAction();
  const clip = THREE.AnimationClip.findByName(clipsAtual, animClipEl.value) || clipsAtual[0];
  if (clip) mixerAtual.clipAction(clip).play();
  precisaRender = true;
  atualizarSnippet();
};

btnAnimPlay.onclick = () => {
  animTocando = !animTocando;
  btnAnimPlay.textContent = animTocando ? 'Pausar' : 'Tocar';
  precisaRender = true;
};

btnCopiar.onclick = async () => {
  try {
    await navigator.clipboard.writeText(snippetCodeEl.textContent);
    setFeedback('JSON copiado para a área de transferência.', 'ok');
  } catch {
    setFeedback('Não foi possível acessar a área de transferência; copie o JSON manualmente.', 'info');
  }
};

async function carregarNoVisor(item) {
  const caminho = item.caminhoLocal || item.caminho;
  if (!caminho) throw new Error('Modelo ainda não baixado localmente.');
  setFeedback(`Carregando ${item.titulo} no visor 3D...`, 'info');
  const url = `/${caminho.replace(/^\/+/, '')}?t=${Date.now()}`;
  const gltf = await gltfLoader.loadAsync(url);

  modeloHolder.clear();
  modeloHolder.scale.setScalar(1);
  mixerAtual = null;
  clipsAtual = gltf.animations || [];

  const rootObj = gltf.scene;
  rootObj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(rootObj);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  rootObj.position.set(-center.x, -box.min.y, -center.z);
  rootObj.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = !isSoftwareGl;
      m.receiveShadow = !isSoftwareGl;
    }
  });
  modeloHolder.add(rootObj);

  modeloAtual = item;
  rawSizeAtual = size.clone();
  visorVazioEl.hidden = true;
  viewerTituloEl.textContent = item.titulo || caminho;
  alturaEl.value = size.y > 0 ? Number(size.y.toFixed(2)) : 2;

  refChar.root.visible = mostrarRefEl.checked;
  refChar.root.position.set(-Math.max(1.1, size.x / 2 + 0.9), 0, 0);

  if (clipsAtual.length) {
    animClipEl.innerHTML = '';
    clipsAtual.forEach((c, idx) => animClipEl.add(new Option(c.name || `Animação ${idx + 1}`, c.name)));
    mixerAtual = new THREE.AnimationMixer(rootObj);
    mixerAtual.clipAction(clipsAtual[0]).play();
    animTocando = true;
    btnAnimPlay.textContent = 'Pausar';
    animBarEl.hidden = false;
  } else {
    animBarEl.hidden = true;
  }

  const tri = item.triangulos ? ` · ${item.triangulos.toLocaleString('pt-BR')} triângulos` : '';
  const bytes = item.tamanhoBytes ? ` · ${fmtBytes(item.tamanhoBytes)}` : '';
  const animTxt = clipsAtual.length ? ` · ${clipsAtual.length} animação(ões) GLB` : '';
  modeloDetalhesEl.innerHTML = `<b>Arquivo:</b> <code>${caminho}</code> · <b>Dimensões originais:</b> ${fmtDims(size)}${tri}${bytes}${animTxt}`;
  atualizarSnippet();
  enquadrarVisor();
  setFeedback(`Modelo "${item.titulo}" pronto para usar no storyboard.`, 'ok');
}

// ---------- Loop de renderização ----------
let ultimoTempo = performance.now();
function loop() {
  const agora = performance.now();
  const dt = Math.min(0.05, (agora - ultimoTempo) / 1000);
  ultimoTempo = agora;

  if (controls.enableDamping) controls.update();
  if (mixerAtual && animTocando) {
    mixerAtual.update(dt);
    precisaRender = true;
  }
  if (precisaRender) {
    renderer.render(scene, camera);
    precisaRender = false;
  }
  requestAnimationFrame(loop);
}
loop();

// ---------- Busca e download ----------
async function atualizarStatus() {
  const res = await fetch('/api/modelos/status');
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || 'Falha ao consultar fontes.');
  qtdLocaisEl.textContent = String(data.locaisTotal || 0);
  const tjaMsg = data.fontes?.threejsassets?.downloadComChave
    ? 'ThreeJS Assets: chave TJA_API_KEY ativa'
    : 'ThreeJS Assets: catálogo público (download direto exige TJA_API_KEY no .env)';
  statusEl.textContent = `Polyfork: download .glb grátis sem chave · ${tjaMsg} · ${data.locaisTotal || 0} salvo(s) localmente.`;
}

function criarCard(item) {
  const card = document.createElement('article');
  card.className = 'modelo-card';

  const thumb = document.createElement('div');
  thumb.className = 'modelo-thumb';
  if (item.thumbnail) {
    const img = document.createElement('img');
    img.src = item.thumbnail;
    img.alt = item.titulo;
    img.loading = 'lazy';
    thumb.appendChild(img);
  } else {
    const ph = document.createElement('div');
    ph.className = 'modelo-thumb-ph';
    ph.textContent = item.local ? 'GLB LOCAL' : '3D';
    thumb.appendChild(ph);
  }
  card.appendChild(thumb);

  const info = document.createElement('div');
  info.className = 'modelo-info';

  const titulo = document.createElement('h3');
  titulo.textContent = item.titulo;
  info.appendChild(titulo);

  const meta = document.createElement('p');
  meta.className = 'modelo-meta';
  const partes = [
    item.credito || item.fonteLabel,
    item.categoria,
    item.triangulos ? `${item.triangulos.toLocaleString('pt-BR')} tri` : null,
    item.tamanhoM ? fmtDims(item.tamanhoM) : null,
    item.tamanhoBytes ? fmtBytes(item.tamanhoBytes) : null,
  ].filter(Boolean);
  meta.textContent = partes.join(' · ');
  info.appendChild(meta);

  const acoes = document.createElement('div');
  acoes.className = 'modelo-acoes';

  if (item.local || item.baixavelSemChave || item.autorizadoDownload) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = item.local ? 'btn-secondary' : 'btn-primary';
    btn.textContent = item.local ? 'Visualizar 3D' : 'Baixar e ver 3D';
    btn.onclick = async () => {
      btn.disabled = true;
      try {
        let pronto = item;
        if (!item.local) {
          setFeedback(`Baixando ${item.titulo} para assets/modelos/...`, 'info');
          const r = await fetch('/api/modelos/baixar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chave: item.chave }),
          });
          const data = await r.json();
          if (!r.ok || !data.ok) throw new Error(data.error || 'Erro ao baixar modelo.');
          pronto = data.modelo;
          item.local = true;
          item.caminhoLocal = pronto.caminhoLocal;
          btn.className = 'btn-secondary';
          btn.textContent = 'Visualizar 3D';
          atualizarStatus().catch(() => {});
        }
        await carregarNoVisor(pronto);
      } catch (err) {
        setFeedback(err?.message || String(err), 'erro');
      } finally {
        btn.disabled = false;
      }
    };
    acoes.appendChild(btn);
  } else {
    const nota = document.createElement('span');
    nota.className = 'modelo-aviso-chave';
    nota.textContent = item.gratis ? 'Grátis (exige TJA_API_KEY no .env)' : 'Premium no ThreeJS Assets';
    acoes.appendChild(nota);
  }

  if (item.paginaUrl) {
    const link = document.createElement('a');
    link.href = item.paginaUrl;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.className = 'btn-link';
    link.textContent = 'Site';
    acoes.appendChild(link);
  }

  info.appendChild(acoes);
  card.appendChild(info);
  return card;
}

async function executarBusca() {
  btnBuscar.disabled = true;
  setFeedback('Buscando modelos 3D...', 'info');
  try {
    const params = new URLSearchParams({
      q: qEl.value.trim(),
      fonte: fonteEl.value,
      gratis: gratisEl.checked ? '1' : '0',
      maxTriangulos: maxTriEl.value,
      limite: '16',
    });
    const r = await fetch(`/api/modelos/buscar?${params.toString()}`);
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || 'Erro ao buscar modelos.');

    resultadosEl.innerHTML = '';
    if (!data.itens.length) {
      resultadosEl.innerHTML = '<p class="muted">Nenhum modelo encontrado para esse filtro. Tente outro termo em inglês (ex.: truck, tree, building, chair).</p>';
    } else {
      for (const it of data.itens) resultadosEl.appendChild(criarCard(it));
    }

    const avisoTxt = data.avisos?.length ? ` (${data.avisos.join('; ')})` : '';
    setFeedback(`${data.itens.length} modelo(s) exibido(s).${avisoTxt}`, data.avisos?.length ? 'info' : 'ok');
  } catch (err) {
    setFeedback(err?.message || String(err), 'erro');
  } finally {
    btnBuscar.disabled = false;
  }
}

formEl.onsubmit = (e) => {
  e.preventDefault();
  executarBusca();
};

fonteEl.onchange = executarBusca;
maxTriEl.onchange = executarBusca;
gratisEl.onchange = executarBusca;

btnLocais.onclick = () => {
  fonteEl.value = 'local';
  executarBusca();
};

await atualizarStatus().catch((e) => setFeedback(e.message, 'erro'));
await executarBusca();
window.__ready = true;
