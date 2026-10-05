---
id: 0071
titulo: Planner publica no Instagram pelas contas conectadas nos Satélites
dominio: nasa-planner
status: aprovada
autor: João Gabriel
criada: 2026-10-05
atualizada: 2026-10-05
branch: feature/comments-contas-instagram-satelites-20261005
pr: # empilhada sobre a PR 431
peso: completa
---

# 0071 — Planner publica no Instagram pelas contas conectadas nos Satélites

> Depende das specs [0069](../comments/0069-contas-do-instagram-nos-satelites.md)
> (várias contas do Instagram nos Satélites) e
> [0070](0070-kits-da-marca-por-conta.md) (kit da marca por conta).
> Altera a origem das contas da [spec 0057](0057-publicacao-confiavel-e-stories.md).

---

## 1. Contexto

Hoje existem dois cadastros de conta do Instagram que não se falam.

| Cadastro | Quem preenche | Quem usa |
| --- | --- | --- |
| `SocialChannel` (Satélites › Instagram) | Formulário simplificado (ID da conta + token + app secret) **ou** "Conectar pela Meta" | Comments, chat, Kit da Marca |
| `MetaPublishAccount` | Só o "Conectar pela Meta" | Planner inteiro: publicar, escolher a conta do post, métricas, comentários do post, checagem diária, Astro e MCP |

Consequência: a conta conectada pelo formulário aparece nos kits e no Comments,
mas o Planner responde "Nenhuma conta do Instagram conectada" na hora de publicar.

O formulário simplificado usa o token do app do Instagram (Instagram API com
login do Instagram, host `graph.instagram.com`). Esse token publica, lê
métricas e lê comentários, desde que o app tenha as permissões. O código de
publicação do Planner (`src/http/meta/planner-graph.ts`) só chama
`graph.facebook.com`, que exige o token de página da conexão da Meta.

Outro ponto: o token do app do Instagram vale 60 dias e **nada o renova hoje**.
No Comments isso já é um risco; com posts agendados, o post falha na hora de sair.

Não há empresa real publicando pelo Planner em produção — só testes avulsos
(informação do dono do produto, 2026-10-05). Não há dado a migrar.

## 2. Objetivo

O Planner usa **somente** as contas do Instagram conectadas nos Satélites, para
publicar, mostrar métricas e comentários do post, qualquer que seja a forma de
conexão; e o token dessas contas se renova sozinho.

### Não-objetivos

- **Publicar em página do Facebook pelas contas dos Satélites.** O Facebook
  continua como extra opcional, pela conexão da Meta (`MetaPublishAccount` do
  tipo página), sem mudança.
- **Anúncios e insights de campanhas pagas.** Continuam pela conexão da Meta.
- **Migrar posts de teste antigos.** Post que aponta para uma conta que não está
  nos Satélites pede para escolher a conta de novo.
- **Outras redes (TikTok etc.).** O encaixe fica pronto (D-1), a rede não.
- **Remover o "Conectar pela Meta" dos Satélites.** Continua como forma de
  conexão; a conta conectada por ele também publica.
- **Trocar o motor de agendamento** (Inngest, espera de processamento de vídeo,
  novas tentativas). A spec 0057 continua valendo.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | A lista de contas do Instagram no Planner (criar post, escolher conta, calendário, filtro) vem das contas ativas dos Satélites da empresa. Não lê mais `MetaPublishAccount` para Instagram. |
| RF-2 | Publicar e agendar funcionam em conta conectada pelo formulário: imagem, carrossel, reels e stories. |
| RF-3 | Publicar e agendar continuam funcionando em conta conectada pela Meta, a partir da mesma lista. |
| RF-4 | Métricas do post publicado e comentários do post (ler, responder, ocultar, apagar) usam a conta dos Satélites do post. |
| RF-5 | O post guarda a conta escolhida pelo ID dela na rede, como hoje (`targetIgAccountId`), que é o mesmo valor de `SocialChannel.externalAccountId`. Kit da marca e Comments do post seguem resolvendo por esse valor. |
| RF-6 | Ao conectar ou trocar a credencial, o sistema confere o que a conta consegue fazer — publicar, métricas — e guarda o resultado. O cartão da conta nos Satélites mostra essas capacidades. |
| RF-7 | Conta sem permissão de publicar aparece no Planner marcada como "não publica", com link para o passo do guia que libera a permissão. Não pode ser escolhida para um post novo. |
| RF-8 | O guia de conexão pede as três permissões do app do Instagram: comentários e mensagens, publicação, insights. |
| RF-9 | O token das contas conectadas pelo formulário é renovado sozinho antes de vencer. A data de validade aparece no cartão da conta. |
| RF-10 | Se a renovação falhar ou o token for recusado, a conta passa a "precisa reconectar", owners e admins recebem notificação com link para a página da conta, e os posts agendados dela mostram o aviso no calendário. |
| RF-11 | A checagem diária de saúde passa a cobrir as contas dos Satélites. A checagem de `MetaPublishAccount` fica só para páginas do Facebook. |
| RF-12 | As ferramentas do Astro e do MCP que listam ou escolhem conta do Instagram leem as contas dos Satélites. |
| RF-13 | Desativar ou desconectar a conta nos Satélites impede novas publicações nela; o post agendado falha com mensagem clara, sem tentar de novo. |
| RF-14 | O calendário filtra os posts por conta do Instagram (filtro "Conta", na URL) e mostra o @ da conta no cartão do post quando o cliente tem mais de uma conta. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | O token nunca entra no histórico do Inngest nem vai para o navegador: cada passo do workflow busca o seu, como hoje. |
| RNF-2 | Migration só aditiva (regra 24h). |
| RNF-3 | O Planner não chama a API do Instagram direto: pede ao módulo `social`, por um port (D-1). Regra de fronteira do `.dependency-cruiser.js` continua passando. |
| RNF-4 | A renovação de token roda em Inngest, uma conta por passo, e a falha de uma não interrompe as outras. |
| RNF-5 | Toda leitura de conta para publicar confere que a conta é da empresa do post. |

## 4. Critérios de aceite

- [x] **CA-1** — Dada uma conta conectada pelo formulário, com permissão de publicar, quando o usuário publica um post de imagem, então o post sai no Instagram e guarda o id e o link da publicação.
- [x] **CA-2** — Idem para carrossel, reels e story (um caso por tipo).
- [ ] **CA-3** — Dada uma conta conectada pela Meta, quando o usuário publica, então o post sai como hoje.
- [x] **CA-4** — Dada uma empresa com duas contas nos Satélites e nenhuma `MetaPublishAccount`, quando abre o criador de post, então vê as duas contas para escolher.
- [x] **CA-5** — Dada uma empresa só com `MetaPublishAccount` do Instagram e nenhuma conta nos Satélites, quando abre o criador de post, então não vê conta do Instagram e vê o convite para conectar nos Satélites.
- [x] **CA-6** — Dada uma conta cujo token não tem a permissão de publicar, quando é conectada, então fica marcada como "não publica", não pode ser escolhida no post e o cartão aponta o passo do guia.
- [x] **CA-7** — Dado um post publicado por conta do formulário, quando o usuário abre o post, então vê métricas e comentários lidos com o token dessa conta.
- [x] **CA-8** — Dada uma conta do formulário com token a menos de 10 dias de vencer, quando a rotina diária roda, então o token é trocado pelo renovado e a nova validade é gravada.
- [x] **CA-9** — Dada a renovação recusada pelo Instagram, quando a rotina roda, então a conta vira "precisa reconectar" e uma notificação é criada para owners e admins.
- [x] **CA-10** — Dado um post agendado para conta desativada, quando chega a hora, então o post falha com "A conta está desativada nos Satélites" e não entra em nova tentativa.
- [x] **CA-11** — Dado um post de outra empresa, quando sua conta é resolvida para publicar, então uma conta de mesmo ID em outra empresa nunca é usada.
- [ ] **CA-12** — Dado um post para Instagram e Facebook, quando é publicado, então o Instagram sai pela conta dos Satélites e o Facebook pela página da conexão da Meta, e a falha de um não desfaz o outro (comportamento da spec 0057).
- [x] **CA-13** — O plano de publicação gravado no Inngest não contém token (inspeção do objeto).
- [x] **CA-14** — `pnpm guides:check` passa; o guia de conexão tem os passos das três permissões.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Post antigo de teste com `targetIgAccountId` que não existe nos Satélites | Tratado como "sem conta": o criador pede para escolher; publicar devolve "Escolha a conta do Instagram". |
| CB-2 | Empresa com uma conta só e post sem conta escolhida | Usa a única conta, como hoje. |
| CB-3 | Empresa com várias contas e post sem conta escolhida | Não publica: pede a escolha. Nunca escolhe sozinho. |
| CB-4 | Mesma conta conectada duas vezes, pelo formulário e pela Meta | Os IDs são diferentes em cada conexão, então são duas linhas. A página da conta avisa que parecem ser a mesma (mesmo @) e sugere manter uma. |
| CB-5 | Token renovado enquanto um post está no meio da publicação | O passo seguinte lê o token novo. O token antigo continua válido até a data original, então não há janela de falha. |
| CB-6 | Token colado com menos de 24h de vida | O Instagram recusa renovar tokens com menos de 24h. A rotina só tenta depois disso. |
| CB-7 | Conta conectada antes desta spec, sem capacidades conferidas | A checagem diária confere na primeira rodada; até lá a conta aparece como "a conferir" e pode ser escolhida. |
| CB-8 | Permissão de insights ausente, publicação presente | Publica normalmente; a tela do post mostra "Esta conta não tem permissão de métricas" no lugar dos números. |
| CB-9 | Limite diário de publicações da conta atingido | Falha com a mensagem do limite e o horário em que libera; não marca a conta como "precisa reconectar". |
| CB-10 | Conta conectada pela Meta com a variável `META_PUBLISH_SCOPES_ENABLED` desligada | A conferência de capacidades marca "não publica"; o cartão explica que a conexão da Meta não pediu a permissão. |

## 6. Decisões de design

### D-1 — Publicar é um port do módulo `social`

- **Escolha**: novo port `ContentPublisher` em `src/modules/social/ports/`, com
  as operações que o Planner precisa: criar o contêiner de mídia, consultar o
  processamento, publicar, ler o link, ler métricas, ler e moderar comentários,
  consultar o limite de publicações. Dois adaptadores para o Instagram, um por
  forma de conexão, que diferem em host e token. O Planner recebe o port pronto
  da composição do módulo, a partir do id da conta.
- **Por quê**: o módulo já resolve credencial, host e forma de conexão para o
  Comments. Repetir essa escolha no Planner criaria o segundo lugar que sabe
  ler o token de uma conta.
- **Alternativas descartadas**: (a) passar um "host base" como parâmetro para
  `planner-graph.ts` e resolver o token no Planner — mais curto, mas o Planner
  passaria a decifrar credencial de `SocialChannel` e a conhecer `authMode`;
  (b) estender `ChannelGateway` — ele é o port de conversa (mensagens e
  comentários de automação); publicação é outra responsabilidade e outra rede
  pode ter uma sem a outra.
- **Consequência**: `planner-graph.ts` perde as funções de Instagram, que viram
  os adaptadores; ficam nele só as de página do Facebook. O workflow do Inngest
  (`publish-workflow.ts`) mantém a orquestração e troca as chamadas.

### D-2 — `MetaPublishAccount` fica só para páginas do Facebook

- **Escolha**: o Planner deixa de ler linhas `IG_BUSINESS` de
  `MetaPublishAccount`. A tabela e as linhas ficam: a conexão pela Meta nos
  Satélites (spec 0061) usa o token de página guardado ali para criar a conta
  em `SocialChannel`.
- **Consequência**: o fallback da conexão antiga (`PlatformIntegration` META,
  CB-5 da spec 0057) é removido para Instagram e mantido para Facebook.

### D-3 — Capacidades conferidas por chamada de leitura, guardadas na conta

- **Escolha**: duas colunas em `SocialChannel` — `canPublish` e
  `canReadInsights`, nulas enquanto não conferidas — preenchidas no conectar,
  no trocar credencial e na checagem diária. A conferência é uma chamada de
  leitura que só responde com a permissão: o limite de publicações da conta,
  para publicar; uma métrica da conta, para insights.
- **Por quê**: o token do app do Instagram não tem um endpoint que liste as
  permissões concedidas. Descobrir só na hora de publicar é tarde: o post
  agendado falha sem ninguém olhando.
- **A confirmar no primeiro teste com conta real**: que as duas chamadas de
  conferência existem nos dois hosts e falham por permissão, e não por outro
  motivo. Se não der, a conferência cai para "a conferir" e a primeira
  publicação define o valor.

### D-4 — Renovação diária do token, com a validade guardada

- **Escolha**: coluna `credentialsExpiresAt` em `SocialChannel`. Rotina diária
  do Inngest renova o token das contas do formulário que vencem em até 10 dias
  (ou sem validade conhecida e conectadas há mais de 24h), grava o token novo
  cifrado e a nova validade.
- **Por quê**: 10 dias dão várias tentativas diárias antes do vencimento.
- **Consequência**: contas conectadas pela Meta não entram — o token de página
  delas não vence por tempo e já é atualizado pela reconexão da Meta.

### D-5 — O post continua guardando o ID da conta na rede

- **Escolha**: `targetIgAccountId` não muda de significado nem vira chave
  estrangeira. A conta é resolvida por `(empresa, INSTAGRAM, externalAccountId)`.
- **Por quê**: kit da marca (0070) e Comments do post (0059) já resolvem assim;
  reconectar a conta troca a linha mas não o ID, e os posts não se perdem.
- **Alternativas descartadas**: `socialChannelId` no post — desconectar e
  conectar de novo deixaria os posts órfãos.

## 7. Impacto

- [x] Schema / migration — `social_channels`: `can_publish`, `can_read_insights`, `credentials_expires_at`, todas nulas. Só aditiva
- [x] Procedures oRPC — `nasaPlanner.v2.publishing.listAccounts` e `calendar` passam a devolver contas dos Satélites para Instagram; `socialAccounts.list` devolve capacidades e validade
- [ ] Realtime
- [x] Automações (Inngest) — workflow de publicação troca a origem do token; checagem diária cobre `SocialChannel`; nova rotina de renovação
- [ ] Env vars novas
- [x] Breaking change para clientes existentes — conta conectada só pela Meta, sem linha nos Satélites, deixa de aparecer no Planner (CA-5). Aceito: sem uso real em produção
- [x] Documentação obrigatória — `docs/nasa-planner-overview.md`, `docs/comments-overview.md`, `docs/arquitetura-evolucao-overview.md` (port novo no módulo), `docs/comments-meta-producao.md` (permissões do app); guia de conexão e `pnpm guides:check`; ritual pós-migration

Arquivos principais:

- `prisma/schema.prisma`, migration nova
- `src/modules/social/ports/content-publisher.ts` (novo), `infra/instagram/` (dois adaptadores), `index.ts`, `application/connect-channel.ts`
- `src/features/nasa-planner/server/publishing/resolve-targets.ts`, `publish-workflow.ts`, `post-metrics.ts`, `post-comments.ts`, `publish-accounts.ts`
- `src/http/meta/planner-graph.ts`
- `src/inngest/functions/nasa-planner/publish-accounts-health.ts`, nova função de renovação
- `src/app/router/nasa-planner/v2/publishing.ts`, `calendar.ts`, `creations.ts`; `src/app/router/social-accounts/index.ts`
- `src/features/nasa-planner/components/v2/composer-script-step.tsx` e demais leitores de `accounts`
- `src/features/social-accounts/components/social-account-card.tsx`, `lib/instagram-connect-guide.json`
- `src/features/external-ai/server/mcp/planner-mcp-tools.ts`, ferramenta do Astro do Planner

## 8. Plano de testes

Sem runner no projeto (CLAUDE.md, regra 20): os casos de servidor viram
`scripts/planner-publish-accounts-qa-check.ts` contra o Postgres local, com um
`ContentPublisher` falso no lugar da rede.

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-4, CA-5, CA-11, CB-1, CB-2, CB-3 | script | Resolução da conta do post com combinações de contas e empresas |
| CA-6, CB-7, CB-8, CB-10 | script | Conferência de capacidades com publicador falso que recusa cada permissão |
| CA-8, CA-9, CB-6 | script | Rotina de renovação com respostas simuladas |
| CA-10, CA-13 | script | Plano de publicação para conta desativada; inspeção do plano |
| CA-12 | script | Plano com Instagram e Facebook |
| CA-1, CA-2, CA-7 | **manual, conta real** | Conta de teste conectada pelo formulário, um post por tipo |
| CA-3 | manual, conta real | Conta conectada pela Meta, com `META_PUBLISH_SCOPES_ENABLED=true` |
| CA-14 | automatizado | `pnpm guides:check` |

Os casos manuais precisam de um app do Instagram com as três permissões e de
uma URL pública para a mídia (o Instagram baixa o arquivo pela internet;
`localhost` não serve).

## 9. Riscos e rollback

- **Publicação pelo host do Instagram nunca foi testada neste projeto.** Os
  endpoints são os mesmos da documentação, mas diferenças de parâmetro ou de
  erro só aparecem com conta real. Mitigação: CA-1 e CA-2 manuais antes do merge.
- **ID da conta diferente por forma de conexão** (CB-4). A mesma conta pode
  virar duas linhas e dois kits. Mitigação: aviso na página da conta.
- **Renovação silenciosamente quebrada** deixa tudo funcionando por até 60 dias
  e depois derruba todas as contas do formulário em sequência. Mitigação: a
  rotina registra quantas renovou e quantas falharam; a validade fica visível
  no cartão.
- **Limite de publicações por conta em 24h** (a documentação fala em 100, a
  confirmar): empresas que publicam muito por API batem nele. Mitigação: CB-9.
- **Rollback**: a migration é aditiva. Revertendo o código, o Planner volta a
  ler `MetaPublishAccount`; as colunas novas ficam ignoradas. Tokens renovados
  continuam válidos.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-05 | João Gabriel | Rascunho. Decisões do dono do produto: Facebook segue como extra pela Meta; sem migração (não há uso real em produção); renovação de token na mesma etapa |
| 2026-10-05 | João Gabriel | Aprovada e **implementada**. Marcados os critérios provados por `scripts/planner-publish-accounts-qa-check.ts` e por `pnpm guides:check`. Abertos, dependem de conta real: CA-1, CA-2, CA-3, CA-7; CA-12 (Instagram + Facebook no mesmo post) não tem caso no script. Desvios do texto: (1) D-1 previa dois adaptadores; ficou **um** `InstagramContentPublisher` configurado por forma de conexão, porque só host, token e nó da resposta privada mudam; (2) RF-10: a notificação e o estado "precisa reconectar" existem, mas o aviso no cartão do post agendado não foi feito — o calendário mostra "reconectar" no filtro de contas e de clientes; (3) CB-4 (aviso de conta duplicada pelas duas formas de conexão) não foi implementado; (4) renovação recusada só derruba a conta quando a validade já é conhecida, para o token com menos de 24h não virar "precisa reconectar" (CB-6); (5) acrescentado o RF-14 a pedido do dono do produto; (6) nova procedure `socialAccounts.recheckCapabilities` ("conferir de novo" no cartão) |
| 2026-10-05 | João Gabriel | **Primeira publicação real** pelo token do app do Instagram (conta de teste, post de imagem): CA-1 e CA-7 provados, e a renovação do token e a conferência de capacidades (D-3) confirmadas na rede. O teste achou um defeito: publicar logo depois de criar o contêiner de imagem devolve "Media ID is not available" (9007/2207027). O workflow agora espera o contêiner ficar pronto para qualquer mídia (3s entre checagens para imagem, 15s para vídeo) e esse erro passou a ser tentado de novo. CA-2 (carrossel, reels, story) e CA-3 (conta pela Meta) seguem abertos |
| 2026-10-05 | João Gabriel | **CA-2 provado com conta real**: carrossel (2 imagens), story de imagem e reel publicados pelo workflow do Planner na conta de teste. Story de vídeo e carrossel com vídeo não foram testados. Observação do teste: a Meta não baixa vídeo hospedado no próprio CDN do Instagram (contêiner vira ERROR sem detalhe); com o arquivo no bucket do projeto o reel publicou. Segue aberto só o CA-3 (conta conectada pela Meta) |
