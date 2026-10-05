---
id: 0069
titulo: Conectar várias contas do Instagram pelos Satélites e escolher a conta no Comments
dominio: comments
status: aprovada
autor: João Gabriel
criada: 2026-10-05
atualizada: 2026-10-05
branch: feature/comments-contas-instagram-satelites-20261005
pr: # empilhada sobre a PR 431
peso: completa
---

# 0069 — Conectar várias contas do Instagram pelos Satélites e escolher a conta no Comments

> Cobre as etapas 1 (Satélites) e 2 (Comments escolhe a conta), entregues juntas.
> A etapa 3 (Planner publica pela conta conectada e mostra contas no lugar de
> clientes) tem spec própria e depende desta.

---

## 1. Contexto

Hoje existem **três** jeitos de "conectar o Instagram" e nenhum conversa com o outro:

| Onde | Como | Onde grava | Quem usa |
| --- | --- | --- | --- |
| Comments | Formulário simplificado (ID da conta, token, app secret) com guia passo a passo (spec 0047) | `SocialChannel` | Comments, tracking-chat |
| Satélites → Meta | Login da Meta (OAuth) | `MetaPublishAccount` | Planner; Comments via "Conectar pela Meta" (spec 0061) |
| Satélites → cartão "Instagram DM" | Formulário genérico (App ID, App Secret, token de página) | `PlatformIntegration.config` | Webhook legado de DM |

Consequências para o usuário:

- Para usar o Instagram no Planner ele precisa primeiro conectar a Meta; para o
  Comments, conectar de novo dentro do Comments.
- **Uma empresa só pode ter uma conta.** É invariante do código (spec 0024, D-13):
  `PrismaChannelRepository.currentRow()` devolve "a conta da empresa" (a mais
  antiga) e é usada por 11 pontos de leitura.
- O cartão "Instagram DM" dos Satélites pede dados que não alimentam nem o
  Comments nem o Planner.

A abstração para várias redes já existe: `src/modules/social` é Ports & Adapters
(spec 0024, D-10), com a porta `ChannelGateway` e um adapter, o do Instagram.
O que falta é o cadastro de contas ser **da empresa** (Satélites), e não de um app.

## 2. Objetivo

Nos Satélites, o admin conecta **uma ou mais** contas do Instagram pelo formulário
simplificado com o passo a passo; no Comments, o usuário escolhe em qual dessas
contas está trabalhando, e cada automação pertence a uma conta.

### Não-objetivos

- **Planner publicar pela conta conectada e trocar o seletor de clientes por
  contas** — etapa 3. Inclui a porta de publicação e a conferência da permissão
  de publicar.
- **Outras redes** (Facebook, TikTok). O desenho permite; nenhum adapter novo entra.
- **Remover o "Conectar pela Meta"**. Continua como segunda opção.
- **Mover `META_WEBHOOK_VERIFY_TOKEN` para o banco.** Esse token é do webhook
  único do app da Meta da plataforma; a Meta aceita um por app. As contas
  conectadas pelo formulário **já** têm URL e verify token próprios no banco
  (spec 0024, D-11) e não dependem da variável.
- **Trocar o verify token fixo `"nasa-verify"`** de `oauth-finalize.ts`. Mexe no
  webhook legado de DM; fica registrado em §9 para spec própria.
- **Migrar ou apagar `MetaPublishAccount`**. Segue sendo a fonte do Planner até a etapa 3.
- **Mover automações de uma conta para outra.** Automação nasce e fica na conta em que foi criada.

## 3. Requisitos

### Funcionais — Satélites

| ID | Requisito |
| --- | --- |
| RF-1 | O cartão do Instagram nos Satélites abre a lista de **contas conectadas** da empresa: foto/@, estado (ativa, precisa reconectar, desativada), forma de conexão (manual ou pela Meta) e últimos 4 caracteres do token. |
| RF-2 | "Adicionar conta" abre o guia passo a passo do Comments (spec 0047), com os mesmos campos: ID da conta, token de acesso e app secret. O verify token continua sendo gerado pelo sistema, nunca digitado. |
| RF-3 | A empresa pode ter **várias** contas do Instagram, até 20. Adicionar uma conta nunca altera nem remove outra. |
| RF-4 | A credencial é conferida na Meta **antes** de salvar (comportamento atual de `connectChannel`): token recusado ou de outra conta não cria nada. |
| RF-5 | Cada conta tem URL de webhook e verify token próprios, exibidos no guia e recuperáveis depois na lista ("Ver dados do webhook"). |
| RF-6 | Por conta: trocar credencial (reconectar), reenviar a inscrição nos eventos, desativar e reativar. Desativar preserva automações, histórico e URL do webhook (comportamento atual). |
| RF-7 | "Conectar pela Meta" continua disponível e grava no **mesmo** cadastro, com forma de conexão "pela Meta". |
| RF-8 | O cartão "Instagram DM" deixa de mostrar o formulário genérico (App ID / App Secret / token de página). Integrações já salvas nesse formato continuam funcionando; só não é possível criar novas por ele. |
| RF-9 | O guia ganha um passo pedindo a permissão de publicar conteúdo, para as contas servirem ao Planner na etapa 3 sem reconexão. O passo entra só com texto; o print é adicionado depois. |
| RF-10 | Conectar, reconectar, desativar e reativar: só owner e admin. Listar: qualquer membro, sem nunca receber token, app secret ou verify token. |
| RF-11 | Os botões novos dos Satélites e do Comments ganham âncora do Astro Guia (CLAUDE.md, regra 21). |

### Funcionais — Comments

| ID | Requisito |
| --- | --- |
| RF-12 | O Comments mostra um **seletor de conta** com as contas do Instagram da empresa (foto, @ e estado). A conta escolhida fica na URL e é lembrada no navegador do usuário. |
| RF-13 | A lista de automações, o histórico de execuções e a escolha de publicações mostram só o que é da conta selecionada. |
| RF-14 | Automação criada pertence à conta selecionada no momento. O editor mostra de qual conta ela é. |
| RF-15 | Ativar uma automação confere o estado **da conta dela**, não de outra. |
| RF-16 | O tracking que recebe os leads do Instagram (spec 0062) é escolhido **por conta**. |
| RF-17 | A tela de conexão do Comments passa a ser a mesma dos Satélites: "Adicionar conta" abre o mesmo guia, e há atalho "Gerenciar contas nos Satélites". O Comments não tem mais "Trocar conta". |
| RF-18 | No chat do tracking, a resposta a um lead do Instagram sai pela conta que recebeu a mensagem dele. |
| RF-19 | No Planner, a automação de Comments de um post usa a conta do Instagram **do post**; sem conta conectada correspondente, a tela pede para conectá-la nos Satélites. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Nenhuma leitura do módulo devolve "a conta da empresa" implicitamente. Toda operação recebe o `channelId`. A única exceção é o fallback de conversas antigas do chat (D-3). |
| RNF-2 | Segredos continuam cifrados (AES-256-GCM, `AI_SECRETS_KEY`) e fora de qualquer resposta ao navegador. |
| RNF-3 | Teto de 20 contas do Instagram por empresa, em constante nomeada. |
| RNF-4 | Sem migration: `SocialChannel` já comporta várias linhas por empresa (`@@unique([provider, externalAccountId])`), `SocialAutomation.channelId` e `SocialChannel.leadTrackingId` já existem. |
| RNF-5 | Todo `channelId` recebido do navegador é conferido contra a empresa da sessão antes de qualquer uso. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dada uma empresa sem Instagram, quando o admin conclui o guia nos Satélites com credenciais válidas, então a conta aparece na lista como ativa e o cartão do Instagram entra em órbita.
- [ ] **CA-2** — Dada uma empresa com a conta A conectada e com automações, quando o admin adiciona a conta B, então A continua ativa, com as mesmas automações, o mesmo histórico e a mesma URL de webhook, e a lista mostra A e B.
- [ ] **CA-3** — Dadas A e B conectadas, quando chega um evento no webhook de B, então ele é processado no canal B e nenhuma automação de A dispara.
- [ ] **CA-4** — Dado um token inválido ou de conta diferente do ID informado, quando o admin tenta conectar, então nada é salvo e a mensagem diz qual é o problema.
- [ ] **CA-5** — Dada uma conta já conectada em **outra** empresa, quando o admin tenta conectá-la, então recebe "conta já conectada em outra empresa" e nada é salvo.
- [ ] **CA-6** — Dada uma conta já conectada na **mesma** empresa, quando o admin a conecta de novo, então a credencial dela é atualizada e nenhuma linha nova é criada.
- [ ] **CA-7** — Dadas A e B, quando o usuário escolhe B no seletor do Comments, então a lista mostra só as automações de B e a URL passa a identificar B; ao recarregar a página, B continua selecionada.
- [ ] **CA-8** — Dado um membro que não é owner nem admin, quando abre os Satélites, então vê a lista sem botões de gerenciar, e as chamadas de conectar/desativar devolvem FORBIDDEN.
- [ ] **CA-9** — Dada a conta B desativada, quando o admin a reativa, então volta a ativa e a inscrição nos eventos é reenviada.
- [ ] **CA-10** — Dada a lista de contas, quando inspecionada a resposta da API, então não há token, app secret nem verify token (só os 4 últimos caracteres do token).
- [ ] **CA-11** — Dada uma empresa com 20 contas, quando o admin tenta a 21ª, então recebe a mensagem de limite e nada é salvo.
- [ ] **CA-12** — `pnpm guides:check` passa com as âncoras novas e com o guia apontando para os componentes movidos.
- [ ] **CA-13** — Dada B selecionada, quando o usuário cria uma automação, então ela é gravada com o `channelId` de B e não aparece com A selecionada.
- [ ] **CA-14** — Dada A em "precisa reconectar" e B ativa, quando o usuário ativa uma automação de B, então ativa; quando ativa uma de A, então recebe o erro de reconexão.
- [ ] **CA-15** — Dadas A e B com trackings diferentes escolhidos, quando chega um comentário em B, então o lead é criado no tracking de B.
- [ ] **CA-16** — Dado um lead que comentou em B, quando o atendente responde pelo chat, então a resposta sai por B.
- [ ] **CA-17** — Dado um `channelId` de outra empresa, quando enviado a qualquer procedure do Comments ou dos Satélites, então a resposta é NOT_FOUND e nada é lido nem alterado.
- [ ] **CA-18** — Dado um post do Planner apontando para a conta B, quando o usuário configura a automação de Comments do post, então ela é criada em B, mesmo com A sendo a conta mais antiga.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | **Limpeza de "órfãs" do `connect` atual.** Hoje, ao trocar de conta, o código apaga (se vazias) ou desativa **todas** as outras linhas da empresa, por considerá-las restos do bug da D-13. Com várias contas, isso destruiria as contas adicionadas. | A limpeza é removida. É o item de maior risco desta spec e tem teste dedicado (CA-2). |
| CB-2 | Empresa que já tem linhas desativadas deixadas por essa limpeza antiga | Aparecem na lista como "desativada", com opção de reativar. Nada é apagado automaticamente. |
| CB-3 | Conta selecionada no Comments é desativada | Continua selecionável, marcada como desativada; as automações dela aparecem, mas não ativam (CA-14). O Comments não pula sozinho para outra conta. |
| CB-4 | URL do Comments aponta para conta que não existe mais ou é de outra empresa | Cai na primeira conta ativa da empresa (ou na mais antiga, se nenhuma estiver ativa) e corrige a URL. |
| CB-5 | Empresa sem nenhuma conta | O Comments mostra o estado vazio com "Adicionar conta" (mesmo guia dos Satélites). |
| CB-6 | Duas pessoas conectam a mesma conta ao mesmo tempo | O unique `(provider, externalAccountId)` decide; a segunda recebe "já conectada" (mesma empresa: tratada como atualização; outra empresa: CA-5). |
| CB-7 | Token expira ou é revogado depois de conectado | Comportamento atual: a conta vai para "precisa reconectar" no primeiro envio recusado. A lista e o seletor mostram o estado e o botão de reconectar. |
| CB-8 | Reconectar informando token de **outra** conta | Recusado: reconectar não troca a conta de uma linha. Quem quer outra conta usa "Adicionar conta". Isso elimina a troca de conta dentro da mesma linha, origem do bug da D-13. |
| CB-9 | Conta conectada "pela Meta" e depois adicionada manualmente (ou o inverso) | É a mesma conta (mesmo ID): atualiza a linha existente e a forma de conexão passa a ser a última usada. |
| CB-10 | A inscrição nos eventos falha depois de salvar | Comportamento atual: a conta fica salva e a lista mostra aviso com "Reenviar inscrição". |
| CB-11 | Usuário fecha o guia no meio, depois de conectar mas antes do passo do webhook | A conta já está na lista; "Ver dados do webhook" reabre o guia nesse passo. |
| CB-12 | Integração legada do cartão "Instagram DM" ativa em `PlatformIntegration` | Continua recebendo DMs pelo webhook legado. Na lista aparece um aviso "conexão antiga" com link para adicionar pelo novo fluxo; não é migrada automaticamente. |
| CB-13 | Conversa do chat criada **antes** desta spec, sem registro de qual conta a recebeu | A resposta sai pela conta mais antiga da empresa — o comportamento de hoje. Mensagens novas passam a registrar a conta (D-3). |
| CB-14 | Lead interagiu com A e depois com B | Cada mensagem registra a própria conta; a resposta usa a conta da mensagem citada ou, sem citação, a da última mensagem recebida do lead. |
| CB-15 | Conta B sem tracking escolhido | Cai no primeiro tracking da empresa, como hoje (spec 0062). |
| CB-16 | Post do Planner sem conta definida (`targetIgAccountId` vazio) e empresa com mais de uma conta | A tela de automação do post pede para escolher a conta do post antes; nada é criado numa conta "padrão". |
| CB-17 | Automação do Planner já vinculada a uma conta, e o post passa a apontar para outra | A tela avisa que a automação é da conta anterior e oferece recriá-la na conta nova; não migra sozinha. |

## 6. Decisões de design

### D-1 — Revoga a D-13 da spec 0024: várias contas por empresa

- **Escolha**: a empresa pode ter N contas por rede. O repositório troca
  `findForTenant()` / `findWithCredentials()` por `listForTenant()`,
  `findById(channelId)`, `findWithCredentialsById(channelId)` e
  `findByExternalAccountId(provider, externalAccountId)`, todas escopadas na empresa.
- **Por que a D-13 existia**: `connect` criava uma segunda linha que nenhuma
  leitura enxergava. A causa era leitura e escrita discordarem sobre "qual é a
  linha", não a existência de várias linhas.
- **Como o bug não volta**: (a) conectar é sempre por `(provider, externalAccountId)`
  — existe na empresa, atualiza; não existe, cria; (b) reconectar atua num
  `channelId` explícito e recusa conta diferente (CB-8); (c) nenhuma operação
  troca a conta de uma linha existente; (d) não existe mais leitura sem `channelId`.
- **Alternativas descartadas**: manter uma conta por empresa e criar uma empresa
  por Instagram (é o modelo atual do Planner; obriga a criar empresas só para
  ter outro perfil).
- **Consequência**: atualizar o changelog da spec 0024 marcando a D-13 como revogada.

### D-2 — `SocialChannel` é o cadastro único; nenhuma tabela nova

- **Escolha**: as contas conectadas são linhas de `SocialChannel`. O modelo já é
  agnóstico de rede (`provider`) e já guarda credencial cifrada, estado, webhook
  e tracking de leads por conta.
- **Alternativas descartadas**: tabela nova "SocialAccount" com `SocialChannel`
  apontando para ela (duas tabelas para a mesma coisa, com migração de dados);
  reaproveitar `PlatformIntegration` (config em JSON sem cifra e sem unicidade por conta).
- **Consequência**: `MetaPublishAccount` continua existindo em paralelo para o
  Planner até a etapa 3, que decide a convergência.

### D-3 — A conta vem sempre de quem chama; fallback só para conversas antigas

- **Escolha**: cada ponto que hoje pede "a conta da empresa" passa a saber qual é:

  | Ponto | De onde vem a conta |
  | --- | --- |
  | Telas e procedures do Comments | `channelId` do seletor (RF-12) |
  | Ativar automação | `automation.channelId` |
  | Resposta pelo chat | `channelId` gravado na mensagem recebida |
  | Automação de um post do Planner | conta do post (`targetIgAccountId`) |
  | Tracking de leads | a própria conta |

- **Fallback**: mensagens do Instagram passam a gravar `channelId` em
  `metadata.instagram`. Conversa antiga sem esse dado usa a conta mais antiga da
  empresa (CB-13) — única leitura implícita que sobra, isolada numa função com
  nome próprio no tracking-chat.
- **Alternativas descartadas**: coluna nova na conversa (migration para um dado
  que só as conversas antigas não têm).

### D-4 — Feature própria para a tela de contas

- **Escolha**: componentes e hooks em `src/features/social-accounts/`; procedures
  em `src/app/router/social-accounts/`. O guia de conexão
  (`instagram-connect-guide.*` e o dialog) sai de `features/comments` e vai para lá.
- **Por quê**: Satélites, Comments e Planner consomem a mesma tela. Pela regra de
  domínio fechado (CLAUDE.md), o que duas features usam vira feature própria.
- **Consequência**: `features/comments` e `features/integrations` importam de
  `features/social-accounts`; o inverso não acontece. As procedures de conexão
  saem de `comments.*` (`connectChannel`, `disconnectChannel`, `reactivateChannel`,
  `repairSubscription`, `getWebhookSetup`) e passam a existir só em `socialAccounts.*`.

### D-5 — Permissão de publicar entra no guia agora, a conferência depois

- **Escolha**: o passo a passo passa a pedir também a permissão de publicação de
  conteúdo (RF-9). O passo entra sem print. A conferência automática de quais
  permissões o token tem fica para a etapa 3.
- **Consequência**: quem conectou antes desta spec pode precisar gerar token novo
  quando o Planner passar a usar a conta; a etapa 3 trata esse aviso.

### D-6 — Conta selecionada mora na URL, não no banco

- **Escolha**: `?conta=<channelId>` na URL do Comments, com a última escolha
  lembrada em `localStorage`.
- **Alternativas descartadas**: preferência por usuário no banco (migration e
  procedure para um estado de tela); estado global Zustand sem URL (link
  compartilhado abriria em outra conta).

## 7. Impacto

- [ ] Schema / migration — **não** (RNF-4)
- [x] Procedures oRPC — novo grupo `socialAccounts` (`list`, `connect`, `reconnect`, `disconnect`, `reactivate`, `repairSubscription`, `getWebhookSetup`); procedures do Comments que dependem de conta passam a exigir `channelId` (`listAutomations`, `createAutomation`, `listContent`, `getLeadTracking`, `setLeadTracking`); `comments.getChannel` e as procedures de conexão do Comments são removidas (D-4)
- [ ] Realtime
- [ ] Automações (Inngest)
- [ ] Env vars novas
- [x] Breaking change para clientes existentes — o Comments perde o "Trocar conta" (RF-17); contrato das procedures acima muda
- [x] Documentação obrigatória — `docs/comments-overview.md`; `docs/arquitetura-evolucao-overview.md` (regra 19, muda `src/modules/social`); changelog da spec 0024 (D-13); `pnpm guides:check` (regra 21)

Arquivos principais:

- `src/modules/social/ports/repositories.ts`, `infra/prisma-channel-repository.ts`, `application/connect-channel.ts`, `application/activate-automation.ts`
- `src/app/router/social-accounts/` (novo), `src/app/router/comments/channel.ts`, `automations.ts`
- `src/features/social-accounts/` (novo), `src/features/comments/components/`, `hooks/`, `server/lead-tracking.ts`, `server/meta-login-channel.ts`
- `src/features/integrations/components/satellites/`, `integrations-page.tsx` (cartão "Instagram DM")
- `src/features/tracking-chat/server/instagram/`, `lib/instagram-message-metadata.ts`
- `src/features/nasa-planner/server/comments-link.ts`

## 8. Plano de testes

O projeto ainda não tem runner de teste (CLAUDE.md, regra 20). Os casos de
repositório abaixo viram script em `scripts/` contra o Postgres local até o
runner existir; os demais são manuais.

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-2, CA-6, CB-1 | script | Conectar A, criar automação, conectar B, reconectar A: contar linhas e conferir que automação e `webhookPathToken` de A não mudaram |
| CA-3, CA-15 | script | Enviar payload assinado ao webhook de B; conferir `SocialInboundEvent.channelId` e o tracking do lead |
| CA-5, CA-11, CB-6 | script | Duas empresas, mesma conta; 21ª conta |
| CA-13, CA-14, CA-17 | script | Criar e ativar automação por conta; `channelId` de outra empresa em cada procedure |
| CA-1, CA-4, CA-9, CB-10, CB-11 | manual | Conta real de teste da Meta, guia ponta a ponta nos Satélites |
| CA-7, CB-3, CB-4, CB-5 | manual | Seletor do Comments com duas contas, uma desativada, e URL adulterada |
| CA-16, CB-13, CB-14 | manual | Responder pelo chat a lead de cada conta e a uma conversa antiga |
| CA-18, CB-16, CB-17 | manual | Automação de Comments num post do Planner apontando para B |
| CA-8, CA-10 | manual | Usuário com papel `member`; inspecionar a resposta de `socialAccounts.list` |
| CA-12 | automatizado | `pnpm guides:check` |

## 9. Riscos e rollback

- **Perda de contas por causa da limpeza de órfãs (CB-1).** Se a limpeza não for
  removida junto, a primeira conexão pelo fluxo antigo desativa ou apaga as
  demais contas. Mitigação: remoção e teste no mesmo commit.
- **Automações "sumindo" para o usuário.** Depois do deploy, quem tem linhas
  antigas desativadas (CB-2) vê mais de uma conta no seletor; se abrir na errada,
  parece que as automações sumiram. Mitigação: o seletor abre na primeira conta
  **ativa** e mostra a contagem de automações por conta.
- **Rollback**: sem migration, reverter o código basta. Contas extras criadas no
  período ficam no banco; o código antigo as trataria como "órfãs" e as
  desativaria na próxima troca de conta — por isso, ao reverter, desativar antes
  as contas além da mais antiga de cada empresa.
- **Verify token fixo `"nasa-verify"`** (`src/app/router/integrations/oauth-finalize.ts`):
  valor padrão no código quando a variável de ambiente falta. Fora do escopo
  (webhook legado), registrado aqui para spec própria.
- **PR empilhada**: a branch nasce da PR 431. Se a 431 mudar antes do merge, esta
  precisa ser atualizada sobre ela.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-05 | João Gabriel | Criada, cobrindo só os Satélites |
| 2026-10-05 | João Gabriel | Decisões do dono do produto: limite fixo de 20 contas; passo de permissão de publicar sem print; etapa 2 (Comments escolhe a conta) incorporada, o que eliminou a "conta padrão" temporária; branch própria empilhada sobre a PR 431 |
