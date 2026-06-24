# Tag por clique em botão — follow-ups e riscos residuais

> Contexto: tag aplicada ao lead quando ele clica num botão/linha de menu do WhatsApp.
> O envio grava `metadata.buttonTagMap` (`buttonId → tagId`) na `Message`; o webhook
> (`src/app/api/chat/webhook/route.ts`, bloco `[btn-tag]`) resolve a tag no clique e
> chama `applyTagsByAi`.
>
> Fluxo Uazapi-only (no provider Meta Cloud, botões são gateados como
> `META_FEATURE_UNSUPPORTED`).

## Estado atual (já corrigido)

Os 4 caminhos de envio gravam o `buttonTagMap`:

| Caminho | Arquivo |
| --- | --- |
| Automação clássica (nó send-message) | `src/features/tracking-executions/components/send-message/executor.ts` |
| Automação agent-mode | `src/features/workflows/lib/agent-executors/apps.ts` + `src/features/tracking-executions/lib/send-buttons-to-lead.ts` |
| Tool da IA (chatbot) | `src/features/tracking-chat-ai/server/tools/send-buttons.ts` |
| Envio manual pelo chat | `src/app/router/message/create-with-buttons.ts` + `src/features/tracking-chat/components/buttons-panel.tsx` |

Presets (aba Chatbot IA → Presets de botões) ganharam campo `tagId` por botão
(`src/features/tracking-settings/components/chatbot-ia-buttons-tab.tsx` + routers
`create/update-ai-button-preset.ts`).

Causas sistemáticas já eliminadas no webhook:
- **Short-circuit**: parava no primeiro metadata achado mesmo sem o botão clicado → agora só aceita candidato cujo `buttonTagMap` contém exatamente o `clickedButtonId`.
- **Fallback frágil**: pegava a outbound mais recente com metadata → agora varre as recentes buscando a que tem o botão clicado.
- **id em `content.id` / `messageType` variante**: webhook re-derivava o id diferente do adapter → agora usa o `replyId` já normalizado pelo adapter como fonte primária, e gateia na presença de uma mensagem canônica `interactive_reply` (não em strings de `messageType`).

## Follow-up recomendado (fazer depois)

### 1. Estratégia 3 sem janela de 20 — filtro JSON-path (prioridade: média)

**Problema:** o fallback (`webhook/route.ts`, Estratégia 3) busca as 20 outbound
recentes com metadata e varre em JS procurando a que contém o botão clicado. Se
`quoted`/`contextInfo` não vierem **e** mais de 20 mensagens com metadata tiverem
sido enviadas depois do menu, a mensagem certa fica fora da janela → tag não cai.
Raro, mas possível em conversa muito intensa.

**Solução:** trocar o `findMany({ take: 20 })` + varredura em JS por uma query única
com filtro JSON-path no Postgres, achando direto a outbound cujo
`metadata.buttonTagMap.<clickedButtonId>` existe:

```ts
// Estratégia 3 (substituir o findMany + loop atual):
if (!resolvedTagId && buttonTagLead.conversation?.id) {
  const matchingMessage = await prisma.message.findFirst({
    where: {
      conversationId: buttonTagLead.conversation.id,
      fromMe: true,
      // value at path metadata->buttonTagMap-><clickedButtonId> existe e não é null
      metadata: {
        path: ["buttonTagMap", clickedButtonId],
        not: Prisma.AnyNull,
      },
    },
    orderBy: { createdAt: "desc" },
    select: { metadata: true },
  });
  resolvedTagId = resolveTagIdFromMeta(matchingMessage?.metadata);
  console.log("[btn-tag] strategy3 resolvedTagId:", resolvedTagId);
}
```

**Cuidados ao implementar:**
- Confirmar o comportamento de `path` + `Prisma.AnyNull` na versão do Prisma 7 deste
  projeto (filtragem JSON em Postgres). Testar com um `clickedButtonId` real.
- `clickedButtonId` é a chave da varredura — vem do `replyId` do adapter; garantir que
  está definido antes da query (já está, dentro do `if (clickedButtonId)`).
- Remove a necessidade de `Prisma.DbNull` no `where` da versão antiga.

### 2. (Opcional) Escopar a query da tag por tracking/org

`prisma.tag.findFirst({ where: { id: resolvedTagId, archivedAt: null } })` não filtra
por `trackingId`/`organizationId`. Se um preset referenciar um `tagId` de outro
tracking, ainda aplicaria. Higiene de dados, não causa "não funciona". Avaliar se vale
adicionar o escopo.

## Riscos residuais conhecidos (baixa probabilidade — monitorar, não bloqueiam)

- **Fidelidade do `id` ecoado pelo uazapi**: a tag só resolve se o id clicado for
  idêntico à chave do `buttonTagMap`. Presets/inline usam `crypto.randomUUID()`
  (seguro). Risco só com ids customizados muito longos no painel manual (truncamento
  por WhatsApp/uazapi).
- **Lookup do lead por telefone**: `phone = chatid.split("@")[0]` + `findUnique`.
  Consistente na maioria; borda no quirk do 9º dígito BR quando o lead foi criado com
  formato diferente de outra origem.
- **Tag arquivada** (`archivedAt != null`) → não aplica, silenciosamente. Por design.
- **Mensagens enviadas antes do deploy** não têm `buttonTagMap` → cliques nelas não
  tageiam. Só envios novos funcionam.

## Diagnóstico em produção

Logs `[btn-tag] ...` cobrem cada etapa. Ordem de leitura num caso que falhar:
1. `[btn-tag] interactiveReply:` — gate disparou + `replyId` extraído pelo adapter.
2. `[btn-tag] clickedButtonId:` — id final usado na resolução.
3. `[btn-tag] strategyN resolvedTagId:` — qual estratégia resolveu (ou nenhuma).
4. `[btn-tag] activeTag:` / `tag applied successfully:` — tag existe/ativa e foi aplicada.
