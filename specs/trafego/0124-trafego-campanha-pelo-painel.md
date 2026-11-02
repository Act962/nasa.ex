---
id: 0124
titulo: Owner/admin cria, publica e edita campanha de WhatsApp pelo painel do trafeGO
dominio: trafego
status: implementada
autor: Weydson Lima
criada: 2026-10-30
atualizada: 2026-10-30
branch: feature/W-trafego-base-meta-desempenho-20261030
pr: # preenchido no /ship
peso: completa
---

# 0124 — Campanha de WhatsApp criada, publicada e editada pelo painel

> Entrega C do plano em três. Depende das specs 0122 (integração Meta da org, `canCreate`) e 0123 (trava de complemento vencido).
> Pesquisa da Marketing API v25 feita em 30/10/2026; as fontes estão na seção 7.

## 1. Contexto

O dono quer que o **owner ou admin da org do cliente** monte a campanha pelo painel, passo a passo, usando a API da Meta pela integração dos Satélites (spec 0122). Hoje:

- A criação existe só como funções HTTP soltas em `ads-management.ts`, sem nenhum uso, e uma tela de Insights cria só a campanha, sem conjunto nem anúncio.
- A decisão travada nas specs 0008, 0009 e 0010 diz "execução manual pela equipe; clique do cliente não publica anúncio". **Esta spec revoga essa decisão** e põe travas no lugar (seção 6, D-1).
- Regra da agência: anunciar a **publicação existente** é o caminho principal. Mandar arquivo é o caminho frágil (codec, processamento) e perde a prova social.

## 2. Objetivo

O owner/admin monta uma campanha de mensagens no WhatsApp a partir de um post do Instagram (ou de uma imagem), ela nasce pausada, ele revisa e publica; depois consegue pausar, retomar, mudar verba, data de fim e público, e trocar o anúncio.

### Não-objetivos

- Objetivos além de mensagens no WhatsApp (leads, vendas, tráfego), Google Ads e WhatsApp Oficial.
- Envio de vídeo (`/advideos`, processamento assíncrono).
- Apagar qualquer coisa no Meta. Só arquivar.
- Público com interesses detalhados ou públicos personalizados (risco de política de saúde, seção 7).
- Ferramentas novas no MCP externo.
- Corrigir os stubs de `execute-mcp-action.ts` (tarefa separada).

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Guarda `assertCampaignBuilderAccess(context, orderId)`, conferida **no servidor** em toda procedure: pedido da org da sessão; usuário `isOrgOwnerOrAdmin`; canal META_ADS; integração da org em modo conta com `connectionCheck.canCreate`; status ONBOARDING, MATERIALS_SUBMITTED, REQUESTED, CHANGES_REQUESTED, SCHEDULED, RUNNING ou PAUSED; nenhum complemento vencido (`hasOverdueTrafegoComplement`, spec 0123). |
| RF-2 | Aba **"Publicar"** no painel do pedido, só para quem passa na guarda; o motivo aparece quando não passa. O menu de baixo do celular continua igual. |
| RF-3 | Passo **Antes de começar**: página da conta e WhatsApp ligado a ela, Instagram, status e moeda da conta, verba declarada, já usada e saldo. Sem WhatsApp na página, a criação é bloqueada com a instrução de como ligar. |
| RF-4 | Passo **Público**: cidade com raio (`/search?type=adgeolocation`, raio de 17 a 80 km), idade a partir de 18 e gênero. A sugestão das regras usa o conjunto antigo da conta com menor custo por conversa (com pelo menos R$ 30 gastos nos últimos 180 dias); sem histórico, usa a cidade do negócio + 17 km, 18 a 65 anos, todos. |
| RF-5 | Passo **Anúncio**, caminho principal: lista os posts do Instagram da conta (`/{ig-user-id}/media`, sem stories, só os com `boost_eligibility_info` elegível) e usa o post escolhido com botão de WhatsApp. Alternativa: imagem dos Materiais do pedido, enviada por `/act/adimages`, com texto das copies selecionadas e a mensagem de boas-vindas. O texto (legenda ou copy) passa pela checagem de políticas (`ad-policies`): o que é BLOCKED não segue, e WARNING pede confirmação. |
| RF-6 | Passo **Verba**: orçamento total da campanha (lifetime, CBO) e data de fim. A sugestão é o saldo da verba declarada. Valor acima do saldo mostra o complemento estimado (30% do excedente, spec 0123) e pede confirmação. A verba diária equivalente não pode ficar abaixo do `min_daily_budget` da conta. |
| RF-7 | Passo **Revisão**: todos os campos que vão para a Meta, com a prévia (`/generatepreviews`) quando disponível. |
| RF-8 | **Criar rascunho**: campanha → conjunto → criativo → anúncio, todos **PAUSADOS**. Se algo falha no meio, o que foi criado é **arquivado** e o erro da Meta aparece em texto claro. O nome da campanha carrega `TG-NNNN — <negócio> — Mensagens #<chave>`; a chave curta é gerada no navegador e serve de trava contra clique duplo, porque antes de criar procura campanha com a mesma chave na conta e reaproveita. |
| RF-9 | **Publicar**: confere que a campanha é da conta da org do pedido, ativa anúncio, conjunto e campanha (nessa ordem) e relê. Se o pedido ainda não estava no ar, leva-o a RUNNING pelo `transitionTrafegoOrder` (`source=CLIENT`), que já avisa o cliente e a equipe. |
| RF-10 | **Editar** as campanhas do pedido, listadas a partir do Desempenho (spec 0122, selo "deste pedido"): pausar, retomar, verba total, data de fim e público (cidade, raio, idade, gênero). Mudar público avisa que a Meta revisa de novo. **Trocar anúncio** cria um anúncio novo com outro post ou imagem e pausa o antigo, porque criativo não se edita. |
| RF-11 | Toda criação, publicação e edição grava um evento no pedido (visível ao cliente, com o nome de quem fez) e um `logActivity`, fora de transação. A equipe é avisada na publicação. |
| RF-12 | Espelho: a campanha criada vira linha em `MetaAdCampaign` da org do pedido. Se o pedido ainda não tem campanha vinculada, ela passa a ser a vinculada. |
| RF-13 | Guias do Astro (regra 21): âncoras da aba e dos botões "Criar rascunho" e "Publicar", o guia `trafego.publish` e os tipos de resultado `trafegoDraftCreated` e `trafegoCampaignPublished`. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Nenhuma tabela, coluna, env var, cron ou função Inngest nova. A chave do rascunho vai no nome da campanha; o rascunho é a própria campanha pausada no Meta. |
| RNF-2 | A criação roda síncrona na procedure, com no máximo uns 8 chamados; o usuário espera na tela. Não usa Inngest: volume baixo e retomada pela chave. |
| RNF-3 | A entrada nunca traz `adAccountId`, nem id de campanha de fora do pedido. A conta vem da integração da org do pedido, e as campanhas editáveis são só as "deste pedido". |
| RNF-4 | Limite de chamadas por usuário (`takeRateLimit`) em criar, publicar, editar e buscar cidade. |

## 4. Critérios de aceite

- [ ] **CA-1** — Membro comum ou moderador: a aba não aparece e as procedures devolvem FORBIDDEN.
- [ ] **CA-2** — Sem `canCreate` (falta `pages_manage_ads`) ou com complemento vencido: a aba mostra o motivo e não deixa criar.
- [ ] **CA-3** — Criar rascunho com post do Instagram gera, na conta da clínica e tudo PAUSADO:
  - campanha `OUTCOME_ENGAGEMENT` com `lifetime_budget`, `bid_strategy=LOWEST_COST_WITHOUT_CAP` e `special_ad_categories=[]`;
  - conjunto com `destination_type=WHATSAPP`, `optimization_goal=CONVERSATIONS`, `billing_event=IMPRESSIONS`, `promoted_object.page_id` e `end_time`;
  - público com `publisher_platforms=[facebook, instagram]`, sem Audience Network, sem `explore` e sem Messenger, `age_min ≥ 18` e `advantage_audience` explícito;
  - anúncio com criativo `source_instagram_media_id` + `instagram_user_id` e botão `WHATSAPP_MESSAGE`.
- [ ] **CA-4** — Clique duplo em "Criar rascunho" deixa uma campanha só.
- [ ] **CA-5** — Falha no meio (ex.: anúncio recusado) deixa campanha e conjunto **arquivados**, nada órfão ativo, e mostra o erro.
- [ ] **CA-6** — Legenda com "Você sofre de…?" é bloqueada antes de ir à Meta (regra nova de atributos pessoais).
- [ ] **CA-7** — Publicar ativa os três níveis, o pedido vai a RUNNING (se não estava), e cliente e equipe são avisados.
- [ ] **CA-8** — Mudar a verba ou a data de fim de campanha no ar funciona sem nova revisão; mudar o público mostra o aviso de revisão.
- [ ] **CA-9** — Trocar o anúncio cria um anúncio novo e pausa o antigo; nada é apagado.
- [ ] **CA-10** — Tentar editar campanha que não é do pedido (id de outra conta ou sem o código) devolve NOT_FOUND.
- [ ] **CA-11** — Verba acima do saldo declarado só segue com a confirmação do complemento estimado.
- [ ] **CA-12** — `pnpm guides:check` passa.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Página sem WhatsApp ligado | Bloqueia no "Antes de começar", com a instrução. |
| CB-2 | Post sem elegibilidade (música com direitos, IGTV) | Não aparece na lista; mostra quantos ficaram de fora e por quê. |
| CB-3 | Usuário do sistema sem tarefa de conteúdo na página (não lê os posts) | A lista de posts mostra "atribua a página com tarefa de conteúdo"; o caminho por imagem segue disponível. |
| CB-4 | Post do Facebook (não do Instagram) | Fora da v1: a Meta não documenta post do Facebook com botão de WhatsApp. Fica para depois de testar com `validate_only`. |
| CB-5 | Conta não BRL | O passo Verba bloqueia, porque a verba é em reais. |
| CB-6 | Meta pede para esperar (limite) | Mensagem clara, nada é repetido; o rascunho já criado continua lá. |
| CB-7 | Campanha arquivada pelo cliente no Gerenciador | Some da lista de edição; o gasto segue contando (spec 0122). |
| CB-8 | Duas pessoas criando ao mesmo tempo | Cada uma com a sua chave: viram duas campanhas, ambas pausadas e visíveis; a revisão mostra os rascunhos existentes antes de criar. |
| CB-9 | Pedido em PAUSED (pausado pela equipe) | Pode editar e criar, mas "Publicar" não tira o pedido de PAUSED: a decisão de retomar o pedido é da equipe. |

## 6. Decisões de design

### D-1 — Revoga "clique do cliente não publica anúncio"
- **Escolha**: o owner/admin publica.
- **Travas**: tudo nasce pausado; a confirmação mostra o valor; a verba acima do declarado mostra o complemento; só a conta da org do pedido; o complemento vencido trava.
- **Registro**: changelog nas specs 0008, 0009 e 0010 e no `docs/trafego-overview.md` §2.

### D-2 — Post do Instagram como caminho principal
- **Por quê**: é o único "usar publicação existente" com botão de WhatsApp documentado pela Meta (`source_instagram_media_id`). Post do Facebook com WhatsApp não está documentado (CB-4).

### D-3 — Orçamento total na campanha (CBO, lifetime)
- **Por quê**: a Meta respeita o total como teto; a verba diária vezes os dias pode estourar num dia. `bid_strategy` vai explícito, porque sem ele a Meta usa um padrão que exige lance (`LOWEST_COST_WITH_BID_CAP`).
- **Consequência**: sem `is_adset_budget_sharing_enabled` (só vale com orçamento no conjunto).

### D-4 — Rascunho = campanha pausada no Meta, chave no nome
- **Escolha**: o rascunho é a campanha pausada, identificada pela chave no nome.
- **Alternativas descartadas**: tabela de rascunho ou Json no pedido (S4).
- **Consequência**: a retomada e a trava contra clique duplo leem a conta.

### D-5 — Público com `advantage_audience=0` e campos explícitos
- **Por quê**: com 1, a Meta fixa a idade máxima em 65 e limita a mínima a 18–25. Explícito evita o padrão implícito (regra da agência: nada fica implícito).
- **Placements**: lista manual sem `explore` (removido na v26) e sem Messenger `story` (removido em todas as versões desde 27/10/2026).

### D-6 — Sem `degrees_of_freedom_spec`
- **Por quê**: os exemplos da Meta usam `standard_enhancements`, que deixou de existir na v22. Fica de fora até testar com `validate_only`.

## 7. Impacto

- [ ] Schema / migration: **não**.
- [x] Procedures oRPC novas: `trafego.campaignBuilder.{access, context, suggest, searchCities, listInstagramPosts, createDraft, publish, discardDraft, update, replaceAd}`.
- [ ] Realtime: não.
- [ ] Automações: não.
- [ ] Env vars novas: não.
- [x] Breaking change: revoga a decisão D-1 das specs 0008, 0009 e 0010.
- [x] Documentação: overview, playbook e guias do Astro.

### Segurança de dados

- Toda procedure confere o dono do pedido e o papel **antes** de chamar a Meta. A conta e as campanhas vêm do servidor, nunca da entrada (RNF-3).
- O token não sai do servidor (spec 0122).
- O nome de quem publicou ou editou fica no histórico do pedido. A Meta registra o usuário do sistema dono do token.

### Regras da Meta

Fontes consultadas em 30/10/2026, na documentação da Marketing API:
- **Anúncios de clique para WhatsApp:** messaging-ads/click-to-whatsapp
- **Orçamento da campanha (Advantage Campaign Budget):** advantage-campaign-budget
- **Compartilhamento de orçamento entre conjuntos:** adset-budget-sharing (v24)
- **Posicionamento:** placement-targeting
- **Público Advantage+:** advantage-audience
- **Busca de cidade:** targeting-search
- **Imagens de anúncio:** ad-image
- **Mídia do Instagram:** instagram-media
- **Boas práticas:** best-practices
- **Categorias especiais:** special-ad-category
- **Mudanças da v26:** changelog v26.0

O que vale:
- Página com WhatsApp ligado; usuário do sistema com a tarefa ADVERTISE na página (e uma tarefa de conteúdo para ler os posts) e o Instagram atribuído.
- Clínica não tem categoria especial (`special_ad_categories=[]`). Não usar público ou conversão personalizada com nome de condição de saúde (a Meta sinaliza, erros 2460003 e 2460004).
- Copy sem afirmar ou insinuar condição de saúde de quem vê (atributos pessoais): regra nova determinística em `lib/ad-policies`.
- O criativo não é editável: trocar = anúncio novo. Mudar público ou criativo passa por revisão de novo; verba e datas, não.
- Nunca apagar, só arquivar.

## 8. Plano de testes

O script `scripts/trafego-0124-qa-check.ts` testa as funções puras: montagem dos payloads (campos explícitos, idade ≥ 18, placements, CTA), cálculo de verba e complemento estimado, a chave no nome e a regra de atributos pessoais. Os outros critérios são manuais.

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-3, CA-6, CA-11 | automatizado (script) | Payloads e regras puras. |
| CA-1, CA-2, CA-10 | manual | `curl` com sessões de papéis diferentes. |
| CA-4, CA-5, CA-7, CA-8, CA-9 | manual | Na conta da clínica, **só com o "sim" do dono**: rascunho pausado, conferido no Gerenciador e arquivado; publicar só junto com o cliente. |
| CA-12 | automatizado | `pnpm guides:check`. |

## 9. Riscos e rollback

- **Dinheiro real**: tudo pausado, confirmação com o valor e trava de conta e de complemento.
- **API da Meta muda**: os payloads ficam centralizados num só arquivo (`build-meta-payloads.ts`), com os campos citados na seção 7.
- **Rollback**: reverter a PR. Rascunhos criados ficam pausados na conta e podem ser arquivados pelo Gerenciador.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-30 | Weydson Lima (com Claude) | Criada (entrega C). |
| 2026-10-30 | Weydson Lima (com Claude) | Implementada. Divergências: (a) a prévia da revisão é a miniatura do post ou da imagem, e o rascunho criado ganha o link de prévia da Meta (`preview_shareable_link`); `/generatepreviews` ficou de fora (RF-7); (b) a mensagem de boas-vindas do WhatsApp (`page_welcome_message`) fica fora da v1, como o D-6, até testar com `validate_only`; (c) a sugestão de público é só por regras (sem modelo de IA), como o RF-4 descreve; (d) a trava de clique duplo procura a chave entre as campanhas do pedido na conta; o limite por usuário usa o `takeRateLimit` em memória que já existe (freio, não garantia, com 2 instâncias); (e) a guarda devolve FORBIDDEN com o motivo, e `access` diz se a aba aparece: some para membro comum e para pedido fora do Meta, aparece com o motivo nos outros casos; (f) o post escolhido é relido no servidor e precisa ser do Instagram da página; (g) arquivos de escrita separados em `builder-actions` (criar, publicar) e `builder-edits` (descartar, pausar, verba, fim, público, anúncio). |
