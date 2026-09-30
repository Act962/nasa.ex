---
id: 0052
titulo: Espelhar o disparo da campanha no chat e exigir valor nas variáveis
dominio: campanhas
status: em-revisao
autor: João Gabriel
criada: 2026-09-30
atualizada: 2026-09-30
branch: claude/campanhas-feedback-validacao-368e85
pr:
peso: completa
---

# 0052 — Espelhar o disparo da campanha no chat e exigir valor nas variáveis

## 1. Contexto

Dois problemas relatados no uso do disparo em massa (spec 0040, Fase 3 do
`docs/campanhas-overview.md`):

1. **O template enviado não aparece no chat.** O `dispatchBroadcast` envia pela
   Meta e grava só o `BroadcastRecipient`. Nenhuma `Message` é criada, então o
   atendente só vê a conversa quando o contato responde — e sem o contexto do
   que foi enviado. Pior: a audiência pode vir de contatos que **nunca**
   conversaram (CSV ou leads de outro tracking), e para esses não existe nem
   conversa.
2. **Disparo com variável vazia.** Na aba Modelo, `{{1}}` como "Texto fixo" em
   branco é salvo sem erro e o botão Disparar segue liberado. O envio sai com
   parâmetro vazio (a Meta recusa ou entrega a frase quebrada: "Olá, .").

## 2. Objetivo

Todo template que a campanha envia com sucesso aparece como mensagem enviada na
conversa do contato no chat do tracking de origem, e nenhuma campanha sai com
variável sem valor.

### Não-objetivos

- Header dinâmico e botões com variável (o MVP segue mapeando só o corpo).
- Renderizar mídia de cabeçalho no chat — a mensagem espelhada é texto.
- Disparar automações de lead novo (workflow NEW_LEAD, rodízio, IA) para os
  leads criados pela campanha — ver D-2.
- Reprocessar campanhas já disparadas para criar as mensagens retroativamente.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Após envio bem-sucedido, grava `Message` `fromMe` com o `wamid` e o texto do template com as variáveis resolvidas. |
| RF-2 | O lead é procurado no tracking da campanha por todas as grafias do número (`waIdLookupVariants`, com e sem o 9º dígito). |
| RF-3 | Sem lead no tracking, cria um no primeiro status, `ACTIVE`, `source WHATSAPP`, `phone` = `wa_id` devolvido pela Meta. |
| RF-4 | Sem conversa, cria com `remoteJid = <phone>@s.whatsapp.net`. |
| RF-5 | Recipient sem `leadId` passa a apontar para o lead usado. |
| RF-6 | A lista de conversas e a conversa aberta atualizam em tempo real (Pusher `message:new`). |
| RF-7 | `setTemplate` recusa variável de origem "Texto fixo" ou "Campo da planilha" sem valor. |
| RF-8 | `send`/`schedule`/taxa recusam campanha cujo mapa não cobre todas as `{{n}}` do corpo do template aprovado, ou tem valor vazio. |
| RF-9 | No envio, variável que resolve vazia para um contato (ex.: coluna da planilha em branco) marca aquele destinatário `FAILED` com o motivo, sem chamar a Meta. |
| RF-10 | A aba Modelo mostra o problema e desabilita "Salvar modelo" enquanto houver variável incompleta. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Falha ao espelhar no chat nunca muda o status do destinatário nem derruba o lote. |
| RNF-2 | Nada de transação Prisma nem I/O dentro de transação (regra 18 do CLAUDE.md). |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado um contato sem lead no tracking, quando a campanha dispara, então aparece no chat uma conversa nova com a mensagem do template enviada.
- [ ] **CA-2** — Dado um lead que já conversa no tracking, quando a campanha dispara, então a mensagem entra na conversa existente, sem lead duplicado.
- [ ] **CA-3** — Dado o lead gravado sem o 9º dígito e a Meta devolvendo o `wa_id` com 9 (ou o inverso), então a mensagem cai na conversa do lead existente.
- [ ] **CA-4** — Quando o contato lê a mensagem, então o status dela no chat avança (webhook casa pelo `wamid`) e o destinatário da campanha também.
- [ ] **CA-5** — Quando o contato responde, então a resposta entra na mesma conversa da mensagem da campanha.
- [ ] **CA-6** — Dado `{{1}}` como "Texto fixo" vazio, então "Salvar modelo" fica desabilitado com a mensagem do problema.
- [ ] **CA-7** — Dada uma campanha salva antes desta mudança com variável vazia, quando clica Disparar, então recebe erro "Preencha o texto fixo da variável {{1}}." e nada é enviado.
- [ ] **CA-8** — Dado `{{1}}` como "Campo da planilha" e um contato com a coluna vazia, então só esse destinatário fica `FAILED` com o motivo; os outros saem.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Lead existe no tracking com a mesma grafia | Reusa lead e conversa. |
| CB-2 | Lead existe no tracking com a outra grafia do 9º dígito | Encontrado por `waIdLookupVariants`; reusa. |
| CB-3 | Lead existe só em **outro** tracking (audiência via Contatos) | Cria lead novo no tracking da campanha — é nele que a resposta chega. `recipient.leadId` fica como estava. |
| CB-4 | Nenhum lead | Cria (RF-3). |
| CB-5 | Lead sem conversa | Cria a conversa (`upsert` por `leadId_trackingId`). |
| CB-6 | Contato responde durante o lote e o webhook cria o lead antes | `P2002` no create → reusa o lead que o webhook criou. |
| CB-7 | Já existe conversa com o mesmo `remoteJid` presa a outro lead | Não espelha; loga aviso. Envio segue `SENT`. |
| CB-8 | Retry do lote do Inngest com `wamid` já gravado | `upsert` por `messageId` — sem duplicar. |
| CB-9 | Webhook de status chega antes da `Message` existir | Aquele status é perdido para o chat; os seguintes (entregue/lido) atualizam. O destinatário da campanha não é afetado. |
| CB-10 | Template não encontrado na Meta ao carregar o texto | Disparo segue; nenhuma mensagem é espelhada. |
| CB-11 | Tracking sem nenhum status | Não cria lead; loga aviso; envio segue. |
| CB-12 | Lead finalizado (`FINISHED`) | Mensagem gravada e lead reaberto (`ACTIVE`) no servidor — a lista padrão do chat exclui finalizados e o client só reabre conversa que já está no cache. |
| CB-15 | Contato responde entre gravar a mensagem e promovê-la a última da conversa | Promoção condicional: só vira `lastMessage` se a atual for mais antiga (ou não existir). A resposta não é rebaixada. |
| CB-13 | Template com variável no cabeçalho de texto | Fora do escopo: o mapa não cobre o header; a Meta recusa como hoje. |
| CB-14 | "Nome do contato" sem nome e sem valor reserva | Resolve vazio → destinatário `FAILED` (RF-9). |

## 6. Decisões de design

### D-1 — Espelhar dentro do lote do Inngest, depois do `SENT`

- **Escolha**: `recordBroadcastChatMessage` roda logo após gravar o destinatário como `SENT`, com `.catch` próprio.
- **Alternativas descartadas**: evento Inngest separado por mensagem (milhares de eventos por campanha, sem ganho); passar pela `WhatsAppChatProvider` (o `/marketing_messages` não pertence a ela — decisão 13.5 do overview).
- **Consequência**: best-effort. Um erro no espelho não reenvia nem falha o contato.

### D-2 — Lead criado pela campanha não dispara automações de lead novo

- **Escolha**: cria como `start-by-phone` (primeiro status, `ACTIVE`), sem workflow NEW_LEAD, rodízio nem `lead.arrived`.
- **Alternativas descartadas**: reusar `createLeadFromInbound` (dispara tudo isso para cada contato — uma campanha de 5 mil contatos viraria 5 mil execuções de workflow e atribuições); `statusFlow WAITING` (encheria a fila "aguardando atendimento" de gente que não pediu nada).
- **Consequência**: quando o contato responde, o pipeline inbound encontra o lead e segue normal.

### D-3 — Sem `conversation:new` no Pusher

- **Escolha**: só `message:new` (canal da conversa e do tracking).
- **Motivo**: `conversation:new` toca som no client; o `message:new` do tracking já faz a lista buscar a conversa desconhecida.

### D-4 — Validação em três camadas

- Client (UX), `setTemplate` (valor vazio) e `assertBroadcastSendable` (contra o template aprovado) — a última cobre campanhas salvas antes desta mudança. O envio ainda falha por destinatário quando o dado da planilha está vazio.

## 7. Impacto

- [ ] Schema / migration — nenhuma. Usa `Message.metadata` (`{ source: "broadcast", broadcastId, templateName }`).
- [x] Procedures oRPC — `setTemplate` e `send`/`schedule`/`fee` passam a recusar mapa incompleto (mesmo contrato, novo `BAD_REQUEST`).
- [x] Realtime — `message:new` por destinatário enviado.
- [x] Automações (Inngest) — `dispatchBroadcast` ganha o passo `load-template-texts` e o espelho no lote.
- [ ] Env vars novas
- [ ] Breaking change
- [x] Documentação — `docs/campanhas-overview.md` §17.

## 8. Plano de testes

Não há runner de teste no projeto (CLAUDE.md, item 20). Verificação manual:

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1..CA-5 | manual | Campanha de teste com 2 contatos: um sem lead, um com conversa aberta. Conferir chat, status lido e resposta. |
| CA-6 | manual | Aba Modelo com variável vazia. |
| CA-7 | manual | Campanha antiga com mapa vazio → Disparar. |
| CA-8 | manual | CSV com coluna vazia em uma linha. |

## 9. Riscos e rollback

- **Volume**: cada envio faz ~5 queries e 2 chamadas Pusher a mais. Em lotes de 50, aceitável; observar tempo do `send-batch` em campanhas grandes.
- **Leads novos em massa** no primeiro status do tracking — é o pedido, mas muda o board de quem dispara para listas frias. Registrado em D-2.
- **Rollback**: reverter o PR. Sem migration; mensagens e leads já criados permanecem (dados válidos).

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-30 | João Gabriel | Criada |
| 2026-09-30 | João Gabriel | Review do PR #427: CB-12 passa a reabrir o lead no servidor; CB-15 (promoção condicional da última mensagem). |
