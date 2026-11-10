---
id: 0135
titulo: Conectar o MCP do ÓRBITA pelo ChatGPT e outras IAs (OAuth)
dominio: external-ai
status: em-revisao
autor: João Gabriel
criada: 2026-11-10
atualizada: 2026-11-10
branch: claude/planner-mcp-cross-org-instagram-cadd3f
pr:
peso: completa
---

# 0135 — Conectar o MCP do ÓRBITA pelo ChatGPT e outras IAs (OAuth)

## 1. Contexto

O MCP do ÓRBITA (spec 0065) só aceita a chave `orb_live_…` colada no cabeçalho `Authorization`. Isso serve ao Claude Code e ao Codex, mas **o ChatGPT e os conectores do claude.ai não aceitam chave colada**: eles só conectam um servidor MCP remoto por OAuth (o fluxo "Conectar → entrar na conta → Permitir"). A spec 0065, D-1, deixou o OAuth "para depois". Este é o depois.

O Quizio, outro produto da equipe, já fez isso (spec 044 de lá, ADR 0023), e a conexão foi testada por túnel com o ChatGPT (plano gratuito, "Adicionar servidor MCP personalizado") e com o Claude. Esta spec traz a mesma ideia, adaptada ao ÓRBITA.

Quem sente a dor: a equipe e os clientes que usam ChatGPT ou claude.ai no dia a dia e querem criar posts do Planner conversando com a própria IA, sem precisar do Claude Code.

## 2. Objetivo

Uma pessoa com conta no ÓRBITA cola `https://<domínio>/api/mcp` no ChatGPT, no claude.ai ou em outra IA compatível. Ela entra na conta, permite e passa a usar as ferramentas de **todos os apps do ÓRBITA a que ela tem acesso**: hoje o Planner, em todas as empresas em que tem acesso a ele, e o trafeGO, para a equipe. Os próximos apps entram no MCP sem mexer na conexão (D-7).

### Não-objetivos

- **Não cria conta** pelo fluxo de conexão: quem não tem conta não conecta.
- **Não muda quem acessa o trafeGO**: as ferramentas dele continuam só para a equipe (admin do sistema, spec 0131), também por OAuth.
- **Não traz agora as ferramentas de outros apps** (Tracking, Forms, Chat…). Esta spec só deixa o encaixe pronto; cada app novo no MCP tem a sua própria spec.
- **Não remove nem muda as chaves `orb_live_…`**: elas continuam valendo para o Claude Code, o Codex, o Cursor e as rotinas.
- **Não escolhe empresas na tela de permitir** (ver D-2).
- **Não muda as ferramentas** do MCP nem o que cada uma faz.
- **Não traz o "importar arquivo por link"** do Quizio. O `request_upload_url` continua o caminho para mandar mídia. Se o ChatGPT não conseguir enviar o arquivo, isso vira uma spec separada.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | O better-auth passa a ser também o servidor de autorização OAuth 2.1 das IAs, com os plugins oficiais `jwt`, `mcp` (sobre o `oauth-provider`) e `cimd`. |
| RF-2 | A IA se registra sozinha: primeiro pelo documento de metadados do cliente (CIMD) e, como alternativa, pelo registro dinâmico (DCR, RFC 7591), sem login. |
| RF-3 | Os endereços de descoberta respondem para qualquer origem (CORS `*`): `/.well-known/oauth-protected-resource/api/mcp` (RFC 9728) e `/.well-known/oauth-authorization-server/api/auth` (RFC 8414). |
| RF-4 | `/api/mcp` sem credencial, ou com credencial inválida, responde `401` com `WWW-Authenticate: Bearer resource_metadata="<origem>/.well-known/oauth-protected-resource/api/mcp"`, para a IA descobrir onde fazer o login. |
| RF-5 | Quem não está logado é levado ao `/sign-in` e, depois de entrar (e-mail ou Google), volta para a tela de permitir com o pedido intacto. |
| RF-6 | A tela **"Conectar ao ÓRBITA"** (`/conectar-ia`) mostra o nome que a IA registrou e o domínio para onde a pessoa volta, lista os apps a que a IA terá acesso (os que a pessoa pode usar hoje, ex.: "Planner" e, para a equipe, "trafeGO"), avisa que vale para todas as empresas da pessoa e tem **Permitir** e **Recusar**. Se o pedido for inválido ou tiver expirado, mostra isso em vez dos botões. |
| RF-7 | O token de acesso é um JWT de **1 hora** com a audiência `<origem>/api/mcp` (RFC 8707). O refresh token vence depois de **90 dias sem uso**. |
| RF-8 | A cada pedido, o `/api/mcp` confere a assinatura, o emissor, a audiência e a validade do token **e** que o consentimento (pessoa + IA) ainda existe. Se a conexão foi desfeita, o pedido seguinte já é recusado. |
| RF-9 | Na conexão OAuth, as empresas visíveis são as que a pessoa tem com permissão de ver o Planner **no momento do pedido** (`listPlannerOrganizations`). As escritas continuam conferidas por `assertCallerOrganization` com a ação certa. |
| RF-10 | Na conexão OAuth, os apps liberados são decididos **a cada pedido** pela regra de acesso de cada app (D-7): o Planner, se a pessoa tem o Planner em ao menos uma empresa; o trafeGO, se ela é admin do sistema. Quem deixa de ser admin perde as ferramentas do trafeGO já no pedido seguinte. As instruções do servidor juntam só as dos apps liberados. |
| RF-15 | Os apps do MCP ficam num registro único (`src/features/external-ai/server/mcp/apps.ts`). Cada app declara a chave, o nome que a tela mostra, as instruções, a regra de acesso e a função que registra as ferramentas. A rota `/api/mcp` só percorre esse registro. |
| RF-11 | A seção **IA externa** dos Satélites ganha: (1) o endereço do servidor com **Copiar**; (2) **"Como conectar"**, com o passo a passo do ChatGPT, do claude.ai e de "Outra IA" (por OAuth) e o comando com a chave para o Claude Code e o Codex, que é o que já existe; (3) **"IAs conectadas"**, com o nome e a data da conexão de cada uma e **Desconectar**. |
| RF-12 | **Desconectar** apaga o consentimento e os refresh tokens daquela IA para a pessoa. |
| RF-13 | Trocar a senha (em "Alterar senha", logado) desconecta todas as IAs da pessoa conectadas por OAuth. As chaves continuam valendo, porque têm ciclo de vida próprio e são revogadas na mesma tela. A redefinição por e-mail ("esqueci a senha") **não** desconecta nesta etapa: ver seção 9. |
| RF-14 | O `sourceActorLabel` dos posts criados por OAuth é o nome da IA ("ChatGPT"), como hoje é o nome da chave. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | O MCP continua sem estado (spec 0065, D-2). A conferência do token não guarda nada na memória do processo, exceto o cache das chaves públicas (JWKS) por 5 minutos, que é recarregado se a chave girar. |
| RNF-2 | A conferência por pedido custa **1 consulta a mais** (o consentimento), além das empresas e dos apps que já são resolvidos para a chave. Não se grava "último uso" por pedido. |
| RNF-3 | O registro de cliente (`/oauth2/register`) é limitado a 10 por minuto por IP. |
| RNF-4 | O build continua sem precisar de banco nem de segredo no import (regra 24a). |
| RNF-5 | Todos os pacotes `better-auth` e `@better-auth/*` ficam na **mesma versão fixada** (sem `^`). |

## 4. Critérios de aceite

- [x] **CA-1** — Dado um `POST /api/mcp` sem `Authorization`, então a resposta é `401` com `WWW-Authenticate` apontando para o `resource_metadata` (RF-4).
- [x] **CA-2** — Dado `GET /.well-known/oauth-protected-resource/api/mcp`, então a resposta tem `resource = <origem>/api/mcp`, o servidor de autorização e `Access-Control-Allow-Origin: *` (RF-3).
- [x] **CA-3** — Dado `GET /.well-known/oauth-authorization-server/api/auth`, então os metadados trazem os endpoints `authorize`, `token` e `register`, o PKCE `S256` e o suporte a CIMD (RF-2, RF-3).
- [x] **CA-4** — Dada uma pessoa deslogada que inicia a conexão, quando ela entra pelo `/sign-in`, então cai em `/conectar-ia` com o nome da IA e, ao **Permitir**, a IA recebe o código (RF-5, RF-6).
- [x] **CA-5** — Dado um pedido com a assinatura alterada ou expirada, então `/conectar-ia` mostra "pedido inválido" e não oferece Permitir (RF-6).
- [x] **CA-6** — Dada a conexão feita, quando a IA chama `list_clients`, então vê exatamente as empresas em que a pessoa tem permissão de ver o Planner (RF-9).
- [ ] **CA-7** — Dada a conexão feita, quando a pessoa sai de uma empresa, então essa empresa some do `list_clients` no pedido seguinte e o `create_draft` nela é recusado (RF-9).
- [x] **CA-8** — Dada a conexão feita, quando a pessoa clica **Desconectar**, então o pedido seguinte da IA, ainda com um token dentro da validade, recebe `401` (RF-8, RF-12).
- [x] **CA-9** — Dada a conexão feita, quando a pessoa troca a senha, então o pedido seguinte da IA recebe `401` (RF-13).
- [x] **CA-10** — Dado um token OAuth de uma pessoa que é admin do sistema, então as ferramentas `trafego_*` aparecem e as instruções incluem o fluxo do trafeGO. Para uma pessoa que não é admin, nenhuma `trafego_*` aparece. Quando a pessoa perde o admin, elas somem no pedido seguinte (RF-10).
- [x] **CA-16** — A rota `/api/mcp` não cita nenhum app pelo nome: o Planner e o trafeGO vêm do registro (RF-15).
- [x] **CA-11** — Dada uma chave `orb_live_…` válida, então tudo continua como antes, inclusive o escopo `trafego` (não-objetivo).
- [x] **CA-12** — Dado um token emitido para outra audiência, vencido ou assinado por outra chave, então `401` (RF-7, RF-8).
- [x] **CA-13** — Um post criado pelo ChatGPT por OAuth fica com `source = MCP` e `sourceActorLabel` igual ao nome da IA (RF-14).
- [ ] **CA-14** — Login por e-mail, login pelo Google, troca de empresa ativa, convite de membro, assinatura do Stripe e sync com o NERP continuam funcionando depois da subida do better-auth (RNF-5).
- [ ] **CA-15** — Verificação manual: o ChatGPT e o claude.ai se conectam por túnel (ngrok) e cada um cria um rascunho no Planner. O resultado é registrado no changelog.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Pessoa sem nenhuma empresa com Planner | Conecta normalmente; `list_clients` devolve lista vazia e a resposta explica que não há empresa liberada. |
| CB-2 | A IA registra um `redirect_uri` e o pedido chega com outro | Recusado pelo better-auth antes da tela de permitir. |
| CB-3 | A mesma pessoa conecta o ChatGPT duas vezes | Um consentimento só por (pessoa, IA): a segunda conexão substitui a primeira e não cria uma linha nova. |
| CB-4 | O token tem 1 h, mas a pessoa desconectou faz 1 minuto | `401` (RF-8). É o motivo da conferência por pedido. |
| CB-5 | Conexão sem uso há mais de 90 dias | O refresh falha e a IA pede o login de novo. |
| CB-6 | A chave de assinatura gira e o cache ainda tem a antiga | Lê o JWKS de novo uma vez antes de recusar (RNF-1). |
| CB-7 | Duas réplicas do container | Nada em memória além do cache de JWKS, que é só leitura. O limite do registro é por réplica (memória do better-auth), o que é aceito: ele só freia abuso. |
| CB-8 | Cadastro de IA por um bot, em massa | Limite do RNF-3. Clientes que nunca ganharam consentimento são apagados pela limpeza (seção 9). |
| CB-9 | O ChatGPT envia `resource` no pedido de token | Aceito; o token sai com essa audiência. Sem `resource`, a audiência padrão é o próprio `/api/mcp`. |
| CB-10 | Pessoa logada na empresa A abre a tela de permitir | A empresa ativa não importa: a conexão vale para todas as empresas com Planner (D-2). |
| CB-11 | O Bearer começa com `orb_live_` | Vai pelo caminho da chave, sem tentar ler JWT. |
| CB-12 | Usuário apagado | Os consentimentos e tokens caem em cascata e o pedido seguinte recebe `401`. |
| CB-13 | O sync NERP recebe um `Account` sem alteração | O bump não pode mudar o formato de `User`, `Account`, `Organization` ou `Member` que o sync replica. Se mudar, o bump para. |

## 6. Decisões de design

### D-1 — O better-auth faz o OAuth, com os plugins oficiais

- **Escolha**: subir `better-auth` e `@better-auth/stripe` de 1.6.5 para **1.7.14**, a mesma do Quizio, e adicionar `@better-auth/oauth-provider`, `@better-auth/mcp` e `@better-auth/cimd` na mesma versão fixada.
- **Alternativas descartadas**:
  - **Escrever o OAuth à mão**: DCR, CIMD, PKCE, metadados e JWKS são muita superfície de segurança, e o better-auth já é o dono das contas.
  - **Só chaves**: o ChatGPT e o claude.ai não aceitam.
  - **Provedor externo (Auth0, WorkOS)**: uma segunda base de usuários para sincronizar, além da que já existe com o NERP.
- **Consequência**: o bump mexe no login de todo o sistema. Os CA-14 são obrigatórios antes do merge. O `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` passa a ser o emissor e a audiência dos tokens, e trocar o domínio público exige reconectar as IAs.

### D-2 — A conexão OAuth vê todas as empresas com Planner, conferidas a cada pedido

- **Escolha**: o `ExternalAiCaller` da conexão OAuth não guarda lista de empresas. Em cada pedido, `organizationIds` vem de `listPlannerOrganizations(userId, "view")`. É o mesmo que o Planner web mostra (spec 0058) e não precisa de coluna nem tabela.
- **Alternativa descartada**: escolher as empresas na tela de permitir. Isso exigiria guardar a lista por consentimento, fazer uma tela a mais e decidir o que acontece quando a pessoa entra numa empresa nova. Quem quer restringir as empresas usa uma chave, que já tem essa escolha.
- **Consequência**: entrar numa empresa nova já a libera para a IA conectada. Isso foi aceito pelo usuário em 2026-11-10.

### D-3 — O JWT não se revoga, então o consentimento é conferido a cada pedido

- **Escolha**: além de verificar a assinatura, `/api/mcp` exige que o `oauthConsent` (pessoa, IA) exista. Desconectar ou trocar a senha apaga o consentimento e os refresh tokens.
- **Alternativa descartada**: tokens opacos com introspecção. Os clientes MCP pedem `resource`, que leva ao JWT, e a conferência do consentimento dá a revogação sem perder isso.
- **Consequência**: uma consulta a mais por pedido (RNF-2).

### D-4 — A tela de permitir é do ÓRBITA

- **Escolha**: `consentPage` aponta para `/conectar-ia`, uma página do app com o layout de autenticação. Ela lê o pedido assinado (`verifyOAuthQueryParams`) e o nome do cliente (`/oauth2/public-client`). Como qualquer um pode registrar uma IA com qualquer nome, a tela mostra também o **domínio de volta**, que é o que identifica de verdade quem pediu.
- **Consequência**: se o roteador do Next reescrever a query assinada (chaves repetidas), a assinatura quebra. O Quizio resolveu isso embrulhando a query inteira num único parâmetro base64url. Fazemos o mesmo se o teste mostrar o problema.

### D-5 — Uma identidade só para chave e OAuth

- **Escolha**: `authenticateExternalAiToken` passa a aceitar os dois tipos de credencial e devolve o mesmo `ExternalAiCaller`, com um campo `credential: "key" | "oauth"`. As ferramentas não mudam. `tokenId` passa a ser o id da chave ou o `clientId` da IA, e `label` o nome da chave ou o nome da IA.
- **Consequência**: na chave, `scopes` continua vindo do que foi gravado na criação. No OAuth, ele é calculado a cada pedido pelo registro de apps (D-7).

### D-6 — As chaves `orb_live_…` ficam

- **Escolha**: as chaves continuam, sem mudança. Elas servem para IAs no computador da pessoa, para rotinas sem navegador (spec 0132) e para restringir empresas.
- **Alternativa descartada**: migrar as chaves para o plugin de API keys do better-auth. Seria uma mudança sem ganho para quem usa e quebraria as chaves existentes.

### D-7 — Um registro de apps do MCP, com a regra de acesso de cada um

- **Escolha**: cada app do ÓRBITA no MCP é uma entrada de `MCP_APPS`: `{ key, label, instructions, canAccess(userId), register(server, caller) }`. A regra de acesso é a do próprio app, e as ferramentas continuam conferindo empresa e ação em cada chamada. Na conexão OAuth, os apps liberados são `MCP_APPS.filter(canAccess)` a cada pedido. Na chave, são os `scopes` gravados ∩ os que ainda passam em `canAccess`.
  - Planner: `listPlannerOrganizations(userId).length > 0`.
  - trafeGO: `isSystemAdmin(userId)`.
  - App futuro: em geral, `getUserAppPermissions(org, userId, "<appKey>")` em ao menos uma empresa, a mesma matriz de Permissões das telas.
- **Alternativas descartadas**:
  - **Escopos OAuth por app, escolhidos na tela de permitir**: cada app novo exigiria que a pessoa reconectasse para ganhá-lo, e a tela ficaria com uma lista de caixas de marcar. Isso só se justifica se surgir o pedido de "conectar a IA só a um app". Nesse dia, os escopos entram sem mudar o registro.
  - **Continuar com um `if` por app na rota**: funciona com dois apps, mas o pedido é ter todos. Como este já é o segundo app, a extração se paga agora (S5).
- **Consequência**: colocar um app no MCP passa a ser "um arquivo de ferramentas + uma entrada no registro", sem tocar na conexão, na tela ou nas tabelas. Uma pessoa que ganha acesso a um app já o vê na IA conectada. Esse é o mesmo comportamento de D-2, agora para os apps.

### D-8 — Ponte para as listas opcionais entre o better-auth e o Prisma

- **Problema** (achado no teste local): o better-auth grava `null` nas listas opcionais das tabelas OAuth (escopos, recursos), mas o Prisma não aceita lista nula. Ao ler, o Prisma devolve `[]` para NULL, e o oauth-provider trata `null` como "sem restrição" e `[]` como "nada permitido". Sem tratar isso, o registro da IA dá 500 e a renovação do token falharia.
- **Escolha**: `withOAuthNullableLists` (`src/features/external-ai/server/oauth-prisma-lists.ts`), um Proxy no cliente que o better-auth recebe. Na escrita, ele tira o `null` (a coluna fica NULL); na leitura, devolve `[]` como `null`. Vale só para os campos listados dos 5 modelos OAuth, e o `tx` das transações também passa por ela.
- **Alternativas descartadas**: `$extends` do Prisma faria o TypeScript recalcular o tipo do cliente de ~340 models (regra 22). Usar `Json?` nas colunas também não resolve, porque o adapter manda `null` puro, que o Prisma recusa em `Json`.
- **Dívida assumida**: um `[]` gravado de propósito volta como `null` (sem restrição). Hoje nada no fluxo grava `[]` nesses campos. Remover a ponte quando o adapter do better-auth para o Prisma tratar listas opcionais; conferir a cada atualização do better-auth.

## 7. Impacto

- [x] **Schema / migration**: 8 tabelas que o plugin exige (`Jwks`, `OauthClient`, `OauthResource`, `OauthClientResource`, `OauthAccessToken`, `OauthRefreshToken`, `OauthConsent`, `OauthClientAssertion`), geradas pelo CLI do better-auth para Prisma e revisadas à mão. Nenhuma tem `organizationId`, porque o OAuth é da pessoa, não da empresa. O acesso às empresas é resolvido por `Member` (D-2). Talvez seja preciso uma coluna opcional em `Account` (no Quizio entrou `account.issuer`); se entrar, ela é opcional para não quebrar o deploy e o sync. Um `@@index([userId, clientId])` em `OauthConsent` serve à conferência por pedido.
- [x] **Procedures oRPC**: `external-ai.listConnections` e `external-ai.disconnect`, ambas limitadas à própria pessoa.
- [ ] Realtime: não.
- [ ] **Automações (Inngest)**: nenhuma função nova. A limpeza de clientes órfãos e tokens vencidos entra no cron diário de manutenção que já existir. Se não existir nenhum, ela vai como script manual e não como cron novo (S11).
- [x] **Env vars**: nenhuma nova. Usa `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` e `BETTER_AUTH_SECRET`.
- [ ] Breaking change: não. A chave continua igual, e o `401` só ganha o `resource_metadata`.
- [x] **Documentação**: atualizar a spec 0065 (D-1 aponta para esta), o `CLAUDE.md` (o MCP aceita OAuth) e o `public/skills/orbita-planner/SKILL.md` (como conectar pelo ChatGPT).

**Arquivos previstos**

- `src/lib/auth.ts`: plugins `jwt`, `mcp`, `cimd`.
- `src/app/.well-known/[...path]/route.ts`: descoberta com CORS.
- `src/app/(auth)/conectar-ia/page.tsx` e um componente em `src/features/external-ai/components/`.
- `src/features/external-ai/server/access-tokens.ts`: verificador do JWT e conferência do consentimento.
- `src/features/external-ai/server/mcp/apps.ts`: o registro de apps (D-7), com o Planner e o trafeGO.
- `src/app/api/mcp/route.ts`: `401` com `resource_metadata` e o laço sobre o registro.
- `src/app/router/external-ai/index.ts` e `src/features/external-ai/hooks/use-external-ai-connections.ts`.
- `src/features/external-ai/components/external-ai-section.tsx`: "Como conectar" e "IAs conectadas".

## 8. Plano de testes

Não há runner de teste instalado (CLAUDE.md, regra 20). Os CA viram verificações por `curl` e por um cliente MCP de referência num script em `scripts/`, citando o id.

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1, CA-2, CA-3, CA-12 | script | `curl` nos endereços de descoberta e no `/api/mcp`. O token inválido ou vencido é gerado no próprio script. |
| CA-4, CA-5 | manual no navegador | Fluxo completo com o MCP Inspector (`npx @modelcontextprotocol/inspector`) contra o localhost. |
| CA-6, CA-7, CA-8, CA-9, CA-10, CA-13 | script + manual | Conectar pelo Inspector e repetir as chamadas depois de cada mudança (sair da empresa, desconectar, trocar a senha). |
| CA-11 | script | Chamada com uma chave `orb_live_` existente, com e sem o escopo `trafego`. |
| CA-14 | manual | Roteiro: entrar por e-mail e pelo Google, trocar de empresa, convidar um membro, abrir o checkout do Stripe, conferir o evento de sync no Inngest. |
| CA-15 | manual | ngrok + ChatGPT + claude.ai, registrado no changelog. |

## 9. Riscos e rollback

- **O bump do better-auth quebrar o login** é o maior risco. Mitigação: PR separado só com o bump e os CA-14, que entra antes do OAuth. Rollback: reverter o PR do bump. Ele não tem migration, salvo a coluna opcional de `Account`, que é aditiva.
- **A migration das 8 tabelas** é só aditiva e reversível com `DROP TABLE`. Ela roda no boot (regra 24h), então o SQL é revisado antes do merge.
- **Tabelas que crescem para sempre**: os tokens de acesso vencem em 1 hora e os refresh tokens em 90 dias. A limpeza apaga tokens vencidos há mais de 7 dias e clientes OAuth sem consentimento criados há mais de 1 dia. O volume esperado é de algumas centenas de linhas por mês.
- **Injeção de prompt**: a IA lê textos escritos por outras pessoas (pedidos de ajuste, legendas). As ferramentas já não aprovam, não programam e não publicam (spec 0065, CA-5), o que limita o dano.
- **"Esqueci a senha" não desconecta as IAs** (lacuna conhecida do RF-13): o gancho do better-auth na redefinição não traz quem é a pessoa. Quem redefine a senha porque perdeu a conta deve desconectar as IAs em Satélites → IA externa. O certo é tratar isso no `account.update` quando a senha mudar; isso fica para uma etapa seguinte.
- **Desligar sem rollback de código**: tirar os plugins `mcp`/`cimd` do `auth.ts` faz os pedidos de conexão darem 404, e as chaves continuam funcionando.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-11-10 | João Gabriel (com Claude) | Criada, a partir da spec 044 do Quizio. D-2 (todas as empresas com Planner) decidida pelo usuário. |
| 2026-11-10 | João Gabriel (com Claude) | Revisão: o trafeGO entra também pelo OAuth para a equipe, e os apps ficam num registro para que os próximos entrem sem mexer na conexão (RF-10, RF-15, CA-10, CA-16, D-7). |
| 2026-11-10 | João Gabriel (com Claude) | Implementação: o "último uso" das IAs saiu (seria uma tabela ou uma escrita por pedido, sem uso de negócio), e o RNF-2 passou a 1 consulta; o RF-13 cobre só "Alterar senha". O registro de apps vale também para a chave: os escopos gravados ∩ o acesso atual. O bump do better-auth não muda nenhuma tabela existente (conferido com `getAuthTables` da 1.7.14). A migration `20261110120000_external_ai_oauth` só cria as 8 tabelas. |
| 2026-11-10 | João Gabriel (com Claude) | Verificação local (dev na porta 3001, script ponta a ponta + navegador): CA-1 a CA-6, CA-8 a CA-13 e CA-16 passaram, incluindo o trafeGO para admin, que some para não admin, e a renovação do token. Falta CA-7 (sair da empresa; a lógica é a mesma do CA-6, conferida a cada pedido), CA-14 (roteiro manual do login com o better-auth novo) e CA-15 (ChatGPT e claude.ai reais por túnel). Achado no teste: listas nulas (D-8). |
| 2026-11-10 | João Gabriel (com Claude) | Correções da revisão: o limite do trafeGO passa a ser por pessoa + IA (o client_id do CIMD é o mesmo para todos que usam o mesmo app); empresas e apps são calculados uma vez por pedido (`createMcpAccessContext`), e a chave passa a ter as empresas filtradas pela permissão atual já na autenticação; `/api/mcp` responde OPTIONS e CORS (credencial só no cabeçalho); depois do login, o pedido volta pela autorização (`/api/external-ai/oauth/resume`) e ganha assinatura nova, para não expirar durante um cadastro demorado. Fluxo ponta a ponta repetido e aprovado. |
