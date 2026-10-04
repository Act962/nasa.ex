import type { RouterClient } from "@orpc/server";
import { RPCLink } from "@orpc/client/fetch";
import { createORPCClient } from "@orpc/client";
import { router } from "@/app/router";

import { createTanstackQueryUtils } from "@orpc/tanstack-query";

declare global {
  var $client: RouterClient<typeof router> | undefined;
}

const link = new RPCLink({
  url: () => {
    if (typeof window === "undefined") {
      throw new Error("RPCLink is not allowed on the server side.");
    }

    return `${window.location.origin}/api/rpc`;
  },
});

const browserClient: RouterClient<typeof router> = createORPCClient(link);

type CallableNode = (...args: unknown[]) => unknown;

/**
 * No servidor, o cliente é resolvido a cada chamada, não quando este módulo é avaliado.
 * `globalThis.$client` é criado por `orpc.server.ts` (importado no layout raiz); se este módulo
 * fosse avaliado antes dele, um `const client = globalThis.$client ?? ...` ficaria preso para
 * sempre no cliente de navegador, que lança erro no servidor.
 */
function createServerClient(path: string[] = []): unknown {
  return new Proxy((() => undefined) as CallableNode, {
    get(_target, key) {
      if (typeof key !== "string" || key === "then") return undefined;
      return createServerClient([...path, key]);
    },
    apply(_target, _thisArg, args: unknown[]) {
      const procedure = path.reduce<unknown>(
        (node, segment) => (node as Record<string, unknown>)[segment],
        globalThis.$client ?? browserClient,
      );
      return (procedure as CallableNode)(...args);
    },
  });
}

export const client: RouterClient<typeof router> =
  typeof window === "undefined"
    ? (createServerClient() as RouterClient<typeof router>)
    : browserClient;

export const orpc = createTanstackQueryUtils(client);
