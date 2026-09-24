# 0026 — Consultas em código do Astro

**Status**: implementada
**Autor**: Weydson
**Data**: 2026-09-24
**Peso**: leve

## 1. Problema

"Quantos leads temos?" chegava ao orquestrador, consumia **43.141 tokens** e
voltava *"Parece que não tenho acesso aos dados da sua organização"*. O modelo
do nível SMART, diante de ~91 ferramentas, respondia sem chamar nenhuma.

Contar linha em tabela não é trabalho de modelo: é `count()`. A spec 0025
resolveu isso para **ações** (verbos); esta faz o mesmo para **leitura**.

## 2. Decisão

Uma camada determinística no início de `/api/astro/chat`, **antes** de
qualquer modelo. Cada consulta é um par frase→query Prisma, sem classificador.
Casou, responde; não casou, o pedido segue o caminho de sempre (triagem de
ação e, por fim, orquestrador).

- `src/features/astro/queries/types.ts` — contrato e utilitários
- `queries/tracking.ts`, `queries/agenda.ts`, `queries/apps.ts` — as consultas
- `queries/registry.ts` — ordem de teste e `runAstroQuery`

**D-1 — Regex, não classificador.** Um segundo classificador custaria tokens e
erraria: leitura tem vocabulário fixo ("quantos", "quais", "liste"). O custo
desta camada é zero.

**D-2 — Ordem é parte do contrato.** A primeira que casa responde, então a
específica vem antes da genérica: "leads sem responsável" antes de "quantos
leads"; "mensagens hoje" antes de "mensagens não lidas". Medido: sem isso,
`chat.unread` sequestrava `chat.messages_today`.

**D-3 — Ordem nunca vira consulta.** "Crie um lead chamado Ana" não pode casar
com leitura. Testado para as quatro formas de escrita mais comuns.

## 3. Cobertura (17 consultas)

| App | Consultas |
| --- | --- |
| tracking | contagem de leads, lista de funis, leads por etapa, leads sem responsável, tags |
| agenda | agendas, compromissos dos próximos 7 dias, lembretes ativos |
| chat | mensagens de hoje, conversas sem ler |
| forge | propostas por situação |
| form | formulários com respostas |
| workspaces | workspaces, tarefas pendentes e atrasadas |
| payment | a pagar / a receber / vencidos, pago e recebido no mês |
| pages | páginas publicadas e rascunhos |

## 4. Critérios de aceite

- **CA-1** — cada consulta casa a frase que a motivou e devolve texto não vazio
- **CA-2** — nenhuma consulta estoura contra o banco real (campo renomeado
  quebra aqui, não no chat)
- **CA-3** — ordem de escrita não é capturada pela camada de leitura
- **CA-4** — toda consulta no registro tem frase de teste

Verificados por `scripts/verify-astro-queries.ts` — 22 checagens, 0 falhas.

## 5. Fora de escopo

Os relatórios de `/insights` que exigem cálculo (funil com tempo por etapa,
conversão por etapa, tráfego Meta, evolução de campanhas, resgate de leads)
continuam com o orquestrador, que tem 5 ferramentas de insights. As outras 18
procedures seguem sem alcance — assunto de spec própria.

## 6. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-24 | Weydson | Criada e implementada a partir do custo medido: 43.141 tokens para não responder "quantos leads temos" |
