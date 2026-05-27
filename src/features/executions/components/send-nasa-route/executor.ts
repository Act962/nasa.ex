import { NodeExecutor } from "@/features/executions/types";
import prisma from "@/lib/prisma";
import { NonRetriableError } from "inngest";
import { LeadContext } from "../../schemas";
import { sendLinkToLead } from "../../lib/send-link-to-lead";
import {
  applyVariables,
  buildLeadVariables,
} from "../../lib/interpolate-message";
import { sendAppActionChannel } from "@/inngest/channels/send-app-action";

/**
 * SEND_NASA_ROUTE — envia link de curso NASA Route pro lead. Pra cursos
 * pagos, lead vê checkout Stripe ao abrir; pra cursos free, acesso
 * direto.
 *
 * Por simplicidade, sempre envia o link PÚBLICO do curso (`/cursos/<slug>`).
 * Lead clica → flow normal de matrícula/checkout. Pra atribuição,
 * `?ref=<leadId>` na URL.
 *
 * Ownership: curso precisa ter `creatorOrgId` = org do lead (org dona
 * do tracking enviando = org que criou o curso). Cursos de outras orgs
 * não podem ser usados como ação.
 */

export interface SendNasaRouteData {
  courseId: string;
  messageTemplate?: string;
}

const DEFAULT_TEMPLATE =
  "Olá {{nome}}, sua matrícula no curso {{curso_nome}} ({{curso_preco}}) — {{checkout_ou_acesso}}: {{url}}";

export const sendNasaRouteExecutor: NodeExecutor<SendNasaRouteData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  return await step.run("send-nasa-route", async () => {
    const leadCtx = context.lead as LeadContext;
    const realTime = context.realTime as boolean;

    const lead = await prisma.lead.findUnique({
      where: { id: leadCtx.id },
      include: {
        status: true,
        tracking: { select: { name: true, organizationId: true } },
        responsible: { select: { name: true } },
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

      // NOTA: usa só campos que `creatorListCourses` também usa, pra
      // garantir compatibilidade com DBs onde migrations de Stripe BRL
      // (`is_free`, `price_brl_cents`) ou archive (`is_archived`) não
      // foram aplicadas ainda.
      const course = await prisma.nasaRouteCourse.findFirst({
        where: {
          id: data.courseId,
          creatorOrgId: lead.tracking.organizationId,
          isPublished: true,
        },
        select: {
          id: true,
          slug: true,
          title: true,
          priceStars: true,
        },
      });
      if (!course) {
        throw new NonRetriableError(
          "Course not found, not published, or not owned by lead's organization",
        );
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      const url = `${baseUrl}/cursos/${course.slug}?ref=${lead.id}`;

      // Free: priceStars === 0 → "Acessar agora". Pago: mostra preço em
      // Stars (sistema atual de cobrança do NASA Route).
      const isFree = (course.priceStars ?? 0) === 0;
      const precoLabel = isFree ? "Grátis" : `${course.priceStars} ⭐`;
      const acessoLabel = isFree ? "Acessar agora" : "Pagar e acessar";

      const template = data.messageTemplate?.trim() || DEFAULT_TEMPLATE;
      const variables = {
        ...buildLeadVariables(lead),
        "{{url}}": url,
        "{{curso_nome}}": course.title,
        "{{curso_preco}}": precoLabel,
        "{{checkout_ou_acesso}}": acessoLabel,
      };
      const body = applyVariables(template, variables);

      await sendLinkToLead({
        leadId: lead.id,
        trackingId: lead.trackingId,
        body,
      });

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
