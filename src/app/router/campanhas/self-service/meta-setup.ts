import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { canToggleInChatManual } from "@/features/tracking-chat/lib/can-toggle-in-chat-manual";
import {
  addNumberAndRequestCode,
  getSetupStatus,
  requestCode,
  saveMetaKeys,
  selectPhoneNumber,
  verifyAndRegister,
} from "@/features/campanhas/server/lib/meta-setup-service";
import {
  getConnectProgress,
  saveConnectProgress,
  saveKeyDraft,
} from "@/features/campanhas/server/lib/connect-progress-service";

const trackingInput = z.object({ trackingId: z.string().min(1) });

/** Só quem administra o WhatsApp da empresa mexe nas chaves e no número. */
const managerProcedure = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(async ({ context, next, errors }) => {
    if (!(await canToggleInChatManual(context.user.id, context.org.id))) {
      throw errors.FORBIDDEN({ message: "Só owner, admin ou moderador pode conectar o WhatsApp oficial." });
    }
    return next();
  });

export const metaSetupStatus = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(trackingInput)
  .handler(({ input, context }) => getSetupStatus({ organizationId: context.org.id, trackingId: input.trackingId }));

export const saveMetaKeysProcedure = managerProcedure
  .input(
    trackingInput.extend({
      accessToken: z.string().optional(),
      appId: z.string().optional(),
      appSecret: z.string().optional(),
      wabaId: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const result = await saveMetaKeys({ organizationId: context.org.id, ...input });
    if (result.status === "saved") {
      await logActivity({
        organizationId: context.org.id,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: context.user.image,
        appSlug: "campanhas",
        action: "whatsapp_official.keys_saved",
        actionLabel: "Conectou as chaves do WhatsApp oficial",
        resource: "tracking",
        resourceId: input.trackingId,
        metadata: { wabaId: result.wabaId, phones: result.phones.length, webhook: result.webhook },
      }).catch(() => {});
    }
    return result;
  });

export const selectMetaPhone = managerProcedure
  .input(trackingInput.extend({ phoneNumberId: z.string().min(1) }))
  .handler(({ input, context }) => selectPhoneNumber({ organizationId: context.org.id, ...input }));

export const addMetaNumber = managerProcedure
  .input(
    trackingInput.extend({
      phoneNumber: z.string().min(10),
      verifiedName: z.string().min(2).max(60),
      codeMethod: z.enum(["SMS", "VOICE"]).optional(),
    }),
  )
  .handler(({ input, context }) => addNumberAndRequestCode({ organizationId: context.org.id, ...input }));

export const requestMetaCode = managerProcedure
  .input(trackingInput.extend({ phoneNumberId: z.string().min(1), codeMethod: z.enum(["SMS", "VOICE"]).optional() }))
  .handler(({ input, context }) => requestCode({ organizationId: context.org.id, ...input }));

export const verifyMetaCode = managerProcedure
  .input(trackingInput.extend({ phoneNumberId: z.string().min(1), code: z.string().min(4).max(10) }))
  .handler(async ({ input, context }) => {
    const result = await verifyAndRegister({ organizationId: context.org.id, ...input });
    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: context.user.image,
      appSlug: "campanhas",
      action: "whatsapp_official.number_registered",
      actionLabel: "Registrou o número do WhatsApp oficial",
      resource: "tracking",
      resourceId: input.trackingId,
      metadata: { phoneNumberId: input.phoneNumberId },
    }).catch(() => {});
    return result;
  });

export const connectProgress = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(trackingInput)
  .handler(({ input, context }) => getConnectProgress({ organizationId: context.org.id, trackingId: input.trackingId }));

export const saveConnectProgressProcedure = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    trackingInput.extend({
      guideSlug: z.string().max(80).nullable().optional(),
      addDoneIds: z.array(z.string().max(80)).max(20).optional(),
      removeDoneIds: z.array(z.string().max(80)).max(20).optional(),
      numberSource: z.enum(["own", "salvy"]).nullable().optional(),
      salvyNumberId: z.string().nullable().optional(),
    }),
  )
  .handler(({ input, context }) => {
    const { trackingId, ...patch } = input;
    return saveConnectProgress({ organizationId: context.org.id, trackingId, userId: context.user.id, patch });
  });

export const saveKeyDraftProcedure = managerProcedure
  .input(
    trackingInput.extend({
      accessToken: z.string().max(1000).optional(),
      appId: z.string().max(40).optional(),
      appSecret: z.string().max(100).optional(),
      appPageUrl: z.string().max(500).optional(),
      businessPageUrl: z.string().max(1000).optional(),
    }),
  )
  .handler(({ input, context }) => {
    const { trackingId, ...keys } = input;
    return saveKeyDraft({ organizationId: context.org.id, trackingId, userId: context.user.id, ...keys });
  });
