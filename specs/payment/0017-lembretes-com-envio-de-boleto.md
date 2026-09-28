---
id: 0017
titulo: Lembretes que enviam o boleto por WhatsApp e e-mail
dominio: payment
status: em-revisao
autor: Weydson
criada: 2026-09-15
atualizada: 2026-09-15
branch: feature/W-astro-finance-tools-20260915
pr: https://github.com/Act962/nasa.ex/pull/392
peso: completa
---

# 0017 — Lembretes com envio de boleto (Fase 4)

---

## 1. Contexto

Depois que o Astro lança o boleto (spec 0014), o passo seguinte do empresário
é cobrar ou avisar: "manda o boleto pro João amanhã às 9h". Hoje isso é
manual — baixar o PDF em Documentos e mandar pelo celular. A régua de cobrança
(`PaymentDunningRule`) existe, mas é por regra de dias, só manda texto, só
usa Uazapi (`sendWhatsAppText`) e nunca anexa o documento.

Esta é a fase 4 do plano "Astro agente financeiro" (ver `docs/ASTRO_PROGRESS.md`).

## 2. Objetivo

O usuário agenda, pela tela ou pelo Astro, um lembrete para uma data e hora;
nesse horário cada destinatário recebe a mensagem com o boleto/NF anexo no
WhatsApp da empresa e/ou por e-mail, e quem agendou é avisado do resultado.

### Não-objetivos

- Recorrência (lembrete semanal/mensal). Um lembrete = um disparo.
- Editar lembrete agendado — cancela e cria outro.
- Substituir a régua de cobrança (`dunning`). Convivem.
- Template HSM da Meta para abrir conversa fora da janela de 24h.
- Estorno de Stars quando o provider falha depois da cobrança.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | `PaymentReminder` guarda org, lançamento e documento opcionais, `remindAt`, canais (`WHATSAPP`, `EMAIL`), destinatários `[{contactId?, name, phone?, email?}]`, mensagem, `notifyCreator`, status e `deliveryLog`. |
| RF-2 | Criar lembrete (tela ou executor `payment.reminder.create`) valida posse de lançamento/documento, recusa lançamento pago/cancelado e horário passado, completa telefone/e-mail a partir do `PaymentContact` e publica `payment/reminder.created`. Sem documento explícito, usa o anexo mais recente do lançamento. |
| RF-3 | O Inngest dorme até `remindAt`, recarrega e entrega por destinatário × canal, cada entrega num `step.run` próprio. |
| RF-4 | WhatsApp sai pela PORT canônica (`resolveOutboundProvider` + `sendMedia` documento), em Uazapi ou Meta, com URL pré-assinada de 15 min. Sem documento, manda texto. |
| RF-5 | Cancelar (tela ou executor `payment.reminder.cancel`) só vale para `SCHEDULED` e publica `payment/reminder.cancelled`, que derruba o sono via `cancelOn`. |
| RF-6 | Ao final, status agregado (`SENT`, `PARTIAL`, `FAILED`), `sentAt`, `deliveryLog` e notificação in-app ao criador quando `notifyCreator`. |
| RF-7 | Astro: `propose_payment_reminder`, `list_payment_reminders`, `propose_cancel_payment_reminder`, com o mesmo gate `assertPaymentToolAccess` e confirmação da spec 0014. |
| RF-8 | Destinatário por nome é buscado em `PaymentContact`; nome ambíguo devolve erro com candidatos e o Astro pergunta. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Escrita exige `requirePaymentAccess("entries", "edit")`; leitura, `entries.view`. |
| RNF-2 | 1★ (`astro_finance_reminder_send`) por entrega, cobrado antes do envio e só depois dos pré-requisitos (destino, instância, bytes do anexo). |
| RNF-3 | Uma entrega nunca lança exceção: o resultado é memoizado pelo step e um retry do Inngest não cobra de novo. |
| RNF-4 | Concorrência de 3 execuções por organização. |
| RNF-5 | Nenhum I/O dentro de `$transaction` (regra 18) — o evento sai depois do insert. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado "manda o boleto pro João", quando existe um único contato "João", então a proposta traz o contato com telefone/e-mail; quando há dois, a tool devolve os candidatos e o Astro pergunta qual.
- [ ] **CA-2** — Dada uma proposta de lembrete, quando o usuário confirma, então o `PaymentReminder` nasce `SCHEDULED` e o evento `payment/reminder.created` é publicado.
- [ ] **CA-3** — No horário, o contato recebe no WhatsApp o documento com o nome padrão (spec 0014, D-6) e, por e-mail, a mensagem com o arquivo anexo.
- [ ] **CA-4** — Dado um lançamento pago antes do horário, quando o lembrete dispara, então o status vira `SKIPPED`, nada é enviado e nenhuma Star é cobrada.
- [ ] **CA-5** — Dado um lembrete agendado, quando é cancelado, então vira `CANCELLED` e a execução do Inngest é cancelada pelo `cancelOn`.
- [ ] **CA-6** — Dada uma org sem instância WhatsApp `CONNECTED`, quando o lembrete dispara com os dois canais, então a entrega WhatsApp fica `FAILED` (`no_connected_whatsapp_instance`, sem cobrança) e o e-mail é enviado.
- [ ] **CA-7** — Cobra 1★ por canal por destinatário entregue ao provider; entregas puladas por falta de destino ou instância não cobram.
- [ ] **CA-8** — Com `notifyCreator`, o criador recebe notificação in-app com o resultado (enviado, parcial, falhou ou não enviado).

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Destinatário sem telefone com canal WhatsApp | Entrega `SKIPPED` (`recipient_without_phone`), sem cobrança; proposta avisa. |
| CB-2 | Nenhum destinatário alcançável pelos canais escolhidos | Criação recusada. |
| CB-3 | Documento excluído depois do agendamento | `attachmentId` vira null (SetNull); WhatsApp manda texto e e-mail sai sem anexo. |
| CB-4 | Bytes do documento indisponíveis no R2 | Entrega de e-mail `FAILED` (`attachment_unavailable`), sem cobrança. |
| CB-5 | Saldo de Stars insuficiente | Entrega `FAILED` (`stars_insufficient`), nada é enviado. |
| CB-6 | Meta Cloud fora da janela de 24h | Provider recusa; entrega `FAILED` com o motivo, Star já cobrada (ver §9). |
| CB-7 | Cancelar lembrete já processado | Recusado com mensagem; cancelar um já cancelado é idempotente. |
| CB-8 | Regra `AppStarCost` ausente | `chargeStarsByAction` pula; envio segue sem cobrança. |
| CB-9 | Lembrete para horário no passado | Recusado (tolerância de 1 min). |
| CB-10 | Várias instâncias conectadas | Usa a mais antiga (`createdAt asc`), mesma regra de `sendWhatsAppText`. |

## 6. Decisões de design

### D-1 — Helper provider-agnóstico por organização

- **Escolha**: `sendOrganizationWhatsAppDocument` em `tracking-chat/lib/providers/send-org-document.ts` escolhe a instância e usa `resolveOutboundProvider(trackingId)`.
- **Alternativas descartadas**: estender `sendWhatsAppText` (Uazapi-only, sem mídia).
- **Consequência**: funciona com Meta Cloud; a janela de 24h passa a ser limitação visível no log.

### D-2 — Um step por destinatário × canal, cobrança dentro do step

- **Escolha**: `step.run("deliver-<i>-<canal>")` que cobra e envia e sempre devolve resultado.
- **Alternativas descartadas**: um step para tudo (retry reenviaria a todos e cobraria de novo).
- **Consequência**: retry de uma entrega não duplica as outras; falha do provider após a cobrança não é estornada (não há API de crédito reverso).

### D-3 — E-mail com bytes do R2, não link

- **Escolha**: `resend.emails.send({ attachments: [{ filename, content: Buffer }] })` lendo com `readAttachmentBytes`.
- **Alternativas descartadas**: link pré-assinado no corpo (expira, e o destinatário não é usuário da plataforma).
- **Consequência**: primeiro uso de anexos do Resend no repo; limite prático de 16 MB herdado do upload.

### D-4 — Notificação reaproveita `PAYMENT_DUNNING_SENT`

- **Escolha**: tipo existente, com `metadata.reminderId`.
- **Alternativas descartadas**: tipo novo em `NOTIF_TYPES` (exige mexer no catálogo de preferências).
- **Consequência**: a preferência do usuário para "cobrança enviada" também governa os lembretes.

## 7. Impacto

- [x] Schema / migration — `payment_reminders` (`PaymentReminder`, `PaymentReminderChannel`, `PaymentReminderStatus`)
- [x] Procedures oRPC — `payment.reminders.{list,create,cancel}`
- [ ] Realtime
- [x] Automações (Inngest) — `payment-reminder-fire`
- [ ] Env vars novas
- [ ] Breaking change
- [x] Documentação — `docs/ASTRO_PROGRESS.md`, `docs/STARS_OVERVIEW.md`, `docs/whatsapp-oficial-overview.md`

## 8. Plano de testes

O projeto não tem runner de teste (CLAUDE.md, item 20). Verificação manual com
`pnpm inngest:dev`.

| Critério | Tipo | Como verificar | Resultado |
| --- | --- | --- | --- |
| CA-1 | manual | Dois contatos "João" → pedir ao Astro; depois um só | pendente |
| CA-2 | manual | Confirmar a proposta; ver linha `SCHEDULED` e o run no Inngest | pendente |
| CA-3 | manual | Lembrete para +2 min com os dois canais | pendente |
| CA-4 | manual | Agendar, baixar o lançamento, esperar o horário; conferir `StarTransaction` | pendente |
| CA-5 | manual | Agendar e cancelar; run cancelado no Inngest | pendente |
| CA-6 | manual | Org sem instância conectada, dois canais | pendente |
| CA-7 | manual | Conferir `deliveryLog.starsCharged` × `StarTransaction` | pendente |
| CA-8 | manual | Sino de notificações do criador | pendente |

## 9. Riscos e rollback

- Migration aditiva (tabela e enums novos). Rollback: `DROP TABLE payment_reminders; DROP TYPE "PaymentReminderStatus"; DROP TYPE "PaymentReminderChannel";`.
- Star cobrada quando o provider falha depois do envio (CB-6). Mitigação futura: crédito reverso em `star-service`.
- URL pré-assinada de 15 min: se o provider enfileirar o download além disso, a mídia falha.
- Lembretes antigos agendados antes de um deploy que mude o payload do evento continuam no Inngest — o payload só carrega `reminderId` e `organizationId` por isso.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-15 | Weydson | Criada |
