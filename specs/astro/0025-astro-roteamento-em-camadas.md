---
id: 0025
titulo: Roteamento em camadas — o Astro alcança todos os apps sem perder precisão
dominio: astro
status: rascunho
autor: Weydson
criada: 2026-09-24
atualizada: 2026-09-24
branch: feature/W-forge-simulador-custos-20260923
pr:
peso: completa
---

# 0025 — Roteamento em camadas

## 1. Contexto

As specs 0023 e 0024 entregaram 19 verbos, e no caminho mediram o limite do
desenho atual: **uma lista única de ações fica menos precisa conforme cresce.**

Duas medições, não estimativas:

| O que mudou | Efeito |
| --- | --- |
| Entrou um verbo novo no catálogo | `agenda.create_reminder` passou a ser confundido com `lead.add_note` — acertava **1 em 3** |
| Entrou **um parágrafo** no prompt do classificador | `tracking.create_status` caiu de **3/3 para 0/3**, sem ninguém tocar nesse verbo |

O objetivo do dono do produto é o Astro executar **qualquer ação de qualquer
app**. O universo elegível, pelo critério da spec 0024, é de **30 apps e 288
escritas** — um catálogo uma ordem de grandeza maior que o de hoje.

Com lista única, esse catálogo não classifica: o prompt passaria de ~9.000
tokens e a confusão entre verbos vizinhos, já visível com 19, seria a regra.

> **Correção de rumo.** A spec 0023, na D-1, descartou dividir a triagem em
> etapas alegando custo. Aquilo valia para 19 verbos e **deixa de valer** na
> escala pedida: com 200 verbos, duas perguntas curtas custam menos que uma
> longa, porque cada etapa carrega uma lista pequena. Ver §6, D-1.

## 2. Objetivo

O Astro passa a alcançar todos os apps sem que verbo novo degrade verbo
antigo, combinando três mecanismos: **triagem em duas etapas**, **dropdown de
escolha quando há dúvida** e **escalada para modelo mais capaz** quando o
pedido é genuinamente difícil.

### Não-objetivos

- **Não** implementar os 288 verbos nesta spec. Aqui entra a máquina; os
  verbos entram por onda, como já vinha sendo feito.
- **Não** mexer no que já funciona: registro de ações, confirmação, `dryRun`,
  auditoria nos Insights e o orquestrador continuam como estão.
- **Não** dar ao Astro os apps excluídos pela 0024 (`admin`, preferência de
  tela, infraestrutura).

## 3. As três camadas

### 3.1 Triagem em duas etapas

| Etapa | Pergunta | Tamanho da lista |
| --- | --- | --- |
| 1 | De qual **app** é este pedido? | ~15 nomes |
| 2 | Qual **ação** dentro deste app? | ~10 verbos |

Nenhuma etapa vê mais de ~15 opções, independentemente do tamanho total do
catálogo. É a diferença entre um cardápio de 200 linhas soltas e um com seções.

Custo projetado, contra a lista única:

| Catálogo | Lista única | Duas etapas |
| --- | ---: | ---: |
| 19 verbos (hoje) | ~1.240 | ~1.600 |
| 200 verbos | ~9.000, com confusão | **~900** |

### 3.2 Dropdown quando há dúvida

Confiança intermediária **não vira chute nem escalada**: vira pergunta com
opções no próprio campo de mensagem. O usuário toca e segue.

```
Você: "manda pro Kauê"
Astro: [ Enviar formulário ▾ ]  ← dropdown com as 3 ações mais prováveis
       ( ) Enviar formulário ao Kauê
       ( ) Enviar template de WhatsApp
       ( ) Encaminhar última mensagem
```

Quem sabe a resposta é o usuário. Perguntar custa **zero token** e acerta
100% — contra um modelo mais caro que acertaria talvez 80%.

### 3.3 Escalada de modelo

Só quando nem a etapa 2 nem o dropdown resolvem — pedido que envolve análise,
várias fontes ou raciocínio — o pedido sobe:

```
FAST (classificar)  →  SMART (classificar)  →  orquestrador completo
   ~400 tokens          ~600 tokens              ~18.500 tokens
```

O roteador de níveis da Fase 4 (PR #400) já existe e é o que provê isso.

## 4. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Cada ação do registro declara seu `app`. A etapa 1 classifica entre os apps que têm ao menos um verbo. |
| RF-2 | A etapa 2 recebe **apenas** os verbos do app escolhido. |
| RF-3 | Confiança ≥ `ALTA` executa direto (com confirmação, quando a ação exigir). |
| RF-4 | Confiança entre `BAIXA` e `ALTA` devolve **dropdown** com até 3 candidatos, no formato de ação já existente (`status: "ambiguous"`). |
| RF-5 | Escolha no dropdown executa sem nova chamada de modelo — o candidato já traz ação e campos. |
| RF-6 | Confiança < `BAIXA` na etapa 1 sobe para o nível SMART **na mesma etapa**, antes de cogitar o orquestrador. |
| RF-7 | Falha ou dúvida persistente depois da escalada cai no orquestrador, como hoje. |
| RF-8 | O `UsageEvent` grava qual camada resolveu: `stage1`, `stage2`, `dropdown`, `smart` ou `orchestrator`. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Pedido resolvido pelas duas etapas continua abaixo de **10% do turno do orquestrador**, com o catálogo em qualquer tamanho. |
| RNF-2 | Verbo novo **não** pode derrubar a taxa de acerto de verbo existente. O script roda todas as frases típicas a cada mudança. |
| RNF-3 | Dropdown não consome token: os candidatos vêm da etapa 2 já feita. |
| RNF-4 | Etapa 1 + etapa 2 somadas respondem em < 3 s no p95. |

## 5. Critérios de aceite

- [ ] **CA-1** — Com 40+ verbos no registro, toda frase típica continua classificando ≥ 2/3, igual a hoje com 19.
- [ ] **CA-2** — "manda pro Kauê" (ambíguo de propósito) devolve dropdown com 3 opções, e nenhuma chamada extra de modelo é feita.
- [ ] **CA-3** — Escolher no dropdown executa a ação correspondente sem reclassificar.
- [ ] **CA-4** — Pedido analítico continua indo ao orquestrador.
- [ ] **CA-5** — O `UsageEvent` distingue as cinco camadas.
- [ ] **CA-6** — Com o catálogo dobrado, o custo por pedido simples **não** dobra.

## 6. Decisões de design

### D-1 — Duas etapas, revertendo a D-1 da spec 0023

- **Escolha**: triagem em app → verbo.
- **O que muda desde a 0023**: lá o argumento contra era custo, e estava certo
  para 19 verbos. Na escala pedida ele se inverte — a lista única cresce
  linearmente e a de duas etapas fica constante.
- **Consequência**: um pedido simples passa a fazer duas chamadas curtas em vez
  de uma longa. Hoje isso é ~30% mais caro; a partir de ~40 verbos, mais barato.

### D-2 — Dúvida vira dropdown, não modelo melhor

- **Escolha**: confiança intermediária pergunta ao usuário, com opções.
- **Alternativa descartada**: *escalar direto para um modelo melhor* — custa
  token, demora, e ainda pode errar. O usuário sabe a resposta e responde num
  toque.
- **Consequência**: o caso ambíguo, que hoje é o mais caro, passa a ser o mais
  barato. E o Astro nunca "quebra" por não saber: ele pergunta.

### D-3 — Escalada de modelo só depois do dropdown

- **Escolha**: FAST → SMART → orquestrador, e o dropdown entra antes da
  escalada.
- **Alternativa descartada**: *começar no modelo melhor* — pagaria o preço alto
  em todo pedido para resolver a minoria difícil.

### D-4 — O registro passa a declarar o app

- **Escolha**: campo `app` obrigatório em cada ação.
- **Consequência**: a etapa 1 se monta sozinha a partir do registro — app novo
  aparece na triagem sem código novo, como o CA-8 da 0024 já garante para os
  verbos.

## 7. Impacto

- [ ] Schema / migration — nenhuma.
- [x] Procedures oRPC — nenhuma muda; o roteamento é interno ao `/api/astro/chat`.
- [x] UI — o campo de mensagem ganha o dropdown de escolha.
- [ ] Env vars — os limiares ficam em constante versionada.
- [ ] Breaking change.
- [x] Documentação — esta spec e a 0024 (que passa a apontar para cá).

## 8. Plano de testes

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1 | script | `verify-astro-routing.ts`, já existente, com o catálogo maior |
| CA-2, CA-3 | manual + script | Frase ambígua devolve 3 opções; escolher executa |
| CA-4 | script | O caso analítico da suíte atual |
| CA-5 | script | Ler `metadata.route` dos `UsageEvent` das cinco camadas |
| CA-6 | script | Medir o custo com N e com 2N verbos e comparar |

## 9. Riscos e rollback

**O risco principal é a etapa 1 errar o app.** Errar o app faz o verbo certo
nem ser considerado. Mitigado porque nomes de app são muito mais distintos
entre si do que verbos vizinhos ("agenda" contra "formulário" é fácil;
"anotar" contra "lembrar" é difícil) — e porque confiança baixa na etapa 1
escala para o SMART antes de decidir (RF-6).

**Latência.** Duas chamadas em série somam. RNF-4 fixa o teto em 3 s e a
escalada só acontece quando necessário.

**Rollback**: `ASTRO_INTENT_ROUTING=false` continua desligando tudo. Uma
constante nova permite voltar à etapa única sem remover código.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-24 | Weydson | Criada a partir do limite medido nas specs 0023/0024 e do desenho proposto pelo dono do produto: duas etapas, dropdown na dúvida, escalada de modelo no difícil |
