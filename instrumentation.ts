export async function register() {
  // Conditionally import if facing runtime compatibility issues
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/orpc.server");

    process.on("unhandledRejection", (reason) => {
      console.error("[unhandledRejection]", reason);
    });
    process.on("uncaughtException", (err) => {
      console.error("[uncaughtException]", err);
    });
  }
}
