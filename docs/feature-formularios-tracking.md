# Formulários inteligentes + Jornada do Lead — Notas de migração

Branch: `feature/W-formularios-adicao-campos-integracoes-tracking-20260507`

Este documento descreve **o que o dev precisa rodar localmente** para que as
mudanças desta branch funcionem em runtime. O assistente não roda comandos
Prisma/SQL — todas as migrações ficam para o dev.

## 1. Regenerar o cliente Prisma e aplicar a migration

Após puxar a branch:

```bash
pnpm prisma migrate dev --name formularios_tracking_jornada
pnpm prisma generate
```

A migration cobre:

- `Status.slaHours` (Int?), `Status.notifyClientOnEnter`, `Status.clientNotifyTemplate`
- `Lead.publicToken` (String? @unique), `Lead.slaDeadline`, `Lead.statusEnteredAt`
- `LeadHistory`: novo enum `LeadEventType` + colunas `previousStatusId`,
  `newStatusId`, `previousTrackingId`, `newTrackingId`, `previousResponsibleId`,
  `newResponsibleId`, `metadata`. Coluna `userId` agora é nullable
  (eventos automáticos sem usuário).
- Novo modelo `TrackingCardConfig` (id, trackingId @unique, fields Json,
  showSlaTimer Boolean).

> **Atenção:** o helper `recordLeadEvent` define um union local de `LeadEventType`
> em `src/features/leads/lib/history.ts` para que o código compile **antes** do
> `prisma generate`. Após gerar o cliente, troque o tipo local pelo importado:
> ```ts
> // de:
> export type LeadEventType = "ACTION_CHANGE" | ...;
> // para:
> import type { LeadEventType } from "@/generated/prisma/client";
> ```

## 2. Variáveis de ambiente

Confirme que `NEXT_PUBLIC_APP_URL` está no `.env.local` — é usada para montar o
link público do lead (`{NEXT_PUBLIC_APP_URL}/public/lead/{token}`).

## 3. O que ficou para o dev terminar (UI)

Os procedures, schema, hooks e componentes principais estão prontos. Faltam as
**telas de configuração** abaixo (toda a infra que elas precisam já existe):

### a) Configuração de SLA por status
- Procedure: usar `tracking.update` (já existe) ou criar `status.update` que
  permita gravar `slaHours`, `notifyClientOnEnter`, `clientNotifyTemplate`.
- Onde: aba "Status" das settings do tracking. Adicionar input numérico de
  horas, switch de "Notificar cliente ao entrar nesta etapa" e textarea
  com o template (suportando `{{public_link}}`, `{{status}}`, `{{name}}`).
- Permissão: `useOrgRole().canManage` (Owner ou Moderador).

### b) Configuração dos campos do card
- Procedures prontas: `tracking.getCardConfig`, `tracking.updateCardConfig`.
- Onde: nova aba "Aparência" no `tracking-settings-dialog`.
- UI: drag-drop de campos com `@dnd-kit`. Campo `fields: Field[]` onde cada
  Field é `{ key, label, type: 'lead' | 'form' | 'custom', formFieldId?, formId? }`.
- Render no card: editar `lead-item.tsx` para chamar `tracking.getCardConfig`
  e renderizar a lista dinamicamente quando `fields` não estiver vazia,
  com fallback para o layout atual.

### c) Botão "Compartilhar com o cliente" no detalhe do lead
- Procedure pronta: `leads.generatePublicLink` (também aceita `rotate: true`).
- Onde: header do `LeadInfo` ou novo dropdown ao lado do botão de jornada.
- UI: ao clicar, copiar URL no clipboard e mostrar toast.

### d) Workflow padrão "Notificar cliente ao mudar status"
- Tudo pronto: variável `{{public_link}}` já está no `send-message/variables.ts`
  e é resolvida em `send-message/executor.ts`.
- Resta: criar template/atalho de workflow pré-pronto que combine
  `MOVE_LEAD_STATUS` → `SEND_MESSAGE` (pode ser feito 100% via UI atual de
  workflows; nenhum código novo necessário).

## 4. Arquivos novos / modificados

### Schema
- `prisma/schema.prisma`

### Helpers
- `src/features/leads/lib/history.ts` *(novo — `recordLeadEvent`)*
- `src/features/leads/lib/sla.ts` *(novo — `computeSlaDeadline`, `computeSlaState`)*

### Form blocks (novos arquivos)
- `src/features/form/types.ts` *(`FormBlockType` estendido)*
- `src/features/form/lib/form-blocks.ts` *(registry estendido)*
- `src/features/form/components/common/blocks/`:
  - `checkbox-block.tsx`
  - `dropdown-block.tsx`
  - `date-picker-block.tsx`
  - `user-select-block.tsx` *(exporta `UserSelectBlock` e `MultiUserSelectBlock`)*
  - `file-upload-block.tsx`
  - `image-upload-block.tsx`
  - `image-display-block.tsx`
  - `paragraph-with-title-block.tsx`
  - `signature-blocks.tsx` *(exporta `SignatureUserBlock` e `SignatureClientBlock`)*
  - `slider-block.tsx`

### Lead detail
- `src/features/leads/components/lead-details.tsx` *(aba Formulários adicionada)*
- `src/features/leads/components/lead-form-responses.tsx` *(novo)*
- `src/features/leads/components/lead-journey-tree.tsx` *(novo)*
- `src/features/leads/components/lead-info/index.tsx` *(ícone de jornada adicionado)*
- `src/features/leads/components/sla-timer.tsx` *(novo)*

### Procedures
- `src/app/router/leads/list-form-responses.ts` *(novo)*
- `src/app/router/leads/list-journey.ts` *(novo)*
- `src/app/router/leads/generate-public-link.ts` *(novo)*
- `src/app/router/leads/get-by-public-token.ts` *(novo)*
- `src/app/router/leads/update.ts` *(hooks de jornada + recompute SLA)*
- `src/app/router/leads/index.ts` *(exports)*
- `src/app/router/leads/get-many.ts` *(select expandido)*
- `src/app/router/trackings/get-card-config.ts` *(novo)*
- `src/app/router/trackings/update-card-config.ts` *(novo)*
- `src/app/router/trackings/index.ts` *(exports)*
- `src/app/router/form/public/submut-response.ts` *(emite FORM_SUBMITTED)*

### Executions / Inngest
- `src/features/executions/components/move-lead/executor.ts` *(SLA + jornada)*
- `src/features/executions/components/responsible/executor.ts` *(jornada)*
- `src/features/executions/components/send-message/variables.ts` *(`{{public_link}}`)*
- `src/features/executions/components/send-message/executor.ts` *(resolução de `{{public_link}}`)*

### Página pública
- `src/app/(public)/lead/[token]/page.tsx` *(novo)*

### Card kanban
- `src/features/trackings/components/lead-item.tsx` *(SlaTimer)*
- `src/features/trackings/types.ts` *(slaDeadline opcional)*

## 5. Como testar end-to-end

1. **Builder** — crie um formulário, arraste cada novo bloco, salve e publique.
   Abra `/submit-form/{id}` numa aba anônima e responda. Verifique
   `FormResponses.jsonResponse` no Studio.
2. **Aba Formulários** — abra o lead criado pela resposta acima, vá na nova aba
   "Formulários" e veja a resposta listada.
3. **Jornada** — clique no ícone de árvore ao lado de "Histórico" no LeadInfo.
   Mude status, responsável e tracking via UI; deve aparecer cada transição
   na linha do tempo.
4. **SLA** — no Studio, defina `Status.slaHours = 1` para uma coluna. Mova um
   lead para essa coluna e verifique o cronômetro no card (verde→amarelo→vermelho).
5. **Link público** — chame `orpc.leads.generatePublicLink` (ou via curl com
   token de auth) e abra a URL retornada em janela anônima. Mude o status no
   admin e veja a página atualizar sozinha (Pusher).
6. **WhatsApp** — em um workflow, use o template
   `"Olá {{name}}, atualizamos: {{status}}. Acompanhe: {{public_link}}"`.
   Mova o lead → mensagem deve chegar com a URL correta.

## 6. Pendências reconhecidas

- N-Box e anotação visual em foto: fora deste MVP (acordado com o user).
- Email transacional (Resend): fora deste MVP (WhatsApp basta para a Bosch).
- Histórico de mecânico por linha de serviço: fase 2 (modelo `ServiceExecution`).
- UI de configuração SLA / Card / botão de compartilhamento: ver seção 3.
