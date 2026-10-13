import { NodeExecutor } from "@/features/workspace-executions/types";
import { NonRetriableError } from "inngest";
import prisma from "@/lib/prisma";
import { resolveOutboundProvider } from "@/features/tracking-chat/lib/providers";
import { NOTICE_NEEDS_CLIENT_TEMPLATE_MESSAGE } from "@/features/tracking-chat/lib/providers/automated-outbound";
import { wsSendMessageChannel } from "@/inngest/channels/workspace";
import { ActionContext } from "../../schemas";
import { loadActionContext } from "../../lib/load-action-context";
import { renderWorkspaceVariables } from "../../lib/render-variables";
import { countries } from "@/types/some";
import { normalizePhone } from "@/utils/format-phone";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { sendTextRaw } from "./message/send-text-raw";
import { sendImageRaw } from "./message/send-image-raw";
import { sendDocumentRaw } from "./message/send-document-raw";
import type { WsSendMessageFormValues } from "./dialog";

type Data = {
  action?: WsSendMessageFormValues;
};

export const wsSendMessageParticipantsExecutor: NodeExecutor<Data> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  const realTime = context.realTime as boolean;

  return step.run("ws-send-message-participants", async () => {
    if (realTime) {
      await publish(
        wsSendMessageChannel().status({ nodeId, status: "loading" }),
      );
    }
    try {
      const action = context.action as ActionContext | undefined;
      const cfg = data.action;
      if (!action || !cfg) {
        throw new NonRetriableError("Action or config missing");
      }

      const detail = await loadActionContext(action.id);
      if (!detail) throw new NonRetriableError("Action not found");

      const workspace = await prisma.workspace.findUnique({
        where: { id: detail.workspaceId },
      });
      if (!workspace) throw new NonRetriableError("Workspace not found");

      const column = detail.columnId
        ? await prisma.workspaceColumn.findUnique({
            where: { id: detail.columnId },
          })
        : null;

      const instance = await prisma.whatsAppInstance.findUnique({
        where: { id: cfg.instanceId },
      });
      if (!instance) throw new NonRetriableError("Instance not found");
      // Participante não é lead e não tem janela de 24h: na API Oficial só
      // sai template aprovado da conta do cliente. Conferido antes de cobrar.
      const resolved = await resolveOutboundProvider(instance.trackingId);
      if (
        resolved.providerId === "meta-cloud" &&
        cfg.payload.type !== "TEMPLATE"
      ) {
        throw new NonRetriableError(NOTICE_NEEDS_CLIENT_TEMPLATE_MESSAGE);
      }
      if (resolved.providerId !== "meta-cloud" && cfg.payload.type === "TEMPLATE") {
        throw new NonRetriableError(
          "Template só pode ser enviado por instância da API Oficial.",
        );
      }
      const { provider } = resolved;

      const renderFor = (
        template: string,
        participant?: { name: string; email: string },
      ) =>
        renderWorkspaceVariables(template, {
          action: detail,
          workspace: { name: workspace.name },
          column: column ? { name: column.name } : undefined,
          participant,
        });

      const dispatch = async (
        number: string,
        participant?: { name: string; email: string },
      ) => {
        const payload = cfg.payload;

        // Variáveis do template resolvidas e conferidas antes da cobrança:
        // variável vazia não pode custar uma mensagem que não saiu.
        const renderParameters = (parameters: string[] | undefined) =>
          (parameters ?? []).map((parameter) =>
            renderFor(parameter, participant).trim(),
          );
        const templateParameters =
          payload.type === "TEMPLATE"
            ? {
                header: renderParameters(payload.headerParameters),
                body: renderParameters(payload.bodyParameters),
              }
            : null;
        const hasEmptyParameter =
          templateParameters !== null &&
          [...templateParameters.header, ...templateParameters.body].some(
            (parameter) => parameter.length === 0,
          );
        if (hasEmptyParameter) {
          throw new NonRetriableError(
            `Uma variável do template ficou vazia para ${participant?.name ?? number}.`,
          );
        }

        const charge = await chargeStarsByAction(
          workspace.organizationId,
          "message_send",
          {
            appSlug: "message_send",
            description: `Workspace send-message — ${workspace.name}${participant ? ` → ${participant.name}` : ""}`,
          },
        );
        if (!charge.success) {
          console.warn(
            `[ws-send-message-participants] saldo insuficiente — skipped ${number}`,
          );
          return;
        }

        if (payload.type === "TEMPLATE" && templateParameters) {
          await provider.sendTemplate({
            kind: "template",
            to: number,
            templateName: payload.templateName,
            languageCode: payload.languageCode,
            headerParameters: templateParameters.header.length
              ? templateParameters.header
              : undefined,
            bodyParameters: templateParameters.body.length
              ? templateParameters.body
              : undefined,
          });
        } else if (payload.type === "TEXT") {
          await sendTextRaw({
            body: renderFor(payload.message, participant),
            number,
            provider,
          });
        } else if (payload.type === "IMAGE") {
          await sendImageRaw({
            body: renderFor(payload.caption ?? "", participant),
            number,
            provider,
            mediaUrl: payload.imageUrl,
          });
        } else if (payload.type === "DOCUMENT") {
          await sendDocumentRaw({
            body: renderFor(payload.caption ?? "", participant),
            number,
            provider,
            mediaUrl: payload.documentUrl,
            fileName: payload.fileName,
          });
        }
      };

      if (cfg.target.sendMode === "CUSTOM") {
        const country = countries.find((c) => c.code === cfg.target.code);
        const ddi = country?.ddi.replace(/\D/g, "") || "";
        const number = ddi + normalizePhone(cfg.target.phone);
        await dispatch(number);
      } else {
        const participants = await prisma.user.findMany({
          where: { id: { in: detail.participantIds } },
        });

        for (const participant of participants) {
          if (!participant.phone) continue;
          const number = normalizePhone(participant.phone);
          if (!number) continue;

          await dispatch(number, {
            name: participant.name,
            email: participant.email ?? "",
          });
        }
      }

      if (realTime) {
        await publish(
          wsSendMessageChannel().status({ nodeId, status: "success" }),
        );
      }
      return context;
    } catch (err) {
      if (realTime) {
        await publish(
          wsSendMessageChannel().status({ nodeId, status: "error" }),
        );
      }
      throw err;
    }
  });
};
