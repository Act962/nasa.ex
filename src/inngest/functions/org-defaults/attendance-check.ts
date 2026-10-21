import { inngest } from "@/inngest/client";
import {
  ATTENDANCE_CHECK_EVENT,
  applyCheckEffects,
  claimAttendanceCheck,
  runHumanAbsentCheck,
  sendCheckFixedMessage,
  type AttendanceCheckEvent,
} from "@/features/org-defaults/lib/attendance/state";

// Uma checagem por espera (spec 0113, RNF-1): dorme até o prazo, confere e trava a seção, depois age. Cada
// parte num passo: um retry não repete a mensagem fixa nem perde o próximo estágio. Nada roda por relógio.
export const attendanceCheck = inngest.createFunction(
  {
    id: "org-defaults-attendance-check",
    retries: 2,
    // Uma checagem por vez por lead: duas que acordam juntas não mandam mensagem dobrada.
    concurrency: [{ key: "event.data.leadId", limit: 1 }],
  },
  { event: ATTENDANCE_CHECK_EVENT },
  async ({ event, step }) => {
    const data = event.data as AttendanceCheckEvent;
    await step.sleepUntil("aguarda-prazo", new Date(data.dueAt));
    // "O atendente sumiu" vale para todas as empresas e só lê o lead (spec 0113, revisão 9.1).
    if (data.stage === "human_absent") return step.run("atendente-sumiu", () => runHumanAbsentCheck(data));
    const claimed = await step.run("confere-e-trava", () => claimAttendanceCheck(data));
    const effects = claimed.effects;
    if (!effects) return claimed;
    const fixedMessageKind = effects.fixedMessageKind;
    if (fixedMessageKind) await step.run("mensagem-fixa", () => sendCheckFixedMessage(data, fixedMessageKind));
    if (effects.aiReply || effects.ownerNoticeNumber) {
      await step.run("ia-e-avisos", () => applyCheckEffects(data, effects));
    }
    return claimed;
  },
);
