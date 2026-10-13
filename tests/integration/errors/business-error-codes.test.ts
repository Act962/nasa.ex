// Etapa 5 do plano de migração: erro de negócio chega ao cliente com o código
// certo, não como erro interno. Antes, `throw errors.X;` (sem invocar) lançava
// a função e o cliente recebia 500. Um caso por domínio alterado.

import { call } from "@orpc/server";
import { describe, expect, it } from "vitest";
import { deleteReason } from "@/app/router/reasons/delete";
import { updateStatus } from "@/app/router/status/update";
import { getTracking } from "@/app/router/trackings/get";
import { createOrganizationWithOwner } from "../support/builders";
import { procedureContext, signInAs } from "../support/session";

describe("erros de negócio devolvem o código próprio", () => {
  it("trackings/get: tracking inexistente devolve NOT_FOUND", async () => {
    signInAs(await createOrganizationWithOwner());

    await expect(
      call(getTracking, { trackingId: "tracking-que-nao-existe" }, procedureContext),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("status/update: coluna inexistente devolve NOT_FOUND", async () => {
    signInAs(await createOrganizationWithOwner());

    await expect(
      call(updateStatus, { statusId: "coluna-que-nao-existe", name: "Nova" }, procedureContext),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("reasons/delete: motivo inexistente devolve BAD_REQUEST com mensagem própria", async () => {
    signInAs(await createOrganizationWithOwner());

    await expect(call(deleteReason, { id: "motivo-que-nao-existe" }, procedureContext)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      status: 400,
      message: "Motivo não encontrado.",
    });
  });
});
