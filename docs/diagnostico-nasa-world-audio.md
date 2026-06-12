# Diagnóstico — NASA World (áudio entre usuários)

**Sintoma reportado**
> Não conseguimos colocar vários usuários conversando entre si, como no Gather.
> Em algumas tentativas funciona, mas logo falha e ninguém consegue mais conversar.

**URL afetada:** `https://orbita.nasaex.com/station/<nick>/world`
**Branch base do diagnóstico:** `main` em `8401a9bd` (10/jun, último merge `PR #307`)
**Data:** 2026-06-10

---

## 1. Como a feature está montada hoje

A `SpaceGame` ([space-game.tsx:163-190](../src/features/space-station/components/world/space-game.tsx#L163)) escolhe entre dois transportes de mídia, e ambos rodam em paralelo:

| Transporte | Hook | Quando entra |
|---|---|---|
| **SFU (LiveKit Cloud)** | [`useSfuRoom`](../src/features/space-station/hooks/use-sfu-room.ts) | Usuário **logado** + `LIVEKIT_*` env configurados |
| **Mesh P2P (Pusher signaling)** | [`useWebRTC`](../src/features/space-station/hooks/use-webrtc.ts) | **Guest** ou fallback quando SFU indisponível |

Quem decide o transporte:

```ts
// space-game.tsx
const isLoggedIn = !rawUserId.startsWith("guest");
const joinWorldQuery = useJoinWorld(stationId, { enabled: USE_SFU && isLoggedIn });
const sfuReady = USE_SFU && Boolean(sfuToken && sfuWsUrl);
const webrtc = sfuReady ? sfu : mesh;
```

Identity do LiveKit é mintada em [join-world.ts:138-145](../src/app/router/space-station/join-world.ts#L138):

```ts
sfuToken = await mintLiveKitToken({
  roomName: `station:${station.id}:world`,
  identity: userId,        // ← user.id puro, sem sufixo por aba/sessão
  ...
});
```

---

## 2. O que já foi corrigido hoje

Dois commits de 10/jun melhoraram bastante o lado do mesh e a UX dos devices:

### `acea61c7` — fix(space-station): corrige áudio assimétrico no mundo
- Mesh agora conecta dirigido por **presença** (`remote-join`/`remote-leave`) em vez de proximidade. Todo mundo da sala se ouve, sem "bolha" gateando áudio.
- `createOffer` explícito **removido**: a única fonte de oferta passa a ser `onnegotiationneeded`, com `setLocalDescription()` atômico → elimina o glare que deixava o áudio unidirecional ("um ouve o outro, o outro não").
- `makingOfferRef` é limpa no `closePeer` e no `onconnectionstatechange === "failed"|"closed"` → evita "glare fantasma" em reconexões.
- `VideoOverlay` ganhou retry de autoplay no 1º gesto.
- `ProximityBar` perdeu o botão "Sair da bolha" (não existe mais bolha).

### `384eb56b` — feat: media device management
- `useMediaDeviceStore` (Zustand + persist em localStorage `space-station:media-devices`) compartilhado entre SFU e mesh.
- `resolvePreferredDeviceId` cai pro default sem apagar a preferência se o device sumir.
- Retry de `getUserMedia`/`setMicrophoneEnabled` sem `deviceId.exact` quando o device persistido foi desconectado.
- `applySinkId` aplica a saída de áudio escolhida em `<audio>` de áreas e em VideoOverlay.

### Observação importante do commit `acea61c7`
> As credenciais LiveKit foram adicionadas ao `.env` local (gitignored, fora deste PR).
> **Replicar as 4 vars no Coolify em produção.**

> ⚠️ **Bloqueador #0:** se isso ainda não foi feito, **prod continua 100% no mesh** — sem os fixes de glare deste mesmo commit em runtime (eles estão no mesh, então até funciona, mas mesh sem TURN tem outros problemas; ver §3.4).

---

## 3. Bugs que continuam abertos

Em ordem de impacto sobre o sintoma "às vezes funciona, depois ninguém conversa":

### 3.1 🔴 Identity duplicada do LiveKit entre abas / refresh (causa #1 mais provável)

**Arquivo:** [join-world.ts:139](../src/app/router/space-station/join-world.ts#L139)

```ts
identity: userId,   // user.id puro
```

Regra do LiveKit server: **dois participantes com a mesma `identity` na mesma sala → a primeira conexão é desconectada à força**.

Cenários reais que disparam isso:

- **Usuário com duas abas abertas** do mesmo mundo (super comum testando) → aba B mintaa token, conecta, LiveKit kicka aba A. Aba A entra em cleanup. Se houver hot reload, focus event ou qualquer remount, ela re-mintaa e kicka a aba B. Loop.
- **F5 / refresh rápido**: o token antigo ainda tem a Room viva no servidor por alguns segundos; ao reconectar com a mesma identity, o LiveKit faz "kick-the-zombie" — janela em que o usuário oscila pros outros peers.
- **React StrictMode em dev** ou qualquer remount: mesma classe.

Esse cuidado **já existe pro guest** ([space-game.tsx:73-88](../src/features/space-station/components/world/space-game.tsx#L73)) com `sessionStorage` per-tab. Falta replicar pro caminho logado.

**Fix sugerido (servidor + cliente):**

```ts
// server: join-world.ts — aceitar um sessionId opcional
.input(z.object({
  stationId: z.string().min(1),
  sessionId: z.string().min(1).max(64).optional(), // novo
}))
.handler(async ({ input }) => {
  ...
  sfuToken = await mintLiveKitToken({
    roomName: `station:${station.id}:world`,
    identity: input.sessionId ? `${userId}:${input.sessionId}` : userId,
    name: context.user.name ?? undefined,
    ...
  });
});
```

```ts
// cliente: space-game.tsx — gerar um id estável por aba (já existe pra guest, generalizar)
const tabSessionId = useMemo(() => {
  const KEY = `_nasa_world_session_${stationId}`;
  try {
    const stored = sessionStorage.getItem(KEY);
    if (stored) return stored;
    const fresh = crypto.randomUUID();
    sessionStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}, [stationId]);

const joinWorldQuery = useJoinWorld(stationId, {
  enabled: USE_SFU && isLoggedIn,
  sessionId: tabSessionId,
});
```

⚠️ Atenção: o `identity` precisa permanecer único **e estável dentro da mesma aba**. Não pode ser `Math.random()` num render, senão re-renders mintaam tokens diferentes. Use `sessionStorage`/`useState lazy init` como no exemplo.

> Isolado, esse fix sozinho deve fazer ~80% do sintoma reportado sumir, segundo o padrão dos relatos.

---

### 3.2 🔴 Cleanup do `useSfuRoom` reseta mic/cam silenciosamente

**Arquivo:** [use-sfu-room.ts:288-302](../src/features/space-station/hooks/use-sfu-room.ts#L288)

```ts
return () => {
  cancelled = true;
  audioUnlockDisposeRef.current?.();
  audioUnlockDisposeRef.current = null;
  if (activeRoom) activeRoom.disconnect();
  roomRef.current = null;
  setPeers(new Map());
  setLocalStream(null);
  setScreenStream(null);
  setMicOn(false);   // ← reseta sem avisar
  setCamOn(false);   // ← reseta sem avisar
  setScreenOn(false);
};
```

Qualquer re-execução do `useEffect` (mudou `token`/`wsUrl`, ou um callback nas deps) **desconecta a Room E reseta mic/cam pra `false`**. O botão da MediaBar volta pro estado "desligado". O usuário acha que está com mic ligado, fala, e ninguém ouve.

Combinado com o #3.1, isso amplifica o sintoma "tava funcionando e parou".

**Fix sugerido:** preservar as flags de estado e, após reconexão, reabilitar mic/cam se elas estavam ligadas antes:

```ts
// salvar o intent antes do disconnect
const intentBeforeCleanup = useRef({ micOn: false, camOn: false, screenOn: false });

// no início do cleanup, antes do disconnect
intentBeforeCleanup.current = {
  micOn: micOnRef.current,
  camOn: camOnRef.current,
  screenOn: screenOnRef.current,
};
// e NÃO chamar setMicOn(false) / setCamOn(false) — manter o estado de UI.
```

E em seguida, ao reconectar, reaplicar `setMicrophoneEnabled(intent.micOn)`, etc.

Outra opção mais defensiva: mostrar um aviso na UI ("Conexão restabelecida — clique no microfone pra reativar") em vez de tentar restaurar sozinho.

---

### 3.3 🟡 Split SFU × mesh: logado e guest na mesma sala não se ouvem

**Arquivo:** [space-game.tsx:163-190](../src/features/space-station/components/world/space-game.tsx#L163)

- Usuário **logado** entra na Room LiveKit `station:<id>:world`.
- Guest cai no mesh P2P (canal Pusher `private-rtc-<stationId>`).
- **Não há ponte entre os dois.**

Por presence (Pusher), ambos os lados aparecem no mapa, parecem estar conectados — mas mídia nunca cruza. Se o teste foi feito com **uma aba logada + uma aba anônima/incógnito**, o áudio nunca vai funcionar entre elas.

**Caminhos possíveis:**

1. **Mintar token LiveKit pra guest também**, com `identity: \`guest_${randomId}\`` e role `speaker` (ou `audience` se quiser limitar). Requer relaxar o `requiredAuthMiddleware` no `joinWorld` ou criar um endpoint paralelo pra guest. Resolve definitivo.
2. **Bloquear áudio/cam pra guest na UI** e exibir CTA "Entre pra falar no mundo". Menos invasivo, mantém presence visual pra guest mas evita a confusão de "vejo a pessoa e não ouço".

---

### 3.4 🟡 Mesh sem TURN — falhas silenciosas em rede corporativa/4G

**Arquivo:** [use-webrtc.ts:50-59](../src/features/space-station/hooks/use-webrtc.ts#L50)

```ts
const TURN_URL = process.env.NEXT_PUBLIC_TURN_URL;
const TURN_USER = process.env.NEXT_PUBLIC_TURN_USERNAME;
const TURN_CRED = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  ...(TURN_URL && TURN_USER && TURN_CRED ? [{ urls: TURN_URL, ... }] : []),
];
```

Se essas envs não estão setadas em produção (provável), **~10-15% das conexões P2P falham** em NAT simétrico (rede corporativa, 4G/5G de algumas operadoras). O peer entra na sala mas não fecha conexão com ninguém — silencioso, sem mensagem de erro.

LiveKit Cloud resolve isso nativamente pra usuários logados; sobra como problema só pra guests, mas guest é justamente o caso mais comum de "convidei alguém pra entrar no mundo".

**Fix:** setar `NEXT_PUBLIC_TURN_URL`, `NEXT_PUBLIC_TURN_USERNAME`, `NEXT_PUBLIC_TURN_CREDENTIAL` no Coolify. Opções:
- **Twilio Network Traversal** (~US$ 0.40/GB, mais barato pra começar).
- **Self-hosted Coturn** em VPS (mais barato em escala, mais setup).

---

### 3.5 🟢 `adaptiveStream`/`dynacast` desligados (não causa o bug, mas piora custo em escala)

**Arquivo:** [use-sfu-room.ts:211-212](../src/features/space-station/hooks/use-sfu-room.ts#L211)

```ts
adaptiveStream: false,
dynacast: false,
```

O motivo está bem comentado: os overlays usam `el.srcObject` direto em vez de `track.attach()`, e o LiveKit precisa de `attach()` pra saber quem está "visível" e pausar tracks que ninguém vê.

Não é o bug atual, mas com adaptiveStream desligado, **cada participante recebe vídeo de todos os outros sempre, mesmo fora da tela**. Em escala (>10 pessoas), custo de banda do LiveKit Cloud cresce muito.

Roadmap: migrar `VideoOverlay`/`ScreenShareOverlay` pra usar `track.attach()` ao invés de `srcObject` e religar `adaptiveStream`/`dynacast`.

---

## 4. Plano de ação sugerido

Em ordem de prioridade:

| # | Ação | Quem | Impacto |
|---|---|---|---|
| 0 | **Verificar/setar as 4 envs do LiveKit no Coolify** (`LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_WS_URL`, `NEXT_PUBLIC_LIVEKIT_URL`) e re-deploy. | DevOps | Crítico — sem isso, prod fica 100% no mesh. |
| 1 | **Corrigir identity duplicada** (§3.1): aceitar `sessionId` no `joinWorld`, mintar `identity: \`${userId}:${sessionId}\``. | Backend + Frontend | Resolve ~80% do sintoma. |
| 2 | **Não resetar mic/cam no cleanup** (§3.2). | Frontend | Tira a sensação de "parou de funcionar do nada". |
| 3 | **Decidir o que fazer com guests** (§3.3): mintar token guest no LiveKit, ou bloquear áudio/cam pra guest e mostrar CTA de login. | Produto + Backend | Tira a confusão de "vejo mas não ouço". |
| 4 | **Configurar TURN** (Twilio/Coturn) e setar as 3 envs `NEXT_PUBLIC_TURN_*` (§3.4). | DevOps | Tira a falha silenciosa em rede corporativa/4G. |
| 5 | Migrar overlays pra `track.attach()` e religar `adaptiveStream`/`dynacast` (§3.5). | Frontend | Reduz custo do LiveKit em escala. |

---

## 5. Como validar depois do deploy

Roteiro mínimo de teste em **produção** após aplicar #0 e #1:

1. **Janela A (logada como dono da station)** → entra no mundo. Console > network: verificar request `POST /space-station/join-world` retornou `sfuToken` não-nulo e `sfuRoom: "station:<id>:world"`.
2. **Janela B (outro usuário logado, browser/perfil diferente)** → entra no mesmo mundo. Confirmar que ambos aparecem na Room (`participantConnected` no console).
3. Ambos ligam mic. Confirmar áudio bidirecional.
4. **Janela A faz F5**. Após reconectar, mic deve voltar ao estado anterior (ou mostrar aviso na UI).
5. **Abrir uma 3ª aba do mesmo usuário da A** → as duas abas DEVEM coexistir (sem kick). Se ainda kicka, o fix de identity não foi aplicado/deployado.
6. **Janela C (anônima/guest)** → confirmar comportamento esperado conforme decisão da #3 do plano.

---

## 6. Referências de código

- Hook SFU: [`src/features/space-station/hooks/use-sfu-room.ts`](../src/features/space-station/hooks/use-sfu-room.ts)
- Hook mesh: [`src/features/space-station/hooks/use-webrtc.ts`](../src/features/space-station/hooks/use-webrtc.ts)
- Mint do token: [`src/app/router/space-station/join-world.ts`](../src/app/router/space-station/join-world.ts)
- Orquestrador: [`src/features/space-station/components/world/space-game.tsx`](../src/features/space-station/components/world/space-game.tsx)
- LiveKit server helpers: [`src/lib/livekit/server.ts`](../src/lib/livekit/server.ts)
- LiveKit client wrapper: [`src/lib/livekit/client.ts`](../src/lib/livekit/client.ts)
- Audio unlock (autoplay fix): [`src/lib/media/audio-unlock.ts`](../src/lib/media/audio-unlock.ts)
- Presence: [`src/features/space-station/hooks/use-world-presence.ts`](../src/features/space-station/hooks/use-world-presence.ts)
- Pusher auth (com regra de `private-rtc-*`): [`src/app/api/pusher/auth/route.ts`](../src/app/api/pusher/auth/route.ts)
