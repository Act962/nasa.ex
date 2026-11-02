---
id: 0130
titulo: Conectar o Banco Inter para gerar o PIX de cada cobrança e dar baixa sozinho
dominio: payment
status: rascunho
autor: Weydson
criada: 2026-10-31
atualizada: 2026-10-31
branch: feature/W-payment-banco-inter-20261031
pr:
peso: completa
---

# 0130 — Conectar o Banco Inter para gerar o PIX de cada cobrança e dar baixa sozinho

## 1. Contexto

A ORBITA HUB cobra os próprios clientes pela aba **Cobranças** do Financeiro (spec 0115): a
régua manda os avisos pelo WhatsApp com o link `/cobranca/<token>` e o PIX copia e cola. Hoje
esse PIX é **estático**: o ÓRBITA monta o código com a chave da empresa
(`ForgeSettings.paymentGatewayConfigs.PIX`), e desde 31/10/2026 a chave é o CNPJ da conta
Inter (69.758.472/0001-04), porque a conta Nubank foi descontinuada.

Com PIX estático, **ninguém avisa o ÓRBITA quando o cliente paga**. A baixa é digitada à mão
ou sai da conciliação do extrato, dias depois. Enquanto isso a régua continua mandando aviso
para quem já pagou. A ORBITA HUB tem hoje ~29 séries de cobrança em aberto (175 parcelas),
quase todas mensais.

Em 31/10/2026 o Inter liberou para a ORBITA HUB uma integração de API (client_id,
client_secret, certificado `.crt` e chave `.key`). A pesquisa de 23/10
(`reports/API do Banco Inter para Órbita.md` e `research_notes/API do Banco Inter para Órbita/`)
concluiu que o Inter resolve a parte "dinheiro": gera a cobrança PIX e **avisa quando ela é
paga**. Não emite nota, não cobra no cartão e **não avisa PIX feito direto na chave**.

**O que já existe e será reaproveitado** (nada disto é recriado):

| Já existe | Onde | Uso aqui |
| --- | --- | --- |
| Conta bancária do Financeiro, com a conta "BANCO INTER EMPRESA" já cadastrada na ORBITA HUB | `PaymentBankAccount` | Recebe a conexão (decisão D-3 da spec 0115) |
| Movimento bancário com idempotência por `externalId`, pagador e tela "a identificar" | `PaymentBankTransaction`, `statements/ports.ts` | O PIX pago vira um movimento, como o OFX |
| Regra única de quitação (pago × parcial) | `statements/apply-payment.ts` (`applyPaymentToEntry`) | Baixa a conta a receber |
| Conciliação com casamento e desfazer | `statements/reconcile-transaction.ts`, `unmatch-transaction.ts` | Casamento exato pelo `txid` |
| Página pública da cobrança com QR e copia e cola | `/cobranca/<token>`, `charges/charge-details.ts` | Passa a mostrar o PIX do Inter |
| Régua com `{{pix_copia_e_cola}}` e `{{link_pagamento}}`, que já pula conta paga | `inngest/functions/payment/dunning-fire.ts` | Usa o PIX do Inter; para ao pagar |
| Gatilho "Pagamento recebido" | evento `agent-workflow/payment-received` | Disparado na baixa automática |
| Cifragem de segredos (AES-256-GCM) e `last4` | `src/lib/crypto.ts` | client_secret, `.crt` e `.key` |
| Checagem de dono/administrador | `features/permissions/server/is-org-admin.ts` | Só eles conectam |
| Rotina diária que procura integrações quebradas | `crons/detect-broken-integrations.ts` | Aviso de certificado vencendo (sem cron novo) |
| Gerador de PIX estático (BR Code) | `form-records/lib/pix-br-code.ts` | Reserva quando o Inter falhar |

## 2. Objetivo

Com o Inter conectado, cada conta a receber ganha um **PIX próprio do Inter**, e quando o
cliente paga, a conta é baixada sozinha, a régua para e o gatilho "Pagamento recebido"
dispara — sem ninguém digitar nada.

### Não-objetivos

- **Boleto / BolePix.** Fase 2. O v1 é só PIX (mesmo motivo da D-4 da spec 0115).
- **Extrato automático** do Inter na Conciliação (`StatementProvider`). Fase 2; até lá o
  PIX feito direto na chave continua chegando pelo extrato importado.
- **Pix Automático** (débito recorrente autorizado). Exige 6 meses de CNPJ e outra API.
- **Juros e multa** no PIX vencido. Possível no `cobv`, mas fica para depois (alinha com 0115).
- **Nota fiscal (NFS-e)**, **cartão** e **link de pagamento do Inter** (só existe no app).
- **Outros bancos** (Asaas, Itaú…). O desenho deixa a porta aberta (D-1), mas só o Inter entra.
- **Cada cliente do ÓRBITA conectar o próprio Inter** como produto. Funciona por empresa desde
  o início, mas a divulgação, o guia e o suporte para clientes ficam para depois do piloto
  na ORBITA HUB.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | **Conectar**: em Financeiro → Contas, a conta bancária ganha "Conectar API do Inter" (e o card "Banco Inter" em Satélites leva até ela). A pessoa informa ambiente (produção/teste), client_id, client_secret, envia o `.crt` e o `.key` (soltos ou no ZIP que o Inter entrega), a chave PIX da conta e o número da conta corrente. O ÓRBITA confere que certificado e chave formam par e lê a validade; pede um token ao Inter com os escopos do v1; registra o webhook (`PUT /pix/v2/webhook/{chave}`). Deu certo: grava tudo cifrado e mostra conectado, escopos ativos, 4 últimos dígitos do client_id e validade do certificado. |
| RF-2 | **Escopos mínimos**: o v1 pede só `cobv.read cobv.write pix.read webhook.read webhook.write` (opcionais: `cob.read cob.write` para a CB-4 e `extrato.read` para a fase 2). Se a integração tiver escopo que **move dinheiro** (`pix.write`, que devolve PIX, ou `pagamento-pix.*`, `pagamento-boleto.*`, `pagamento-darf.write`, `pagamento-lote.*`), a tela avisa em vermelho para a pessoa pedir a remoção no Inter. O ÓRBITA nunca pede esses escopos no token. |
| RF-3 | **Conta padrão de cobranças**: uma conta conectada pode ser marcada "padrão de cobranças" (só uma por empresa). É dela que sai o PIX de todas as cobranças. |
| RF-4 | **PIX da cobrança**: na primeira vez que a cobrança precisa do PIX (página aberta, aviso da régua ou botão "Gerar PIX"), o ÓRBITA cria no Inter uma cobrança PIX com identificador (`txid`) derivado da conta a receber, valor em aberto e vencimento. Guarda o copia e cola e o `txid` na conta a receber e reaproveita nas próximas vezes. |
| RF-5 | **Valor ou vencimento mudou**: na próxima vez que o PIX for pedido, o ÓRBITA atualiza a cobrança no Inter antes de mostrar. |
| RF-6 | **Pagamento recebido**: o Inter avisa o ÓRBITA (webhook, um aviso pode trazer vários PIX). Para cada um, o ÓRBITA **confere o pagamento consultando o Inter** (`GET /pix/v2/pix/{endToEndId}`) com as próprias credenciais, cria o movimento bancário (origem nova `BANK_API`, `externalId` = `endToEndId`) e casa pelo `txid` com a conta a receber. Casou: baixa por `applyPaymentToEntry`, régua encerrada e `agent-workflow/payment-received` disparado. Não casou: o movimento fica "a identificar". |
| RF-7 | **Baixa manual ou cancelamento**: se a conta a receber for paga por outra fonte (manual, extrato) ou cancelada, o ÓRBITA remove a cobrança no Inter, para o cliente não pagar duas vezes. |
| RF-8 | **Reserva**: Inter desconectado, certificado vencido ou erro do Inter ao criar a cobrança → a página e a régua usam o PIX estático de hoje (sem baixa automática), e a tela de Cobranças mostra o motivo. |
| RF-9 | **Certificado vencendo**: o certificado vale 1 ano e pode ser renovado a partir de 90 dias antes. Aos 90, 30 e 7 dias, dono e administradores recebem aviso no sino; vencido, a conexão fica "certificado vencido" e vale a reserva (RF-8). A tela permite trocar só o `.crt`/`.key`, mantendo client_id e secret. |
| RF-10 | **Desconectar / trocar credenciais**: apaga client_secret, `.crt`, `.key` e o token guardado, remove o webhook no Inter (`DELETE /pix/v2/webhook/{chave}`, quando possível) e volta ao PIX estático. Trocar credenciais repete a validação do RF-1. |
| RF-11 | **Rede de segurança**: uma vez por dia, para cada conta Inter conectada, o ÓRBITA lista os PIX recebidos nas últimas 48 h (`GET /pix/v2/pix?inicio&fim`) e processa os que não viraram movimento, pelo mesmo caminho do RF-6. Roda **dentro da rotina diária de vencidos que já existe** (`mark-overdue-receivables`), antes de marcar atrasadas, para não chamar de atrasado quem pagou e o aviso se perdeu. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | **Nenhum cron novo.** O aviso de pagamento chega por webhook; certificado (RF-9) e rede de segurança (RF-11) entram em rotinas diárias que já existem. Estimativa de execuções Inngest: ~200 PIX pagos/mês na ORBITA HUB → ~200 execuções da função nova; 10x ≈ 2.000/mês. |
| RNF-2 | **Segredos só cifrados.** client_secret, `.crt`, `.key` e o token guardado são gravados com `encryptSecret`, presos à empresa (dado adicional `organizationId:inter`); nunca voltam para o navegador, nem em log, nem em erro, nem no R2. A tela mostra só `last4` do client_id, o CNPJ e a validade do certificado. O cliente HTTP monta o certificado em memória, por chamada (regra 24a). |
| RNF-3 | **Só dono ou administrador** conecta, troca, desconecta ou marca a conta padrão. Toda ação grava `logActivity`. |
| RNF-4 | **Webhook não confia no corpo** (D-4). A URL tem um token aleatório por conta (≥ 128 bits, comparado com `timingSafeEqual`); o cabeçalho `x-conta-corrente` tem de bater com a conta cadastrada; a origem é conferida contra a lista de IPs do Inter (configurável, não fixa no código); e o ÓRBITA só baixa depois de consultar o pagamento no Inter (RF-6). Responde 200 rápido (o Inter tenta de novo até 4 vezes, em ~4 h) e enfileira; para o que não é nosso, 200 sem revelar nada. A rota aceita o sufixo `/pix` que o Inter acrescenta à URL cadastrada. |
| RNF-5 | **Idempotência**: o mesmo aviso entregue duas vezes não cria movimento nem baixa de novo (`externalId` = `endToEndId`, restrição única que já existe). Criar o PIX duas vezes para a mesma conta não cria duas cobranças no Inter (`txid` determinístico). |
| RNF-6 | Toda query nova filtra por `organizationId`; o webhook só toca a empresa dona da conta do token. |
| RNF-7 | Sem rede dentro de `$transaction` (regra 18): a consulta ao Inter acontece antes; a baixa grava no banco; evento e mensagens saem depois do commit. |
| RNF-8 | A página `/cobranca/<token>` não pode travar por causa do Inter: tempo máximo de espera curto (ver P-3); estourou, mostra o PIX estático (RF-8). |
| RNF-9 | **Limites do Inter**: no máximo 5 pedidos de token por minuto e 120 chamadas por minuto nas APIs de PIX. O token (válido por 60 min) é guardado cifrado e reaproveitado até 5 min antes de vencer (D-6). 429 do Inter → espera e tenta de novo pelo próprio retry do Inngest; na página, vai para a reserva (RF-8). |
| RNF-10 | **Chamadas ao Inter só a partir do servidor da aplicação** (IP fixo). O Inter bloqueia IP dinâmico com 406 sem mensagem; nunca chamar do navegador nem de função de borda. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dadas credenciais válidas do sandbox do Inter, quando o dono conecta a conta, então a tela mostra "Conectado", os escopos, os 4 últimos dígitos do client_id e a validade do certificado, e o client_secret não aparece em nenhuma resposta da API.
- [ ] **CA-2** — Dadas credenciais erradas ou certificado de outra integração, quando conecta, então aparece o erro do Inter em português e nada é gravado.
- [ ] **CA-3** — Dado um usuário que não é dono nem administrador, quando tenta conectar, trocar ou desconectar, então recebe "Só o dono ou um administrador…" e nada muda.
- [ ] **CA-4** — Dada uma conta a receber em aberto e a conta Inter como padrão, quando a página `/cobranca/<token>` abre, então mostra o PIX do Inter com o valor em aberto, e uma segunda abertura não cria outra cobrança no Inter.
- [ ] **CA-5** — Dado o PIX do Inter pago no sandbox, quando o aviso chega, então a conta a receber fica paga, existe um movimento `BANK_API` casado com ela, a régua não envia mais nada e o gatilho "Pagamento recebido" dispara.
- [ ] **CA-6** — Dado o mesmo aviso reenviado (curl), então não há segundo movimento nem segunda baixa.
- [ ] **CA-7** — Dado um aviso com token de URL errado, então 401 e nada muda; dado um aviso com token certo mas `txid`/`endToEndId` que o Inter não confirma, então nada é baixado.
- [ ] **CA-8** — Dado um PIX pago no Inter cujo `txid` não é de nenhuma conta a receber, então o movimento fica "a identificar".
- [ ] **CA-9** — Dada uma conta a receber com PIX do Inter, quando é marcada como paga à mão ou cancelada, então a cobrança some no Inter.
- [ ] **CA-10** — Dado o valor da conta alterado depois do PIX gerado, quando a página abre, então o PIX mostra o valor novo.
- [ ] **CA-11** — Dado o Inter fora do ar (ou credenciais removidas), quando a régua envia, então a mensagem sai com o PIX estático e a tela de Cobranças mostra o motivo.
- [ ] **CA-12** — Dado um certificado que vence em 30 dias, quando a rotina diária roda, então dono e administradores recebem o aviso no sino uma vez.
- [ ] **CA-13** — Dado um id de conta bancária ou conta a receber de outra empresa, em qualquer procedure nova ou no webhook, então nada é lido nem alterado.
- [ ] **CA-14** — Dada uma integração com escopo `pix.write` ou `pagamento-*`, quando o dono conecta, então a tela mostra o aviso vermelho e o token pedido pelo ÓRBITA não contém esses escopos.
- [ ] **CA-15** — Dados 20 avisos da régua saindo no mesmo minuto, todos pedindo PIX do Inter, então o ÓRBITA pede no máximo 1 token e nenhum aviso falha por 429.
- [ ] **CA-16** — Dado um PIX do Inter pago cujo aviso nunca chegou, quando a rotina diária roda, então a conta é baixada pelo mesmo caminho do aviso e não é marcada como atrasada.
- [ ] **CA-17** — Dado um aviso com `x-conta-corrente` diferente da conta cadastrada, ou vindo de IP fora da lista do Inter, então nada é processado.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Cliente paga o PIX **estático** antigo (mensagem enviada antes de conectar o Inter) | O Inter não avisa (PIX na chave). Chega pelo extrato importado, como hoje. A partir da conexão, as mensagens novas levam o PIX do Inter. |
| CB-2 | Cliente paga o PIX do Inter depois de a conta já ter sido baixada à mão | O aviso não acha conta em aberto; movimento "a identificar" = sinal de pagamento em dobro para a equipe devolver (igual CB-8 da 0115). |
| CB-3 | Cliente paga depois do vencimento | Vale enquanto a cobrança no Inter aceitar pagamento (validade após o vencimento, ver P-2); depois disso o PIX expira e a página gera um novo na próxima abertura. |
| CB-4 | Contato sem CPF/CNPJ | Ver P-1: se a cobrança com vencimento exigir devedor, usa a cobrança imediata com expiração longa; senão, reserva (RF-8). |
| CB-5 | Parcela de série (ex.: 5/12) | Cada parcela tem o próprio `txid`; pagar uma não mexe nas outras. |
| CB-6 | Aviso do Inter chega antes de a cobrança terminar de gravar no ÓRBITA (corrida) | A consulta ao Inter traz o `txid`; o casamento é pelo `txid`, que é derivado da conta a receber, então funciona mesmo sem o copia e cola gravado. |
| CB-7 | Pagamento parcial | Não acontece no PIX do Inter (valor fixo). Se o valor recebido divergir do em aberto, `applyPaymentToEntry` grava parcial, como a conciliação já faz. |
| CB-8 | Estorno (devolução) do PIX no Inter | v1: o ÓRBITA não recebe aviso de devolução; a equipe desfaz a conciliação (`unmatch-transaction`, já existe). Registrado em §9. |
| CB-9 | Duas contas Inter conectadas na mesma empresa | Só a marcada como padrão gera PIX; avisos das duas são aceitos (cada uma com o próprio token). |
| CB-10 | Token do Inter expirado no meio de uma operação | Pede outro e tenta uma vez; falhou, reserva (RF-8). |
| CB-11 | `.crt` e `.key` que não formam par, ou arquivo `.pfx` em vez de PEM | Erro na conexão explicando o formato esperado; nada gravado. |
| CB-12 | Certificado vence com cobranças PIX do Inter já enviadas | Os PIX já gerados continuam pagáveis no Inter; o aviso de pagamento depende do webhook, que é do Inter, mas a consulta de conferência (RF-6) falha sem certificado → movimento "a identificar" até renovar. |

## 6. Decisões de design

### D-1 — A conexão mora na conta bancária (segue a D-3 da spec 0115)

- **Escolha**: colunas em `PaymentBankAccount`: `provider` (enum `PaymentBankProvider`: `NONE`, `INTER`), `providerEnv`, `providerClientId`, `providerClientSecretEnc`, `providerCertEnc`, `providerKeyEnc`, `providerCertValidTo`, `providerScopes`, `providerAccountNumber` (para o `x-conta-corrente`), `providerTokenEnc`, `providerTokenExpiresAt`, `providerWebhookToken`, `providerConnectedAt`, `pixKey`, `isDefaultForCharges`. O Asaas da 0115 entra depois como outro valor do mesmo enum.
- **Alternativas descartadas**: (a) tabela nova de conexão — a 0115 já decidiu contra (a conta Inter **é** uma conta bancária, com saldo e extrato, e o movimento precisa do `accountId`); (b) `ForgeSettings.paymentGatewayConfigs` (`Json` com segredo de banco, sem tipo — regra S3); (c) `CompanyCredential` (cofre de senhas para pessoas lerem, com "revelar"; aqui o segredo nunca deve ser revelado); (d) `PaymentGatewayConfig` (é do sistema, sem `organizationId`).
- **Consequência**: a conexão do Asaas da 0115 reaproveita estas colunas. A chave PIX passa a poder vir da conta (`pixKey`); o Forge continua como reserva (dívida já registrada na 0115).

### D-2 — PIX dinâmico do Inter, criado sob demanda e reaproveitado

- **Escolha**: a cobrança PIX com vencimento (`PUT /pix/v2/cobv/{txid}`, resposta imediata com `pixCopiaECola`) é criada no Inter na primeira vez que alguém precisa dela (página, régua ou botão), com `txid` determinístico = `orb` + id da conta a receber. O Inter exige `[a-zA-Z0-9]{26,35}`; o id tem 25 caracteres, então `orb` + id dá 28. O mesmo `txid` torna o `PUT` repetível e o casamento exato. O copia e cola e um "carimbo" (valor + vencimento) ficam em colunas novas da conta a receber: `pixTxid`, `pixCopiaECola`, `pixProvider`, `pixAmountCents`, `pixDueDate`. Se o carimbo não bate com a conta, revisa no Inter (`PATCH /pix/v2/cobv/{txid}`, RF-5). Cancelar = `PATCH` só com `status: REMOVIDA_PELO_USUARIO_RECEBEDOR` (vale só para cobrança `ATIVA`). O QR é desenhado pelo ÓRBITA a partir do copia e cola (o Inter não devolve imagem).
- **Alternativas descartadas**: (a) criar a cobrança no Inter para toda conta a receber, ao lançar — gera centenas de cobranças que ninguém vai pagar (parcelas de 12 meses) e lixo no Inter; (b) continuar só com PIX estático e conciliar pelo extrato — é o problema de hoje, e o Inter não avisa PIX feito direto na chave; (c) BolePix — fica para a fase 2 (não-objetivo); (d) tabela `PaymentCharge` 1:N, sugerida na pesquisa — a D-1 da 0115 descartou ("duas fontes de verdade para o mesmo dinheiro"); com um PIX por conta, colunas bastam. Rever se o BolePix entrar (dois meios para a mesma conta).
- **Custo do Inter** (tabela PJ de 21/06/2025): 0,99% por PIX recebido em cobrança, mínimo R$ 0,10 e máximo R$ 1,99, com franquia mensal de 30 a 100 conforme o plano. O uso da API é gratuito. O ÓRBITA não calcula nem lança tarifa no v1 (alinha com P-3 da 0115).
- **Consequência**: a spec 0115 trocou `pixTxid` pelo id da conta (changelog, item b); aqui a coluna volta porque o Inter tem regra própria de `txid` e porque o casamento automático depende de guardá-lo.

### D-3 — O aviso de pagamento entra pela conciliação (segue a D-2 da 0115)

- **Escolha**: o webhook só valida o token da URL e publica o evento `payment/bank-pix.received` (id = `endToEndId`, para o Inngest deduplicar). Uma função consulta o pagamento no Inter, cria o `PaymentBankTransaction` (origem `BANK_API`) e casa pelo `txid`.
- **Alternativas descartadas**: (a) baixar direto no webhook — perde o PIX que não casou e confia no corpo do aviso; (b) tabela nova de "PIX recebidos" — é o que `PaymentBankTransaction` já é.
- **Consequência**: Inter, OFX, PDF e e-mail viram a mesma coisa para o Financeiro: movimentos do banco.

### D-4 — Webhook protegido por token na URL e conferência no Inter, não por mTLS no nosso servidor

- **Escolha**: URL `api/payment/bank-webhook/[accountId]/[token]` (token aleatório por conta), cabeçalho `x-conta-corrente` conferido, lista de IPs do Inter e consulta ao Inter antes de baixar (RNF-4). O aviso não tem assinatura (HMAC); a consulta (`GET /pix/v2/pix/{endToEndId}`) é a defesa principal: um aviso forjado só consegue fazer o ÓRBITA perguntar ao Inter.
- **Por quê**: a documentação do Inter pede que o servidor que recebe o aviso confira o certificado do Inter (`ca.crt`, baixado em "Minhas integrações" → "Certificado Webhook"). O ÓRBITA fica atrás do Cloudflare e do proxy do Coolify, que encerram o TLS antes do app: a rota Next.js não enxerga certificado de cliente. A conferência pela API dá a mesma garantia ("este pagamento existe, é deste valor e desta cobrança") sem depender da infraestrutura. Ver P-5.
- **Alternativas descartadas**: (a) subdomínio sem proxy com `clientAuth` no Traefik — mexe na borda do servidor só para esta rota e não funciona se o servidor de reserva (proposta de 23/10) entrar; (b) receptor Node dedicado com mTLS — mais um serviço para manter; (c) mTLS no Cloudflare (API Shield) — plano pago e configuração fora do código. Qualquer uma pode ser somada depois sem mudar o resto.

### D-5 — Reserva no PIX estático, sempre

- **Escolha**: qualquer falha do Inter (desconectado, certificado vencido, erro, demora) cai no PIX estático de hoje (RF-8).
- **Por quê**: a cobrança chegar ao cliente é mais importante que a baixa automática; a régua não pode parar por causa do banco.

### D-6 — Token do Inter guardado cifrado na conta bancária

- **Escolha**: o token OAuth (60 min) fica cifrado em `providerTokenEnc` com `providerTokenExpiresAt` e é reaproveitado até 5 min antes de vencer. Renovar é uma escrita condicional (só quem ainda vê o token velho grava o novo), para duas chamadas ao mesmo tempo não pedirem dois tokens.
- **Por quê**: o Inter aceita só **5 pedidos de token por minuto**. Às 9h a régua manda vários avisos de uma vez, e cada um pode precisar criar um PIX: pedir token por operação estoura o limite (429).
- **Alternativa descartada**: cache em memória do processo — não vale com duas instâncias nem depois de reiniciar (S3).

### D-7 — Chave de cifragem própria para credencial de banco

- **Escolha**: env var nova **`BANK_SECRETS_KEY`** (≥ 32 caracteres), usada só para as credenciais de banco. `encryptSecret`/`decryptSecret` ganham um parâmetro opcional de chave e de dado adicional (`organizationId:inter`), sem mudar o comportamento de quem já usa.
- **Por quê**: a `AI_SECRETS_KEY` protege chaves de IA; credencial que dá acesso a conta bancária não deve cair junto se aquela vazar ou precisar ser trocada. O dado adicional impede copiar o texto cifrado de uma empresa para outra.
- **Ciclo de vida (S9)**: não é flag; é segredo permanente. Ausente = a tela de conexão recusa conectar e explica; nada mais quebra. Perder a chave torna as credenciais ilegíveis: a empresa reconecta (o Inter não reenvia o secret, então quem conectou precisa ter guardado o pacote).

### D-8 — Rede de segurança dentro da rotina diária que já existe

- **Escolha**: a varredura de PIX recebidos (RF-11) roda dentro de `mark-overdue-receivables`, só para contas com Inter conectado, antes de marcar atrasadas.
- **Alternativas descartadas**: (a) cron novo (S11: o plano do Inngest já estourou); (b) confiar só no webhook — o Inter desiste depois de ~4 h de tentativas, e um aviso perdido vira cobrança indevida no dia seguinte.

### Segurança dos dados (LGPD)

- **O que entra**: credenciais da empresa (não de pessoa) e, de cada PIX pago, `endToEndId`, valor, horário, nome e CPF/CNPJ do pagador (`infoPagador`). Os dados do pagador já são guardados hoje no movimento bancário do extrato (`counterpartyName`/`counterpartyDocument`); nada novo de pessoa física além disso.
- **Quem vê**: credenciais, ninguém (nem dono: não há "revelar"). Movimentos e pagadores, quem já tem acesso à Conciliação do Financeiro.
- **O que sai**: nada vai para o cliente além do que a página da cobrança já mostra hoje. O webhook nunca devolve dado.
- **Furo de permissão conferido antes**: as procedures novas usam `requireOrgMiddleware` + `isOrgOwnerOrAdmin`; a rota genérica de integrações (`upsertPlatformIntegration`) **não** é usada, porque só exige estar logado.
- **Inventário**: o Inter entra na lista de suboperadores do inventário LGPD da plataforma.

### Perguntas em aberto

Respondidas pela pesquisa (fontes em `research_notes/API do Banco Inter para Órbita/`): regra do
`txid` (D-2), cancelamento por `PATCH` de status (D-2), tarifa (D-2), limites e validade do token
(RNF-9, D-6) e conteúdo do aviso — `endToEndId`, `txid`, `valor`, `horario`, `infoPagador` (D-4).

- **P-1** — A `cobv` exige `devedor` (CPF/CNPJ + nome)? O exemplo do Inter sempre traz. Se exigir, contato sem documento usa a cobrança imediata (`cob`, escopo `cob.*`) com expiração até o vencimento + validade, ou cai na reserva. Hoje, 17 das 29 cobranças da ORBITA HUB não têm nem telefone; documento, menos ainda.
- **P-2** — Qual `validadeAposVencimento` usar na ORBITA HUB? Proposta: 30 dias (passa do último aviso da régua, +7) e configurável por empresa. Não há teto documentado.
- **P-3** — Qual tempo máximo de espera do Inter na página da cobrança (RNF-8)? Proposta: 3 s.
- **P-5** — O Inter entrega o aviso numa URL atrás do Cloudflare, sem pedir certificado de cliente? Testar com o validador de URL do portal e com um PIX real de R$ 1,00 **antes do código**. Se o Inter recusar a entrega, D-4 muda para uma das alternativas.
- **P-9** — O sandbox estava "indisponível" em 23/10 e, quando funciona, tem escopos fixos, certificado de 30 dias e só 10 chamadas/min. Se continuar fora, os testes viram produção com cobranças de R$ 1,00 pagas pela própria equipe e canceladas depois.
- **P-10** — As credenciais recebidas em 31/10 são de **produção** e de qual pacote de permissões? Conferir no Internet Banking antes de conectar (RF-2).

## 7. Impacto

- [x] Schema / migration — colunas em `PaymentBankAccount` (D-1) e em `PaymentEntry` (D-2); enum `PaymentBankProvider`; valor `BANK_API` em `PaymentBankTxSource`. Só adiciona.
- [x] Procedures oRPC — conectar/testar/desconectar/marcar padrão na conta bancária; "Gerar PIX" na conta a receber.
- [ ] Realtime.
- [x] Automações (Inngest) — **função nova** `payment-bank-pix-received` (por evento, ~1 por PIX pago; ~200/mês hoje, ~2.000 com 10x; `concurrency` 1 por conta para não estourar os limites do Inter). Alteradas: `payment-dunning-fire` (pede o PIX do Inter), `mark-overdue-receivables` (rede de segurança, RF-11) e `detect-broken-integrations` (certificado, RF-9). **Nenhum cron novo.** Depois do deploy, "Resync" do Inngest.
- [x] Env vars novas — `BANK_SECRETS_KEY` (D-7), documentada no CLAUDE.md. Não é `NEXT_PUBLIC_*`; não entra no build.
- [ ] Breaking change — não. Sem o Inter conectado, tudo funciona como hoje.
- [x] Código novo de infraestrutura — cliente HTTP fino em `src/http/inter/` (token, `cobv`, `pix`, `webhook`), com `node:https` e certificado em memória. Não há SDK oficial do Inter em Node.
- [x] Documentação — CLAUDE.md (env var), guia do Astro "Conectar o Inter" com âncora na tela de conexão (regra 21), inventário LGPD, e changelog da spec 0115 citando esta (conexão bancária implementada aqui).

## 8. Plano de testes

Sem runner de teste no projeto (regra 20): roteiro manual no **sandbox do Inter**; viram testes
com o id no nome quando o runner existir. Credenciais de produção só em produção.

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| P-1, P-5, P-9, P-10 | manual, **antes do código** | Pedir token com os escopos do v1, criar uma `cobv` com e sem `devedor`, validar a URL do webhook no portal, pagar R$ 1,00 e ler o aviso e a consulta (sandbox, ou produção se o sandbox seguir fora) |
| CA-1 a CA-3 | manual | Conectar com credenciais certas, erradas e com usuário comum |
| CA-4, CA-10 | manual | Abrir a página duas vezes; mudar o valor e abrir de novo; conferir no Inter |
| CA-5 a CA-8 | manual (sandbox) + curl | Pagar; reenviar o aviso; token errado; `txid` desconhecido |
| CA-9 | manual | Baixa manual e cancelamento; conferir a cobrança no Inter |
| CA-11, CA-12 | manual | Remover credenciais e mandar aviso da régua; certificado de teste perto do vencimento |
| CA-13, CA-17 | manual / automatizado (futuro) | ids de outra empresa nas procedures e no webhook; `x-conta-corrente` e IP trocados |
| CA-14 | manual | Integração de teste com escopo de pagamento marcado |
| CA-15 | manual | Régua com 20 cobranças vencendo no mesmo dia; contar pedidos de token no log |
| CA-16 | manual | Pagar um PIX com o webhook desligado no Inter; rodar a rotina diária em dev |

## 9. Riscos e rollback

- **Credencial que dá acesso à conta.** Mitigação: escopos mínimos (RF-2), aviso se vierem
  escopos de pagamento, segredos cifrados (RNF-2), só dono/administrador (RNF-3). Vazou:
  revogar a integração no Internet Banking do Inter (a revogação é do Inter, não do ÓRBITA).
- **Pagamento confirmado errado.** Mitigação: nunca baixa pelo corpo do aviso, só depois de
  consultar o Inter (RNF-4); sem casamento pelo `txid`, fica "a identificar".
- **Cliente paga duas vezes** (PIX do Inter + estático antigo, ou baixa manual + PIX). Aparece
  como movimento "a identificar"; RF-7 reduz o caso.
- **Inter fora do ar.** Reserva no PIX estático (D-5); a régua não para.
- **Estorno sem aviso** (CB-8). Dívida: tratar a devolução quando o aviso do Inter suportar.
- **Certificado vence e tudo para sem barulho.** É o risco mais citado por quem já integra o
  Inter. Mitigação: avisos aos 90, 30 e 7 dias (RF-9), estado "certificado vencido" visível e
  reserva no PIX estático (RF-8).
- **IP do servidor muda** (troca de VPS ou servidor de reserva). O Inter pode bloquear o IP novo
  com 406 sem mensagem. Mitigação: reserva no PIX estático; conferir com o Inter antes de trocar
  de servidor.
- **Aviso perdido** (o Inter desiste em ~4 h). Mitigação: rede de segurança diária (RF-11).
- **Migration reversível**: só adiciona colunas e valores de enum.
- **Rollback**: desconectar o Inter na tela volta ao PIX estático sem deploy; reverter o deploy
  não apaga dados.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-31 | Weydson | Criada a partir da pesquisa de 23/10 e das credenciais liberadas pelo Inter em 31/10. |
