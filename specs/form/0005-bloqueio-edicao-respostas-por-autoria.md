---
id: 0005
titulo: Política configurável de edição de respostas de formulário
dominio: form
status: em-revisao
autor: João Gabriel
criada: 2026-08-17
atualizada: 2026-08-17
branch: feature/form-bloqueio-edicao-respostas-20260817
pr:
peso: completa
---

# 0005 — Política configurável de edição de respostas

---

## 1. Contexto

Hoje, **qualquer** usuário que participe do tracking atual do lead pode reescrever
**qualquer** resposta de formulário daquele lead. A regra de permissão de
`form.updateResponse` é composta de duas checagens, ambas coletivas — nenhuma
olha para quem preencheu:

| Checagem | Onde | O que garante |
| --- | --- | --- |
| Membership na org | `update-response.ts` | usuário pertence à org do form |
| Participante do tracking | `checkLeadTrackingParticipant` | usuário participa do tracking **atual** do lead |

A consequência prática: numa oficina com cinco técnicos no mesmo tracking, o
técnico B abre a resposta que o técnico A preencheu, altera o diagnóstico e salva.
Não há bloqueio, não há aviso, e — como `updateResponse` sobrescreve `jsonResponse`
por inteiro — não há como recuperar o que A tinha escrito. O único rastro é o
`LeadJourneyEvent` com `edited: true` e `editedBy`, que ninguém consulta na hora.

O mesmo vale para `form.updateResponseLabel`, que usa exatamente o mesmo par de
checagens.

Ao mesmo tempo, **a regra certa não é a mesma para todo formulário**: um checklist
de diagnóstico técnico pede autoria estrita; uma ficha de triagem preenchida a
várias mãos pede o contrário. Uma regra global fixa erraria metade dos casos.

### O obstáculo central

**`FormResponses` não tem coluna de autoria.** O modelo (schema.prisma:2053) tem
`formId`, `leadId`, `actionId`, `label` — e nada que diga quem preencheu. Nenhuma
regra baseada em "quem respondeu" é implementável sobre o schema atual.

### Evidência nos dados

Dump de produção `pg-dump-nasa_db-1786924813` (mesma base usada na spec 0002),
336 respostas. A única fonte de autoria recuperável é `lead_journey_events.actor_id`
cruzado por `metadata->>'formResponseId'` — `lead_history` não serve (zero linhas
`FORM_SUBMITTED` com `user_id` ou `metadata->>'createdBy'`).

Cruzando autoria com origem, a população se divide em **três** grupos, não dois:

| Grupo | Qtd | % | Autor recuperável |
| --- | --- | --- | --- |
| Preenchida por usuário logado (evento com `actor_id`) | 103 | 30,7% | ✅ sim |
| **Submit público — o próprio lead preencheu** | **182** | **54,2%** | ❌ nunca |
| Legado puro (nenhum evento de jornada) | 51 | 15,2% | ❌ não |

Confirmação da segunda linha, no código e nos dados: o submit público
([`submut-response.ts:341`](../../src/app/router/form/public/submut-response.ts))
empilha o evento de jornada **sem `actorId`**. No banco, eventos `form_submit` com
`source='public'` são **156, dos quais 0 têm actor**.

Frequência real do problema — de 92 respostas que sofreram edição:

| | Qtd |
| --- | --- |
| Editadas **somente pelo próprio autor** (auto-save do preenchimento) | 82 |
| **Editadas por terceiro** ← o caso a bloquear | **10** |
| Editadas sem autor de criação conhecido | 9 |

O problema é real, mas raro — argumento a favor de política opt-in por formulário
em vez de regra global imposta (D-11).

## 2. Objetivo

Cada formulário passa a declarar **quem pode editar suas respostas** — mantendo o
comportamento atual (participantes do setor) ou restringindo a quem preencheu — sem
alterar quem pode **visualizar**, sem jamais conceder acesso além do que já é
permitido hoje, e sem mudar o comportamento de nenhum formulário existente até que
alguém escolha outro nível.

### Não-objetivos

- **Não** muda quem pode **abrir/visualizar** uma resposta. A política governa
  apenas edição; quem não pode editar vê o conteúdo íntegro com os campos
  desabilitados. Ver CB-15 sobre o limite de visualização que **já existe** hoje.
- **Não** muda a permissão de **criar** resposta nova (`createResponseForLead`),
  nem o comportamento do submit público (`submitResponse`).
- **Não** altera o fluxo de assinatura do cliente final (`updateClientSignatures`,
  autenticado por `publicToken` do lead) — o cliente não é usuário da org.
- **Não** mexe em `cancelResponse`, que já é Master/Tracking-Owner.
- **Não** implementa versionamento, diff ou auditoria de conteúdo de resposta.
- **Não** cria tela de "transferir autoria" nem fluxo de "solicitar liberação".
  Ver D-9 — instrumentar antes de construir.
- **Não** cria política padrão por organização. Ver D-14.
- **Não** entrega o nível `MANAGERS_ONLY` ("somente gestores"). Cortado do v1 por
  ser incoerente com o fluxo de preenchimento — ver D-16, que registra a condição
  obrigatória para reintroduzi-lo.
- **Não** adiciona infraestrutura de teste. Cobertura automatizada fica registrada
  como pendência para a remodelagem de arquitetura já planejada — ver 8.1.
- **Não** exibe estado de bloqueio em todas as telas que listam respostas. O v1
  cobre apenas as superfícies com escrita direta — ver 6.4.

## 3. Requisitos

### Pré-requisito bloqueante

| ID | Requisito |
| --- | --- |
| **RF-0** | `form.update` (`src/app/router/form/update.ts:137`) precisa validar que o usuário é membro da organização do formulário **antes** desta feature ir para produção. Hoje o handler recebe apenas `{ input }`, sem `context` e sem escopo de org no `where` — qualquer usuário autenticado reescreve qualquer formulário de qualquer organização. Enquanto isso existir, a política é contornável em uma chamada (e é, por si só, uma falha cross-tenant pré-existente). Ver seção 9.2. |

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | `FormResponses` ganha `createdById String?` (FK `User`, `onDelete: SetNull`) — quem preencheu, quando foi um usuário da org. |
| RF-2 | `FormResponses` ganha `authorKind FormResponseAuthorKind @default(UNKNOWN)` com valores `USER`, `LEAD`, `SYSTEM`, `UNKNOWN`. |
| RF-3 | `FormSettings` ganha `responseEditPolicy FormResponseEditPolicy @default(TRACKING_PARTICIPANTS)` — **NOT NULL**, com os níveis da seção 6.1. |
| RF-4 | `createResponseForLead` grava `createdById = context.user.id` e `authorKind = USER`. |
| RF-5 | `submitResponse` (público) grava `createdById = null` e `authorKind = LEAD`. |
| RF-6 | Migration classifica as linhas existentes: `USER` + `createdById` para as que têm `actor_id` em `lead_journey_events`; `LEAD` para as que têm evento `form_submit` sem actor; `UNKNOWN` para as que não têm evento algum. |
| RF-7 | Guard único em `src/features/form/lib/can-edit-response.ts`, resolvendo a matriz 6.2. |
| RF-8 | `updateResponse` e `updateResponseLabel` aplicam o guard e devolvem `FORBIDDEN` com mensagem específica por motivo. |
| RF-9 | `getResponseById` devolve `canEdit: boolean`, `editBlockedReason: string \| null` e `createdBy: { id, name, image } \| null`. As procedures de lista das superfícies da seção 6.4 devolvem os mesmos campos por linha. |
| RF-10 | A página `/formulario/[slug]/[responseId]` renderiza `FormSubmitComponent` com `readOnly` quando `canEdit === false`, oculta o botão de submit e exibe aviso com o motivo e o nome do autor. **O conteúdo da resposta permanece integralmente visível.** |
| RF-11 | Com `canEdit === false`, o auto-save (`onPartialSave`) não dispara nenhuma chamada de rede. |
| RF-12 | O cliente **nunca** re-deriva a regra: renderiza apenas o que `canEdit` disser. |
| RF-13 | O guard é dividido em `resolveResponseEditContext(userId, organizationId)` (faz I/O, uma vez por request) e `canEditFormResponse(response, policy, context)` (**função pura**, sem I/O). Ver D-8. |
| RF-14 | Toda negação de edição é registrada (`userId`, `responseId`, `authorKind`, `policy`, `reason`) para medir a taxa real de escalação. Ver D-9. |
| RF-15 | Alterar `responseEditPolicy` é restrito a Master da org e Owner do tracking vinculado ao formulário. Ver D-13. |
| RF-16 | A política é lida **no momento da edição**, nunca congelada na resposta. Ver D-12. |
| RF-17 | O seletor de política aparece em `form-settings.tsx` como escolha única (rádio), com os rótulos da seção 6.1. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | O guard não adiciona mais de uma query ao caminho de `updateResponse` — reaproveita o `member` e o `lead.trackingId` já carregados. |
| RNF-2 | Backfill roda dentro da migration e é idempotente (`WHERE author_kind = 'UNKNOWN'`). |
| RNF-3 | A migration é reversível por `DROP COLUMN` + `DROP TYPE` sem perda de dado pré-existente. |
| RNF-4 | Calcular `canEdit` para uma lista de N respostas custa **O(1) queries**, não O(N). |
| RNF-5 | Formulário sem linha em `FormSettings` (relação é opcional) resolve para o nível padrão sem erro. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado um formulário sem configuração explícita, quando qualquer participante do tracking edita uma resposta, então salva com sucesso — **comportamento idêntico ao de hoje** (D-11).
- [ ] **CA-2** — Rodada a migration em produção, então `SELECT count(*) FROM form_settings WHERE response_edit_policy <> 'TRACKING_PARTICIPANTS'` retorna 0.
- [ ] **CA-3** — Dado um form em `AUTHOR_ONLY` e a resposta R (`authorKind = USER`) preenchida por A, quando A edita R, então salva com sucesso.
- [ ] **CA-4** — Mesmo cenário, quando B (participante do mesmo tracking, role `member`) tenta `updateResponse`, então recebe `FORBIDDEN` e `jsonResponse` permanece inalterado.
- [ ] **CA-5** — Mesmo cenário, quando B tenta `updateResponseLabel`, então recebe `FORBIDDEN`.
- [ ] **CA-6** — Dado um form em `AUTHOR_ONLY` e R com `authorKind = LEAD`, quando um participante do tracking edita R, então salva com sucesso — o "Continuar preenchimento" sobrevive (matriz 6.2, nota ¹).
- [ ] **CA-7** — Dado um form em `AUTHOR_ONLY` e R com `authorKind = UNKNOWN`, quando um participante não-gestor tenta editar, então recebe `FORBIDDEN`; quando o Master edita, salva.
- [ ] **CA-8** — Dado um form em `TRACKING_PARTICIPANTS` e R com `authorKind = UNKNOWN`, quando um participante edita, então salva — a origem só importa sob política de autoria (D-10).
- [ ] **CA-9** — Dado um form em `AUTHOR_ONLY`, quando o autor não-gestor preenche a resposta do início ao fim (criação + todos os saves parciais + submit final), então **nenhum** save é bloqueado.
- [ ] **CA-10** — Dado **qualquer** nível de política, quando um membro da org que **não** participa do tracking do lead tenta editar, então recebe `FORBIDDEN` — nenhuma configuração afrouxa a regra de setor (invariante de monotonicidade, D-15).
- [ ] **CA-11** — Para **todo** nível de política, quando o Master da org ou o Owner do tracking edita, então salva com sucesso (invariante 6.3).
- [ ] **CA-12** — Dado um usuário `member` sem cargo de gestor, quando tenta alterar `responseEditPolicy` via `form.update`, então recebe `FORBIDDEN` (RF-15).
- [ ] **CA-13** — Dado que a política do form muda de `AUTHOR_ONLY` para `TRACKING_PARTICIPANTS`, quando um participante edita uma resposta **anterior** à mudança, então salva — a política vale para o histórico (D-12).
- [ ] **CA-14** — Dado que B abre uma resposta sem permissão de edição, então **todo o conteúdo preenchido é visível**, os campos estão desabilitados, o botão de envio não existe e há aviso com o motivo.
- [ ] **CA-15** — Dado que B navega entre etapas em modo leitura, então nenhuma requisição a `form.updateResponse` é emitida.
- [ ] **CA-16** — Dado R com `authorKind = LEAD`, quando um usuário a edita, então `authorKind` e `createdById` permanecem inalterados (D-3).
- [ ] **CA-17** — Rodada a migration na base restaurada, então a distribuição é `USER = 103`, `LEAD = 182`, `UNKNOWN = 51`, sem `created_by_id` órfão.
- [ ] **CA-18** — Toda resposta criada após o deploy tem `authorKind ≠ UNKNOWN`.
- [ ] **CA-19** — Dado que o autor A foi deletado do sistema, quando a resposta é carregada, então `createdById` é `null`, `authorKind` continua `USER`, e sob `AUTHOR_ONLY` a edição fica restrita a gestores sem erro.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Formulário sem linha em `FormSettings` | Resolve para `TRACKING_PARTICIPANTS` (padrão). Sem erro, sem 500 (RNF-5). |
| CB-2 | `authorKind = LEAD` sob `AUTHOR_ONLY` | Cai para participante do tracking. Não existe autor-usuário a honrar; travar recriaria pela porta da config a armadilha que D-2 removeu. |
| CB-3 | `authorKind = UNKNOWN` sob `AUTHOR_ONLY` | Só gestores — a política exige atribuição e o dado não tem. Conjunto congelado de 51 linhas. |
| CB-4 | `authorKind = UNKNOWN` sob política não-autoral | Segue a política normalmente. A origem é irrelevante quando a regra não fala de autoria (D-10). |
| CB-5 | `authorKind = USER` mas `createdById = null` (autor deletado) | Sob `AUTHOR_ONLY`, cai em gestores. **Não** vira `LEAD` — a resposta teve autor; ele deixou de existir. |
| CB-6 | Master da org **não** é participante do tracking | **Edita**, em qualquer nível. Invariante 6.3 / D-4. |
| CB-7 | Autor é participante, mas o lead foi movido para tracking do qual ele não participa | **Bloqueado**, com `NOT_TRACKING_PARTICIPANT_MESSAGE`. A regra de setor continua valendo abaixo da política; autoria não é passe livre. |
| CB-8 | Autor removido da organização | `member` ausente → `UNAUTHORIZED`, como hoje. |
| CB-9 | Resposta sem lead (`leadId = null`) | O guard de setor já é pulado hoje. Aplica-se a política sobre membership da org. |
| CB-10 | Auto-save durante o preenchimento pelo próprio autor | `authorKind = USER` com `createdById` do autor → passa em **todos** os saves parciais, em ambos os níveis. Nenhum nível do v1 pode bloquear o autor de terminar o que começou (D-16). |
| CB-11 | Draft público (`completedAt IS NULL`) retomado por consultor | `authorKind = LEAD` → participante edita. Preserva a retomada de rascunho. |
| CB-12 | Política muda enquanto um usuário está com a página aberta | Primeiro save recebe `FORBIDDEN`; a UI mostra toast e recarrega em modo leitura. Sem retry automático. |
| CB-13 | Cliente final assinando via `/lead/<token>/formulario/<id>` | Rota e procedure distintas (`updateClientSignatures`), **não** afetadas. |
| CB-14 | Resposta vinculada a uma Action (`actionId`) | Sem efeito: a permissão é da resposta, não da tarefa. |
| CB-15 | Usuário fora do tracking tenta **visualizar** | Continua bloqueado por `getResponseById`, como **hoje**. Este é um limite pré-existente que a política de edição não afeta e não remove. |
| CB-16 | Backfill classificar como `LEAD` uma resposta que era interna pré-instrumentação | Erra para o lado seguro: preserva o comportamento atual em vez de travar. |
| CB-17 | Dois cliques simultâneos do autor em abas diferentes | Comportamento atual mantido (último save vence). Fora do escopo. |
| CB-18 | Resposta criada **em branco por automação** (`send-form` e `open-form` dos tracking-executions) | Classificada `SYSTEM`. Ninguém preencheu ainda, então não há autoria a proteger: cai para participante do tracking em qualquer política. Descoberto na implementação — ver changelog. |

## 6. Decisões de design

### 6.1 Os níveis de política

Ordenados do mais aberto ao mais restrito. Enum `FormResponseEditPolicy`:

| Valor | Rótulo na UI | Quem edita |
| --- | --- | --- |
| `TRACKING_PARTICIPANTS` | Participantes do setor · **padrão** | participantes do tracking atual do lead (comportamento de hoje) |
| `AUTHOR_ONLY` | Somente quem preencheu | o autor da resposta |

Em ambos os níveis, gestores editam (invariante 6.3). Um terceiro nível
(`MANAGERS_ONLY`) foi projetado e **cortado do v1** — ver D-16, que registra a
condição obrigatória para reintroduzi-lo.

**Monotonicidade (invariante)**: todo nível é **subconjunto** do padrão. A política
só restringe a partir do comportamento atual — nunca concede. Logo, nenhuma
configuração possível de formulário pode produzir escalação de privilégio: o teto é
sempre a regra de setor (`checkLeadTrackingParticipant`) que já existe hoje, e ela
continua protegendo dado de lead entre setores. Ver D-15.

### 6.2 Matriz de resolução (política × origem da resposta)

| Política \ `authorKind` | `USER` | `LEAD` | `SYSTEM` | `UNKNOWN` |
| --- | --- | --- | --- | --- |
| `TRACKING_PARTICIPANTS` | participante | participante | participante | participante |
| `AUTHOR_ONLY` | **autor** | participante ¹ | participante ³ | **gestores** ² |

¹ Não existe autor-usuário numa resposta enviada pelo próprio lead — cai para o
nível imediatamente mais aberto, preservando o "Continuar preenchimento" (CB-2).
² Não é atribuível, então a regra de autoria não pode ser honrada — sobe para o
nível mais restrito (CB-3).
³ Resposta criada **em branco** por automação: ninguém preencheu ainda, logo não
há autoria a proteger. Cai para participante (CB-18).

### 6.3 Invariante

**Gestores editam em qualquer nível.** "Gestor" = `Member.role = "owner"` (Master)
ou `TrackingParticipant.role = "OWNER"` do tracking atual do lead. Sem isso, é
possível configurar um formulário em que ninguém consegue corrigir uma resposta
errada. Em todos os níveis, membership na org continua obrigatória.

### 6.4 Onde `canEdit` é exposto no v1

Regra de escopo: **superfície que oferece escrita direta recebe `canEdit`;
superfície que apenas navega herda o bloqueio da página de destino.**

| Superfície | v1 | Motivo |
| --- | --- | --- |
| `/formulario/[slug]/[responseId]` | ✅ | é onde a edição acontece; modo leitura + aviso (RF-10) |
| `contatos/[leadId]/formularios/[formId]` | ✅ | edita o `label` in-place (`updateResponseLabel`) — precisa desabilitar o campo |
| `lead-forms-dialog` | ✅ | entrada principal para as respostas do lead; exibe cadeado por linha |
| `recent-responses-carousel` | ⬜ | apenas navega — o usuário abre e encontra o modo leitura |
| `action-forms-dialog`, `generated-from-form-field` | ⬜ | idem — links de navegação |

As duas superfícies de lista marcadas ✅ recebem `canEdit` por linha via
`resolveResponseEditContext` + predicado puro (D-8), portanto em **O(1) queries**
(RNF-4) — nunca resolvendo o guard por resposta.

### D-1 — Autoria vira coluna, não derivação

- **Escolha**: adicionar `FormResponses.createdById`.
- **Alternativas descartadas**: resolver o autor a cada request consultando
  `lead_journey_events` por `metadata->>'formResponseId'` — JSON sem índice, tabela
  com **200.950 linhas**, e o mesmo `formResponseId` aparecendo em vários eventos
  (criação + cada edição), exigindo desempate por data a cada checagem.
  Permissão não pode depender de heurística sobre log.
- **Consequência**: ponto único de verdade; o log segue sendo histórico.

### D-2 — `authorKind` explícito, porque `NULL` significa duas coisas

- **Escolha**: `createdById IS NULL` não é critério de decisão; quem decide é `authorKind`.
- **Problema que resolve**: `createdById` será `NULL` tanto para o legado (finito)
  quanto para **toda resposta que o lead preencher pelo link público** (permanente,
  54% da base). Tratar `NULL` como "só gestor edita" transformaria cada submit
  público futuro numa resposta que só um gestor toca — quebrando o "Continuar
  preenchimento", razão de existir de `updateResponse`. O passivo **cresceria** em
  vez de envelhecer.
- **Consequência**: uma coluna a mais. Em troca, restrição por falta de atribuição
  incide sobre conjunto **congelado** (51 linhas) e toda resposta futura nasce
  classificada.

### D-3 — Editar **não** reivindica autoria

- **Escolha**: `updateResponse` nunca escreve `createdById` nem `authorKind`.
- **Alternativas descartadas**: "claim" no primeiro update. Transformaria acidente
  em posse — o primeiro colega a abrir uma resposta pública viraria dono dela.
- **Consequência**: `authorKind` é imutável após a criação.

### D-4 — Gestores dispensam o guard de setor

- **Escolha**: Master e Tracking Owner passam antes do `checkLeadTrackingParticipant`.
- **Motivo**: a mensagem que o sistema já dá ao bloqueado é *"fale com um gestor
  para alterar"* — se o gestor também precisa participar do tracking, a válvula não
  existe. `cancelResponse` já opera assim.
- **Consequência**: `admin` e `moderador` **não** entram, por coerência com
  `cancelResponse`, que exclui ambos de ação sensível.

### D-5 — Título segue a resposta

`updateResponseLabel` usa o mesmo guard. O `label` identifica a O.S.; deixá-lo
editável por terceiros contornaria o bloqueio pela porta lateral.

### D-6 — Guard centralizado, não replicado

Já existem quatro caminhos de escrita sobre `FormResponses` e a tendência é
crescer. Regra de permissão copiada é regra que diverge — o risco de longo prazo
não é errar hoje, é a quinta procedure nascer sem a checagem.

### D-7 — Enum em vez de boolean (origem)

Três estados hoje, com candidatos previsíveis a um quarto (`SYSTEM` para respostas
de automação, `IMPORT` para migração de base de cliente).

### D-8 — Guard em duas partes: contexto com I/O + predicado puro

- **Escolha**: `resolveResponseEditContext(userId, organizationId)` resolve os
  fatos do **usuário** em duas queries, uma vez por request;
  `canEditFormResponse(response, policy, context)` é **pura**.
- **Motivo**: dos fatos que a regra precisa, apenas autoria e política são por
  linha — os do usuário se repetem. Guard monolítico com I/O por resposta vira
  **N+1** na primeira tela de lista com cadeado: `getManyResponses` traz todas as
  respostas de um form, `lead-forms-dialog` chega a 18 por lead. Com 200 linhas,
  ~600 queries.
- **Custo do contexto**: trivial — 186 trackings na base, máximo 14 participantes
  por tracking.
- **Consequência**: satisfaz RNF-4 por construção e protege o caminho quente
  (`updateResponse` roda a cada "Próximo": 2.101 eventos para 92 respostas).

### D-9 — Instrumentar a escalação antes de construir válvula

- **Escolha**: registrar toda negação (RF-14); **não** construir agora transferência
  de autoria nem solicitação de liberação.
- **Motivo**: os cenários de atrito são reais (autor de férias, desligado, troca de
  setor, virada de turno) e parte das 10 edições por terceiro era passagem de
  bastão legítima — mas não sabemos a proporção.
- **Consequência**: em ~30 dias existe taxa real para decidir com dado. A política
  configurável já é, por si, a principal válvula: a org afrouxa o formulário.

### D-10 — Política é escada ordenada, e `authorKind` só importa quando ela é autoral

- **Escolha**: um enum ordenado (dois valores no v1), em vez de flags independentes
  (`podeAutor`, `podeParticipante`, `podeMembro`…). E `authorKind` entra na decisão
  **apenas** sob `AUTHOR_ONLY`.
- **Motivo**: os níveis são pontos de um mesmo eixo de restritividade — flags
  permitiriam combinações sem sentido ("autor não pode, mas qualquer membro pode")
  e exigiriam UI de checkboxes que ninguém entende. Ordenados, viram rádio e
  admitem inserção de nível novo no meio sem quebrar os existentes.
  Quanto ao `authorKind`: se a política não fala de autoria, travar as 51 linhas
  legadas seria restrição sem justificativa.
- **Por que enum e não boolean, já que o v1 tem dois valores**: `restrictEditToAuthor`
  descreveria o *mecanismo*, não o *nível* — e voltaria a acoplar o nome da coluna a
  uma regra específica, tornando a inserção de qualquer nível futuro (D-16) uma
  migration de renomeação com reinterpretação de dado. O enum nomeia o eixo, não a
  implementação.
- **Consequência**: a regra "sem referência → só gestores" deixa de ser avulsa e
  vira **consequência** de escolher `AUTHOR_ONLY`. Nada se perde — quem quer o
  bloqueio liga o nível e o ganha automaticamente.

### D-16 — `MANAGERS_ONLY` cortado do v1 (e a condição para voltar)

- **Escolha**: o v1 tem **dois** níveis. `MANAGERS_ONLY` ("somente gestores") fica
  fora.
- **Motivo — o nível era incoerente com o próprio fluxo de preenchimento**: a
  política governa edição, não criação (não-objetivo). Mas o preenchimento interno
  é `createResponseForLead` **seguido de um `updateResponse` a cada "Próximo"**.
  Sob `MANAGERS_ONLY`, um consultor não-gestor criaria a resposta e seria bloqueado
  no save seguinte — formulário impossível de preencher, deixando uma resposta pela
  metade órfã. Alertar na UI não conserta isso; apenas avisa sobre um estado quebrado.
- **Condição obrigatória para reintroduzir**: `MANAGERS_ONLY` precisa governar
  **também a criação** (`createResponseForLead`), de modo que o nível signifique
  "este formulário é de gestores, ponto" — sem meio-estado em que se cria mas não
  se conclui. Reintroduzir apenas na camada de edição repete o defeito.
- **Alternativa descartada**: manter o nível com aviso na UI. Descartada porque
  transfere para o usuário a responsabilidade de evitar um estado que o sistema não
  deveria permitir criar.
- **Consequência**: `AUTHOR_ONLY` cobre o pedido original de produto (bloquear
  edição por terceiros). Nenhum nível do v1 consegue impedir o autor de concluir o
  próprio preenchimento — o que vira o critério `CA-9`.

### D-15 — A política só restringe; nunca afrouxa

- **Escolha**: a escada tem **três** níveis, todos subconjuntos do padrão. Não
  existe nível mais aberto que o comportamento de hoje.
- **Alternativa descartada**: um nível `ORG_MEMBERS` ("qualquer pessoa da equipe"),
  que dispensaria o `checkLeadTrackingParticipant`. Descartada por dois motivos:
  1. **Nunca foi o pedido.** "Público", no enunciado do produto, significa
     *participantes do tracking que têm acesso à resposta* — que é exatamente o
     nível padrão. O nível extra resolvia um problema que ninguém tem.
  2. **Era inconsistente com a visualização.** `getResponseById` lança `FORBIDDEN`
     para quem não participa do tracking. Sob `ORG_MEMBERS`, um membro de fora do
     setor teria permissão de **editar** uma resposta que não consegue nem
     **abrir** — nível inutilizável sem também afrouxar a regra de leitura, o que
     é escopo diferente e mexe na proteção de dado de lead entre setores.
- **Consequência**: nenhuma configuração de formulário pode produzir escalação de
  privilégio. O teto é sempre a regra de setor pré-existente, e ver e editar passam
  a ter o mesmo teto — sem assimetria. Um nível mais aberto, se um dia for
  realmente pedido, exige spec própria porque muda a regra de visualização junto.

### D-11 — O padrão é o comportamento atual; a feature sobe apagada

- **Escolha**: `@default(TRACKING_PARTICIPANTS)`, idêntico ao comportamento de hoje.
- **Motivo**: sem isso, o deploy mudaria o comportamento de 103 respostas de uma
  vez, em produção, para usuários que não pediram nada. Com isso, **nenhum**
  formulário muda até alguém escolher outro nível.
- **Consequência**: adoção incremental e reversível por formulário, sem migration.
  Colapsa o Risco 1 da seção 9 e torna o rollback uma troca de select na UI.

### D-12 — Política avaliada na edição, não congelada na resposta

- **Escolha**: o guard lê a política atual do formulário a cada checagem.
- **Alternativas descartadas**: gravar a política vigente em cada resposta. Mais
  previsível, porém contraintuitivo — o gestor que afrouxa a config espera que
  valha para o histórico, não só para respostas futuras.
- **Consequência**: mudar a política tem efeito retroativo e imediato (CA-13).

### D-13 — Quem altera a política precisa ser gestor

- **Escolha**: `responseEditPolicy` só pode ser alterada por Master ou Tracking Owner.
- **Motivo**: sem isso o bloqueio é decorativo — o membro bloqueado por
  `AUTHOR_ONLY` chama `form.update`, seta `TRACKING_PARTICIPANTS` e edita. **A política vale
  o que valer a procedure que a escreve** — daí o RF-0 ser bloqueante.
- **Consequência**: a UI de settings esconde/desabilita o seletor para não-gestores,
  e o servidor rejeita a alteração independentemente do que a UI mostrar.

### D-14 — Política por formulário, sem padrão por organização (ainda)

- **Escolha**: escopo é o formulário. Coluna **NOT NULL** com default.
- **Alternativas descartadas**: coluna nullable onde `NULL` = "herda o padrão da
  org". Descartada deliberadamente: seria reintroduzir um `NULL` com dois
  significados — exatamente o defeito que D-2 acabou de remover. Se o padrão por
  org for pedido, entra como coluna própria em `Organization` e uma função de
  resolução explícita.
- **Consequência**: org com muitos formulários configura um a um no início. Aceito
  enquanto não houver evidência de volume.

## 7. Impacto

- [x] Schema / migration (`prisma/schema.prisma`)
- [x] Procedures oRPC (contrato de entrada/saída)
- [ ] Realtime (Pusher / event-bus)
- [ ] Automações (Inngest)
- [ ] Env vars novas
- [x] Breaking change para clientes existentes
- [ ] Documentação obrigatória (CLAUDE.md itens 10 / 14 / 16)

**Breaking change**: apenas para formulários que **optarem** por um nível diferente
do padrão (D-11). No deploy, nada muda.

**Ritual pós-migration** (CLAUDE.md item 11): `pnpm db:generate`, bump de
`SCHEMA_VERSION` em `src/lib/prisma.ts`, touch nos catch-all, validação por `curl`.

**Arquivos previstos**:

| Arquivo | Mudança |
| --- | --- |
| `src/app/router/form/update.ts` | **RF-0** — membership + gate de gestor para a política |
| `prisma/schema.prisma` | 2 enums + 3 colunas + relação + índice |
| `prisma/migrations/<ts>_form_response_edit_policy/migration.sql` | DDL + backfill classificatório |
| `src/features/form/lib/can-edit-response.ts` | novo — contexto + predicado puro |
| `src/app/router/form/update-response.ts` | aplica guard |
| `src/app/router/form/update-response-label.ts` | aplica guard |
| `src/app/router/form/create-response-for-lead.ts` | `createdById` + `authorKind = USER` |
| `src/app/router/form/public/submut-response.ts` | `authorKind = LEAD` |
| `src/app/router/form/get-response.ts` | devolve `canEdit` / `editBlockedReason` / `createdBy` |
| `src/app/(platform)/formulario/[slug]/[responseId]/page.tsx` | modo leitura + aviso |
| `src/features/form/components/common/form-settings.tsx` | seletor de política (RF-17) |

## 8. Plano de testes

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1, CA-2 | SQL + manual | Após migration, editar respostas sem tocar em config e conferir que tudo funciona como antes. |
| CA-3 a CA-5 | manual + SQL | Form em `AUTHOR_ONLY`; dois usuários no mesmo tracking; conferir 403 e `jsonResponse` intacto. |
| CA-6 | manual | Lead envia pelo link público; consultor participante completa — deve salvar. |
| CA-7, CA-8 | SQL + manual | Forçar `author_kind='UNKNOWN'` e alternar a política entre `AUTHOR_ONLY` e `TRACKING_PARTICIPANTS`. |
| CA-9 | manual | Autor não-gestor preenche do início ao fim num form `AUTHOR_ONLY`; nenhum save bloqueado. |
| CA-10 | manual | Membro fora do tracking nos dois níveis — 403 nos dois. |
| CA-11 | manual | Master e Tracking Owner editam nos dois níveis. |
| CA-12 | manual | `member` comum tenta alterar a política via chamada direta à procedure. |
| CA-13 | manual | Alternar política e reeditar resposta antiga. |
| CA-14, CA-15 | manual + devtools | Conferir conteúdo visível, campos desabilitados, ausência de botão de envio e zero requisições ao navegar. |
| CA-16 | SQL | Editar resposta `LEAD` e conferir que a autoria não mudou. |
| CA-17, CA-18 | SQL | `SELECT author_kind, count(*) GROUP BY 1` → 103 / 182 / 51; nenhuma linha nova `UNKNOWN`. |
| CA-19 | SQL | Deletar um `user` autor em base de teste e recarregar. |
| CB-13 | manual | Cliente assina pelo link público — deve continuar funcionando. |

### 8.1 Cobertura automatizada — PENDÊNCIA (não entra no v1)

O v1 é verificado **inteiramente à mão**. O repositório hoje não tem infraestrutura
de teste: sem script `test` em `package.json`, sem vitest/jest/playwright nas
dependências, sem nenhum arquivo de teste. Introduzir runner agora foi
**deliberadamente descartado** — a cobertura automatizada entra junto com a
remodelagem de arquitetura já planejada para o backend, não antes e não isolada
nesta feature.

Fica registrado o que essa remodelagem deve cobrir quando chegar:

| Item | Pendência |
| --- | --- |
| Alvo prioritário | `canEditFormResponse(response, policy, context)` — a D-8 já o desenhou como **função pura**, sem banco, mock ou servidor |
| Escopo | todas as células da matriz 6.2 (2 políticas × 3 origens × papéis) + invariante 6.3 |
| Nomenclatura | cada teste cita o id do critério (`CA-4`, `CA-11`…), conforme CLAUDE.md item 17 |
| Por que este alvo primeiro | é o núcleo da regra, é finito, e é o único trecho que já está testável sem nenhuma infraestrutura além do runner |

Até lá, vale o **Risco 2** da seção 9.

## 9. Riscos e rollback

**Risco 1 — bloqueio indevido em operação corrente.** Neutralizado por D-11: no
deploy, nenhum formulário muda de comportamento. O risco passa a ser da org que
escolhe o nível, e é reversível por select.

**Risco 2 — regressão silenciosa da regra de permissão.** É o risco mais sério que
o v1 aceita conscientemente. São 19 critérios de aceite sobre **autorização de
dado de lead**, todos verificados manualmente uma única vez e sem rede de proteção
depois disso. Regra de auth sem teste de regressão volta a quebrar em silêncio — e
o sintoma (alguém edita o que não deveria, ou é bloqueado sem motivo) não gera
erro, só dado errado.

- **Por que aceitamos**: a cobertura automatizada entra na remodelagem de
  arquitetura já planejada (seção 8.1), e não faz sentido introduzir runner de
  teste isolado nesta feature.
- **Mitigação disponível hoje**: a D-8 deixou o núcleo da regra numa função pura —
  quando o runner chegar, cobrir a matriz 6.2 é trabalho de um arquivo, sem
  refactor.
- **Enquanto isso**: qualquer PR que toque `can-edit-response.ts` ou as procedures
  de escrita de resposta precisa reexecutar o roteiro manual da seção 8 por
  inteiro. Registrado aqui para que a revisão de PR cobre isso.

**Risco 3 — backfill classificar errado.** Assimétrico e a favor: falso-`USER`
atribui a quem comprovadamente já mexeu na resposta; falso-`LEAD` apenas preserva
o comportamento atual (CB-16). Nenhum trava usuário legítimo.

**Risco 4 — auto-save em loop recebendo 403.** Mitigado por RF-11 e CB-12.

**Risco 5 — a quinta procedure de escrita nascer sem o guard.** Mitigado por D-6 e
registrado para revisão de PR futuro.

### 9.1 Gargalos previstos

| Gargalo | Natureza | Quando aparece | Mitigação |
| --- | --- | --- | --- |
| **N+1 do guard em telas de lista** | técnico | Na primeira tela com cadeado por linha | D-8 / RNF-4 — previne por construção |
| **Escalação para gestores** | operacional | Cresce com o uso, sob políticas restritivas | D-4 distribui por 186 trackings; D-9 mede antes de construir válvula; a própria política é a válvula |
| **Padrão por organização** | arquitetural | Org com dezenas de formulários configurando um a um | D-14 — entra como coluna própria, sem `NULL` ambíguo |

**Não são gargalos**: as 51 linhas `UNKNOWN` (congeladas), a migration (336 linhas)
e os enums.

### 9.2 Achado de segurança pré-existente (bloqueante — RF-0)

`src/app/router/form/update.ts:137` — o handler é `async ({ input })`: sem
`context`, sem consulta a `member`, sem escopo de organização no
`prisma.form.update({ where: { id } })`. O único gate é `requiredAuthMiddleware`,
que apenas confirma existir sessão (`src/app/middlewares/auth.ts:5`).

Consequência hoje, independentemente desta spec: **qualquer usuário autenticado
pode reescrever qualquer formulário de qualquer organização** — conteúdo, settings
e direcionamento — bastando o id. É escrita cross-tenant.

Consequência para esta feature: guardar a política em `FormSettings` sem fechar
essa procedure produz um bloqueio decorativo (D-13). Por isso RF-0 é pré-requisito,
não melhoria opcional.

**Rollback**: `ALTER TABLE form_responses DROP COLUMN created_by_id, DROP COLUMN
author_kind;` + `ALTER TABLE form_settings DROP COLUMN response_edit_policy;` +
`DROP TYPE`. Colunas puramente aditivas; nenhum dado pré-existente é alterado.
Revertendo só o código, o sistema volta ao comportamento atual sem erro.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-08-17 | João Gabriel | Criada |
| 2026-08-17 | João Gabriel | Revisão após análise de dados: `NULL` era ambíguo entre legado e submit público (54% da base). Introduzido `authorKind` (D-2, D-7); matriz substitui o fallback binário; guard centralizado (D-6). |
| 2026-08-17 | João Gabriel | Análise de gargalos: guard dividido em contexto + predicado puro contra N+1 (D-8, RF-13, RNF-4); instrumentação de negações antes de válvula (D-9, RF-14); seção 9.1. |
| 2026-08-17 | João Gabriel | **Política configurável por formulário** (D-10 a D-14): enum ordenado, padrão = comportamento atual (deploy neutro), `authorKind` só decide sob política autoral, invariante de gestor, política avaliada na edição. Achado de segurança em `form.update` vira pré-requisito bloqueante RF-0 (seção 9.2). |
| 2026-08-17 | João Gabriel | Nível `ORG_MEMBERS` removido após esclarecimento do produto: "público" = participantes do tracking, que já é o padrão. O nível também era inconsistente com `getResponseById` (permitiria editar o que não se pode abrir). Escada reduzida a 3 níveis e monotonicidade vira invariante explícita (D-15). |
| 2026-08-17 | João Gabriel | **Implementação** — divergência encontrada e corrigida na mesma branch (CLAUDE.md item 17): os executores de automação `send-form` e `open-form` criam respostas **em branco**, caso não enumerado pela spec. Classificá-las `UNKNOWN` violaria o CA-18 e as trancaria em gestores. Adicionado o valor `SYSTEM` (já antecipado pela D-7), com comportamento igual ao de `LEAD` na matriz 6.2 — sem autor a proteger, cai para participante. Novo CB-18. |
| 2026-08-17 | João Gabriel | Fechamento do v1: `MANAGERS_ONLY` cortado por ser incoerente com o fluxo de preenchimento — bloqueava o autor no auto-save após permitir a criação (D-16, com a condição para reintroduzir). Escopo de `canEdit` delimitado por superfície (6.4). Cobertura automatizada movida para pendência da remodelagem de arquitetura (8.1) e o risco de regressão silenciosa assumido explicitamente (Risco 2). |
