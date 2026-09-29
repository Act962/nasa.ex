---
id: 0036
titulo: ASTRO no WhatsApp entende áudio (transcrição)
dominio: astro-bot
status: aprovada
autor: Weydson
criada: 2026-09-26
atualizada: 2026-09-26
branch: feature/W-astro-commander-20260925
pr:
peso: leve
---

# 0036 — ASTRO no WhatsApp entende áudio

## 1. Contexto

O membro vinculado ao ASTRO pelo WhatsApp só conseguia mandar texto, botão, documento ou imagem. Áudio seguia o fluxo comum do CRM e o pedido se perdia — caso F8-WA-03 da bateria (lacuna L6).

## 2. Objetivo

Áudio de número vinculado vira texto (transcrição) e é tratado exatamente como se tivesse sido digitado.

### Não-objetivos

- Transcrever áudio de lead no atendimento (continua como `[audio]`; TODO já registrado em `tracking-chat-ai/PROGRESS.md`).
- Número não vinculado: nada muda (segue o CRM).

## 3. Requisitos

| ID | Requisito |
|---|---|
| RF-1 | Os dois webhooks (Uazapi `AudioMessage`; Meta `audio`) entregam o áudio ao bot como mídia `audio`, só quando o número é vinculado — o portão do bot é o mesmo de hoje. |
| RF-2 | Áudio não depende de `financeEnabled` (diferente de documento/imagem, que alimentam o Financeiro). |
| RF-3 | O bot baixa o áudio pelo provider do funil, transcreve (OpenAI `whisper-1`, pt) e usa o texto no lugar da mensagem: camadas em código, ciclo guiado e orquestrador, como texto digitado. |
| RF-4 | Cobrança por minuto de áudio na ação `astro_bot_transcription` (unidade minuto, mínimo 1). Org isenta (trafeGO) não paga. |
| RF-5 | Falha ao baixar ou transcrever responde "não consegui ouvir o áudio, pode escrever?" — nunca fica mudo. O log do comando guarda `[áudio] <transcrição>`. |

## 4. Critérios de aceite

- [ ] **CA-1** (RF-3, F8-WA-03) — Um áudio dizendo "quantos leads eu tenho" é transcrito e respondido com o mesmo número que o texto teria.
- [ ] **CA-2** (RF-2) — Org sem `financeEnabled` também tem o áudio atendido.
- [ ] **CA-3** (RF-5) — Áudio que não baixa devolve o pedido para escrever.

## 5. Casos de borda

- Áudio longo: limite de 10 minutos; acima, pede para resumir por escrito.
- Sem `OPENAI_API_KEY`: responde o pedido para escrever (RF-5), sem erro.

## 9. Riscos e rollback

O webhook ganha um tipo de mensagem a mais no caminho do bot; qualquer erro do bot já cai no fluxo normal do CRM. Rollback: tirar `audio` das duas condições dos webhooks.
