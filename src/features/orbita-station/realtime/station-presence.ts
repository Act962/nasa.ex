// Presença ao vivo da estação (spec 0119, D-3): uma sala do LiveKit por empresa, só com mensagens de dados.
// Sem React: a interface cria, escuta o status e chama `stop` ao sair. Tudo que chega dos colegas é validado.
import { DisconnectReason, Room, RoomEvent, type RemoteParticipant } from "livekit-client";
import { z } from "zod";
import type { PlayerState, StationEngine } from "../engine/station-engine";
import { avatarLookSchema, type AvatarLook } from "../lib/avatar-look";
import { roomNamesSchema, templateKeySchema, type StationSettings } from "../lib/station-settings";

const TOPIC = "orbita";
// Até 10 posições por segundo, e só enquanto anda (RNF-3).
const SEND_INTERVAL_MS = 100;
const RETRY_DELAYS_MS = [5_000, 15_000, 60_000];
const ASK_AGAIN_AFTER_MS = 2_000;

export type PresenceStatus = "connecting" | "connected" | "unavailable" | "replaced";

export interface JoinTicket {
  token: string;
  url: string;
}

interface StationPresenceOptions {
  engine: StationEngine;
  fetchTicket: () => Promise<JoinTicket | null>;
  getLook: () => AvatarLook;
  onStatus: (status: PresenceStatus, colleagueCount: number) => void;
  onStationChanged: (station: StationSettings) => void;
}

const coordinate = z.number().finite().min(-500).max(500);
// `n`: identificador desta sessão (muda a cada conexão). Distingue o colega que recarregou a página, cuja sequência `s`
// recomeça do 1, de uma posição velha que chegou fora de ordem.
const stateFields = { n: z.string().min(1).max(32), s: z.number().int().nonnegative(), x: coordinate, z: coordinate, f: z.number().finite(), w: z.boolean() };
const messageSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("pos"), ...stateFields }),
  z.object({ t: z.literal("hello"), look: avatarLookSchema, ...stateFields }),
  z.object({ t: z.literal("look"), look: avatarLookSchema }),
  z.object({ t: z.literal("ask") }),
  z.object({ t: z.literal("station"), templateKey: templateKeySchema, roomNames: roomNamesSchema, version: z.number().int().nonnegative() }),
]);
type PresenceMessage = z.infer<typeof messageSchema>;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class StationPresence {
  private room: Room | null = null;
  private sendTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryCount = 0;
  private sequence = 0;
  private lastSent: PlayerState | null = null;
  private readonly lastSequenceById = new Map<string, number>();
  private readonly sessionById = new Map<string, string>();
  private sessionId = "";
  private readonly askedAtById = new Map<string, number>();
  private status: PresenceStatus = "connecting";
  private isStopped = false;

  constructor(private readonly options: StationPresenceOptions) {}

  async start() {
    this.setStatus("connecting");
    let ticket: JoinTicket | null = null;
    try {
      ticket = await this.options.fetchTicket();
    } catch {
      ticket = null;
    }
    if (this.isStopped) return;
    // Sem LiveKit no ambiente (ou servidor fora do ar): a estação segue sozinha (CB-7).
    if (!ticket) {
      this.setStatus("unavailable");
      return;
    }
    this.sessionId = Math.random().toString(36).slice(2, 12);
    this.sequence = 0;
    const room = new Room({ adaptiveStream: false, dynacast: false });
    this.room = room;
    room
      .on(RoomEvent.DataReceived, (payload, participant) => this.handleData(payload, participant))
      .on(RoomEvent.ParticipantConnected, (participant) => {
        this.sendHello([participant.identity]);
        this.emitStatus();
      })
      .on(RoomEvent.ParticipantDisconnected, (participant) => {
        this.options.engine.removeRemote(participant.identity);
        this.lastSequenceById.delete(participant.identity);
        this.sessionById.delete(participant.identity);
        this.askedAtById.delete(participant.identity);
        this.emitStatus();
      })
      .on(RoomEvent.Disconnected, (reason) => this.handleDisconnect(reason));
    try {
      await room.connect(ticket.url, ticket.token);
    } catch {
      if (this.isStopped) return;
      this.room = null;
      this.setStatus("unavailable");
      this.scheduleRetry();
      return;
    }
    if (this.isStopped) {
      void room.disconnect();
      return;
    }
    this.retryCount = 0;
    this.setStatus("connected");
    this.sendHello();
    this.sendTimer = setInterval(() => this.sendPosition(), SEND_INTERVAL_MS);
  }

  publishLook(look: AvatarLook) {
    this.publish({ t: "look", look }, true);
  }

  publishStation(station: StationSettings) {
    this.publish({ t: "station", templateKey: station.templateKey, roomNames: station.roomNames, version: station.version }, true);
  }

  stop() {
    this.isStopped = true;
    if (this.sendTimer) clearInterval(this.sendTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    const room = this.room;
    this.room = null;
    if (room) {
      room.remoteParticipants.forEach((participant) => this.options.engine.removeRemote(participant.identity));
      void room.disconnect();
    }
  }

  private setStatus(status: PresenceStatus) {
    this.status = status;
    this.emitStatus();
  }

  private emitStatus() {
    this.options.onStatus(this.status, this.room?.remoteParticipants.size ?? 0);
  }

  private handleDisconnect(reason: DisconnectReason | undefined) {
    if (this.sendTimer) clearInterval(this.sendTimer);
    this.sendTimer = null;
    const room = this.room;
    this.room = null;
    room?.remoteParticipants.forEach((participant) => this.options.engine.removeRemote(participant.identity));
    if (this.isStopped || reason === DisconnectReason.CLIENT_INITIATED) return;
    // A mesma pessoa abriu a estação em outra aba: esta sai da sala e não tenta voltar sozinha (CB-3).
    if (reason === DisconnectReason.DUPLICATE_IDENTITY) {
      this.setStatus("replaced");
      return;
    }
    this.setStatus("unavailable");
    this.scheduleRetry();
  }

  // Conexão caiu de vez (o LiveKit já tenta reconectar sozinho antes disso): token novo, com espera crescente (CB-12, CB-13).
  private scheduleRetry() {
    if (this.isStopped || this.retryTimer) return;
    const delay = RETRY_DELAYS_MS[Math.min(this.retryCount, RETRY_DELAYS_MS.length - 1)];
    this.retryCount += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.start();
    }, delay);
  }

  private stateFields(state: PlayerState) {
    return { n: this.sessionId, s: ++this.sequence, x: state.x, z: state.z, f: state.facing, w: state.isWalking };
  }

  private sendHello(destinationIdentities?: string[]) {
    const state = this.options.engine.getPlayerState();
    if (!state) return;
    this.publish({ t: "hello", look: this.options.getLook(), ...this.stateFields(state) }, true, destinationIdentities);
    this.lastSent = state;
  }

  private sendPosition() {
    const state = this.options.engine.getPlayerState();
    if (!state) return;
    const previous = this.lastSent;
    const hasMoved = !previous || Math.hypot(state.x - previous.x, state.z - previous.z) > 0.01 || Math.abs(state.facing - previous.facing) > 0.05;
    if (!hasMoved && state.isWalking === previous?.isWalking) return;
    // Parou de andar: a última posição vai com garantia de entrega, para ninguém ver o colega "andando parado".
    this.publish({ t: "pos", ...this.stateFields(state) }, !state.isWalking);
    this.lastSent = state;
  }

  private publish(message: PresenceMessage, isReliable: boolean, destinationIdentities?: string[]) {
    const room = this.room;
    if (!room || room.state !== "connected") return;
    void room.localParticipant
      .publishData(encoder.encode(JSON.stringify(message)), { reliable: isReliable, topic: TOPIC, destinationIdentities })
      .catch(() => {
        // Mensagem perdida: a próxima posição corrige (CB-11).
      });
  }

  private handleData(payload: Uint8Array, participant: RemoteParticipant | undefined) {
    if (!participant) return;
    let parsed: ReturnType<typeof messageSchema.safeParse>;
    try {
      parsed = messageSchema.safeParse(JSON.parse(decoder.decode(payload)));
    } catch {
      return;
    }
    if (!parsed.success) return;
    const message = parsed.data;
    const engine = this.options.engine;
    const id = participant.identity;
    const name = participant.name || "Colega";
    if (message.t === "station") {
      this.options.onStationChanged({ templateKey: message.templateKey, roomNames: message.roomNames, version: message.version });
      return;
    }
    if (message.t === "look") {
      engine.upsertRemote(id, name, message.look);
      return;
    }
    if (message.t === "ask") {
      this.sendHello([id]);
      return;
    }
    // O "olá" que o colega manda ao entrar pode sair antes de a sala entregar a quem já estava lá. Chegou posição de
    // quem ainda não se apresentou: pede o "olá" dele (no máximo a cada 2 s), em vez de deixá-lo invisível.
    if (message.t === "pos" && (!engine.hasRemote(id) || this.sessionById.get(id) !== message.n)) {
      const now = Date.now();
      if (now - (this.askedAtById.get(id) ?? 0) > ASK_AGAIN_AFTER_MS) {
        this.askedAtById.set(id, now);
        this.publish({ t: "ask" }, true, [id]);
      }
      return;
    }
    // O colega só aparece com o "olá" dele, que traz visual, posição e a sessão nova.
    if (message.t === "hello") {
      engine.upsertRemote(id, name, message.look);
      this.sessionById.set(id, message.n);
      this.lastSequenceById.delete(id);
    }
    // Posição mais velha que a última recebida chegou fora de ordem: ignora (CB-11).
    if ((this.lastSequenceById.get(id) ?? -1) >= message.s) return;
    this.lastSequenceById.set(id, message.s);
    engine.setRemoteState(id, { x: message.x, z: message.z, facing: message.f, isWalking: message.w });
  }
}
