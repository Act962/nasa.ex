---
id: 0122
titulo: Base Meta pelos Satélites, Desempenho com a conta real do cliente e "Corrigir valores"
dominio: trafego
status: implementada
autor: Weydson Lima
criada: 2026-10-30
atualizada: 2026-10-30
branch: feature/W-trafego-base-meta-desempenho-20261030
pr: # preenchido no /ship
peso: completa
---

# 0122 — Base Meta pelos Satélites, Desempenho real e "Corrigir valores"

> Entrega A de um plano de três. A **B** (cobrança só do serviço: 30% com mínimo de R$ 150 e complemento pelo gasto real) e a **C** (criar e editar campanha pelo painel) terão specs próprias e dependem desta.

## 1. Contexto

O pedido **TG-0002** (Clínica Tércio Rezende, org TÉRCIO REZENDE) é um pedido avulso (spec 0116). A conta de anúncios da clínica (`751951975841502`) já está compartilhada com o BM da Órbita como parceira. Mesmo assim:

1. **O "Desempenho" do painel fica vazio.** O painel só mostra a campanha ligada ao pedido (`metaCampaignExternalId`). Além disso, a leitura passa pela integração Meta da **org da agência**, que olha uma conta só (`config.adAccountId`). Isso vale para `live-meta-insights.ts` e para os crons `sync-meta-ads-kpis` e `sync-meta-ads-structure`. Para a clínica, nenhum número aparece.
2. **O pedido nasceu com valores errados** (verba R$ 450, taxa R$ 0; o certo é verba R$ 300), e não existe como corrigir. A spec 0116 deixou a edição de valores como não-objetivo.
3. **A integração Meta dos Satélites tem falhas de base.** Foram encontradas no código e conferidas na documentação da Marketing API em 30/10/2026:
   - O token volta **inteiro para o navegador**: `get-many` e `upsert` só mascaram as chaves de IA. Ele fica gravado em texto puro.
   - **Qualquer membro** da org pode editar a integração, porque `integrations-platform/upsert` não confere o papel.
   - Duas funções de leitura põem o token **na URL** (`fetchAdsBreakdowns`, `fetchAdsTimeSeries`).
   - Os erros da Meta viram texto solto, sem distinguir token vencido, permissão faltando e limite de chamadas.
   - A leitura de insights não pagina, não filtra por campanha e não lê conversas iniciadas, que é o resultado principal de quem anuncia para o WhatsApp.
   - O login (OAuth) usa a Graph **v19**, desligada pela Meta em 21/05/2026. As chamadas de anúncios estão na v22.

Decisão do dono: **por enquanto, a integração é por token manual nos Satélites**, porque o formulário já existe. O token recomendado é o do **usuário do sistema do BM da Órbita**, com a conta e a página do cliente atribuídas pela parceria. Segundo a documentação, esse token não expira.

## 2. Objetivo

Quando esta spec estiver pronta, valem quatro coisas:
- o trafeGO lê os números **da conta de anúncios do cliente**, configurada nos Satélites da org do pedido, como o Gerenciador de Anúncios mostra;
- a conexão com a Meta é testável e segura;
- o token não vaza para o navegador;
- a equipe consegue corrigir os valores de um pedido antes de ele ir ao ar.

### Não-objetivos

- Criar, editar ou publicar campanha pelo painel. Fica para a entrega C. Nada aqui escreve no Meta.
- Mudar preço, checkout, financeiro de vendas novas ou cobrar complemento. Fica para a entrega B.
- Mudar o login pela Meta (OAuth) ou pedir permissão nova no app da Meta. A App Review não é pré-requisito.
- Coluna, tabela ou enum novo. A conta do pedido é a conta da integração da org do pedido.
- Cron ou função Inngest nova (S11).
- Trocar a versão da Graph no Planner, no Comments e nas mensagens. Só os arquivos de anúncios e insights vão para a v25.
- Corrigir o `getMetaAuth`, que troca de conta em silêncio, e os stubs de `execute-mcp-action.ts`. Ficam registrados como tarefas separadas.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Cliente Graph único (`src/http/meta/graph-client.ts`), com quatro comportamentos: versão em uma constante (`v25.0`); token só no cabeçalho `Authorization`; `appsecret_proof` quando houver `appSecret`; tempo limite de 20 s. O `graphFetch` de `ads-management.ts` passa a usá-lo, e as assinaturas atuais continuam iguais. |
| RF-2 | Os erros da Graph viram `MetaGraphError` com `kind`: `token_invalid` (190), `permission` (10, 200–299), `rate_limited` (4, 17, 32, 613, 80000–80014, lendo `X-Business-Use-Case-Usage` / `X-FB-Ads-Insights-Throttle` e o tempo para voltar), `transient` (`is_transient` ou código 1/2) e `unknown`. Só `transient` é repetido, uma vez. |
| RF-3 | `graphPaginate` segue `paging.next` até um limite de páginas configurável. |
| RF-4 | Na integração META, `accessToken` e `appSecret` são **cifrados** ao gravar e **mascarados** ao devolver ao navegador, que recebe só "configurado" e os 4 últimos dígitos. Reaproveita o padrão de `integration-api-key.ts` (spec 0093). Campo vazio numa edição mantém o valor atual. |
| RF-5 | `readMetaAccessToken(config)` devolve o token pronto para uso e aceita texto puro gravado antes desta spec. Todo código Meta de anúncios passa a ler o token por essa função: `meta-ads/_helpers.ts`, `live-meta-insights.ts`, crons `sync-meta-ads-*`, `resolve-meta-ad.ts`, `disconnect-oauth.ts` e `publish-accounts-health.ts`. A gravação do OAuth (`oauth-finalize`) também cifra. |
| RF-6 | Só **owner/admin** da org cria, edita, reconecta pelo login da Meta, remove ou desconecta a integração META. Se a integração tem `config.managedBy = "ORBITA"`, só **admin do sistema** edita token, conta e o próprio marcador; o owner/admin da org vê o resumo, sem editar. |
| RF-7 | "Testar conexão" (`checkMetaConnection`). Consulta ao vivo `/me`, `/me/permissions`, `debug_token` (quando houver `appId`/`appSecret`), `/act_{id}` (nome, status, moeda, fuso, orçamento mínimo diário, BM) e `/act_{id}/promote_pages` (com o Instagram e o WhatsApp da página). Grava o resumo em `config.connectionCheck` e devolve `canRead` e `canCreate`. |
| RF-8 | `canRead` exige `ads_read` **ou** `ads_management`, além da conta ativa e acessível. `canCreate` exige `ads_management`, `pages_manage_ads`, `pages_read_engagement` e `pages_show_list`, mais uma página promovível na conta. `canCreate` só é calculado e exibido aqui; quem o usa é a entrega C. |
| RF-9 | O cartão Meta dos Satélites mostra o resultado do teste: conta, moeda, status, página, Instagram, WhatsApp da página, permissões que faltam e validade do token ("não expira" para usuário do sistema). |
| RF-10 | `fetchAdsInsights` ganha estes campos: `use_unified_attribution_setting=true`, `filtering`, `time_increment`, `breakdowns`, `fields` extras e paginação. O `parseInsightRow` passa a ler conversas iniciadas (`onsite_conversion.messaging_conversation_started_7d`), custo por conversa, CPM e frequência. Quem chama hoje não muda nada. |
| RF-11 | `resolveOrderMetaAccess(order)` decide de onde ler. Com integração META ativa e `canRead` na **org do pedido**, lê a conta dela. Senão, cai no **modo antigo**, pela integração da agência (`metricsOrganizationId`), como hoje. Nunca troca de conta em silêncio. |
| RF-12 | O Desempenho no modo conta mostra: (a) KPIs da conta no período (investido, conversas iniciadas, custo por conversa, alcance, impressões, cliques, CTR, CPM, frequência); (b) série diária; (c) campanhas da conta, com nome, status, investido, resultados e o selo **"deste pedido"**; (d) públicos por idade, gênero e plataforma. |
| RF-13 | A **verba usada** é o gasto lifetime das campanhas do pedido, inclusive arquivadas, comparado com `adBudgetBrlCents`. Campanha do pedido é a que tem o código do pedido no nome (casamento **exato**: `TG-0002` não casa com `TG-00021`) ou cujo id é `metaCampaignExternalId`. |
| RF-14 | Procedures `trafego.performance.budget`, `overview` e `breakdown`. Todas confirmam que o pedido é da org da sessão **antes** de chamar a Meta. O cabeçalho do pedido usa só o `budget`, mais leve. |
| RF-15 | Sem integração na org do pedido, o Desempenho no modo antigo continua como hoje e mostra "Conecte a conta do Meta nos Satélites" para owner/admin. |
| RF-16 | `trafego.admin.orders.correctValues` (só admin do sistema) corrige verba, taxa, setup, tipo, objetivo e duração, com motivo obrigatório. O total é recalculado. O nome do plano é regenerado, com a fórmula extraída num helper único. |
| RF-17 | "Corrigir valores" só aceita estes status: PAID, ACCOUNT_REVIEW, ONBOARDING, MATERIALS_SUBMITTED, REQUESTED, IN_REVIEW e CHANGES_REQUESTED. |
| RF-18 | Lançamentos do pedido no financeiro (`PaymentEntry`, org da agência, `documentNumber = código`). A correção é **recusada**, com "ajuste o financeiro à mão", em três casos: algum lançamento conciliado com o banco, o repasse da verba pago ou pago em parte, a receita paga em parte. Fora desses casos, o repasse e a receita são ajustados na mesma transação. A receita registrada como paga na venda continua paga, com o valor novo. Nenhum lançamento novo é criado: se faltar algum, a resposta traz uma nota. |
| RF-19 | A correção grava um evento `source=ADMIN` interno com o antes → depois e o motivo, e um evento visível ao cliente, "Valores do pedido atualizados pela equipe". |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Nenhuma chamada à Meta dentro de `prisma.$transaction` (regra 18). |
| RNF-2 | Na primeira abertura, o Desempenho faz no máximo 6 chamadas à Meta: conta, totais, série diária, campanhas, status das campanhas e verba usada. Leitura com cache de 15 min, chave conta + período + bloco + filtro; a Meta atualiza os insights a cada 15 min. Falha fica no cache por 2 min. O cache é só economia e funciona com 2 instâncias e depois de restart. |
| RNF-3 | O token nunca aparece em resposta, log, URL ou mensagem de erro. Do erro da Meta, só `error_user_msg` / `userMessage` chega ao cliente. |
| RNF-4 | Tipos do Prisma conforme a regra 22. Nada lança erro no import do módulo sem env (regra 24a). |
| RNF-5 | Sem tabela, coluna, enum, env var, cron ou função Inngest nova. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado o pedido TG-0002 e a TÉRCIO REZENDE com token + `act_751951975841502`, quando o Desempenho abre no período do pedido, então os totais batem com o Gerenciador de Anúncios para a mesma conta e período, com diferença só de arredondamento. Isso inclui "Conversas iniciadas".
- [ ] **CA-2** — A verba usada soma só as campanhas com exatamente `TG-0002` no nome (não `TG-00021`), mais a campanha vinculada, inclusive arquivadas.
- [ ] **CA-3** — Dado um usuário de outra org que passa o `orderId`, então recebe NOT_FOUND e **nenhuma** chamada à Meta é feita.
- [ ] **CA-4** — Dado um pedido cuja org não tem integração Meta, então o Desempenho segue no modo antigo como hoje e nunca mostra a conta da agência inteira.
- [ ] **CA-5** — Dado um token sem acesso à conta, então o Desempenho mostra "a conexão com a Meta não tem acesso a esta conta", sem cair em outra conta.
- [ ] **CA-6** — Duas consultas com períodos diferentes devolvem números diferentes: o período faz parte da chave do cache.
- [ ] **CA-7** — Dada uma conta em moeda diferente de BRL, então a verba usada não mostra porcentagem, e sim o aviso.
- [ ] **CA-8** — A resposta de `integrationsPlatform.getMany` e `upsert` para META traz `accessToken` e `appSecret` vazios, com `…Configured: true` e os 4 últimos dígitos. No banco, os dois ficam cifrados.
- [ ] **CA-9** — Um token antigo gravado em texto puro continua funcionando: o Desempenho e os crons leem normalmente.
- [ ] **CA-10** — Um membro com papel "member" ou "moderador" que tenta salvar a integração META recebe FORBIDDEN.
- [ ] **CA-11** — Com `managedBy = "ORBITA"`, o owner da org recebe FORBIDDEN ao trocar conta ou token, e o admin do sistema consegue.
- [ ] **CA-12** — "Testar conexão" com o token do usuário do sistema mostra a conta, a moeda BRL, a página, as permissões e "não expira". Sem `pages_manage_ads`, aparece `canCreate=false` com a permissão que falta citada.
- [ ] **CA-13** — Um erro 80004 da Meta vira a mensagem "a Meta pediu para esperar N min" e não é repetido.
- [ ] **CA-14** — "Corrigir valores" no TG-0002 de 450/0 para 300/150 resulta em total 450, nome do plano "Tráfego R$ 300,00", evento interno com o antes → depois e evento visível.
- [ ] **CA-15** — "Corrigir valores" é recusado nos status SCHEDULED, RUNNING, PAUSED e terminais.
- [ ] **CA-16** — Com lançamento do pedido conciliado ou pago, "Corrigir valores" é recusado e nada é gravado. Com lançamentos em aberto, os valores são atualizados.
- [ ] **CA-17** — Quem não é admin do sistema recebe FORBIDDEN em `correctValues`.
- [ ] **CA-18** — Nenhuma URL de chamada à Meta contém `access_token=`. Isso é conferido no script de QA, sobre as URLs montadas.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Conta desativada, em atraso ou em carência (`account_status ≠ 1`) | O teste mostra o status. O Desempenho mostra os dados com o aviso do status. |
| CB-2 | Token vencido ou revogado (190) | A integração é marcada "precisa reconectar". O Desempenho mostra o aviso para owner/admin e "números indisponíveis" para os demais. |
| CB-3 | Conta com mais de 500 campanhas | A paginação segue até o limite; acima dele, aparece "mostrando as N mais recentes". |
| CB-4 | Fuso da conta diferente de America/Sao_Paulo | O período é calculado no fuso da conta (`timezone_name`). |
| CB-5 | Cliente renomeia a campanha e tira o código | Ela continua contando se for a campanha vinculada; senão, sai da verba usada (risco registrado para a entrega B). |
| CB-6 | Duas orgs com a mesma conta | Cada uma lê pela própria integração. A trava `managedBy` impede que o cliente aponte para conta de outro. |
| CB-7 | `appId`/`appSecret` ausentes | O teste roda sem `debug_token` e mostra "validade: não verificada". |
| CB-8 | Integração antiga, gravada pelo OAuth, com várias contas | `resolveOrderMetaAccess` usa `config.adAccountId` e mostra qual conta está em uso. A troca é feita pelo formulário. |
| CB-9 | Correção com o pedido já com campanha vinculada | Permitida se o status deixar. A verba usada passa a comparar com o valor novo. |
| CB-10 | Correção concorrente com uma baixa no financeiro | A transação confere o estado dos lançamentos dentro dela e recusa se mudou. |
| CB-11 | Pedido pago pela landing (`pendingPurchaseId`) | A correção só redistribui verba, taxa e setup. Mudar o total cobrado pelo Stripe/Asaas é recusado. |
| CB-12 | Duas orgs com a mesma conta e tokens diferentes | O cache de leitura usa org + conta + final do token. Uma org nunca recebe dados lidos pelo token da outra. |

## 6. Decisões de design

### D-1 — A conta do pedido vem da integração da org do pedido, sem coluna nova
- **Escolha**: `resolveOrderMetaAccess` lê a integração META da org do pedido.
- **Alternativas descartadas**: `TrafegoOrder.metaAdAccountId` (coluna). Com token manual, a org tem uma conta; a coluna entra quando houver segunda conta (S4). O token da agência no pedido também foi descartado: lê a conta de qualquer cliente, e a decisão é "tudo vem dos Satélites".
- **Consequência**: trocar a conta na integração muda o Desempenho dos pedidos daquela org.

### D-2 — Token manual com usuário do sistema da Órbita e marcador `managedBy`
- **Escolha**: o token recomendado é o do usuário do sistema do BM da Órbita, que não expira e gerencia contas atribuídas. Como ele enxerga as contas de todos os clientes, a integração ganha o marcador `managedBy = "ORBITA"`, e só admin do sistema edita.
- **Alternativas descartadas**: um usuário do sistema por cliente (o acesso padrão permite 1 usuário do sistema + 1 admin); OAuth com permissão nova (exige App Review e quebra o login de quem não tem papel no app); deixar o owner editar (furo: trocar o número da conta para ler o cliente de outra empresa).
- **Consequência**: a configuração da integração gerenciada é tarefa da equipe Órbita.

### D-3 — Atribuição unificada
- **Escolha**: `use_unified_attribution_setting=true` em toda leitura de insights.
- **Por quê**: é o que faz os números baterem com o Gerenciador de Anúncios, conforme a documentação de Insights.

### D-4 — Leitura ao vivo com cache, sem snapshot e sem cron para a conta do cliente
- **Escolha**: leitura ao vivo com cache de 15 min.
- **Alternativa descartada**: estender o cron para gravar snapshot da conta. A volumetria não justifica, e o cron só olha `config.adAccountId` (S11).

### D-5 — "Corrigir valores" recusa quando o dinheiro já andou
- **Escolha**: lançamento conciliado ou pago bloqueia a correção.
- **Alternativa descartada**: estornar ou ajustar automaticamente. Mexer em dinheiro já recebido em silêncio é pior que pedir ajuste manual (S2).

### D-6 — v25 só nos arquivos de anúncios e insights
- **Escolha**: v25 em anúncios e insights; os demais arquivos Meta continuam como estão.
- **Por quê**: limita o alcance da mudança. A v22 continua disponível até 20/05/2027.

## 7. Impacto

- [ ] Schema / migration — **não**
- [x] Procedures oRPC:
  - novas: `trafego.performance.*`, `trafego.admin.orders.correctValues`, `integrations.meta.checkConnection`
  - alterada: `integrationsPlatform.upsert` (permissão e cifragem) e `getMany` (máscara)
- [ ] Realtime — não
- [ ] Automações (Inngest) — **não** (os crons existentes só passam a ler o token pelo helper)
- [ ] Env vars novas — **não**
- [x] Breaking change — membros comuns deixam de poder editar a integração Meta, e o token deixa de ir ao navegador
- [x] Documentação: `docs/trafego-overview.md` e `docs/trafego-playbook-gestor.md`

### Segurança de dados

- Toda procedure confere o dono do pedido (`organizationId` da sessão) antes de qualquer chamada à Meta. A entrada nunca traz `adAccountId`: a conta vem só da integração da org do pedido.
- O token é cifrado no banco (AES-256-GCM, `src/lib/crypto.ts`) e nunca vai ao navegador, ao log nem à URL.
- Editar a integração Meta é ação de owner/admin. A integração gerenciada pela Órbita só é editada por admin do sistema (D-2).
- O Desempenho mostra só números agregados da conta. Nenhum dado pessoal é lido.
- Correções de valor deixam rastro: evento com autor, antes → depois e motivo.

### Regras da Meta

- Só leitura nesta entrega: nada é criado, alterado ou apagado no Meta.
- Limites de chamada são respeitados:
  - os cabeçalhos de uso são lidos e, quando a Meta pede espera, a chamada não é repetida;
  - leituras repetidas saem do cache;
  - a Meta recomenda preferir `date_preset` e filtros.
- Permissões mínimas do token: `ads_read` para ler. As permissões de criação aparecem no teste só como informação para a entrega C.
- Atribuição unificada para bater com o Gerenciador (D-3).

## 8. Plano de testes

Não há runner de teste no projeto (CLAUDE.md, regra 20). O script `scripts/trafego-0122-qa-check.ts`, rodado com `tsx`, cita os CA nos nomes dos casos.

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-2, CA-6, CA-13, CA-18 | automatizado (script) | Funções puras: casamento do código, chave do cache, classificação de erro e montagem da URL sem token. |
| CA-14, CA-15, CA-16 | automatizado (script) | Regras puras de correção, status e financeiro. |
| CA-1, CA-5, CA-7, CA-12 | manual | Script de leitura real em `scripts/` contra a conta da clínica e conferência no Gerenciador. |
| CA-3, CA-10, CA-11, CA-17 | manual | `curl` nas rotas `/api/rpc` com sessões de papéis diferentes. |
| CA-4, CA-8, CA-9 | manual | Pedido sem integração; resposta do `getMany`; token antigo em texto puro. |

## 9. Riscos e rollback

- **Mudança de permissão nos Satélites:** membro comum deixa de editar a integração Meta. Rollback: reverter a PR.
- **Tokens já gravados em texto puro** continuam funcionando (RF-5) e são cifrados na próxima edição. Rollback seguro: o helper aceita os dois formatos.
- **v25 nos arquivos de anúncios** pode mudar o formato de algum campo. A leitura real (CA-1) roda antes do merge.
- **Sem migration**, então o rollback é só reverter o código.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-30 | Weydson Lima (com Claude) | Criada a partir do plano em 3 entregas (A: esta; B: cobrança; C: criação pelo painel). |
| 2026-10-30 | Weydson Lima (com Claude) | Ajustes da implementação. RNF-2 passa a contar 6 chamadas na primeira abertura, por causa da lista de status das campanhas. RF-6 vale também para reconectar, remover e desconectar. RF-18 detalha quando a receita paga é ajustada e diz que nada é criado. Entram CB-11 (total da landing) e CB-12 (cache por org e token). |
