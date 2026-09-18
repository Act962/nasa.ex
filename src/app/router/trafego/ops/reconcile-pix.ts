import { base } from "@/app/middlewares/base";
import { requireTrafegoOperatorMiddleware } from "@/app/middlewares/trafego-operator";
import { z } from "zod";
import { reconcileStuckTrafegoPix } from "@/features/trafego/server/lib/reconcile-asaas-pix";

/**
 * "Reconciliar PIX agora" — pergunta ao Asaas o estado das cobranças abertas e
 * confirma o que já foi pago.
 *
 * Existe porque as outras duas camadas de recuperação rodam no Inngest, e o
 * modo de falha que elas não cobrem é o Inngest estar fora. Esta roda no
 * request, sem fila no meio: é a saída manual quando nada mais responde.
 *
 * Idempotente — quem confirma é o `markTrafegoPurchasePaid`, com o mesmo claim
 * atômico do webhook. Clicar duas vezes não gera pedido duplicado.
 */
export const reconcileTrafegoPix = base
  .use(requireTrafegoOperatorMiddleware)
  .input(
    z
      .object({
        /** 0 = inclui cobrança recém-criada; o default respeita o webhook. */
        minAgeMinutes: z.number().int().min(0).max(1440).default(20),
        maxAgeDays: z.number().int().min(1).max(30).default(7),
      })
      .optional(),
  )
  .handler(async ({ input }) => {
    const summary = await reconcileStuckTrafegoPix({
      minAgeMinutes: input?.minAgeMinutes ?? 20,
      maxAgeDays: input?.maxAgeDays ?? 7,
      limit: 100,
    });

    return {
      ...summary,
      message:
        summary.confirmed > 0
          ? `${summary.confirmed} pagamento(s) confirmado(s).`
          : summary.checked === 0
            ? "Nenhuma cobrança aberta para conferir."
            : `${summary.checked} cobrança(s) conferida(s), nenhuma paga ainda.`,
    };
  });
