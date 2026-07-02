# Astro Bot via WhatsApp — Design Doc

**Status:** Implementado (Fase 1) + reworked para "Insights pelo WhatsApp" (2026-06-30)
**Última atualização:** Sessão 2026-06-30 (João + Claude)

---

## ⭐ Rework 2026-06-30 — "Insights pelo WhatsApp" (fonte de verdade atual)

O modelo abaixo (instância dedicada + OTP/PIN + Astro completo) foi **revisto**. O
que vale hoje:

1. **Número da própria tracking (não dedicado).** O Astro responde pelo número
   que a tracking já usa no atendimento. A resposta sai pelo **provider ATIVO da
   tracking** (Uazapi ou WhatsApp Cloud/Meta), via
   [`resolveOutboundProvider(trackingId)`](../src/features/tracking-chat/lib/providers/resolve-outbound-provider.ts).
   Implementado em [`tracking-provider-channel.ts`](../src/features/astro-bot/lib/tracking-provider-channel.ts)
   (substitui `UazapiBotChannel`, que ficou desativado).

2. **Allow-list por tracking selecionada.** O admin marca **quais trackings**
   respondem o Astro (novo model `AstroBotTracking`, ligado a `OrganizationBotConfig`).
   Uma mensagem só cai no Astro quando: o número está na allow-list
   (`UserWhatsappBinding`) **e** a tracking que recebeu está habilitada **e** a config
   está ativa. Qualquer outro número segue o atendimento normal (vira lead). Gating em
   [`webhook-handler.ts`](../src/features/astro-bot/lib/webhook-handler.ts).

3. **Escopo read-only (insights).** O orquestrador é chamado com
   `streamAstro({ toolScope: "insights" })` — expõe só tools de leitura
   (analytics/list/search/chart). Sem mutations/actions/workflows e sem routing pra
   sub-agents. Enforcement real (não gate pós-execução).

4. **Auth simplificada (sem OTP/PIN).** Admin adiciona o número direto e escolhe em
   nome de qual membro o Astro consulta (`binding/create`). As colunas de PIN/sessão do
   schema ficam como **legado** (nullable, não enforçadas). Gestão (config + allow-list)
   é **owner/admin only** (enforçado server-side via `assertOrgAdmin`).

**Webhooks:** os dois intercepts (Uazapi `api/chat/webhook` e Meta
`api/chat/webhook/official`) passam `trackingId` pro `maybeHandleBotMessage`. O branch
`META_CLOUD → provider_not_implemented` foi removido — agora Meta é caminho real.

**Procedures ativas:** `astroBot.config.{get,upsert}`, `astroBot.binding.{create,list,revoke}`.
OTP/`reset-pin` foram desregistrados (arquivos mantidos).

**Memória de conversa:** cada inbound é uma chamada isolada ao `streamAstro`, então o
`router.ts` injeta um histórico curto por número (últimos 6 turnos `ok` em até 30 min),
reconstruído das linhas de `WhatsappBotCommand` via
[`conversation-history.ts`](../src/features/astro-bot/lib/conversation-history.ts) — sem
store novo. Dá memória conversacional ("qual o nome desse lead?" após "quantos leads tenho?").

**Saída de tabelas/listas no WhatsApp:** o `router.ts` agrega tool-calls/results de
**todos os steps** do `streamAstro` (`stream.steps`), não só do último — sem isso
`tools_called` ficava vazio e o resumo de `astro_table` nunca era anexado. O
`summarizeStructuredPayload` foi corrigido pra ler `rows`/`columns` (o payload real) e
listar o conteúdo em texto (no WhatsApp não dá pra clicar na tabela). `list_leads` passou
a incluir `phone`/`email` nas linhas (não nas colunas — UI in-app intacta) pra responder
"nome e contato". O bot força `gpt-4o` (`forceComplexModel: true`): o `gpt-4o-mini`
alucinava "não consegui acessar" em perguntas com `list_*`.

**Paridade com `/insights` (2026-06-30):** o Astro agora expõe os mesmos números da
página `/insights` como tools read-only, começando por **funil de conversão**,
**ganhos/perdidos + vendidos no mês** e **canais de aquisição + tags**. Arquitetura de
fonte de verdade única: o cálculo de cada bloco vive em
[`src/features/insights/lib/metrics/`](../src/features/insights/lib/metrics/)
(`funnel.ts`, `won-leads.ts`, `sold-this-month.ts`, `acquisition-channels.ts`,
`leads-by-tags.ts`) e é consumido **tanto pela procedure oRPC** (página) **quanto pela
tool do Astro** — página e bot nunca divergem. As tools ficam em
[`tools/insights-reports/`](../src/features/astro/server/tools/insights-reports/index.ts)
(`get_funnel`, `get_won_lost_leads`, `get_sold_this_month`, `get_leads_by_channel`,
`get_leads_by_tags`), entram no `readOnlyTools` e são **single-org**: usam
`ctx.organizationId` (a org do número no WhatsApp) + `userBelongsToOrg`, nunca agregam
multi-org. `get_funnel` pede o tracking quando a empresa tem mais de um. Próximos blocos
candidatos: leads por atendente, performance por tracking, tráfego Meta, resgate de leads.

O restante deste documento é o design original (2026-05-30), mantido por histórico.

---

## ⚠️ Pendências conhecidas — tratar depois (code review 2026-06-30)

Levantadas no review da branch `feature/tracking-insights-whatsapp-20260630`. Nenhuma
bloqueou o merge inicial, mas devem ser endereçadas antes de escalar o uso.

### Correção / segurança

1. **Lead-fantasma + vazamento via echo do Uazapi (mais grave).** ✅ **RESOLVIDO
   (2026-06-30).** A resposta do bot sai pelo número da própria tracking; o Uazapi ecoa essa
   mensagem enviada como webhook `fromMe:true`. Sem guard, o echo caía em
   `persistCanonicalInbound` e criava Lead+Conversation fantasma pro número do membro,
   rodava round-robin, disparava NEW_LEAD e persistia a resposta do Astro (com dados de
   outros leads) como mensagem de CRM. Só Uazapi (Meta não ecoa mensagens próprias).

   **Implementado:**
   - Gate de allow-list extraído em `resolveBotGate({ phone, trackingId, trackingOrganizationId })`
     (helper interno de [`webhook-handler.ts`](../src/features/astro-bot/lib/webhook-handler.ts)),
     reutilizado por `maybeHandleBotMessage` (inbound) e pelo novo export
     `shouldSuppressBotEcho(input)`. Mesma fonte de verdade → o echo é suprimido exatamente
     nos casos em que o inbound foi interceptado.
   - No webhook Uazapi ([route.ts](../src/app/api/chat/webhook/route.ts)), novo ramo
     `fromMe && bodyForBot && isTextForBot` chama `shouldSuppressBotEcho({ phone, ... })`
     **antes** do `persistCanonicalInbound`; se `true` → `return 200 { ignored: "astro-bot-echo" }`.
   - **Escopo:** só echo de **texto** — não suprime mídia de operador. Tradeoff aceito: texto
     legítimo de operador pra número allow-listado também seria suprimido (ok: número
     allow-listado é usuário-bot, não lead). Meta não tem branch equivalente (não ecoa).

2. **Escopo das tools é o usuário, não a tracking.** ✅ **RESOLVIDO (2026-06-30).** No modo
   insights, `list_leads`/analytics/charts filtravam pelas **memberships do `ctx.userId`**
   (default = todas as orgs do membro) — um número allow-listado consultava dados de qualquer
   org que o membro participasse. Decisão de produto: **single-org** (o número responde só pela
   empresa dele). Implementado com:
   - `AgentContext.restrictToOrgId` (novo, opcional) — o router do bot seta
     `restrictToOrgId = binding.organizationId`; o Cmd+K in-app não seta (multi-org intacto).
   - Helper único [`resolveTargetOrgs(ctx, requestedOrgIds?)`](../src/features/astro/server/tools/shared/resolve-target-orgs.ts)
     que trava nas orgs permitidas (intersecção com memberships; quando `restrictToOrgId`,
     trava só nela). Substituiu ~30 blocos duplicados de `myOrgIds`/`targetOrgs` em
     `lists`/`charts`/`analytics`. `search` já usava `ctx.organizationId` (single-org).
   - Sintoma corrigido: "Quantos trackings temos" passa a contar só a empresa do número.

   **Bônus desta sessão (qualidade do fluxo, fora das 7 pendências):**
   - Fallback `"✅ Feito."` removido — reply vazio em read-only não pode virar confirmação de
     ação (causava "quais empresas vc vê? → ✅ Feito."). Agora vira mensagem de não-resposta
     clara + status `empty_reply` no audit ([router.ts](../src/features/astro-bot/lib/router.ts)).
   - `INSIGHTS_SCOPE_PROMPT` injetado no system (antes `systemSuffix` era `""` em insights):
     instrui o modelo a sempre responder em texto, nunca confirmar ação, e responder só sobre a
     empresa do número ([orchestrator.ts](../src/features/astro/server/orchestrator.ts)).

3. **`binding.isActive` não é checado no webhook.** ✅ **RESOLVIDO (2026-06-30).** O gate olhava
   só `botConfig.isActive`. Agora `resolveBotGate` também checa `binding.isActive`; binding
   revogado → `allowed:false` → `maybeHandleBotMessage` devolve `handled:false` e a mensagem cai
   no atendimento normal (não fica em limbo recebendo "acesso desativado" num número
   compartilhado). Cobre de quebra a supressão de echo: número revogado deixa de ser tratado
   como usuário-bot.

4. **Provider sem credencial = drop silencioso.** ✅ **RESOLVIDO (2026-06-30).** Antes, se a
   tracking habilitada estava desconectada, `resolveOutboundProvider` lançava dentro do
   `sendText` (engolido pelo try/catch) — o membro não recebia resposta **e** a mensagem sumia.
   Agora `maybeHandleBotMessage` resolve o provider **antes** de marcar `handled:true`; se
   lançar, devolve `handled:false` e a mensagem segue pro atendimento (não some). O resultado
   fica em cache (TTL 30s), então o `sendText` reusa sem novo lookup.

5. **`config.get` sem gate de admin expõe segredos.** `getBotConfig` usa só `requiredAuth`+`requireOrg`
   e retorna `{ ...config }`, espalhando colunas legadas cifradas (`metaAccessToken`/`metaPhoneId`/
   `metaWabaId`) pra qualquer membro ([config/get.ts:37](../src/app/router/astro-bot/config/get.ts)).
   _Fix candidato:_ `assertOrgAdmin` + `select` explícito dos campos usados.

6. **Tracking arquivada continua respondendo.** ✅ **RESOLVIDO (2026-06-30).** O gate
   (`resolveBotGate`) agora exige `tracking.isArchived === false` na lookup de `AstroBotTracking`
   — tracking arquivada não responde mais, mesmo que a linha de habilitação persista.
   Além disso, `config.get` filtra trackings arquivadas do `enabledTrackingIds` retornado, então
   o próximo save (replace-all) descarta as linhas órfãs. Sem mudança de schema.

7. **`allowedTools` por binding é código morto.** O `binding/create` grava/exibe `allowedTools`,
   mas o router passa um `toolScope:"insights"` global e nunca lê o campo. Permissão exibida é
   enganosa. _Fix candidato:_ enforçar ou remover o campo/UI.

### Limpeza / performance

8. **Duplicação:** `chunkText`/`humanDelayMs` + constantes em `tracking-provider-channel.ts` são
   cópia literal de `uazapi-channel.ts`. Extrair pra módulo compartilhado.

9. **Delay humano bloqueia o webhook:** `sendText` espera 1,5–4s **antes do primeiro chunk** (o
   `UazapiBotChannel` antigo delegava isso ao provider). Pular o delay quando `i === 0`.

10. **Histórico só por `bindingId`:** `loadRecentBotHistory` não filtra por `trackingId`, então
    turnos de uma tracking podem vazar como contexto ao responder noutra tracking da mesma org.

---

## Visão geral

Cada cliente (organização) tem um número de WhatsApp que funciona como interface alternativa do Astro (a IA orquestradora do Cmd+K do NASA). Membros autorizados da org podem **enviar comandos em linguagem natural via WhatsApp** ("liste leads de hoje", "cria tarefa pra João", "resumo da conversa com Maria Silva") e o Astro responde no mesmo chat com os mesmos resultados que daria no NASA Explorer.

Reusa 70% da infra existente:

- **Astro orchestrator** ([astro/server/orchestrator.ts](../src/features/astro/server/orchestrator.ts)) — motor + tools (`analytics`/`lists`/`actions`/`mutations`/`search`/`charts`) já prontos
- **UAZAPI client** (`src/http/uazapi/`) — `sendText`, `sendButtons`, `sendMedia` prontos
- **Webhook inbound** ([api/chat/webhook/route.ts](../src/app/api/chat/webhook/route.ts)) — só adiciona 1 ramo de roteamento ("remetente é membro? → Astro")
- **Multi-tenant + Better Auth** — isolamento por org já garantido
- **Stars charging** ([chargeStarsByAction](../src/features/stars/lib/charge-by-action.ts)) — mesma cobrança que Cmd+K usa

## Arquitetura por plano (duas tiers)

| Plano | Provider WhatsApp | Quem paga | Risco de ban | Limites |
|--|--|--|--|--|
| **Earth** (base) | uazapi (instância dedicada por org, separada do atendimento) | NASA | Médio (mitigado) | 3 phones/org, 30 cmds/h/phone |
| **Suite/Constellation** | WhatsApp Business Cloud API (Meta oficial) | Cliente final (~R$0,025/conversa) | ~Zero | Sem limite prático |

### Por que duas tiers

- Vocês já tomam ban da uazapi em produção (existe `inChatModeActive` no schema = fallback quando banido). Astro Bot via uazapi adiciona vetor de risco
- Cloud API oficial é a única forma compliant pra alto volume — mas custa e exige setup Meta Business
- Funil de venda automático: cada ban da uazapi vira oportunidade de upgrade ("Não tomar isso de novo → upgrade pra Constellation")

### Abstração comum

Astro orchestrator não sabe qual provider está sendo usado. Interface única:

```ts
interface WhatsappBotChannel {
  sendText(phone: string, text: string): Promise<void>;
  sendButtons(phone: string, payload: ButtonPayload): Promise<void>;
  sendImage(phone: string, url: string, caption?: string): Promise<void>;
  registerWebhook(webhookUrl: string): Promise<void>;
}

class UazapiBotChannel implements WhatsappBotChannel { ... }
class MetaCloudBotChannel implements WhatsappBotChannel { ... }
```

Trocar de Earth → Suite é setar uma flag no `OrganizationBotConfig.provider`.

## Schema novo (cobre as 2 tiers)

```prisma
model OrganizationBotConfig {
  id              String @id @default(cuid())
  organizationId  String @unique
  provider        BotProvider @default(UAZAPI)

  // UAZAPI fields
  uazapiInstanceId  String?  // FK pra WhatsAppInstance separada (Astro Bot)

  // Meta Cloud fields
  metaPhoneId       String?  // WABA phone number ID
  metaAccessToken   String?  // criptografado com AI_SECRETS_KEY
  metaWabaId        String?

  // Limites comuns
  maxPhonesPerOrg   Int @default(3)
  maxCmdsPerHour    Int @default(30)
  quietHoursStart   Int?  // ex: 22 (22h)
  quietHoursEnd     Int?  // ex: 8 (8h)

  isActive          Boolean @default(false)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

enum BotProvider {
  UAZAPI
  META_CLOUD
}

model UserWhatsappBinding {
  id              String   @id @default(cuid())
  userId          String
  organizationId  String
  organizationBotConfigId String

  phoneE164       String   @unique
  verifiedAt      DateTime?

  // Auth — PIN + sessão
  pinHash         String              // bcrypt
  pinFailures     Int     @default(0)
  pinLockedUntil  DateTime?

  sessionToken     String?
  sessionExpiresAt DateTime?
  sessionDeviceId  String?  // uazapi deviceId no momento da auth

  // Permissões
  allowedTools     String[]            // whitelist: ["search", "lists", ...]
  isActive         Boolean @default(true)
  lastSeenAt       DateTime?

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

## Autenticação — Modelo Híbrido

**Por que híbrido:** PIN fixo é fraco, OTP rotativo é UX ruim. Híbrido equilibra.

### Fluxo

```
[Binding inicial — 1 única vez]
  User: adiciona phone em Configurações → "Conectar WhatsApp pessoal"
  NASA: envia OTP de 6 dígitos pro email do user
  User: cola OTP no NASA → vincula phone + define PIN de 4-6 dígitos
  NASA: envia "Vinculado ✓" pro WhatsApp do user

[Primeira sessão do dia]
  User: "lista leads de hoje" (via WhatsApp)
  Bot: 🔐 Manda teu código de acesso pra ativar a sessão.
  User: "4729"
  Bot: ✓ Sessão ativa por 8h. Vou listar...

[Comandos normais durante a sessão (read + actions não-destrutivas)]
  User: "cria tarefa pra João revisar proposta amanhã"
  Bot: ✓ Tarefa criada.

[Comando destrutivo — sempre exige PIN]
  User: "deleta o lead João Silva"
  Bot: 🔐 Operação destrutiva — manda teu código pra confirmar.
  User: "4729"
  Bot: ✓ Lead "João Silva" deletado.

[Após 8h sem uso]
  User: "lista leads"
  Bot: 🔐 Sessão expirou. Manda teu código pra reativar.
```

### Camadas de segurança

1. **Binding** com OTP via email (reusa Better Auth)
2. **Sessão diária**: 1º cmd do dia exige PIN → ativa 8h
3. **Sempre exige PIN** pra:
   - DELETE/PURGE qualquer entidade (lead, tracking, automação)
   - Mudar permissões / membros
   - Acessar billing
4. **Auto-revoke** se:
   - `deviceId` da uazapi mudar (signal SIM swap)
   - User aciona "Encerrar sessão WhatsApp" na UI do NASA
   - 3 PINs errados seguidos → lockout 1h

## Mitigações compartilhadas (vale pros 2 providers)

Pra reduzir risco de detecção como bot:

`src/features/astro-bot/lib/bot-rate-limit.ts`
- Verifica `maxCmdsPerHour` por phone antes de processar
- Resposta amigável quando excede: "Aguarde, você está enviando comandos muito rápido"

`src/features/astro-bot/lib/quiet-hours.ts`
- Bloqueia respostas em horário noturno (configurável por org)
- Auto-queue: cmd recebido às 23h → resposta enviada às 8h01
- Padrão comportamento humano

`src/features/astro-bot/lib/humanize.ts`
- Random delay 1.5-4s antes de `sendText` (reforça `delay: 2000` que já existe)
- Pool de mensagens "processando" variadas (4-5 frases rotativas)
- Typing indicator antes de respostas longas (`/send/presence` da uazapi)

`src/features/astro-bot/lib/health-monitor.ts`
- Lê `inChatModeActive` da `WhatsAppInstance` (já existe no schema)
- Se uazapi banida → desativa Astro Bot daquela org + notifica admin via NotificationBell

`src/features/astro-bot/lib/output-formatter.ts`
- Astro response → WhatsApp-friendly text
- Tabelas markdown viram listas numeradas ("1. Lead João — Em negociação")
- Cards viram resumos ("📊 3 trackings · 247 leads ativos")
- Quebra em múltiplas mensagens se passar de 4000 chars (limite uazapi)
- Botões interativos quando precisar confirmação ("Quer mesmo deletar?" → 2 botões)

## UI de setup por plano

### Plano Earth (Configurações → "Astro Bot WhatsApp")

```
🤖 Astro Bot via WhatsApp (uazapi)
[Configurar nova instância dedicada]

⚠️ Esta instância usa WhatsApp não-oficial. Risco de bloqueio existe e
   está dentro do limite do seu plano. Pra zero risco, considere o
   plano Constellation com WhatsApp Business API oficial.

Limite: 3 números vinculados · 30 comandos/hora · 8h-22h
```

### Plano Suite/Constellation

```
🤖 Astro Bot via WhatsApp Business Cloud API (Meta oficial)
[Conectar conta Meta Business]

✓ Zero risco de bloqueio
✓ Sem limite de números vinculados
✓ Você paga pela conversa direto na Meta (~R$0,025/conv)
```

## Comandos suportados (Fase 1 — MVP read-only)

Reusam tools existentes do Astro sem mudança:

| Categoria | Exemplo | Tool Astro |
|--|--|--|
| Analytics | "Quantos leads novos hoje?" | `analytics` |
| Listagem | "Lista leads em 'Em negociação' do tracking Vendas" | `lists` |
| Criação | "Cria tarefa pra João revisar proposta amanhã 10h" | `actions` (Fase 2) |
| Busca | "Resumo da reunião com João Silva" | `search` + `analytics` |
| Charts | "Como anda a conversão de Marketing esse mês?" | `charts` (envia como imagem) |

**Fora de escopo MVP:**
- "Mostra o pipeline visual" — canvas é grande demais. Mandar deeplink: "Abre no NASA: <url>"
- "Cria automação X" — complexo demais via WhatsApp. Mandar deeplink pro editor.

## Roadmap por fase

| Fase | Escopo | Esforço |
|--|--|--|
| **Fase 1 — Read-only MVP (Earth uazapi)** | Vincular número + PIN + comandos somente leitura (analytics, lists, search). Sem mutations. | 3 dias |
| **Fase 2 — Mutations seguras** | Adiciona actions (criar lead, tarefa, mover lead) + botões de confirmação + PIN obrigatório em destrutivo | +2 dias |
| **Fase 3 — Output rico** | Charts como imagem (puppeteer + R2 upload), histórico persistente, multi-org switch | +3 dias |
| **Fase 4 — Hardening uazapi** | Rate limits, audit log de todos os comandos, tools admin gateadas, quiet hours | +2 dias |
| **Fase 5 — Meta Cloud API (Suite tier)** | Implementação do `MetaCloudBotChannel`, UI de conexão Meta Business, billing, migração fluida Earth → Suite | +5 dias |

**Total realista pro Suite com migração fluida:** ~15 dias úteis.

**MVP útil (Fase 1 sozinho):** 3 dias e já entrega valor — user consulta info da empresa pelo celular.

## Riscos & decisões em aberto

### Decididos
- ✅ Provider pago pelo cliente final no Suite (não pela NASA)
- ✅ Instância uazapi DEDICADA por org pra Astro Bot (não reusa atendimento)
- ✅ Auth híbrida (PIN + sessão 8h + PIN obrigatório em destrutivo)
- ✅ Whitelist de tools por padrão (admin pode expandir)
- ✅ Mitigações de humanização ativas mesmo em Cloud API (consistência)

### Pendentes
- ⏸️ Multi-org: se user é membro de várias orgs, como troca contexto via WhatsApp? Sugestão: comando "/org" lista, "/org SLUG" troca, default é a `organizationBotConfigId` do binding
- ⏸️ Áudio: user manda áudio em vez de texto. Transcrever via Whisper (`OPENAI_API_KEY` já existe). Custo adicional de tokens.
- ⏸️ Imagens: user manda imagem ("analisa esse comprovante"). Roteia pra `AI_VISION` executor? Ou pra `analyzeImage` tool do Astro?
- ⏸️ Bot dorme à noite ou só pausa respostas? Recebe e fila? Ou ignora e responde só "Bot dormindo, manda de novo amanhã"?
- ⏸️ Pricing exato do Cloud API — quem cobra o cliente? NASA passa o custo direto? Markup? Plano fixo mensal por uso?

### Riscos operacionais
- **Ban da uazapi** continua acontecendo no Earth — aceitamos como custo. Mitigação: instância dedicada isola atendimento
- **Token cost** sobe — cada comando WhatsApp = chamada Astro = tokens. Pode estourar budget de orgs grandes
- **Suporte humano** — user reclama "bot não respondeu", precisa diagnóstico (ban? quota? PIN errado?). Investir em logging detalhado

## Próximo passo

Quando abrir PR pra implementar:

1. Spec detalhada da Fase 1 num documento separado (`docs/astro-bot-phase-1-spec.md`)
2. Migration do schema (`OrganizationBotConfig` + `UserWhatsappBinding` + enum `BotProvider`)
3. Implementar `UazapiBotChannel` + webhook routing
4. UI de binding em Configurações
5. Testes manuais com 1 piloto interno antes de liberar pra clientes

## Arquivos críticos pra referência

- [astro/server/orchestrator.ts](../src/features/astro/server/orchestrator.ts) — motor a ser reusado
- [api/chat/webhook/route.ts](../src/app/api/chat/webhook/route.ts) — adicionar ramo de roteamento aqui
- [http/uazapi/send-text.ts](../src/http/uazapi/send-text.ts) — base do `UazapiBotChannel.sendText`
- [http/uazapi/send-menu.ts](../src/http/uazapi/send-menu.ts) — base do `UazapiBotChannel.sendButtons`
- [features/stars/lib/charge-by-action.ts](../src/features/stars/lib/charge-by-action.ts) — cobrança Stars por comando
- [features/tracking-chat/lib/in-chat-mode.ts](../src/features/tracking-chat/lib/in-chat-mode.ts) — fallback quando uazapi banida
- [prisma/schema.prisma](../prisma/schema.prisma) — modelo `WhatsAppInstance` e `Organization`
