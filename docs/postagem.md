# Capa e texto de postagem

Depois do vídeo renderizado, entregue sempre um arquivo `projects/<nome>/postagem.md` com tudo pronto para copiar.

## Capa

Gere o quadro mais forte do vídeo (personagem em close com expressão exagerada e o objeto do tema, ou o cenário mais impactante):

```bash
node tools/render.mjs projects/<nome> --capa <segundos>   # salva render/capa.png em 1080×1920
```

Para uma capa dedicada (com título grande e expressão), crie uma cena curta extra **no começo do storyboard** (0,3 s) e capture dela — ou use o instante do gancho. Texto da capa: **uma pergunta ou provocação curta** (até 5–6 palavras), legível no celular pequeno. Use `expressao: "surprised"` e personagens em `plano: close`.

## Estrutura do `postagem.md`

```markdown
# Postagem — {título interno}

## Título (até ~60 caracteres)
{3 opções, curiosidade + tema; sem mentira}

## Descrição
{1ª linha: promessa/pergunta do vídeo. 2ª: contexto em uma frase. Depois: fontes e link de vídeo relacionado.}

## Hashtags
#shorts #{nicho} #{tema} (3 a 5, sem exagero)

## Comentário fixado
{A MESMA pergunta do final do vídeo + link do vídeo relacionado / produto}

## Fontes
{lista curta com o que sustenta os fatos}
```

## Boas práticas e automação

- **Título + Capa trabalham juntos:** nunca repita no texto da capa as palavras que já estão no título (ex.: se o título diz *"Por que o asfalto aguenta caminhões?"*, a capa diz *"O segredo embaixo"*). Mantenha **≤ 40 caracteres** para o assunto principal não cortar no celular (e até **60** na busca de PC).
- O título repete a **curiosidade**, não o spoiler.
- A pergunta do comentário fixado é igual à do vídeo; assim quem lê o comentário já sabe responder.
- Use `node tools/youtube.mjs pacote --titulo "..." --capa "..."` para validar limites e `node tools/youtube.mjs preparar projects/<nome>` para gerar o rascunho de `postagem.md` e `youtube.json` (detalhes em `docs/youtube.md`).
- Se o canal tem vídeo relacionado, a última fala do vídeo pede para ver e o comentário fixado leva o link.
- Poste com consistência (o mesmo número de vídeos por semana) em vez de rajadas.
- Confira as regras vigentes da plataforma sobre conteúdo gerado por IA e monetização antes de postar; o criador é o responsável final.

