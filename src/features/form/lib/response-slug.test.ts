import { describe, expect, it } from "vitest";
import { buildResponseSlug } from "./response-slug";

// Datas no fuso local de propósito: a função usa os getters locais.
const localDate = new Date(2026, 0, 5);

describe("buildResponseSlug", () => {
  it("gera kebab-case sem acento nem pontuação, seguido da data", () => {
    expect(buildResponseSlug("Ficha de Inscrição 2026!", localDate)).toBe(
      "ficha-de-inscricao-2026-20260105",
    );
  });

  it("aceita a data como string", () => {
    expect(buildResponseSlug("Cadastro", "2026-03-09T12:00:00")).toBe("cadastro-20260309");
  });

  it("colapsa espaços e hífens repetidos e apara as pontas", () => {
    expect(buildResponseSlug(" - Ficha   --   Nova - ", localDate)).toBe("ficha-nova-20260105");
  });

  it("usa 'formulario' quando o nome é vazio ou só tem símbolos", () => {
    expect(buildResponseSlug("", localDate)).toBe("formulario-20260105");
    expect(buildResponseSlug("!!! ???", localDate)).toBe("formulario-20260105");
  });

  it("corta o nome em 80 caracteres", () => {
    expect(buildResponseSlug("a".repeat(100), localDate)).toBe(`${"a".repeat(80)}-20260105`);
  });

  // Comportamento atual: o corte em 80 vem depois de aparar os hífens, então
  // pode sobrar um hífen no fim do nome. Cosmético (a URL resolve pelo id).
  it("pode deixar hífen duplo quando o corte cai num separador", () => {
    expect(buildResponseSlug(`${"a".repeat(79)} b`, localDate)).toBe(
      `${"a".repeat(79)}--20260105`,
    );
  });
});
