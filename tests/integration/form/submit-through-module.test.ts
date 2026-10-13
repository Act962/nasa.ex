// Passo 7d do plano de migração: as mesmas caracterizações do envio de
// formulário, agora com o envio rodando pelo módulo `src/modules/form`. Os
// arquivos importados não mudam: é isso que prova que os dois caminhos se
// comportam igual.

import { expect, it, vi } from "vitest";
import { isFormSubmitModuleOn } from "@/modules/form";

vi.stubEnv("FORM_SUBMIT_USE_MODULE", "true");

it("a flag do envio pelo módulo está ligada nesta suíte", () => {
  expect(isFormSubmitModuleOn()).toBe(true);
});

await import("./submit-response.characterization.test");
await import("./submit-response-actions.characterization.test");
await import("./save-partial-response.characterization.test");
