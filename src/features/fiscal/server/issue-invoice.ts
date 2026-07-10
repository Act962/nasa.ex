import "server-only";
import prisma from "@/lib/prisma";
import { NfeError } from "nfe-io";
import { describeNfeIoError } from "@/lib/nfe-io";
import { FocusNfeHttpError } from "@/http/focus-nfe/client";
import type { FiscalEnvironment, TomadorType } from "@/generated/prisma/enums";
import {
  resolveGateway,
  type FiscalIssueOverrides,
  type FiscalIssueSource,
} from "@/features/fiscal/lib/gateways";
import { Prisma } from "@/generated/prisma/client";

export class FiscalIssueValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FiscalIssueValidationError";
  }
}

export class FiscalIssueNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FiscalIssueNotFoundError";
  }
}

export type IssueInvoiceLink =
  | { contractId: string }
  | { paymentEntryId: string };

export type IssueInvoiceServiceInput = {
  organizationId: string;
  issuedById: string;
  source: FiscalIssueSource;
  link: IssueInvoiceLink;
  refPrefix: "forge" | "payment";
  refEntityId: string;
  tipoTomador: TomadorType;
  overrides: FiscalIssueOverrides;
  environment: FiscalEnvironment;
};

export type IssueInvoiceServiceResult = {
  invoiceId: string;
  status: string;
  ref: string;
};

function buildTomadorSnapshot(
  tipoTomador: TomadorType,
  overrides: FiscalIssueOverrides,
): Prisma.InputJsonValue {
  return tipoTomador === "PJ"
    ? {
        tipo: "PJ",
        cnpj: overrides.tomadorCnpj ?? null,
        razaoSocial: overrides.tomadorRazaoSocial ?? null,
      }
    : {
        tipo: "PF",
        cpf: overrides.tomadorCpf ?? null,
        nome: overrides.tomadorNome ?? null,
      };
}

export async function issueInvoiceFromSource(
  input: IssueInvoiceServiceInput,
): Promise<IssueInvoiceServiceResult> {
  const profile = await prisma.fiscalCompanyProfile.findUnique({
    where: { organizationId: input.organizationId },
  });
  if (!profile) {
    throw new FiscalIssueValidationError(
      "Perfil fiscal não configurado para esta organização",
    );
  }

  const activeInvoice = await prisma.fiscalInvoice.findFirst({
    where: {
      ...input.link,
      status: { in: ["PROCESSANDO", "AUTORIZADO"] },
    },
  });
  if (activeInvoice) {
    throw new FiscalIssueValidationError(
      "Já existe uma nota fiscal ativa para este vínculo",
    );
  }

  const gateway = resolveGateway(profile.fiscalGateway);

  const preflight = gateway.validateBeforeIssue({
    ref: "",
    source: input.source,
    profile,
    overrides: input.overrides,
    environment: input.environment,
  });
  if (!preflight.valid) {
    throw new FiscalIssueValidationError(preflight.errors.join("; "));
  }

  const invoiceCount = await prisma.fiscalInvoice.count({
    where: input.link,
  });
  let ref = `${input.refPrefix}-${input.refEntityId}-${invoiceCount + 1}`;

  let issueResult;
  try {
    issueResult = await gateway.issueInvoice({
      ref,
      source: input.source,
      profile,
      overrides: input.overrides,
      environment: input.environment,
    });
  } catch (err) {
    console.error("[fiscal/issue-invoice] erro ao emitir no gateway:", err);
    if (err instanceof FocusNfeHttpError) {
      throw new FiscalIssueValidationError(`Focus NFe: ${err.message}`);
    }
    if (err instanceof NfeError) {
      const nfeDetail = describeNfeIoError(err.details ?? err.raw);
      throw new FiscalIssueValidationError(
        `NFE.io: ${nfeDetail ?? err.message}`,
      );
    }
    throw err;
  }

  const isAuthorized = issueResult.status === "AUTORIZADO";
  const tomadorSnapshot = buildTomadorSnapshot(
    input.tipoTomador,
    input.overrides,
  );

  const createData = {
    organizationId: input.organizationId,
    profileId: profile.id,
    ...input.link,
    ref,
    type: issueResult.invoiceType,
    status: issueResult.status,
    environment: input.environment,
    gateway: gateway.id,
    externalId: issueResult.externalId,
    flowStatus: issueResult.rawStatus,
    valorServicos: input.source.amount,
    aliquotaIss: profile.defaultAliquotaIss,
    issRetido: profile.defaultIssRetido,
    dataCompetencia: input.overrides.dataCompetencia,
    requestPayload: issueResult.requestPayload as Prisma.InputJsonValue,
    focusResponse: issueResult.providerResponse as Prisma.InputJsonValue,
    tomadorSnapshot,
    tipoTomador: input.tipoTomador,
    issuedById: input.issuedById,
    ...(isAuthorized && {
      numero: issueResult.numero,
      codigoVerificacao: issueResult.codigoVerificacao,
      urlEspelho: issueResult.urlEspelho,
      urlDanfse: issueResult.urlDanfse,
      caminhoXmlFocus: issueResult.caminhoXml,
      authorizedAt: new Date(),
    }),
    errorMessage: issueResult.errorMessage,
  };

  let invoice;
  try {
    invoice = await prisma.fiscalInvoice.create({ data: createData });
  } catch (err) {
    // Colisão de `ref` (concorrência ou nota antiga excluída) — recontamos e
    // tentamos 1x com o próximo número antes de desistir.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const retryCount = await prisma.fiscalInvoice.count({
        where: input.link,
      });
      ref = `${input.refPrefix}-${input.refEntityId}-${retryCount + 1}`;
      invoice = await prisma.fiscalInvoice.create({
        data: { ...createData, ref },
      });
    } else {
      throw err;
    }
  }

  return { invoiceId: invoice.id, status: invoice.status, ref: invoice.ref };
}
