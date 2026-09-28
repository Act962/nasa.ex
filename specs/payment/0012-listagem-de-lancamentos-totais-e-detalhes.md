---
id: 0012
titulo: Totais por filtro, detalhes do lançamento e paridade do formulário de edição
dominio: payment
status: implementada
autor: Weydson
criada: 2026-09-14
atualizada: 2026-09-14
branch: feature/W-trafego-self-service-20260908
pr:
peso: leve
---

# 0012 — Totais por filtro, detalhes do lançamento e paridade do formulário de edição

---

## 1. Contexto

Três incômodos relatados nas abas Receita e Despesa:

1. **O cabeçalho mostrava só "Total pendente".** Com o filtro "Todos" não havia
   como ver quanto já entrou (ou saiu) sem abrir o Painel. Pior: ao escolher o
   filtro **"Pago"**, o número exibido era **R$ 0,00** — `pendingAmount` é a soma
   dos status `PENDING`/`PARTIAL`/`OVERDUE` respeitando o filtro do usuário, e a
   interseção com `PAID` é vazia. A tela dizia "Total pendente: R$ 0,00" sobre uma
   lista cheia de lançamentos pagos.
2. **Não havia como ver um lançamento inteiro.** Categoria, contato, conta
   bancária, nº do documento, competência e comprovantes só apareciam entrando no
   modo de edição.
3. **Editar tinha menos campos que criar.** O formulário de criação
   (`entry-form.tsx`) já tem "Conta Bancária" e um bloco "Mais opções"; o de
   edição (`entry-edit-dialog.tsx`) não tinha nenhum dos dois — um lançamento
   criado com conta bancária não podia ter essa conta trocada.

## 2. Objetivo

A listagem informa quanto está pendente e quanto já foi liquidado conforme o
filtro escolhido, qualquer lançamento pode ser aberto para leitura com seus
comprovantes, e editar oferece os mesmos campos que criar.

### Não-objetivos

- Reescrever o cálculo dos totais no servidor: `totals.paidAmount` já existia no
  contrato e só não era consumido pela tela.
- Editar parcelas depois de criadas — o parcelamento define vários registros e
  alterá-lo em um só deixaria o grupo inconsistente.
- Mexer no formulário de criação, que já estava completo.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Com o filtro "Todos", o cabeçalho mostra "Total pendente" e "Total recebido" (Receita) / "Total pago" (Despesa) |
| RF-2 | Com o filtro "Pago", mostra apenas o total liquidado — nunca R$ 0,00 sobre uma lista preenchida |
| RF-3 | Com filtro de um status pendente, mostra apenas "Total pendente" |
| RF-4 | Com os demais filtros (Cancelado, Aguardando aprovação), mostra "Total do filtro" |
| RF-5 | Cada linha tem um ícone de olho que abre os detalhes do lançamento |
| RF-6 | Clicar em qualquer ponto da linha (ou do card, no mobile) abre os mesmos detalhes |
| RF-7 | O menu de ações não dispara os detalhes ao ser aberto |
| RF-8 | Os detalhes exibem valor, liquidado, restante, vencimento, data de liquidação, categoria, contato, conta bancária, nº do documento, competência, parcela, observações e os comprovantes anexados |
| RF-9 | O formulário de edição oferece "Conta bancária" e um bloco "Mais opções" com contato e nº do documento |
| RF-10 | "Mais opções" abre já expandido quando há contato ou nº de documento preenchido |

## 4. Critérios de aceite

- [x] **CA-1** — Dado o filtro "Todos" em Receita, então o cabeçalho mostra
      "Total pendente" e "Total recebido" lado a lado.
- [x] **CA-2** — Dado o filtro "Pago" em Receita, então aparece "Total recebido"
      com o valor liquidado, e não "Total pendente: R$ 0,00".
- [x] **CA-3** — Dada a aba Despesa, então o rótulo é "Total pago".
- [x] **CA-4** — Dado um clique na linha, então abrem os detalhes daquele
      lançamento.
- [x] **CA-5** — Dado um clique no ícone de olho, então abrem os mesmos detalhes.
- [x] **CA-6** — Dados os detalhes abertos, então conta bancária, nº do documento
      e a área de comprovantes aparecem.
- [x] **CA-7** — Dado o formulário de edição, então "Conta bancária" e "Mais
      opções" estão presentes e o que for salvo persiste.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Clique no menu de ações dentro da linha | `stopPropagation` impede que os detalhes abram por trás do menu |
| CB-2 | Lançamento sem categoria/contato/conta | Os campos aparecem com "—", em vez de sumirem e desalinharem o grid |
| CB-3 | Lançamento pago parcialmente | Os detalhes mostram "Recebido"/"Pago" e "Restante" |
| CB-4 | Lançamento sem parcelas ou sem competência | Esses dois campos são omitidos, por não se aplicarem |
| CB-5 | Navegação por teclado no card mobile | `Enter` e `Espaço` abrem os detalhes (o card tem `role="button"`) |

## 6. Decisões de design

### D-1 — O cabeçalho segue o filtro, em vez de mostrar sempre os dois totais

- **Escolha**: a lista de totais é derivada de `statusFilter`.
- **Alternativas descartadas**: exibir sempre "pendente" e "liquidado" — com o
  filtro "Pago" um dos dois seria sempre R$ 0,00, que é justamente a confusão
  que originou o pedido.
- **Consequência**: o cabeçalho muda de composição conforme o filtro. É o
  comportamento desejado, mas exige que o rótulo seja sempre lido junto do valor.

### D-2 — Correção do `paidAt` gravado à meia-noite UTC

- **Contexto**: os detalhes passaram a exibir a data de liquidação, e ela
  aparecia um dia antes. `payPaymentEntry` e `updatePaymentEntry` gravavam
  `new Date("2026-09-08")`, que é meia-noite **UTC**; exibida em UTC-3, vira 07/09.
- **Escolha**: usar `parseCalendarDate`, o helper que `lib/dates.ts` criou
  exatamente para isso (grava meio-dia UTC, imune a deslocamento de fuso).
- **Consequência**: pagamentos novos exibem a data correta. **Registros gravados
  antes desta correção seguem deslocados em um dia** — não houve backfill.

## 7. Impacto

- [x] Procedures oRPC — só a gravação de `paidAt`; contratos inalterados
- [ ] Schema / migration
- [ ] Realtime
- [ ] Automações
- [ ] Env vars novas
- [ ] Breaking change para clientes existentes

## 8. Plano de testes

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1 a CA-3 | manual | Alternar o filtro de status em Receita e Despesa |
| CA-4 a CA-6 | manual | Clicar na linha e no olho; conferir os campos |
| CA-7 | manual | Editar um lançamento, preencher conta e documento, salvar e reabrir |

> Verificado em 14/09/2026 no ambiente de dev (org GOTHAN CITY). O card mobile
> (RF-6/CB-5) foi implementado mas **não** exercitado em viewport móvel — a
> janela do navegador não reduziu abaixo do ponto de quebra `md`.

## 9. Riscos e rollback

Sem migration. O risco é a mudança de `paidAt` (D-2) conviver com registros
antigos gravados à meia-noite UTC: por um período, lançamentos pagos antes e
depois da correção exibem datas com critérios diferentes. Um backfill
(`UPDATE ... SET paid_at = paid_at + interval '12 hours'` nos registros à
meia-noite UTC) resolveria, e fica fora desta spec por tocar dados existentes.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-14 | Weydson | Criada e implementada na mesma sessão. D-2 surgiu durante o teste: expor a data de liquidação nos detalhes tornou visível um bug de fuso anterior a esta mudança |
