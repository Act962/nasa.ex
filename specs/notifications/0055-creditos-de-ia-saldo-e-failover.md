---
id: 0055
titulo: Mostrar saldo estimado de IA, avisar antes de acabar e trocar de provedor sozinho
dominio: notifications
status: implementada
autor: Weydson (com Claude)
criada: 2026-10-02
atualizada: 2026-10-02
branch: feature/W-orbita-melhorias-ui-ux-20261001
pr:
peso: completa
---

# 0055 — Créditos de IA: saldo estimado, aviso antecipado e troca automática de provedor

## 1. Contexto

Pedido do Weydson (2026-10-02): "não sei quanto tenho de crédito nos modelos de IA; o usuário corre o risco de perder a inteligência do Astro por pagamento; não existe alerta claro, nem tokens consumidos, nem quanto falta".

Estado medido no código e no banco (`usage_event`, 30 dias):

- A spec 0037 alerta só **quando o crédito já acabou** (recusa do provedor) e quando o consumo do dia passa de 1 milhão de tokens. Não há saldo nem previsão.
- OpenAI e Google não expõem o saldo pré-pago por API (sem chave de admin, decisão do usuário).
- **O custo das chamadas do ASTRO não está sendo gravado**: ~3 milhões de tokens OpenAI em 30 dias com `provider_cost_usd = 0`. O ASTRO grava só `totalTokens`, e a tabela de preços (`token-pricing.ts`) precisa de entrada e saída separadas — `price_source = unknown`.
- Nenhuma tela mostra consumo de IA ao admin do sistema nem ao cliente com chave própria.

## 2. Objetivo

O admin do sistema e o cliente com chave própria veem o saldo estimado de cada provedor, quanto gastam por dia e quando o saldo acaba; são avisados antes; e o ASTRO continua respondendo quando um provedor fica sem crédito.

### Não-objetivos

- Ler o saldo direto do provedor (sem chave de admin — decisão do usuário).
- Recarregar o provedor pela plataforma.
- Reescrever o custo gravado no passado (a estimativa de registros antigos é feita na leitura).

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Registro de saldo por provedor (`openai`, `google`, `anthropic`), em dois escopos: **plataforma** (chaves do `.env`, admin do sistema) e **empresa** (chave própria em Satélites, admins da empresa). Dois tipos de lançamento: **recarga** (soma) e **saldo informado** (o valor que o painel do provedor mostra agora — zera a conta a partir dali). |
| RF-2 | Saldo estimado = último saldo informado (ou 0) + recargas depois dele − custo das chamadas do escopo depois dele. |
| RF-3 | Custo por chamada: o gravado; se zero/ausente, estimado na leitura pela tabela de preços (com só o total de tokens, divide 80% entrada / 20% saída; modelo desconhecido usa o preço do modelo padrão do provedor). Daqui para frente, o registro já grava a estimativa quando falta a divisão, e o chat do ASTRO grava entrada e saída reais. |
| RF-4 | Painel **Créditos de IA** no Admin (`/admin/ai-credits`): por provedor, saldo estimado, % do último saldo/recarga, gasto de hoje, 7 e 30 dias, ritmo diário (média de 7 dias), "acaba em X dias", tokens de 30 dias; lançamentos (adicionar/remover); detalhe de 30 dias por empresa, App e modelo. |
| RF-5 | Aviso antecipado (de hora em hora, no cron da spec 0037): saldo estimado ≤ 30% → aviso; ≤ 10% ou acaba em < 7 dias → crítico. Plataforma → admins do sistema; empresa → admins da empresa. No máximo uma vez por dia por escopo, provedor e nível. |
| RF-6 | Faixa no topo do Admin enquanto algum provedor da plataforma estiver em nível de aviso ou crítico. |
| RF-7 | **Troca automática**: provedor que recusa por falta de crédito fica marcado como esgotado por 30 min (ou até um lançamento novo); nesse tempo o roteador de modelos pula esse provedor e usa o próximo com chave. Chave própria esgotada cai na chave da plataforma (modelo cobrado em Stars). Ligada para todos. |
| RF-8 | O alerta de crédito esgotado (spec 0037) passa a dizer qual provedor acabou e que o ASTRO seguiu por outro; para chave própria, que o ASTRO está usando o modelo ÓRBITA, cobrado em Stars, até a recarga. |
| RF-9 | Em **Satélites**, o card de cada IA conectada mostra tokens e custo estimado do mês, saldo estimado (se a empresa informou) e o botão **Informar saldo** (lançamentos do escopo empresa). |
| RF-10 | **Ícone de uso abaixo da caixa da Início** (pedido de 2026-10-02, como o Claude Code): o ASTRO sem o disco, com o anel na cor do limite mais perto de acabar (azul < 50%, amarelo 50–75%, laranja 75–90%, vermelho ≥ 90% ou ≤ 7 dias de saldo), o percentual e o nome do modelo em uso. Ao clicar: IA em uso e voz, Stars do ciclo, IAs e modelos ativos com preço por 1M tokens e o saldo da chave própria; "Contas da plataforma" só para admin do sistema. |
| RF-11 | **Escolha do modelo** no "Uso do ASTRO": "Automático" (padrão, o roteador decide pela pergunta) ou um modelo das IAs conectadas com a chave da própria empresa (ex.: `gpt-4o`). Preferência por navegador (localStorage), enviada em cada pedido (`preferredModelId`); o servidor só aceita modelo do catálogo, de provedor com chave própria e não esgotado. Na chave da plataforma não há escolha: o preço em Stars é por token e igual para qualquer modelo, então um modelo caro mudaria o custo sem mudar a cobrança. |
| RF-12 | **Escolha liberada para todos** (decisão de 2026-10-02): na chave da plataforma o usuário escolhe entre os modelos liberados pelo admin; a resposta é cobrada em Stars pelo custo real do modelo (tabela de preços, entrada/saída) **+ margem** (padrão 50%), convertido pelo câmbio e preço da estrela do `RouterPaymentSettings` (`meter` com `computedStars`). Margem e modelos liberados são configurados em Admin → Créditos de IA ou pelo super usuário (`AI_PRICING_ADMIN_EMAILS`, hoje `weydsonlima@gmail.com`), também pelo "Uso do ASTRO". "Automático" segue a cobrança por token atual. |
| RF-13 | **Passo a passo no "Informar crédito de IA"** (como o guia do número oficial do WhatsApp): por provedor, passos com link direto (OpenAI `platform.openai.com/home`, Gemini `aistudio.google.com/app/usage`, Anthropic Console), dicas (recarga automática) e avisos (orçamento mensal da OpenAI corta a API mesmo com saldo; nível gratuito do Gemini pode usar o conteúdo para treino). Último passo = lançamento. Novo tipo **Nível gratuito** (`FREE_TIER`): sem saldo nem aviso, consumo segue visível. |
| RF-14 | **Consumo por modelo e voz escolhível** no "Uso do ASTRO": cada modelo tem barra (fatia do gasto de 30 dias do provedor) e seta que expande hoje/30 dias em tokens, US$ e R$ (câmbio do `RouterPaymentSettings`), atualizando a cada 15 s com o painel aberto. Voz: "Tempo real · gpt-realtime-mini" (padrão), "Tempo real · gpt-realtime" e "Econômica · gpt-4o-mini-tts" (navegador ouve, ASTRO responde em texto, OpenAI lê). Tempo real com truncamento (`retention_ratio` 0,7, até 6 mil tokens de conversa reenviados). |
| RF-15 | **Ordem das IAs** no "Uso do ASTRO": toggle em cada IA com chave (liga/desliga; a última ligada não desliga) e, acima da caixa, select "Principal" / "2ª opção (Fallback)"; as demais seguem a ordem de ativação. Preferência por navegador (`providerOrder`), enviada no corpo do chat e no `usageSummary`; o roteador usa só as IAs ligadas, nessa ordem, e ignora a escolha se nenhuma delas tiver chave. Modelo ÓRBITA só força a OpenAI quando ela é a principal. Não vale para WhatsApp e Workflows (não passam por essa preferência). |
| RF-16 | **Toggle em cada modelo**: texto — o roteador só usa os ligados (modelo desligado é trocado por outro ligado da mesma IA, mesmo nível primeiro); IA sem nenhum modelo ligado sai da fila e a próxima (2ª opção/ativa) assume; o switch da IA liga/desliga todos os modelos dela. Tudo desligado (ou nada ligado responde) → inteligência da plataforma (chaves do `.env`, sem as do cliente). Voz — um modelo ligado por vez (`gpt-realtime-mini`, `gpt-realtime` ou `gpt-4o-mini-tts`); nenhum ligado esconde o botão "Conversar por voz". Preferência por navegador (`disabledModelIds`, `activeVoiceModelId`). |
| RF-17 | **Barra e % de cada modelo contra o crédito**: em modelo da chave própria, barra + percentual = gasto daquele modelo desde o início do saldo atual ÷ crédito informado da IA (último saldo + recargas). Modelo da chave da ÓRBITA mostra "pago em Stars"; IA sem saldo informado, "informe o saldo para ver o % gasto". Substitui a fatia do gasto de 30 dias (RF-14), que ia a 100% com um só modelo em uso. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Painéis respondem em < 2 s com 30 dias de `usage_event` (agregação em SQL, não em memória). |
| RNF-2 | Tabela de lançamentos ausente (migração não aplicada) não derruba nada: painéis mostram "sem saldo informado" e os avisos de saldo não disparam. |
| RNF-3 | Marcação de esgotado é por instância do servidor (memória); a primeira recusa em cada instância a ensina. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado saldo informado de US$ 50 na OpenAI da plataforma e US$ 12 de custo depois dele, o painel mostra US$ 38 e o ritmo/dia dos últimos 7 dias.
- [ ] **CA-2** — Uma recarga de US$ 20 depois do saldo informado soma ao saldo estimado.
- [ ] **CA-3** — Evento antigo com só `total_tokens` de `gpt-4o-mini` entra no gasto com custo estimado > 0.
- [ ] **CA-4** — Saldo estimado em 25% do último saldo informado gera aviso para os admins do sistema; a rodada seguinte do mesmo dia não repete.
- [ ] **CA-5** — Recusa por crédito da OpenAI da plataforma: na pergunta seguinte o ASTRO responde pelo próximo provedor com chave (ex.: Gemini).
- [ ] **CA-6** — Recusa por crédito da chave OpenAI da empresa: a pergunta seguinte usa a chave da plataforma e é cobrada em Stars; os admins da empresa recebem o alerta explicando.
- [ ] **CA-7** — O card da OpenAI conectada em Satélites mostra tokens e custo estimado do mês.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Nenhum lançamento no provedor | Mostra gasto e ritmo; saldo "não informado"; sem aviso de saldo. |
| CB-2 | Saldo estimado negativo | Mostra US$ 0 e "possivelmente esgotado"; nível crítico. |
| CB-3 | Ritmo zero | "Acaba em —" (sem divisão por zero). |
| CB-4 | Todos os provedores esgotados | O roteador volta a tentar todos (melhor tentar do que não responder); alerta crítico já enviado. |
| CB-5 | Lançamento novo enquanto o provedor está marcado esgotado | Limpa a marca na hora, nesta instância. |
| CB-6 | Cliente sem chave própria | Card de Satélites sem consumo próprio; nada muda. |

## 6. Decisões de design

### D-1 — Saldo estimado por lançamento manual (sem chave de admin)
Decisão do usuário. O "saldo informado" deixa corrigir a deriva da estimativa a qualquer momento com o número do painel do provedor.

### D-2 — Estimar custo na leitura, corrigir na origem
Reescrever `usage_event` histórico mudaria registros de cobrança já usados em relatórios. A leitura estima; a gravação nova passa a ter custo.

### D-3 — Troca automática em memória, 30 min
Persistir exigiria outra tabela e leitura a cada chamada de IA. Em memória, cada instância aprende na primeira recusa; 30 min evita martelar um provedor sem crédito e volta a testá-lo sozinho.

### D-4 — Chave própria esgotada cai na plataforma (Stars)
Decisão do usuário ("troca automática ligada"). O alerta da empresa explica a cobrança em Stars até a recarga.

## 7. Arquivos

| Arquivo | Papel |
| --- | --- |
| `prisma/schema.prisma` + migração | Modelo `AiCreditEntry` |
| `src/features/ia/lib/token-pricing.ts` | `estimateUsageCostUsd` (divisão 80/20, preço padrão do provedor) |
| `src/features/stars/lib/metering/record-usage-event.ts` | Grava custo estimado quando falta a divisão |
| `src/features/ai-credits/lib/*` | Saldo, ritmo, níveis, provedores esgotados |
| `src/features/ia/lib/router/resolve-model.ts` | Pula provedor esgotado |
| `src/features/alerts/lib/ai-token-alerts.ts` | Provedor no alerta, marca esgotado, varredura de saldo |
| `src/app/router/admin/ai-credits/*` | Painel e lançamentos da plataforma |
| `src/app/router/integrations-platform/ai-credits/*` | Consumo e lançamentos da empresa |
| `src/app/(admin)/admin/ai-credits/page.tsx` | Tela do Admin |
| `src/features/integrations/components/satellites/*` | Card com consumo e "Informar saldo" |

## 9. Changelog

- 2026-10-02 — Criada e aprovada no chat: 4 partes, sem chave de admin, troca automática ligada.
- 2026-10-02 — RF-17: `ownKeyCostUsdSinceReference` em `computeOrganizationModelUsage` (agrupado por dia, proporcional no dia do lançamento) e `referenceStartAt` no resumo do crédito.
- 2026-10-02 — RF-16: `disabledModelIds` em `resolveModels` (substituto da mesma IA + queda na plataforma), toggles por modelo no `astro-usage-model-row.tsx`, voz exclusiva e botão escondido sem voz.
- 2026-10-02 — RF-15: `providerOrder` em `resolveModels`/orquestrador/chat, toggle + select no `astro-usage-meter.tsx`.
- 2026-10-02 — RF-14: `computeOrganizationModelUsage`, `astro-usage-model-row.tsx`, voz econômica (`/api/astro/voice/speech`, motor `openai` no `tts.ts`), escolha do modelo de voz (`voiceModelId` na sessão), truncamento do contexto.
- 2026-10-02 — Voz em tempo real passa a entrar no custo: cada `response.done` manda o `usage` para `/api/astro/voice/usage`, que grava `usage_event` (`feature: astro.voice`) com custo exato (áudio × texto, `realtime-usage-cost.ts`); `gpt-realtime` entra na tabela de preços e na lista do "Uso do ASTRO". Texto do "Informar crédito" deixa claro que o valor é manual e que "Saldo atual" é o saldo credor, não o gasto do mês.
- 2026-10-02 — RF-13: passo a passo com links e tipo `FREE_TIER` (entra na mesma migração pendente `20261002150000_astro_model_pricing`).
- 2026-10-02 — RF-12: escolha liberada na chave da plataforma com margem configurável; migração `20261002150000_astro_model_pricing` (colunas em `router_payment_settings`).
- 2026-10-02 — RF-11 (escolha do modelo) implementado: `use-astro-model-preference.ts`, `resolve-preferred-model.ts`, campo `preferredModelId` no corpo do chat.
- 2026-10-02 — RF-10 (ícone de uso na Início) aprovado em mock e implementado: `astro.usageSummary`, `astro-usage-meter.tsx`, `astro-usage-glyph.tsx`, `astro-usage-level.ts`.
- 2026-10-02 — Implementada. Detalhes: o modelo forçado (`ASTRO_DEFAULT_MODEL`/modelo ÓRBITA) só vale quando o provedor do candidato bate, senão a troca automática quebraria a chamada; a IA do WhatsApp (tracking-chat-ai) só marca a OpenAI da plataforma como esgotada (a chave própria dela é do `AiSettings`, não de Satélites); o aviso de saldo roda no mesmo cron da spec 0037 (`detect-ai-token-usage`). Migração `20261002120000_ai_credit_entry` aplicada em 2026-10-02 (autorizada no chat).
