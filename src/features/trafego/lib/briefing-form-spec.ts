/**
 * Formulário "Briefing TrafeGO" — blocos com ids ESTÁVEIS, para que a resposta
 * gerada pelo sistema case com o formulário provisionado pelo admin.
 *
 * Nenhum bloco é `required` de propósito: o ícone do card fica vermelho
 * ("aguardando") quando uma resposta tem campo obrigatório vazio por mais de
 * 24 h — e o wizard deixa vários campos opcionais.
 */

import type { FormBlockInstance } from "@/features/form/types";
import { CAMPAIGN_TYPE_LABEL, OBJECTIVE_LABEL, PLATFORM_LABEL } from "./catalog-labels";
import { formatBrlFromCents } from "./pricing";
import type {
  TrafegoCampaignType,
  TrafegoObjective,
  TrafegoPlatform,
} from "@/generated/prisma/enums";

export const BRIEFING_FORM_NAME = "Briefing TrafeGO";

export const BRIEFING_BLOCK_IDS = {
  orderCode: "tg-order-code",
  businessName: "tg-business-name",
  niche: "tg-niche",
  channel: "tg-channel",
  objective: "tg-objective",
  audience: "tg-audience",
  destination: "tg-destination",
  whatsapp: "tg-whatsapp",
  investment: "tg-investment",
  businessManager: "tg-business-manager",
  social: "tg-social",
  officialNumber: "tg-official-number",
  phoneVerified: "tg-phone-verified",
  start: "tg-start",
  notes: "tg-notes",
} as const;

interface FieldSpec {
  id: string;
  label: string;
  helperText?: string;
  kind: "TextField" | "TextArea";
  useAsResponseLabel?: boolean;
}

const FIELDS: FieldSpec[] = [
  { id: BRIEFING_BLOCK_IDS.orderCode, label: "Pedido", kind: "TextField", useAsResponseLabel: true, helperText: "Código do pedido trafeGO (preenchido pelo sistema)." },
  { id: BRIEFING_BLOCK_IDS.businessName, label: "Nome do negócio", kind: "TextField" },
  { id: BRIEFING_BLOCK_IDS.niche, label: "Ramo de atuação", kind: "TextField" },
  { id: BRIEFING_BLOCK_IDS.channel, label: "Canal e tipo de campanha", kind: "TextField" },
  { id: BRIEFING_BLOCK_IDS.objective, label: "Objetivo", kind: "TextField" },
  { id: BRIEFING_BLOCK_IDS.audience, label: "Público que quer alcançar", kind: "TextArea" },
  { id: BRIEFING_BLOCK_IDS.destination, label: "Para onde direcionar o cliente", kind: "TextField" },
  { id: BRIEFING_BLOCK_IDS.whatsapp, label: "WhatsApp que recebe os contatos", kind: "TextField" },
  { id: BRIEFING_BLOCK_IDS.investment, label: "Investimento", kind: "TextField", helperText: "Verba + serviço + setup." },
  { id: BRIEFING_BLOCK_IDS.businessManager, label: "Já tem conta de anúncios (BM)?", kind: "TextField" },
  { id: BRIEFING_BLOCK_IDS.social, label: "Instagram / Facebook", kind: "TextField", helperText: "Conta informada no wizard e o que a Graph API encontrou." },
  { id: BRIEFING_BLOCK_IDS.officialNumber, label: "Número na API Oficial", kind: "TextField" },
  { id: BRIEFING_BLOCK_IDS.phoneVerified, label: "WhatsApp de contato verificado?", kind: "TextField" },
  { id: BRIEFING_BLOCK_IDS.start, label: "Prazo", kind: "TextField", helperText: "Data desejada × data realista aceita no wizard." },
  { id: BRIEFING_BLOCK_IDS.notes, label: "Observações do cliente", kind: "TextArea" },
];

/** Estrutura do formulário (o `jsonBlock` do builder). */
export function buildBriefingFormBlocks(): FormBlockInstance[] {
  const heading: FormBlockInstance = {
    id: "tg-heading",
    blockType: "RowLayout",
    attributes: {},
    isLocked: true,
    childblocks: [
      {
        id: "tg-heading-title",
        blockType: "Heading",
        attributes: {
          label: BRIEFING_FORM_NAME,
          level: 1,
          fontSize: "4x-large",
          fontWeight: "normal",
        },
      },
      {
        id: "tg-heading-text",
        blockType: "Paragraph",
        attributes: {
          label: "Paragraph",
          text: "Respostas do cliente no site do trafeGO. Preenchido automaticamente ao contratar.",
          fontSize: "small",
          fontWeight: "normal",
        },
      },
    ],
  };

  const rows: FormBlockInstance[] = FIELDS.map((field) => ({
    id: `${field.id}-row`,
    blockType: "RowLayout",
    attributes: {},
    childblocks: [
      {
        id: field.id,
        blockType: field.kind,
        attributes: {
          label: field.label,
          helperText: field.helperText ?? "",
          required: false,
          placeHolder: "",
          ...(field.kind === "TextArea" ? { rows: 3 } : {}),
          ...(field.useAsResponseLabel ? { useAsResponseLabel: true } : {}),
        },
      },
    ],
  }));

  return [heading, ...rows];
}

export interface BriefingAnswerSource {
  orderCode?: string | null;
  businessName?: string | null;
  businessNiche?: string | null;
  platform: TrafegoPlatform;
  campaignType: TrafegoCampaignType;
  objective: TrafegoObjective;
  targetAudience?: string | null;
  destinationUrl?: string | null;
  whatsappNumber?: string | null;
  adBudgetBrlCents: number;
  serviceFeeBrlCents: number;
  setupFeeBrlCents: number;
  totalBrlCents: number;
  hasBusinessManager?: boolean | null;
  phoneVerifiedAt?: Date | string | null;
  socialHandle?: string | null;
  socialProfile?: unknown;
  hasOfficialNumber?: boolean | null;
  officialNumber?: string | null;
  officialNumberCheck?: unknown;
  desiredStartAt?: Date | string | null;
  earliestStartAt?: Date | string | null;
  notes?: string | null;
  contact: { name?: string | null; email?: string | null; phone?: string | null };
}

const formatDate = (value: Date | string | null | undefined) =>
  value ? new Date(value).toLocaleDateString("pt-BR") : null;

/** Monta o objeto que vai em `FormResponses.jsonResponse` (como string JSON). */
export function buildBriefingAnswers(source: BriefingAnswerSource): Record<string, unknown> {
  const businessManager =
    source.hasBusinessManager === true
      ? "Sim, já tem"
      : source.hasBusinessManager === false
        ? "Não tem — setup contratado"
        : "Não soube dizer — setup contratado";

  const investment = `${formatBrlFromCents(source.adBudgetBrlCents)} de verba + ${formatBrlFromCents(source.serviceFeeBrlCents)} de serviço${
    source.setupFeeBrlCents > 0 ? ` + ${formatBrlFromCents(source.setupFeeBrlCents)} de setup` : ""
  } = ${formatBrlFromCents(source.totalBrlCents)}`;

  const desired = formatDate(source.desiredStartAt);
  const earliest = formatDate(source.earliestStartAt);
  const start = desired
    ? `Quer começar em ${desired}${earliest ? ` · data realista aceita: ${earliest}` : ""}`
    : earliest
      ? `Data realista aceita: ${earliest}`
      : "";

  const labelValue = source.orderCode
    ? `${source.orderCode}${source.businessName ? ` · ${source.businessName}` : ""}`
    : source.businessName ?? "Aguardando pagamento";

  const entry = (value: string | null | undefined) => ({ value: value ?? "" });

  const profile = source.socialProfile as { found?: boolean; name?: string | null; followers?: number | null } | null | undefined;
  const social = source.socialHandle
    ? `${source.socialHandle}${profile?.found ? ` · encontrada: ${profile.name ?? ""}${profile.followers != null ? ` (${profile.followers} seguidores)` : ""}` : profile ? " · não encontrada na verificação" : ""}`
    : null;
  const check = source.officialNumberCheck as { status?: string; verifiedName?: string | null } | null | undefined;
  const officialNumber =
    source.hasOfficialNumber === true
      ? `${source.officialNumber ?? "Sim"}${check?.status === "found" ? ` · ativo no WhatsApp${check.verifiedName ? ` (${check.verifiedName})` : ""}` : check?.status === "not_found" ? " · NÃO encontrado no WhatsApp" : ""}`
      : source.hasOfficialNumber === false
        ? "Não tem — número novo incluído no setup"
        : source.platform === "WHATSAPP_OFICIAL"
          ? "Não soube dizer — setup contratado"
          : null;

  return {
    user_name: source.contact.name ?? source.businessName ?? "",
    user_email: source.contact.email ?? "",
    user_phone: source.contact.phone ?? "",
    [BRIEFING_BLOCK_IDS.orderCode]: entry(labelValue),
    [BRIEFING_BLOCK_IDS.businessName]: entry(source.businessName),
    [BRIEFING_BLOCK_IDS.niche]: entry(source.businessNiche),
    [BRIEFING_BLOCK_IDS.channel]: entry(
      `${PLATFORM_LABEL[source.platform]} · ${CAMPAIGN_TYPE_LABEL[source.campaignType]}`,
    ),
    [BRIEFING_BLOCK_IDS.objective]: entry(OBJECTIVE_LABEL[source.objective]),
    [BRIEFING_BLOCK_IDS.audience]: entry(source.targetAudience),
    [BRIEFING_BLOCK_IDS.destination]: entry(source.destinationUrl),
    [BRIEFING_BLOCK_IDS.whatsapp]: entry(source.whatsappNumber),
    [BRIEFING_BLOCK_IDS.investment]: entry(investment),
    [BRIEFING_BLOCK_IDS.businessManager]: entry(businessManager),
    [BRIEFING_BLOCK_IDS.social]: entry(social),
    [BRIEFING_BLOCK_IDS.officialNumber]: entry(officialNumber),
    [BRIEFING_BLOCK_IDS.phoneVerified]: entry(source.phoneVerifiedAt ? `Sim, em ${formatDate(source.phoneVerifiedAt)}` : "Não"),
    [BRIEFING_BLOCK_IDS.start]: entry(start),
    [BRIEFING_BLOCK_IDS.notes]: entry(source.notes),
  };
}

export function briefingResponseLabel(source: {
  orderCode?: string | null;
  businessName?: string | null;
}): string {
  if (source.orderCode) {
    return `${source.orderCode}${source.businessName ? ` · ${source.businessName}` : ""}`.slice(0, 80);
  }
  return (source.businessName ?? "Briefing trafeGO").slice(0, 80);
}
