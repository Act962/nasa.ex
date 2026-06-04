# Astro Bot Webhook — Pendências de Hardening

Lista do review do PR #286 + patches da branch
`feature/tracking-chat-fix-astro-bot-webhook-interceptor-20260604` que **não**
foram fechados no patch atual e precisam de PR separada — seja por exigir
decisão de produto, migration nova, ou trabalho da Fase 3.

Contexto:
- Arquivo principal: [`src/app/api/chat/webhook/route.ts`](../src/app/api/chat/webhook/route.ts)
- Interceptador: [`src/features/astro-bot/lib/webhook-handler.ts`](../src/features/astro-bot/lib/webhook-handler.ts)
- Helper de cache: [`src/features/tracking-chat/lib/get-cached-tracking-context.ts`](../src/features/tracking-chat/lib/get-cached-tracking-context.ts)
- Doc do produto: [`astro-bot-whatsapp.md`](astro-bot-whatsapp.md)

> Itens fechados no patch atual (referência rápida):
> - Duplicação no fail parcial → `maybeHandleBotMessage` agora encapsula erros internos e devolve `handled=true status=partial_failure`.
> - Phantom leads META_CLOUD → `handled=true status=provider_not_implemented` suprime criação de lead.
> - Cache do tracking lookup → `getCachedTrackingContext` (in-process Map, TTL 30s).
> - Cálculo lazy de `leadName`/`senderName` → movido pra depois do bloco bot.
> - Defesa-em-profundidade: org check usa `binding.botConfig.organizationId`, exhaustive switch no provider, dead fallback removido, warn estruturado em config quebrada.

---

## 1. Caso de borda: tracking deletado mas instância bot viva

**Severidade**: borda · **Origem**: patch atual (regressão controlada)

O patch atual movimentou `tracking.findUnique` (agora cacheado) pra antes do
bloco bot. Se o `trackingId` na URL apontar pra um tracking deletado mas a
instância dedicada do bot ainda existir vinculada a outra org, o webhook
devolve 400 antes mesmo de tentar interceptar.

uazapi pode marcar o webhook como falho e parar de entregar mensagens —
o membro perde acesso ao bot até o admin reconfigurar a URL.

**Solução proposta**: se `tracking` é null mas o `json.token` bate com
alguma `WhatsAppInstance` que é `uazapiInstanceId` de algum
`OrganizationBotConfig`, ainda chamar `maybeHandleBotMessage` derivando
`trackingOrganizationId` do botConfig encontrado.

---

## 2. Mídia de membro com binding ainda vira lead

**Severidade**: baixa · **Origem**: PR #286 (comentário já admite)

O filtro `json.message.messageType === "TextMessage"` em
[`route.ts`](../src/app/api/chat/webhook/route.ts) só intercepta texto.
Áudio/imagem/documento de membro com binding vai pro fluxo normal e cria
Lead. Comentário admite "Fase 3 adiciona OCR/visão" — mas até lá, a UX é
confusa: membro manda áudio pro bot, vira lead.

**Solução proposta** (Fase 3): interceptar todo `messageType` quando há
binding ativo e responder com "ainda não processo áudio/imagem" via channel.

---

## 3. Schema permite reuso de WhatsAppInstance entre atendimento e bot

**Severidade**: média (correctness) · **Origem**: PR #286

`OrganizationBotConfig.uazapiInstanceId` é FK opcional pra `WhatsAppInstance`,
sem constraint que impeça apontar pra mesma instância usada por um
`Tracking` de atendimento. Se admin misconfigurar, o webhook fica ambíguo:

- Mensagem de cliente (lead) vinda dessa instância → token check do bot
  passa (mesma instância) → se cliente compartilhar phone com algum
  membro com binding na mesma org, cliente é interceptado como bot.

**Solução proposta**: adicionar constraint no schema garantindo que
`OrganizationBotConfig.uazapiInstanceId` aponte pra instância **não usada**
por nenhum `Tracking`. Ou, em código, no setup de `upsert.ts`, validar que
a instância selecionada não tem `tracking` associado.

---

## Próximos passos

1. Itens #1 e #2 são quality-of-life — abrir issue/branch quando houver
   sprint de polimento dedicada ao Astro Bot.
2. Item #3 é correctness mas baixa probabilidade — depende de admin
   misconfigurar. Vale agendar pra sprint de hardening de schema.
3. Quando `getCachedTrackingContext` ganhar novos call-sites (`/api/in-chat`,
   `/identify`), lembrar de chamar `invalidateTrackingContext` no procedure
   que toggle `globalAiActive` — hoje o admin espera até 30s pra ver efeito.
