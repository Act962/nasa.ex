---
id: 0010
titulo: Corrigir normalização de telefone BR e estruturar erros do outbound
dominio: tracking-chat
status: implementada
autor: João Gabriel
criada: 2026-09-03
atualizada: 2026-09-03
branch: claude/tracking-chat-update-49409d
pr:
peso: leve
---

# 0010 — Corrigir normalização de telefone BR e estruturar erros do outbound

---

## 1. Contexto

Dois followups 🔴 **high** do code review adversarial da Fase 6 (registrados em
[`docs/whatsapp-oficial-overview.md`](../../docs/whatsapp-oficial-overview.md)
§12.1, itens **#12** e **#14**) seguem abertos. Ambos vivem no caminho de envio
outbound do chat e ambos só se manifestam com `provider = META_CLOUD`, que é
justamente o caminho que está saindo do sandbox.

### #12 — `normalizePhoneToMetaE164` corrompe telefone BR de 12 dígitos

`normalizePhoneToMetaE164` existe porque o `wa_id` que a Meta entrega no webhook
pode vir sem o 9º dígito brasileiro. A regra atual insere o `9` em **qualquer**
número de 12 dígitos que comece com `55`:

```ts
if (digits.length === 12 && digits.startsWith("55")) {
  const ddd = digits.slice(2, 4);
  const rest = digits.slice(4);
  return `55${ddd}9${rest}`;
}
```

O próprio JSDoc da função reconhece o furo e o classifica como aceitável ("99,9%
dos casos são mobile sem o 9"). O problema é o que acontece no 0,1%: um telefone
**fixo** brasileiro (`5586` + `32211234`, 12 dígitos) vira `5586932211234` — um
celular que **existe e pertence a outra pessoa**. O envio não falha: entrega a
mensagem ao destinatário errado. Dados de lead do cliente vazam para um terceiro.

Fixos entram na base por três portas que não validam formato de celular:
cadastro manual de lead, importação de CSV e integrações. Nenhuma delas
consegue distinguir hoje "mobile antigo sem o 9" de "fixo".

| Entrada (12 díg.) | Primeiro dígito local | Hoje | Correto |
| --- | --- | --- | --- |
| `558688923098` | `8` — mobile antigo | `5586988923098` ✅ | `5586988923098` |
| `558632211234` | `3` — fixo | `5586932211234` ❌ **entrega a terceiro** | `558632211234` |
| `558672345678` | `7` — mobile antigo | `5586972345678` ✅ | `5586972345678` |

### #14 — Erros do resolver retornam 500 em vez de `BAD_REQUEST` estruturado

`resolveOutboundProvider(trackingId)` lança erros de domínio já modelados
(`InstanceNotFoundError`, `MetaCredentialsIncompleteError`) que carregam `code` e
campos úteis. Em 13 dos 15 call-sites a chamada está **fora** de qualquer
try/catch: o erro sobe cru, vira 500 e o frontend cai no
`toast.error("Erro ao enviar mensagem")` genérico de
[`show-send-error.tsx`](../../src/features/tracking-chat/lib/show-send-error.tsx).

O atendente que não tem instância configurada recebe a mesma mensagem de quem
teve um timeout de rede. Só `create-template.ts` faz o mapeamento certo, inline.

O mesmo vale para os erros lançados **pelo envio**: `OutboundWindowClosedError`
(`META_WINDOW_CLOSED`) e `ProviderSendInvalidResponseError`. O overview afirma
que a janela de 24h devolve "erro estruturado `META_WINDOW_CLOSED`" — na
prática nenhum handler mapeia, então também sai como 500.

## 2. Objetivo

Nenhuma mensagem sai para um número diferente do que o operador escolheu, e todo
erro de configuração ou de janela do outbound chega ao frontend com `code`
próprio em vez de 500 genérico.

### Não-objetivos

- **Validar telefone no `createLead` / `createLeadWithTags` / import CSV.** O
  followup #12 sugeria rejeitar < 13 dígitos quando DDI = 55. Fica de fora: a
  esmagadora maioria dos trackings em produção é Uazapi, onde fixo e número de
  12 dígitos são dados legítimos que já existem na base. Rejeitá-los no cadastro
  quebraria clientes que não têm nada a ver com a Meta, para resolver um
  problema que é da fronteira de envio da Meta. A correção fica onde o dano
  acontece.
- **Gating preventivo de UI para features Meta-unsupported** (followup #10) —
  continua aberto.
- **Refactor do campo `uazapiToken` na PORT** (followup #22).
- Qualquer mudança de schema. Esta spec não tem migration.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | `normalizePhoneToMetaE164` só insere o 9º dígito quando o número tem 12 dígitos, começa com `55` e o primeiro dígito do número local é `6`, `7`, `8` ou `9` (faixa de celular pela ANATEL). |
| RF-2 | Números BR de 12 dígitos cujo número local começa com `2`–`5` (fixos) são devolvidos sem modificação. |
| RF-3 | Erros que descendem de `OutboundProviderError` viram `ORPCError("BAD_REQUEST")` com `data.code` e os campos específicos da subclasse (`feature`, `fields`, `providerId`). |
| RF-4 | O mapeamento cobre tanto a resolução do provider quanto a falha de envio, em todos os handlers `router/message/*` e `router/conversation/*` que chamam `resolveOutboundProvider`. |
| RF-5 | Erros que **não** são de domínio outbound sobem inalterados — nada vira `BAD_REQUEST` por engano. |
| RF-6 | `forward` preserva o `code` por destino no array de resultados, em vez de `String(err)`. |
| RF-7 | `showSendMessageError` renderiza mensagem própria para `INSTANCE_NOT_FOUND`, `META_CREDENTIALS_INCOMPLETE`, `META_WINDOW_CLOSED`, `META_FEATURE_UNSUPPORTED` e `PROVIDER_SEND_INVALID_RESPONSE`. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | `normalizePhoneToMetaE164` continua pura, síncrona e idempotente — sem I/O. |
| RNF-2 | O mapeamento de erro não adiciona query nem round-trip: opera sobre o erro já em mãos. |
| RNF-3 | Nenhum segredo (token, `apiKey`, credencial Meta) entra na mensagem ou no `data` devolvido ao client. |

## 4. Critérios de aceite

- [x] **CA-1** — Dado o telefone `558688923098` (mobile antigo, local começa com `8`), quando enviado por tracking `META_CLOUD`, então o `to` do POST ao Graph é `5586988923098`.
- [x] **CA-2** — Dado o telefone `558632211234` (fixo, local começa com `3`), quando enviado, então o `to` é `558632211234` — inalterado, sem o `9` injetado.
- [x] **CA-3** — Dado o telefone `558672345678` (mobile antigo faixa 7), quando enviado, então o `to` é `5586972345678`.
- [x] **CA-4** — Dado um tracking sem `WhatsAppInstance`, quando o atendente envia texto, então a resposta é `BAD_REQUEST` com `data.code === "INSTANCE_NOT_FOUND"` (não 500).
- [x] **CA-5** — Dado um tracking `META_CLOUD` com a janela de 24h fechada, quando o atendente envia texto livre, então a resposta é `BAD_REQUEST` com `data.code === "META_WINDOW_CLOSED"`.
- [x] **CA-6** — Dado um erro genérico no envio (timeout de rede), quando ele sobe, então continua sendo erro não-mapeado — o comportamento atual não muda.
- [x] **CA-7** — Dado um `forward` para 3 conversas em que uma falha por credencial incompleta, então o item correspondente traz `code: "META_CREDENTIALS_INCOMPLETE"` e as outras duas seguem com `success: true`.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Telefone já com 13 dígitos (`5586988923098`) | Devolvido como veio. Idempotente — normalizar duas vezes dá o mesmo resultado. |
| CB-2 | Telefone internacional de 12 dígitos que não começa com `55` (ex.: `351912345678`) | Intocado. A regra do 9º dígito é exclusiva do Brasil. |
| CB-3 | Telefone de 12 dígitos começando com `55` cujo local começa com `0` ou `1` | Faixa inexistente na numeração brasileira. Intocado — melhor a Meta recusar com `131030` do que adivinhar. |
| CB-4 | Telefone com formatação cosmética (`+55 (86) 9 8892-3098`) | `replace(/\D/g, "")` roda antes de tudo; comportamento idêntico ao da string limpa. |
| CB-5 | String vazia ou sem dígitos | Devolve string vazia. Quem consome (`provider.send*`) já falha adiante com erro da Meta — não é papel do normalizador validar. |
| CB-6 | `provider = UAZAPI` | Não passa por `normalizePhoneToMetaE164`. O normalizador é chamado só pelo adapter Meta. Uazapi segue intocado. |
| CB-7 | Resolver falha **depois** de `chargeMessageOutbound` | Não acontece: o resolver roda antes do charge desde o fix #13. O mapeamento preserva essa ordem — só troca o formato do erro. |
| CB-8 | Erro de domínio outbound lançado dentro do `Promise.allSettled` do `forward` | Não vira `ORPCError` (o forward não aborta a requisição inteira): vira item de resultado com `success: false` + `code`. |
| CB-9 | Handler que já mapeia inline (`create-template.ts`, gates `edit`/`delete`/`buttons`) | Passa a usar o helper compartilhado. O `code` na resposta permanece igual — sem breaking change para o frontend. |
| CB-10 | Frontend antigo (bundle em cache) recebendo os novos `code` | `showSendMessageError` já tem fallback genérico; `code` desconhecido cai nele. Degradação suave. |

## 6. Decisões de design

### D-1 — Faixa de celular `6-9`, não `8-9` como sugeria o followup

- **Escolha**: inserir o 9º dígito quando o primeiro dígito do número local for `6`, `7`, `8` ou `9`.
- **Alternativa descartada**: a proposta original do followup #12 (`digits[4] === "8" || digits[4] === "9"`). Ela conserta o vazamento para fixos, mas passa a **quebrar** celulares antigos das faixas 6 e 7, que a ANATEL também migrou para 9 dígitos — trocaria um bug raro por outro.
- **Consequência**: a regra passa a ser exatamente a da ANATEL (fixos ocupam `2`–`5`, móveis `6`–`9`), sem faixa cinzenta. Ambas as classes de erro ficam cobertas.

### D-2 — Helper que devolve o erro em vez de lançar

- **Escolha**: `mapOutboundError(error): unknown` devolve um `ORPCError` quando reconhece o erro e o **original** quando não reconhece; o call-site escreve `throw mapOutboundError(error)`.
- **Alternativa descartada**: helper que recebe o objeto `errors` do oRPC (`mapOutboundError(err, errors)`, como sugeria o followup). O `errors.BAD_REQUEST` do projeto é tipado sem schema de `data`, o que obriga `as never` em cada call-site e torna a assinatura do helper frágil a variância de parâmetro. `ORPCError` direto é o padrão já usado em [`router/comments/_errors.ts`](../../src/app/router/comments/_errors.ts).
- **Consequência**: call-site de uma linha, sem cast, e o helper fica testável isoladamente sem montar um contexto oRPC.

### D-3 — Mapear também a falha de envio, não só a do resolver

- **Escolha**: o mesmo helper cobre o `catch` do `provider.send*`.
- **Alternativa descartada**: limitar ao resolver, como o followup #14 descrevia literalmente.
- **Consequência**: `META_WINDOW_CLOSED` e `PROVIDER_SEND_INVALID_RESPONSE` passam a chegar estruturados — o overview já afirmava que o primeiro era estruturado, o que não era verdade. Custo marginal: as mesmas linhas de `catch` já existiam.

## 7. Impacto

- [ ] Schema / migration
- [x] Procedures oRPC (contrato de **saída**: erros antes 500 agora `BAD_REQUEST` com `data.code`; nenhum contrato de entrada muda)
- [ ] Realtime
- [ ] Automações
- [ ] Env vars novas
- [ ] Breaking change para clientes existentes — o frontend já tem fallback genérico para `code` desconhecido (CB-10)
- [x] Documentação obrigatória (CLAUDE.md item 14 — `docs/whatsapp-oficial-overview.md`)

## 9. Riscos e rollback

**Risco 1 — mobile BR de 12 dígitos numa faixa fora de `6`–`9`.** Não existe na
numeração brasileira; se aparecer, o número deixa de receber e a Meta devolve
`131030`. Falha visível e sem dano, contra o comportamento atual de entrega
silenciosa ao número errado. Trade-off aceito conscientemente.

**Risco 2 — erro que hoje sobe como 500 e é observado por alguma automação que
depende do status.** Nenhum consumidor conhecido faz isso; o `showSendMessageError`
lê `data.code` com fallback.

**Rollback**: sem migration e sem estado persistido. Reverter os commits restaura
o comportamento anterior; nada precisa ser desfeito no banco.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-03 | João Gabriel | Criada e implementada — fecha followups #12 e #14 (e, de tabela, #15) do overview do WhatsApp Oficial |
