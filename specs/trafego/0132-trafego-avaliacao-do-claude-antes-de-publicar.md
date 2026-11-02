---
id: 0132
titulo: trafeGO — o Claude avalia o pedido, o cliente libera e o Claude publica pela Meta
dominio: trafego
status: implementada
autor: Weydson Lima (com Claude)
criada: 2026-11-02
atualizada: 2026-11-02
branch: feature/W-trafego-ux-20261031
pr:
peso: completa
---

# 0132 — Avaliação do Claude antes de publicar

> Depende das specs 0129 (passo a passo guiado pelo criativo), 0130 (pedido completo e "Precisa de aprovação") e
> 0131 (trafeGO no MCP do ÓRBITA). **Reescrita em 2026-11-02**: a primeira versão partia da campanha criada pelo
> painel com o token da Meta da empresa (spec 0124). O dono corrigiu: quem cria e põe o anúncio no ar é o **Claude
> da equipe, com o MCP da Meta** ligado à conta de anúncios. O ÓRBITA não precisa de token da Meta.

## 1. Contexto

O cliente monta o pedido em `/trafego` (0129/0130): criativo, texto, título, mensagem inicial do WhatsApp,
público, região, verba e prazo. Hoje, depois disso, a equipe abre o admin, copia o prompt (0130), cola no Claude,
o Claude monta a campanha pela Meta e a equipe devolve recomendações para o cliente aprovar.

O MCP do ÓRBITA (0131) já entrega o pedido para a IA da equipe. Falta fechar o ciclo **sem gente no meio**:

1. o Claude **avalia** o pedido assim que o cliente termina;
2. o cliente **libera** a publicação no painel (é a autorização dele);
3. o Claude **publica** pela Meta e marca o pedido como no ar.

## 2. Objetivo

Uma rotina do Claude roda **a cada 2 horas** e faz duas coisas:

- **Avaliar** os pedidos completos que esperam avaliação. Resultado no painel do cliente:
  - **Aprovado** → botão **"Aprovado, publicar"**;
  - **Ajustes** → botão **"Avaliar melhorias e aprovar"**.
- **Publicar** os pedidos que o cliente liberou: cria a campanha pelo MCP da Meta, vincula ao pedido e põe no ar.

### Não-objetivos

- **O ÓRBITA não chama a Meta para criar nada.** Criar e ativar é do Claude, pelo MCP da Meta dele.
- **Token da Meta da empresa.** Não é pré-requisito deste fluxo. O construtor do painel (0124) segue existindo para
  quem tem token, sem trava nova.
- **Cron ou Inngest novo** (S11). Quem roda é a rotina do Claude, fora da plataforma.
- **Stars.** A avaliação usa a assinatura do Claude da equipe.
- **Campanha já no ar.** Ajustes depois de publicar seguem pelo `trafego_send_recommendation` (0130/0131).

## 3. Requisitos

### Funcionais

- **RF-1 — O pedido completo entra na fila sozinho.** Quando o pedido tem criativo e texto (fim do passo a passo,
  ou quando o cliente envia o que faltava), ele vai para **Em análise** (`IN_REVIEW`) e ganha a hora de entrada na
  fila. No painel do cliente: "A equipe avalia seu anúncio em até 2 horas".
- **RF-2 — Status que já existem, sem enum novo.** A avaliação usa os status do pedido:
  - `IN_REVIEW` = esperando a avaliação;
  - `CHANGES_REQUESTED` = ajustes pedidos;
  - `SCHEDULED` = aprovado pela equipe (esperando o cliente liberar ou a data de início);
  - `RUNNING` = no ar, depois que o Claude publica.
- **RF-3 — A avaliação é a recomendação da 0130.** O resultado vira o mesmo evento "Precisa de aprovação"
  (`requiresApproval`), com o resumo do Claude. Assim o selo, o cartão e o "o cliente aprovou" da 0130 valem
  sem código novo. Uma aprovação só: o cliente não aprova duas coisas.
- **RF-4 — Aprovado.** O cartão da 0130 mostra o resumo e o botão **"Aprovado, publicar"**. O clique grava a
  aprovação do evento (a autorização do cliente) e o painel passa a dizer "A equipe publica em até 2 horas".
- **RF-5 — Ajustes: "Avaliar melhorias e aprovar".** Abre a lista do que o Claude pediu.
  - **Melhorias aplicáveis** (o painel grava no pedido sozinho): texto do anúncio, título, mensagem inicial do
    WhatsApp e descrição do público.
  - **Observações** (o cliente resolve): trocar o criativo, mandar outra foto, ajustar a oferta.
  - Só melhorias aplicáveis: o botão **aplica todas e aprova de uma vez**. O pedido fica liberado para publicar
    sem nova avaliação, porque o texto aplicado é exatamente o que o Claude escreveu.
  - Com observação: o cliente resolve pelo painel e o pedido volta para a fila (RF-6).
- **RF-6 — A aprovação vale para a versão avaliada.** O pedido tem uma **impressão digital** (hash) do que vai
  para a Meta: criativos ativos, texto e título escolhidos, mensagem inicial, público, região, verba e prazo.
  - O Claude recebe a impressão digital ao ler o pedido e a devolve ao avaliar. Se o cliente mudou algo no meio,
    a avaliação é recusada.
  - O cliente mudou algo depois da aprovação: o pedido volta para `IN_REVIEW` e a aprovação antiga deixa de valer.
  - Na hora de publicar, o Claude confere a impressão digital de novo (`trafego_get_publish_brief`).
- **RF-7 — Ferramentas no MCP** (só chave com escopo `trafego`, mesma conferência da 0131):
  - `trafego_list_review_queue` — duas listas, mais antigos primeiro: **para avaliar** (`IN_REVIEW`) e **para
    publicar** (aprovados pelo cliente, com a data de início já chegada e sem campanha vinculada).
  - `trafego_get_order_for_review` — tudo o que vai para a Meta, as regras da Meta, o histórico da conta (0129) e
    o **criativo como imagem** (a imagem enviada, ou um quadro do vídeo, mais o texto lido nele). Devolve a
    impressão digital.
  - `trafego_review_order` — `{ code, fingerprint, verdict: "approved" | "changes", summary, fixes?, notes? }`.
    `fixes` só aceita os campos aplicáveis do RF-5.
  - `trafego_mark_published` — depois de criar a campanha pelo MCP da Meta: confere que o cliente liberou e que a
    versão é a aprovada, grava o id da campanha (reaproveita `trafego_link_meta_campaign`) e leva o pedido a
    `RUNNING`, avisando o cliente.
- **RF-8 — Aviso ao cliente.** Em cada passo (aprovado, ajustes, no ar): evento no histórico e WhatsApp.
- **RF-9 — Saída de emergência.** No admin do pedido, o admin do sistema pode **aprovar à mão** (mesma função do
  MCP) e **marcar como publicado** depois de criar a campanha por fora.
- **RF-10 — Rotina documentada.** Prompt, horário e como ligar em `docs/trafego-rotina-avaliacao.md`. A rotina:
  1. `trafego_list_review_queue`;
  2. **avaliar**: para cada pedido, `trafego_get_order_for_review` → `trafego_review_order`;
  3. **publicar**: para cada pedido liberado, `trafego_get_publish_brief` → cria a campanha pelo MCP da Meta
     (campanha de WhatsApp, nome com o código do pedido) → ativa → `trafego_mark_published`;
  4. nunca publica pedido que o cliente não liberou.
- **RF-11 — Liga e desliga.** `TRAFEGO_CAMPAIGN_REVIEW=true` liga a entrada automática na fila (RF-1) e os botões
  novos. Ausente = o pedido segue o fluxo manual de hoje (0130). **Condição de remoção**: duas semanas com a rotina
  em produção sem pedido parado mais de 4 horas na fila → apagar o flag e o caminho manual.

### Não-funcionais

- **RNF-1 — Sem estado na memória.** A fila é o banco; a rotina roda em qualquer máquina.
- **RNF-2 — Sem segredo na resposta.** Criativo por imagem embutida ou link assinado de 24 h; nunca token.
- **RNF-3 — Nada de Meta no ÓRBITA.** As ferramentas leem e gravam só o banco do ÓRBITA.

## 4. Critérios de aceite

- **CA-1** — Flag ligado: pedido completo vai para `IN_REVIEW` e aparece em `trafego_list_review_queue`.
- **CA-2** — `trafego_review_order` com `approved`: pedido em `SCHEDULED`, cartão com "Aprovado, publicar".
- **CA-3** — O cliente clica "Aprovado, publicar": o pedido aparece em "para publicar" na fila.
- **CA-4** — Com `changes` + `fixes` (texto e mensagem inicial): "Avaliar melhorias e aprovar" grava os dois no
  pedido e o libera para publicar sem nova avaliação.
- **CA-5** — Com `notes`: o botão não libera direto; depois que o cliente troca o criativo, o pedido volta para a
  fila.
- **CA-6** — O cliente muda o texto depois de aprovado: volta para `IN_REVIEW` e some de "para publicar".
- **CA-7** — Avaliação com impressão digital velha é recusada: "o cliente mudou o pedido, leia de novo".
- **CA-8** — `trafego_mark_published` em pedido não liberado é recusado; liberado, leva a `RUNNING` e avisa.
- **CA-9** — Admin aprova à mão; o cliente vê "Aprovado, publicar".
- **CA-10** — `trafego_get_order_for_review` devolve o criativo como imagem e nenhum token.
- **CA-11** — Flag desligado: nada muda no fluxo de hoje.

## 5. Casos de borda

- **CB-1 — Pedido sem criativo ou sem texto**: não entra na fila; o painel continua pedindo o que falta.
- **CB-2 — Data de início no futuro**: liberado, mas só entra em "para publicar" no dia.
- **CB-3 — Rotina parada**: o admin vê a idade na fila e aprova ou marca como publicado à mão (RF-9).
- **CB-4 — Pedido pausado, cancelado ou reembolsado**: sai da fila.
- **CB-5 — Vídeo**: o Claude recebe um quadro e o texto lido no vídeo (o que a análise do Astro já guarda) e diz
  no resumo que avaliou pelo quadro.
- **CB-6 — Cliente libera e muda o pedido antes da publicação**: `trafego_mark_published` recusa (versão
  diferente) e o pedido volta para a fila.

## 6. Decisões de design

### D-1 — O pedido é o rascunho

Sem token da Meta no ÓRBITA, o rascunho não pode morar na Meta. Ele já mora no pedido: criativos
(`TrafegoCreative`), texto escolhido (`TrafegoCopy`), mensagem inicial e orientação do Astro (briefing do
passo a passo), público, região, verba e prazo. A avaliação olha o pedido.

### D-2 — Status existentes + 4 colunas no pedido, sem tabela e sem enum

`IN_REVIEW`, `CHANGES_REQUESTED`, `SCHEDULED` e `RUNNING` já dizem onde o pedido está. Faltam só os dados da
avaliação, em colunas de `trafego_order`:

- `review_requested_at` — entrada na fila (ordem da fila e a idade no admin);
- `review_fingerprint` — versão aprovada (RF-6);
- `review_fixes` (`Json`) — melhorias aplicáveis, validadas por Zod na entrada e na leitura; pacote que o painel
  aplica inteiro, nunca filtrado ou somado (S3);
- `review_notes` (`text[]`) — observações para o cliente.

O resumo do Claude fica no evento (RF-3). A liberação do cliente é a aprovação do evento (`approved_at`), que já
existe.

### D-3 — Uma aprovação só (unifica com a 0130)

A avaliação é a recomendação da 0130 com resultado estruturado. O "Aprovar" da 0130 vira "Aprovado, publicar"
quando o evento é uma avaliação. A ferramenta `trafego_send_recommendation` continua para ajustes de campanha
no ar.

### D-4 — Rotina do Claude a cada 2 horas

Decidido com o dono. Zero Inngest e zero Stars. Custo: até 2 horas para avaliar e até 2 horas para publicar depois
da liberação — a tela diz isso. **A confirmar na implementação**: se a rotina na nuvem do Claude usa o MCP do
ÓRBITA (cabeçalho da chave) e o MCP da Meta ao mesmo tempo. Se não, roda como tarefa agendada no app do Claude no
computador da gestora.

### D-5 — O que sai da primeira versão

A primeira implementação desta spec (ainda não em produção) travava a campanha criada pelo painel com token:
colunas em `meta_ad_campaigns`, travas em publicar, retomar e ligar anúncio, e o arquivamento na troca de
anúncio. **Tudo isso sai**: as colunas, o enum, as travas e o cartão. A migration volta a não mexer em
`meta_ad_campaigns`.

### D-6 — Reaproveitar

- Ler o pedido: `loadOrderPublishPrompt` (0130), `loadWizardAccountContext` (0129), quadros do criativo da análise
  do Astro (0126).
- Aprovação: evento `requiresApproval` e `approveTrafegoRecommendation` (0130).
- Publicar: `linkOrderToMetaCampaign` (0131) e `transitionTrafegoOrder`.
- MCP: `guardTrafegoTool` (0131).

## 7. Impacto

- **Schema:** 4 colunas em `trafego_order` (D-2). Sem tabela e sem enum. Migration aditiva, somada à da branch.
- **Código:**
  - `src/features/trafego/lib/order-review.ts` (puro): impressão digital do pedido, melhorias aplicáveis, regras.
  - `src/features/trafego/server/lib/order-review.ts`: entrar na fila, gravar avaliação, aplicar melhorias,
    conferir antes de publicar, marcar como publicado.
  - Pontos de entrada na fila: fim do passo a passo e envio de criativo/texto pelo painel.
  - `trafego-review-mcp-tools.ts`: as quatro ferramentas do RF-7.
  - Painel: o cartão da 0130 ganha "Aprovado, publicar" e "Avaliar melhorias e aprovar".
  - Admin: "Aprovar à mão" e "Marcar como publicado".
  - Remover o que o D-5 lista.
- **Env:** `TRAFEGO_CAMPAIGN_REVIEW` (RF-11), lida no servidor em tempo de execução.
- **Docs:** `docs/trafego-rotina-avaliacao.md`, `docs/trafego-overview.md`, `docs/trafego-playbook-gestor.md`,
  `CLAUDE.md`. Guias do Astro (regra 21): âncora do botão "Avaliar melhorias e aprovar".

### Segurança de dados

- Só chave com escopo `trafego` de admin do sistema avalia e marca como publicado (0131, RF-2).
- Liberar e aplicar melhorias: owner/admin da org do pedido, como no "Aprovar" da 0130 (escopo pela org da
  sessão).
- O cliente aplica só as melhorias guardadas no servidor; não manda valores.
- O cliente vê resumo e melhorias, nunca o nome da chave nem dados de outra empresa.

### Regras da Meta

- Nada vai ao ar sem a liberação do cliente. O Claude só publica pedido liberado e na versão aprovada.
- A avaliação segue `META_AD_TEXT_RULES` e `ad-policies` (atributo pessoal, promessa de resultado, saúde).
- Aprovar não dispensa a revisão da Meta: o painel avisa que a Meta ainda revisa o anúncio.

## 8. Plano de testes

- `scripts/trafego-0132-qa-check.ts`: impressão digital do pedido (muda com texto, criativo, público, verba e
  prazo; não muda com status), validação de `fixes`, "só aplicáveis = libera direto" (CA-4, CA-5).
- Chamada real ao `/api/mcp` local com um pedido de teste: CA-1, CA-2, CA-7, CA-8, CA-10.
- Navegador, logado como dono da org do pedido: CA-2 a CA-6.

## 9. Riscos e rollback

- **Rotina parada**: pedido parado na fila. Mitigação: prazo na tela, idade no admin, aprovação e publicação à mão.
- **O Claude publica algo errado na Meta**: só publica o que o cliente liberou, com a versão conferida; a campanha
  fica vinculada ao pedido e o painel mostra os números (0122).
- **Cliente se irrita com a espera**: o flag desliga sem deploy.
- **Rollback:** desligar `TRAFEGO_CAMPAIGN_REVIEW`. As colunas ficam sem uso e saem numa migration separada se o
  fluxo for abandonado (S9).

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-11-02 | Weydson Lima (com Claude) | Criação. Rotina a cada 2 horas decidida pelo dono. |
| 2026-11-02 | Weydson Lima (com Claude) | Primeira implementação sobre a campanha criada pelo painel (token da Meta). |
| 2026-11-02 | Weydson Lima (com Claude) | **Reescrita.** Quem cria e publica é o Claude pelo MCP da Meta; o rascunho é o pedido. Status existentes + 4 colunas em `trafego_order`; avaliação unificada com a recomendação da 0130; ferramenta `trafego_mark_published`; a implementação sobre `meta_ad_campaigns` sai (D-5). |
| 2026-11-02 | Weydson Lima (com Claude) | Implementada (versão do pedido). `lib/order-review.ts`, `server/lib/order-review.ts`, `order-review-actions.ts`, `order-review-draft.ts`, `trafego-review-mcp-tools.ts`, `OrderReviewStatus` no painel e `OrderReviewCard` no admin. Entrada na fila em `transitionTrafegoOrder` (ao chegar a `MATERIALS_SUBMITTED`). O aprovar simples da 0130 é recusado quando a avaliação pediu ajustes. Sem a Meta nos Satélites, `trafego_mark_published` grava o id sem conferir e registra nota interna. QA: `scripts/trafego-0132-qa-check.ts` (20 ok). |
