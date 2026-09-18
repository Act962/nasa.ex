---
id: 0020
titulo: Cobrança PIX automática pelo Asaas no checkout do trafeGO
dominio: trafego
status: em-revisao
autor: João Gabriel
criada: 2026-09-18
atualizada: 2026-09-18
branch: feature/trafego-pix-asaas-20260918
pr:
peso: completa
---

# 0020 — Cobrança PIX automática pelo Asaas no checkout do trafeGO

> Spec **completa**: integração externa, dinheiro, dado pessoal novo (CPF/CNPJ) e
> migração de schema. O desenho foi escrito e decidido antes do código, conforme
> item 17 do CLAUDE.md; a implementação veio no mesmo PR, por decisão do dono.
>
> **Estado**: código escrito e com lint limpo. Os critérios que dependem da API
> do Asaas (CA-1, CA-2, CA-5, CA-8, CA-14) **ainda não foram verificados** — não
> havia chave de sandbox configurada. Ver §8.

---

## 1. Contexto

O PIX do trafeGO é manual de ponta a ponta. O que acontece hoje, lido no código:

| Passo | Onde | O que faz |
| --- | --- | --- |
| 1 | [`checkout/trafego/route.ts:313-374`](../../src/app/api/checkout/trafego/route.ts) | Gera uma referência curta (`TGP-4K2M`) e devolve a **chave PIX estática da agência**, vinda de `TrafegoSettings.pixKey` |
| 2 | [`lib/pix.ts`](../../src/features/trafego/lib/pix.ts) | Monta o texto que o cliente manda no WhatsApp junto do comprovante |
| 3 | — | O cliente paga no app do banco dele e envia o print para a equipe |
| 4 | [`ops/confirm-pix.ts`](../../src/app/router/trafego/ops/confirm-pix.ts) | Um operador confere o comprovante e **digita à mão** o valor recebido |
| 5 | [`mark-purchase-paid.ts`](../../src/features/trafego/server/lib/mark-purchase-paid.ts) | Só então o pedido é liberado e o cliente recebe o link de ativação |

Cinco problemas, todos consequência de o passo 4 ser humano:

1. **Latência.** Entre pagar e receber o acesso existe uma pessoa. Fora do
   horário comercial, o cliente pagou e não acontece nada.
2. **O valor é digitado.** `receivedBrlCents` vem do que alguém leu num print.
   Um dígito errado marca `amountMismatch` numa venda correta — ou, pior,
   **não** marca numa venda divergente.
3. **A referência não amarra nada.** `TGP-4K2M` é convenção social: se o cliente
   não digitar isso na mensagem do PIX, a conciliação vira busca por valor e
   horário no extrato.
4. **A expiração é pelo nosso relógio, não pelo do provedor.** O cron
   [`trafego-pix-pending-sweep`](../../src/inngest/functions/crons/trafego-pix-pending-sweep.ts)
   marca `EXPIRED` de hora em hora quando `pixExpiresAt` passou — isso já
   funciona. O que falta é o outro lado: nada confirma que o cliente **não**
   pagou. Uma pendência expirada pode ter sido paga e o comprovante ter se
   perdido no WhatsApp, e o sistema não tem como saber a diferença.
5. **Comprovante é confiança.** Print de PIX é trivial de forjar, e a única
   barreira entre um print falso e um pedido liberado é a atenção do operador.

O projeto já fala com o Asaas — [`src/lib/asaas.ts`](../../src/lib/asaas.ts),
usado hoje só na recarga de Stars — e já tem `PaymentGatewayConfig` com UI em
`/admin/payments`. A infraestrutura existe; o trafeGO não a usa.

### 1.1 O que a pesquisa na API do Asaas mudou no desenho

Três fatos apurados na documentação oficial antes de desenhar, porque cada um
elimina um caminho possível:

| Fato | Fonte | Consequência |
| --- | --- | --- |
| `POST /v3/customers` exige `cpfCnpj` | [criar-novo-cliente](https://docs.asaas.com/reference/criar-novo-cliente) | O wizard **precisa** coletar documento na trilha PIX. Não existe cobrança nominal sem isso |
| Entrega é *at least once*, com `id` de evento para idempotência | [receba-eventos](https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook) | O handler tem de ser idempotente por construção, não por sorte |
| Após **15 falhas consecutivas** a fila do webhook é **interrompida**; os eventos ficam retidos por 14 dias | [webhooks-2](https://docs.asaas.com/docs/webhooks-2) | Responder 500 a um evento que não nos interessa **derruba a fila inteira**. O ack tem de ser rápido e quase incondicional |

Um quarto fato, menor, que vale corrigir junto: a URL de sandbox em
`src/lib/asaas.ts:15` é `https://sandbox.asaas.com/api/v3`, e a documentação
atual publica `https://api-sandbox.asaas.com/v3`. Os dois hosts respondem
(verificado: ambos devolvem `401` sem chave), então **não está quebrado** — é o
host legado, e só o novo é documentado.

## 2. Objetivo

O cliente que escolhe PIX paga por QR Code e o pedido é liberado sozinho, pelo
webhook do Asaas, sem operador no meio.

### Não-objetivos

- **Trocar o Stripe no cartão.** O cartão continua exatamente como está.
- **Boleto ou cartão pelo Asaas.** Só PIX.
- **Cupom no PIX.** Segue valendo o não-objetivo da [spec 0010](0010-trafego-checkout-cupom.md).
- **Corrigir o S1** (webhook de Stars sem validação de assinatura). É endpoint
  diferente, com escopo e segredo próprios. O handler desta spec nasce correto e
  **serve de template** para a correção, mas o S1 continua aberto na
  [auditoria](../../docs/seguranca-auditoria-2026-08.md) até alguém fechá-lo.
- **Conta Asaas por organização.** Uma conta só, a da agência.
- **Split, antecipação ou assinatura recorrente.**
- **Estorno automático.** Chargeback e refund são *detectados* e sinalizados
  (RF-13); desfazer o financeiro continua sendo P-4/P-5/P-6 do
  [backlog](../../docs/trafego-correcoes-pendentes.md).
- **Aposentar o "Confirmar PIX" manual.** Ele fica, de propósito — ver D-5.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Ao escolher PIX, o checkout cria uma cobrança no Asaas (`POST /v3/payments`, `billingType: "PIX"`) e devolve ao cliente o **copia-e-cola** (`payload`) e a **imagem** (`encodedImage`) do QR, obtidos em `GET /v3/payments/{id}/pixQrCode` |
| RF-2 | O wizard coleta `cpfCnpj` **apenas** na trilha PIX, com validação de dígito verificador no cliente e no servidor |
| RF-3 | O customer do Asaas é reaproveitado por `cpfCnpj`; só cria quando não existe |
| RF-4 | `externalReference` da cobrança = `TrafegoPendingPurchase.id`, e o id da cobrança (`pay_...`) é gravado na pendência |
| RF-5 | `dueDate` = hoje + `TrafegoSettings.pixExpiryHours`, reusando a configuração que já existe |
| RF-6 | Endpoint dedicado `POST /api/trafego/asaas/webhook` valida o header `asaas-access-token` contra o segredo guardado, **fail-closed**: token ausente ou diferente → `401`, sem efeito nenhum |
| RF-7 | O valor **nunca** vem do corpo do webhook. O handler relê `GET /v3/payments/{id}` e usa o valor da API como verdade |
| RF-8 | A confirmação passa por `markTrafegoPurchasePaid({ paymentSource: "pix" })` — nenhum caminho novo de liberação de pedido |
| RF-9 | Idempotência: evento repetido não produz segundo efeito. Garantida pelo claim atômico já existente (`updateMany` com guarda de status) |
| RF-10 | O handler responde `200` para qualquer evento que não seja erro **nosso** — inclusive evento desconhecido e pendência inexistente — e processa o efeito fora do ciclo da resposta |
| RF-11 | O "Confirmar PIX" manual continua funcionando e passa a aceitar também pendências com cobrança Asaas |
| RF-12 | Chave de API, ambiente e token do webhook vêm do **ambiente** (`ASAAS_API_KEY`, `ASAAS_ENV`, `ASAAS_WEBHOOK_TOKEN`), não do banco. `ASAAS_ENV` ausente vale `sandbox` |
| RF-13 | `PAYMENT_OVERDUE` marca a pendência como `EXPIRED` (sem cancelar) — redundante com o cron `trafego-pix-pending-sweep`, e mantido porque vem do provedor, que é a fonte autoritativa do vencimento. `PAYMENT_REFUNDED`, `PAYMENT_PARTIALLY_REFUNDED` e `PAYMENT_CHARGEBACK_REQUESTED` **não** revertem nada automaticamente: notificam os admins e registram evento no pedido |
| RF-14 | A tela de PIX do wizard mostra o QR e faz polling do status da pendência, liberando o próximo passo assim que o webhook confirmar |
| RF-15 | Com o gateway Asaas inativo ou não configurado, o checkout PIX volta ao fluxo manual de hoje (chave estática + referência), sem erro para o cliente |
| RF-16 | Cada cobrança PIX criada agenda **um** acompanhamento próprio, que confere o estado no Asaas em 15min, 2h, 24h e 48h, e encerra no primeiro checkpoint em que a pendência já estiver resolvida |
| RF-17 | O cron horário que já existe (`trafego-pix-pending-sweep`) **reconcilia antes de expirar**: pendência aberta com cobrança no Asaas é conferida contra a API, e só depois o que sobrou vira `EXPIRED` |
| RF-18 | Quando a reconciliação **confirma** um pagamento que o webhook não confirmou, os admins são notificados — isso não é rotina, é sinal de que a entrega de eventos está quebrada |
| RF-19 | Existe um "Reconciliar PIX agora" no admin, servido por procedure oRPC **fora do Inngest**, para o caso de a fila inteira estar indisponível |
| RF-20 | Nenhuma credencial do Asaas é lida do banco nem editável por interface |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | O webhook confirma o recebimento em < 1s no p95; a regra de negócio roda assíncrona |
| RNF-2 | `authToken` entre 32 e 255 caracteres, aleatório, **nunca** igual à API key do Asaas — a própria documentação desaconselha |
| RNF-3 | Nenhum fallback silencioso na validação do token. Sem segredo configurado, o endpoint recusa tudo |
| RNF-4 | A chave da API nunca é exposta ao cliente; QR e copia-e-cola vêm do nosso servidor |
| RNF-5 | `cpfCnpj` é dado pessoal (LGPD): guardado só na pendência, usado só para emitir a cobrança, com prazo de retenção declarado em D-6 |
| RNF-6 | Toda chamada ao Asaas tem timeout e falha fechada no checkout — não deixa o cliente numa tela de QR vazia |
| RNF-7 | O custo de execução da recuperação acompanha o **volume de vendas**, não a passagem do tempo: nenhum cron novo, e um run por cobrança |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado um checkout PIX com CPF válido, quando o cliente conclui, então a resposta traz `payload` e `encodedImage`, e a pendência guarda o `pay_...` do Asaas.
- [ ] **CA-2** — Dado um CPF/CNPJ inválido, quando o cliente tenta seguir, então o checkout recusa com mensagem de campo e **não** cria cobrança órfã no Asaas.
- [ ] **CA-3** — Dado um POST no webhook **sem** o header `asaas-access-token`, então a resposta é `401` e nenhuma pendência muda de status.
- [ ] **CA-4** — Dado um POST com token **errado**, então a resposta é `401` e nada muda. (Ausente e errado são critérios separados porque são caminhos distintos no código.)
- [ ] **CA-5** — Dado `PAYMENT_RECEIVED` válido para uma pendência `PENDING`, então ela vira `PAID`, o pedido nasce e o cliente recebe o link de ativação.
- [ ] **CA-6** — Dado o **mesmo** evento entregue duas vezes, então o segundo não gera pedido, e-mail ou lançamento financeiro duplicado.
- [ ] **CA-7** — Dado um webhook cujo corpo diz um valor e a API diz outro, então vale o da API.
- [ ] **CA-8** — Dado um pagamento de valor diferente do contratado, então a pendência é confirmada **e** marcada `amountMismatch`.
- [ ] **CA-9** — Dado um evento cujo `externalReference` não existe no banco, então a resposta é `200` (a fila não pode ser punida por um evento que não é nosso).
- [ ] **CA-10** — Dado `PAYMENT_RECEIVED` para uma pendência já paga no cartão, então o resultado é `already_paid` e os admins recebem o aviso de duplicidade.
- [ ] **CA-11** — Dado `PAYMENT_OVERDUE`, então a pendência vira `EXPIRED` e continua confirmável à mão.
- [ ] **CA-12** — Dado `PAYMENT_REFUNDED`, então os admins são notificados e o pedido registra o evento, sem reverter lançamento financeiro sozinho.
- [ ] **CA-13** — Dado o gateway Asaas desativado em `/admin/payments`, então o checkout PIX entrega a chave estática e a referência `TGP-`, como hoje.
- [ ] **CA-14** — Dado um cliente que já comprou antes com o mesmo CPF, então nenhum customer novo é criado no Asaas.
- [ ] **CA-15** — Dado um pagamento cujo webhook nunca chegou, quando o acompanhamento da cobrança acorda, então a pendência é confirmada e os admins recebem o aviso de resgate.
- [ ] **CA-16** — Dado que o webhook já confirmou, quando o acompanhamento acorda, então ele encerra sem efeito nenhum.
- [ ] **CA-17** — Dada uma pendência cuja cobrança existe no Asaas mas cujo `asaasPaymentId` não foi gravado, quando a reconciliação roda, então ela reencontra a cobrança pelo `externalReference` e grava o vínculo.
- [ ] **CA-18** — Dado o botão "Reconciliar PIX agora" clicado duas vezes seguidas, então o segundo clique não gera pedido, e-mail ou lançamento duplicado.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Header `asaas-access-token` ausente | `401`, log, nenhum efeito (CA-3) |
| CB-2 | Token presente mas diferente | `401`, log com alerta — é tentativa de forja (CA-4) |
| CB-3 | Nenhum `authToken` configurado no gateway | Recusa **tudo** com `401`. Sem segredo não há como distinguir o Asaas de qualquer um (RNF-3) |
| CB-4 | Mesmo evento entregue N vezes | O primeiro confirma; os demais devolvem `200` sem efeito (CA-6) |
| CB-5 | Eventos fora de ordem (`sendType: NON_SEQUENTIALLY`) | O estado vem sempre da releitura da cobrança, não da sequência de eventos |
| CB-6 | Corpo "lean": webhook traz só `payment.id` | Esperado. O handler sempre relê a cobrança — o corpo diz *qual*, não *quanto* (RF-7) |
| CB-7 | `externalReference` de outro sistema, ou nulo | `200` + log. Nunca `500`: 15 desses derrubam a fila (CA-9) |
| CB-8 | Pendência já paga no cartão | `already_paid` e aviso de duplicidade aos admins — o caminho já existe em `mark-purchase-paid.ts` (CA-10) |
| CB-9 | Pagou a menos ou a mais | Confirma e marca `amountMismatch`. Não reescalar verba em silêncio (spec 0008 CA-14) |
| CB-10 | Cobrança vencida, cliente paga depois | Confirma normalmente: `claimFromStatuses` já aceita `EXPIRED` (spec 0009 CA-9) |
| CB-11 | Asaas indisponível na hora do checkout | Falha fechada, com mensagem clara e pendência `CANCELLED` — igual ao `503` de hoje quando falta `pixKey` |
| CB-12 | `GET /pixQrCode` falha depois de a cobrança ser criada | A cobrança existe e é válida; a tela oferece "gerar QR novamente" em vez de recriar a cobrança — recriar geraria cobrança duplicada |
| CB-13 | Cliente fecha a tela antes de pagar e paga pelo link depois | Funciona: a cobrança vive no Asaas e o webhook confirma quando cair |
| CB-14 | CPF válido no dígito, mas de outra pessoa | Fora do nosso alcance. A cobrança é emitida; o pagador real vem no evento e fica registrado |
| CB-15 | Mesmo CPF com e-mail diferente do cadastro anterior | Reusa o customer existente (busca por `cpfCnpj`) e **não** sobrescreve o cadastro no Asaas |
| CB-16 | Dois checkouts simultâneos do mesmo cliente | Duas pendências, duas cobranças, dois QR. Cada webhook resolve a sua pelo `externalReference` |
| CB-17 | Fila interrompida após 15 falhas | Eventos ficam retidos 14 dias; reativar com `PUT /v3/webhooks/{id}` (`interrupted: false`). Precisa de alarme — ver D-7 |
| CB-18 | Cobrança criada em sandbox e webhook de produção (ou vice-versa) | `ASAAS_ENV` define a base URL e o `.env` define o token. Como dev e produção são arquivos diferentes, evento de ambiente trocado não valida o token e cai no CB-2 |
| CB-26 | `ASAAS_ENV` com valor inesperado (vazio, `prod`, `Sandbox`) | Vale `sandbox`. Só a string exata `production` liga produção — qualquer ambiguidade erra para o lado que não move dinheiro |
| CB-19 | `PAYMENT_DELETED` (cobrança apagada no painel) | Pendência volta a `CANCELLED`, com log. Não apagar dados |
| CB-20 | Cliente escolhe PIX, desiste e volta como cartão | A cobrança Asaas fica em aberto e vence sozinha; a pendência nova é outra. Registrar, para não conciliar errado depois |
| CB-21 | Webhook e reconciliação confirmam ao mesmo tempo | O claim atômico decide; o perdedor recebe `already_paid` e não faz nada |
| CB-22 | `inngest.send` do acompanhamento falha na criação da cobrança | Só loga. O sweep horário é a rede — por isso ele existe mesmo com o acompanhamento por pedido |
| CB-23 | Cliente paga depois dos 48h do último checkpoint | O sweep horário ainda pega, até `MAX_AGE_DAYS`. Depois disso, só o "Confirmar PIX" manual |
| CB-24 | Reconciliação não consegue falar com o Asaas | Conta em `failed`, notifica os admins e **não** marca nada. Chave errada não pode virar pedido cancelado |
| CB-25 | Inngest inteiramente fora | Acompanhamento e sweep param juntos — são a mesma fila. Sobram o botão no admin e o "Confirmar PIX" |

## 6. Decisões de design

### D-1 — Cobrança nominal, com CPF/CNPJ pedido só na trilha PIX

- **Escolha**: `POST /v3/payments` com customer real, e o campo de documento
  aparece **apenas** para quem escolheu PIX, na etapa de pagamento.
- **Alternativas descartadas**:
  - **QR Code estático** (`POST /v3/pix/qrCodes/static`): dispensa cliente e CPF,
    concilia pelo `pixQrCodeId`. Descartada porque não tem vencimento nativo, não
    notifica o pagador e dificulta estorno — e a própria documentação do Asaas
    recomenda QR estático para valor fixo/doação e **cobrança Pix para venda com
    vencimento**, que é exatamente o nosso caso.
  - **CPF obrigatório para todo mundo**, inclusive no cartão: padronizaria o
    cadastro do pagador, mas cobra atrito de um funil que hoje não precisa disso.
    Fica registrada como o caminho natural **se** a nota fiscal passar a ser
    emitida para toda venda.
- **Consequência**: o wizard ganha um campo, e o trafeGO passa a guardar um dado
  pessoal que antes não guardava. É mudança de produto, não só técnica.

### D-2 — Endpoint dedicado, separado do webhook de Stars

- **Escolha**: `POST /api/trafego/asaas/webhook`, com segredo próprio.
- **Alternativas descartadas**: reaproveitar `/api/payments/asaas/webhook`.
  Descartada por dois motivos: ele credita Stars e não valida assinatura (S1
  aberto), e endpoint compartilhado faz um domínio herdar o risco do outro.
- **Consequência**: dois endpoints Asaas no projeto. Aceitável — o custo é um
  arquivo; o benefício é o trafeGO não ficar esperando o S1 ser corrigido.

### D-3 — O valor vem da API, nunca do corpo do webhook

- **Escolha**: validado o token, o handler faz `GET /v3/payments/{id}` e usa o
  valor de lá.
- **Alternativas descartadas**: confiar em `payment.value` do corpo. É o que o
  webhook de Stars faz hoje — e é metade do S1: mesmo com assinatura válida, um
  valor divergente creditaria o pacote cheio. O corpo também pode chegar "lean",
  só com o `id` (CB-6), então confiar nele é frágil mesmo sem adversário.
- **Consequência**: uma chamada HTTP a mais por evento. É o preço de o valor não
  ser palpite.

### D-4 — Confirmação entra pelo `markTrafegoPurchasePaid`

- **Escolha**: o handler chama a função que já existe, com `paymentSource: "pix"`.
- **Alternativas descartadas**: caminho próprio de confirmação para o Asaas.
  Descartada porque quebraria a invariante mais valiosa do domínio: **existe um
  único lugar onde uma compra vira paga**. É ele que segura duplicidade, gera o
  `signupToken`, cria o pedido e dispara os efeitos.
- **Consequência**: a idempotência vem de graça, pelo claim atômico.

### D-5 — O "Confirmar PIX" manual continua existindo

- **Escolha**: manter a procedure e o botão.
- **Alternativas descartadas**: remover, agora que o PIX é automático.
  Descartada porque cliente vai continuar pagando por fora — PIX na chave antiga,
  transferência, valor quebrado — e porque é a única saída quando a fila do
  webhook está interrompida (CB-17).
- **Consequência**: dois caminhos de confirmação, ambos idempotentes pelo mesmo
  claim. Um operador confirmando algo que o webhook já confirmou recebe
  `already_paid`, e nada acontece.

### D-6 — CPF/CNPJ guardado na pendência, com prazo declarado

- **Escolha**: gravar em `TrafegoPendingPurchase`, usar para emitir a cobrança e
  para reusar o customer. **Não** copiar para `TrafegoOrder`.
- **Alternativas descartadas**: não guardar e sempre reconsultar o Asaas (perde o
  reuso de customer e vaza a dependência para dentro do checkout); copiar para o
  pedido (espalha dado pessoal sem necessidade funcional).
- **Consequência**: o dado tem um lugar só. O prazo de retenção e quem pode ler
  precisam ser decididos **na revisão desta spec**, não depois.

### D-7 — Ack rápido, processamento assíncrono, e alarme na fila

- **Escolha**: validar o token, enfileirar via Inngest, responder `200`.
- **Alternativas descartadas**: processar tudo dentro do request. Descartada por
  causa da regra das 15 falhas: um pico de latência do nosso lado interromperia a
  fila inteira do Asaas, e o sintoma apareceria como "o PIX parou de confirmar",
  dias depois.
- **Consequência**: precisa de visibilidade. Pendência PIX `PENDING` há mais de X
  horas **com cobrança Asaas criada** é sinal de fila interrompida, e deve virar
  notificação para os admins.

### D-8 — Recuperação agendada por pedido, não varredura por tempo

- **Escolha**: ao criar a cobrança, agendar um acompanhamento dela; e reusar o
  cron horário que já existia como rede.
- **Alternativas descartadas**: um cron novo de 10 em 10 minutos. Descartada por
  custo e por forma: varredura de tempo executa igual com zero ou com mil
  vendas, e é a única parte do sistema cujo custo não tem relação com o negócio.
  Também descartado `step.waitForEvent` esperando o evento do próprio webhook —
  é mais elegante, mas verifica contra um evento **nosso**, e a falha que se
  quer cobrir é justamente o evento não existir. Conferir na API prova o fato.
- **Consequência**: um run por cobrança, quase todos encerrando no primeiro
  checkpoint. `step.sleep` não consome compute enquanto dorme nem ocupa
  concorrência. No plano gratuito o teto de sleep é 7 dias — o nosso maior
  checkpoint é 48h.

### D-10 — Credenciais no ambiente, não no banco

- **Escolha**: as três variáveis `ASAAS_*` vivem no `.env`. O
  `PaymentGatewayConfig` continua servindo só a recarga de Stars.
- **Alternativas descartadas**: reusar o `PaymentGatewayConfig`, que já tem
  interface pronta em `/admin/payments` — foi o desenho da primeira versão desta
  spec. Descartada por decisão do dono, e a evidência apareceu durante o setup
  local: o banco de desenvolvimento guardava uma chave `sk_live_` do Stripe
  cadastrada meses antes, com `environment: production`. Credencial em linha
  editável pela interface é credencial que ninguém audita, e o **ambiente** dela
  vira um campo que alguém troca sem querer. No `.env`, dev e produção são
  arquivos diferentes por construção.
- **Consequência**: trocar chave passa a exigir deploy, e não mais um clique.
  É o preço — e, para credencial que move dinheiro, é o lado certo do trade.
  Some também a UI de configuração: não há tela a manter.

### D-9 — A saída manual não pode morar na mesma fila

- **Escolha**: "Reconciliar PIX agora" é procedure oRPC, roda no request.
- **Alternativas descartadas**: um botão que dispara evento Inngest. Descartada
  porque o cenário que ele existe para atender é exatamente o Inngest estar
  fora — um botão que enfileira não serve de nada nessa hora.
- **Consequência**: a chamada pode demorar alguns segundos com muitas cobranças
  abertas. Aceitável: é operação manual, não caminho de cliente.

## 7. Impacto

- [x] Schema / migration (`prisma/schema.prisma`)
- [x] Procedures oRPC (contrato de entrada/saída)
- [ ] Realtime (Pusher / event-bus)
- [x] Automações (Inngest)
- [x] Env vars novas
- [ ] Breaking change para clientes existentes
- [x] Documentação obrigatória

### Schema — **precisa de aprovação antes do código**

Quatro campos aditivos em `TrafegoPendingPurchase`, todos opcionais:

| Campo | Tipo | Por que é necessário |
| --- | --- | --- |
| `asaasPaymentId` | `String? @unique` | Conciliação e chave de idempotência. Sem ele não dá para ligar evento a pendência com segurança |
| `asaasCustomerId` | `String?` | Evita recriar customer a cada compra (CA-14) |
| `payerDocument` | `String?` | O CPF/CNPJ. Exigido pela API do Asaas (D-1) |
| `pixQrCodePayload` | `String?` | Copia-e-cola, para reexibir a tela sem nova chamada. **Opcional** — se preferir migration menor, sai, ao custo de um `GET` por reload |

A migration é aditiva e reversível (drop das colunas). Rodar com
`pnpm db:migrate`, seguido do ritual do item 11 do CLAUDE.md.

### Configuração — três variáveis novas

| Variável | Papel | Ausente significa |
| --- | --- | --- |
| `ASAAS_API_KEY` | Chave da API | PIX volta ao fluxo manual |
| `ASAAS_ENV` | `sandbox` (padrão) ou `production` | Sandbox — errar para esse lado não move dinheiro |
| `ASAAS_WEBHOOK_TOKEN` | Header `asaas-access-token` | Webhook recusa **todos** os eventos |

Documentadas no CLAUDE.md. O `PaymentGatewayConfig` **não** é usado pelo trafeGO
— ele continua servindo só a recarga de Stars (ver D-10).

### Correção carona

`src/lib/asaas.ts:15` — sandbox passa para `https://api-sandbox.asaas.com/v3`, e
`findOrCreateCustomer` passa a exigir `cpfCnpj`. Isso **muda a assinatura** de
uma função que o fluxo de Stars usa; o ajuste lá entra no mesmo PR.

### Documentação

[`docs/trafego-overview.md`](../../docs/trafego-overview.md) descreve o PIX como
manual, e a linha 50 diz "Asaas não valida assinatura". Precisa ser atualizada no
mesmo PR.

## 8. Plano de testes

Não há runner instalado (deriva conhecida, item 20 do CLAUDE.md), então os
critérios são verificados **manualmente em sandbox**, com o roteiro registrado no
PR. O sandbox do Asaas permite simular o pagamento de um QR.

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1, CA-2, CA-14 | manual (sandbox) | Checkout PIX com CPF de teste; conferir cobrança e customer no painel |
| CA-3, CA-4 | manual (`curl`) | POST sem header e com header errado; esperar `401` nos dois |
| CA-5 | manual (sandbox) | Pagar o QR no sandbox; pendência vira `PAID` e o e-mail de ativação sai |
| CA-6 | manual (`curl`) | Reenviar o mesmo payload; conferir que não há segundo pedido nem segundo `PaymentEntry` |
| CA-7 | manual (`curl`) | Payload com `value` adulterado; o valor gravado tem de ser o da API |
| CA-8 | manual (sandbox) | Pagamento parcial; conferir `amountMismatch = true` |
| CA-9 | manual (`curl`) | `externalReference` inexistente; esperar `200` |
| CA-10 | manual | Confirmar no cartão e depois disparar o evento PIX; conferir a notificação de duplicidade |
| CA-11, CA-12 | manual (`curl`) | Disparar `PAYMENT_OVERDUE` e `PAYMENT_REFUNDED` com token válido |
| CA-13 | manual | Desativar o gateway; checkout PIX volta à chave estática |

## 9. Riscos e rollback

| Risco | Mitigação |
| --- | --- |
| Fila do webhook interrompida sem ninguém notar | Alarme de D-7 + "Confirmar PIX" manual como saída (D-5) |
| Cobrança criada e cliente nunca paga | Vence sozinha pelo `dueDate` no Asaas, e a pendência já era expirada pelo cron horário. `PAYMENT_OVERDUE` (RF-13) só torna o sinal autoritativo |
| Queda de conversão pelo campo de CPF | O campo só aparece na trilha PIX (D-1). Medir antes/depois no PostHog, que já instrumenta `trafego_checkout_started` |
| Credencial do Asaas vazada | `authToken` separado da API key (RNF-2); rotação pelo `/admin/payments`, sem deploy |
| Dinheiro confirmado por evento forjado | Token fail-closed (RF-6) **e** valor relido da API (RF-7). As duas barreiras são independentes |

**Rollback**: desativar o gateway Asaas em `/admin/payments`. O checkout volta ao
PIX manual (RF-15 / CA-13) sem deploy e sem migration reversa. As cobranças já
abertas continuam confirmáveis pelo botão manual. Se for preciso reverter o
schema, o drop das quatro colunas não afeta nenhum fluxo anterior.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-18 | João Gabriel | Criada. Fatos da API do Asaas apurados na documentação oficial antes do desenho; D-1 decidido pelo dono (cobrança nominal, com CPF só na trilha PIX) |
| 2026-09-18 | João Gabriel | Credenciais movidas do `PaymentGatewayConfig` para o `.env` (RF-12, RF-20, D-10), por decisão do dono. A UI de `/admin/payments` volta a servir só a recarga de Stars |
| 2026-09-18 | João Gabriel | Recuperação de falha do webhook (RF-16..RF-19, D-8, D-9). O desenho inicial era um cron de 10 minutos; recusado pelo dono por custo no Inngest, e trocado por acompanhamento agendado por cobrança mais o cron horário que já existia — nenhum cron novo |
| 2026-09-18 | João Gabriel | Implementada no mesmo PR. Divergência registrada: `pixAvailable` passou a considerar o gateway Asaas, porque com cobrança nominal a chave estática deixa de ser obrigatória; e `MarkPurchasePaidInput.pix.confirmedByUserId` virou anulável, para o webhook gravar `pixConfirmedAt` sem operador |
| 2026-09-18 | João Gabriel | Correção de fato no §1: a expiração de PIX **existe**, pelo cron `trafego-pix-pending-sweep`. A primeira versão afirmava que nada expirava. RF-13 e a tabela de riscos foram reescritos em cima disso |
