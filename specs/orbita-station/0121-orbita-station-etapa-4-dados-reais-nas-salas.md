---
id: 0121
titulo: Órbita Station 3D, etapa 4 — dados reais nas salas, painel "O que pede atenção" e fila de leads do chat
dominio: orbita-station
status: em-revisao
autor: João Gabriel (com Claude)
criada: 2026-10-29
atualizada: 2026-10-29
branch: claude/focused-hamilton-2dc35f (veio da feature/orbita-station-etapa-4-20261029, PR #485)
pr: 482
peso: completa
---

# 0121 — Órbita Station 3D, etapa 4: dados reais nas salas, "O que pede atenção" e a fila de leads do chat

> **Depende de:** [0120](0120-orbita-station-etapa-3-salas-ligadas-aos-modulos.md) (salas ligadas aos módulos e painel da sala).
> **Referência:** protótipo v33 (`docs/orbita-station/prototipo/`), seções `Painel lateral` (`managerAlerts`, `roomDetails`), `Leads do NasaChat` e `Portal de teletransporte`.

## 1. Contexto

Depois da etapa 3, cada sala abre o módulo dela, mas **não diz nada** sobre o que está acontecendo nele. O protótipo mostrava dois tipos de informação:

- **Indicadores por sala:** fila do chat, leads de hoje, tarefas atrasadas, recebíveis vencidos, agenda do dia e propostas.
- **Fila de leads em 3D:** cada lead esperando atendimento entrava pelo portal e esperava no NasaChat, com o tempo de espera em cima da cabeça.

Tudo isso era dado de exemplo. O que foi levantado no código e no banco clone antes de propor (S1, S4, S5):

- **"Lead aguardando" não pode ser `statusFlow = WAITING`.** No banco clone há **4.114** leads em WAITING, e só **1** deles tem `awaitingSince`. O estado fica parado depois do atendimento, então a estação mostraria uma fila falsa de milhares de pessoas.
- **O critério certo já existe.** O detector de alertas `src/features/alerts/lib/detectors/lead-waiting.ts` (spec 0029, RF-4) considera aguardando o lead em que:
  - a última mensagem é dele (`lastInboundAt` depois de `lastOutboundAt`);
  - essa mensagem chegou nas últimas 12 h;
  - há uma conversa;
  - o lead não está arquivado nem apagado.

  A estação usa **o mesmo critério**, extraído para uma função compartilhada.
- **Quem vê os leads:** nos módulos de leads e chat, o escopo é o tracking em que a pessoa é participante (`participants: { some: { userId } }`, como em `src/app/router/leads/metrics-summary.ts`). A estação segue o mesmo escopo.
- **Volume no banco clone:** 46.745 leads em 146 trackings (o maior tem 11.761). Contar por `trackingId` usa o índice `leads_tracking_id_idx` (0,09 ms no `EXPLAIN`).
- **Atualização:** até ~20 pessoas na estação ao mesmo tempo (0119).

## 2. Objetivo

Cada sala mostra, no painel lateral, um resumo real do módulo dela, só para quem pode ver o módulo e só com os dados que essa pessoa já veria nele. Um painel "O que pede atenção" junta o que está pendente, e os leads que esperam resposta aparecem na sala do NasaChat.

### Não-objetivos

- **Estado de cada pessoa:** "em atendimento", "em reunião", "online" e a "confiança" do protótipo. Exige uma fonte de presença que não existe.
- **Tabela de vendedores, metas e carteira do ERP** (sala Comercial do protótipo). Isso é Insights, não a estação.
- **Inspeções dos banheiros e visitas dos vendedores externos.** Não existe módulo para isso.
- **Ler a conversa do lead dentro da estação.** O painel do lead só leva ao chat.
- **Pessoas sentadas nos postos.** Fica para o polimento.
- **Aviso instantâneo de lead novo:** a fila atualiza a cada 30 s (D-2).

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Nova procedure `orbitaStation.getRoomIndicators`. Devolve os indicadores das salas da estação, cada bloco só se a pessoa tem **Ver** no app do módulo. Sem permissão, o bloco vem `null` e não é calculado. |
| RF-2 | **NasaChat** (app `chat`): quantos leads estão aguardando e há quanto tempo espera o mais antigo. Inclui até 8 leads, com primeiro nome e inicial do sobrenome, canal, início da espera e id da conversa. |
| RF-3 | **Terminal de Chegada** (app `tracking`): leads criados hoje e as 3 origens mais comuns (`source`). |
| RF-4 | **Workspace** (app `workspace`): **minhas** tarefas atrasadas e as que vencem hoje (`ActionsUserResponsible` = eu, `isDone = false`, sem arquivar), com até 5 títulos das atrasadas. |
| RF-5 | **Financeiro** (app `financeiro`): recebíveis vencidos (quantidade e soma) e o total a receber hoje, da empresa. |
| RF-6 | **Recepção e Sala de reuniões** (app `spacetime`): os próximos compromissos de hoje (até 5: hora, título e status, sem os cancelados), das agendas dos trackings em que a pessoa participa. |
| RF-7 | **Comercial** (app `forge`): propostas em aberto (rascunho, enviada e vista) e contratos aguardando assinatura, em quantidade. |
| RF-8 | O painel da sala mostra o bloco dela acima de "Pessoas aqui". Cada número diz a origem em palavras simples. Por exemplo: "aguardando = a última mensagem é do cliente, nas últimas 12 h". |
| RF-9 | **"O que pede atenção":** um botão no topo, com um selo da quantidade, abre uma lista que junta os itens pendentes: fila do chat maior que zero, minhas tarefas atrasadas, recebíveis vencidos e propostas em rascunho. Cada item leva até a sala dele (com "Ir até") e abre o painel. |
| RF-10 | **Fila em 3D:** cada lead aguardando (até 8) vira um personagem no NasaChat, sem capacete e com visual tirado do id. Quem chega à fila entra pelo portal na porta da sala; quem sai da fila sai pelo portal. Acima de 8, aparece a etiqueta "+N aguardando". |
| RF-11 | Cada lead da fila tem uma etiqueta com o tempo de espera, colorida em três faixas: até 5 min, de 5 a 10 min e mais de 10 min. Clicar no lead, ou chegar perto e apertar E, abre o painel do lead: primeiro nome, canal, espera e **"Abrir conversa"** (`/tracking-chat/<id>`, numa aba nova). |
| RF-12 | Os leads só aparecem para quem pode entrar no NasaChat (0120, RF-2) e tem **Ver** no app `chat`. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Toda consulta filtra pela empresa ativa. Leads e agenda filtram também pelos trackings em que a pessoa participa, e tarefas pelo responsável. A estação não mostra nada que o módulo não mostraria a essa pessoa. |
| RNF-2 | Só contagens, somas e listas curtas (`take` de no máximo 8). Nenhum `findMany` sem limite. Os blocos rodam em paralelo, com tempo-alvo abaixo de 300 ms no banco clone. |
| RNF-3 | Atualiza a cada 30 s só com a aba visível, sem Pusher, Inngest nem cron (D-2). Com ~20 pessoas, são ~40 chamadas por minuto, no total. |
| RNF-4 | O nome do lead sai do servidor já reduzido ("Maria S."). Telefone, e-mail e mensagens não saem. |
| RNF-5 | O critério de "aguardando" é **uma função só**, usada pelo detector de alertas e pela estação. Mudar o critério muda os dois. |
| RNF-6 | Os personagens dos leads reaproveitam o `CharacterFactory` e o portal. Tudo é liberado no `dispose` (0117, CA-6). |
| RNF-7 | Nenhuma migration, tabela, env var ou função do Inngest. |

## 4. Critérios de aceite

- [x] **CA-1** — Dado um lead cuja última mensagem é dele, de 7 min atrás, num tracking em que participo, quando abro o painel do NasaChat, então vejo "1 aguardando", com a espera em amarelo, e o personagem dele na sala. _(verificado no banco local com 10 leads de teste: o painel mostra "10 aguardando", a maior espera e a lista com as cores certas, e 8 personagens aparecem na sala, cada um com o tempo em cima.)_
- [x] **CA-2** — Dado esse lead respondido no chat, então em até ~30 s ele sai da fila pelo portal, e o número cai. _(verificado gravando `last_outbound_at` num lead: em menos de 30 s ele saiu, o painel dele passou a dizer "Já foi respondido" e o próximo ocupou o lugar.)_
- [ ] **CA-3** — Dados leads em `statusFlow = WAITING` sem mensagem recente do cliente, então eles **não** aparecem na fila. _(pelo critério: a consulta não usa `statusFlow`. Falta testar numa empresa com leads assim.)_
- [x] **CA-4** — Dado um lead aguardando num tracking em que não participo, então ele não aparece na fila nem conta no número. _(verificado tirando a participação no funil, no banco local: a fila e as chegadas zeraram; a participação foi devolvida depois.)_
- [ ] **CA-5** — Dada uma pessoa sem **Ver** em `financeiro`, então `getRoomIndicators` devolve `finance: null`, e nenhuma consulta de `PaymentEntry` roda.
- [ ] **CA-6** — Dada uma tarefa minha vencida e não concluída, então ela conta em "atrasadas" no Workspace e aparece em "O que pede atenção". Tarefa de outra pessoa não conta. _(a primeira parte foi verificada: 3 tarefas atrasadas aparecem no Workspace e no sino. Falta conferir com a tarefa de outra pessoa.)_
- [x] **CA-7** — Dados 12 leads aguardando, então 8 personagens aparecem na sala e a etiqueta mostra "+4 aguardando". _(verificado com 10: 8 personagens e "+2 aguardando".)_
- [x] **CA-8** — Dado "Abrir conversa" no painel do lead, então `/tracking-chat/<id>` abre numa aba nova. _(verificado: E perto do lead abre o painel, e o link tem `target=_blank`.)_
- [ ] **CA-9** — Dada a aba escondida, então nenhuma chamada a `getRoomIndicators` acontece até ela voltar.
- [ ] **CA-10** — Dado o banco clone, então `getRoomIndicators` responde em menos de 300 ms (medido no log do servidor). _(no servidor de desenvolvimento, de 184 a 850 ms de código da aplicação, com o banco no Docker do Windows. Falta medir em produção.)_
- [ ] **CA-11** — O detector de alertas `lead-waiting` continua achando os mesmos leads depois de passar a usar a função compartilhada.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | A pessoa não participa de nenhum tracking | Os blocos de chat, Terminal e agenda vêm zerados, com o texto "você não participa de nenhum funil". Nenhuma consulta de lead roda com lista vazia. |
| CB-2 | A estação não tem sala de NasaChat (modelo compacto) | A fila em 3D não é montada. O número continua em "O que pede atenção". |
| CB-3 | O mesmo lead sai da fila e volta antes da próxima atualização | Segue o estado de cada atualização. Se ele estava e continua, não passa pelo portal de novo. |
| CB-4 | A atualização falha (rede ou 500) | Mantém os últimos dados, com o aviso discreto "dados de hh:mm". Não esvazia a fila nem tira o personagem. |
| CB-5 | Um lead sem `lastInboundAt` | Não entra: o critério exige a data. |
| CB-6 | O nome do lead está vazio ou é só um telefone | Aparece "Cliente", sem expor o número. |
| CB-7 | Moedas e centavos | `PaymentEntry.amount` é guardado em centavos. A tela formata com o helper canônico de moeda do projeto (S5), sem criar outro. |
| CB-8 | "Hoje" e fuso horário | Não existe fuso por empresa no schema: "hoje" é o dia em `America/Sao_Paulo` (UTC-3 fixo desde 2019), igual nos blocos de leads, tarefas, financeiro e agenda. |
| CB-9 | A permissão muda com a estação aberta | O próximo `getRoomIndicators` já respeita a mudança: o bloco passa a vir `null`. A porta só muda ao recarregar (0120, CB-4). |

## 6. Decisões de design

### D-1 — "Aguardando" é o critério dos alertas (0029), não o `statusFlow`

- **Escolha:** extrair a condição do detector `lead-waiting` para uma função compartilhada, `waitingLeadWhere(now)` em `src/features/alerts/lib/`. A estação e o detector usam a mesma função.
- **Alternativa descartada:** `statusFlow = WAITING`. O banco clone mostra que ele fica parado depois do atendimento (4.114 leads e só 1 com espera registrada).
- **Alternativa descartada:** `awaitingSince` (spec 0113). Só existe nas empresas com `ATTENDANCE_STATE_ORGS` ligado.
- **Consequência:** a fila da estação e o alerta "lead esperando" sempre concordam.

### D-2 — Atualizar a cada 30 s, em vez de tempo real

- **Escolha:** TanStack Query com `refetchInterval: 30_000` e `refetchIntervalInBackground: false`.
- **Alternativa descartada:** evento do Pusher a cada mensagem recebida. Seria preciso mexer no pipeline de mensagens do chat, que é caminho quente, para um ganho de no máximo 30 s.
- **Alternativa descartada:** a mensagem passar pelo LiveKit. Só quem está com a estação aberta saberia da mensagem.
- **Consequência:** um lead novo aparece em até 30 s. A carga fica limitada pelo número de pessoas com a estação aberta, não pelo volume de mensagens.

### D-3 — Uma procedure para todas as salas

- **Escolha:** `getRoomIndicators` devolve todos os blocos de uma vez, cada um calculado só se a pessoa tem permissão.
- **Alternativa descartada:** uma procedure por sala. Seriam seis chamadas a cada 30 s por pessoa, e a matriz de permissão seria lida seis vezes.
- **Consequência:** um bloco lento atrasa todos. O RNF-2 limita cada consulta a contagens e listas curtas.

### D-4 — Os leads são personagens só na tela, não colegas

- **Escolha:** os personagens dos leads são montados pelo motor a partir da lista do servidor. Não passam pela sala do LiveKit e não são clicáveis como colegas.
- **Consequência:** cada pessoa vê a fila dos trackings dela. Duas pessoas podem ver filas diferentes, e isso é o certo.

## 7. Impacto

- [ ] Schema / migration: **nenhum**.
- [x] Procedures oRPC: nova `orbitaStation.getRoomIndicators`, só leitura.
- [x] Alertas: a condição do `lead-waiting` passa a vir de uma função compartilhada, sem mudar o comportamento (CA-11).
- [ ] Realtime: nenhum.
- [ ] Inngest: nenhuma função nova. O detector existente só troca a origem do `where`.
- [ ] Env vars: nenhuma.
- [x] Documentação: `docs/orbita-station-overview.md` e o README do protótipo.

## 8. Plano de testes

O projeto não tem runner de teste (CLAUDE.md, regra 20). Os critérios são verificados manualmente, no banco clone, e o resultado fica registrado aqui.

| Critério | Como verificar |
| --- | --- |
| CA-1 a CA-4, CA-7 | No banco local, criar e ajustar leads de teste (datas de mensagem e participantes) e abrir a estação |
| CA-5, CA-6 | Conta trocada para membro, com a matriz ajustada no banco local (desfeito depois), como na 0120 |
| CA-9 | Painel de rede com a aba escondida |
| CA-10 | Tempo da chamada no log do servidor |
| CA-11 | Rodar o detector com escopo da empresa de teste antes e depois da extração e comparar os ids |

## 9. Riscos e rollback

- **Consulta lenta numa empresa grande:** o tracking com 11 mil leads conta pelo índice de `tracking_id`. Se ficar lento em produção, o próximo passo é um índice `(tracking_id, last_inbound_at)`, numa migration separada e só depois de medir.
- **Dado sensível na tela 3D:** só sai primeiro nome e inicial, e a pessoa já veria esse lead no chat (RNF-1, RNF-4).
- **Rollback:** reverter o PR. Não há dado novo, e o detector volta ao `where` local.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-29 | João Gabriel (com Claude) | Criada |
| 2026-10-29 | João Gabriel (com Claude) | Implementada. CB-8 reescrito: o schema não tem fuso por empresa. Critérios verificados marcados. Achado no teste e fora do escopo: o "Ir até" anda em linha reta e pode prender num móvel perto da porta, quando a pessoa sai de um ponto fora do centro da sala (vale para todas as etapas). |
