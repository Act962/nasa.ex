import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "./env";

export const allowedOrigins = [env.WEB_ORIGIN];

// Respostas que chamam reply.hijack() (auth/rpc escrevem direto no socket)
// não passam pelos hooks do @fastify/cors. Aplicamos os headers de credencial
// direto no reply.raw pra a sessão cross-origin funcionar ponta a ponta.
export function applyCorsHeaders(request: FastifyRequest, reply: FastifyReply): void {
  const origin = request.headers.origin;
  if (typeof origin === "string" && allowedOrigins.includes(origin)) {
    reply.raw.setHeader("Access-Control-Allow-Origin", origin);
    reply.raw.setHeader("Access-Control-Allow-Credentials", "true");
    reply.raw.setHeader("Vary", "Origin");
  }
}
