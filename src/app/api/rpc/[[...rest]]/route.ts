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
  const { response } = await handler.handle(request, {
    prefix: "/api/rpc",
    context: {
      headers: request.headers,
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
