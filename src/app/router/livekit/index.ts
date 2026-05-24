import { createLeadMeeting } from "./create-lead-meeting";

/**
 * LiveKit router — endpoints relacionados a salas SFU (vídeo/áudio).
 *
 * Sprint 1: `createLeadMeeting` — cria sala 1:1 entre consultor e lead
 * a partir de uma conversa do /tracking-chat.
 *
 * Sprint 2 (a fazer): `startEgress` (gravação na nuvem) + integração
 * com AssemblyAI pra transcrever + diarizar.
 */
export const livekitRouter = {
  createLeadMeeting,
};
