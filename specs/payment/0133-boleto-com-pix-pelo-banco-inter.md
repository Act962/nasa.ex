---
id: 0133
titulo: Emitir boleto com PIX pelo banco conectado e dar baixa sozinho
dominio: payment
status: em-implementacao
autor: João Gabriel
criada: 2026-11-03
atualizada: 2026-11-03
branch: feature/payment-boleto-inter-20261103
pr:
peso: completa
---

# 0133 — Emitir boleto com PIX pelo banco conectado e dar baixa sozinho

## 1. Contexto

A spec 0130 ligou o Banco Inter às Cobranças: cada conta a receber ganha um PIX próprio do
banco e é baixada sozinha quando o cliente paga. Só PIX. Parte dos clientes das empresas
paga por **boleto**: empresa que lança no contas a pagar, quem prefere pagar no internet
banking, quem precisa do documento para o financeiro dela. Hoje esse cliente recebe só o
PIX e acaba pagando por fora (transferência, boleto avulso feito no app do banco), e a baixa
volta a ser manual.

O Inter tem a **API Cobrança V3** (lida em 2026-11-03 em developers.inter.co): um boleto que
traz também um QR Code PIX ("BolePix"). O cliente paga do jeito que quiser, e o Inter avisa
quando foi pago, por qualquer dos dois. O que a documentação diz e muda o desenho:

| Fato da API | Consequência |
| --- | --- |
| Emissão **assíncrona**: `POST /cobranca/v3/cobrancas` devolve só `codigoSolicitacao`; o boleto (linha digitável, código de barras, PIX) vem depois, pelo webhook ou por `GET /cobrancas/{codigoSolicitacao}` | A página e a régua precisam esperar alguns segundos ou mostrar "gerando boleto" |
| Pagador **exige** CPF/CNPJ, tipo de pessoa, nome, endereço, cidade, UF e CEP | Só o **lead** tem endereço no ÓRBITA (`Lead.address*`); `PaymentContact` não tem |
| `seuNumero` até **15 caracteres** | O id da conta a receber (25) não cabe; o casamento é pelo `codigoSolicitacao` guardado |
| Valor de **R$ 2,50** a R$ 99.999.999,99 | Conta abaixo de R$ 2,50 fica no PIX |
| `formasRecebimento`: `BOLETO`, `BOLETO + PIX` ou nenhuma; **não aceita só PIX** | PIX sozinho continua pela API PIX da 0130 |
| O PIX do boleto tem `txid` **gerado pelo Inter** | A baixa vem pelo **webhook de cobrança**, não pelo de PIX da 0130 (que ignora `txid` que não é `orb…`) |
| Multa (`PERCENTUAL`/`VALORFIXO`), mora (`TAXAMENSAL`/`VALORDIA`) e desconto por antecipação | Juros e multa passam a ser possíveis |
| Editar valor/vencimento (`PATCH`) é **assíncrono e leva até 30 min**; limite de 10 chamadas/min | Edição não é instantânea como no PIX |
| Cancelar: `POST /cobrancas/{id}/cancelar` com motivo (até 50 caracteres). **Assíncrono**: responde 202 na hora e o boleto só vira `CANCELADO` minutos depois (conferido em 2026-11-03) | Ao cancelar, o código do boleto continua guardado até o aviso de cancelado, para um pagamento que chegue antes ainda ser reconhecido |
| PDF: `GET /cobrancas/{id}/pdf` devolve o PDF em base64 | O boleto em PDF não precisa ser guardado: é buscado na hora |
| Webhook de cobrança é **por conta**, não por chave (`PUT /cobranca/v3/cobrancas/webhook`); avisa emitida, paga, cancelada, expirada; mesmas 4 tentativas | Um cadastro a mais ao conectar |
| Idempotência do Inter: `seuNumero` + valor + vencimento + CPF/CNPJ, por 30 min | Repetir a emissão logo em seguida não duplica |
| Escopos `boleto-cobranca.read` e `boleto-cobranca.write` | A integração da ORBITA HUB foi criada só com os escopos do PIX: precisa ganhar estes |

**O que já existe e será reaproveitado** (spec 0130):

| Já existe | Onde | Uso aqui |
| --- | --- | --- |
| Conexão do banco, segredos cifrados, token guardado | `PaymentBankConnection`, `bank-charges/connection-store.ts` | Mesma conexão, mesmo token |
| Porta `BankAdapter` e registro de bancos | `bank-charges/ports.ts`, `bank-adapters.ts` | Ganha a parte de boleto, opcional por banco |
| PIX do banco com reserva no estático | `bank-charges/charge-pix.ts` → `charge-details.ts` | Vira "cobrança no banco": boleto quando dá, PIX quando não |
| Sincronização do PIX com a conta (baixa parcial, edição, cancelamento) | `syncEntryBankPix` | Vale também para o boleto |
| Webhook do banco com token na URL | `api/payment/bank-webhook/[connectionId]/[token]` | Recebe também o aviso de cobrança |
| Função de baixa automática | `payment-bank-pix-received` (Inngest) | Ganha o evento do boleto; **nenhuma função nova** |
| Baixa como movimento bancário `BANK_API` | `settle-bank-pix.ts` (`recordConfirmedBankPix`) | Mesmo caminho para o boleto |
| Rede de segurança diária | `payment-mark-overdue-receivables` | Também relê boletos pagos |
| Variável `{{boleto_link}}` da régua | `dunning-fire.ts` | Hoje é o mesmo link da cobrança; passa a abrir uma página com o boleto |

## 2. Objetivo

Com o banco conectado e o boleto ligado, cada cobrança de cliente com endereço completo sai
como **boleto com PIX** do banco (linha digitável, PDF e copia e cola); o cliente paga por
qualquer um dos dois e a conta é baixada sozinha.

### Não-objetivos

- **Nota fiscal (NFS-e).** O Inter só anexa o número de uma nota já emitida; emitir é outra spec (emissor).
- **Escolher boleto ou PIX por cobrança.** v1 é uma escolha da empresa (D-2).
- **Protesto, negativação, boleto parcelado/recorrente do Inter** (`tipoCobranca` `PARCELADO`/`RECORRENTE`): as parcelas e recorrências já são do ÓRBITA.
- **Pagar contas pelo ÓRBITA** (API Banking de pagamentos): escopo que move dinheiro.
- **Outros bancos.** A porta fica pronta; só o Inter entra.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | **Ligar o boleto**: no painel da conexão (Financeiro → Contas), a empresa escolhe "Como cobrar": **PIX** (como hoje) ou **Boleto com PIX**. Só aparece se o banco tem boleto e a integração tem os escopos `boleto-cobranca.*`; sem eles, a tela explica o que marcar no Inter. Ao ligar, o ÓRBITA cadastra o webhook de cobrança da conta. |
| RF-2 | **Multa, juros e desconto** (opcionais, só no boleto): multa em %, juros ao mês em % e desconto em % até N dias antes do vencimento. Vazio = sem. |
| RF-3 | **Quando sai boleto**: conta a receber em aberto, valor em aberto ≥ R$ 2,50, cliente com CPF/CNPJ e endereço completo (rua, cidade, UF, CEP com 8 dígitos) — do contato do Financeiro ou, sem ele, do lead (D-7). Faltou algo → sai o PIX da 0130 (e, se faltar o documento, o estático), e o diálogo do link diz o que falta. |
| RF-4 | **Emissão sob demanda**, como o PIX: na primeira vez que a cobrança precisa (página aberta, aviso da régua, botão do link), o ÓRBITA emite o boleto e guarda o `codigoSolicitacao`. Enquanto o banco processa, a página mostra "gerando boleto" e o PIX da 0130 não é criado para a mesma conta (uma cobrança só no banco por conta a receber). |
| RF-5 | **Boleto pronto**: chega pelo aviso de cobrança (ou pela consulta, se o aviso atrasar); o ÓRBITA guarda linha digitável, código de barras e o copia e cola do PIX do boleto. A página `/cobranca/<token>` mostra o PIX (QR e copia e cola), a linha digitável com "copiar" e "Baixar boleto (PDF)". |
| RF-6 | **Régua**: `{{pix_copia_e_cola}}` usa o PIX do boleto; `{{boleto_link}}` leva à página da cobrança, já com o boleto; nova variável `{{linha_digitavel}}`. Se o boleto ainda está sendo gerado quando o aviso sai, o aviso espera até 30 s; não ficou pronto, vai com o link (o boleto aparece na página). |
| RF-7 | **Pago**: o aviso de cobrança `RECEBIDO` (por boleto ou PIX) é conferido consultando o Inter (`GET /cobrancas/{id}`: situação, valor recebido, origem). Vira movimento `BANK_API` (`externalId` = `boleto:<codigoSolicitacao>`), casado pelo `codigoSolicitacao` guardado; baixa por `applyPaymentToEntry`, régua para, gatilho "Pagamento recebido". Valor recebido inclui multa e juros: a baixa registra o valor em aberto e a diferença fica no movimento (D-6). |
| RF-8 | **Conta muda**: baixa parcial, edição de valor ou vencimento revisam o boleto no banco (`PATCH`, até 30 min para valer); quitada por fora, cancelada ou excluída → boleto cancelado no banco ("Pago por outra forma" / "Cobrança cancelada"). |
| RF-9 | **Boleto expirado** (passou `numDiasAgenda` depois do vencimento sem pagamento) ou cancelado no banco por fora: na próxima vez, emite um novo. |
| RF-10 | **Rede de segurança**: a rotina diária que já existe também lista boletos `RECEBIDO` dos últimos 2 dias (`GET /cobrancas?filtrarDataPor=PAGAMENTO&situacao=RECEBIDO`) e processa os que não viraram movimento. |
| RF-11 | **Desligar o boleto** ou desconectar: os boletos em aberto continuam pagáveis e com baixa automática enquanto a conexão existir; desconectar cancela-os, como o PIX (0130). |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | **Nenhuma função nem cron novo no Inngest.** O aviso de cobrança entra na função `payment-bank-pix-received` como um segundo evento; a rede de segurança, na rotina diária. Estimativa: cada boleto pago gera 1 execução (mais 1 do aviso de emissão, que não precisa de função: grava direto na rota). ~200/mês hoje. |
| RNF-2 | **Uma cobrança no banco por conta a receber**: nunca boleto e PIX da 0130 ativos ao mesmo tempo para a mesma conta. Ao emitir boleto para conta que já tem PIX ativo, o PIX é cancelado antes. |
| RNF-3 | **Webhook não confia no corpo** (mesma regra da 0130): token na URL, conferência no Inter antes de baixar. O aviso de emissão (boleto pronto) só grava dados de exibição, nunca baixa. |
| RNF-4 | **Idempotência**: aviso repetido não baixa duas vezes (`externalId` único); emitir de novo em 30 min não duplica (chave do Inter) e o ÓRBITA não emite se já há `codigoSolicitacao` ativo. |
| RNF-5 | **Limites**: edição 10/min (fila natural: a revisão é feita no próximo uso, não em rajada); emissão 120/min. A página não espera mais de 3 s (P-3 da 0130). |
| RNF-6 | **LGPD**: o endereço do cliente passa a ser guardado no contato do Financeiro (dado pessoal novo, com a mesma finalidade de cobrança) e vai ao banco só para registrar o boleto. Entra no inventário LGPD. |
| RNF-7 | Toda query nova filtra por `organizationId`; o PDF é servido por rota pública que só aceita o token da cobrança (o mesmo da página). |

## 4. Critérios de aceite

- [ ] **CA-1** — Dada uma conexão sem os escopos de boleto, quando a pessoa abre o painel, então "Boleto com PIX" aparece desligado com a explicação do que marcar no Inter.
- [ ] **CA-2** — Dado o boleto ligado e um lead com CPF e endereço completos, quando a página da cobrança abre, então mostra "gerando boleto" ou o boleto pronto (linha digitável, PDF e PIX), e uma segunda abertura não emite outro.
- [ ] **CA-3** — Dado um lead sem CEP, então sai o PIX da 0130 e o diálogo do link diz "falta o endereço do cliente para o boleto".
- [ ] **CA-4** — Dado um boleto pago **por boleto** (sandbox), quando o aviso chega, então a conta fica paga, existe movimento `BANK_API` casado e a régua para.
- [ ] **CA-5** — Dado um boleto pago **pelo PIX do boleto**, então o mesmo de CA-4, e o aviso de PIX da 0130 desse pagamento é ignorado (não cria segundo movimento).
- [ ] **CA-6** — Dado o mesmo aviso de cobrança reenviado, então não há segunda baixa.
- [ ] **CA-7** — Dada a conta quitada à mão, cancelada ou excluída, então o boleto é cancelado no banco.
- [ ] **CA-8** — Dada uma baixa parcial, então o boleto é revisado para o saldo (pode levar até 30 min para valer no banco).
- [ ] **CA-9** — Dada uma conta com PIX da 0130 ativo, quando o boleto é emitido para ela, então o PIX é cancelado antes.
- [ ] **CA-10** — Dada multa 2% e juros 1% a.m. configurados, então o boleto emitido traz os dois, e o pagamento com acréscimo baixa a conta.
- [ ] **CA-11** — Dado um boleto pago cujo aviso nunca chegou, quando a rotina diária roda, então a conta é baixada.
- [ ] **CA-12** — Dado o link do PDF com token de cobrança de outra empresa ou inválido, então 404.
- [ ] **CA-13** — Dado um valor em aberto de R$ 2,00, então sai PIX, não boleto.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Cliente paga o boleto **e** o PIX antigo da 0130 enviado antes de ligar o boleto | RNF-2 cancela o PIX ao emitir o boleto; se o cliente pagou antes do cancelamento, o segundo pagamento vira movimento "a identificar" (devolução) |
| CB-2 | Boleto pago com multa/juros (valor maior que o aberto) | Baixa pelo valor em aberto; a diferença aparece no movimento (D-6) |
| CB-3 | Edição de valor ainda processando (até 30 min) e o cliente paga o valor antigo | Valor menor: baixa parcial, como hoje; maior: D-6 |
| CB-4 | Vencimento hoje depois das 19h59 | O Inter recusa vencimento no mesmo dia após 19h59; o ÓRBITA emite com vencimento amanhã |
| CB-5 | Conta já vencida | Como no PIX (0130): o boleto novo vence hoje (ou amanhã, CB-4) |
| CB-6 | Emissão falha (`FALHA_EMISSAO`) | Cai no PIX da 0130 para essa conta e mostra o motivo no link; não tenta de novo na mesma hora |
| CB-7 | Lead trocou de endereço depois da emissão | O boleto já emitido segue; o endereço novo vale para o próximo |
| CB-8 | Aviso de emissão chega antes de o ÓRBITA gravar o `codigoSolicitacao` (corrida) | Aviso sem conta casada é ignorado; a consulta na próxima abertura traz os dados |
| CB-9 | `numDiasAgenda` passou (boleto expirado) | RF-9: emite outro na próxima vez |

## 6. Decisões de design

### D-1 — Boleto entra na mesma porta, como parte opcional do banco

- **Escolha**: `BankAdapter` ganha `createBoletoProvider?` (opcional): `issueBoleto`, `getBoleto`, `reviseBoleto`, `cancelBoleto`, `getBoletoPdf`, `listPaidBoletos`, `registerBoletoWebhook`. Banco sem boleto simplesmente não implementa; a tela esconde a opção.
- **Por quê**: o segundo banco previsto (Asaas, spec 0115) também tem boleto; régua, página e baixa não podem saber que é o Inter.

### D-2 — Escolha por empresa, não por cobrança

- **Escolha**: coluna `chargeMethod` (`PIX` | `BOLETO_PIX`) na `PaymentBankConnection`, mais `boletoFinePercent`, `boletoInterestMonthlyPercent`, `boletoDiscountPercent`, `boletoDiscountDays`.
- **Alternativa descartada**: escolher por conta a receber — mais um campo no formulário de lançamento para um caso que a empresa decide uma vez. Rever se alguém pedir (é só uma coluna na conta a receber, depois).

### D-3 — Colunas novas na conta a receber, sem tabela de cobranças

- **Escolha**: `PaymentEntry` ganha `boletoRequestId` (único, o `codigoSolicitacao`), `boletoDigitableLine`, `boletoBarcode`, `boletoStatus` (`PROCESSING` | `ACTIVE` | `FAILED`). O copia e cola do PIX do boleto vai em `pixCopyPaste`, que a régua e a página já leem; `pixTxid` continua só para o PIX da 0130.
- **Alternativa descartada**: tabela `PaymentBankCharge` 1:N — a D-2 da 0130 e a D-1 da 0115 já descartaram ("duas fontes de verdade para o mesmo dinheiro"). Com uma cobrança ativa por conta (RNF-2), colunas bastam. Histórico de boletos cancelados fica no banco (Inter), não aqui.

### D-4 — Mesmo webhook, mesma função, dois eventos

- **Escolha**: a rota `api/payment/bank-webhook/[connectionId]/[token]` reconhece o corpo: `{ pix: [...] }` (aviso de PIX, 0130) ou `[ { codigoSolicitacao, situacao, ... } ]` (aviso de cobrança). Cobrança `RECEBIDO` → evento `payment/bank-boleto.paid`; emitida → grava os dados de exibição direto (sem Inngest); cancelada/expirada → limpa a conta para emitir outro. A função `payment-bank-pix-received` passa a ter os dois gatilhos.
- **Por quê**: S11 — nenhuma função nova; o token e as defesas da 0130 valem iguais.

### D-5 — Emissão sob demanda, com espera curta

- **Escolha**: como o PIX (0130, D-2): emite na primeira necessidade. A página espera até 3 s (consulta a cada 1 s); a régua, até 30 s dentro do passo. Pronto depois disso, aparece na próxima abertura.
- **Alternativa descartada**: emitir ao lançar a conta — gera centenas de boletos para parcelas de 12 meses que ninguém vai pagar ainda (mesmo motivo da 0130).

### D-6 — Multa e juros: baixa pelo valor em aberto

- **Escolha**: pagamento maior que o em aberto quita a conta pelo valor em aberto; o movimento guarda o valor real recebido e a diferença aparece na Conciliação como "acréscimo recebido". Lançar a receita de juros automaticamente fica para depois (P-2).
- **Por quê**: `applyPaymentToEntry` não aceita pagar mais que o em aberto, e hoje o recebimento a maior cai em "a identificar" — com boleto, juros são esperados, não erro.

### D-7 — Endereço no contato do Financeiro, com o lead como reserva

- **Escolha**: `PaymentContact` ganha endereço (`addressZipCode`, `addressStreet`, `addressNumber`, `addressComplement`, `addressNeighborhood`, `addressCity`, `addressState`), com busca por CEP no formulário do contato. O boleto usa o endereço do contato; sem ele, o do lead. CPF/CNPJ segue a regra da 0130 (contato, depois lead). O diálogo do link diz exatamente o que falta e leva ao contato.
- **Por quê (P-3, respondida)**: na cópia local da ORBITA HUB (21/10), das **150** contas a receber em aberto, **0** têm lead, **13** têm CPF/CNPJ e **0** têm endereço. Só com o endereço do lead, o boleto não sairia para nenhuma cobrança da ORBITA HUB.
- **Alternativa descartada**: copiar o endereço do lead para o contato — a ORBITA HUB não tem lead nas cobranças; não há o que copiar.

### D-8 — Permissões conferidas chamando a API, não pelo token

- **Fato (conferido em produção em 2026-11-03)**: o Inter devolve no token **qualquer escopo pedido**, inclusive `pagamento-pix.write`. Pedindo um escopo, a chamada passa da checagem de acesso; sem pedir, o Inter responde 401. Ou seja, a lista do token não prova o que a integração pode fazer.
- **Escolha**: ao conectar e em "Testar conexão", o ÓRBITA chama a API: leitura inofensiva para os escopos de leitura e escrita com corpo vazio (o banco recusa com 400 sem criar nada) para os de escrita. 401/403 = falta; 2xx/400/404 = tem. `PaymentBankConnection.scopes` passa a guardar só o que foi confirmado, com `permissionsCheckedAt`. Faltou permissão do PIX → a conexão é recusada dizendo o que marcar no banco. Faltou do boleto → "Boleto com PIX" fica desligado com a mesma explicação.
- **Permissões que movem dinheiro** (`pagamento-pix.write`, `pagamento-boleto.write`) são conferidas do mesmo jeito, num token descartado em seguida e com corpo vazio. Aparecem em vermelho na tela. O token de trabalho nunca as pede.
- **Custo**: até 4 pedidos de token por conferência (o Inter aceita 5 por minuto) e 9 chamadas sem efeito.
- **Achado**: a integração da ORBITA HUB tem `pagamento-pix.write` e `pagamento-boleto.write`. Recomendação: remover no Internet Banking.
- **Corrige a 0130 (RF-2)**: o aviso de "escopo que move dinheiro" lido do token nunca acendia, porque o ÓRBITA só pedia os escopos do PIX.

## 7. Impacto

- [x] Schema / migration — colunas em `PaymentBankConnection` (D-2), `PaymentEntry` (D-3) e endereço em `PaymentContact` (D-7); enums `PaymentBankChargeMethod` e `PaymentBoletoStatus`. Só adiciona.
- [x] Tela do contato do Financeiro — endereço com busca por CEP.
- [x] Procedures oRPC — salvar "Como cobrar" e multa/juros/desconto na conexão; o link da cobrança devolve o tipo (boleto/PIX/estático) e o motivo.
- [x] Rota pública nova — PDF do boleto por token da cobrança.
- [x] Automações (Inngest) — **nenhuma função nova**: `payment-bank-pix-received` ganha o gatilho `payment/bank-boleto.paid`; `payment-mark-overdue-receivables` ganha a releitura de boletos; `payment-dunning-fire` usa o boleto. "Resync" depois do deploy.
- [ ] Env vars — nenhuma.
- [x] Código de infraestrutura — `src/http/inter/boleto.ts` (cliente da API Cobrança V3) e adapter.
- [x] Documentação — guia do Astro (ligar o boleto) e changelog da 0130.

## 8. Plano de testes

Sandbox do Inter (tem "Pagar cobrança (Sandbox)") e, depois, um boleto real de R$ 2,50 pago pela equipe.

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1 | manual | Conexão atual (sem escopo de boleto) |
| CA-2, CA-3, CA-13 | manual / roteiro | Lead com e sem endereço; valor < R$ 2,50 |
| CA-4, CA-5, CA-6 | sandbox + curl | Pagar por boleto e pelo PIX do boleto; reenviar o aviso |
| CA-7, CA-8, CA-9 | roteiro contra o banco | Como o roteiro de revisão da 0130 |
| CA-10 | sandbox | Boleto com multa/juros pago depois do vencimento |
| CA-11 | roteiro | Pagar com webhook desligado e rodar a rotina |
| CA-12 | curl | Token inválido no PDF |

## 9. Riscos e rollback

- **Integração sem os escopos de boleto**: a ORBITA HUB precisa editar (ou recriar) a integração no Inter marcando `boleto-cobranca.*`. Se o Inter exigir integração nova, vem certificado novo: a tela já permite trocar (0130, RF-9). Ver P-1.
- **Tarifa do boleto** é diferente da do PIX (P-4): boleto pago custa mais para a empresa.
- **Edição em até 30 min**: cliente pode pagar o valor antigo nesse intervalo (CB-3).
- **Endereço e documento faltando**: hoje quase nenhuma cobrança da ORBITA HUB tem CPF/CNPJ e endereço. Sem preencher os contatos, o boleto fica ligado e não sai. O diálogo do link diz o que falta, contato por contato.
- **Endereço desatualizado**: o boleto sai com o endereço errado; não impede o pagamento.
- **Rollback**: voltar "Como cobrar" para PIX na tela; boletos já emitidos continuam pagáveis e com baixa. Reverter o deploy não apaga dados.

### Perguntas em aberto

- **P-1** — *Respondida (2026-11-03)*: a integração da ORBITA HUB já tem `boleto-cobranca.read` e `boleto-cobranca.write` (conferido chamando a API, D-8).
- **P-2** — Juros e multa recebidos devem virar uma receita própria (categoria "Juros recebidos") automaticamente? Proposta: v1 não; a diferença fica visível no movimento.
- **P-3** — *Respondida (2026-11-03, cópia local de 21/10)*: das 150 contas a receber em aberto da ORBITA HUB, 0 têm lead, 13 têm CPF/CNPJ, 0 têm endereço. Levou à D-7 (endereço no contato).
- **P-4** — Qual a tarifa do boleto no plano da ORBITA HUB? Mostrar na tela ao ligar.
- **P-5** — `numDiasAgenda` (dias após o vencimento para o boleto expirar): proposta 30, igual à validade do PIX (0130, P-2).

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-11-03 | João Gabriel | Criada a partir da leitura da API Cobrança V3 do Inter e da implementação da 0130. |
| 2026-11-03 | João Gabriel | P-3 respondida pelos dados: D-7 passa a pôr endereço no contato do Financeiro (lead vira reserva). |
| 2026-11-03 | João Gabriel | Teste real em produção: boleto de R$ 2,50 emitido em 2 s (linha digitável, PIX do boleto e PDF de 40 KB), reaproveitado na segunda consulta (10 ms), cancelado. O cancelamento levou alguns minutos: o código passou a ficar guardado até o aviso de cancelado, e aviso atrasado de "ativo" não reativa o boleto. |
| 2026-11-03 | João Gabriel | Implementação. D-8 nova (permissões conferidas pela API; o token repete qualquer escopo), P-1 respondida. Detalhes que divergem do texto acima: a conexão do boleto reaproveita `pixConnectionId`; o aviso de cobrança vira o evento `payment/bank-boleto.updated` (emitido, pago, cancelado, expirado), sempre conferido no banco pela função `payment-bank-pix-received`; o webhook de cobrança é cadastrado ao ligar o boleto; o boleto pago casa com `matchMethod` `BANK_BOLETO` e `externalId` `boleto:<codigoSolicitacao>`. Testado contra o Inter real sem emitir boleto (permissões, ligar o boleto, conta sem endereço caindo no PIX) e com baixa simulada no banco local (juros, aviso repetido). |
