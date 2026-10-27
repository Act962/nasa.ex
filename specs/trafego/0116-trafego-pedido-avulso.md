---
id: 0116
titulo: Pedido avulso do trafeGO criado pela equipe
dominio: trafego
status: em-revisao
autor: João Gabriel
criada: 2026-10-27
atualizada: 2026-10-27
branch: claude/trafego-features-review-e7832d
pr:
peso: leve
---

# 0116 — Pedido avulso do trafeGO criado pela equipe

## 1. Contexto

Todo o painel do cliente (`/trafego/painel`) gira em torno de um `TrafegoOrder`: briefing,
criativos, copies, Release, ativação, suporte e desempenho. Hoje o pedido só nasce de
`markTrafegoPurchasePaid`, ou seja, de um pagamento feito pelo checkout da landing (cartão no
Stripe ou PIX).

Cliente que fechou com a agência por fora (pagou por transferência, contrato, PIX direto) e já deu
os acessos fica com o painel vazio — "Nenhuma campanha ainda" — e o único caminho é mandá-lo
refazer o wizard e pagar de novo pela landing. Isso não faz sentido para quem já pagou.

## 2. Objetivo

A equipe (admin do sistema) cria, pelo `/admin/trafego`, um pedido para a empresa do cliente, e a
partir daí o cliente usa o painel exatamente como quem comprou pela landing.

### Não-objetivos

- **O cliente criar pedido sozinho pelo painel.** Qualquer empresa com acesso ganharia campanha sem
  pagar; a trava continua sendo "só existe pedido com pagamento confirmado ou criado pela equipe".
- **Novo meio de pagamento no schema.** Sem migration: a equipe escolhe PIX ou Cartão, conforme
  o que o cliente usou por fora. A origem avulsa fica no histórico (evento com `source = ADMIN`) e
  na nota interna.
- Editar valores do pedido depois de criado (não existe hoje para nenhum pedido).
- Cobrança: o pedido avulso não gera cobrança, só registra o que já foi pago.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Procedure `trafego.admin.orders.createManual`, só admin do sistema (`requireAdminMiddleware`). |
| RF-2 | Entrada: organização, canal, tipo de campanha, objetivo, verba, taxa de serviço (R$), setup (R$), meio de pagamento (PIX/Cartão), duração, limites de criativos e copies, nome do negócio, WhatsApp, se lança no financeiro, observação interna. |
| RF-3 | O dono do pedido é o membro `owner` da organização (na falta, `admin`; na falta, o membro mais antigo). Organização sem membros é recusada. |
| RF-4 | O pedido nasce em `ACCOUNT_REVIEW`, com os mesmos dois eventos do pedido comprado (`PAID` e `ACCOUNT_REVIEW`), porém com `source = ADMIN` e o primeiro evento dizendo "Pagamento registrado pela equipe". |
| RF-5 | Depois do commit roda o mesmo `runTrafegoOrderPostCreation` dos outros caminhos: card no tracking de operação, briefing, aviso ao cliente e `trafego/order.created`. |
| RF-6 | O financeiro (receita + repasse) é opcional: desligado, o passo é pulado — evita duplicar quando a equipe já lançou a venda à mão. |
| RF-7 | A tela sugere taxa e setup pela tabela de faixas (`quoteTrafego`), mas a equipe pode editar: o valor foi negociado por fora. |
| RF-8 | `internalNotes` registra "Pedido avulso criado por <admin>" e a observação digitada. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Sem tabela, coluna ou enum novo. |
| RNF-2 | A transação cria só o pedido e os eventos; card, financeiro e avisos rodam depois do commit (regra 18). |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado um usuário que não é admin do sistema, quando chama `createManual`, então
  recebe `FORBIDDEN`.
- [ ] **CA-2** — Dado um admin, quando cria o pedido para a org X, então o pedido aparece em
  `/trafego/painel` para os membros de X, em "Análise da conta", com briefing, criativos e copies
  editáveis.
- [ ] **CA-3** — Dado "lançar no financeiro" desligado, então nenhum `PaymentEntry` é criado com o
  código do pedido; ligado, são criados receita (taxa + setup) e repasse (verba).
- [ ] **CA-4** — Dado uma org sem membros, então a criação é recusada com mensagem clara e nada é
  gravado.
- [ ] **CA-5** — A timeline do pedido mostra "Pagamento registrado pela equipe" e o card do cliente
  aparece na coluna de análise do tracking de operação.

## 5. Riscos

- **Valor digitado errado vai para o financeiro.** Mitigação: total visível antes de confirmar e
  financeiro opcional.
- **Pedido duplicado por duplo clique.** Mitigação: botão travado durante o envio. Não há chave de
  idempotência (o pedido avulso não tem compra de origem); duplicata se resolve cancelando.

## 9. Changelog

| Data | Mudança |
| --- | --- |
| 2026-10-27 | Spec criada. Decisão do dono: sem migration — PIX ou Cartão escolhido pela equipe. |
