# Space Station — Análise Técnica

> Data: 2026-05-14
> Objetivo: mapear o estado atual da feature `space-station`, identificar pontos fortes, pontos fracos, bugs e dívidas técnicas, para servir de base de decisão antes de novas iterações.

---

## 1. Visão geral

A feature `space-station` (em `src/features/space-station/`) implementa um **ambiente virtual de trabalho 2D inspirado no Gather.town**: avatares andando em um mapa, proximidade desencadeando áudio/vídeo P2P, áreas com triggers (website, áudio, info, demanda etc.), editor WYSIWYG de mapa, e múltiplos cenários reutilizáveis.

### Stack interna da feature

| Camada | Tecnologia |
| --- | --- |
| Motor gráfico | Phaser 3 (Canvas 2D) |
| Multiplayer / presença | Pusher (presence + private channels) |
| Áudio/Vídeo | WebRTC P2P com *perfect negotiation* |
| Persistência local | `localStorage` (posição do player, avatar customizado, overlays) |
| Avatar | Spritesheets LPC (Universal LPC) + Pipoya + overlays estilo Woka/WorkAdventure |
| Mapa | 11+ cenários (`station`, `space`, `rocket`, `lunar`, `lab`...) + tile painter + placed objects + áreas + suporte a Tiled (.tmj) |
| Estado/RPC | Hooks oRPC (`use-station.ts`) + window events para integração React ↔ Phaser |

### Fluxos principais

1. **Presença**: `useWorldPresence` (React) → `POST /api/pusher/world` → Pusher presence channel → `WorldScene` escuta via `window` events.
2. **WebRTC**: `useWebRTC` → `POST /api/pusher/rtc` → private channel → perfect negotiation (tie-breaker por `userId`).
3. **Proximidade**: `WorldScene` detecta peers dentro de `PROXIMITY_RADIUS` (~192px) e dispara `space-station:proximity-enter/leave`, que o `useWebRTC` consome para conectar/desconectar.
4. **Map Editor**: painéis React modificam `placedObjects` / `areas` / `tiles` → window events → `WorldScene` sincroniza visualmente → persistência via oRPC (`spaceStation.updateWorld`).

---

## 2. Estrutura de arquivos

```
src/features/space-station/
├── admin/
│   ├── my-stations-list.tsx           # lista de stations do user/org
│   └── space-station-admin.tsx        # painel de config (nick, mundo, módulos)
├── components/
│   ├── station-explorer.tsx
│   ├── station-modules-grid.tsx
│   ├── station-org-chart.tsx
│   ├── station-profile-header.tsx
│   ├── station-public-page.tsx
│   ├── station-send-star.tsx          # ratings/estrelas
│   └── world/
│       ├── astronaut-avatar.tsx        # renderer de sprite LPC (legacy?)
│       ├── bubble-apps.tsx
│       ├── bubble-chat.tsx
│       ├── bubble-connect.tsx
│       ├── bubble-empresas.tsx
│       ├── bubble-credits.tsx
│       ├── lpc-avatar-editor.tsx       # seletor de spritesheet LPC
│       ├── woka-customizer.tsx         # customizer de overlays
│       ├── woka-avatars-panel.tsx
│       ├── proximity-bar.tsx           # tiles dos peers próximos + mic status
│       ├── media-bar.tsx               # controles mic/cam
│       ├── media-settings.tsx
│       ├── media-video-overlay.tsx
│       ├── communicate-bubble.tsx      # chat em tempo real
│       ├── space-game-loader.tsx
│       ├── space-game.tsx              # container principal do Phaser
│       ├── screen-share-overlay.tsx
│       ├── share-panel.tsx
│       ├── station-access-gate.tsx
│       ├── video-overlay.tsx
│       ├── game-config.ts              # config do Phaser
│       ├── map-editor/
│       │   ├── map-editor.tsx          # canvas principal do editor + toolbar
│       │   ├── tile-painter.tsx        # paint / bucket fill / rect select
│       │   ├── area-editor.tsx         # desenhar áreas / colisão
│       │   ├── map-menu.tsx            # undo/redo, settings, templates
│       │   ├── object-library.tsx      # galeria de placed objects
│       │   ├── image-import-modal.tsx
│       │   ├── room-config.tsx         # nome, música, cor
│       │   ├── room-templates.ts       # 4 templates predefinidos
│       │   ├── scenario-editor.tsx     # seletor de cenário
│       │   ├── tile-textures.ts        # 169 texturas (pisos, paredes, deco)
│       │   ├── publish-template-modal.tsx
│       │   └── categories.ts
│       └── scenes/
│           ├── preload-scene.ts
│           └── world-scene.ts          # ~4.2k LOC, motor do jogo
├── hooks/
│   ├── use-station.ts                  # ~24 hooks oRPC para spaceStation.*
│   ├── use-webrtc.ts                   # ~606 LOC, peer connections + media toggle
│   └── use-world-presence.ts           # ~247 LOC, Pusher presence + sync de posição
├── types.ts                            # ~516 LOC: enums, Avatar, World, Area, Tile, Room
└── utils/
    ├── sprite-defaults.ts              # hash determinístico Pipoya por userId
    ├── composite-spritesheet.ts        # gera LPC base com foto + visor
    ├── composite-visor.ts
    ├── composite-face-pipoya.ts
    ├── portrait-to-pipoya.ts
    ├── remove-background.ts
    ├── tiled-canvas-renderer.ts        # renderiza .tmj → canvas pré-renderizado
    └── tiled-loader.ts
```

---

## 3. Pontos fortes

1. **Arquitetura multiplayer sólida**
   - Pusher *presence channel* para tracking de membros + dados de perfil.
   - *Private channel* separado para WebRTC (evita duplicar presença).
   - *Perfect negotiation* implementado corretamente (tie-breaker por `userId` previne glare).
   - Cleanup correto via `pc.onconnectionstatechange` removendo peers `failed`/`closed`.

2. **Persistência inteligente no cliente**
   - Avatar customizado por visitante em `localStorage` (não global da station).
   - Posição do player restaurada ao recarregar (`ss:pos:${stationId}:${userId}`).
   - Overlays Woka memorizados localmente (UX continua entre sessões).

3. **Sprite handling sofisticado**
   - Sentinela `pixel_astronaut` resolve diferente para local (composita com foto) vs remoto (fallback Pipoya determinístico).
   - 167 variantes Pipoya com hash djb2 → colisão <1%.
   - Suporte declarado a overlays Woka (eyes, hair, clothes, hat, accessory) — apesar de ainda não compostos visualmente.

4. **Input handling robusto**
   - Teclas travadas quando foco vai a input/dropdown → `resetKeys()` + velocity zero.
   - Separação de contextos: `Ctrl+scroll` = zoom em qualquer lugar; sem `Ctrl` = pan no editor / zoom no canvas.
   - Pinch-to-zoom em touch.
   - Modo debug (`Ctrl+Shift+D`) liga visualização de physics bodies.

5. **Modularidade de cenários e mapas**
   - 11+ cenários desenhados reutilizáveis.
   - Tile layers por profundidade (floor, wall, deco, overlay).
   - Áreas com 10+ tipos de trigger (silent, focus, entry, exit, meeting, website, play-audio, info, credits, collision) + 13+ ações NASA (N-Box, agendamento, demanda etc.).
   - Placed objects com drag/drop + resize no editor e colisão opcional.

6. **UX defensiva em mídia**
   - Mensagens de erro específicas para `INSECURE_CONTEXT`, `MEDIA_API_UNAVAILABLE`, `NotAllowedError`, `NotFoundError`.
   - Canvas não captura `space` (não conflita com inputs).
   - Fallback gracioso quando `mediaDevices` indisponível (iframe, HTTP, browser antigo).
   - Toasts ao entrar em áreas (website, áudio, info, demanda...).

7. **TypeScript saudável**
   - Sem `any` aparente nas hooks principais.
   - Refs bem tipadas (`RTCPeerConnection`, `HTMLCanvasElement`, `MediaStream`).
   - Schemas Zod validando input de API (`update-world.ts`).

---

## 4. Pontos fracos / dívidas técnicas

1. **`world-scene.ts` é um "god object"** — ~4.2k LOC concentrando rendering, physics, input, editor, proximidade, integração WebRTC, undo/redo. Difícil de revisar, testar e modificar sem efeito colateral.

2. **Comunicação React ↔ Phaser via `window.dispatchEvent`** — funciona, mas:
   - Espalha *event spaghetti* difícil de rastrear.
   - Não tem tipagem (cada listener faz seu cast).
   - Não há fonte da verdade central; o mesmo dado vive em React state, refs, `window`, Phaser scene e `localStorage`.
   - Conflita com a diretriz do `CLAUDE.md` ("estado global com Zustand").

3. **Overlays Woka persistidos mas nunca compostos visualmente** — `wokaEyesUrl`, `wokaHairUrl`, `wokaClothesUrl`, `wokaHatUrl`, `wokaAccessoryUrl` em `types.ts:40–48` são salvos no DB e em `localStorage`, mas o sprite remoto/local ignora overlays. UX promete customização que não aparece para os peers.

4. **Ausência de validação server-side de posição/identidade** — endpoints `/api/pusher/world` e `/api/pusher/rtc` aceitam `userId` e `{x, y}` vindos do cliente sem verificar contra a sessão (better-auth). Vide bug B1 abaixo.

5. **Sem spatial partitioning** — detecção de áreas/proximidade é O(n) por frame via `Phaser.Physics.Arcade.overlap`. Performance degrada com 50+ áreas ou muitos peers.

6. **Tiled map load sem timeout / retry / fallback** — `renderTiledMapToCanvas` em `space-game.tsx:176–191` pode prender o jogo em loading se o CDN do tileset cair.

7. **Lógica de cliente confia em `localStorage`** — posição restaurada sem sanity-check contra colisões/bounds atuais. Se o mapa muda, o player pode "spawnar" dentro de parede.

8. **Falta separação clara entre código de domínio e infra do Phaser** — utilitários como `composite-visor`, `composite-face-pipoya`, `portrait-to-pipoya` poderiam viver em `utils/` mais granular ou ter testes. Hoje são caixas pretas.

9. **Sprites e cenários hard-coded em arrays gigantes** — `tile-textures.ts` com 169 entradas e `room-templates.ts` fixos. Sem CMS / sem versionamento. Cada nova arte exige redeploy.

10. **Sem testes** — nenhum arquivo `.test.ts(x)` encontrado na feature. Hooks de WebRTC e presença, especialmente, têm muita lógica concorrente que se beneficiaria de testes.

---

## 5. Bugs e problemas suspeitos

> Severidades: 🔴 Alta · 🟡 Média · 🟠 Baixa · 🔵 Dívida (não é bug funcional)

| ID | Sev. | Local | Descrição | Status |
| --- | --- | --- | --- | --- |
| B1 | 🔴 | `app/api/pusher/world/route.ts`, `app/api/pusher/rtc/route.ts` | **Sem auth middleware**: cliente envia `userId` arbitrário; user A pode fingir ser user B em presença e em sinalização WebRTC. Mitigação parcial só existe no endpoint que assina o token Pusher. | Confirmado |
| B2 | 🟡 | `world-scene.ts` (listener `pointermove` para pinch, ~linhas 453–467) | Listener nunca é removido no `shutdown` da scene. Abrir/fechar o editor várias vezes acumula handlers → leak gradual. | Suspeita forte |
| B3 | 🟡 | `use-webrtc.ts` (~linhas 77–87 e bloco `acquireStream`) | Race entre `setSelectedAudio/Video` (assíncrono via `useEffect`) e `acquireStream` lendo a ref. Clicar duas vezes rápido na troca de device pode adquirir o device anterior. | Suspeita |
| B4 | 🟡 | `use-webrtc.ts:220–244` (handler `onPeerSprite`) | Eventos `world:joined` (já traz `spriteUrl`) e `space-station:peer-sprite` podem chegar fora de ordem. Sem `loadGen` tracking (que existe em `WorldScene`), o sprite remoto pode renderizar stale por 1–2 frames. | Suspeita |
| B5 | 🟡 | `world-scene.ts` (update loop, ~linha 779) | Teleporte (`space-station:teleport-to`) não força re-check de overlap. No frame seguinte o engine dispara falso `area-leave` → áudio para sozinho, toast some. | Suspeita |
| B6 | 🟡 | `world-scene.ts` (`loadLpcSpritesheet`, ~linha 333+) | Re-chamada não destrói sprite anterior nem limpa physics body antigo. Mudar avatar N vezes deixa objetos órfãos. | Suspeita |
| B7 | 🟡 | `world-scene.ts` (`_tileSyncTimer`, ~linha 205 + `syncTileRendering`) | Editor fecha enquanto timer está pendente: timer não recebe `clearTimeout` antes de nullify; callback executa em scene destruída (silenciosamente engolido pelo try/catch). | Suspeita |
| B8 | 🟠 | `space-game.tsx:176–191` (`renderTiledMapToCanvas`) | Fetch externo sem timeout/retry/fallback. CDN fora → loading infinito. | Confirmado |
| B9 | 🟠 | `use-world-presence.ts` + `/api/pusher/world` | Posição enviada sem clamp/validação de bounds. Não é exploit imediato (apenas visual), mas falta defensiva. | Confirmado |
| B10 | 🔵 | `types.ts:40–48`, `update-world.ts:26–30` | Overlays Woka salvos mas nunca compostos no sprite final. | Dívida confirmada |
| B11 | 🔵 | `world-scene.ts` (~4.2k LOC) | God object — refator urgente em submódulos (`EditorManager`, `PhysicsManager`, `ProximityManager`). | Dívida confirmada |
| B12 | 🟠 | `use-webrtc.ts` (`closePeer`) | Peer sai durante screen share: PC é fechado, mas `screenSendersRef.current` pode ficar com senders pendurados. | Suspeita |

> Observação: as linhas exatas foram identificadas em uma varredura agente; antes de corrigir cada item, conferir com `grep`/leitura direta para garantir que o arquivo não mudou.

---

## 6. Hipóteses sobre os bugs que você está enfrentando

Sem repro exato em mãos, os candidatos mais prováveis para problemas vistos "em produção" são:

- **Áudio/vídeo conectando errado ou conectando com o peer errado** → B1 + B4.
- **Avatar dos outros aparece com sprite genérico ou trocado** → B4 + B10.
- **Áudio para sozinho sem motivo aparente** → B5 (false area-leave) ou B12 (sender pendurado).
- **Travamento ao trocar câmera/mic rapidamente** → B3.
- **Editor de mapa pesado depois de algum tempo de uso** → B2 + B6 + B7.
- **Player spawna em lugar estranho ou "dentro" de objeto** → B9 + posição vinda do `localStorage` sem revalidação.

---

## 7. Perguntas em aberto

Pontos que precisam decisão antes de mexer:

1. **Validação de URLs externas** — `lpcSpritesheetUrl` aceita `z.string().url()`. Há whitelist de domínios? Risco de XSS via SVG ou *blob:* malicioso?
2. **Versionamento de mapas Tiled** — URL é imutável ou pode mudar e quebrar mapas salvos? Fallback se o tileset CDN cai?
3. **Renegociação WebRTC simultânea** — screen share + toggle de câmera ao mesmo tempo: o `onnegotiationneeded` lida atomicamente?
4. **Persistência de `connected`** — ao fechar o browser, quem estava "conectado" via WebRTC fica zumbi até timeout do Pusher? Reentrar deveria reconectar automaticamente?
5. **Composição visual de overlays Woka** — vamos compor no cliente (canvas 2D, gera blob por sessão) ou no servidor (worker, retorna PNG cacheado)?
6. **Refator de comunicação React ↔ Phaser** — migrar `window.dispatchEvent` para um Zustand store dedicado (`useStationStore`)? Custo de migração vs benefício de rastreabilidade.

---

## 8. Linha de raciocínio sugerida (próximos passos)

Ordem proposta, do maior impacto/menor custo para o oposto:

### P0 — Risco de segurança imediato
- **Aplicar `requiredAuthMiddleware`** nos endpoints `/api/pusher/world` e `/api/pusher/rtc`. Forçar que `userId` do payload seja igual ao da sessão.
- **Validar `x`, `y`** no servidor antes de propagar via Pusher.

### P1 — Bugs visíveis pelo usuário
- B5: forçar re-check de áreas após teleporte (re-rodar overlap manualmente no frame seguinte).
- B12: ao fechar peer, encerrar `screenStream` + limpar `screenSendersRef`.
- B3: serializar trocas de device (queue ou abortar promise anterior).

### P2 — Leaks e estabilidade do editor
- B2, B6, B7: passar uma vassoura por `shutdown` da `WorldScene` — remover *todos* os listeners, destruir sprites antigos, `clearTimeout` em todos os timers.

### P3 — Dívida estrutural
- Quebrar `world-scene.ts` em módulos (`InputManager`, `EditorManager`, `ProximityManager`, `PhysicsManager`, `RenderingManager`).
- Substituir `window.dispatchEvent` por um Zustand store da feature (`useStationRuntimeStore`) — fica alinhado com o `CLAUDE.md`.
- Implementar composição visual dos overlays Woka (canvas em worker, cache por hash dos URLs).

### P4 — Robustez de assets externos
- Timeout + retry exponencial no `renderTiledMapToCanvas`.
- Whitelist de domínios para `lpcSpritesheetUrl` e demais URLs de spritesheet.

### P5 — Cobertura
- Testes unitários para `use-webrtc` (mock de `RTCPeerConnection`) e `use-world-presence`.
- Testes visuais (Playwright) para fluxos críticos: spawn, movimentação, entrar em área, conectar áudio.

---

## 9. Resumo executivo

A feature é **ambiciosa e bem construída no nível de UX e arquitetura multiplayer**, mas carrega três classes de risco:

1. **Segurança** (B1) — exige correção antes de qualquer exposição pública.
2. **Concorrência** (B3, B4, B5, B12) — origem provável dos bugs intermitentes de áudio/vídeo e sprites.
3. **Dívida estrutural** (god object + event spaghetti + overlays não compostos) — o custo de cada nova feature cresce não-linearmente até isso ser endereçado.

Recomendação: tratar P0 + P1 antes de adicionar novas features; planejar P3 (refator estrutural) como sprint dedicado.
