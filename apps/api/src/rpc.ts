import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { RPCHandler } from "@orpc/server/node";
import { ORPCError, onError } from "@orpc/server";
import type { router as AppRouter } from "@/app/router";
import * as routerModule from "@/app/router";
import { applyCorsHeaders } from "./cors";

// A raiz é CommonJS e o apps/api é ESM: o named export não é detectado pelo
// lexer cross-formato, então pegamos o router via `.default` (module.exports).
const router = (routerModule as unknown as { default: { router: typeof AppRouter } })
  .default.router;

const RPC_PREFIX = "/api/rpc";

const handler = new RPCHandler(router, {
  interceptors: [
    onError((error) => {
      if (error instanceof ORPCError) {
        if (error.code === "INTERNAL_SERVER_ERROR") {
          console.warn("[rpc:internal]", error.message);
        }
        return;
      }
      console.error(error);
    }),
  ],
});

function toWebHeaders(headers: FastifyRequest["headers"]): Headers {
  const webHeaders = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) webHeaders.append(key, item);
    } else if (value != null) {
      webHeaders.set(key, value);
    }
  }
  return webHeaders;
}

// Registrado com prefix /api/rpc. A encapsulação do plugin mantém o parser
// passthrough local — rotas nativas (health/webhooks) seguem com parser próprio.
export const rpcPlugin: FastifyPluginAsync = async (app) => {
  app.removeAllContentTypeParsers();
  app.addContentTypeParser("*", (_request, payload, done) => done(null, payload));

  app.all("/*", async (request, reply) => {
    applyCorsHeaders(request, reply);
    const { matched } = await handler.handle(request.raw, reply.raw, {
      prefix: RPC_PREFIX,
      context: { headers: toWebHeaders(request.headers) },
    });

    if (matched) {
      reply.hijack();
      return;
    }

    reply.code(404).send({ error: "RPC route not matched" });
  });
};
