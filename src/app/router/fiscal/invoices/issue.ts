import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { FocusNfeHttpError } from "@/http/focus-nfe/client";
import type { FiscalEnvironment } from "@/generated/prisma/enums";
import { resolveNfseProvider } from "@/features/fiscal/lib/providers/resolve-nfse-provider";
import {
  resolveCompanyToken,
  focusStatusToDb,
  formatFocusErrorMessage,
} from "./utils";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "America/Sao_Paulo";

export const issueFiscalInvoice = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Issue NFS-e from contract",
    tags: ["Fiscal"],
  })
  .input(
    z.object({
      contractId: z.string(),
      tipoTomador: z.enum(["PF", "PJ"]),
      dataCompetencia: z.string(),
      tomadorCnpj: z.string().optional(),
      tomadorCpf: z.string().optional(),
      tomadorRazaoSocial: z.string().optional(),
      tomadorNome: z.string().optional(),
      tomadorEmail: z.string().optional(),
      tomadorLogradouro: z.string().optional(),
      tomadorNumero: z.string().optional(),
      tomadorComplemento: z.string().optional(),
      tomadorBairro: z.string().optional(),
      tomadorCodigoMunicipio: z.string().optional(),
      tomadorUf: z.string().optional(),
      tomadorCep: z.string().optional(),
      discriminacao: z.string().optional(),
      naturezaOperacao: z.string().optional(),
      // enum da doc: 0=Nenhum,1,2,3,4,5,6,9.
      regimeEspecialTributacao: z.number().int().min(0).max(9).optional(),
      ibsCbsSituacaoTributaria: z.string().optional(),
      ibsCbsClassificacaoTributaria: z.string().optional(),
      consumidorFinal: z.boolean().optional(),
      environment: z.enum(["HOMOLOGACAO", "PRODUCAO"]).default("HOMOLOGACAO"),
    }),
  )
  .output(
    z.object({ invoiceId: z.string(), status: z.string(), ref: z.string() }),
  )
  .handler(async ({ input, context, errors }) => {
    let contract;
    try {
      contract = await prisma.forgeContract.findUnique({
        where: { id: input.contractId, organizationId: context.org.id },
      });
    } catch (err) {
      console.error("[fiscal/invoices/issue] erro ao buscar contrato:", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
    if (!contract)
      throw errors.NOT_FOUND({ message: "Contrato não encontrado" });

    let profile;
    try {
      profile = await prisma.fiscalCompanyProfile.findUnique({
        where: { organizationId: context.org.id },
      });
    } catch (err) {
      console.error(
        "[fiscal/invoices/issue] erro ao buscar perfil fiscal:",
        err,
      );
      throw errors.INTERNAL_SERVER_ERROR;
    }
    if (!profile)
      throw errors.BAD_REQUEST({
        message: "Perfil fiscal não configurado para esta organização",
      });

    let activeInvoice;
    try {
      activeInvoice = await prisma.fiscalInvoice.findFirst({
        where: {
          contractId: input.contractId,
          status: { in: ["PROCESSANDO", "AUTORIZADO"] },
        },
      });
    } catch (err) {
      console.error(
        "[fiscal/invoices/issue] erro ao verificar nota ativa:",
        err,
      );
      throw errors.INTERNAL_SERVER_ERROR;
    }
    if (activeInvoice) {
      throw errors.BAD_REQUEST({
        message: "Já existe uma nota fiscal ativa para este contrato",
      });
    }

    const overrides = {
      tipoTomador: input.tipoTomador as "PF" | "PJ",
      // Data enviada pelo dialog é "YYYY-MM-DD"; ancoramos explicitamente em
      // horário de Brasília em vez de deixar o parser nativo assumir meia-noite
      // UTC, que equivale a 21h do dia anterior em Brasília (data errada ao formatar).
      dataCompetencia: dayjs
        .tz(input.dataCompetencia, TIMEZONE)
        .startOf("day")
        .toDate(),
      discriminacao: input.discriminacao,
      tomadorCnpj: input.tomadorCnpj,
      tomadorCpf: input.tomadorCpf,
      tomadorRazaoSocial: input.tomadorRazaoSocial,
      tomadorNome: input.tomadorNome,
      tomadorEmail: input.tomadorEmail,
      tomadorLogradouro: input.tomadorLogradouro,
      tomadorNumero: input.tomadorNumero,
      tomadorComplemento: input.tomadorComplemento,
      tomadorBairro: input.tomadorBairro,
      tomadorCodigoMunicipio: input.tomadorCodigoMunicipio,
      tomadorUf: input.tomadorUf,
      tomadorCep: input.tomadorCep,
      naturezaOperacao: input.naturezaOperacao,
      regimeEspecialTributacao: input.regimeEspecialTributacao,
      ibsCbsSituacaoTributaria: input.ibsCbsSituacaoTributaria,
      ibsCbsClassificacaoTributaria: input.ibsCbsClassificacaoTributaria,
      consumidorFinal: input.consumidorFinal,
    };

    const provider = resolveNfseProvider(profile.nfseStandard);
    const fiscalEnvironment = input.environment as FiscalEnvironment;

    const preflight = provider.validate(
      contract,
      profile,
      overrides,
      fiscalEnvironment,
    );
    if (!preflight.valid) {
      throw errors.BAD_REQUEST({ message: preflight.errors.join("; ") });
    }

    let invoiceCount;
    try {
      invoiceCount = await prisma.fiscalInvoice.count({
        where: { contractId: contract.id },
      });
    } catch (err) {
      console.error(
        "[fiscal/invoices/issue] erro ao contar notas do contrato:",
        err,
      );
      throw errors.INTERNAL_SERVER_ERROR;
    }
    const ref = `forge-${contract.id}-${invoiceCount + 1}`;

    console.log(
      "[fiscal/issue] ambiente Focus NFe:",
      fiscalEnvironment,
      "padrão:",
      provider.standard,
    );

    let companyToken;
    try {
      companyToken = resolveCompanyToken(profile, fiscalEnvironment);
    } catch (err) {
      console.error(
        "[fiscal/invoices/issue] erro ao resolver token Focus NFe:",
        err,
      );
      throw errors.BAD_REQUEST({
        message:
          err instanceof Error
            ? err.message
            : "Token Focus NFe não configurado",
      });
    }

    let focusResponse;
    let payload: unknown;
    try {
      ({ response: focusResponse, payload } = await provider.emitir({
        ref,
        contract,
        profile,
        overrides,
        environment: fiscalEnvironment,
        companyToken,
      }));
    } catch (err) {
      console.error(
        "[fiscal/invoices/issue] erro ao chamar Focus NFe (emitir):",
        err,
      );
      if (err instanceof FocusNfeHttpError) {
        throw errors.BAD_REQUEST({ message: `Focus NFe: ${err.message}` });
      }
      throw errors.INTERNAL_SERVER_ERROR;
    }

    const dbStatus = focusStatusToDb(focusResponse.status);
    const isAuthorized = dbStatus === "AUTORIZADO";

    const tomadorSnapshot =
      input.tipoTomador === "PJ"
        ? {
            tipo: "PJ",
            cnpj: input.tomadorCnpj,
            razaoSocial: input.tomadorRazaoSocial,
          }
        : { tipo: "PF", cpf: input.tomadorCpf, nome: input.tomadorNome };

    let invoice;
    try {
      invoice = await prisma.fiscalInvoice.create({
        data: {
          organizationId: context.org.id,
          profileId: profile.id,
          contractId: contract.id,
          ref,
          type: provider.invoiceType,
          status: dbStatus,
          environment: fiscalEnvironment,
          valorServicos: contract.value,
          aliquotaIss: profile.defaultAliquotaIss,
          issRetido: profile.defaultIssRetido,
          dataCompetencia: overrides.dataCompetencia,
          requestPayload: payload as never,
          focusResponse: focusResponse as never,
          tomadorSnapshot: tomadorSnapshot as never,
          tipoTomador: input.tipoTomador as "PF" | "PJ",
          issuedById: context.user.id,
          ...(isAuthorized && {
            numero: focusResponse.numero,
            codigoVerificacao: focusResponse.codigo_verificacao,
            urlEspelho: focusResponse.url,
            urlDanfse: focusResponse.url_danfse,
            caminhoXmlFocus: focusResponse.caminho_xml_nota_fiscal,
            authorizedAt: new Date(),
          }),
          errorMessage:
            dbStatus === "ERRO"
              ? (formatFocusErrorMessage(focusResponse) ?? "Erro desconhecido")
              : null,
        },
      });
    } catch (err) {
      console.error(
        "[fiscal/invoices/issue] erro ao salvar nota fiscal no banco:",
        err,
      );
      throw errors.INTERNAL_SERVER_ERROR;
    }

    return { invoiceId: invoice.id, status: invoice.status, ref: invoice.ref };
  });
