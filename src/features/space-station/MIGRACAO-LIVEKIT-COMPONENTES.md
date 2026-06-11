# Migração para os componentes prontos do LiveKit (`@livekit/components-react`)

> Branch: `fix/world-audio-autoplay` · Objetivo: que o mundo (`/station/nasa/world`)
> tenha call/áudio/compartilhamento de tela **tão confiáveis quanto o POC**.

## TL;DR

O áudio remoto do mundo passou a usar o componente pronto **`<RoomAudioRenderer>`**
(o mesmo do POC), em vez de `<audio srcObject>` montado à mão. Isso conserta o bug
de áudio em **produção** na raiz. O vídeo continua como estava (ver "Fase B" abaixo —
por que não foi trocado).

---

## Por que o áudio quebrava em produção (causa-raiz)

| | POC (funciona) | Mundo (antes) |
|---|---|---|
| Como o áudio remoto tocava | `<RoomAudioRenderer>` → `track.attach(el)` | `<audio srcObject={new MediaStream([track])}>` na mão |
| `room.canPlaybackAudio` enxerga o elemento? | **Sim** (foi a Room que anexou) | **Não** (elemento criado fora da Room) |
| Resultado | `startAudio()`/autoplay funcionam | `canPlaybackAudio` dava **falso-positivo** → detector de bloqueio (`attachAudioUnlock`) nunca disparava → em prod (autoplay estrito do Chrome) o som ficava barrado **sem aviso** |

`track.attach()` registra o elemento no subsistema de áudio da Room. Sem ele, a Room
não sabe que o elemento existe, então `room.canPlaybackAudio` mente e o destravamento
por gesto nunca acontece. Em `localhost` (autoplay permissivo) passa batido; em
produção, não. Era exatamente o sintoma relatado ("ou ninguém se escuta, ou só dá pra
ouvir e não falar").

---

## O que mudou (Fase A — áudio)

### Dependências
```
pnpm add @livekit/components-react@2.9.21 @livekit/components-styles
```
(`livekit-client@2.19.0` já satisfaz o peer `^2.18.2` da lib.)

### `hooks/use-sfu-room.ts`
- A `Room` agora é exposta como **estado** (`room: Room | null`), não só `ref` — o
  `<RoomAudioRenderer>` precisa re-renderizar quando a Room (re)conecta.
- `setRoom(room)` no sucesso da conexão; `setRoom(null)` no cleanup.
- `attachAudioUnlock` foi **mantido**: agora que o áudio é anexado via `track.attach()`,
  `room.canPlaybackAudio`/`startAudio()` passam a ser verdadeiros, então o listener de
  gesto vira uma rede de segurança **sem banner** (destrava no 1º clique/tecla/toque).

### `components/world/space-game.tsx`
- `import { RoomAudioRenderer } from "@livekit/components-react"`.
- Monta `<RoomAudioRenderer room={sfu.room} />` **só no caminho SFU** e **só quando a
  room já existe**:
  ```tsx
  {!loading && sfuReady && sfu.room && <RoomAudioRenderer room={sfu.room} />}
  ```
  ⚠️ O guard `sfu.room &&` é obrigatório: `RoomAudioRenderer` chama `useEnsureRoom()`,
  que **lança** se a room for nula e não houver `RoomContext`. Sem o guard, o mundo
  crasharia no ~1s de conexão.
- Passa `manageRemoteAudio={!sfuReady}` ao `<VideoOverlay>`.

### `components/world/video-overlay.tsx`
- **Removido** todo o caminho de áudio manual: o `<audio srcObject>` por peer, o
  `audioRef`, os effects de `play()`/unlock e a aplicação de `sinkId`. Os tiles agora
  mostram **só vídeo** (`<video>` sempre mudo); o áudio remoto vem do `<RoomAudioRenderer>`.
- A saída de áudio (output device) é aplicada pelo `room.switchActiveDevice("audiooutput")`
  no `use-sfu-room`, que alcança os elementos do `RoomAudioRenderer` — então a prop
  `sinkId` saiu do overlay.

### Mantidos / removidos
- `lib/media/audio-unlock.ts` — **mantido** (compartilhado com `/call/[room]` e
  world-events; segue como rede de segurança **sem banner**: gesto → `room.startAudio()`,
  agora *efetivo* porque o áudio passou a ser anexado via `track.attach()`).
- `lib/media/remote-audio-unlock.ts` — **removido** (era band-aid do mundo; o
  `<RoomAudioRenderer>` resolve na raiz).

---

## Remoção do mesh (fallback) — LiveKit é o único transporte

A pedido ("o fallback não funciona mesmo"), o mesh P2P caseiro foi **removido**:
- **Deletados:** `hooks/use-webrtc.ts`, `app/api/pusher/rtc/route.ts` (sinalização do
  mesh) e `lib/media/remote-audio-unlock.ts` (band-aid).
- **`space-game.tsx`:** sem flag `USE_SFU`, sem `mesh`, sem `sfuPending`. Virou
  `const webrtc = useSfuRoom(...)` direto. Sem token LiveKit, o mundo funciona pra
  movimento, só sem áudio/vídeo.
- **`RemotePeer`** (que morava no mesh) migrou pra `use-sfu-room.ts`; os 6 overlays que
  o importavam agora apontam pra lá.
- Docs atualizados (`OVERVIEW.md` — Fase 4 marcada como feita).

## Fase B — componentes prontos de VÍDEO (feita)

Sem o mesh, o `VideoOverlay` é LiveKit-only — a troca virou substituição limpa, com o
shell do overlay (toolbar, drag, scale, PiP) **intacto**:

- **`use-sfu-room.ts`**: `RemotePeer` ganhou `cameraTrackRef?: TrackReference` (aditivo),
  populada em `snapshotRemotePeer` a partir da publicação de câmera
  (`{ participant, publication, source: rpub.source }` — usa `rpub.source` pra **não**
  importar o valor `Track` do livekit-client, preservando o lazy-load do SDK).
  Preservada no upsert via Pusher pra o vídeo não piscar. `adaptiveStream`/`dynacast`
  **religados** no `connectRoom`.
- **`video-overlay.tsx`**: os tiles **remotos** renderizam `<VideoTrack trackRef ref>`
  (componente pronto, que faz `track.attach()` → habilita o adaptiveStream). O tile
  **local** segue por `srcObject` (preview espelhado; não é afetado por adaptiveStream).
  O effect de `srcObject` é blindado (`if (trackRef) return`) pra não pisar no attach.
  O `<VideoTrack>` encaminha o `ref` pro `<video>` interno, então o **PiP** segue funcionando.

Ganhos: economia de banda + menos "tela preta" (adaptiveStream pausa/baixa o vídeo de
tiles invisíveis) e o mesmo caminho de render batido do POC. (Anel de "quem fala" e
indicador de qualidade — do `ParticipantTile` completo — ficam como melhoria futura:
exigiriam trocar também o *chrome* do tile, que preferimos manter como está.)

Ganhos: anel de quem-fala, qualidade de conexão, placeholder e economia de banda.
Risco: mexe no modelo de peers; **testar isolado** depois que a Fase A estiver validada.

---

## Como testar (produção)
1. Deploy desta branch no Coolify.
2. 2 pessoas reais em `/station/nasa/world`.
3. Cada uma **clica no microfone pra falar**. Esperado: os dois se ouvem **nos dois
   sentidos**, sem banner. Câmera e compartilhamento de tela seguem funcionando.
4. Se alguém ficar mudo: console daquela aba (procurar `play()` rejeitado / startAudio).

## Pendências
- 🔑 **Rotacionar o `LIVEKIT_API_SECRET`** (foi exposto num print durante a investigação).
- Decidir se vamos fazer a **Fase B** (vídeo) conforme o plano acima.
