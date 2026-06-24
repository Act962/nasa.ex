import { NodeExecutor } from "@/features/tracking-executions/types";
import prisma from "@/lib/prisma";
import { NonRetriableError } from "inngest";
import { LeadContext } from "../../schemas";
import { sendAppActionChannel } from "@/inngest/channels/send-app-action";
import { createNotification } from "@/features/admin/lib/notification-service";

/**
 * OPEN_FORM — cria uma `FormResponses` vazia vinculada ao lead, SEM enviar
 * link via WhatsApp. Diferente de SEND_FORM:
 *  - SEND_FORM: lead preenche o formulário (recebe link no WhatsApp).
 *  - OPEN_FORM: operador (consultor/atendente) preenche o formulário em
 *    nome do lead no app — recebe **notificação em tempo real** (toast +
 *    sino) com link direto pro `/formulario/novo/<formId>/<leadId>` já
 *    pré-preenchido com o nome do lead.
 *
 * Notificação vai pro `lead.responsibleId` se houver, senão pra todos os
 * participantes do tracking (TODO: a v1 só notifica responsável; sem
 * responsável, executor falha silencioso pra não spammar org inteira).
 *
 * Idempotência: se já existir uma FormResponses pra esse (form,lead) com
 * jsonResponse vazio, reusa ao invés de criar duplicata. Evita acúmulo
 * de drafts vazios se o workflow rodar várias vezes pro mesmo lead.
 */

export type OpenFormData = {
  formId: string;
};

export const openFormExecutor: NodeExecutor<OpenFormData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  return await step.run("open-form", async () => {
    const leadCtx = context.lead as LeadContext;
    const realTime = context.realTime as boolean;

    const lead = await prisma.lead.findUnique({
      where: { id: leadCtx.id },
      select: {
        id: true,
        name: true,
        responsibleId: true,
        tracking: { select: { name: true, organizationId: true } },
      },
    });
    if (!lead) {
      if (realTime) {
        await publish(
          sendAppActionChannel().status({ nodeId, status: "error" }),
        );
      }
      throw new NonRetriableError("Lead not found");
    }

    try {
      if (realTime) {
        await publish(
          sendAppActionChannel().status({ nodeId, status: "loading" }),
        );
      }

      // 1. Valida form + ownership
      const form = await prisma.form.findFirst({
        where: {
          id: data.formId,
          organizationId: lead.tracking.organizationId,
          published: true,
        },
        select: { id: true, name: true },
      });
      if (!form) {
        throw new NonRetriableError(
          "Form not found, not published, or not in lead's organization",
        );
      }

      // 2. Reusa draft existente vazio (idempotência) ou cria novo
      const existing = await prisma.formResponses.findFirst({
        where: {
          formId: form.id,
          leadId: lead.id,
          jsonResponse: { equals: "{}" },
        },
        select: { id: true },
      });

      if (!existing) {
        await prisma.formResponses.create({
          data: {
            formId: form.id,
            leadId: lead.id,
            jsonResponse: "{}",
            labelManuallyEdited: false,
          },
        });
      }

      // 3. Notifica o responsável em tempo real (toast + sino, via Pusher)
      //    com link direto pro form pré-preenchido com nome/email/phone do
      //    lead. createNotification respeita preferências do user (in-app
      //    + opcional WhatsApp). Se lead não tem responsável, skipa
      //    silenciosamente pra evitar spam de toda a org.
      if (lead.responsibleId) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
        const actionUrl = `${baseUrl}/formulario/novo/${form.id}/${lead.id}`;
        try {
          await createNotification({
            userId: lead.responsibleId,
            organizationId: lead.tracking.organizationId,
            type: "CUSTOM",
            title: `Preencher formulário: ${form.name}`,
            body: `Automação solicitou preenchimento do form "${form.name}" para o lead ${lead.name ?? ""}.`,
            actionUrl,
            appKey: "forms",
            severity: "info",
            displaySurface: "toast",
            metadata: {
              source: "workflow.open_form",
              formId: form.id,
              leadId: lead.id,
              nodeId,
            },
          });
        } catch (notifErr) {
          // Não bloqueia o executor — notification é fire-and-forget.
          console.error("[OPEN_FORM] createNotification falhou:", notifErr);
        }
      }

      if (realTime) {
        await publish(
          sendAppActionChannel().status({ nodeId, status: "success" }),
        );
      }
      return { ...context };
    } catch (error) {
      if (realTime) {
        await publish(
          sendAppActionChannel().status({ nodeId, status: "error" }),
        );
      }
      throw error;
    }
  });
};
