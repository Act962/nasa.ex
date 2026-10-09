import { inngest } from "@/inngest/client";
import {
  BOT_MESSAGE_RECEIVED_EVENT,
  BOT_QUESTION_OPENED_EVENT,
  closeInactiveQuestion,
  inactivityMinutes,
  type BotQuestionOpenedData,
} from "@/features/astro-bot/lib/inactivity";

// Pergunta do Astro no WhatsApp sem resposta: encerra e avisa (spec 0079, RF-16).
// Qualquer mensagem do membro cancela a espera.
export const astroBotInactivityNotice = inngest.createFunction(
  {
    id: "astro-bot-inactivity-notice",
    retries: 1,
    cancelOn: [{ event: BOT_MESSAGE_RECEIVED_EVENT, match: "data.bindingId" }],
  },
  { event: BOT_QUESTION_OPENED_EVENT },
  async ({ event, step }) => {
    const data = event.data as BotQuestionOpenedData;
    await step.sleep("aguarda-resposta", `${inactivityMinutes()}m`);
    return step.run("encerra-e-avisa", async () => ({ isNoticeSent: await closeInactiveQuestion(data) }));
  },
);
