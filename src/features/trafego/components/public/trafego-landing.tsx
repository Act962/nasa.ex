"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  Eye,
  Heart,
  Megaphone,
  MessagesSquare,
  Pencil,
  Repeat,
  Search,
  Send,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Target,
  ThumbsUp,
  UserPlus,
  Users,
} from "lucide-react";
import type {
  TrafegoCampaignType,
  TrafegoObjective,
  TrafegoPlatform,
} from "@/generated/prisma/enums";
import {
  useCaptureTrafegoLead,
  useStartTrafegoCheckout,
  type TrafegoPixCharge,
} from "@/features/trafego/hooks/use-trafego-purchase";
import { useTrafegoPublicConfig } from "@/features/trafego/hooks/use-trafego-plans";
import {
  CAMPAIGN_TYPES_BY_PLATFORM,
  CAMPAIGN_TYPE_DESCRIPTION,
  CAMPAIGN_TYPE_LABEL,
  CAMPAIGN_TYPE_SHORT_LABEL,
  OBJECTIVES_BY_PLATFORM,
  OBJECTIVE_DESCRIPTION,
  OBJECTIVE_LABEL,
  PLATFORM_SHORT_LABEL,
} from "@/features/trafego/lib/catalog-labels";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import {
  quoteTrafego,
  resolveTrafegoSetupBrlCents,
} from "@/features/trafego/lib/pricing-tiers";
import { summarizeAudience } from "@/features/trafego/lib/audience";
import { prescreenAdContent } from "@/features/trafego/lib/ad-policies";
import {
  estimateEarliestStart,
  formatStartDate,
  isDesiredStartTooSoon,
} from "@/features/trafego/lib/timeline";
import type {
  SocialNetwork,
  TrafegoSocialProfile,
} from "@/features/trafego/lib/social-profile";
import {
  BusinessManagerStep,
  type BusinessManagerAnswer,
} from "./business-manager-step";
import {
  InvestmentSimulator,
  TalkToManagerButton,
} from "./investment-simulator";
import { BrandsMarquee } from "./brands-marquee";
import { ChoiceCardGrid, type ChoiceCardOption } from "./choice-card-grid";
import { SocialBackdrop } from "./social-backdrop";
import { Testimonials } from "./social-proof";
import { TrafegoFooter } from "./trafego-footer";
import { LandingNav } from "./landing-nav";
import { Hero } from "./hero";
import { WizardStepper } from "./wizard/wizard-stepper";
import { StepShell } from "./wizard/step-shell";
import { ChannelStep } from "./wizard/channel-step";
import { MetaAccountStep } from "./wizard/meta-account-step";
import {
  WhatsappAcquireStep,
  WhatsappNumberStep,
  type OfficialNumberAnswer,
} from "./wizard/whatsapp-number-step";
import {
  WhatsappVerifyStep,
  type WhatsappNumberCheckResult,
} from "./wizard/whatsapp-verify-step";
import { BusinessStep, type BusinessDraft } from "./wizard/business-step";
import { TimingStep, type TimingDraft } from "./wizard/timing-step";
import { ContactStep, type ContactDraft } from "./wizard/contact-step";
import { OrderSummary } from "./wizard/order-summary";
import type { PhoneVerificationStatus } from "./wizard/phone-verification";
import {
  PaymentMethodStep,
  type TrafegoPaymentMethod,
} from "./wizard/payment-method-step";
import { PixInstructions } from "./wizard/pix-instructions";
import { PayerDocumentStep } from "./wizard/payer-document-step";
import { isValidBrazilianDocument } from "@/features/payment/lib/documents/normalize-document";
import { ComplianceAlert } from "./wizard/compliance-alert";
import { TrafegoAssistant } from "./assistant/trafego-assistant";
import { TechnicalTerm } from "../technical-term";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { CreativeStep } from "./wizard/creative-step";
import type { TrafegoCreativeDraft } from "@/features/trafego/lib/creative-review/schema";
import {
  guidanceAudienceChips,
  suggestBudget,
  type CreativeGuidance,
} from "@/features/trafego/lib/creative-review/guidance";
import {
  checkWizardGuardrails,
  type GuardrailField,
} from "@/features/trafego/lib/wizard-guardrails";
import { useTrafegoWizardAccountSummary } from "@/features/trafego/hooks/use-trafego-creative-review";
import { useWizardAstroSuggestions } from "@/features/trafego/hooks/use-wizard-astro-suggestions";
import { AstroSuggestionNote } from "./wizard/astro-suggestion-note";
import { GuardrailNotes } from "./wizard/guardrail-notes";
import { OpenWarningsSummary } from "./wizard/open-warnings-summary";
import { AccountPhoneField } from "./wizard/account-phone-field";

const STEPS = [
  { key: "channel", label: "Canal" },
  { key: "type", label: "Campanha" },
  { key: "objective", label: "Objetivo" },
  { key: "business", label: "Negócio" },
  { key: "contact", label: "Contato" },
  { key: "investment", label: "Investimento" },
] as const;

/**
 * Telas do wizard. As verificações de canal são sub-telas do passo 1 — assim a
 * trilha continua com seis marcos, sem inflar conforme o canal escolhido.
 */
type ScreenId =
  | "channel"
  | "meta-account"
  | "ad-account"
  | "wa-has-number"
  | "wa-verify"
  | "wa-acquire"
  | "type"
  | "objective"
  | "business"
  | "timing"
  | "creative"
  | "contact"
  | "investment";

const SCREEN_STEP: Record<ScreenId, number> = {
  channel: 0,
  "meta-account": 0,
  "ad-account": 0,
  "wa-has-number": 0,
  "wa-verify": 0,
  "wa-acquire": 0,
  type: 1,
  objective: 2,
  business: 3,
  // "Prazo" é sub-tela de "Negócio": a trilha continua com seis marcos.
  timing: 3,
  // Spec 0126: o criativo também é sub-tela de "Negócio".
  creative: 3,
  contact: 4,
  investment: 5,
};

const CAMPAIGN_TYPE_ICON: Record<TrafegoCampaignType, typeof Megaphone> = {
  PROSPECCAO: UserPlus,
  REMARKETING: Repeat,
  VENDA_DIRETA: ShoppingCart,
  RECONHECIMENTO: Eye,
  RELACIONAMENTO: Heart,
};

const OBJECTIVE_ICON: Record<TrafegoObjective, typeof Megaphone> = {
  LEADS: UserPlus,
  TRAFFIC: Users,
  SALES: ShoppingCart,
  AWARENESS: Eye,
  ENGAGEMENT: ThumbsUp,
  MESSAGES: MessagesSquare,
  BROADCAST: Send,
  SEARCH: Search,
};

const DEFAULT_BUDGET_BRL_CENTS = 200_000;

const EMPTY_BUSINESS: BusinessDraft = {
  businessName: "",
  segment: "",
  destinationUrl: "",
  audienceChips: [],
  audienceNotes: "",
  specialCategory: "none",
};

const EMPTY_TIMING: TimingDraft = {
  desiredStartAt: "",
  hasSocialLinked: null,
  materialsReady: null,
  acknowledged: false,
};

const EMPTY_CONTACT: ContactDraft = {
  fullName: "",
  email: "",
  phone: "",
  referralSource: "",
};

export interface ReturningCustomerDefaults {
  organizationId: string;
  organizationName: string;
  /** null = a org ainda não teve pedido: contrata dentro dela pela primeira vez (spec 0123, RF-9). */
  sourceOrderCode: string | null;
  platform: TrafegoPlatform | null;
  campaignType: TrafegoCampaignType | null;
  objective: TrafegoObjective | null;
  /** A org tem a Meta conectada e testada nos Satélites (spec 0123, RF-10). */
  isMetaConnected: boolean;
  /** A empresa já pagou o setup em outro pedido (spec 0126, RF-8). */
  hasPaidSetup: boolean;
  socialHandle: string;
  hasBusinessManager: BusinessManagerAnswer;
  officialAnswer: OfficialNumberAnswer | null;
  officialNumber: string;
  business: Pick<
    BusinessDraft,
    "businessName" | "segment" | "destinationUrl" | "audienceNotes"
  >;
  timing: Pick<TimingDraft, "hasSocialLinked" | "materialsReady">;
  contact: ContactDraft;
  phoneVerified: boolean;
}

interface TrafegoLandingProps {
  wasCancelled: boolean;
  repeatDefaults?: ReturningCustomerDefaults | null;
}

export function TrafegoLanding({
  wasCancelled,
  repeatDefaults,
}: TrafegoLandingProps) {
  const wizardRef = useRef<HTMLDivElement>(null);

  // O wizard só entra em cena quando o cliente pede. Antes disso a página é
  // só a promessa — quem chega pelo anúncio decide se quer começar.
  // Volta aberto quando o Stripe devolve com `?cancelado=1`: a pessoa já
  // estava no meio do caminho.
  const [hasStarted, setHasStarted] = useState(
    wasCancelled || Boolean(repeatDefaults),
  );
  // Spec 0129: com a Meta conectada, tudo começa pelo criativo.
  const [screenId, setScreenId] = useState<ScreenId>(
    repeatDefaults?.platform === "META_ADS" && repeatDefaults.isMetaConnected
      ? "creative"
      : repeatDefaults?.platform
        ? "business"
        : "channel",
  );
  const [platform, setPlatform] = useState<TrafegoPlatform | null>(
    repeatDefaults?.platform ?? null,
  );
  const [campaignType, setCampaignType] = useState<TrafegoCampaignType | null>(
    repeatDefaults?.campaignType ?? null,
  );
  const [objective, setObjective] = useState<TrafegoObjective | null>(
    repeatDefaults?.objective ?? null,
  );

  const [socialNetwork, setSocialNetwork] =
    useState<SocialNetwork>("instagram");
  const [socialHandle, setSocialHandle] = useState(
    repeatDefaults?.socialHandle ?? "",
  );
  const [socialProfile, setSocialProfile] =
    useState<TrafegoSocialProfile | null>(null);

  const [hasBusinessManager, setHasBusinessManager] =
    useState<BusinessManagerAnswer | null>(
      repeatDefaults?.hasBusinessManager ?? null,
    );
  const [officialAnswer, setOfficialAnswer] =
    useState<OfficialNumberAnswer | null>(
      repeatDefaults?.officialAnswer ?? null,
    );
  const [officialNumber, setOfficialNumber] = useState(
    repeatDefaults?.officialNumber ?? "",
  );
  const [officialCheck, setOfficialCheck] =
    useState<WhatsappNumberCheckResult | null>(null);
  const [acquireConfirmed, setAcquireConfirmed] = useState(false);

  const savedBusiness = repeatDefaults
    ? {
        ...EMPTY_BUSINESS,
        ...repeatDefaults.business,
      }
    : EMPTY_BUSINESS;
  const [business, setBusiness] = useState<BusinessDraft>(savedBusiness);
  const [useSavedCompany, setUseSavedCompany] = useState(
    Boolean(repeatDefaults),
  );
  const [timing, setTiming] = useState<TimingDraft>({
    ...EMPTY_TIMING,
    ...repeatDefaults?.timing,
  });
  const [adBudgetBrlCents, setAdBudgetBrlCents] = useState(
    DEFAULT_BUDGET_BRL_CENTS,
  );
  const [contact, setContact] = useState<ContactDraft>(
    repeatDefaults?.contact ?? EMPTY_CONTACT,
  );
  // Com a Meta conectada e o contato da conta completo, o passo Contato não pergunta nada novo.
  // Logado, nome e e-mail vêm da conta: o passo Contato some e, se faltar telefone, só ele é pedido no Investimento.
  const shouldSkipContact = Boolean(
    repeatDefaults &&
    repeatDefaults.contact.fullName.trim().length > 2 &&
    /\S+@\S+\.\S+/.test(repeatDefaults.contact.email),
  );
  const isMissingAccountPhone =
    shouldSkipContact &&
    (repeatDefaults?.contact.phone.replace(/\D/g, "").length ?? 0) < 10;
  const [phoneVerification, setPhoneVerification] =
    useState<PhoneVerificationStatus>(
      repeatDefaults?.phoneVerified ? "verified" : "idle",
    );
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [paymentMethod, setPaymentMethod] =
    useState<TrafegoPaymentMethod>("CARD");
  const [complianceAcknowledged, setComplianceAcknowledged] = useState(false);
  /** CPF/CNPJ do pagador — só a trilha PIX pede (spec 0022 D-1). */
  const [payerDocument, setPayerDocument] = useState("");
  /** Cobrança PIX gerada: enquanto existir, a tela do PIX substitui o wizard. */
  const [pixCharge, setPixCharge] = useState<{
    pendingId: string;
    charge: TrafegoPixCharge;
  } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [creativeDraft, setCreativeDraft] =
    useState<TrafegoCreativeDraft | null>(null);
  const isCreativeFirst =
    platform === "META_ADS" && Boolean(repeatDefaults?.isMetaConnected);
  // Criativo e texto mandados no passo Criativo: o Prazo não pergunta de novo se os materiais estão prontos.
  const hasSentMaterials = Boolean(
    (creativeDraft?.fileKey || creativeDraft?.postLink) &&
    creativeDraft?.message?.trim(),
  );
  const materialsReady = hasSentMaterials ? true : timing.materialsReady;
  const astroSuggestions = useWizardAstroSuggestions();
  const { data: accountSummary } = useTrafegoWizardAccountSummary({
    enabled: isCreativeFirst,
  });

  const { data: config } = useTrafegoPublicConfig();
  const startCheckout = useStartTrafegoCheckout();
  const captureLead = useCaptureTrafegoLead();
  /** Uma captura por sessão do wizard: ir e voltar no passo não repete a chamada. */
  const hasCapturedRef = useRef(false);

  const isWhatsappChannel = platform === "WHATSAPP_OFICIAL";
  // No WhatsApp o setup é o número na API; nos demais, a configuração inicial
  // feita pela equipe, uma vez por empresa (spec 0126).
  const setupBrlCents = resolveTrafegoSetupBrlCents({
    adBudgetBrlCents,
    isWhatsappChannel,
    needsWhatsappNumber: officialAnswer !== "yes",
    hasPaidSetupBefore: repeatDefaults?.hasPaidSetup ?? false,
  });
  const setupLabel = isWhatsappChannel
    ? "Setup do número na API Oficial"
    : "Setup inicial da conta";

  const quote = useMemo(
    () => quoteTrafego(adBudgetBrlCents, setupBrlCents),
    [adBudgetBrlCents, setupBrlCents],
  );

  // Mesma função que o servidor roda antes de cobrar — o aviso que o cliente
  // vê aqui é exatamente o que decide o checkout, sem surpresa no fim.
  const compliance = useMemo(
    () =>
      prescreenAdContent({
        platform,
        texts: [
          business.businessName,
          business.segment,
          business.audienceNotes,
          summarizeAudience(business.audienceChips, business.specialCategory),
          business.destinationUrl,
        ],
      }),
    [platform, business],
  );
  // Mesma conta do servidor: a data mostrada é a que vale no checkout.
  const hasAdAccount = isWhatsappChannel
    ? officialAnswer === "yes"
    : hasBusinessManager === "yes";
  const startEstimate = estimateEarliestStart({
    hasAdAccount,
    hasSocialLinked: timing.hasSocialLinked,
    materialsReady,
  });
  const startTooSoon = isDesiredStartTooSoon(
    timing.desiredStartAt,
    startEstimate.earliestStart,
  );

  const guardrailWarnings = useMemo(
    () =>
      checkWizardGuardrails({
        platform,
        objective,
        message: creativeDraft?.message ?? "",
        headline: creativeDraft?.headline ?? "",
        audienceChips: business.audienceChips,
        adBudgetBrlCents,
        account: accountSummary ?? null,
        creative: creativeDraft?.review ?? null,
        requireLocation: platform === "META_ADS",
      }),
    [
      platform,
      objective,
      creativeDraft,
      business.audienceChips,
      adBudgetBrlCents,
      accountSummary,
    ],
  );
  const warningsFor = (...fields: GuardrailField[]) =>
    guardrailWarnings.filter((warning) => fields.includes(warning.field));
  const hasBlockedGuardrail = guardrailWarnings.some(
    (warning) => warning.level === "blocked",
  );

  const isBlockedByPolicy = compliance.level === "BLOCKED";
  const needsComplianceAck = compliance.level === "WARNING";

  const screens = useMemo<ScreenId[]>(() => {
    const list: ScreenId[] = ["channel"];
    // Com a Meta conectada, conta e perfil já são conhecidos: depois do criativo vêm as escolhas da campanha.
    if (isCreativeFirst) list.push("creative");
    else if (platform === "META_ADS") list.push("meta-account", "ad-account");
    if (platform === "GOOGLE_ADS") list.push("ad-account");
    if (platform === "WHATSAPP_OFICIAL") {
      list.push("wa-has-number");
      if (officialAnswer === "yes") list.push("wa-verify");
      if (officialAnswer === "no") list.push("wa-acquire");
    }
    list.push("type", "objective", "business", "timing");
    // Quem já é cliente envia o criativo e o Astro analisa (spec 0126, RF-9).
    if (platform === "META_ADS" && repeatDefaults && !isCreativeFirst)
      list.push("creative");
    if (!shouldSkipContact) list.push("contact");
    list.push("investment");
    return list;
  }, [
    platform,
    officialAnswer,
    shouldSkipContact,
    repeatDefaults,
    isCreativeFirst,
  ]);

  const position = Math.max(0, screens.indexOf(screenId));
  const isLastScreen = position === screens.length - 1;

  const campaignTypeOptions: ChoiceCardOption<TrafegoCampaignType>[] = (
    platform ? CAMPAIGN_TYPES_BY_PLATFORM[platform] : []
  ).map((type) => ({
    value: type,
    label: CAMPAIGN_TYPE_LABEL[type],
    description: CAMPAIGN_TYPE_DESCRIPTION[type],
    icon: CAMPAIGN_TYPE_ICON[type],
  }));

  const objectiveOptions: ChoiceCardOption<TrafegoObjective>[] = (
    platform ? OBJECTIVES_BY_PLATFORM[platform] : []
  ).map((value) => ({
    value,
    label: OBJECTIVE_LABEL[value],
    description: OBJECTIVE_DESCRIPTION[value],
    icon: OBJECTIVE_ICON[value],
  }));

  // Só a cobrança do Asaas exige documento. No PIX manual o campo nem aparece.
  const needsPayerDocument =
    paymentMethod === "PIX" && Boolean(config?.pixAutoConfirms);

  const canGoNext = (() => {
    switch (screenId) {
      case "channel":
        return Boolean(platform);
      case "meta-account":
        // A conta é opcional: quem não tem perfil comercial segue e a equipe
        // confere na análise. Travar aqui perderia venda por detalhe de setup.
        return true;
      case "ad-account":
        return Boolean(hasBusinessManager);
      case "wa-has-number":
        return Boolean(officialAnswer);
      case "wa-verify":
        return officialNumber.replace(/\D/g, "").length >= 10;
      case "wa-acquire":
        return acquireConfirmed;
      case "type":
        return Boolean(campaignType);
      case "objective":
        return Boolean(objective);
      case "business":
        return (
          business.businessName.trim().length > 1 &&
          Boolean(business.segment) &&
          !isBlockedByPolicy &&
          !warningsFor("audience").some((warning) => warning.level === "blocked")
        );
      case "timing":
        return !startTooSoon || timing.acknowledged;
      case "creative":
        return !warningsFor("message", "headline").some(
          (warning) => warning.level === "blocked",
        );
      case "contact":
        return (
          contact.fullName.trim().length > 2 &&
          /\S+@\S+\.\S+/.test(contact.email) &&
          contact.phone.replace(/\D/g, "").length >= 10
        );
      case "investment":
        return (
          quote.totalBrlCents > 0 &&
          acceptedTerms &&
          !hasBlockedGuardrail &&
          (!isMissingAccountPhone ||
            contact.phone.replace(/\D/g, "").length >= 10) &&
          !isBlockedByPolicy &&
          (!needsComplianceAck || complianceAcknowledged) &&
          (!startTooSoon || timing.acknowledged) &&
          (!needsPayerDocument || isValidBrazilianDocument(payerDocument))
        );
      default:
        return false;
    }
  })();

  function scrollToWizard() {
    wizardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /** CTA do hero e do topo: revela o wizard e leva o olho até ele. */
  function startWizard() {
    if (hasStarted) {
      scrollToWizard();
      return;
    }
    setHasStarted(true);
    // Só dá para rolar depois que o bloco existe no DOM.
    requestAnimationFrame(() => requestAnimationFrame(scrollToWizard));
  }

  /**
   * Lead do passo Contato (spec 0021). Sai na frente do pagamento: quem
   * abandona no Investimento continua sendo um contato que a equipe pode
   * trabalhar. Dispara e segue — o wizard não espera nem mostra erro.
   */
  function captureContactLead() {
    if (hasCapturedRef.current) return;
    hasCapturedRef.current = true;

    captureLead.mutate(
      {
        fullName: contact.fullName.trim(),
        email: contact.email.trim().toLowerCase(),
        phone: contact.phone.trim(),
        platform,
        objective,
        businessName: business.businessName.trim() || null,
        segment: business.segment || null,
        adBudgetBrlCents: quote.adBudgetBrlCents,
        referralSource: contact.referralSource || null,
      },
      {
        onError: () => {
          // Libera uma nova tentativa no próximo "Continuar", mas nunca
          // interrompe o wizard: a venda vale mais que o card (RNF-2).
          hasCapturedRef.current = false;
        },
      },
    );
  }

  function applyBudgetSuggestion() {
    if (!accountSummary) return;
    const budget = suggestBudget(accountSummary);
    if (!budget) return;
    astroSuggestions.suggest("budget", budget.reason, () =>
      setAdBudgetBrlCents(budget.recommendedMonthlyCents),
    );
  }

  /** Orientação do Astro (spec 0129, RF-4): preenche só o que o cliente ainda não mexeu (CA-4). */
  function applyGuidance(guidance: CreativeGuidance) {
    astroSuggestions.suggest("campaignType", guidance.campaignType.reason, () =>
      setCampaignType(guidance.campaignType.value),
    );
    astroSuggestions.suggest("objective", guidance.objective.reason, () =>
      setObjective(guidance.objective.value),
    );
    astroSuggestions.suggest("audience", guidance.audience.reason, () => {
      setUseSavedCompany(false);
      setBusiness((current) => ({
        ...current,
        // Categoria especial: a Meta proíbe gênero e idade, só os interesses entram.
        audienceChips: guidanceAudienceChips(guidance).filter(
          (chip) =>
            current.specialCategory === "none" || chip.dimension === "interest",
        ),
      }));
    });
  }

  function goToWarningField(field: GuardrailField) {
    const screenByField: Record<GuardrailField, ScreenId> = {
      message: "creative",
      headline: "creative",
      creative: "creative",
      objective: "objective",
      audience: "business",
      budget: "investment",
    };
    setUseSavedCompany(false);
    setScreenId(screenByField[field]);
    scrollToWizard();
  }

  function goNext() {
    setFormError(null);
    if (isLastScreen) {
      handleSubmit();
      return;
    }
    if (screenId === "contact" || (screenId === "timing" && shouldSkipContact))
      captureContactLead();
    const nextScreen = screens[position + 1];
    if (nextScreen === "investment") applyBudgetSuggestion();
    setScreenId(nextScreen);
    scrollToWizard();
  }

  function goBack() {
    setFormError(null);
    if (position === 0) return;
    setScreenId(screens[position - 1]);
    scrollToWizard();
  }

  function selectPlatform(value: TrafegoPlatform) {
    setPlatform(value);
    // Cada canal tem catálogo e perguntas próprias — o que foi respondido para
    // outro canal não vale mais.
    setCampaignType(null);
    setObjective(null);
    setSocialHandle("");
    setSocialProfile(null);
    setHasBusinessManager(null);
    setOfficialAnswer(null);
    setOfficialNumber("");
    setOfficialCheck(null);
    setAcquireConfirmed(false);
  }

  const managerMessage = [
    "Olá! Vim pelo site do trafeGO e quero falar sobre uma campanha.",
    platform ? `Canal: ${PLATFORM_SHORT_LABEL[platform]}` : null,
    objective ? `Objetivo: ${OBJECTIVE_LABEL[objective]}` : null,
    `Investimento pensado: ${formatBrlFromCents(quote.adBudgetBrlCents)}`,
    business.businessName.trim()
      ? `Negócio: ${business.businessName.trim()}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  function handleSubmit() {
    if (!platform || !campaignType || !objective || !acceptedTerms) return;
    setFormError(null);

    const audience = summarizeAudience(
      business.audienceChips,
      business.specialCategory,
      business.audienceNotes,
    );

    startCheckout.mutate(
      {
        adBudgetBrlCents: quote.adBudgetBrlCents,
        organizationId: repeatDefaults?.organizationId,
        // Canal WhatsApp não pergunta BM: "unsure" mantém o setup cobrado, e a
        // equipe estorna se a conta já existir.
        hasBusinessManager: isWhatsappChannel
          ? "unsure"
          : (hasBusinessManager ?? "unsure"),
        socialHandle: socialHandle.trim() || undefined,
        hasOfficialNumber: isWhatsappChannel
          ? (officialAnswer ?? undefined)
          : undefined,
        officialNumber:
          isWhatsappChannel && officialAnswer === "yes"
            ? officialNumber.trim() || undefined
            : undefined,
        platform,
        campaignType,
        objective,
        acceptedTerms: true,
        paymentMethod,
        payerDocument:
          paymentMethod === "PIX"
            ? payerDocument.trim() || undefined
            : undefined,
        complianceAcknowledged,
        desiredStartAt: timing.desiredStartAt || undefined,
        hasSocialLinked: timing.hasSocialLinked ?? undefined,
        materialsReady: materialsReady ?? undefined,
        startAcknowledged: timing.acknowledged,
        email: contact.email.trim().toLowerCase(),
        phone: contact.phone.trim(),
        companyName: business.businessName.trim() || undefined,
        briefing: {
          businessName: business.businessName.trim() || undefined,
          businessNiche: business.segment || undefined,
          targetAudience: audience || undefined,
          destinationUrl: business.destinationUrl.trim() || undefined,
          whatsappNumber: contact.phone.trim() || undefined,
          creativeDraft: creativeDraft ?? undefined,
          notes:
            [
              contact.fullName.trim()
                ? `Contato: ${contact.fullName.trim()}`
                : null,
              timing.desiredStartAt
                ? `Quer começar em ${timing.desiredStartAt}`
                : null,
              contact.referralSource
                ? `Conheceu por: ${contact.referralSource}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ") || undefined,
        },
      },
      {
        onSuccess: (data) => {
          if (data.paymentMethod === "PIX") {
            setPixCharge({ pendingId: data.pendingId, charge: data.pix });
            scrollToWizard();
            return;
          }
          window.location.assign(data.url);
        },
        onError: (error) =>
          setFormError(
            error instanceof Error
              ? error.message
              : "Não foi possível iniciar o pagamento.",
          ),
      },
    );
  }

  return (
    <div className="dark min-h-screen">
      <SocialBackdrop />
      <LandingNav onStart={startWizard} />
      <Hero onStart={startWizard} />

      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <BrandsMarquee />

        {wasCancelled && (
          <div className="mt-6 rounded-xl border border-warning/30 bg-warning/15 p-4 text-sm text-warning">
            Pagamento cancelado. Seus dados continuam preenchidos — é só refazer
            a simulação quando quiser.
          </div>
        )}

        {pixCharge ? (
          <div ref={wizardRef} id="montar" className="scroll-mt-20 pt-8">
            <PixInstructions
              charge={pixCharge.charge}
              pendingId={pixCharge.pendingId}
            />
          </div>
        ) : hasStarted ? (
          <div
            ref={wizardRef}
            id="montar"
            className="scroll-mt-20 pt-8"
            data-guide={GUIDE_ANCHORS.trafegoWizard.id}
          >
            <WizardStepper
              steps={STEPS}
              currentIndex={
                screenId === "creative" && isCreativeFirst
                  ? 0
                  : SCREEN_STEP[screenId]
              }
            />

            <div className="mt-5">
              {screenId === "channel" && (
                <StepShell
                  eyebrow="01. Canal"
                  title="Onde você quer anunciar?"
                  subtitle="Escolha o canal da sua campanha. Dá para contratar mais de um — comece por este."
                  onBack={scrollToWizard}
                  onNext={goNext}
                  canGoNext={canGoNext}
                  backDisabled
                >
                  <ChannelStep value={platform} onSelect={selectPlatform} />
                  <p className="mt-3 text-xs text-white/45">
                    Tráfego pago
                    <TechnicalTerm
                      term="paidTraffic"
                      className="text-white/50"
                    />
                  </p>
                </StepShell>
              )}

              {screenId === "meta-account" && (
                <StepShell
                  eyebrow="01A. Verificação Meta"
                  title="Conecte sua conta do Instagram ou Facebook"
                  subtitle="Verifique se a conta existe e permita que nossa equipe analise."
                  onBack={goBack}
                  onNext={goNext}
                  canGoNext={canGoNext}
                >
                  <MetaAccountStep
                    handle={socialHandle}
                    onHandle={setSocialHandle}
                    network={socialNetwork}
                    onNetwork={setSocialNetwork}
                    profile={socialProfile}
                    onProfile={setSocialProfile}
                    lookupEnabled={config?.verification.social ?? false}
                  />
                </StepShell>
              )}

              {screenId === "ad-account" && (
                <StepShell
                  eyebrow="01B. Conta de anúncios"
                  title={
                    <>
                      Você já tem conta de anúncios
                      <TechnicalTerm
                        term="adAccount"
                        className="text-white/50"
                      />{" "}
                      (BM)
                      <TechnicalTerm term="bm" className="text-white/50" />?
                    </>
                  }
                  subtitle={
                    <>
                      Assim nossa equipe sabe se cria a conta ou conecta a que
                      você já tem. O preço não muda.
                    </>
                  }
                  onBack={goBack}
                  onNext={goNext}
                  canGoNext={canGoNext}
                >
                  <BusinessManagerStep
                    value={hasBusinessManager}
                    onChange={setHasBusinessManager}
                  />
                </StepShell>
              )}

              {screenId === "wa-has-number" && (
                <StepShell
                  eyebrow="01B. Verificação WhatsApp"
                  title="Você já possui um número na API Oficial do WhatsApp?"
                  onBack={goBack}
                  onNext={goNext}
                  canGoNext={canGoNext}
                >
                  <WhatsappNumberStep
                    value={officialAnswer}
                    onChange={setOfficialAnswer}
                    setupBrlCents={quote.tier.setupBrlCents}
                  />
                </StepShell>
              )}

              {screenId === "wa-verify" && (
                <StepShell
                  eyebrow="01B.1. Verificar número"
                  title="Informe o número do WhatsApp"
                  onBack={goBack}
                  onNext={goNext}
                  canGoNext={canGoNext}
                >
                  <WhatsappVerifyStep
                    number={officialNumber}
                    onNumber={setOfficialNumber}
                    check={officialCheck}
                    onCheck={setOfficialCheck}
                    checkEnabled={config?.verification.whatsappCheck ?? false}
                  />
                </StepShell>
              )}

              {screenId === "wa-acquire" && (
                <StepShell
                  eyebrow="01B.2. Adquirir número"
                  title="Vamos providenciar um novo número?"
                  onBack={goBack}
                  onNext={goNext}
                  canGoNext={canGoNext}
                >
                  <WhatsappAcquireStep
                    confirmed={acquireConfirmed}
                    onConfirm={setAcquireConfirmed}
                    setupBrlCents={quote.tier.setupBrlCents}
                  />
                </StepShell>
              )}

              {screenId === "type" && (
                <StepShell
                  eyebrow="02. Campanha"
                  title="Que tipo de campanha?"
                  subtitle={
                    <>
                      Isso orienta como a equipe vai configurar a segmentação
                      <TechnicalTerm
                        term="segmentation"
                        className="text-white/50"
                      />
                      .
                    </>
                  }
                  onBack={goBack}
                  onNext={goNext}
                  canGoNext={canGoNext}
                >
                  <ChoiceCardGrid
                    options={campaignTypeOptions}
                    value={campaignType}
                    onSelect={(value) => {
                      astroSuggestions.markTouched("campaignType");
                      setCampaignType(value);
                    }}
                  />
                  <AstroSuggestionNote
                    reason={astroSuggestions.reasons.campaignType}
                  />
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-white/45">
                    <span>
                      Prospecção
                      <TechnicalTerm
                        term="prospecting"
                        className="text-white/50"
                      />
                    </span>
                    <span>
                      Remarketing
                      <TechnicalTerm
                        term="remarketing"
                        className="text-white/50"
                      />
                    </span>
                  </div>
                </StepShell>
              )}

              {screenId === "objective" && (
                <StepShell
                  eyebrow="03. Objetivo"
                  title="Qual o resultado que você quer?"
                  subtitle="O objetivo define como a campanha é otimizada."
                  onBack={goBack}
                  onNext={goNext}
                  canGoNext={canGoNext}
                >
                  <ChoiceCardGrid
                    options={objectiveOptions}
                    value={objective}
                    onSelect={(value) => {
                      astroSuggestions.markTouched("objective");
                      setObjective(value);
                    }}
                  />
                  <AstroSuggestionNote
                    reason={astroSuggestions.reasons.objective}
                  />
                  <GuardrailNotes warnings={warningsFor("objective")} />
                  <p className="mt-3 text-xs text-white/45">
                    Lead
                    <TechnicalTerm term="lead" className="text-white/50" />
                    <span className="mx-2">·</span>
                    Otimização
                    <TechnicalTerm
                      term="optimization"
                      className="text-white/50"
                    />
                  </p>
                </StepShell>
              )}

              {screenId === "business" && (
                <StepShell
                  eyebrow="04. Seu negócio"
                  title="Conte sobre o seu negócio"
                  subtitle="Essas informações ajudam nossa equipe a encontrar as pessoas certas."
                  onBack={goBack}
                  onNext={goNext}
                  canGoNext={canGoNext}
                >
                  <div className="space-y-5">
                    {repeatDefaults && (
                      <div className="rounded-2xl border border-success/30 bg-success/15 p-4">
                        <div className="flex items-start gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-success/15">
                            {useSavedCompany ? (
                              <CheckCircle2 className="size-5 text-success" />
                            ) : (
                              <Building2 className="size-5 text-white/55" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-white">
                              Usar dados da {repeatDefaults.organizationName}
                            </p>
                            <p className="mt-0.5 text-xs text-white/50">
                              {repeatDefaults.sourceOrderCode
                                ? `Reaproveitados da campanha ${repeatDefaults.sourceOrderCode}.`
                                : "Da empresa em que você está no Órbita."}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                const next = !useSavedCompany;
                                setUseSavedCompany(next);
                                if (next) setBusiness(savedBusiness);
                              }}
                              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-success transition hover:text-success/80"
                            >
                              <Pencil className="size-3.5" />
                              {useSavedCompany
                                ? "Editar ou usar outra empresa"
                                : "Voltar aos dados salvos"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Sem região salva, o formulário abre: anúncio de WhatsApp precisa dela (spec 0130, RF-4). */}
                    {useSavedCompany && repeatDefaults && !warningsFor("audience").some((warning) => warning.id === "audience-no-location") ? (
                      <dl className="grid gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.03] p-4 text-sm sm:grid-cols-2">
                        <SavedValue
                          label="Nome do negócio"
                          value={business.businessName}
                        />
                        <SavedValue label="Segmento" value={business.segment} />
                        <SavedValue
                          label="Link de destino"
                          value={business.destinationUrl}
                        />
                        <SavedValue
                          label="Público"
                          value={business.audienceNotes}
                        />
                      </dl>
                    ) : (
                      <BusinessStep
                        value={business}
                        onChange={(next) => {
                          if (next.audienceChips !== business.audienceChips) {
                            astroSuggestions.markTouched("audience");
                          }
                          setBusiness(next);
                        }}
                      />
                    )}
                    <AstroSuggestionNote
                      reason={astroSuggestions.reasons.audience}
                    />
                    <GuardrailNotes warnings={warningsFor("audience")} />
                    <ComplianceAlert
                      level={compliance.level}
                      issues={compliance.hits}
                      supportWhatsapp={config?.supportWhatsapp}
                    />
                  </div>
                </StepShell>
              )}

              {screenId === "timing" && (
                <StepShell
                  eyebrow="04B. Prazo"
                  title="Quando você quer começar?"
                  subtitle="Melhor combinar isso agora do que descobrir depois que o prazo não cabia."
                  onBack={goBack}
                  onNext={goNext}
                  canGoNext={canGoNext}
                >
                  <TimingStep
                    value={timing}
                    onChange={setTiming}
                    hasAdAccount={hasAdAccount}
                    reuseSocialConnection={Boolean(
                      repeatDefaults?.timing.hasSocialLinked,
                    )}
                    socialConnectionSource={
                      repeatDefaults?.isMetaConnected
                        ? "satellites"
                        : "previous-order"
                    }
                    hasSentMaterials={hasSentMaterials}
                  />
                </StepShell>
              )}

              {screenId === "creative" && (
                <StepShell
                  eyebrow="Criativo"
                  title="Qual imagem ou vídeo vai no anúncio?"
                  subtitle={
                    isCreativeFirst
                      ? "Comece por aqui: o Astro olha o criativo e os números da sua conta e já preenche os próximos passos. Você pode mudar tudo."
                      : "O Astro avalia antes de publicar. Se preferir, pule e envie depois pelo painel."
                  }
                  onBack={goBack}
                  onNext={goNext}
                  canGoNext={canGoNext}
                >
                  <CreativeStep
                    value={creativeDraft}
                    onChange={setCreativeDraft}
                    isLinkEnabled={Boolean(repeatDefaults?.isMetaConnected)}
                    businessName={business.businessName}
                    businessNiche={business.segment}
                    socialProfile={socialProfile}
                    withGuidance={isCreativeFirst}
                    onGuidance={applyGuidance}
                    warnings={warningsFor("message", "headline")}
                  />
                  {isCreativeFirst && accountSummary?.message && (
                    <p className="mt-3 text-xs text-white/45">
                      {accountSummary.message}
                    </p>
                  )}
                </StepShell>
              )}

              {screenId === "contact" && (
                <StepShell
                  eyebrow="05. Contato"
                  title="Seus dados de contato"
                  subtitle="É por aqui que a equipe fala com você sobre a campanha."
                  onBack={goBack}
                  onNext={goNext}
                  canGoNext={canGoNext}
                >
                  <ContactStep
                    value={contact}
                    onChange={setContact}
                    phoneVerification={phoneVerification}
                    onPhoneVerification={setPhoneVerification}
                    verificationEnabled={config?.verification.phone ?? false}
                    numberCheckEnabled={
                      config?.verification.whatsappCheck ?? false
                    }
                  />
                </StepShell>
              )}

              {screenId === "investment" && (
                <StepShell
                  eyebrow="06. Investimento"
                  title="Quanto você quer investir?"
                  subtitle={
                    <>
                      A verba de tráfego
                      <TechnicalTerm
                        term="adBudget"
                        className="text-white/50"
                      />{" "}
                      você paga direto à Meta. Ela só serve para calcular o
                      serviço: 30%, com mínimo de R$ 150.
                    </>
                  }
                  onBack={goBack}
                  onNext={goNext}
                  canGoNext={canGoNext}
                  isBusy={startCheckout.isPending}
                  nextLabel={
                    paymentMethod === "PIX"
                      ? "Gerar PIX e contratar"
                      : "Finalizar e contratar"
                  }
                >
                  <div className="space-y-6">
                    <OpenWarningsSummary
                      warnings={guardrailWarnings.filter(
                        (warning) => warning.field !== "budget",
                      )}
                      onFix={goToWarningField}
                    />
                    <InvestmentSimulator
                      adBudgetBrlCents={adBudgetBrlCents}
                      onChangeBudget={(cents) => {
                        astroSuggestions.markTouched("budget");
                        setAdBudgetBrlCents(cents);
                      }}
                      setupBrlCents={setupBrlCents}
                      setupLabel={setupLabel}
                      showSetupTiers={isWhatsappChannel && setupBrlCents > 0}
                    />
                    <AstroSuggestionNote
                      reason={astroSuggestions.reasons.budget}
                    />
                    <GuardrailNotes warnings={warningsFor("budget")} />

                    {config?.supportWhatsapp && (
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-xs text-white/40">
                          Ficou em dúvida sobre quanto investir?
                        </p>
                        <TalkToManagerButton
                          whatsappNumber={config.supportWhatsapp}
                          message={managerMessage}
                        />
                      </div>
                    )}

                    <div className="space-y-5 border-t border-white/[0.07] pt-6">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-info/80">
                        Pagamento
                      </p>

                      {isMissingAccountPhone && (
                        <AccountPhoneField
                          value={contact.phone}
                          onChange={(phone) =>
                            setContact((current) => ({ ...current, phone }))
                          }
                        />
                      )}

                      <ComplianceAlert
                        level={compliance.level}
                        issues={compliance.hits}
                        acknowledged={complianceAcknowledged}
                        onAcknowledge={setComplianceAcknowledged}
                        supportWhatsapp={config?.supportWhatsapp}
                      />

                      <PaymentMethodStep
                        value={paymentMethod}
                        onChange={setPaymentMethod}
                        pixAvailable={config?.pixAvailable ?? false}
                        pixAutoConfirms={config?.pixAutoConfirms ?? false}
                      />

                      {needsPayerDocument && (
                        <PayerDocumentStep
                          value={payerDocument}
                          onChange={setPayerDocument}
                        />
                      )}

                      <div className="rounded-2xl border border-white/[0.09] bg-white/[0.03] p-4 sm:p-5">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/35">
                          Resumo
                        </p>
                        <p className="mt-1.5 text-sm text-white/60">
                          {platform ? PLATFORM_SHORT_LABEL[platform] : ""} ·{" "}
                          {campaignType
                            ? CAMPAIGN_TYPE_SHORT_LABEL[campaignType]
                            : ""}{" "}
                          · {objective ? OBJECTIVE_LABEL[objective] : ""}
                        </p>
                        {contact.fullName.trim() && (
                          <p className="mt-1 truncate text-xs text-white/35">
                            {contact.fullName} · {contact.email}
                          </p>
                        )}
                        <div className="mt-3">
                          <OrderSummary
                            quote={quote}
                            setupLabel={setupLabel}
                            compact
                          />
                        </div>
                      </div>

                      {formError && (
                        <p className="rounded-lg border border-destructive/30 bg-destructive/15 p-3 text-sm text-destructive">
                          {formError}
                        </p>
                      )}

                      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.09] bg-white/[0.03] p-4 transition hover:border-white/20">
                        <input
                          type="checkbox"
                          checked={acceptedTerms}
                          onChange={(event) =>
                            setAcceptedTerms(event.target.checked)
                          }
                          className="mt-0.5 size-4 shrink-0 accent-info"
                        />
                        <span className="text-xs leading-relaxed text-white/55">
                          Li e aceito os{" "}
                          <Link
                            href="/trafego/termos"
                            target="_blank"
                            className="font-medium text-info underline underline-offset-2"
                          >
                            Termos de serviço
                          </Link>{" "}
                          e a{" "}
                          <Link
                            href="/trafego/privacidade"
                            target="_blank"
                            className="font-medium text-info underline underline-offset-2"
                          >
                            Política de privacidade
                          </Link>
                          . Entendo que a Órbita executa e otimiza a veiculação,
                          e que o resultado depende também do criativo e da
                          oferta que eu enviar — não há garantia de vendas ou de
                          retorno.
                        </span>
                      </label>

                      <div className="flex items-center gap-2 text-xs text-white/35">
                        <ShieldCheck className="size-4 shrink-0" />
                        {paymentMethod !== "PIX"
                          ? "Pagamento processado pelo Stripe. Não guardamos dados do cartão."
                          : needsPayerDocument
                            ? "Cobrança emitida pelo Asaas. A confirmação é automática assim que o PIX cair."
                            : "Você paga na nossa chave e envia o comprovante. A equipe confirma em horário comercial."}
                      </div>
                    </div>
                  </div>
                </StepShell>
              )}
            </div>
          </div>
        ) : null}

        <ValueProps />
        <Testimonials />
        <TrafegoFooter />
      </div>

      <TrafegoAssistant
        context={{
          platform,
          objective: objective ? OBJECTIVE_LABEL[objective] : null,
          campaignType: campaignType
            ? CAMPAIGN_TYPE_SHORT_LABEL[campaignType]
            : null,
          businessName: business.businessName || null,
          segment: business.segment || null,
          adBudgetBrlCents: quote.adBudgetBrlCents,
          totalBrlCents: quote.totalBrlCents,
          feePercent: quote.feePercent,
          setupBrlCents: quote.setupBrlCents || null,
          earliestStart: formatStartDate(startEstimate.earliestStart),
        }}
      />
    </div>
  );
}

function SavedValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-white/35">
        {label}
      </dt>
      <dd className="mt-1 truncate text-white/75">
        {value || "Não informado"}
      </dd>
    </div>
  );
}

function ValueProps() {
  const items = [
    {
      icon: Target,
      title: "A verba é toda sua",
      text: "Você paga a verba direto à Meta, no cartão da sua conta de anúncios. A Órbita cobra só o serviço.",
    },
    {
      icon: BadgeCheck,
      title: "Equipe especialista",
      text: "Nosso time configura, publica e acompanha. Você não precisa aprender Meta Ads.",
    },
    {
      icon: Sparkles,
      title: "Painel próprio",
      text: "Envie criativos, acompanhe o desempenho e fale com o suporte num lugar só.",
    },
  ];

  return (
    <div
      id="como-funciona"
      className="mt-14 grid scroll-mt-20 gap-4 md:grid-cols-3"
    >
      {items.map((item) => (
        <div
          key={item.title}
          className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5"
        >
          <item.icon className="size-5 text-info" />
          <p className="mt-3 text-sm font-semibold text-white">{item.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-white/45">
            {item.text}
          </p>
        </div>
      ))}
    </div>
  );
}
