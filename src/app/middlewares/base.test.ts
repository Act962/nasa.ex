// Por que `throw errors.X;` (sem parênteses) é defeito: `errors.X` é a função
// que constrói o erro. Lançá-la entrega ao oRPC algo que não é um ORPCError, e
// o cliente recebe 500 genérico no lugar do código pretendido (item A1 da auditoria).

import { call, ORPCError } from "@orpc/server";
import { describe, expect, it } from "vitest";
import { base } from "./base";

const context = { context: { headers: new Headers() } };

async function rejectionOf(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error("a procedure deveria ter lançado");
}

describe("erros tipados das procedures", () => {
  it("invocado, o erro chega com o código e a mensagem padrão", async () => {
    const procedure = base.handler(({ errors }) => {
      throw errors.NOT_FOUND();
    });

    const rejection = await rejectionOf(() => call(procedure, undefined, context));

    expect(rejection).toBeInstanceOf(ORPCError);
    expect(rejection).toMatchObject({ code: "NOT_FOUND", status: 404, message: "Not found" });
  });

  it("invocado com mensagem, a mensagem substitui a padrão", async () => {
    const procedure = base.handler(({ errors }) => {
      throw errors.FORBIDDEN({ message: "Sem acesso a este lead" });
    });

    const rejection = await rejectionOf(() => call(procedure, undefined, context));

    expect(rejection).toMatchObject({ code: "FORBIDDEN", status: 403, message: "Sem acesso a este lead" });
  });

  it("INTERNAL_SERVER_ERROR invocado é um ORPCError 500", async () => {
    const procedure = base.handler(({ errors }) => {
      throw errors.INTERNAL_SERVER_ERROR();
    });

    const rejection = await rejectionOf(() => call(procedure, undefined, context));

    expect(rejection).toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Something went wrong",
    });
  });

  it("sem invocar, o que é lançado não é um ORPCError e o código pretendido se perde", async () => {
    const procedure = base.handler(({ errors }) => {
      throw errors.NOT_FOUND;
    });

    const rejection = await rejectionOf(() => call(procedure, undefined, context));

    expect(rejection).not.toBeInstanceOf(ORPCError);
    expect(rejection).not.toMatchObject({ code: "NOT_FOUND" });
  });
});
