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

## 9. Roadmap detalhado — próximos passos por bug e por área

> Esta seção é o plano de ataque "pegar e executar". Cada item traz: **objetivo**, **arquivos a tocar**, **passos concretos**, **critério de pronto** e **risco/efeito colateral**. A ideia é poder retomar isso em outra sessão e saber exatamente por onde começar.

### 9.1 — Bloco de segurança (P0)

#### 9.1.1 — Autenticar endpoints de sinalização (B1)
- **Objetivo**: garantir que `userId` enviado nas APIs de Pusher venha da sessão, não do body.
- **Arquivos**:
  - `src/app/api/pusher/world/route.ts`
  - `src/app/api/pusher/rtc/route.ts`
  - `src/app/api/pusher/auth/route.ts` (conferir consistência)
- **Passos**:
  1. Importar `auth` (better-auth) e ler `headers()` no início de cada handler.
  2. Se não autenticado → `return new Response("unauthorized", { status: 401 })`.
  3. Substituir `body.userId` por `session.user.id` antes de propagar no Pusher.
  4. Manter `body.userId` apenas como hint para *log*, nunca como source-of-truth.
  5. Adicionar Zod schema para o body: `{ type, x?, y?, payload? }` — rejeitar campos extras com `.strict()`.
- **Critério de pronto**: tentar `POST /api/pusher/world` com `userId` diferente da sessão (via DevTools) retorna 401 ou substitui silenciosamente. Manual QA com 2 contas confirma que ninguém consegue impersonar.
- **Risco**: baixo. Pode quebrar clientes desatualizados se houver alguma chamada pública não autenticada — improvável aqui.

#### 9.1.2 — Validar bounds de posição (B9)
- **Objetivo**: rejeitar `{x, y}` fora do mapa.
- **Arquivos**: mesmos do 9.1.1.
- **Passos**:
  1. Definir constantes `WORLD_BOUNDS = { minX, minY, maxX, maxY }` por cenário, em `src/features/space-station/lib/world-bounds.ts` (criar).
  2. Buscar bounds do cenário atual pelo `worldKey` da station (DB ou map fixo).
  3. Clamp: `x = clamp(x, minX, maxX)`; `y = clamp(y, minY, maxY)`.
  4. Se diferença pré/pós-clamp > 50px → logar `[space-station] suspicious position`.
- **Critério de pronto**: cliente envia `{x: 999999, y: -1}` → broadcast traz coordenada clampeada. Log aparece para divergências grandes.
- **Risco**: nenhum. É puro defensivo.

#### 9.1.3 — Whitelist de domínios em URLs externas
- **Objetivo**: evitar XSS/SSRF via spritesheets remotos.
- **Arquivos**: `src/features/space-station/types.ts`, `src/features/space-station/server/update-world.ts` (ou onde está o input do oRPC).
- **Passos**:
  1. Criar `ALLOWED_ASSET_HOSTS` em `src/features/space-station/lib/asset-whitelist.ts` — incluir CDN próprio (R2) + tilesets oficiais.
  2. Substituir `z.string().url()` por `.refine(url => isAllowedHost(url), { message: "host não permitido" })`.
  3. Aplicar em `lpcSpritesheetUrl`, `wokaEyesUrl`, `wokaHairUrl`, `wokaClothesUrl`, `wokaHatUrl`, `wokaAccessoryUrl`, `tiledMapUrl`.
- **Critério de pronto**: tentar salvar URL `https://evil.com/x.png` → erro de validação. URLs válidos do R2 passam.
- **Risco**: pode bloquear assets de desenvolvimento — mitigar com flag `NODE_ENV === "development"` que afrouxa a whitelist.

---

### 9.2 — Bugs visíveis ao usuário (P1)

#### 9.2.1 — Re-check de áreas após teleporte (B5)
- **Objetivo**: parar de gerar `area-leave` falso quando o player teleporta.
- **Arquivos**: `src/features/space-station/components/world/scenes/world-scene.ts` (handler `space-station:teleport-to` + update loop ~linha 779).
- **Passos**:
  1. No handler de teleport: após mover o player, chamar `this.recomputeAreaOverlaps()` no próximo `update` (flag `_pendingAreaRecheck = true`).
  2. No `update`, se a flag estiver true: rodar `Phaser.Physics.Arcade.overlap` manualmente para popular `insideAreaIds` ANTES do diff que dispara `enter/leave`.
  3. Resetar a flag.
- **Critério de pronto**: teleportar entre duas áreas com `play-audio` não interrompe o áudio se o destino estiver na mesma área-chave. QA manual com `space-station:teleport-to` no console.
- **Risco**: médio — mexer no update loop é cirúrgico. Cobrir com log antes/depois.

#### 9.2.2 — Limpar screen share ao fechar peer (B12)
- **Objetivo**: garantir que `screenStream` e `screenSendersRef` não vazem.
- **Arquivos**: `src/features/space-station/hooks/use-webrtc.ts` (função `closePeer`).
- **Passos**:
  1. Em `closePeer(peerId)`: iterar `screenSendersRef.current[peerId]` e chamar `pc.removeTrack(sender)`.
  2. Deletar a entrada do dicionário.
  3. Se foi o último peer recebendo o screen share local: parar tracks do `screenStream` e setar ref como `null`.
  4. Emitir evento `space-station:screen-share-stopped` se aplicável.
- **Critério de pronto**: abrir DevTools → `chrome://webrtc-internals` → entrar/sair de proximidade durante screen share: contagem de PCs zera, sem senders pendurados.
- **Risco**: baixo, mas testar com 3+ peers simultâneos.

#### 9.2.3 — Serializar trocas de device (B3)
- **Objetivo**: evitar que cliques rápidos em "trocar mic/câmera" capturem o device anterior.
- **Arquivos**: `src/features/space-station/hooks/use-webrtc.ts` (`acquireStream`, `applyDeviceChange`).
- **Passos**:
  1. Introduzir um `AbortController` global por tipo de device (`audioAbortRef`, `videoAbortRef`).
  2. No início de `applyDeviceChange`: abortar o anterior, criar novo.
  3. Passar `signal` para todo `getUserMedia` (Chrome 95+ aceita).
  4. Se `signal.aborted` após `await`, parar tracks recém-obtidos e retornar.
- **Critério de pronto**: clicar 5x rápido em "trocar câmera" → estado final reflete a última escolha. Sem stream zumbi.
- **Risco**: baixo. `AbortController` em `getUserMedia` é seguro de polyfillar.

#### 9.2.4 — Tracking de geração no sprite remoto (B4)
- **Objetivo**: ignorar updates de sprite que chegam fora de ordem.
- **Arquivos**: `src/features/space-station/hooks/use-webrtc.ts:220–244` (`onPeerSprite`).
- **Passos**:
  1. Manter `Map<peerId, number>` chamado `spriteGenRef`.
  2. Cada update de sprite incrementa o gen.
  3. Comparar com `worldScene` (que já usa `loadGen`) — se evento for mais antigo, ignorar.
  4. Documentar a ordem esperada de eventos em comentário no topo do hook.
- **Critério de pronto**: log mostra "ignorando sprite stale" quando provocado artificialmente (delay de 500ms em um dos canais). Avatar remoto não pisca entre dois sprites.
- **Risco**: baixo.

---

### 9.3 — Leaks e estabilidade do editor (P2)

#### 9.3.1 — Inventário de cleanup da WorldScene (B2, B6, B7)
- **Objetivo**: garantir que `shutdown()` da scene libere 100% dos recursos.
- **Arquivos**: `src/features/space-station/components/world/scenes/world-scene.ts`.
- **Checklist a executar dentro do `shutdown`**:
  - [ ] Remover *todos* os event listeners adicionados via `window.addEventListener` (manter array `_disposers: Array<() => void>` e iterar).
  - [ ] `clearTimeout` em `_tileSyncTimer`, `_areaCheckTimer`, qualquer outro timer.
  - [ ] `clearInterval` se houver.
  - [ ] Destruir todos os sprites em `_remotePlayers`, `_placedObjects`, `_areaHitzones`.
  - [ ] Cancelar `requestAnimationFrame` pendente (se houver).
  - [ ] Revogar `URL.createObjectURL` criados para overlays/sprites compostos.
  - [ ] Anular refs (`this._player = null` etc.) para liberar GC.
- **Padrão recomendado**: substituir `window.addEventListener("x", fn)` direto por um helper:
  ```ts
  this.on(window, "x", fn); // helper que registra disposer
  ```
- **Critério de pronto**: abrir/fechar editor 20x → Memory tab do DevTools mostra heap estável (com tolerância). Listeners no `getEventListeners(window)` voltam ao baseline.
- **Risco**: alto se feito de uma vez. Fazer incremental: primeiro o helper `this.on`, depois migrar listener por listener.

#### 9.3.2 — Destruir sprite antes de recarregar (B6)
- **Objetivo**: evitar sprites/physics bodies órfãos ao trocar avatar.
- **Arquivos**: `world-scene.ts:333+` (`loadLpcSpritesheet`).
- **Passos**:
  1. No início da função: se `this._playerSprite` existe → `this._playerSprite.destroy(true)` (destroi physics body também).
  2. Resetar `this._playerSprite = null` antes de criar o novo.
  3. Conferir que `this.physics.world.colliders` não tem colliders apontando para o body antigo (Phaser geralmente limpa, mas confirmar).
- **Critério de pronto**: trocar avatar 10x seguidas → `scene.children.list.length` não cresce ilimitadamente.
- **Risco**: médio. Se houver código que mantém referência ao sprite antigo, vai quebrar — buscar por `_playerSprite` em todo `world-scene.ts`.

---

### 9.4 — Dívida estrutural (P3)

#### 9.4.1 — Refatorar `world-scene.ts` em módulos
- **Objetivo**: quebrar god object de 4.2k LOC em peças testáveis.
- **Estratégia** (não fazer tudo de uma vez):

  | Módulo proposto | Responsabilidade | LOC alvo |
  | --- | --- | --- |
  | `InputManager` | Teclado, mouse, touch, pinch, zoom, pan. Foco em inputs HTML. | ~400 |
  | `ProximityManager` | Calcula distância entre player local e remotos, dispara `proximity-enter/leave`. | ~200 |
  | `AreaManager` | Overlap player↔áreas, triggers, toasts. | ~400 |
  | `EditorManager` | Tile painter, área editor, placed objects, undo/redo. | ~800 |
  | `RemotePlayersManager` | Sprite remoto, interpolação de posição, animação. | ~400 |
  | `RenderingManager` | Tile layers, profundidade, ordering, render-on-top. | ~300 |
  | `WorldScene` (residual) | Lifecycle (create/update/shutdown) + cola entre managers. | ~400 |

- **Passos por módulo** (repetir):
  1. Criar classe `XxxManager` em `src/features/space-station/components/world/scenes/managers/`.
  2. Construtor recebe `scene: WorldScene`.
  3. Mover métodos um a um, deixando wrapper em `WorldScene` que delega (para não quebrar quem chama via `scene.foo()`).
  4. Quando todos os call-sites estiverem migrados, remover os wrappers.
- **Critério de pronto**: cada módulo cabe em uma tela, tem responsabilidade clara, e o `world-scene.ts` residual é navegável em <5min.
- **Risco**: alto se feito sem testes. Antes de começar, criar smoke test Playwright que entra, anda, entra em área, sai. Rodar a cada módulo migrado.

#### 9.4.2 — Substituir `window.dispatchEvent` por Zustand store
- **Objetivo**: ter uma fonte da verdade tipada e rastreável.
- **Arquivos novos**: `src/features/space-station/stores/use-station-runtime-store.ts`.
- **Passos**:
  1. Inventariar todos os eventos `space-station:*` (grep no projeto).
  2. Modelar como ações da store: `setProximityPeers`, `setActiveArea`, `setLocalAvatar`, `teleportTo`, etc.
  3. Migrar Phaser para `subscribe` da store (usar `subscribeWithSelector`).
  4. Migrar React para `useStationRuntimeStore`.
  5. Deletar listeners `window`.
- **Critério de pronto**: zero `window.dispatchEvent("space-station:*")` no codebase. Todos os fluxos visíveis em uma única store inspecionável via Redux DevTools (Zustand plugin).
- **Risco**: alto. Phaser fica fora do ciclo de React e precisa de `subscribe` manual — fácil esquecer de unsubscribe. Fazer junto com 9.3.1.
- **Alinhamento**: bate com `CLAUDE.md` ("estado global com Zustand stores (nunca Context providers)").

#### 9.4.3 — Implementar composição visual dos overlays Woka (B10)
- **Objetivo**: avatar customizado aparecer para os outros peers.
- **Estratégia**:
  1. Criar `composite-woka.ts` em `utils/` que recebe `{ base, eyes, hair, clothes, hat, accessory }` (URLs) e devolve um `OffscreenCanvas` (ou `HTMLCanvasElement` fallback).
  2. Cachear o resultado por hash dos URLs (`crypto.subtle.digest` + `btoa`).
  3. Compor em Web Worker se o browser suportar (lazy import).
  4. Substituir `spriteUrl` no `peer-sprite` event pelo blob URL composto.
  5. Persistir no servidor um único campo `compositeSpriteUrl` (opcional) ou só os componentes (cliente compõe sempre).
- **Critério de pronto**: dois clientes vendo o mesmo avatar customizado, com chapéu, cabelo e roupa renderizados.
- **Risco**: médio. Worker + OffscreenCanvas tem caveats em Safari iOS.

---

### 9.5 — Robustez de assets externos (P4)

#### 9.5.1 — Timeout + retry no Tiled loader (B8)
- **Arquivo**: `src/features/space-station/utils/tiled-canvas-renderer.ts` e `components/world/space-game.tsx:176–191`.
- **Passos**:
  1. Envolver fetch em `Promise.race([fetch(url), timeout(10000)])`.
  2. Retry exponencial: 3 tentativas com backoff 500ms / 1500ms / 4500ms.
  3. Se falhar todas: renderizar fallback (cenário "station" padrão) + toast "mapa indisponível, usando fallback".
  4. Logar para Sentry (se existir) ou `console.error` estruturado.
- **Critério de pronto**: bloquear URL no DevTools (Network → Block request URL) → app entra com fallback em ≤15s, nunca trava em loading.
- **Risco**: nenhum.

#### 9.5.2 — Sanitização de tilesets externos
- **Objetivo**: garantir que tilesets vindos de URL não sejam SVG malicioso.
- **Passos**:
  1. Validar `Content-Type` da resposta (`image/png`, `image/jpeg`, `image/webp` apenas).
  2. Recusar tudo que não seja imagem raster.
  3. Logar para auditoria.
- **Critério de pronto**: tileset com `Content-Type: image/svg+xml` é rejeitado.

---

### 9.6 — Cobertura de testes (P5)

#### 9.6.1 — Testes unitários priorizados
- `use-webrtc.test.ts` — mock de `RTCPeerConnection`, verificar: criar offer, aceitar answer, ICE candidate, fechar peer, troca de device.
- `use-world-presence.test.ts` — mock do Pusher, verificar: join, leave, posição, reconnect.
- `composite-woka.test.ts` (após 9.4.3) — verificar que hash idêntico → cache hit.
- `world-bounds.test.ts` (após 9.1.2) — clamp em todos os cenários.

#### 9.6.2 — Smoke test Playwright
- **Fluxo**:
  1. Login → entrar em station.
  2. Andar 5 segundos com setas.
  3. Aproximar de um segundo player (mockado via segunda BrowserContext).
  4. Confirmar que `proximity-enter` aconteceu (DOM da `proximity-bar`).
  5. Entrar em área de website → toast aparece.
  6. Sair da área → toast some.
- **Critério de pronto**: roda no CI, falha em <2min se algo quebrar.

---

### 9.7 — Cronograma sugerido (1 engenheiro)

| Sprint | Foco | Itens |
| --- | --- | --- |
| 1 (1 semana) | Segurança + bugs críticos | 9.1.1, 9.1.2, 9.2.1, 9.2.2, 9.2.3 |
| 2 (1 semana) | Estabilidade | 9.2.4, 9.3.1 (helper + 50% dos listeners), 9.3.2, 9.5.1 |
| 3 (1 semana) | Resto do cleanup + whitelist | 9.3.1 (resto), 9.1.3, 9.5.2 |
| 4–5 (2 semanas) | Refator estrutural | 9.4.1 (3 managers mais simples), smoke test Playwright |
| 6 (1 semana) | Store + overlays | 9.4.2 (parcial), 9.4.3 |
| 7 (1 semana) | Resto do refator + testes | 9.4.1 (3 managers restantes), 9.6.1 |

Total estimado: ~7 semanas com 1 engenheiro full-time, podendo paralelizar P0–P2 (semanas 1–3) com um segundo dev em P3 (4–7).

---

### 9.8 — Princípios para reutilizar essa feature em outras seções

Se a ideia é tirar partes da `space-station` para usar em outros lugares (ex: avatares em outras telas, multiplayer noutra feature):

1. **`use-webrtc` deve virar um pacote agnóstico** — hoje conhece `space-station` por nome de eventos. Renomear para `useP2PMedia` e parametrizar canal/eventos.
2. **`use-world-presence` idem** — abstrair como `usePresenceChannel<TPayload>` em `src/lib/pusher/` (alinhado com `CLAUDE.md`, que coloca `pusher` em `lib`).
3. **Sprite handling** (`sprite-defaults`, `composite-*`) pode subir para `src/lib/avatar/` se outras features precisarem de avatares 2D.
4. **`tiled-canvas-renderer`** é genérico — pode virar `src/lib/tiled/` se houver outro uso de mapas Tiled.
5. **NÃO subir antes da hora** — espere ter um segundo consumidor real. Abstrair preventivamente é o que cria os god objects que estamos limpando aqui.

---

## 10. Resumo executivo

A feature é **ambiciosa e bem construída no nível de UX e arquitetura multiplayer**, mas carrega três classes de risco:

1. **Segurança** (B1) — exige correção antes de qualquer exposição pública.
2. **Concorrência** (B3, B4, B5, B12) — origem provável dos bugs intermitentes de áudio/vídeo e sprites.
3. **Dívida estrutural** (god object + event spaghetti + overlays não compostos) — o custo de cada nova feature cresce não-linearmente até isso ser endereçado.

**Recomendação**: tratar Sprint 1 (segurança + bugs visíveis) imediatamente; planejar Sprints 4–7 (refator estrutural) como bloco dedicado quando o produto estabilizar. Antes de pensar em reutilizar partes em outras seções, fechar Sprint 3 — abstrações prematuras vão multiplicar a dívida atual em vez de aliviá-la.
