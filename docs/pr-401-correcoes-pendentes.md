# PR #401 — correções pendentes da revisão de código

> Backlog levantado na revisão de **2026-09-21**, sobre a branch da PR #401
> (`feature/W-astro-finance-tools-20260915`) no commit `8bc0dc63` — o merge que resolveu os
> conflitos com a `main`. **Nenhum item abaixo foi aplicado**: este documento existe para que as
> correções sejam feitas depois, em PR próprio.
>
> Nenhum dos itens é regressão do merge — todos vêm da branch. O `next build` (compilação +
> typecheck) está verde.
>
> **Ao corrigir um item aqui, marque o status e registre o PR — não apague o item.** Mesma regra de
> [`seguranca-auditoria-2026-08.md`](seguranca-auditoria-2026-08.md) e
> [`trafego-correcoes-pendentes.md`](trafego-correcoes-pendentes.md).

---

## 1. Contexto da revisão

| Métrica | Valor |
| --- | --- |
| Diff revisado | `main...HEAD` (`f2665905...8bc0dc63`) |
| Arquivos | 79 |
| Linhas | ~3.761 adicionadas / ~1.675 removidas |
| Domínios tocados | SEI (novo), payment/conciliação, trafeGO, forge/propostas, OAuth Google |
| Migrations novas | 3 (todas aditivas, sem `DROP`) |
| `next build` | **verde** (compilação + typecheck) |
| Checks de CI na PR | **nenhum** (rollup vazio) |

**Cobertura**: todo o código de servidor novo foi lido integralmente — `src/features/sei/`,
`src/features/payment/server/statements/`, `src/features/trafego/server/`, os routers de pagamento
e SEI, e as funções Inngest. As ~2.500 linhas de UI (`proposal-templates.tsx`, `copies-manager.tsx`,
`trafego-landing.tsx`) foram inspecionadas **apenas** nos pontos que a lógica de servidor toca —
uma segunda passada na camada visual continua pendente.

---

## 2. Correções — segurança

### S-1 · Guarda anti-SSRF do SEI é furada por redirect HTTP — **alta** 🔴

[`sei-client.ts:161`](../src/features/sei/server/sei-client.ts) chama `assertSafeSeiEndpoint()`,
que resolve o host e recusa endereço privado — e em seguida faz `fetch` com `redirect: "follow"`
(o padrão). O destino final nunca é revalidado, então a guarda protege só o primeiro salto.

O `endpoint` é configurável por **qualquer admin de organização** via
`integrations-platform.upsert`, e o corpo da resposta é parseado e gravado em
`SeiProcessLink.snapshot` — de onde volta ao cliente por `sei.listLeadProcesses`. É exfiltração,
não apenas saída indevida.

**Falha concreta**: o admin salva `endpoint = https://host-dele.com/sei` (público, passa na
validação). Esse host responde `302` para
`http://169.254.169.254/latest/meta-data/iam/security-credentials/`. O servidor segue o redirect,
faz o POST no metadata service da cloud e persiste a resposta no snapshot do processo.

O mesmo vale por **DNS rebinding**: `lookup()` e `fetch()` resolvem o nome de forma independente,
então o A record pode trocar para `127.0.0.1` entre a validação e a requisição.

- [ ] `redirect: "manual"` no `fetch` e tratar `3xx` como erro explícito — o WebService do SEI não
      redireciona em operação normal
- [ ] Fechar a janela do rebinding conectando no **IP já validado** em vez do hostname, fixando o
      header `Host`
- [ ] Se algum SEI real precisar de redirect, revalidar o `Location` com `assertSafeSeiEndpoint` e
      limitar a 1 salto
- [ ] Aplicar `timeout` também no `lookup()` (hoje só o `fetch` tem os 30s)

### S-2 · `isPrivateAddress` não detecta IPv4 mapeado em IPv6 — **alta** 🔴

[`sei-client.ts:37`](../src/features/sei/server/sei-client.ts) — o ramo IPv6 só reconhece `::1`,
`fc`, `fd` e `fe80:`. Um IPv4 mapeado como `::ffff:169.254.169.254` não casa com nenhum desses e é
classificado como público.

**Falha concreta**: o atacante publica um registro AAAA apontando para `::ffff:a9fe:a9fe`
(= `169.254.169.254` mapeado). `lookup()` devolve family 6, `isIP` retorna 6, a string não começa
com `fc`/`fd`/`fe80` nem é `::1` → `isPrivateAddress` devolve `false`, o host é liberado e o `fetch`
sai para o metadata service. Exatamente o que a função existe para impedir.

- [ ] Normalizar `::ffff:x.x.x.x` para IPv4 antes de aplicar `PRIVATE_IPV4`
- [ ] Acrescentar no lado IPv4: `100.64.0.0/10` (CGNAT), `198.18.0.0/15`, `192.0.2.0/24`,
      `198.51.100.0/24`, `203.0.113.0/24`, `224.0.0.0/4`
- [ ] Acrescentar no lado IPv6: `::`, `2002:` (6to4), `2001:db8:`
- [ ] Testar os casos de bypass junto com S-1 — os dois protegem a mesma fronteira

> **Spec**: S-1 e S-2 criam caminho condicional sobre dado que já existe em produção (o `endpoint`
> salvo por organização). Pela regra 17 do CLAUDE.md, vale uma spec leve em `specs/sei/` — o
> domínio SEI entrou nesta PR sem spec e sem doc de overview.

---

## 3. Correções — produto (o usuário sente)

### F-1 · Gateway PIX grava pseudo-URL e vira link morto na proposta — **alta**

[`generate-payment-link/route.ts:220`](../src/app/api/forge/generate-payment-link/route.ts) monta
`pix:<chave>?amount=...&description=...`, um esquema que **nenhum navegador resolve**, e grava em
`ForgeProposal.paymentLink`. A proposta pública renderiza esse mesmo campo como o botão "Pagar com
segurança" ([`proposal-templates.tsx:277`](../src/features/forge/components/public/proposal-templates.tsx)).

**Falha concreta**: o usuário gera a cobrança escolhendo PIX. O cliente abre a proposta, vê o botão
(`hasPayment` é `true`, porque `paymentLink` não é vazio), clica — e nada acontece. Ele também não
recebe a chave para copiar, porque o texto de fallback ("A forma de pagamento será combinada com a
empresa responsável") só aparece quando `paymentLink` é **nulo**.

- [ ] Gerar BR Code (EMV / copia-e-cola) de verdade, ou tratar PIX como `paymentMethod` próprio na
      proposta — bloco com chave, QR e botão de copiar, em vez de `<a href>`
- [ ] Enquanto não houver BR Code, o ramo PIX **não** deve preencher `paymentLink` (cai no fallback,
      que é honesto)

### C-1 · `namesMatch` casa por token genérico e auto-confere transação errada — **alta**

[`review-transaction.ts:43`](../src/features/payment/server/statements/review-transaction.ts) aceita
os nomes como equivalentes quando compartilham **qualquer** token de 3+ caracteres — e "ltda" conta.
Um match de pagador basta para o `reviewedAt` automático, porque `matches` só exige
`payer !== "divergent"`, `amount === "match"` e `date !== "divergent"`.

**Falha concreta**: o comprovante extraído traz pagador "JOAO SILVA LTDA" sem CNPJ legível
(`expectedPayerDocument` vazio, então cai no `namesMatch`), e a transação do extrato tem
`counterpartyName = "MARIA SOUZA LTDA"`. O token "ltda" está nos dois → `payerStatus = "match"`. Com
valor e data iguais (comum em mensalidade de mesmo preço no mesmo dia), `matches` fica `true` e o
código grava `reviewedAt`/`reviewedById`: a conciliação aparece **conferida pela IA** com o
comprovante de outro pagador.

- [ ] Stoplist de tokens societários: `ltda`, `eireli`, `mei`, `sa`, `me`, `epp`, `cia`
- [ ] Exigir 2+ tokens significativos em comum
- [ ] Alternativa mais conservadora: quando não houver documento em nenhum dos lados, devolver
      `unknown` em vez de `match` — a conferência fica com o humano, que é o ponto do selo

### T-1 · Corrida em `ensureTrafegoConversation` vira 500 no painel — **alta**

[`conversation-bridge.ts:18`](../src/features/trafego/server/lib/conversation-bridge.ts) faz
`findUnique` e depois `create`, sem `upsert` nem tratamento de conflito — e
`Conversation.leadId` é `@unique` no schema.

**Falha concreta**: o pedido é criado e a função Inngest `trafego-order-created` chama
`recordTrafegoSystemMessage` enquanto o cliente manda a primeira mensagem pelo painel
(`sendTrafegoMessage`) ou enquanto `sendTrafegoClientWhatsapp` persiste a saída. As duas execuções
leem `null` no `findUnique` e chamam `create` com o mesmo `leadId`: a segunda estoura `P2002`. No
caminho do painel isso é **500** para o cliente; no Inngest, execução falha e reprocessa.

- [ ] Trocar por `prisma.conversation.upsert` com `where: { leadId }`, ou capturar `P2002` e reler
      a linha
- [ ] Conferir os três chamadores (`recordTrafegoSystemMessage`,
      `persistTrafegoOutboundMessage`, `sendTrafegoMessage`) — todos passam pelo mesmo helper

---

## 4. Correções — consistência e diagnóstico

### F-2 · Asaas e Mercado Pago ignoram `response.ok` — **média**

[`generate-payment-link/route.ts:135`](../src/app/api/forge/generate-payment-link/route.ts) — só o
ramo `STRIPE` verifica `.ok`, loga o corpo e propaga a mensagem do gateway. Asaas e Mercado Pago
leem o JSON e seguem adiante.

**Falha concreta**: com a `apiKey` do Asaas expirada, `custSearch` responde 401 →
`custData?.data?.[0]?.id` é `undefined` → o POST de criação de cliente também falha →
`customerId` continua `undefined` → o POST de `/payments` sai com `customer: undefined`. Nenhuma das
três respostas é verificada, então `payData.invoiceUrl` é `undefined`, `paymentLink` fica vazio e o
usuário recebe "Failed to generate payment link from gateway" — sem "chave inválida" em lugar nenhum
e sem log do corpo do erro.

- [ ] Checar `.ok` nas três chamadas do Asaas e na do Mercado Pago, logar o corpo e propagar a
      mensagem do gateway como 502 — espelhando o ramo do Stripe
- [ ] Validar `apiKey`/`accessToken` antes de sair para a rede, como o Stripe valida o prefixo `sk_`

### T-2 · `remoteJid` nasce com `leadId` no lugar do telefone — **média**

[`conversation-bridge.ts:24`](../src/features/trafego/server/lib/conversation-bridge.ts) — sem
telefone, o fallback grava `remoteJid = "<leadId>@s.whatsapp.net"`. Como a Conversation só é criada
uma vez, o JID inválido é **permanente**, mesmo depois que o telefone aparece.

**Falha concreta**: `trafego-order-created` roda antes do cliente informar o WhatsApp
(`pendingPurchase.phone`, `owner.phone` e `whatsappNumber` todos nulos) e a Conversation nasce com
`remoteJid = "clx123abc...@s.whatsapp.net"`. Depois, um operador usa o encaminhamento de mensagem,
que deriva o destino exatamente desse campo
([`forward.ts:99`](../src/app/router/message/forward.ts) faz
`conversation.remoteJid.replace("@s.whatsapp.net", "")`) e tenta enviar para um cuid como se fosse
número.

- [ ] Não criar a Conversation sem telefone conhecido (adiar), ou atualizar `remoteJid` quando o
      telefone chegar
- [ ] `forward.ts` deveria validar que o JID parece um número antes de enviar

### T-3 · Criativos extras entram no total, mas não na economia da faixa — **média**

[`pricing-tiers.ts:158`](../src/features/trafego/lib/pricing-tiers.ts) — `totalBrlCents` passou a
incluir `extraCreativesBrlCents`, mas o `upgradedTotal` usado em `nextTierSavingBrlCents` **não**.
A economia exibida na landing (`investment-simulator.tsx:125`, "<valor> a menos") fica inflada pelo
valor exato dos extras.

E uma divergência **latente, mais séria**: [`trafego-landing.tsx:320`](../src/features/trafego/components/public/trafego-landing.tsx)
e `investment-simulator.tsx:36` chamam `quoteTrafego(adBudgetBrlCents, needsSetup)` **sem** os dois
argumentos novos, enquanto o servidor
([`checkout/trafego/route.ts:140`](../src/app/api/checkout/trafego/route.ts)) cobra com eles. Hoje
não vaza porque nenhum cliente envia `desiredCreativeCount` — mas o schema público já aceita
`1..20`, então **o primeiro que enviar é cobrado acima do total que viu na tela**.

- [ ] Somar os extras também no `upgradedTotal`
- [ ] Repassar `extraCreatives`/`extraCreativeBrlCents` nos dois chamadores de UI — os valores já
      vêm de `trafego.public.getConfig` (`includedCreatives`, `extraCreativeBrlCents`)
- [ ] Decidir se o wizard público vai oferecer criativos extras; se não for oferecer, remover
      `desiredCreativeCount` do schema público em vez de deixar a porta aberta

### A-1 · Guarda de acesso do SEI lança `Error` cru — **baixa**

[`sei/_access.ts:8`](../src/app/router/sei/_access.ts) lança
`new Error("Lead não encontrado nesta organização.")` em vez de `errors.NOT_FOUND({ message })`.

**Falha concreta**: um usuário chama `sei.linkProcess` ou `sei.listLeadProcesses` com `leadId` de
outra organização (ou já apagado). O oRPC não reconhece o `Error` como falha de domínio, responde
`INTERNAL_SERVER_ERROR` e registra stack trace — alerta de 500 em produção para o que é só entrada
inválida, e a UI não distingue "lead não é seu" de falha real do servidor.

- [ ] Receber `errors` no handler e lançar `errors.NOT_FOUND`, ou lançar `ORPCError` — como
      [`request-sync.ts`](../src/app/router/sei/request-sync.ts) já faz no mesmo router

---

## 5. Checklist consolidado

| Id | Item | Peso | Área | Status |
| --- | --- | --- | --- | --- |
| S-1 | **SSRF: `fetch` do SEI segue redirect sem revalidar** | Alta | Segurança | ⬜ |
| S-2 | **SSRF: IPv4 mapeado em IPv6 passa como público** | Alta | Segurança | ⬜ |
| F-1 | Gateway PIX gera link morto na proposta pública | Alta | Forge | ⬜ |
| C-1 | `namesMatch` auto-confere conciliação errada | Alta | Conciliação | ⬜ |
| T-1 | Corrida em `ensureTrafegoConversation` vira 500 | Alta | trafeGO | ⬜ |
| F-2 | Asaas e Mercado Pago ignoram `response.ok` | Média | Forge | ⬜ |
| T-2 | `remoteJid` nasce com `leadId` | Média | trafeGO | ⬜ |
| T-3 | Extras fora do `upgradedTotal`; UI sem os novos args | Média | trafeGO | ⬜ |
| A-1 | Guarda do SEI lança `Error` cru → 500 | Baixa | SEI | ⬜ |

### Ordem sugerida

1. **PR 1 — SSRF do SEI**: S-1 e S-2 juntos, com a spec em `specs/sei/`. Protegem a mesma fronteira
   e os testes de bypass são os mesmos. É o único grupo que eu trataria como bloqueante para deixar
   o SEI ativo em produção.
2. **PR 2 — o que o cliente vê**: F-1 e C-1. Um entrega link morto para quem vai pagar; o outro
   marca conciliação como conferida com o comprovante errado. Não compartilham arquivo, mas
   compartilham urgência.
3. **PR 3 — trafeGO**: T-1, T-2 e T-3. Os dois primeiros são o mesmo arquivo
   (`conversation-bridge.ts`) e o mesmo conceito (a Conversation do lead).
4. **PR 4 — arestas**: F-2 e A-1. Diagnóstico e tipo de erro; sem risco de dado.

---

## 6. Já corrigido no merge de conflitos (`8bc0dc63`)

Três bugs que já existiam na branch e impediam o `next build` de fechar:

| Arquivo | Problema | Status |
| --- | --- | --- |
| [`20260915170000_sei_integration/migration.sql`](../prisma/migrations/20260915170000_sei_integration/migration.sql) | FK apontava para a tabela `lead`; o nome real é `leads`. `prisma migrate deploy` quebrava com `42P01` em qualquer ambiente, inclusive no deploy | ✅ |
| [`trafego/support.ts`](../src/app/router/trafego/support.ts) | o `order` de `assertOwnedOrder` era reatribuído com o resultado rico do `findUniqueOrThrow`; o TypeScript não vê `lead`/`pendingPurchase` | ✅ |
| [`generate-payment-link/route.ts`](../src/app/api/forge/generate-payment-link/route.ts) | `customerEmail` é opcional no schema Zod e ia direto para `encodeURIComponent` | ✅ |

---

## 7. Lacunas de processo, para decidir à parte

- **Não há CI nesta PR** — o `statusCheckRollup` volta vazio, então o único portão foi o
  `next build` local. Vale ligar o build como check obrigatório antes de PRs deste tamanho. Ver
  [`testes-estrategia.md`](testes-estrategia.md).
- **O domínio SEI entrou sem spec e sem doc de overview**, contra as regras 17 e 19 do CLAUDE.md.
  As correções de S-1/S-2 são a oportunidade natural de escrever a spec.
- **O typecheck estoura o heap padrão do Node** (8 GB) neste diff — foi preciso
  `NODE_OPTIONS=--max-old-space-size=16384`. Se o build de produção rodar com o padrão, vai falhar
  por OOM, não por erro de tipo.
- **Revisão de UI pendente**: ~2.500 linhas (`proposal-templates.tsx`, `copies-manager.tsx`,
  `trafego-landing.tsx`) não passaram por leitura completa.
