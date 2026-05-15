export async function register() {
  // Conditionally import if facing runtime compatibility issues
  if (process.env.NEXT_RUNTIME === "nodejs") {
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
