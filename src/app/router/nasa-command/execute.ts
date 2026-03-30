import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

// ─── Date/Time Helpers ────────────────────────────────────────────────────────

function parseDate(cmd: string): Date {
  if (cmd.includes("/amanhã") || cmd.includes("/amanha")) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (cmd.includes("/semana_que_vem")) {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  }
  // Try DD.MM.AAAA pattern
  const dateMatch = cmd.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (dateMatch) return new Date(`${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`);
  return new Date(); // default to today
}

function parseTime(cmd: string): string | null {
  const match = cmd.match(/às?\s*(\d{1,2})h(\d{2})?/);
  if (match) return `${String(match[1]).padStart(2, "0")}:${match[2] ?? "00"}`;
  return null;
}

function buildDateTime(date: Date, timeStr: string): Date {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

// ─── Entity Resolution ────────────────────────────────────────────────────────

async function resolveContact(name: string, orgId: string) {
  const normalized = name.replace(/_/g, " ");
  return prisma.lead.findFirst({
    where: {
      name: { contains: normalized, mode: "insensitive" },
      tracking: { organizationId: orgId },
    },
    select: { id: true, name: true },
  });
}

async function resolveUser(name: string, orgId: string) {
  const normalized = name.replace(/_/g, " ");
  const member = await prisma.member.findFirst({
    where: {
      organizationId: orgId,
      user: { name: { contains: normalized, mode: "insensitive" } },
    },
    include: { user: { select: { id: true, name: true } } },
  });
  return member?.user ?? null;
}

async function resolveProduct(name: string, orgId: string) {
  const normalized = name.replace(/_/g, " ");
  return prisma.forgeProduct.findFirst({
    where: {
      organizationId: orgId,
      name: { contains: normalized, mode: "insensitive" },
    },
    select: { id: true, name: true },
  });
}

// ─── Title Extractor ──────────────────────────────────────────────────────────

function extractTitle(command: string): string {
  // Remove #tags and /variables, trim to ~50 chars
  const cleaned = command.replace(/#[\w-]+/g, "").replace(/\/[\w_ÀÀ-ÿ.]+/g, "").trim();
  return cleaned.slice(0, 60) || "Novo post";
}

function extractTrackingName(command: string): string {
  // 1. Straight quotes "Name" or curly quotes "Name"
  const quotedMatch = command.match(/[\u201C"«]([^\u201D"»\n]+)[\u201D"»]/);
  if (quotedMatch) return quotedMatch[1].trim();
  // 2. chamado <name> (no/com/end)
  const chamadoMatch = command.match(/chamado\s+(.+?)(?:\s+(?:no|com|em)\s+#|\s*$)/i);
  if (chamadoMatch) return chamadoMatch[1].trim();
  // 3. /Add_tracking <name>
  const addMatch = command.match(/\/Add_tracking\s+(.+?)(?:\s+(?:no|com)\s+#|\s*$)/i);
  if (addMatch) return addMatch[1].trim();
  return "Novo Tracking";
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export const execute = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Execute NASA Command", tags: ["NASA Command"] })
  .input(z.object({ command: z.string().min(1) }))
  .output(
    z.object({
      type: z.enum(["created", "query_result", "error"]),
      title: z.string(),
      description: z.string(),
      url: z.string().optional(),
      appName: z.string(),
      extraData: z.any().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { command } = input;
    const cmd = command.toLowerCase();
    const orgId = context.org.id;

    // ── Detect app ────────────────────────────────────────────────────────────
    const app = cmd.includes("#forge")
      ? "forge"
      : cmd.includes("#agenda")
        ? "agenda"
        : cmd.includes("#nasa-post")
          ? "nasa-post"
          : cmd.includes("#tracking")
            ? "tracking"
            : cmd.includes("#nbox")
              ? "nbox"
              : cmd.includes("#contatos")
                ? "contatos"
                // Detecta intenção de tracking sem o # (ex: "Crie um tracking chamado X")
                : /\b(tracking|pipeline|funil|add_tracking)\b/.test(cmd) &&
                    /\b(crie|criar|novo|nova|adicione|add)\b/.test(cmd)
                  ? "tracking"
                  : null;

    // ── Detect action type ────────────────────────────────────────────────────
    const isCreate =
      /\b(crie|cria|criar|gere|gera|gerar|fa[çc]a|fazer|agende|agendar|marque|marcar|adicione|adicionar|nova|novo|add)\b/.test(
        cmd,
      );
    const isList = /\b(liste|listar|mostrar|mostre|quais|quem|ver)\b/.test(cmd);
    const isCount = /\b(quantos|quantas|total|count)\b/.test(cmd);
    const isQuery = isList || isCount;

    // ── Extract /Variables from command ───────────────────────────────────────
    const variableRegex = /\/([A-Za-zÀ-ÿ0-9_\.]+)/g;
    const variables: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = variableRegex.exec(command)) !== null) {
      variables.push(match[1]);
    }

    // Categorise variables (dates vs names)
    const dateKeywords = ["hoje", "amanhã", "amanha", "semana_que_vem"];
    const dateVars = variables.filter(
      (v) => dateKeywords.some((k) => v.toLowerCase() === k) || /^\d{2}\.\d{2}\.\d{4}$/.test(v),
    );
    const nameVars = variables.filter(
      (v) =>
        !dateKeywords.some((k) => v.toLowerCase() === k) &&
        !/^\d{2}\.\d{2}\.\d{4}$/.test(v) &&
        !v.startsWith("link_"),
    );

    // ── Resolve entities ──────────────────────────────────────────────────────
    let resolvedContact: { id: string; name: string } | null = null;
    let resolvedUser: { id: string; name: string } | null = null;
    let resolvedProduct: { id: string; name: string } | null = null;

    for (const name of nameVars) {
      if (!resolvedContact) resolvedContact = await resolveContact(name, orgId);
      if (!resolvedUser) resolvedUser = await resolveUser(name, orgId);
      if (!resolvedProduct) resolvedProduct = await resolveProduct(name, orgId);
    }

    const resolvedClientName = resolvedContact?.name ?? (nameVars[0]?.replace(/_/g, " ") ?? null);

    // ── STAR BALANCE ──────────────────────────────────────────────────────────
    if (
      cmd.includes("saldo") ||
      cmd.includes("estrelas") ||
      cmd.includes("stars")
    ) {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          starsBalance: true,
          plan: { select: { name: true } },
        },
      });
      const balance = org?.starsBalance ?? 0;
      const planName = org?.plan?.name ?? "FREE";
      return {
        type: "query_result" as const,
        title: "Saldo de Estrelas",
        description: `Você tem ${balance.toLocaleString("pt-BR")} estrelas disponíveis. Plano: ${planName}.`,
        appName: "NASA",
        extraData: { balance, planName },
      };
    }

    // ── FORGE — Create proposal ───────────────────────────────────────────────
    if (app === "forge" && isCreate && cmd.includes("proposta")) {
      try {
        const last = await prisma.forgeProposal.findFirst({
          where: { organizationId: orgId },
          orderBy: { number: "desc" },
          select: { number: true },
        });
        const number = (last?.number ?? 0) + 1;

        const validUntil = dateVars.length > 0 ? parseDate(cmd) : null;

        const proposal = await prisma.forgeProposal.create({
          data: {
            organizationId: orgId,
            title: `Proposta - ${resolvedClientName ?? "Novo Cliente"}`,
            number,
            clientId: resolvedContact?.id ?? null,
            responsibleId: resolvedUser?.id ?? context.user.id,
            participants: [],
            validUntil,
            status: "RASCUNHO" as never,
            description: command,
            headerConfig: {},
            createdById: context.user.id,
          },
          select: { id: true, number: true },
        });
        return {
          type: "created" as const,
          title: "Proposta criada!",
          description: `Proposta "${`Proposta - ${resolvedClientName ?? "Novo Cliente"}`}" criada no Forge.`,
          url: `/forge?tab=proposals&id=${proposal.id}`,
          appName: "Forge",
        };
      } catch (err) {
        console.error("[nasa-command/execute forge proposal]", err);
        throw errors.INTERNAL_SERVER_ERROR({ message: "Erro interno. Tente novamente." });
      }
    }

    // ── FORGE — Create contract ───────────────────────────────────────────────
    if (app === "forge" && isCreate && cmd.includes("contrato")) {
      try {
        const lastContract = await prisma.forgeContract.findFirst({
          where: { organizationId: orgId },
          orderBy: { number: "desc" },
          select: { number: true },
        });
        const number = (lastContract?.number ?? 0) + 1;

        const startDate = new Date();
        const endDate = dateVars.length > 0 ? parseDate(cmd) : new Date(startDate.getFullYear() + 1, startDate.getMonth(), startDate.getDate());

        const contract = await prisma.forgeContract.create({
          data: {
            organizationId: orgId,
            number,
            startDate,
            endDate,
            value: 0,
            status: "PENDENTE_ASSINATURA" as never,
            signers: [],
            content: command,
            createdById: context.user.id,
          },
          select: { id: true, number: true },
        });
        return {
          type: "created" as const,
          title: "Contrato criado!",
          description: `Contrato #${contract.number} criado no Forge aguardando assinatura.`,
          url: `/forge?tab=contracts&id=${contract.id}`,
          appName: "Forge",
        };
      } catch (err) {
        console.error("[nasa-command/execute forge contract]", err);
        throw errors.INTERNAL_SERVER_ERROR({ message: "Erro interno. Tente novamente." });
      }
    }

    // ── FORGE — List proposals ────────────────────────────────────────────────
    if (app === "forge" && isQuery) {
      try {
        const proposals = await prisma.forgeProposal.findMany({
          where: { organizationId: orgId },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, title: true, status: true, number: true },
        });
        const list = proposals.map((p) => `#${p.number} — ${p.title} (${p.status})`).join("\n");
        return {
          type: "query_result" as const,
          title: `${proposals.length} propostas encontradas`,
          description: proposals.length > 0 ? list : "Nenhuma proposta encontrada.",
          url: "/forge",
          appName: "Forge",
          extraData: { proposals },
        };
      } catch (err) {
        console.error("[nasa-command/execute forge list]", err);
        throw errors.INTERNAL_SERVER_ERROR({ message: "Erro interno. Tente novamente." });
      }
    }

    // ── AGENDA — Create appointment ───────────────────────────────────────────
    if (app === "agenda" && isCreate) {
      try {
        const agenda = await prisma.agenda.findFirst({
          where: { organizationId: orgId, isActive: true },
        });
        if (!agenda) {
          throw errors.BAD_REQUEST({
            message: "Nenhuma agenda ativa encontrada. Crie uma agenda primeiro em /agendas.",
          });
        }

        const appointmentDate = parseDate(cmd);
        const timeStr = parseTime(cmd) ?? "09:00";
        const startsAt = buildDateTime(appointmentDate, timeStr);
        const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000); // +30 min

        const appointment = await prisma.appointment.create({
          data: {
            agendaId: agenda.id,
            title: `Reunião - ${resolvedClientName ?? "Cliente"}`,
            status: "PENDING" as never,
            notes: command,
            startsAt,
            endsAt,
            leadId: resolvedContact?.id ?? null,
            userId: resolvedUser?.id ?? context.user.id,
            trackingId: agenda.trackingId,
          },
          select: { id: true },
        });
        return {
          type: "created" as const,
          title: "Agendamento criado!",
          description: `Reunião com ${resolvedClientName ?? "cliente"} agendada para ${startsAt.toLocaleDateString("pt-BR")} às ${timeStr}.`,
          url: `/agendas`,
          appName: "Agenda",
        };
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        if (e?.code === "BAD_REQUEST") throw err;
        console.error("[nasa-command/execute agenda appointment]", err);
        throw errors.INTERNAL_SERVER_ERROR({ message: "Erro interno. Tente novamente." });
      }
    }

    // ── AGENDA — Query today's appointments ───────────────────────────────────
    if (
      (app === "agenda" && isQuery) ||
      (cmd.includes("reuniões") && cmd.includes("hoje")) ||
      (cmd.includes("compromissos") && cmd.includes("hoje"))
    ) {
      try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

        const agendas = await prisma.agenda.findMany({
          where: { organizationId: orgId },
          select: { id: true },
        });
        const agendaIds = agendas.map((a) => a.id);

        const appointments = await prisma.appointment.findMany({
          where: {
            agendaId: { in: agendaIds },
            startsAt: { gte: todayStart, lt: todayEnd },
          },
          orderBy: { startsAt: "asc" },
          select: { title: true, startsAt: true, status: true },
        });

        const list = appointments
          .map(
            (a) =>
              `${a.startsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} — ${a.title ?? "Reunião"} (${a.status})`,
          )
          .join("\n");

        return {
          type: "query_result" as const,
          title: `${appointments.length} compromisso(s) hoje`,
          description: appointments.length > 0 ? list : "Nenhum compromisso para hoje.",
          url: "/agendas",
          appName: "Agenda",
          extraData: { appointments },
        };
      } catch (err) {
        console.error("[nasa-command/execute agenda query]", err);
        throw errors.INTERNAL_SERVER_ERROR({ message: "Erro interno. Tente novamente." });
      }
    }

    // ── NASA POST — Create post ───────────────────────────────────────────────
    if (app === "nasa-post" && isCreate) {
      try {
        const postType = cmd.includes("carrossel")
          ? "CAROUSEL"
          : cmd.includes("reel") || cmd.includes("vídeo") || cmd.includes("video")
            ? "REEL"
            : cmd.includes("story")
              ? "STORY"
              : "STATIC";

        const networks = cmd.includes("linkedin")
          ? ["linkedin"]
          : cmd.includes("twitter") || cmd.includes("thread")
            ? ["twitter"]
            : ["instagram"];

        const post = await prisma.nasaPost.create({
          data: {
            organizationId: orgId,
            createdById: context.user.id,
            type: postType as never,
            title: extractTitle(command),
            targetNetworks: networks,
            aiPrompt: command,
            status: "DRAFT" as never,
            hashtags: [],
          },
          select: { id: true },
        });

        return {
          type: "created" as const,
          title: "Post criado no NASA Post!",
          description: `${postType === "CAROUSEL" ? "Carrossel" : postType === "REEL" ? "Reel" : postType === "STORY" ? "Story" : "Post"} criado como rascunho para ${networks.join(", ")}.`,
          url: `/nasa-post`,
          appName: "NASA Post",
        };
      } catch (err) {
        console.error("[nasa-command/execute nasa-post]", err);
        throw errors.INTERNAL_SERVER_ERROR({ message: "Erro interno. Tente novamente." });
      }
    }

    // ── TRACKING — Create tracking ────────────────────────────────────────────
    // Condição: app é tracking E é uma criação E NÃO é criação de lead
    if (
      app === "tracking" &&
      isCreate &&
      !cmd.includes("lead") &&
      !cmd.includes("/novo_lead")
    ) {
      try {
        const trackingName = extractTrackingName(command);
        const tracking = await prisma.tracking.create({
          data: {
            organizationId: orgId,
            name: trackingName,
            description: command,
          },
          select: { id: true, name: true },
        });

        // Adiciona o usuário atual como OWNER para aparecer na lista de trackings
        await prisma.trackingParticipant.create({
          data: {
            trackingId: tracking.id,
            userId: context.user.id,
            role: "OWNER",
          },
        });

        // Cria etapas padrão em try-catch separado para não bloquear o retorno
        const defaultStatuses = ["Prospecção", "Contato", "Proposta", "Fechado"];
        try {
          await Promise.all(
            defaultStatuses.map((statusName, i) =>
              prisma.status.create({
                data: { name: statusName, trackingId: tracking.id, order: i },
              }),
            ),
          );
        } catch (statusErr) {
          console.error("[nasa-command/execute create tracking statuses]", statusErr);
          // Não bloqueia: tracking foi criado, etapas podem ser adicionadas depois
        }

        return {
          type: "created" as const,
          title: `Tracking "${tracking.name}" criado!`,
          description: `Pipeline criado com as etapas: Prospecção, Contato, Proposta, Fechado. Acesse o app para personalizar.`,
          url: `/tracking`,
          appName: "Tracking",
        };
      } catch (err) {
        console.error("[nasa-command/execute create tracking]", err);
        throw errors.INTERNAL_SERVER_ERROR({ message: "Erro ao criar tracking. Tente novamente." });
      }
    }

    // ── TRACKING — Create lead ────────────────────────────────────────────────
    if (app === "tracking" && isCreate && cmd.includes("lead")) {
      try {
        const firstTracking = await prisma.tracking.findFirst({
          where: { organizationId: orgId },
        });
        if (!firstTracking) {
          throw errors.BAD_REQUEST({
            message: "Nenhum tracking encontrado. Crie um tracking primeiro.",
          });
        }

        const firstStatus = await prisma.status.findFirst({
          where: { trackingId: firstTracking.id },
          orderBy: { order: "asc" },
        });
        if (!firstStatus) {
          throw errors.BAD_REQUEST({
            message: "Nenhum status encontrado no tracking.",
          });
        }

        const leadName = resolvedClientName ?? nameVars[0]?.replace(/_/g, " ") ?? "Novo Lead";
        const lead = await prisma.lead.create({
          data: {
            name: leadName,
            trackingId: firstTracking.id,
            statusId: firstStatus.id,
          },
          select: { id: true, name: true },
        });

        return {
          type: "created" as const,
          title: "Lead criado!",
          description: `Lead "${lead.name}" adicionado ao tracking "${firstTracking.name}".`,
          url: `/tracking`,
          appName: "Tracking",
        };
      } catch (err: unknown) {
        const e = err as { code?: string };
        if (e?.code === "BAD_REQUEST") throw err;
        console.error("[nasa-command/execute create lead]", err);
        throw errors.INTERNAL_SERVER_ERROR({ message: "Erro interno. Tente novamente." });
      }
    }

    // ── TRACKING — Count leads ────────────────────────────────────────────────
    if (app === "tracking" && isCount) {
      try {
        const count = await prisma.lead.count({
          where: { isActive: true, tracking: { organizationId: orgId } },
        });
        return {
          type: "query_result" as const,
          title: "Total de leads",
          description: `Você tem ${count.toLocaleString("pt-BR")} lead(s) ativo(s) no total.`,
          appName: "Tracking",
          extraData: { count },
        };
      } catch (err) {
        console.error("[nasa-command/execute count leads]", err);
        throw errors.INTERNAL_SERVER_ERROR({ message: "Erro interno. Tente novamente." });
      }
    }

    // ── Generic count leads (no app prefix) ──────────────────────────────────
    if (isCount && cmd.includes("lead")) {
      try {
        const count = await prisma.lead.count({
          where: { isActive: true, tracking: { organizationId: orgId } },
        });
        return {
          type: "query_result" as const,
          title: "Total de leads",
          description: `Você tem ${count.toLocaleString("pt-BR")} lead(s) ativo(s) no total.`,
          appName: "Tracking",
          extraData: { count },
        };
      } catch (err) {
        console.error("[nasa-command/execute count leads generic]", err);
        throw errors.INTERNAL_SERVER_ERROR({ message: "Erro interno. Tente novamente." });
      }
    }

    // ── /pesquisar — Busca universal ──────────────────────────────────────────
    if (cmd.includes("/pesquisar") || cmd.includes("pesquise") || cmd.includes("pesquisar") || cmd.includes("busque") || cmd.includes("buscar") || cmd.includes("encontre")) {
      try {
        // Extract the search term: text after /pesquisar or after action verb
        const searchTermMatch =
          command.match(/\/pesquisar\s+(.+)/i) ??
          command.match(/(?:pesquise|busque|buscar|encontre|pesquisar)\s+(.+)/i);
        const term = searchTermMatch?.[1]?.replace(/[#/]/g, "").trim() ?? "";
        const termNorm = term.replace(/_/g, " ").trim();

        if (!termNorm) {
          return {
            type: "query_result" as const,
            title: "Pesquisa",
            description: "Informe o que deseja pesquisar. Ex: /pesquisar Francisco ou /pesquisar Clientes 2026",
            appName: "NASA",
          };
        }

        const [leads, users, trackings, products] = await Promise.all([
          // Leads (por nome, e-mail)
          prisma.lead.findMany({
            where: {
              isActive: true,
              tracking: { organizationId: orgId },
              OR: [
                { name: { contains: termNorm, mode: "insensitive" } },
                { email: { contains: termNorm, mode: "insensitive" } },
              ],
            },
            take: 5,
            select: { id: true, name: true, email: true },
          }),
          // Usuários (membros da org)
          prisma.member.findMany({
            where: {
              organizationId: orgId,
              user: {
                OR: [
                  { name: { contains: termNorm, mode: "insensitive" } },
                  { email: { contains: termNorm, mode: "insensitive" } },
                ],
              },
            },
            take: 5,
            include: { user: { select: { id: true, name: true, email: true } } },
          }),
          // Trackings / Pipelines
          prisma.tracking.findMany({
            where: {
              organizationId: orgId,
              name: { contains: termNorm, mode: "insensitive" },
            },
            take: 5,
            select: { id: true, name: true },
          }),
          // Produtos (Forge)
          prisma.forgeProduct.findMany({
            where: {
              organizationId: orgId,
              name: { contains: termNorm, mode: "insensitive" },
            },
            take: 5,
            select: { id: true, name: true },
          }),
        ]);

        const lines: string[] = [];
        if (leads.length > 0) {
          lines.push(`👤 Leads: ${leads.map((l) => `${l.name}${l.email ? ` (${l.email})` : ""}`).join(", ")}`);
        }
        if (users.length > 0) {
          lines.push(`🧑‍💼 Usuários: ${users.map((m) => m.user.name ?? m.user.email).join(", ")}`);
        }
        if (trackings.length > 0) {
          lines.push(`📊 Trackings: ${trackings.map((t) => t.name).join(", ")}`);
        }
        if (products.length > 0) {
          lines.push(`📦 Produtos: ${products.map((p) => p.name).join(", ")}`);
        }

        const total = leads.length + users.length + trackings.length + products.length;

        return {
          type: "query_result" as const,
          title: total > 0 ? `${total} resultado(s) para "${termNorm}"` : `Nenhum resultado para "${termNorm}"`,
          description: total > 0 ? lines.join("\n") : "Tente outro termo. A busca cobre: leads, usuários, trackings e produtos.",
          url: total > 0 ? "/tracking" : undefined,
          appName: "NASA",
          extraData: { leads, users: users.map((m) => m.user), trackings, products },
        };
      } catch (err) {
        console.error("[nasa-command/execute pesquisar]", err);
        throw errors.INTERNAL_SERVER_ERROR({ message: "Erro interno. Tente novamente." });
      }
    }

    // ── DEFAULT FALLBACK ──────────────────────────────────────────────────────
    return {
      type: "query_result" as const,
      title: "Comando processado",
      description:
        "Não foi possível identificar uma ação específica. Tente usar #app para especificar o destino (ex: #forge, #agenda, #nasa-post, #tracking).",
      appName: "NASA",
    };
  });
