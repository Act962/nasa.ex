import { describe, expect, it } from "vitest";
import type { FormBlockInstance } from "@/features/form/types";
import { computeFormReadiness } from "./form-readiness";

type BlockAttributes = Record<string, unknown>;

function block(
  id: string,
  blockType: string,
  attributes: BlockAttributes = {},
  childblocks?: FormBlockInstance[],
): FormBlockInstance {
  return { id, blockType: blockType as FormBlockInstance["blockType"], attributes, childblocks };
}

const problemMessages = (blocks: FormBlockInstance[]) =>
  computeFormReadiness(blocks).problems.map((problem) => problem.message);

describe("computeFormReadiness", () => {
  it("formulário vazio não é publicável", () => {
    const readiness = computeFormReadiness([]);

    expect(readiness.percent).toBe(0);
    expect(readiness.problems).toEqual([
      {
        blockId: "__empty__",
        blockType: "__empty__",
        message: "Adicione pelo menos um bloco ao formulário.",
      },
    ]);
    expect(readiness.invalidIds.has("__empty__")).toBe(true);
  });

  it("formulário com todos os blocos válidos chega a 100%", () => {
    const readiness = computeFormReadiness([
      block("titulo", "Heading", { text: "Inscrição" }),
      block("nome", "TextField", { label: "Nome" }),
      block("plano", "RadioSelect", { label: "Plano", options: [{ value: "A" }, { value: "B" }] }),
      block("quebra", "PageBreak"),
    ]);

    expect(readiness).toMatchObject({ totalChecks: 4, passed: 4, percent: 100, problems: [] });
    expect(readiness.invalidIds.size).toBe(0);
  });

  it("campo sem título é problema", () => {
    expect(problemMessages([block("nome", "TextField", { label: "   " })])).toEqual([
      "Defina um título pro campo.",
    ]);
  });

  it("bloco de opções exige título, duas opções e texto em todas", () => {
    expect(problemMessages([block("plano", "Dropdown", { options: [] })])).toEqual([
      "Defina um título pro campo.",
    ]);
    expect(
      problemMessages([block("plano", "Dropdown", { label: "Plano", options: [{ value: "A" }] })]),
    ).toEqual(["Adicione pelo menos 2 opções."]);
    expect(
      problemMessages([
        block("plano", "Dropdown", { label: "Plano", options: [{ value: "A" }, { value: " " }] }),
      ]),
    ).toEqual(["Toda opção precisa de um texto."]);
  });

  it("imagem exige URL e título exige texto", () => {
    expect(problemMessages([block("imagem", "ImageDisplay")])).toEqual([
      "Faça upload ou cole a URL da imagem.",
    ]);
    expect(problemMessages([block("titulo", "Heading", { text: "" })])).toEqual([
      "Defina o texto do título.",
    ]);
  });

  it("parágrafo aceita o conteúdo em text ou, na ausência dele, em content", () => {
    expect(problemMessages([block("texto", "Paragraph", { text: "Olá" })])).toEqual([]);
    expect(problemMessages([block("texto", "Paragraph", { content: "Olá" })])).toEqual([]);
    expect(problemMessages([block("texto", "Paragraph")])).toEqual([
      "Adicione o conteúdo do parágrafo.",
    ]);
  });

  it("CA-7 (spec 0109): parágrafo com text vazio vale pelo content preenchido", () => {
    expect(problemMessages([block("texto", "Paragraph", { text: "", content: "Olá" })])).toEqual([]);
    expect(problemMessages([block("texto", "Paragraph", { text: "  ", content: " " })])).toEqual([
      "Adicione o conteúdo do parágrafo.",
    ]);
  });

  it("tipo desconhecido só é cobrado pelo título se tiver o atributo label", () => {
    expect(problemMessages([block("novo", "BlocoFuturo", { label: "" })])).toEqual([
      "Defina um título pro campo.",
    ]);
    expect(problemMessages([block("novo", "BlocoFuturo", { outro: 1 })])).toEqual([]);
  });

  it("problema em bloco filho marca também o pai e entra no percentual", () => {
    const readiness = computeFormReadiness([
      block("linha", "RowLayout", {}, [
        block("nome", "TextField", { label: "Nome" }),
        block("email", "TextField", {}),
      ]),
    ]);

    expect(readiness).toMatchObject({ totalChecks: 3, passed: 2, percent: 67 });
    expect(readiness.problems).toEqual([
      { blockId: "email", blockType: "TextField", message: "Defina um título pro campo." },
    ]);
    expect([...readiness.invalidIds].sort()).toEqual(["email", "linha"]);
  });
});
