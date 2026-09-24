---
id: 0024
titulo: Catálogo de verbos do Astro — recorte por onda
dominio: astro
status: aprovada
autor: Weydson
criada: 2026-09-24
atualizada: 2026-09-24
branch: feature/W-forge-simulador-custos-20260923
pr:
peso: completa
---

# 0024 — Catálogo de verbos do Astro, por onda

## 1. Contexto

A spec 0023 entregou o registro de ações e provou o desenho com uma ação só
(`forge.create_proposal`). A auditoria de 2026-09-24 mediu o tamanho do buraco:

| | |
| --- | ---: |
| Escritas no sistema (POST/PATCH/PUT/DELETE no oRPC) | **344** |
| Ferramentas de escrita do Astro | **33** |
| Escritas em apps sem nenhuma ferramenta | **198 (57%)** |
| Apps com escrita e zero verbo | **29** |

O modo Comando engana quem olha de fora: ele cita 20 apps, mas só **8** viram
ação de verdade (agendamento, contrato, lead criado, lead movido, post criado,
post gerado, tarefa criada). O resto é ajuda de navegação — "acesse Menu →
Integrações" — não execução.

Só o `payment` está realmente coberto, resultado da spec 0014. `leads` vem
atrás. O resto do produto, o Astro não toca.

## 2. Objetivo

Definir **quais** verbos entram no registro, em que ordem, e por qual critério —
para que "o Astro faz qualquer ação" seja um roadmap verificável em vez de uma
intenção.

### Não-objetivos

- **Não** cobrir as 344 escritas. A maioria é CRUD interno que ninguém pediria
  falando; ver §6, D-1.
- **Não** dar ao Astro escritas de plataforma (`admin`, 40 escritas). Moderação
  e gestão de conta continuam exigindo um humano na tela.
- **Não** expor preferência de interface (`sidebar-prefs`, `widgets`) — não é
  trabalho, é ajuste de tela.
- **Não** implementar nesta spec. Aqui é o recorte; cada onda vira seu PR.

## 3. Critério de entrada

Um verbo entra no catálogo quando passa nos quatro:

| ID | Critério |
| --- | --- |
| C-1 | **Alguém diria isso em voz alta.** "Remarca o Kauê pra sexta" entra; "atualiza a ordem das colunas" não. |
| C-2 | **Os campos cabem numa frase.** Se exige preencher 8 campos, é tela, não verbo. |
| C-3 | **O efeito é conferível.** O usuário vê o que aconteceu num cartão e desfaz se errou. |
| C-4 | **A escrita é reversível ou confirmável.** Destrutivo sem volta exige confirmação explícita (spec 0023, D-4). |

## 4. Onda 1 — tracking, chat e agendas

Os três de uso diário, que é onde o custo por token dói mais hoje.

### 4.1 Tracking

| Verbo | Frase típica | Já existe? |
| --- | --- | --- |
| `tracking.create_status` | "cria a coluna Proposta no funil de vendas" | ⬜ |
| `tracking.rename_status` | "renomeia a coluna Início para Entrada" | ⬜ |
| `tracking.apply_preset` | "aplica o padrão de vendas nesse tracking" | ⬜ |
| `tracking.add_participant` | "põe o João nesse tracking" | ⬜ |
| `tracking.archive` | "arquiva o tracking de 2025" | ⬜ (destrutivo → C-4) |
| `lead.add_note` | "anota no Kauê que ele pediu desconto" | ⬜ |
| `lead.toggle_favorite` | "favorita o Kauê" | ⬜ |
| `lead.delete` | "apaga o lead duplicado" | ⬜ (destrutivo → C-4) |

Já cobertos e fora da onda: criar, atualizar, mover e taguear lead; criar tracking.

### 4.2 Chat

| Verbo | Frase típica | Já existe? |
| --- | --- | --- |
| `chat.send_template` | "manda o template de boas-vindas pro Kauê" | ⬜ |
| `chat.start_conversation` | "abre conversa com o 86 99999-9999" | ⬜ |
| `chat.forward_message` | "encaminha essa mensagem pro comercial" | ⬜ |
| `chat.mark_read` | "marca as conversas do dia como lidas" | ⬜ |

Já cobertos: enviar mensagem de WhatsApp para lead e para número avulso.

**Fora por C-2**: enviar imagem, vídeo, áudio, arquivo, localização, contato,
sticker e botões interativos. O anexo não cabe na frase — o Astro já recebe
arquivo pelo clipe, e isso é outro fluxo.

### 4.3 Agendas

| Verbo | Frase típica | Já existe? |
| --- | --- | --- |
| `agenda.reschedule_appointment` | "remarca o Kauê pra sexta às 15h" | ✅ implementado |
| `agenda.cancel_appointment` | "cancela o agendamento de amanhã" | ⬜ (C-4) |
| `agenda.create_reminder` | "me lembra de ligar pro Kauê toda segunda" | ⬜ |
| `agenda.block_date` | "bloqueia o dia 30 na minha agenda" | ⬜ |
| `agenda.toggle_active` | "desativa a agenda de consultoria" | ⬜ |

Já cobertos: criar agenda, criar agendamento.

**`agenda.reschedule_appointment` é a de maior retorno da onda 1** — remarcar é
o pedido mais frequente e hoje custa navegação: abrir a agenda, achar o card,
arrastar.

## 5. Ondas seguintes

### Onda 2 — formulários

| Verbo | Frase típica |
| --- | --- |
| `form.send_to_lead` | "manda o formulário de briefing pro Kauê" |
| `form.publish` | "publica o formulário de captação" |
| `form.unpublish` | "tira o formulário do ar" |

`form.send_to_lead` é o verbo mais valioso do catálogo inteiro: cruza dois apps
(form + chat) numa frase que o usuário já diz hoje, e que hoje exige quatro
telas.

**Fora por C-2**: criar formulário. Campos, tipos e validação não cabem numa
frase — é tela, e o Astro pode no máximo abrir a tela certa.

### Onda 3 — o resto, por ordem de uso

`pages` (publicar, duplicar), `space-station`, `linnker`, `trafego`, `partner`.
Cada um entra com seu recorte próprio, pelo mesmo critério da §3.

### Nunca

`admin` (40 escritas), `sidebar-prefs`, `widgets`, `livekit`, `scripts`,
`user-notifications`. Plataforma, preferência de tela e infraestrutura — ver
§2, não-objetivos.

## 6. Decisões de design

### D-1 — Cobertura por frase dita, não por endpoint

- **Escolha**: o catálogo cobre o que alguém pede falando. As 344 escritas são
  o universo, não a meta.
- **Alternativa descartada**: *mapear todas as escritas* — produziria centenas
  de verbos que ninguém usaria, cada um com manutenção e risco de o
  classificador confundir. Catálogo grande piora a classificação.
- **Consequência**: "o Astro faz qualquer ação" passa a significar "qualquer
  ação que se peça em linguagem natural", que é o que o usuário quer dizer.

### D-2 — Ondas por uso diário, não por tamanho do buraco

- **Escolha**: tracking, chat e agendas primeiro, embora `admin` e
  `space-station` tenham mais escritas órfãs.
- **Alternativa descartada**: *atacar quem tem mais escritas sem verbo* —
  `admin(40)` lidera a lista e é justamente onde o Astro não deve escrever.
- **Consequência**: a onda 1 tem 17 verbos e cobre o caminho que o usuário
  percorre todo dia.

### D-4 — CRUD completo, com exclusão sempre confirmada e sempre auditada

- **Escolha**: cada família de verbo cobre criar, ler, atualizar e excluir.
  Exclusão tem `requiresConfirmation: true` **obrigatório** e grava em
  `systemActivityLog`, que é de onde os Insights leem o histórico
  (`get-activity-summary.ts`, `get-member-activity-report.ts`).
- **Alternativa descartada**: *só criar e atualizar* — deixa o usuário na tela
  justamente no momento de maior risco, sem reduzir risco nenhum.
- **Consequência**: quem apagou, o quê e quando fica no mesmo relatório que
  todas as outras ações da organização. Escrita feita pelo Astro entra no log
  com a identidade de quem pediu, com `via: "astro"` no metadata para
  distinguir da ação feita na tela.

### D-5 — O classificador enxerga a conversa, com limite

- **Escolha**: as últimas **3 falas**, cortadas em 280 caracteres cada, entram
  no prompt do classificador. É o que resolve "crie uma proposta para **ele**".
- **Alternativas descartadas**:
  - *Sem histórico* — era o estado anterior: o pronome não tinha antecedente,
    o pedido escalava por falta de contexto e não por complexidade, e custava
    19★ em vez de 2★.
  - *Conversa inteira* — devolveria ao classificador o problema de tamanho que
    ele existe para evitar.
- **Consequência**: o prompt cresce algumas centenas de tokens e continua duas
  ordens de grandeza abaixo do orquestrador. O prompt instrui explicitamente a
  **ignorar** o histórico quando o pedido abre assunto novo — nem tudo que vem
  depois se refere ao que veio antes.

### D-3 — Destrutivo entra, com confirmação

- **Escolha**: `lead.delete`, `tracking.archive` e `agenda.cancel_appointment`
  entram no catálogo, apoiados na confirmação da spec 0023 (D-4).
- **Alternativa descartada**: *deixar destrutivo de fora* — é justamente o que
  as pessoas pedem falando ("apaga esse lead duplicado"), e tirar do Astro só
  empurra para a tela sem reduzir risco.
- **Consequência**: nenhuma dessas grava sem o usuário confirmar no cartão.

## 7. Impacto

- [ ] Schema / migration — nenhuma; todos os verbos chamam lógica que já existe.
- [x] Procedures oRPC — os verbos reusam as procedures atuais, sem mudar contrato.
- [ ] Realtime · Automações · Env vars
- [ ] Breaking change
- [x] Documentação — cada onda atualiza esta spec e o `BILLING_ARCHITECTURE.md`.

## 8. Plano de testes

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| Cada verbo novo | script | `scripts/verify-astro-routing.ts` já afirma que toda ação do registro aparece nas duas superfícies (CA-8) — cresce sozinho |
| Classificação não degrada | script | Com o catálogo maior, repetir CA-1 e CA-3: pedido direto continua acertando, analítico continua devolvendo `null` |
| Frase típica de cada verbo | script | Automatizado em `verify-astro-routing.ts`: cada verbo do registro é classificado pela sua frase |
| Resolução de contexto (D-5) | script | Três casos no mesmo script: sem histórico não inventa; com histórico resolve o pronome; assunto novo ignora o histórico |

## 9. Riscos e rollback

**O risco real é o catálogo grande piorar a classificação.** Com 1 ação o
classificador acerta com 0,9–0,95 de confiança; com 30 as fronteiras ficam mais
finas. Por isso o plano de testes repete CA-1 e CA-3 a cada onda: se a confiança
cair ou pedido analítico começar a virar ação, o catálogo cresceu demais ou as
descrições estão ambíguas.

**O classificador é probabilístico, e isso tem custo.** Medido em 4 execuções da
mesma frase: 3 acertos (0,90–0,95) e 1 `null`. O `null` não erra — manda ao
orquestrador, que resolve. Mas custa 19★ onde custaria 2★. Ou seja, a economia
da spec 0023 é estatística, não garantida por chamada. Se a taxa de `null`
subir com o catálogo maior, o remédio é descrição mais nítida por verbo, não
baixar o limiar.

**Rollback**: `ASTRO_INTENT_ROUTING=false` continua desligando o roteamento
inteiro. Verbo individual sai removendo a entrada do registro — sem migration,
sem dado tocado.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-24 | Weydson | Criada a partir da auditoria: 344 escritas, 33 ferramentas, 29 apps sem verbo |
| 2026-09-24 | Weydson | D-4 (CRUD com exclusão confirmada e auditada) e D-5 (contexto conversacional) acrescentadas a pedido do dono do produto |
| 2026-09-24 | Weydson | **Variância medida**: a mesma frase classificou `null` em 1 de 4 execuções e acertou nas outras 3 (0,90–0,95). O caso do `null` cai no orquestrador — seguro, porém caro (19★ em vez de 2★). Registrado como risco em §9 |
| 2026-09-24 | Weydson | Aprovada. `agenda.reschedule_appointment` implementado — 1 de 17 da onda 1. A frase típica de cada verbo virou teste automatizado em `verify-astro-routing.ts`; com 2 verbos no catálogo a classificação segue em 0,90 e 0,95 |
