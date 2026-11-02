---
id: 0128
titulo: Nota de qualidade por anúncio e conjunto, com correção guiada pelo Astro
dominio: trafego
status: aprovada
autor: Weydson Lima (com Claude)
criada: 2026-10-31
atualizada: 2026-10-31
branch: feature/W-trafego-ux-20261031
pr:
peso: completa
---

# 0128 — Nota de qualidade por anúncio e conjunto, com correção guiada pelo Astro

## 1. Contexto

Com a spec 0126, o painel mostra cada anúncio com setas contra a média da conta: verde quando é bom para o
cliente e vermelho quando pede atenção. O cliente vê **que** algo está ruim (ex.: CPC ↑ R$ 1,80 em vermelho),
mas não sabe **por quê**, **o que fazer** nem **quando** mexer. O erro mais comum de quem não é gestor é pausar
ou trocar um anúncio no segundo dia: isso reinicia a fase de aprendizado da Meta, deixa os números piores e
queima verba.

O objetivo do produto é que todos os indicadores fiquem verdes. Para isso, cada anúncio e cada conjunto precisa
de uma nota simples e de uma orientação com ação, sem o cliente precisar entender CPC ou CPM.

## 2. Objetivo

Cada anúncio e cada conjunto de anúncios mostra uma **nota de qualidade de 0 a 100**. Cada indicador vermelho,
ao ser clicado, explica a causa provável e a correção e oferece **"Fazer correção nesse criativo"** e
**"Duplicar criativo com correção"**. O Astro diz **quando** é seguro mexer, para não atrapalhar o aprendizado
da Meta.

### Não-objetivos

- Gerar imagem ou vídeo novo por IA. O Astro corrige o **texto** do anúncio e diz o que mudar no visual; o arquivo
  novo é do cliente. Imagem gerada em anúncio de saúde, finanças etc. tem alto risco de reprovação e de restrição
  da conta.
- Pausar, duplicar ou trocar anúncio sozinho. Toda ação parte de um clique do cliente.
- Nota para campanha encerrada ou fora do Órbita (anúncios sem o código do pedido e sem vínculo).
- Tabela nova. A nota é calculada na leitura, não guardada.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | **Nota do anúncio (0–100)**, regra fixa e sem IA (`lib/quality-score.ts`), somando pesos: custo por conversa 30, CTR 20, CPC 15, CPM 10, classificações da Meta 25 (qualidade 10, engajamento 8, conversão 7). Na média da conta cada indicador vale 70% do peso; 50% ou mais melhor vale o peso cheio; 100% pior vale zero. Indicador sem dado (ex.: sem conversas) sai da conta e o peso dele é redistribuído. |
| RF-2 | **Classificações da Meta** (`quality_ranking`, `engagement_rate_ranking`, `conversion_rate_ranking`) vêm na mesma leitura de insights por anúncio. ABOVE_AVERAGE = 100% do peso; AVERAGE = 70%; BELOW_AVERAGE_35 = 30%; BELOW_AVERAGE_20 = 15%; BELOW_AVERAGE_10 = 0%; UNKNOWN = fora da conta. |
| RF-3 | **Faixas:** 80–100 "Ótimo" (verde), 60–79 "Bom" (verde claro), 40–59 "Pode melhorar" (amarelo), 0–39 "Fraco" (vermelho). |
| RF-4 | **Nota do conjunto** = média das notas dos anúncios dele, ponderada pelo gasto no período. |
| RF-5 | **Aprendendo:** quando a Meta informa o conjunto em aprendizado (`learning_stage_info.status = LEARNING`), a nota aparece como **"Aprendendo — avalie a partir de DD/MM"**, com a data = início ou última mudança relevante do conjunto + 7 dias. Os indicadores continuam visíveis, mas as ações avisam que mexer agora reinicia o aprendizado. |
| RF-6 | **Dados insuficientes:** anúncio com menos de 1.000 impressões ou menos de 3 dias de entrega mostra "Dados insuficientes — aguarde até DD/MM", sem nota. |
| RF-7 | **Popover no indicador vermelho** (cartão da lista e tabela da campanha): título do problema, causa provável e correção em uma frase cada, vindas de um catálogo fixo (`lib/quality-diagnosis.ts`), e o tempo recomendado antes de mexer. Sem custo. |
| RF-8 | **"Pedir análise do Astro"** no popover: o Astro recebe a imagem do criativo (prévia da Meta), o texto do anúncio, os números contra a média e o "Sobre a empresa", e devolve o diagnóstico e um **texto corrigido** (texto principal, título e chamada), passando pelo prescreen de políticas que a IA nunca rebaixa (spec 0126, D-8). Custa 5 Stars, cobrados só depois da resposta. |
| RF-9 | **"Fazer correção nesse criativo"**: abre "Publicar e editar" na troca de anúncio (spec 0124, `replaceCampaignAd`) já preenchida com o texto corrigido; o cliente pode trocar a imagem. O anúncio novo substitui o antigo e herda o estado (no ar ou pausado). |
| RF-10 | **"Duplicar criativo com correção"**: cria um anúncio novo no **mesmo conjunto**, com o texto corrigido e a mesma imagem (ou uma nova enviada pelo cliente), **pausado**. Ativar segue o liga/desliga do cartão: confirmação e limite de anúncios no ar (spec 0127). O original continua rodando, para comparar. |
| RF-11 | **Aviso de tempo** nas duas ações quando o conjunto está aprendendo ou com dados insuficientes: "Mexer agora reinicia o aprendizado da Meta. O ideal é esperar até DD/MM." O cliente pode seguir mesmo assim, com confirmação. |
| RF-12 | As ações exigem a mesma permissão do "Publicar e editar" (`canBuild`: dono ou admin e conexão que altera a conta). Sem ela, o popover mostra só o diagnóstico. |
| RF-13 | **Média do mesmo objetivo:** cada anúncio é comparado com a média dos anúncios da conta **do mesmo objetivo** (campo `objective` da leitura de insights). Com menos de 3 anúncios do mesmo objetivo no período, vale a média da conta toda e o popover diz isso. |
| RF-14 | **Período de teste interno:** enquanto `TRAFEGO_QUALITY_SCORE_PUBLIC` não for `true`, a nota e o popover só aparecem para admin do sistema (`User.isSystemAdmin`); o cliente vê as setas como hoje. Condição de remoção do flag: 2 semanas de nota conferida pela equipe com o Gerenciador em pelo menos 3 clientes; depois disso o flag e o caminho antigo saem (S9). |
| RF-15 | **Taxa de conversa** = conversas ÷ cliques, novo indicador por anúncio (mais é melhor). Mostra se quem clicou mandou mensagem; baixa aponta problema na mensagem inicial ou no WhatsApp, não no criativo. O CTR continua "todos os cliques ÷ impressões" e já inclui o toque em "Enviar mensagem". |
| RF-16 | **Origem no Órbita, por anúncio:** mensagem inicial (texto pronto do anúncio de WhatsApp, lido do criativo na Meta), funil(s) do Órbita onde os leads desse anúncio caíram, tags mais comuns desses leads e quantos leads chegaram (comparado com as conversas da Meta). Vem do `Lead.metaAdId`, que o atendimento já grava; escopo sempre pela org do pedido. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Nenhuma chamada nova à Meta para a nota: as classificações e o `learning_stage_info` entram nas leituras que já existem (insights por anúncio e árvore da campanha). Cache de 15 min mantido. |
| RNF-2 | A nota é igual para os mesmos números (regra pura, coberta no script de QA). |
| RNF-3 | A análise do Astro responde em até 30 s; passou disso, erro com "Tentar de novo" e sem cobrança. |
| RNF-4 | Celular: o popover vira gaveta de baixo; botões `rounded-full`, `h-11`. |

## 4. Critérios de aceite

- [ ] **CA-1** — Anúncio na média da conta em todos os indicadores e classificações AVERAGE → nota entre 70 e 85.
- [ ] **CA-2** — Anúncio com custo por conversa 100% acima da média e o resto na média → perde os 30 pontos do custo por conversa (nota ≤ 70).
- [ ] **CA-3** — Anúncio sem conversas no período → custo por conversa sai da conta e o peso é redistribuído (a nota não vira zero por isso).
- [ ] **CA-4** — Conjunto com `learning_stage_info.status = LEARNING` → mostra "Aprendendo — avalie a partir de DD/MM" e as ações mostram o aviso do RF-11.
- [ ] **CA-5** — Anúncio com 600 impressões → "Dados insuficientes", sem nota.
- [ ] **CA-6** — Clicar no CPC vermelho abre o popover com causa, correção, tempo e os dois botões (com `canBuild`) ou só o diagnóstico (sem `canBuild`).
- [ ] **CA-7** — "Duplicar criativo com correção" cria o anúncio novo **pausado** no mesmo conjunto; com o limite de anúncios no ar cheio, ativá-lo é recusado com a mensagem da spec 0127.
- [ ] **CA-8** — Texto corrigido pelo Astro com "Você sofre de…?" é marcado pelo prescreen e não pode ser publicado sem a correção.
- [ ] **CA-9** — Sem Stars, "Pedir análise do Astro" avisa e não chama a IA.
- [ ] **CA-11** — Anúncio de conversa comparado só com anúncios de conversa da conta; com menos de 3, usa a conta toda e avisa.
- [ ] **CA-12** — Sem `TRAFEGO_QUALITY_SCORE_PUBLIC=true`, cliente comum não vê nota nem popover; admin do sistema vê.
- [ ] **CA-13** — 57 cliques e 7 conversas → taxa de conversa 12,28%.
- [ ] **CA-14** — Anúncio com 5 leads no Órbita mostra o funil e as tags deles; leads de outra org não entram.
- [ ] **CA-10** — Usuário de outra org não consegue pedir análise nem duplicar anúncio de um pedido que não é dele (NOT_FOUND antes de chamar a Meta ou a IA).

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Conta com um anúncio só | A média da conta é o próprio anúncio: indicadores na média, nota vem das classificações da Meta; sem setas vermelhas. |
| CB-2 | Classificação UNKNOWN (menos de 500 impressões) | Sai da conta; se todas forem UNKNOWN e houver menos de 1.000 impressões, vale o RF-6. |
| CB-3 | Anúncio reprovado ou com problema (`DISAPPROVED`, `WITH_ISSUES`) | Sem nota; o popover mostra o motivo da Meta e "Fazer correção". |
| CB-4 | Prévia do criativo indisponível (vídeo sem miniatura) | A análise do Astro roda só com texto e números e avisa. |
| CB-5 | Dois cliques em "Duplicar" | O botão trava durante a criação; o servidor recusa outro duplicado do mesmo anúncio em menos de 1 min. |
| CB-6 | Conjunto com otimização diferente de conversa (ex.: alcance) | Custo por conversa sai da conta (como no CA-3); a nota usa CTR, CPC, CPM e classificações. |
| CB-7 | Média da conta inclui campanhas de outro objetivo | Aceito nesta etapa; o popover diz "comparado com a média da sua conta". Filtro por objetivo fica como melhoria. |

## 6. Decisões de design

### D-1 — Nota por regra fixa, IA só sob demanda
A nota precisa ser instantânea, gratuita e estável; IA a cada leitura custaria Stars e daria notas diferentes para os
mesmos números. A IA entra no "Pedir análise do Astro", quando o cliente quer o texto corrigido.

### D-2 — Classificações da Meta entram na nota
São o sinal oficial de qualidade do criativo contra anúncios do mesmo público, e vêm sem chamada extra.
**Descartado:** nota só com os nossos indicadores — ignora o que a própria Meta já mede.

### D-3 — Tempo de aprendizado vem da Meta
`learning_stage_info` diz se o conjunto ainda aprende. A data "avalie a partir de" é o início ou a última mudança
relevante + 7 dias (a janela que a Meta usa para ~50 resultados). **Descartado:** prazo fixo para todos — ignora
mudança recente que reiniciou o aprendizado.

### D-4 — Duplicar nasce pausado
O original segue rodando para comparar; o novo só gasta quando o cliente ativa, com a confirmação e o limite da
spec 0127. Evita gasto surpresa e respeita o limite de anúncios no ar.

### D-6 — Comparar com o mesmo objetivo
Campanha de alcance tem CPM muito menor que a de conversa; misturar as duas deixa toda campanha de conversa "cara".
O objetivo vem na mesma leitura, sem custo. **Descartado:** média da conta toda sempre.

### D-7 — Ver origem antes de configurar rota
Esta etapa **mostra** funil, tags e leads por anúncio. Escolher o funil e a tag de cada anúncio fica para os Gatilhos
Automáticos ("lead veio do anúncio X → funil Y, tag Z"), que já fazem roteamento; não cria configuração paralela.

### D-8 — Benchmark do setor e sandbox (fase 2)
O comparativo com o setor da Meta (`ads_insights_industry_benchmark` / desempenho contra concorrentes, pelo MCP
oficial) entra como segunda referência depois do período de teste interno. Os testes de escrita (pausar, corrigir,
duplicar) usam uma **conta de anúncios sandbox** da Meta ligada ao app de teste, que aceita escrita sem veicular nem
gastar; o passo a passo fica no playbook do gestor.

### D-5 — O Astro corrige texto, não gera imagem
Ver Não-objetivos. A sugestão visual vira orientação ("rosto e produto nos 3 primeiros segundos"), e o cliente envia o arquivo.

## 7. Impacto

**Schema:** nenhum.

**Reaproveita:** `order-ads-performance.ts` (insights por anúncio e árvore), `averageAdMetrics`/`compareWithAverage`,
`AverageArrow`, `reviewCreative` e o prescreen de políticas (spec 0126), `replaceCampaignAd` (spec 0124),
`setOrderDeliveryStatus` e o limite de anúncios no ar (spec 0127), `chargeStarsByAction`.

**Novo:**
- `lib/quality-score.ts` — nota, faixas, gates de aprendizado e dados insuficientes (puro).
- `lib/quality-diagnosis.ts` — catálogo de causa/correção por indicador (puro).
- Insights por anúncio passam a pedir `quality_ranking`, `engagement_rate_ranking`, `conversion_rate_ranking`; a árvore
  passa a pedir `learning_stage_info` e `updated_time` do conjunto.
- `server/lib/quality-fix.ts` — análise do Astro com números e texto corrigido; criação do anúncio duplicado pausado.
- Procedures `trafego.campaignBuilder.{analyzeAd,duplicateAdWithFix}`; hooks no `use-trafego-campaign-builder.ts`.
- UI: `QualityScoreBadge` (anúncio e conjunto, cartão e tabela), `IndicatorPopover` sobre o `AverageArrow` vermelho,
  e a troca de anúncio aceitando texto pré-preenchido.

**Stars:** nova ação `trafego_ad_fix` (5 Stars) em `star-rules.ts` e recurso de IA em `ai-resources.ts`.

**Docs:** `docs/trafego-overview.md` e `docs/trafego-playbook-gestor.md` (como a equipe lê a nota).

**Inngest:** nada.

### Segurança de dados

- Análise e duplicação conferem o pedido da org e que o anúncio é das campanhas do pedido **antes** de chamar Meta ou IA (CA-10).
- A imagem enviada à IA vem da prévia da Meta (URL da Graph, só CDN da Meta); nenhuma URL do cliente é baixada.
- O texto do anúncio e o "Sobre a empresa" vão ao mesmo provedor de IA da checagem de textos; nada além disso.

### Regras da Meta

- Corrigir um anúncio no ar cria um anúncio novo e reinicia o aprendizado dele; por isso o aviso do RF-11.
- Mudanças grandes no conjunto (público, verba > 20%, pausa longa) também reiniciam o aprendizado: o catálogo de
  correção prefere ajustar o criativo e o texto antes de mexer no conjunto.
- O texto corrigido passa pelo prescreen (atributos pessoais, promessa de resultado, antes e depois) e a análise
  diz que é orientação, sem garantia de aprovação.
- As classificações da Meta só existem acima de 500 impressões; abaixo disso, UNKNOWN (CB-2).

## 8. Plano de testes

- `scripts/trafego-0128-qa-check.ts`: um caso por CA das regras puras (CA-1 a CA-5, CB-1, CB-2, CB-6).
- Rotas com `curl`: CA-10.
- Navegador, na GOTHAN com a conta da Tércio (só leitura): nota, "Aprendendo", popover e diagnóstico (CA-4 a CA-6).
- Ações de escrita (CA-7) só numa conta de teste com permissão de gerenciar anúncios; **nunca** na conta da clínica sem pedido explícito.
- `pnpm lint` nos arquivos tocados; sem typecheck local.

## 9. Riscos e rollback

- **Nota mal calibrada** assusta ou acomoda o cliente. Mitigação: período de teste interno (RF-14), pesos e faixas numa
  constante só, comparação com o mesmo objetivo (RF-13) e benchmark do setor na fase 2 (D-8).
- **Teste de escrita em conta real.** Mitigação: conta sandbox da Meta (D-8); nunca na conta de cliente sem pedido explícito.
- **Cliente mexe cedo demais mesmo com o aviso.** Mitigação: confirmação explícita com a data recomendada.
- **Custo de IA** só sob demanda, coberto pelos Stars da ação.
- **Rollback:** reverter o PR; nada no banco.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-31 | Weydson Lima (com Claude) | Criada a partir do pedido de nota de qualidade com correção pelo Astro. Decisões: nota por regra fixa com as classificações da Meta, tempo de aprendizado vindo da Meta, duplicado nasce pausado, Astro corrige texto e não gera imagem. |
| 2026-10-31 | Weydson Lima (com Claude) | Aprovada com: média do mesmo objetivo (RF-13), período de teste interno por flag (RF-14), taxa de conversa (RF-15), origem no Órbita por anúncio — mensagem inicial, funil, tags e leads (RF-16); benchmark do setor e sandbox como fase 2 (D-8). |
| 2026-10-31 | Weydson Lima (com Claude) | Toda seta abre a janela (não só as vermelhas): vermelha com causa, correção e ações; verde com "bom sinal" e o que o número significa; cinza só o significado. Catálogo ganhou alcance e impressões abaixo da média; frequência e investido explicados. |
