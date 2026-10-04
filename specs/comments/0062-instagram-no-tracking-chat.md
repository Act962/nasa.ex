---
id: 0062
titulo: Comentários e DMs do Instagram viram conversa no tracking-chat
dominio: comments
status: implementada
autor: Weydson + Claude
criada: 2026-10-04
atualizada: 2026-10-04
branch: feature/W-orbita-melhorias-ui-ux-2-20261004
pr:
peso: completa
---

# 0062 — Comentários e DMs do Instagram viram conversa no tracking-chat

## 1. Contexto

Com o Comments conectado pela Meta (spec 0061), os comentários e DMs do Instagram chegam ao ÓRBITA, mas só servem às automações. O atendente não vê quem comentou, não tem o histórico da pessoa e não consegue responder pelo chat. O círculo do Instagram no tracking-chat já olha para o Comments (`conversation-filters.tsx`), mas nenhuma conversa nasce desse caminho. O fluxo antigo (`/api/integrations/instagram/webhook`) só cria lead por DM, sempre no primeiro tracking, com nome `Instagram <id>` e sem comentários.

## 2. Objetivo

Todo comentário e DM do Instagram conectado vira mensagem na conversa do lead (um por pessoa), no tracking escolhido, com o @, a tag "Instagram", a miniatura do post nos comentários, e resposta no mesmo comentário direto do chat.

### Não-objetivos

- Enviar mídia (imagem/áudio) pelo Instagram a partir do chat.
- Curtir ou editar comentário pelo chat (a API não permite — ver seção Comentários do Planner).
- Migrar leads antigos criados pelo fluxo de DM legado.
- Contas conectadas pelo passo a passo manual (`INSTAGRAM_LOGIN`) — só `META_LOGIN` nesta fase.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | `SocialChannel.leadTrackingId` guarda o tracking que recebe os leads do Instagram; ausente = primeiro tracking da org (por criação). Escolhido em Comments → Integrações. |
| RF-2 | Comentário (`COMMENT_CREATED`) e DM (`DIRECT_MESSAGE_RECEIVED`) de outra conta: acha ou cria o lead por `phone = IGSID` no tracking, com nome `@username`, `source = INSTAGRAM`, conversa `channel = INSTAGRAM`, `remoteJid = <IGSID>@instagram`. |
| RF-3 | A mensagem guarda `metadata.instagram = { kind, commentId?, media? }`. Comentário leva `media = { id, permalink, thumbnailUrl, mediaType, title }` (título do post do Planner quando existir). |
| RF-4 | A tag "Instagram" entra no lead; se a org não tem a tag padrão, ela é criada (mesmo slug/cor do template, spec 0042). Aplica também "Em atendimento"/"Aguard. atendimento" pelas regras existentes. |
| RF-5 | Respostas da automação do Comments (resposta pública e DM) entram na conversa como enviadas (`fromMe`), marcadas como automação. |
| RF-6 | No chat, comentário mostra "Comentário no <formato>" + card do post (miniatura, título, formato, horário, link); DM mostra "Mensagem no Direct do Instagram". |
| RF-7 | Em conversa do Instagram, o comentário mais recente do lead vem selecionado na caixa de resposta; responder com um comentário selecionado publica a resposta **naquele comentário**. Sem seleção, vai por DM (resposta privada ao último comentário se o lead nunca mandou DM). |
| RF-8 | O webhook legado deixa de criar lead/mensagem de DM para contas `META_LOGIN` (quem cuida é este fluxo), evitando duplicar. |
| RF-9 | Eventos chegam ao chat em tempo real (Pusher: `conversation:new`, `message:new`). |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Falha no chat nunca derruba a automação nem o webhook (best-effort, depois das automações). |
| RNF-2 | Idempotente: `Message.messageId` = id do comentário/mid; reentrega da Meta não duplica. |
| RNF-3 | Nada de I/O dentro de `$transaction` (Regra 18). |

## 4. Critérios de aceite

- [x] **CA-1** — Dado Comments conectado pela Meta, quando alguém comenta num post, então aparece conversa `@usuario` no tracking escolhido com o comentário e a miniatura do post.
- [x] **CA-2** — Quando a mesma pessoa manda DM, a mensagem cai na mesma conversa com "Mensagem no Direct do Instagram".
- [x] **CA-3** — O lead tem a tag "Instagram".
- [ ] **CA-4** — Com o comentário selecionado, enviar no chat publica a resposta no mesmo comentário no Instagram e a mensagem aparece como enviada.
- [ ] **CA-5** — Respostas da automação aparecem na conversa como enviadas.
- [ ] **CA-6** — Reentrega do mesmo evento não duplica mensagem.
- [ ] **CA-7** — Comentário do próprio perfil não cria lead.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Tracking escolhido foi apagado | Cai no primeiro tracking da org. |
| CB-2 | Org sem tracking | Não cria lead; automações seguem. |
| CB-3 | Tracking sem status | Não cria lead (mesmo comportamento do fluxo legado). |
| CB-4 | DM sem username no evento | Busca `username`/`name` na Graph API; sem resposta, usa "Instagram". |
| CB-5 | Mídia do post não carrega (permissão/expirada) | Mensagem sem card, só o rótulo e o texto. |
| CB-6 | Lead já existe por DM legado no mesmo tracking (`phone = IGSID`) | Reaproveita o lead e a conversa. |
| CB-7 | Resposta no comentário falha (comentário apagado) | Erro legível no chat; nada é gravado como enviado. |

## 6. Decisões de design

### D-1 — Coluna `lead_tracking_id` em `social_channels`, sem FK
Mesmo padrão de `connectedById`: ponteiro solto, sem somar relation ao model `Tracking`. Tracking apagado = fallback para o primeiro (CB-1).

### D-2 — Ponte por callback em `processChannelEvents`
O módulo `social` não conhece o tracking-chat. A rota injeta um observador (`ChannelEventObserver`); a ponte mora em `src/features/tracking-chat/server/instagram/`. A automação roda antes; o chat depois, best-effort.

### D-3 — Respostas da automação vêm do resultado do caso de uso
`handleInboundEvent` passa a devolver o que enviou (`deliveries`: tipo, texto, botões, id externo). Ler de eco de webhook seria incerto (eco de comentário próprio nem sempre chega) e duplicaria com o que o chat envia.

### D-4 — "Comentário selecionado" reaproveita a resposta citada do chat
`messageSelected`/`replyIdInternal` já existem. Se a mensagem citada é um comentário do Instagram, `message.create` responde no comentário em vez de mandar DM.

## 7. Plano de implementação

- Migration `social_channels.lead_tracking_id`; schema; `src/features/comments/server/lead-tracking.ts` + `comments.channel.leadTracking`/`setLeadTracking`.
- `handle-inbound-event.ts`: `deliveries` no resultado.
- `process-channel-events.ts`: observador opcional por evento.
- `src/features/tracking-chat/server/instagram/ingest-instagram-event.ts` (lead, conversa, mensagem, tags, Pusher) + `instagram-graph-lookups.ts` (card do post, perfil) + `lib/instagram-message-metadata.ts` (contrato do `metadata`).
- Rotas de webhook (único e legado) passam a ponte; legado pula DM de conta `META_LOGIN`.
- `message/create.ts`: resposta em comentário / DM pelo gateway do canal `META_LOGIN`.
- UI: `message-box.tsx` (card do post/rótulos), auto-seleção do comentário em `body.tsx`, chip na caixa de resposta, seletor de tracking no card do Comments.

## 8. Changelog

- 2026-10-04 — criada e implementada. Testado com eventos assinados simulados (comentário + DM do mesmo usuário → uma conversa `@usuario` no tracking escolhido, card do Reel, rótulo de Direct, tag Instagram, chip "Respondendo ao comentário"). Falta o teste real de envio (CA-4) e de automação (CA-5).
