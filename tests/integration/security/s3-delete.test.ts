import { describe, expect, it, vi } from "vitest";
import { DELETE } from "@/app/api/s3/delete/route";
import { deleteStoredObject } from "@/lib/s3-client";
import { createUploadDeleteToken } from "@/lib/security/upload-delete-token";
import { createOrganizationWithOwner } from "../support/builders";
import { signInAs } from "../support/session";

// O efeito no bucket é a asserção: o storage é o único dublê deste arquivo.
vi.mock("@/lib/s3-client", () => ({
  deleteStoredObject: vi.fn(async () => true),
}));

const OBJECT_KEY = "3f1c2b7e-0000-4000-8000-000000000001.png";

function deleteRequest(body: unknown) {
  return new Request("http://localhost:3000/api/s3/delete", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const tokenFor = (objectKey: string) =>
  createUploadDeleteToken(objectKey, process.env.BETTER_AUTH_SECRET);

describe("spec 0091 — DELETE /api/s3/delete (S2)", () => {
  it("RF-4: sem sessão e sem token, recusa com 401 e não apaga", async () => {
    const response = await DELETE(deleteRequest({ key: OBJECT_KEY }));

    expect(response.status).toBe(401);
    expect(deleteStoredObject).not.toHaveBeenCalled();
  });

  it("RF-4: com sessão, apaga", async () => {
    signInAs(await createOrganizationWithOwner());

    const response = await DELETE(deleteRequest({ key: OBJECT_KEY }));

    expect(response.status).toBe(200);
    expect(deleteStoredObject).toHaveBeenCalledWith(OBJECT_KEY);
  });

  it("CA-3: sem sessão, o token emitido no upload do arquivo autoriza apagar", async () => {
    const response = await DELETE(
      deleteRequest({ key: OBJECT_KEY, deleteToken: tokenFor(OBJECT_KEY) }),
    );

    expect(response.status).toBe(200);
    expect(deleteStoredObject).toHaveBeenCalledWith(OBJECT_KEY);
  });

  it("CA-3: o token de um arquivo não apaga outro", async () => {
    const response = await DELETE(
      deleteRequest({ key: "outro-arquivo.png", deleteToken: tokenFor(OBJECT_KEY) }),
    );

    expect(response.status).toBe(401);
    expect(deleteStoredObject).not.toHaveBeenCalled();
  });

  it.each([
    ["ausente", {}],
    ["vazia", { key: "" }],
    ["que não é texto", { key: 42 }],
    ["longa demais", { key: "a".repeat(600) }],
  ])("chave %s devolve 400 sem apagar", async (_caso, body) => {
    signInAs(await createOrganizationWithOwner());

    const response = await DELETE(deleteRequest(body));

    expect(response.status).toBe(400);
    expect(deleteStoredObject).not.toHaveBeenCalled();
  });

  it("falha do storage devolve 502", async () => {
    vi.mocked(deleteStoredObject).mockResolvedValueOnce(false);
    signInAs(await createOrganizationWithOwner());

    const response = await DELETE(deleteRequest({ key: OBJECT_KEY }));

    expect(response.status).toBe(502);
  });
});
