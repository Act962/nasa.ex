import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";

/**
 * Pusher auth endpoint — autoriza subscriptions em canais privados/
 * presence. Required for:
 *  - presence channels (presence-world-*, presence-space-*)
 *  - private channels (private-user-{userId}, private-org-{orgId}, ...)
 *  - client events (WebRTC signaling)
 *
 * 🚨 SEGURANÇA: cada canal privado só pode ser assinado pelo dono
 * (ou membro, no caso de org). Sem essa validação, um user
 * autenticado consegue subscrever em `private-user-OUTRO_USER` e
 * receber as notificações/alertas/SP events alheios.
 *
 * Convenções de canal validadas:
 *   private-user-{userId}     → só o próprio user
 *   private-org-{orgId}       → só membros daquela org
 *   private-conversation-{id} → só participantes da conversa
 *   private-* (outros)        → reject (lista de allow é explícita)
 *   presence-*                → qualquer user logado
 *
 * 🚨 DEV: quando criar uma feature nova que precisa de canal privado,
 * adicione um case no `validatePrivateChannel()` abaixo. Senão a
 * subscription vai falhar com 403 silenciosamente.
 */
export async function POST(req: NextRequest) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  const body = await req.text();
  const params = new URLSearchParams(body);
  const socketId = params.get("socket_id");
  const channel = params.get("channel_name");

  if (!socketId || !channel) {
    return new NextResponse("Bad request", { status: 400 });
  }

  // Guest: pode assinar APENAS presence (read-only). Privados exigem login.
  const userId = session?.user?.id;
  const userName = session?.user?.name ?? "Visitante";
  const userImage = session?.user?.image ?? null;

  try {
    // Presence — qualquer um (logado ou guest); identidade vai no payload.
    if (channel.startsWith("presence-")) {
      // Logado: usa sempre o id da sessão (não deixa um cliente spoofar outro
      // usuário). Guest: usa o `uid` auto-atribuído pelo cliente (estável por
      // aba, `?uid=`) pra que member.id === effectiveUserId. Sem isso o guest
      // ganha um id derivado do socket que diverge do world:joined e da identity
      // do LiveKit → avatar duplicado. Validado por formato (prefixo `guest`);
      // cai pro id do socket se faltar/for inválido.
      const requestedUid = req.nextUrl.searchParams.get("uid");
      const presenceUserId = userId
        ? userId
        : requestedUid && /^guest[a-zA-Z0-9_-]*$/.test(requestedUid)
          ? requestedUid
          : `guest_${socketId.replace(".", "_")}`;
      const authResponse = pusherServer.authorizeChannel(socketId, channel, {
        user_id: presenceUserId,
        user_info: { name: userName, image: userImage },
      });
      return NextResponse.json(authResponse);
    }

    // Private — requer login + validação de propriedade
    if (channel.startsWith("private-")) {
      if (!userId) {
        return new NextResponse("Unauthorized", { status: 401 });
      }
      const allowed = await validatePrivateChannel(channel, userId);
      if (!allowed) {
        return new NextResponse("Forbidden", { status: 403 });
      }
      const authResponse = pusherServer.authorizeChannel(socketId, channel);
      return NextResponse.json(authResponse);
    }

    // Canais públicos NÃO precisam de auth (Pusher SDK não chama esse
    // endpoint pra eles), mas se chegar aqui é bug ou ataque — rejeita.
    return new NextResponse("Forbidden", { status: 403 });
  } catch (err) {
    console.error("Pusher auth error:", err);
    return new NextResponse("Unauthorized", { status: 403 });
  }
}

/**
 * Decide se `userId` pode assinar o canal privado.
 * Adicione novos prefixos aqui quando criar features novas.
 */
async function validatePrivateChannel(
  channel: string,
  userId: string,
): Promise<boolean> {
  // private-user-{userId} — só o próprio user
  const userMatch = /^private-user-(.+)$/.exec(channel);
  if (userMatch) {
    return userMatch[1] === userId;
  }

  // private-org-{orgId} — só membros daquela org
  const orgMatch = /^private-org-(.+)$/.exec(channel);
  if (orgMatch) {
    const orgId = orgMatch[1]!;
    const member = await prisma.member.findFirst({
      where: { userId, organizationId: orgId },
      select: { id: true },
    });
    return Boolean(member);
  }

  // private-conversation-{id} — só participantes da conversa
  const convMatch = /^private-conversation-(.+)$/.exec(channel);
  if (convMatch) {
    const conversationId = convMatch[1]!;
    // Conversation tem leadId; user é "participante" se tiver acesso ao
    // tracking via member da org dona. Validação leve — refinar se
    // necessário.
    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        lead: { select: { tracking: { select: { organizationId: true } } } },
      },
    });
    const orgId = conv?.lead?.tracking?.organizationId;
    if (!orgId) return false;
    const member = await prisma.member.findFirst({
      where: { userId, organizationId: orgId },
      select: { id: true },
    });
    return Boolean(member);
  }

  // private-rtc-{stationId} — WebRTC do Space Station. Só member da org
  // que é dona da SpaceStation. Sinaliza ofertas/answers/ICE candidates
  // entre clientes; sem auth, qualquer um espionava chamadas alheias.
  const rtcMatch = /^private-rtc-(.+)$/.exec(channel);
  if (rtcMatch) {
    const stationId = rtcMatch[1]!;
    const station = await prisma.spaceStation.findUnique({
      where: { id: stationId },
      select: { orgId: true, userId: true },
    });
    if (!station) return false;
    // Pessoal (type=USER) → só o dono. Org station → qualquer member.
    if (station.userId) {
      return station.userId === userId;
    }
    if (station.orgId) {
      const member = await prisma.member.findFirst({
        where: { userId, organizationId: station.orgId },
        select: { id: true },
      });
      return Boolean(member);
    }
    return false;
  }

  // Padrão: rejeita. Novos canais devem ser adicionados explicitamente.
  return false;
}
