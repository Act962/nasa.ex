---
id: 0076
titulo: Vinculados do lead (dependentes, filiais) com cobrança pelo Financeiro
dominio: leads
status: implementada
autor: Weydson
criada: 2026-10-08
atualizada: 2026-10-08
branch:
pr:
peso: completa
---

# 0076 — Vinculados do lead (dependentes, filiais) com cobrança pelo Financeiro

Relacionadas: [0075](../form/0075-fichas-com-itens-calculo-e-fechamento.md) (fichas e fechamento) e [0074](../payment/0074-lead-ganho-vira-conta-a-receber.md) (lead ganho vira conta a receber).

## 1. Contexto

Hoje um lead é uma pessoa ou empresa isolada. Dois casos reais não cabem nisso:

- **Clínica:** quem contrata é o pai ou a mãe (o lead), mas os atendimentos são dos filhos. A criança não tem telefone e não deve entrar no funil, e mesmo assim precisa de fichas e histórico próprios.
- **Oficina de pintura:** um grupo tem várias concessionárias. Às vezes o grupo paga tudo; às vezes cada filial paga a sua.

Sem essa associação, a empresa cria um lead para cada filho ou filial (poluindo o funil e perdendo o vínculo) ou mistura tudo num lead só (perdendo o histórico de cada um).

## 2. Objetivo

Um lead (o **titular**) pode ter vários **vinculados**. Fichas, fechamento, página do cliente e cobrança passam a enxergar o vinculado. O vinculado pode, no futuro, virar um lead próprio sem perder o histórico.

### Não-objetivos

- Não substitui `OrgProject` (cadastro de marca do Planner).
- Não migra dados existentes: leads que hoje representam filiais continuam como estão até alguém escolher juntá-los.
- Agenda, Chat e Workspace não ganham o vinculado nesta spec (ver §10).

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | **Vinculado** (`LeadMember`): pertence a um lead e pode ficar **abaixo de outro vinculado** (`parentMemberId`), formando níveis: grupo → regional → loja. Um vinculado pode ter vários abaixo dele. O servidor recusa ciclo (um vinculado abaixo de si mesmo ou de um descendente) e pai de outro lead; tem nome (obrigatório) e, opcionais, tipo livre (ex.: "Filho", "Filial"), documento, data de nascimento, telefone, e-mail e observação. Não aparece no funil. Pode ser arquivado; não é apagado se tiver ficha. |
| RF-2 | **Nome na tela configurável por empresa**: singular e plural ("Paciente/Pacientes", "Loja/Lojas"). Padrão: "Vinculado/Vinculados". |
| RF-3 | **Aba no lead** com a lista de vinculados: criar, editar, arquivar, ver as fichas de cada um. Exige ser participante do tracking do lead (mesma regra de editar o lead). |
| RF-4 | **"Para quem?" no preenchimento interno** (`/formulario/novo/[formId]/[leadId]`): quando o lead tem vinculado ativo, a tela pede a escolha entre "o próprio" e cada vinculado, com atalho para cadastrar um novo. A resposta e a ficha (`FormRecord`) gravam `leadMemberId`. Lead sem vinculado: nada muda. |
| RF-5 | **Lista de fichas**: coluna e filtro por vinculado. |
| RF-6 | **Forma de cobrança do vinculado** (`billingMode`): `TITULAR` (padrão: entra na conta do lead) ou `PROPRIO` (conta separada em nome do vinculado). É a escolha do usuário entre "centro de custo da empresa" e "centro de custo próprio". Vinculado `PROPRIO` pode apontar um **centro de custo do Financeiro** (`PaymentCostCenter`); `TITULAR` usa o do titular, se houver. |
| RF-7 | **Fechamento** (spec 0075, RF-10): cada vinculado com ficha no período é uma **unidade de rateio**, igual a um cliente sem vinculados (na planilha de setembro o rateio é por loja). A tela mostra o titular com os vinculados abaixo e o subtotal. |
| RF-8 | **Contas a receber**: uma por titular, somando os vinculados `TITULAR`, e uma por vinculado `PROPRIO`. Toda conta sai pelo fluxo do Financeiro (`createPaymentEntryRecord`), com descrição que cita o vinculado e, quando houver, o centro de custo. Continua sem duplicar ao gerar de novo. |
| RF-9 | **Página do cliente** (`/lead/[token]/fichas`): mostra as fichas de todos os vinculados, com filtro, e o resumo do período por vinculado. O token continua sendo do titular. |
| RF-10 | **Promover a lead**: transforma o vinculado num lead novo, por uma **função própria** (`promoteLeadMember`), sem tocar em `leads.create` — cada uma com a sua responsabilidade. A função grava o mesmo que a criação manual grava: conferência de telefone repetido no tracking, posição no fim da etapa (`order`), valores-padrão das colunas, histórico do lead, evento na jornada, registro de atividade e cobrança de Stars de `lead_create`. Exige telefone, como qualquer lead. **Tracking e etapa são sempre os do titular no momento da promoção — não há escolha.** Responsável: o do titular. Nome, telefone, e-mail, documento e observação vêm do vinculado. As fichas dele passam para o lead novo; fichas de período **fechado** ficam onde estão. O lead novo guarda de quem veio (`originLeadId`) e o vinculado fica marcado como promovido, sem aceitar ficha nova. Os vinculados que estavam abaixo dele sobem para o nível de cima. |
| RF-11 | **Juntar um lead como vinculado** (caminho inverso, para filiais que hoje são leads): escolhe-se o titular; o lead vira vinculado dele e as fichas abertas acompanham. Recusado se o lead tiver ficha em período fechado com conta gerada, ou conversa/negociação em andamento — a tela diz o motivo. |
| RF-12 | **Organograma na página do cliente** (`/lead/[token]` e `/lead/[token]/fichas`): bloco em destaque no topo, com o titular em cima e cada vinculado como um nó ligado a ele. Cada nó mostra nome, tipo, nº de fichas e total do período, e é um **link** para as fichas daquele vinculado (`/lead/[token]/fichas?vinculado=<id>`); o nó do titular leva às fichas de todos. No celular os nós descem em lista recuada, mantendo as linhas de ligação. Vinculado arquivado sem ficha não aparece; vinculado promovido aparece como "agora cliente próprio", sem link (a página dele tem outro link de acesso). Lead sem vinculado não mostra o bloco. O mesmo organograma aparece na aba de vinculados do lead, dentro do Órbita, com link para as fichas de cada um e para o lead novo quando promovido. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Migration só aditiva: tabela nova e colunas anuláveis. Nenhum dado existente muda de valor. |
| RNF-2 | Todo valor cobrado nasce de `FormClosingLine` e vira `PaymentEntry`. Não existe total calculado só na tela nem lançamento fora do Financeiro. |
| RNF-3 | Transações só com escritas de banco (regra 18): contas a receber criadas depois do commit, como na 0075. |
| RNF-4 | Vinculado é sempre resolvido pelo lead: nenhuma rota aceita `leadMemberId` sem conferir que ele é do lead e da organização de quem pede. As rotas públicas resolvem pelo token e nunca aceitam id vindo do navegador sem essa conferência. |

## 4. Critérios de aceite

| ID | Critério |
| --- | --- |
| CA-1 | Lead sem vinculado preenche formulário, fecha período e gera conta exatamente como antes (as 29 checagens de `scripts/dev-integration-check.ts` continuam passando). |
| CA-2 | Ficha preenchida "para" um vinculado aparece na lista com o nome dele e some do filtro de outro vinculado. |
| CA-3 | Vinculado de outro lead, ou de outra organização, enviado no preenchimento é recusado (404), e nada é gravado. |
| CA-4 | Fechamento com um titular de 2 vinculados (3 e 1 fichas) e um cliente simples (2 fichas): o custo compartilhado é rateado em 3/6, 1/6 e 2/6, e a soma das partes fecha com o total, centavo a centavo. |
| CA-5 | Mesmo cenário, os dois vinculados `TITULAR`: gera 2 contas (titular e cliente simples). Um deles `PROPRIO`: gera 3. Gerar de novo não cria nenhuma. |
| CA-6 | Conta de vinculado `PROPRIO` com centro de custo sai com esse centro de custo no lançamento. |
| CA-7 | Página do cliente lista fichas dos dois vinculados; token de outro cliente não vê nenhuma (404). |
| CA-8 | Promover vinculado com 2 fichas abertas e 1 em período fechado: o lead novo fica com 2; a fechada continua no titular; o vinculado não aceita ficha nova. |
| CA-9 | Promover sem telefone é recusado com mensagem clara. Telefone que já existe no tracking do titular também é recusado, como na criação manual. |
| CA-12 | Lead promovido e lead criado à mão no mesmo tracking têm **as mesmas colunas preenchidas** (comparação coluna a coluna, fora nome/telefone/origem), o mesmo tipo de registro no histórico, na jornada e na atividade, e a mesma cobrança de Stars. O promovido está no tracking e na etapa do titular, no fim da coluna. |
| CA-10 | Juntar lead que tem conta gerada em período fechado é recusado, e nada muda. |
| CA-13 | Vinculado C abaixo de B abaixo de A: o organograma mostra os três níveis; pôr A abaixo de C é recusado (ciclo); pôr como pai um vinculado de outro lead é recusado. |
| CA-11 | Página do cliente de um titular com 2 vinculados mostra o organograma com 3 nós; o link de um vinculado abre só as fichas dele; `?vinculado=` com id de vinculado de outro cliente devolve 404. Lead sem vinculado não mostra o organograma. |

## 5. Casos de borda

- **Vinculado arquivado com ficha em rascunho:** a ficha continua editável; ele só não aparece para fichas novas.
- **Titular apagado:** os vinculados vão junto (cascade); as fichas ficam, como já ficam hoje sem o lead (0075, D-6), com o nome do vinculado gravado na linha do fechamento.
- **Trocar `billingMode` com período já fechado:** vale só para os próximos fechamentos.
- **Vinculado `PROPRIO` sem centro de custo:** a conta sai sem centro de custo, como as demais criações automáticas.
- **Dois vinculados com o mesmo nome:** permitido; a tela mostra o tipo e o documento para diferenciar.
- **Formulário público (sem login):** não oferece "Para quem?"; a resposta fica no titular.

## 6. Decisões de design

### D-1 — Vinculado é registro próprio, não um lead
Lead exige telefone e mora numa etapa do funil. Criança de clínica e filial sem negociação não cabem nisso. Descartado "lead pai de lead": resolveria as concessionárias e pioraria a clínica.

### D-2 — Um mecanismo para os dois casos, com a cobrança como escolha
A diferença entre "filho" e "filial que paga a própria conta" é só **quem recebe a cobrança**. Isso virou um campo (`billingMode`), não dois modelos.

### D-3 — Promoção em vez de vínculo entre leads
Quando o vinculado precisa de vida própria (a criança cresce, a filial vira cliente direto), ele é promovido e leva o histórico aberto. O lead novo lembra a origem, mas passa a ser independente.

### D-6 — Promoção tem função própria; a igualdade com a criação manual é garantida por teste
`leads.create` é usada pelo tracking inteiro e não é alterada. A promoção tem a sua função, que repete os mesmos registros. O risco de as duas envelhecerem diferente é coberto pelo CA-12, que compara coluna a coluna um lead promovido com um criado à mão: se alguém acrescentar um campo na criação manual e esquecer a promoção, o teste falha.

### D-7 — Hierarquia por `parentMemberId`
Uma coluna de pai no próprio vinculado, em vez de tabela de ligações: cada vinculado tem no máximo um pai, que é o que um organograma pede. Fechamento e cobrança continuam por vinculado; os níveis servem para agrupar e somar na tela.

### D-8 — Linha do fechamento usa texto vazio para "o próprio lead"
A chave única passa a incluir o vinculado. Com NULL, o banco trataria duas linhas do mesmo cliente simples como diferentes e deixaria cobrar em dobro; por isso `leadMemberId` da linha é `''` quando não há vinculado.

### D-4 — Rateio por vinculado
Segue a planilha do cliente (por loja). Ratear por titular mudaria o valor de quem tem muitas unidades e não foi pedido.

### D-5 — Centro de custo é o do Financeiro
Não se cria um "centro de custo" paralelo: usa-se `PaymentCostCenter`, para o relatório do Financeiro bater com o fechamento.

## 7. Modelo de dados

- **`LeadMember`** (novo): `id`, `organizationId`, `leadId` (FK, cascade), `parentMemberId?` (auto-relação), `name`, `kind?`, `document?`, `birthDate?`, `phone?`, `email?`, `notes?`, `billingMode` (`TITULAR` | `PROPRIO`, padrão `TITULAR`), `costCenterId?`, `archivedAt?`, `promotedLeadId?`, `createdAt`, `updatedAt`. Índices: `(leadId)`, `(organizationId)`.
- **`Lead`**: `originLeadId?` (de qual titular veio, quando promovido).
- **`FormResponses`** e **`FormRecord`**: `leadMemberId?`.
- **`Form`**: `autoNumberCounter` (contador próprio do número automático, spec 0075 RF-13).
- **`FormClosingLine`**: `leadMemberId` (texto, `''` = o próprio lead), `leadMemberName?`; a unicidade passa de `(closingId, leadId)` para `(closingId, leadId, leadMemberId)`.
- **Nome na tela**: dois campos de texto na configuração da organização (singular e plural).

## 8. Segurança

- Dados de criança (nome, data de nascimento) são dados pessoais de menor: só membros da organização participantes do tracking do lead leem; a página pública mostra apenas o nome do vinculado, nunca documento nem data de nascimento.
- Promover e juntar são ações de escrita em vários registros: exigem o mesmo acesso de editar o lead e ficam no histórico do lead.

## 9. Fases

| Fase | Entrega |
| --- | --- |
| 1 ✅ | Migration, `LeadMember`, aba no lead com organograma, hierarquia, nome configurável |
| 2 ✅ | "Para quem?" no preenchimento, coluna e filtro na lista de fichas |
| 3 ✅ | Fechamento por vinculado, `billingMode`, centro de custo, contas a receber |
| 4 ✅ | Página do cliente com vinculados e organograma |
| 5 ✅ | Promover a lead e juntar lead como vinculado |

## 10. Em aberto

- Agenda, Chat e demandas do Workspace por vinculado (ex.: consulta marcada para o filho): fica para outra spec, depois que a base existir.
- Lead ganho → conta a receber (0074): continua pelo valor do lead; não se divide por vinculado.

## 11. Changelog

- 2026-10-08 — Criada, a partir de dois casos: clínica (pais e filhos) e grupo de concessionárias.
- 2026-10-08 — RF-12 e CA-11: organograma hierárquico com links na página do cliente e na aba do lead.
- 2026-10-08 — RF-10 reescrito: promoção usa a mesma rotina da criação manual e herda sempre tracking e etapa do titular. CA-12 e D-6.
- 2026-10-08 — Decisões da revisão: hierarquia por `parentMemberId` (RF-1, D-7, CA-13); promoção com função própria, sem alterar `leads.create` (RF-10, D-6); chave única do fechamento com texto vazio (D-8); tudo no PR 445.
- 2026-10-08 — Fase 1 implementada: migration `20261009120000_lead_members_and_auto_number`, domínio `src/features/lead-members/`, rotas `leadMembers.{list,create,update,updateLabels}`, aba "Vinculados" no lead. `scripts/lead-members-qa-check.ts` cobre a hierarquia (CA-13). Pendente da fase 1: âncoras e guia do Astro para a aba (regra 21).
- 2026-10-08 — Fase 2 implementada: `form.createResponseForLead` aceita `leadMemberId` (conferido pelo lead; inválido responde 404 sem gravar), `FormResponses` e `FormRecord` guardam o vinculado, seletor "Para quem é esta ficha?" no preenchimento interno (aceita `?vinculado=<id>` na URL e trava depois do primeiro salvamento), coluna e filtro "Vinculado" na lista de fichas. Organograma ganhou recolher/expandir por nó.
- 2026-10-08 — Fase 3 implementada: `computeClosing` rateia por vinculado, `groupLinesForBilling` define uma conta por titular e uma por vinculado de cobrança própria, `FormClosingLine` congela `billingMode` e `costCenterId`. O Financeiro não tinha tela de centros de custo: o cadastro do vinculado lista os existentes e cria um novo pelo nome. Linhas de uma mesma conta guardam `shared:<id da conta>:<id da linha>`, porque `paymentEntryId` é único. `scripts/dev-integration-check.ts` ganhou T-30 a T-35 (CA-2 a CA-6 e CA-13).
- 2026-10-08 — Fase 4 implementada: `formRecords.public.list` devolve os vinculados (só nome e tipo) e aceita `memberId`; organograma com links na página do cliente e na página de fichas (árvore em tela larga, lista recuada no celular). Mudou em relação ao RF-12: o link de um vinculado abre as fichas dele **e de quem está abaixo dele**, e o nó mostra essa soma.
- 2026-10-08 — Fase 5 implementada: `promoteLeadMember` (função própria; `leads.create` intacta) e `mergeLeadIntoMember`, rotas `leadMembers.{promote,mergeLead}`, ações na aba do lead. Mudou em relação ao RF-11: o lead juntado é **arquivado**, não apagado, e a junção é recusada quando ele tem qualquer conta no Financeiro ou conversa no Chat (a spec falava em "negociação em andamento", que não tem definição no código). `scripts/dev-integration-check.ts` ganhou T-36 a T-39 (CA-8, CA-9, CA-10, CA-12). Pendente: CA-7/CA-11 só conferidos à mão. O guia do Astro (`contacts.member.create`) foi feito em seguida.
