// CLI para buscar, inspecionar e baixar modelos 3D prontos (.glb) gratuitos para os vídeos.
// Uso:
//   node tools/modelos.mjs buscar "<consulta>" [--fonte todas|polyfork|threejsassets] [--todos] [--max-tri 5000] [--limite 12] [--json]
//   node tools/modelos.mjs baixar <fonte>:<id> [--json]
//   node tools/modelos.mjs info <fonte>:<id> [--json]
//   node tools/modelos.mjs listar [--json]

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerEnv } from './voz/gerar.mjs';
import {
  baixarModelo, buscarModelos, detalhesModelo, listarModelosLocais,
} from './modelos/catalogo.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
lerEnv(root);

const args = process.argv.slice(2);
const cmd = args[0];
const jsonMode = args.includes('--json');

function getFlag(nome, padrao = '') {
  const i = args.indexOf(nome);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : padrao;
}

function primeiroPosicional() {
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      if (['--fonte', '--max-tri', '--limite', '--pagina'].includes(a)) i++;
      continue;
    }
    return a;
  }
  return '';
}

function fmtSize(m) {
  if (!m) return '?';
  return `${Number(m.x).toFixed(2)}×${Number(m.y).toFixed(2)}×${Number(m.z).toFixed(2)}m`;
}

try {
  if (!cmd || cmd === '--help' || cmd === '-h') {
    console.log(
      'Uso:\n'
      + '  node tools/modelos.mjs buscar "<termo>" [--fonte todas|polyfork|threejsassets] [--todos] [--max-tri 8000] [--limite 12] [--json]\n'
      + '  node tools/modelos.mjs baixar <polyfork:id|threejsassets:slug> [--json]\n'
      + '  node tools/modelos.mjs info <polyfork:id|threejsassets:slug> [--json]\n'
      + '  node tools/modelos.mjs listar [--json]',
    );
    process.exit(0);
  }

  if (cmd === 'buscar') {
    const q = primeiroPosicional();
    const fonte = getFlag('--fonte', 'todas');
    const apenasGratis = !args.includes('--todos');
    const maxTriangulos = Number(getFlag('--max-tri', '0')) || 0;
    const limite = Number(getFlag('--limite', '12')) || 12;
    const pagina = Number(getFlag('--pagina', '1')) || 1;
    const res = await buscarModelos({ root, q, fonte, apenasGratis, maxTriangulos, limite, pagina });
    if (jsonMode) {
      console.log(JSON.stringify(res, null, 2));
    } else {
      console.log(`Encontrados ${res.itens.length} modelo(s)${q ? ` para "${q}"` : ''}:`);
      for (const it of res.itens) {
        const badge = it.local ? '[BAIXADO]' : it.requerChave ? '[REQUER TJA_API_KEY]' : '[GRÁTIS]';
        const tri = it.triangulos ? `${it.triangulos} tri` : '? tri';
        console.log(`  ${it.chave} — ${it.titulo} ${badge} (${it.categoria}, ${tri}, ${fmtSize(it.tamanhoM)})`);
      }
      for (const av of res.avisos) console.log(`  ! ${av}`);
    }
    process.exit(0);
  }

  if (cmd === 'baixar') {
    const spec = primeiroPosicional();
    if (!spec) throw new Error('Informe o identificador do modelo (ex.: polyfork:ox-cart-c12bca).');
    const meta = await baixarModelo(root, spec);
    if (jsonMode) {
      console.log(JSON.stringify(meta, null, 2));
    } else {
      console.log(`✓ Modelo baixado em ${meta.caminho} (${(meta.tamanhoBytes / 1024).toFixed(1)} KB)`);
      if (meta.animacoes?.length) console.log(`  Animações embutidas: ${meta.animacoes.join(', ')}`);
      console.log(`  Use no storyboard.json: ${JSON.stringify(meta.snippet)}`);
    }
    process.exit(0);
  }

  if (cmd === 'info') {
    const spec = primeiroPosicional();
    if (!spec) throw new Error('Informe o identificador do modelo (ex.: polyfork:ox-cart-c12bca).');
    const res = await detalhesModelo(spec);
    if (jsonMode) {
      console.log(JSON.stringify(res.item, null, 2));
    } else {
      const it = res.item;
      console.log(`${it.chave} — ${it.titulo}`);
      console.log(`  Fonte: ${it.fonteLabel} | Categoria: ${it.categoria} | Triângulos: ${it.triangulos ?? '?'}`);
      console.log(`  Tamanho: ${fmtSize(it.tamanhoM)} | Grátis: ${it.gratis ? 'sim' : 'não'} | Página: ${it.paginaUrl}`);
    }
    process.exit(0);
  }

  if (cmd === 'listar') {
    const lista = listarModelosLocais(root);
    if (jsonMode) {
      console.log(JSON.stringify({ total: lista.length, modelos: lista }, null, 2));
    } else if (!lista.length) {
      console.log('Nenhum modelo .glb baixado em assets/modelos/ ainda.');
    } else {
      console.log(`${lista.length} modelo(s) baixado(s) em assets/modelos/:`);
      for (const m of lista) {
        console.log(`  ${m.caminho} — ${m.titulo} (${(m.tamanhoBytes / 1024).toFixed(1)} KB${m.animacoes.length ? `, anims: ${m.animacoes.join(', ')}` : ''})`);
      }
    }
    process.exit(0);
  }

  throw new Error(`Comando desconhecido: "${cmd}". Use buscar, baixar, info ou listar.`);
} catch (err) {
  if (jsonMode) {
    console.log(JSON.stringify({ ok: false, error: err?.message || String(err) }, null, 2));
  } else {
    console.error(`Erro: ${err?.message || err}`);
  }
  process.exit(1);
}
