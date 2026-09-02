---
id: 0008
titulo: Levar a mensagem do lead no payload dos gatilhos e filtrar por ela
dominio: tracking-executions
status: em-revisao
autor: João Gabriel
criada: 2026-08-27
atualizada: 2026-08-27
branch: feature/tracking-mensagem-payload-gatilhos-20260827
pr:
peso: completa
---

# 0008 — Levar a mensagem do lead no payload dos gatilhos e filtrar por ela

---

## 1. Contexto

Hoje não existe nenhuma forma de ramificar um workflow do tracking pelo **texto
que o lead escreveu**, a não ser com IA.

O gatilho `MESSAGE_INCOMING` tem um campo "Filtro por palavras" no dialog
([agent-node-forms.tsx:861](../../src/features/tracking-executions/components/agent-node-forms.tsx:861))
que grava `data.containsAny`, mas **esse dado nunca é lido em runtime**. Não há
consumidor em `dispatchToMatchingWorkflows`, nem em `executeNode`, nem no
`WAIT_FOR_EVENT`. O node dispara em toda mensagem inbound, e o texto de ajuda
("Dispara só se a msg do lead contiver alguma destas palavras") descreve um
comportamento inexistente.

As alternativas atuais têm custo ou limitação:

| Caminho | Problema |
| --- | --- |
| `AI_DECISION` | Exige `OPENAI_API_KEY` e cobra 1 Star por execução. Sem a env, o node **falha** — o fallback heurístico não é alcançado (erro vira `UNKNOWN`, e `shouldUseFallback` só aceita 4 códigos). |
| `IF_CONDITION` com `trigger.messageText` | Só existe no Modo Agente IA. Workflows clássicos (a maioria) não têm esse node. |
| `FILTER_LEAD` | Roda nos workflows clássicos, mas só conhece `status`, `tag`, `value`, `name` e `email` — nada de mensagem. |

Resultado prático: para "se o lead escreveu X, siga por aqui" num workflow
comum, hoje não há solução sem IA.

Os gatilhos que rodam em cima de uma mensagem inbound (`NEW_LEAD` via WhatsApp,
`FIRST_INTERACTION_OF_DAY`) têm o texto em mãos no momento do dispatch e o
descartam — o `initialData` leva só `{ lead }`.

## 2. Objetivo

Os gatilhos de workflow passam a levar a mensagem do lead no `initialData`, e o
node `FILTER_LEAD` ganha o campo **"Mensagem do lead"** para comparar contra ela
— sem IA, sem Stars.

### Não-objetivos

- **Não** implementa o `containsAny` do `MESSAGE_INCOMING` em runtime. O input
  inerte foi **removido do dialog** (só UI — ver D-6), e o gatilho segue
  disparando em toda mensagem, como sempre fez.
- **Não** corrige o `parseAiError` que impede o fallback heurístico quando a
  `OPENAI_API_KEY` está ausente. Bug real, escopo separado.
- **Não** mexe no engine do Modo Agente IA (`run-workflow.ts`). `FILTER_LEAD` não
  está registrado no `agent-executor-registry`, então esta spec é sobre o engine
  clássico (topo-sort linear em `inngest/functions.ts`).
- **Não** adiciona regex nem match semântico. Só comparação literal normalizada.
- **Não** altera o gatilho `LAST_INBOUND_TIMEOUT` — foi removido e substituído
  pela Idle Automation.
- **Não** trata autenticação da rota `/api/workflows/lead/new` (ver §9).

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Um novo campo opcional `leadMessage` entra no `initialData` dos dispatches de gatilho, com o shape `{ text, messageId?, mediaType?, sentAt?, source }`. |
| RF-2 | `leadMessage.text` é **sempre** o texto escrito pelo LEAD — nunca do atendente, nunca da IA. |
| RF-3 | `NEW_LEAD` leva a mensagem quando o lead foi criado por uma mensagem **do lead** — WhatsApp, DM de Instagram ou DM de Facebook (`source: "TRIGGER_EVENT"`). |
| RF-4 | `FIRST_INTERACTION_OF_DAY` leva a mensagem inbound que satisfez o gate (`source: "TRIGGER_EVENT"`). |
| RF-5 | `FIRST_CHAT_INTERACTION`, `LEAD_TAGGED` e `AI_FINISHED` levam a última mensagem do lead **que tem texto**, buscada no banco (`source: "CONVERSATION_HISTORY"`). Mídia sem legenda, cartão de contato e localização são puladas; a busca olha no máximo 20 mensagens pra trás. |
| RF-6 | O dialog do `FILTER_LEAD` ganha o campo "Mensagem do lead" com os operadores *contém*, *não contém* e *é igual a*. |
| RF-7 | A comparação normaliza os dois lados: minúsculas, acentos removidos e espaços colapsados. |
| RF-8 | O executor do `FILTER_LEAD` lê a mensagem de `context.leadMessage`. |
| RF-9 | A busca da última mensagem (RF-5) só acontece quando existe ao menos um workflow ativo casando com o gatilho. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Nenhum dispatch novo pode falhar por causa da mensagem: toda coleta é best-effort, em `try/catch`, e um erro resulta em `leadMessage` ausente — nunca em gatilho não-disparado. |
| RNF-2 | A query de RF-5 usa índice existente (`Message.conversationId` + `createdAt`), `take: 20`, e o descarte de contato/localização acontece em memória — não depende da semântica de NULL do `notIn` do Prisma numa coluna nullable. |
| RNF-3 | `leadMessage.text` é truncado em 2000 caracteres antes de entrar no payload do Inngest. |
| RNF-4 | Nenhum `any` nas assinaturas novas (CLAUDE.md item 13). |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado um lead novo criado por mensagem de WhatsApp "Olá, sou intrevistador", quando o gatilho `NEW_LEAD` dispara, então `initialData.leadMessage.text` é `"Olá, sou intrevistador"` e `source` é `"TRIGGER_EVENT"`.
- [ ] **CA-2** — Dado um `FILTER_LEAD` com condição *Mensagem do lead — contém — "intrevistador"*, quando o lead escreveu "Olá, sou intrevistador", então o filtro é satisfeito e o fluxo continua.
- [ ] **CA-3** — Dada a mesma condição do CA-2, quando o lead escreveu "Olá, sou INTREVISTADOR" ou "olá, sou intrevistadór", então o filtro **também** é satisfeito (normalização de caixa e acento).
- [ ] **CA-4** — Dado um lead criado por submit de formulário (sem mensagem), quando o `FILTER_LEAD` tem qualquer condição de "Mensagem do lead", então o filtro **não** é satisfeito e o fluxo para.
- [ ] **CA-5** — Dado um workflow com gatilho `FIRST_CHAT_INTERACTION`, quando o atendente envia a primeira mensagem, então `initialData.leadMessage` traz a **última mensagem do lead** da conversa, não a do atendente.
- [ ] **CA-6** — Dado um tracking sem nenhum workflow ativo com o gatilho, quando uma mensagem inbound chega, então nenhuma query extra de mensagem é executada.
- [ ] **CA-7** — Dado que a coleta da mensagem lança exceção, quando o gatilho dispara, então o workflow roda normalmente com `leadMessage` ausente e um `console.error` é registrado.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Lead criado por **submit de formulário** | `leadMessage` ausente. Condições de mensagem avaliam `false` (inclusive *não contém*). |
| CB-2 | Lead criado por **In-Chat identify** | `leadMessage` ausente — o lead nasce no identify, antes de qualquer mensagem. |
| CB-3 | Mensagem é **só mídia**, sem legenda | `text: ""`, `mediaType` preenchido. Condições de texto avaliam `false`. |
| CB-4 | Mensagem é **mídia com legenda** | `text` = legenda. |
| CB-5 | Mensagem é **resposta de botão/lista** (`interactive_reply`) | `text` = `replyText`, com fallback pro `replyId`. |
| CB-6 | Mensagem é **localização / contato / reação / revoke** | `text: ""` nos três caminhos. `Message.body` guarda o nome do cartão (contato) e "nome — endereço" (localização), mas nada disso foi escrito pelo lead — `getLastLeadMessage` e a rota In-Chat descartam esse texto por `mediaType`. |
| CB-7 | Lead **nunca escreveu nada** e o gatilho é de histórico (RF-5) | `leadMessage` ausente. |
| CB-15 | Lead escreve "quero orçamento" e depois manda foto/localização/contato; gatilho de histórico dispara | `leadMessage.text` = "quero orçamento" — a busca pula as mensagens sem texto. |
| CB-16 | Lead escreve texto e depois manda **mais de 20** mensagens sem texto | `leadMessage` ausente. Limite deliberado (`TEXT_LOOKBACK_LIMIT`): texto tão antigo não descreve mais a intenção atual. |
| CB-8 | Operador *não contém* com mensagem ausente | Avalia `false`, **não** `true`. Decisão D-3. |
| CB-9 | Condição de mensagem com `value` vazio | Bloqueada na validação do form (Zod `min(1)`). |
| CB-10 | Mensagem maior que 2000 caracteres | Truncada em 2000 antes do dispatch (RNF-3). Comparação roda sobre o texto truncado. |
| CB-11 | Workflow salvo **antes** desta mudança, sem condição de mensagem | Inalterado — nenhuma condição nova, mesmo resultado de antes. |
| CB-12 | Dois workflows no mesmo gatilho, um com filtro de mensagem e outro sem | Cada um avalia independentemente; o payload é o mesmo para os dois. |
| CB-13 | **Atendente inicia a conversa** pelo celular com número desconhecido (Uazapi entrega `fromMe=true`, e esse caminho cria o lead) | `leadMessage` ausente. O texto é do atendente, não do lead — anexá-lo violaria RF-2. |
| CB-14 | Lead criado por **DM de Instagram ou Facebook** | `leadMessage` presente, `source: "TRIGGER_EVENT"`. `is_echo` é descartado antes, então a mensagem é sempre do lead. |

## 6. Decisões de design

### D-1 — `leadMessage` significa sempre "a mensagem do LEAD", em todos os gatilhos

- **Escolha**: em `FIRST_CHAT_INTERACTION` (que dispara na primeira mensagem do
  **atendente**), o payload carrega a última mensagem inbound do lead, buscada no
  banco, e não o texto que o atendente acabou de enviar.
- **Alternativas descartadas**:
  - *Levar a mensagem do atendente*: zero query, mas o campo do filtro mudaria de
    significado conforme o gatilho — quem monta o fluxo não tem como saber, de
    olhar a tela, o que está sendo comparado.
  - *Dois campos separados no filtro*: mais flexível, mas dobra a superfície de UI
    para um caso de uso que ninguém pediu ainda.
- **Consequência**: 1 query indexada por dispatch nos gatilhos de histórico
  (RF-5), executada só quando há workflow casando (RF-9).

### D-2 — Uma condição = um texto; sem lista separada por vírgula

- **Escolha**: o campo aceita **um** texto por condição. Para "A ou B", o operador
  adiciona duas condições e usa a lógica `OR` que o `FILTER_LEAD` já tem.
- **Alternativas descartadas**: campo com termos separados por vírgula, no molde
  do `containsAny` do `MESSAGE_INCOMING`. Descartado porque a vírgula quebra
  frases silenciosamente — quem digita "Olá, sou intrevistador" espera uma frase
  e recebe dois termos em OR.
- **Consequência**: o combinador AND/OR do node passa a ter uso real; não há
  sintaxe escondida dentro do campo de texto.

### D-3 — Sem mensagem no payload, condição de mensagem é `false` — inclusive "não contém"

- **Escolha**: quando `context.leadMessage` está ausente, toda condição de
  "Mensagem do lead" avalia `false`.
- **Alternativas descartadas**: tratar ausência como string vazia. Aí "não contém
  'cancelar'" passaria para lead de formulário, que nunca escreveu nada — o
  filtro "passaria" por omissão, exatamente o tipo de silêncio que a spec 0001
  nos ensinou a enumerar.
- **Consequência**: o operador precisa saber que essas condições só fazem sentido
  em gatilho com mensagem. O dialog explicita isso em texto de apoio.

### D-4 — Normalização de acento e caixa na comparação

- **Escolha**: `toLowerCase()` + `normalize("NFD")` sem diacríticos + colapso de
  espaços, nos dois lados.
- **Alternativas descartadas**: comparação crua (`includes` direto), como faz o
  `IF_CONDITION` — que faz lowercase mas mantém acento, e por isso falha em
  "Olá" vs "Ola".
- **Consequência**: não há como exigir match sensível a acento. Aceitável: é
  texto digitado por humano em celular.

### D-5 — Truncar em 2000 caracteres

- **Escolha**: o texto entra truncado no payload.
- **Alternativas descartadas**: mandar íntegro. Payload do Inngest é serializado e
  replicado em cada step do run; mensagem longa (transcrição de áudio, texto
  colado) infla todo o histórico do workflow.
- **Consequência**: filtro sobre trecho além do caractere 2000 não casa. Irrelevante
  para o uso real (palavra-chave no início da mensagem).

### D-6 — O "Filtro por palavras" do `MESSAGE_INCOMING` sai do dialog

- **Escolha**: remover o input inerte e pôr no lugar uma nota apontando pro
  `IF_CONDITION` com `trigger.messageText`. Só o dialog muda — nenhum runtime.
- **Alternativas descartadas**:
  - *Implementar o `containsAny` no dispatch*: viraria um segundo jeito de
    filtrar texto, com semântica diferente (vírgula = OR) do que esta spec
    acabou de entregar. Duas sintaxes pro mesmo problema confundem mais do que
    economizam.
  - *Apontar pro `FILTER_LEAD`*: **errado**. `MESSAGE_INCOMING` é
    `agentModeOnly`, e `FILTER_LEAD` não está no `agent-executor-registry` — o
    nó falharia com "Sem executor registrado pro NodeType FILTER_LEAD"
    ([run-workflow.ts:629](../../src/features/workflows/lib/run-workflow.ts:629)).
    Em Modo Agente o caminho é `IF_CONDITION`.
- **Consequência**: workflows salvos antes disso mantêm `data.containsAny` no
  banco como dado órfão — nunca foi lido, e agora também não é editável.
  Inofensivo; limpar exigiria migration de dados sem ganho.

## 7. Impacto

- [ ] Schema / migration (`prisma/schema.prisma`)
- [ ] Procedures oRPC (contrato de entrada/saída)
- [ ] Realtime (Pusher / event-bus)
- [x] Automações (Inngest)
- [ ] Env vars novas
- [ ] Breaking change para clientes existentes
- [x] Documentação obrigatória (CLAUDE.md itens 10 / 14 / 16)

**Automações (Inngest)**: `initialData` dos gatilhos `NEW_LEAD`,
`FIRST_CHAT_INTERACTION`, `FIRST_INTERACTION_OF_DAY`, `LEAD_TAGGED` e
`AI_FINISHED` ganha a chave opcional `leadMessage`. Campo aditivo — runs antigos
e workflows existentes seguem funcionando sem ele (CB-11).

**Documentação**: a mudança toca
[`persist-canonical-inbound.ts`](../../src/features/tracking-chat/lib/inbound/persist-canonical-inbound.ts),
que é parte do pipeline canônico de inbound — CLAUDE.md item 14 exige atualizar
[`docs/whatsapp-oficial-overview.md`](../../docs/whatsapp-oficial-overview.md) na
mesma sessão.

**Contrato HTTP**: `POST /api/workflows/lead/new` passa a aceitar
`leadMessage` no body (opcional, validado por Zod). Callers antigos que mandam só
`{ trackingId }` continuam válidos.

## 8. Plano de testes

Não há runner de teste instalado no projeto (CLAUDE.md item 20 — Regra 17 é
inexequível hoje). Verificação é manual, com os passos abaixo.

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1 | manual | Workflow com `NEW_LEAD` → `FILTER_LEAD`. Mandar msg de número novo pro WhatsApp do tracking. Conferir `initialData` no dashboard do Inngest. |
| CA-2 / CA-3 | manual | Mesmo workflow, condição *contém "intrevistador"*. Testar as 3 grafias do CA-3. |
| CA-4 | manual | Submeter formulário público que cria lead. Run deve parar no `FILTER_LEAD` com "Filtro não satisfeito". |
| CA-5 | manual | Workflow com `FIRST_CHAT_INTERACTION`. Lead manda "teste"; atendente responde. Conferir que `leadMessage.text` = "teste". |
| CA-6 | manual | Tracking sem workflow com o gatilho: conferir nos logs que nenhuma query de última mensagem roda. |
| CA-7 | manual | Forçar erro na coleta (derrubar a query temporariamente) e conferir que o run acontece mesmo assim. |

## 9. Riscos e rollback

**Sem migration** — rollback é reverter o commit. Nenhum dado persistido muda de
forma; `leadMessage` vive só no payload do evento Inngest e no `initialData` do
`WorkflowRun` (coluna JSON já existente).

| Risco | Mitigação |
| --- | --- |
| Query extra no hot path de inbound | RF-9: só roda quando há workflow ativo casando. `FIRST_INTERACTION_OF_DAY` já filtra por workflow antes de tocar o banco. |
| Payload maior no Inngest | RNF-3 trunca em 2000 chars. |
| Operador monta filtro de mensagem em gatilho sem mensagem (ex.: `MOVE_LEAD_STATUS`) e o fluxo "para de funcionar" | D-3 é o comportamento correto, mas silencioso. Mitigação: texto de apoio no dialog listando os gatilhos que trazem mensagem. |
| Vazamento de conteúdo de mensagem no `initialData` do `WorkflowRun` | Já é o caso hoje para `MESSAGE_INCOMING` no Modo Agente. Mesma superfície, mesma proteção (JSON por org). |

**Risco pré-existente, fora do escopo**: `POST /api/workflows/lead/new` não tem
autenticação — qualquer um que conheça `trackingId` + `leadId` dispara workflows
`NEW_LEAD`. Esta spec adiciona um campo ao body, então passa a ser possível
**injetar texto arbitrário** no payload de um gatilho. Não é uma regressão de
autenticação (a rota já era aberta), mas aumenta o que um chamador não-autenticado
controla. Registrado aqui para virar item próprio na auditoria de segurança.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-08-27 | João Gabriel | Criada |
| 2026-08-27 | João Gabriel | Implementada. Typecheck limpo nos arquivos tocados; critérios de aceite ainda não verificados manualmente (exigem inbound real de WhatsApp). |
| 2026-08-27 | João Gabriel | D-6 adicionada — o input inerte "Filtro por palavras" do `MESSAGE_INCOMING` saiu do dialog, com nota apontando pro `IF_CONDITION`. Mudança só de UI, decidida durante a implementação. |
| 2026-09-02 | João Gabriel | RF-5 passa de "última mensagem" para "última mensagem **com texto**" (CB-15/CB-16, RNF-2). Sem isso, uma foto ou localização enviada depois do texto zerava o `leadMessage` e o filtro falhava calado, mesmo o lead tendo escrito o que se procurava. |
| 2026-09-02 | João Gabriel | CB-6 passa a valer nos três caminhos: `getLastLeadMessage` e a rota In-Chat descartavam o `body` de contato/localização como se fosse texto do lead, divergindo do caminho canônico. |
| 2026-09-02 | João Gabriel | Code review pegou 3 falhas, corrigidas neste PR: (a) `NEW_LEAD` anexava o texto do **atendente** quando a mensagem `fromMe=true` criava o lead — RF-3 e CB-13 ajustados; (b) e (c) webhooks de Instagram e Facebook criavam lead sem `leadMessage`, apesar do texto estar em escopo — RF-3 e CB-14 ajustados. |
