// Baixa automática do PIX pago no banco (spec 0130, RF-6). Disparada pelo webhook, uma
// execução por PIX (~200/mês hoje). Concorrência 1 por conexão para respeitar o limite do banco.
import { inngest } from "@/inngest/client";
import { confirmAndRecordBankPix } from "@/features/payment/server/bank-charges/settle-bank-pix";

interface BankPixReceivedData {
  organizationId: string;
  connectionId: string;
  endToEndId: string;
}

export const paymentBankPixReceived = inngest.createFunction(
  {
    id: "payment-bank-pix-received",
    retries: 4,
    concurrency: { key: "event.data.connectionId", limit: 1 },
  },
  { event: "payment/bank-pix.received" },
  async ({ event, step }) => {
    const data = event.data as BankPixReceivedData;
    const settlement = await step.run("confirm-and-record", () => confirmAndRecordBankPix(data));
    return settlement ?? { outcome: "not_confirmed" };
  },
);
