import { describe, expect, it } from "vitest";
import {
  createUploadDeleteToken,
  isUploadDeleteTokenValid,
  UPLOAD_DELETE_TOKEN_TTL_MS,
} from "./upload-delete-token";

const SECRET = "segredo-de-teste";
const NOW = 1_800_000_000_000;
const KEY = "3f1c2b7e-0000-4000-8000-000000000001.png";

const tokenFor = (objectKey: string) => createUploadDeleteToken(objectKey, SECRET, NOW)!;

describe("token de exclusão de upload (S2)", () => {
  it("o token emitido para um arquivo autoriza apagar esse arquivo", () => {
    expect(isUploadDeleteTokenValid(KEY, tokenFor(KEY), SECRET, NOW + 1000)).toBe(true);
  });

  it("não autoriza apagar outro arquivo", () => {
    expect(isUploadDeleteTokenValid("outro-arquivo.png", tokenFor(KEY), SECRET, NOW)).toBe(false);
  });

  it("expira depois de 24 horas", () => {
    const token = tokenFor(KEY);

    expect(isUploadDeleteTokenValid(KEY, token, SECRET, NOW + UPLOAD_DELETE_TOKEN_TTL_MS - 1)).toBe(true);
    expect(isUploadDeleteTokenValid(KEY, token, SECRET, NOW + UPLOAD_DELETE_TOKEN_TTL_MS)).toBe(false);
  });

  it("recusa validade adulterada para estender o prazo", () => {
    const [, signature] = tokenFor(KEY).split(".");
    const forgedToken = `${NOW + 10 * UPLOAD_DELETE_TOKEN_TTL_MS}.${signature}`;

    expect(isUploadDeleteTokenValid(KEY, forgedToken, SECRET, NOW)).toBe(false);
  });

  it("recusa token assinado com outro segredo", () => {
    const foreignToken = createUploadDeleteToken(KEY, "outro-segredo", NOW);

    expect(isUploadDeleteTokenValid(KEY, foreignToken, SECRET, NOW)).toBe(false);
  });

  it.each([null, undefined, "", "abc", "123", "123.", ".abc", "1.2.3", "naonumero.abcdef"])(
    "recusa token malformado (%j)",
    (malformedToken) => {
      expect(isUploadDeleteTokenValid(KEY, malformedToken, SECRET, NOW)).toBe(false);
    },
  );

  it("fail-closed sem segredo: não emite nem aceita", () => {
    expect(createUploadDeleteToken(KEY, undefined, NOW)).toBeNull();
    expect(isUploadDeleteTokenValid(KEY, tokenFor(KEY), undefined, NOW)).toBe(false);
    expect(isUploadDeleteTokenValid(KEY, tokenFor(KEY), "", NOW)).toBe(false);
  });
});
