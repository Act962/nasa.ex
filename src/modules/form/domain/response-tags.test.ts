import { describe, expect, it } from "vitest";
import { extractResponseTagIds } from "./response-tags";

const asJson = (answers: unknown) => JSON.stringify(answers);

describe("extractResponseTagIds", () => {
  it("lê a tag de escolha única e as de múltipla escolha, sem repetir", () => {
    const answers = {
      plano: { value: "Pro", meta: { tagId: "tag-pro" } },
      interesses: { value: ["A", "B"], meta: { tagIds: ["tag-a", "tag-b", "tag-pro"] } },
    };

    expect(extractResponseTagIds(asJson(answers))).toEqual(["tag-pro", "tag-a", "tag-b"]);
  });

  it("ignora campo sem meta, tag vazia e valor que não é texto", () => {
    const answers = {
      nome: "Ana",
      vazio: { meta: { tagId: "" } },
      numero: { meta: { tagId: 7, tagIds: [null, "", "tag-ok"] } },
      semMeta: { value: "x" },
    };

    expect(extractResponseTagIds(asJson(answers))).toEqual(["tag-ok"]);
  });

  it.each(["isto não é json", "null", "42", '"texto"'])("resposta %s não tem tags", (rawResponse) => {
    expect(extractResponseTagIds(rawResponse)).toEqual([]);
  });
});
