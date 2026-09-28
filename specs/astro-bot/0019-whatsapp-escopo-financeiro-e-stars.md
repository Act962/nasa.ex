---
id: 0019
titulo: Astro pelo WhatsApp — escopo financeiro, mídia inbound e cobrança de Stars
dominio: astro-bot
status: em-revisao
autor: Weydson
criada: 2026-09-15
atualizada: 2026-09-15
branch: feature/W-astro-finance-tools-20260915
pr: https://github.com/Act962/nasa.ex/pull/392
peso: completa
---

# 0019 — WhatsApp: escopo financeiro, mídia e Stars (Fase 6)

---

## 1. Contexto

O Astro pelo WhatsApp ("Insights pelo WhatsApp", rework 2026-06-30) só lê dados
de CRM, não entende arquivo e **não cobra Stars** — `WhatsappBotCommand.starsCharged`
sai sempre `null`. As fases 1–5 do Astro financeiro (spec 0014 em diante) já
entregaram, dentro do app: pack de tools `payment`, proposta → confirmação
(`AstroPendingAction`), leitura de boleto/NF (`read_financial_document`) e
`streamAstro({ toolScope: "assistant" })`.

O empresário quer o mesmo pelo celular: "quanto tenho a pagar essa semana?",
mandar o PDF do boleto, responder "sim" e o lançamento nascer no `/payment`.

## 2. Objetivo

Um membro allow-listado de uma org com `OrganizationBotConfig.financeEnabled`
consulta o financeiro, manda PDF/foto de documento e confirma lançamentos pelo
WhatsApp, e toda mensagem ao Astro — com ou sem financeiro — cobra Stars como o
chat in-app.

### Não-objetivos

- Botões interativos reais (Uazapi `send-menu` / Meta `interactive`) — a
  confirmação é por texto SIM/NÃO nesta fase (ver D-3).
- Áudio, vídeo, figurinha e planilhas pelo bot.
- Mudar o gate de trackings/allow-list, o rate limit ou as quiet hours.
- Mídia que chega em POST Meta com mais de uma mensagem (continua no fluxo normal).
- Extrato OFX pelo WhatsApp.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | `financeEnabled = false` → `toolScope: "insights"` (inalterado); `true` → `toolScope: "assistant"`. |
| RF-2 | `handleBotCommand` cobra `chargeStarsByAction(orgId, "astro_prompt")` antes do orquestrador e `debitStars` por tokens (1★/1k, mínimo 1) depois, nos dois escopos. Org `appScope = "trafego"` é isenta (paridade in-app). |
| RF-3 | Saldo insuficiente no stake → reply de saldo, `status: "stars_insufficient"`, orquestrador não roda e nenhuma mídia é baixada. |
| RF-4 | `WhatsappBotCommand.starsCharged` = stake cobrado + Stars de tokens efetivamente debitadas. |
| RF-5 | Webhooks Uazapi (`DocumentMessage`/`ImageMessage`) e Meta (`document`/`image`, POST com 1 mensagem) passam a mídia para `maybeHandleBotMessage`, que só intercepta se o gate aceitar **e** `financeEnabled = true`. |
| RF-6 | `storeBotInboundDocument` exige `entries.create` do usuário do binding (`resolvePaymentPermissions`), baixa pelo provider da tracking, grava em `payment/attachments/<orgId>/<uuid>.<ext>` e cria `PaymentAttachment` sem `entryId`, `sourceChannel: "whatsapp"`, `originalFileName`. |
| RF-7 | O anexo entra em `ctx.attachments`; sem legenda o prompt vira "Leia o documento que acabei de enviar e me mostre o resumo". |
| RF-8 | `ctx.channel = "WHATSAPP"` (TTL de proposta 2 h) e `ctx.sessionId = "whatsapp:<bindingId>"`. |
| RF-9 | `astro_confirmation` vira texto com linhas, avisos e "Responda *SIM* pra confirmar ou *NÃO* pra cancelar (vale até HH:mm)"; `astro_confirmation_result` vira ✅/❌ + resumo. |
| RF-10 | Admin liga/desliga em "Astro Financeiro pelo WhatsApp (cobra Stars)" (`astroBot.config.upsert` com `financeEnabled` opcional; ausente preserva o valor). Mudança gera `logActivity`. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Qualquer erro no gate/handler antes de `handled: true` cai no `catch` do webhook e segue o atendimento normal — mídia de lead nunca se perde. |
| RNF-2 | Mudança nos webhooks é aditiva: o caminho de texto e o echo-suppression ficam idênticos. |
| RNF-3 | Download com timeout de 15 s; limite de 16 MB (`MAX_ATTACHMENT_BYTES`). |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado `financeEnabled = false`, quando o membro manda texto, então o escopo é `insights`, a resposta é a de hoje e `starsCharged` reflete a cobrança.
- [ ] **CA-2** — Dado `financeEnabled = true`, quando o membro pergunta "quanto tenho a pagar esta semana?", então o orquestrador roda com `toolScope: "assistant"` e responde com tools financeiras.
- [ ] **CA-3** — Dado `financeEnabled = true` e membro com `entries.create`, quando ele manda um PDF de boleto, então nasce `PaymentAttachment` (`sourceChannel: "whatsapp"`), o Astro chama `read_financial_document` e a resposta traz o resumo + "Responda SIM ou NÃO".
- [ ] **CA-4** — Dado uma proposta pendente do binding, quando o membro responde "sim", então `confirm_action` executa e o lançamento aparece no `/payment` com o anexo vinculado; a resposta começa com ✅.
- [ ] **CA-5** — Dado saldo insuficiente, quando o membro manda texto ou mídia, então recebe o aviso de saldo, `status = "stars_insufficient"`, nenhuma tool roda e nenhum arquivo é baixado.
- [ ] **CA-6** — Dado um número que não está na allow-list (lead), quando manda PDF ou foto, então a mensagem vira `Message` normal no atendimento — e o mesmo vale para membro allow-listado em org com `financeEnabled = false`.
- [ ] **CA-7** — Dado um comando que consumiu N tokens com stake S, então `WhatsappBotCommand.starsCharged = S + max(1, round(N/1000))` (ou só S se o débito de tokens falhar).
- [ ] **CA-8** — Dado um arquivo que não é PDF/imagem (ex.: `.docx`) ou maior que 16 MB, então o membro recebe aviso de formato/tamanho, `status = "media_unsupported"`, e o stake não é cobrado quando o formato é recusado.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Membro sem `entries.create` manda PDF | Aviso de permissão, `media_forbidden`, sem stake, sem download. |
| CB-2 | Download falha (instância caiu, URL expirou) depois do stake | Aviso "não consegui baixar", `media_failed`, `starsCharged` = stake. |
| CB-3 | Provider de saída não resolvível | `handled: false` antes de qualquer coisa → mídia segue o atendimento (comportamento já existente). |
| CB-4 | Imagem sem mimetype declarado | Tratada como `image/jpeg`. |
| CB-5 | Documento com mimetype `application/octet-stream` e nome `.pdf` | Tratado como PDF. |
| CB-6 | POST Meta com mídia + texto juntos | Não intercepta (regra anterior de 1 mensagem por POST); ambos seguem o atendimento. |
| CB-7 | Legenda na imagem ("lança isso") | Legenda vira o texto do prompt. |
| CB-8 | "sim" depois de 2 h | `confirm_action` recusa por expiração (spec 0014 CA-5). |
| CB-9 | Falha de infraestrutura na cobrança (exceção) | Loga e segue sem cobrar — paridade com `/api/astro/chat`. |
| CB-10 | Echo `fromMe` de mídia no Uazapi | Inalterado: supressão de echo continua só para texto. |
| CB-11 | Cliente antigo chama `upsert` sem `financeEnabled` | Valor salvo é preservado. |

## 6. Decisões de design

### D-1 — Flag por org, não por binding

- **Escolha**: `OrganizationBotConfig.financeEnabled`; a permissão fina fica na whitelist `PaymentAccess` do usuário do binding (tools checam `assertPaymentToolAccess`; upload checa `entries.create`).
- **Alternativas descartadas**: flag por `UserWhatsappBinding` — duplicaria a whitelist do payment e criaria duas fontes de verdade.
- **Consequência**: ligar a flag não dá acesso financeiro a quem não tem no app.

### D-2 — Validação barata antes do stake, download depois

- **Escolha**: formato + permissão → stake → download/R2 → orquestrador.
- **Alternativas descartadas**: baixar antes do stake (saldo zerado deixaria arquivo órfão em Documentos); cobrar antes de validar (arquivo recusado gastaria Stars).
- **Consequência**: falha de download após o stake cobra o stake (CB-2).

### D-3 — Confirmação por texto SIM/NÃO

- **Escolha**: `astro_confirmation` vira texto; "sim"/"não" chega como texto e o prompt mapeia para `confirm_action`/`cancel_action` (última pendente do usuário).
- **Alternativas descartadas**: botões — a PORT canônica (`WhatsAppChatProvider`) não tem envio interativo, Meta exige mensagem `interactive` fora da PORT e o clique chega como `interactive_reply`, que o gate do bot não intercepta.
- **Consequência**: mesma UX nos dois providers; botões ficam para quando a PORT ganhar `sendInteractive`.

### D-4 — Download direto dos clients HTTP, não das strategies do pipeline

- **Escolha**: `downloadFile` (Uazapi) e `downloadInboundMedia` (Meta) com credenciais resolvidas por `resolveOutboundProvider` / `WhatsAppInstance`.
- **Alternativas descartadas**: `buildUazapiDownloadInboundMedia`/`buildMetaDownloadInboundMedia` — sobem na raiz do bucket com chave própria; o anexo financeiro precisa de `payment/attachments/<orgId>/`.

### D-5 — Cobrança nos dois escopos

- **Escolha**: `insights` também paga (stake + tokens).
- **Consequência**: mudança de comportamento para orgs que já usam o bot — comunicar admins. Sem regra `astro_prompt` em `AppStarCost`, o stake é pulado, mas os tokens continuam sendo debitados.

## 7. Impacto

- [x] Schema / migration — `OrganizationBotConfig.financeEnabled` (`bot_config_finance_enabled`)
- [x] Procedures oRPC — `astroBot.config.upsert` ganha `financeEnabled?: boolean`
- [ ] Realtime (Pusher / event-bus)
- [ ] Automações (Inngest)
- [ ] Env vars novas
- [x] Breaking change para clientes existentes — o bot passa a cobrar Stars
- [x] Documentação obrigatória — `docs/astro-bot-whatsapp.md`, `docs/whatsapp-oficial-overview.md` (regra 14), `docs/ASTRO_PROGRESS.md`, `docs/STARS_OVERVIEW.md`

Arquivos: `src/features/astro-bot/lib/{router,webhook-handler,output-formatter,types,inbound-media,stars-billing}.ts`, `src/app/api/chat/webhook/route.ts`, `src/app/api/chat/webhook/official/route.ts`, `src/app/router/astro-bot/config/upsert.ts`, `src/features/astro-bot/components/bot-config-section.tsx`.

## 8. Plano de testes

Não há runner de teste instalado (CLAUDE.md regra 20); verificação manual.

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1 | manual | Flag desligada, "quantos leads tenho?" → resposta insights; `WhatsappBotCommand.starsCharged > 0`. |
| CA-2 | manual | Flag ligada, "quanto tenho a pagar esta semana?" → valores batem com `/payment`. |
| CA-3 | manual | Mandar PDF de boleto → `PaymentAttachment.sourceChannel = 'whatsapp'` + resumo com SIM/NÃO. |
| CA-4 | manual | Responder "sim" → lançamento em `/payment` com anexo; reply ✅. |
| CA-5 | manual | Zerar saldo da org → aviso de saldo, `status = stars_insufficient`, nenhum `PaymentAttachment` novo. |
| CA-6 | manual | PDF de número fora da allow-list → `Message` no chat do lead. |
| CA-7 | manual | Conferir `StarTransaction` do comando contra `starsCharged`. |
| CA-8 | manual | Mandar `.docx` → aviso de formato, `status = media_unsupported`, sem `StarTransaction`. |

## 9. Riscos e rollback

- **Cobrança nova no WhatsApp** — admins precisam ser avisados; rollback de cobrança = zerar a regra `astro_prompt` (tokens ainda cobram) ou reverter o PR.
- **Mídia de membro deixa de ir para o atendimento** quando a flag está ligada — intencional; desligar a flag restaura.
- **Migration aditiva** (coluna boolean com default) — reversível com `DROP COLUMN`.
- **Rollback de comportamento sem deploy**: `financeEnabled = false` volta o bot ao escopo `insights` e a mídia ao atendimento.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-15 | Weydson | Criada |
