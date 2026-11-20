# Voz da narração: APIs gratuitas, voz local ou paga

O criador escolhe **uma vez** (e pode trocar quando quiser). Tudo passa por `node tools/voz.mjs` ou pela aba **Vozes** no preview (`/preview/voz.html`).

| | Edge TTS (recomendada) | Gemini TTS (Google AI Studio) | Google Tradutor TTS | Kokoro + Whisper (local) | ElevenLabs (paga) |
|---|---|---|---|---|---|
| Custo | R$ 0 (nuvem) | R$ 0 (cota gratuita AI Studio) | R$ 0 (nuvem) | R$ 0 (no PC) | plano mensal |
| Chave / instalação | **Nenhuma** | `GEMINI_API_KEY` | **Nenhuma** | Python + ~1 GB | `ELEVENLABS_API_KEY` |
| Qualidade pt-BR | neural natural (`pt-BR-AntonioNeural`, `pt-BR-FranciscaNeural`) | expressiva, com controle de estilo (`Kore`, `Puck`, `Charon`...) | básica, útil como fallback | boa voz de preset | a mais natural |
| Tempos por palavra | **nativos** (`WordBoundary`) | alinhamento automático | estimativa proporcional | Whisper local | nativos |

## Caminho A — APIs gratuitas em nuvem (sem instalar Python)

### Edge TTS (sem chave, pronto para usar)
1. `node tools/voz.mjs vozes --provedor edge` lista as vozes em português (`pt-BR-AntonioNeural`, `pt-BR-FranciscaNeural`, `pt-BR-ThalitaMultilingualNeural`).
2. `node tools/voz.mjs configurar-edge --voz pt-BR-AntonioNeural`
3. `node tools/voz.mjs testar`

### Gemini TTS / Google AI Studio (`GEMINI_API_KEY`)
1. Defina `GEMINI_API_KEY` no ambiente (ou no `.env`).
2. `node tools/voz.mjs configurar-gemini --voz Kore --estilo "Narrador dinâmico de vídeo curto"`
3. `node tools/voz.mjs testar`

### Google Tradutor TTS (sem chave)
1. `node tools/voz.mjs configurar-google --voz pt-BR`
2. `node tools/voz.mjs testar`

## Caminho B — voz paga (ElevenLabs)

1. O criador abre o ElevenLabs, cria uma **chave de API** e copia `.env.example` para `.env`, colando a chave em `ELEVENLABS_API_KEY=`.
2. `node tools/voz.mjs vozes --provedor elevenlabs` lista as vozes da conta.
3. `node tools/voz.mjs configurar-paga --voz <id>`
4. `node tools/voz.mjs testar`

## Caminho C — voz grátis local (Kokoro + Whisper)

1. `node tools/voz.mjs diagnostico` confere hardware, Python e ffmpeg.
2. `node tools/voz.mjs instalar` baixa os modelos em `.voz/` (apague `.voz/` para desinstalar).
3. `node tools/voz.mjs testar`

## Gerar a narração de um vídeo

```bash
node tools/voz.mjs gerar projects/<nome> [--provedor edge|gemini|google|kokoro|elevenlabs] [--voz ID] [--velocidade 1.0]
```

Lê `projects/<nome>/narracao.txt` e escreve na mesma pasta:

| Arquivo | Conteúdo |
|---|---|
| `narracao.falado.txt` | o texto exatamente como foi falado (números por extenso, símbolos removidos) |
| `narracao.wav` / `narracao.mp3` | o áudio (`edge`/`google`/`elevenlabs` = mp3, `gemini`/`kokoro` = wav) |
| `palavras.json` | cada palavra com `inicio` e `fim` (alimenta as legendas e a boca) |
| `frases.json` | cada frase com início e fim (use para alinhar as cenas) |
| `voz.json` | provedor, voz, duração |

Depois ajuste `duracao` e `audio` no storyboard. Se o ritmo ficou lento ou rápido, repita com `--velocidade 0.95` ou `1.05`.

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| "Falta GEMINI_API_KEY" | Defina `GEMINI_API_KEY` ou troque para `configurar-edge` (não precisa de chave) |
| "Python não encontrado" (Kokoro) | Use `configurar-edge` / `configurar-gemini` ou instale Python 3.11 |
| Legenda adiantada/atrasada | números e nomes difíceis; escreva por extenso/como se fala e gere de novo |
| ElevenLabs 401 / 402 | chave errada ou créditos acabaram |
