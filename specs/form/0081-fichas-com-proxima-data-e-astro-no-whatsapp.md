---
id: 0081
titulo: Fichas com próxima data, lidas e avisadas pelo ASTRO no WhatsApp
dominio: form
status: implementada
autor: Weydson
criada: 2026-10-09
atualizada: 2026-10-09
branch: feature/W-form-fichas-proxima-data-20261009
pr:
peso: completa
---

# 0081 — Fichas com próxima data, lidas e avisadas pelo ASTRO no WhatsApp

## 1. Contexto

Um técnico de ar condicionado quer controlar os clientes pelo WhatsApp: foto do aparelho, marca, tempo de uso, local, histórico, prazo da próxima manutenção, aviso de cliente perto do prazo, envio da chave PIX, perguntas ("quantos clientes tenho essa semana?", "quanto faturei esse mês?", "quantas manutenções no próximo mês?") e a rotina "todo dia às X horas, me mande a lista do dia".

Diretrizes do Weydson (09/10/2026): a solução é **genérica** (mecânico, dedetizadora, dentista, assistência técnica), **sem complexidade**, e o cliente e seus dados **não ficam espalhados em vários Apps**. O App a adaptar é o Formulário, que já permite criar campos próprios.

As Fichas (spec 0075) já guardam, sem código novo: campos do ramo, foto, datas, local, itens com valor, assinatura, PDF, número de O.S., histórico por cliente, ficha que puxa dados de outra ficha (`sourceRecordId`) e o link público do cliente.

Falta: uma data futura consultável na ficha, o ASTRO ler as fichas, o ASTRO escrever primeiro no WhatsApp do prestador, e o PIX.

## 2. Objetivo

Um prestador de serviço monta suas fichas com os campos do seu ramo, marca um campo como "próxima data", e passa a perguntar, ser avisado e cobrar pelo WhatsApp, usando só o App de Formulários.

### Não-objetivos

- Cadastro de equipamento fora das fichas (coluna no lead, Vinculados, modelo novo).
- Usar Workspace, Agenda, Financeiro ou Forge para isso. A ligação de tarefa com lead existe, mas espalharia o prazo e o aparelho em Apps diferentes.
- Preencher a ficha conversando com o ASTRO pelo WhatsApp. É a fase seguinte, em spec própria.
- Confirmação automática de pagamento (Asaas). Nesta entrega a baixa é manual.
- Autônomo com um único número de WhatsApp. O ASTRO segue exigindo a linha do negócio conectada e outro celular liberado.
- Criar e aprovar template da Meta para mensagem fora da janela de 24 h.

## 3. Requisitos

### A. Próxima data na ficha

| ID | Requisito |
| --- | --- |
| RF-1 | Campo de data do formulário ganha a opção **"Usar como próxima data"**, ao lado de "Usar como data da ficha". Um campo por formulário. O rótulo do campo é livre ("Próxima manutenção", "Retorno", "Renovação"). |
| RF-2 | Opção **"Calcular se ficar em branco"**: data da ficha + N meses (1 a 60). Com o campo preenchido, vale o que foi preenchido. |
| RF-3 | A data vira `FormRecord.nextDueAt`. Só ficha finalizada tem próxima data; rascunho não. |
| RF-4 | Quando uma ficha nova do mesmo formulário é finalizada para o **mesmo item** (mesma ficha de origem; sem origem, mesmo cliente com o mesmo rótulo da ficha), a próxima data das fichas anteriores desse item é limpa. Vale sempre a da ficha mais recente. Sem isso, a manutenção já feita continuaria aparecendo como prevista. |
| RF-5 | A lista de fichas mostra a próxima data e permite ordenar e filtrar por ela ("vencidas", "esta semana", "este mês"). |

### B. ASTRO lê as fichas (em código, sem IA e sem Stars)

| ID | Requisito |
| --- | --- |
| RF-6 | **Previstas no período**: fichas com próxima data no período, com quantidade, clientes distintos e lista (cliente, campos-chave, data). Responde "quantas manutenções tenho essa semana?", "quantas no próximo mês?" e "quantos clientes tenho essa semana?". |
| RF-7 | **Vencidas**: fichas com próxima data já passada. "Hoje" inclui as vencidas, separando os dois números. |
| RF-8 | **Feitas e faturado no período**: fichas finalizadas com data da ficha no período e a soma do valor (`usageTotalCents`). Responde "quanto faturei esse mês?" e "quantas manutenções fiz essa semana?". |
| RF-9 | **Fichas de um cliente**: "me mostra as fichas da Maria" devolve as fichas dela com os campos-chave e o link da ficha. |
| RF-10 | **Vocabulário pelo nome do formulário**: a palavra da pergunta é comparada com os nomes dos formulários de ficha da empresa, no singular e no plural ("Manutenção" responde a "manutenções"). Nenhuma palavra de ramo fica no código. "Ficha" e "atendimento" valem para todos os formulários. |
| RF-11 | `periodFrom` passa a entender "próximo mês" / "mês que vem", e "próxima semana" como a semana seguinte (segunda a domingo). |
| RF-12 | Respeita a permissão de ver Formulários. Sem ela, a recusa de sempre. |

### C. ASTRO escreve primeiro

| ID | Requisito |
| --- | --- |
| RF-13 | **Resumo do dia**: em "O que o ASTRO te manda no WhatsApp", a pessoa liga "Fichas previstas do dia" e escolhe a hora. Na hora marcada chega a lista do dia e as vencidas. Sem nada previsto, não chega mensagem. |
| RF-14 | **Aviso de prazo**: na mesma tela, "Avisar N dias antes" (1 a 30). Uma vez por dia chega a lista das fichas cuja próxima data cai em N dias. |
| RF-15 | Vai para o número liberado no ASTRO (`UserWhatsappBinding`) de quem ligou o aviso, pelo número do tracking habilitado para o ASTRO. Quem não tem número liberado vê a opção desligada, com o motivo. |
| RF-16 | Cada aviso é enviado uma vez por dia por pessoa, mesmo com reinício ou reenvio do agendador. |
| RF-17 | "Me manda as manutenções do dia todo dia às 7h", dito ao ASTRO, liga o resumo do dia naquela hora. |

### D. PIX

| ID | Requisito |
| --- | --- |
| RF-18 | A empresa cadastra uma vez: chave PIX, nome do recebedor e cidade, numa tela das Fichas. É o mesmo dado que o Forge já usa (`ForgeSettings.paymentGatewayConfigs`), sem coluna nova. |
| RF-19 | O sistema gera o "copia e cola" válido (BR Code estático, com valor e identificador), aceito por app de banco. |
| RF-20 | Botão "Enviar PIX" na ficha finalizada com valor, e ação do ASTRO "manda o PIX para a Maria": envia ao chat do cliente o valor, o copia e cola e o nome do recebedor. Pelo ASTRO, com confirmação antes de enviar. |
| RF-21 | Sem chave cadastrada, o botão e o ASTRO dizem onde cadastrar. |
| RF-22 | A ficha registra "PIX enviado em" e "pago em". "Marca a ficha da Maria como paga" dá a baixa manual. |

### E. Modelo pronto e menu

| ID | Requisito |
| --- | --- |
| RF-23 | Dois modelos de formulário, "Item do cliente" e "Atendimento" (o mecanismo de modelos cria um formulário por modelo): a ficha **Item** (foto, descrição, marca, local, data de instalação) e a ficha **Atendimento** (item, serviços com valor, observações, próxima data calculada em 6 meses, assinatura). O prestador renomeia e troca os campos. |
| RF-24 | App "Fichas" no menu do ASTRO no WhatsApp: Previstas hoje, Previstas na semana, Vencidas, Faturado no mês, Fichas de um cliente. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Consultas e avisos não usam IA nem cobram Stars. |
| RNF-2 | Nada no código menciona ar condicionado, manutenção ou qualquer ramo. |
| RNF-3 | Empresa sem nenhuma ficha com próxima data não percebe diferença: as perguntas de hoje continuam indo para onde iam. |

## 4. Critérios de aceite

- [ ] **CA-1** — Marcar um campo como "próxima data", preencher e finalizar: a ficha aparece em "previstas" na data certa.
- [ ] **CA-2** — Campo em branco com "calcular em 6 meses": a próxima data é a data da ficha mais 6 meses.
- [ ] **CA-3** — Finalizar um segundo Atendimento do mesmo Item: o primeiro deixa de aparecer como previsto e o segundo aparece.
- [ ] **CA-4** — Dois Itens do mesmo cliente têm próximas datas independentes.
- [ ] **CA-5** — "Quantas manutenções tenho essa semana?" responde quantidade, clientes e lista; "quantos clientes tenho essa semana?" responde o número de clientes distintos.
- [ ] **CA-6** — "Quantas manutenções no próximo mês?" usa o mês seguinte inteiro.
- [ ] **CA-7** — "Quanto faturei esse mês?" soma o valor das fichas finalizadas no mês.
- [ ] **CA-8** — Trocar o nome do formulário para "Revisão" faz "quantas revisões tenho essa semana?" funcionar, sem mexer em código.
- [ ] **CA-9** — Empresa sem ficha com próxima data: "quantos clientes tenho essa semana?" responde como antes desta spec.
- [ ] **CA-10** — Resumo do dia ligado para as 7h: chega às 7h com as previstas do dia; sem previstas, não chega; não chega duas vezes.
- [ ] **CA-11** — Aviso de 3 dias: ficha com próxima data daqui a 3 dias gera o aviso hoje, uma vez.
- [ ] **CA-12** — O copia e cola enviado é aceito num app de banco, com o valor da ficha e o nome do recebedor.
- [ ] **CA-13** — Sem chave PIX cadastrada, "manda o PIX" explica onde cadastrar e não envia nada.
- [ ] **CA-14** — O modelo "Prestador de serviço" cria as duas fichas, e um Atendimento finalizado já aparece em "previstas".
- [ ] **CA-15** — Usuário sem permissão de ver Formulários não recebe dados de ficha pelo ASTRO.

## 5. Abordagem

- **Banco** (`prisma/schema.prisma`, `FormRecord`): `nextDueAt DateTime?`, `pixSentAt DateTime?`, `paidAt DateTime?`, e índice `(organizationId, nextDueAt)`. Migration aditiva; tabela pequena. Preferência dos avisos em `UserNotificationPreference`, se o modelo comportar hora e antecedência; senão, duas colunas ali.
- **Projeção**: `buildRecordProjection` (`src/features/form-records/lib/record-fields.ts`) lê `useAsNextDate` e `nextDateAfterMonths`; `syncFormRecord` (`server/sync-form-record.ts`) grava `nextDueAt` na finalização e limpa as anteriores do mesmo item (RF-4). Continua fora de transação e sem lançar.
- **Construtor**: `record-field-settings.tsx` e `date-picker-block.tsx` ganham as duas opções.
- **Consultas**: novo `src/features/astro/queries/records.ts`, registrado em `registry.ts` antes das consultas de tracking. `matches` olha o texto; o vocabulário (nomes de formulário) é lido no `run`, que devolve `null` quando a empresa não tem ficha com próxima data (RNF-3).
- **Avisos**: cron Inngest por hora, no padrão de `src/inngest/functions/crons/`, com envio por `TrackingProviderBotChannel`. Idempotência por chave `pessoa + tipo + dia`.
- **PIX**: gerador de BR Code em `src/features/form-records/lib/` (função pura, com CRC16), leitura da chave em `ForgeSettings`, rota em `src/app/router/form-records/`, envio pelo chat do lead como as demais mensagens. Ação do ASTRO em `src/features/astro/actions/` com `requiresConfirmation: true`.
- **Modelo e menu**: `src/features/form/lib/starter-templates.ts` e `src/features/astro-bot/lib/menu/menu-tree.ts`.

## 6. Riscos

| Risco | Tratamento |
| --- | --- |
| Janela de 24 h da API oficial: resumo e aviso só chegam se o prestador escreveu ao número nas últimas 24 h | Registrar a falha e mostrar na tela "não enviado: janela fechada". Template aprovado fica para depois (não-objetivo) |
| RF-4 limpa a próxima data antiga e ela não volta se a ficha nova for apagada | Documentado; a ficha antiga continua existindo com todos os outros dados |
| Pergunta genérica ("quantos clientes tenho essa semana?") passar a responder fichas em vez de leads | RNF-3 e CA-9: só quando a empresa tem ficha com próxima data |
| Função Inngest nova | Exige "Resync app" no Inngest Cloud depois do deploy |
| BR Code inválido por nome ou cidade com acento ou longos | Normalizar (sem acento, limites do padrão) e testar em app de banco (CA-12) |

## 7. Ordem de entrega

1. Parte A e Parte E (RF-23): sem elas não há dado.
2. Parte B e RF-24: já dá para perguntar pelo WhatsApp.
3. Parte C.
4. Parte D.

Cada parte pode ser uma PR.

## 8. Em aberto

- **Branch**: a PR Act962/nasa.ex#451 está aberta na branch do ASTRO. Esta spec começa numa branch nova a partir da `main` (depois do merge da 451, de que ela depende para o menu e o canal de envio), ou segue na mesma?
- **Quem recebe os avisos**: cada pessoa liga o seu (RF-13 a RF-15). Alternativa: o dono liga para a empresa toda.

## 9. Changelog

- 2026-10-09 — criada, a partir do plano aprovado pelo Weydson.
- 2026-10-09 — aprovada pelo Weydson. Branch nova a partir da `main` (PR #451 já mergeada). Avisos por pessoa, como escrito (RF-13 a RF-15).
- 2026-10-09 — Partes A, B (consultas) e RF-23 implementadas. Divergências:
  - RF-4: sem ficha de origem, "mesmo item" passou a exigir o mesmo rótulo da ficha além do mesmo cliente. Só o cliente fazia o atendimento de um aparelho apagar o prazo de outro aparelho da mesma pessoa (achado no teste).
  - RF-23: são dois modelos, não um que cria as duas fichas; segue o padrão de "Abertura de O.S." e "Controle de consumo".
  - RF-9: o cliente é procurado só entre os que têm ficha, comparando sem acento (a frase chega ao ASTRO sem acento).
  - Migration `20261009210000_form_record_next_due` aplicada no banco de desenvolvimento com autorização; já traz as colunas do PIX (parte D).
- 2026-10-09 — conferido por script na ASTRO QA, com um formulário "Manutenção" de teste e 7 fichas: CA-1, CA-2, CA-3, CA-4 (sem origem, por rótulo), CA-5, CA-6, CA-7, CA-8 (pelo nome "Manutenção") e rascunho sem próxima data. Não conferido: preenchimento pela tela, CA-4 com ficha de origem, CA-9 em empresa sem ficha, CA-15 e a lista de fichas (RF-5), cuja tela aguarda aprovação do desenho.
- 2026-10-09 — RF-5 implementado depois da aprovação do desenho: filtro "Próxima data" (Todas, Vencidas, Próximos 7 dias, Até o fim do mês) e coluna com a distância até o prazo, em `components/record-next-due.tsx`. A coluna usa o rótulo do próprio campo; se o campo também estiver marcado como "mostrar na lista", a coluna comum dele é omitida. Conferido no navegador com o formulário de teste: cores, textos ("hoje", "em 4 dias", "venceu há 7 dias") e o filtro "Vencidas". RF-24 (App Fichas no menu do WhatsApp) e o gerador do PIX copia e cola (`lib/pix-br-code.ts`, RF-19) escritos; o CRC bate com o vetor padrão do CRC16-CCITT, mas o código ainda não foi lido por um app de banco (CA-12).
- 2026-10-09 — Parte D implementada depois da aprovação do desenho: `server/record-pix.ts` (chave em `ForgeSettings.paymentGatewayConfigs.PIX`, com `pixCity` novo no mesmo bloco), rotas `formRecords.pix.*`, `components/record-pix-actions.tsx` (botão "Chave PIX" na barra das fichas; "Enviar PIX" e "Marcar como paga" na ficha aberta) e as ações do ASTRO `form.send_record_pix` e `form.mark_record_paid`, as duas com confirmação. O PIX vai em duas mensagens (valor e recebedor; depois só o código). O padrão de "marcar como pago" do Financeiro passou a ignorar frases com "ficha". Conferido por script: as frases caem na ação certa e, sem chave cadastrada, a conferência devolve "cadastre a chave" sem enviar (CA-13). Não conferido: a tela, o envio real e a leitura do código num app de banco (CA-12).
- 2026-10-09 — Parte C implementada: `server/record-notices.ts`, rotas `formRecords.notices.*`, tela `components/record-notice-preferences.tsx` (dentro de "O que o ASTRO te manda no WhatsApp"), cron Inngest `send-record-notices` (de 15 em 15 min) e a ação `form.schedule_daily_records` (RF-17). Migration `20261009230000_notification_preference_params` (`params JSONB` em `user_notification_preference`) aplicada no banco de desenvolvimento com autorização. Detalhes:
  - A hora é cheia (00 a 23); quem escolhe 7h recebe entre 7h00 e 7h15.
  - O aviso de prazo sai na hora do resumo do dia da mesma pessoa; sem resumo ligado, às 8h.
  - "Uma vez por dia" é garantido marcando o dia em `params.lastRunOn` antes do envio (RF-16).
  - Falha de envio (ex.: janela de 24 h fechada) fica em `params.lastError` e aparece na tela.
  - RF-17 pelo padrão de frase exige a palavra "fichas"; com o nome do formulário ("manutenções") a frase vai para o classificador.
  - Conferido por script: canal resolvido para o número liberado, texto do resumo do dia e do aviso de prazo com as fichas de teste. Não conferido: a tela, o envio real, o cron (o Inngest local está desligado) e CA-10/CA-11 de ponta a ponta.
- 2026-10-09 — conferido no navegador, na ASTRO QA: bloco "Fichas" em ASTRO › WhatsApp com o número liberado, a hora e os dias; botão "Chave PIX" na barra das fichas; na ficha aberta, "Cadastrar chave PIX" (sem chave) e "Marcar como paga" → selo "Paga em 09/10" → "Desfazer baixa"; coluna de próxima data sem repetição. Segue sem conferência: envio real do PIX e leitura do código num app de banco (CA-12), envio real dos avisos e o cron (CA-10, CA-11), as ações pelo WhatsApp e CA-9/CA-15.
- 2026-10-09 — teste de ponta a ponta pelo caminho do WhatsApp (`maybeHandleBotMessage`, com envio real ao número do Weydson pelo número oficial de teste): ficha nova finalizada com próxima data calculada em 6 meses (CA-2); "quantas manutenções tenho essa semana?" (CA-5); "quanto faturei esse mês?" (CA-7); "me mostra as manutenções do Weydson"; "manda o PIX…" sem chave cadastrada devolve onde cadastrar (CA-13); resumo do dia ligado por frase (RF-17); agendador enviou os dois avisos na primeira execução e nenhum na segunda (RF-16, CA-10 e CA-11 sem o cron). Defeito achado e corrigido: a hora dita na frase ("às 20h") era ignorada, porque `\b` não reconhece "à" como letra. Continuam sem teste: envio real do PIX e leitura num app de banco (CA-12, falta a chave), o cron no Inngest e os cliques pela tela nesta rodada (o navegador parou de responder).

