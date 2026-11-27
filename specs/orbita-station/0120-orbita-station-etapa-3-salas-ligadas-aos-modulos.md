---
id: 0120
titulo: Órbita Station 3D, etapa 3 — salas ligadas aos módulos, portas trancadas e interação por perto
dominio: orbita-station
status: em-revisao
autor: João Gabriel (com Claude)
criada: 2026-10-29
atualizada: 2026-10-29
branch: claude/focused-hamilton-2dc35f (veio da feature/orbita-station-etapa-3-20261029, PR #484)
pr: 482
peso: completa
---

# 0120 — Órbita Station 3D, etapa 3: salas ligadas aos módulos, portas trancadas e interação por perto

> **Depende de:** [0119](0119-orbita-station-etapa-2-estacao-da-empresa.md) (estação da empresa e colegas ao vivo, PR #482).
> **Não bloqueia** a [0118](0118-loja-orbita-itens-na-estacao.md) (loja), que segue para a etapa 5.
> **Referência:** protótipo v33, em `docs/orbita-station/prototipo/`. As seções usadas são `Interação por proximidade`, `Painel lateral` (só `openRoomPanel` e `openUserPanel`), `canEnter`/`bumpLockedDoor`, `Portal de teletransporte` e `Animação` (aceno).

## 1. Contexto

Depois da etapa 2, a estação mostra a equipe andando ao vivo, mas **não leva a lugar nenhum**:

- cada sala é só um cenário;
- entrar no NasaChat não abre o NasaChat;
- todo mundo entra em todas as salas, inclusive no Financeiro;
- chegar perto de um colega não faz nada.

O protótipo resolveu isso com quatro peças:

1. **Prompt por proximidade:** a tecla E ou um botão na tela, com "Ver sala", "Falar com Ana" ou "Sem acesso".
2. **Painel lateral** da sala e do colega.
3. **Porta trancada**, que treme e mostra um aviso.
4. **Portal**, usado para os leads entrarem e saírem.

O que foi levantado no código antes de propor (S1, S4, S5):

- **Permissões:** a matriz já tem um app para cada módulo das salas (`src/features/permissions/lib/app-permission-catalog.ts`): `tracking`, `chat`, `spacetime`, `workspace`, `financeiro` e `forge`.
  - `getUserAppPermissions` (`src/features/permissions/server/app-permission.ts`) aplica a mesma regra da tela de Permissões: o Master sempre pode, e os outros papéis usam o override da empresa ou o padrão do papel.
- **Rotas dos módulos:** já estão em `src/features/apps/lib/sidebar-items.ts`. São `/tracking`, `/tracking-chat`, `/agendas`, `/workspaces/recente`, `/payment` e `/forge`.
- **Acesso por sala no protótipo:** cada sala tinha a própria lista de papéis e pessoas (`room.access`). No produto, isso seria uma segunda matriz de permissões, que o Master teria de manter em paralelo à primeira (ver D-1).
- **Aceno:** no protótipo era o braço girado no código, num boneco de outro rig. Os pacotes de animação do KayKit que já estão no repositório têm o clipe `Interact`, mas não têm um aceno pronto (ver §9).
- **Uso esperado:** continua o mesmo da 0119, até ~20 pessoas ao mesmo tempo.

## 2. Objetivo

Cada sala da estação passa a responder pelo módulo dela:

- quem tem acesso ao módulo entra na sala e abre o módulo a partir dela;
- quem não tem acesso encontra a porta trancada;
- chegar perto de uma sala ou de um colega oferece a ação certa, sem menu.

### Não-objetivos

- **Indicadores dentro das salas:** fila do chat, tarefas atrasadas, recebíveis, agenda do dia e o painel "O que pede atenção". Ficam para a **etapa 4**, que lê dados reais e precisa de um cuidado próprio com volume e permissão por dado. Nesta etapa o painel da sala mostra só pessoas e atalhos.
- **Leads andando na estação** (fila e guichês do NasaChat). Também ficam para a etapa 4, junto com o portal de chegada dos leads.
- **Acesso por sala configurado à mão:** papéis e pessoas escolhidos sala a sala, como no protótipo (D-1).
- **Voz, vídeo ou chat** ao "Falar com". O aceno é o único gesto desta etapa.
- **Editor de decoração e loja:** etapa 5 (0118).
- **Trancar a sala para quem está dentro dela agora.** Quem perde a permissão com a estação aberta só vê a porta trancada depois de recarregar (CB-4).

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Cada tipo de sala tem um **app da matriz** e uma **rota** fixos no código (tabela em D-2). Salas sem módulo (Copa, Administrativo, Banheiros) e o Terminal de Chegada ficam sempre abertos. |
| RF-2 | Uma sala está **aberta** para a pessoa quando ela tem **Ver** no app da sala. O servidor calcula isso e devolve junto com a estação. |
| RF-3 | **Porta trancada:** a pessoa não atravessa a porta de uma sala fechada. Ao tentar, a porta treme e aparece o aviso "Porta trancada: você não tem acesso a <sala>", no máximo uma vez a cada ~2 s. A placa da sala mostra um cadeado. |
| RF-4 | **"Ir até a sala"** (modo mapa e painel) para uma sala fechada leva a pessoa até a porta, do lado de fora, e não para dentro. |
| RF-5 | **Prompt por proximidade.** Um botão na parte de baixo da tela, acionado pela tecla **E** ou por toque, oferece uma ação só, nesta ordem de prioridade: |
| | 1. "Falar com <primeiro nome>", com um colega a até ~2,3 m; |
| | 2. "Sem acesso a <sala>", perto de uma porta trancada; |
| | 3. "Ver <sala>", dentro de uma sala. |
| | Fora dessas situações, o botão some. |
| RF-6 | **Painel da sala** (lateral, fecha com Esc). Mostra: |
| | - o nome e o módulo; |
| | - as pessoas presentes agora, que são os colegas ao vivo dentro dela; |
| | - **"Abrir <módulo>"**, que abre a rota do módulo numa aba nova; |
| | - "Ir até a sala", quando a pessoa não está nela. |
| | Para uma sala fechada, mostra só o nome e o aviso "Você não tem acesso a esta sala. Peça a um Master para liberar." |
| RF-7 | **Painel do colega**, aberto por "Falar com" ou pelo nome no mapa. Mostra o primeiro nome, a sala onde ele está e "Ir até <nome>". Ao abrir pelo "Falar com", os dois personagens acenam, e o colega vê o aceno ao vivo. |
| RF-8 | **Colega numa sala fechada para mim:** não é desenhado. No painel e no mapa aparece como "em sala restrita", e "Ir até" fica indisponível. |
| RF-9 | **Chegada e saída dos colegas pelo portal:** quem entra na estação aparece por um portal no ponto onde nasceu, e quem sai some por um portal. Hoje o personagem só surge e desaparece. |
| RF-10 | O aceno é uma mensagem nova (`emote`) no protocolo da sala da empresa, validada com Zod como as outras. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | A trava é **conforto, não segurança**. O que protege os dados de cada módulo continua sendo a permissão do próprio módulo, nas procedures dele. A posição de um colega numa sala fechada ainda chega ao navegador pela sala da empresa (D-3). Esta spec não pode prometer o contrário em nenhum texto da tela. |
| RNF-2 | O acesso às salas é calculado com **duas consultas no total**: o papel da pessoa e os overrides da empresa para os apps das salas. Nunca uma consulta por sala. |
| RNF-3 | **Nenhuma** migration, tabela, coluna, env var ou função do Inngest. |
| RNF-4 | O aceno tem um limite: no máximo um a cada 2 s por pessoa, tanto ao enviar quanto ao receber. |
| RNF-5 | O "Abrir <módulo>" abre numa aba nova (`noopener`), e a estação continua conectada na aba original (D-4). |
| RNF-6 | O mapa de salas para apps e rotas fica num arquivo só, em `layout/room-kinds.ts`. Nada de `if (kind === "finance")` espalhado pelo código. |
| RNF-7 | O portal reaproveita a geometria e a textura entre todos os portais, e tudo é liberado no `dispose`. A verificação de memória da 0117 (CA-6) continua valendo. |

## 4. Critérios de aceite

- [x] **CA-1** — Dado um membro sem **Ver** no app `financeiro`, quando ele anda até a porta do Financeiro, então não entra, a porta treme, aparece o aviso, e a placa mostra o cadeado. _(verificado no banco local, com a conta trocada para membro sem Financeiro: o personagem esbarra e escorrega pela parede, aparece "Porta trancada: você não tem acesso a Financeiro", a porta ganha a faixa vermelha e o mapa mostra o cadeado.)_
- [x] **CA-2** — Dado o Master, então todas as salas estão abertas. _(verificado: `appAccess` volta com todos os apps liberados.)_
- [ ] **CA-3** — Dado um membro que ganha **Ver** em `financeiro` na tela de Permissões, quando ele recarrega a estação, então a porta do Financeiro abre. _(o mesmo caminho foi visto mudando a permissão direto no banco e recarregando; falta pela tela de Permissões.)_
- [x] **CA-4** — Dada uma pessoa dentro do NasaChat, quando ela aperta E (ou toca no botão), então abre o painel da sala, e "Abrir Chat" abre `/tracking-chat` numa aba nova. A estação continua conectada na aba original. _(verificado: o painel mostra "Você" e o colega presente, e o link aponta para `/tracking-chat` com `target=_blank`.)_
- [ ] **CA-5** — Dados dois colegas a menos de ~2,3 m, quando um aperta E, então aparece "Falar com <nome>", o painel do colega abre e os dois personagens acenam nas duas telas. _(verificado com o colega simulado no LiveKit local: "Falar com Ana" aparece, o painel abre e a mensagem `emote` chega ao colega. Falta ver a animação do braço numa tela visível.)_
- [x] **CA-6** — Dado um colega dentro de uma sala fechada para mim, então não o vejo no 3D, e no mapa ele aparece "em sala restrita", sem "Ir até". _(verificado: o nome dele some do 3D; no mapa, a lista "Na estação" mostra "Em sala restrita", e o painel aberto por ela vem sem "Ir até".)_
- [x] **CA-7** — Dada uma sala fechada, quando escolho "Ir até a sala" no mapa, então o personagem para na porta, do lado de fora. _(verificado: ele para no corredor em frente ao Financeiro, e o botão mostra "Sem acesso a Financeiro".)_
- [ ] **CA-8** — Dado um colega que entra na estação, então ele aparece por um portal. Quando fecha a aba, some por um portal (depois do tempo da 0119, CA-9).
- [ ] **CA-9** — Dado o `getStation`, então o log de queries mostra no máximo duas consultas de permissão para calcular as salas, independentemente do modelo de estação. _(pelo código: `getUserPermissionsForApps` faz uma consulta do papel e uma dos overrides, para todos os apps juntos. Não foi conferido no log.)_
- [ ] **CA-10** — Dado um aceno forjado com campos a mais, ou mais de um por segundo vindo da mesma pessoa, então o cliente ignora sem erro.
- [ ] **CA-11** — Dados 12 ciclos de montar e liberar o motor com portais abertos, então não sobra canvas nem aviso de contexto WebGL (mesmo teste da 0117 CA-6).

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | O ponto de nascimento fica numa sala fechada | Não acontece: o Terminal de Chegada nunca tranca (RF-1). Se um modelo de estação não tiver Terminal, o nascimento é no corredor, que nunca tranca. |
| CB-2 | A pessoa fica dentro de uma sala que passou a ser fechada para ela (a estação foi remontada com outro modelo) | Ela volta ao Terminal, pela mesma regra de quem fica fora do piso novo (0119, RF-3). Não fica presa nem atravessa a parede. Ao abrir a página, todo mundo nasce no Terminal, que nunca tranca. |
| CB-3 | A sala comercial usa dois módulos (Tracking e Forge) | O acesso é decidido pelo app principal (`tracking`). O painel mostra um botão por módulo, e só os que a pessoa pode ver. |
| CB-4 | A permissão muda com a estação aberta | Nada muda até recarregar. Avisar ao vivo exigiria um evento novo para cada mudança da matriz, o que não se paga para ~20 pessoas (§9). |
| CB-5 | O "Falar com" é acionado com o colega a ponto de sair da estação | O painel abre com o último estado conhecido. Se ele sair, o painel mostra "saiu da estação" e "Ir até" some. |
| CB-6 | Duas pessoas acenam uma para a outra ao mesmo tempo | Cada aceno é independente. O limite de RNF-4 evita repetição. |
| CB-7 | A pessoa está no modo mapa ou com o estúdio aberto | O prompt fica escondido, e a tecla E não faz nada. |
| CB-8 | O app de um módulo foi desligado no plano da empresa ou some da matriz | A sala segue a resposta da matriz: sem **Ver**, a porta fica trancada. Rota inexistente não gera botão. |
| CB-9 | Tecla E pressionada com o foco num campo de texto (editor de salas) | Ignorada: o atalho só vale com o foco no canvas ou no corpo da página. |
| CB-10 | O LiveKit está indisponível (CB-7 da 0119) | Portas, painéis e "Abrir módulo" funcionam normalmente. "Falar com" não aparece, porque não há colegas. |

## 6. Decisões de design

### D-1 — O acesso à sala vem da permissão do módulo, sem lista por sala

- **Escolha:** a sala tranca quando a pessoa não tem **Ver** no app do módulo dela, segundo a matriz que já existe.
- **Alternativa descartada:** o acesso por sala do protótipo (papéis e pessoas escolhidos sala a sala, guardados em `OrbitaStation`). Foi descartado por três motivos:
  - Seria uma segunda matriz de permissões, mantida em paralelo à primeira.
  - As duas podem discordar: uma sala aberta para quem não vê o módulo, ou o contrário.
  - Seria um campo `Json` com regra de acesso, justamente o que a S3 manda evitar.
- **Consequência:** o Master não tranca uma sala sem módulo, como a Copa. Se esse pedido aparecer, ele vira uma spec própria, com uma coluna tipada.

### D-2 — Mapa de salas para apps e rotas

| Tipo de sala | App que decide o acesso | Botões "Abrir" |
| --- | --- | --- |
| Terminal de Chegada | sempre aberta | Tracking (`/tracking`), se puder ver |
| NasaChat | `chat` | Chat (`/tracking-chat`) |
| Recepção e Sala de reuniões | `spacetime` | Agenda (`/agendas`) |
| Financeiro | `financeiro` | Financeiro (`/payment`) |
| Workspace | `workspace` | Workspace (`/workspaces/recente`) |
| Comercial | `tracking` | Tracking (`/tracking`) e Forge (`/forge`) |
| Vendedores externos | `tracking` | Tracking (`/tracking`) e Agenda (`/agendas`) |
| Banheiros, Copa e Administrativo | sempre abertas | nenhum |

Os Banheiros apontavam para "Workspace (inspeções)" no protótipo. Ficam abertos porque trancar o banheiro por permissão de Workspace não faz sentido para quem usa. O vínculo com as inspeções volta na etapa 4, como indicador.

### D-3 — A trava é visual; nenhuma filtragem de presença por sala

- **Escolha:** a posição de todos continua indo para todos da empresa. O cliente apenas não desenha quem está numa sala fechada para ele.
- **Alternativa descartada:** enviar a posição só para quem pode ver a sala (`destinationIdentities` do LiveKit). Isso exigiria que cada navegador soubesse as permissões dos colegas, o que vaza a matriz. A outra saída seria um servidor intermediário repassando posições, que a 0119 (D-3) descartou.
- **Consequência:** alguém com conhecimento técnico consegue saber que um colega está no Financeiro. Isso não expõe nenhum dado do Financeiro. O protótipo dizia "o que acontece aqui dentro não é enviado"; o produto **não** usa essa frase.

### D-4 — O módulo abre numa aba nova

- **Escolha:** `window.open(rota, "_blank", "noopener")`.
- **Alternativa descartada:** navegar na mesma aba. Isso desconecta a pessoa da sala da empresa, e ela some para os colegas a cada clique, o que contraria a ideia do escritório aberto ao lado.
- **Consequência:** mais abas abertas. Só a aba da estação conecta ao LiveKit, então o CB-3 da 0119 (duas abas) não é afetado.

### D-5 — O portal entra na etapa 3 só para os colegas

O portal do protótipo nasceu para os leads, que ficam para a etapa 4. Ele já é usado aqui para a chegada e a saída dos colegas, com o mesmo componente. Assim, a etapa 4 só o reaproveita.

## 7. Impacto

- [ ] Schema / migration: **nenhum**.
- [x] Procedures oRPC: o `getStation` passa a devolver também `appAccess: Record<appKey, boolean>` (**Ver** em cada app usado pelas salas). O cliente decide a sala pelo `accessApp` e filtra os botões "Abrir" pelo mesmo mapa. A mudança é aditiva, e o cliente antigo ignora o campo.
- [x] Realtime: nova mensagem `emote` no tópico `orbita` do LiveKit. Clientes antigos validam com Zod e descartam o que não reconhecem.
- [ ] Automações (Inngest): nenhuma.
- [ ] Env vars: nenhuma.
- [ ] Breaking change: não.
- [x] Documentação: `docs/orbita-station-overview.md` (etapa 3, API do motor) e o README do protótipo (marcar os itens portados).

## 8. Plano de testes

O projeto não tem runner de teste (CLAUDE.md, regra 20). Como nas specs 0117 e 0119, os critérios são verificados manualmente, e o resultado fica registrado aqui.

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1, CA-2, CA-3, CA-7 | manual | Duas contas na mesma empresa (Master e membro), mudando a matriz entre recargas |
| CA-4 | manual | Abrir o módulo e conferir no painel do LiveKit que a estação continua conectada |
| CA-5, CA-6, CA-8, CA-10 | manual | Uma conta real mais o colega simulado no LiveKit local, como na 0119 |
| CA-9 | manual | Log de queries do Prisma em dev, numa chamada do `getStation` |
| CA-11 | manual | O mesmo laço de montar e liberar da 0117 CA-6 |

## 9. Riscos e rollback

- **Aceno sem animação pronta:** o KayKit não tem aceno, e o clipe `Interact` é o mais próximo. Se ele não ficar bom, o aceno vira uma rotação do osso do braço sobre a animação parada. Isso é decidido na implementação, sem mudar a spec.
- **Trava contornável no navegador:** é aceito, porque é conforto e não segurança (RNF-1, D-3).
- **Permissão que muda com a estação aberta** (CB-4): para refletir ao vivo seria preciso um evento a cada mudança da matriz. Fica para quando alguém sentir essa falta.
- **Rollback:** reverter o PR. Não há migration nem dado novo, e as mensagens `emote` antigas são descartadas pela validação.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-29 | João Gabriel (com Claude) | Criada |
| 2026-10-29 | João Gabriel (com Claude) | Implementada. O `getStation` devolve `appAccess` por app, em vez de `roomAccess` por tipo de sala: os botões "Abrir" também dependem dele (CB-3). CB-2 reescrito: a reconexão não move o personagem, então a sala só fica trancada "com ele dentro" quando a estação é remontada, e aí ele volta ao Terminal. Critérios verificados marcados. |
