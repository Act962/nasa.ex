import { inngest } from "@/inngest/client";
import { sendDueRecordNotices } from "@/features/form-records/server/record-notices";

// Resumo do dia e aviso de prazo das fichas (spec 0081, parte C). De 15 em 15 minutos: quem
// escolheu 7h recebe entre 7h00 e 7h15. A trava de "uma vez por dia" fica em `sendDueRecordNotices`.
export const sendRecordNotices = inngest.createFunction(
  { id: "send-record-notices", retries: 0, concurrency: { limit: 1 } },
  { cron: "*/15 * * * *" },
  async ({ step }) => step.run("envia-avisos-das-fichas", () => sendDueRecordNotices()),
);
