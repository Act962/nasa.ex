# Órbita Station 3D — visão geral

Escritório virtual em 3D em que cada sala corresponde a um módulo da plataforma. É um produto **novo**, sem relação com a Space Station 2D (`src/features/space-station/`, em Phaser). Os dois não compartilham código, dados nem specs.

| Item | Onde |
| --- | --- |
| Rota | `/orbita-station`, em `src/app/(platform)/orbita-station/page.tsx`. Exige login e não aparece no menu até a etapa 2. |
| Domínio | `src/features/orbita-station/` |
| Modelos 3D | `public/orbita-station/models/` (créditos e licenças em `CREDITS.txt`, todos CC0) |
| Protótipo (referência temporária) | [docs/orbita-station/prototipo/](orbita-station/prototipo/README.md): fonte da versão 33. **Apagar** quando o que ainda só existe nele estiver portado (lista no README da pasta) |
| Specs | [0117 — etapa 1](../specs/orbita-station/0117-orbita-station-3d-etapa-1.md) · [0119 — etapa 2](../specs/orbita-station/0119-orbita-station-etapa-2-estacao-da-empresa.md) · [0120 — etapa 3](../specs/orbita-station/0120-orbita-station-etapa-3-salas-ligadas-aos-modulos.md) · [0121 — etapa 4](../specs/orbita-station/0121-orbita-station-etapa-4-dados-reais-nas-salas.md) · [0118 — loja](../specs/orbita-station/0118-loja-orbita-itens-na-estacao.md) |

## Etapas

| Etapa | O que entra | Status |
| --- | --- | --- |
| 1 (spec 0117) | Estação do protótipo como código do app, sem banco: modelos de estação, personagem, câmera, acabamento | 🚧 em construção |
| 2 (spec 0119) | Estação da empresa no banco, avatar no servidor, colegas ao vivo (LiveKit), permissões, link no menu | 🚧 pronta, PR #482 |
| 3 (spec 0120) | Salas ligadas aos módulos: porta trancada pela matriz de permissões, botão de proximidade (E), painel da sala e do colega, aceno, portal na chegada e saída dos colegas | 🚧 implementada, em revisão |
| 4 (spec 0121) | Dados reais nas salas (`getRoomIndicators`, a cada 30 s), "O que pede atenção" e a fila de leads do NasaChat em 3D, com portal | 🚧 implementada, em revisão |
| 5 (sem spec) | Editor de decoração e loja (0118) | ⬜ |
| Final | Remover a Space Station 2D (`src/features/space-station/`, rotas, permissão `space-station` e, em migration separada depois do deploy, as tabelas `SpaceStation*` e afins) | ⬜ quando o 3D estiver pronto |

O tempo real da etapa 2 usa um servidor do LiveKit nosso, na VPS: ver [livekit-self-hosted.md](livekit-self-hosted.md).
| Loja (spec 0118) | Comprar itens com STARS e posicioná-los | ⬜ depende da etapa 2 |

## Estrutura

```
src/features/orbita-station/
├── layout/      # funções puras (sem Three.js nem DOM): modelos de estação, tipos de sala, montagem e colisão
├── engine/      # Three.js puro: StationEngine, estrutura, móveis, personagem, acabamento, biblioteca de modelos
├── components/  # React: canvas, interface, joystick
├── store/       # Zustand da interface
└── lib/         # preferências no navegador (Zod), visual do avatar
```

## API do motor (`engine/station-engine.ts`)

A interface só fala com o motor por estes métodos e eventos. O motor não importa React.

| Método | O que faz |
| --- | --- |
| `start()` | Baixa os modelos, monta a estação e começa o loop. |
| `setStation(key, roomNames)` | Remonta as salas com outro modelo ou outros nomes. |
| `walkToRoom(key)` / `walkToColleague(id)` | Anda sozinho até a sala (para na porta se ela estiver trancada) ou até perto do colega. |
| `colleagues()` / `isRoomOpenForMe(key)` | Colegas presentes, com a sala e se estão numa sala trancada para quem olha; e se uma sala está aberta. |
| `wave(colleagueId?)` / `remoteWave(id)` | Aceno do próprio personagem (e do colega com quem fala) ou de um colega. |
| `setWaitingLeads(leads, overflow)` / `queueLabels()` | Fila de leads do NasaChat: quem entra chega pelo portal e quem sai vai embora por ele; posições das etiquetas de espera e do "+N". |
| `firstRoomOfKind(kind)` | Primeira sala de um tipo no modelo atual (o "O que pede atenção" usa para levar até ela). |
| `setLook(look)` | Troca o visual do personagem. |
| `setQuality("medio" \| "leve")` | Liga ou desliga o brilho. |
| `setMoveInput(x, y)` | Joystick de toque, de -1 a 1. |
| `zoomBy(factor)` | Aproxima ou afasta a câmera, dentro do limite. |
| `captureImage()` | PNG da tela atual. |
| `dispose()` | Libera tudo: GPU, contexto WebGL, eventos. |

| Evento (`onEvent`) | Quando |
| --- | --- |
| `ready` | A estação está montada e o personagem nasceu. |
| `roomChange` | O personagem entrou numa sala ou no corredor (`room: null`). |
| `interactionChange` | Mudou a ação do botão de proximidade: colega perto, porta trancada à frente, a sala atual, ou nenhuma. |
| `lockedDoor` | O personagem esbarrou numa porta trancada (no máximo a cada ~2 s). |
| `qualityChange` | O nível gráfico mudou (inclusive a queda automática para "leve"). |
| `error` | Os modelos 3D não carregaram. |

## Decisões que não devem ser revertidas sem argumento novo

- **Three.js puro, não `@react-three/fiber`** (0117, D-2): portar a lógica validada custa menos que reescrever tudo em formato declarativo.
- **Modelos como arquivos estáticos** (0117, D-4), carregados uma vez. Os móveis da cena são clones que dividem a geometria (`userData.sharesGeometry`), então `disposeObject` não libera a geometria deles.
- **Luzes multiplicadas por π** em relação ao protótipo: desde a r155 o Three.js usa unidades físicas.
- **Reflexo pela cena com `scene.environmentIntensity = 0,22`**: desde a r163 o `envMapIntensity` do material é ignorado quando o reflexo vem de `scene.environment`. Material que precisa de outra intensidade recebe o mapa direto (`bindEnvironment` no motor). Sem isso, a cena fica ~4,5x mais clara.
- **Porta trancada vem da permissão do módulo** (0120, D-1): o app da matriz de cada tipo de sala fica em `layout/room-kinds.ts` (`accessApp` e `links`). Não existe lista de acesso por sala.
- **"Ir até" por A* numa grade de 0,4 m** (`layout/path-finding.ts`): desvia de paredes, móveis e salas trancadas, e depois corta os degraus por linha de visão. O destino continua o dos pontos de porta (`planRouteToRoom`), que segue como reserva se não houver caminho. Calcula uma vez por clique (~2 ms).
- **"Lead aguardando" é o critério dos alertas** (0121, D-1): `waitingLeadWhere` em `src/features/alerts/lib/waiting-lead.ts`, compartilhado com o detector `lead-waiting`. Nunca `statusFlow = WAITING`, que fica parado depois do atendimento.
- **A trava é só visual** (0120, D-3): a posição de quem está numa sala trancada chega igual ao navegador; ela só não é desenhada. Quem protege os dados é a permissão de cada módulo.
- **Tamanho zero do canvas é ignorado** até ele ganhar tamanho. No protótipo isso deixava a tela preta para sempre (0117, CB-2).

## Changelog

| Data | Mudança |
| --- | --- |
| 2026-10-27 | Criado com a primeira parte da etapa 1: estrutura, móveis, personagem, câmera, acabamento e rota. |
| 2026-10-28 | Estúdio do personagem (prévia em `engine/studio-preview.ts`, abre sozinho na primeira visita) e modo mapa (tecla M, clique na sala leva o personagem até ela). Novos métodos do motor: `setMode`, `setPaused`, `walkToRoom`, `roomLabels`, `openStudio`. |
| 2026-10-28 | Etapa 2, parte sem tempo real: tabela `orbita_stations`, coluna `user.orbita_avatar`, procedures `orbitaStation.getStation` / `updateStation` / `avatar.save`, app `orbita-station` na matriz (só o Master por padrão), editor da estação e app na página Apps. |
| 2026-10-29 | Fonte do protótipo (versão 33) guardado em `docs/orbita-station/prototipo/` como referência temporária, com a lista do que falta portar e o aviso de remoção. |
| 2026-10-29 | Etapa 3 (spec 0120): `getStation` devolve `appAccess`, portas trancadas, botão de proximidade, painéis da sala e do colega, aceno (mensagem `emote`), portal (`engine/portal.ts`). |
| 2026-10-29 | Etapa 4 (spec 0121): `getRoomIndicators` (chat, chegadas, tarefas, financeiro, agenda e Forge, cada um só com Ver no módulo), painel "O que pede atenção", indicadores no painel da sala, fila de leads em 3D com portal e painel do lead. |
| 2026-10-29 | "Ir até" desvia dos móveis: A* numa grade sobre o piso, usado em `walkToRoom` e `walkToColleague`. Antes era só uma linha reta entre os pontos de porta, que prendia nas mesas. |
