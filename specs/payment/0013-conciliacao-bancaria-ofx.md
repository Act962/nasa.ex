---
id: 0013
titulo: Conciliação bancária por importação de extrato OFX
dominio: payment
status: implementada
autor: Weydson
criada: 2026-09-14
atualizada: 2026-09-14
branch: feature/W-trafego-self-service-20260908
pr:
peso: completa
---

# 0013 — Conciliação bancária por importação de extrato OFX

---

## 1. Contexto

O financeiro é alimentado à mão: toda entrada e saída da conta Nubank PJ precisa
ser digitada como lançamento. O pedido foi que o banco alimentasse o sistema
sozinho, **sem custo mensal**.

A pesquisa fechou o caminho automático:

- **O Nubank não tem API.** Não existe portal de desenvolvedor nem API de conta
  PJ. O `NuPay for Business` é checkout para e-commerce, não acesso à conta.
- **Open Finance exige agregador pago.** Um SaaS não regulado não se conecta
  direto — precisa de instituição autorizada pelo BCB. Pluggy a partir de
  R$ 2.500/mês, Belvo US$ 1.000/mês; nenhum tem plano gratuito de produção. O
  "Meu Pluggy", gratuito, proíbe uso comercial no próprio FAQ.
- **`pynubank` e similares estão mortos** desde que o Nubank passou a exigir
  verificação facial (ago/2023), e expõem a conta do cliente a bloqueio.

Sobra o **OFX**, que se mostrou melhor do que o esperado: o Nubank exporta com
**FITID em todas as transações** (identificador estável do banco), o MEMO traz a
contraparte do Pix com nome e CNPJ, o formato está estável desde 2021, e o app
oferece **envio recorrente por e-mail** — o que abre a automação futura sem
mensalidade.

## 2. Objetivo

Importar o extrato da conta e resolver cada transação contra os lançamentos já
existentes, sem duplicar o que foi cadastrado à mão.

### Não-objetivos

- Integração com agregador de Open Finance — descartada por custo, com a
  fronteira preparada para quando deixar de ser problema.
- Criar lançamento automaticamente para toda transação: duplicaria a conta a
  receber que já estava cadastrada.
- Sobrescrever `PaymentBankAccount.balance` com o saldo do extrato. Ele é
  digitado pelo usuário e alimenta o saldo inicial da projeção.
- Importar fatura de cartão de crédito (bloco `CREDITCARDMSGSRSV1`).

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | O usuário escolhe a conta e sobe um arquivo `.ofx`; as transações entram numa fila |
| RF-2 | Reimportar o mesmo período não duplica nem ressuscita transação ignorada |
| RF-3 | O sistema sugere o lançamento em aberto que combina, mostrando **por que** combina |
| RF-4 | Conciliar aplica a baixa no lançamento (`PAID` ou `PARTIAL`) e marca a transação |
| RF-5 | É possível criar um lançamento novo a partir da transação, já quitado |
| RF-6 | É possível ignorar uma transação e restaurá-la depois |
| RF-7 | É possível desfazer uma conciliação, estornando o valor no lançamento |
| RF-8 | O extrato de uma conta não pode ser importado sobre outra conta |
| RF-9 | Tudo isolado por organização |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Nenhum valor monetário passa por ponto flutuante |
| RNF-2 | Nenhuma data sofre deslocamento por fuso |
| RNF-3 | A sugestão do lote inteiro é calculada em uma varredura, sem N+1 |

## 4. Critérios de aceite

- [x] **CA-1** — Dado um OFX do Nubank, a importação lê banco, conta, período,
      saldo e todas as transações, com valores exatos em centavos.
- [x] **CA-2** — Dado um OFX com `ENCODING:USASCII`/`CHARSET:1252` e tags não
      fechadas, o parser lê corretamente.
- [x] **CA-3** — Dada uma transação de 04/09, ela é gravada como 04/09,
      independentemente do fuso.
- [x] **CA-4** — Dado o mesmo arquivo importado duas vezes, a segunda reporta
      zero novas e nada é criado.
- [x] **CA-5** — Dadas três parcelas de mesmo valor e três transações, cada
      transação recebe um lançamento diferente.
- [x] **CA-6** — Dada uma transação com valor, data e CNPJ conferindo, a
      sugestão sai com confiança alta e os motivos visíveis.
- [x] **CA-7** — Dados dois lançamentos igualmente compatíveis, a sugestão é
      marcada como ambígua.
- [x] **CA-8** — Dada uma entrada de dinheiro, nenhum lançamento a pagar é
      sugerido.
- [x] **CA-9** — Dada uma conciliação confirmada, o lançamento fica `PAID` e a
      transação sai da fila.
- [x] **CA-10** — Dado um desfazer, o lançamento volta a `PENDING` com o valor
      estornado.
- [x] **CA-11** — Dado um extrato de outra conta, a importação é recusada com a
      conta correta na mensagem.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Transação sem FITID | Id sintético determinístico + aviso de que reimportar pode duplicar |
| CB-2 | FITID repetido no mesmo arquivo | Só a primeira ocorrência entra; aviso na tela |
| CB-3 | Transação ignorada, arquivo reimportado | Continua ignorada — o `@@unique` impede recriação |
| CB-4 | Valor maior que o saldo em aberto do lançamento | Conciliação recusada |
| CB-5 | Lançamento cancelado | Nunca é sugerido nem aceito |
| CB-6 | Recebimento em dois Pix | Ambos casam com a mesma entry, que fica `PARTIAL` e depois `PAID` |
| CB-7 | CPF mascarado no MEMO | Guardado como veio; pontua menos que documento completo; nunca é desmascarado |
| CB-8 | Lote apagado | `importId` vira nulo, a transação permanece — a idempotência não pode ser perdida |
| CB-9 | Arquivo que não é extrato bancário | Erro explicando que pode ser fatura de cartão |
| CB-10 | **Sicoob**: `<STMTTRN>` sem `<DTPOSTED>` | Data cai para o `DTEND` do bloco e, em último caso, para o prefixo `AAAAMMDD` do FITID sintético |
| CB-11 | **BB**: pseudo-lançamentos "Saldo Anterior"/"Saldo do dia" com FITID vazio | Ignorados — não são movimentação. Chegam a 36% dos blocos num extrato PJ real |
| CB-12 | **BB**: mesmo FITID em transações distintas | Cada reaparição ganha sufixo posicional (`fitid#2`). Tratar como duplicata descartaria movimento legítimo — 28 lançamentos colapsariam em 2 |
| CB-13 | Tag vazia fechada (`<FITID></FITID>`) | Lida como string vazia, não como nó aninhado |

## 6. Decisões de design

### D-1 — Uma fronteira única de escrita

`NormalizedStatement` + `ingestStatement` em `server/statements/`. O parser OFX é
apenas um produtor desse tipo.

- **Alternativa descartada**: o parser escrever direto no banco. Funcionaria hoje
  e obrigaria a reescrever tudo quando entrar a segunda fonte.
- **Consequência**: inbox de e-mail e agregador viram adaptadores.

### D-2 — Idempotência estrutural, não por consulta

`@@unique([organizationId, accountId, externalId])` + `createMany({ skipDuplicates })`.

- **Alternativa descartada**: `count()` antes de inserir, como o trafeGO faz por
  `documentNumber` — sujeito a corrida e sem garantia do banco.
- **Consequência**: `accountId` na chave significa que importar o mesmo arquivo
  em duas contas diferentes duplicaria; daí a validação de RF-8.

### D-3 — Parser próprio em vez de biblioteca

O plano previa `ofx-data-extractor`. Ela foi instalada, testada e **removida**:
normaliza a data no momento do parse — `20260904000000[-3:BRT]` chega como
`2026-09-04` e o fuso se perde antes de qualquer opção de configuração.

- **Escolha**: `lib/ofx/parse-sgml.ts`, ~90 linhas, que trata tags fechadas e não
  fechadas (OFX permite `<TRNAMT>100.00` sem fechamento).
- **Consequência**: uma dependência a menos processando dado bancário, e controle
  total sobre valor, data e encoding — que são exatamente os três riscos da §9.

### D-4 — Atribuição gulosa global, não melhor-candidato-por-transação

Todos os pares são ordenados por pontuação e cada lançamento é consumido uma vez.

- **Alternativa descartada**: escolher o melhor para cada transação isoladamente.
  Erra sistematicamente em parcelas de mesmo valor — a mesma parcela seria
  sugerida para todas as transações.

### D-5 — Lançamento criado do extrato pula a aprovação

O dinheiro já se moveu na conta; exigir aprovação de fato consumado encheria a
fila do Master sem decisão possível. Diverge de `createPaymentEntry`, e é por
isso que está escrito aqui.

### D-8 — Compatibilidade por banco mora no parser, não no schema

Pesquisa sobre Sicoob, BB e Caixa mostrou que cada banco desvia da especificação
OFX de um jeito próprio. Os desvios são absorvidos em `parse-statement.ts` e
`parse-sgml.ts`, sem tabela de exceções por instituição e sem mudança de schema.

| Banco | API de extrato PJ | Webhook Pix | OFX | Desvio observado |
| --- | --- | --- | --- | --- |
| **Sicoob** | Sim (`cco_extrato`, 3 meses, grátis para cooperado) | Sim | Sim | `<STMTTRN>` sem `<DTPOSTED>`; FITID sintético (data+valor+seq) |
| **Banco do Brasil** | Sim ("API de Extratos", melhor doc e sandbox) | Sim | Sim | FITID vazio em linhas de saldo; FITID repetido entre transações distintas |
| **Caixa** | Não confirmada — só Pix, SOAP/CNAB legado | Sim (Pix Automático) | Sim (60 dias; escolher variante **completa**) | Não verificado — sem arquivo real disponível |

**Por que não integrar as APIs agora**: nos três bancos a credencial é do
correntista, por conta, com certificado e-CNPJ A1 e cadastro via gerente. Não há
credenciamento de parceiro que permita falar por N organizações. Cada tenant
exigiria coletar `.PFX`, senha e `client_id`, e renovar o certificado todo ano —
o SaaS viraria custodiante de certificado digital alheio. O OFX não tem esse
custo e cobre os três.

**O que vale no futuro**: webhook de Pix recebido, que é a única coisa que o OFX
não resolve (entrada em tempo real). Escopo pequeno, independente do extrato, e
opt-in por tenant.

### D-7 — O arquivo não passa pelo storage

Previa-se reusar o upload de anexos (`/api/payment/attachments/upload`), guardando
o arquivo original para auditoria. Na primeira importação real o storage recusou
as credenciais (`upload_failed Unauthorized`), e ficou claro que a dependência
não se justifica: um extrato mensal tem dezenas de KB.

- **Escolha**: o navegador lê os bytes e envia em **base64** para a procedure. O
  encoding continua sendo detectado no servidor a partir do cabeçalho — mandar
  como texto já decodificado destruiria essa informação.
- **Consequência**: o arquivo original não fica arquivado. A auditoria sobrevive
  pelo `fileHash` do lote e pelo `rawPayload` de cada transação. `attachmentId`
  segue no modelo, opcional, para quando alguém quiser anexar o extrato também
  como documento.

### D-6 — Sugestão não é persistida

Calculada a cada listagem. Lançamento editado ou quitado por outro caminho
tornaria a sugestão guardada obsoleta em silêncio.

## 7. Impacto

- [x] Schema / migration — 2 tabelas, 4 enums, 4 colunas, 1 valor de enum
- [x] Procedures oRPC — sub-router `statements`
- [ ] Realtime · [ ] Automações · [ ] Env vars · [ ] Breaking change

## 8. Plano de testes

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1 a CA-3 | manual | Parser exercitado contra dois OFX de formatos diferentes |
| CA-5 a CA-8 | manual | Motor de match exercitado com parcelas idênticas e direções opostas |
| CA-4, CA-9 a CA-11 | manual | Dependem da migration aplicada |

> CA-1 a CA-11 verificados em 14/09/2026. CA-1 a CA-8 rodando parser e motor
> isoladamente; CA-9 a CA-11 contra o banco de dev (org GOTHAN CITY), com os
> lançamentos de setembro e um extrato que reproduz os mesmos valores.
>
> **Ainda não verificado**: o formato do OFX **PJ real** do Nubank (o arquivo de
> teste reproduz o formato documentado) e a **estabilidade do FITID** entre duas
> exportações do mesmo período.

## 9. Riscos e rollback

Migration aditiva (zero `DROP`), reversível com `DROP TABLE` das duas tabelas.

| Risco | Mitigação |
| --- | --- |
| Centavos por ponto flutuante | Parse por string; verificado com `1234.56`, `0.01`, `1.234,56` |
| Fuso deslocando o dia | `postedAt` (instante) + `postedDate` (meio-dia UTC) |
| Encoding lido errado | Sniff do header antes de decodificar |
| FITID instável entre exportações | **Não verificado** — exportar o mesmo mês duas vezes e comparar antes de confiar |
| OFX real do Nubank PJ | O parser foi validado contra o formato documentado, **não contra um arquivo PJ real** |
| CPF de terceiro no MEMO (LGPD) | Guardado como veio, com marcação de mascarado; nunca desmascarado |

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-14 | Weydson | Criada e implementada. D-3 mudou durante a implementação: a biblioteca prevista no plano perdia o fuso da data e foi substituída por parser próprio |
| 2026-09-14 | Weydson | D-8 e CB-10..13: pesquisa sobre Sicoob, BB e Caixa revelou três desvios de formato que quebravam o parser — Sicoob sem DTPOSTED, BB com FITID vazio em linhas de saldo e BB com FITID repetido entre transações distintas. Todos corrigidos e testados contra arquivos que reproduzem os formatos reais |
| 2026-09-14 | Weydson | Verificada de ponta a ponta em dev: CA-1 a CA-11 passaram, incluindo idempotência, conciliação, desfazer e recusa de extrato de outra conta |
| 2026-09-14 | Weydson | D-7: a importação deixou de passar pelo storage. A primeira tentativa real falhou com `upload_failed Unauthorized` no S3, e o arquivo é pequeno demais para justificar o intermediário |
