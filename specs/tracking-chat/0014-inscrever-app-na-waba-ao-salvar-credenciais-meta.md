---
id: 0014
titulo: Inscrever o App Meta na WABA ao salvar credenciais manualmente
dominio: tracking-chat
status: implementada
autor: João Gabriel
criada: 2026-09-16
atualizada: 2026-09-16
branch: claude/orbita-webhook-messages-prod-ebbf71
pr:
peso: leve
---

# 0014 — Inscrever o App Meta na WABA ao salvar credenciais manualmente

---

## 1. Contexto

Um tracking `META_CLOUD` em produção nunca recebeu nenhuma mensagem. As credenciais foram coladas manualmente no card "Provider WhatsApp".

Diagnóstico local com dump de produção + ngrok (2026-09-16):

- O handshake `GET` do webhook respondia `200`; a URL estava correta.
- Mensagens reais enviadas ao número não geravam **nenhum** POST no webhook.
- `GET /{waba_id}/subscribed_apps` → `{"data": []}`.
- Após `POST /{waba_id}/subscribed_apps` → `success: true`, a mensagem seguinte
  chegou e foi persistida (`POST /api/chat/webhook/official 200`).

Causa: sem inscrição do App na WABA a Meta não entrega eventos. Só o fluxo de
Embedded Signup (`onboard.ts`) chamava `subscribeApp`; o caminho manual
(`integrations.setProviderSettings`) nunca chamava.

## 2. Objetivo

Salvar credenciais Meta manualmente deixa a WABA inscrita no App, sem passo
fora do NASA.

### Não-objetivos

- Tornar o WABA ID obrigatório no save (instâncias antigas sem ele seguem salvando).
- Backfill automático das instâncias `META_CLOUD` existentes — basta re-salvar
  as credenciais no card.
- Validar o App Secret / Verify Token contra a Meta.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Quando `setProviderSettings` altera provider ou credencial e a instância resultante é `META_CLOUD` com accessToken, phoneNumberId e WABA ID, chama `POST /{waba_id}/subscribed_apps` com o token da instância. |
| RF-2 | Falha da Meta não desfaz o save: a procedure retorna `webhookSubscription: { status: "failed", detail }` e loga `meta_subscribe_app_failed`. |
| RF-3 | Sem WABA ID, retorna `webhookSubscription.status = "missing_business_account_id"` e a UI avisa que sem ele não há recebimento. |
| RF-4 | Provider `UAZAPI` ou save sem mudança não chama a Meta (`webhookSubscription: null`). |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado tracking `META_CLOUD` com WABA não inscrita, quando o operador salva credenciais com WABA ID, então `subscribed_apps` passa a listar o App e mensagens recebidas chegam ao webhook.
- [ ] **CA-2** — Dado token inválido, quando salva, então as credenciais ficam gravadas e a UI mostra aviso de falha na inscrição.
- [ ] **CA-3** — Dado save sem WABA ID, então a UI mostra aviso pedindo o WABA ID.
- [ ] **CA-4** — Dado troca para `UAZAPI`, então nenhuma chamada à Graph API é feita.

## 5. Abordagem

Novo helper `src/features/tracking-chat/lib/providers/ensure-meta-webhook-subscription.ts`
(decifra credenciais, chama `subscribeApp`, devolve union de status sem lançar).
Chamado pós-commit em `src/app/router/integrations/provider-settings.ts`. Aviso via
toast em `use-whatsapp-provider.ts`. `subscribed_apps` é idempotente, então
re-salvar credenciais é seguro.

## 9. Changelog

| Data | Mudança |
| --- | --- |
| 2026-09-16 | Spec criada e implementada após diagnóstico de um tracking `META_CLOUD` sem inbound em produção. Sem runner de teste no projeto (CLAUDE.md regra 20); CAs validados manualmente. |
