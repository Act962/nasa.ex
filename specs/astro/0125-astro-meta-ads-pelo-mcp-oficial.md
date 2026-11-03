---
id: 0125
titulo: Astro gerencia contas de anúncio da Meta pelo MCP oficial (e o "MCP" de mentira sai)
dominio: astro
status: implementada
autor: Weydson Lima
criada: 2026-10-30
atualizada: 2026-10-30
branch: feature/W-trafego-base-meta-desempenho-20261030
pr: # preenchido no /ship
peso: completa
---

# 0125 — Astro gerencia contas de anúncio pelo MCP oficial da Meta

> Depende da spec 0122 (token da Meta cifrado nos Satélites, "Testar conexão", conta da org) e
> conversa com a 0124 (guarda de quem cria campanha no trafeGO) e a 0123 (trava de complemento).
> Documentação da Meta consultada em 30/10/2026: seção 7.

## 1. Contexto

O dono quer que o cliente gerencie as contas de anúncio da Meta **conversando com o Astro**, com a
credencial vinda dos Satélites. Já existe um começo disso ("Astro Meta Ads", Satélites → Meta →
"Astro + IA"), mas ele tem dois defeitos sérios:

1. **O "MCP" é de mentira.** `src/lib/meta-mcp/server-spawn.ts` tenta abrir como subprocesso local
   um pacote `npx @meta/ads-mcp` que não existe, com nomes de ferramenta inventados
   (`list_campaigns`). Só roda quando a env `META_MCP_SERVER_CMD` existe, e ela nunca existiu em
   produção. Na prática, sempre roda o "modo direto" (`client.ts`), que chama a Marketing API à mão.
2. **Três ações de escrita são de enfeite.** Em `src/app/router/meta-ads/execute-mcp-action.ts`,
   editar campanha, criar campanha e criar anúncio caem num `stub: true`: marcam a ação como
   executada e **cobram Stars sem fazer nada na Meta**.

A Meta agora tem um **servidor MCP oficial de anúncios**, hospedado por ela
(`https://mcp.facebook.com/ads`), que aceita o token do usuário no cabeçalho e expõe ~40
ferramentas (campanha, conjunto, anúncio, criativo, números, diagnóstico, Instagram, públicos,
catálogo). Ele substitui as duas metades acima com algo mantido pela própria Meta.

## 2. Objetivo

O Astro passa a ler e gerenciar a conta de anúncios da org pelo MCP oficial da Meta, com o token dos
Satélites, sempre pedindo confirmação antes de qualquer escrita; o "MCP" de mentira e o modo
direto paralelo deixam de existir.

### Não-objetivos

- **Login pelo Facebook (OAuth) para conectar.** v1 usa o token manual dos Satélites (spec 0122).
  O botão "Conectar com Facebook" pedindo `ads_mcp_management` fica para a etapa 2 (D-5).
- Públicos personalizados com lista de clientes, catálogo, pixel/eventos e testes A/B pelo Astro:
  envolvem dado pessoal ou configuração de rastreio. Fora da lista de ferramentas da v1.
- Trocar o construtor da aba Publicar (spec 0124) pelo MCP. Ele continua igual; só a IA muda.
- Astro agindo sozinho (sem pessoa confirmando) ou em rotina agendada.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | **Cliente MCP remoto** `src/http/meta/ads-mcp-client.ts`: transporte HTTP do `@modelcontextprotocol/sdk` (já instalado) para `https://mcp.facebook.com/ads`, `Authorization: Bearer <token>`, tempo limite de 30 s por chamada e erro tipado (token inválido, permissão, conta sem MCP liberado, limite, passageiro), reaproveitando a classificação de `graph-client.ts`. Um cliente por pedido; nada guardado na memória do processo. |
| RF-2 | **Credencial e conta vêm só da org**: token cifrado da integração Meta dos Satélites (`readMetaAccessToken`) e a conta `adAccountId` dela. A IA nunca escolhe conta: o servidor **injeta** `ad_account_id` em toda chamada e recusa qualquer outro. O `getMetaAuth` (que troca de conta em silêncio) deixa de ser usado pelo Astro. |
| RF-3 | **Lista curta de ferramentas** (allowlist, D-2). Leitura, que roda direto: `ads_get_ad_entities`, `ads_get_ad_account_pages`, `ads_get_ig_accounts`, `ads_get_ig_media`, `ads_get_creatives`, `ads_get_creative_ads`, `ads_get_ad_preview`, `ads_get_field_context` e as de diagnóstico/números da categoria de relatórios que existirem na conta (descobertas por `tools/list` e filtradas por prefixo aprovado). Escrita, que só roda depois de confirmação: `ads_update_entity` (pausar, retomar, verba, datas, nome), `ads_create_campaign`, `ads_create_ad_set`, `ads_create_creative`, `ads_create_ad`, `ads_boost_ig_post`, `ads_activate_entity`. Qualquer ferramenta fora da lista é recusada no servidor, mesmo que o modelo peça. |
| RF-4 | **Escrita = propor e confirmar.** O Astro chama `metaPropose…`, que valida e grava um `MetaAdsPendingAction` (já existe, validade 5 min) e mostra o cartão de confirmação (já existe). Só o clique em "Confirmar" executa, chamando a ferramenta real do MCP. O cartão mostra o que muda e, quando houver, o valor. |
| RF-5 | **Ativar gasta dinheiro**: `ads_activate_entity` sempre tem cartão próprio com a verba e a data de fim da campanha, lidas da Meta no momento da proposta. Criação nasce pausada (padrão do MCP); o Astro nunca cria já ativo. |
| RF-6 | **Travas no servidor antes de executar** (defesa em profundidade, `safety.ts` existente): operação permitida pela org (`mcpAllowedOps`), verba dentro do teto da org (`mcpMaxBudgetPerCampaign`), objeto (campanha/conjunto/anúncio) pertence à conta da org (relido antes de escrever), política de texto (`ad-policies`, inclusive "atributos pessoais") para criativo novo. |
| RF-7 | **Stars só depois do sucesso.** A cobrança acontece quando a Meta confirma a escrita; falha não cobra. Fim do `stub`. |
| RF-8 | **"Testar conexão" mostra se o Astro pode gerenciar**: confere `ads_mcp_management` nas permissões do token e se a conta tem o MCP liberado (a Meta libera conta por conta). Resultado entra no `connectionCheck` como `canUseAstro` + motivo. Sem isso, a seção "Astro + IA" mostra o que falta e o botão de habilitar fica desligado. |
| RF-9 | **Quem pode usar**: as regras de hoje continuam (dono e moderador direto; admin e membro com liberação em `MetaMcpAuthorization`). Habilitar exige `canUseAstro`. |
| RF-10 | **No painel do trafeGO** (Astro com escopo `trafego`): leitura das campanhas do pedido e propostas de pausar, retomar, mudar verba e data de fim **só das campanhas do pedido** (código TG no nome ou vinculada), com a mesma guarda da aba Publicar (spec 0124: dono/admin, `canCreate`, fase do pedido, sem complemento vencido). Criar campanha pelo Astro no trafeGO fica de fora da v1: o caminho é a aba Publicar. |
| RF-11 | **Registro**: toda escrita confirmada grava `logActivity` (quem, o quê, objeto) e, no trafeGO, evento visível no pedido. |
| RF-12 | **Remoção completa do "MCP" de mentira** (D-1): apagar `src/lib/meta-mcp/server-spawn.ts`, o modo direto e o modo stdio de `src/lib/meta-mcp/client.ts` (o arquivo sai), a env `META_MCP_SERVER_CMD`, os nomes de ferramenta inventados e o ramo `stub` de `execute-mcp-action.ts`. As ferramentas do Astro (`read-tools.ts`, `propose-tools.ts`, `_shared.ts`) passam a usar o cliente do RF-1. `authorization.ts` e `safety.ts` saem de `src/lib/` para `src/features/astro-meta-ads/server/` (regra 2 do CLAUDE.md: domínio não mora em `lib`). |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Nenhuma tabela, coluna, env var ou função Inngest nova. Uma env **sai** (`META_MCP_SERVER_CMD`). |
| RNF-2 | Token só no servidor e só no cabeçalho; nunca no prompt do modelo, no log ou na resposta ao navegador. |
| RNF-3 | Limite por usuário nas propostas e execuções (`takeRateLimit`, freio de instância). |
| RNF-4 | Resposta de ferramenta truncada antes de ir ao modelo (lista grande de campanhas ou números): no máximo ~20 itens e só os campos usados, para não estourar contexto nem custo de tokens. |

## 4. Critérios de aceite

- [ ] **CA-1** — Não sobra referência a `META_MCP_SERVER_CMD`, `server-spawn`, `spawnMetaMcpServer` nem ao modo direto no código (`grep` vazio).
- [ ] **CA-2** — "Quais campanhas estão ativas e quanto gastaram nos últimos 7 dias?" responde com os números da conta da org, lidos pelo MCP oficial.
- [ ] **CA-3** — O modelo pede uma ferramenta fora da allowlist (ex.: `ads_delete_custom_audience`) ou outra `ad_account_id`: o servidor recusa e nada é chamado na Meta.
- [ ] **CA-4** — "Pausa a campanha X": aparece o cartão; sem clicar, nada muda na Meta; ao confirmar, a campanha fica pausada no Gerenciador e as Stars são cobradas.
- [ ] **CA-5** — Escrita que a Meta recusa: o cartão mostra o erro em português e **nenhuma Stars é cobrada**.
- [ ] **CA-6** — Verba acima do teto da org é recusada antes de chegar à Meta.
- [ ] **CA-7** — Criar campanha pelo Astro gera campanha pausada; ativar pede um segundo cartão com a verba.
- [ ] **CA-8** — Token sem `ads_mcp_management` ou conta sem MCP liberado: "Testar conexão" diz o motivo e "Habilitar" fica desligado.
- [ ] **CA-9** — No trafeGO, pedir para pausar campanha que não é do pedido devolve recusa; membro comum não vê as ferramentas.
- [ ] **CA-10** — Texto de criativo com "Você sofre de…?" é bloqueado antes da Meta.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | A Meta ainda não liberou o MCP para a conta | `canUseAstro=false` com o motivo; nada quebra no resto dos Satélites |
| CB-2 | Token vencido no meio da conversa | Erro tipado vira "a conexão com a Meta venceu, reconecte nos Satélites" |
| CB-3 | Proposta confirmada depois de 5 min | `expired`, nada executa (já é o comportamento) |
| CB-4 | Dois cliques em "Confirmar" | Claim atômico em `status` (já existe) executa uma vez só |
| CB-5 | A Meta renomeia ou tira uma ferramenta | `tools/list` não acha a ferramenta da allowlist: o Astro diz que a ação não está disponível; nada é inventado |
| CB-6 | Usuário do sistema com papel Admin no BM | A Meta não aceita (só papel Funcionário): o teste de conexão explica isso |
| CB-7 | Conta em moeda diferente de BRL | Leitura funciona; teto de verba compara na moeda da conta e o cartão mostra a moeda |

## 6. Decisões de design

### D-1 — Remover o "MCP" de mentira em vez de mantê-lo como plano B
- **Por quê**: nunca funcionou (pacote inexistente), mantém dois caminhos para o mesmo resultado e esconde o bug das ações de enfeite. Código substituído é apagado (S9).
- **Consequência**: o Astro depende do MCP oficial. Se a Meta não liberar o MCP para uma conta, as ferramentas de IA não aparecem para ela (CB-1). As telas de Desempenho e Publicar seguem pela Marketing API (specs 0122/0124), sem relação com o MCP.

### D-2 — Allowlist curta em vez das ~40 ferramentas
- **Por quê**: cada ferramenta exposta é texto no contexto do modelo (custo) e superfície de erro com dinheiro real. Públicos com lista de clientes mexem em dado pessoal (LGPD).
- **Como cresce**: nova ferramenta entra na allowlist com teste no script de QA.

### D-3 — Conta injetada pelo servidor
- **Por quê**: o token do usuário do sistema da Órbita enxerga a conta de todos os clientes (spec 0122, D-2). Deixar o modelo escolher `ad_account_id` seria um furo entre empresas.

### D-4 — Confirmação continua sendo nossa
- **Por quê**: a documentação diz que "o cliente de IA pede confirmação antes de ativar"; o servidor da Meta não obriga. O cartão + `MetaAdsPendingAction` é a trava.

### D-5 — Token manual na v1; login pelo Facebook depois
- **Por quê**: reaproveita a 0122 inteira. O login pelo Facebook (Login for Business com `config_id`) exige configurar o app de produção (do João) com o caso de uso de MCP e a URL de retorno; é etapa própria.

## 7. Impacto

- [ ] Schema / migration: **não**.
- [x] Procedures oRPC: `meta-ads.executeMcpAction` reescrita (executa de verdade); `meta-mcp.getStatus` passa a devolver `canUseAstro`; `platformIntegrations.metaConnection.test` confere `ads_mcp_management`.
- [x] Arquivos removidos: `src/lib/meta-mcp/server-spawn.ts`, `src/lib/meta-mcp/client.ts`. Movidos: `authorization.ts`, `safety.ts` → `src/features/astro-meta-ads/server/`.
- [x] Env removida: `META_MCP_SERVER_CMD`.
- [ ] Automações / Inngest: não.
- [x] Configuração fora do código: adicionar o caso de uso **"Crie e gerencie anúncios com o servidor MCP de anúncios"** (`ADS_AGENTIC`, permissão `ads_mcp_management`) ao app da Meta usado pelos tokens — no de teste (ÓRBITA TESTE 2026) e no de produção.
- [x] Documentação: `docs/trafego-overview.md` (Astro no painel), overview do Astro/integrações e o changelog do `CLAUDE.md` não precisa (nenhuma env nova).

### Segurança de dados

- O token nunca vai ao modelo nem ao navegador (RNF-2). O modelo vê só o resultado filtrado da ferramenta.
- A conta é sempre a da org da sessão (D-3); objeto de outra conta é recusado antes de escrever (RF-6).
- Escrita só com uma pessoa autorizada clicando (RF-4, RF-9), com registro de quem fez (RF-11).
- Nada de dado de cliente final (listas de público) passa pelo Astro na v1 (D-2).

### Regras da Meta

Fontes consultadas em 30/10/2026:
- Visão geral do servidor MCP de anúncios: `developers.facebook.com/documentation/ads-commerce/ads-ai-connectors/ads-mcp-server/ads-mcp-server-overview`
- Primeiros passos (autenticação): `.../ads-mcp-server-get-started`
- Ferramentas de criação e gestão: `.../ads-mcp-server-tools-ad-creation-and-management`
- Casos de uso do app ÓRBITA TESTE 2026, lidos pela ferramenta de desenvolvedor da Meta.

O que vale:
- Permissão mínima `ads_mcp_management` + `ads_read` ou `ads_management`; o app precisa do caso de uso de MCP.
- Usuário do sistema só com papel **Funcionário** ("Admin-role system user access tokens can't access the ads MCP server").
- Criação nasce pausada; ativar é ferramenta separada e "starts spending budget".
- A liberação do MCP é gradual por conta (visto em 30/10: "Ads MCP is gradually being rolled out" numa conta da Órbita).
- Não está documentado: limite de chamadas, validade do token e uso por plataforma em nome de clientes. Validar no teste real antes de vender (seção 9).
- Valem as mesmas regras de anúncio de sempre: sem atributos pessoais, sem categoria especial indevida, nunca apagar (só arquivar).

## 8. Plano de testes

`scripts/astro-meta-ads-qa-check.ts` testa as funções puras: allowlist, injeção de `ad_account_id`, recusa de conta diferente, teto de verba, montagem do cartão de ativação e a regra de política. O resto é manual.

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1 | automatizado | `grep` no código, no script de QA |
| CA-3, CA-6, CA-10 | automatizado (script) | Funções puras de guarda |
| CA-2, CA-4, CA-5, CA-7 | manual | Conta Órbita Hub com token de Funcionário e `ads_mcp_management`, **só com o "sim" do dono** para escrever; ativar apenas com verba mínima |
| CA-8, CA-9 | manual | Token sem a permissão; sessão de membro comum no trafeGO |

## 9. Riscos e rollback

- **Disponibilidade**: depende da Meta liberar o MCP por conta e do servidor dela estar no ar. Mitigação: `canUseAstro` com motivo; as telas do trafeGO não dependem do MCP.
- **Dinheiro real por conversa**: mitigado por propor-e-confirmar, teto de verba, criação pausada e cartão de ativação.
- **Termos para uso multiempresa não documentados**: antes de oferecer a clientes, confirmar com a Meta (ou nos termos dos conectores de IA) que o uso por plataforma é permitido.
- **Rollback**: reverter a PR. Sem migration; o que foi criado na Meta fica pausado ou como o usuário deixou.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-30 | Weydson Lima (com Claude) | Criada. Inclui a remoção completa do "MCP" de mentira (D-1, RF-12). |
| 2026-10-30 | Weydson Lima (com Claude) | Implementada. Divergências: (a) as ferramentas são carregadas do próprio servidor (`tools/list`) e filtradas pela allowlist, em vez de escritas à mão; a que a Meta tirar some sozinha (CB-5); (b) no Workspace/Insights o cartão continua sendo o `MetaAdsPendingAction` (5 min); no painel do trafeGO o cartão é o do chat principal do Astro (`AstroPendingAction`, executor `meta-ads.mcp-write`, 30 min), porque é esse chat que o cliente usa ali; (c) a posse do objeto (RF-6) é garantida pela própria Meta: com a conta da org injetada, `ads_update_entity` e `ads_activate_entity` recusam objeto de outra conta, então o espelho local `MetaAdCampaign` deixou de ser usado para isso; (d) o MCP trabalha em "modo rascunho": criação fica no rascunho do Gerenciador até `ads_activate_entity`; (e) `canUseAstro` usa `is_ads_mcp_enabled` de `ads_get_ad_accounts`; (f) no trafeGO o Astro oferece pausar, retomar e verba total; data de fim e público continuam na aba Publicar; (g) leitura cobra 1 Star por chamada, como antes; (h) o script de QA roda com `--conditions=react-server`. |
| 2026-10-30 | Weydson Lima (com Claude) | Autenticação revista. A Meta oferece dois jeitos de entrar no MCP: login (OAuth pelo Facebook Login for Business) ou token já gerado. O login, para gerenciar contas de outras empresas, exige o app da Órbita com Acesso Avançado em `ads_mcp_management` (App Review). Fica o token manual nos Satélites, agora com passo a passo na tela (`src/features/integrations/lib/meta-token-tutorial.ts`), mostrado no "Conectar Meta Ads" e na seção do Astro enquanto ele está bloqueado. Quando o app for aprovado, o caminho é somar `ads_mcp_management` ao login com Facebook que já existe (`meta-config.ts`). |
