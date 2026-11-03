// Baixa automática do que foi pago no banco: PIX (spec 0130, RF-6) e boleto com PIX (spec
// 0133, RF-7). Disparada pelo webhook, uma execução por aviso (~200 PIX/mês hoje; o boleto soma
// ~2 por boleto: emitido e pago). Concorrência 1 por conexão para respeitar o limite do banco.
import { inngest } from "@/inngest/client";
import {
  confirmAndApplyBankBoleto,
  confirmAndRecordBankPix,
} from "@/features/payment/server/bank-charges/settle-bank-pix";

interface BankPixReceivedData {
  organizationId: string;
  connectionId: string;
  endToEndId: string;
}

interface BankBoletoUpdatedData {
  organizationId: string;
  connectionId: string;
  boletoRequestId: string;
}

export const paymentBankPixReceived = inngest.createFunction(
  {
    id: "payment-bank-pix-received",
    retries: 4,
    concurrency: { key: "event.data.connectionId", limit: 1 },
  },
  [{ event: "payment/bank-pix.received" }, { event: "payment/bank-boleto.updated" }],
  async ({ event, step }) => {
    if (event.name === "payment/bank-boleto.updated") {
      const data = event.data as BankBoletoUpdatedData;
      const result = await step.run("confirm-and-apply-boleto", () => confirmAndApplyBankBoleto(data));
      return result ?? { outcome: "not_confirmed" };
    }
    const data = event.data as BankPixReceivedData;
    const settlement = await step.run("confirm-and-record", () => confirmAndRecordBankPix(data));
    return settlement ?? { outcome: "not_confirmed" };
  },
);
