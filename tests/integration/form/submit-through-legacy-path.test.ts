// As mesmas caracterizações do envio de formulário, agora pelo caminho antigo dos
// handlers. O módulo `src/modules/form` é o padrão; o caminho antigo fica como
// saída de emergência (`FORM_SUBMIT_USE_MODULE=false`) até o passo 7e. Os
// arquivos importados não mudam: é isso que prova que os dois caminhos se
// comportam igual.

import { expect, it, vi } from "vitest";
import { isFormSubmitModuleOn } from "@/modules/form";

it("sem a variável o envio roda pelo módulo, e só `false` volta ao caminho antigo", () => {
  vi.stubEnv("FORM_SUBMIT_USE_MODULE", undefined);
  expect(isFormSubmitModuleOn()).toBe(true);
  vi.stubEnv("FORM_SUBMIT_USE_MODULE", "true");
  expect(isFormSubmitModuleOn()).toBe(true);
  vi.stubEnv("FORM_SUBMIT_USE_MODULE", "false");
  expect(isFormSubmitModuleOn()).toBe(false);
});

vi.stubEnv("FORM_SUBMIT_USE_MODULE", "false");

it("o caminho antigo está ativo nesta suíte", () => {
  expect(isFormSubmitModuleOn()).toBe(false);
});

await import("./submit-response.characterization.test");
await import("./submit-response-actions.characterization.test");
await import("./save-partial-response.characterization.test");
