// Cron diário: conta a receber vencida vira OVERDUE (spec 0104, RF-5). Antes disso nada gravava esse status.
// Antes de marcar, relê os PIX pagos no banco (spec 0130, RF-11): quem pagou e teve o aviso perdido
// não vira atrasado. E avisa do certificado do banco vencendo (RF-9).
import { inngest } from "@/inngest/client";
import { markOverdueReceivables } from "@/features/payment/server/entries/lead-credit-status";
import { sweepBankPixPayments } from "@/features/payment/server/bank-charges/settle-bank-pix";
import { alertExpiringBankCertificates } from "@/features/payment/server/bank-charges/certificate-alerts";

export const markOverdueReceivablesCron = inngest.createFunction(
  { id: "payment-mark-overdue-receivables", retries: 1 },
  { cron: "TZ=America/Sao_Paulo 15 0 * * *" },
  async ({ step }) => {
    const bankPix = await step.run("bank-pix-sweep", () => sweepBankPixPayments());
    const updated = await step.run("mark-overdue", () => markOverdueReceivables());
    const bankCertificates = await step.run("bank-certificates", () => alertExpiringBankCertificates());
    return { updated, bankPix, bankCertificates };
  },
);
