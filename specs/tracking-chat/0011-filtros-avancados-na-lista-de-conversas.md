---
id: 0011
titulo: Filtros avançados e ordenação na lista de conversas do chat
dominio: tracking-chat
status: implementada
autor: João Gabriel
criada: 2026-09-03
atualizada: 2026-09-03
branch: claude/tracking-chat-update-49409d
pr:
peso: completa
---

# 0011 — Filtros avançados e ordenação na lista de conversas do chat

---

## 1. Contexto

A sidebar do `/tracking-chat` hoje oferece cinco filtros: canal, "Finalizados",
"Em atendimento", "Favoritas", "Arquivados" e "Etiquetas". O board do tracking,
em contraste, tem um painel completo — Participantes, Projetos/Clientes, Tags,
Temperatura, Status, Ativos, Calendário e Ordenar.

Quem atende no chat não consegue responder perguntas que o board responde: "quais
conversas são minhas?", "quais leads quentes estão parados?", "quem entrou nessa
etapa primeiro?". A lista sempre vem ordenada pela última mensagem, sem alternativa.

O pedido é trazer para o chat os mesmos filtros: **Responsável**, **Tags**,
**Temperatura**, **Status** e **Ordenar**.

### O que já existe

Duas coisas da lista pedida já estão no chat, e reconhecê-las evita trabalho
duplicado:

| Pedido | Situação real |
| --- | --- |
| Tags (mais de uma) | **Pronto.** O dropdown "Etiquetas" já é multi-select (`selectedTagIds: string[]`), filtrando por `tagId`. |
| Status | **Parcial.** Os pills "Finalizados" e "Em atendimento" já filtram `statusFlow` — o mesmo campo do filtro "Status" do board, mas single-select e sem "Novo lead"/"Aguardando". |

### O problema escondido: a paginação atual não suporta ordenação

[`conversation/list.ts`](../../src/app/router/conversation/list.ts) pagina assim:

```ts
orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
cursor: { id: input.cursor }, skip: 1,
```

Cursor por `id` com ordenação por outra coluna só funciona por acidente:
`lastMessageAt` é `@updatedAt` e praticamente nunca empata, então o "pular 1 a
partir deste id" cai sempre no lugar certo.

Isso deixa de valer no instante em que se ordena por **data de entrada na etapa**
ou **data de chegada**: leads criados no mesmo import ou no mesmo segundo empatam
com frequência, e o scroll infinito passa a **repetir e omitir conversas**. Não é
um risco teórico — é o comportamento garantido de cursor por id sobre ordenação
não-única.

O board não sofre disso porque
[`leads/get-many.ts`](../../src/app/router/leads/get-many.ts) usa keyset real
(`cursorId` + `cursorValue`, com cláusula `OR` de desempate). O chat precisa da
mesma migração **antes** de ganhar ordenação.

## 2. Objetivo

O atendente filtra a lista de conversas pelos mesmos critérios do board
(responsável, tags, temperatura, status) e escolhe a ordenação, com o scroll
infinito devolvendo cada conversa exatamente uma vez em qualquer ordenação.

### Não-objetivos

- **Refazer o filtro de Tags.** Já funciona e é multi-select. Continua em
  `useState` com `tagId`, enquanto os filtros novos vão para a URL — divergência
  deliberada (ver D-3), registrada como follow-up.
- **Projetos/Clientes, Ativos (Ganhos/Perdidos) e Calendário.** Existem no board e
  não foram pedidos. Ficam de fora; a estrutura criada aqui aceita cada um deles
  como um controle a mais no painel, sem redesenho.
- **Índice novo em `Lead.statusEnteredAt`.** Ver RNF-2 e §9 — decisão adiada até
  haver medição, não suposição.
- **Persistir filtro por usuário no banco.** O estado vive na URL; F5 preserva,
  troca de máquina não.
- **Mudar o default da lista.** Sem filtro e sem ordenação escolhida, a lista sai
  exatamente como sai hoje.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Filtro **Responsável**: seleção única, por `Lead.responsible.email`, alimentado por `tracking.listParticipants` — mesma fonte e mesma semântica do board. |
| RF-2 | Filtro **Temperatura**: multi-select sobre `Lead.temperature` (`COLD`, `WARM`, `HOT`, `VERY_HOT`). |
| RF-3 | Filtro **Status**: multi-select sobre `Lead.statusFlow` (`NEW`, `ACTIVE`, `WAITING`, `FINISHED`). |
| RF-4 | Os pills "Finalizados" e "Em atendimento" passam a ser **atalhos do mesmo estado** do filtro Status: clicar no pill marca/desmarca o valor correspondente, e o pill reflete a seleção feita no painel. Uma única fonte de verdade. |
| RF-5 | Sem nenhum status selecionado, o servidor mantém o comportamento atual: esconde `FINISHED` (`statusFlow: { not: "FINISHED" }`). |
| RF-6 | **Ordenar** por: Data de interação (`Conversation.lastMessageAt`), Data de entrada na etapa (`Lead.statusEnteredAt`), Data de chegada (`Lead.createdAt`). |
| RF-7 | Cada ordenação aceita **direção** ascendente ou descendente ("do mais antigo para o mais novo" e o inverso). |
| RF-8 | Default sem escolha explícita: Data de interação, descendente — idêntico ao de hoje. |
| RF-9 | Os filtros novos são combináveis entre si e com os existentes (canal, favoritas, arquivados, etiquetas, busca). |
| RF-10 | A paginação migra para keyset (`cursorId` + `cursorValue` → `nextCursorId` + `nextCursorValue`), correta para todas as ordenações de RF-6/RF-7. |
| RF-11 | O painel exibe a contagem de filtros ativos e permite limpar todos de uma vez. |
| RF-12 | Os filtros novos funcionam em desktop (sidebar) e mobile (`tracking-chat-bottom-tabs`). |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Nenhuma conversa duplicada nem omitida ao paginar, em qualquer combinação de ordenação e direção (é o critério que motiva RF-10). |
| RNF-2 | As ordenações por `lastMessageAt` e `Lead.createdAt` usam colunas indexadas. `Lead.statusEnteredAt` **não tem índice** — aceito nesta entrega, medido antes de virar migration (§9). **Medido em 2026-09-03** sobre 3.257 conversas reais: 7ms/página em `lastMessageAt`, 22ms em `statusEnteredAt`, 30-35ms em `leadCreatedAt`. O índice ausente não é o gargalo — quem custa é o `orderBy` por relação, e `leadCreatedAt` é o mais lento apesar de indexado. Índice descartado. |
| RNF-3 | Sem filtro e sem ordenação escolhida, a query emitida é equivalente à de hoje — nenhuma regressão de latência no caminho padrão. |
| RNF-4 | Os três callers de `conversation.list` continuam funcionando (dois paginam e migram junto; um não pagina). |

## 4. Critérios de aceite

- [x] **CA-1** — Dado um tracking com leads de responsáveis diferentes, quando seleciono um responsável, então a lista mostra apenas conversas cujo lead tem aquele responsável.
- [x] **CA-2** — Dado leads com temperaturas variadas, quando seleciono "Quente" e "Muito Quente", então a lista mostra apenas conversas nessas duas temperaturas.
- [x] **CA-3** — Dado que marco "Finalizado" no painel Status, então o pill "Finalizados" aparece ativo; e desmarcar o pill remove `FINISHED` do painel (RF-4, nos dois sentidos).
- [x] **CA-4** — Dado nenhum status selecionado, então conversas de leads `FINISHED` não aparecem — igual a hoje (RF-5).
- [x] **CA-5** — Dado 60+ conversas e ordenação "Data de chegada" ascendente, quando rolo até o fim carregando todas as páginas, então nenhuma conversa aparece duas vezes e nenhuma some (comparar o conjunto de ids com a consulta sem paginação).
- [x] **CA-6** — Dado 3 leads com `createdAt` idêntico ao segundo, quando pagino com limite que corta exatamente no meio do empate, então os 3 aparecem, uma vez cada.
- [x] **CA-7** — Dado que não escolhi ordenação, então a lista sai por última mensagem, mais recente primeiro (RF-8).
- [x] **CA-8** — Dado filtros de responsável + temperatura + status + etiqueta ativos ao mesmo tempo, então a lista respeita a interseção de todos (RF-9).
- [ ] **CA-9** — Dado o diálogo "Encaminhar mensagem", quando rolo a lista de destinos, então ela continua paginando corretamente após a migração de cursor (RNF-4).
- [x] **CA-10** — Dado filtros ativos, quando recarrego a página (F5), então os filtros continuam aplicados (estado na URL).

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Lead sem responsável (`responsibleId = null`) | Não aparece quando há filtro de responsável ativo. Sem filtro, aparece normalmente. |
| CB-2 | `Lead.statusEnteredAt = null` (leads legados, anteriores ao campo) | Ordenados **por último** em ambas as direções, com desempate por `id`. A paginação trata a transição não-nulo → nulo explicitamente (D-2) — é exatamente onde o keyset ingênuo do board erra. |
| CB-3 | Ordenação por `statusEnteredAt` com **todos** os leads nulos | Vira ordenação por `id`, estável e sem duplicatas. |
| CB-4 | Filtro "Arquivados" ativo junto com os novos | `archivedOnly` continua ortogonal: mostra só arquivados, e os demais filtros se aplicam dentro desse conjunto. Comportamento atual preservado. |
| CB-5 | Busca textual ativa junto com os novos filtros | Busca continua liberando arquivados (comportamento atual) e os novos filtros se aplicam por cima. |
| CB-6 | `trackingId` ausente/nulo na sidebar | Painel abre com Responsável desabilitado e a mensagem "Selecione um tracking" — mesmo padrão que o dropdown de etiquetas já usa. |
| CB-7 | Usuário vem do board com `?participant=` ou `?temperature=` na URL | O chat **aplica** o mesmo filtro. É consequência aceita de compartilhar as chaves nuqs (D-3); o painel mostra a contagem ativa, então o estado é visível e limpável. |
| CB-8 | Valor inválido na URL (`?temperature=BANANA`) | Zod rejeita no input da procedure. O cliente sanitiza contra a lista conhecida antes de enviar, para não derrubar a lista inteira por causa de uma URL editada à mão. |
| CB-9 | Todos os 4 status selecionados | Equivale a "sem filtro de status", **exceto** que `FINISHED` passa a aparecer (o default esconde). É a única forma de ver finalizados junto com os demais. |
| CB-10 | Conversa recebe mensagem nova (Pusher) enquanto ordenação ≠ "Data de interação" | O realtime só move a conversa para o topo na ordenação default. Nas demais ela é atualizada **no lugar** — o que é correto em `statusEnteredAt` e `leadCreatedAt`, porque a mensagem não altera o campo ordenado. Em `lastMessageAt` **ascendente** a mensagem altera a própria chave, então ali o handler invalida a query para o servidor reposicionar (`newMessageChangesSortKey`). |
| CB-10b | Conversa **nova** (`conversation:new`) chega com filtro ativo ou ordenação não-default | O payload do Pusher não carrega o lead, então não dá para decidir no cliente se a conversa pertence à lista nem onde ela entra. Com qualquer estreitamento ativo (ou fora da ordenação default), o handler invalida em vez de inserir no topo (`listHasNarrowingFilters`). Sem filtro e na ordenação default, o caminho otimista de hoje é preservado. |
| CB-11 | Filtro ativo que zera o resultado | Estado vazio da lista com CTA "Limpar filtros" (RF-11), não a tela de "nenhuma conversa" genérica, que faria o atendente achar que perdeu dados. |
| CB-12 | Dois filtros mutuamente excludentes (ex.: status `FINISHED` + pill exclusivo) | Não existe mais essa combinação: RF-4 unificou a fonte de verdade. |

## 6. Decisões de design

### D-1 — Ordenação e paginação por keyset, com a `Conversation` como raiz

- **Escolha**: manter `Conversation` como modelo raiz da query e ordenar por campos do `Lead` via `orderBy: { lead: { ... } }`, paginando por keyset (`cursorId` + `cursorValue`).
- **Alternativas descartadas**:
  - *Manter `cursor: { id }` + `skip: 1`*: quebra com empates, que é a regra e não a exceção em `createdAt`/`statusEnteredAt`.
  - *Inverter a raiz para `Lead`* (todos os filtros e ordenações viram colunas próprias, indexadas): tornaria a ordenação **default** — `lastMessageAt`, a mais usada — uma ordenação por relação, penalizando o caminho quente para beneficiar os raros.
  - *`OFFSET`*: mais simples, mas sofre drift quando chega mensagem durante a rolagem, que é o caso normal de um chat.
- **Consequência**: uma função `buildOrderBy` e uma `buildCursorWhere`, espelhando `leads/get-many.ts`. O contrato de cursor muda e os dois callers que paginam migram junto (RNF-4).

### D-2 — Nulos de `statusEnteredAt` tratados explicitamente no cursor

- **Escolha**: ordenar com nulos sempre por último e o cursor carregar um marcador de "estou na faixa dos nulos", alternando a cláusula de comparação.
- **Alternativa descartada**: o que `leads/get-many.ts` faz hoje — usar `statusEnteredAt ?? createdAt` como `cursorValue`. Compara duas colunas diferentes: o cursor sai da faixa correta e a paginação pula ou repete registros. Não é um bug reportado no board porque lá a query é filtrada por `statusId`, o que reduz muito a chance de a página cortar dentro da faixa nula — mas o defeito está lá.
- **Consequência**: ~10 linhas a mais no `buildCursorWhere`, e o board fica com um bug conhecido que esta spec **não** corrige (fora do escopo; anotado como follow-up).

### D-3 — Filtros novos na URL (nuqs), Tags fica onde está

- **Escolha**: Responsável, Temperatura, Status e Ordenação vivem na URL via `nuqs`, reaproveitando as chaves e os componentes do board (`participant`, `temperature`, `status_flow`). Tags continua em `useState` com `tagId`.
- **Alternativas descartadas**:
  - *Tudo em `useState`*: obrigaria a reescrever quatro componentes que já existem, só para não usar a URL.
  - *Migrar Tags junto para a URL*: o board indexa tags por `slug` e o chat por `id`; unificar exigiria mexer no filtro de etiquetas, que hoje funciona, e no input da procedure — risco desproporcional para ganho estético.
- **Consequência**: `TemperatureFilter` e `StatusFlowFilter` são reaproveitados sem alteração; `ParticipantsSwitcher` ganha uma prop opcional `trackingId` (hoje lê `useParams`, que no `/tracking-chat` não tem o parâmetro). Filtro aplicado no board acompanha o usuário até o chat (CB-7). Convergência de Tags fica como follow-up.

### D-4 — "Data de interação" é a última mensagem, não `Lead.updatedAt`

- **Escolha**: `Conversation.lastMessageAt`.
- **Alternativa descartada**: `Lead.updatedAt`, que é o que o board usa. Num board, "interação" é qualquer edição do lead; num chat, é mensagem.
- **Consequência**: mantém o default de hoje (zero regressão, RNF-3) e usa coluna indexada. Board e chat divergem de propósito nesse rótulo.

### D-5 — Ordenação ganha direção, que o board não tem

- **Escolha**: cada critério aceita asc/desc, como pedido ("do mais antigo para o mais novo").
- **Consequência**: `SorterLead` do board **não** é reaproveitado (só tem os 4 critérios, sem direção, e guarda estado no `useKanbanStore`). O chat tem componente próprio, com a direção na URL.

## 7. Impacto

- [ ] Schema / migration — nenhuma nesta entrega (índice adiado, §9)
- [x] Procedures oRPC — `conversation.list` ganha entradas e **muda o contrato de cursor** (breaking para quem pagina; os dois callers migram no mesmo PR)
- [x] Realtime (Pusher) — o handler de `message:new` reordena a lista; passa a fazê-lo só na ordenação default (CB-10)
- [ ] Automações (Inngest)
- [ ] Env vars novas
- [x] Breaking change para clientes existentes — interno: `cursor`/`nextCursor` → `cursorId`/`cursorValue`. Nenhum consumidor externo.
- [ ] Documentação obrigatória (CLAUDE.md itens 10 / 14 / 16) — não se aplica

Arquivos previstos:

| Arquivo | Mudança |
| --- | --- |
| `src/app/router/conversation/list.ts` | Entradas novas, `buildOrderBy`/`buildCursorWhere`, keyset |
| `src/features/tracking-chat/components/conversation-filters.tsx` | Painel (Sheet) com os filtros novos; pills ligados ao estado unificado |
| `src/features/tracking-chat/components/conversation-sorter.tsx` | **Novo** — critério + direção |
| `src/features/tracking-chat/components/conversations-list.tsx` | Lê nuqs, repassa à query, migra cursor |
| `src/features/tracking-chat/components/tracking-chat-bottom-tabs.tsx` | Paridade mobile |
| `src/features/tracking-chat/hooks/use-conversation.ts` | Migra cursor do diálogo de encaminhar; realtime respeita ordenação |
| `src/features/trackings/components/filters/participant-switcher.tsx` | Prop opcional `trackingId` |

## 8. Plano de testes

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1, CA-2, CA-8 | manual | Aplicar cada filtro na sidebar e conferir contra o board com o mesmo filtro |
| CA-3, CA-4, CB-9 | manual | Alternar pill e painel nos dois sentidos; verificar que finalizados só aparecem quando marcados |
| CA-5, CA-6, RNF-1 | automatizado (script) | Script que pagina até o fim em cada combinação de ordenação/direção e compara o conjunto de ids com a query sem paginação — sem duplicata, sem faltante. É a verificação que justifica RF-10 |
| CB-2, CB-3 | automatizado (script) | Semear leads com `statusEnteredAt` nulo e não-nulo misturados, paginar com limite que corta dentro da faixa nula |
| CA-7, RNF-3 | manual | Abrir o chat sem tocar em nada e conferir ordem idêntica à de hoje |
| CA-9 | manual | Abrir "Encaminhar mensagem" e rolar a lista de destinos |
| CA-10, CB-7, CB-8 | manual | F5 com filtros ativos; editar a URL à mão com valor inválido |

> O projeto não tem runner de teste instalado (CLAUDE.md item 20), então os itens
> "automatizado" são scripts `tsx` executados contra o banco local e descartados,
> como feito na [spec 0010](0010-telefone-br-e-erros-outbound-estruturados.md).

## 9. Riscos e rollback

**Risco 1 — a migração de cursor é a parte perigosa.** Ela toca o caminho mais
quente do chat (carregar a lista) e um erro aqui aparece como conversa sumindo,
que o atendente lê como perda de dado. Mitigação: CA-5/CA-6 comparam o conjunto
de ids paginado contra a query sem paginação, em todas as combinações; e o
caminho default é mantido byte a byte equivalente ao de hoje (RNF-3).

**Risco 2 — `Lead.statusEnteredAt` sem índice.** ~~Medir antes de decidir.~~
**Medido e descartado em 2026-09-03.** Sobre o tracking real de 3.257 conversas
(2.446 delas com `statusEnteredAt` nulo): 22ms por página, contra 7ms na
ordenação default. `leadCreatedAt`, que **tem** índice, ficou em 30-35ms — mais
lento que o campo sem índice. O custo está no `orderBy` por relação
(join + sort), não na ausência do índice, então a migration não traria ganho e
cobraria escrita em toda atualização de lead. Não será feita.

**Risco 3 — compartilhar chaves nuqs com o board** faz filtro vazar de uma tela
para a outra (CB-7). Foi decisão explícita do dono; o mitigador é a contagem de
filtros ativos visível e o "Limpar filtros" (RF-11).

**Rollback**: sem migration e sem estado persistido. Reverter os commits basta —
os filtros somem e a lista volta ao cursor antigo. Como o contrato de cursor
muda, o rollback precisa ser **do conjunto**: reverter só o servidor deixaria os
dois callers migrados falando um contrato que não existe mais.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-03 | João Gabriel | Criada. Decisões D-3 (nuqs), D-4 (interação = última mensagem) e RF-4 (pills como atalho) definidas pelo dono antes da escrita |
| 2026-09-03 | João Gabriel | **Painel virou Popover ancorado no botão**, a pedido do dono — o Sheet lateral destoava do resto da UI. `modal={false}` é obrigatório aqui, não estético: cada controle interno abre o próprio popover/dropdown, e o modo modal prenderia o foco no painel. Verificados os dois tipos de aninhamento, que é onde o Radix costuma fechar o pai ao clicar no filho: Popover-em-Popover (Temperatura, Status) e DropdownMenu-em-Popover (Participantes, Ordenar) — nos dois casos o painel externo permanece aberto e a seleção aplica. Efeito colateral conhecido: com o painel compacto, o popover filho cobre os controles abaixo dele enquanto está aberto (no Sheet sobrava altura). É comportamento padrão de menu em cascata, mantido |
| 2026-09-03 | João Gabriel | **Verificação de UI em harness isolado.** Página temporária (sem auth, criada e apagada na sessão) exercitou o que não depende de login: CA-3 nos dois sentidos (pill marca o painel e o painel desmarca o pill, com `status_flow` saindo da URL em vez de ficar vazio), CA-7 (default `lastMessageAt`/`desc` sem sujar a URL), CA-10 (F5 preserva temperatura + ordenação + direção), CB-8 (`?temperature=BANANA,HOT&status_flow=XXX,ACTIVE&sort=inexistente` → sobra `HOT`/`ACTIVE` e o sort cai no default, sem erro) e RF-11 (limpar zera tudo). Layout mobile (375px) renderiza; **abrir o painel nessa largura não foi exercitado** — a emulação de toque travou os cliques. Falta ainda, por depender de login: CA-9 (paginação do diálogo de encaminhar) e o caminho ponta a ponta dos filtros na lista real |
| 2026-09-03 | João Gabriel | **Code review — 3 achados corrigidos.** (1) `conversation:new` inseria conversa nova no topo ignorando filtros e ordenação; agora invalida quando há estreitamento ou ordenação não-default (CB-10b). (2) Em `participant-switcher`, o item "Todos os participantes" ficava `disabled` quando o email da URL não correspondia a nenhum participante do tracking atual — situação criada pelo compartilhamento da chave com o board (CB-7) — deixando o filtro impossível de limpar por ali e a lista vazia sem explicação; passou a depender do filtro na URL, e o gatilho mostra o email quando não há correspondência. (3) `lastMessageAt` ascendente mantinha a conversa na posição antiga após mensagem nova sem agendar refetch (CB-10). Também foi implementado o **CB-11**, que tinha ficado de fora: lista vazia por filtro agora tem estado próprio com "Limpar filtros", em vez do texto que sugeria importar conversas do WhatsApp |
| 2026-09-03 | João Gabriel | **Bug encontrado e corrigido na validação com dados reais.** `buildCursorWhere` devolvia `{ lead: { statusEnteredAt: null }, id: {...} }` na fase dos nulos, e o `where` do handler espalha essa cláusula **antes** da sua própria chave `lead` — o spread sobrescrevia a restrição do cursor, a paginação voltava ao início e entrava em loop: 25.181 conversas duplicadas e 2.438 sumidas em `statusEnteredAt`. O teste em memória não pegou porque avaliava a cláusula do cursor isolada, sem mesclar com o `where` base — a lição é que só dado real exercita a montagem completa da query. Correção: `buildCursorWhere` embrulha o resultado em `AND`, o que torna a ordem do spread no caller irrelevante. Revalidado: 6/6 ordenações íntegras sobre 3.257 conversas reais |
| 2026-09-03 | João Gabriel | Implementada. CA-5/CA-6 (+ CB-2/CB-3) verificados por script contra as cláusulas Prisma reais: 24 combinações de ordenação × direção × tamanho de página, ordem idêntica à consulta sem paginação. Teste validado por mutação — removendo o desempate por `id`, 7 de 12 conversas com `createdAt` empatado somem. Demais CAs dependem de app + banco de pé e seguem por verificar. A lógica de ordenação/keyset foi extraída para `lib/conversation-list-order.ts` (não estava previsto na §7; o handler oRPC ficou só com transporte e a regra virou testável isoladamente) |
