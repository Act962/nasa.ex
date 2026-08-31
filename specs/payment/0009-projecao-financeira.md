---
id: 0009
titulo: Projeção financeira — saldo futuro por mês
dominio: payment
status: aprovada
autor: Weydson
criada: 2026-08-31
atualizada: 2026-08-31
branch: feature/W-payment-melhorias-financeiro-20260831
pr:
peso: completa
---

# 0009 — Projeção financeira: saldo futuro por mês

---

## 1. Contexto

O módulo financeiro responde bem "o que aconteceu" e "o que está em aberto",
mas não responde **"quanto vou ter em caixa daqui a três meses"** — que é a
pergunta que faz o dono do negócio decidir contratar, comprar ou segurar.

O que existe hoje e por que não resolve:

- **Fluxo de Caixa** (`getCashflow`) agrega `PaymentEntry` por `dueDate` dentro
  de um período escolhido. Duas limitações: o saldo acumulado **começa do
  zero**, ignorando o dinheiro que a empresa já tem; e ele só enxerga o que já
  foi lançado, então um mês futuro sem lançamentos aparece como zero — o que
  se lê como "não vai entrar nada", quando o certo seria "ninguém lançou
  ainda".
- **DRE/DRO** são retrospectivos por competência.
- O dashboard mostra totais do período corrente.

Resultado prático: para saber o caixa de setembro, alguém exporta CSV e monta
planilha à parte — e a planilha diverge do sistema no dia seguinte.

## 2. Objetivo

O usuário abre uma aba e vê, mês a mês num horizonte configurável, quanto
espera ter em caixa — separando o que já está contratado do que é estimativa
baseada no histórico.

### Não-objetivos

- **Cenários nomeados e editáveis** (otimista/realista/pessimista com premissas
  salvas). Exigiria tabela nova; fica para spec futura se a projeção pegar uso.
- **Projeção por conta bancária individual.** O horizonte é o caixa
  consolidado da organização.
- **Machine learning / sazonalidade estatística.** A tendência é média
  aritmética simples de meses realizados — explicável em uma frase, que é o que
  importa quando alguém questiona o número.
- **Editar a projeção.** É leitura; para mudar o futuro, lança-se no sistema.
- **Alertas automáticos de caixa negativo** (e-mail/Inngest). A tela sinaliza
  visualmente; notificar é outra spec.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Nova aba **Projeção** no módulo financeiro. |
| RF-2 | O saldo inicial é a soma de `PaymentBankAccount.balance` das contas ativas da organização. |
| RF-3 | Horizonte selecionável: 3, 6 ou 12 meses. Default 6. |
| RF-4 | Para cada mês futuro, a projeção separa **firme** (lançamentos já registrados, ainda não pagos) de **estimado** (tendência histórica). |
| RF-5 | A tendência é a média mensal **realizada** dos últimos N meses fechados (default 6), por natureza (entrada/saída). |
| RF-6 | O estimado **completa** a média, não soma sobre o firme: `estimado = max(0, médiaHistórica − firmeDoMês)`. |
| RF-7 | Vencidos não pagos (`OVERDUE`, ou vencimento passado ainda em aberto) entram no **primeiro** mês projetado, não no mês de origem. |
| RF-8 | Lançamentos `PAID` não entram na projeção — o dinheiro já se moveu e está refletido no saldo das contas. |
| RF-9 | Em lançamento `PARTIAL`, projeta-se apenas o saldo devedor (`amount − paidAmount`). |
| RF-10 | A tela mostra o saldo projetado acumulado mês a mês, em gráfico e em tabela. |
| RF-11 | Meses com saldo projetado negativo são destacados visualmente. |
| RF-12 | A tela informa o **grau de confiança** de cada mês: proporção do firme sobre o total projetado. |
| RF-13 | A estimativa do mês corrente é rateada pela fração do mês que ainda resta. |
| RF-14 | Quando não há histórico suficiente para média, a projeção mostra só o firme e diz explicitamente que não há base para estimativa. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Uma única query de lançamentos para todo o cálculo — nada de uma query por mês do horizonte. |
| RNF-2 | Permissão reaproveita o recurso `dashboard` do `PaymentAccess`, como `getCashflow`. |
| RNF-3 | Todo dinheiro trafega em centavos (`Int`), como no resto do módulo. |
| RNF-4 | O cálculo é puro e isolado do acesso a banco, para poder ser conferido sem subir a aplicação. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado saldo de contas de R$ 10.000 e nenhum lançamento futuro nem histórico, quando abrir a Projeção, então todos os meses mostram saldo projetado R$ 10.000 e confiança "sem base histórica".
- [ ] **CA-2** — Dado um a receber de R$ 5.000 vencendo no mês que vem, quando projetar, então o mês seguinte mostra R$ 5.000 como **firme** e o saldo acumulado sobe em R$ 5.000.
- [ ] **CA-3** — Dado histórico de saída média de R$ 8.000/mês e um mês futuro com R$ 3.000 já lançados, quando projetar, então esse mês mostra R$ 3.000 firme + R$ 5.000 estimado (não R$ 11.000).
- [ ] **CA-4** — Dado um mês futuro com R$ 12.000 lançados e média histórica de R$ 8.000, quando projetar, então o estimado é R$ 0 — o firme não é reduzido para caber na média.
- [ ] **CA-5** — Dado um a pagar vencido há 40 dias e ainda em aberto, quando projetar, então ele aparece no primeiro mês projetado, não no mês do vencimento original.
- [ ] **CA-6** — Dado um lançamento `PAID` com vencimento futuro, quando projetar, então ele não afeta nenhum mês.
- [ ] **CA-7** — Dado um `PARTIAL` de R$ 1.000 com R$ 400 pagos, quando projetar, então entram R$ 600.
- [ ] **CA-8** — Dado que a projeção cruza o zero em algum mês, quando renderizar, então esse mês é destacado como saldo negativo.
- [ ] **CA-9** — Dado horizonte trocado de 6 para 12, quando recalcular, então a tabela passa a ter 12 linhas sem recarregar a página.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Organização sem conta bancária cadastrada | Saldo inicial R$ 0, com aviso na tela de que nenhuma conta ativa foi encontrada. A projeção ainda roda sobre o resultado do período. |
| CB-2 | Menos de 2 meses fechados de histórico | Sem estimativa (RF-14): só firme, e o rótulo de confiança diz "sem base histórica". Média de um mês só é ruído, não tendência. |
| CB-3 | Histórico só de entradas, nenhuma saída | Média de saída = 0. Projeta entradas estimadas e saídas só firmes. Não inventa saída. |
| CB-4 | Lançamento parcelado ao longo do horizonte | Cada parcela conta no seu próprio mês de vencimento — o comportamento natural, já que são linhas distintas. |
| CB-5 | Lançamento `PENDING_APPROVAL` | Conta como firme. Ainda não foi aprovado, mas é compromisso conhecido; ignorá-lo subestimaria a saída. |
| CB-6 | Lançamento `CANCELLED` | Fora da projeção, em qualquer mês. |
| CB-7 | Mês corrente | Conta só o que ainda não foi pago dele (o já pago está no saldo das contas), e a **estimativa é rateada pelo que resta do mês** — ver D-6. |
| CB-8 | Vencidos somam valor alto | Vão todos para o mês 1 (RF-7), que pode ficar visualmente distorcido. A tela mostra o montante vencido separado, para o usuário saber a razão do pico. |
| CB-9 | Horizonte atravessa a virada do ano | Rótulos incluem o ano quando o horizonte cruza dezembro. |
| CB-10 | Saldo de conta negativo (cheque especial) | Aceito como está; é informação real, não erro. |

## 6. Decisões de design

### D-1 — Estimativa completa a média, não soma sobre ela

- **Escolha**: `estimado = max(0, médiaHistórica − firmeDoMês)`.
- **Alternativas descartadas**: somar a média ao firme — dobraria o valor de
  meses bem lançados, e puniria justamente quem usa o sistema direito, que é o
  oposto do incentivo desejado.
- **Consequência**: um mês inteiramente lançado tem estimado zero e confiança
  100%. A projeção converge para o firme conforme os lançamentos entram.

### D-2 — Média aritmética de meses realizados, não regressão

- **Escolha**: média simples dos últimos N meses fechados, considerando
  lançamentos efetivamente pagos.
- **Alternativas descartadas**: regressão linear ou média móvel ponderada —
  mais sofisticadas, mas impossíveis de defender numa reunião quando alguém
  pergunta "de onde saiu esse número?".
- **Consequência**: a projeção reage devagar a mudança de patamar. Aceitável:
  o firme carrega a informação nova.

### D-3 — Vencidos no primeiro mês projetado

- **Escolha**: aberto com vencimento passado entra no mês 1.
- **Alternativas descartadas**: (a) ignorar — sumiria dinheiro real do caixa
  futuro; (b) manter no mês de origem — jogaria valor num passado que já não
  aparece no horizonte, sumindo do mesmo jeito.
- **Consequência**: o mês 1 tende a inchar. Mitigado exibindo o montante
  vencido em separado (CB-8).

### D-4 — Saldo inicial vem das contas bancárias

- **Escolha**: soma de `balance` das `PaymentBankAccount` ativas.
- **Alternativas descartadas**: (a) começar do zero, como o Fluxo de Caixa —
  responde "resultado do período", não "quanto vou ter"; (b) campo manual —
  vira número desatualizado que ninguém mantém.
- **Consequência**: a projeção só é confiável se os saldos estiverem em dia.
  A tela mostra o saldo inicial e de quantas contas ele veio, para que um valor
  errado seja evidente em vez de silencioso.

### D-5 — Cálculo puro, separado do acesso a dados

- **Escolha**: `build-projection.ts` recebe dados já carregados e devolve o
  resultado; a procedure só busca e delega.
- **Alternativas descartadas**: calcular dentro do handler — impossível de
  conferir sem banco.
- **Consequência**: quando houver runner de teste (deriva do item 20), o
  cálculo é testável sem nenhuma infraestrutura.

### D-6 — Estimativa do mês corrente é rateada pelo tempo restante

- **Escolha**: no mês corrente, `estimado = max(0, médiaMensal × fraçãoRestante
  − firmeDoMês)`, onde `fraçãoRestante = (diasNoMês − diaDeHoje + 1) ÷
  diasNoMês`. Nos demais meses o fator é 1. Nessa comparação o firme do mês
  corrente **exclui o vencido**, que é dinheiro de meses passados e não o fluxo
  normal que a média representa.
- **Alternativas descartadas**: aplicar a média cheia ao mês corrente — foi a
  primeira implementação, e estava errada: metade de agosto já aconteceu e já
  está no saldo das contas, então somar um mês inteiro de média contava o mesmo
  dinheiro duas vezes. Num dia 28, a projeção inflava o mês quase inteiro.
- **Consequência**: a projeção do mês corrente encolhe conforme o mês avança,
  como deve. Assume fluxo distribuído uniformemente ao longo do mês — o que é
  falso para quem concentra recebimento em data fixa, mas o firme cobre
  justamente esses casos, porque data fixa costuma estar lançada.

## 7. Impacto

- [ ] Schema / migration (`prisma/schema.prisma`)
- [x] Procedures oRPC (contrato de entrada/saída)
- [ ] Realtime (Pusher / event-bus)
- [ ] Automações (Inngest)
- [ ] Env vars novas
- [ ] Breaking change para clientes existentes
- [ ] Documentação obrigatória (CLAUDE.md itens 10 / 14 / 16)

Detalhe:

- **Sem mudança de schema** — a projeção lê `PaymentEntry` e
  `PaymentBankAccount` como já existem.
- **oRPC**: `payment.projection.get`.

## 8. Plano de testes

Sem runner instalado (deriva conhecida, item 20 do CLAUDE.md). O cálculo é
puro (D-5), então a verificação usa um script de conferência versionado em
[`scripts/check-projecao-financeira.ts`](../../scripts/check-projecao-financeira.ts),
além da checagem manual na tela:

```bash
pnpm exec tsx scripts/check-projecao-financeira.ts
```

Ao mexer em `build-projection.ts`, rode o script antes de commitar.

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1 | script | Entradas vazias + saldo 10.000 → todo mês projeta 10.000. |
| CA-2 | script | Um a receber futuro → firme no mês certo. |
| CA-3 | script | Firme 3.000 e média 8.000 → estimado 5.000. |
| CA-4 | script | Firme 12.000 e média 8.000 → estimado 0. |
| CA-5 | script | Vencido há 40 dias → mês 1. |
| CA-6 | script | `PAID` futuro → nenhum efeito. |
| CA-7 | script | `PARTIAL` 1.000/400 → 600. |
| CA-8 | manual | Forçar saldo negativo e conferir o destaque. |
| CA-9 | manual | Trocar horizonte 6 → 12 e conferir 12 linhas. |

## 9. Riscos e rollback

**Migration reversível?** Não se aplica — não há mudança de schema. O rollback
é remover a aba e a procedure.

**Riscos:**

1. **Saldo bancário desatualizado** (D-4) — a projeção inteira desloca junto.
   Mitigação: a tela mostra o saldo inicial e a contagem de contas na origem
   do número, em vez de escondê-lo dentro do gráfico.
2. **Leitura da estimativa como promessa** — o número estimado pode ser tratado
   como compromisso. Mitigação: separação visual explícita entre firme e
   estimado, e o indicador de confiança por mês (RF-12).
3. **Histórico curto produzindo média enviesada** — organização nova com um mês
   atípico. Mitigação: CB-2 exige ao menos 2 meses fechados.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-08-31 | Weydson | Criada |
| 2026-08-31 | Weydson | D-6 + RF-13: rateio da estimativa no mês corrente. A versão inicial aplicava a média cheia e contava em dobro o que já se moveu no mês. |
