# Workspace + Actions ↔ Tracking + Leads — Visão Geral

> Documento vivo do elo entre o domínio **Workspace/Action** (execução: quadros, tarefas, eventos) e o domínio **Tracking/Lead** (comercial: pipeline, contatos). Última revisão: 2026-07-22 (**Fase 3** — vínculo Action → Lead reativado + correções S1/S2).
>
> **Regra de manutenção:** sempre que alterar qualquer coisa em `src/features/workspace/`, `src/features/actions/`, os routers `src/app/router/leads/`, ou os modelos `Workspace`/`WorkspaceColumn`/`WorkspaceMember`/`Action`/`SubActions` no `prisma/schema.prisma`, **atualize este arquivo na mesma sessão** — tabelas, roadmap/status, decisões e changelog sincronizados com o código. Espelha a regra dos itens 10 e 14 do CLAUDE.md.

---

## 1. Objetivo

Hoje a NASA tem dois domínios maduros que **não conversam**:

- **Tracking/Lead** — pipeline comercial. Quem é o lead, em que etapa está, quem é o responsável, qual o histórico.
- **Workspace/Action** — execução. Quadros kanban com tarefas, reuniões, eventos e notas.

O schema do Prisma **já modela** a ponte entre os dois (`Workspace.trackingId`, `Action.trackingId`, `Action.leadId`), mas nenhuma dessas colunas tem escritor vivo no código. O resultado é que a operação comercial e a execução vivem em silos: não dá pra ver "quais tarefas existem para este lead" nem "quais quadros pertencem a este funil".

O objetivo desta linha de trabalho é **ativar essas pontes** de forma incremental e segura, começando pela mais estrutural (Workspace → Tracking) e descendo até o vínculo fino (Action → Lead).

---

## 2. Estado Atual

| Item | Status |
| --- | --- |
| Fase em andamento | **Fase 3 implementada ✅** (backend) — criação de tarefa a partir do lead, com workspace resolvido pelo tracking; dívidas **S1 e S2 fechadas**. ⚠️ A aba "Tarefas" foi **desmontada** por reprovação de UI/UX — ver §6.3/U1 e Fase 3.2 |
| Fase anterior | **Fase 2 implementada ✅** — Action herda o `trackingId` do workspace na criação, re-resolve ao mover/copiar e recebe cascata quando o vínculo do workspace muda |
| Fase anterior | **Fase 1.1 implementada ✅** — seletor de workspaces conectados na toolbar do board de tracking |
| Fase 1 | **✅** — vínculo Tracking → Workspaces (1:N), com seleção na criação e na aba Geral das configurações |
| `Workspace.trackingId` | **Ativo ✅** — gravável em `workspace.create` e `workspace.update`, filtrável em `workspace.list` |
| `Action.trackingId` | **Ativo ✅** — herdado do workspace na criação, re-resolvido em move/copy e cascateado quando o vínculo do workspace muda. **Sem migration pendente** |
| `Action.leadId` | **Ativo ✅** — gravável via `leads.createAction`; repontar exige mesmo tracking |
| Validação de coerência | ⬜ Inexistente — nada garante que lead/tracking/workspace/org sejam consistentes entre si (ver §6) |
| Dívidas de segurança | 🚧 Mapeadas em §6, **não corrigidas** salvo onde indicado |

---

## 3. Mapa do Modelo de Dados

### 3.1 As três pontes

| Ponte | Coluna | Cardinalidade | Delete |
| --- | --- | --- | --- |
| Workspace → Tracking | `Workspace.trackingId` ([schema.prisma:1170](../prisma/schema.prisma)) | **1 tracking : N workspaces** | `SetNull` |
| Action → Tracking | `Action.trackingId` ([schema.prisma:1280](../prisma/schema.prisma)) | 1 tracking : N actions | `SetNull` |
| Action → Lead | `Action.leadId` ([schema.prisma:1283](../prisma/schema.prisma)) | 1 lead : N actions | `SetNull` |

> **Nota importante:** a cardinalidade 1:N de tracking→workspaces **já existia no schema** desde sempre — `trackingId` é uma FK nullable no lado `Workspace`, então N workspaces podem apontar pro mesmo tracking. A Fase 1 **não precisou de migration**; foi puramente wiring de aplicação.

### 3.2 Hierarquia

```
Organization
 ├─ Tracking ──────────────┐  (1:N)
 │   ├─ Status             │
 │   │   └─ Lead ──────────┼──┐  Action.leadId (1:N)
 │   ├─ TrackingParticipant│  │
 │   └─ TrackingConsultant │  │
 │                         │  │
 └─ Workspace ◄────────────┘  │  Workspace.trackingId (N:1)
     ├─ WorkspaceColumn        │
     ├─ WorkspaceMember        │
     └─ Action ◄───────────────┘
         ├─ SubActions
         ├─ ActionsUserParticipant
         └─ ActionsUserResponsible
```

`Action` carrega **cinco** FKs denormalizadas: `workspaceId` (obrigatória), `columnId`, `trackingId`, `leadId`, `organizationId`, `orgProjectId`. Todas exceto `workspaceId` são nullable e nenhuma tem invariante garantida em código.

---

## 4. Modelos de Permissão (dois, desconectados)

### 4.1 Tracking — opt-in explícito

Acesso é dado por `TrackingParticipant` (com `ParticipantRole`). As listagens filtram `participants: { some: { userId } }`:

- [`list-trackings.ts:24`](../src/app/router/trackings/list-trackings.ts)
- [`list-dashboard.ts:36`](../src/app/router/trackings/list-dashboard.ts)

Customização do board é gated em `TrackingParticipant.role === "OWNER"` (ver `use-can-customize-board.ts`).

### 4.2 Workspace — org inteira por padrão

`WorkspaceMember` existe com `WorkspaceMemberRole` (OWNER/MEMBER/VIEWER), mas [`workspace.create`](../src/features/workspace/server/routes/create.ts) insere **todos os membros da organização** automaticamente (criador vira `OWNER`, o resto `MEMBER`). Na prática, membership de workspace ≈ organização inteira.

Os caminhos de leitura de actions (`listByWorkspace`, `listByColumn`, `searchActions`) filtram pelo **`Member.role` do better-auth**, não pelo `WorkspaceMember.role`:

```ts
// list-action-by-workspace.ts:33-55 (resumo)
if (member.role === "member") visibilityFilter = { OR: [{ createdBy }, { participants }] };
// qualquer outro role → visibilityFilter = {} (vê tudo)
```

### 4.3 Consequência

Os dois sistemas **não se sincronizam**. Participante de tracking não vira membro de workspace, e vice-versa. Ao vincular um workspace a um tracking (Fase 1), o vínculo é **organizacional//informativo**, não propaga permissão. Qualquer fase futura que queira propagar acesso precisa decidir explicitamente a direção da sincronização.

---

## 5. Roadmap

| Fase | Escopo | Status |
| --- | --- | --- |
| **1** | **Vínculo Tracking → Workspaces (1:N).** `trackingId` gravável em create/update, filtro em list, seletor na UI de criação e configurações | **✅ Implementada** |
| **1.1** | **Seletor de workspaces conectados** na toolbar do tracking, com atalho de navegação por item | **✅ Implementada** |
| **2** | **Herança `Action.trackingId`.** Action criada num workspace vinculado herda o `trackingId` do workspace; backfill das actions existentes | **✅ Implementada** |
| **3** | **Reativar vínculo Action → Lead.** Criação de tarefa pelo painel do lead + correções S1/S2 | **✅ Implementada** |
| **3.1** | **Seletor de lead dentro da action** (direção inversa, não coberta pela Fase 3) | ⬜ Planejada |
| **3.2** | **Redesenho da aba "Tarefas" do lead.** Backend pronto e funcional; a aba foi **desmontada** por reprovação de UI/UX. Ver §6.4 | 🚧 **Pendente — prioridade** |
| **4** | **Validação de coerência.** Garantir que `leadId` pertence ao `trackingId`, que o workspace pertence à org, e que `move-action` atualiza os campos denormalizados | ⬜ Planejada |
| **5** | **Endurecimento de permissão.** Fechar as rotas sem checagem de recurso listadas em §6 | ⬜ Planejada |

---

## 6. Dívidas Conhecidas

Levantadas na análise de 2026-07-22. **Não corrigidas** salvo indicação em contrário — documentadas aqui pra não se perderem.

### 6.1 Segurança

| # | Onde | Problema |
| --- | --- | --- |
| S1 | [`leads/update-action-by-lead.ts`](../src/app/router/leads/update-action-by-lead.ts) | ~~Sem org, sem checagem de dono, gravava `createdBy` do chamador~~ — **corrigida na Fase 3**: `requireOrgMiddleware`, escopo via `workspace.organizationId`, `createdBy` e `trackingId` removidos do write |
| S2 | [`leads/list-actions.ts`](../src/app/router/leads/list-actions.ts) | ~~`where: { leadId }` sem escopo de org~~ — **corrigida na Fase 3**: filtra pelo tracking do lead (org + participação) |
| S3 | [`workspace/update.ts`](../src/features/workspace/server/routes/update.ts) | ~~Atualizava por id sem checar org~~ — **corrigido na Fase 1** (escopo de org + participação no tracking) |
| S4 | `actions/list-action-by-workspace.ts:85` | `where: { workspaceId }` sem escopo de org → role privilegiado da org A lê actions de workspace da org B |
| S5 | `actions/` — ~18 procedures | `update`, `toggleDone`, `reorder`, `addParticipant`, `createSubAction` e afins rodam com auth+org apenas, **zero checagem de recurso** |

### 6.2 Consistência

| # | Onde | Problema |
| --- | --- | --- |
| C1 | [`workspace/move-action.ts`](../src/features/workspace/server/routes/move-action.ts) | ~~Move `workspaceId` sem atualizar `trackingId`~~ — **`trackingId` corrigido na Fase 2** (re-resolvido do destino). `organizationId`/`orgProjectId` seguem rançosos |
| C2 | `actions/create.ts:100` | Grava `workspaceId` ao lado de `organizationId` sem verificar que o workspace pertence àquela org |
| C3 | `workspace/approve-share.ts:60` | Copia pra `targetWorkspaceId` não validado |
| C4 | [`trackings/components/filters/index.tsx:92`](../src/features/trackings/components/filters/index.tsx) | **Erro de hidratação pré-existente** na toolbar do tracking. `canCustomizeBoard && !collapsed` muda a contagem de filhos entre servidor e cliente (a query resolve diferente no SSR), então o React desalinha os irmãos e reporta mismatch no botão "Personalizar". Reproduzido no baseline em 2026-07-22, **não** causado pela Fase 1.1. Correção provável: renderizar o botão sempre e controlar só a visibilidade, ou aguardar `isFetched` antes de decidir |

### 6.3 UI pendente

| # | Onde | Situação |
| --- | --- | --- |
| U1 | [`leads/components/lead-details.tsx`](../src/features/leads/components/lead-details.tsx) | **Aba "Tarefas" desmontada em 2026-07-22 por reprovação de UI/UX.** O backend da Fase 3 está completo e verificado (criar tarefa pelo lead funciona ponta a ponta), e `TabNotes` continua importado no arquivo. Para religar: recolocar a entrada `{ name: "Tarefas", value: "tasks", icon: StickyNoteIcon, content: <TabNotes leadId={...} trackingId={...} /> }` no array `tabs`. **Antes de religar, redesenhar** — ver notas abaixo |

**O que precisa melhorar antes de voltar** (`features/leads/components/notes/`):

- `container-item-lead.tsx` é o principal ofensor: cada tarefa vira um bloco alto com editor rico embutido, blocos de Lembrete/Prioridade/Responsável sempre expandidos e `px-8 py-4` — três tarefas já estouram a altura do painel. Deveria ser uma linha compacta que expande sob demanda.
- O formulário de criação ocupa o topo inteiro com um editor rico completo (barra de ferramentas com H1/H2/H3, listas, alinhamento) para o que na maioria das vezes é uma frase. Considerar campo simples com opção de expandir.
- Sem estado vazio desenhado para "nenhuma tarefa ainda".
- O card não mostra o **título** como texto — ele vive dentro de um `<input>`, o que confunde leitura e acessibilidade.

### 6.4 Código morto

| # | Onde | Situação |
| --- | --- | --- |
| D1 | [`leads/create-action-by-lead.ts`](../src/app/router/leads/create-action-by-lead.ts) | ~~Arquivo inteiro comentado~~ — **reescrito e ativado na Fase 3** |
| D2 | [`leads/components/notes/index.tsx`](../src/features/leads/components/notes/index.tsx) | ~~Botão "Adicionar nota" era `onClick={() => {}}`~~ — **substituído na Fase 3** por formulário funcional |
| D3 | `ActionMirror` (schema.prisma:3710) | Modelo sem nenhuma referência em `src/` — zero hits fora do generated |
| D4 | `workspace-calendar-modal.tsx:171` | Filtro de leads deduz leads das actions do mês. Passa a funcionar conforme actions ganham `leadId` (Fase 3) |

---

## 7. Changelog

### 2026-07-22 — Fase 3: vínculo Action → Lead reativado ✅

Fecha a terceira ponte. O painel do lead volta a criar tarefas, e elas nascem vinculadas ao lead, ao tracking e a um workspace real.

| Arquivo | Mudança |
| --- | --- |
| `leads/create-action-by-lead.ts` | **Reescrito e ativado.** A versão comentada criava a action **sem `workspaceId`** — campo obrigatório no schema, então nunca teria funcionado. Agora resolve o workspace pelo tracking do lead |
| `leads/update-action-by-lead.ts` | **S1 fechada** — `requireOrgMiddleware`, escopo via `workspace.organizationId`, `createdBy` e `trackingId` fora do write, repontar lead exige mesmo tracking |
| `leads/list-actions.ts` | **S2 fechada** — filtra pelo tracking do lead (org + participação) |
| `leads/index.ts` | `createAction` registrado |
| `leads/hooks/use-lead-action.tsx` | `useMutationCreateLeadAction` reativado, com mensagem de erro vinda do servidor |
| `leads/components/notes/index.tsx` | Formulário funcional (título + descrição + seletor de workspace quando há mais de um) no lugar do botão morto |

> ⚠️ **Atualização de 2026-07-22, mesma data:** a aba "Tarefas" chegou a ser montada em `lead-details.tsx` e **foi removida em seguida** — layout reprovado. O backend permanece ativo e testado; só a superfície visual saiu. Detalhes e checklist de redesenho em §6.3/U1.

**Decisões:**

- **O workspace é resolvido pelo tracking do lead**, com default no primeiro workspace conectado e seletor só quando há mais de um. Sem workspace conectado, a aba mostra um aviso apontando pras configurações em vez de um formulário que falharia. É a Fase 1 pagando dividendo: sem o vínculo tracking↔workspace não haveria como responder "onde essa tarefa mora".
- **`trackingId` saiu do contrato das duas rotas.** Antes o cliente mandava; agora é derivado do lead. Cliente escolher o tracking é justamente o que permitia incoerência entre `leadId` e `trackingId`.
- **`createdBy` nunca mais é escrito no update.** Era o vetor de roubo de autoria da S1, e afetava até edições legítimas de descrição.
- **Repontar a action pra outro lead exige mesmo tracking** — cruzar trackings quebraria a coerência que a Fase 2 estabeleceu.

**Verificado em runtime:** tarefa criada pelo lead nasceu com `leadId`, `trackingId` e `workspaceId`/`columnId` resolvidos, e apareceu na aba do lead. Nas guardas: action de fora da org → `NOT_FOUND`; lead de outra org em `listActions` → 0 ações; lead inexistente em `createAction` → `NOT_FOUND`; repontar pra lead de outro tracking → `FORBIDDEN`; `trackingId` forjado no update → ignorado; `createdBy` preservado. Dados de teste removidos.

### 2026-07-22 — Fase 2: herança de `Action.trackingId` ✅

A action passa a nascer — e permanecer — com o tracking do workspace onde vive. Workspace sem vínculo produz `null`, como antes.

| Arquivo | Mudança |
| --- | --- |
| `actions/lib/workspace-tracking.ts` | **Novo.** `resolveWorkspaceTrackingId(workspaceId, prisma?)` — lookup por PK, aceita client de transação via `PrismaLike` |
| `actions/server/routes/create.ts` | Caminho principal de criação herda o tracking |
| `actions/server/routes/promote-sub-action.ts` | Passa a **resolver do workspace** em vez de copiar da action-pai (a pai pode ser pré-Fase 2 e propagar `null`) |
| `workspace/server/routes/copy-action.ts` | Resolve do workspace **de destino** — a cópia pode aterrissar em outro quadro |
| `workspace/server/routes/move-action.ts` / `move-actions.ts` | Re-resolvem ao mover, fechando a dívida **C1** |
| `workspace-executions/.../executor.ts` | Usa `workspace.trackingId` (o workspace já estava carregado) |
| `astro/server/tools/actions/index.ts` | `trackingId` entrou no `select` do workspace e na criação |
| `public-calendar/utils/create-event-from-parsed.ts` | Herda na criação do evento público |
| `ia/ai-workspace/tools/create-action.ts` | Herda via `tracking: { connect }` (o arquivo usa sintaxe de relação) |
| `nasa-planner/create-campaign-task.ts` / `create-campaign-event.ts` | Herdam na criação |
| `nasa-command/execute.ts` | Herda na criação da tarefa |
| `workspace/server/routes/update.ts` | **Cascata**: mudar o `trackingId` do workspace atualiza as actions dele na mesma transação |

**Decisões:**

- **Herança na criação + re-resolução no movimento.** Só preencher na criação deixaria o campo rançoso assim que alguém arrastasse a action pra outro quadro — foi exatamente a dívida C1. `moveAction`, `moveActions` e `copyAction` re-resolvem do destino, então o invariante "trackingId da action == trackingId do seu workspace" vale sempre.
- **Cópias cross-org continuam sem herdar.** `copy-action-to-org.ts` e o trecho de cópia em `create.ts` seguem descartando `trackingId`/`leadId` de propósito: o tracking pertence à org de origem e não faz sentido na destino.
- **`promote-sub-action` deixou de copiar da action-pai.** Resolver do workspace cobre o caso de actions antigas com `trackingId` nulo, que propagariam o nulo adiante.
- **Cascata no `workspace.update` em vez de migration de backfill.** A primeira versão desta fase trazia uma migration de dados; ela foi **removida antes do merge** por ser inócua: em produção nenhum workspace tem `tracking_id` (a Fase 1 é que introduz o primeiro escritor), então o `UPDATE` casaria zero linhas. O problema real não é o deploy e sim o uso contínuo — vincular um workspace que **já tem** actions deixaria essas actions órfãs, e uma migration executada semanas antes não ajudaria. A cascata resolve os dois casos e dispensa migration.
- **A cascata só dispara quando o vínculo muda de fato** (`input.trackingId !== undefined && !== valor atual`), evitando um `updateMany` desnecessário a cada save da aba Geral. Roda dentro da mesma transação do update do workspace.

**Verificado em runtime:** action criada em workspace vinculado nasceu com o `trackingId`; movida pra workspace sem vínculo virou `null`; movida de volta, voltou a apontar. Na cascata, vincular um workspace com 4 actions preexistentes (todas `null`) preencheu as 4 de uma vez, e desvincular zerou as 4. Dados de teste removidos.

### 2026-07-22 — Fase 1.1: seletor de workspaces na toolbar do tracking ✅

Primeiro consumo visível do vínculo criado na Fase 1. A toolbar do board de tracking passa a mostrar quais workspaces estão conectados àquele tracking, com atalho de navegação.

| Arquivo | Mudança |
| --- | --- |
| `trackings/components/filters/workspaces-switcher.tsx` | **Novo.** Dropdown no padrão do `TrackingSwitcher`, listando os workspaces conectados via `useWorkspacesByTracking`. Cada item é um link para `/workspaces/<id>?action-view=kanban` com ícone `ArrowUpRight`. Badge com a contagem no gatilho |
| `trackings/components/filters/index.tsx` | `StatusFlowFilter` sai da toolbar inline, `WorkspacesSwitcher` entra no lugar (entre `TagsFilter` e `CalendarFilter`) |

**Decisões:**

- **O filtro de Status não foi removido do sistema** — continua disponível no Sheet de "Filtros" (`filters.tsx:41`), que é acessível pelo ícone de funil na mesma toolbar. Só saiu da barra inline, que era o pedido.
- **O item inteiro é o link, não só o ícone.** O ícone `ArrowUpRight` é a affordance visual do "abrir", mas a área clicável é a linha toda — evita uma zona morta no dropdown e espelha o comportamento do `TrackingSwitcher`.
- **Estado vazio explícito** quando nenhum workspace está conectado, apontando onde fazer o vínculo (configurações do workspace) em vez de mostrar um menu vazio.
- **O link força `?action-view=kanban`.** Vindo de um board de tracking (que é kanban), cair na visão de Lista do workspace quebraria a continuidade visual. O parâmetro é o mesmo `useQueryState("action-view")` de `actions-view-switcher.tsx:39`, e já havia precedente em `ia/ai-workspace/tools/create-action.ts:55`. Como é só um query param, o usuário troca pra Lista/Calendário normalmente depois.
- Diferente do `TrackingSwitcher` (que chama `orpc` direto e viola o item 9 do CLAUDE.md), este componente consome o hook `useWorkspacesByTracking`.

### 2026-07-22 — Fase 1: vínculo Tracking → Workspaces ✅

Ativa a primeira ponte. Um tracking pode ter **vários** workspaces; um workspace pertence a **no máximo um** tracking (ou nenhum — o vínculo é opcional).

**Sem migration** — `Workspace.trackingId` já existia no schema com índice.

| Arquivo | Mudança |
| --- | --- |
| `workspace/lib/tracking-link.ts` | **Novo.** `isTrackingAccessibleByUser` — valida que o tracking existe, pertence à org, não está arquivado e que o usuário é participante |
| `workspace/server/routes/create.ts` | Aceita `trackingId` opcional; valida antes de gravar |
| `workspace/server/routes/update.ts` | Aceita `trackingId` nullable (`null` desvincula); **passa a checar escopo de org** (fecha S3) |
| `workspace/server/routes/list.ts` | Aceita filtro opcional `trackingId`; inclui `tracking { id, name }` no retorno |
| `workspace/server/routes/get.ts` | Inclui `tracking { id, name }` no retorno |
| `workspace/hooks/use-workspace.ts` | `useWorkspacesByTracking` — lista workspaces de um tracking |
| `workspace/components/modals/create-workspace-modal.tsx` | Seletor de tracking (opcional) |
| `workspace/components/modals/tabs/general-tab.tsx` | Seletor de tracking com opção de desvincular |

**Decisões:**

- **Vínculo opcional, não obrigatório.** Workspaces avulsos (sem tracking) continuam sendo o caso normal — muitos quadros não são comerciais. Forçar vínculo quebraria os workspaces existentes.
- **Vínculo não propaga permissão.** Ligar um workspace a um tracking não adiciona os participantes do tracking como membros do workspace, nem o contrário. Os dois modelos de permissão continuam independentes (ver §4.3). Isso é deliberado pra manter a fase pequena e reversível; se a propagação for desejada, vira uma fase própria com decisão explícita de direção.
- **Validação exige participação no tracking.** Não basta o tracking ser da mesma org: o usuário precisa ser `TrackingParticipant`. Caso contrário seria possível descobrir/vincular trackings dos quais não se participa.
- **Trackings arquivados não são vinculáveis**, mas um vínculo existente sobrevive ao arquivamento do tracking (não há cascade — o campo só vira `null` se o tracking for deletado).
