import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { debitStars } from "@/lib/star-service";
import { StarTransactionType, ForgeProposalStatus } from "@/generated/prisma/enums";
import {
  parseDate,
  parseTime,
  buildDateTime,
  normalizeTimeStr,
  parseParsedVars,
  STAR_COSTS,
  resolveContact,
  resolveUser,
  resolveProduct,
  extractTitle,
  extractTrackingName,
  generateWithAI,
  type ExecuteOutput,
} from "./execute-helpers";
import { parseCommandIntent } from "./ai-intent";

// ─── Fuzzy normaliser ─────────────────────────────────────────────────────────
// Maps common misspellings / phonetic variants to canonical tokens so intent
// detection works even when the user types "agendmentu", "propposta", etc.
function normaliseCommand(raw: string): string {
  return raw
    .toLowerCase()
    // agendamento variants
    .replace(/agend[a-z]{0,6}/g, (m) => {
      if (/agend(amento|ament|amnt|mnto|mento|emnt|emento|ementu|amentu|ament[uo]|ament[oi])/i.test(m)) return "agendamento";
      if (/agend[ae]r?/i.test(m)) return "agendar";
      return m;
    })
    // proposta variants
    .replace(/pr[ao]p[oua]s?t[ao]s?/g, "proposta")
    // reunião variants
    .replace(/r[eu]{1,2}ni[aã][uo]?s?/g, "reunião")
    // criar variants
    .replace(/\b(cri[ae]r?|quero\s+criar|quero\s+cri[ae]|quero\s+fazer|quero\s+faz[ae]r?)\b/g, "criar")
    // lead variants
    .replace(/\bl[ie][ae]d[sz]?\b/g, "lead")
    // mover variants
    .replace(/\bm[ou]v[ae]r?\b/g, "mover");
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export const execute = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Execute NASA Command", tags: ["NASA Command"] })
  .input(z.object({
    command: z.string().min(1),
    model: z.string().optional(),
    appContext: z.string().optional(),
  }))
  .output(
    z.object({
      type: z.enum(["created", "query_result", "error", "needs_input", "post_generated", "confirmation_needed"]),
      title: z.string(),
      description: z.string(),
      url: z.string().optional(),
      appName: z.string(),
      extraData: z.any().optional(),
      resultLinks: z.array(z.object({ label: z.string(), url: z.string() })).optional(),
      missingFields: z.array(z.object({ key: z.string(), label: z.string() })).optional(),
      partialContext: z.record(z.string(), z.string()).optional(),
      content: z.string().optional(),
      starsSpent: z.number().optional(),
      confirmOptions: z.array(z.object({ key: z.string(), label: z.string() })).optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { command } = input;
    // Normalised version handles typos/phonetic variants ("agendmentu" → "agendamento")
    const cmd = normaliseCommand(command);
    const orgId = context.org.id;

    // ── Parse "key"="value" pairs ─────────────────────────────────────────────
    const parsedVars = parseParsedVars(command);

    // ── Detect app from #hashtags ─────────────────────────────────────────────
    const appFromHash = cmd.includes("#forge")
      ? "forge"
      : cmd.includes("#agenda")
        ? "agenda"
        : cmd.includes("#nasa-planner")
          ? "nasa-planner"
          : cmd.includes("#tracking")
            ? "tracking"
            : cmd.includes("#nbox")
              ? "nbox"
              : cmd.includes("#contatos")
                ? "contatos"
                : null;

    // ── Detect action type ────────────────────────────────────────────────────
    const isCreate =
      /\b(crie|cria|criar|gere|gera|gerar|fa[çc]a|fazer|agende|agendar|marque|marcar|adicione|adicionar|nova|novo|add)\b/.test(cmd);
    const isList =
      /\b(liste|listar|mostrar|mostre|mostra|quais|quem|ver|veja|vejas|me\s+mostr[ae]|exib[ae]|exibir|verifique|confira|aberta[s]?|pendente[s]?|traga|me\s+traga|busque|buscar|busca|encontre|encontrar|ache|achar|me\s+d[eê]|me\s+de|pega|pegue|pegar|quero\s+ver|quero\s+saber|me\s+mostra|todas?\s+as?|todos?\s+os?|todas?\s+as?\s+minhas?|todos?\s+os?\s+meus?)\b/.test(cmd);
    const isCount = /\b(quantos|quantas|total|count)\b/.test(cmd);
    const isQuery = isList || isCount;

    // ── Keyword presence flags ────────────────────────────────────────────────
    const hasProposal    = /\b(proposta[s]?|proposal[s]?|or[çc]amento[s]?)\b/.test(cmd);
    const hasLead        = /\b(lead[s]?|contato[s]?|cliente[s]?)\b/.test(cmd);
    const hasTracking    = /\b(tracking[s]?|pipeline[s]?|funil|funis)\b/.test(cmd);
    const hasAgenda      = /\b(agenda[s]?|agendamento[s]?|reuni[aã]o|reuniões|compromisso[s]?)\b/.test(cmd);
    const hasPost        = /\b(post[s]?|conte[úu]do|story|reel|carrossel|legenda|publicaç[aã]o)\b/.test(cmd);
    const hasProduct     = /\b(produto[s]?|product[s]?|servi[çc]o[s]?)\b/.test(cmd);
    const hasWorkspace   = /\b(workspace[s]?|quadro[s]?|board[s]?|painel[s]?)\b/.test(cmd);

    // ── Infer app from keywords when no hashtag is present ───────────────────
    const app = appFromHash ?? (
      hasProposal  ? "forge" :
      hasAgenda    ? "agenda" :
      hasPost      ? "nasa-planner" :
      hasWorkspace ? "workspaces" :
      hasTracking  ? "tracking" :
      hasLead      ? "tracking" :
      null
    );

    // ── Semantic intent detection ─────────────────────────────────────────────
    const isAppointment =
      /\b(agendamento|agendar|agenda[re]|reuni[aã]o|compromisso|hor[aá]rio|marqu[ae]|marcar)\b/.test(cmd) ||
      /\b(quero|preciso|desejo)\b.*\b(agend|reuni|comprom)\w*/i.test(cmd);
    const isMoveLead      = /\b(mov[ae]|mover|transferi[rr]|mudar)\b/.test(cmd) && hasLead;
    const isProposal      = hasProposal && isCreate;
    // isProposalQuery: detecção explícita de lista/consulta OU contexto implícito
    // (ex: "me traga todas as propostas", "quero as propostas", "propostas abertas")
    const isProposalImplicitQuery =
      hasProposal && !isCreate &&
      /\b(todas?|todos?|minhas?|meus?|abertas?|pendentes?|enviadas?|pagas?|canceladas?)\b/.test(cmd);
    const isProposalQuery = hasProposal && (isQuery || isProposalImplicitQuery);
    const isLeadQuery     = hasLead && isQuery;
    const isLeadCreate    = hasLead && isCreate && !isMoveLead;
    const isTrackingQuery = hasTracking && isQuery;
    const isPost          = hasPost && isCreate;
    // isWorkspaceQuery: "me traga todos os workspaces", "quais workspaces", "liste os quadros", etc.
    const isWorkspaceImplicitQuery = hasWorkspace && !isCreate;
    const isWorkspaceQuery = hasWorkspace && (isQuery || isWorkspaceImplicitQuery);

    // ── Extract /Variables from command ───────────────────────────────────────
    const variableRegex = /\/([A-Za-zÀ-ÿ0-9_\.]+)/g;
    const variables: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = variableRegex.exec(command)) !== null) {
      variables.push(match[1]);
    }

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

    // ─── Helper: debit stars safely ───────────────────────────────────────────
    async function tryDebitStars(cost: number, description: string): Promise<void> {
      try {
        await debitStars(orgId, cost, StarTransactionType.APP_CHARGE, `NASA Explorer — ${description}`, "nasa-explorer");
      } catch {
        // Non-critical, don't block the response
      }
    }

    // ── STAR BALANCE ──────────────────────────────────────────────────────────
    if (cmd.includes("saldo") || cmd.includes("estrelas") || cmd.includes("stars")) {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { starsBalance: true, plan: { select: { name: true } } },
      });
      const balance = org?.starsBalance ?? 0;
      const planName = org?.plan?.name ?? "FREE";
      return {
        type: "query_result" as const,
        title: "Saldo de Estrelas",
        description: `Você tem ${balance.toLocaleString("pt-BR")} estrelas disponíveis. Plano: ${planName}.`,
        appName: "NASA",
        extraData: { balance, planName },
      } satisfies ExecuteOutput;
    }

    // ── FORGE — Create proposal (enhanced) ───────────────────────────────────
    if (
      (app === "forge" || (!app && (cmd.includes("proposta") || cmd.includes("proposal")))) &&
      isCreate &&
      (cmd.includes("proposta") || cmd.includes("proposal"))
    ) {
      try {
        // Resolve productName: parsedVars first, then regex, then resolvedProduct
        let productName: string | null =
          parsedVars["produto"] ?? parsedVars["product"] ?? parsedVars["productnome"] ?? null;
        if (!productName) {
          const prodMatch = command.match(/(?:produto|serviço|product|service)\s+["']?([^"',\n]+)["']?/i);
          if (prodMatch) productName = prodMatch[1].trim();
        }
        if (!productName && resolvedProduct) productName = resolvedProduct.name;

        // Resolve clientName: parsedVars first, then resolvedContact
        let clientName: string | null =
          parsedVars["cliente"] ?? parsedVars["client"] ?? parsedVars["lead"] ?? null;
        if (!clientName && resolvedContact) clientName = resolvedContact.name;
        if (!clientName) {
          const clientMatch = command.match(/(?:para|for|cliente|lead)\s+["']?([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÀÜ][a-záéíóúâêîôûãõçàü]+(?:\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÀÜa-záéíóúâêîôûãõçàü]+)*)["']?/);
          if (clientMatch) clientName = clientMatch[1].trim();
        }

        // Check required fields
        if (!productName) {
          return {
            type: "needs_input" as const,
            title: "Informação necessária",
            description: "Qual é o nome do produto ou serviço da proposta?",
            appName: "Forge",
            missingFields: [{ key: "productName", label: "Nome do produto ou serviço" }],
            partialContext: clientName ? ({ clientName } as Record<string, string>) : {},
          };
        }

        if (!clientName) {
          return {
            type: "needs_input" as const,
            title: "Informação necessária",
            description: `Para quem é a proposta do produto "${productName}"?`,
            appName: "Forge",
            missingFields: [{ key: "clientName", label: "Nome do cliente (lead)" }],
            partialContext: { productName } as Record<string, string>,
          };
        }

        // Look up product and lead
        const foundProduct = resolvedProduct ?? await resolveProduct(productName, orgId);
        const foundContact = resolvedContact ?? await resolveContact(clientName, orgId);

        const last = await prisma.forgeProposal.findFirst({
          where: { organizationId: orgId },
          orderBy: { number: "desc" },
          select: { number: true },
        });
        const number = (last?.number ?? 0) + 1;

        // Parse validUntil
        const validUntilRaw = parsedVars["validade"] ?? parsedVars["validuntil"] ?? null;
        let validUntil: Date | null = null;
        if (validUntilRaw) validUntil = parseDate(validUntilRaw);
        else if (dateVars.length > 0) validUntil = parseDate(cmd);

        const proposalTitle = `Proposta - ${clientName}`;

        const proposal = await prisma.forgeProposal.create({
          data: {
            organizationId: orgId,
            title: proposalTitle,
            number,
            clientId: foundContact?.id ?? null,
            responsibleId: resolvedUser?.id ?? context.user.id,
            participants: [],
            validUntil,
            status: "RASCUNHO" as never,
            description: foundProduct ? `Produto: ${foundProduct.name}\n\n${command}` : command,
            headerConfig: {},
            createdById: context.user.id,
          },
          select: { id: true, number: true },
        });

        const cost = STAR_COSTS.create;
        await tryDebitStars(cost, `Proposta criada — ${proposalTitle}`);

        return {
          type: "created" as const,
          title: "Proposta criada!",
          description: `Proposta "${proposalTitle}" criada no Forge.${foundProduct ? ` Produto: ${foundProduct.name}.` : ""}`,
          url: `/forge?tab=proposals&id=${proposal.id}`,
          appName: "Forge",
          starsSpent: cost,
        } satisfies ExecuteOutput;
      } catch (err) {
        console.error("[nasa-command/execute forge proposal enhanced]", err);
        throw errors.INTERNAL_SERVER_ERROR;
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
        const endDate = dateVars.length > 0
          ? parseDate(cmd)
          : new Date(startDate.getFullYear() + 1, startDate.getMonth(), startDate.getDate());

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

        const cost = STAR_COSTS.create;
        await tryDebitStars(cost, `Contrato #${contract.number} criado`);

        return {
          type: "created" as const,
          title: "Contrato criado!",
          description: `Contrato #${contract.number} criado no Forge aguardando assinatura.`,
          url: `/forge?tab=contracts&id=${contract.id}`,
          appName: "Forge",
          starsSpent: cost,
        } satisfies ExecuteOutput;
      } catch (err) {
        console.error("[nasa-command/execute forge contract]", err);
        throw errors.INTERNAL_SERVER_ERROR;
      }
    }

    // ── FORGE — List proposals (with or without #forge hashtag) ──────────────
    // ForgeProposalStatus enum: RASCUNHO | ENVIADA | VISUALIZADA | PAGA | EXPIRADA | CANCELADA
    if (isProposalQuery || (app === "forge" && isQuery)) {
      try {
        // "Abertas" = ainda em andamento (não pagas, não expiradas, não canceladas)
        const filterOpen  = /\b(aberta[s]?|pendente[s]?|ativa[s]?|andamento)\b/.test(cmd);
        const filterPaid  = /\b(paga[s]?|pago[s]?|recebida[s]?)\b/.test(cmd);
        const filterExp   = /\b(expirada[s]?|vencida[s]?)\b/.test(cmd);
        const filterCan   = /\b(cancelada[s]?)\b/.test(cmd);
        const filterSent  = /\b(enviada[s]?)\b/.test(cmd);

        const statusFilter: ForgeProposalStatus[] | undefined = filterPaid
          ? [ForgeProposalStatus.PAGA]
          : filterExp
            ? [ForgeProposalStatus.EXPIRADA]
            : filterCan
              ? [ForgeProposalStatus.CANCELADA]
              : filterSent
                ? [ForgeProposalStatus.ENVIADA, ForgeProposalStatus.VISUALIZADA]
                : filterOpen
                  ? [ForgeProposalStatus.RASCUNHO, ForgeProposalStatus.ENVIADA, ForgeProposalStatus.VISUALIZADA]
                  : undefined; // sem filtro = todas

        const proposals = await prisma.forgeProposal.findMany({
          where: {
            organizationId: orgId,
            ...(statusFilter ? { status: { in: statusFilter } } : {}),
          },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, title: true, status: true, number: true },
        });

        const statusLabel: Record<ForgeProposalStatus, string> = {
          [ForgeProposalStatus.RASCUNHO]:   "Rascunho",
          [ForgeProposalStatus.ENVIADA]:    "Enviada",
          [ForgeProposalStatus.VISUALIZADA]:"Visualizada",
          [ForgeProposalStatus.PAGA]:       "Paga",
          [ForgeProposalStatus.EXPIRADA]:   "Expirada",
          [ForgeProposalStatus.CANCELADA]:  "Cancelada",
        };

        const filterDesc = filterPaid ? " pagas" : filterExp ? " expiradas" : filterCan ? " canceladas" : filterSent ? " enviadas" : filterOpen ? " abertas" : "";

        const resultLinks = proposals.map((p) => ({
          label: `#${p.number} — ${p.title} (${statusLabel[p.status] ?? p.status})`,
          url: `/forge?tab=proposals&id=${p.id}`,
        }));

        return {
          type: "query_result" as const,
          title: proposals.length > 0
            ? `${proposals.length} proposta(s)${filterDesc} encontrada(s)`
            : `Nenhuma proposta${filterDesc} encontrada`,
          description: proposals.length > 0
            ? `Clique em uma proposta para abrir diretamente no Forge:`
            : `Não há propostas${filterDesc} no momento.`,
          url: "/forge",
          appName: "Forge",
          resultLinks: proposals.length > 0 ? resultLinks : undefined,
          extraData: { proposals },
        } satisfies ExecuteOutput;
      } catch (err) {
        console.error("[nasa-command/execute forge list]", err);
        throw errors.INTERNAL_SERVER_ERROR;
      }
    }

    // ── TRACKING — Move lead ──────────────────────────────────────────────────
    if (
      (app === "tracking" || !app || isMoveLead) &&
      /\b(mov|mova|mover)\b/.test(cmd) &&
      cmd.includes("lead")
    ) {
      try {
        // Extract leadName
        let leadName: string | null =
          parsedVars["lead"] ?? parsedVars["nome"] ?? null;
        if (!leadName && resolvedContact) leadName = resolvedContact.name;
        if (!leadName) {
          const leadMatch = command.match(/lead\s+["']?([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÀÜ][a-záéíóúâêîôûãõçàü\s]+)["']?/i);
          if (leadMatch) leadName = leadMatch[1].trim();
        }

        // Extract statusName
        let statusName: string | null =
          parsedVars["status"] ?? parsedVars["etapa"] ?? null;
        if (!statusName) {
          const statusMatch = command.match(/(?:para|to|status)\s+["']?([^"',\n]+)["']?/i);
          if (statusMatch) statusName = statusMatch[1].trim();
        }

        // Extract trackingName (optional)
        const trackingName: string | null =
          parsedVars["tracking"] ?? parsedVars["pipeline"] ?? null;

        // Gather ALL missing fields at once
        const moveMissing: Array<{ key: string; label: string }> = [];
        if (!leadName) moveMissing.push({ key: "lead", label: "Nome do lead a ser movido" });
        if (!statusName) moveMissing.push({ key: "status", label: "Para qual status mover o lead?" });

        if (moveMissing.length > 0) {
          return {
            type: "needs_input" as const,
            title: "Informação necessária",
            description: `Para mover o lead, preciso de mais informações:\n${moveMissing.map((f) => `• ${f.label}`).join("\n")}`,
            appName: "Tracking",
            missingFields: moveMissing,
            partialContext: {
              ...(leadName ? { lead: leadName } : {}),
              ...(statusName ? { status: statusName } : {}),
            } as Record<string, string>,
          };
        }

        // Find lead
        const lead = leadName
          ? await prisma.lead.findFirst({
              where: {
                name: { contains: leadName, mode: "insensitive" },
                tracking: { organizationId: orgId },
              },
              select: { id: true, name: true, trackingId: true },
            })
          : null;

        if (!lead) {
          return {
            type: "error" as const,
            title: "Lead não encontrado",
            description: `Não foi possível encontrar o lead "${leadName ?? "informado"}". Verifique o nome e tente novamente.`,
            appName: "Tracking",
          } satisfies ExecuteOutput;
        }

        // Find tracking
        let trackingId = lead.trackingId;
        if (trackingName) {
          const tracking = await prisma.tracking.findFirst({
            where: { organizationId: orgId, name: { contains: trackingName, mode: "insensitive" } },
            select: { id: true },
          });
          if (tracking) trackingId = tracking.id;
        }

        // Find status
        const status = await prisma.status.findFirst({
          where: {
            trackingId,
            name: { contains: statusName, mode: "insensitive" },
          },
          select: { id: true, name: true },
        });

        if (!status) {
          return {
            type: "error" as const,
            title: "Status não encontrado",
            description: `Status "${statusName}" não encontrado no tracking. Verifique o nome da etapa.`,
            appName: "Tracking",
          } satisfies ExecuteOutput;
        }

        await prisma.lead.update({
          where: { id: lead.id },
          data: { statusId: status.id, trackingId },
        });

        const cost = STAR_COSTS.move;
        await tryDebitStars(cost, `Lead "${lead.name}" movido para "${status.name}"`);

        return {
          type: "created" as const,
          title: "Lead movido!",
          description: `Lead "${lead.name}" movido para a etapa "${status.name}".`,
          url: "/tracking",
          appName: "Tracking",
          starsSpent: cost,
        } satisfies ExecuteOutput;
      } catch (err) {
        console.error("[nasa-command/execute move lead]", err);
        throw errors.INTERNAL_SERVER_ERROR;
      }
    }

    // ── NASA PLANNER — Generate post with AI ──────────────────────────────────
    if (
      (app === "nasa-planner" || cmd.includes("#nasa-planner")) &&
      (cmd.includes("post") || cmd.includes("crie um post") || cmd.includes("gere um post"))
    ) {
      try {
        // Extract topic
        const topic =
          parsedVars["tema"] ??
          parsedVars["assunto"] ??
          parsedVars["topic"] ??
          extractTitle(command);

        const postType = cmd.includes("carrossel") || cmd.includes("carousel")
          ? "carousel"
          : cmd.includes("reel") || cmd.includes("vídeo") || cmd.includes("video")
            ? "reel"
            : cmd.includes("story")
              ? "story"
              : "static";

        const network = cmd.includes("linkedin")
          ? "LinkedIn"
          : cmd.includes("twitter") || cmd.includes("thread")
            ? "Twitter/X"
            : cmd.includes("tiktok")
              ? "TikTok"
              : "Instagram";

        const postSystemPrompt = `Você é um especialista em marketing de conteúdo. Crie conteúdo para redes sociais em português do Brasil.
Responda com o seguinte formato exato (sem markdown extra):

TÍTULO: [título chamativo]
LEGENDA: [legenda completa para o post]
HASHTAGS: [lista de hashtags relevantes]
CTA: [chamada para ação]`;

        const postUserPrompt = `Crie um ${postType === "carousel" ? "carrossel" : postType === "reel" ? "reel" : postType === "story" ? "story" : "post"} para ${network} sobre: ${topic}`;

        const aiContent = await generateWithAI(orgId, postSystemPrompt, postUserPrompt);

        if (!aiContent) {
          // Fallback: create draft without AI content
          let planner = await prisma.nasaPlanner.findFirst({
            where: { organizationId: orgId },
            orderBy: { createdAt: "asc" },
          });
          if (!planner) {
            planner = await prisma.nasaPlanner.create({
              data: { organizationId: orgId, name: "Planner Principal" },
            });
          }
          await prisma.nasaPlannerPost.create({
            data: {
              plannerId: planner.id,
              organizationId: orgId,
              createdById: context.user.id,
              type: postType.toUpperCase() as never,
              title: topic,
              targetNetworks: [network.toLowerCase()],
              aiPrompt: command,
              status: "DRAFT" as never,
              hashtags: [],
            },
          });
          return {
            type: "created" as const,
            title: "Post criado!",
            description: `Rascunho criado no NASA Planner. Conecte uma IA para gerar o conteúdo automaticamente.`,
            url: "/nasa-planner",
            appName: "NASA Planner",
          } satisfies ExecuteOutput;
        }

        // Parse AI response into structured content
        const content = aiContent;
        const titleMatch = content.match(/TÍTULO:\s*(.+)/i);
        const captionMatch = content.match(/LEGENDA:\s*([\s\S]+?)(?=HASHTAGS:|$)/i);
        const hashtagsMatch = content.match(/HASHTAGS:\s*(.+)/i);
        const ctaMatch = content.match(/CTA:\s*(.+)/i);

        const postTitle = titleMatch?.[1]?.trim() ?? topic;
        const caption = captionMatch?.[1]?.trim() ?? "";
        const hashtags = hashtagsMatch?.[1]?.trim() ?? "";
        const cta = ctaMatch?.[1]?.trim() ?? "";

        const formattedContent = `**${postTitle}**\n\n${caption}\n\n${hashtags}\n\n📣 ${cta}`;

        // Save draft to NASA Planner
        let planner = await prisma.nasaPlanner.findFirst({
          where: { organizationId: orgId },
          orderBy: { createdAt: "asc" },
        });
        if (!planner) {
          planner = await prisma.nasaPlanner.create({
            data: { organizationId: orgId, name: "Planner Principal" },
          });
        }
        await prisma.nasaPlannerPost.create({
          data: {
            plannerId: planner.id,
            organizationId: orgId,
            createdById: context.user.id,
            type: postType.toUpperCase() as never,
            title: postTitle,
            targetNetworks: [network.toLowerCase()],
            aiPrompt: command,
            status: "DRAFT" as never,
            hashtags: hashtags ? hashtags.split(/\s+/).filter((h) => h.startsWith("#")) : [],
          },
        });

        const cost = STAR_COSTS.ai_generate;
        await tryDebitStars(cost, `Post gerado com IA — ${topic}`);

        return {
          type: "post_generated" as const,
          title: "Post gerado!",
          description: caption.slice(0, 150) + (caption.length > 150 ? "..." : ""),
          url: "/nasa-planner",
          appName: "NASA Planner",
          content: formattedContent,
          starsSpent: cost,
        } satisfies ExecuteOutput;
      } catch (err) {
        console.error("[nasa-command/execute generate post]", err);
        throw errors.INTERNAL_SERVER_ERROR;
      }
    }

    // ── NASA PLANNER — Create post (existing handler) ──────────────────────────
    if (app === "nasa-planner" && isCreate) {
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

        let planner = await prisma.nasaPlanner.findFirst({
          where: { organizationId: orgId },
          orderBy: { createdAt: "asc" },
        });
        if (!planner) {
          planner = await prisma.nasaPlanner.create({
            data: { organizationId: orgId, name: "Planner Principal" },
          });
        }

        const post = await prisma.nasaPlannerPost.create({
          data: {
            plannerId: planner.id,
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

        const cost = STAR_COSTS.create;
        await tryDebitStars(cost, `Post criado no NASA Planner`);

        return {
          type: "created" as const,
          title: "Post criado no NASA Planner!",
          description: `${postType === "CAROUSEL" ? "Carrossel" : postType === "REEL" ? "Reel" : postType === "STORY" ? "Story" : "Post"} criado como rascunho para ${networks.join(", ")}.`,
          url: `/nasa-planner`,
          appName: "NASA Planner",
          starsSpent: cost,
        } satisfies ExecuteOutput;
      } catch (err) {
        console.error("[nasa-command/execute nasa-planner]", err);
        throw errors.INTERNAL_SERVER_ERROR;
      }
    }

    // ── AGENDA — Create appointment (semantic, conversational) ───────────────
    if (isAppointment) {
      try {
        // ── Detect action context ──────────────────────────────────────────
        const actionContext = /\b(cancelar|cancel)\b/.test(cmd)
          ? "cancel"
          : /\b(editar|alterar|edit|update)\b/.test(cmd)
            ? "edit"
            : "create";

        // ── Extract agendaName ─────────────────────────────────────────────
        let agendaName: string | null =
          parsedVars["agenda"] ?? null;
        if (!agendaName) {
          const agendaMatch = command.match(/(?:na agenda|agenda)\s+([\w\s]+?)(?:\s+para|\s+com|\s+no|\s+amanhã|\s+amanha|$)/i);
          if (agendaMatch) agendaName = agendaMatch[1].trim();
        }

        // ── Extract date ───────────────────────────────────────────────────
        const dateStr: string | null = parsedVars["data"] ?? parsedVars["date"] ?? null;
        let dateResolved: Date | null = null;
        if (dateStr) {
          dateResolved = parseDate(dateStr);
        } else if (
          cmd.includes("amanhã") || cmd.includes("amanha") ||
          cmd.includes("hoje") || cmd.includes("semana que vem") ||
          /\d{2}\.\d{2}\.\d{4}/.test(cmd)
        ) {
          dateResolved = parseDate(cmd);
        }

        // ── Extract time ───────────────────────────────────────────────────
        let timeStr: string | null =
          parsedVars["horario"] ?? parsedVars["hora"] ?? null;
        // Normalize natural language time (e.g. "2 horas da tarde" → "14:00")
        if (timeStr) timeStr = normalizeTimeStr(timeStr) ?? timeStr;
        if (!timeStr) timeStr = parseTime(cmd);

        // ── Extract leadName ───────────────────────────────────────────────
        let leadName: string | null =
          parsedVars["lead"] ?? parsedVars["cliente"] ?? parsedVars["contato"] ?? null;
        if (!leadName && resolvedContact) leadName = resolvedContact.name;
        if (!leadName) {
          const leadMatch = command.match(/(?:para|com)\s+([\w\s]+?)(?:\s+na|\s+às|\s+as|\s+amanhã|\s+amanha|$)/i);
          if (leadMatch) leadName = leadMatch[1].trim();
        }

        // ── Gather ALL missing fields at once ─────────────────────────────
        const missing: Array<{ key: string; label: string }> = [];
        if (!agendaName) missing.push({ key: "agenda", label: "Nome da agenda" });
        if (!dateResolved && !dateStr) missing.push({ key: "data", label: "Data do agendamento (ex: amanhã, 25/06/2026)" });
        if (!timeStr) missing.push({ key: "horario", label: "Horário do agendamento (ex: 14h30)" });
        if (!leadName) missing.push({ key: "lead", label: "Nome do lead/cliente" });

        if (missing.length > 0) {
          return {
            type: "needs_input" as const,
            title: "Informações necessárias",
            description: `Para criar o agendamento, preciso de mais informações:\n${missing.map((f) => `• ${f.label}`).join("\n")}`,
            appName: "Spacetime",
            missingFields: missing,
            partialContext: {
              ...(agendaName ? { agenda: agendaName } : {}),
              ...(dateResolved ? { data: dateResolved.toISOString() } : {}),
              ...(timeStr ? { horario: timeStr } : {}),
              ...(leadName ? { lead: leadName } : {}),
            } as Record<string, string>,
          } satisfies ExecuteOutput;
        }

        // ── Check if user confirmed lead choice ────────────────────────────
        const confirmedLeadId = parsedVars["lead_id"] ?? null;
        const createNewLead = parsedVars["create_new_lead"] === "true";

        let resolvedLead: { id: string; name: string } | null = null;

        if (confirmedLeadId) {
          // User selected a specific lead by id
          resolvedLead = await prisma.lead.findFirst({
            where: { id: confirmedLeadId, tracking: { organizationId: orgId } },
            select: { id: true, name: true },
          });
        } else if (createNewLead) {
          // Create a new lead with the given name
          const contactInfo = parsedVars["contato"] ?? null;
          if (!contactInfo) {
            return {
              type: "needs_input" as const,
              title: "Informação necessária",
              description: "Qual é o contato do novo lead (telefone ou e-mail)?",
              appName: "Spacetime",
              missingFields: [{ key: "contato", label: "Contato do novo lead (telefone ou email)" }],
              partialContext: {
                lead: leadName!,
                ...(agendaName ? { agenda: agendaName } : {}),
                ...(dateResolved ? { data: dateResolved.toISOString() } : {}),
                ...(timeStr ? { horario: timeStr } : {}),
                create_new_lead: "true",
              } as Record<string, string>,
            } satisfies ExecuteOutput;
          }
          const firstTracking = await prisma.tracking.findFirst({
            where: { organizationId: orgId },
            select: { id: true },
          });
          const firstStatus = firstTracking
            ? await prisma.status.findFirst({
                where: { trackingId: firstTracking.id },
                orderBy: { order: "asc" },
                select: { id: true },
              })
            : null;
          if (firstTracking && firstStatus) {
            resolvedLead = await prisma.lead.create({
              data: {
                name: leadName!,
                email: contactInfo.includes("@") ? contactInfo : null,
                phone: !contactInfo.includes("@") ? contactInfo : null,
                trackingId: firstTracking.id,
                statusId: firstStatus.id,
              },
              select: { id: true, name: true },
            });
          }
        } else {
          // Search for lead by name
          const leads = await prisma.lead.findMany({
            where: {
              name: { contains: leadName!, mode: "insensitive" },
              tracking: { organizationId: orgId },
            },
            select: { id: true, name: true },
            take: 5,
          });

          if (leads.length > 1) {
            const confirmOptions = [
              ...leads.map((l) => ({ key: `lead_${l.id}`, label: `Sim, é ${l.name}` })),
              { key: "create_new_lead", label: "Criar novo lead" },
            ];
            return {
              type: "confirmation_needed" as const,
              title: "Qual lead deseja usar?",
              description: `Encontrei ${leads.length} leads com esse nome:\n${leads.map((l, i) => `(lead ${i + 1}: ${l.name})`).join("\n")}`,
              appName: "Spacetime",
              confirmOptions,
              partialContext: {
                ...(agendaName ? { agenda: agendaName } : {}),
                ...(dateResolved ? { data: dateResolved.toISOString() } : {}),
                ...(timeStr ? { horario: timeStr } : {}),
                lead: leadName!,
              } as Record<string, string>,
            } satisfies ExecuteOutput;
          } else if (leads.length === 1) {
            const exactMatch = leads[0].name.toLowerCase() === leadName!.toLowerCase();
            if (!exactMatch && parsedVars["lead_confirmed"] !== "true") {
              return {
                type: "confirmation_needed" as const,
                title: "Confirmar lead",
                description: `Encontrei o lead "${leads[0].name}". É para ele?`,
                appName: "Spacetime",
                confirmOptions: [
                  { key: `lead_${leads[0].id}`, label: `Sim, é para ${leads[0].name}` },
                  { key: "create_new_lead", label: "Criar novo lead" },
                ],
                partialContext: {
                  ...(agendaName ? { agenda: agendaName } : {}),
                  ...(dateResolved ? { data: dateResolved.toISOString() } : {}),
                  ...(timeStr ? { horario: timeStr } : {}),
                  lead: leadName!,
                } as Record<string, string>,
              } satisfies ExecuteOutput;
            }
            resolvedLead = leads[0];
          } else {
            // No lead found — offer to create one
            return {
              type: "confirmation_needed" as const,
              title: "Lead não encontrado",
              description: `Não encontrei nenhum lead com o nome "${leadName}". Deseja criar um novo?`,
              appName: "Spacetime",
              confirmOptions: [
                { key: "create_new_lead", label: `Criar lead "${leadName}"` },
              ],
              partialContext: {
                ...(agendaName ? { agenda: agendaName } : {}),
                ...(dateResolved ? { data: dateResolved.toISOString() } : {}),
                ...(timeStr ? { horario: timeStr } : {}),
                lead: leadName!,
              } as Record<string, string>,
            } satisfies ExecuteOutput;
          }
        }

        if (!resolvedLead) {
          return {
            type: "error" as const,
            title: "Lead não resolvido",
            description: "Não foi possível encontrar ou criar o lead para o agendamento.",
            appName: "Spacetime",
          } satisfies ExecuteOutput;
        }

        // ── Resolve agenda ─────────────────────────────────────────────────
        const agenda = await prisma.agenda.findFirst({
          where: {
            organizationId: orgId,
            OR: agendaName
              ? [{ name: { contains: agendaName, mode: "insensitive" } }, { isActive: true }]
              : [{ isActive: true }],
          },
        });

        if (!agenda) {
          return {
            type: "error" as const,
            title: "Agenda não encontrada",
            description: "Nenhuma agenda ativa encontrada. Crie uma agenda no Spacetime primeiro.",
            appName: "Spacetime",
          } satisfies ExecuteOutput;
        }

        // ── Create appointment ─────────────────────────────────────────────
        const finalDate = dateResolved ?? (dateStr ? parseDate(dateStr) : new Date());
        const finalTime = timeStr ?? "09:00";
        const startsAt = buildDateTime(finalDate, finalTime);
        const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

        await prisma.appointment.create({
          data: {
            agendaId: agenda.id,
            title: `${actionContext === "create" ? "Reunião" : "Compromisso"} - ${resolvedLead.name}`,
            leadId: resolvedLead.id,
            userId: context.user.id,
            status: "PENDING" as never,
            startsAt,
            endsAt,
            trackingId: agenda.trackingId ?? null,
            notes: command,
          },
          select: { id: true },
        });

        const cost = STAR_COSTS.create;
        await tryDebitStars(cost, `Agendamento criado — ${resolvedLead.name}`);

        return {
          type: "created" as const,
          title: "Agendamento criado!",
          description: `Reunião com ${resolvedLead.name} em ${startsAt.toLocaleDateString("pt-BR")} às ${finalTime}.`,
          url: "/agendas",
          appName: "Spacetime",
          starsSpent: cost,
        } satisfies ExecuteOutput;
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        if (e?.code === "BAD_REQUEST") throw err;
        console.error("[nasa-command/execute appointment semantic]", err);
        throw errors.INTERNAL_SERVER_ERROR;
      }
    }

    // ── AGENDA — Query appointments (today, or general list) ─────────────────
    if (
      (app === "agenda" && isQuery) ||
      (hasAgenda && isQuery) ||
      (cmd.includes("reuniões") && cmd.includes("hoje")) ||
      (cmd.includes("compromissos") && cmd.includes("hoje")) ||
      (cmd.includes("agendamentos") && isQuery)
    ) {
      try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        // If no "hoje" keyword → show next 7 days
        const isToday = cmd.includes("hoje");
        const rangeEnd = isToday ? todayEnd : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const agendas = await prisma.agenda.findMany({
          where: { organizationId: orgId },
          select: { id: true },
        });
        const agendaIds = agendas.map((a) => a.id);

        const appointments = await prisma.appointment.findMany({
          where: {
            agendaId: { in: agendaIds },
            startsAt: { gte: todayStart, lt: rangeEnd },
          },
          orderBy: { startsAt: "asc" },
          take: 15,
          select: { title: true, startsAt: true, status: true },
        });

        const list = appointments
          .map((a) => {
            const dateStr = a.startsAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
            const timeStr = a.startsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
            return isToday
              ? `${timeStr} — ${a.title ?? "Reunião"} (${a.status})`
              : `${dateStr} às ${timeStr} — ${a.title ?? "Reunião"} (${a.status})`;
          })
          .join("\n");

        const rangeLabel = isToday ? "hoje" : "nos próximos 7 dias";

        return {
          type: "query_result" as const,
          title: appointments.length > 0
            ? `${appointments.length} compromisso(s) ${rangeLabel}`
            : `Nenhum compromisso ${rangeLabel}`,
          description: appointments.length > 0 ? list : `Você não tem compromissos agendados ${rangeLabel}.`,
          url: "/agendas",
          appName: "Spacetime",
          extraData: { appointments },
        } satisfies ExecuteOutput;
      } catch (err) {
        console.error("[nasa-command/execute agenda query]", err);
        throw errors.INTERNAL_SERVER_ERROR;
      }
    }

    // ── TRACKING — List trackings/pipelines ──────────────────────────────────
    if (isTrackingQuery) {
      try {
        const trackings = await prisma.tracking.findMany({
          where: { organizationId: orgId },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, name: true, _count: { select: { leads: true } } },
        });
        const list = trackings
          .map((t) => `• ${t.name} — ${t._count.leads} lead(s)`)
          .join("\n");
        return {
          type: "query_result" as const,
          title: trackings.length > 0
            ? `${trackings.length} tracking(s) encontrado(s)`
            : "Nenhum tracking encontrado",
          description: trackings.length > 0 ? list : "Crie seu primeiro pipeline no Tracking.",
          url: "/tracking",
          appName: "Tracking",
          extraData: { trackings },
        } satisfies ExecuteOutput;
      } catch (err) {
        console.error("[nasa-command/execute tracking list]", err);
        throw errors.INTERNAL_SERVER_ERROR;
      }
    }

    // ── TRACKING — List leads ─────────────────────────────────────────────────
    if (isLeadQuery && !isCount) {
      try {
        // Optional filter by tracking name
        const trackingName = parsedVars["tracking"] ?? parsedVars["pipeline"] ?? null;
        const trackingFilter = trackingName
          ? await prisma.tracking.findFirst({
              where: { organizationId: orgId, name: { contains: trackingName, mode: "insensitive" } },
              select: { id: true, name: true },
            })
          : null;

        const leads = await prisma.lead.findMany({
          where: {
            isActive: true,
            tracking: trackingFilter
              ? { id: trackingFilter.id }
              : { organizationId: orgId },
          },
          orderBy: { createdAt: "desc" },
          take: 15,
          select: {
            id: true, name: true, email: true, phone: true,
            status: { select: { name: true } },
            tracking: { select: { name: true } },
          },
        });

        const list = leads
          .map((l) => `• ${l.name}${l.email ? ` (${l.email})` : l.phone ? ` (${l.phone})` : ""} — ${l.status?.name ?? "?"} / ${l.tracking.name}`)
          .join("\n");

        return {
          type: "query_result" as const,
          title: leads.length > 0
            ? `${leads.length} lead(s) encontrado(s)${trackingFilter ? ` em "${trackingFilter.name}"` : ""}`
            : "Nenhum lead encontrado",
          description: leads.length > 0 ? list : "Nenhum lead ativo no momento.",
          url: "/tracking",
          appName: "Tracking",
          extraData: { leads },
        } satisfies ExecuteOutput;
      } catch (err) {
        console.error("[nasa-command/execute leads list]", err);
        throw errors.INTERNAL_SERVER_ERROR;
      }
    }

    // ── TRACKING — Create tracking ────────────────────────────────────────────
    if (
      app === "tracking" &&
      isCreate &&
      !hasLead &&
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

        await prisma.trackingParticipant.create({
          data: { trackingId: tracking.id, userId: context.user.id, role: "OWNER" },
        });

        const defaultStatuses = ["Prospecção", "Contato", "Proposta", "Fechado"];
        try {
          await Promise.all(
            defaultStatuses.map((statusName, i) =>
              prisma.status.create({ data: { name: statusName, trackingId: tracking.id, order: i } }),
            ),
          );
        } catch (statusErr) {
          console.error("[nasa-command/execute create tracking statuses]", statusErr);
        }

        const cost = STAR_COSTS.create;
        await tryDebitStars(cost, `Tracking "${tracking.name}" criado`);

        return {
          type: "created" as const,
          title: `Tracking "${tracking.name}" criado!`,
          description: `Pipeline criado com as etapas: Prospecção, Contato, Proposta, Fechado. Acesse o app para personalizar.`,
          url: `/tracking`,
          appName: "Tracking",
          starsSpent: cost,
        } satisfies ExecuteOutput;
      } catch (err) {
        console.error("[nasa-command/execute create tracking]", err);
        throw errors.INTERNAL_SERVER_ERROR;
      }
    }

    // ── TRACKING — Create lead ────────────────────────────────────────────────
    if ((app === "tracking" || isLeadCreate) && isCreate && hasLead) {
      try {
        const firstTracking = await prisma.tracking.findFirst({
          where: { organizationId: orgId },
        });
        if (!firstTracking) {
          throw errors.BAD_REQUEST;
        }

        const firstStatus = await prisma.status.findFirst({
          where: { trackingId: firstTracking.id },
          orderBy: { order: "asc" },
        });
        if (!firstStatus) {
          throw errors.BAD_REQUEST;
        }

        const leadName =
          parsedVars["lead"] ??
          parsedVars["nome"] ??
          resolvedClientName ??
          nameVars[0]?.replace(/_/g, " ") ??
          "Novo Lead";

        const lead = await prisma.lead.create({
          data: { name: leadName, trackingId: firstTracking.id, statusId: firstStatus.id },
          select: { id: true, name: true },
        });

        const cost = STAR_COSTS.create;
        await tryDebitStars(cost, `Lead "${lead.name}" criado`);

        return {
          type: "created" as const,
          title: "Lead criado!",
          description: `Lead "${lead.name}" adicionado ao tracking "${firstTracking.name}".`,
          url: `/tracking`,
          appName: "Tracking",
          starsSpent: cost,
        } satisfies ExecuteOutput;
      } catch (err: unknown) {
        const e = err as { code?: string };
        if (e?.code === "BAD_REQUEST") throw err;
        console.error("[nasa-command/execute create lead]", err);
        throw errors.INTERNAL_SERVER_ERROR;
      }
    }

    // ── TRACKING — Count leads (with or without #tracking) ───────────────────
    if (isCount && hasLead) {
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
        } satisfies ExecuteOutput;
      } catch (err) {
        console.error("[nasa-command/execute count leads]", err);
        throw errors.INTERNAL_SERVER_ERROR;
      }
    }

    // ── QUERY DATA — resultado, campanha, relatório, performance, dados de ─────
    if (
      cmd.includes("resultado") ||
      cmd.includes("campanha") ||
      cmd.includes("relatório") ||
      cmd.includes("relatorio") ||
      cmd.includes("performance") ||
      /\bdados de\b/.test(cmd)
    ) {
      try {
        const [leadCount, trackings] = await Promise.all([
          prisma.lead.count({ where: { isActive: true, tracking: { organizationId: orgId } } }),
          prisma.tracking.findMany({
            where: { organizationId: orgId },
            take: 5,
            select: { id: true, name: true, _count: { select: { leads: true } } },
          }),
        ]);

        const trackingLines = trackings.map((t) => `• ${t.name}: ${t._count.leads} leads`).join("\n");
        const description = `Total de leads ativos: ${leadCount.toLocaleString("pt-BR")}\n\nTrackings:\n${trackingLines || "Nenhum tracking encontrado."}`;

        return {
          type: "query_result" as const,
          title: "Dados da organização",
          description,
          appName: "NASA",
          extraData: { leadCount, trackings },
        } satisfies ExecuteOutput;
      } catch (err) {
        console.error("[nasa-command/execute query data]", err);
        throw errors.INTERNAL_SERVER_ERROR;
      }
    }

    // ── /pesquisar — Busca universal ──────────────────────────────────────────
    if (
      cmd.includes("/pesquisar") ||
      cmd.includes("pesquise") ||
      cmd.includes("pesquisar") ||
      cmd.includes("busque") ||
      cmd.includes("buscar") ||
      cmd.includes("encontre")
    ) {
      try {
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
          } satisfies ExecuteOutput;
        }

        const [leads, users, trackings, products] = await Promise.all([
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
          prisma.tracking.findMany({
            where: { organizationId: orgId, name: { contains: termNorm, mode: "insensitive" } },
            take: 5,
            select: { id: true, name: true },
          }),
          prisma.forgeProduct.findMany({
            where: { organizationId: orgId, name: { contains: termNorm, mode: "insensitive" } },
            take: 5,
            select: { id: true, name: true },
          }),
        ]);

        const lines: string[] = [];
        if (leads.length > 0) lines.push(`👤 Leads: ${leads.map((l) => `${l.name}${l.email ? ` (${l.email})` : ""}`).join(", ")}`);
        if (users.length > 0) lines.push(`🧑‍💼 Usuários: ${users.map((m) => m.user.name ?? m.user.email).join(", ")}`);
        if (trackings.length > 0) lines.push(`📊 Trackings: ${trackings.map((t) => t.name).join(", ")}`);
        if (products.length > 0) lines.push(`📦 Produtos: ${products.map((p) => p.name).join(", ")}`);

        const total = leads.length + users.length + trackings.length + products.length;

        return {
          type: "query_result" as const,
          title: total > 0 ? `${total} resultado(s) para "${termNorm}"` : `Nenhum resultado para "${termNorm}"`,
          description: total > 0 ? lines.join("\n") : "Tente outro termo. A busca cobre: leads, usuários, trackings e produtos.",
          url: total > 0 ? "/tracking" : undefined,
          appName: "NASA",
          extraData: { leads, users: users.map((m) => m.user), trackings, products },
        } satisfies ExecuteOutput;
      } catch (err) {
        console.error("[nasa-command/execute pesquisar]", err);
        throw errors.INTERNAL_SERVER_ERROR;
      }
    }

    // ── WORKSPACE-LIST ────────────────────────────────────────────────────────
    if (isWorkspaceQuery) {
      const cost = STAR_COSTS.query;
      await tryDebitStars(cost, "busca de workspaces");

      try {
        // Busca todos os workspaces da organização com colunas e contagem de cards
        const workspaces = await prisma.workspace.findMany({
          where: { organizationId: orgId, isArchived: false },
          orderBy: { order: "asc" },
          select: {
            id: true,
            name: true,
            columns: {
              orderBy: { order: "asc" },
              select: {
                id: true,
                name: true,
                color: true,
                _count: { select: { actions: { where: { isArchived: false } } } },
                actions: {
                  where: { isArchived: false },
                  orderBy: { order: "asc" },
                  select: { id: true, title: true, isDone: true, priority: true },
                },
              },
            },
          },
        });

        if (workspaces.length === 0) {
          return {
            type: "query_result" as const,
            title: "Nenhum workspace encontrado",
            description: "Você ainda não tem workspaces criados nesta organização.",
            url: "/workspaces",
            appName: "Workspaces",
            starsSpent: cost,
          } satisfies ExecuteOutput;
        }

        // Formata a saída: workspace → colunas → cards
        const lines: string[] = [];
        const links: Array<{ label: string; url: string }> = [];

        for (const ws of workspaces) {
          const totalCards = ws.columns.reduce((s, c) => s + c._count.actions, 0);
          lines.push(`📋 **${ws.name}** — ${totalCards} card(s)`);
          links.push({ label: `Abrir ${ws.name}`, url: `/workspaces/${ws.id}` });

          if (ws.columns.length === 0) {
            lines.push("  └ Sem colunas cadastradas");
          } else {
            for (const col of ws.columns) {
              const count = col._count.actions;
              lines.push(`  📁 **${col.name}** (${count} card${count !== 1 ? "s" : ""})`);
              for (const action of col.actions) {
                const done = action.isDone ? "✅" : "⬜";
                lines.push(`    ${done} ${action.title}`);
              }
            }
          }
          lines.push(""); // linha em branco entre workspaces
        }

        const totalGlobal = workspaces.reduce(
          (s, ws) => s + ws.columns.reduce((c, col) => c + col._count.actions, 0),
          0,
        );

        return {
          type: "query_result" as const,
          title: `${workspaces.length} workspace(s) encontrado(s) — ${totalGlobal} card(s) no total`,
          description: lines.join("\n").trim(),
          url: "/workspaces",
          appName: "Workspaces",
          starsSpent: cost,
          resultLinks: links,
        } satisfies ExecuteOutput;
      } catch (err) {
        console.error("[nasa-command/execute workspace-list]", err);
        throw errors.INTERNAL_SERVER_ERROR;
      }
    }

    // ── AI FALLBACK — try to understand via connected AI ─────────────────────
    const aiIntent = await parseCommandIntent(command, orgId);
    if (aiIntent) {
      // If AI identified a clear intent with no missing fields, give a helpful prompt
      if (aiIntent.missingRequired.length > 0) {
        const fieldLabels: Record<string, string> = {
          agendaName: "nome da agenda",
          date: "data",
          time: "horário",
          leadName: "nome do lead/cliente",
          productName: "nome do produto",
          clientName: "nome do cliente",
          statusName: "status de destino",
          topic: "tema do post",
        };
        const missing = aiIntent.missingRequired.map((k) => fieldLabels[k] ?? k);
        return {
          type: "needs_input" as const,
          title: `${aiIntent.summary} — informações necessárias`,
          description: `Para ${aiIntent.summary.toLowerCase()}, preciso de: ${missing.join(", ")}.`,
          appName: aiIntent.app ?? "NASA",
          missingFields: aiIntent.missingRequired.map((k) => ({
            key: k,
            label: fieldLabels[k] ?? k,
          })),
          partialContext: { ...parsedVars, _intent: aiIntent.intent, _app: aiIntent.app ?? "" },
        } satisfies ExecuteOutput;
      }
      // AI understood but we don't have a handler yet — give a helpful generic message
      return {
        type: "query_result" as const,
        title: aiIntent.summary,
        description: `Entendi que você quer: ${aiIntent.summary}. Esta funcionalidade estará disponível em breve.`,
        appName: aiIntent.app ?? "NASA",
      } satisfies ExecuteOutput;
    }

    // ── DEFAULT FALLBACK ──────────────────────────────────────────────────────
    return {
      type: "needs_input" as const,
      title: "Não entendi o comando",
      description: "Pode reformular? Exemplos: \"Crie um agendamento para amanhã às 14h\", \"Mova o lead João para o status Proposta\", \"Crie uma proposta para Maria\".",
      appName: "NASA",
      missingFields: [],
    } satisfies ExecuteOutput;
  });
