import { inngest } from "@/inngest/client";
import {
  ATTENDANCE_CHECK_EVENT,
  runAttendanceCheck,
  type AttendanceCheckEventData,
} from "@/features/org-defaults/lib/attendance/state";

// Uma checagem por espera (spec 0113, RNF-1): dorme até o prazo e confere se ainda vale. Nada roda por relógio.
export const attendanceCheck = inngest.createFunction(
  {
    id: "org-defaults-attendance-check",
    retries: 2,
    // Uma checagem por vez por lead: duas que acordam juntas não mandam mensagem dobrada.
    concurrency: [{ key: "event.data.leadId", limit: 1 }],
  },
  { event: ATTENDANCE_CHECK_EVENT },
  async ({ event, step }) => {
    const data = event.data as AttendanceCheckEventData;
    await step.sleepUntil("aguarda-prazo", new Date(data.dueAt));
    return step.run("confere-e-age", () => runAttendanceCheck(data));
  },
);
