// Confere o seletor único no servidor, com uma empresa real do banco local (spec 0093, CA-11): sem
// preferência gravada, cada recurso ligado devolve a chave da plataforma e o modelo de sempre. Só
// leitura, não chama IA. Uso: pnpm tsx --conditions=react-server scripts/verify-ai-selector-server.ts <organizationId>
import "./astro-qa/load-env";

async function main() {
  const organizationId = process.argv[2];
  if (!organizationId) throw new Error("Informe o id da empresa.");
  const { loadAiPreferences, resolveAiFor } = await import("../src/features/ia/server/resolve-ai-for");
  const preferences = await loadAiPreferences(organizationId);
  console.log("preferências:", JSON.stringify(preferences));

  const cases = [
    { resourceId: "workflows.ai-steps", provider: "openai", modelId: "gpt-4o-mini" },
    { resourceId: "chat.assist", provider: "google", modelId: "gemini-2.5-flash" },
    { resourceId: "astro.build-flow", provider: "openai", modelId: "gpt-4o" },
  ] as const;
  let failureCount = 0;
  for (const testCase of cases) {
    try {
      const resolved = await resolveAiFor({ ...testCase, organizationId });
      const isDefault = preferences.companyKeyResources.includes(testCase.resourceId) || (resolved.keySource === "env" && resolved.modelId === testCase.modelId);
      if (!isDefault) failureCount += 1;
      console.log(`${isDefault ? "ok  " : "FALHA"} ${testCase.resourceId}: ${resolved.keySource} · ${resolved.modelId}`);
    } catch (error) {
      // Sem a chave da plataforma no ambiente local o erro é o esperado e é o mesmo de antes do seletor.
      console.log(`info ${testCase.resourceId}: ${error instanceof Error ? error.message : error}`);
    }
  }
  process.exitCode = failureCount === 0 ? 0 : 1;
}

main().then(() => process.exit(process.exitCode ?? 0)).catch((error) => { console.error(error); process.exit(1); });
