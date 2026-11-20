# Estratégia e Auditoria para YouTube (Shorts e Vídeos 3D)

Este guia equipa o agente de IA para produzir vídeos pensados para **descoberta, clique, retenção e comentário** no YouTube — com checagens automáticas via `tools/youtube.mjs` e aba **YouTube** em `http://localhost:3000/preview/youtube.html`.

## 1. Fluxo obrigatório do agente no YouTube

Antes de escrever e fechar qualquer vídeo, execute estas 4 etapas com o CLI:

```bash
# 1) Pesquise o tema e veja o padrão dos concorrentes (média de caracteres, perguntas e Outliers >= 1,5x)
node tools/youtube.mjs pesquisar "como funciona <tema>" --limite 10

# 2) Teste a primeira frase da narração nos 5 eixos de gancho (meta: >= 72 / grau A ou S)
node tools/youtube.mjs gancho "<primeira frase exata>"

# 3) Depois de gerar voz + storyboard, audite retenção, ritmo, falas e fechamento
node tools/youtube.mjs auditar projects/<nome>

# 4) Valide Título + Texto da Capa (sem repetir palavras) e gere postagem.md + youtube.json
node tools/youtube.mjs pacote --titulo "..." --capa "..." --descricao "..." --tags "..."
node tools/youtube.mjs preparar projects/<nome>
```

## 2. Como o algoritmo decide a entrega

- **Shorts (9:16):** o público avalia nos **primeiros 2 a 3 segundos** ("Ficou para assistir" vs "Passou para cima") e o algoritmo mede porcentagem vista + replays + comentários. Nunca abra com saudações ("oi pessoal", nome do canal); entregue movimento visual e tensão já no segundo `0.0`.
- **Feed Inicial e Sugeridos:** o espectador olha **Capa + Título juntos por menos de 1 segundo** no celular. Se os dois repetem as mesmas palavras, você desperdiça metade da área de clique.
- **Busca:** vídeos explicativos ("como funciona...", "por que...") continuam recebendo visitas por meses quando o título traz o termo claro nos primeiros **40 caracteres** (antes do corte no celular) e descrição/tags objetivas.

## 3. Regras de Ouro: Título + Texto da Capa

1. **Complemento, nunca cópia:** se o título diz *"Por que o asfalto aguenta caminhões?"*, o texto na capa de abertura diz *"O segredo embaixo"* — nunca escreva *"Asfalto aguenta caminhões"* na capa.
2. **Corte de tela:**
   - **≤ 40 caracteres:** aparece inteiro no celular.
   - **≤ 60 caracteres:** aparece inteiro na busca do computador.
   - **100 caracteres:** teto técnico do YouTube Studio.
3. **Zero adjetivo vago:** troque *"incrível / insano / absurdo"* por número, camada, erro comum ou consequência visível.
4. **Máximo 2 palavras em MAIÚSCULAS** no título; texto na capa com **2 a 5 palavras grandes**.

## 4. Os 5 eixos de pontuação de Gancho (`tools/youtube/ganchos.mjs`)

Liste todas as 21 fórmulas disponíveis com `node tools/youtube.mjs formulas`:

1. **Especificidade:** contém dado concreto, número, dimensão ou fato verificável.
2. **Direcionamento ("você"):** coloca o espectador dentro da ação já nas primeiras **6 palavras**.
3. **Aposta / Risco:** deixa claro o que quebra, falha, custa caro ou surpreende.
4. **Curiosidade aberta:** abre uma pergunta ou inversão (*"mas na verdade..."*) **sem explicar o "porque" na 1ª frase**.
5. **Concisão:** **7 a 20 palavras** (~3 a 6 s falados) — entra direto na ação visual.

## 5. Retenção e Loop (Shorts e Vídeos)

- **Ritmo visual:** cenas curtas (**2,5 a 4,2 s** em Shorts; nunca > 5,2 s sem troca de plano/ângulo ou processo acontecendo).
- **Sem ar morto:** evite silêncios maiores que `0,75 s` entre palavras na narração e mantenha cadência próxima de **145–175 palavras/minuto** em Shorts.
- **Re-gancho a cada 8–12 s:** insira micro-perguntas, contrastes ou troca de plano/ambiente na metade do vídeo para segurar quem ia pular.
- **Fechamento + Comentário Fixado + Loop:** termine pagando a promessa do gancho + **uma pergunta binária ou específica** falada, exibida no painel `pergunta` da última cena e duplicada no **Comentário fixado** do `postagem.md`.

## 6. Pesquisa com ou sem chave

- **Sem chave (padrão):** `node tools/youtube.mjs pesquisar "<tema>"` consulta os resultados públicos do YouTube e calcula comprimento médio dos títulos, `%` com pergunta/número, termos recorrentes e **Outlier Ratio** (visualizações divididas pela mediana da busca).
- **Opcional (`YOUTUBE_API_KEY`):** se o criador colocar uma chave da **YouTube Data API v3** no `.env`, a busca usa os endpoints oficiais com contagem exata de visualizações. Nunca exiba ou peça chaves na interface web.
