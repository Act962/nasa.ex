import { z } from "zod";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  MAX_DAYS_BEFORE,
  RECORDS_DAILY_NOTICE,
  RECORDS_DUE_SOON_NOTICE,
  getRecordNoticeSettings,
  saveRecordNotice,
} from "@/features/form-records/server/record-notices";

// Avisos das fichas no WhatsApp de quem está logado (spec 0081, parte C).

const noticeState = { isOn: z.boolean(), lastError: z.string().nullable() };

export const getRecordNotices = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Get my record notices on WhatsApp", tags: ["Forms"] })
  .output(
    z.object({
      /** Número liberado no ASTRO por onde os avisos chegam; `null` = não há, e os avisos não saem. */
      boundPhone: z.string().nullable(),
      daily: z.object({ ...noticeState, hour: z.number() }),
      dueSoon: z.object({ ...noticeState, daysBefore: z.number() }),
    }),
  )
  .handler(async ({ context }) => getRecordNoticeSettings({ userId: context.user.id, organizationId: context.org.id }));

export const saveRecordNotices = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Turn a record notice on or off", tags: ["Forms"] })
  .input(
    z.discriminatedUnion("notice", [
      z.object({ notice: z.literal("daily"), isOn: z.boolean(), hour: z.number().int().min(0).max(23).optional() }),
      z.object({ notice: z.literal("dueSoon"), isOn: z.boolean(), daysBefore: z.number().int().min(1).max(MAX_DAYS_BEFORE).optional() }),
    ]),
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context }) => {
    await saveRecordNotice({
      userId: context.user.id,
      organizationId: context.org.id,
      notifType: input.notice === "daily" ? RECORDS_DAILY_NOTICE : RECORDS_DUE_SOON_NOTICE,
      isOn: input.isOn,
      hour: input.notice === "daily" ? input.hour : undefined,
      daysBefore: input.notice === "dueSoon" ? input.daysBefore : undefined,
    });
    return { success: true };
  });
