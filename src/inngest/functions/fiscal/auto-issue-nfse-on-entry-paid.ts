import { inngest } from "@/inngest/client";
import { NonRetriableError } from "inngest";
import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { consultarCnpj, CnpjWsError } from "@/http/cnpj-ws/client";
import type { FiscalIssueOverrides } from "@/features/fiscal/lib/gateways";
import {
  FiscalIssueValidationError,
  issueInvoiceFromSource,
} from "@/features/fiscal/server/issue-invoice";

type EventData = {
  entryId: string;
  organizationId: string;
  paidByUserId: string;
};

async function logAutoIssueFailure(
  data: EventData,
  reason: string,
  entryDescription: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: data.paidByUserId },
    select: { name: true, email: true, image: true },
  });
  await logActivity({
    organizationId: data.organizationId,
    userId: data.paidByUserId,
    userName: user?.name ?? "Sistema",
    userEmail: user?.email ?? "",
    userImage: user?.image,
    appSlug: "fiscal",
    subAppSlug: "fiscal-auto-issue",
    featureKey: "fiscal.auto-issue.failed",
    action: "fiscal.auto-issue.failed",
    actionLabel: `Emissão automática de NFS-e falhou para "${entryDescription}": ${reason}`,
    resource: entryDescription,
    resourceId: data.entryId,
    metadata: { reason },
  });
}

// Disparado por payPaymentEntry (payment/entry.paid) sempre que um lançamento
// RECEIVABLE é quitado — o skip pela flag do perfil acontece aqui, não no
// emissor do evento, pra manter payment agnóstico do fiscal.
export const fiscalAutoIssueNfseOnEntryPaid = inngest.createFunction(
  { id: "fiscal-auto-issue-nfse-on-entry-paid", retries: 3 },
  { event: "payment/entry.paid" },
  async ({ event, step }) => {
    const data = event.data as EventData;

    const profile = await step.run("load-profile", () =>
      prisma.fiscalCompanyProfile.findUnique({
        where: { organizationId: data.organizationId },
      }),
    );
    if (!profile?.autoIssueOnEntryPaid) return { skipped: "auto-issue-disabled" };

    const entry = await step.run("load-entry", () =>
      prisma.paymentEntry.findUnique({
        where: { id: data.entryId },
        include: { contact: true },
      }),
    );
    if (!entry || entry.type !== "RECEIVABLE" || entry.status !== "PAID") {
      return { skipped: "entry-not-eligible" };
    }

    const activeInvoice = await step.run("check-active-invoice", () =>
      prisma.fiscalInvoice.findFirst({
        where: {
          paymentEntryId: entry.id,
          status: { in: ["PROCESSANDO", "AUTORIZADO"] },
        },
      }),
    );
    if (activeInvoice) return { skipped: "invoice-already-active" };

    const documentDigits = (entry.contact?.document ?? "").replace(/\D/g, "");
    if (!documentDigits) {
      await step.run("log-skip-no-document", () =>
        logAutoIssueFailure(
          data,
          "Contato do lançamento sem CPF/CNPJ cadastrado",
          entry.description,
        ),
      );
      return { skipped: "contact-without-document" };
    }
    const tipoTomador: "PF" | "PJ" =
      documentDigits.length === 11 ? "PF" : "PJ";

    // step.run serializa o retorno como JSON entre steps (Date vira string) —
    // reconstrói explicitamente antes de usar como Date.
    const dataCompetencia = entry.paidAt ? new Date(entry.paidAt) : new Date();

    let overrides: FiscalIssueOverrides = {
      tipoTomador,
      dataCompetencia,
      tomadorCnpj: tipoTomador === "PJ" ? documentDigits : undefined,
      tomadorCpf: tipoTomador === "PF" ? documentDigits : undefined,
      tomadorRazaoSocial: tipoTomador === "PJ" ? entry.contact?.name : undefined,
      tomadorNome: tipoTomador === "PF" ? entry.contact?.name : undefined,
      tomadorEmail: entry.contact?.email ?? undefined,
    };

    if (tipoTomador === "PJ") {
      try {
        const cnpjData = await step.run("hydrate-cnpj-address", () =>
          consultarCnpj(documentDigits),
        );
        const estabelecimento = cnpjData.estabelecimento;
        const ibgeId = estabelecimento.cidade?.ibge_id;
        overrides = {
          ...overrides,
          tomadorRazaoSocial: cnpjData.razao_social || overrides.tomadorRazaoSocial,
          tomadorLogradouro: estabelecimento.logradouro ?? undefined,
          tomadorNumero: estabelecimento.numero ?? undefined,
          tomadorComplemento: estabelecimento.complemento ?? undefined,
          tomadorBairro: estabelecimento.bairro ?? undefined,
          tomadorCep: estabelecimento.cep?.replace(/\D/g, "") ?? undefined,
          tomadorUf: estabelecimento.estado?.sigla ?? undefined,
          tomadorCodigoMunicipio: ibgeId
            ? String(ibgeId).padStart(7, "0")
            : undefined,
          tomadorMunicipio: estabelecimento.cidade?.nome ?? undefined,
        };
      } catch (err) {
        // 404/429/erro de rede no CNPJ.ws: segue sem endereço — o preflight do
        // gateway decide se é exigível pro município do prestador.
        if (!(err instanceof CnpjWsError)) throw err;
      }
    }

    try {
      const result = await step.run("issue-invoice", () =>
        issueInvoiceFromSource({
          organizationId: data.organizationId,
          issuedById: data.paidByUserId,
          source: {
            amount: entry.amount / 100,
            defaultDescription:
              entry.description ||
              `Referente ao lançamento ${entry.documentNumber ?? entry.id}`,
          },
          link: { paymentEntryId: entry.id },
          refPrefix: "payment",
          refEntityId: entry.id,
          tipoTomador,
          overrides,
          environment: profile.environment,
        }),
      );
      return result;
    } catch (err) {
      if (err instanceof FiscalIssueValidationError) {
        await step.run("log-skip-validation", () =>
          logAutoIssueFailure(data, err.message, entry.description),
        );
        throw new NonRetriableError(err.message);
      }
      throw err;
    }
  },
);
