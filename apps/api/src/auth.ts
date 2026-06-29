import type { FastifyPluginAsync } from "fastify";
import { toNodeHandler } from "better-auth/node";
import type { auth as AuthInstance } from "@/lib/auth";
import * as authModule from "@/lib/auth";
import { applyCorsHeaders } from "./cors";

// Mesmo interop CJS↔ESM do router: a raiz é CommonJS, pegamos o `auth`
// via `.default` (module.exports).
const auth = (authModule as unknown as { default: { auth: typeof AuthInstance } })
  .default.auth;

const authNodeHandler = toNodeHandler(auth);

// Registrado com prefix /api/auth. better-auth lê o corpo cru, então o parser
// passthrough fica encapsulado neste plugin (não afeta rotas nativas).
export const authPlugin: FastifyPluginAsync = async (app) => {
  app.removeAllContentTypeParsers();
  app.addContentTypeParser("*", (_request, payload, done) => done(null, payload));

  app.all("/*", async (request, reply) => {
    applyCorsHeaders(request, reply);
    await authNodeHandler(request.raw, reply.raw);
    reply.hijack();
  });
};
