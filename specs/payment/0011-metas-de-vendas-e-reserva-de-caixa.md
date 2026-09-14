---
id: 0011
titulo: Metas de vendas e reserva mínima de caixa
dominio: payment
status: implementada
autor: Weydson
criada: 2026-09-14
atualizada: 2026-09-14
branch: feature/W-trafego-self-service-20260908
pr:
peso: completa
---

# 0011 — Metas de vendas e reserva mínima de caixa

---

## 1. Contexto

Hoje o Painel Financeiro exibe uma barra "Meta do mês" que **não é uma meta**:
`goalTarget` é calculado como `totalReceived + totalReceivable`
([dashboard.ts:266](../../src/app/router/payment/dashboard.ts)), ou seja, a
própria previsão do mês. O medidor sempre caminha para 100% por construção e
não informa nada — em setembro/2026 marcava 37% só porque metade do mês ainda
não tinha vencido.

Não existe lugar no módulo para responder as duas perguntas que o dono do
negócio faz todo mês:

- **Quanto preciso vender?** — não há meta cadastrada em lugar nenhum.
- **Quanto preciso deixar no caixa?** — não há piso de reserva; o card
  "Reservas" mostra apenas o saldo somado das contas bancárias
  (R$ 0,00 na org em produção, porque ninguém alimenta saldo).

Consequência prática: a decisão de pagar ou segurar uma despesa é tomada no
olho. Não há aviso quando o mês caminha para fechar abaixo do caixa necessário.

## 2. Objetivo

O dono define uma meta de vendas e um percentual de reserva de caixa, vê no
Painel quanto falta para cada um, e é avisado antes de o mês fechar abaixo da
reserva.

### Não-objetivos

- Meta por vendedor, por categoria ou por centro de custo. Esta versão é uma
  meta única por organização/mês.
- Meta de despesa (teto de gastos). O que a tela mostra é o **compromisso já
  lançado** do mês, não um limite a respeitar.
- Reconciliação com saldo bancário real (`PaymentBankAccount.balance`). A
  reserva é medida contra o caixa **projetado pelos lançamentos**, não contra
  extrato — o saldo das contas hoje não é alimentado de forma confiável.
- Meta acumulada / trimestral / anual.
- Envio por WhatsApp. Os alertas nascem in-app (`UserNotification`), que já
  dispara Pusher via `createNotification`.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Existe uma tela de configuração com meta de vendas (R$) e reserva de caixa (% da receita) padrão da organização |
| RF-2 | É possível sobrescrever meta e/ou reserva de um mês específico; mês sem override herda o padrão |
| RF-3 | A meta é medida contra a **receita realizada** do mês: `paidAmount` de `RECEIVABLE` com `status: PAID` e `paidAt` no mês — o mesmo número do card "Faturamento" |
| RF-4 | A reserva-alvo do mês é `percentual × receita realizada`; a reserva-alvo **projetada** usa a receita prevista (realizada + a receber em aberto) |
| RF-5 | O Painel exibe um card com: progresso da meta, reserva-alvo vs. caixa projetado, e total de despesa ainda a pagar no mês |
| RF-6 | A barra "Meta do mês" do resumo executivo passa a usar a meta cadastrada; sem meta cadastrada, o medidor não é exibido |
| RF-7 | Alerta **risco de reserva**: quando o caixa projetado do mês fica abaixo da reserva-alvo projetada |
| RF-8 | Alerta **resumo semanal**: toda segunda, com meta atingida, despesa a pagar e caixa projetado |
| RF-9 | Alerta **meta batida**: quando a receita realizada cruza a meta do mês |
| RF-10 | Alerta **despesa estoura o caixa**: ao criar ou aprovar um `PAYABLE` que derruba a projeção abaixo da reserva |
| RF-11 | Cada um dos quatro alertas pode ser ligado/desligado na configuração |
| RF-12 | Os alertas vão para quem tem acesso ao módulo financeiro com permissão de ver o dashboard |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | O cálculo de metas reaproveita os mesmos agregados do dashboard — um único número de receita realizada no módulo, nunca dois |
| RNF-2 | Os crons custam zero execução para organização sem meta cadastrada |
| RNF-3 | Cada alerta dispara no máximo uma vez por mês por organização (exceto o resumo semanal, 1×/semana) |

## 4. Critérios de aceite

- [x] **CA-1** — Dado que não existe meta cadastrada, quando abro o Painel,
      então o card de metas mostra um convite para configurar e a barra "Meta
      do mês" não aparece.
- [x] **CA-2** — Dada meta padrão de R$ 30.000 e nenhum override, quando abro
      outubro, então a meta exibida é R$ 30.000.
- [x] **CA-3** — Dada meta padrão de R$ 30.000 e override de R$ 50.000 em
      dezembro, quando abro dezembro, então a meta exibida é R$ 50.000; ao
      voltar para novembro, R$ 30.000.
- [x] **CA-4** — Dada reserva de 20% e receita realizada de R$ 7.407,88, então
      a reserva-alvo exibida é R$ 1.481,58.
- [x] **CA-5** — Dada reserva de 20%, receita prevista de R$ 20.113,65 e
      despesa prevista de R$ 10.567,20, então o caixa projetado é R$ 9.546,45,
      a reserva projetada é R$ 4.022,73 e o card indica folga de R$ 5.523,72.
- [x] **CA-6** — Dado caixa projetado abaixo da reserva projetada, quando o
      cron diário roda, então cada usuário com acesso ao dashboard recebe uma
      `UserNotification` de risco de reserva.
- [x] **CA-7** — Dado que o alerta de risco já foi enviado neste mês, quando o
      cron roda de novo no mesmo mês, então nenhuma notificação nova é criada.
- [x] **CA-8** — Dada receita realizada que cruza a meta, quando o cron roda,
      então sai uma notificação de meta batida — e só uma, mesmo que a receita
      continue subindo.
- [x] **CA-9** — Dado um `PAYABLE` cujo lançamento derruba a projeção abaixo da
      reserva, quando ele é criado, então sai a notificação de despesa crítica.
- [x] **CA-10** — Dado o alerta de resumo semanal desligado na configuração,
      quando a segunda chega, então nada é notificado.
- [x] **CA-11** — Dado percentual de reserva fora de 0–100, quando salvo a
      configuração, então a procedure rejeita com erro de validação.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Meta cadastrada como R$ 0 | Tratada como "sem meta": medidor oculto, alerta de meta batida não dispara (divisão por zero) |
| CB-2 | Reserva 0% | Reserva-alvo é R$ 0; alerta de risco só dispara com caixa projetado negativo |
| CB-3 | Receita realizada R$ 0 no início do mês | Reserva-alvo é R$ 0; a projetada usa a receita prevista, então o card ainda informa algo útil |
| CB-4 | Mês fechado no passado | Card mostra o resultado final; crons não olham meses passados |
| CB-5 | Filtro de categoria ativo no Painel | O card de metas **ignora** o filtro de categoria e sempre mostra o mês inteiro, com aviso na tela. Meta é da empresa, não da categoria |
| CB-6 | Período customizado (não um mês inteiro) no picker | Card de metas oculto: meta é mensal e não faz sentido em intervalo arbitrário |
| CB-7 | Organização sem nenhum usuário com acesso ao dashboard | Cron loga warning e não falha |
| CB-8 | Override criado e depois zerado pelo usuário | Campo nulo volta a herdar o padrão, em vez de valer 0 |
| CB-9 | Despesa crítica lançada com a projeção **já** abaixo da reserva | Não notifica de novo: o alerta é sobre *cruzar* o limite, e o alerta mensal de risco já cobriu |
| CB-10 | Dois usuários salvam a config do mesmo mês ao mesmo tempo | `upsert` com unique `[organizationId, year, month]`; o último a gravar vence |
| CB-11 | Despesa criada já em `PENDING_APPROVAL` | Não dispara o alerta de despesa crítica: ela ainda não pesa no caixa projetado. A checagem roda de novo quando a aprovação sai |
| CB-12 | Nenhum destinatário elegível no momento do alerta | O carimbo **não** é gravado. Carimbar um alerta que não chegou a ninguém o silenciaria para o resto do mês |

## 6. Decisões de design

### D-1 — Padrão na organização + override por mês, em dois modelos

- **Escolha**: `PaymentGoalConfig` (1 por org, guarda os defaults e as flags de
  alerta) e `PaymentGoalMonth` (override opcional por ano/mês).
- **Alternativas descartadas**: (a) um modelo só com `year`/`month` nulos para
  o padrão — no Postgres `NULL != NULL`, então o `@@unique` não impediria dois
  registros "padrão" para a mesma org; (b) `periodKey` string com o valor
  `"default"` — resolve o unique mas mistura dois conceitos numa coluna e
  atrapalha consulta por intervalo.
- **Consequência**: ler a meta de um mês custa duas linhas (config + override),
  buscadas numa query só.

### D-2 — Reserva é % da receita realizada; o alerta usa a projetada

- **Escolha**: `reservaAlvo = percentual × receita realizada` para o número que
  a tela mostra como "já preciso ter guardado"; o alerta compara
  `caixaProjetado` contra `percentual × receita prevista`.
- **Alternativas descartadas**: usar sempre a receita prevista — infla a
  reserva no dia 1º do mês, quando nada entrou ainda, e o card abriria todo mês
  em vermelho.
- **Consequência**: a reserva-alvo cresce ao longo do mês. Precisa estar
  explícito na tela, senão parece instável.

### D-3 — Meta contra caixa recebido, não contra venda lançada

- **Escolha**: `RECEIVABLE` + `PAID`, por `paidAt` — mesmo agregado do card
  "Faturamento".
- **Alternativas descartadas**: medir contra o vendido (recebido + a receber).
  Mede o comercial, mas descola da reserva, que é caixa. Misturar as duas
  réguas na mesma tela é exatamente o que gerou a confusão da spec 0010.
- **Consequência**: venda feita e não recebida não conta para a meta. É o
  comportamento correto para uma meta que convive com reserva de caixa, mas
  precisa estar escrito na tela.

### D-4 — Card de metas ignora o filtro de categoria

- **Escolha**: sempre o mês inteiro da organização, com aviso quando há filtro
  de categoria ativo.
- **Alternativas descartadas**: respeitar o filtro — a meta passaria a ser
  comparada contra um recorte, e o número mudaria conforme o filtro sem que a
  meta mudasse.
- **Consequência**: é o único bloco do Painel que não responde ao filtro
  compartilhado. Exige o aviso de CB-5 para não parecer bug.

### D-5 — Três alertas por cron diário, um por evento

- **Escolha**: um cron diário resolve risco de reserva e meta batida (ambos
  dependem de agregado do mês); o resumo semanal é um segundo cron na segunda;
  a despesa crítica é disparada no fluxo de criação/aprovação do `PAYABLE`.
- **Alternativas descartadas**: recalcular a cada lançamento — custo alto e
  notificação repetida a cada edição.
- **Consequência**: risco de reserva pode demorar até 24h para avisar, exceto
  quando o gatilho é uma despesa nova, que avisa na hora.

### D-7 — Decisão dos alertas fora do handler do Inngest

- **Escolha**: `runGoalDailyCheck` / `runGoalWeeklySummary` em
  `server/goals/run-alert-checks.ts`; o cron é um wrapper de três linhas.
- **Alternativas descartadas**: manter a lógica dentro do `createFunction` —
  só exercitável subindo o agendador, o que inviabiliza verificar os critérios.
- **Consequência**: os CA-6 a CA-10 foram verificados chamando essas funções
  contra o banco real, sem depender do cron disparar.

### D-6 — Idempotência via carimbo no registro do mês

- **Escolha**: `PaymentGoalMonth` ganha `reserveRiskNotifiedAt` e
  `goalReachedNotifiedAt`. O cron cria a linha do mês se ela não existir.
- **Alternativas descartadas**: consultar `UserNotification` por tipo e
  intervalo — funciona, mas é varredura numa tabela que cresce rápido.
- **Consequência**: a linha do mês passa a existir mesmo sem override do
  usuário, com os campos de valor nulos (herdando o padrão). CB-8 depende
  disso funcionar.

## 7. Impacto

- [x] Schema / migration (`prisma/schema.prisma`) — 2 modelos novos
- [x] Procedures oRPC (contrato de entrada/saída) — 3 novas
- [x] Realtime (Pusher) — via `createNotification`, sem canal novo
- [x] Automações (Inngest) — 2 crons novos
- [ ] Env vars novas
- [ ] Breaking change para clientes existentes
- [ ] Documentação obrigatória (CLAUDE.md itens 10 / 14 / 16)

### Superfície estimada

| Camada | Arquivos |
| --- | --- |
| Schema | `PaymentGoalConfig`, `PaymentGoalMonth` + migration |
| Server | `src/features/payment/server/goals/` — resolver da meta do mês e cálculo de reserva |
| Procedures | `getPaymentGoals`, `updatePaymentGoalConfig`, `upsertPaymentGoalMonth` em `src/app/router/payment/goals.ts` |
| Hooks | `src/features/payment/hooks/use-payment-goals.ts` (regra 9) |
| UI | `goals-card.tsx` no Painel + seção em `payment-settings.tsx` |
| Inngest | `payment-goal-daily-check`, `payment-goal-weekly-summary` |
| Notificações | 4 entradas novas em `NOTIF_TYPES` |

## 8. Plano de testes

> **Status**: CA-1 a CA-11 verificados em 14/09/2026 no ambiente de dev
> (org GOTHAN CITY), com lançamentos reproduzindo os números de setembro.

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1 a CA-3 | manual | Cadastrar padrão, abrir três meses diferentes, criar override em um |
| CA-4, CA-5 | manual | Conferir contra os números reais de setembro/2026 registrados na spec 0010 |
| CA-6 a CA-8 | manual | Disparar o cron pelo dev server do Inngest (`pnpm inngest:dev`) com meta acima e abaixo do realizado |
| CA-9 | manual | Lançar despesa grande com reserva apertada |
| CA-10, CA-11 | manual | Desligar a flag; tentar salvar 150% |

> Sem cobertura automatizada — o projeto ainda não tem runner instalado
> (CLAUDE.md item 20). Quando houver, cada `CA-n` vira teste com o id no nome.

## 9. Riscos e rollback

- **Migration**: aditiva, duas tabelas novas, nenhuma coluna alterada em tabela
  existente. Reversível com `DROP TABLE`.
- **Risco de spam de notificação**: se o carimbo de idempotência (D-6) falhar,
  o cron notifica todo dia. Mitigação: o carimbo é gravado no mesmo passo do
  envio; em caso de dúvida, desligar a flag em RF-11 corta o alerta sem deploy.
- **Risco de número divergente**: se o cálculo de receita realizada for
  reimplementado em vez de reaproveitado (RNF-1), as metas passam a discordar do
  Painel — exatamente o problema que a spec 0010 acabou de corrigir.
- **Rollback**: reverter o commit e dropar as duas tabelas. Nenhum dado de
  lançamento é tocado.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-14 | Weydson | Criada, com as quatro decisões de escopo respondidas em sessão |
| 2026-09-14 | Weydson | Implementada. CB-11 acrescentado durante a implementação: somar de volta uma despesa em `PENDING_APPROVAL` inflava o caixa "antes" e acusava um cruzamento inexistente |
| 2026-09-14 | Weydson | Verificada em dev contra o banco real: todos os CA-1 a CA-11 passaram. Três correções saíram do teste — invalidação de cache usava `["payment"]` em vez de `orpc.payment.key()` (o painel só atualizava após reload); o resumo semanal contava envio sem destinatário; o carimbo era gravado mesmo sem ninguém notificado (CB-12). D-7 registra a extração da lógica dos crons |
