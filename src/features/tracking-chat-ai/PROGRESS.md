# tracking-chat-ai — Progresso da feature

> **Regra obrigatória:** sempre que algo nesta feature for adicionado, removido, renomeado ou tiver comportamento alterado, **atualize este arquivo na mesma alteração**. Ele é o ponto de continuidade entre sessões — se ele estiver defasado, a próxima sessão vai recriar coisa que já existe ou contrariar decisões já tomadas. Mantenha as seções "Estado atual", "Mapa de arquivos" e "Backlog" sempre verdadeiras.

---

## Objetivo da feature

Substituir o agente IA do WhatsApp que rodava no n8n (`WEBHOOK_AI_AGENT_N8N`) por um pipeline interno **Inngest + AI SDK + Uazapi**. Mantém o mesmo UX/persistência (`AiSettings.prompt`, `assistantName`, `finishSentence`, `Tracking.globalAiActive`) e ganha extensibilidade pra adicionar tools sem mexer em fluxo externo.

Escopo atual: **só WhatsApp**. Instagram/Facebook continuam apontando pro n8n até a fase 2.

---

## Estado atual (v1 — entregue em `feat/tracking-chat-ai`)

### Arquitetura

```
Uazapi → /api/chat/webhook
            │ (depois do conversation.update / lastInboundAt)
            ▼
   inngest.send("chat/ai.whatsapp-message-received", { trackingId, leadId, conversationId, messageId, organizationId })
            │
            ▼ debounce 3s key=leadId · concurrency limit=1 key=leadId · retries=2
   chat-ai-whatsapp-agent (Inngest function)
            │
            ├─ loadAgentContext()         ← lead + conversation + 20 msgs + AiSettings + WhatsAppInstance + org
            ├─ guards inline               ← lead.isActive, settings, instance, statusFlow!=FINISHED, lead.phone
            ├─ step.run("run-agent")       ← generateText(model, system, tools, messages, stopWhen steps>=6)
            └─ step.run("send-final-text") ← splitForWhatsapp(result.text) → loop sendText + persistOutboundMessage
```

### Decisões de design (não reabrir sem motivo forte)

1. **Texto não é tool.** `result.text` do `generateText` é a resposta — enviada via `sendText`. As tools cobrem só o que o modelo não consegue gerar como texto (mídia + controle). Elimina o modo de falha "modelo escreveu fora da tool e o lead não recebeu nada".
2. **Split estilo humano.** Modelo é instruído a separar mensagens com `\n\n`. `splitForWhatsapp()` força ≤4 chunks, ≤500 chars cada, com fallback por sentença quando bloco único >500. Envio sequencial com `delay: 600ms` no payload Uazapi + `setTimeout(600)` entre chunks pra manter ordem.
3. **Debounce nativo do Inngest** (`period: "3s"`, `key: leadId`) — agrupa rajadas de mensagens curtas. Sem Redis, sem infra extra.
4. **Concorrência 1 por lead** — impede execuções paralelas no mesmo lead.
5. **Modelo: OpenAI**, default `gpt-4o-mini`, override via `ASTRO_DEFAULT_MODEL`. Reusa `OPENAI_API_KEY` (mesma do RAG/Astro).
6. **Sem step.run em `loadAgentContext`** — Inngest serializa o retorno em `JsonifyObject<T>`, quebra `ModelMessage[]` e o tipo de `AgentContext` passado pras tools. Re-executar em retry é barato; deixar fora.
7. **Schema sem migrações.** Reusa `AiSettings` (já tem prompt/assistantName/finishSentence/isAudioEnabled), `Lead.isActive` como flag de pausa pós transfer_to_human, `Lead.statusFlow=FINISHED` pós finish_conversation.

### Tools v1 (registradas em [server/tools/index.ts](server/tools/index.ts))

| Tool                 | O que faz                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `send_audio`         | `sendMedia` type=ptt (voz). Sem caption.                                                    |
| `send_document`      | `sendMedia` type=document, com `docName` (fileName) e caption opcional.                     |
| `finish_conversation`| `Lead.statusFlow = FINISHED` + pusher `lead:updated`. IA não responde mais até nova msg.    |
| `transfer_to_human`  | `Lead.isActive = false` + `statusFlow = ACTIVE` + pusher. IA pausada para esse lead.        |
| `add_tags_to_lead`   | Aplica até 3 tags no lead, dispara workflows `LEAD_TAGGED` + alert bus. Só registra `LeadTag` (sem history/activity log nessa fase). Só exposta se a org tiver tag com `description`. |
| `send_buttons`       | Envia preset de botões interativos via Uazapi `/send/menu`. Recebe `presetId`, lê de `AiButtonPreset`, persiste outbound com resumo textual (`<body>\n\n[Botões]\n• B1...`). Só exposta se houver preset ativo. Não trunca botões — se >3, Uazapi recusa e o erro volta pro modelo. |

### Mapa de arquivos

```
src/features/tracking-chat-ai/
├── PROGRESS.md                       ← este arquivo
├── lib/
│   ├── agent.ts                      runWhatsappAgent(): orquestra context+guard+generateText+split+send
│   ├── context.ts                    loadAgentContext() + AgentContext (inclui availableTags) + AgentEventData
│   ├── system-prompt.ts              buildSystemPrompt(): regras de split, finishSentence, catálogo de tags
│   ├── split-message.ts              splitForWhatsapp(): ≤4 chunks de ≤500 chars
│   ├── persist.ts                    persistOutboundMessage(): cria Message fromMe=true, lastOutboundAt, pusher
│   ├── apply-tags-by-ai.ts           applyTagsByAi(): cria LeadTag + dispara workflows LEAD_TAGGED + eventBus
│   └── model.ts                      defaultModel(): OpenAI com ASTRO_DEFAULT_MODEL
└── server/
    └── tools/
        ├── index.ts                  buildAgentTools(ctx) → ToolSet
        ├── send-image.ts
        ├── send-audio.ts
        ├── send-document.ts
        ├── finish-conversation.ts
        ├── transfer-to-human.ts
        ├── add-tags-to-lead.ts
        └── send-buttons.ts
```

Arquivos externos modificados:
- `src/app/api/chat/webhook/route.ts` — trocou `fetch(WEBHOOK_AI_AGENT_N8N)` por `inngest.send`, posicionado depois do `conversation.update`.
- `src/app/api/inngest/route.ts` — registrou `chatAiWhatsappAgent`.
- `src/inngest/functions/chat-ai/whatsapp-agent.ts` — definição da Inngest function (debounce/concurrency/retries).

### Eventos Inngest

| Evento                                  | Producer                                                              | Consumer                  | Payload                                                                                                                |
| --------------------------------------- | --------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `chat/ai.whatsapp-message-received`     | `src/app/api/chat/webhook/route.ts` + `src/inngest/functions/triggers/idle-automation.ts` | `chatAiWhatsappAgent`     | `{ trackingId, leadId, conversationId, messageId, organizationId, trigger?, idleMinutes? }`                            |

### Variáveis de ambiente usadas

- `OPENAI_API_KEY` (obrigatória pra ligar a IA)
- `ASTRO_DEFAULT_MODEL` (opcional, default `gpt-4o-mini`)
- `NEXT_PUBLIC_UAZAPI_BASE_URL` (já existia — base do Uazapi)
- `WEBHOOK_AI_AGENT_N8N` (ainda usada pelos webhooks de Instagram/Facebook — não remover até fase 2)

---

## Backlog / próximas fases

### Fase 2 — Expansão de canais
- [ ] Migrar Instagram (`src/app/api/integrations/instagram/webhook/route.ts:256`).
- [ ] Migrar Facebook (`src/app/api/integrations/facebook/webhook/route.ts:254`).
- [ ] Renomear evento para `chat/ai.message-received` + campo `channel: WHATSAPP|INSTAGRAM|FACEBOOK`. Cada tool decide o transporte.
- [ ] Remover env var `WEBHOOK_AI_AGENT_N8N` após migração completa.

### Tools adicionais (priorizadas)
- [ ] `send_location` — envolver [src/http/uazapi/send-location.ts](../../http/uazapi/send-location.ts) (`sendLocation`). Útil para enviar endereço de loja/encontro.
- [ ] `send_contact` — [src/http/uazapi/send-contact.ts](../../http/uazapi/send-contact.ts) (`sendContact`). Para indicar outro atendente/parceiro.
- [x] ~~`send_buttons` — modelo de dados já existe (`AiButtonPreset`, ver changelog 2026-05-20). Falta a tool em `server/tools/send-buttons.ts` que recebe `presetId`, lê do banco, chama `sendButtons` e persiste outbound. System prompt precisa listar presets ativos com `description` (campo "quando usar") pra IA escolher.~~ **Entregue em 2026-05-21.**
- [ ] `send_list` — `sendList` em [src/http/uazapi/send-menu.ts](../../http/uazapi/send-menu.ts). Mesmo padrão de presets pode ser estendido (hoje só botões).
- [ ] `search_knowledge` — consulta `AiKnowledgeChunk` via pgvector (já existe schema). Retorna trechos relevantes pro RAG.
- [ ] `get_lead_context` — busca campos extras do lead (UTM, tags, histórico de status) quando o prompt principal não trouxer.
- [ ] `schedule_followup` — cria `Reminder` para o lead em data futura.
- [ ] `update_lead_field` — escrita controlada de campos do lead (name, email, amount, temperature) com whitelist.

### Funcionalidades
- [ ] **Reset de histórico v2 (híbrido)** — hoje, ao alterar `AiSettings.prompt`, `loadAgentContext` corta TODAS as mensagens anteriores a `settings.updatedAt` (slate limpo). É confiável mas pode soar como "amnésia" se a mudança no prompt for pequena. Ideal: combinar reforço no system prompt ("estas instruções substituem qualquer tom anterior") com corte do histórico só quando `updatedAt` for recente (ex: ≤24h) ou quando a diff do prompt for grande. Decisão registrada em 2026-05-21 após relato de que a IA seguia o tom antigo mesmo com prompt novo.
- [ ] Transcrição inbound de áudio (Whisper) antes do `generateText` — hoje áudio entra como `[audio]` no histórico, sem conteúdo.
- [ ] OCR de imagens inbound — mesmo conceito.
- [ ] Realtime UI feedback — disparar `agent:thinking` via pusher enquanto o `run-agent` step roda, pra UI mostrar "IA digitando..." sem depender só do delay do Uazapi.
- [ ] Telemetria — registrar custo (input/output tokens) por execução em `AiSession` ou tabela nova `ChatAiRun` (decisão pendente).
- [ ] Guard por horário — respeitar `Tracking` business hours (se existir) e cair em fila pro humano fora do horário.
- [ ] Toggle de pausa por lead na UI — botão "pausar IA neste lead" que seta `Lead.isActive=false` pra atendente assumir manualmente.

### Dívida técnica
- [ ] Considerar mover `WEBHOOK_AI_AGENT_N8N` pra config por-tracking em vez de env global (multi-org). Provavelmente fica obsoleto com fase 2.
- [ ] `ctx.lead.statusFlow` é checado como string literal `"FINISHED"` em `agent.ts` — usar o enum `StatusFlow.FINISHED` do prisma quando refatorar.
- [ ] **Auditoria do `add_tags_to_lead`**: `applyTagsByAi` hoje pula `recordLeadHistory`, `recordLeadEvent("TAG_ADDED")` e `logActivity` porque essas funções exigem `userId` humano. Resultado: tags aplicadas pela IA não aparecem no feed de jornada do lead nem na timeline do admin. Resolver com User de sistema ("NASA IA") por organização ou refatorando essas APIs para aceitarem ator opcional. Antes disso, ações da IA são rastreáveis só via `LeadTag.createdAt` + logs de Inngest.
- [ ] **Limite de botões por preset**: hoje `AiButtonPreset.buttons` é livre (decisão consciente do usuário em 2026-05-20, reconfirmada em 2026-05-21 ao implementar a tool). A Uazapi recomenda ≤3 quick replies. A tool `send_buttons` **não trunca** — envia tudo e, se >3, a Uazapi retorna 400; o `try/catch` da tool devolve `{ error: "uazapi_send_failed", message }` pro modelo, que segue a conversa em texto. Resultado: preset com 4+ botões "falha silenciosamente" do ponto de vista do lead (ele recebe só o texto da IA, sem botões). Resolver com `.max(3)` no schema de create/update do preset + ajuste do `useFieldArray` na UI quando virar dor real.
- [ ] **Duplicação consciente do dispatch de workflows LEAD_TAGGED**: a query (`Workflow.findMany` com filtro `nodes.some.type=LEAD_TAGGED + array_contains tagIds`) está hoje em DOIS lugares — `src/app/router/leads/add-tags.ts` (humano) e `src/features/tracking-chat-ai/lib/apply-tags-by-ai.ts` (IA). Foi feito de propósito para não tocar no router de produção. Se o critério de match mudar, atualizar os dois.

---

## Como testar localmente (smoke test)

1. `pnpm dev` + `pnpm inngest:dev` (devkit em http://localhost:8288).
2. Em um tracking de teste com `globalAiActive=true`, `AiSettings.prompt` preenchido e `WhatsAppInstance` conectado: mandar 3 msgs rápidas pelo WhatsApp do número do lead.
3. Esperado no devkit Inngest:
   - 1 run de `chat-ai-whatsapp-agent` disparado ~3s após a última msg (debounce funcionando).
   - Steps: `run-agent` (com `toolCalls` listados se houver) → `send-final-text` (com `sent: N` partes).
4. No WhatsApp: 2-4 mensagens curtas separadas chegando do número do tracking.
5. Pedir "quero falar com humano" → confirmar no banco que `Lead.isActive=false` e que próximas msgs **não** disparam nova run (cai no guard `lead_inactive`).

---

## Histórico de mudanças (changelog desta feature)

> Adicione uma entrada **toda vez** que alterar algo nesta feature. Formato: `YYYY-MM-DD — descrição curta`.

- **2026-05-18** — v1 inicial. Pipeline Inngest+AI SDK+Uazapi substituindo `WEBHOOK_AI_AGENT_N8N` para canal WhatsApp. Tools: send_image/send_audio/send_document/finish_conversation/transfer_to_human. Split de mensagem em até 4 partes. Debounce 3s + concurrency 1 por leadId.
- **2026-05-19** — Pausa automática da IA quando atendente humano interage. Novo helper `claimLeadForAttendant(leadId, userId)` em [`src/app/router/message/utils.ts`](../../../app/router/message/utils.ts) seta `Lead.isActive=false` + `Lead.responsibleId=userId` e dispara pusher `lead:updated`. Chamado dos 6 endpoints de envio outbound (text/audio/image/file/location/contact). Sobrescreve responsável existente: último que respondeu vira o dono. `create-with-buttons` fora de escopo. Implica que o guard `lead.isActive` em [agent.ts](lib/agent.ts) agora tem dois disparadores: a tool `transfer_to_human` e qualquer mensagem manual do atendente.
- **2026-05-20** — Configuração de presets de botões (UI only — tool ainda não existe). Nova model `AiButtonPreset` (N por tracking, JSON `buttons[{text,id}]`, flag `isActive`, campo `description` "quando usar" pra futura decisão da IA). Novo namespace oRPC `ia.buttonPresets` com `list/create/update/delete`. Tab "Botões" adicionada ao [chatbot-ia.tsx](../tracking-settings/components/chatbot-ia.tsx) (refactor pra Tabs Geral+Botões) com Accordion inline + toggle `isActive` no header + delete com confirmação. **Pendente**: tool `send_buttons` que consome esses presets e atualiza o system prompt pra IA escolher qual enviar via `description`. Migração: `add_ai_button_preset`.
- **2026-05-19** — Tagging automático pela IA. Nova tool `add_tags_to_lead` registrada quando há ao menos uma `Tag.description` preenchida na org/tracking; aplica até 3 tags por chamada via novo helper [`apply-tags-by-ai.ts`](lib/apply-tags-by-ai.ts), que cria `LeadTag` (skipDuplicates), dispara workflows `LEAD_TAGGED` que casem com as tagIds e publica `lead.tag_added` no event bus de alertas. `loadAgentContext` ganhou `availableTags` (tags com descrição na org + tracking-scope) e o select dos `leadTags` atuais passou a incluir `id` (a tool precisa pra filtrar duplicatas e validar IDs do catálogo). `buildSystemPrompt` ganhou seções "Tags atuais do lead", "Catálogo de tags disponíveis" e "Quando tagear". **Não toca** em `src/app/router/leads/add-tags.ts` — caminho humano permanece intacto (com `recordLeadHistory`/`logActivity`/`recordLeadEvent`). **Dívida**: auditoria das ações da IA (ver "Dívida técnica") e duplicação do dispatch de workflows entre humano e IA.
- **2026-05-21** — Reset de histórico ao alterar prompt. `AiSettings` ganhou `createdAt`/`updatedAt` (migração necessária). [loadAgentContext](lib/context.ts) agora filtra `messages` para incluir só as criadas após `settings.updatedAt` — quando o prompt muda, a IA começa com slate limpo e não fica presa ao tom das respostas anteriores. Decisão tomada por hoje; o ideal documentado no backlog é abordagem híbrida (reforço no system + corte só em mudanças recentes/grandes).
- **2026-05-21** — Integração com Idle Automation (nova aba "Interações" em tracking settings). `AgentEventData` ganhou `trigger?: "inbound" | "idle-reopen" | "idle-reopen-with-instruction"` e `idleMinutes?: number`. Quando `trigger="idle-reopen-with-instruction"`, [agent.ts](lib/agent.ts) appenda ao system prompt uma nota explicando que o lead está ocioso há X min e instrui a IA a reabrir a conversa de forma natural — sem nova mensagem de usuário, o agente toma iniciativa. Produzido pela nova função Inngest [`idle-automation.ts`](../../inngest/functions/triggers/idle-automation.ts) (3 funcs: scheduleIdleChecks que escuta `lead/created` + `chat/inbound-message.received`; checkNoFirstResponse e checkInConvIdle com sleepUntil + re-check post-wake). O cron antigo `detectLeadsWaitingAttention` e o evento `lead.waiting_attention` do alert-catalog foram **removidos** — configuração migrou pra `TrackingIdleAutomation` (modelo Prisma novo, config por-tracking com 2 cenários: sem 1ª resposta / em conversa).
- **2026-05-21** — Tool `send_buttons` habilitada. `loadAgentContext` agora carrega `AiButtonPreset` filtrados por `isActive=true` (ordem `createdAt asc`) e expõe como `availableButtonPresets`. `buildSystemPrompt` ganhou `buildButtonsBlock` (mesmo padrão de `buildTaggingBlock`): lista cada preset como `- nome (id: ID): descrição [B1 | B2 | ...]` + instruções pra IA escolher pelo `description` e nunca inventar id. Nova tool [`server/tools/send-buttons.ts`](server/tools/send-buttons.ts) recebe `presetId`, lê do `ctx.availableButtonPresets`, chama `sendButtons` da Uazapi (sem truncar) e persiste outbound via `persistOutboundMessage` com resumo textual idêntico ao envio manual (`<body>\n\n[Botões]\n• B1\n• B2`). Registro condicional em `buildAgentTools`: só expõe a tool se houver preset ativo, evitando que o modelo invente IDs. Reusa o fix do payload unificado em [send-menu.ts](../../http/uazapi/send-menu.ts) (`type:"button"` + `choices:["texto|id"]`). Sem mudança de schema. Dívida do limite de 3 botões mantida (ver "Dívida técnica").
