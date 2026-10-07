---
id: 0075
titulo: Fichas com itens, cálculo e fechamento por cliente
dominio: form
status: em-revisao
autor: Weydson
criada: 2026-10-07
atualizada: 2026-10-07
branch: feature/W-form-fichas-itens-calculo-20261007
pr:
peso: completa
---

# 0075 — Fichas com itens, cálculo e fechamento por cliente

## 1. Contexto

Caso que motivou: uma empresa de pintura automotiva atende ~15 concessionárias. A equipe preenche em papel a ficha "Controle de consumo de materiais" (uma por veículo) e outra pessoa redigita tudo numa planilha mensal. As concessionárias precisam conferir online, ficha a ficha.

A planilha de setembro/2026 (69 veículos, R$ 23.701,60 a emitir) calcula, por concessionária: o que foi usado nos veículos dela (quantidade × preço) + a parte dela em custos do mês divididos por veículo (insumos R$ 13.540,49 e tintas R$ 7.154,69). É valor a receber.

Achado na planilha: a célula informativa "ABRASIVOS" do topo (`I4`) soma 14 dos 15 blocos (falta a Locadora Matilde) e mostra R$ 2.954,04, enquanto o real é R$ 3.006,42. O total a emitir não usa essa célula e está certo.

**Diretriz:** não pode ser uma ferramenta só de oficina. Tem de servir a qualquer empresa que registre itens com quantidade e medida, calcule e feche por cliente. A oficina vira configuração (modelos prontos), não código.

O app de Formulários já tem ficha no celular, edição, PDF, vínculo com cliente (`Lead`) e leitura por link secreto. Faltava: número com medida, lista de itens com preço, cálculo, marcação em imagem, busca em dados do Órbita, lista de fichas com soma, fechamento por cliente.

## 2. Objetivo

Qualquer empresa monta, sem código, uma ficha com itens, medidas e cálculo; lista e confere as fichas; fecha o período por cliente gerando contas a receber; e o cliente final confere tudo por um link.

### Não-objetivos

- Controle de estoque (entrada, saída, saldo).
- Etapas do atendimento em quadro (o cliente final vê fichas e valores, não etapa).
- Login para o cliente final (acesso é por link secreto).
- Rateio por outro critério que não o número de fichas (fica para depois).
- Preço calculado em envio **público** de formulário: nesta versão a lista de itens só é precificada no preenchimento interno, e só ficha interna entra no fechamento.
- Fórmulas livres digitadas; o cálculo é uma operação sobre campos escolhidos.

## 3. Requisitos

### Funcionais

| ID | Requisito | Fase |
| --- | --- | --- |
| RF-1 | Bloco **Número com medida**: número com unidade (un, cx, par, ml, L, g, kg, m, m², h, R$) ou unidade digitada. Aceita "1.250,50". | 1 ✅ |
| RF-2 | Bloco **Lista de itens**: itens do catálogo (`ForgeProduct`) ou avulsos, quantidade com +/−, cada item "cobrado pelo uso" ou "só informativo". O servidor grava o preço do dia; o navegador só informa quantidades. | 1 ✅ |
| RF-3 | Bloco **Cálculo**: soma, subtração, multiplicação ou divisão de campos numéricos que vêm antes dele; recalculado no servidor a cada gravação. | 1 ✅ |
| RF-4 | Bloco **Marcar na imagem**: imagem enviada no construtor; quem preenche toca para pôr marcadores numerados com legenda opcional. | 1 ✅ |
| RF-5 | Qualquer campo de valor curto pode ter **nome-chave**, ser **pesquisável**, aparecer **na lista de fichas**; um campo de data pode ser a **data da ficha**. | 1 ✅ |
| RF-6 | Cada resposta de formulário que usa esses recursos mantém uma projeção `FormRecord` (cliente, período, campos-chave, texto de busca, itens e total), atualizada a cada gravação. | 1 ✅ |
| RF-7 | Bloco **Busca no Órbita**: fonte = clientes, fichas de outro formulário, catálogo ou lista própria do campo; sempre aceita texto digitado; escolher uma ficha preenche os campos de mesmo nome-chave (texto, máscara e número com medida) que o usuário ainda não editou. Fontes do servidor só buscam para membro logado; em link público viram texto comum. | 2 ✅ |
| RF-8 | **Lista própria** colada no próprio campo (um item por linha, até 2.000). Rota `/formulario/novo/[formId]` sem cliente pré-escolhido: busca o cliente e segue para o preenchimento. Modelos prontos "Abertura de O.S." (com lista de modelos de carro) e "Controle de consumo de materiais". | 2 ✅ |
| RF-9 | **Lista de fichas** na tela de respostas do formulário: tabela com data, cliente, colunas dos campos "mostrar na lista", total dos itens e situação (rascunho, enviada, fechada); busca, filtro por período e por cliente, soma do filtro. Clicar numa linha abre a **visão rápida**: o formulário inteiro em leitura, desenhado pelos próprios blocos na largura da ficha e reduzido por escala até caber, com "Abrir ficha" e PDF. Formulário sem recursos de ficha não mostra a seção. | 3 ✅ |
| RF-10 | **Fechamento por cliente** em `/form/responses/[formId]/fechamento`: período (mês), grupos de custo compartilhado nomeados pelo usuário (linhas com descrição, quantidade, medida, valor e data), rateio por número de fichas, total por cliente. Aberto = prévia calculada na hora. "Fechar período" grava as linhas e trava as fichas; "Reabrir" desfaz, se não houver conta gerada; "Gerar contas a receber" cria uma por cliente no Financeiro (vencimento e competência no último dia do período), sem duplicar. Gerar contas exige permissão de criar lançamentos no Financeiro. | 4 ✅ |
| RF-11 | **Visão do cliente** em `/lead/[token]/fichas`: fichas do período, visão rápida e resumo. Período aberto aparece como prévia, sem rateio. | 5 ⬜ |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Formulário que não usa os blocos novos não muda de comportamento: a resposta é gravada byte a byte como antes e não ganha projeção. |
| RNF-2 | Falha na projeção (inclusive tabela ainda não migrada) nunca impede salvar a resposta. |
| RNF-3 | Regra 18: nenhuma transação com I/O; contas a receber são criadas depois do commit do fechamento. |
| RNF-4 | O link do cliente nunca devolve dado de outro cliente nem totais do período que revelem o volume dos demais. |

## 4. Critérios de aceite

CA-1 a CA-6 e CA-9 são conferidos por `scripts/form-records-qa-check.ts` (30 checagens, sem banco).

- [x] **CA-1** — "1.250,50" em reais vira `R$ 1.250,50` com `amount 1250.5`; unidade personalizada é mostrada como digitada; campo vazio emite `value` vazio; 1500 ml = 1,5 L.
- [x] **CA-2** — Resposta enviada com preço, nome e modo de cobrança adulterados é regravada com os dados do formulário e do catálogo; item que não existe no formulário é descartado; item sem preço entra sem valor; lista vazia emite `value` vazio.
- [x] **CA-3** — Editar uma ficha depois de o catálogo mudar de preço mantém o preço original da ficha.
- [x] **CA-4** — Cálculo "itens + valor do serviço" resulta em R$ 513,75 no exemplo do script.
- [x] **CA-5** — Marcador com posição inválida é descartado; posição é limitada a 0–100%.
- [x] **CA-6** — A projeção traz campos-chave, texto de busca sem acento, total dos itens e período vindo da data da ficha (não do dia da digitação).
- [ ] **CA-7** — Manual: montar um formulário sem nada de oficina (visita técnica com itens e horas), preencher, reabrir, gerar PDF.
- [ ] **CA-8** — Manual: ficha de período fechado não pode ser editada nem cancelada.
- [x] **CA-9** — Rateio de R$ 13.540,49 e de R$ 7.154,69 entre as 15 concessionárias por 69 veículos fecha no centavo; quem tem 10 veículos paga R$ 1.962,39 de insumos; total de setembro = R$ 23.701,60.
- [x] **CA-10** — Fechamento de setembro pelo cálculo novo: 15 clientes, 69 fichas, R$ 23.701,60; a soma das linhas é o total; rascunho e ficha sem cliente ficam de fora e são avisados; período sem fichas não gera linha. _(script)_
- [ ] **CA-15** — Manual, depois da migration: salvar custos, fechar, tentar editar uma ficha do período (recusa), gerar contas a receber duas vezes (não duplica), reabrir com conta gerada (recusa).
- [x] **CA-12** — Lista colada vira itens únicos; filtro ignora acento e ordem das palavras; texto digitado à mão vale sem referência; ficha escolhida guarda a origem. _(script)_
- [ ] **CA-14** — Manual, depois da migration: a lista mostra as fichas com as colunas configuradas; filtrar por período e cliente muda total e soma; clicar abre a visão rápida sem rolagem lateral no computador e no celular; nada na visão rápida é editável.
- [ ] **CA-13** — Manual, depois da migration: preencher uma "Abertura de O.S.", abrir o "Controle de consumo", buscar pela placa e ver cliente, O.S., modelo e cor preenchidos; repetir digitando tudo à mão.
- [ ] **CA-11** — Manual: token de um cliente pedindo ficha de outro recebe 404.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Preço do catálogo muda no meio do mês | Cada ficha guarda o preço do dia em que foi preenchida. |
| CB-2 | Ficha editada após o fechamento | Recusada com mensagem; só reabrindo o fechamento. |
| CB-3 | Ficha sem cliente | Listada à parte; bloqueia o fechamento enquanto existir. |
| CB-4 | Rascunho (auto-save sem envio final) | Não conta como ficha no rateio. |
| CB-5 | Cliente sem ficha no período | Não recebe rateio nem conta. |
| CB-6 | Centavos do rateio | Método do maior resto: a soma dos clientes é sempre o total. |
| CB-7 | Item removido do formulário depois de fichas preenchidas | Fichas antigas mantêm o item (está gravado na resposta). |
| CB-8 | Ficha digitada dias depois | O período vem do campo marcado como data da ficha. |
| CB-9 | Divisão por zero no cálculo | Resultado em branco. |
| CB-10 | Formulário público com lista de itens | Grava o que veio, sem preço do servidor e sem projeção; não entra em fechamento. |
| CB-11 | Dois cliques simultâneos em "Gerar contas a receber" | Cada linha é reservada antes de criar a conta; só um dos pedidos cria. |
| CB-12 | Criação da conta falha para um cliente | A reserva é desfeita, os demais seguem, e o botão volta a oferecer as que faltam. |
| CB-13 | Processo cai entre reservar e criar a conta | A linha fica com a marca provisória e aparece como "não gerada", mas não é refeita sozinha. Reabrir e fechar o período limpa. |
| CB-14 | Ficha enviada depois do fechamento, no mesmo período | Não entra nas linhas já gravadas; a tela avisa e é preciso reabrir para incluí-la. |

## 6. Decisões de design

### D-1 — Genérico em vez de "módulo de oficina"
Blocos e fechamento não conhecem carro, placa nem tinta. O que é específico (campos, desenho do carro, lista de modelos) é configuração de formulário e de lista. Alternativa descartada: modelo `ServiceOrder` com colunas `plate`, `vehicleModel` — serviria a um único ramo.

### D-2 — Preço gravado pelo servidor
`jsonResponse` não tem validação no servidor; preço vindo do navegador seria adulterável. `prepareRecordResponse` reescreve as listas a partir do formulário (nome, unidade, modo) e do catálogo (preço), aceitando do cliente só a quantidade.

### D-3 — Projeção `FormRecord` em vez de ler o `jsonResponse`
A coluna guarda uma string JSON: não dá para filtrar por período nem somar no banco. A projeção tem colunas indexadas, centavos em inteiro e é onde a ficha é travada após o fechamento. Alternativa descartada: chave reservada dentro da resposta.

### D-4 — Marcação livre em qualquer imagem
Em vez de um SVG de carro com peças fixas no código, o construtor sobe a imagem e o usuário põe marcadores com legenda. Serve a planta, corpo humano, mapa.

### D-5 — Cálculo por operação, não por fórmula livre
Uma operação sobre campos escolhidos cobre os casos e não exige interpretador de expressão. Um cálculo pode usar outro que venha antes.

### D-6 — Sem FK de `FormRecord` para `Lead`
Ficha de período fechado é documento de cobrança: sobrevive ao lead ser apagado. O nome do cliente é copiado na linha do fechamento.

### D-7 — Lista própria dentro do campo, não em tabela
A lista (ex.: modelos de carro) fica nos atributos do bloco. Funciona em formulário público, viaja junto ao duplicar o formulário e dispensa tela de cadastro. A tabela `form_option_list` já criada na migration fica reservada para listas compartilhadas entre formulários, se a necessidade aparecer.

### D-8 — Escolher o cliente antes, não dentro do formulário
A ficha nova sem cliente passa por uma tela de busca e cai no preenchimento interno de sempre, que já exige um lead. Alternativa descartada: resolver o `leadId` a partir de um campo do formulário no momento de salvar — mexeria na criação de resposta e nas regras de permissão por tracking.

## 7. Modelo de dados

Migration `20261008120000_form_records_and_closings`, só aditiva: `form_record`, `form_option_list`, `form_closing`, `form_closing_line`, enum `FormClosingStatus`. Roda no deploy; **não** foi aplicada à mão em banco nenhum.

Formato dos valores novos em `jsonResponse[blockId]` (`value` sempre texto; estrutura em `meta`):

| Bloco | `meta.kind` | Conteúdo |
| --- | --- | --- |
| NumberMeasure | `number-measure` | `amount`, `unit`, `isCurrency` |
| ItemList | `item-list` | `items[{ itemId, productId, name, unit, billingMode, quantity, unitPriceCents, lineTotalCents }]`, `usageTotalCents`, `pricedAt` |
| Calculation | `calculation` | `amount`, `unit` |
| ImageMarker | `image-markers` | `markers[{ id, xPercent, yPercent, note }]` |
| OrbitLookup | `orbit-lookup` | `source`, `refId` (`null` = digitado à mão). Com `source: RECORDS`, o `refId` vira `FormRecord.sourceRecordId`. |

## 8. Segurança

- Corrigido nesta spec: `leads.generatePublicLink` aceitava o id de um lead de **outra organização** e devolvia (ou trocava) o link público dele. Agora exige organização ativa e filtra pelo tracking da organização.
- Procedures públicas da fase 5 resolvem o lead pelo token e filtram por `leadId`; nunca aceitam `leadId` do cliente.

## 9. Changelog

- 2026-10-07 — Criada. Fase 0 (correção do link público) e fase 1 (blocos, nome-chave, projeção, PDF) implementadas; fases 2 a 5 pendentes.
- 2026-10-08 — Fase 4 implementada: cálculo puro do fechamento, rotas (ler, salvar custos, fechar, reabrir, gerar contas) e tela. A conta a receber sai sem categoria nem conta bancária, como as demais criações automáticas; quem recebe ajusta no Financeiro.
- 2026-10-08 — Fase 3 implementada: lista de fichas e visão rápida (componente único `FormRecordQuickView`, que a fase 5 reusa na página do cliente).
- 2026-10-08 — Fase 2 implementada. Mudou em relação ao plano: lista própria fica no campo (D-7) e o cliente é escolhido numa tela antes do formulário (D-8). O modelo de consumo nasce sem a imagem do veículo e sem itens: os dois são da empresa e entram pelas propriedades.
