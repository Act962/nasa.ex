---
id: 0106
titulo: Trazer a carteira do Winthor para o Órbita, resgatar vendas e atribuir cada venda ao canal e ao vendedor
dominio: leads
status: aprovada
autor: Claude (pedido do Weydson)
criada: 2026-10-15
atualizada: 2026-10-15
branch: feature/W-catalogo-venda-guiada-ajustes-teste-20261015
pr:
peso: completa
---

# 0106 — Carteira do ERP no Órbita, campanhas de resgate e atribuição de vendas

## 1. Contexto

O NERP e o Órbita estão virando um serviço de vendas online:

- **O NERP** tem o catálogo, os preços e os produtos.
- **O Órbita** faz o atendimento e acompanha a venda pelo CRM.

A equipe passa a ganhar comissão sobre cada cliente que vem dos nossos canais: Instagram, Catálogo online, site, Linnker e tráfego.

Hoje o Órbita não tem três coisas que esse serviço precisa:

1. **Não conhece a carteira da loja.** Os clientes, a dívida e o histórico de compras ficam no Winthor (`PCCLIENT`, `PCPREST`, `PCMOV`), e nada traz isso para o Órbita. O NERP só lê o Oracle sob demanda (Astro, indicadores).
2. **Não sabe quem não respondeu a uma campanha.** `BroadcastRecipient` guarda enviado, entregue e lido, mas não a resposta. Um disparo também não marca o contato com tag.
3. **Não atribui a venda a ninguém.** O canal de origem está no lead (spec 0105), mas a venda paga não é marcada com o canal, o vendedor da nossa equipe e o consultor da loja. Comissão hoje só existe para parceiros (`PartnerCommission`).

**Meta do negócio:** reduzir a inadimplência e recuperar vendas perdidas, provando o que veio dos nossos canais.

## 2. Objetivo

Cada cliente do Winthor que já comprou vira um lead no Órbita, com:

- tags (filial, situação, interesses);
- a dívida e a última compra;
- o histórico de compras na Jornada.

A equipe faz campanhas de resgate em que cada contato ganha tag, e quem não respondeu entra na próxima campanha com um clique. Toda venda paga sai marcada com o canal, o nosso vendedor e o consultor da loja (comissão compartilhada).

### Não-objetivos

- Calcular e pagar a comissão (percentual, extrato, repasse). Agora é **só a atribuição** e o relatório.
- Cobrança ou negociação de dívida automática pelo Astro (acordo, parcelamento, boleto de renegociação).
- Escrever qualquer coisa no Winthor. A leitura é sempre só leitura.
- Clientes que nunca compraram.

## 3. Requisitos

### Funcionais

**A. Carteira do Winthor (NERP → Órbita)**

| ID | Requisito |
| --- | --- |
| RF-1 | **NERP:** procedure s2s `erpCarteira.listar`, só leitura e paginada por `CODCLI`. Ela devolve, por cliente com ao menos uma venda: código, nome, CPF/CNPJ, telefone/celular, e-mail, filial (código e nome), consultor do Winthor (`CODUSUR` e nome), data de cadastro, primeira e última compra, valor da última compra, total comprado, dívida vencida (valor, parcelas, vencimento mais antigo) e as últimas 5 categorias e produtos. Escopo s2s: `customer:rw` (já concedido às integrações; escopo novo obrigaria reconectar). |
| RF-2 | **NERP:** procedure s2s `erpCarteira.historico(codcli)`, uma linha por venda desde o cadastro: data, filial, valor, itens, situação (paga, em aberto, vencida). Ela alimenta a Jornada. |
| RF-3 | **Órbita:** em Integrações → NERP, o botão "Importar carteira do Winthor". A pessoa escolhe o tracking e a etapa inicial, e um job Inngest roda em lotes. O lead é criado ou atualizado pelo telefone (`waIdLookupVariants`); sem telefone, pelo CPF/CNPJ; sem os dois, o cliente é pulado e entra na contagem do relatório. |
| RF-4 | Os dados do ERP ficam no modelo novo `LeadErpProfile` (1:1 com o lead), não em `Lead.amount`/`description`: código, filial, consultor do ERP, primeira e última compra, valor da última compra, total comprado, dívida (valor, parcelas, vencimento mais antigo), últimos produtos e `syncedAt`. |
| RF-5 | **Tags automáticas**, num grupo de tags "Carteira ERP": `Winthor`, `Filial <nome>`, `Inadimplente` ou `Em dia`, `Inativo 90d`/`Inativo 180d` (sem compra no período) e `Interesse: <categoria>` (as categorias mais compradas). Na atualização, quem deixou de estar em uma situação perde a tag; tag posta à mão nunca é removida. |
| RF-6 | **Jornada:** cada venda do histórico vira um evento `erp_purchase` com `occurredAt` = data da venda (`trackLeadEvent`). O cadastro no Winthor vira `erp_customer_since`. Mostra os itens, o valor e a filial. Não duplica na reimportação (chave = número da venda). |
| RF-7 | **Atualização diária:** pega carona na sincronização diária do ERP que já existe no NERP (`erp-sync-schedule`). Quando ela termina, o NERP avisa o Órbita, que reimporta só o que mudou. Nenhum cron novo. |
| RF-8 | **Ficha do lead:** bloco "Carteira ERP" com última compra, total comprado, filial, consultor e dívida. O valor da dívida só aparece para quem tem permissão do financeiro ou é admin; os demais veem só a tag. |

**B. Campanhas de resgate**

| ID | Requisito |
| --- | --- |
| RF-9 | O público da campanha filtra pelos campos da carteira: inadimplente, faixa de dívida, dias sem comprar, filial, interesse e consultor do ERP, além dos filtros que já existem. |
| RF-10 | **Cada contato ganha tag:** ao enviar, o destinatário recebe `Campanha: <nome>`. Ao responder, recebe `Respondeu: <nome>`. |
| RF-11 | **Resposta por destinatário:** `BroadcastRecipient.repliedAt`. A primeira mensagem do contato na mesma conversa, em até 7 dias após o envio, marca a resposta. |
| RF-12 | **"Criar campanha para quem não respondeu":** o botão na campanha enviada cria um rascunho com os destinatários sem `repliedAt` e sem falha. Ele só aparece 48h depois do envio. |
| RF-13 | Nos números da campanha: respondidos, não respondidos e vendas pagas em até 30 dias pelos leads da campanha (com valor). |

**C. Atribuição e consultor da loja**

| ID | Requisito |
| --- | --- |
| RF-14 | **Interesses vindos dos nossos canais:** pedido do Catálogo online, conversa e formulário aplicam `Interesse: <categoria>` dos produtos pedidos ou citados, além do canal de origem (spec 0105), visível na Jornada. |
| RF-15 | **Consultor da loja:** o consultor do Winthor (`CODUSUR`) é ligado a um usuário do Órbita, num de-para na tela da integração. Lead dos nossos canais que já tem consultor da loja é direcionado **só a esse consultor**, com a lista de produtos do pedido (WhatsApp e sino), e a venda fica **compartilhada**. Nunca vai para o rodízio nem para outro consultor. |
| RF-16 | **Atribuição da venda:** modelo `SaleAttribution`, gravado quando o pedido é pago. Guarda pedido, lead, canal de origem, campanha (se veio de resgate), vendedor da nossa equipe, consultor da loja, tipo (`OURS` ou `SHARED`) e valor. Uma linha por pedido pago. |
| RF-17 | **Relatório "Vendas por canal":** total por canal, vendedor, campanha e tipo (nossa ou compartilhada) no período, com exportação CSV. Sem cálculo de comissão. |
| RF-18 | Inadimplência resgatada: quando um lead com tag `Inadimplente` passa a `Em dia` depois de contato de campanha, isso conta como "dívida recuperada" no relatório da campanha (valor que saiu da dívida). |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | **Leitura leve no Oracle de produção:** páginas de até 500 clientes, `callTimeoutMs` 60 s e uma página por vez. A primeira carga é disparada pelo botão. A atualização diária roda no mesmo horário da sincronização de produtos. |
| RNF-2 | A importação de 20 mil clientes termina em menos de 30 min e pode retomar de onde parou (cursor salvo). |
| RNF-3 | O histórico (RF-2) é buscado sob demanda: na primeira abertura da Jornada e na importação, só dos clientes com venda nos últimos 24 meses. Os demais ficam com o resumo. |

## 4. Critérios de aceite

- [ ] **CA-1** — Cliente do Winthor com venda e celular vira lead no tracking escolhido, com as tags `Winthor`, `Filial <nome>` e `Inadimplente` ou `Em dia`.
- [ ] **CA-2** — Reimportar não duplica o lead nem os eventos `erp_purchase`, inclusive com o celular sem o 9º dígito.
- [ ] **CA-3** — **A importação não dispara nenhum fluxo nem mensagem:** nenhum "lead criado" nem "lead com tag" e nenhum envio de WhatsApp.
- [ ] **CA-4** — Cliente que pagou a dívida perde `Inadimplente` e ganha `Em dia` na atualização diária. Uma tag posta à mão continua.
- [ ] **CA-5** — A Jornada mostra as compras do Winthor nas datas reais, da primeira à última.
- [ ] **CA-6** — Usuário sem permissão do financeiro não vê o valor da dívida na ficha nem na API.
- [ ] **CA-7** — Destinatário de campanha ganha `Campanha: <nome>`. Ao responder, ganha `Respondeu: <nome>` e o `repliedAt` é gravado.
- [ ] **CA-8** — "Criar campanha para quem não respondeu" gera um rascunho só com quem não respondeu e não falhou.
- [ ] **CA-9** — Lead do Catálogo online com consultor da loja ligado é avisado só a esse consultor, com a lista de produtos. O rodízio não roda.
- [ ] **CA-10** — Pedido pago gera um `SaleAttribution` com o canal, o tipo `SHARED` (quando há consultor da loja) ou `OURS`, e o valor.
- [ ] **CA-11** — O relatório "Vendas por canal" soma por canal, vendedor e campanha e bate com os pedidos pagos do período.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Cliente sem telefone e sem CPF/CNPJ | É pulado e conta em "sem contato" no relatório da importação. |
| CB-2 | Dois clientes do Winthor com o mesmo telefone (ex.: empresa e sócio) | Um lead só; os códigos ficam em `LeadErpProfile.customerCodes[]`. O resumo (dívida, última compra) é o do último código lido; as compras de todos entram na Jornada. |
| CB-3 | O lead já existe (veio do catálogo) | É atualizado; ganha o perfil e as tags, sem trocar a etapa, o responsável nem a origem. |
| CB-4 | O lead já tem um responsável no Órbita diferente do consultor do ERP | O responsável não muda. O consultor do ERP fica no perfil e entra na atribuição. |
| CB-5 | Consultor do ERP sem de-para | A venda fica `OURS`. A tela da integração lista os consultores sem usuário ligado. |
| CB-6 | O Oracle cai no meio da importação | O job para, guarda o cursor e retoma no próximo clique ou na atualização diária. |
| CB-7 | O contato pede para sair ("parar", "sair", "não quero") | Ganha a tag `Não contatar` e sai de todo público de campanha (RF-9 exclui sempre). |
| CB-8 | A resposta chega depois de 7 dias | Não conta como resposta da campanha; a conversa segue normal. |
| CB-9 | O lead está em duas campanhas abertas | A resposta conta para a campanha mais recente. |
| CB-10 | Um pedido é pago duas vezes (webhook repetido) | `SaleAttribution` é único por pedido. |
| CB-11 | Lead dos nossos canais **sem** consultor da loja | Segue a venda guiada de hoje e a venda fica `OURS`. |

## 6. Decisões de design

### D-1 — O NERP lê o Winthor; o Órbita só consome

- **Escolha:** a consulta ao Oracle mora no NERP (que já tem o conector, `withOracleReadOnly`, as credenciais e a sincronização diária) e sai por s2s, como `customer.*` hoje.
- **Descartada:** o Órbita ler o Oracle direto (duplicaria as credenciais e o conector).

### D-2 — Perfil do ERP em modelo próprio, não em campos do lead

- **Escolha:** `LeadErpProfile`.
- **Descartada:** usar `Lead.amount` e `description`. `amount` é o valor da negociação no card e a dívida ficaria visível a todos (CA-6). Tag sozinha também não guarda valor nem data.

### D-3 — Produtos como interesse por categoria, não uma tag por produto

- **Escolha:** `Interesse: <categoria>`.
- **Descartada:** uma tag por produto (milhares de tags, filtro inútil). Os produtos ficam no perfil e na Jornada.

### D-4 — Importação sem disparar fluxos

- **Escolha:** grava leads e tags direto (`createMany`), sem passar por `applyTagsByAi` nem `add-tags`.
- **Descartada:** reaproveitar `add-tags`. Ele dispara "Lead com tag", e uma carteira de 20 mil clientes viraria 20 mil mensagens: risco de bloqueio do número e de LGPD.

### D-5 — Comissão compartilhada é só uma marca agora

- **Escolha:** `SaleAttribution.kind = SHARED` com os dois nomes, e o relatório.
- **Descartada:** percentuais e extrato. A regra de divisão ainda não foi definida pelo negócio.

### D-6 — Resposta medida pela conversa, não pela Meta

- **Escolha:** a primeira mensagem recebida na conversa do lead, depois do envio e dentro de 7 dias, marca `repliedAt`. A Meta não informa "respondeu a este template"; o clique em botão de template entra como mensagem recebida e também vale.

## 7. Impacto

- [x] **Schema/migration (aditiva):**
  - `LeadErpProfile`;
  - `SaleAttribution`;
  - `ErpConsultantLink` (código do consultor no ERP → usuário);
  - `BroadcastRecipient.repliedAt`;
  - `Broadcast.parentBroadcastId` (campanha de quem não respondeu).
- [x] **Procedures oRPC:**
  - `nerp.erpCarteira.import`, `status` e `consultants`;
  - `leads.erpProfile.get`;
  - `campanhas.createFromNonResponders`;
  - `insights.salesByChannel`.
- [x] **Automações (Inngest):**
  - `nerp/erp-carteira.import` (lotes com cursor);
  - `nerp/erp-carteira.refresh` (evento vindo do NERP);
  - a marcação de resposta entra no pipeline de entrada já existente, em step leve.
- [ ] Env vars novas — nenhuma.
- [ ] Breaking change — nenhuma.
- [x] **Documentação:**
  - `docs/nerp-catalog-orbita.md`;
  - `docs/whatsapp-oficial-overview.md` (regra 14), por causa da marcação de resposta;
  - spec do NERP `specs/erp-carteira-winthor.md`.

### Segurança de dados

- **Dívida:** o valor (RF-8) só é visto por admin ou financeiro, na ficha, na API e na exportação. Os demais veem só a tag.
- **Importação:** só admin da org importa. O NERP só responde à org dona da conexão Winthor (s2s assinado + escopo `customer:rw`).
- **Astro e cliente:** o Astro nunca fala valor de dívida ao cliente sem o cliente perguntar e estar identificado pelo documento (mesma regra da 0104).
- **Consultor da loja:** recebe só os leads da própria carteira; não vê os de outro consultor.
- **Relatório de vendas por canal:** só para admin.

### Regras da Meta

- **Templates:**
  - campanha de resgate e de "quem não respondeu" = template de **marketing**, aprovado;
  - lembrete de dívida = template de **utilidade**, sem tom de ameaça.
- **Opt-out:** `Não contatar` (CB-7) exclui o contato de todo disparo. O template de marketing leva o botão "Parar de receber".
- **Frequência:** no máximo 1 campanha de "quem não respondeu" por campanha de origem (2 contatos no total), com 48h entre elas. A tela avisa quando o público já recebeu marketing nos últimos 7 dias.
- **Volume:** importar a carteira **não** envia mensagem (CA-3). Os disparos seguem o limite de envio do número que já existe nas Campanhas.

## 8. Plano de testes

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1, CA-2, CA-3 | manual | Importar a carteira da Gotham (3001) duas vezes; contar leads e eventos; conferir que nenhuma execução de fluxo foi criada. |
| CA-4 | manual | Marcar uma parcela como paga no banco de teste do Winthor (ou mock do conector) e rodar o refresh. |
| CA-5 | manual | Abrir a Jornada de um cliente com várias compras. |
| CA-6 | manual | Abrir a ficha com um usuário sem permissão do financeiro e chamar `leads.erpProfile.get`. |
| CA-7, CA-8 | manual | Campanha para 2 números de teste; responder com um deles; criar a campanha de quem não respondeu. |
| CA-9, CA-10, CA-11 | manual | Pedido do catálogo de cliente com consultor ligado, pagamento sandbox, relatório. |

## 9. Riscos e rollback

- **Peso no Oracle da loja:** mitigado por paginação, timeout e uma página por vez (RNF-1). O botão pode ser desligado pela integração.
- **Tags demais:** grupo próprio "Carteira ERP" e interesses limitados às 3 categorias mais compradas.
- **Rollback:** as migrations são aditivas e os modelos novos podem ficar vazios. Desligar o botão e o evento de refresh volta ao comportamento de hoje. As tags importadas podem ser apagadas pelo grupo.

## 10. Entrega em fases (uma PR por repositório)

1. **Fase 1:** carteira (RF-1 a RF-8), a base para o resto.
2. **Fase 2:** resgate (RF-9 a RF-13, RF-18).
3. **Fase 3:** atribuição e consultor da loja (RF-14 a RF-17).

## 11. Conferido no Oracle da Armazém Carvalho (2026-10-15)

- `PCCLIENT` (27.875 clientes): `CODCLI`, `CLIENTE`, `FANTASIA`, `CGCENT`, `TELCELENT`/`TELENT`/`TELCOM`, `EMAIL`, `DTCADASTRO`, `DTULTCOMP`, `DTEXCLUSAO`, `CODFILIALNF`, `CODUSUR1`.
- Filial: `PCFILIAL.CODIGO`/`FANTASIA` (5 filiais). Consultor: `PCUSUARI.CODUSUR`/`NOME`. Interesse: `PCPRODUT.CODEPTO` → `PCDEPTO.DESCRICAO`.
- Histórico: `PCPEDC` (2,4 mi de pedidos; `POSICAO = 'F'` e sem `DTCANCEL`). `PCNFSAID` não é legível pela conexão. Vão para a Jornada os 120 pedidos mais recentes de cada cliente.

## 12. Implementação da fase 1

- **NERP:** `features/erp-carteira/server/carteira-winthor.ts` (página de 200 clientes: cadastro, dívida, pedidos e itens dos últimos 12 meses), procedure `erpCarteira.listar`, aviso `avisar-orbita.ts` no fim do `erp-sync-run` diário (03h).
- **Órbita:** `LeadErpProfile`, `ErpCarteiraImport`, `LeadSource.ERP` (migration `20261015180000_erp_carteira`); `features/erp-carteira` (importação, tags, card na integração NERP, bloco na ficha); Inngest `erp-carteira-import` (um step por página, retoma do cursor); rota `POST /api/integrations/nerp/erp-carteira` (assinada) para a atualização diária; Jornada `erp_purchase`/`erp_customer_since`.
- Tags do grupo "Carteira ERP" são gerenciadas pela importação (entram e saem); tag desse grupo posta à mão também sai se o ERP disser o contrário.

## 13. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-15 | Claude | Criada a partir do pedido do Weydson (resgate, inadimplência, comissão compartilhada, só atribuição). |
| 2026-10-15 | Claude | Aprovada a fase 1 pelo Weydson; escopo `customer:rw`, colunas conferidas no Oracle, CB-2 simplificado, notas de implementação. |
| 2026-10-15 | Claude | Testes: `scripts/erp-carteira-email-qa-check.ts` (regras puras) e `scripts/erp-carteira-email-qa-db.ts` (importa, reimporta e muda a carteira num funil temporário do banco de desenvolvimento; CA-1 a CA-5 passando). |
