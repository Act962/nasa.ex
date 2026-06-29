import "./load-env";
import { fastify } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { fastifySwagger } from "@fastify/swagger";
import { fastifyCors } from "@fastify/cors";
import ScalarApiReference from "@scalar/fastify-api-reference";
import { env } from "./env";
import { allowedOrigins } from "./cors";
import { healthRoute } from "./routes/health";
import { authPlugin } from "./auth";
import { rpcPlugin } from "./rpc";
import { inngestPlugin } from "./inngest";
import { stripeWebhookPlugin } from "./stripe-webhook";
import { paymentsWebhooksPlugin } from "./webhooks-payments";
import { metaWebhooksPlugin } from "./webhooks-meta";
import { miscWebhooksPlugin } from "./webhooks-misc";

const app = fastify().withTypeProvider<ZodTypeProvider>();

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

await app.register(fastifyCors, {
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});

await app.register(fastifySwagger, {
  openapi: {
    info: { title: "NASA API", description: "Backend NASA (Fastify)", version: "1.0.0" },
  },
  transform: jsonSchemaTransform,
});

await app.register(ScalarApiReference, { routePrefix: "/docs" });

await app.register(healthRoute);
await app.register(authPlugin, { prefix: "/api/auth" });
await app.register(rpcPlugin, { prefix: "/api/rpc" });
await app.register(inngestPlugin);
await app.register(stripeWebhookPlugin);
await app.register(paymentsWebhooksPlugin);
await app.register(metaWebhooksPlugin);
await app.register(miscWebhooksPlugin);

app
  .listen({ port: env.PORT, host: "0.0.0.0" })
  .then(() => {
    console.log(`🔥 HTTP em http://localhost:${env.PORT}`);
    console.log(`🚀 OpenAPI/Scalar em http://localhost:${env.PORT}/docs`);
  })
  .catch((error) => {
    console.error("Falha ao subir o servidor Fastify:", error);
    process.exit(1);
  });
