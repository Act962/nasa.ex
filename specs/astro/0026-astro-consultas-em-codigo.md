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

**D-3 — "Hoje" vale em todos os apps.** Um só leitor de recorte (`periodFrom`)
serve a todas as consultas: hoje, amanhã, ontem, esta semana, este mês. Ele
devolve `since`/`until` para o que já aconteceu e `futureUntil` para o que
vem — "esta semana" são os 7 dias passados em criação e os 7 próximos em
compromisso, e tratar os dois como um só dava resposta errada sem erro.

**D-4 — A frase seguinte herda o assunto.** "Me manda a lista deles", logo
após "quantos leads hoje", devolve os leads de hoje. A referência só resolve
com histórico: sem ele, o pedido segue para o orquestrador em vez de listar
qualquer coisa.

**D-5 — Ordem nunca vira consulta.** "Crie um lead chamado Ana" não pode casar
com leitura. Testado para as quatro formas de escrita mais comuns.

## 3. Cobertura (27 consultas)

| App | Consultas |
| --- | --- |
| tracking | contagem de leads, leads criados num período, lista de leads, lista de funis, leads por etapa, leads sem responsável, tags |
| agenda | agendas, compromissos dos próximos 7 dias, lembretes ativos |
| chat | mensagens de hoje, conversas sem ler |
| forge | propostas por situação |
| form | formulários com respostas |
| workspaces | workspaces, tarefas pendentes e atrasadas |
| payment | a pagar / a receber / vencidos, pago e recebido no mês |
| pages | páginas publicadas e rascunhos |
| insights | funil com tempo e queda por etapa, ganhos × perdidos com motivos, vendido no mês contra o anterior, canais de aquisição com conversão, leads por responsável, leads por tag |

## 4. Critérios de aceite

- **CA-1** — cada consulta casa a frase que a motivou e devolve texto não vazio
- **CA-2** — nenhuma consulta estoura contra o banco real (campo renomeado
  quebra aqui, não no chat)
- **CA-3** — ordem de escrita não é capturada pela camada de leitura
- **CA-4** — toda consulta no registro tem frase de teste
- **CA-5** — "a lista deles" herda o recorte do turno anterior e, sem histórico, não responde
- **CA-6** — "hoje" é respeitado por todos os apps, e a resposta diz o recorte que aplicou

Verificados por `scripts/verify-astro-queries.ts` — 35 checagens, 0 falhas.

## 4b. WhatsApp

As mesmas camadas valem no WhatsApp desde 2026-09-24. `astro-bot/router.ts`
chamava `streamAstro` direto: "Quantos leads temos?" ia ao modelo caro e
voltava *"Não consegui montar uma resposta pra isso"*.

A decisão saiu de `run-classified-action.ts` para `resolve-action.ts`, que não
conhece formato de saída. O chat embrulha em stream com cartões; o WhatsApp
traduz para texto (`astro-bot/lib/cheap-layers.ts`): tabela vira lista com
marcadores, escolha vira lista numerada, confirmação continua por "SIM".

Mensagem com anexo não passa por aqui — ler boleto é trabalho de modelo.

**Botões (2026-09-24).** A escolha vira botão de verdade quando o provider é
Uazapi (`sendButtons`), e o clique volta como `ButtonsResponseMessage` — o
webhook passou a aceitar esse tipo para o bot, senão o menu aparecia e o toque
não chegava a lugar nenhum, pior do que não ter botão. O rótulo clicado é o
próprio texto da opção, então o ciclo guiado o recebe como qualquer resposta,
sem mapa de ids. Provider sem menu (Meta) degrada para lista numerada.

**"SIM" é barato.** Confirmar ia ao orquestrador só para ele chamar uma
ferramenta que a camada pode chamar direto. Agora executa a proposta pendente
em código, com botões SIM/NÃO.

## 5. Fora de escopo

Seis relatórios de `/insights` entraram (2026-09-24), reusando os mesmos
`compute*` das procedures da tela — o cálculo não é reescrito, porque número
do Astro que não bate com o dashboard é pior que número nenhum.

Continuam fora: tráfego Meta, evolução de campanhas, resgate de leads,
conversão por etapa com filtro de tag, relatórios de workspace e a leitura de
relatórios salvos. Seguem com o orquestrador.

## 6. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-24 | Weydson | **Recorte de tempo era só do tracking**: "quantas propostas hoje", "quanto recebi hoje" e "compromissos hoje" ignoravam o "hoje" — o de compromissos devolvia a semana inteira. `periodFrom` passou a servir os 9 apps, e a resposta agora declara o recorte aplicado |
| 2026-09-24 | Weydson | Lista de leads e recorte por período acrescentados: "quantos leads criados hoje" era respondido pelo orquestrador com o total, e "me manda a lista deles" voltava "não tenho acesso" |
| 2026-09-24 | Weydson | Criada e implementada a partir do custo medido: 43.141 tokens para não responder "quantos leads temos" |
