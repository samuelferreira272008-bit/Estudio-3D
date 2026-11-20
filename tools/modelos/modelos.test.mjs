import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { normalizarItemPolyfork, slugSeguro } from './polyfork.mjs';
import { normalizarItemThreeJsAssets } from './threejsassets.mjs';
import {
  calcularEscalaNormalizada,
  caminhoLocalModelo,
  parseSpecModelo,
  resolverCaminhoModeloSeguro,
  snippetStoryboard,
  validarArquivoGlb,
} from './catalogo.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function criarGlbMinimo(jsonObj) {
  const jsonText = JSON.stringify(jsonObj);
  const pad = (4 - (Buffer.byteLength(jsonText) % 4)) % 4;
  const jsonBuf = Buffer.from(jsonText + ' '.repeat(pad), 'utf8');
  const totalLength = 12 + 8 + jsonBuf.length;
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 4, 'ascii');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const chunkHead = Buffer.alloc(8);
  chunkHead.writeUInt32LE(jsonBuf.length, 0);
  chunkHead.write('JSON', 4, 4, 'ascii');
  return Buffer.concat([header, chunkHead, jsonBuf]);
}

test('slugSeguro e resolverCaminhoModeloSeguro bloqueiam traversal e extensões inválidas', () => {
  assert.equal(slugSeguro('Follow Me Car #1!'), 'follow-me-car-1');
  assert.equal(caminhoLocalModelo('polyfork', 'ox-cart-c12bca'), 'assets/modelos/polyfork-ox-cart-c12bca.glb');
  assert.equal(caminhoLocalModelo('threejsassets', 'aac-tablet-01'), 'assets/modelos/tja-aac-tablet-01.glb');

  const ok = resolverCaminhoModeloSeguro('/tmp/estudio', 'assets/modelos/polyfork-ox-cart.glb');
  assert.equal(ok.rel, 'assets/modelos/polyfork-ox-cart.glb');

  assert.throws(() => resolverCaminhoModeloSeguro('/tmp/estudio', '../../etc/passwd.glb'), /inválido/i);
  assert.throws(() => resolverCaminhoModeloSeguro('/tmp/estudio', 'projects/foo/bar.glb'), /assets\/modelos/);
  assert.throws(() => resolverCaminhoModeloSeguro('/tmp/estudio', 'assets/modelos/evil.exe'), /\.glb/);
});

test('normalização de itens Polyfork e ThreeJS Assets mantém esquema uniforme', () => {
  const pf = normalizarItemPolyfork({
    id: 'ox-cart-c12bca',
    title: 'Ox Cart',
    class: 'vehicle',
    triangles: 1936,
    free: true,
    size_m: { x: 2.02, y: 1.47, z: 4.14 },
    download: { glb: 'https://polyfork.dev/cdn/ox-cart-c12bca.glb', auth: 'none' },
  });
  assert.equal(pf.chave, 'polyfork:ox-cart-c12bca');
  assert.equal(pf.baixavelSemChave, true);
  assert.equal(pf.requerChave, false);
  assert.equal(pf.arquivoSugerido, 'assets/modelos/polyfork-ox-cart-c12bca.glb');

  const tjaSemChave = normalizarItemThreeJsAssets({
    slug: 'aac-tablet-01',
    name: 'AAC Tablet',
    tier: 'free',
    category: 'assistive-devices',
    triangles: 13590,
  }, false);
  assert.equal(tjaSemChave.chave, 'threejsassets:aac-tablet-01');
  assert.equal(tjaSemChave.gratis, true);
  assert.equal(tjaSemChave.requerChave, true);
  assert.equal(tjaSemChave.credito, 'by ThreeJS Assets');

  const tjaComChave = normalizarItemThreeJsAssets({
    slug: 'aac-tablet-01',
    name: 'AAC Tablet',
    tier: 'free',
    entitled: true,
  }, true);
  assert.equal(tjaComChave.requerChave, false);
  assert.equal(tjaComChave.autorizadoDownload, true);
});

test('validarArquivoGlb extrai meshes e animações e rejeita buffers não-GLB', () => {
  const glb = criarGlbMinimo({
    asset: { version: '2.0', generator: 'EstudioTest' },
    meshes: [{ name: 'Body' }, { name: 'Wheel' }],
    animations: [{ name: 'Spin' }],
  });
  const info = validarArquivoGlb(glb);
  assert.equal(info.versao, 2);
  assert.equal(info.meshes, 2);
  assert.deepEqual(info.animacoes, ['Spin']);
  assert.equal(info.gerador, 'EstudioTest');

  assert.throws(() => validarArquivoGlb(Buffer.from('<html><body>Login required page</body></html>')), /não é um \.glb/);
  assert.throws(() => validarArquivoGlb(Buffer.alloc(4)), /vazio ou corrompido/);
});

test('calcularEscalaNormalizada, parseSpecModelo e snippetStoryboard funcionam corretamente', () => {
  const esc = calcularEscalaNormalizada({ x: 2, y: 4, z: 1 }, { altura: 2, escala: 1.5 });
  assert.equal(esc.factor, 0.75);
  assert.deepEqual(esc.size, { x: 1.5, y: 3, z: 0.75 });

  assert.deepEqual(parseSpecModelo('threejsassets:aac-tablet-01'), { fonte: 'threejsassets', id: 'aac-tablet-01' });
  assert.deepEqual(parseSpecModelo('ox-cart-c12bca'), { fonte: 'polyfork', id: 'ox-cart-c12bca' });

  const snip = snippetStoryboard('assets/modelos/polyfork-ox-cart.glb', { id: 'ox-cart', tamanhoM: { x: 2, y: 1.47, z: 4 } });
  assert.equal(snip.modelo, 'assets/modelos/polyfork-ox-cart.glb');
  assert.equal(snip.altura, 1.47);
});

test('tools/validar.mjs aceita objeto com modelo .glb válido e rejeita .glb ausente', () => {
  const tmpDir = fs.mkdtempSync(path.join(root, 'projects', '_test_glb_'));
  const relProj = path.relative(root, tmpDir).replace(/\\/g, '/');
  const glbPath = path.join(tmpDir, 'teste.glb');
  fs.writeFileSync(glbPath, criarGlbMinimo({ asset: { version: '2.0' }, meshes: [{}], animations: [{ name: 'Idle' }] }));
  fs.writeFileSync(glbPath.replace(/\.glb$/, '.meta.json'), JSON.stringify({ animacoes: ['Idle'] }));

  try {
    const sbValido = {
      versao: 1,
      titulo: 'Teste GLB',
      formato: { largura: 1080, altura: 1920, fps: 30 },
      duracao: 4,
      cenas: [
        {
          inicio: 0,
          fim: 4,
          objetos: [
            { id: 'item', modelo: 'teste.glb', pos: [0, 0], altura: 2.0, anim: { gira: 30 } },
          ],
          personagens: [
            { id: 'guia', preset: 'construtor', pos: [2, 1], acoes: [{ clip: 'point', de: 0.5, ate: 3.5 }] },
          ],
          camera: { tipo: 'enquadrar', alvo: 'item', plano: 'geral' },
          textos: [{ texto: 'Teste?', de: 0.2, ate: 3.5, estilo: 'pergunta' }],
        },
      ],
    };
    fs.writeFileSync(path.join(tmpDir, 'storyboard.json'), JSON.stringify(sbValido, null, 2));

    const okRun = spawnSync(process.execPath, [path.join(root, 'tools/validar.mjs'), relProj, '--sem-audio', '--json'], {
      cwd: root,
      encoding: 'utf8',
    });
    const okJson = JSON.parse(okRun.stdout);
    assert.equal(okJson.ok, true, `Erros inesperados: ${okJson.erros?.join('; ')}`);

    sbValido.cenas[0].objetos[0].modelo = 'nao-existe.glb';
    fs.writeFileSync(path.join(tmpDir, 'storyboard.json'), JSON.stringify(sbValido, null, 2));
    const failRun = spawnSync(process.execPath, [path.join(root, 'tools/validar.mjs'), relProj, '--sem-audio', '--json'], {
      cwd: root,
      encoding: 'utf8',
    });
    const failJson = JSON.parse(failRun.stdout);
    assert.equal(failJson.ok, false);
    assert.ok(failJson.erros.some((e) => e.includes('não encontrado no disco')));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
