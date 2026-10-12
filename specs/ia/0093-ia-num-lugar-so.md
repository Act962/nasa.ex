---
id: 0093
titulo: IA num lugar só — chaves, modelos, custo e quem paga
dominio: ia
status: em-revisao
autor: Weydson
criada: 2026-10-11
atualizada: 2026-10-11
branch: feature/workflows-simulador-visual-20261010
pr: Act962/nasa.ex#454
peso: completa
---

# 0093 — IA num lugar só

## 1. Contexto

Olhando a plataforma, ninguém responde três perguntas: **qual modelo cada recurso usa, de qual chave sai e quem paga**. O Weydson, dono do produto, não sabia onde ligar a IA nem qual modelo a ligação usa. O alerta "crédito quase no fim" aparece sem dizer de quem é a conta. Em 2026-10-11, um dia de testes gastou US$ 1,33 sem que a plataforma mostrasse onde.

Levantamento do código (2026-10-11):

- 57 pontos chamam IA; só 10 passam pelo seletor central (`ia/lib/router/resolve-model.ts`).
- Quatro cofres de chave: Satélites (`PlatformIntegration.config`), a chave do funil (`AiSettings.aiApiKey`), a do Planner (`NasaPlanner.anthropicApiKey`) e o `.env`.
- Cinco seletores de chave e modelo em paralelo, com ordens diferentes; em `lib/anthropic-key.ts` a plataforma vem antes da empresa.
- Uma chave por provedor por empresa, valendo para tudo.
- Duas tabelas de uso (`UsageEvent`, `AiChatRun`); cerca de 25 pontos não registram nada.
- Nenhuma tela cruza recurso × modelo × quem pagou.
- Com chave própria a empresa ainda paga Stars (cheio no atendimento do funil, taxa fixa no Astro).

## 2. Objetivo

Cada empresa paga o próprio modelo; quem não tem chave usa a da plataforma, no modelo mais básico. E isso fica à vista num lugar só: as chaves em Satélites, com o que cada uma atende, e o consumo em Insights.

## 3. Decisões

| ID | Decisão |
| --- | --- |
| D-1 | Com chave própria, a empresa **não paga Stars de IA** (etapa 4) |
| D-2 | Na chave da plataforma roda **só o modelo básico** de cada tipo, pago em Stars (etapa 4; reverte a RF-12 da spec 0055) |
| D-3 | **Primeiro enxergar**: a etapa 1 não muda como nada roda nem quanto custa |
| D-4 | **Nenhuma chave salva é desligada, apagada ou movida.** O plano só acrescenta em quais Apps e recursos cada uma funciona |
| D-5 | Um cadastro único de recursos de IA (`ia/lib/ai-resources.ts`) é a fonte da tela, do relatório e, depois, do seletor |
| D-6 | `UsageEvent` é a fonte única de uso. `AiChatRun` continua sendo gravado, mas as telas deixam de depender dele |
| D-7 | Todo lugar em que se escolhe modelo mostra o que ele faz, para que serve melhor e quanto custa, com preço conferido ou marcado como estimado |

Mantidas das specs anteriores: chaves cifradas e nunca devolvidas ao navegador (0053, RF-7 a RF-9); saldo por lançamento manual (0055, D-1); voz com chave inválida não cai em silêncio na plataforma (0054, CB-5).

## 4. Etapas

| Etapa | O quê | Muda comportamento? |
| --- | --- | --- |
| 0 | Dois problemas de segurança | Só para o vazamento |
| 1 | Enxergar: cadastro, "de onde sai", registro de uso, tela "IA da empresa", relatório em Insights, alerta que diz de quem é a conta, guia de modelos | Não |
| 2 | "Funciona em" por chave salva e um seletor só | Sim, com aval |
| 3 | Várias chaves por provedor | Migration, com autorização |
| 4 | Regras de cobrança (D-1, D-2) | Mexe em receita; com o João |

## 5. Requisitos da etapa 0 e da etapa 1

| ID | Requisito |
| --- | --- |
| RF-1 | Token do Hugging Face cifrado ao gravar e mascarado ao voltar para o navegador. Token antigo em texto puro continua sendo lido |
| RF-2 | O clipe de vídeo do Planner nunca envia a chave da OpenAI da empresa ao fal.ai |
| RF-3 | Cadastro único: cada recurso com App, nome, tipo, como escolhe chave e modelo hoje e os nomes que grava no uso |
| RF-4 | "De onde sai" calculado por empresa (e por funil no atendimento): provedor, modelo, origem da chave e quem paga, mostrando a realidade de hoje, inclusive o que foge da regra |
| RF-5 | Todo ponto que chama IA grava uma linha de uso com recurso, modelo e origem da chave, **sem debitar nada novo** |
| RF-6 | Tela "IA da empresa" em Satélites: uma linha por recurso, com modelo, chave, quem paga e uso de 30 dias. Só dono e admin |
| RF-7 | Relatório "Consumo de IA" em Insights: recurso × modelo × quem pagou |
| RF-8 | O alerta de saldo diz se a conta é da plataforma ou da empresa |
| RF-9 | Guia de modelos: uma frase por modelo, recomendação por uso em três faixas e custo de tabela e na prática |
| RF-10 | Consumo no topo de "IA da empresa": total do período (hoje, 7 dias, este mês, no horário de Brasília) e uma barra por uso (atendimento, ligações, Astro, automações e demais), separando o que saiu da chave da empresa do que foi cobrado em Stars. Com chave da empresa o registro grava custo zero, então o valor é estimado pelos tokens e pela tabela de preços; modelo sem preço fica fora do total e a tela avisa |
| RF-11 | Selo de IA no cabeçalho dos Apps, com três estados: **IA ligada** (chave da empresa, do funil ou do Planner), **IA básica da plataforma** e **IA desligada** (o recurso não roda sem chave). Qualquer membro recebe só o estado; chave (provedor e final), modelo e valores só para dono e admin. O quarto estado, "chave com problema", fica para depois: hoje nada registra a falha da chave da empresa |
| RF-12 | "Qual IA a sua empresa usa?": IA da plataforma ou chave própria, com o botão de cadastrar por provedor (abre o formulário de Satélites que já existe) e, em cada chave salva, **"Funciona em"** e o que ainda está na IA da plataforma. As chaves do funil e do Planner aparecem identificadas e continuam onde estão (D-4) |
| RF-13 | "O que cada uso roda": a faixa do modelo em vigor em cada uso e o custo por resposta. **Só mostra**: o modelo do atendimento continua sendo trocado em cada funil; a escolha por uso num lugar só é da etapa 2 |
| RF-14 | Aviso na Início para dono e admin enquanto a empresa não tem chave própria, com "Cadastrar minha chave" e "Agora não" (a dispensa fica no navegador da pessoa). Atalho "Consumo de IA" no saldo de Stars |

### Segurança

- A tela e a rota nunca devolvem chave: só provedor e os 4 últimos caracteres.
- Relatório por empresa; a conta da plataforma só para administrador do sistema.
- O registro de uso guarda contagem e custo, nunca conteúdo de mensagem.

### Regras da Meta

Não se aplica: nada aqui envia mensagem.

## 5.1 Requisitos da etapa 2, primeira fatia

Aprovada pelo Weydson em 2026-10-11 ("pode seguir para a etapa 2"), incluindo a migration de uma coluna.

**Princípio**: nada muda sozinho. Com as preferências vazias (o estado de toda empresa depois do deploy), cada recurso escolhe chave e modelo exatamente como hoje. Só muda o que o dono ou admin ligar.

| # | Requisito |
| --- | --- |
| RF-15 | Preferências de IA da empresa numa coluna só: `Organization.aiPreferences` (JSON, padrão `{}`). Guarda `companyKeyResources` (recursos em que a pessoa ligou a chave da empresa) e `useBands` (faixa do modelo por uso). **Diverge do plano**, que previa guardar o "Funciona em" junto de cada chave: regravar a chave em Satélites substitui o `config` inteiro e apagaria a escolha |
| RF-16 | "Funciona em" editável: em cada chave de Satélites, um interruptor por recurso **já ligado ao seletor único** que hoje só usa a plataforma. Ligado, o recurso passa a usar a chave da empresa, no mesmo provedor. Recurso que já usa a chave da empresa aparece ligado e travado; desligar esses fica para a fatia seguinte |
| RF-17 | Seletor único `resolveAiFor(recurso, empresa)`: decide por uma função pura (`decideAiFor`) sobre o cadastro, os fatos das chaves e as preferências. Qualquer falha ao decidir devolve o comportamento de hoje |
| RF-18 | Recursos ligados ao seletor nesta fatia: resumo e sugestão de resposta do chat, assistente do funil, assistente do workspace, resposta a comentários, modo rápido dos Gatilhos, criar fluxo com o Astro, narrativa do Insights e os passos de IA dos Gatilhos |
| RF-19 | Faixa do modelo por uso, escolhida em Satélites, só com chave da empresa (D-2: na plataforma é sempre o básico). Nesta fatia: **Automações** (passos de IA dos Gatilhos). Atendimento continua por funil e ligações continuam fixas até a fatia seguinte, com teste real |
| RF-20 | O registro de uso passa a gravar a origem real da chave nesses recursos |

**O que esta fatia NÃO muda, e a tela diz**: a cobrança de Stars. Recurso que cobra Stars continua cobrando mesmo rodando na chave da empresa (D-1 é da etapa 4, com o João). Quem ligar a própria chave num desses paga o provedor **e** as Stars até a etapa 4.

### Segurança (etapa 2)

- Só dono e admin leem e gravam as preferências. A rota valida cada id contra o cadastro e contra a lista de recursos ligados ao seletor: id desconhecido é recusado, não guardado.
- A chave nunca sai do servidor: `resolveAiFor` devolve o modelo já montado, e as rotas continuam devolvendo só provedor e final da chave.
- A decisão usa só as chaves da própria empresa (`loadOrganizationKeys` filtra por empresa).

### Regras da Meta (etapa 2)

Não se aplica: nenhuma mensagem nova é enviada. Os passos de IA dos Gatilhos continuam gerando o mesmo tipo de texto, só que podendo rodar em outra chave.

## 6. Critérios de aceite

- [x] **CA-1** — Token do Hugging Face vai cifrado para o banco, é lido no servidor e volta mascarado; token antigo em texto puro continua valendo e deixa de voltar (`scripts/verify-ai-key-sealing.ts`).
- [x] **CA-2** — Sem `falaiKey`, o clipe de vídeo usa só a chave do fal.ai da plataforma (lido no código; sem teste de chamada, que é paga).
- [x] **CA-3** — Para empresas de exemplo (chave em Satélites; só chave no funil; sem chave), cada recurso informa a origem da chave e quem paga (`scripts/verify-ai-resources.ts`, 17 verificações).
- [ ] **CA-4** — Nenhum `feature`/`action` de IA gravado em `usage_event` nos últimos 30 dias fica sem recurso no cadastro.
- [x] **CA-5** — Recurso instrumentado grava uma linha de uso e nenhum débito novo de Stars. 35 dos 36 recursos têm ponto de gravação (`scripts/verify-ai-usage-coverage.ts`); `recordAiUsage` não chama cobrança nenhuma. Fica de fora o assistente de formulários, que roda no navegador.
- [x] **CA-6** — Tela, relatório e diálogo de consumo mostram o mesmo total para a mesma empresa e período: os três leem `usage_event` com a mesma conta de custo (`usageCostBrl`). Conferido com uma empresa real do banco de desenvolvimento: em 30 dias, a soma por dia e a soma por recurso deram os mesmos usos, custo e Stars (`scripts/verify-ai-consumption.ts`).
- [x] **CA-7** — Todo modelo oferecido para escolha tem texto no guia e preço na tabela: a aba de modelo do funil passou a ler do guia (`funnelModelOptions`), e os de transcrição têm preço por minuto (`scripts/verify-ai-pricing.ts`, 28 verificações; `scripts/verify-ai-model-guide.ts`). Seguem sem texto ou preço, por não serem oferecidos para escolha: `tts-1`, `dall-e-3`, `gemini-2.0-flash` e `gemini-2.0-flash-exp`.
- [x] **CA-8** — Todo recurso cai num dos quatro usos; "hoje" e "este mês" começam à meia-noite e no dia 1 de Brasília; uso na chave da empresa tem custo estimado pelos tokens e modelo sem preço não vira custo zero; o selo é verde para chave da empresa, do funil ou do Planner, amarelo para plataforma e cinza sem chave (`scripts/verify-ai-use-groups.ts`, 13 verificações).
- [x] **CA-9** — Para uma empresa real do banco de desenvolvimento, a soma por uso fecha com a soma por recurso nos três períodos (`scripts/verify-ai-consumption.ts`, só leitura).
- [ ] **CA-10** — Membro sem papel de dono ou admin recebe do selo só o estado, sem chave, modelo nem valores. Garantido no código da rota `ia.resourceStatus`; falta o teste com um usuário membro.
- [x] **CA-11** — Com as preferências vazias, a decisão é idêntica ao comportamento de hoje em todos os 36 recursos, com e sem chave da empresa (`scripts/verify-ai-selector.ts`); no servidor, com uma empresa real, os recursos ligados devolvem a chave da plataforma e o modelo de sempre, **inclusive com a coluna ainda ausente no banco** (`scripts/verify-ai-selector-server.ts`).
- [x] **CA-12** — Ligar um recurso muda só aquele recurso, e só quando a empresa tem chave do mesmo provedor; sem a chave, continua na plataforma e a tela avisa; recurso fora do seletor ignora a preferência.
- [x] **CA-13** — A faixa troca o modelo só na chave da empresa; na plataforma segue o básico; tela e servidor decidem igual.
- [x] **CA-14** — Valor inválido guardado vira o padrão vazio; a rota recusa recurso desconhecido, recurso fora do seletor e faixa inválida.
- [ ] **CA-15** — Um passo de IA de um fluxo real roda na chave da empresa depois de ligado, e volta à plataforma quando a chave falha. **Não testado**: exige a migration aplicada, uma chave de empresa no banco de desenvolvimento e uma chamada paga.

## 9. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-11 | Weydson | Criada a partir do levantamento do código e das decisões D-1 a D-7. **Etapa 0 implementada**: `integrations/lib/integration-api-key.ts` ganhou `SEALED_KEY_PLATFORMS` (os três provedores de IA mais o Hugging Face) usado na gravação (`router/integrations-platform/upsert.ts`) e na máscara; `router/nasa-planner/generate-video-clip.ts` deixou de cair na chave da OpenAI da empresa. Ponto que ficou de fora e fica registrado: o `falaiKey` continua guardado em texto puro dentro da integração OpenAI |
| 2026-10-11 | Weydson | **Etapa 1, primeira parte.** (1a) `ia/lib/ai-resources.ts`: 36 recursos em 17 Apps, cada um com a regra de chave e de modelo de hoje e os nomes de uso. (1b) `ia/lib/describe-ai-resource.ts`, puro, e `ia/server/load-ai-key-facts.ts`, que lê as chaves só para saber se existem e o final delas. (1d) rota `ia.resourcesOverview` (dono e admin) e a seção "IA da empresa" no topo de Satélites (`ia/components/ai-company-panel.tsx`), recolhida por padrão, com o que foge da regra destacado. (1f) o alerta de saldo passou a dizer se é a chave da empresa ou a conta da plataforma, e que o saldo é estimativa. (1g) `ia/lib/ai-model-guide.ts` e `ia/components/ai-model-guide.tsx`: uma frase, ponto forte e limite por modelo, e três faixas por uso (atendimento, fluxos, ligações, áudio, Astro, documentos) com preço de tabela e custo por resposta numa conversa de exemplo. **O que falta da etapa 1**: (1c) registrar o uso nos cerca de 25 pontos que hoje não registram; (1e) relatório em Insights e o diálogo de consumo na mesma fonte; custo "na prática" pela média real da empresa; conferência dos preços nas páginas dos provedores (a tela avisa que são estimativa); a aba de modelo do funil lendo do guia. **Não mexido de propósito**: o rótulo "Mantido pelo ÓRBITA" só para o Gemini, porque estendê-lo esconderia o botão de cadastrar a própria chave nos outros provedores |
| 2026-10-11 | Weydson | **Etapa 1, segunda parte: a tela deixou de ser uma tabela.** O Weydson achou a primeira versão complexa ("onde insiro as chaves? onde escolho o modelo? como quem entra sabe que precisa de chave? onde vejo o consumo?"). Leiaute aprovado e implementado: RF-10 a RF-14. Servidor: `ia/server/load-ai-usage.ts` (uso por recurso, separando chave da empresa e plataforma), `ia/lib/ai-use-groups.ts` (os quatro usos, o período e a estimativa na chave da empresa), `ia/lib/ai-badge-state.ts`, rota `ia.resourcesOverview` com período e rota nova `ia.resourceStatus`. Tela: `ai-company-panel.tsx` aberto por padrão, com `ai-consumption-card.tsx`, `ai-keys-card.tsx`, `ai-use-models-card.tsx`, o guia e a lista completa (`ai-resource-table.tsx`) recolhidos; `ai-status-badge.tsx` na Início (Astro), no Fluxo de atendimento do funil e nos Gatilhos Automáticos; `ai-key-banner.tsx` na Início; atalho no saldo de Stars. **Diferenças em relação ao leiaute aprovado, de propósito**: (1) o modelo por uso só é mostrado, não escolhido, porque guardar a escolha da empresa pede coluna nova (migration) e muda como o atendimento, as ligações e os fluxos rodam, o que é da etapa 2; (2) o texto não diz "não gasta Stars com IA" na chave própria, porque hoje ainda cobra (etapa 4); (3) o selo vermelho ficou fora; (4) o selo ainda não está em Ligações nem no Explorer. O consumo continua incompleto até a 1c: os pontos que não registram uso não entram no total, e a tela avisa |
| 2026-10-11 | Weydson | **Etapa 1c: todo uso de IA gravado.** `ia/server/record-ai-usage.ts` (`recordAiUsage`): uma linha em `usage_event` com o recurso do cadastro, modelo, tokens e a origem da chave em `metadata.keySource`; só registra, nunca debita, nunca lança. Descoberta do levantamento: os pontos que cobravam Stars por `chargeStarsByAction` **também não gravavam uso** (a cobrança só grava quando recebe o custo), então o consumo deles aparecia zerado. Passaram a gravar, informando as Stars que eles mesmos já cobraram: resumo e sugestão de resposta do chat, auditoria de lead, relatório e narrativa do Insights, criar fluxo com o Astro, assistentes do funil e do workspace, modo rápido dos Gatilhos, busca na web e voz dos fluxos, os cinco pontos do trafeGO (lançados na empresa da agência, por `trafego/server/lib/record-trafego-ai-usage.ts`; sem agência configurada nada é gravado), extrair marca e guia, orçamento, evento por imagem, leitura de documento financeiro, de documento da empresa e de extrato em PDF, roteiros do Planner, Explorer (interpretar e gerar) e resposta a comentários. `lib/anthropic-key.ts` ganhou `anthropicKeySourceOf`. **Limites que ficam registrados**: (1) no extrato em PDF e no Explorer as Stars são cobradas em outro arquivo, depois da leitura, e por isso a linha de uso sai com zero Stars; (2) o assistente de formulários (`form/lib/google-ai.ts`) roda no navegador lendo uma variável de ambiente que não chega lá, então não há o que registrar e provavelmente não funciona; (3) `src/app/api/chat/route.ts` chama `gpt-4o-mini` sem login nenhum, fora do cadastro: furo a fechar, não mexido aqui; (4) falha do provedor não é gravada, só o uso que deu certo |
| 2026-10-11 | Weydson | **Furo fechado**: `src/app/api/chat/route.ts` removida. Ela chamava `gpt-4o-mini` na chave da plataforma sem login nem limite, e nenhuma tela a usava (todos os chats têm transporte próprio; nenhum cai no caminho padrão `/api/chat`). Conferido: `POST /api/chat` passou a responder 404. `api/chat/ia` (devolve um texto fixo, sem IA) e `api/chat/webhook` não foram tocadas |
| 2026-10-11 | Weydson | **Etapa 1e: relatório em Insights e diálogo na mesma fonte.** `ia/server/load-ai-daily-usage.ts` agrupa `usage_event` no banco por dia de Brasília, provedor, modelo e origem da chave. Rota `ia.consumptionReport` (dono e admin; 7, 30, 90 dias ou este mês): linhas recurso × funil × modelo × quem pagou e a série por dia. Página `/insights/relatorios/consumo-ia` (`ia/components/ai-consumption-report.tsx`), com cartão em Insights › Relatórios e link a partir da seção de Satélites. `ia.usage.overview` (medidor da barra lateral e diálogo "Consumo de Tokens IA") deixou de ler `AiChatRun` e passou a ler `usage_event`, mantendo o mesmo formato de resposta: agora enxerga o Astro e os demais recursos. `AiChatRun` continua sendo gravado. **Fica registrado, sem mexer**: `ia.usage.overview` responde a qualquer membro da empresa, como já respondia, e mostra o custo total de IA; restringir a dono e admin muda o que o membro vê na barra lateral e precisa de decisão |
| 2026-10-11 | Weydson | **Custo de IA só para dono e admin, e um vazamento entre empresas fechado.** `ia.usage.overview` passou a recusar quem não é dono nem admin; o medidor "Tokens IA" da barra lateral e o item do menu da conta somem para os demais, e o diálogo mostra o motivo. As três telas usam o hook novo `useTokenUsageOverview`, que não repete a consulta recusada. **Furo encontrado no caminho e fechado**: `ia.usage.get` (aba "Uso" do Fluxo de atendimento) aceitava o id de qualquer funil sem conferir a empresa, então um usuário logado lia tokens e execuções recentes do atendimento de outra empresa; agora exige a empresa ativa e devolve "não encontrado" para funil alheio. Dentro da própria empresa essa aba continua visível a qualquer membro que abra as configurações do funil |
| 2026-10-11 | Weydson | **Aba "Uso" do funil só para dono e admin.** `ia.usage.get` recusa os demais papéis (além de já conferir a empresa), e a aba some do Fluxo de atendimento para quem não pode ver (`tracking-settings/components/chatbot-ia.tsx`); quem chega pelo endereço com a aba marcada cai em "Geral". Com isso, todo consumo de IA (Satélites, Insights, medidor, diálogo e aba do funil) segue a mesma regra de acesso |
| 2026-10-11 | Weydson | **Fim da etapa 1: preços conferidos, custo pela média real e aba do funil no guia.** (1) Preços conferidos em 11/10/2026 nas páginas oficiais da OpenAI, da Anthropic e do Google; `token-pricing.ts` ganhou `PRICES_VERIFIED_ON`, `UNVERIFIED_PRICE_MODEL_IDS` (o que não estava nas páginas: Gemini 2.0 e 1.5, GPT anteriores ao 4o, Claude 3) e `AUDIO_MINUTE_PRICE_USD` (transcrição por minuto). **Dois erros corrigidos**: Claude Opus 4.5, 4.6, 4.7 e 4.8 custam US$ 5/25 por milhão, mas casavam por prefixo com o Opus 4 (US$ 15/75) e o custo saía três vezes maior; Claude 3.5 Haiku é US$ 0,80/4, não 1/5. Entraram os preços dos Claude 5. Os demais valores marcados "conferir" estavam certos. (2) Custo "na prática": `loadAverageReplyTokens` calcula o tamanho médio real de uma chamada nos últimos 30 dias (mínimo de 20 usos; abaixo disso vale a conversa de exemplo, e a tela diz qual das duas usou); aparece em "O que cada uso roda", no guia e na aba do funil. (3) A aba "Modelo" do funil lê a lista do guia, do mais barato ao mais caro, com a faixa ao lado e uma explicação do modelo escolhido (`ia/components/funnel-model-hint.tsx`); o modelo que o funil já usa continua na lista mesmo fora do guia, marcado como antigo; ao trocar de provedor o padrão passa a ser o equilibrado (antes era o primeiro da lista, o mais caro na OpenAI). Saem da oferta para funis novos: Gemini 2.0 e 1.5. **Etapa 1 concluída.** Pendências que não são desta etapa: selo em Ligações e no Explorer, estado "chave com problema", Stars do extrato em PDF e do Explorer na linha de uso, e o preço de `tts-1` (US$ 15 por milhão de caracteres) e `dall-e-3` (fora da página) no custo apurado |
| 2026-10-11 | Weydson | **Etapa 2, primeira fatia (RF-15 a RF-20).** Schema: `Organization.aiPreferences` e a migration `20261011120000_organization_ai_preferences` (uma coluna, aditiva, com padrão `{}`). **A migration ainda não foi aplicada em banco nenhum**: a execução foi barrada no ambiente do Claude e fica com o Weydson; por isso o cliente Prisma local não foi regenerado nem a `SCHEMA_VERSION` subiu. O código lê a coluna dentro de `try/catch` e vale o padrão vazio se ela não existir. Código: `ia/lib/ai-preferences.ts` (formato, validação e a lista `SELECTOR_WIRED_RESOURCE_IDS`), `ia/lib/decide-ai-for.ts` (decisão pura), `ia/server/resolve-ai-for.ts` (`resolveAiFor`, `loadAiPreferences`), rotas `ia.preferences.get/update` (dono e admin). Ligados ao seletor: `ia/generate-conversation-summary.ts`, `ia/generate-compose.ts`, `ia/ai-tracking`, `ia/ai-workspace`, `modules/social/infra/stars-ai-reply-generator.ts`, `workflow/quick-builder.ts`, `astro/server/tools/workflows/generate-flow.ts`, `insights/cross/generate-tile-narrative.ts` e os quatro passos de `workflows/lib/agent-executors/ai.ts` (por `pickStepModel`, que volta ao modelo de sempre em qualquer falha; a reserva no Gemini e o caminho heurístico não mudaram). Tela: `ai-key-scope-toggles.tsx` ("Usar esta chave também em") e a faixa das Automações clicável em `ai-use-models-card.tsx`. A visão geral e o selo passaram a decidir por `decideAiFor`. **Fica para a fatia seguinte**: atendimento e ligações no seletor (com teste real), desligar a chave da empresa em recurso que já a usa, e os demais pontos de chamada |
| 2026-10-11 | Weydson | **Migration aplicada no banco de desenvolvimento**, com autorização do Weydson ("pode rodar a migration"): `db execute` do arquivo, `migrate resolve --applied`, cliente Prisma regenerado e `SCHEMA_VERSION` em `v123-organization-ai-preferences`. Conferido com a empresa de teste: gravar, ler e restaurar as preferências funciona; id de recurso desconhecido gravado direto no banco é ignorado na leitura; recurso ligado sem chave da empresa continua na chave da plataforma com o modelo de sempre. Em produção a migration roda no boot do container |
