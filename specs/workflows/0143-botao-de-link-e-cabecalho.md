---
id: 0143
titulo: Botão de link, cabeçalho, rodapé e descrição da lista no bloco Enviar mensagem do FlowAstro
dominio: workflows
status: implementada
autor: João Gabriel
criada: 2026-11-27
atualizada: 2026-11-27
branch: feature/flowastro-botao-link-cabecalho-20261127
pr:
peso: completa
---

# 0143 — Botão de link, cabeçalho, rodapé e descrição da lista no FlowAstro

## 1. Contexto

O bloco "Enviar mensagem" do FlowAstro ([spec 0139](0139-fluxo-de-atendimento.md)) já manda texto com até 3 botões de
resposta ou uma lista de até 10 itens pela API oficial (`send-interactive.ts`, spec 0079). A documentação da Meta tem
recursos que o bloco ainda não oferece:

- **Botão de link** (`interactive.type = "cta_url"`, [doc](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/interactive-cta-url-messages)):
  um botão que abre um site. Hoje a empresa cola o link no meio do texto.
- **Cabeçalho** nos botões ([doc](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/interactive-reply-buttons-messages)):
  imagem, vídeo, documento ou título em cima do texto. Hoje "foto do produto + botões" exige dois blocos e chega como
  duas mensagens.
- **Rodapé** (60 letras): o envio já aceita (`footerText`), mas o editor do FlowAstro não mostra o campo.
- **Descrição do item da lista** (72 letras, [doc](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/interactive-list-messages)):
  o envio oficial já aceita (`InteractiveOption.description`), mas o bloco não tem o campo.

O carrossel ([doc](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/interactive-media-carousel-messages))
fica para spec própria (ver Não-objetivos).

## 2. Objetivo

A empresa monta no mesmo bloco uma mensagem com cabeçalho, texto, rodapé e, à escolha, botões de resposta, lista com
descrição ou um botão de link, e o cliente recebe tudo numa mensagem só.

### Não-objetivos

- **Carrossel.** São de 2 a 10 cartões, e todos precisam do mesmo tipo e da mesma quantidade de botões. A página da Meta
  não diz o que chega no webhook quando o cliente toca numa resposta rápida do cartão. Spec própria, depois de um envio
  de teste que mostre esse retorno.
- **Seções com título na lista.** Pede um editor de grupos para pouco ganho; a lista segue com uma seção só.
- **Mais de um botão de link.** A Meta aceita um por mensagem, e não dá para misturar com botões de resposta.
- **Saber se o cliente clicou no link.** A Meta não avisa o clique no botão de link. Não existe caminho "clicou".
- **Gatilhos Automáticos (editor antigo).** Só o FlowAstro ganha os campos. O passo antigo aceita o dado novo, mas a
  tela dele não muda, como na spec 0141.
- **Menus salvos do atendimento** (`AiButtonPreset`): não mudam.

## 3. Requisitos

### Funcionais

- **RF-1 — Tipo de resposta.** Na aba Texto, a empresa escolhe entre "Botões de resposta" (como hoje: botões ou lista) e
  "Botão de link". Trocar de um para o outro avisa que os botões montados serão descartados.
- **RF-2 — Botão de link.** Campos: texto do botão (até 20 letras) e endereço. O endereço precisa começar com `https://`
  e aceita variáveis (`{nome}` etc.); o valor da variável entra codificado para URL. O bloco tem só a saída
  "Próximo passo": o fluxo segue logo depois do envio.
- **RF-3 — Cabeçalho.** Opcional, com Botões de resposta (formato botão) e com Botão de link: nenhum, título (até 60
  letras), imagem, vídeo (MP4/3GP até 16 MB) ou documento (com nome do arquivo). Com lista, só título, que é o que a
  Meta aceita.
- **RF-4 — Rodapé.** Campo opcional de até 60 letras, com botões, lista e botão de link.
- **RF-5 — Descrição do item da lista.** No formato lista, cada item ganha uma descrição opcional de até 72 letras.
- **RF-6 — Envio pela API oficial.**
  - O cabeçalho de mídia vai como `link` público, como já fazem imagem, áudio e vídeo.
  - Botão de link sai como `interactive.type = "cta_url"`, com `action.name = "cta_url"` e `parameters.display_text` /
    `parameters.url`.
  - A janela de 24 horas e o modelo de mensagem reserva valem como para os botões de hoje.
- **RF-7 — Número fora da API oficial (Uazapi).**
  - **Botão de link:** sai como texto, com o link numa linha no fim: `<texto do botão>: <url>`.
  - **Cabeçalho de mídia:** sai como uma mensagem de mídia antes do menu.
  - **Título do cabeçalho:** vira a primeira linha do texto, em negrito.
  - **Descrição do item:** vai para a lista da Uazapi (`título|id|descrição`) ou, no menu numerado (spec 0095), entre
    parênteses depois do título.
- **RF-8 — Histórico do chat.** A mensagem gravada mostra o título do cabeçalho, o texto, o rodapé e as opções (ou
  `<texto do botão>: <url>`). O cabeçalho de mídia fica gravado em `mediaUrl`.
- **RF-9 — Cartão no editor.** O cartão mostra o texto. Botão de link aparece como uma linha "🔗 <texto do botão>".
  Cabeçalho de mídia aparece como "Imagem", "Vídeo" ou "Documento" acima do texto.
- **RF-10 — MCP (spec 0142).** O catálogo de blocos ensina os campos novos, e as travas valem pelos dois caminhos:
  - `ctaText` e `ctaUrl` no tipo `CTA_URL`;
  - `header {type, text, mediaUrl, fileName}`;
  - `footerText`;
  - `description` em cada item.

### Não-funcionais

- **RNF-1:** nenhuma migration, flag ou função nova no Inngest. Tudo vive no `data` do nó, que já é `Json`.
- **RNF-2:** os outros que chamam `sendInteractive` não mudam de comportamento, porque os campos novos são opcionais:
  - Astro bot;
  - aprovações do catálogo;
  - resposta codificada da IA.
- **RNF-3:** os limites da Meta são conferidos no envio com a mesma regra de hoje: título de opção longo falha com uma
  frase clara, e texto livre longo é encurtado com "…" (`shorten`).

## 4. Critérios de aceite

- **CA-1:** um bloco com botão de link "Ver cardápio" e endereço `https://exemplo.com/cardapio` chega no WhatsApp
  oficial com o botão, e o toque abre o site.
- **CA-2:** botões de resposta com cabeçalho de imagem chegam numa mensagem só, com a foto em cima. O clique segue o
  caminho do botão, como hoje.
- **CA-3:** lista com descrição nos itens mostra a descrição sob cada título, e o clique segue o caminho do item.
- **CA-4:** o rodapé aparece em cinza embaixo do texto nos três tipos.
- **CA-5:** num número Uazapi, o botão de link chega como texto com o link clicável. O cabeçalho de imagem chega como
  foto seguida do menu.
- **CA-6:** com endereço sem `https://`, o cartão mostra o aviso de bloco incompleto e o fluxo não liga.
- **CA-7:** pelo MCP, `flowastro_create_flow` com um bloco `CTA_URL` cria o bloco igual ao feito pela tela.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Variável vazia no endereço (`https://site.com/{cupom}` sem cupom) | Envia com o trecho vazio; o fluxo não tenta adivinhar. O aviso no editor sugere variável que sempre exista. |
| CB-2 | Variável que muda o domínio (`https://{{site}}`) | O cartão mostra o aviso, o fluxo não liga (tela e MCP) e o envio recusa: a variável só pode entrar depois do domínio, para o fluxo não virar um redirecionador para qualquer site. |
| CB-3 | Trocar de lista para botão com cabeçalho de mídia | O cabeçalho de mídia continua; ao voltar para lista, ele vira "nenhum", porque a lista só aceita título. |
| CB-4 | Vídeo de cabeçalho em H.264 perfil High | Mesmo problema da spec 0141, CB-5: pode não tocar no Android. Mesmo aviso na tela. |
| CB-5 | Janela de 24h fechada | Mesmo comportamento dos botões de hoje: modelo reserva, se houver; sem ele, o passo falha com a mensagem de sempre. |
| CB-6 | Bloco antigo sem os campos novos | Sai como hoje. Nenhum campo novo é obrigatório. |
| CB-7 | Mídia do cabeçalho apagada do armazenamento | A Meta recusa ao baixar e o passo falha com o erro do provedor, como acontece com imagem hoje. |

## 6. Decisões de design

### D-1 — Botão de link no mesmo bloco, não num bloco novo
Fica dentro da aba Texto, como alternativa aos botões de resposta, porque é uma mensagem de texto com um botão. Um bloco
novo duplicaria o envio, a janela de 24h, o histórico e a cobrança de Stars. Custo: a aba Texto ganha um seletor a mais.

### D-2 — Cabeçalho de mídia por `link`, não por `id`
A Meta recomenda subir a mídia e mandar o `id`, mas aceita `link`. Imagem, áudio e vídeo do fluxo já usam `link` (R2
público). Mandar por `id` exigiria subir a mídia na Meta a cada envio, ou guardar o `id`, que expira em 30 dias.
Revisitar só se a Meta deixar de aceitar `link`.

### D-3 — Variável só depois do domínio no endereço
Evita que um dado do cliente (nome, resposta de pergunta) mude para qual site o botão leva (CB-2). O endereço sem as
variáveis precisa ser um `https://` válido com domínio fixo. A mesma regra (`linkButtonUrlProblem`) vale no cartão,
ao ligar o fluxo (`setAttendanceFlowActive`) e no envio. O editor salva sozinho, então "não salvar" não existe: a trava
fica em ligar e enviar.

### D-4 — Um tipo `CTA_URL` no payload, não um "modo" dentro de `BUTTONS`
`BUTTONS` espera o clique e tem uma saída por botão. O botão de link não espera nada e tem só "Próximo passo". Misturar
os dois num tipo faria o executor perguntar "é link?" em todo lugar que hoje trata `BUTTONS`.

## 7. Impacto

- **Editor:**
  - `block-panel.tsx`: seletor da RF-1, campos de cabeçalho, rodapé, descrição e link;
  - `block-preview.ts`;
  - aviso de bloco incompleto.
- **Executor:** `apps.ts`, com o ramo `CTA_URL` e o cabeçalho no ramo `BUTTONS`.
- **Envio:**
  - `send-buttons-to-lead.ts`: cabeçalho e descrição;
  - um `send-link-button-to-lead.ts` novo, ou junto, se couber sem `if` espalhado;
  - `http/whats-oficial/send-interactive.ts`: cabeçalho e `cta_url`;
  - `SendCanonicalInteractive` com `header?` e `cta?`.
- **Validação:** `dialog.tsx`, com o schema do payload `CTA_URL` e os campos novos em `BUTTONS`.
- **MCP:** `mcp-format.ts`, com o catálogo e as conversões.
- **Docs:** `docs/whatsapp-oficial-overview.md` (regra 14) e a spec 0139 (changelog).
- **Fora:** schema Prisma, Inngest e webhook. O clique em botão e lista já volta como hoje, e o botão de link não volta.

## 8. Plano de testes

- **CA-1 a CA-5:** envio real no número oficial de teste e num Uazapi, com print de cada caso.
- **CA-6 e CB-2:** pelo editor (bloco incompleto e fluxo que não liga) e pelo MCP (aviso no retorno).
- **CA-7:** criar pelo MCP e comparar o `data` gravado com o de um bloco feito pela tela.
- **Regressão:** um fluxo antigo com botões e lista continua igual (CB-6), e o Astro bot e as aprovações seguem
  mandando botões.

## 9. Riscos e rollback

- **Risco principal:** mexer em `send-interactive.ts`, que outros recursos usam. Mitigação: campos novos opcionais e o
  teste de regressão da seção 8.
- **Rollback:** reverter o PR. Blocos criados com `CTA_URL` param de enviar (o passo falha com "tipo desconhecido") até
  serem trocados para texto. Não há migration para desfazer.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-11-27 | João Gabriel | Rascunho a partir das páginas de mensagens interativas da Meta (botão de link, lista, botões e carrossel). |
| 2026-11-27 | João Gabriel | Aprovada e implementada. Botão de link reusa `sendButtonsToLead` (com `cta`), sem arquivo novo de envio. D-3 vale ao ligar e no envio, porque o editor salva sozinho. Falta o envio real (CA-1 a CA-5). |
