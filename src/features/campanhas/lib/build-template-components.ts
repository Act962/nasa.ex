import type {
  CreateMessageTemplateRequest,
  CreateTemplateButton,
  CreateTemplateComponent,
} from "@/http/whats-oficial";
import type { CreateTemplateInput } from "../schema/template-schemas";
import { TEMPLATE_LIMITS } from "./template-constants";

/**
 * Converte o input estruturado do builder no payload exato de criação de
 * template da Meta (`components[]` + `example`). Função pura e testável —
 * usada pelo procedure `campanhas.createTemplate` e pelo preview.
 */

/** Placeholders `{{n}}` únicos de um texto, em ordem crescente. */
export function extractVariableNumbers(text: string): number[] {
  const matches = text.match(/\{\{\s*(\d+)\s*\}\}/g) ?? [];
  const numbers = matches.map((token) =>
    Number(token.replace(/[^\d]/g, "")),
  );
  return [...new Set(numbers)].sort((first, second) => first - second);
}

export function countVariables(text: string): number {
  return extractVariableNumbers(text).length;
}

/** Erros de validação (semânticos) do template antes de mandar pra Meta. */
export function validateTemplateInput(input: CreateTemplateInput): string[] {
  const errors: string[] = [];

  // Corpo — variáveis sequenciais começando em 1 + exemplos preenchidos.
  const bodyVariables = extractVariableNumbers(input.body.text);
  if (!isSequentialFromOne(bodyVariables)) {
    errors.push(
      "As variáveis do corpo devem ser sequenciais começando em {{1}} (sem pular números).",
    );
  }
  if (bodyVariables.length > 0) {
    if (input.body.examples.length !== bodyVariables.length) {
      errors.push(
        `Preencha um exemplo para cada variável do corpo (${bodyVariables.length}).`,
      );
    } else if (input.body.examples.some((example) => example.trim() === "")) {
      errors.push("Os exemplos das variáveis do corpo não podem ficar vazios.");
    }
  }

  // Header de texto — no máximo 1 variável ({{1}}) e exemplo obrigatório.
  if (input.header.type === "TEXT") {
    const headerVariables = extractVariableNumbers(input.header.text);
    if (headerVariables.length > TEMPLATE_LIMITS.maxHeaderVariables) {
      errors.push("O cabeçalho de texto aceita no máximo uma variável ({{1}}).");
    }
    if (headerVariables.length === 1 && headerVariables[0] !== 1) {
      errors.push("A variável do cabeçalho deve ser {{1}}.");
    }
    if (headerVariables.length === 1 && !input.header.example?.trim()) {
      errors.push("Informe um exemplo para a variável do cabeçalho.");
    }
  }

  // Botões — limites por tipo.
  const urlCount = input.buttons.filter((button) => button.type === "URL").length;
  const phoneCount = input.buttons.filter(
    (button) => button.type === "PHONE_NUMBER",
  ).length;
  const copyCount = input.buttons.filter(
    (button) => button.type === "COPY_CODE",
  ).length;
  if (urlCount > TEMPLATE_LIMITS.maxUrlButtons) {
    errors.push("No máximo 2 botões de URL.");
  }
  if (phoneCount > TEMPLATE_LIMITS.maxPhoneButtons) {
    errors.push("No máximo 1 botão de telefone.");
  }
  if (copyCount > TEMPLATE_LIMITS.maxCopyCodeButtons) {
    errors.push("No máximo 1 botão de copiar código.");
  }

  for (const button of input.buttons) {
    if (button.type === "URL" && button.urlType === "DYNAMIC") {
      if (!/\{\{\s*1\s*\}\}/.test(button.url)) {
        errors.push(
          `A URL dinâmica do botão "${button.text}" precisa terminar com {{1}}.`,
        );
      }
      if (!button.example?.trim()) {
        errors.push(
          `Informe um exemplo para a variável da URL do botão "${button.text}".`,
        );
      }
    }
  }

  return errors;
}

function isSequentialFromOne(numbers: number[]): boolean {
  return numbers.every((value, index) => value === index + 1);
}

function buildHeaderComponent(
  header: CreateTemplateInput["header"],
): CreateTemplateComponent | null {
  switch (header.type) {
    case "NONE":
      return null;
    case "TEXT": {
      const component: CreateTemplateComponent = {
        type: "HEADER",
        format: "TEXT",
        text: header.text,
      };
      if (countVariables(header.text) === 1 && header.example) {
        component.example = { header_text: [header.example] };
      }
      return component;
    }
    case "IMAGE":
    case "VIDEO":
    case "DOCUMENT":
      return {
        type: "HEADER",
        format: header.type,
        example: { header_handle: [header.handle] },
      };
    case "LOCATION":
      return { type: "HEADER", format: "LOCATION" };
  }
}

function buildButton(
  button: CreateTemplateInput["buttons"][number],
): CreateTemplateButton {
  switch (button.type) {
    case "QUICK_REPLY":
      return { type: "QUICK_REPLY", text: button.text };
    case "PHONE_NUMBER":
      return {
        type: "PHONE_NUMBER",
        text: button.text,
        phone_number: button.phoneNumber,
      };
    case "COPY_CODE":
      return { type: "COPY_CODE", example: button.example };
    case "URL": {
      const built: CreateTemplateButton = {
        type: "URL",
        text: button.text,
        url: button.url,
      };
      if (button.urlType === "DYNAMIC" && button.example) {
        built.example = [button.url.replace(/\{\{\s*1\s*\}\}/, button.example)];
      }
      return built;
    }
  }
}

export function buildTemplateComponents(
  input: CreateTemplateInput,
): CreateTemplateComponent[] {
  const components: CreateTemplateComponent[] = [];

  const header = buildHeaderComponent(input.header);
  if (header) components.push(header);

  const body: CreateTemplateComponent = {
    type: "BODY",
    text: input.body.text,
  };
  if (countVariables(input.body.text) > 0) {
    body.example = { body_text: [input.body.examples] };
  }
  components.push(body);

  if (input.footer?.trim()) {
    components.push({ type: "FOOTER", text: input.footer.trim() });
  }

  if (input.buttons.length > 0) {
    components.push({ type: "BUTTONS", buttons: input.buttons.map(buildButton) });
  }

  return components;
}

export function buildCreateTemplateRequest(
  input: CreateTemplateInput,
): CreateMessageTemplateRequest {
  return {
    name: input.name,
    language: input.language,
    category: input.category,
    components: buildTemplateComponents(input),
  };
}
