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
| `send_image`         | `sendMedia` type=image, com caption opcional. Persiste Message + pusher.                    |
| `send_audio`         | `sendMedia` type=ptt (voz). Sem caption.                                                    |
| `send_document`      | `sendMedia` type=document, com `docName` (fileName) e caption opcional.                     |
| `finish_conversation`| `Lead.statusFlow = FINISHED` + pusher `lead:updated`. IA não responde mais até nova msg.    |
| `transfer_to_human`  | `Lead.isActive = false` + `statusFlow = ACTIVE` + pusher. IA pausada para esse lead.        |

### Mapa de arquivos

```
src/features/tracking-chat-ai/
├── PROGRESS.md                       ← este arquivo
├── lib/
│   ├── agent.ts                      runWhatsappAgent(): orquestra context+guard+generateText+split+send
│   ├── context.ts                    loadAgentContext() + tipo AgentContext + AgentEventData
│   ├── system-prompt.ts              buildSystemPrompt(): regras de split, finishSentence, tools
│   ├── split-message.ts              splitForWhatsapp(): ≤4 chunks de ≤500 chars
│   ├── persist.ts                    persistOutboundMessage(): cria Message fromMe=true, lastOutboundAt, pusher
│   └── model.ts                      defaultModel(): OpenAI com ASTRO_DEFAULT_MODEL
└── server/
    └── tools/
        ├── index.ts                  buildAgentTools(ctx) → ToolSet
        ├── send-image.ts
        ├── send-audio.ts
        ├── send-document.ts
        ├── finish-conversation.ts
        └── transfer-to-human.ts
```

Arquivos externos modificados:
- `src/app/api/chat/webhook/route.ts` — trocou `fetch(WEBHOOK_AI_AGENT_N8N)` por `inngest.send`, posicionado depois do `conversation.update`.
- `src/app/api/inngest/route.ts` — registrou `chatAiWhatsappAgent`.
- `src/inngest/functions/chat-ai/whatsapp-agent.ts` — definição da Inngest function (debounce/concurrency/retries).

### Eventos Inngest

| Evento                                  | Producer                          | Consumer                  | Payload                                                                       |
| --------------------------------------- | --------------------------------- | ------------------------- | ----------------------------------------------------------------------------- |
| `chat/ai.whatsapp-message-received`     | `src/app/api/chat/webhook/route.ts` | `chatAiWhatsappAgent`     | `{ trackingId, leadId, conversationId, messageId, organizationId }`           |

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
- [ ] `send_buttons` / `send_list` — `sendButtons`/`sendList` em [src/http/uazapi/send-menu.ts](../../http/uazapi/send-menu.ts). Qualificação guiada com botões interativos.
- [ ] `search_knowledge` — consulta `AiKnowledgeChunk` via pgvector (já existe schema). Retorna trechos relevantes pro RAG.
- [ ] `get_lead_context` — busca campos extras do lead (UTM, tags, histórico de status) quando o prompt principal não trouxer.
- [ ] `schedule_followup` — cria `Reminder` para o lead em data futura.
- [ ] `update_lead_field` — escrita controlada de campos do lead (name, email, amount, temperature) com whitelist.

### Funcionalidades
- [ ] Transcrição inbound de áudio (Whisper) antes do `generateText` — hoje áudio entra como `[audio]` no histórico, sem conteúdo.
- [ ] OCR de imagens inbound — mesmo conceito.
- [ ] Realtime UI feedback — disparar `agent:thinking` via pusher enquanto o `run-agent` step roda, pra UI mostrar "IA digitando..." sem depender só do delay do Uazapi.
- [ ] Telemetria — registrar custo (input/output tokens) por execução em `AiSession` ou tabela nova `ChatAiRun` (decisão pendente).
- [ ] Guard por horário — respeitar `Tracking` business hours (se existir) e cair em fila pro humano fora do horário.
- [ ] Toggle de pausa por lead na UI — botão "pausar IA neste lead" que seta `Lead.isActive=false` pra atendente assumir manualmente.

### Dívida técnica
- [ ] Considerar mover `WEBHOOK_AI_AGENT_N8N` pra config por-tracking em vez de env global (multi-org). Provavelmente fica obsoleto com fase 2.
- [ ] `ctx.lead.statusFlow` é checado como string literal `"FINISHED"` em `agent.ts` — usar o enum `StatusFlow.FINISHED` do prisma quando refatorar.

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
