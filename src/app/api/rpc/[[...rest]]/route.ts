// import { OpenAPIHandler } from "@orpc/openapi/fetch";
// import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
// import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { RPCHandler } from "@orpc/server/fetch";
import { ORPCError, onError } from "@orpc/server";
import { router } from "@/app/router";

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

// const handler = new OpenAPIHandler(router, {
//   interceptors: [
//     onError((error) => {
//       console.error(error);
//     }),
//   ],
//   plugins: [
//     new OpenAPIReferencePlugin({
//       docsProvider: "scalar",
//       schemaConverters: [new ZodToJsonSchemaConverter()],
//       specGenerateOptions: {
//         info: {
//           title: "N.A.S.A",
//           version: "1.0.0",
//         },
//       },
//     }),
//   ],
// });

async function handleRequest(request: Request) {
  // TEMP debug: log raw body for /api/rpc/nerp/* mutations. Remove after fix.
  const url = new URL(request.url);
  const isMutation = request.method !== "GET" && request.method !== "HEAD";
  const isNerp = url.pathname.startsWith("/api/rpc/nerp/");
  let handledRequest = request;
  if (isMutation && isNerp) {
    const raw = await request.text();
    console.log(
      "[rpc-debug]",
      request.method,
      url.pathname,
      "ct=",
      request.headers.get("content-type"),
      "len=",
      raw.length,
      "body=",
      raw.slice(0, 500),
    );
    handledRequest = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body: raw,
    });
  }

  const { response } = await handler.handle(handledRequest, {
    prefix: "/api/rpc",
    context: {
      headers: handledRequest.headers,
    }, // Provide initial context if needed
  });

  return response ?? new Response("RPC route not matched", { status: 404 });
}

export const HEAD = handleRequest;
export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
