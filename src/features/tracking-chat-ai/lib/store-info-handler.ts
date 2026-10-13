import "server-only";
import prisma from "@/lib/prisma";
import { buildMapsSearchUrl, formatOrganizationAddress } from "@/features/company/lib/format-organization-address";
import { listInstagramHandles } from "@/features/nasa-planner/server/publishing/instagram-channels";
import { sendCodedReply } from "./coded-reply";
import type { AgentContext } from "./context";
import { STORE_INFO_OPTION, STORE_INFO_PREFIX } from "./coded-menu-options";
import { clientMenuId } from "./guided-menu/menu-ids";

// Opções do menu com resposta fixa, tirada do cadastro da empresa (spec 0102, RF-12): ofertas nos
// stories, perfil do Instagram e endereço. O código responde; a assistente não é chamada.

const BACK_TO_MENU = { id: clientMenuId({ step: "menu" }), title: "Voltar ao menu" };

export function buildInstagramProfileUrl(handle: string): string {
  return `https://instagram.com/${handle.replace(/^@/, "")}`;
}

export function buildInstagramStoriesUrl(handle: string): string {
  return `https://instagram.com/stories/${handle.replace(/^@/, "")}/`;
}

async function buildStoreInfoReply(ctx: AgentContext, optionId: string): Promise<string | null> {
  if (optionId === STORE_INFO_OPTION.address) {
    const organization = await prisma.organization.findUnique({
      where: { id: ctx.organizationId },
      select: { addressLine: true, city: true, state: true, postalCode: true },
    });
    const address = organization ? formatOrganizationAddress(organization) : null;
    if (!address) return "Nosso endereço ainda não está cadastrado por aqui. Fale com um atendente que a gente te passa.";
    return `📍 *Nosso endereço*\n${address}\n\nComo chegar: ${buildMapsSearchUrl(address)}`;
  }
  if (optionId !== STORE_INFO_OPTION.offers && optionId !== STORE_INFO_OPTION.instagram) return null;
  const [handle] = await listInstagramHandles(ctx.organizationId);
  if (!handle) return "Nosso Instagram ainda não está cadastrado por aqui. Fale com um atendente que a gente te passa.";
  if (optionId === STORE_INFO_OPTION.offers) {
    return `🛒 *Ofertas do dia*\nAs ofertas ficam nos nossos stories do Instagram:\n${buildInstagramStoriesUrl(handle)}\n\nSe os stories não abrirem, veja pelo perfil: ${buildInstagramProfileUrl(handle)}`;
  }
  return `📸 *Nosso Instagram*\n${buildInstagramProfileUrl(handle)}\n\nSiga a gente para ver as ofertas e novidades.`;
}

export async function handleStoreInfo(ctx: AgentContext, inboundMessageId: string): Promise<{ handled: boolean }> {
  if (ctx.catalogOrder || !ctx.lead.phone || !ctx.instance) return { handled: false };
  const inbound = await prisma.message.findFirst({
    where: { id: inboundMessageId, conversationId: ctx.conversation.id, fromMe: false },
    select: { metadata: true },
  });
  const clickedId = (inbound?.metadata as { interactiveReplyId?: unknown } | null)?.interactiveReplyId;
  if (typeof clickedId !== "string" || !clickedId.startsWith(STORE_INFO_PREFIX)) return { handled: false };
  const body = await buildStoreInfoReply(ctx, clickedId);
  if (!body) return { handled: false };
  await sendCodedReply(ctx, { body, options: [BACK_TO_MENU] });
  return { handled: true };
}
