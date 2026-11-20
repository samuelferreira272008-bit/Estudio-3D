// Interface web do Estúdio YouTube: Auditoria de retenção, 21 fórmulas de gancho,
// linter Título + Texto da Capa + SEO e pesquisa de concorrentes/outliers.

const $ = (id) => document.getElementById(id);

let projetosMap = new Map();
let formulasList = [];

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function classeNota(nota) {
  if (nota >= 78) return 'bom';
  if (nota >= 58) return 'medio';
  return 'baixo';
}

function setFeedback(msg, tipo = 'info') {
  const el = $('yt-feedback');
  el.textContent = msg;
  el.className = `feedback ${tipo}`;
}

function atualizarMedidorTitulo() {
  const titulo = $('pkg-titulo').value.trim();
  const len = titulo.length;
  $('pkg-chars').textContent = `${len} / 60 caracteres recomendados (máx. 100)`;
  const pct = Math.min(100, Math.round((len / 80) * 100));
  const bar = $('pkg-meter-bar');
  bar.style.width = `${pct}%`;
  bar.className = `yt-bar-fill ${len > 100 || len === 0 ? 'baixo' : len > 60 ? 'medio' : 'bom'}`;
  if (!len) $('pkg-corte').textContent = 'Digite um título';
  else if (len <= 40) $('pkg-corte').textContent = 'Cabe inteiro no celular e no PC';
  else if (len <= 60) $('pkg-corte').textContent = 'Cabe no PC (no celular corta após 40 ch)';
  else if (len <= 100) $('pkg-corte').textContent = 'Corta no celular e na busca de PC';
  else $('pkg-corte').textContent = 'Passou do limite máximo de 100 caracteres';
}

function preencherCamposProjeto(projetoId) {
  const p = projetosMap.get(projetoId);
  if (!p) return;
  const nar = p.narracao || '';
  const primeiraFrase = (nar.match(/^(.+?[.!?])(\s|$)/)?.[1] || nar.split(/\s+/).slice(0, 18).join(' ')).trim();
  if (primeiraFrase) $('gancho-texto').value = primeiraFrase;

  const post = p.postagem || {};
  $('pkg-titulo').value = post.titulo || p.tituloStoryboard || '';
  $('pkg-capa').value = post.textoCapa || '';
  $('pkg-descricao').value = post.descricao || '';
  $('pkg-hashtags').value = (post.hashtags || []).map((h) => `#${h}`).join(' ');
  $('pkg-tags').value = (post.tags || []).join(', ');
  $('pkg-comentario').value = post.comentarioFixado || '';
  atualizarMedidorTitulo();
}

function renderAuditoria(aud) {
  const badge = $('aud-nota');
  badge.textContent = `${aud.notaGeral}/100`;
  badge.className = `yt-badge ${classeNota(aud.notaGeral)}`;
  $('aud-resumo').textContent = `${aud.formato} · ${aud.cenas} cenas · ${Number(aud.duracao).toFixed(1)} s · velocidade média ${aud.wpm || 0} palavras/min`;

  const pilaresInfo = [
    { key: 'gancho', nome: '1. Gancho (0–3 s)', det: aud.pilares.gancho.formula?.nome || '' },
    { key: 'ritmo', nome: '2. Ritmo e Quebras Visuais', det: `média ${aud.pilares.ritmo.mediaCena} s/cena · ${aud.pilares.ritmo.cenasLentas} longa(s)` },
    { key: 'fala', nome: '3. Fala e Silêncios', det: `${aud.pilares.fala.wpm} ppm · ${aud.pilares.fala.pausasLongas} pausa(s) > 0,75 s` },
    { key: 'pacote', nome: '4. Pacote Clique & SEO', det: aud.pilares.pacote.titulo ? `${aud.pilares.pacote.titulo.length} caracteres no título` : 'sem título' },
    { key: 'fechamento', nome: '5. Fechamento e Comentário', det: aud.pilares.fechamento.painelFinal ? 'com painel de pergunta' : 'falta pergunta na tela' },
  ];

  $('aud-pilares').innerHTML = pilaresInfo.map((info) => {
    const p = aud.pilares[info.key];
    const cls = classeNota(p.nota);
    const dicaPrincipal = p.dicas?.[0] ? `<div class="muted">${esc(p.dicas[0])}</div>` : '<div class="muted">Ponto bem resolvido.</div>';
    return `
      <div class="yt-pilar">
        <div class="yt-pilar-top">
          <span>${esc(info.nome)}</span>
          <span class="yt-badge ${cls}">${p.nota}/100</span>
        </div>
        <div class="yt-bar-bg"><div class="yt-bar-fill ${cls}" style="width:${p.nota}%"></div></div>
        <div class="muted">${esc(info.det)}</div>
        ${dicaPrincipal}
      </div>
    `;
  }).join('');

  const wrap = $('aud-acoes-wrap');
  const ol = $('aud-acoes');
  if (aud.proximasAcoes?.length) {
    wrap.hidden = false;
    ol.innerHTML = aud.proximasAcoes.map((a) => `<li class="aviso">${esc(a)}</li>`).join('');
  } else {
    wrap.hidden = false;
    ol.innerHTML = '<li class="ok">Nenhuma pendência crítica encontrada para publicação.</li>';
  }
}

function renderGancho(res) {
  const b = $('gancho-badge');
  b.textContent = `${res.nota}/100 (${res.grau})`;
  b.className = `yt-badge ${classeNota(res.nota)}`;

  const subs = [
    ['Especificidade', res.subnotas.especificidade],
    ['Você (0–6 pal.)', res.subnotas.direcionamento],
    ['Aposta / Risco', res.subnotas.aposta],
    ['Curiosidade', res.subnotas.curiosidade],
    ['Concisão', res.subnotas.concisao],
  ];

  const itens = [
    ...(res.pontosFortes || []).map((p) => `<li class="ok">${esc(p)}</li>`),
    ...(res.problemas || []).map((p) => `<li class="aviso">${esc(p)}</li>`),
  ].join('');

  $('gancho-resultado').innerHTML = `
    <div class="yt-formula-box">
      <div><strong>Fórmula detectada:</strong> ${esc(res.formula?.nome || '-')} (${res.palavras} palavras)</div>
      <div class="muted">${subs.map(([k, v]) => `${esc(k)}: <b>${v}</b>`).join(' · ')}</div>
      ${itens ? `<ul class="yt-lista">${itens}</ul>` : ''}
    </div>
  `;
}

function renderPacote(res) {
  const b = $('pacote-badge');
  b.textContent = `${res.nota}/100`;
  b.className = `yt-badge ${classeNota(res.nota)}`;

  const bons = (res.bons || []).map((m) => `<li class="ok">${esc(m)}</li>`).join('');
  const iss = (res.issues || []).map((i) => `<li class="${i.severidade === 'erro' ? 'erro' : 'aviso'}">${esc(i.mensagem)}</li>`).join('');
  $('pacote-resultado').innerHTML = `
    <div class="yt-formula-box">
      <ul class="yt-lista">${bons}${iss}</ul>
    </div>
  `;
}

function renderPesquisa(res) {
  $('pesquisa-stats').hidden = false;
  $('stat-chars').textContent = `${res.mediaCaracteres} ch`;
  $('stat-padrao').textContent = `${res.porcentagemPergunta}% ? · ${res.porcentagemComNumero}% nº`;
  $('stat-mediana').textContent = res.medianaViews ? Number(res.medianaViews).toLocaleString('pt-BR') : '-';

  const kw = $('pesquisa-keywords');
  if (res.palavrasFrequentes?.length) {
    kw.hidden = false;
    kw.innerHTML = `<b>Termos mais usados no topo:</b> ${res.palavrasFrequentes.map((p) => `${esc(p.palavra)} (${p.qtd})`).join(', ')}`;
  } else {
    kw.hidden = true;
  }

  const lista = $('pesquisa-lista');
  if (!res.videos?.length) {
    lista.innerHTML = '<p class="muted">Nenhum vídeo retornado para essa busca.</p>';
    return;
  }

  lista.innerHTML = res.videos.map((v, i) => {
    const isOutlier = v.outlierVsBusca && v.outlierVsBusca >= 1.5;
    const badgeOutlier = isOutlier ? `<span class="yt-badge bom">${v.outlierVsBusca}× mediana</span>` : '';
    return `
      <article class="yt-video-card">
        <img class="yt-video-thumb" src="${esc(v.thumbnail)}" alt="" loading="lazy">
        <div class="yt-video-body">
          <h3>${esc(v.titulo)}</h3>
          <p class="modelo-meta">${esc(v.canal || 'YouTube')} · ${v.titulo.length} ch${v.viewsTexto ? ` · ${esc(v.viewsTexto)}` : ''}${v.duracao ? ` · ${esc(v.duracao)}` : ''}</p>
          <div class="yt-video-actions">
            ${badgeOutlier}
            <button type="button" class="btn-compact" data-usar-idx="${i}">Usar como base no título</button>
            <a class="btn-link" href="${esc(v.url)}" target="_blank" rel="noreferrer">Abrir</a>
          </div>
        </div>
      </article>
    `;
  }).join('');

  lista.querySelectorAll('[data-usar-idx]').forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.usarIdx);
      const v = res.videos[idx];
      if (!v) return;
      $('pkg-titulo').value = v.titulo;
      atualizarMedidorTitulo();
      avaliarPacoteAtual();
      setFeedback('Título copiado para o pareador — ajuste para não duplicar o texto da capa.', 'info');
    };
  });
}

async function auditarAtual() {
  const projeto = $('yt-projeto').value;
  if (!projeto) {
    setFeedback('Nenhum projeto com storyboard encontrado em projects/.', 'erro');
    return;
  }
  $('btn-auditar').disabled = true;
  setFeedback(`Auditando ${projeto}...`, 'info');
  try {
    const r = await fetch('/api/youtube/auditar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projeto,
        tituloOverride: $('pkg-titulo').value.trim(),
        capaOverride: $('pkg-capa').value.trim(),
        descricaoOverride: $('pkg-descricao').value.trim(),
        tagsOverride: $('pkg-tags').value.trim(),
      }),
    });
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || 'Falha na auditoria.');
    renderAuditoria(data.auditoria);
    setFeedback(`Auditoria concluída para ${projeto}: ${data.auditoria.notaGeral}/100.`, 'ok');
  } catch (e) {
    setFeedback(e.message, 'erro');
  } finally {
    $('btn-auditar').disabled = false;
  }
}

async function avaliarGanchoAtual() {
  const texto = $('gancho-texto').value.trim();
  const r = await fetch('/api/youtube/gancho', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto }),
  });
  const data = await r.json();
  if (!r.ok || !data.ok) throw new Error(data.error || 'Falha ao avaliar gancho.');
  renderGancho(data);
}

async function avaliarPacoteAtual() {
  const r = await fetch('/api/youtube/pacote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      titulo: $('pkg-titulo').value,
      textoCapa: $('pkg-capa').value,
      descricao: $('pkg-descricao').value,
      tags: $('pkg-tags').value,
    }),
  });
  const data = await r.json();
  if (!r.ok || !data.ok) throw new Error(data.error || 'Falha ao avaliar pacote.');
  renderPacote(data);
}

async function salvarPostagemAtual() {
  const projeto = $('yt-projeto').value;
  if (!projeto) {
    setFeedback('Selecione um projeto para salvar o postagem.md.', 'erro');
    return;
  }
  $('btn-salvar-postagem').disabled = true;
  try {
    const r = await fetch('/api/youtube/salvar-postagem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projeto,
        titulo: $('pkg-titulo').value,
        textoCapa: $('pkg-capa').value,
        descricao: $('pkg-descricao').value,
        hashtags: $('pkg-hashtags').value,
        tags: $('pkg-tags').value,
        comentarioFixado: $('pkg-comentario').value,
      }),
    });
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || 'Falha ao salvar postagem.md.');
    if (data.auditoria) renderAuditoria(data.auditoria);
    setFeedback(`Salvo em ${data.arquivo} e auditado novamente.`, 'ok');
  } catch (e) {
    setFeedback(e.message, 'erro');
  } finally {
    $('btn-salvar-postagem').disabled = false;
  }
}

async function pesquisarAtual(e) {
  if (e) e.preventDefault();
  const q = $('yt-query').value.trim();
  if (!q) {
    setFeedback('Digite um tema para pesquisar concorrentes no YouTube.', 'erro');
    return;
  }
  $('btn-pesquisar').disabled = true;
  setFeedback(`Pesquisando "${q}" no YouTube...`, 'info');
  try {
    const r = await fetch(`/api/youtube/pesquisar?q=${encodeURIComponent(q)}&limite=10`);
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || 'Falha na pesquisa do YouTube.');
    renderPesquisa(data);
    setFeedback(`Pesquisa concluída (${data.total} vídeos, modo ${data.modo === 'api_oficial' ? 'API oficial' : 'público zero-chave'}).`, 'ok');
  } catch (e2) {
    setFeedback(e2.message, 'erro');
  } finally {
    $('btn-pesquisar').disabled = false;
  }
}

async function init() {
  const r = await fetch('/api/youtube/status');
  const data = await r.json();
  if (!r.ok || !data.ok) throw new Error(data.error || 'Erro ao inicializar Estúdio YouTube.');

  const modoBusca = data.youtubeApiConfigurada ? 'YouTube Data API v3 ativa' : 'Pesquisa pública zero-chave ativa';
  $('yt-status').textContent = `${data.formulas.length} fórmulas de gancho · ${modoBusca}`;

  formulasList = data.formulas || [];
  const fSel = $('formula-select');
  fSel.innerHTML = '<option value="">Escolha uma fórmula para ver formato e exemplo...</option>';
  for (const f of formulasList) {
    fSel.add(new Option(f.nome, f.id));
  }
  fSel.onchange = () => {
    const found = formulasList.find((f) => f.id === fSel.value);
    if (!found) {
      $('formula-box').hidden = true;
      return;
    }
    $('formula-box').hidden = false;
    $('formula-desc').innerHTML = `<strong>${esc(found.formato)}</strong><br>Exemplo: <em>"${esc(found.exemplo)}"</em>`;
  };

  $('btn-usar-exemplo').onclick = () => {
    const found = formulasList.find((f) => f.id === fSel.value);
    if (!found) return;
    $('gancho-texto').value = found.exemplo;
    avaliarGanchoAtual().catch((err) => setFeedback(err.message, 'erro'));
  };

  const pSel = $('yt-projeto');
  pSel.innerHTML = '';
  projetosMap.clear();
  const comSb = (data.projetos || []).filter((p) => p.temStoryboard);
  for (const p of comSb) {
    projetosMap.set(p.id, p);
    pSel.add(new Option(`${p.nome}${p.tituloStoryboard ? ` — ${p.tituloStoryboard}` : ''}`, p.id));
  }
  if (!comSb.length) {
    pSel.add(new Option('Nenhum projeto com storyboard', ''));
  } else {
    preencherCamposProjeto(pSel.value);
    await Promise.all([auditarAtual(), avaliarGanchoAtual(), avaliarPacoteAtual()]);
  }

  pSel.onchange = () => {
    preencherCamposProjeto(pSel.value);
    auditarAtual().catch((err) => setFeedback(err.message, 'erro'));
  };
}

$('pkg-titulo').oninput = atualizarMedidorTitulo;
$('btn-auditar').onclick = () => auditarAtual().catch((err) => setFeedback(err.message, 'erro'));
$('btn-avaliar-gancho').onclick = () => avaliarGanchoAtual().catch((err) => setFeedback(err.message, 'erro'));
$('btn-avaliar-pacote').onclick = () => avaliarPacoteAtual().catch((err) => setFeedback(err.message, 'erro'));
$('btn-salvar-postagem').onclick = () => salvarPostagemAtual().catch((err) => setFeedback(err.message, 'erro'));
$('form-pesquisa').onsubmit = pesquisarAtual;

init().catch((err) => setFeedback(err.message, 'erro'));
