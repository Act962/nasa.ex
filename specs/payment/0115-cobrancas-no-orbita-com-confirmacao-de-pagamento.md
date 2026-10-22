---
id: 0115
titulo: Cobranças dentro do ÓRBITA, com confirmação do pagamento por várias fontes
dominio: payment
status: em-revisao
autor: João Gabriel
criada: 2026-10-22
atualizada: 2026-10-22
branch: # definir no /start (ex.: feature/payment-cobrancas-20261022)
pr:
peso: completa
---

# 0115 — Cobranças dentro do ÓRBITA, com confirmação do pagamento por várias fontes

## 1. Contexto

Hoje cobramos nossos próprios clientes fora da plataforma: o PIX ou o boleto sai
do banco, o aviso é mandado à mão no WhatsApp e a baixa no financeiro é digitada
depois. Atrasos passam despercebidos e quem já pagou às vezes recebe cobrança. A
mesma dor aparece em outras empresas que vendem serviço recorrente pelo ÓRBITA.

A cobrança deve **morar no ÓRBITA**: criar, mandar, acompanhar e saber se foi
paga, tudo aqui. Um gateway (Asaas) entra só como **uma das formas de confirmar**
que o dinheiro chegou, não como lugar onde a cobrança é criada. Empresa sem
gateway nenhum usa o mesmo fluxo e confirma pelo extrato, pelo comprovante ou à
mão — e, em qualquer caso, os avisos param assim que a conta é dada como paga.

O que já existe e será reaproveitado:

| Já existe | Onde |
| --- | --- |
| Conta a receber com status, parcelas e vínculo com lead/funil | `PaymentEntry` |
| Lead ganho vira conta a receber | spec 0074 |
| Régua de cobrança por e-mail/WhatsApp, agendada por evento, que **já pula conta paga** antes de enviar | `dunning/schedule.ts`, `inngest/functions/payment/dunning-fire.ts` |
| Marcação diária de vencidos | `crons/mark-overdue-receivables.ts` |
| PIX "copia e cola" gerado **sem gateway**, com a chave da empresa | `form-records/lib/pix-br-code.ts` (fichas, spec 0075) |
| Conciliação: movimentos do banco (OFX, PDF, e-mail) casados com contas a receber, com sugestão e idempotência por `externalId` | `PaymentBankTransaction`, `statements/suggest-matches.ts`, `reconcile-transaction.ts` (specs 0013, 0016, 0018) |
| Leitura de comprovante por IA | `PaymentBankTransaction.reviewResult`; preset `comprovante-pagamento` |
| Asaas por empresa com chave cifrada e webhook com token | Catálogo online: `NerpCatalogIntegration`, `api/integrations/nerp/asaas-webhook/[orgId]` |
| Gatilho "Pagamento recebido" | evento `agent-workflow/payment-received` |
| WhatsApp da empresa com template da Meta fora da janela de 24h | `accounting/server/alerts/send-compliance-whatsapp.ts` |

O que falta:

1. A conta a receber não tem um link para o cliente pagar nem um PIX próprio.
2. Não existe um caminho único de "pagamento confirmado": a baixa manual, a conciliação e o webhook do Catálogo fazem cada um a sua.
3. O webhook do Asaas só entende pedido do Catálogo; um PIX recebido na conta Asaas não chega ao financeiro.
4. Nada gera a cobrança do mês seguinte (o campo "recorrente" é só um rótulo).
5. A régua não manda link nem PIX, ignora o telefone do lead, manda WhatsApp só por uazapi e não tem limite de frequência.
6. Não há gatilho "cobrança vencida".

**Verificado na documentação do Asaas** (2026-10-22): PIX recebido pela chave da
conta ou por QR Code estático gera automaticamente uma cobrança no Asaas e o
evento `PAYMENT_RECEIVED`. É isso que permite confirmar um PIX que o ÓRBITA
gerou, sem criar a cobrança lá antes. **Não verificado**: se o webhook devolve o
identificador (`txid`) que colocamos no PIX — ver P-1.

## 2. Objetivo

A empresa cria e acompanha cobranças no ÓRBITA, o cliente paga por um PIX gerado
aqui, e a conta a receber é dada como paga por qualquer fonte de confirmação
(Asaas, extrato, comprovante conferido ou manual), parando a régua na hora.

### Dois modos, o mesmo fluxo

A integração com o banco é **opcional**. A cobrança, a página, a régua, a janela
de avisos e os gatilhos são iguais nos dois modos; muda só **quem confirma** o
pagamento.

| | Sem integração (padrão) | Com integração bancária (opcional) |
| --- | --- | --- |
| Onde a cobrança é criada e acompanhada | ÓRBITA | ÓRBITA |
| Como o cliente paga | PIX gerado no ÓRBITA com a chave da empresa | O mesmo PIX, caindo na conta conectada |
| Quem confirma o pagamento | Pessoa: baixa manual, extrato importado ou comprovante conferido | O banco, sozinho, pelo webhook (RF-8) |
| Quando os avisos param | Na baixa, ou na hora em que chega um comprovante (pausa) | Segundos depois do pagamento |
| Pagamento que não casa com nenhuma conta | — | Fica "a identificar" para um clique |

Começa com o Asaas como primeiro banco conectável; outros entram como nova
origem de movimento (D-2), sem mudar o resto.

### Não-objetivos

- **Criar cobranças no gateway.** Nenhuma cobrança é criada pela API do Asaas no v1.
- **Boleto e cartão.** Só existem registrados num banco ou processador, ou seja, criando a cobrança lá. Fase 2, opcional por empresa (ver D-4).
- **Plataforma como banco** (subcontas, custódia).
- **Stripe**, **nota fiscal (NFS-e)** e **migrar o Forge**: specs próprias.
- **Tags mensais que zeram** e status como coluna do funil de vendas (ver D-7).
- **Taxa do gateway** como despesa automática.
- **Juros e multa** sobre PIX vencido.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | **Conta de recebimento**: uma conta bancária do financeiro (`PaymentBankAccount`) pode ter chave PIX, nome e cidade do recebedor. A marcada como padrão de cobranças é a usada no PIX. Sem nenhuma, vale a chave PIX já salva no Forge (fallback, ver D-3). |
| RF-2 | **Conexão do Asaas como fonte de confirmação** (em Satélites): a empresa liga uma conta bancária do financeiro à conta Asaas dela informando chave de API e ambiente. A chave é validada, guardada cifrada, e o webhook é registrado. Nenhuma cobrança é criada pela API. |
| RF-3 | A conexão do Asaas do Catálogo online passa a viver na conta bancária: a migration copia as chaves já salvas, e o Catálogo continua funcionando sem ação da empresa. |
| RF-4 | **Cobrança**: toda conta a receber pendente ou vencida tem um link público (`/cobranca/<token>`) com empresa, descrição, valor, vencimento, situação e o PIX (QR Code e copia e cola) com valor e identificador únicos da conta. Paga, a página mostra "Pago em …". |
| RF-5 | **Confirmação única**: toda fonte chama a mesma função (`confirmReceivablePayment`), que baixa a conta (pago ou parcial), grava de onde veio a confirmação (`MANUAL`, `STATEMENT`, `GATEWAY`, `RECEIPT_REVIEWED`), encerra a régua e dispara `agent-workflow/payment-received` com o `leadId`. |
| RF-6 | **Fonte manual**: "Marcar como pago" (já existe) passa pela função única; comprovante opcional. |
| RF-7 | **Fonte extrato**: ao conciliar um movimento (OFX, PDF, e-mail) com uma conta a receber, a baixa passa pela função única. |
| RF-8 | **Fonte Asaas**: cada `PAYMENT_RECEIVED` da conta Asaas vira um movimento de conciliação (origem `GATEWAY_WEBHOOK`, `externalId` = id do pagamento no Asaas). Casamento automático, nesta ordem: (1) identificador da conta, se o Asaas o devolver; (2) uma única conta em aberto da empresa com o mesmo valor e o mesmo CPF/CNPJ do pagador; (3) senão, o movimento fica na conciliação como "a identificar", com as sugestões de hoje, para um clique. |
| RF-9 | **Fonte comprovante**: comprovante recebido pelo WhatsApp e lido pelo Astro **pausa a régua** e cria uma pendência "comprovante a conferir" na conta a receber. Uma pessoa confirma (vira baixa `RECEIPT_REVIEWED`) ou recusa (régua retoma). Comprovante nunca dá baixa sozinho (ver D-5). |
| RF-10 | **Recorrência**: a empresa define valor, dia de vencimento, régua e lead/contato. A plataforma cria a conta a receber de cada mês com antecedência configurável (padrão 10 dias) e agenda a régua. Pode pausar, mudar o valor (vale para as próximas) e encerrar. |
| RF-11 | **Régua**: variáveis `{{link_pagamento}}` (página da RF-4), `{{pix_copia_e_cola}}` e `{{outras_pendencias}}`. Textos padrão usam o link. |
| RF-12 | **Destinatário**: contato do financeiro; sem e-mail ou telefone, os do lead. Sem nenhum para o canal do passo, falha "sem contato" e entra em pendências (RF-16). |
| RF-13 | **WhatsApp** sai pelo número da empresa: em número oficial, com o template aprovado configurado no passo (parâmetros: nome, valor, vencimento, link); em não oficial, o texto do passo. |
| RF-14 | **Pausa manual** da régua de uma conta a receber, com retomada. |
| RF-15 | **Gatilho "Cobrança vencida"** nos Gatilhos Automáticos e modelos prontos "Confirmação de pagamento" e "Marcar inadimplente". |
| RF-16 | **Visão "Cobranças"** no financeiro: em aberto, vencidas, comprovantes a conferir, pagamentos do Asaas a identificar, clientes sem contato, e quanto foi recuperado no mês depois de algum aviso. |
| RF-17 | **Card do lead**: campo "Cobrança" com próximo vencimento e situação (em dia / vence hoje / atrasado há N dias / comprovante em conferência). Entra em `CARD_FIELDS` (regra 16). |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Nenhum cron novo. Régua e recorrência são eventos agendados; o Asaas chega por webhook. Estimativa: 500 cobranças/mês × 8 passos + 500 gerações ≈ 4.500 execuções/mês (~150/dia); 10x ≈ 1.500/dia. |
| RNF-2 | No máximo um aviso de régua por destinatário por dia, somando todas as cobranças dele. |
| RNF-3 | Avisos só entre 8h e 20h (Brasília); o que cair fora sai às 9h seguintes. |
| RNF-4 | O editor da régua impede mais de 10 passos e intervalos menores que 2 dias depois do vencimento. |
| RNF-5 | Webhook idempotente pelo id do pagamento no Asaas; responde 200 para eventos que não são nossos. |
| RNF-6 | Toda query nova filtra por `organizationId`. O webhook confere o token da conta bancária da URL e só toca dados dessa empresa. A página pública só aceita o token (aleatório, ≥ 128 bits) e não expõe CPF, e-mail nem telefone. |
| RNF-7 | O campo do card é calculado para todos os leads da página do board numa consulta só. |
| RNF-8 | Sem rede dentro de `$transaction` (regra 18): baixa grava no banco; evento e mensagens saem depois do commit. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dada uma conta bancária com chave PIX marcada como padrão, quando a página `/cobranca/<token>` de uma conta a receber abre, então mostra valor, vencimento e um PIX válido com o valor da conta.
- [ ] **CA-2** — Dada uma conta a receber paga, quando a página abre, então mostra "Pago em …" e nenhum PIX.
- [ ] **CA-3** — Dado um Asaas sandbox, quando a empresa conecta a chave numa conta bancária, então a conexão mostra os 4 últimos dígitos, o webhook existe no Asaas e nenhuma cobrança foi criada lá.
- [ ] **CA-4** — Dada uma empresa com Asaas no Catálogo, quando a migration roda, então o PIX do Catálogo continua sendo gerado e baixado.
- [ ] **CA-5** — Dado um PIX do ÓRBITA pago na chave da conta Asaas, com o CPF do contato e o valor exato de uma única conta em aberto, quando o webhook chega, então a conta fica paga com origem `GATEWAY` e o evento de pagamento recebido é disparado.
- [ ] **CA-6** — Dado um PIX recebido no Asaas que casa com duas contas (mesmo valor e pagador), então nenhuma é baixada e o movimento aparece como "a identificar" com as duas sugestões.
- [ ] **CA-7** — Dado o mesmo webhook entregue duas vezes, então a segunda não cria movimento nem baixa de novo.
- [ ] **CA-8** — Dado um webhook com token errado, então 401 e nada muda.
- [ ] **CA-9** — Dado um extrato OFX importado com o recebimento, quando o movimento é conciliado com a conta, então ela fica paga com origem `STATEMENT` e a régua para.
- [ ] **CA-10** — Dada uma empresa sem Asaas, quando alguém clica "Marcar como pago", então a conta fica paga com origem `MANUAL` e nenhum aviso agendado sai depois.
- [ ] **CA-11** — Dado um comprovante lido pelo Astro, então a régua pausa, a conta mostra "comprovante a conferir" e continua em aberto até alguém confirmar.
- [ ] **CA-12** — Dado um comprovante recusado, então a régua retoma nos passos seguintes.
- [ ] **CA-13** — Dado um passo com `{{link_pagamento}}`, então a mensagem leva o link da página da cobrança.
- [ ] **CA-14** — Dado contato sem telefone e lead com telefone, então o WhatsApp vai para o telefone do lead.
- [ ] **CA-15** — Dado número oficial com template no passo, fora da janela de 24h, então sai o template com nome, valor, vencimento e link.
- [ ] **CA-16** — Dado um cliente com duas cobranças com passo no mesmo dia, então ele recebe um aviso só.
- [ ] **CA-17** — Dado um passo agendado para 22h, então ele sai às 9h do dia seguinte.
- [ ] **CA-18** — Dada uma recorrência com vencimento dia 10 e antecedência de 10 dias, então no dia 1º existe a conta a receber do dia 10 com a régua agendada; pausada, nada é gerado.
- [ ] **CA-19** — Dada uma conta que vence hoje sem pagamento, quando o robô diário a marca como vencida, então o gatilho "Cobrança vencida" dispara para o lead.
- [ ] **CA-20** — Dado um lead com cobrança em aberto, então o card mostra vencimento e situação; desligando "Cobrança" no "Personalizar board", some.
- [ ] **CA-21** — Dado um id de outra empresa, enviado a qualquer procedure nova, ao webhook ou à página pública, então nada é lido nem alterado.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Cliente paga e o webhook atrasa; um passo cai no intervalo | O guard do envio já checa o status. Sem gateway não há como saber antes; é o motivo do teto de 1 aviso/dia e do texto "se já pagou, desconsidere". |
| CB-2 | Cliente paga de outra conta (cônjuge, empresa) — CPF diferente | Não casa sozinho; fica "a identificar" com sugestão por valor. |
| CB-3 | Cliente paga valor diferente (arredondou, juntou dois meses) | Não casa sozinho; "a identificar". Na conciliação manual, um movimento pode baixar uma conta como parcial (já suportado). |
| CB-4 | PIX recebido no Asaas que não é de cobrança (venda avulsa, Catálogo) | Pedido do Catálogo segue o fluxo do Catálogo (pelo `externalReference`); o resto vira movimento "a identificar" e pode ser ignorado com motivo (já suportado). |
| CB-5 | Estorno no Asaas (`PAYMENT_REFUNDED`) de algo já baixado | A conta volta para pendente/vencida com nota; a equipe é avisada; a régua não recomeça sozinha. |
| CB-6 | Comprovante falso ou de outro valor | Nunca baixa sozinho (RF-9). Na conferência, o resultado da leitura do Astro (pagador × valor × data) aparece ao lado. |
| CB-7 | Comprovante chega e ninguém confere | A pendência aparece em "Cobranças" e no card; depois de 3 dias sem conferência, a equipe é avisada (sino). A régua continua pausada. |
| CB-8 | Baixa manual de conta que também recebe o PIX depois | O webhook não acha conta em aberto; o movimento fica "a identificar" — sinal de pagamento em dobro para a equipe devolver. |
| CB-9 | Valor ou vencimento editados | O PIX da página é sempre gerado na hora com o valor atual; a régua é reagendada (já suportado). |
| CB-10 | Conta sem contato nem lead | Página funciona; régua não tem destinatário e aparece em pendências. |
| CB-11 | Empresa sem chave PIX em lugar nenhum | Página mostra os dados da cobrança e "fale com a empresa para pagar"; `{{pix_copia_e_cola}}` sai vazio; a tela de Cobranças avisa que falta a chave. |
| CB-12 | Empresa troca a conta Asaas | Webhook novo registrado; o antigo deixa de ser aceito. Pagamentos que caírem na conta antiga chegam só pelo extrato. |
| CB-13 | Número da empresa desconectado no passo | Falha "sem WhatsApp conectado", sem insistir além do retry padrão. |
| CB-14 | Número oficial sem template no passo | Tenta texto; se a Meta recusar, falha com motivo. A tela da régua alerta antes. |
| CB-15 | Recorrência com dia 31 em mês curto | Último dia do mês. |
| CB-16 | Recorrência criada com primeiro vencimento já passado | Só gera a partir do próximo vencimento futuro. |
| CB-17 | Evento de geração entregue duas vezes | Uma conta só por (recorrência, vencimento): restrição única. |
| CB-18 | Lead apagado com recorrência ativa | Recorrência encerrada; contas existentes ficam. |
| CB-19 | Mês novo com o anterior em aberto | Duas contas; um aviso por dia (RNF-2); `{{outras_pendencias}}` cita o total em aberto. |
| CB-20 | Token da página adivinhado ou vazado | Token aleatório, sem dado pessoal na página; só mostra o que já está na mensagem enviada ao cliente. |

## 6. Decisões de design

### D-1 — Cobrança é a conta a receber; nada de tabela "Cobrança"

- **Escolha**: colunas novas em `PaymentEntry`: `chargeToken` (único), `pixTxid` (único por empresa), `paidVia` (enum `PaymentConfirmationSource`), `receiptReviewPendingAt`, `dunningPausedAt`, `recurrenceId`.
- **Alternativa descartada**: tabela `Charge` 1:N. Duas fontes de verdade para o mesmo dinheiro, e a contabilidade (derivada do `PaymentEntry`, regra 23) teria de olhar as duas.

### D-2 — Pagamento recebido entra pela conciliação que já existe

- **Escolha**: o webhook do Asaas cria um `PaymentBankTransaction` (origem nova `GATEWAY_WEBHOOK`) e usa o casamento da conciliação, agora com casamento automático quando há um candidato único (RF-8). A baixa final passa por `confirmReceivablePayment`.
- **Alternativas descartadas**: (a) tabela nova de "pagamentos recebidos" — é exatamente o que `PaymentBankTransaction` já é, com idempotência, pagador, documento e tela de "a identificar"; (b) baixar direto no webhook sem registrar o movimento — perderia o PIX que não casou com nada.
- **Consequência**: Asaas, OFX, PDF e e-mail viram a mesma coisa para o financeiro: movimentos do banco. Um banco novo no futuro é só mais uma origem.

### D-3 — Chave PIX e conexão do Asaas moram na conta bancária

- **Escolha**: colunas em `PaymentBankAccount`: `pixKey`, `pixReceiverName`, `pixReceiverCity`, `isDefaultForCharges`, `provider` (enum: `NONE`, `ASAAS`), `providerApiKey` (cifrada), `providerApiKeyLast4`, `providerEnv`, `providerWebhookId`, `providerWebhookToken`. Webhook por conta: `api/payment/bank-webhook/[accountId]`; a rota antiga do Catálogo usa o mesmo handler.
- **Alternativas descartadas**: (a) tabela nova de conexão — a conta Asaas **é** uma conta bancária (tem saldo e extrato), e o movimento recebido precisa de `accountId` de qualquer jeito; (b) continuar em `NerpCatalogIntegration` (dono errado) ou no `Json` do Forge (dado validado em `Json`, regra S3).
- **Consequência**: a migration cria, para cada empresa com Asaas no Catálogo, uma conta bancária "Asaas" com as chaves copiadas (já cifradas). O Catálogo lê da conta; as colunas antigas saem depois do deploy (S9). As fichas continuam lendo a chave PIX do Forge e servem de fallback para a cobrança; juntar as duas é dívida registrada (§9).

### D-4 — Só PIX no v1; boleto e cartão ficam para a fase 2

- **Escolha**: o v1 gera apenas PIX, aqui dentro.
- **Por quê**: PIX é o único meio que pode ser gerado sem banco intermediário (o copia e cola é montado com a chave da empresa). Boleto precisa ser registrado num banco; cartão precisa de um processador. Os dois obrigam a criar a cobrança no gateway, que é o oposto do que se quer.
- **Fase 2**: empresa que quiser boleto ou cartão liga isso na conexão do Asaas; a cobrança continua aparecendo e sendo acompanhada no ÓRBITA, e só o boleto/cartão é emitido lá.

### D-5 — Comprovante pausa, não baixa

- **Escolha**: comprovante lido pela IA pausa a régua e pede conferência humana.
- **Por quê**: comprovante falso é golpe comum, e a IA confirma que o papel diz o valor certo, não que o dinheiro chegou. Baixa automática só vem de fonte bancária (Asaas ou extrato).
- **Consequência**: o cliente que mandou comprovante para de receber aviso na hora, que é o que mais importa para ele.

### D-6 — Recorrência como molde próprio, gerada por evento agendado

- **Escolha**: model `PaymentRecurrence` (`organizationId`, contato/lead, descrição, valor, dia de vencimento, régua, antecedência, status ACTIVE/PAUSED/ENDED, `endsAt`, próximo vencimento). Cada geração cria a conta a receber, agenda a régua e agenda a próxima geração (`payment/recurrence.generate`). Único (`recurrenceId`, `dueDate`) em `PaymentEntry`.
- **Alternativas descartadas**: (a) clonar a última conta usando `isRecurring/recurrenceType` — não há onde guardar "pausada" ou "valor novo a partir de"; (b) cron diário procurando o que gerar — o padrão mais caro (S11); (c) assinatura no gateway — contraria a decisão de manter a cobrança aqui; (d) `ForgeContract` como molde — contrato é documento, nem toda empresa usa o Forge.
- **Consequência**: `isRecurring/recurrenceType` ficam sem uso; remover depois (S9).

### D-7 — Status mora na conta a receber; tags e funil são efeitos opcionais

- **Escolha**: a situação vem de `FinancialEntryStatus` + pausa/conferência. Tags e mudança de etapa saem de fluxos ligados a "Pagamento recebido" e "Cobrança vencida".
- **Alternativa descartada**: tags mensais que zeram e colunas Aberto/Atrasado/Pago no funil. Um cliente com setembro atrasado e outubro pago não cabe numa tag; o reset mensal exige cron e apaga histórico; "Cobrança 1, 2, 3" já é registrado por `PaymentDunningExecution`.

### D-8 — O número das cobranças é o de um tracking escolhido nas configurações

Cada número de WhatsApp pertence a um tracking (`WhatsAppInstance.trackingId` é único), então escolher o tracking é escolher o número — e a resposta do cliente cai no chat daquele tracking, com as automações e o atendimento que ele já tem. A escolha mora em `PaymentGovernanceConfig.messagingTrackingId` (a configuração do financeiro, uma por empresa; `onDelete: SetNull`), sem tabela nova. A régua, os lembretes do financeiro, os avisos fiscais da aba Contábil e o aviso do Astro ao agendar lembrete usam esse número. Sem escolha, vale o comportamento antigo (número conectado mais antigo, QR code antes do oficial). Com escolha e o número desconectado, o envio **falha** com `sender_tracking_not_connected` em vez de trocar para outro número: o cliente não recebe cobrança de um número que não conhece.

### Perguntas em aberto

- **P-1** — O webhook do Asaas devolve o `txid` que colocamos no PIX estático? Testar no sandbox **antes** do código. Se sim, o casamento automático fica quase total; se não, depende de valor + CPF (RF-8, passo 2) e mais pagamentos caem em "a identificar".
- **P-2** — Gerar a página e o PIX para toda conta a receber, ou só quando a empresa clicar "Cobrar"? Proposta: toda conta a receber tem link; a régua só roda se tiver régua atribuída (como hoje).
- **P-3** — Taxa do Asaas como despesa ao baixar? Proposta: não no v1.
- **P-4** — Conta de vinculado com cobrança própria (spec 0076): `PaymentEntry` não guarda o vinculado, então o pagador cairia no titular. Conferir se o fechamento preenche o contato com os dados do vinculado.

## 7. Impacto

- [x] Schema / migration — colunas em `PaymentEntry`, `PaymentBankAccount` e `PaymentDunningStep` (`whatsappTemplateName`); model `PaymentRecurrence`; enums `PaymentConfirmationSource`, `PaymentBankProvider`, `PaymentRecurrenceStatus`; valor `GATEWAY_WEBHOOK` em `PaymentBankTxSource`; valor `PAYMENT_OVERDUE` em `NodeType`; cópia das chaves do Catálogo.
- [x] Procedures oRPC — conexão do Asaas na conta bancária, recorrências, pausa/retomada da régua, conferência de comprovante, resumo de cobrança no board; rota pública da página de cobrança.
- [ ] Realtime
- [x] Automações (Inngest) — **função nova**: `payment-recurrence-generate` (por evento, ~1 por recorrência/mês). Alteradas: `payment-dunning-fire`, `mark-overdue-receivables` (dispara o gatilho em lote). Nenhum cron novo.
- [ ] Env vars novas — nenhuma.
- [ ] Breaking change — não.
- [x] Documentação — `docs/nerp-catalog-orbita.md`, `CARD_FIELDS` (regra 16), guias do Astro para "Conectar Asaas" e "Conferir comprovante" (regra 21).

## 8. Plano de testes

Sem runner de teste no projeto ainda (regra 20): roteiro manual em sandbox do Asaas por CA; viram testes com o id no nome quando o runner existir.

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| P-1 | manual (sandbox), **antes do código** | Pagar um PIX estático com `txid` na conta sandbox e ler o payload do webhook |
| CA-1, CA-2 | manual | Abrir a página; pagar o PIX num app de banco de teste ou validar o copia e cola num leitor |
| CA-3, CA-4 | manual (sandbox) | Conectar; migration numa cópia do banco com Catálogo configurado |
| CA-5 a CA-8 | manual / automatizado (futuro) | Pagar no sandbox; reenviar payload com curl; token errado |
| CA-9, CA-10 | manual | Importar OFX; marcar como pago; conferir execuções puladas |
| CA-11, CA-12 | manual | Enviar comprovante no WhatsApp de teste |
| CA-13 a CA-17 | manual | Régua com passos curtos; conferir `PaymentDunningExecution` |
| CA-18, CA-19 | manual | Recorrência com antecedência curta; rodar o cron de vencidos em dev |
| CA-20, CA-21 | manual / automatizado (futuro) | Board; ids de outra org nas procedures, webhook e página |

## 9. Riscos e rollback

- **Credencial do Catálogo, que já move dinheiro.** A migration só copia; a leitura nova cai nas colunas antigas se a conta bancária não existir, até a migration de limpeza. Rollback: reverter o deploy.
- **Pagamento que não casa sozinho** (CPF diferente, valor diferente, P-1 negativo). Cai em "a identificar" — trabalho manual, nunca baixa errada.
- **Aviso para quem já pagou** em empresa sem Asaas (o extrato chega com atraso). Mitigação: teto diário, horário comercial, texto "se já pagou, desconsidere", pausa ao receber comprovante.
- **Bloqueio do número de WhatsApp** por denúncia. Mitigação: limites e template de utilidade.
- **Duas chaves PIX configuradas** (conta bancária e Forge). Dívida assumida: fallback no v1; juntar numa etapa seguinte.
- **Receita bruta sem taxa do gateway.** Dívida conhecida (P-3).
- **Migration reversível**: só adiciona colunas, tabela e valores de enum; a cópia das chaves é `INSERT`.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-22 | João Gabriel | Criada |
| 2026-10-22 | João Gabriel | Cobrança passa a morar no ÓRBITA: o Asaas vira só fonte de confirmação, PIX gerado aqui, baixa por extrato/comprovante/manual, boleto e cartão para a fase 2. |
| 2026-10-22 | João Gabriel | **Etapa 1 implementada, sem migration** (branch `feature/payment-cobrancas-recorrentes-20261022`): RF-4 (página `/cobranca/<token>` com PIX), RF-11, RF-12, RNF-2 e RNF-3, e "Link de pagamento" no menu da conta a receber. Divergências desta etapa: (a) o token é **assinado** (HMAC, `lib/charge-link.ts`) em vez da coluna `chargeToken` de D-1 — sem coluna, sem migration; (b) o `txid` do PIX é o próprio id do lançamento, dispensando `pixTxid`; (c) a chave PIX vem só de `ForgeSettings.paymentGatewayConfigs.PIX` (a mesma das Propostas e Fichas), a da conta bancária (RF-1, D-3) entra com a conexão dos bancos; (d) cobrança com número fixo de meses (ex.: 10× R$ 600 dia 22) usa o **parcelamento que já existe**; `PaymentRecurrence` (D-6) fica só para mensalidade sem fim. Pendentes: RF-1 a RF-3, RF-5 a RF-10, RF-13 (template da Meta por passo), RF-14 a RF-17. |
| 2026-10-22 | João Gabriel | **D-8**: escolha do tracking (número) que envia as cobranças nas Configurações do Financeiro. Migration `20261022150000_payment_messaging_tracking` (coluna `messaging_tracking_id` em `payment_governance_config`). Procedures `payment.messaging.getSender`/`setSender` (permissão `settings`). |
