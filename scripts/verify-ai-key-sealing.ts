// Confere que o token do Hugging Face é cifrado ao gravar e mascarado ao voltar (spec 0093, etapa 0).
// Sem banco e sem rede. Rodar: pnpm tsx --conditions=react-server scripts/verify-ai-key-sealing.ts
import "./astro-qa/load-env";
import assert from "node:assert/strict";
import { maskIntegrationConfig, readIntegrationApiKey, sealIntegrationConfig } from "../src/features/integrations/lib/integration-api-key";

const token = "hf_exemploDeTokenQueNaoExiste1234";
for (const platform of ["HUGGING_FACE", "OPENAI"]) {
  const sealed = sealIntegrationConfig(platform, { apiKey: token }, null);
  assert.notEqual(sealed.apiKey, token, `${platform}: a chave não pode ir para o banco em texto puro`);
  assert.equal(readIntegrationApiKey(sealed), token, `${platform}: a chave cifrada volta a ser lida no servidor`);
  const masked = maskIntegrationConfig(platform, sealed) as Record<string, unknown>;
  assert.equal(masked.apiKey, "", `${platform}: a chave não volta para o navegador`);
  assert.equal(masked.apiKeyLast4, "1234", `${platform}: só os 4 últimos caracteres aparecem`);
  console.log(`ok    ${platform}: cifrada no banco, lida no servidor, mascarada para o navegador`);
}
const legacy = maskIntegrationConfig("HUGGING_FACE", { apiKey: token }) as Record<string, unknown>;
assert.equal(legacy.apiKey, "", "token antigo em texto puro também não volta para o navegador");
assert.equal(readIntegrationApiKey({ apiKey: token }), token, "token antigo em texto puro continua sendo lido");
console.log("ok    token antigo, salvo em texto puro: continua valendo e deixa de voltar para o navegador");
const kept = sealIntegrationConfig("HUGGING_FACE", { apiKey: "" }, { apiKey: "guardada", apiKeyLast4: "dada" });
assert.equal(kept.apiKey, "guardada", "campo vazio na edição mantém a chave atual");
console.log("ok    editar sem digitar a chave mantém a que já estava salva");
const other = sealIntegrationConfig("PAGSEGURO", { token: "x" }, null);
assert.deepEqual(other, { token: "x" }, "outras integrações não mudam");
console.log("ok    integrações que não são de IA não mudam\nTUDO CERTO (5 verificações)");
