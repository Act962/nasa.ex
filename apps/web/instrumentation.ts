export async function register() {
  // Conditionally import if facing runtime compatibility issues
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // PostHog LLM analytics via OpenTelemetry — captures $ai_generation events
    // for every Vercel AI SDK call that has experimental_telemetry enabled.
    const { NodeSDK } = await import("@opentelemetry/sdk-node");
    const { resourceFromAttributes } = await import("@opentelemetry/resources");
    const { PostHogSpanProcessor } = await import("@posthog/ai/otel");
    const sdk = new NodeSDK({
      resource: resourceFromAttributes({ "service.name": "nasa-ex" }),
      spanProcessors: [
        new PostHogSpanProcessor({
          apiKey: process.env.NEXT_PUBLIC_POSTHOG_KEY!,
          host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        }),
      ],
    });
    sdk.start();

    await import("@/lib/orpc.server");

    // Registra subscribers do alert-engine pra escutar eventos do bus.
    // 1x por processo, idempotente.
    const { registerAlertSubscribers } = await import(
      "@/features/alerts/lib/event-subscribers"
    );
    registerAlertSubscribers();

    process.on("unhandledRejection", (reason) => {
      console.error("[unhandledRejection]", reason);
    });
    process.on("uncaughtException", (err) => {
      console.error("[uncaughtException]", err);
    });
  }
}
