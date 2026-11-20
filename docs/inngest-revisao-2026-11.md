# Revisão das funções do Inngest — 2026-11

Contexto: mais de 50 mil execuções até o dia 11/11. O Inngest cobra **1 execução por run + 1 por step** (`step.run`, `sleep`, `sleepUntil`, `waitForEvent`, `sendEvent`, `invoke`).

## Diagnóstico

Os crons **não** são mais o problema principal: já estão agrupados em 3 tickers (`polling-tickers.ts`), somando cerca de 900 execuções/dia. O grosso vem das funções disparadas **a cada mensagem de WhatsApp**.

Custo de **uma mensagem recebida** hoje (`persistCanonicalInbound` → `firePostInboundAutomations`):

| Evento | Quando | Execuções |
| --- | --- | --- |
| `agent-workflow/message-incoming` | sempre, sem checar nada antes | 2 |
| `lead/metrics.recompute` | sempre, inclusive no eco das mensagens enviadas (debounce de 2 min) | ~1 por rajada |
| `idle/lead-activity` | tracking com ociosidade ligada, sem debounce | 5 |
| `chat/ai.whatsapp-message-received` | IA ligada | 14–18 por resposta |
| `org-defaults/await-reply.check` | tag "Aguardando" ligada, início da espera | 3 |

Resumo: ~3 execuções por mensagem sem IA, ~8 com ociosidade, ~20–25 por resposta da IA.

## Plano de corte (por impacto)

### 1. `agent-trigger-message-incoming` — remover a função
- Hoje roda a cada mensagem e quase sempre encontra 0 fluxos (`agent-workflow-triggers.ts:31-48`).
- O **evento** precisa continuar: ele acorda os fluxos parados em "Esperar resposta" (`waitForEvent`, `functions.ts:146`). Evento sem função não gera execução.
- Correção: a consulta "existe fluxo agente com gatilho MESSAGE_INCOMING?" roda direto no pipeline (é uma query rápida), e só então chama `sendWorkflowExecution`. A função sai.
- Ganho: **-2 por mensagem recebida**. Mesma correção para `agent-trigger-payment-received`, que tem volume baixo.

### 2. Ociosidade (`schedule-idle-checks`) — deduplicar
- 5 execuções por mensagem, e um cliente que manda 5 mensagens deixa 5 checagens dormindo.
- O envio ignora "estado de atendimento" e lead FINISHED, então a função acorda e sai sem fazer nada.
- Correção:
  - a checagem antes do envio já decide o cenário e manda os eventos de checagem direto, sem a função intermediária;
  - `id` do evento = lead + cenário + última mensagem enviada, para deduplicar;
  - `cancelOn` quando a equipe responder.
- Ganho: de 5 por mensagem para ~3 por espera real (**-80% ou mais**).

### 3. Agente de IA do WhatsApp — juntar steps
- `agent.ts:177-654` tem 6 steps seguidos de "quem responde" (check-lead-gate, flow-awaiting, campaign, store-info, guided, topic), todos consultas rápidas.
- Correção:
  - juntar os 6 numa etapa só;
  - juntar charge + knowledge + persist-usage;
  - subir o debounce de 3 s para 8 s, para agrupar mensagens digitadas em sequência.
- Ganho: de 14–18 para ~6–7 por resposta (**-55%**).

### 4. `lead-metrics-recompute` — parar de disparar por mensagem
- Hoje recalcula a cada rajada de mensagens, inclusive as enviadas.
- Correção: tirar o disparo do pipeline de mensagens. As métricas passam a ser recalculadas pelo cron noturno (que já existe) e nos eventos que mudam o lead de verdade (finalizar, agenda, proposta, PIX).
- Ganho: **~-90%** dessa função.
- Precisa confirmar: alguma tela mostra métrica que precisa estar atualizada em minutos?

### 5. Upload de vídeo — remover `nasa-route/on-video-upload-progress`
- Roda 1 vez por pedaço enviado do vídeo, só para repassar o progresso que o navegador já sabe.
- Correção: o progresso passa a ser calculado no navegador. Ganho: **-100%** dessa função.

### 6. Crons fora dos tickers
- `payment-inbox-sync-cron` roda a cada 30 min e abre 1 run por org, mesmo sem e-mail novo (~190/dia por org). Correção: ticker de hora em hora, sem o step `finish` vazio. Ganho: **-75%**.
- `nerp-catalog-remind-sales-approvals` roda a cada 30 min (96/dia). Correção: entra no ticker horário.

### 7. Limpeza (código morto)
- Funções sem ninguém enviando o evento: `agent-trigger-webhook-external`, `astro-agent-trigger`, `auto-agent-on-lead-reply`.
- Eventos enviados para funções desligadas: `user/action.tracked` (`tracking-emitter.ts`) e `auto-agent/session-scheduled`.
- Função de outro app: `dashboard-alert-check` (`*/5 6-22 * * 1-6`, ~450/dia somando o app) não existia neste repositório. Removida pelo time no app de origem em 2026-11-11.
- `detect-chat-timeouts` está comentada no `route.ts`. Se aparece rodando no painel, falta "Resync".

## Status (2026-11-11)

| Corte | Situação |
| --- | --- |
| 1. message-incoming / payment-received | Feito. Busca dos fluxos roda em `agent-trigger-helpers.ts`; funções removidas. O evento segue sendo enviado (acorda WAIT_FOR_EVENT). |
| 2. Ociosidade | Feito. `idle-automation-gate.ts` envia a checagem direto, com `id` de deduplicação por janela de tempo do cenário (mensagens na mesma janela = 1 checagem; quem insiste depois agenda outra); `schedule-idle-checks` removida. |
| 3. Agente de IA | Feito. Etapas: `check-lead-ai` (com transcrição e uso da hora) → `coded-reply` → `prepare-reply` (cobrança por último) → `run-agent` → `deliver-reply` (envio primeiro, resto protegido). Debounce mantido em 3 s. Também com `checkpointing: true` (`chat-ai/whatsapp-agent.ts`): as etapas rodam na mesma chamada, sem o Inngest chamar o app de novo a cada uma — corta a maior parte da demora da resposta. |
| 4. Métricas do lead | Feito. Mensagem não dispara mais; cron da madrugada inclui lead novo sem métricas, não tem mais o limite de 2.000 leads e recalcula de novo (em vez de pular) quem conversou durante o cálculo. Spec 0035 atualizada. |
| 5. Upload de vídeo | Feito. Rota `creator-report-upload-part` e função removidas; progresso vem do store local. |
| 6. Crons de 30 min | Feito. Inbox Gmail e lembrete de aprovações no ticker horário; sync da org sem e-mail novo = 2 execuções. Spec 0018 atualizada. |
| 7. Código morto | Feito em parte: removidas `agent-trigger-webhook-external`, `astro-agent-trigger` e o registro de `auto-agent-on-lead-reply`. **Não** apagados (decisão de produto): funções comentadas no `route.ts` (gamificação, onboarding, booking) e o envio de `user/action.tracked` — eventos sem função não custam execução. `dashboard-alert-check` era de outro app ligado à mesma conta (~450 execuções/dia); removido pelo time em 2026-11-11. |

Depois do deploy: **Resync** no painel do Inngest, para as funções removidas saírem do registro.

## Para não voltar a acontecer
- Regra: evento disparado **por mensagem ou por lead** só sai depois de checar se há algo a fazer (padrão já usado em `dispatchIdleActivityIfActive`).
- Script `pnpm inngest:audit` (em `scripts/`):
  - lista funções, gatilhos e steps;
  - falha no CI se surgir cron fora dos tickers ou função sem quem envie o evento.

## Pendente
Estimativas feitas por leitura de código. Confirmar com o gráfico de execuções por função do painel do Inngest (últimos 7 dias) antes de priorizar.
