---
id: 0032
titulo: ASTRO faz o CRUD de propostas do Forge — criar guiado, listar, editar, cancelar e excluir
dominio: astro
status: aprovada
autor: Weydson
criada: 2026-09-25
atualizada: 2026-09-25
branch: feature/W-astro-commander-20260925
pr:
peso: completa
---

# 0032 — CRUD de propostas do Forge pelo ASTRO

Relacionadas:
- [0023](0023-astro-roteamento-por-intencao-e-proposta-com-link.md): `forge.create_proposal` e roteamento por intenção.
- [0014](0014-astro-agente-financeiro-tools-e-confirmacao.md): cartão de confirmação e `confirm_action`.
- [0026](0026-astro-consultas-em-codigo.md): consultas em código (camada antes do modelo).

---

## 1. Contexto

Teste real em 2026-09-25, GOTHAN CITY, pelo widget do ASTRO:

| Operação | Resultado |
| --- | --- |
| "Quero criar uma proposta." → "Suellen Souza" → Confirmar | Criou a #15 **com R$ 0,00**. O ASTRO só exige o cliente; não pergunta produto nem validade. |
| "Adicione o Setup na proposta #14" | Ofereceu criar **outra** proposta. Não existe editar. É a origem das #0005–#0011, sete rascunhos zerados do mesmo cliente. |
| "Quais propostas o Kauê tem e o valor de cada uma?" | Devolveu "14 rascunhos": não filtra por cliente e não mostra valor. |
| Excluir ou cancelar proposta | Não existe. |
| Clicar em Confirmar ou Cancelar no cartão | Funciona, mas passa pelo orquestrador inteiro: **~45 mil tokens, ~46 Stars por clique**. |
| Tela do Forge depois da ação | "Propostas Recentes" não atualiza; a proposta nova só aparece recarregando. |
| Faixa "1 ação esperando sua aprovação" | Continua aparecendo depois que o cartão já foi confirmado ou cancelado. |

Já corrigido no mesmo dia (changelog da 0023 e da 0026): o pedido de montar caía em consulta, a proposta gravava o produto como texto, a validade em português entrava em loop e o clique em Confirmar voltava ao classificador.

## 2. Objetivo

Pelo ASTRO, o usuário cria uma proposta completa (cliente, produtos, validade), consulta as propostas de um cliente com valor, edita, cancela e exclui. Toda escrita passa pelo cartão de confirmação, e o clique no cartão não gasta modelo.

### Não-objetivos

- Enviar a proposta ao cliente (WhatsApp, e-mail). Fica para depois; hoje o ASTRO devolve o link.
- Criar ou editar **produto** do catálogo do Forge.
- Desconto, gateway de pagamento e cabeçalho da proposta. Fica na tela do Forge.
- Contratos.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | **Criar guiado.** Com o cliente resolvido e sem produto no pedido, o ASTRO pergunta quais produtos entram, mostrando até 8 do Forge como opções de um toque (os mais usados em propostas da org primeiro), com "Nenhum por enquanto" e "Outro". Em seguida pergunta a validade, com as opções "7 dias" (padrão), "15 dias", "30 dias" e "Sem validade". |
| RF-2 | **Vários produtos, quantidade opcional.** "2 Setup e a Assinatura" grava Setup com quantidade 2. O cartão lista cada item com valor unitário e o total. |
| RF-3 | **Listar por cliente.** "Quais propostas o Kauê tem?" mostra uma tabela com número, título, situação, validade e total de cada proposta daquele cliente, cada linha com link. Sem cliente, "quais propostas" mantém a contagem por situação da 0026. |
| RF-4 | **Ver uma proposta.** "Mostra a proposta #14" lista itens, total, validade, situação e o link público. |
| RF-5 | **Editar.** Na proposta indicada por número ("#14") ou pela última do cliente ("a do Kauê"): adicionar item, remover item, mudar quantidade, trocar validade e trocar título. Sempre com cartão mostrando antes e depois do total. |
| RF-6 | **Referência à última.** Logo após criar ou mostrar uma proposta, "adiciona o Setup nela" edita essa proposta. |
| RF-7 | **Cancelar.** Muda a situação para `CANCELADA`. Vale para qualquer situação, menos `PAGA`. |
| RF-8 | **Excluir.** Só `RASCUNHO` sem contrato vinculado. Nas outras situações, o ASTRO oferece cancelar (D-3). O cartão de exclusão tem aviso em vermelho. |
| RF-9 | **Excluir em lote os rascunhos vazios.** "Apaga os rascunhos zerados do Kauê" lista no cartão quais serão excluídos (número e título) e exclui só esses. |
| RF-10 | **Confirmar e cancelar sem modelo.** "confirmar <id>" e "cancelar <id>" vindos do cartão executam direto no código, com a mesma checagem de dono, organização, validade e situação do `confirm_action`. |
| RF-11 | **Telas atualizam.** Depois de qualquer escrita do ASTRO no Forge, as listas do Forge abertas atualizam sem recarregar. |
| RF-12 | **Faixa de aprovações correta.** A faixa "N ações esperando aprovação" some quando o cartão é confirmado, cancelado ou expira. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Clique no cartão (RF-10) custa zero token. Criar e editar pelo classificador ficam na ordem de 1–2 mil tokens (RNF-1 da 0023). |
| RNF-2 | Permissão por ação: `forge.create`, `forge.update`, `forge.delete`, verificada no ensaio (antes do cartão) e na execução. |
| RNF-3 | Escrita de proposta e itens na mesma `$transaction`, só com escritas de banco (Regra 18). Pusher e invalidação vêm depois do commit. |

## 4. Critérios de aceite

- [x] **CA-1** — "Quero criar uma proposta" → cliente → o ASTRO pergunta os produtos com opções → validade com opções → cartão com itens e total → Confirmar grava a proposta com os itens e o total certo.
- [ ] **CA-2** — "Nenhum por enquanto" cria a proposta sem itens, e o cartão avisa que o total é R$ 0,00.
- [x] **CA-3** — "Quais propostas o Kauê tem?" lista só as do Kauê, com total de cada uma.
- [x] **CA-4** — "Adiciona o Setup na #14" edita a #14. Nenhuma proposta nova é criada.
- [x] **CA-5** — Logo depois de criar, "adiciona o Treinamento nela" edita a proposta recém-criada.
- [ ] **CA-6** — "Exclui a #0010" com a #0010 em `RASCUNHO` e sem contrato: cartão vermelho e, confirmado, some do Forge.
- [x] **CA-7** — "Exclui a proposta X" com X `ENVIADA`: o ASTRO recusa excluir e oferece cancelar.
- [x] **CA-8** — "Cancela a #14" muda a situação para `CANCELADA`. Com a proposta `PAGA`, recusa.
- [x] **CA-9** — Clicar em Confirmar ou Cancelar no cartão não gera `UsageEvent` de LLM e não debita Stars de token.
- [x] **CA-10** — Com a tela do Forge aberta, a proposta criada ou editada pelo ASTRO aparece sem recarregar.
- [x] **CA-11** — A faixa de aprovações some depois de confirmar ou cancelar o último cartão pendente.
- [ ] **CA-12** — Usuário sem permissão de excluir no Forge recebe a recusa antes do cartão.

## 5. Casos de borda

| # | Caso | Comportamento |
| --- | --- | --- |
| CB-1 | Produto citado não existe no Forge | O cartão lista o que achou e "não achei no Forge: X". Não inventa produto nem preço. |
| CB-2 | Dois produtos casam com o nome ("Setup (Única)" e "Setup (Única) · única") | Pergunta qual, com as duas opções. |
| CB-3 | "a do Kauê" com várias propostas do Kauê | Usa a mais recente e mostra o número no cartão, para o usuário conferir. |
| CB-4 | Remover o último item | Permitido; o cartão avisa que o total vai a R$ 0,00. |
| CB-5 | Editar proposta `PAGA` ou `CANCELADA` | Recusa, explicando a situação. |
| CB-6 | Cartão expirado | "Essa confirmação expirou. Quer que eu refaça?" (comportamento do `confirm_action`). |
| CB-7 | Dois cliques rápidos em Confirmar | Só uma execução; o segundo clique responde "já executada". |
| CB-8 | Produto teve o preço alterado entre o cartão e o Confirmar | Grava o preço do momento da confirmação e mostra o total final no resultado. |

## 6. Decisões de design

### D-1 — Escrita vira verbo; leitura vira consulta em código
- **Escolha:** `forge.update_proposal`, `forge.cancel_proposal`, `forge.delete_proposal` e
  `forge.delete_empty_draft_proposals` entram no registro de ações (`actions/forge/`), com ensaio
  antes do cartão. **Listar e ver** (RF-3 e RF-4) ficaram na camada de consultas em código
  (`queries/forge.ts`), não como ações.
- **Motivo:** ler proposta é `findMany` com soma — não precisa de modelo nenhum, e pela camada de
  consultas custa zero token e já devolve tabela clicável. Só a escrita precisa de classificação,
  cartão e permissão.
- **Ordem:** as duas consultas novas vêm antes da contagem genérica de propostas; quando a frase não
  cita cliente que exista, elas devolvem `null` e a genérica responde (spec 0026, D-2).

### D-10 — O ciclo guiado passou a valer também no chat
- **Escolha:** a rota do chat usa `resolveGuided` (memória do que já foi perguntado por sessão), que
  até aqui só servia ao WhatsApp.
- **Motivo:** sem ela, cada resposta era reclassificada do zero. Medido: escolher "Setup (Única)" na
  lista de produtos repetia a mesma pergunta para sempre, porque a frase solta não dizia o cliente.

### D-11 — Uma pergunta por vez
- **Escolha:** faltando vários campos, o ASTRO pergunta só o primeiro, com opções quando houver.
- **Motivo:** "me diga: o cliente, os produtos, a validade" obriga a responder tudo numa frase só —
  o oposto do ciclo guiado. Vale para todas as ações, não só proposta.

### D-12 — A data quem calcula é o código
- **Escolha:** `validUntil` chega como texto ("7 dias", "02/10/2026", "sem validade") e o código
  converte; data no passado é recusada com nova pergunta.
- **Motivo:** o classificador não sabe que dia é hoje. Medido: devolveu `2023-10-06` para "validade
  de 7 dias", e a proposta #13 ficou com validade em 2023.

### D-13 — O app Forge precisa se anunciar como CRUD na triagem
- **Escolha:** a descrição do app na etapa 1 passou a citar alterar, cancelar, excluir e limpar
  rascunho, e a dizer que o alvo é a proposta, não o cliente.
- **Motivo:** medido — "apaga os rascunhos zerados do Kauê" era classificado como **excluir o lead
  Kauê**. Com a descrição antiga ("criar proposta com valor para um cliente"), o app nem entrava na
  disputa.

### D-2 — Pergunta guiada com opções
- **Escolha:** campo faltante vem com opções de um toque (produtos do Forge, prazos de validade), reaproveitando `optionsForField`.
- **Motivo:** o pedido curto é o mais comum, e hoje ele cria proposta vazia sem perguntar nada.

### D-3 — Excluir só rascunho sem contrato; o resto é cancelar
- **Escolha:** exclusão física apenas de `RASCUNHO` sem `ForgeContract`. Nas outras situações, `CANCELADA`.
- **Motivo:** proposta enviada já tem link público com o cliente, e a paga tem histórico financeiro. Apagar quebraria o link e o rastro.

### D-4 — Confirmação determinística
- **Escolha:** a rota do chat reconhece "confirmar <id>" e "cancelar <id>" e chama o executor registrado direto. O `confirm_action` do orquestrador continua para "sim" e "pode" em texto livre.
- **Motivo:** o clique é inequívoco; mandar ao modelo custa ~46 Stars e ainda pode errar.

### D-5 — Invalidação por evento, não por polling
- **Escolha:** depois da escrita, Pusher `forge:proposals-changed` no canal da organização; as telas do Forge invalidam as queries de propostas.
- **Motivo:** mesmo padrão do `alert:new`; sem polling.

## 7. Impacto

- **Ações ASTRO:** 5 novas em `actions/forge/`, mais `create_proposal` com quantidade e perguntas guiadas.
- **Rota** `/api/astro/chat`: confirmação determinística (D-4).
- **Consultas em código (0026):** `forge.proposals` deixa de responder quando a frase cita um cliente.
- **Forge (UI):** assinatura do evento de invalidação e ajuste da faixa de aprovações no widget.
- **Schema:** nenhum.
- **Env vars:** nenhuma.

## 8. Plano de testes

Sem runner (CLAUDE.md, item 20). Manual no widget, na GOTHAN CITY, um roteiro por CA, com leitura do `UsageEvent` para o CA-9 e duas abas (Forge + widget) para o CA-10.

## 9. Riscos e rollback

- **Exclusão indevida:** mitigada por D-3, confirmação obrigatória, cartão vermelho e permissão `forge.delete`.
- **Edição da proposta errada (CB-3):** mitigada mostrando o número no cartão.
- **Rollback:** remover os verbos do registro. Nenhum dado novo é criado além das propostas.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-25 | Weydson | Criada a partir do teste do ASTRO no Forge (seção 1). |
| 2026-09-25 | Weydson | Implementada e verificada no widget (GOTHAN CITY). Divergências registradas em D-1 (leitura virou consulta em código), D-10 (ciclo guiado no chat), D-11 (uma pergunta por vez), D-12 (data calculada no código) e D-13 (descrição do app Forge na triagem). CA-1 a CA-5 e CA-7 a CA-11 verificados; CA-6 (exclusão em lote) parou no cartão, à espera da decisão de apagar dados reais; CA-12 (permissão) não verificado por falta de um segundo usuário sem acesso ao Forge. |
