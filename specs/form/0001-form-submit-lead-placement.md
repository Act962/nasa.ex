---
id: 0001
titulo: Posicionamento de lead no submit público de formulário
dominio: form
status: em-revisao
autor: João Gabriel
criada: 2026-08-07
atualizada: 2026-08-07
branch: feature/form-fix-submit-deadlock-20260807
pr:
peso: completa
---

# 0001 — Posicionamento de lead no submit público de formulário

> **Spec de referência.** Foi escrita depois do bug, reconstruindo o que uma spec
> teria capturado antes dele. Serve de exemplo de preenchimento — em especial das
> seções 5 (casos de borda) e 6 (decisões de design), que são as que teriam
> evitado o incidente.

---

## 1. Contexto

O submit público (`form.submitResponse`) posiciona o lead no tracking/coluna
configurados no formulário. Quando o telefone já existe na organização, o lead
existente é **realocado** em vez de duplicado.

Em produção (`orbita.nasaex.com`), o submit passou a devolver **500** com o toast
"Algo deu errado" — de forma intermitente. Reproduzido de forma determinística
no form `cmp2d117x00ki0urqo83z9rgt` com o telefone `551111111111`: **3 falhas em
3 tentativas, sempre em ~5,2 s**.

Causa raiz, com evidência do próprio Postgres durante a falha:

```
blocked_pid 639: INSERT INTO lead_journey_events   ← trackLeadEvent (conexão do prisma global)
blocking_pid 683: UPDATE leads SET tracking_id...  ← a transação, "idle in transaction"
```

```
[form/submitResponse] PrismaClientKnownRequestError:
Transaction API error: A query cannot be executed on an expired transaction.
The timeout for this transaction was 5000 ms, however 5019 ms passed
```

`trackLeadEvent()` usa o **cliente Prisma global**, mas é chamado **de dentro** da
`$transaction` do submit. Rodando em outra conexão, o `INSERT` em
`lead_journey_events` precisa validar a FK contra a linha de `leads` que a própria
transação acabou de travar. A transação não avança porque espera o
`trackLeadEvent`; o `trackLeadEvent` não avança porque espera a transação.
Espera circular resolvida só pelo timeout de 5 s.

**Duas correções anteriores não resolveram** porque miravam outra causa: o PR #369
(`fd3b36a6`) corrigiu um 500 real, vindo de `responseId` obsoleto do resume, e o
assunto foi dado como encerrado. O 500 por realocação continuou — nunca foi
enumerado como caminho distinto.

### Por que passou despercebido

O comportamento depende de **em qual tracking o lead já estava** — um dado que só
existe em produção:

| Situação do lead | Caminho | Escreve em `leads`? | Resultado observado |
| --- | --- | --- | --- |
| Já está no tracking do form | `reused` | não | ✅ 200 |
| Está em **outro** tracking | `relocated` | sim | ❌ **500** |
| Não existe | `created` | sim (dentro da tx) | ⚠️ 200, mas perde evento de jornada |

Só o primeiro caminho era exercitado nos testes manuais. O terceiro esconde um
**segundo defeito, silencioso**: o lead é criado dentro da transação e ainda não
é visível para a outra conexão, então o `INSERT` falha com
`lead_journey_events_lead_id_fkey`. Como `trackLeadEvent` engole o erro, o submit
retorna 200 e **os eventos de jornada desses leads nunca são gravados**.

## 2. Objetivo

O submit público posiciona o lead no tracking/coluna do formulário e registra os
eventos de jornada corretamente **nos três caminhos** (criado, realocado,
reusado), sem estourar a transação.

### Não-objetivos

- **Não** unifica leads duplicados. A mescla continua sendo ação manual do board
  (`merge-leads`), fora do submit.
- **Não** altera a regra de resolução por telefone (escopo org, normalização).
- **Não** mexe no fluxo de rascunho/retomada de sessão, já coberto pelo PR #369.
- **Não** altera o contrato de entrada/saída da procedure.
- **Não** corrige o mesmo padrão nos outros 9 arquivos que chamam
  `trackLeadEvent` dentro de transação — vira spec própria (ver §7).

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Telefone inexistente na org → cria lead no tracking/coluna do form. |
| RF-2 | Telefone existente em **outro** tracking da org → realoca a mesma linha para o tracking/coluna do form, sem duplicar. |
| RF-3 | Telefone existente **no** tracking do form → reusa a linha; move de coluna se a coluna diferir. |
| RF-4 | Os eventos de jornada (`form_submit`, `status_changed`, `utm_landing`) são gravados nos três caminhos. |
| RF-5 | Falha ao gravar evento de jornada não derruba o submit, mas **é logada de forma visível** — nunca engolida em silêncio. |
| RF-6 | Realocação publica o movimento no realtime do board (origem e destino) e dispara o alerta de mudança de status. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | A `$transaction` contém **exclusivamente** escritas de banco. Nenhuma chamada de rede (HTTP, Pusher, Inngest) e nenhuma query por cliente Prisma que não seja o `tx`. |
| RNF-2 | O submit responde em < 1 s no p95 e nunca se aproxima do timeout de 5 s da transação. |
| RNF-3 | Efeitos pós-commit são best-effort: falha em qualquer um deles não invalida a submissão já persistida. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado telefone que não existe na org, quando o form é submetido, então o lead é criado no tracking/coluna do form e a resposta é 200.
- [ ] **CA-2** — Dado telefone existente **no** tracking do form, quando o form é submetido, então a mesma linha é reusada (sem duplicata) e a resposta é 200.
- [ ] **CA-3** — Dado telefone existente em **outro** tracking da mesma org, quando o form é submetido, então a linha é realocada para o tracking do form e a resposta é **200 em menos de 1 s**.
- [ ] **CA-4** — Dado o cenário de CA-3, quando o submit conclui, então existe evento `status_changed` em `lead_journey_events` para aquele lead.
- [ ] **CA-5** — Dado o cenário de CA-1, quando o submit conclui, então existe evento `form_submit` para o lead recém-criado _(hoje falha silenciosamente com violação de FK)_.
- [ ] **CA-6** — Dados **dois ou mais** leads com o mesmo telefone na org, um deles já no tracking do form, quando o form é submetido, então **esse** é o escolhido e nenhuma violação de `leads_phone_tracking_id_key` ocorre.
- [ ] **CA-7** — Durante o submit, nenhuma conexão fica bloqueada por outra: `pg_blocking_pids()` retorna vazio ao longo de toda a requisição.
- [ ] **CA-8** — Dado `responseId` de resposta já concluída, quando reenviado, então a resposta é 200 idempotente sem duplicar submissão _(regressão do PR #369)_.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Lead já no tracking **e** coluna do form | Reusa, sem escrita, sem evento de mudança de status |
| CB-2 | Lead no tracking do form, **outra** coluna | Move de coluna, publica no board, gera `status_changed` |
| CB-3 | Lead em outro tracking da org | Realoca, publica origem **e** destino |
| CB-4 | **Vários** leads com o mesmo telefone em trackings distintos | Prefere o que já está no tracking do form; senão, o primeiro. Nunca viola `unique(phone, tracking_id)` |
| CB-5 | Telefone nulo, vazio ou form sem campo de telefone | Não resolve lead por telefone; cria conforme os dados enviados |
| CB-6 | Form sem `trackingId`/`statusId` configurados | Salva a resposta sem posicionar lead; não é erro |
| CB-7 | `responseId` de resposta já concluída | Retorno idempotente, sem reprocessar efeitos (PR #369) |
| CB-8 | `responseId` inexistente ou de outro form | Tratado como submissão nova, não como erro |
| CB-9 | Dois submits simultâneos, mesmo telefone, mesmo form | Um vence; o outro reusa ou falha de forma limpa — nunca cria duplicata nem estoura timeout |
| CB-10 | Coluna de destino vazia | `order` inicial válido, sem divisão por zero nem colisão |
| CB-11 | Efeito pós-commit falha (Pusher fora, Inngest fora) | Submissão permanece válida; erro logado; usuário vê sucesso |

> **CB-3 e CB-4 são o incidente.** Estivessem nesta tabela antes da implementação,
> teriam virado teste e o 500 não chegaria em produção.

## 6. Decisões de design

### D-1 — A transação contém apenas escritas de banco

- **Escolha**: todo I/O — `trackLeadEvent`, `fetch` de workflows, Pusher, Inngest —
  sai da `$transaction` e roda **após o commit**, no padrão já usado pelo
  `pendingLeadEvents` do próprio arquivo.
- **Alternativas descartadas**:
  - _Aumentar o timeout da transação para 15 s_ — mascara o problema: a espera
    circular continua existindo e passa a segurar conexões por mais tempo, com
    risco de esgotar o pool sob carga.
  - _Passar o `tx` para o `trackLeadEvent`_ — resolve o deadlock, mas amarra o
    evento de jornada ao sucesso da transação e mantém I/O de rede lá dentro no
    futuro. Também exigiria mudar as 10 chamadas do helper.
- **Consequência**: se um efeito pós-commit falhar, a submissão já está
  persistida — comportamento correto e desejado (RNF-3). O código já reconhece
  essa regra para o `recordLeadEvent`; `trackLeadEvent` apenas escapou dela.

### D-2 — Falha de evento de jornada é visível, não silenciosa

- **Escolha**: `trackLeadEvent` continua best-effort, mas o log passa a incluir
  contexto suficiente para alarme (lead, kind, erro).
- **Alternativas descartadas**: _propagar o erro_ — derrubaria submits por falha
  de telemetria, o oposto do que se quer.
- **Consequência**: a violação de FK do caminho `created` deixa de ser invisível.
  Foi justamente o silêncio que permitiu perda de dados sem ninguém notar.

### D-3 — Resolução de lead prefere a linha já no tracking de destino

- **Escolha**: mantida a regra atual (`existingRows.find(row.trackingId === formTrackingId) ?? existingRows[0]`).
- **Consequência**: evita colisão com `unique(phone, tracking_id)` ao realocar.
  Registrado aqui porque é uma decisão **não óbvia** que parece arbitrária ao ler
  o código — e que alguém poderia "simplificar" para `existingRows[0]`,
  reintroduzindo o bug.

## 7. Impacto

- [ ] Schema / migration
- [ ] Procedures oRPC (contrato de entrada/saída) — comportamento muda, contrato não
- [x] Realtime (Pusher / event-bus) — publicações passam a ocorrer só pós-commit
- [x] Automações (Inngest) — envio sai de dentro da transação
- [ ] Env vars novas
- [ ] Breaking change para clientes existentes
- [ ] Documentação obrigatória (CLAUDE.md itens 10 / 14 / 16)

**Débito registrado**: o mesmo padrão (`trackLeadEvent` dentro de `$transaction`)
existe em outros 9 arquivos — `leads/update.ts`, `leads/create-lead.ts`,
`leads/add-tags.ts`, `leads/update-action.ts`, `leads/update-many-status.ts`,
webhooks de Facebook/Instagram, `persist-canonical-inbound.ts` e
`incoming-message-pipeline.ts`. Não são todos fatais — só quebram quando há
escrita na mesma linha antes da chamada. Merece spec própria e varredura
dedicada; fora do escopo desta.

## 8. Plano de testes

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1 | manual + automatizado | Submit com telefone inédito; conferir lead no tracking |
| CA-2 | manual + automatizado | Submit com telefone já no tracking do form |
| CA-3 | **automatizado (regressão)** | Submit com `551111111111` na cópia de produção — hoje falha 3/3 em ~5,2 s |
| CA-4, CA-5 | automatizado | Consultar `lead_journey_events` após cada caminho |
| CA-6 | automatizado | Base com telefone duplicado em 2+ trackings |
| CA-7 | manual | `pg_blocking_pids()` durante a requisição |
| CA-8 | automatizado | Reenviar `responseId` concluído |

Ambiente de verificação: banco local restaurado do dump de produção
(240 tabelas, 44.677 leads), onde o cenário de CA-3 reproduz de forma
determinística.

## 9. Riscos e rollback

- **Risco**: mover efeitos para pós-commit faz um evento de jornada se perder se o
  processo morrer entre o commit e o efeito. **Aceito** — é telemetria, e o
  trade-off é explicitamente melhor que o 500 atual.
- **Risco**: publicações de realtime passam a ocorrer alguns ms depois. Sem
  impacto perceptível no board.
- **Rollback**: mudança restrita a um arquivo de procedure, sem migration.
  Reverter o commit basta.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-08-07 | João Gabriel | Criada a partir do incidente de 500 no submit em produção |
