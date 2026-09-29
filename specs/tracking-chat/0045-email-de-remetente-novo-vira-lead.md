---
id: 0045
titulo: E-mail de remetente novo vira lead no funil escolhido
dominio: tracking-chat
status: aprovada
autor: Weydson
criada: 2026-09-29
atualizada: 2026-09-29
branch: feature/W-campanhas-disparo-self-service-20260927
pr:
peso: leve
---

# 0045 — E-mail de remetente novo vira lead no funil escolhido

## Contexto

Um cliente mandou e-mail para a caixa da GOTHAN CITY (Gmail conectado em `/integrations`) e nada apareceu no chat. O canal E-mail (spec 0030) só mostra conversas com endereços já cadastrados em leads do funil aberto (CA-4). O dono decidiu, em 2026-09-29, que remetente novo vira lead automaticamente num funil escolhido.

## Requisitos

| ID | Requisito |
| --- | --- |
| RF-1 | No canal E-mail de um funil, a chave "Novos remetentes viram lead aqui" escolhe **esse** funil como destino (um por empresa). Ligar noutro funil move o destino. |
| RF-2 | A cada 5 min (Inngest cron), para cada empresa com a chave ligada: e-mails das últimas 24 h na caixa de entrada, aba Principal (`in:inbox category:primary newer_than:1d -from:me`, até 50). |
| RF-3 | Remetente cujo e-mail não está em nenhum lead da empresa → cria lead na primeira coluna do funil: nome do remetente (ou o endereço), e-mail, origem `GMAIL`. |
| RF-4 | Ignora a própria caixa e endereços automáticos (`noreply`, `no-reply`, `mailer-daemon`, `postmaster`, `notifications`, `bounce`). |
| RF-5 | A conversa aparece no canal E-mail do funil pela regra da 0030 (lida do Gmail), sem gravar e-mails no banco. |

Não muda: e-mails de quem já é lead continuam aparecendo no funil onde esse lead está.

## Critérios de aceite

- [ ] **CA-1** — Chave ligada no Suporte: e-mail de um endereço novo vira lead no Suporte em até 5 min e a conversa aparece no canal E-mail.
- [ ] **CA-2** — Segundo e-mail do mesmo endereço não cria outro lead.
- [ ] **CA-3** — E-mail de `noreply@...` ou da aba Promoções não cria lead.
- [ ] **CA-4** — Chave desligada: nada é criado.

## Decisões

- **D-1 — Sem estado de leitura.** Janela de 24 h, e a deduplicação é "o e-mail já está num lead da empresa". Não precisa de migration nem de cursor do Gmail, e é idempotente.
- **D-2 — Configuração em `PlatformIntegration.config.emailLeadCapture`** (`{ trackingId }`), gravada lendo o config atual na hora e mesclando.
- **D-3 — Polling em vez de push do Gmail.** O push exige Google Pub/Sub. Com a janela de 5 min, funciona igual em localhost e em produção.

## Arquivos

- `src/features/tracking-chat/server/email/email-lead-capture.ts`: configuração, captura e lista de empresas.
- `src/inngest/functions/crons/email-lead-capture.ts`: cron de 5 min.
- `src/app/router/tracking-chat-email/index.ts`: `leadCapture` e `setLeadCapture`. Ao ligar, já varre a caixa uma vez.
- `components/email/email-lead-capture-toggle.tsx`: a chave no canal E-mail.

## Changelog

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-29 | Weydson | Criada (opção escolhida pelo dono: criar lead automaticamente). |
| 2026-09-29 | Weydson | Aprovada e implementada; ligar a chave já varre a caixa na hora. |
