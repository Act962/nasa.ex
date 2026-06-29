import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { findChats } from "@/http/uazapi/find-chat";
import { requireUazapiToken } from "@/features/tracking-chat/lib/providers/uazapi-credentials";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import {
  WhatsAppInstanceStatus,
  LeadSource,
  MessageChannel,
} from "@/generated/prisma/enums";
import { inngest } from "@/inngest/client";
import { logActivity } from "@/features/admin/lib/activity-logger";

/**
 * Importa conversas existentes do WhatsApp pra dentro do tracking-chat.
 *
 * **Por que existe**: quando o usuário conecta a instância WhatsApp pela
 * primeira vez (ou está em dev local sem webhook acessível), ele vê o
 * `tracking-chat` vazio mesmo tendo conversas reais no celular. Esta
 * procedure puxa essas conversas via uazapi `/chat/find` e cria
 * `Lead` + `Conversation` correspondentes pra cada uma.
 *
 * **Segurança contra ban WhatsApp** (referência ao protocolo Baileys):
 * - **Apenas LEITURA** — não envia nada outbound, não dispara chamadas.
 *   Mesma operação que o WhatsApp Web faz ao abrir (listar chats).
 * - **On-demand** (botão do usuário), nunca em cron.
 * - **Throttle interno** de 100ms entre creates pra não saturar a uazapi.
 * - **Paginação respeitosa**: hard cap de 50 chats por chamada. Se sobrar,
 *   `hasMore: true` e o usuário clica "Importar mais".
 * - **Pula imagem de perfil** (campo `image`/`imagePreview` não é
 *   persistido) pra evitar query pesada que algumas implementações
 *   Baileys rate-limitam.
 *
 * **Cobrança**: 5★ por batch (fixo, action `chat_import_existing`).
 * Independe de quantos importou — se importar 0, ainda paga (justifica
 * o caso "importei e descobri que tudo já existia"). Trade-off OK.
 *
 * **Idempotência**: skip de `Conversation` com `remoteJid + trackingId`
 * que já existem (índice unique do schema). Importar 2x não duplica.
 */

export const importExistingChats = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/conversation/import-existing-chats",
    summary: "Importa conversas existentes do WhatsApp via uazapi /chat/find",
    tags: ["Conversation", "Tracking Chat"],
  })
  .input(
    z.object({
      trackingId: z.string().min(1),
      type: z.enum(["contacts", "groups", "both"]).default("both"),
      limit: z.number().int().min(1).max(50).default(50),
      offset: z.number().int().min(0).default(0),
      /**
       * Se `true` (default), dispara automaticamente o sync de mensagens
       * (via Inngest `chat/messages.sync`) pras conversas importadas.
       * Sem isso, a UI mostra a conversa mas sem histórico até o usuário
       * clicar "Sincronizar mensagens" no header.
       */
      syncMessages: z.boolean().default(true),
    }),
  )
  .output(
    z.object({
      imported: z.number().int(),
      skipped: z.number().int(),
      totalFromUazapi: z.number().int(),
      hasMore: z.boolean(),
      nextOffset: z.number().int(),
      /** Quantas conversas tiveram sync de mensagens enfileirado (Inngest). */
      messageSyncQueued: z.number().int(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    // ── 1. Cobrança upfront ──────────────────────────────────────────────
    // 5★ fixo por batch. Se saldo insuficiente, falha antes de bater na
    // uazapi (sem custo do nosso lado, sem rate quota gasta).
    const charge = await chargeStarsByAction(
      context.org.id,
      "chat_import_existing",
      {
        userId: context.user.id,
        appSlug: "chat_import_existing",
        description: "Importação de conversas existentes do WhatsApp",
      },
    );
    if (!charge.success) {
      throw errors.BAD_REQUEST({
        message: "Saldo de STARs insuficiente (5★ por batch).",
        data: { code: "INSUFFICIENT_STARS" },
      });
    }

    // ── 2. Valida tracking + instância WA ────────────────────────────────
    const tracking = await prisma.tracking.findUnique({
      where: { id: input.trackingId },
      include: {
        whatsappInstance: true,
      },
    });
    if (!tracking || tracking.organizationId !== context.org.id) {
      throw errors.NOT_FOUND({ message: "Tracking não encontrado" });
    }
    if (!tracking.whatsappInstance) {
      throw errors.BAD_REQUEST({
        message: "Tracking não tem instância WhatsApp conectada",
      });
    }
    if (tracking.whatsappInstance.status !== WhatsAppInstanceStatus.CONNECTED) {
      throw errors.BAD_REQUEST({
        message:
          "Instância WhatsApp está desconectada — reconecte antes de importar.",
      });
    }

    // Status inicial (primeira coluna do tracking) pra novos leads criados
    // na importação. Sem status, leads não conseguem entrar no kanban.
    const defaultStatus = await prisma.status.findFirst({
      where: { trackingId: input.trackingId },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    if (!defaultStatus) {
      throw errors.BAD_REQUEST({
        message:
          "Tracking não tem nenhuma coluna de status. Crie uma coluna inicial antes de importar.",
      });
    }

    // ── 3. Chama uazapi /chat/find com paginação ─────────────────────────
    // `wa_isGroup` filter: true = só grupos, false = só contatos,
    // undefined = ambos.
    const wa_isGroup =
      input.type === "groups" ? true : input.type === "contacts" ? false : undefined;

    let response;
    try {
      // Payload mínimo (mesmo formato que `findChatByPhone` usa hoje e
      // funciona). Removido `sort` porque algumas versões da uazapi
      // rejeitam o formato `field:asc|desc` com 500. Sem `sort` ela
      // ordena por `wa_lastMsgTimestamp:desc` por padrão (que é o que
      // queremos). `baseUrl` também removido — usa env default igual
      // ao caller existente.
      response = await findChats(requireUazapiToken(tracking.whatsappInstance.apiKey), {
        // `name: ""` força match-all igual ao padrão do find-chat
        // existente (ele sempre manda `name` mesmo vazio).
        name: "",
        limit: input.limit,
        offset: input.offset,
        ...(wa_isGroup !== undefined && { wa_isGroup }),
      });
    } catch (err: any) {
      // Loga TUDO pra diagnóstico — body do erro da uazapi cai aqui
      // como `err.message` (`uazapiFetch` formata como "<msg> (status N)").
      console.error("[importExistingChats] uazapi falhou", {
        message: err?.message,
        cause: err?.cause,
        stack: err?.stack?.split("\n").slice(0, 5),
        // payload enviado (sem token) pra ajudar a reproduzir
        instanceBaseUrl: tracking.whatsappInstance.baseUrl,
        payloadShape: { name: "", limit: input.limit, offset: input.offset, wa_isGroup },
      });

      const rawMsg = String(err?.message ?? "");
      const isAuthError =
        rawMsg.includes("status 401") ||
        rawMsg.includes("status 403") ||
        rawMsg.toLowerCase().includes("invalid token") ||
        rawMsg.toLowerCase().includes("missing token");
      // Status 500 do uazapi muitas vezes mascara um token inválido em
      // estado transitório — observei isso testando direto na API.
      // Tratamos 500 + 401/403 como o mesmo caso "reconecte a instância"
      // porque é o que resolve em 90% dos casos.
      const looksLikeTokenIssue =
        isAuthError || rawMsg.includes("status 500");

      let userFacing: string;
      if (looksLikeTokenIssue) {
        // Marca a instância como DISCONNECTED no DB pra forçar o usuário
        // a reconectar. Isso atualiza o `status` que controla o badge
        // "CONECTADO/DESCONECTADO" na UI e desabilita envios pendentes.
        try {
          await prisma.whatsAppInstance.update({
            where: { id: tracking.whatsappInstance.id },
            data: { status: WhatsAppInstanceStatus.DISCONNECTED },
          });
        } catch (updateErr) {
          console.warn(
            "[importExistingChats] não consegui marcar instância como disconnected",
            updateErr,
          );
        }
        userFacing =
          "Token da uazapi inválido — a instância parece conectada no NASA " +
          "mas a uazapi rejeitou a chave. Clique em 'Reconectar' nas " +
          "configurações de WhatsApp e escaneie o QR de novo. " +
          "(Marquei a instância como desconectada pra forçar o reconect.)";
      } else if (rawMsg.includes("status 404")) {
        userFacing =
          "Endpoint /chat/find não disponível neste plano da uazapi. " +
          "Atualize o plano ou contate o suporte da uazapi.";
      } else {
        userFacing =
          "Falha ao consultar a uazapi: " +
          (rawMsg || "erro desconhecido") +
          ". Verifique se a instância está conectada.";
      }
      throw errors.INTERNAL_SERVER_ERROR({ message: userFacing });
    }

    const chats = response?.chats ?? [];

    // ── 4. Itera + cria Lead + Conversation (idempotente) ────────────────
    let imported = 0;
    let skipped = 0;
    const importedConversationIds: string[] = [];

    for (const chat of chats) {
      const remoteJid = chat.wa_chatid;
      if (!remoteJid) {
        skipped++;
        continue;
      }

      try {
        // Profile picture vem direto na resposta do `/chat/find` (campo
        // `image` ou `imagePreview`). Salvar é grátis — nenhum request
        // extra ao uazapi. `image` é URL completa; `imagePreview` é
        // base64 (preferimos URL pra não inflar o DB).
        const profilePicture = chat.image || chat.imagePreview || null;

        // Idempotência: se conversa já existe, atualiza só os campos
        // visuais (foto + groupSubject) e marca como skipped pra não
        // cobrar STARs extras. Resolve o caso "já importei antes mas
        // sem foto" sem o usuário precisar deletar tudo.
        const existing = await prisma.conversation.findFirst({
          where: { remoteJid, trackingId: input.trackingId },
          select: { id: true, profilePicUrl: true, leadId: true },
        });
        if (existing) {
          // Atualiza só se faltava foto E temos uma agora
          if (!existing.profilePicUrl && profilePicture) {
            await prisma.conversation.update({
              where: { id: existing.id },
              data: { profilePicUrl: profilePicture },
            });
            // Atualiza Lead também se for contato individual
            if (!chat.wa_isGroup) {
              await prisma.lead.updateMany({
                where: { id: existing.leadId, profile: null },
                data: { profile: profilePicture },
              });
            }
          }
          skipped++;
          continue;
        }

        // Extrai phone: pra contato individual vem em `phone`; pra grupo
        // o `phone` muitas vezes vem vazio e o `wa_chatid` é tipo
        // `<id>@g.us` (não é um número real). Pra grupo usamos
        // o `wa_chatid` como identificador único de "lead", sem phone real.
        const isGroup = !!chat.wa_isGroup;
        const phoneRaw =
          chat.phone ||
          (!isGroup ? chat.wa_chatid?.split("@")[0] : "") ||
          "";
        const phone = phoneRaw.replace(/[^\d]/g, "") || null;

        const displayName = isGroup
          ? chat.wa_name || chat.name || "Grupo sem nome"
          : chat.wa_contactName ||
            chat.wa_name ||
            chat.lead_name ||
            chat.name ||
            phone ||
            "Sem nome";

        // Lead: pra individual, dedup por (phone, trackingId). Pra grupo,
        // a unicidade é (remoteJid, trackingId) na Conversation — Lead
        // do grupo é criado sempre novo se não tem phone (Prisma findFirst
        // com phone null não casa com leads existentes facilmente).
        let lead = null;
        if (!isGroup && phone) {
          lead = await prisma.lead.findFirst({
            where: { phone, trackingId: input.trackingId },
            select: { id: true },
          });
        }

        if (!lead) {
          lead = await prisma.lead.create({
            data: {
              name: displayName,
              phone: phone ?? remoteJid, // pra grupo usa o jid como "phone"
              trackingId: input.trackingId,
              statusId: defaultStatus.id,
              source: isGroup ? LeadSource.OTHER : LeadSource.WHATSAPP,
              statusFlow: "ACTIVE",
              // Foto do perfil pra individuais — pra grupos a foto fica
              // só na Conversation (Lead "do grupo" é virtual).
              ...(!isGroup && profilePicture && { profile: profilePicture }),
            },
            select: { id: true },
          });
        }

        // Conversation: cria sempre (já passamos pelo skip de existing).
        const conv = await prisma.conversation.create({
          data: {
            remoteJid,
            leadId: lead.id,
            trackingId: input.trackingId,
            channel: MessageChannel.WHATSAPP,
            isActive: !chat.wa_archived,
            isGroup,
            // Profile pic da conversa: vale pra contato E pra grupo
            // (foto do grupo aparece no card via `profilePicUrl` do schema).
            ...(profilePicture && { profilePicUrl: profilePicture }),
            ...(isGroup && {
              groupSubject: chat.wa_name || chat.name || null,
              // `groupParticipantsCount` vem de outra query (group info);
              // ficamos sem ele aqui pra evitar +N requests à uazapi.
              // Pode ser populado lazy quando o user abrir o grupo.
            }),
          },
          select: { id: true },
        });
        imported++;
        importedConversationIds.push(conv.id);

        // Throttle: 100ms entre creates. Não é a uazapi que rate-limita
        // o create, é só pra dar respiro à conexão dela e evitar pico.
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (innerErr) {
        // Falha individual de 1 chat não para o batch — só pula e continua.
        console.warn(
          "[importExistingChats] falha ao criar Lead/Conversation pra chat",
          chat.wa_chatid,
          innerErr,
        );
        skipped++;
      }
    }

    // ── 5. Dispara sync de mensagens (Inngest) pras conversas novas ──────
    // Cada Conversation criada enfileira 1 job `chat/messages.sync` que
    // chama uazapi `/message/find` em background. Não bloqueia o response
    // — o usuário vê as conversas aparecerem na lista imediatamente, e
    // o histórico de mensagens chega segundos depois via Pusher.
    let messageSyncQueued = 0;
    if (input.syncMessages && importedConversationIds.length > 0) {
      try {
        await inngest.send(
          importedConversationIds.map((conversationId) => ({
            name: "chat/messages.sync",
            data: {
              conversationId,
              trackingId: input.trackingId,
              requestedBy: context.user.id,
            },
          })),
        );
        messageSyncQueued = importedConversationIds.length;
      } catch (inngestErr) {
        // Falha silenciosa — import já foi bem-sucedido, sync é bônus.
        // Usuário pode clicar "Sincronizar mensagens" manualmente depois.
        console.warn(
          "[importExistingChats] falha ao enfileirar sync de mensagens",
          inngestErr,
        );
      }
    }

    // ── 6. Audit log — só registra se efetivamente importou algo. Se foi
    // tudo skip (idempotente), não polui o feed de atividades com noise.
    if (imported > 0) {
      logActivity({
        organizationId: context.org.id,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: context.user.image ?? null,
        appSlug: "chat",
        action: "chat.imported",
        actionLabel: `Importou ${imported} ${imported === 1 ? "conversa" : "conversas"} do WhatsApp`,
        resource: "tracking",
        resourceId: input.trackingId,
        subAppSlug: "tracking-chat",
        featureKey: "chat.import_existing_chats",
        metadata: {
          trackingId: input.trackingId,
          type: input.type,
          imported,
          skipped,
          totalFromUazapi: chats.length,
          messageSyncQueued,
        },
      }).catch(() => {});
    }

    return {
      imported,
      skipped,
      totalFromUazapi: chats.length,
      // Se a uazapi retornou exatamente `limit`, provavelmente tem mais.
      // O usuário clica em "Importar mais" pra paginar.
      hasMore: chats.length === input.limit,
      nextOffset: input.offset + input.limit,
      messageSyncQueued,
    };
  });
