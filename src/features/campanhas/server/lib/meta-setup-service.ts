// Conexão do WhatsApp Oficial pelas chaves do próprio cliente (spec 0040,
// RF-11/RF-12). O cliente cola token + ID do app + chave secreta uma vez; a
// ÓRBITA descobre a conta, cadastra o número, valida o código, registra e
// liga o webhook. Usado pelas procedures do assistente e pelas tools do Astro.

import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { WhatsAppInstanceStatus, WhatsAppProvider } from "@/generated/prisma/enums";
import {
  addPhoneNumber,
  debugToken,
  getPhoneNumbers,
  getWaba,
  registerPhone,
  requestVerificationCode,
  subscribeApp,
  subscribeAppWebhook,
  verifyCode,
} from "@/http/whats-oficial";
import { createOfficialInstance } from "@/features/integrations/lib/whatsapp-embedded-signup/onboard";
import { encryptMetaCredentialsInput } from "@/features/tracking-chat/lib/providers/meta-credentials";
import { invalidateOutboundProvider } from "@/features/tracking-chat/lib/providers/resolve-outbound-provider";
import { invalidateTrackingContext } from "@/features/tracking-chat/lib/get-cached-tracking-context";
import { DEFAULT_WEBHOOK_CALLBACK_URL } from "@/features/campanhas/lib/whatsapp-connect-guide";
import { clearKeyDrafts, readKeyDrafts } from "./connect-progress-service";

const REQUIRED_SCOPES = ["whatsapp_business_management", "whatsapp_business_messaging"];

export function webhookCallbackUrl(): string {
  return process.env.META_WEBHOOK_CALLBACK_URL?.trim() || DEFAULT_WEBHOOK_CALLBACK_URL;
}

export function webhookVerifyToken(): string | null {
  return process.env.META_VERIFY_TOKEN_GLOBAL?.trim() || null;
}

function metaMessage(error: unknown): string {
  return error instanceof Error ? error.message.replace(/\s*\(fbtrace=[^)]*\)/, "") : String(error);
}

async function loadInstance(trackingId: string, organizationId: string) {
  const instance = await prisma.whatsAppInstance.findUnique({
    where: { trackingId },
    select: {
      id: true,
      organizationId: true,
      provider: true,
      apiKey: true,
      metaAccessToken: true,
      metaAppSecret: true,
      metaAppId: true,
      metaBusinessAccountId: true,
      metaPhoneNumberId: true,
      status: true,
      phoneNumber: true,
      metaVerifyToken: true,
    },
  });
  if (instance && instance.organizationId !== organizationId) {
    throw new ORPCError("NOT_FOUND", { message: "Funil não encontrado." });
  }
  return instance;
}

/** Credenciais decifradas do app do cliente; erro claro se ainda não colou as chaves. */
async function requireKeys(trackingId: string, organizationId: string) {
  const instance = await loadInstance(trackingId, organizationId);
  if (!instance?.metaAccessToken || !instance.metaBusinessAccountId) {
    throw new ORPCError("PRECONDITION_FAILED", { message: "Cole suas chaves da Meta primeiro." });
  }
  return {
    instance,
    accessToken: decryptSecret(instance.metaAccessToken),
    appSecret: instance.metaAppSecret ? decryptSecret(instance.metaAppSecret) : null,
    wabaId: instance.metaBusinessAccountId,
  };
}

function refreshCaches(trackingId: string) {
  invalidateOutboundProvider(trackingId);
  invalidateTrackingContext(trackingId);
}

export interface WabaOption {
  id: string;
  name: string | null;
}

export interface PhoneOption {
  id: string;
  displayNumber: string;
  verifiedName: string | null;
  quality: string | null;
  status: string | null;
  /** Número de teste da Meta (grátis, envia só para até 5 celulares cadastrados). */
  isTestNumber: boolean;
  /** Já registrado na Cloud API; sem isso a Meta recusa envios com (#133010). */
  isRegistered: boolean;
}

/** O mesmo número não pode atender dois funis (as mensagens chegam pelo número). */
async function assertPhoneFree(phoneNumberId: string, instanceId: string) {
  const owner = await prisma.whatsAppInstance.findFirst({
    where: { metaPhoneNumberId: phoneNumberId, id: { not: instanceId } },
    select: { tracking: { select: { name: true, organization: { select: { name: true } } } } },
  });
  if (!owner) return;
  const where = owner.tracking ? `no funil "${owner.tracking.name}" da empresa "${owner.tracking.organization?.name ?? "outra empresa"}"` : "em outro funil";
  throw new ORPCError("CONFLICT", {
    message: `Esse número já está conectado ${where}. Um número só atende um funil: desconecte lá (Configurações do funil → Integrações) ou use outro número.`,
  });
}

async function isPhoneFree(phoneNumberId: string, instanceId: string): Promise<boolean> {
  return assertPhoneFree(phoneNumberId, instanceId).then(
    () => true,
    () => false,
  );
}

/** Número definido: o funil passa a contar como conectado no chat e nas demais telas. */
function connectedPhoneData(phone: PhoneOption | undefined) {
  if (!phone) return {};
  return {
    status: WhatsAppInstanceStatus.CONNECTED,
    phoneNumber: phone.displayNumber.replace(/\D/g, "") || null,
    profileName: phone.verifiedName,
    isBusiness: true,
  };
}

async function listPhoneOptions(wabaId: string, accessToken: string): Promise<PhoneOption[]> {
  const response = await getPhoneNumbers({ wabaId, accessToken });
  return (response.data ?? []).map((phone) => ({
    id: phone.id,
    displayNumber: phone.display_phone_number,
    verifiedName: phone.verified_name ?? null,
    quality: phone.quality_rating ?? null,
    status: phone.code_verification_status ?? null,
    // A Meta não expõe um campo "teste": usa o nome e o prefixo que ela dá a esses números.
    isTestNumber: phone.verified_name === "Test Number" || /^\+1 555/.test(phone.display_phone_number),
    isRegistered: phone.platform_type === "CLOUD_API",
  }));
}

/** Número que já existia na conta (ex.: o de teste) pode nunca ter sido registrado na Cloud API. */
async function registerIfNeeded(phone: PhoneOption, accessToken: string): Promise<{ metaTwoStepPin?: string }> {
  if (phone.isRegistered) return {};
  const pin = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await registerPhone({ phoneNumberId: phone.id, pin, accessToken });
  return { metaTwoStepPin: encryptSecret(pin) };
}

/**
 * "Verificar token" do webhook deste funil: o global (se configurado) ou um próprio,
 * gerado na primeira vez e guardado cifrado — o cliente copia na tela do passo do webhook.
 */
async function ensureVerifyToken(instance: { id: string; metaVerifyToken: string | null }): Promise<string> {
  const globalToken = webhookVerifyToken();
  if (globalToken) return globalToken;
  if (instance.metaVerifyToken) {
    try {
      return decryptSecret(instance.metaVerifyToken);
    } catch {
      // Cifrado com outra chave: gera um novo abaixo.
    }
  }
  const generated = `orbita-${randomBytes(12).toString("hex")}`;
  await prisma.whatsAppInstance.update({ where: { id: instance.id }, data: { metaVerifyToken: encryptSecret(generated) } });
  return generated;
}

/**
 * Liga o webhook do app do cliente à ÓRBITA e inscreve o app na conta. Best
 * effort: falha vira aviso na tela — as chaves já estão salvas.
 */
async function connectWebhooks(params: {
  appId: string;
  appSecret: string;
  wabaId: string;
  accessToken: string;
  verifyToken: string;
}) {
  const { verifyToken } = params;
  const result = { isAppSubscribed: false, isWebhookSet: false, detail: null as string | null };
  try {
    await subscribeApp({ wabaId: params.wabaId, accessToken: params.accessToken });
    result.isAppSubscribed = true;
  } catch (error) {
    result.detail = metaMessage(error);
  }
  try {
    await subscribeAppWebhook({
      appId: params.appId,
      appSecret: params.appSecret,
      callbackUrl: webhookCallbackUrl(),
      verifyToken,
    });
    result.isWebhookSet = true;
  } catch (error) {
    result.detail = metaMessage(error);
  }
  return result;
}

export type SaveKeysResult =
  | { status: "choose_waba"; wabas: WabaOption[] }
  /** Chave vale para todas as contas liberadas: a Meta não lista quais — o cliente cola o ID. */
  | { status: "need_waba_id" }
  | {
      status: "saved";
      wabaId: string;
      tokenExpiresAt: string | null;
      phones: PhoneOption[];
      webhook: Awaited<ReturnType<typeof connectWebhooks>>;
    };

/** Confere as chaves na Meta, descobre a conta WhatsApp e grava tudo no funil. */
const NO_WABA_MESSAGE =
  "A chave não enxerga essa conta do WhatsApp. Confira o ID (em Configuração da API → Identificação da conta do WhatsApp Business). Conta do tipo \"Aplicativo WhatsApp Business\" (a do celular) não serve. Liberou a conta depois de gerar a chave? Gere a chave de novo.";

export async function saveMetaKeys(params: {
  organizationId: string;
  trackingId: string;
  /** Vazio = usa o rascunho salvo no passo em que a chave foi copiada. */
  accessToken?: string;
  appId?: string;
  appSecret?: string;
  wabaId?: string;
}): Promise<SaveKeysResult> {
  const drafts = await readKeyDrafts(params.trackingId);
  const accessToken = (params.accessToken?.trim() || drafts.accessToken || "").trim();
  const appId = (params.appId || drafts.appId || "").replace(/\D/g, "");
  const appSecret = (params.appSecret?.trim() || drafts.appSecret || "").trim();
  if (!accessToken || !appId || !appSecret) {
    throw new ORPCError("BAD_REQUEST", { message: "Faltou colar alguma das 3 chaves: chave de acesso, ID do app e chave secreta." });
  }

  let tokenInfo: Awaited<ReturnType<typeof debugToken>>;
  try {
    tokenInfo = await debugToken({ inputToken: accessToken, appId, appSecret });
  } catch (error) {
    throw new ORPCError("BAD_REQUEST", {
      message: `A Meta não aceitou o ID do app ou a chave secreta. Confira e cole de novo. (${metaMessage(error)})`,
    });
  }
  if (!tokenInfo.is_valid) {
    throw new ORPCError("BAD_REQUEST", { message: "Essa chave de acesso está inválida ou expirou. Gere uma nova (validade: Nunca)." });
  }
  if (tokenInfo.app_id && tokenInfo.app_id !== appId) {
    throw new ORPCError("BAD_REQUEST", { message: "A chave de acesso foi gerada para outro app. Gere o token escolhendo o app deste ID." });
  }
  const missingScopes = REQUIRED_SCOPES.filter((scope) => !tokenInfo.scopes?.includes(scope));
  if (missingScopes.length) {
    throw new ORPCError("BAD_REQUEST", {
      message: `Faltou marcar as permissões ${missingScopes.join(" e ")} ao gerar o token. Gere de novo com elas.`,
    });
  }

  const managementScope = tokenInfo.granular_scopes?.find((granular) => granular.scope === "whatsapp_business_management");
  const wabaIds = managementScope?.target_ids ?? [];
  // Sem `target_ids` a chave vale para todas as contas liberadas ao usuário do sistema, mas listá-las
  // exige business_management (que o app não oferece): o cliente informa o ID e conferimos direto.
  if (!wabaIds.length && !params.wabaId) {
    if (managementScope) return { status: "need_waba_id" };
    throw new ORPCError("BAD_REQUEST", { message: NO_WABA_MESSAGE });
  }
  if (params.wabaId && !wabaIds.length) {
    const waba = await getWaba({ wabaId: params.wabaId, accessToken }).catch(() => null);
    if (!waba) throw new ORPCError("BAD_REQUEST", { message: NO_WABA_MESSAGE });
  }
  if (params.wabaId && wabaIds.length && !wabaIds.includes(params.wabaId)) {
    throw new ORPCError("BAD_REQUEST", { message: "Essa conta do WhatsApp não está liberada para a chave." });
  }
  if (!params.wabaId && wabaIds.length > 1) {
    const wabas = await Promise.all(
      wabaIds.map(async (id) => ({ id, name: (await getWaba({ wabaId: id, accessToken }).catch(() => null))?.name ?? null })),
    );
    return { status: "choose_waba", wabas };
  }
  const wabaId = params.wabaId?.replace(/\D/g, "") || wabaIds[0];

  const existing = await loadInstance(params.trackingId, params.organizationId);
  if (existing?.provider === WhatsAppProvider.UAZAPI && existing.apiKey) {
    throw new ORPCError("CONFLICT", {
      message: "Este funil usa um número não-oficial. Crie um funil só para o WhatsApp oficial ou troque em Configurações → Integrações.",
    });
  }
  const instance = existing ?? (await createOfficialInstance(params.trackingId, params.organizationId));
  if (!instance) throw new ORPCError("NOT_FOUND", { message: "Funil não encontrado." });

  const phones = await listPhoneOptions(wabaId, accessToken).catch(() => [] as PhoneOption[]);
  // Número único já usado em outro funil: salva as chaves e deixa o cliente decidir no passo do número.
  const candidatePhone = phones.length === 1 && (await isPhoneFree(phones[0].id, instance.id)) ? phones[0] : undefined;
  // Registro falhou (ex.: número real ainda sem código confirmado): salva as chaves e o cliente segue no passo do número.
  const autoRegistration = candidatePhone ? await registerIfNeeded(candidatePhone, accessToken).catch(() => null) : null;
  const autoPhone = autoRegistration ? candidatePhone : undefined;
  await prisma.whatsAppInstance.update({
    where: { id: instance.id },
    data: {
      provider: WhatsAppProvider.META_CLOUD,
      metaAppId: appId,
      ...(drafts.businessId ? { metaBusinessId: drafts.businessId } : {}),
      ...encryptMetaCredentialsInput({
        accessToken,
        appSecret,
        businessAccountId: wabaId,
        ...(autoPhone ? { phoneNumberId: autoPhone.id } : {}),
      }),
      ...autoRegistration,
      ...connectedPhoneData(autoPhone),
    },
  });
  refreshCaches(params.trackingId);
  await clearKeyDrafts(params.trackingId);

  const verifyToken = await ensureVerifyToken({ id: instance.id, metaVerifyToken: existing?.metaVerifyToken ?? null });
  const webhook = await connectWebhooks({ appId, appSecret, wabaId, accessToken, verifyToken });
  return {
    status: "saved",
    wabaId,
    tokenExpiresAt: tokenInfo.expires_at ? new Date(tokenInfo.expires_at * 1000).toISOString() : null,
    phones,
    webhook,
  };
}

/** Escolhe um número que já existe na conta como o número do funil. */
export async function selectPhoneNumber(params: { organizationId: string; trackingId: string; phoneNumberId: string }) {
  const { instance, accessToken, wabaId } = await requireKeys(params.trackingId, params.organizationId);
  const phones = await listPhoneOptions(wabaId, accessToken);
  const selectedPhone = phones.find((phone) => phone.id === params.phoneNumberId);
  if (!selectedPhone) {
    throw new ORPCError("BAD_REQUEST", { message: "Esse número não está na sua conta do WhatsApp." });
  }
  await assertPhoneFree(params.phoneNumberId, instance.id);
  let registration: { metaTwoStepPin?: string };
  try {
    registration = await registerIfNeeded(selectedPhone, accessToken);
  } catch (error) {
    throw new ORPCError("BAD_GATEWAY", {
      message: `A Meta não ativou esse número na API: ${metaMessage(error)}. Se ele ainda não foi confirmado, peça o código por SMS.`,
    });
  }
  await prisma.whatsAppInstance.update({
    where: { id: instance.id },
    data: { metaPhoneNumberId: params.phoneNumberId, ...registration, ...connectedPhoneData(selectedPhone) },
  });
  refreshCaches(params.trackingId);
  return { phoneNumberId: params.phoneNumberId };
}

/** Cadastra um número novo na conta e já pede o código por SMS. */
export async function addNumberAndRequestCode(params: {
  organizationId: string;
  trackingId: string;
  phoneNumber: string;
  verifiedName: string;
  codeMethod?: "SMS" | "VOICE";
}) {
  const { accessToken, wabaId } = await requireKeys(params.trackingId, params.organizationId);
  const digits = params.phoneNumber.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (digits.length < 10 || digits.length > 11) {
    throw new ORPCError("BAD_REQUEST", { message: "Digite o número com DDD, ex.: (11) 91234-5678." });
  }
  let phoneNumberId: string;
  try {
    ({ id: phoneNumberId } = await addPhoneNumber({
      wabaId,
      accessToken,
      countryCode: "55",
      phoneNumber: digits,
      verifiedName: params.verifiedName.trim(),
    }));
  } catch (error) {
    throw new ORPCError("BAD_GATEWAY", { message: `A Meta não aceitou o número: ${metaMessage(error)}` });
  }
  await requestCode({ ...params, phoneNumberId });
  return { phoneNumberId };
}

export async function requestCode(params: {
  organizationId: string;
  trackingId: string;
  phoneNumberId: string;
  codeMethod?: "SMS" | "VOICE";
}) {
  const { accessToken } = await requireKeys(params.trackingId, params.organizationId);
  try {
    await requestVerificationCode({ phoneNumberId: params.phoneNumberId, accessToken, codeMethod: params.codeMethod });
  } catch (error) {
    throw new ORPCError("BAD_GATEWAY", { message: `Não foi possível pedir o código: ${metaMessage(error)}` });
  }
  return { isRequested: true };
}

/** Valida o código, registra o número na API (PIN guardado cifrado) e liga ao funil. */
export async function verifyAndRegister(params: {
  organizationId: string;
  trackingId: string;
  phoneNumberId: string;
  code: string;
}) {
  const { instance, accessToken, appSecret, wabaId } = await requireKeys(params.trackingId, params.organizationId);
  try {
    await verifyCode({ phoneNumberId: params.phoneNumberId, accessToken, code: params.code.replace(/\D/g, "") });
  } catch (error) {
    throw new ORPCError("BAD_REQUEST", { message: `Código não confirmado: ${metaMessage(error)}` });
  }
  const pin = String(randomInt(0, 1_000_000)).padStart(6, "0");
  try {
    await registerPhone({ phoneNumberId: params.phoneNumberId, pin, accessToken });
  } catch (error) {
    throw new ORPCError("BAD_GATEWAY", { message: `Número confirmado, mas o registro falhou: ${metaMessage(error)}` });
  }
  await assertPhoneFree(params.phoneNumberId, instance.id);
  const registeredPhone = (await listPhoneOptions(wabaId, accessToken).catch(() => [] as PhoneOption[])).find(
    (phone) => phone.id === params.phoneNumberId,
  );
  await prisma.whatsAppInstance.update({
    where: { id: instance.id },
    data: { metaPhoneNumberId: params.phoneNumberId, metaTwoStepPin: encryptSecret(pin), ...connectedPhoneData(registeredPhone) },
  });
  refreshCaches(params.trackingId);
  const webhook =
    instance.metaAppId && appSecret
      ? await connectWebhooks({
          appId: instance.metaAppId,
          appSecret,
          wabaId,
          accessToken,
          verifyToken: await ensureVerifyToken(instance),
        })
      : null;
  return { phoneNumberId: params.phoneNumberId, webhook };
}

export interface SetupStatus {
  hasKeys: boolean;
  isTokenValid: boolean | null;
  tokenExpiresAt: string | null;
  wabaId: string | null;
  wabaName: string | null;
  phone: PhoneOption | null;
  phones: PhoneOption[];
  isWebhookReady: boolean;
  callbackUrl: string;
  verifyToken: string | null;
}

/** Checklist real do que já está pronto na Meta — alimenta a tela e o Astro. */
export async function getSetupStatus(params: { organizationId: string; trackingId: string }): Promise<SetupStatus> {
  const base: SetupStatus = {
    hasKeys: false,
    isTokenValid: null,
    tokenExpiresAt: null,
    wabaId: null,
    wabaName: null,
    phone: null,
    phones: [],
    isWebhookReady: false,
    callbackUrl: webhookCallbackUrl(),
    verifyToken: webhookVerifyToken(),
  };
  const instance = await loadInstance(params.trackingId, params.organizationId);
  if (!instance?.metaAccessToken || !instance.metaBusinessAccountId) return base;

  const accessToken = decryptSecret(instance.metaAccessToken);
  const appSecret = instance.metaAppSecret ? decryptSecret(instance.metaAppSecret) : null;
  const status: SetupStatus = {
    ...base,
    hasKeys: true,
    wabaId: instance.metaBusinessAccountId,
    verifyToken: await ensureVerifyToken(instance),
  };

  if (instance.metaAppId && appSecret) {
    const tokenInfo = await debugToken({ inputToken: accessToken, appId: instance.metaAppId, appSecret }).catch(() => null);
    status.isTokenValid = tokenInfo?.is_valid ?? null;
    status.tokenExpiresAt = tokenInfo?.expires_at ? new Date(tokenInfo.expires_at * 1000).toISOString() : null;
  }
  const [waba, phones] = await Promise.all([
    getWaba({ wabaId: instance.metaBusinessAccountId, accessToken }).catch(() => null),
    listPhoneOptions(instance.metaBusinessAccountId, accessToken).catch(() => [] as PhoneOption[]),
  ]);
  status.wabaName = waba?.name ?? null;
  status.phones = phones;
  status.phone = phones.find((phone) => phone.id === instance.metaPhoneNumberId) ?? null;
  // Conexões feitas antes desta correção ficaram como DISCONNECTED: acerta ao conferir.
  if (status.phone && instance.status !== WhatsAppInstanceStatus.CONNECTED) {
    await prisma.whatsAppInstance
      .update({ where: { id: instance.id }, data: connectedPhoneData(status.phone) })
      .then(() => refreshCaches(params.trackingId))
      .catch(() => {});
  }
  // Número escolhido antes do registro automático existir: ativa na Cloud API agora.
  if (status.phone && !status.phone.isRegistered) {
    const registration = await registerIfNeeded(status.phone, accessToken).catch(() => null);
    if (registration) {
      await prisma.whatsAppInstance.update({ where: { id: instance.id }, data: registration }).catch(() => {});
      status.phone = { ...status.phone, isRegistered: true };
    }
  }
  status.isWebhookReady = Boolean(status.phone && instance.metaAppId);
  return status;
}
