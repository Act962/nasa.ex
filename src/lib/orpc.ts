import type { RouterClient } from "@orpc/server";
import { RPCLink } from "@orpc/client/fetch";
import { createORPCClient } from "@orpc/client";
import { router } from "@/app/router";

import { createTanstackQueryUtils } from "@orpc/tanstack-query";

declare global {
  var $client: RouterClient<typeof router> | undefined;
}

// Quando NEXT_PUBLIC_API_URL aponta pro backend separado (Fastify), o RPCLink
// chama a API cross-origin e precisa mandar o cookie de sessão. Sem a env,
// mantém o comportamento same-origin atual.
const apiUrl = process.env.NEXT_PUBLIC_API_URL;

const link = new RPCLink({
  url: () => {
    if (typeof window === "undefined") {
      throw new Error("RPCLink is not allowed on the server side.");
    }

    return `${apiUrl ?? window.location.origin}/api/rpc`;
  },
  ...(apiUrl
    ? {
        fetch: (request: Request, init: RequestInit) =>
          globalThis.fetch(request, { ...init, credentials: "include" }),
      }
    : {}),
});

/**
 * Fallback to client-side client if server-side client is not available.
 */
export const client: RouterClient<typeof router> =
  globalThis.$client ?? createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
