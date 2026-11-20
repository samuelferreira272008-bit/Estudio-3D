// Interface interativa para testar e configurar APIs gratuitas de voz (Edge TTS, Gemini TTS, Google TTS) e locais/pagas.

const $ = (id) => document.getElementById(id);

let statusData = null;
let palavrasAtuais = [];
let projetosMap = new Map();

function setFeedback(msg, tipo = 'info') {
  const el = $('feedback');
  el.textContent = msg;
  el.className = `feedback ${tipo}`;
}

function atualizarVisibilidadeGemini() {
  $('gemini-opts').hidden = $('provedor').value !== 'gemini';
}

function renderPalavras(palavras) {
  palavrasAtuais = palavras || [];
  const box = $('palavras-box');
  box.innerHTML = '';
  if (!palavrasAtuais.length) {
    box.innerHTML = '<span class="muted">As palavras sincronizadas aparecerão aqui.</span>';
    return;
  }
  palavrasAtuais.forEach((w, idx) => {
    const span = document.createElement('span');
    span.className = 'palavra-chip';
    span.dataset.idx = String(idx);
    span.title = `${w.inicio.toFixed(2)}s – ${w.fim.toFixed(2)}s`;
    span.textContent = w.palavra;
    span.onclick = () => {
      const audio = $('player');
      if (audio.src) {
        audio.currentTime = w.inicio;
        audio.play().catch(() => {});
      }
    };
    box.appendChild(span);
  });
}

function renderFrases(frases) {
  const ol = $('frases-lista');
  ol.innerHTML = '';
  for (const f of frases || []) {
    const li = document.createElement('li');
    li.innerHTML = `<b>${f.inicio.toFixed(2)}s – ${f.fim.toFixed(2)}s</b> · ${escapeHtml(f.texto)}`;
    ol.appendChild(li);
  }
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function carregarVozes(provedor, vozPreferida) {
  const sel = $('voz');
  sel.innerHTML = '<option value="">Carregando vozes...</option>';
  try {
    const r = await fetch(`/api/voz/vozes?provedor=${encodeURIComponent(provedor)}`);
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || 'Falha ao listar vozes.');
    sel.innerHTML = '';
    for (const v of data.vozes) {
      const opt = new Option(`${v.nome}${v.genero ? ` (${v.genero})` : ''}`, v.id);
      sel.add(opt);
    }
    if (vozPreferida && [...sel.options].some((o) => o.value === vozPreferida)) {
      sel.value = vozPreferida;
    }
  } catch (e) {
    sel.innerHTML = '';
    const fallback = statusData?.vozesPadrao?.[provedor] || [];
    for (const v of fallback) sel.add(new Option(v.nome, v.id));
    if (!fallback.length) sel.add(new Option('Nenhuma voz disponível', ''));
    setFeedback(e.message, 'erro');
  }
}

function atualizarStatusTexto() {
  if (!statusData) return;
  const d = statusData.disponiveis;
  const cfg = statusData.config || {};
  const ativo = cfg.provedor ? `Padrão atual: ${cfg.provedor}` : 'Nenhum padrão salvo (Edge TTS pronto para uso)';
  const geminiBadge = d.gemini ? 'Gemini TTS pronto' : 'Gemini TTS aguarda GEMINI_API_KEY';
  $('status-geral').textContent = `${ativo} · Edge TTS e Google TTS prontos sem chave · ${geminiBadge}`;
}

async function carregarStatus() {
  const r = await fetch('/api/voz/status');
  const data = await r.json();
  if (!r.ok || !data.ok) throw new Error(data.error || 'Erro ao carregar status de voz.');
  statusData = data;
  atualizarStatusTexto();

  const projSel = $('projeto');
  projSel.innerHTML = '<option value="_teste-voz">Teste rápido (projects/_teste-voz)</option>';
  projetosMap.clear();
  for (const p of data.projetos || []) {
    projetosMap.set(p.id, p);
    projSel.add(new Option(`Projeto: ${p.nome}`, p.id));
  }

  const provedorInicial = data.config?.provedor || 'edge';
  $('provedor').value = provedorInicial;
  atualizarVisibilidadeGemini();

  const cfgProv = data.config?.[provedorInicial] || {};
  if (cfgProv.velocidade) {
    $('velocidade').value = String(cfgProv.velocidade);
    $('vel-val').textContent = `${Number(cfgProv.velocidade).toFixed(2)}×`;
  }
  if (cfgProv.modelo) $('modelo').value = cfgProv.modelo;
  if (cfgProv.estilo) $('estilo').value = cfgProv.estilo;
  await carregarVozes(provedorInicial, cfgProv.voz || cfgProv.voiceId);
}

$('provedor').onchange = async () => {
  setFeedback('');
  atualizarVisibilidadeGemini();
  const p = $('provedor').value;
  const cfgProv = statusData?.config?.[p] || {};
  await carregarVozes(p, cfgProv.voz || cfgProv.voiceId);
};

$('velocidade').oninput = () => {
  $('vel-val').textContent = `${Number($('velocidade').value).toFixed(2)}×`;
};

$('projeto').onchange = () => {
  const p = projetosMap.get($('projeto').value);
  if (p?.narracao) $('texto').value = p.narracao;
};

$('gerar').onclick = async () => {
  const texto = $('texto').value.trim();
  if (!texto) {
    setFeedback('Digite o texto da narração antes de gerar.', 'erro');
    return;
  }
  $('gerar').disabled = true;
  setFeedback('Gerando áudio e tempos das palavras...', 'info');
  try {
    const payload = {
      provedor: $('provedor').value,
      voz: $('voz').value,
      velocidade: Number($('velocidade').value),
      projeto: $('projeto').value,
      texto,
      ...( $('provedor').value === 'gemini' ? {
        modelo: $('modelo').value,
        estilo: $('estilo').value.trim(),
      } : {}),
    };
    const r = await fetch('/api/voz/gerar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || 'Falha ao gerar narração.');

    const audio = $('player');
    audio.src = data.audioUrl;
    audio.load();
    audio.play().catch(() => {});

    const res = data.resumo;
    $('resumo').textContent = `${res.provedor} · voz ${res.voz || '-'} · ${res.duracao ?? '?'}s · ${res.palavras} palavras · ${res.frases} frases`;
    renderPalavras(data.palavras);
    renderFrases(data.frases);
    setFeedback(`Áudio gerado em ${data.projeto}/${res.audio}.`, 'ok');
  } catch (e) {
    setFeedback(e.message, 'erro');
  } finally {
    $('gerar').disabled = false;
  }
};

$('salvar').onclick = async () => {
  $('salvar').disabled = true;
  try {
    const provedor = $('provedor').value;
    const payload = {
      provedor,
      voz: $('voz').value,
      velocidade: Number($('velocidade').value),
      ...(provedor === 'gemini' ? { modelo: $('modelo').value, estilo: $('estilo').value.trim() } : {}),
    };
    const r = await fetch('/api/voz/configurar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || 'Falha ao salvar configuração.');
    statusData.config = data.config;
    atualizarStatusTexto();
    setFeedback(`Voz padrão salva: ${provedor} (${payload.voz || 'padrão'}).`, 'ok');
  } catch (e) {
    setFeedback(e.message, 'erro');
  } finally {
    $('salvar').disabled = false;
  }
};

$('player').ontimeupdate = () => {
  const t = $('player').currentTime;
  const chips = $('palavras-box').querySelectorAll('.palavra-chip');
  chips.forEach((chip, i) => {
    const w = palavrasAtuais[i];
    const ativo = w && t >= w.inicio && t <= w.fim;
    chip.classList.toggle('ativa', Boolean(ativo));
  });
};

carregarStatus().catch((e) => setFeedback(e.message, 'erro'));
