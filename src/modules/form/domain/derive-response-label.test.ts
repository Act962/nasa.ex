import { describe, expect, it } from "vitest";
import { deriveResponseLabel, readValue } from "./derive-response-label";

const labelBlock = (id: string) => ({ id, attributes: { useAsResponseLabel: true } });

describe("deriveResponseLabel", () => {
  it("usa o valor do bloco marcado como título da resposta", () => {
    const label = deriveResponseLabel({
      jsonBlock: [{ id: "nome" }, labelBlock("empresa")],
      jsonResponse: { nome: { value: "Ana" }, empresa: { value: "Órbita" } },
    });

    expect(label).toBe("Órbita");
  });

  it("escolhe o primeiro bloco marcado na ordem do formulário, incluindo aninhados", () => {
    const label = deriveResponseLabel({
      jsonBlock: [{ id: "linha", childblocks: [labelBlock("aninhado")] }, labelBlock("depois")],
      jsonResponse: { aninhado: { value: "Primeiro" }, depois: { value: "Segundo" } },
    });

    expect(label).toBe("Primeiro");
  });

  it("aceita blocos e respostas serializados em JSON", () => {
    const label = deriveResponseLabel({
      jsonBlock: JSON.stringify([labelBlock("empresa")]),
      jsonResponse: JSON.stringify({ empresa: "Órbita" }),
    });

    expect(label).toBe("Órbita");
  });

  it("aceita o formato antigo de resposta, com a string crua", () => {
    const label = deriveResponseLabel({
      jsonBlock: [labelBlock("empresa")],
      jsonResponse: { empresa: "Órbita" },
    });

    expect(label).toBe("Órbita");
  });

  it("remove espaços das pontas e corta em 80 caracteres", () => {
    const label = deriveResponseLabel({
      jsonBlock: [labelBlock("empresa")],
      jsonResponse: { empresa: { value: `  ${"a".repeat(100)}  ` } },
    });

    expect(label).toBe("a".repeat(80));
  });

  it.each([
    ["nenhum bloco está marcado", [{ id: "empresa" }], { empresa: { value: "Órbita" } }],
    ["o bloco marcado não foi respondido", [labelBlock("empresa")], {}],
    ["a resposta só tem espaços", [labelBlock("empresa")], { empresa: { value: "   " } }],
    ["o valor não é texto", [labelBlock("empresa")], { empresa: { value: 42 } }],
    ["os blocos não são uma lista", { id: "empresa" }, { empresa: { value: "Órbita" } }],
    ["o JSON dos blocos é inválido", "{não é json", { empresa: { value: "Órbita" } }],
    ["o JSON da resposta é inválido", [labelBlock("empresa")], "{não é json"],
    ["a resposta está ausente", [labelBlock("empresa")], null],
  ])("devolve null quando %s", (_caso, jsonBlock, jsonResponse) => {
    expect(deriveResponseLabel({ jsonBlock, jsonResponse })).toBeNull();
  });
});

describe("readValue", () => {
  it("lê string crua e o campo value do formato novo", () => {
    expect(readValue("texto")).toBe("texto");
    expect(readValue({ value: "texto" })).toBe("texto");
  });

  it("devolve null para ausente e para valor que não é texto", () => {
    expect(readValue(null)).toBeNull();
    expect(readValue(undefined)).toBeNull();
    expect(readValue(42)).toBeNull();
    expect(readValue({ value: ["a"] })).toBeNull();
  });
});
