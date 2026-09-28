---
id: 0002
titulo: Formulários e respostas com escopo de Action
dominio: form
status: em-revisao
autor: João Gabriel
criada: 2026-08-16
atualizada: 2026-08-16
branch: feature/tracking-formularios-por-action-20260816
pr:
peso: completa
---

# 0002 — Formulários e respostas com escopo de Action

---

## 1. Contexto

A migration `20260728171153_form_generate_actions` permitiu que um formulário gere
uma Action ao ser enviado (`Action.formResponseId` + `FormSettings.generateActionsConfig`).

No card da Action existe um ícone de prancheta que abre o `LeadFormsDialog`. Esse
dialog é **lead-scoped**: cruza *todos* os formulários publicados da organização
com *todas* as respostas do lead, e apenas destaca o formulário de origem via a
prop `highlightFormId`. O usuário abre pela tarefa e conclui que tudo ali pertence
àquela tarefa.

**Dor relatada pelos usuários**: abrem os formulários pela action achando que
estão vendo o que pertence àquela tarefa, e estão vendo o histórico inteiro do
lead.

Caso real (oficina mecânica): uma Action equivale a **uma Ordem de Serviço** de um
veículo, e o técnico precisa preencher vários checklists *daquela O.S.* —
Inspeção Final, Veículo no Elevador, Veículo no Chão, Checklist Rápido, Ficha de
Diagnóstico. Hoje essas respostas empilham no lead sem nenhuma noção de a qual
O.S. pertencem.

Evidência nos dados de produção (dump `pg-dump-nasa_db-1786924813`, restaurado em
2026-08-16):

| Métrica | Valor |
| --- | --- |
| `form_responses` no total | 336 (303 com lead, 156 finalizadas) |
| Actions geradas por formulário | 30 |
| Formulários com geração ativa | 2 |
| Lead "Lan Logística AmbientNordeste Ltda." | 4 respostas em 2 formulários distintos |
| Lead com mais respostas | 18 respostas do **mesmo** formulário — 18 O.S. indistinguíveis |
| Leads com 2+ actions geradas por formulário | 1 (o caso em que o dialog atual é ambíguo) |

A escala é pequena: a migration é barata e o custo de não fazer backfill é
desprezível.

## 2. Objetivo

Uma resposta de formulário passa a poder pertencer a uma Action, e a Action passa
a ter sua própria pauta de formulários — de modo que abrir os formulários por uma
tarefa mostre **apenas** o que é daquela tarefa.

### Não-objetivos

- **Backfill heurístico** (inferir vínculo por proximidade temporal). Respostas
  sem tarefa ficam com `actionId` NULL. A reconciliação determinística das
  respostas que *geraram* tarefa é outra coisa e está em D-6.
- **Vincular** uma resposta avulsa a uma tarefa depois do fato. v1 só tem
  desvincular (que devolve respostas ao lead). Vincular fica para spec futura.
- Fazer o preenchimento **interno** gerar Action (ver D-3).
- Aceitar `actionId` em preenchimento por **link público**.
- Marcar formulário da pauta como **obrigatório** / bloquear conclusão da tarefa.
- Reordenar a pauta por drag & drop.
- Corrigir o `trackingId` que `form.list` aceita e ignora (registrado em CB-19).

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Uma `FormResponses` pertence a no máximo uma `Action` (`actionId` nullable) |
| RF-2 | Uma `Action` tem uma pauta de N formulários, independente de já terem sido preenchidos |
| RF-3 | A Action gerada por um formulário nasce com esse formulário na posição 0 da pauta |
| RF-4 | A config de geração do formulário define formulários extras que entram na pauta de toda Action gerada |
| RF-5 | O dialog aberto pela Action lista **somente** a pauta daquela Action e as respostas com `actionId` daquela Action |
| RF-6 | Preencher um formulário a partir do dialog da Action grava `actionId` na resposta criada |
| RF-7 | O usuário pode vincular manualmente um formulário publicado da org à pauta de uma Action |
| RF-8 | O usuário pode desvincular um formulário da pauta; respostas vinculadas voltam a ser avulsas mediante confirmação |
| RF-9 | O dialog do lead ganha dois modos: "Por formulário" (grid atual) e "Respostas" (lista cronológica com badge da tarefa e filtro por tarefa) |
| RF-10 | Excluir uma Action não apaga respostas — elas voltam a ser avulsas |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Migration puramente aditiva e reversível, sem backfill |
| RNF-2 | Nenhum consumidor existente de `leads.listFormResponses` quebra — só há adição de campos |
| RNF-3 | `action.listForms` não vaza dados entre organizações (escopo por `workspace.organizationId`) |
| RNF-4 | Nenhum I/O de rede novo dentro de `prisma.$transaction` (CLAUDE.md regra 18) |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado um formulário com geração ativa e 4 formulários extras na
      config, quando um submit público cria a Action, então existem 5 linhas em
      `action_forms` (o gerador com `order = 0`) e a resposta geradora tem
      `action_id` preenchido.
- [ ] **CA-2** — Dado o lead "Lan Logística" com 4 respostas em 2 formulários,
      quando abro o dialog pelo ícone do card da Action, então vejo apenas a
      pauta daquela Action — nenhum outro formulário do lead.
- [ ] **CA-3** — Dado o dialog da Action aberto, quando clico "Preencher" e
      avanço um passo (auto-save), então a `FormResponses` criada já nasce com
      `action_id` daquela Action, e o "Enviar" final **não** cria uma segunda
      resposta.
- [ ] **CA-4** — Dado o dialog do lead no modo "Respostas", então cada resposta
      criada dentro de uma tarefa mostra badge com o título da tarefa, respostas
      antigas mostram "Avulsa", e o filtro por tarefa reduz a lista corretamente.
- [ ] **CA-5** — Dado uma Action com 5 respostas vinculadas, quando a Action é
      excluída, então `action_forms` daquela Action fica com 0 linhas e as 5
      respostas continuam existindo com `action_id IS NULL`.
- [ ] **CA-6** — Dado um usuário logado em outra organização, quando chama
      `action.listForms` com o `actionId` da primeira, então recebe `NOT_FOUND`.
- [ ] **CA-7** — Dado uma Action gerada **antes** desta feature (sem linhas em
      `action_forms`), quando abro o dialog, então o formulário de origem aparece
      mesmo assim, sem erro.
- [ ] **CA-8** — Dado o formulário que gerou a tarefa, quando tento desvinculá-lo,
      então a operação é recusada com mensagem explícita; e ao desvincular um
      formulário com 2 respostas, sou avisado de que "2 respostas voltarão a ser
      avulsas" antes de confirmar.
- [ ] **CA-9** — Dado o modo "Por formulário" do dialog do lead, então o grid e o
      CTA "Preencher" para formulários nunca preenchidos continuam idênticos ao
      comportamento atual.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Action excluída com respostas vinculadas | `ActionForm` cai por Cascade; `FormResponses.actionId → NULL` por SetNull. Nenhuma resposta é perdida |
| CB-2 | Resposta cancelada (`cancel-response.ts:114` faz hard delete) | Linha some; a linha de `ActionForm` **permanece** (a pauta continua exigindo o checklist) e o card volta a `unfilled`. Se era a geradora, `Action.formResponseId → NULL` e a Action perde o badge "Gerou esta tarefa", mantendo a pauta |
| CB-3 | Formulário despublicado | Continua aparecendo na pauta, com badge "Não publicado" e CTA desabilitado. **Não** sumir: sumir esconde trabalho pendente |
| CB-4 | Formulário excluído | `ActionForm` e `FormResponses` caem por Cascade (relação já existente). Consistente |
| CB-5 | Action movida para outro lead com respostas vinculadas | A troca é permitida, mas as respostas **não vão junto**: `actionId → null`, voltando a ser avulsas no lead anterior, com registro no histórico dele. A pauta (`ActionForm`) permanece — o novo lead precisa dos mesmos formulários. Quem preencheu o checklist foi o cliente anterior; levar a resposta junto misturaria dados de clientes |
| CB-6 | Action sem lead (`leadId = null`) | Dialog abre em leitura; pauta e respostas listadas; CTA "Preencher" desabilitado com tooltip "Vincule um lead à tarefa para preencher" |
| CB-7 | Resposta cujo lead difere do lead da Action (dado legado) | `action.listForms` **mostra** com badge de alerta "lead divergente" em vez de esconder |
| CB-8 | Action copiada entre orgs (`copy-action-to-org.ts`) | Não copiar `ActionForm` nem respostas — formulários são escopados por org; copiar vazaria `formId` cross-tenant |
| CB-9 | Mesmo formulário vinculado duas vezes | Impedido por `@@unique([actionId, formId])` |
| CB-10 | Multi-tenant em `leads.listFormResponses` | Hoje essa procedure **não tem checagem de org nenhuma** — bug pré-existente, agravado porque passará a expor `action.title`. Corrigido nesta mudança |
| CB-11 | Duas O.S. do mesmo lead com o mesmo checklist | Cada resposta com seu `actionId`; no modo "Respostas" do lead ambas aparecem com badges diferentes |
| CB-12 | Desvincular o formulário gerador | Recusado (`BAD_REQUEST`) — ele é a proveniência da tarefa |
| CB-13 | Desvincular formulário com respostas | Recusa com a contagem na mensagem; só executa com `detachResponses: true`, que zera `actionId` das N respostas na mesma transação. A UI confirma antes, usando a contagem que já recebeu de `action.forms.list` |
| CB-14 | Config aponta para formulário excluído / de outra org / despublicado | Filtrado antes da transação. A geração não falha — anexa só o que existe |
| CB-15 | Formulário gerador também presente na lista de extras | Deduplicado antes da transação; `skipDuplicates: true` como segunda defesa. `order = 0` garantido |
| CB-16 | Dois técnicos preenchem o mesmo checklist ao mesmo tempo | Duas `FormResponses` distintas com o mesmo `actionId`. **Permitido** — o card já suporta N respostas |
| CB-17 | Resposta parcial abandonada (`completedAt = NULL`) | Nasce com `actionId` (o auto-save já o passa) e aparece como `in_progress`. O detector de formulário abandonado filtra por `completedAt IS NULL` e não é afetado |
| CB-18 | Dados retroativos | Todas as 336 respostas ficam `actionId = NULL` e recebem badge "Avulsa" no lead. No dialog da Action não aparecem — exceto a geradora, que entra pela união com `Action.formResponseId` (ver CA-7) |
| CB-19 | `form.list` aceita `trackingId` e ignora | Pré-existente, fora de escopo. Registrado para não ser "descoberto" de novo |

## 6. Decisões de design

### D-1 — Manter `Action.formResponseId` e adicionar `FormResponses.actionId`

- **Escolha**: os dois FKs coexistem, com significados distintos.

  | Campo | Direção | Semântica |
  | --- | --- | --- |
  | `Action.formResponseId` (existe) | Action → Response | **"foi gerada por"** — proveniência |
  | `FormResponses.actionId` (novo) | Response → Action | **"pertence a"** — posse |
  | `ActionForm` (novo) | Action ↔ Form | **"deve ser preenchido nesta O.S."** — pauta |

- **Alternativas descartadas**: (a) substituir `formResponseId` por uma flag
  `isOrigin` em `FormResponses` — exigiria backfill, vetado, e perderia um FK já
  indexado e com dois consumidores de UI; (b) resolver só com `actionId`, sem
  `ActionForm` — uma O.S. recém-criada tem 4 checklists **em branco**, então o
  dialog abriria vazio; (c) resolver só com `ActionForm`, sem `actionId` — duas
  O.S. do mesmo veículo com o mesmo checklist não teriam como separar suas
  respostas.
- **Consequência**: existe um laço semântico de exatamente um par de linhas (a
  resposta geradora aponta para a Action e vice-versa). Ambas as colunas são
  nullable, então não há dependência de inserção. Vira invariante:

  - **I1** — `action.formResponseId = R` ⟹ `R.actionId = action.id`
  - **I2** — a recíproca **não** vale: `R.actionId = A` não implica `A.formResponseId = R`
  - **I3** — `R.actionId = A` ⟹ `R.form.organizationId = A.workspace.organizationId`
  - **I4** — `R.actionId = A` e `R.leadId ≠ null` ⟹ `R.leadId = A.leadId`
  - **I5** — `R.actionId = A` ⟹ existe `ActionForm(A, R.formId)`; a leitura ainda
    faz união defensiva, para nunca haver resposta invisível

  Garantidas por código, não por constraint.

### D-2 — Pauta na config do formulário (`attachFormIds`) já no v1

- **Escolha**: `ActionTemplate` ganha `attachFormIds: string[]`, e toda Action
  gerada nasce com esses formulários na pauta.
- **Alternativa descartada**: só vínculo manual. Na oficina isso significa o
  técnico repetir 4 cliques por O.S. — o valor da feature está em a O.S. nascer
  com a pauta pronta.
- **Consequência**: ~70 linhas (tipo + normalizador + seeding + multi-select).
  Sem migration: é JSON em `FormSettings.generateActionsConfig`, já normalizado
  defensivamente. Adiar custaria um segundo PR completo.

### D-3 — Preenchimento interno continua NÃO gerando Action

- **Escolha**: `form.createResponseForLead` permanece sem chamar
  `generateActionsForResponse`.
- **Alternativa descartada**: "fechar o gap" e gerar em todo preenchimento.
  Seria um **bug**: preencher o checklist #2 da O.S. #123, a partir do dialog da
  própria O.S., criaria uma O.S. #124.
- **Consequência**: registrado aqui para que ninguém "conserte" isso depois sem
  ler a spec.

### D-4 — Query param `?fromAction=` em vez de segmento de rota

- **Escolha**: o dialog navega para
  `/formulario/novo/[formId]/[leadId]?fromAction=<id>`.
- **O nome importa**: `?actionId=` **não** pode ser usado. O
  `modal-provider.tsx` do layout da plataforma lê `actionId` por
  `useQueryState` e abre o `ViewActionModal` para qualquer URL que tenha esse
  parâmetro — o formulário abria com o modal da tarefa por cima.
- **Alternativas descartadas**: 3º segmento de rota — obrigaria a duplicar as 355
  linhas de `page.tsx` ou virar catch-all opcional; e criaria assimetria com a
  rota de **edição**, que não precisa de nada porque o `actionId` já está
  persistido na resposta.
- **Consequência**: links existentes sem `actionId` continuam funcionando. Exige
  `<Suspense>` acima do `useSearchParams()` (Next 16), senão o build falha com
  `missing-suspense-with-csr-bailout`.

### D-5 — Dialog do lead com dois modos

- **Escolha**: `LeadFormsDialog` ganha um alternador — "Por formulário" (o grid
  atual, intacto) e "Respostas" (lista plana cronológica com badge da tarefa e
  filtro).
- **Alternativa descartada**: substituir o grid pela lista plana. Formulários que
  o lead **nunca** preencheu sumiriam, e com eles o CTA "Preencher" — que é a
  razão documentada da reformulação v2 desse dialog (`lead-forms-dialog.tsx:33-42`).
- **Consequência**: zero regressão; badge e filtro ficam onde fazem sentido
  (linhas de resposta).

### D-6 — Sem backfill heurístico, mas com reconciliação determinística

- **Escolha**: nenhuma resposta é vinculada por inferência. Mas as respostas que
  **geraram** uma tarefa são reconciliadas: `actions.form_response_id` é uma FK
  real, então não há adivinhação — a migration
  `20260817020000_backfill_action_scoped_forms` materializa a invariante I1 (e
  a I5, criando a linha de pauta) nas tarefas criadas antes da feature.
- **Alternativa descartada**: inferir o vínculo por proximidade temporal (mesma
  lead, mesmo form, criada logo após a Action). Vincularia errado sem forma de
  auditar. Isso continua fora.
- **Consequência**: as 30 tarefas antigas abrem com a pauta correta e o ícone de
  formulários no card (que depende de `_count.forms`). As outras 306 respostas
  seguem "Avulsas" — corretamente, porque de fato não pertencem a tarefa nenhuma.
- **Idempotência**: `AND action_id IS NULL` + `ON CONFLICT DO NOTHING`, então
  reexecutar é inofensivo. O `DISTINCT ON` cobre o caso de uma resposta ter
  gerado mais de uma tarefa (a relação é 1:N e `action_id` comporta uma só).

## 7. Impacto

- [x] Schema / migration (`prisma/schema.prisma`)
- [x] Procedures oRPC (contrato de entrada/saída)
- [ ] Realtime (Pusher / event-bus)
- [ ] Automações (Inngest)
- [ ] Env vars novas
- [ ] Breaking change para clientes existentes
- [ ] Documentação obrigatória (CLAUDE.md itens 10 / 14 / 16)

**Schema**: novo model `ActionForm` (`action_forms`); `FormResponses.actionId` +
FK `ON DELETE SET NULL`; índices faltantes em `form_responses` (`action_id`,
`form_id`, `lead_id`); inversos em `Action`, `Form` e `User`.

**Procedures**: novas `action.forms.list`, `action.forms.attach`,
`action.forms.detach`. Alteradas (só adição): `leads.listFormResponses` (campos
`actionId`/`action` + **correção de segurança** do CB-10),
`form.createResponseForLead` (`actionId` opcional), `action.listByColumn`
(`_count.forms`), `action.update` (guarda do CB-5).

**Domínios cruzados**: a decisão mora em `form` (o artefato escopado é a resposta,
e a config que semeia a pauta vive em `FormSettings`), mas altera `actions` e
`leads`.

## 8. Plano de testes

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1 | manual + SQL | Submit público no form com geração ativa; `SELECT * FROM action_forms WHERE action_id = ...` (5 linhas, order 0 = gerador) e `SELECT action_id FROM form_responses WHERE id = ...` |
| CA-2 | manual | Abrir o card da Action da "Lan Logística" no board e conferir a lista contra os 2 formulários do lead |
| CA-3 | manual + SQL | Preencher pelo dialog, um "Próximo", depois "Enviar"; `SELECT id, action_id FROM form_responses ORDER BY created_at DESC LIMIT 2` — uma linha só, com `action_id` |
| CA-4 | manual | Dialog do lead, modo "Respostas": badge presente, "Avulsa" nas antigas, filtro reduz a lista |
| CA-5 | manual + SQL | Arquivar e excluir a Action; contar `action_forms` (0) e `form_responses` (5, com `action_id IS NULL`) |
| CA-6 | manual | Logar em outra org e chamar `action.listForms` com o id da primeira → `NOT_FOUND` |
| CA-7 | manual | Abrir o dialog de uma das 30 Actions geradas antes da feature |
| CA-8 | manual | Tentar desvincular o gerador; desvincular um checklist com 2 respostas |
| CA-9 | manual | Comparar o modo "Por formulário" com o comportamento atual |
| RNF-2 | automatizado | `npx tsc --noEmit` cobre os 3 consumidores de `leads.listFormResponses` |
| RNF-4 | revisão | Inspeção do diff de `generate-actions-for-response.ts` |

## 9. Riscos e rollback

**Migration reversível**: `DROP TABLE action_forms;`
`ALTER TABLE form_responses DROP COLUMN action_id;` mais os `DROP INDEX`. Não há
perda de dado pré-existente porque não há backfill.

| Risco | Mitigação |
| --- | --- |
| Mudar a saída de `leads.listFormResponses` quebra 3 consumidores de uma vez | Só **adicionar** campos; `tsc --noEmit` como rede |
| `CREATE INDEX` sob lock em `form_responses` | Não-problema: 336 linhas. O Prisma envolve a migration numa transação, então `CREATE INDEX CONCURRENTLY` não seria possível de qualquer forma |
| Auto-save cria a resposta antes do submit — se só o submit passasse `actionId`, a resposta nasceria órfã | `actionId` nas **duas** chamadas de `createResponseForLead` na página `/formulario/novo` |
| `useSearchParams` sem `<Suspense>` quebra o `pnpm build` | Envolver o corpo da página; `pnpm build` na verificação |
| Regressão silenciosa no dialog do lead | D-5 preserva o grid atual como modo padrão |

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-08-16 | João Gabriel | Criada |
| 2026-08-17 | João Gabriel | D-6 ganha reconciliação determinística (migration `20260817020000_backfill_action_scoped_forms`). O não-objetivo "sem backfill" continua valendo para inferência heurística; vincular a resposta que **gerou** a tarefa não é inferência — a FK `form_response_id` já diz qual é. Sem isso, as 30 tarefas antigas abriam com pauta vazia e sem o ícone de formulários no card |
| 2026-08-17 | João Gabriel | CB-5 passa de "recusar a troca de lead" para "trocar e desvincular as respostas". Bloquear deixava o usuário sem saída: não há ferramenta óbvia pra desvincular resposta antes de repontar. Desvincular põe a resposta de volta no lead que a preencheu, que é o resultado correto em qualquer leitura. Implementado em `leads/update-action-by-lead.ts`, não em `action.update` — esta última nem aceita `leadId` |
| 2026-08-16 | João Gabriel | D-4: o parâmetro passa a ser `?fromAction=`. Com `?actionId=` o `modal-provider` do layout abria o `ViewActionModal` por cima do formulário — o nome colidia com um parâmetro global preexistente |
| 2026-08-16 | João Gabriel | CB-13 passa a recusar com a contagem na mensagem em vez de `CONFLICT` — o error map do oRPC no projeto não expõe esse código; a UI confirma usando a contagem que já tem de `action.forms.list`. Nomes finais das procedures (`action.forms.*`). Filtro `published` em `form.list` saiu do escopo: os consumidores já filtram no cliente e nada na spec dependia disso. `action.get` não recebeu `_count.forms` — só o `listByColumn` precisa, é ele que alimenta o ícone do card |
