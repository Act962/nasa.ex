---
id: 0033
titulo: ASTRO escolhe por busca, confirma data por extenso e transforma pedido composto em plano
dominio: astro
status: aprovada
autor: Weydson
criada: 2026-09-25
atualizada: 2026-09-25
branch: feature/W-astro-commander-20260925
pr:
peso: completa
---

# 0033 — Busca, data confirmada e plano em pedidos compostos

Relacionadas:
- [0023](0023-astro-roteamento-por-intencao-e-proposta-com-link.md): classificador e caminho curto.
- [0024](0024-catalogo-de-verbos-do-astro.md): catálogo de verbos (`appointment.create`, `agenda.*`).
- [0032](0032-astro-crud-de-propostas-no-forge.md): ciclo guiado com memória (`resolveGuided`).
- Bateria: [`docs/astro-bateria-de-testes.md`](../../docs/astro-bateria-de-testes.md), lacunas L1 a L5 e contrato P1 a P3.

---

## 1. Contexto

Em 2026-09-25 o usuário pediu no widget: *"Marque na agenda uma consulta para segunda feira as 14h e me mande uma notificação para meu WhatsApp 86998221810"*.

O que aconteceu:

1. O classificador devolveu `startsAt = 2023-10-02T14:00`. Ele não sabe que dia é hoje, e `parseWhen` aceitava ISO pronto.
2. O compromisso foi gravado em **02/10/2023**, sem lead e com o título que o modelo quis.
3. Uma segunda execução na mesma conversa esbarrou no próprio registro e respondeu "Já existe 'consulta' em 02/10, 14:00".
4. A parte do WhatsApp foi descartada em silêncio.

A data e o aviso por WhatsApp já foram corrigidos (`parse-when.ts` no fuso de Brasília, palavras do usuário acima do ISO do modelo, aviso por lembrete em `create-appointment.ts`). O que falta é estrutural, e a bateria marca como lacunas:

| Lacuna | Evidência no código |
|---|---|
| **L1** — escolha sem busca | `astro-choice-card.tsx` renderiza até 8 botões (`MAX_OPTIONS = 8`, `resolve-action.ts`). Nome com erro de digitação ("Agenda Comerical") volta "não achei", porque a busca é `contains`. |
| **L2** — sem seletor de data/hora | Data faltando vira pergunta em texto livre. "amanhã" sem hora grava **na hora atual**; "25h" vira 01:00 do dia seguinte; "ontem" nem é reconhecido. |
| **L3** — pedido composto não vira plano | O classificador escolhe **uma** ação. A outra parte some, a menos que o próprio verbo saiba dela. |
| **L4** — data não confirmada antes de gravar | `appointment.create` tem `requiresConfirmation: false`. A data absoluta só aparece depois de gravada. |
| **L5** — "com quem" não é perguntado | `leadName` é opcional. O compromisso nasce "Novo agendamento", sem lead. |

## 2. Objetivo

Quando o ASTRO grava algo que aponta para dado existente ou para uma data, o usuário **escolhe numa busca**, **vê a data por extenso** antes de gravar e, em pedido composto, **vê o plano inteiro** antes de qualquer execução.

### Não-objetivos

- Não troca o classificador nem o orquestrador.
- Plano composto limitado a **3 partes**. Acima disso, o ASTRO pede para dividir o pedido.
- Não cobre o ASTRO CHAT público (visitante não escolhe agenda nem lead da org).
- Busca por similaridade em código (acento + distância de edição). Não instala `pg_trgm`.
- Confirmação obrigatória de data só nos verbos de agenda (`appointment.create`, `agenda.reschedule_appointment`, `agenda.create_reminder`). Os demais seguem como estão.

## 3. Requisitos

### Funcionais

| ID | Requisito |
|---|---|
| RF-1 | **Cartão de escolha com busca.** O cartão ganha um campo de texto que busca **na org inteira** pelo tipo do campo (agenda, lead, funil, etapa, produto, conta, membro, workspace, formulário), no servidor, com debounce. A lista inicial vem pré-filtrada pelo que o usuário disse, com a melhor sugestão no topo. |
| RF-2 | **Tolerância a erro de digitação.** Nome sem correspondência exata não responde "não achei": devolve `ambiguous` com até 8 opções por similaridade (sem acento, minúsculas, distância de edição ≤ 2 por palavra ou prefixo). Sem nenhuma opção próxima, aí sim "não achei", com o botão de busca aberto. |
| RF-3 | **Data e hora incompletas ou inválidas viram seletor.** `parseWhen` passa a devolver o que entendeu e o que falta (`{ iso?, missing: "time" \| "date" \| null, invalid?: string }`). Dia sem hora pede a hora; hora fora de 0–23 ou minuto fora de 0–59 é inválido; "ontem" e data passada pedem confirmação. O cartão mostra seletor de data e hora já preenchido com o que foi entendido. |
| RF-4 | **Confirmação por extenso nos verbos de agenda.** Antes de gravar, cartão com "segunda-feira, 28/09, às 14:00", agenda, lead e duração, com Confirmar/Cancelar. |
| RF-5 | **"Com quem?"** `appointment.create` sem lead pergunta, com busca de lead e a opção fixa "Sem lead (compromisso interno)". |
| RF-6 | **Pedido composto vira plano.** Frase com dois ou mais verbos ligados ("e", "depois", "também", "e me") passa por um classificador de plano, que devolve até 3 partes ordenadas `{ actionKey, fields, dependsOn? }`. Cada parte percorre o ciclo guiado (RF-1 a RF-5) para completar os campos. Com tudo completo, o cartão-plano lista as partes e pede uma única confirmação. |
| RF-7 | **Execução do plano parte a parte, com relatório.** Cada parte volta ✅ ou ❌ com o motivo. Parte que depende de uma que falhou fica ⏸ "não executada porque X falhou". Resultado de uma parte alimenta a seguinte: o lead criado na 1 vira o `leadName` da 2. |
| RF-8 | **WhatsApp (canal do ASTRO no WhatsApp).** Busca vira lista numerada; texto livre filtra a lista; o seletor de data vira pergunta com o exemplo do formato. |
| RF-9 | **Roteiro estruturado por ação (regra do dono do produto, 2026-09-25).** Toda ação que grava declara os dados de que precisa, em ordem, e cada um tem o seu seletor: busca de registro (`entity`), dia e hora (`datetime`), texto curto já sugerido (`text`) ou opções fixas (`select`). Texto livre só vale na **primeira frase** e em áudio/voz; dali em diante, cada resposta sai do seletor e o campo de texto do widget fica travado. O que o ASTRO não entender na primeira frase vira o seletor daquele dado, nunca pergunta aberta. Frase inequívoca ("quero agendar", "marca reunião") entra no roteiro por padrão em código (`intentPatterns`), sem classificador nem orquestrador. Agenda: dia e hora → agenda → lead → título → onde (online/presencial) → cartão. |

### Não-funcionais

| ID | Requisito |
|---|---|
| RNF-1 | Pedido simples (N1) não gasta mais tokens do que hoje. O classificador de plano só roda quando a frase tem sinal de composição. |
| RNF-2 | A busca do cartão responde em < 300 ms no p95, com `take` ≤ 20 e índice existente. |
| RNF-3 | Nenhuma escrita acontece antes da confirmação do plano ou do cartão de data (regra 18: efeitos colaterais depois do commit). |
| RNF-4 | A busca respeita permissão e isolamento por org: o mesmo gate de `permission-gate.ts`. |

## 4. Critérios de aceite

Cada CA aponta para o caso da bateria que o prova.

- [ ] **CA-1** (RF-1, F4-13) — Dada uma org com 12 agendas, quando o usuário digita "suporte" no cartão, então "Agenda Suporte" aparece mesmo fora das 8 iniciais.
- [x] **CA-2** (RF-2, F4-03) — Quando o usuário diz "Agenda Comerical", então o cartão sugere "Agenda Comercial" no topo, sem "não achei".
- [x] **CA-3** (RF-3, F4-01/F4-05) — Quando o usuário diz "marca reunião amanhã" (ou "segunda"), então o ASTRO pede a hora e **nada é gravado** na hora atual.
- [x] **CA-4** (RF-3, F4-14) — Quando o usuário diz "às 25h", então o ASTRO recusa a hora e pergunta de novo.
- [x] **CA-5** (RF-3, F4-15) — Quando o usuário diz "ontem às 10h", então o ASTRO avisa que é passado e pede confirmação ou outra data.
- [x] **CA-6** (RF-4, F4-04) — Quando o usuário diz "dia 5 às 10h", então o cartão mostra o dia da semana e o mês por extenso antes de gravar.
- [x] **CA-7** (RF-5, F4-02) — Com dois "Kauê" na org, quando o usuário diz "reunião com o Kauê", então a busca mostra os dois com telefone e funil para diferenciar.
- [x] **CA-8** (RF-6, RF-7, F5-AGE-01) — Quando o usuário manda a frase do Contexto, então o ASTRO pergunta agenda e lead, mostra o plano com as 2 partes e a data por extenso e, após confirmar, grava o compromisso na segunda às 14:00 (-03:00) com o lead escolhido. O aviso volta ✅ (lembrete para 13:00) ou ❌ com o motivo.
- [x] **CA-9** (RF-7, F5-LEAD-02) — "Cria o lead X e marca reunião com ele amanhã às 9h" grava o compromisso ligado ao lead recém-criado.
- [x] **CA-10** (RF-7, F5-FAIL-02) — Plano de 3 partes com a 2ª em horário ocupado devolve 1 ✅, 2 ❌ com o motivo e 3 ✅ ou ⏸ conforme a dependência.
- [ ] **CA-11** (RNF-1, F10-01) — "Quantos leads eu tenho?" continua resolvido em código, com zero tokens.
- [ ] **CA-12** (RF-8, F8-WA-02) — No WhatsApp, a busca vira lista numerada e "2" escolhe a segunda opção.

## 5. Casos de borda

- Usuário responde à pergunta de hora com outra frase completa ("não, quinta às 9h") → vale a nova data, sem perder agenda e lead já escolhidos.
- Usuário confirma um plano, recarrega a página e confirma de novo → executa uma vez (mesma regra do `confirm_action`).
- Org com uma agenda só → não pergunta a agenda (comportamento de hoje).
- Plano com uma parte que o usuário não tem permissão de executar → a parte vem ❌ "sem permissão" já no cartão-plano, antes de confirmar.
- Frase com "e" que **não** é composta ("reunião com Maria e João") → o classificador de plano devolve uma parte só.

## 6. Decisões de design

- **D-1 — Busca no servidor, não pré-carregada.** Uma org com 5 mil leads não cabe no cartão. O cartão chama `astro.search.<tipo>` com o texto e recebe até 20 itens.
- **D-2 — Similaridade em código.** Normalização sem acento, distância de edição por palavra e bônus por prefixo, aplicadas sobre um `contains` largo (primeiras 3 letras). Sem `pg_trgm`: a extensão não está garantida no Neon e não queremos migração de extensão por causa disto.
- **D-3 — Plano montado em código; classificador só por trecho.** *(revisada na implementação, ver changelog)* O corte da frase e a ligação entre partes são regras determinísticas (`plan/split-clauses.ts`, `plan/build-plan.ts`); o classificador de um verbo roda apenas no trecho que nenhum padrão reconheceu. Texto original desta decisão: **Classificador de plano separado.** O classificador atual escolhe um verbo e isso funciona bem; ensinar o mesmo prompt a devolver lista degradou a classificação em testes anteriores (spec 0023, o mesmo efeito do contexto temporal). O de plano só roda com sinal de composição (RNF-1).
- **D-4 — Máximo de 3 partes** (as etapas de "funil com as etapas A, B e C" não contam: são um pedido só). Acima disso, a chance de o usuário ter misturado dois assuntos é maior que a de ser um plano, e o cartão fica ilegível no widget.
- **D-5 — Confirmação de data só nos verbos de agenda.** É onde a data errada custa um cliente esperando. Nos outros verbos (validade de proposta, vencimento), a data aparece no cartão final como hoje.

## 7. Impacto

- `src/features/astro/actions/parse-when.ts` — retorno estruturado (RF-3). Chamadores atuais (`create-reminder`, `reschedule-appointment`, `create-proposal`, `payment/create-entry`, `coerce-fields`) passam a ler `iso`.
- `src/features/astro/actions/resolve-action.ts` — busca por similaridade (RF-2); `MAX_OPTIONS` segue 8 na lista inicial.
- `src/features/astro/components/astro-choice-card.tsx` — campo de busca e seletor de data/hora (RF-1, RF-3).
- Novo `src/app/router/astro/search.ts` — busca por tipo, com gate de permissão (D-1, RNF-4).
- `src/features/astro/actions/agenda/create-appointment.ts` — confirmação e "com quem" (RF-4, RF-5).
- Novo `src/features/astro/actions/plan/` — detector, classificador e executor do plano (RF-6, RF-7).
- `src/app/api/astro/chat/route.ts` — camada de plano antes do ciclo guiado.
- WhatsApp: `src/features/astro-bot/` — renderização da busca e do seletor (RF-8).
- Sem migração de banco: o plano pendente vive no slot da sessão, como o ciclo guiado.

## 8. Plano de testes

A prova é a bateria. Cada CA é um caso de [`docs/astro-bateria-de-testes.md`](../../docs/astro-bateria-de-testes.md), executado por `scripts/astro-qa/run.ts` com portão por fase. A spec só vira **implementada** quando F4 e F5 passam 3 de 3 vezes.

Entrega em três ondas, cada uma com a bateria verde até a fase correspondente:

1. **Onda 1 — data** (RF-3, RF-4, RF-5): CA-3 a CA-7.
2. **Onda 2 — busca** (RF-1, RF-2): CA-1 e CA-2.
3. **Onda 3 — plano** (RF-6, RF-7, RF-8): CA-8 a CA-12.
4. **Onda 4 — roteiro em todos os Apps** (RF-9), na ordem de volume: Agenda (feito) → Tracking (feito: `lead.create`, `lead.move`, `lead.update`, `lead.add_note`, `lead.delete`, `lead.toggle_favorite`) → Forge (feito: `forge.create_proposal`, `forge.update_proposal`, `forge.cancel_proposal`, `forge.delete_proposal`) → Financeiro (feito: `payment.create_entry`, `payment.mark_paid`) → Workspace (feito: `action.create`, `workspace.create`) → Chat e Formulários (feito: `chat.*`, `form.*`). Cada App entra com os casos da bateria na F3/F4 e só avança com eles 3 de 3.

## 9. Riscos e rollback

- **Um clique a mais nos verbos de agenda (RF-4).** É o preço de não gravar compromisso errado. Se o time rejeitar, a confirmação vira opcional por org.
- **Classificador de plano falhando.** Qualquer falha ou parte sem verbo reconhecido cai no caminho atual (um verbo), que continua existindo.
- **Rollback:** flag `ASTRO_PLAN_ROUTING` desliga a camada de plano; a busca do cartão é aditiva.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-25 | Weydson | Criada a partir do caso real do Contexto e das lacunas L1 a L5 da bateria. |
| 2026-09-25 | Weydson | Aprovada pelo dono do produto ("corrija as falhas"). Onda 1 (RF-3, RF-4, RF-5) implementada e RF-2 para agenda: `parseDateTime` em `parse-when.ts`; `appointment.create` com confirmação por extenso, pergunta de hora e de lead, recusa de hora inválida e passada e sugestão do próximo horário livre; `fuzzy-match.ts` para nome de agenda com erro de digitação. Data e hora vêm só das palavras do usuário: `codeOnlyFields` esconde `spokenWhen`/`answeredWhen` do classificador, que inventava 00:00. CA-2 a CA-7 provados pela bateria, 3 de 3. Onda 2 (busca no cartão, RF-1) e onda 3 (plano, RF-6 a RF-8) seguem abertas. |
| 2026-09-25 | Weydson | RF-9 (roteiro estruturado) a pedido do dono do produto: texto livre só na primeira frase e em voz; o resto por seletor. Implementado na Agenda: seletores de busca (lead, agenda), data/hora, texto (título) e opções (onde); campo de texto travado com seletor aberto; `intentPatterns` como camada zero; classificador com segunda tentativa antes de cair no orquestrador. |
| 2026-09-25 | Weydson | RF-9 no Tracking. Mecanismo genérico `fieldSteps` (pergunta + seletor por campo, usado pelo ciclo guiado quando falta dado); seletores novos `text` com "Pular" e `select`; funil por busca; colunas do funil do lead como opções fixas; dedução em código de nome, telefone, e-mail, funil, coluna, temperatura, valor e nota. Consultas `intelligence.rule` e `intelligence.knowledge` respondem regra e documento em código. |
| 2026-09-26 | Weydson | RF-9 no Forge. Busca de proposta (número, título ou cliente) e de produto; seletor de produtos com várias escolhas e quantidade (`multiple`); validade em opções fixas; título confirmado; proposta e produto resolvidos pelo id escolhido. Pedido sem proposta nomeada pergunta "Qual proposta?" em vez de "não achei proposta com ''". |
| 2026-09-26 | Weydson | RF-9 no Financeiro. Seletor de data em modo "só data" com data passada permitida (vencimento); busca de lançamentos em aberto; conta e categoria em opções fixas, com "Sem categoria"; "já foi paga?" só quando vence hoje ou antes; verbo no passado ("paguei", "recebi") já deduz hoje e pago. Consultas em código não respondem frase que casa com padrão de ação. |
| 2026-09-26 | Weydson | RF-9 no Workspace. Criar tarefa pergunta prazo (seletor de data com "Sem prazo"), responsável (busca de membros com "Eu mesmo") e prioridade; grava responsável e prioridade, que antes ficavam de fora. Busca de workspace e de membro no seletor. |
| 2026-09-26 | Weydson | RF-9 em Chat e Formulários — onda 4 concluída nos seis Apps planejados. Busca de formulário; telefone de conversa nova com 55; checagem de WhatsApp conectado antes do cartão em encaminhar e mandar formulário (antes, o usuário confirmava e só então via o erro). Seguem fora do roteiro: verbos de funil (`tracking.*`), `tag.create`, `agenda.create`, `agenda.reschedule_appointment`, `agenda.cancel_appointment`, `agenda.block_date`, `agenda.toggle_active` e `agenda.create_reminder`. |
| 2026-09-26 | Weydson | RF-9 em todos os 37 verbos do catálogo. Verbos de funil, tag, agenda e lembretes ganham padrões de frase, dedução em código e seletores (busca de compromisso futuro, colunas do funil como opções, duração da agenda, frequência do lembrete). Remarcar reaproveita a data de "marcar compromisso" (`schedule-steps.ts`). Com roteiro em andamento, a rota do chat não deixa consulta em código interceptar a resposta (`shouldSkipReading` passa a valer no chat, e resposta de seletor é sempre resposta). |
| 2026-09-26 | Weydson | Onda 3 (RF-6, RF-7) implementada em `src/features/astro/actions/plan/`. Divergências registradas: (1) D-3 — não há classificador de plano; o corte e as dependências são regras em código, e o classificador de um verbo só roda no trecho sem padrão (custo zero nos 14 casos da F5); (2) parte destrutiva (excluir, cancelar, arquivar) sai do cartão do plano e ganha cartão próprio logo após a execução, junto do relatório; (3) aviso "me mande notificação no WhatsApp" depois de agendar volta a ser do próprio compromisso (uma parte só); (4) parte impossível (e-mail, comprovante inexistente, WhatsApp desconectado) aparece com ❌ e o motivo já no cartão. Novos verbos `lead.add_tag` e `chat.send_message`; desconto na proposta com teto lido da memória ativa. CA-8, CA-9 e CA-10 provados pela F5 da bateria. |
| 2026-09-26 | Weydson | RF-9 (lembrete): o texto do lembrete cortava no primeiro "amanhã", então "me lembra amanhã às 9h de ligar..." salvava "amanhã". Agora o texto é o resto da frase sem data, hora e recorrência. "Todo dia 5" infere mensal; "todos os dias" não infere (não há lembrete diário) e o roteiro pergunta. |
