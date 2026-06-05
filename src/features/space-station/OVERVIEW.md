# Space Station — Visão geral do domínio

> Documento vivo do mundo virtual da plataforma. Atualize ao mudar
> arquitetura, mover/criar arquivos relevantes ou avançar uma fase do
> roadmap. Companheiro do plano em
> `.claude/plans/precisamos-concertar-esse-app-temporal-meadow.md`.

## O que é

`space-station` é um metaverso 2D (Phaser 4) estilo Gather/WorkAdventure. Cada
usuário ou organização tem uma "Space Station" que é, simultaneamente:

- um **perfil público social** em `/@<nick>` (banner, bio, módulos, organograma,
  Stars recebidas, explorador de outras stations);
- um **mundo navegável** em `/@<nick>/world` onde avatares andam num mapa,
  conversam por **proximidade de áudio/vídeo/tela**, interagem com áreas
  ("Funções NASA") e podem visitar **eventos com ingresso** servidos pela
  feature irmã [`world-events`](../world-events).

O mundo é usado para coworking persistente, salas de reunião, atendimento ao
cliente (balcão), palestras/cursos ao vivo (auditório) e loja virtual
(prateleira).

## Onde mora o código

```
src/features/space-station/
├── admin/                  # Painel de admin (CRUD da station, módulos)
├── components/             # Perfil público (header, modules grid, org chart, …)
│   └── world/              # UI do mundo (overlays React em volta do Phaser)
│       ├── map-editor/     # Editor de mapas (objetos, áreas, tiles)
│       └── scenes/         # Phaser scenes (PreloadScene, WorldScene)
├── hooks/                  # use-station, use-world-presence,
│                           # use-webrtc (legacy), use-sfu-room (novo),
│                           # use-station-world
├── lib/                    # (placeholder p/ services de domínio — fase 2+)
├── utils/                  # Pipeline de sprites (Pipoya/LPC/visor)
├── types.ts                # Modelos + enums + metadata (AreaType, RoomType, …)
└── OVERVIEW.md             # Este arquivo
```

Backend (procedures oRPC) fica em [`src/app/router/space-station/`](../../app/router/space-station/)
seguindo a convenção dominante do projeto. Infra de mídia compartilhada vive em
[`src/lib/livekit/`](../../lib/livekit/) e [`src/lib/media/`](../../lib/media/).

## Stack

| Camada            | Tecnologia                                       |
| ----------------- | ------------------------------------------------ |
| Motor 2D          | Phaser 4 (arcade physics)                        |
| Mídia (SFU)       | **LiveKit Cloud** + `livekit-client@^2.16`       |
| Mídia (fallback)  | WebRTC mesh caseiro (sai na Fase 4)              |
| Presença/posição  | Pusher Channels (presence + private)             |
| RPC               | oRPC + TanStack Query                            |
| Persistência      | Prisma 7 + PostgreSQL                            |
| Storage de sprite | Cloudflare R2                                    |

## Arquitetura

### 1. Backend — procedures oRPC

33 procedures em [`src/app/router/space-station/`](../../app/router/space-station/),
agrupadas por função:

- **CRUD/perfil**: `create-station`, `update-station`, `get-by-nick`, `get-my-station`,
  `list-my-stations`, `list-stations`.
- **Mundo**: `update-world`, `get-world`, `world-assets`, templates (`list/get/apply/publish/delete-world-template`).
- **Mídia**: [`join-world`](../../app/router/space-station/join-world.ts) (entrega o
  token LiveKit do mundo persistente).
- **Social**: `send-star`, `get-org-chart`, `create-user-connection`, `list-my-connections`,
  `resolve-peer-as-lead` (liga peer do mundo a Lead/Conversation do Tracking).
- **Acesso**: `check/request/list/handle-access-request`, `update-station-access-mode`.
- **Avatar / geo / bubble**: `list/publish-avatar-template`, `update-org-location`,
  `list-org-stations-with-location`, `get-bubble-peers-status`.

Mutações validam ownership (USER pelo `userId`, ORG por `member` da organização ativa).

### 2. Mídia — LiveKit SFU + fallback mesh (transição em curso)

Implementação atual em [`src/features/space-station/hooks/`](./hooks/):

- **[`use-sfu-room.ts`](./hooks/use-sfu-room.ts)** — hook alvo. Substitui o mesh com a
  **mesma fachada** (`peers`, `localStream`, `micOn/camOn/screenOn`,
  `toggleMic/Cam/Screen`, devices, bubble, …) usando LiveKit. Toggles mapeiam para
  `room.localParticipant.setMicrophoneEnabled / setCameraEnabled / setScreenShareEnabled`
  — adeus renegociação manual, glare e perfect-negotiation.
- **[`use-station-world.ts`](./hooks/use-station-world.ts)** — `useJoinWorld()` busca o
  token LiveKit via oRPC ([`join-world.ts`](../../app/router/space-station/join-world.ts)).
- **[`use-webrtc.ts`](./hooks/use-webrtc.ts)** — mesh P2P legacy. Permanece como fallback
  controlado por feature flag `NEXT_PUBLIC_USE_SFU`. Sai na Fase 4.

A escolha do transporte está em [`space-game.tsx:159`](./components/world/space-game.tsx):

```ts
const isLoggedIn = !rawUserId.startsWith("guest");
const joinWorldQuery = useJoinWorld(stationId, { enabled: USE_SFU && isLoggedIn });
const sfuReady = USE_SFU && isLoggedIn && Boolean(joinWorldQuery.data?.sfuToken);
const sfu  = useSfuRoom({ token: sfuReady ? ... : null, ... });
const mesh = useWebRTC({ ..., enabled: !sfuReady });
const webrtc = sfuReady ? sfu : mesh;
```

Util transversal de mídia em [`src/lib/media/`](../../lib/media/):

- **`audio-unlock.ts`** — destrava autoplay (chama `room.startAudio()` no primeiro
  gesto do usuário). Fix direto do bug "não ouço".
- **`use-room-resilience.ts`** — reflete `RoomEvent.Reconnecting/Disconnected` na UI;
  re-enumera devices em `MediaDevicesChanged`.

LiveKit Cloud configurado via variáveis em `.env`:
`LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_WS_URL`, `NEXT_PUBLIC_LIVEKIT_URL`.

### 3. Presença e posição — Pusher

[`use-world-presence.ts`](./hooks/use-world-presence.ts) — presence channel
`presence-world-<stationId>`. Movimento (~8fps) e join/leave via `/api/pusher/world`.
Esta camada permanece em Pusher mesmo após a migração para LiveKit (Pusher trata da
presença global do mundo; LiveKit trata da mídia da sala/proximidade).

Convidados anônimos (sem login) vêem o mundo e os avatares via Pusher, mas **não
entram no SFU** (não publicam nem recebem mídia).

### 4. Motor — Phaser

[`scenes/world-scene.ts`](./components/world/scenes/world-scene.ts) (4.2k linhas) é
hoje monolítica e concentra:

- Movimento + animação do player (LPC 64×64); atalhos: setas e WASD.
- Física Arcade + colisões + render procedural de 13 cenários e ~50 texturas de tile.
- Multiplayer (sprites remotos com `loadGen` para cancelar loads stale).
- Map editor (objetos, áreas, tiles com flood-fill/rect, undo/redo).
- Sistema de proximidade (raio 6 tiles = 192px) que emite
  `space-station:proximity-enter/leave` → consumido pelo hook de mídia.
- Sistema de áreas (`checkAreaTriggers`) que emite `space-station:area-enter/leave`.

Comunicação Scene ↔ React via `window.CustomEvent` com prefixo `space-station:*`.

### 5. Pipeline de avatar — utilitários

[`utils/`](./utils/) cobre: conversão de foto pessoal → Pipoya 96×128
(`portrait-to-pipoya.ts`, sem API externa, remove fundo com flood-fill BFS),
composição de overlays Woka (`composite-spritesheet.ts`), encaixe de foto no visor
do astronauta LPC (`composite-visor.ts`, ainda não integrado no carregador), defaults
determinísticos por `userId` (`sprite-defaults.ts`, djb2 → 167 variantes Pipoya), e
suporte a Tiled (`tiled-loader.ts`, `tiled-canvas-renderer.ts`).

### 6. Modelos Prisma envolvidos

`SpaceStation`, `SpaceStationWorld`, `SpaceStationStar`, `StationPublicModule`,
`StationAccessRequest`, `WorldGameAsset`, `WorldTemplate`, `AvatarTemplate`,
`UserConnection`, `WorldEvent`, `WorldEventTicket`.

`WorldEvent.stationId` é o elo entre `world-events` e `space-station` — eventos
são organizados por stations e usam o mesmo conceito de mapa (`mapData`, `zones`).

## Estado atual

### O que funciona
- Perfil público (`/@<nick>`): header, módulos, organograma, Stars, explorer.
- Admin da station (CRUD básico, isPublic, módulos públicos, mundo).
- Mundo navegável com avatares Pipoya/LPC.
- Editor de mapas (objetos, áreas, tiles, templates).
- Map editor com persistência via `updateWorld`.
- Presença/posição multiplayer (Pusher).
- Mídia local: mic/cam/screen-share (via LiveKit no caminho novo).
- Movimento por setas **e WASD** (paralelo).
- Lojas/templates de mundo e avatar (publicar/aplicar).
- Acesso restrito por `accessMode` (OPEN/MEMBERS_ONLY/REQUEST) + pedidos.

### O que está atrás de feature flag
- **Transporte de mídia LiveKit** (`NEXT_PUBLIC_USE_SFU`, default ON). Sem credenciais
  LiveKit ou para convidados, cai automaticamente no mesh.
- Banner "clique para ativar áudio" / "reconectando" só aparece no caminho LiveKit.

### O que é placeholder
- **Áreas NASA**: handlers de `n-box`, `balcao`, `auditorio`, `prateleira`,
  `agendamento`, `demanda`, `formulario`, `profile`, `rede-social`, `imagem-link`
  só mostram **toast informativo "(em breve)"** em
  [`space-game.tsx:386`](./components/world/space-game.tsx).
- **`world-events` no renderer**: `event-enter-client.tsx` ainda mostra um painel
  "estamos quase lá" em vez de carregar o motor Phaser com o `mapData` + zonas do
  evento.
- **Composição do visor LPC**: `composite-visor.ts` existe mas não é chamado pelo
  `loadLpcSpritesheet` da `world-scene.ts`.

### Dívidas / red flags conhecidos
- `world-scene.ts` com 4.211 linhas concentra responsabilidades demais.
- `world-settings-panel.tsx` com 1.608 linhas pede divisão.
- Procedures vivem em `src/app/router/space-station/` (padrão dominante do projeto)
  e não em `features/<dominio>/server/` — aceito; só anotar para não confundir o
  CLAUDE.md.
- `useSendStar` e outros mutation hooks em [`use-station.ts`](./hooks/use-station.ts)
  fazem `qc.invalidateQueries()` **sem queryKey** (invalidação global).
- [`communication-bubble.tsx`](./components/world/communication-bubble.tsx) está
  órfão (zero imports). Confirmar se vai para arquivamento ou exclusão (default da
  casa: desativar, não apagar — ver memória `feedback_disable_vs_delete`).
- Falta cultura de testes — a lógica nova de zonas deve nascer com Vitest mínimo.

## Roadmap

Faseamento detalhado em
`.claude/plans/precisamos-concertar-esse-app-temporal-meadow.md`. Resumo:

### Fase 1 — Estabilizar a mídia (entregue)
LiveKit SFU substitui o mesh por trás de feature flag; autoplay tratado; banners de
reconexão/áudio bloqueado. Movimento e UI inalterados. **Pronto.**

### Fase 2 — Zonas, proximidade e unificação com `world-events`
- `src/features/space-station/lib/zones.ts` deriva zonas das `MapArea` já
  existentes (`focus`/`meeting`/`auditorio` → sala dedicada; `silent` → sem áudio;
  resto → proximidade). `world-events` (`stage`/`hall`/`booth`) cai no mesmo modelo.
- Subscrição seletiva por proximidade no LiveKit (`autoSubscribe:false` +
  `setSubscribed()` por participante) usando `space-station:proximity-enter/leave`
  que a `world-scene.ts` já emite.
- Troca de sala SFU ao entrar em zona dedicada (`mint-zone-token` reaproveitada por
  station e evento).
- `event-enter-client.tsx` passa a renderizar `SpaceGame` com `mode: "event"`.
- `use-world-presence.ts` aceita `presenceChannel` como parâmetro.

### Fase 3 — Áreas NASA runtime + gamificação
- `src/features/space-station/lib/area-handlers/<tipo>.ts` com um arquivo por tipo
  e `AREA_HANDLERS: Record<AreaType, AreaHandler>`.
- `space-game.tsx:onAreaEnter` vira `AREA_HANDLERS[type]?.onEnter(ctx)`.
- Pelo menos `n-box`, `auditorio` e `prateleira` abrindo telas reais.

### Fase 4 — Limpeza arquitetural
- Remover `use-webrtc.ts`, `/api/pusher/rtc`, flag `NEXT_PUBLIC_USE_SFU`.
- Arquivar/excluir `communication-bubble.tsx`.
- Quebrar `world-scene.ts` em sistemas (`proximity-system`, `area-system`,
  `remote-players`, `map-editor-system`, `zoom-camera`) com a scene como
  orquestrador fino. Incremental, um sistema por PR.
- Quebrar `world-settings-panel.tsx`.
- Mover utilitários de mídia que cresceram para `src/lib/media/` se virarem
  reusáveis por `/call` e `world-events`.

## Ampliações (backlog de produto / ideias)

Lista não-ordenada, sem compromisso de prazo:

### Mídia e escalabilidade
- **Modo "palco" reforçado** para eventos de centenas a 1000+ (audience-only com
  pouquíssimos `speaker`; talvez integrar Egress para gravação/transmissão a
  espectadores fora do evento).
- **Áudio espacial** (panning estéreo pela posição relativa do peer no mapa).
  LiveKit já entrega o stream; o panning vira um `PannerNode` por peer no Web Audio.
- **Movimento via data channel do LiveKit** quando a sala for pequena, mantendo
  Pusher como presença global. Reduz custo de mensagens Pusher em picos.
- **TURN próprio** caso self-host volte à mesa (Coturn) — hoje LiveKit Cloud
  cobre.
- **Adaptive video layers** ativados por papel (audience baixa-res; speaker hi-res).

### Áreas NASA (runtime)
- **Balcão de atendimento**: vincula posição "em atendimento" no Tracking; abre
  conversa do Lead correspondente; fila de espera visual no chão.
- **Auditório**: integra com `nasa-route` (curso ao vivo + gravação posterior).
- **Prateleira**: catálogo de produtos com pagamento em Stars/Stripe; carrinho
  flutuante no mapa.
- **N-Box**: upload por drag-and-drop sobre a área; lista de arquivos com
  permissão por pasta.
- **Profile**: card 3D do usuário ao clicar; book de fotos; integração com
  `partner` para CV/portfolio.
- **Agendamento**: pisar na área abre a agenda pública daquela station/horário.
- **Demanda**: cria action no `workspace` configurado.
- **Formulário**: abre formulário em modal sem sair do mundo.

### Gamificação
- **Conquistas/badges** ao completar marcos (primeiro visitante, primeiro evento,
  organização do mês).
- **Stars com decay** e ranking de stations.
- **Easter eggs** espalhados pelo mapa.
- **Eventos sazonais** (mapas temáticos, cosméticos limitados de avatar).
- **Quests cooperativas** (visitar N stations, participar de M eventos).

### Editor e criação de conteúdo
- **Snap inteligente** (parede, grid, alinhamento múltiplo).
- **Camadas nomeadas** com toggle de visibilidade no editor.
- **Import direto do Tiled** (já parcial) e **export** para a marketplace.
- **Marketplace de templates** com revenue share via Stars.
- **NPC scripting** mínimo (caminho fixo + falas) para guiar visitantes novos.

### UX e acessibilidade
- **Tutorial interativo** ao primeiro login no mundo.
- **Modo "calmo"** (sem animações pesadas, sem proximity-audio) para usuários
  sensoriais.
- **Captions ao vivo** em palco/reuniões (via Whisper/AssemblyAI no LiveKit Egress).
- **Suporte mobile completo** (touch para mover, layout de painéis adaptado).
- **Keyboard shortcuts** customizáveis e visíveis em painel de ajuda.

### Performance
- **Cache offscreen de tiles** (blit em vez de redesenhar procedural).
- **Sprite atlas** para reduzir requests no preload.
- **LOD de avatares remotos** (sprite estático fora do viewport).
- **Subscrição condicional do Pusher por viewport** (presença só de quem está
  perto do viewport carregado).

### Observabilidade e admin
- **Dashboard de uso por station** (DAU, picos, salas mais usadas, custo LiveKit).
- **Replay de eventos** via Egress.
- **Painel de moderação** (kick/mute/ban por moderator).
- **Auditoria de acessos** ao mundo (já temos `accessRequests`; expandir).

### Integrações
- **Calendário** (Google/Outlook) para criar `WorldEvent` direto do convite.
- **YouTube/Twitch** como ingresso/saída de stream para auditórios.
- **Spotify ambiente** opcional por sala.
- **NERP** (sync de organização) já existe; expandir para presença e atividade.

## Como começar a trabalhar nesta feature

1. **Setup local** (assume a documentação principal do projeto em
   [`CLAUDE.md`](../../../CLAUDE.md)): `pnpm dev` + Docker do Postgres + Inngest.
2. **Variáveis críticas** específicas do mundo:
   - `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_WS_URL`,
     `NEXT_PUBLIC_LIVEKIT_URL` — sem isso, cai no mesh.
   - `NEXT_PUBLIC_PUSHER_*`, `PUSHER_APP_ID`, `PUSHER_SECRET`.
   - `NEXT_PUBLIC_USE_SFU=false` para forçar o mesh durante debug.
3. **Onde começar a ler**:
   - Para mídia: [`use-sfu-room.ts`](./hooks/use-sfu-room.ts) +
     [`join-world.ts`](../../app/router/space-station/join-world.ts) +
     [`audio-unlock.ts`](../../lib/media/audio-unlock.ts).
   - Para Phaser: [`world-scene.ts`](./components/world/scenes/world-scene.ts).
   - Para world-events: [`redeem-ticket.ts`](../../app/router/world-events/redeem-ticket.ts).
4. **Padrões do projeto**:
   - oRPC client-side **só** via hooks em [`hooks/`](./hooks/), nunca `orpc.*`
     direto em componentes ([`CLAUDE.md`](../../../CLAUDE.md) regra 9).
   - Após migration Prisma, aplicar o ritual de bump em `SCHEMA_VERSION` +
     touch nas catch-all routes ([`CLAUDE.md`](../../../CLAUDE.md) item 11).
5. **Teste manual mínimo** ao mexer no transporte de mídia: 3 abas em
   `/station/<nick>/world`, idealmente uma em rede restritiva (hotspot móvel ou
   VPN corporativa). Conferir no dashboard do LiveKit Cloud que a sala
   `station:<id>:world` aparece com os participantes.
