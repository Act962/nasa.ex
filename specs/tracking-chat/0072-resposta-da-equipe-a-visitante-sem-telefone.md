---
id: 0072
titulo: Equipe responde pelo Chat a visitante do ASTRO CHAT sem telefone
dominio: tracking-chat
status: em-revisao
autor: Weydson
criada: 2026-10-06
atualizada: 2026-10-06
branch: feature/W-tracking-chat-fix-resposta-astro-chat-20261006
pr:
peso: leve
---

# 0072 — Equipe responde pelo Chat a visitante do ASTRO CHAT sem telefone

Baseline do domínio: [0003](0003-tracking-chat-baseline.md). Canal de origem: [0031](../astro/0031-astro-chat-widget-no-site.md).

## 1. Contexto

O ASTRO CHAT (spec 0031) cria um lead anônimo — "Visitante do site #XXXX" — na primeira mensagem do visitante. Esse lead **não tem telefone** até o visitante informar um e o ASTRO chamar `save_contact`.

A 0031 promete, no RF-10, que "a resposta da equipe chega ao visitante". Hoje não chega para quem não deu telefone. Quando o visitante pede uma pessoa, o ASTRO transfere (`transfer_to_human`) e sai da conversa. A equipe abre a conversa no Chat, escreve a resposta e recebe **"Erro ao enviar mensagem"**. Nada é gravado, e o visitante fica esperando no widget do site por uma resposta que nunca chega.

Evidência (produção, 2026-10-06, org ORBITA HUB, conversa `cmux8rq3u00ey01lhx3fp5bo2`, site orbitatec.com.br):

- `POST /api/rpc/message/create` → **400** nas duas tentativas da equipe;
- `GET /api/astro-chat/<key>/messages` do visitante devolve 7 mensagens, nenhuma com `author: "team"`;
- a conversa, recarregada, termina na última mensagem do visitante.

Causa: `message.create` declara `leadPhone: z.string()`. O composer manda `leadPhone: lead.phone!`, que para esse lead é `null`. A validação de entrada recusa antes de o handler rodar — e o handler nem usaria o telefone: para lead `ASTRO_CHAT`, `shouldSkipUazapiForConversation` devolve `true` e a mensagem só é gravada (`viaInChat: true`).

O mesmo erro 400 também é a resposta de "saldo de ★ insuficiente" (`chargeMessageOutbound`). O corpo da resposta não foi capturado, então essa segunda causa não está descartada para o caso observado; ela é independente desta spec e continua valendo.

## 2. Objetivo

A equipe consegue responder em texto, pelo Chat, a qualquer conversa In-Chat — inclusive a de um lead sem telefone — e a resposta aparece para o visitante.

### Não-objetivos

- Áudio, imagem, arquivo, vídeo, localização, contato e botões para lead sem telefone. O widget do ASTRO CHAT só mostra texto (`toPublicMessage` entrega `body`); esses envios continuam exigindo telefone.
- Mudar a cobrança de ★ da mensagem de saída.
- Mudar quando o ASTRO volta a responder depois que a equipe assume (`HUMAN_TAKEOVER_SILENCE_MS`, spec 0031).

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | `message.create` aceita `leadPhone` ausente ou nulo. |
| RF-2 | Em conversa In-Chat (`shouldSkipUazapiForConversation` ou pedido do catálogo), a mensagem é gravada e publicada mesmo sem telefone. |
| RF-3 | Fora do In-Chat (WhatsApp por provedor, Instagram, Facebook), `leadPhone` nulo ou ausente é recusado com `BAD_REQUEST` e `data.code = "LEAD_WITHOUT_PHONE"`, **antes** de resolver provedor e de cobrar ★. É o mesmo conjunto que o schema antigo recusava — só muda a mensagem. |
| RF-4 | O composer de texto envia `lead.phone` como está, sem forçar não-nulo. |
| RF-5 | O Chat mostra "Lead sem telefone" (com o que fazer) para `LEAD_WITHOUT_PHONE`, em vez do genérico. |

### Não-funcionais

- Nenhuma mudança de schema, nenhuma migration.
- Clientes antigos, que mandam `leadPhone` como string, continuam funcionando sem alteração.

## 4. Critérios de aceite

- [ ] **CA-1** — Visitante do ASTRO CHAT sem telefone pede uma pessoa; a equipe responde em texto pelo Chat; a mensagem é gravada, aparece na conversa e chega ao widget do site como resposta da equipe.
- [ ] **CA-2** — Lead com telefone em conversa de WhatsApp: o envio continua igual ao de antes (mesmo provedor, mesma cobrança).
- [ ] **CA-3** — Lead **sem** telefone em conversa de WhatsApp que não é In-Chat: o envio é recusado com "Lead sem telefone", nada é gravado e nenhuma ★ é cobrada.
- [ ] **CA-4** — Lead `IN_CHAT` (página pública) e pedido do catálogo: resposta em texto continua funcionando.

## 5. Casos de borda

| Situação | Comportamento |
| --- | --- |
| Lead `ASTRO_CHAT` sem telefone | grava e publica (In-Chat) — **era 400** |
| Lead `ASTRO_CHAT` que já informou telefone | grava e publica (In-Chat); o telefone não é usado para envio |
| Lead de WhatsApp sem telefone, instância normal | `LEAD_WITHOUT_PHONE`, sem cobrança |
| Lead de WhatsApp sem telefone, instância em In-Chat (banida/manual) | grava e publica: é In-Chat |
| Conversa Instagram/Facebook sem `leadPhone` | `LEAD_WITHOUT_PHONE` — nesses canais o campo carrega o id do destinatário |
| `leadPhone` como string vazia `""` | igual a antes: passa pela validação e segue para o canal. Só nulo/ausente mudou de tratamento |
| Saldo de ★ insuficiente | continua `BAD_REQUEST` de `chargeMessageOutbound`, depois da checagem do telefone |

## 9. Riscos e rollback

- **Risco**: mudar o que é aceito fora do In-Chat. Não muda: lá, nulo/ausente já era recusado pela validação de entrada e continua sendo, agora com mensagem própria e antes da cobrança; string (inclusive vazia) segue como sempre.
- **Risco**: os outros envios (áudio, imagem, arquivo…) continuam com `lead.phone!` e falham para visitante sem telefone. Fica fora do escopo por não aparecerem no widget; se o ASTRO CHAT passar a mostrar mídia, vira spec própria.
- **Rollback**: reverter o commit. Sem schema, sem dado migrado.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-06 | Weydson | Criada a partir do teste em produção do ASTRO CHAT no site orbitatec.com.br |
