---
id: 0104
titulo: Venda guiada pelo catálogo com aprovação dos setores
dominio: nerp-catalog
status: aprovada
autor: Claude (pedido da Órbita para a Armazém Carvalho)
criada: 2026-10-14
atualizada: 2026-10-14
branch: claude/stoic-bell-t9hvh9
pr:
peso: completa
---

# 0104 — Venda guiada pelo catálogo com aprovação dos setores

## 1. Contexto

A spec 0103 resolveu o valor negociado: o consultor envia o preço (com base na tabela do NERP), o cliente aprova com SIM e
o Astro cobra. Falta o resto da venda como a Armazém Carvalho opera:

- O cliente não pode ser bombardeado de perguntas na chegada do pedido.
- Quem já tem consultor vai direto para ele.
- O Astro precisa saber se o cliente está apto a comprar (sem dívida vencida).
- Antes de o valor chegar ao cliente, **comercial, financeiro, logística e contábil** aprovam. A logística informa o prazo
  de entrega.
- Depois do pagamento, **financeiro** confirma o recebimento e **logística** confirma a saída. Só então o cliente recebe o
  acompanhamento com prazos.
- A conversa precisa soar humana ("Oi", "Com certeza", "Valeu", "Sei como é").
- Documentos que o cliente manda no número oficial precisam ser lidos.
- O cliente precisa saber quantos pontos ganha na compra (programa de fidelidade, `star-friends`).

Hoje: nada marca conta a receber como vencida (`OVERDUE` nunca é gravado); o Astro não acha cliente por CPF/CNPJ; não
existe aprovação interna por WhatsApp para pedido (os avisos fiscais da aba Contábil já saem pelo número da própria empresa
com template aprovado, `accounting/server/alerts/send-compliance-whatsapp.ts`);
`CatalogOrder` não tem prazo de entrega; documentos recebidos só viram `[document]` no contexto.

## 2. Objetivo

Levar o pedido do Catálogo online do "chegou" ao "saiu para entrega" com poucas perguntas ao cliente, duas rodadas de
aprovação interna (WhatsApp e tela) e o prazo de entrega combinado antes do pagamento.

### Não-objetivos

- Crédito/limite por cliente, score ou análise de risco. "Apto" = sem conta vencida no financeiro do Órbita.
- Inadimplência vinda do NERP.
- Pagamento a prazo (boleto parcelado por condição comercial).
- O Astro decidir preço, desconto ou prazo. Quem decide é sempre uma pessoa.
- Confirmar pagamento por comprovante. Só o Asaas confirma; o comprovante vira aviso ao financeiro.
- Comissão e repasse.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-0 | **O pedido chega pelo WhatsApp (D-6).** No catálogo sem preço, o orçamento termina com o botão principal "Enviar pedido pelo WhatsApp", que abre a conversa com a loja já com o texto pronto ("Olá! Quero finalizar meu pedido #N (código XXXXXX)"). O Órbita grava o pedido com a tag "Aguardando cliente no WhatsApp" e **não manda nada** ao cliente. Quando a mensagem dele chega (pelo código, ou pelo número com ou sem 9º dígito), o pedido é ligado à conversa, a tag sai e o fluxo "chegada do pedido" começa — com a janela de 24h aberta, só texto, sem template. O Astro não responde a essa primeira mensagem. |
| RF-0b | **Um lembrete só, pelos Gatilhos (sem cron).** O fluxo pronto "lembrete do pedido" dispara na tag "Aguardando cliente no WhatsApp", espera 30 min só por aquele pedido (a mensagem do cliente encerra a espera antes) e, se ele ainda não enviou, manda **um** `pedido_aguardando_envio` com o botão "Enviar pedido" — fora das 8h–20h espera até as 8h. O toque conta como a mensagem do cliente (RF-0). Depois disso nada mais é enviado: o pedido fica no painel com a tag para o consultor agir. |
| RF-1 | **Perguntas só quando precisa.** Na chegada do pedido o fluxo "chegada do pedido" manda **uma** mensagem: recebimento, pontos e a pergunta do consultor. CPF/CNPJ é pedido pelo fluxo "aprovação do valor" só depois que a equipe aprova, antes do valor ir ao cliente. |
| RF-2 | **Tom popular.** Na venda guiada (org com aprovadores) o prompt do pedido do catálogo ganha as regras de tom: frases curtas, uma pergunta por vez, expressões populares não agressivas, sem jargão. Fora da venda guiada, tom atual. |
| RF-3 | **Consultor.** Ação `ROUTE_TO_CONSULTANT`: pergunta (Astro fica quieto, como no "Pedir aceite"), procura o nome (sem acento, primeiro nome ou nome completo) entre os `TrackingConsultant` ativos do funil. Um só → responsável, tag "Já atendido", IA pausada e aviso ao consultor (saída `found`). Nenhum ou vários → `not_found`. |
| RF-4 | **Crédito sem perguntar.** Ação `CHECK_CREDIT`: contas a receber vencidas do lead; aplica "Apto a comprar" ou "Inadimplente" (saídas `eligible`/`overdue`). Não bloqueia: o fluxo avisa o responsável e o financeiro vê na aprovação. |
| RF-5 | **Contas vencidas.** Cron diário marca `PaymentEntry` RECEIVABLE `PENDING` com `dueDate` anterior a hoje como `OVERDUE`. |
| RF-6 | **Pedido no financeiro.** Gerar cobrança do pedido cria `PaymentEntry` RECEIVABLE `PENDING` com `leadId`; o pagamento confirmado marca a mesma entrada como `PAID` (hoje a entrada só nasce paga). |
| RF-7 | **Cliente por documento.** Ação `FIND_CUSTOMER_BY_DOCUMENT`: pergunta e lê CPF/CNPJ (valida dígitos, aceita texto com pontuação), procura compra paga anterior na org, grava no lead e no pedido e aplica "Cliente recorrente"/"Cliente novo" (saídas `returning`/`new`/`no_document`, uma nova tentativa antes de desistir). |
| RF-8 | **Aprovadores.** Modelo `SalesApprover` (usuário × setor × rodadas × `phoneE164`), com o aceite de receber mensagens da empresa registrado no cadastro (`optInAt`). Tela nas configurações do Catálogo online, que também guarda o nome do template de aprovação (padrão `aprovacao_pedido`). |
| RF-9 | **1ª rodada (antes do cliente).** Com aprovadores cadastrados, o "Enviar valor" grava o valor e reaplica a tag "Valor em aprovação", que dispara o fluxo pronto; a ação `SALES_APPROVAL` abre a rodada e cada setor recebe pelo **número oficial da loja**, em **template de utilidade**, o resumo — pedido, itens, total, crédito — com **Aprovar / Recusar / Ajustar**. A logística que aprova informa o prazo em texto ("amanhã 11h", lido por IA e confirmado ao aprovador). |
| RF-9b | **Resposta do aprovador não vira lead.** Na entrada do número oficial (`persistCanonicalInbound`), antes da busca/criação do lead: se o remetente é `SalesApprover` ativo da org **e** tem aprovação pendente, a mensagem é tratada como decisão (botão com o id da aprovação no payload, ou texto de ajuste dentro da conversa de aprovação) e **não** cria lead, não entra no chat do cliente e o Astro não responde. Sem aprovação pendente, segue o fluxo normal. |
| RF-10 | **Decisão pela tela.** Painel "Aprovações" na aba Pedido: quem aprovou, quem falta, notas, e aprovar/recusar/ajustar pelo Órbita. |
| RF-11 | **Todos aprovaram.** O cliente recebe valor, prazo de entrega e pontos da compra numa mensagem só ("Fica R$ X, entrega quinta às 11h. E essa compra te rende 10 pontos pra trocar por brindes. Fechado?"). Recusa ou ajuste de preço volta ao consultor; ajuste só de prazo segue com o prazo novo. |
| RF-12 | **Cobrança bloqueada** até a 1ª rodada fechar: estado novo `awaiting_internal_approval` em `getChargeBlockReason`. |
| RF-13 | **Forma de pagamento.** O template `valor_pedido` traz "Fechar pedido / Falar com consultor"; ao aprovar, o Astro pergunta PIX ou cartão/boleto e gera a cobrança (ferramentas da 0103). Menu de botões de forma de pagamento fica para depois (exige `NEXT_PUBLIC_WORKFLOW_META_INTERACTIVE`). |
| RF-14 | **Pagou.** O cliente recebe só "recebemos, estamos conferindo" (com os pontos ganhos). Abre a 2ª rodada (`POST_PAYMENT`): financeiro confirma pedido/valor/pagamento; logística confirma estoque e saída. |
| RF-15 | **Tratativa.** Prazo novo na 2ª rodada: o fluxo manda `prazo_entrega_alterado`, espera a resposta e uma Decisão por IA (ação existente) separa aceitou/não aceitou; aceitou → `CATALOG_ORDER_ACTION` "aceitou o novo prazo". |
| RF-16 | **Liberado.** 2ª rodada fechada → o fluxo manda `pedido_liberado` com a previsão e o botão de acompanhamento. O lead segue em "Pagamento confirmado"; mover para "Separado"/"Entregue" continua manual e dispara os avisos de sempre. Na venda guiada, os avisos fixos de "pagamento confirmado/enviado para separação" do código não saem (quem avisa é o fluxo). |
| RF-17 | **Cadastro do cliente novo** depois do pagamento: reaproveita o passo existente "Preencher formulário pela conversa" (spec 0099). Não vem no fluxo pronto: a equipe acrescenta no fluxo de pagamento escolhendo o formulário. |
| RF-18 | **Documentos lidos.** Reaproveita o fluxo existente "Comprovante de Pagamento — IA Lê o Arquivo" (AI_VISION + READ_PDF + Decisão por IA). Nenhuma leitura nova em código. |
| RF-20 | **Preço e estoque de produto pelo coordenador.** Quando o cliente pergunta preço, estoque ou se tem um produto (texto ou foto) sem valor da equipe, o Astro responde "Tranquilo. Já te mando o valor aqui, só conferindo estoque e preço." e a ferramenta `request_product_check` avisa o **aprovador do Comercial** (coordenador) pelo WhatsApp oficial (texto na janela dele; fora dela, template `consulta_produto`) e pelo sino, com o link do chat, e aplica "Quer orçamento". Vale com ou sem pedido aberto, sempre que há coordenador com aceite. Nunca inventa preço nem estoque. |
| RF-21 | **Sem cobrança automática o Astro segue atendendo.** Sem a chave do Asaas, o pedido de PIX/link avisa a equipe (sino, etiqueta de espera) e o Astro diz que um atendente manda o pagamento, **sem se desligar** — antes ele usava `transfer_to_human` e a pergunta seguinte do cliente ficava sem resposta. |
| RF-22 | **Acompanhamento segue o WhatsApp.** Na venda guiada, a página do pedido (`/pedido/<token>`) mostra: Pedido recebido → Preparando o valor → Valor enviado → Pagamento → Conferindo o pedido → Separação → Em rota → Entregue, com o recado da etapa atual e a entrega prevista. O valor digitado pelo consultor fica oculto (tela e resposta da API) até a equipe aprovar. No NERP, "Acompanhar meu pedido" e o link do pedido levam a essa página. |
| RF-19 | **Pontos.** `previewPurchaseStars(organizationId, amount)` com a mesma regra de `awardPurchaseStars`; sem programa ativo ou abaixo do mínimo, a frase dos pontos não aparece. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Org sem `SalesApprover` funciona como hoje (0103): sem rodadas, valor direto ao cliente. |
| RNF-2 | Aviso a aprovador é efeito pós-commit (regra 18), em Inngest, com retry; falha de envio não desfaz a aprovação pendente. |
| RNF-3 | Migrations aditivas: tabelas novas, colunas novas nulas, índice em `leads(organization_id, document)`. |
| RNF-4 | Regras puras (estado da rodada, bloqueio de cobrança, crédito, pontos) cobertas por `scripts/catalog-quote-qa-check.ts`. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado um pedido novo, quando o Astro responde, então a mensagem tem no máximo uma pergunta (consultor) e não pede CPF, endereço nem cadastro.
- [ ] **CA-2** — Dado o cliente que diz "é o Marcos", quando existe um consultor ativo "Marcos Silva" no tracking, então o lead fica com ele como responsável, recebe "Já atendido" e a IA pausa.
- [ ] **CA-3** — Dado um lead com conta a receber vencida, quando o Astro checa o crédito, então aplica "Inadimplente" e não cita valor ao cliente.
- [ ] **CA-4** — Dado `PaymentEntry` RECEIVABLE PENDING vencida ontem, quando o cron roda, então ela fica `OVERDUE`; uma PAID não muda.
- [ ] **CA-5** — Dado uma org com aprovadores, quando o consultor envia o valor, então o cliente **não** recebe nada e cada setor da 1ª rodada recebe o resumo no WhatsApp.
- [ ] **CA-6** — Dado um clique em "Aprovar" vindo de um número sem `SalesApprover` do setor, ou com id de aprovação de outra org, então nada é aprovado.
- [ ] **CA-6b** — Dado um aprovador com aprovação pendente, quando ele clica "Ajustar" e escreve "amanhã 11h", então nenhum lead é criado, nada aparece no chat de clientes e o Astro não responde.
- [ ] **CA-7** — Dado a logística responde "amanhã 11h", então `proposedDeliveryAt` é a data de amanhã às 11h no fuso da org.
- [ ] **CA-8** — Dado os quatro setores aprovaram, então o cliente recebe valor, prazo e pontos numa mensagem só, e a cobrança fica liberada só depois do SIM dele.
- [ ] **CA-9** — Dado a 1ª rodada aberta, quando o Astro tenta gerar PIX, então é recusado com o motivo `awaiting_internal_approval`.
- [ ] **CA-10** — Dado o pagamento confirmado, então o cliente recebe só "estamos conferindo" e financeiro e logística recebem a 2ª rodada; o link de acompanhamento só sai quando os dois confirmam.
- [ ] **CA-11** — Dado a logística ajusta para "amanhã 11h" na 2ª rodada, então o cliente recebe o novo prazo e o acompanhamento só sai depois do SIM dele.
- [ ] **CA-12** — Dado um comprovante enviado no número oficial, então o financeiro recebe o aviso com valor lido × valor cobrado, e o pedido **não** muda de status.
- [ ] **CA-13** — Dado um programa com 10 pontos por compra acima de R$ 50, quando o valor é R$ 200, então a mensagem cita 10 pontos; R$ 30 não cita pontos.
- [ ] **CA-14** — Dado uma org sem aprovadores, então o fluxo é idêntico ao da 0103.
- [ ] **CA-15** — Dado um pedido de orçamento na venda guiada, quando ele chega ao Órbita, então o cliente não recebe nada e o lead fica com a tag "Aguardando cliente no WhatsApp".
- [ ] **CA-16** — Dado o cliente que envia "Olá! Quero finalizar meu pedido #N (código XXXXXX)", então o pedido é ligado à conversa dele, a tag sai, o fluxo "chegada do pedido" manda uma mensagem só e o Astro não responde junto.
- [ ] **CA-17** — Dado um pedido sem mensagem do cliente há 30 min, então sai um único `pedido_aguardando_envio`; uma segunda checagem não envia outro.

## 5. Casos de borda

| ID | Caso | Comportamento |
| --- | --- | --- |
| CB-1 | Aprovador com dois pedidos pendentes escreve texto solto em vez de clicar | Pergunta qual pedido (#123 ou #124) por mensagem de serviço; nada é aprovado até ele dizer. O botão já carrega o id e não tem essa ambiguidade. |
| CB-1b | O número do aprovador também é cliente da loja | Sem aprovação pendente, a mensagem segue o fluxo normal de lead. Com pendente, só botões de aprovação e o texto logo após "Ajustar" são desviados. |
| CB-1c | Template recusado ou não criado na Meta | O envio falha com motivo registrado, o consultor recebe aviso no sino e a aprovação segue possível pela tela. |
| CB-2 | Setor sem aprovador cadastrado | O setor não entra na rodada. Rodada sem nenhum setor = fechada. |
| CB-3 | Aprovador demora | Lembrete após 2h (horário comercial) e aviso no sino do consultor. Sem expiração automática. |
| CB-4 | Consultor reenviar valor com rodada aberta | As aprovações abertas são canceladas e a rodada recomeça. |
| CB-5 | Cliente pergunta "quanto eu devo?" sem ter informado documento | O Astro pede o CPF/CNPJ antes de falar de valores. |
| CB-6 | Fora da janela de 24h (oficial) | Mensagem ao cliente segue a regra atual: fica no portal e o consultor é avisado. |
| CB-7 | NERP fora do ar no resumo da 1ª rodada | Resumo sai sem a linha de estoque, com "estoque não consultado". |
| CB-8 | Nome de consultor ambíguo ("João") com dois Joões | O Astro pergunta o sobrenome ou a cidade. |
| CB-9 | Cliente escreve de outro número | O código na mensagem liga o pedido à conversa de onde ele escreveu. |
| CB-10 | Cliente nunca envia | Um lembrete (RF-0b); depois só o painel, com a tag. |
| CB-11 | Cliente apaga o texto pronto e escreve outra coisa | Sem código, vale o número: lead com pedido aguardando é ligado na primeira mensagem dele. |

## 6. Decisões de design

### D-1 — Aprovação pelo número oficial, com template de utilidade
Número não oficial (Uazapi) mandando mensagens repetidas para a equipe corre risco de bloqueio. A aprovação sai pelo número
oficial da loja (o mesmo do atendimento), com template de categoria **utilidade** e botões de resposta rápida, como os avisos
fiscais da aba Contábil (`send-compliance-whatsapp.ts`, que reaproveitamos: `findConnectedOrganizationInstance` +
`resolveOutboundProvider` + `sendTemplate`). A resposta volta pelo webhook oficial e é desviada antes de virar lead (RF-9b).

### D-6 — O pedido nasce na mensagem do cliente no WhatsApp
Teste real (14/10): com o pedido indo direto do catálogo para o Órbita, o cliente que não abre o WhatsApp deixa a loja sem
conversa — e na API oficial só sobra template (custo, aprovação da Meta e risco de denúncia por mensagem a quem nunca falou
com a loja). Por isso o envio do pedido termina no WhatsApp: a mensagem do cliente abre a janela de 24h e toda a venda guiada
corre em texto. O pedido continua gravado antes (para ter número e código), mas o atendimento só começa quando ele escreve.
Para quem não envia: um lembrete por template (o aceite é o WhatsApp informado no checkout para a loja falar com ele) e,
depois, só o painel.

### D-5 — O fluxo mora nos Gatilhos Automáticos, não em código fixo
Pedido do usuário: reaproveitar os Gatilhos e criar só as ações que faltam. O roteiro (perguntas, mensagens, ordem das
etapas) é um **fluxo pronto** do funil, editável pela equipe. O código só entrega as ações novas e os pontos de disparo:

| Ação nova (NodeType) | O que faz | Saídas |
| --- | --- | --- |
| `SALES_APPROVAL` — Pedir aprovação da equipe | Abre a rodada (antes ou depois do pagamento) para os setores escolhidos, envia o template a cada aprovador e espera as decisões (pausa e retoma no evento `agent-workflow/catalog-approval-decided`). Guarda prazo e motivos em variáveis. | `approved`, `rejected`, `timeout` |
| `CHECK_CREDIT` — Checar crédito do lead | Contas a receber vencidas do lead; aplica "Apto a comprar" ou "Inadimplente". | `eligible`, `overdue` |
| `FIND_CUSTOMER_BY_DOCUMENT` — Buscar cliente por CPF/CNPJ | Lê o documento (do lead, de uma variável ou da última mensagem), valida e procura compra anterior. | `returning`, `new`, `no_document` |
| `ROUTE_TO_CONSULTANT` — Encaminhar para o consultor dele | Procura o nome dito pelo cliente entre os consultores do funil; define responsável, tag "Já atendido" e pausa a IA. | `found`, `not_found` |
| `CATALOG_ORDER_ACTION` — Atualizar pedido do catálogo | Carrega o pedido em variáveis (`{{vars.pedido.*}}`), registra o aceite do valor ou do novo prazo, libera o pedido. | `main`, `no_order` |

Reaproveitado sem mudança: gatilhos "Lead com tag", "Pagamento recebido", "Lead muda de etapa"; ações Enviar mensagem
(texto, botões, template fora da janela, "Esperar o clique"), Esperar resposta, Decisão por IA, Aplicar tag, Mover lead.
Os pontos de disparo novos no código: o "Enviar valor" aplica a tag "Valor em aprovação" (dispara o fluxo) em vez de
mandar direto ao cliente quando a org tem aprovadores; o pagamento do catálogo dispara "Pagamento recebido"; e, com a
venda guiada ativa, os avisos fixos de "pagamento confirmado/enviado para separação" saem pelo fluxo, não pelo código.

### D-2 — `SalesApprover` em vez de reaproveitar `PaymentApprovalRequest`
A aprovação de pagamento é por valor e tem um aprovador; aqui é por setor e por rodada, por pedido. Modelos próprios no
domínio `nerp-catalog`, sem acoplar ao financeiro.

### D-3 — Crédito pelo telefone, documento só na cobrança
O lead já é o mesmo pelo telefone, e as contas a receber se ligam por `leadId`. Pedir documento no começo mataria a
experiência (pedido do cliente).

### D-4 — Prazo extraído por IA, gravado como data
A logística escreve como fala ("amanhã 11h"); a extração usa o modelo de `resolveExtractionModels` e a data sempre aparece
para o aprovador confirmar na mensagem de volta pelo número oficial ("Entendi: quinta 16/10 às 11h").

## 7. Impacto

- **Schema:** `SalesApprover`, `CatalogOrderApproval`, enums de setor/rodada/decisão; `CatalogOrder.deliveryPromiseAt`,
  `deliveryNote`, `internalApprovedAt`, `postPaymentApprovedAt`; índice `leads(organization_id, document)`.
- **Procedures:** `nerp.catalogOrders.listApprovals`, `nerp.catalogOrders.decideApproval`, `nerp.salesApprovers.*`.
- **Meta:** criar o template de utilidade `aprovacao_pedido` (pt_BR, botões Aprovar/Recusar/Ajustar) na conta da loja
  e aguardar aprovação antes de ligar os aprovadores.
- **Entrada do número oficial:** passo novo em `persistCanonicalInbound` (RF-9b), antes da busca do lead.
- **Inngest:** `catalog-order/approval-notify`, `catalog-order/approval-reminder`, `payment/mark-overdue-entries`,
  `catalog-order/read-inbound-document`.
- **Astro:** tools `find_my_consultant`, `check_customer_credit`, `identify_customer_by_document`,
  `approve_delivery_change`; prompt do pedido reescrito; capability `conversationStyle`.
- **NERP (nerp-2):** `s2s-scopes.ts` libera as procedures que o Órbita chama; `deliver-order.ts` envia preço de tabela
  (unidade e caixa).
- **Docs:** `docs/nerp-catalog-orbita.md`, `docs/whatsapp-oficial-overview.md`, guias do Astro (âncoras do painel de
  aprovações e da tela de aprovadores).

## 8. Plano de testes

| Critério | Tipo | Onde |
| --- | --- | --- |
| CA-4, CA-6, CA-9, CA-13, CB-1, CB-2 | automatizado | `scripts/catalog-quote-qa-check.ts` (funções puras) |
| CA-1, CA-2, CA-3, CA-5, CA-7, CA-8, CA-10, CA-11, CA-12, CA-14 | manual | Armazém Carvalho, Asaas sandbox, aprovadores com números da equipe, cliente 86 99822-1810 |

## 9. Segurança de dados

- O cliente nunca vê preço de tabela, dívida de terceiros, nome de aprovador nem nota interna.
- Valor de dívida só é citado ao cliente depois de ele informar o documento e só se perguntar.
- Aprovação só vale do `phoneE164` de um `SalesApprover` ativo do setor, na mesma org do pedido, **e** com o id da
  aprovação (payload do botão) pertencendo a esse aprovador. Número desconhecido continua virando lead, como hoje.
- Resposta de aprovador decide só o próprio setor, só do pedido indicado.
- Resumo enviado ao aprovador não leva CPF completo nem endereço; só nome, itens, valores e o status de crédito.
- Procedures da tela exigem `catalogo-online` `canEdit`; decidir exige ser o `SalesApprover` do setor.

## 10. Regras da Meta

- Aviso interno sai pelo **número oficial**, sempre por **template de utilidade** aprovado (fora da janela de 24h é o único
  tipo permitido). Nada de Uazapi para a equipe: evita bloqueio de número.
- O template é estritamente transacional — número do pedido, valor, o que precisa ser decidido. Nenhum texto promocional,
  emoji de oferta ou link de catálogo, para a Meta não reclassificar como marketing (mais caro e com limite de frequência).
- Aprovador só recebe depois do aceite registrado (`optInAt`), como a Meta exige para mensagens iniciadas pela empresa.
- Botões de resposta rápida (no máximo 3: Aprovar, Recusar, Ajustar). O clique abre a janela de 24h; o texto de ajuste e a
  confirmação ("Entendi: quinta 16/10 às 11h") seguem como mensagem de serviço, sem custo de template.
- Custo: cada aviso fora da janela é uma conversa de utilidade cobrada pela Meta. Por pedido, até 4 avisos na 1ª rodada e 2
  na 2ª, mais lembretes (CB-3). Lembrete dentro da janela aberta sai como texto.
- Mensagem ao cliente fora da janela de 24h segue a regra atual (CB-6).
- A venda guiada começa na mensagem do cliente (D-6): toda a conversa corre na janela de 24h aberta por ele, sem template.
  O único envio iniciado pela loja ao cliente antes disso é **um** `pedido_aguardando_envio` (utilidade, sem oferta), ao
  número que ele mesmo informou no checkout para a loja falar com ele.
- Um menu de botões por etapa para o cliente, no máximo 3 botões, só em conversa iniciada por ele. Sem disparo em massa.

## 11. Riscos e rollback

- **Fluxo travar por aprovador ausente:** lembrete (CB-3) e a tela permite que outro aprovador do mesmo setor decida.
- **Rollback:** apagar os `SalesApprover` da org volta ao fluxo da 0103 (RNF-1). As colunas novas são nulas.

## 12. Templates da Meta (a criar pela equipe da Órbita)

Todos em **pt_BR**, categoria **Utilidade**, na conta oficial da loja. O nome de cada um fica configurável na tela dos
aprovadores (padrão abaixo). Sem o template aprovado, o envio fora da janela de 24h falha com motivo registrado e o
consultor é avisado (CB-1c, CB-6). Textos estritamente transacionais, sem oferta, para não virarem marketing.

### Para a equipe

| Nome | Quando | Texto | Botões (resposta rápida) |
| --- | --- | --- | --- |
| `aprovacao_pedido` | 1ª rodada (RF-9) | Pedido #{{1}} aguardando sua aprovação ({{2}}).\nCliente: {{3}}\nItens: {{4}}\nTotal: {{5}}\nSituação: {{6}} | Aprovar · Recusar · Ajustar |
| `conferencia_pedido_pago` | 2ª rodada (RF-14) | Pedido #{{1}} pago e aguardando sua conferência ({{2}}).\nCliente: {{3}}\nValor pago: {{4}} via {{5}}\nEntrega prevista: {{6}} | Confirmar · Ajustar |
| `lembrete_aprovacao_pedido` | Lembrete (CB-3), fora da janela | O pedido #{{1}} ainda aguarda sua decisão ({{2}}) desde {{3}}. | Abrir pedido |

Variáveis: {{2}} = setor (Comercial, Financeiro, Logística, Contábil); {{4}} = itens resumidos ("3 cx Refrigerante, 10 un
Arroz 5kg"); {{6}} em `aprovacao_pedido` = crédito e estoque ("Apto a comprar · estoque ok"). "Abrir pedido" abre a janela de
24h e o Astro responde com o resumo e os botões de decisão.

### Para o cliente (só quando a janela de 24h já fechou)

| Nome | Quando | Texto | Botões |
| --- | --- | --- | --- |
| `valor_pedido` | Valor aprovado (RF-11) | Oi, {{1}}! O valor do seu pedido #{{2}} ficou {{3}}, com entrega {{4}}. {{5}} | Fechar pedido · Falar com consultor |
| `pagamento_em_conferencia` | Pagou (RF-14) | Recebemos seu pagamento do pedido #{{1}}, {{2}}. Estamos conferindo e já te confirmamos a entrega. | — |
| `prazo_entrega_alterado` | Tratativa (RF-15) | {{1}}, a entrega do pedido #{{2}} precisou mudar para {{3}}. Pode ser? | Pode ser · Falar com consultor |
| `pedido_liberado` | Liberado (RF-16) | Tudo certo com o pedido #{{1}}! Entrega prevista: {{2}}. Acompanhe aqui: {{3}} | — |
| `consulta_produto` (equipe) | Cliente pediu preço/estoque (RF-20), fora da janela do coordenador | Cliente {{1}} pediu preço e estoque: {{2}}. Responda pelo chat do Órbita. | — |
| `pedido_aguardando_envio` | Cliente não enviou o pedido em 30 min (RF-0b) | Oi, {{1}}! Seu pedido #{{2}} ficou guardado aqui. Pra loja te mandar o valor, é só tocar em Enviar pedido. | Enviar pedido |
| `pedido_recebido` | Chegada do pedido fora da venda guiada, número oficial (hoje reportado como `official_needs_template` em `order-channel.ts`) | Oi, {{1}}! Recebemos seu pedido #{{2}}. Acompanhe por aqui: {{3}} | — |
| `pedido_separado` | Etapa "Separado" (entrega) | Oi, {{1}}! Seu pedido #{{2}} já foi separado e logo sai para entrega. Acompanhe pelo botão abaixo. | Link: Acompanhar pedido |
| `pedido_pronto_retirada` | Etapa "Separado" (retirada) | Oi, {{1}}! Seu pedido #{{2}} está separado e pronto para retirada na loja. Acompanhe pelo botão abaixo. | Link: Acompanhar pedido |
| `pedido_em_rota` | Etapa "Em rota" | Oi, {{1}}! Seu pedido #{{2}} saiu para entrega e chega em breve. Acompanhe pelo botão abaixo. | Link: Acompanhar pedido |
| `pedido_entregue` | Etapa "Entregue" | Oi, {{1}}! Seu pedido #{{2}} foi entregue. Obrigado pela compra! Qualquer coisa, é só responder aqui. | — |

{{5}} em `valor_pedido` = frase dos pontos ("Essa compra te rende 10 pontos pra trocar por brindes.") ou vazio quando não
há programa (RF-19). Dentro da janela de 24h nenhum desses templates é usado: o Astro escreve a mensagem no tom da conversa.

### Decisões do usuário na revisão do desenho dos fluxos (2026-10-14)

- **Crédito também para quem já tem consultor** (fluxo 1): depois de passar ao consultor, o fluxo confere o crédito e o aviso de conta vencida vai para ele.
- **Contábil fora da aprovação antes do cliente** (fluxo 2): aprovam comercial, financeiro e logística.
- **Tudo dentro da janela de 24h do cliente**: as esperas (aprovação dos setores, CPF, consultor, conferência pós-pagamento) usam `timeoutMode: "customer_window"` — terminam 1h antes de fechar a janela da última mensagem do cliente (mínimo 15 min). Janela já fechada: vale o prazo configurado e as mensagens saem por template.
- **Cadastro do cliente novo depois do pagamento com os dados que ele já passou**: o fluxo 3 termina com o passo existente "Preencher formulário pela conversa" (só cliente sem compra paga anterior), com o formulário escolhido ao criar os fluxos. Nome, telefone e CPF já vinham do lead; o endereço passa a vir da entrega do pedido do catálogo (campo de endereço do formulário). Só pergunta o que faltar. Exige `NEXT_PUBLIC_WORKFLOW_FORM_CHAT=true`.
- **"Pedido separado" e "pedido em rota" no acompanhamento e no WhatsApp**: etapa nova **"Em rota"** (`catalog.on_route`) entre "Separado" e "Entregue"; "Separado" avisa "pedido separado" (ou "pronto para retirar"), "Em rota" avisa "saiu para entrega", "Entregue" avisa "entregue". Todo aviso de etapa fica no acompanhamento e sai no WhatsApp: texto dentro da janela, template fora dela (`pedido_separado`, `pedido_pronto_retirada`, `pedido_em_rota`, `pedido_entregue`). A chegada do pedido passa a usar `pedido_recebido` no número oficial.

## 13. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-14 | Claude | Criada |
| 2026-10-14 | Claude | D-1 trocada: aprovação pelo número oficial com template de utilidade (Uazapi arrisca bloqueio). RF-8, RF-9, RF-9b, CA-6b, CB-1b/1c e Regras da Meta ajustados |
| 2026-10-14 | Claude | Seção 13: lista dos templates da Meta (equipe e cliente) com texto, variáveis e botões |
| 2026-10-14 | Claude | D-5: o roteiro vira fluxo pronto nos Gatilhos Automáticos com 5 ações novas; Astro/código só fornecem as peças |
| 2026-10-14 | Claude | Implementação: RF-1..4, 7, 9, 13, 15..18 reescritos para refletir as ações dos Gatilhos, o fluxo pronto e o que foi reaproveitado (formulário pela conversa, leitura de comprovante, Decisão por IA) |
| 2026-10-14 | Claude | Revisão do desenho: crédito também com consultor, sem contábil na 1ª rodada, esperas dentro da janela de 24h do cliente, cadastro do cliente novo com dados do pedido, etapa "Em rota" e avisos de etapa no WhatsApp com 4 templates novos |
| 2026-10-14 | Claude | Teste real: a chegada mandava 5 mensagens. Agora é uma só (recebimento + pontos + pergunta do consultor, pelo fluxo); o Astro não responde à chegada e o link avulso não sai. Com a janela de 24h fechada, a pergunta fica no chat e sai quando o cliente escrever |
| 2026-10-14 | Claude | Revisão completa pós-teste: (1) a mensagem do pedido não conta mais como mensagem do cliente na janela de 24h; (2) perguntas do fluxo saem no WhatsApp mesmo com o pedido vindo do catálogo; (3) pedido acha o lead com ou sem o 9º dígito; (4) aprovação da equipe com prazo próprio (não depende da janela do cliente), reconferida a cada 15 min e cancelada ao vencer; valor reenviado encerra a rodada antiga sem duplicar mensagens; (5) "oi" do aprovador abre a janela dele e aviso não entregue é reenviado na próxima mensagem; pedido de texto ao aprovador vence em 30 min e toda resposta cita "#pedido · setor"; (6) botão "Abrir pedido" do lembrete só reenvia o resumo (antes aprovava); (7) resposta do cliente só vale para a última pergunta feita, e anexo do atendente não conta como resposta; (8) pagamento: aviso ao cliente e conferência da equipe lado a lado, nova ação "Esperar a resposta do cliente" com o Astro calado na mudança de prazo, passos usam o pedido do gatilho; (9) sem Asaas o Astro passa para um humano sem expor o motivo; pedido pago não volta a pedir pagamento; valor só desvia para aprovação se o fluxo estiver ligado |
| 2026-10-15 | Claude | Teste real ponta a ponta até o PIX: RF-20 (consulta de preço/estoque ao coordenador do Comercial) e RF-21 (sem Asaas o Astro não se desliga). Falas dos fluxos mais naturais; botão "Enviar para aprovação" (e sem recado) quando o valor passa pela equipe; CPF inválido com resposta própria; sem programa de pontos a linha some; resumo do pedido de orçamento sem "R$ 0,00"; lista de produtos do NERP no Órbita volta a funcionar (paginação por cursor). |
| 2026-10-15 | Claude | RF-22: linha do tempo da venda guiada no acompanhamento e valor oculto até a aprovação da equipe (antes o portal mostrava o valor do consultor durante a aprovação interna). |
