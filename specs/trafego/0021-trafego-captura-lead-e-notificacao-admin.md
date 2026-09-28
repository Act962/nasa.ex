---
id: 0021
titulo: Captar lead do trafeGO no passo Contato e avisar os admins por popup
dominio: trafego
status: implementada # rascunho | em-revisao | aprovada | implementada | descartada
autor: João Gabriel
criada: 2026-09-21
atualizada: 2026-09-22
branch: claude/trafego-improvements-58fa5b
pr:
peso: completa
---

# 0021 — Captar lead do trafeGO no passo Contato e avisar os admins por popup

---

## 1. Contexto

Hoje o card do cliente no tracking só nasce em `/api/checkout/trafego`, depois
que a pessoa aceitou os termos e escolheu forma de pagamento
([`route.ts:324`](../../src/app/api/checkout/trafego/route.ts)):

```ts
await ensureTrafegoLeadForPending(pending.id);   // coluna AWAITING_PAYMENT
```

Quem preenche nome, e-mail e WhatsApp no wizard e desiste antes de pagar **não
deixa rastro nenhum**. Não há card, não há conversa, não há como o time abordar.
Esses contatos são de campanha paga — cada um custou dinheiro para chegar ali.

A spec [0001 da PR anterior](../../specs/trafego/0020-trafego-pix-asaas.md)
reordenou o wizard: **Contato virou o passo 5** e Investimento/pagamento virou o
6. Isso abriu a janela: existe agora um ponto do fluxo em que os três dados de
contato já estão validados e o pagamento ainda não começou.

Duas lacunas acompanham:

1. Não há audiência "admin do sistema" no resolver de alertas
   ([`audience-resolver.ts`](../../src/features/alerts/lib/audience-resolver.ts)
   só resolve por `Member.role` dentro de uma org).
2. O `AlertProvider` está montado **apenas** em
   [`(platform)/(tracking)/layout.tsx`](<../../src/app/(platform)/(tracking)/layout.tsx>).
   O `/admin` não tem provider nenhum — um admin olhando o painel do trafeGO
   não receberia popup mesmo que o servidor disparasse.

## 2. Objetivo

Quem conclui o passo Contato do wizard vira card num tracking configurável pelo
admin, e todo admin do sistema recebe um popup em tempo real com os dados dele —
mesmo sem pagamento.

### Não-objetivos

- **Não** mexe no card de operação que nasce no checkout. `ensureTrafegoLeadForPending`
  e o `statusColumnMap` continuam exatamente como estão.
- **Não** expira nem marca como perdido o lead que abandonou. Card fica no board
  até alguém mover (decisão do dono do produto; job de expiração fica para fase 2).
- **Não** dispara WhatsApp nem e-mail para o lead captado. Só notificação interna.
- **Não** cria UI de listagem nova no `/admin`. O lead é trabalhado no board de
  tracking que já existe.
- **Não** altera o `AlertCriticalPopup` nem o `AdminNotification`. Reaproveita
  `displaySurface: "popup"` como está.
- **Não** renomeia `User.isSystemAdmin`. Ver [D-4](#d-4--a-flag-é-issystemadmin-não-isadmin).

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Ao clicar "Continuar" no passo 5 (Contato) com nome, e-mail e telefone válidos, o wizard chama uma procedure pública que registra a captura. |
| RF-2 | A captura cria (ou reaproveita) um `Lead` na org, tracking e coluna configurados pelo admin. |
| RF-3 | O admin configura `captureOrganizationId`, `captureTrackingId` e `captureStatusId` em `/admin/trafego` — independentes de `agencyOrganizationId` / `operationsTrackingId`. |
| RF-4 | Sem configuração de captura, o wizard **avança normalmente** e nada é criado (log de warning, igual ao comportamento atual de `ensureTrafegoLead`). |
| RF-5 | Toda captura que cria card novo gera `AdminNotification` com `displaySurface: "popup"` para **cada** `User` com `isSystemAdmin = true`. |
| RF-6 | A notificação chega em tempo real por Pusher em `private-user-{userId}`, evento `alert:new`, e abre o `AlertCriticalPopup`. |
| RF-7 | O popup mostra nome, e-mail, telefone, canal e verba pensada, com link para o card do lead. |
| RF-8 | O `AlertProvider` passa a estar montado também no layout do `/admin`. |
| RF-9 | Captura repetida do mesmo telefone **não** gera card novo nem notificação nova. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | A procedure de captura é pública (sem sessão) — o wizard roda anônimo. Rate limit por telefone/IP igual ao já aplicado em `verification`. |
| RNF-2 | Falha na captura **nunca** bloqueia o avanço do wizard. Best-effort, igual ao bloco `try/catch` do checkout. |
| RNF-3 | A captura responde em < 1s no p95 — ela está no caminho do clique "Continuar". |
| RNF-4 | O fan-out de notificação não roda dentro de `$transaction` (CLAUDE.md regra 18). |

## 4. Critérios de aceite

- [x] **CA-1** — Dado admin com org/tracking/coluna de captura configurados, quando um visitante conclui o passo Contato, então existe `Lead` naquele tracking, naquela coluna, com nome/e-mail/telefone do formulário.
- [x] **CA-2** — Dado o mesmo visitante voltando e clicando "Continuar" de novo no Contato, então continua existindo **um** card e **nenhuma** notificação nova.
- [x] **CA-3** — Dado que a captura criou card, quando ela termina, então cada usuário com `isSystemAdmin = true` tem um `AdminNotification` com `displaySurface = "popup"` e `eventType = "TRAFEGO_LEAD_CAPTURED"`.
- [x] **CA-4** — Dado um admin com a aba aberta em `/admin/trafego`, quando a captura acontece, então o `AlertCriticalPopup` abre sem reload.
- [x] **CA-5** — Dado um usuário **sem** `isSystemAdmin`, quando a captura acontece, então ele não recebe notificação nem popup.
- [x] **CA-6** — Dado `captureTrackingId` não configurado, quando o visitante conclui o Contato, então o wizard avança para Investimento e nenhum card/notificação é criado.
- [ ] **CA-7** — Dado um lead captado que depois paga, quando o checkout roda, então o card de **operação** nasce normalmente e o card de **captura** continua onde estava.
- [ ] **CA-8** — Dado `captureTrackingId` apontando para tracking de outra org que não a de `captureOrganizationId`, quando o admin salva, então a procedure recusa com erro legível.
- [ ] **CA-9** — Dado um usuário com o board do tracking de captura **já aberto**, quando a captura cria o card, então ele aparece na coluna sem reload.
- [ ] **CA-10** — Dado um card criado pela captura, quando se abre a Jornada do lead, então existe um evento `form_submit` identificando o passo Contato do trafeGO.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Telefone já existe como lead **no tracking de captura** | Reusa o card. Atualiza e-mail se estava vazio. Sem notificação. |
| CB-2 | Telefone já existe **em outro tracking** (ex.: board de operação) | Cria card novo no tracking de captura. Não realoca — foi o realocar que causou o 500 da [spec 0001](../form/0001-form-submit-lead-placement.md). |
| CB-3 | Mesmo telefone com 8º/9º dígito diferente | Dedupe por `waIdLookupVariants`, igual a `ensureTrafegoLead`. |
| CB-4 | E-mail igual, telefone diferente | Cria card novo. Telefone é a chave (é por ele que o chat encontra a pessoa). |
| CB-5 | `captureStatusId` aponta para coluna apagada | Cai na primeira coluna do tracking (`order asc`), igual a `resolveColumnStatusId`. |
| CB-6 | Tracking de captura sem nenhuma coluna | Não cria card, loga warning, wizard avança. |
| CB-7 | Visitante volta ao passo 4, muda o negócio e avança de novo | Mesmo card (mesmo telefone); atualiza a descrição. Sem notificação nova. |
| CB-8 | Dois visitantes com o mesmo telefone em paralelo | `@@unique([phone, trackingId])` no `Lead` garante um card. A segunda gravação cai no caminho "já existe". |
| CB-9 | Nenhum `User` com `isSystemAdmin = true` | Card criado, zero notificação, sem erro. |
| CB-10 | Pusher fora do ar | `AdminNotification` gravado mesmo assim; o bell pega no próximo fetch. Erro logado, captura considerada sucesso. |
| CB-11 | Visitante conclui Contato e **nunca** volta | Card fica na coluna de captura indefinidamente (não-objetivo: expiração). |
| CB-12 | Visitante logado com `repeatDefaults` (cliente recorrente) | Mesma regra. O card antigo dele provavelmente já existe → CB-1. |
| CB-13 | Telefone inválido/vazio ao burlar o client | Procedure valida com o mesmo Zod do checkout e recusa. Wizard avança mesmo assim (RNF-2). |
| CB-14 | Captura roda, depois a pessoa paga com **outro** telefone | Dois cards distintos, um em cada board. Aceito — telefone é a identidade. |

## 6. Decisões de design

### D-1 — Tracking de captura separado do tracking de operação

- **Escolha**: três campos novos em `TrafegoSettings` — `captureOrganizationId`,
  `captureTrackingId`, `captureStatusId`.
- **Alternativas descartadas**: adicionar uma coluna `LEAD_CAPTURED` ao
  `TRAFEGO_KANBAN_COLUMNS` e reusar `operationsTrackingId`. Descartada porque o
  board de operação é a mesa do **gestor de tráfego** (um card por pedido pago,
  uma coluna por status de execução); misturar lead frio ali polui o funil de
  quem já é cliente, e prende a captura à org da agência.
- **Consequência**: um cliente que paga aparece em **dois** boards — captura e
  operação. É intencional: são dois times e dois momentos. Registrado em CA-7.

### D-2 — Captura é procedure própria, não reuso de `ensureTrafegoLeadForPending`

- **Escolha**: `trafego.captureLead` público + `ensureTrafegoCaptureLead` no server.
- **Alternativas descartadas**: criar a `TrafegoPendingPurchase` já no Contato e
  chamar o `ensureTrafegoLeadForPending` que existe. Descartada porque a pendência
  carrega verba, taxa, termos aceitos e método de pagamento — nada disso existe no
  passo 5. Gravar pendência com valores provisórios sujaria o funil de compras,
  os relatórios e o job de recuperação de carrinho.
- **Consequência**: um caminho de escrita a mais, mas sem contaminar o modelo de
  compra. A dedupe por telefone é compartilhada (helper extraído).

### D-3 — Sem tabela nova; o `Lead` é o registro da captura

- **Escolha**: a captura grava direto em `Lead`, sem `TrafegoLeadCapture`.
- **Alternativas descartadas**: tabela própria de captura. Descartada porque o
  objetivo declarado é usar **chat e demais ferramentas** com esse contato — todas
  penduradas em `Lead`. Uma tabela paralela exigiria sincronizar as duas.
- **Consequência**: não há histórico de "quantas vezes esse telefone passou pelo
  Contato". Se isso virar necessidade, entra como `LeadEvent`, não como tabela.

### D-4 — A flag é `isSystemAdmin`, não `isAdmin`

- **Escolha**: usar `User.isSystemAdmin`, que é o campo real do schema e o que o
  `requireAdminMiddleware` já confere.
- **Alternativas descartadas**: criar `isAdmin`. Não existe no schema; `Member.role`
  (`admin`/`owner`) é permissão **dentro de uma org**, escopo diferente do pedido.
- **Consequência**: nenhuma migration para isso. Vale registrar que o pedido dizia
  "isAdmin = true" e o campo equivalente é `isSystemAdmin`.

### D-5 — Fan-out reusa `createNotification`, não escreve `AdminNotification` na mão

- **Escolha**: laço sobre os admins chamando
  [`createNotification`](../../src/features/admin/lib/notification-service.ts)
  com `severity: "warning"` e `displaySurface: "popup"`.
- **Alternativas descartadas**: um `AdminNotification` com `targetType: "all"`.
  Descartada porque o `AlertProvider` escuta `private-user-{id}`; sem um registro
  por usuário não há a quem disparar, e o ack por usuário se perde.
- **Consequência**: N escritas para N admins. Aceitável — a equipe NASA é pequena
  e a captura é um evento de baixa frequência.

### D-6 — `AlertProvider` sobe para o layout do `/admin`

- **Escolha**: montar `AlertProvider` em `(admin)/admin/layout.tsx`.
- **Alternativas descartadas**: mover para o layout raiz. Descartada porque ele
  assina Pusher e chama `alerts.pendingCriticals` — não pode rodar nas páginas
  públicas (`/trafego`), que são anônimas.
- **Consequência**: o `AlertProvider` passa a existir em dois lugares. Ele já é
  idempotente por `userId`, e as duas árvores nunca coexistem.

### D-7 — Notificação só no card **novo**

- **Escolha**: notifica apenas quando a captura criou lead; reuso é silencioso.
- **Alternativas descartadas**: notificar toda conclusão do passo Contato.
  Descartada porque quem volta no wizard dispararia popup a cada ida e volta —
  o popup exige ack e viraria ruído que o time aprende a fechar sem ler.
- **Consequência**: um cliente recorrente que recompra não gera popup. Esse caso
  já é coberto pelo card de operação no checkout.

## 7. Impacto

- [x] Schema / migration (`prisma/schema.prisma`) — 3 colunas nullable em `TrafegoSettings`
- [x] Procedures oRPC (contrato de entrada/saída) — `trafego.captureLead` (pública), `admin.settings.update` (3 campos)
- [x] Realtime (Pusher / event-bus) — reusa `alert:new` em `private-user-{id}`
- [ ] Automações (Inngest)
- [ ] Env vars novas
- [ ] Breaking change para clientes existentes
- [x] Documentação obrigatória — este arquivo + changelog

Arquivos tocados (estimativa):

| Camada | Arquivo | Mudança |
| --- | --- | --- |
| Schema | `prisma/schema.prisma` | +3 campos em `TrafegoSettings` |
| Server | `src/features/trafego/server/lib/ensure-trafego-lead.ts` | extrai helper de dedupe; +`ensureTrafegoCaptureLead` |
| Server | `src/features/trafego/server/lib/notify-lead-captured.ts` | **novo** — fan-out para `isSystemAdmin` |
| Server | `src/features/trafego/server/lib/trafego-settings.ts` | +3 campos no tipo e no load |
| Router | `src/app/router/trafego/public/capture-lead.ts` | **novo** |
| Router | `src/app/router/trafego/admin/settings.ts` | +3 campos no Zod e na validação de org |
| Notif | `src/features/admin/lib/notification-service.ts` | +`TRAFEGO_LEAD_CAPTURED` em `NOTIF_TYPES`/`NOTIF_META` |
| UI wizard | `src/features/trafego/components/public/trafego-landing.tsx` | dispara captura no `goNext` do Contato |
| UI wizard | `src/features/trafego/hooks/use-trafego-purchase.ts` | +`useCaptureTrafegoLead` (CLAUDE.md regra 9) |
| UI admin | `src/features/admin/components/trafego/settings/section-agency.tsx` | bloco "Entrada de leads", dentro de "Agência e entrada de leads" |
| Realtime | `src/features/leads/realtime/publish.ts` | consumido pelo router: `publishLeadCreated` no card novo |
| Jornada | `src/features/leads/lib/history.ts` | consumido pelo router: `recordLeadEvent` (`FORM_SUBMITTED`) no card novo |
| Layout | `src/app/(admin)/admin/layout.tsx` | monta `AlertProvider` |

## 8. Plano de testes

> ⚠️ O projeto **não tem runner de teste instalado** (CLAUDE.md item 20 — regra 17
> é inexequível hoje). Até a Fase 0 corrigir isso, os `CA-n` são verificados
> manualmente pelo roteiro abaixo, e cada passo cita o id.

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1 | manual | Configurar captura no `/admin/trafego`; preencher wizard até Contato; conferir card no board. |
| CA-2 | manual | Voltar e avançar de novo; conferir que segue um card e nenhum popup novo. |
| CA-3 | manual | `select * from admin_notification where event_type='TRAFEGO_LEAD_CAPTURED'` — uma linha por admin. |
| CA-4 | manual | Duas abas: admin em `/admin/trafego`, anônima no wizard. Popup abre sem reload. |
| CA-5 | manual | Logar com usuário `isSystemAdmin=false`; nenhum popup. |
| CA-6 | manual | Limpar `captureTrackingId`; wizard avança para Investimento sem erro no console nem no server. |
| CA-7 | manual | Concluir o pagamento do lead captado; conferir os dois cards. |
| CA-8 | manual | Escolher tracking de outra org no form do admin; salvar deve recusar. |
| CA-9 | manual | Board do tracking de captura aberto numa aba; preencher o Contato em outra. O card deve surgir sozinho. |
| CA-10 | manual | Abrir "Detalhes do lead" → Jornada; deve constar "Preencheu: trafeGO — passo Contato". |

## 9. Riscos e rollback

**Migration** — três colunas `nullable` sem default em `TrafegoSettings`.
Reversível com `DROP COLUMN`; nenhum dado existente é lido ou reescrito. Com as
colunas nulas o sistema se comporta exatamente como hoje (RF-4 / CA-6), então o
deploy do schema pode ir antes do código sem efeito nenhum.

**Risco 1 — popup vira ruído.** Se a landing receber volume alto, cada admin leva
um popup com ack por lead. Mitigação: D-7 restringe a card novo. Se ainda
incomodar, baixar `displaySurface` para `"toast"` é mudança de uma linha, sem
migration.

**Risco 2 — card duplicado entre os dois boards.** Consequência aceita em D-1 e
coberta por CA-7/CB-14. O que **não** pode acontecer é realocar o card existente:
foi esse o bug da spec 0001. Por isso CB-2 é explícito.

**Risco 3 — captura lenta segura o "Continuar".** Mitigado por RNF-2/RNF-3: a
mutation dispara mas o wizard não espera o resultado para avançar.

**Risco 4 — LGPD.** Passa-se a guardar contato de quem não fechou negócio. A
política de privacidade do trafeGO já cobre dados de contato do formulário;
confirmar com o dono do produto antes do deploy.

**Rollback completo**: reverter o PR. Os `Lead` já criados ficam — são dados
legítimos e continuam visíveis no board.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-21 | João Gabriel | Criada |
| 2026-09-21 | João Gabriel | Implementada. CA-1, CA-2, CA-3 e CA-6 verificados contra o banco local; CA-4, CA-5, CA-7 e CA-8 ficam para verificação com sessão de admin real. |
| 2026-09-22 | João Gabriel | CA-4 confirmado: popup abre em tempo real no `/admin` com nome, telefone, e-mail, canal e verba. O push da spec 0022 passa a acompanhar o popup. |
| 2026-09-22 | João Gabriel | CA-5 confirmado por auditoria no banco: 18 notificações, todas `targetType = "user"` para destinatários `isSystemAdmin`, nenhum broadcast. |
| 2026-09-22 | João Gabriel | Correção: a captura criava o `Lead` mas não publicava `lead-created` nem gravava evento de jornada. Board aberto só via o card após reload e a timeline nascia vazia. Adicionados `publishLeadCreated` e `recordLeadEvent` no router, só para card novo (D-7). Novos CA-9 e CA-10. |
