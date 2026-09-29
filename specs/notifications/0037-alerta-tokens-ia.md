---
id: 0037
titulo: Alertar crédito de IA esgotado e consumo alto de tokens
dominio: notifications
status: implementada
autor: Weydson
criada: 2026-09-27
atualizada: 2026-09-27
branch: feature/W-astro-commander-20260925
pr:
peso: leve
---

# 0037 — Alertar crédito de IA esgotado e consumo alto de tokens

## 1. Contexto

O tipo `AI_TOKEN_ALERT` existe (ícone no sino, preferência, fala do ASTRO), mas nada o
dispara. Quando o crédito no provedor de IA acaba, cada tela descobre sozinha: o ASTRO
mostra "sem crédito no provedor", o Workflow marca o passo com erro, a IA do WhatsApp
para de responder — e ninguém é avisado.

Não existe saldo de tokens por organização: a IA é cobrada em Stars (que já têm alerta),
e o crédito que acaba de verdade é o da conta no provedor, que a OpenAI não expõe por
API. Medido em 2026-09-27 (`usage_event`, 14 dias): o maior consumo diário de uma org foi
1,29 milhão de tokens; o normal fica abaixo de 600 mil.

## 2. Objetivo

Quem pode resolver fica sabendo quando a IA ficou sem crédito, e é avisado antes quando
o consumo do dia está alto.

### Não-objetivos

- Ler o saldo do provedor (não há API para isso).
- Limite por organização configurável na tela — o limite é global, por variável de ambiente.
- Instrumentar todas as 27 chamadas de IA: entram as superfícies principais (RF-3).

## 3. Requisitos

| ID | Requisito |
|---|---|
| RF-1 | Recusa do provedor por crédito (`insufficient_quota`, `credit_balance_too_low`, `RESOURCE_EXHAUSTED`, cota excedida) abre **alerta crítico** (popup com "Entendi"), com a org no cabeçalho. |
| RF-2 | Destino depende da chave: chave de IA **própria da org** → admins/owners da org; **chave da plataforma** → administradores do sistema (`User.isSystemAdmin`). O cliente não recarrega a conta da plataforma. |
| RF-3 | RF-1 cobre o ASTRO (widget), a IA do WhatsApp (tracking-chat-ai) e os agentes de IA dos Workflows. |
| RF-4 | Consumo de tokens de IA da org no dia (fuso São Paulo, `usage_event` kind `LLM`) acima do limite abre **aviso** (warning). Verificação de hora em hora. Limite padrão 1.000.000 de tokens; `AI_TOKEN_DAILY_ALERT_TOKENS` sobrescreve. |
| RF-5 | Destino do RF-4 segue o RF-2, separado por tipo de chave (o consumo com chave própria e o com chave da plataforma são somados à parte). |
| RNF-1 | Sem avalanche: RF-1 no máximo uma vez a cada 24 h por org e tipo de chave; RF-4 uma vez por dia por org e tipo de chave. |
| RNF-2 | Falha ao alertar nunca derruba a resposta de IA que já falhou (best-effort, fora de transação). |

## 4. Critérios de aceite

- [ ] **CA-1** — Erro de cota no ASTRO com chave da plataforma cria um alerta crítico para o administrador do sistema, com a org no cabeçalho; o segundo erro nas 24 h seguintes não cria outro.
- [ ] **CA-2** — Erro de cota com chave própria alerta os admins da org, não o administrador do sistema.
- [ ] **CA-3** — Org acima do limite diário recebe um aviso; a rodada seguinte da mesma hora/dia não repete.

## 5. Decisões

- **D-1 — Dois gatilhos** (decisão do usuário, 2026-09-27): aviso de consumo alto antes, alerta crítico quando acabar.
- **D-2 — Destino pela chave** (decisão do usuário, 2026-09-27): ver RF-2.
- **D-3 — Limite global de 1 milhão/dia**: acima do maior dia medido de uso normal; ajustável sem deploy de código.

## 9. Changelog

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-27 | Weydson | Criada e implementada a partir do pedido "incluir um alerta desses para tokens baixos da IA". |
