---
id: 0074
titulo: Lead marcado como ganho vira conta a receber
dominio: payment
status: em-revisao
autor: Weydson
criada: 2026-10-07
atualizada: 2026-10-07
branch: feature/W-payment-lead-valor-a-receber-20261007
pr:
peso: completa
---

# 0074 — Lead marcado como ganho vira conta a receber

## 1. Contexto

O valor preenchido no lead (`Lead.amount`) é só o valor do negócio no funil. O
financeiro mostra apenas `PaymentEntry` e nenhuma parte dele lê o lead. Na
PLENOCAR (2026-10-07) um lead recebeu R$ 12.000,00 e a pergunta foi "é alguma
configuração?" — não era: o lançamento precisou ser criado à mão.

Quem fecha uma venda no funil espera vê-la em "A receber" sem redigitar.

## 2. Objetivo

Quando um lead com valor passa a GANHO, por clique ou por automação, nasce um
lançamento "A receber" desse valor, vinculado ao lead e ao tracking.

### Não-objetivos

- Criar lançamento ao **preencher** o valor (lead ainda aberto não é receita).
- Atualizar ou cancelar o lançamento quando o valor do lead muda depois, ou
  quando o lead deixa de ser ganho.
- Parcelar, escolher categoria, conta ou vencimento — o lançamento nasce simples
  e é editado no financeiro.
- Opção por empresa para desligar o comportamento (ver D-3).
- Lançar retroativamente os leads que já estavam ganhos.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Ao marcar o lead como ganho pelo botão (procedure `leads.updateAction`), cria-se um `PaymentEntry` `RECEIVABLE` com `amount = Lead.amount`, `leadId` e `trackingId` do lead. |
| RF-2 | O mesmo acontece quando o ganho vem do bloco "Ganho/Perda" de uma automação — é o caminho de "tag adicionada" e "entrou na etapa". |
| RF-3 | Descrição `Venda — <nome do lead>`; vencimento = dia do ganho no calendário de São Paulo; observação informando a origem automática. |
| RF-4 | O autor do lançamento é quem clicou. Na automação, o responsável do lead; sem responsável, o OWNER mais antigo do tracking. |
| RF-5 | O lançamento passa pelo serviço padrão (`createPaymentEntryRecord`): respeita aprovação por valor, diário contábil e log de atividade. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | A criação roda depois do commit que grava o ganho e nunca lança erro: falha no financeiro não desfaz nem derruba o fechamento do lead (CLAUDE.md, regra 18). |
| RNF-2 | Sem mudança de schema. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado um lead com valor R$ 12.000,00 e sem lançamento vinculado, quando é marcado como ganho pelo botão, então existe um "A receber" de R$ 12.000,00 com `leadId` e `trackingId` dele.
- [ ] **CA-2** — Dado o mesmo lead, quando uma automação com bloco "Ganho/Perda" (motivo de ganho) roda para ele, então o lançamento é criado da mesma forma.
- [ ] **CA-3** — Dado um lead com valor zero, quando vira ganho, então nenhum lançamento é criado.
- [ ] **CA-4** — Dado um lead que já tem um "A receber" não cancelado vinculado, quando vira ganho, então nenhum lançamento novo é criado.
- [ ] **CA-5** — Dado um lead marcado como **perdido**, então nenhum lançamento é criado.
- [ ] **CA-6** — Dado que a criação do lançamento falha, quando o lead é marcado como ganho, então o lead fica ganho e a resposta é de sucesso.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Lead ganho, reaberto e ganho de novo | O "A receber" da primeira vez segue vinculado → não duplica (CA-4). |
| CB-2 | Lead com orçamento já lançado pelo chat (`leadId` preenchido) | Não cria outro, mesmo com valor diferente: o orçamento é a fonte mais específica. |
| CB-3 | Único lançamento vinculado está **cancelado** | Cria um novo. |
| CB-4 | Lançamento vinculado já **pago** | Não cria outro. |
| CB-5 | Venda do Catálogo online (`confirm-payment`) | Fora deste fluxo: aquele caminho já cria o próprio lançamento e não chama este serviço. |
| CB-6 | Automação sem responsável no lead e tracking sem OWNER | Não cria; registra `no_actor` no retorno. O lead fica ganho. |
| CB-7 | Passo da automação reexecutado pelo Inngest | A checagem de lançamento vinculado evita o segundo. |
| CB-8 | Dois ganhos simultâneos no mesmo lead (clique + automação no mesmo instante) | Pode gerar dois lançamentos — não há trava única no banco (RNF-2). Aceito: raro e corrigível cancelando um. |
| CB-9 | `Lead.amount` fracionado (Decimal) | Arredonda para centavos inteiros. |
| CB-10 | Valor acima do limite de aprovação da empresa | Nasce `PENDING_APPROVAL`, como qualquer lançamento (RF-5). |
| CB-11 | Ganho às 22h de Brasília (já é o dia seguinte em UTC) | Vencimento = dia de Brasília. |
| CB-12 | Lead ganho com valor zero que recebe valor depois | Não gera lançamento (não-objetivo). |

## 6. Decisões de design

### D-1 — Gatilho é o GANHO, não o preenchimento do valor

- **Escolha**: criar no momento em que `currentAction` vira `WON`.
- **Alternativas descartadas**: criar ao preencher o valor — encheria o "A receber" de negócios ainda em negociação.
- **Consequência**: valor preenchido em lead aberto continua sem reflexo no financeiro.

### D-2 — Idempotência por "já existe A receber vinculado ao lead"

- **Escolha**: antes de criar, procurar `PaymentEntry` `RECEIVABLE` não cancelado com o mesmo `leadId`.
- **Alternativas descartadas**: coluna `source`/chave única em `PaymentEntry` — exige migration e não cobriria os orçamentos do chat, que são a duplicidade mais provável.
- **Consequência**: sem trava no banco, a corrida do CB-8 é possível.

### D-3 — Sempre ligado, sem opção por empresa

- **Escolha**: vale para todas as empresas.
- **Alternativas descartadas**: toggle em `PaymentGovernanceConfig` — exige migration e tela; fica para quando alguma empresa pedir para desligar.
- **Consequência**: empresa que lança a receita à mão **sem** vincular ao lead passa a ter dois lançamentos por venda. Ver seção 9.

### D-4 — Dois pontos de chamada, um serviço

- **Escolha**: `createReceivableFromWonLead` chamado em `leads/update-action.ts` e no executor `win_loss`.
- **Alternativas descartadas**: ouvir o evento de jornada `won` — o executor da automação não o emite hoje.
- **Consequência**: um caminho novo que grave `WON` precisa chamar o serviço.

## 7. Impacto

- [ ] Schema / migration (`prisma/schema.prisma`)
- [ ] Procedures oRPC (contrato de entrada/saída)
- [ ] Realtime (Pusher / event-bus)
- [x] Automações (Inngest) — o bloco "Ganho/Perda" passa a criar o lançamento
- [ ] Env vars novas
- [x] Breaking change para clientes existentes — comportamento novo em produção (D-3)
- [ ] Documentação obrigatória (CLAUDE.md itens 10 / 14 / 16)

Arquivos: `src/features/payment/lib/won-lead-receivable.ts`,
`src/features/payment/server/entries/create-receivable-from-won-lead.ts`,
`src/app/router/leads/update-action.ts`,
`src/features/tracking-executions/components/win_loss/executor.ts`.

## 8. Plano de testes

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-3, CA-4, CB-3, CB-4, CB-6, CB-9, CB-11 | script | `pnpm tsx scripts/payment-won-lead-receivable-qa-check.ts` (regras puras) |
| CA-1, CA-5, CA-6 | manual | Marcar lead com valor como ganho/perdido e conferir "A receber" |
| CA-2 | manual | Automação "tag adicionada → Ganho/Perda" em lead com valor |

## 9. Riscos e rollback

- **Duplicidade para quem já lança à mão sem vincular ao lead** (D-3). Sinal: dois "A receber" do mesmo valor no dia do ganho. Correção: cancelar um; se virar padrão, implementar o toggle.
- **Rollback**: remover as duas chamadas ao serviço. Sem migration; os lançamentos já criados permanecem e podem ser cancelados no financeiro.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-07 | Weydson | Criada |
