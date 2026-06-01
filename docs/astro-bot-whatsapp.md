# Astro Bot via WhatsApp — Design Doc

**Status:** Aprovado, pendente implementação (próxima sessão / outra PR)
**Última atualização:** Sessão 2026-05-30 (Wey + Claude)

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
