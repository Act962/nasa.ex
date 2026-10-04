---
id: 0064
titulo: Criar, ajustar e aprovar posts do Planner pelo WhatsApp com o Astro
dominio: nasa-planner
status: implementada
autor: Weydson + Claude
criada: 2026-10-04
atualizada: 2026-10-04
branch: feature/W-orbita-melhorias-ui-ux-2-20261004
pr:
peso: completa
---

# 0064 — Criar, ajustar e aprovar posts do Planner pelo WhatsApp com o Astro

## 1. Contexto

Fase B do roteiro de conteúdo (Fase A = spec 0063). O Astro já atende membros vinculados pelo WhatsApp (`astro-bot`), com confirmação por texto (SIM/NÃO — botões da Uazapi não chegam ao aparelho e o clique cai fora do gate do bot). Mas no WhatsApp ele usa o escopo `insights` (só leitura) e não enxerga o pacote `planner`; também não envia imagem. A aprovação de posts só existe na tela.

## 2. Objetivo

Quem tem papel no Planner pede um post pelo WhatsApp, ajusta, cria o rascunho (que já vai para aprovação), e quem aprova recebe a prévia no WhatsApp e aprova ou pede ajuste respondendo por texto.

### Não-objetivos

- Botões interativos (seguem desligados na base do bot).
- Gerar imagem/vídeo com IA (não-objetivo herdado da 0063).
- Mudar o roteamento do webhook de WhatsApp.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Escopo `insights` (WhatsApp sem financeiro) passa a incluir o pacote `planner` (leitura + propostas com confirmação) e seu prompt. O escopo `assistant` já inclui. |
| RF-2 | Pedido de post pelo WhatsApp: o Astro confere o kit, monta a prévia (roteiro, legenda, quando) e propõe o rascunho; "SIM" cria. Pelo WhatsApp, o rascunho criado vai direto para aprovação. |
| RF-3 | Ajuste: "ajustar/ajuste …" faz o Astro refazer a proposta (cartão novo substitui o anterior). |
| RF-4 | Enviado para aprovação (tela ou WhatsApp): cada aprovador com número vinculado ao Astro na empresa recebe a prévia — imagem do post quando houver — e "Responda SIM para aprovar ou AJUSTE: o que mudar". |
| RF-5 | "SIM" do aprovador aprova; se o post tem horário futuro, já programa. "AJUSTE: motivo" pede ajuste com o motivo e avisa quem pediu. |
| RF-6 | Perguntas ("qual a legenda do post de amanhã?") e reprogramação ("muda pra 19h", com confirmação) usam as tools do pacote. |
| RF-7 | O canal do bot ganha `sendMedia` (imagem com legenda) pelo provider ativo da tracking. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Aviso de aprovação roda em Inngest (I/O fora da requisição e fora de transação — Regra 18). |
| RNF-2 | Aprovação pelo WhatsApp é decisão humana: só o "SIM" do próprio aprovador, na sessão dele, executa. |
| RNF-3 | Só aprovadores com permissão de aprovar no Planner da empresa e vínculo ativo recebem o aviso. |

## 4. Critérios de aceite

- [x] **CA-1** — "cria um carrossel sobre X pra sexta 18h" pelo WhatsApp devolve a prévia com "Responda SIM…"; "SIM" cria o rascunho em aprovação.
- [x] **CA-2** — Aprovador vinculado recebe a prévia no WhatsApp ao enviar para aprovação.
- [x] **CA-3** — "SIM" do aprovador aprova (e programa se houver horário futuro).
- [x] **CA-4** — "AJUSTE: motivo" pede ajuste com o motivo.
- [x] **CA-5** — Pergunta sobre um post ("qual a legenda do post Kit da Marca…?") responde com o post certo. (Reprogramar por mensagem — "muda pra 19h" — não foi testado: nenhum post de teste tinha mídia para ser programado.)

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Aprovador sem número vinculado | Só o aviso no sino (já existente). |
| CB-2 | Aviso pendente expirou | "SIM" não acha cartão; o Astro diz para abrir o Planner. |
| CB-3 | Aprovador responde AJUSTE sem aviso pendente | Vai para o orquestrador normalmente. |
| CB-4 | Post sem imagem | Aviso só em texto. |
| CB-5 | Quem pediu também é aprovador | Recebe o aviso como os demais (pode aprovar o próprio, como na tela). |

## 6. Decisões de design

### D-1 — Confirmação por texto, não botão
A base do bot desligou botões (medido: a Uazapi aceita e não entrega). Reaproveitar `decideLatestCardByText` mantém um caminho só.

### D-2 — Aviso de aprovação como `AstroPendingAction` na sessão do aprovador
Assim o "SIM" do aprovador cai no mesmo `confirmPendingAction`, com dono, validade e auditoria — sem estado novo.

### D-3 — Planner no escopo `insights`
O pacote só escreve por proposta confirmada; abrir só o Planner no WhatsApp sem financeiro não expõe as escritas do financeiro.

## 7. Plano de implementação

- `tool-scope.ts`: escopo `insights` com pacote `planner` + tools de confirmação; `orchestrator.ts` anexa o prompt do pacote.
- `astro-bot/lib/types.ts` + `tracking-provider-channel.ts` (+ `uazapi-channel.ts`): `sendMedia`.
- `nasa-planner/server/approval-whatsapp.ts` + Inngest `nasa-planner/approval.whatsapp-notify`; disparo no fim de `submitPostForApproval`.
- Executores `planner.post.approve`; resposta "AJUSTE:" em `astro-bot/lib/router.ts` (antes das camadas baratas).
- `executors.ts`: rascunho criado pelo WhatsApp vai para aprovação.
- Docs: `docs/nasa-planner-overview.md`.

## 8. Changelog

- 2026-10-04 — criada e implementada. Testado com mensagens recebidas simuladas (`maybeHandleBotMessage`) e envio real pelo número UAZAPI do GOTHAN CODEX: pedido → cartão com roteiro, legenda, #orbitahub e "sexta-feira 09/10 às 18:00"; "Ajustar: legenda mais curta" → cartão novo; SIM → rascunho criado e enviado para aprovação; aviso de aprovação no WhatsApp; SIM do aprovador → "Aprovado. Não programei: o carrossel precisa de 2 a 10 itens"; "AJUSTE: …" → ajuste pedido; pergunta pelo nome do post → legenda certa.
- 2026-10-04 — Ajustes do teste: (1) o modelo imitava o cartão em texto sem chamar a tool (o SIM confirmaria o cartão antigo) → cartões saem do histórico do bot (`conversation-history.ts`), resposta que imita cartão sem proposta é descartada (`router.ts`) e "Ajustar…" com rascunho pendente é reescrito para refazer a proposta pela tool (`buildPlannerAdjustPrompt`); (2) `planner_brand_kit_status` devolve nome da marca, hashtags, CTAs e frases; cartão mostra roteiro e hashtags; data sem segundos; (3) aprovar e programar viraram passos separados (post sem mídia é aprovado e o motivo de não programar é dito); (4) aviso só vira cartão depois do envio dar certo; o canal do bot registra os providers sozinho (antes falhava fora da rota do webhook); (5) nova tool `planner_search_posts` (post pelo nome); confirmação no WhatsApp traz o link do post.
