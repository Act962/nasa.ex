import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getAppsInsights = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      organizationIds: z.array(z.string()).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      trackingId: z.string().optional(),
      tagIds: z.array(z.string()).optional(),
      workspaceIds: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const orgId = context.org.id;
    const orgIds = input.organizationIds?.length ? input.organizationIds : [orgId];

    const dateFilter =
      input.startDate && input.endDate
        ? {
            gte: new Date(input.startDate),
            lte: new Date(input.endDate),
          }
        : undefined;

    const tagWhereLead =
      input.tagIds && input.tagIds.length > 0
        ? { leadTags: { some: { tagId: { in: input.tagIds } } } }
        : undefined;

    // ── Forge: Proposals ─────────────────────────────────────────────────────
    // tagIds filter: ForgeProposal vincula via clientId (Lead opcional). Quando
    // há tagIds, propostas sem cliente são excluídas (não há tag para casar).
    const [proposals, contracts] = await Promise.all([
      prisma.forgeProposal.findMany({
        where: {
          organizationId: { in: orgIds },
          ...(dateFilter ? { createdAt: dateFilter } : {}),
          ...(tagWhereLead ? { client: { is: tagWhereLead } } : {}),
        },
        include: {
          products: { select: { unitValue: true, quantity: true, discount: true } },
        },
      }),
      prisma.forgeContract.findMany({
        where: {
          organizationId: { in: orgIds },
          ...(dateFilter ? { createdAt: dateFilter } : {}),
          ...(tagWhereLead ? { proposal: { client: { is: tagWhereLead } } } : {}),
        },
        select: { id: true, status: true, value: true, createdAt: true },
      }),
    ]);

    const calcProposalValue = (p: typeof proposals[0]) =>
      p.products.reduce((sum: number, prod) => {
        const base = Number(prod.unitValue) * Number(prod.quantity ?? 1);
        const disc = Number(prod.discount ?? 0);
        return sum + base - disc;
      }, 0);

    // Tempo médio entre criação e mudança pra PAGA — usa updatedAt como
    // proxy do paidAt (não há campo dedicado no schema). Vale só pra
    // propostas com status final PAGA. Resultado em horas.
    const paidProposals = proposals.filter((p) => p.status === "PAGA");
    const avgTimeToPaid =
      paidProposals.length > 0
        ? paidProposals.reduce(
            (sum, p) => sum + (p.updatedAt.getTime() - p.createdAt.getTime()),
            0,
          ) /
          paidProposals.length /
          (1000 * 60 * 60)
        : 0;

    // Desconto médio aplicado — combina o discount top-level (ForgeProposal)
    // com o discount por produto. Calculado como % sobre valor bruto.
    const discountStats = proposals.reduce(
      (acc, p) => {
        const gross = p.products.reduce(
          (s, prod) => s + Number(prod.unitValue) * Number(prod.quantity ?? 1),
          0,
        );
        if (gross <= 0) return acc;
        const productDiscount = p.products.reduce(
          (s, prod) => s + Number(prod.discount ?? 0),
          0,
        );
        const topDiscount = Number(p.discount ?? 0);
        // Assume top-level discount em valor absoluto quando type=FIXO, ou
        // % quando PERCENTUAL — defensivo: trata sempre como absoluto se < gross
        const totalDiscount =
          p.discountType === "PERCENTUAL"
            ? (gross * topDiscount) / 100 + productDiscount
            : topDiscount + productDiscount;
        acc.totalGross += gross;
        acc.totalDiscount += totalDiscount;
        acc.count++;
        return acc;
      },
      { totalGross: 0, totalDiscount: 0, count: 0 },
    );
    const avgDiscount =
      discountStats.totalGross > 0
        ? (discountStats.totalDiscount / discountStats.totalGross) * 100
        : 0;

    // Receita "perdida" — propostas que nunca vão converter (canceladas + expiradas)
    const lostRevenue = proposals
      .filter((p) => p.status === "CANCELADA" || p.status === "EXPIRADA")
      .reduce((sum, p) => sum + calcProposalValue(p), 0);

    const forgeData = {
      totalProposals: proposals.length,
      rascunho:    proposals.filter((p) => p.status === "RASCUNHO").length,
      enviadas:    proposals.filter((p) => p.status === "ENVIADA").length,
      visualizadas: proposals.filter((p) => p.status === "VISUALIZADA").length,
      pagas:       proposals.filter((p) => p.status === "PAGA").length,
      expiradas:   proposals.filter((p) => p.status === "EXPIRADA").length,
      canceladas:  proposals.filter((p) => p.status === "CANCELADA").length,
      revenueTotal: proposals
        .filter((p) => p.status === "PAGA")
        .reduce((sum, p) => sum + calcProposalValue(p), 0),
      revenuePipeline: proposals
        .filter((p) => ["ENVIADA", "VISUALIZADA"].includes(p.status))
        .reduce((sum, p) => sum + calcProposalValue(p), 0),
      totalContracts: contracts.length,
      contractsAtivo: contracts.filter((c) => c.status === "ATIVO").length,
      contractsAssinado: contracts.filter((c) => c.status === "PENDENTE_ASSINATURA").length,
      // Novos KPIs
      avgTimeToPaid,
      avgDiscount,
      lostRevenue,
    };

    // ── Spacetime: Appointments ──────────────────────────────────────────────
    // tagIds: Appointment.lead é opcional → quando há tagIds, exige lead com tag.
    const appointments = await prisma.appointment.findMany({
      where: {
        agenda: { organizationId: { in: orgIds } },
        ...(dateFilter ? { startsAt: dateFilter } : {}),
        ...(input.trackingId ? { trackingId: input.trackingId } : {}),
        ...(tagWhereLead ? { lead: { is: tagWhereLead } } : {}),
      },
      select: {
        id: true,
        status: true,
        startsAt: true,
        endsAt: true,
        leadId: true,
      },
    });

    const noShowCount = appointments.filter((a) => a.status === "NO_SHOW").length;
    // Duração média em horas (entre `startsAt` e `endsAt`)
    const avgDurationSpacetime =
      appointments.length > 0
        ? appointments.reduce(
            (sum, a) => sum + (a.endsAt.getTime() - a.startsAt.getTime()),
            0,
          ) /
          appointments.length /
          (1000 * 60 * 60)
        : 0;

    const spacetimeData = {
      total:     appointments.length,
      pending:   appointments.filter((a) => a.status === "PENDING").length,
      confirmed: appointments.filter((a) => a.status === "CONFIRMED").length,
      done:      appointments.filter((a) => a.status === "DONE").length,
      cancelled: appointments.filter((a) => a.status === "CANCELLED").length,
      noShow:    noShowCount,
      withLead:  appointments.filter((a) => a.leadId).length,
      conversionRate:
        appointments.length > 0
          ? (appointments.filter((a) => a.status === "DONE").length / appointments.length) * 100
          : 0,
      // Novos KPIs
      noShowRate:
        appointments.length > 0 ? (noShowCount / appointments.length) * 100 : 0,
      avgDuration: avgDurationSpacetime,
    };

    // ── NASA Planner ────────────────────────────────────────────────────────────
    // tagIds: NasaPlannerPost não tem relação com Lead → filtro por tag não se aplica.
    const posts = await prisma.nasaPlannerPost.findMany({
      where: {
        organizationId: { in: orgIds },
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      select: { id: true, status: true, targetNetworks: true, starsSpent: true, createdAt: true },
    });

    const nasaPlannerData = {
      total:      posts.length,
      draft:      posts.filter((p) => p.status === "DRAFT").length,
      published:  posts.filter((p) => p.status === "PUBLISHED").length,
      scheduled:  posts.filter((p) => p.status === "SCHEDULED").length,
      approved:   posts.filter((p) => p.status === "APPROVED").length,
      starsSpent: posts.reduce((s, p) => s + p.starsSpent, 0),
      byNetwork:  posts.reduce<Record<string, number>>((acc, p) => {
        p.targetNetworks.forEach((n) => { acc[n] = (acc[n] ?? 0) + 1; });
        return acc;
      }, {}),
    };

    // ── Chat: Conversations & Messages ───────────────────────────────────────
    // tagIds: Conversation.lead é obrigatório → filtro funciona sem perda.
    const [conversations, totalMessages, fromMeMessages] = await Promise.all([
      prisma.conversation.findMany({
        where: {
          tracking: { organizationId: { in: orgIds } },
          ...(dateFilter ? { createdAt: dateFilter } : {}),
          ...(input.trackingId ? { trackingId: input.trackingId } : {}),
          ...(tagWhereLead ? { lead: { is: tagWhereLead } } : {}),
        },
        // createdAt + lastMessageAt pra calcular duração média
        select: { id: true, isActive: true, createdAt: true, lastMessageAt: true },
      }),
      prisma.message.count({
        where: {
          conversation: {
            tracking: { organizationId: { in: orgIds } },
            ...(input.trackingId ? { trackingId: input.trackingId } : {}),
            ...(tagWhereLead ? { lead: { is: tagWhereLead } } : {}),
          },
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
      }),
      // Mensagens enviadas pelo time (fromMe=true) — pro fromMeRatio
      prisma.message.count({
        where: {
          fromMe: true,
          conversation: {
            tracking: { organizationId: { in: orgIds } },
            ...(input.trackingId ? { trackingId: input.trackingId } : {}),
            ...(tagWhereLead ? { lead: { is: tagWhereLead } } : {}),
          },
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
      }),
    ]);

    // Active conversations as proxy for "attended"
    const attendedCount = conversations.filter((c) => c.isActive).length;

    // Duração média da conversa em horas (criação → última mensagem)
    const avgConversationDuration =
      conversations.length > 0
        ? conversations.reduce(
            (sum, c) =>
              sum + (c.lastMessageAt.getTime() - c.createdAt.getTime()),
            0,
          ) /
          conversations.length /
          (1000 * 60 * 60)
        : 0;

    const chatData = {
      totalConversations: conversations.length,
      totalMessages,
      attendedConversations: attendedCount,
      unattendedConversations: conversations.length - attendedCount,
      attendanceRate:
        conversations.length > 0
          ? (attendedCount / conversations.length) * 100
          : 0,
      // Novos KPIs
      avgConversationDuration,
      fromMeRatio:
        totalMessages > 0 ? (fromMeMessages / totalMessages) * 100 : 0,
    };

    // ── Workspace: Actions ───────────────────────────────────────────────────
    // tagIds: Action.lead é opcional → quando há tagIds, exige lead com tag.
    const now = new Date();
    const actions = await prisma.action.findMany({
      where: {
        organizationId: { in: orgIds },
        isArchived: false,
        ...(dateFilter ? { createdAt: dateFilter } : {}),
        ...(input.trackingId ? { trackingId: input.trackingId } : {}),
        ...(tagWhereLead ? { lead: { is: tagWhereLead } } : {}),
        ...(input.workspaceIds && input.workspaceIds.length > 0
          ? { workspaceId: { in: input.workspaceIds } }
          : {}),
      },
      select: {
        id: true,
        type: true,
        isDone: true,
        dueDate: true,
        createdBy: true,
        createdAt: true,
        closedAt: true,
      },
    });

    // Subactions vinculadas — usadas pro KPI `subactionRatio`
    const subactionCount =
      actions.length > 0
        ? await prisma.subActions.count({
            where: { actionId: { in: actions.map((a) => a.id) } },
          })
        : 0;

    const actionCreatorCount = actions.reduce<Record<string, number>>((acc, a) => {
      acc[a.createdBy] = (acc[a.createdBy] ?? 0) + 1;
      return acc;
    }, {});
    const topCreatorIds = Object.entries(actionCreatorCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);
    const topCreators = topCreatorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: topCreatorIds } },
          select: { id: true, name: true, image: true },
        })
      : [];

    // Tempo médio entre criação e fechamento (Actions finalizadas) em horas
    const closedActions = actions.filter((a) => a.isDone && a.closedAt);
    const avgCompletionTime =
      closedActions.length > 0
        ? closedActions.reduce(
            (sum, a) =>
              sum + (a.closedAt!.getTime() - a.createdAt.getTime()),
            0,
          ) /
          closedActions.length /
          (1000 * 60 * 60)
        : 0;

    // Top criador mais rápido — agrupa por createdBy entre closedActions
    // (média de tempo em horas) e pega o user com menor média.
    const closeTimeByCreator = new Map<string, { sum: number; count: number }>();
    for (const a of closedActions) {
      const cur = closeTimeByCreator.get(a.createdBy) ?? { sum: 0, count: 0 };
      cur.sum += a.closedAt!.getTime() - a.createdAt.getTime();
      cur.count++;
      closeTimeByCreator.set(a.createdBy, cur);
    }
    const fastestCreatorEntry = Array.from(closeTimeByCreator.entries())
      .filter(([, v]) => v.count >= 2) // exige pelo menos 2 ações pra ranking justo
      .map(([id, v]) => ({
        id,
        avgHours: v.sum / v.count / (1000 * 60 * 60),
        count: v.count,
      }))
      .sort((a, b) => a.avgHours - b.avgHours)[0];

    const topFastestCreator = fastestCreatorEntry
      ? {
          id: fastestCreatorEntry.id,
          name:
            topCreators.find((u) => u.id === fastestCreatorEntry.id)?.name ??
            "—",
          avgHours: fastestCreatorEntry.avgHours,
          count: fastestCreatorEntry.count,
        }
      : null;

    const workspaceData = {
      total: actions.length,
      done: actions.filter((a) => a.isDone).length,
      open: actions.filter((a) => !a.isDone).length,
      overdue: actions.filter((a) => !a.isDone && a.dueDate && a.dueDate < now).length,
      byType: actions.reduce<Record<string, number>>((acc, a) => {
        acc[a.type] = (acc[a.type] ?? 0) + 1;
        return acc;
      }, {}),
      topCreators: topCreators.map((u) => ({
        id: u.id,
        name: u.name,
        image: u.image,
        count: actionCreatorCount[u.id] ?? 0,
      })),
      // Novos KPIs
      avgCompletionTime,
      topFastestCreator,
      subactionRatio: actions.length > 0 ? subactionCount / actions.length : 0,
    };

    // ── Forms ────────────────────────────────────────────────────────────────
    // tagIds: filtro aplicado em FormResponses.lead. Form em si não tem lead.
    const [forms, formResponses] = await Promise.all([
      prisma.form.findMany({
        where: {
          organizationId: { in: orgIds },
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
        select: { id: true, name: true, published: true, views: true, responses: true },
      }),
      prisma.formResponses.findMany({
        where: {
          form: { organizationId: { in: orgIds } },
          ...(dateFilter ? { createdAt: dateFilter } : {}),
          ...(tagWhereLead ? { lead: { is: tagWhereLead } } : {}),
        },
        select: { id: true, formId: true, leadId: true },
      }),
    ]);

    const responsesByForm = formResponses.reduce<Record<string, number>>((acc, r) => {
      acc[r.formId] = (acc[r.formId] ?? 0) + 1;
      return acc;
    }, {});
    const topForms = Object.entries(responsesByForm)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([formId, count]) => ({
        id: formId,
        name: forms.find((f) => f.id === formId)?.name ?? "Unknown",
        responses: count,
      }));

    const totalFormViews = forms.reduce((s, f) => s + f.views, 0);
    const formsData = {
      totalForms: forms.length,
      publishedForms: forms.filter((f) => f.published).length,
      totalResponses: formResponses.length,
      responsesWithLead: formResponses.filter((r) => r.leadId).length,
      totalViews: totalFormViews,
      topForms,
      // Novo KPI: 1 - (responses/views); fica 0% quando não tem views.
      abandonRate:
        totalFormViews > 0
          ? Math.max(0, (1 - formResponses.length / totalFormViews) * 100)
          : 0,
    };

    // ── N-Box ────────────────────────────────────────────────────────────────
    // tagIds: NBoxItem não tem relação com Lead → filtro por tag não se aplica.
    const nboxItems = await prisma.nBoxItem.findMany({
      where: {
        organizationId: { in: orgIds },
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      select: { id: true, type: true, size: true, isPublic: true },
    });

    const nboxData = {
      totalItems: nboxItems.length,
      publicItems: nboxItems.filter((i) => i.isPublic).length,
      totalSize: nboxItems.reduce((s, i) => s + (i.size ?? 0), 0),
      byType: nboxItems.reduce<Record<string, number>>((acc, i) => {
        acc[i.type] = (acc[i.type] ?? 0) + 1;
        return acc;
      }, {}),
    };

    // ── Payment: PaymentEntry ────────────────────────────────────────────────
    // tagIds: PaymentEntry não tem relação com Lead → filtro por tag não se aplica.
    // Período: usa competenceDate quando preenchido, senão dueDate.
    const paymentDateFilter = dateFilter
      ? {
          OR: [
            { competenceDate: dateFilter },
            { AND: [{ competenceDate: null }, { dueDate: dateFilter }] },
          ],
        }
      : {};
    const paymentEntries = await prisma.paymentEntry.findMany({
      where: {
        organizationId: { in: orgIds },
        ...paymentDateFilter,
      },
      select: {
        id: true,
        type: true,
        status: true,
        amount: true,
        paidAmount: true,
        dueDate: true,
        paidAt: true,
      },
    });

    const paid = paymentEntries.filter((e) => e.status === "PAID");
    const pending = paymentEntries.filter((e) => e.status === "PENDING");
    const overdueEntries = paymentEntries.filter(
      (e) => e.status === "PENDING" && e.dueDate < now,
    );
    const revenueEntries = paid.filter((e) => e.type === "RECEIVABLE");
    const expenseEntries = paid.filter((e) => e.type === "PAYABLE");

    // DSR (Days Sales Receivable) — média de dias entre vencimento e
    // pagamento pra entries RECEIVABLE pagas. Pode ser negativo quando
    // o pagamento aconteceu antes do vencimento.
    const dsrSamples = revenueEntries.filter((e) => e.paidAt && e.dueDate);
    const avgDSR =
      dsrSamples.length > 0
        ? dsrSamples.reduce(
            (sum, e) =>
              sum + (e.paidAt!.getTime() - e.dueDate.getTime()),
            0,
          ) /
          dsrSamples.length /
          (1000 * 60 * 60 * 24)
        : 0;

    const paymentData = {
      totalEntries: paymentEntries.length,
      revenue: revenueEntries.reduce((s, e) => s + e.paidAmount, 0) / 100,
      expense: expenseEntries.reduce((s, e) => s + e.paidAmount, 0) / 100,
      pendingCount: pending.length,
      pendingAmount: pending.reduce((s, e) => s + e.amount, 0) / 100,
      overdueCount: overdueEntries.length,
      overdueAmount: overdueEntries.reduce((s, e) => s + e.amount, 0) / 100,
      avgTicket:
        paid.length > 0
          ? paid.reduce((s, e) => s + e.paidAmount, 0) / paid.length / 100
          : 0,
      // Novo KPI — em dias. O catálogo converte exibição.
      avgDSR: avgDSR * 24, // converte dias → horas pro format=duration
    };

    // ── Linnker ──────────────────────────────────────────────────────────────
    // tagIds: aplicado via LinnkerScan.lead.
    const [scans, linnkerLinks] = await Promise.all([
      prisma.linnkerScan.findMany({
        where: {
          page: { organizationId: { in: orgIds } },
          ...(dateFilter ? { createdAt: dateFilter } : {}),
          ...(tagWhereLead ? { lead: { is: tagWhereLead } } : {}),
        },
        select: { id: true, leadId: true, pageId: true },
      }),
      prisma.linnkerLink.findMany({
        where: {
          page: { organizationId: { in: orgIds } },
          isActive: true,
        },
        select: { id: true, title: true, clicks: true },
        orderBy: { clicks: "desc" },
        take: 5,
      }),
    ]);

    const linnkerData = {
      totalScans: scans.length,
      scansWithLead: scans.filter((s) => s.leadId).length,
      totalClicks: linnkerLinks.reduce((s, l) => s + l.clicks, 0),
      topLinks: linnkerLinks.map((l) => ({
        id: l.id,
        title: l.title,
        clicks: l.clicks,
      })),
    };

    // ── Space Points ─────────────────────────────────────────────────────────
    // tagIds: SpacePoint não tem relação com Lead → filtro por tag não se aplica.
    const userSpacePoints = await prisma.userSpacePoint.findMany({
      where: {
        orgId: { in: orgIds },
      },
      select: {
        id: true,
        userId: true,
        totalPoints: true,
        weeklyPoints: true,
      },
    });
    const userPointIds = userSpacePoints.map((u) => u.id);
    const pointTransactions = userPointIds.length
      ? await prisma.spacePointTransaction.findMany({
          where: {
            userPointId: { in: userPointIds },
            ...(dateFilter ? { createdAt: dateFilter } : {}),
          },
          select: { points: true, userPointId: true },
        })
      : [];

    const spacePointsData = {
      totalBalance: userSpacePoints.reduce((s, u) => s + u.totalPoints, 0),
      weeklyBalance: userSpacePoints.reduce((s, u) => s + u.weeklyPoints, 0),
      granted: pointTransactions
        .filter((t) => t.points > 0)
        .reduce((s, t) => s + t.points, 0),
      spent: Math.abs(
        pointTransactions
          .filter((t) => t.points < 0)
          .reduce((s, t) => s + t.points, 0),
      ),
      activeUsers: new Set(pointTransactions.map((t) => t.userPointId)).size,
      totalUsers: userSpacePoints.length,
    };

    // ── Stars ────────────────────────────────────────────────────────────────
    // tagIds: StarTransaction não tem relação com Lead → filtro por tag não se aplica.
    const starTransactions = await prisma.starTransaction.findMany({
      where: {
        organizationId: { in: orgIds },
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      select: {
        id: true,
        type: true,
        amount: true,
        balanceAfter: true,
        appSlug: true,
        organizationId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const lastBalanceByOrg = starTransactions.reduce<Record<string, number>>(
      (acc, t) => {
        if (acc[t.organizationId] === undefined) acc[t.organizationId] = t.balanceAfter;
        return acc;
      },
      {},
    );
    const lastBalance = Object.values(lastBalanceByOrg).reduce((s, v) => s + v, 0);

    const starsData = {
      lastBalance,
      topupTotal: starTransactions
        .filter((t) => t.type === "TOPUP_PURCHASE")
        .reduce((s, t) => s + t.amount, 0),
      appCharges: Math.abs(
        starTransactions
          .filter((t) => t.type === "APP_CHARGE")
          .reduce((s, t) => s + t.amount, 0),
      ),
      planCredit: starTransactions
        .filter((t) => t.type === "PLAN_CREDIT")
        .reduce((s, t) => s + t.amount, 0),
      byApp: starTransactions
        .filter((t) => t.type === "APP_CHARGE" && t.appSlug)
        .reduce<Record<string, number>>((acc, t) => {
          const k = t.appSlug as string;
          acc[k] = (acc[k] ?? 0) + Math.abs(t.amount);
          return acc;
        }, {}),
    };

    // ── Space Station ────────────────────────────────────────────────────────
    const [stations, accessRequests, starsSentByOrgUsers, starsReceivedByOrgStations] =
      await Promise.all([
        prisma.spaceStation.findMany({
          where: {
            OR: [
              { orgId: { in: orgIds } },
              { user: { members: { some: { organizationId: { in: orgIds } } } } },
            ],
          },
          select: {
            id: true,
            type: true,
            isPublic: true,
            rank: true,
            starsReceived: true,
            accessMode: true,
          },
        }),
        prisma.stationAccessRequest.findMany({
          where: {
            station: {
              OR: [
                { orgId: { in: orgIds } },
                { user: { members: { some: { organizationId: { in: orgIds } } } } },
              ],
            },
            ...(dateFilter ? { createdAt: dateFilter } : {}),
          },
          select: { id: true, status: true },
        }),
        prisma.spaceStationStar.findMany({
          where: {
            from: {
              OR: [
                { orgId: { in: orgIds } },
                { user: { members: { some: { organizationId: { in: orgIds } } } } },
              ],
            },
            ...(dateFilter ? { createdAt: dateFilter } : {}),
          },
          select: { id: true, amount: true },
        }),
        prisma.spaceStationStar.findMany({
          where: {
            to: {
              OR: [
                { orgId: { in: orgIds } },
                { user: { members: { some: { organizationId: { in: orgIds } } } } },
              ],
            },
            ...(dateFilter ? { createdAt: dateFilter } : {}),
          },
          select: { id: true, amount: true },
        }),
      ]);

    const spaceStationData = {
      totalStations: stations.length,
      publicStations: stations.filter((s) => s.isPublic).length,
      orgStations: stations.filter((s) => s.type === "ORG").length,
      userStations: stations.filter((s) => s.type === "USER").length,
      totalStarsReceived: stations.reduce((s, st) => s + st.starsReceived, 0),
      starsSentInPeriod: starsSentByOrgUsers.reduce((s, st) => s + st.amount, 0),
      starsReceivedInPeriod: starsReceivedByOrgStations.reduce((s, st) => s + st.amount, 0),
      pendingAccessRequests: accessRequests.filter((r) => r.status === "PENDING").length,
      approvedAccessRequests: accessRequests.filter((r) => r.status === "APPROVED").length,
    };

    // ── NASA Route ───────────────────────────────────────────────────────────
    const [routeCourses, enrollments, progress, certificates] = await Promise.all([
      prisma.nasaRouteCourse.findMany({
        where: {
          creatorOrgId: { in: orgIds },
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
        select: {
          id: true,
          title: true,
          isPublished: true,
          studentsCount: true,
          priceStars: true,
          format: true,
        },
      }),
      prisma.nasaRouteEnrollment.findMany({
        where: {
          OR: [
            { course: { creatorOrgId: { in: orgIds } } },
            { buyerOrgId: { in: orgIds } },
          ],
          ...(dateFilter ? { enrolledAt: dateFilter } : {}),
        },
        select: {
          id: true,
          source: true,
          paidStars: true,
          completedAt: true,
          courseId: true,
          enrolledAt: true,
          userId: true,
          certificate: { select: { id: true, issuedAt: true } },
        },
      }),
      prisma.nasaRouteProgress.findMany({
        where: {
          course: { creatorOrgId: { in: orgIds } },
          ...(dateFilter ? { startedAt: dateFilter } : {}),
        },
        select: { id: true, completedAt: true, completedLessonIds: true },
      }),
      prisma.nasaRouteCertificate.findMany({
        where: {
          course: { creatorOrgId: { in: orgIds } },
          ...(dateFilter ? { issuedAt: dateFilter } : {}),
        },
        select: { id: true },
      }),
    ]);

    const enrollmentsByCourse = enrollments.reduce<Record<string, number>>((acc, e) => {
      acc[e.courseId] = (acc[e.courseId] ?? 0) + 1;
      return acc;
    }, {});
    const topCourses = Object.entries(enrollmentsByCourse)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({
        id,
        title: routeCourses.find((c) => c.id === id)?.title ?? "Curso",
        enrollments: count,
      }));

    // % de matrículas com curso concluído (usa `completedAt` do enrollment)
    const completedEnrollments = enrollments.filter((e) => e.completedAt);
    const completionRate =
      enrollments.length > 0
        ? (completedEnrollments.length / enrollments.length) * 100
        : 0;

    // Tempo médio (horas) entre matrícula e emissão do certificado pra
    // enrollments que receberam certificado.
    const certifiedEnrollments = enrollments.filter(
      (e): e is typeof e & { certificate: { id: string; issuedAt: Date } } =>
        !!e.certificate?.issuedAt,
    );
    const avgTimeToCertificate =
      certifiedEnrollments.length > 0
        ? certifiedEnrollments.reduce(
            (sum, e) =>
              sum +
              (e.certificate.issuedAt.getTime() - e.enrolledAt.getTime()),
            0,
          ) /
          certifiedEnrollments.length /
          (1000 * 60 * 60)
        : 0;

    const nasaRouteData = {
      totalCourses: routeCourses.length,
      publishedCourses: routeCourses.filter((c) => c.isPublished).length,
      totalStudents: routeCourses.reduce((s, c) => s + c.studentsCount, 0),
      totalEnrollments: enrollments.length,
      paidEnrollments: enrollments.filter((e) => e.source === "purchase").length,
      freeEnrollments: enrollments.filter((e) => e.source === "free_access").length,
      starsRevenue: enrollments.reduce((s, e) => s + e.paidStars, 0),
      completedCourses: progress.filter((p) => p.completedAt).length,
      completedLessons: progress.reduce((s, p) => s + p.completedLessonIds.length, 0),
      certificatesIssued: certificates.length,
      topCourses,
      // Novos KPIs
      completionRate,
      avgTimeToCertificate,
    };

    return {
      forge:        forgeData,
      spacetime:    spacetimeData,
      nasaPlanner:  nasaPlannerData,
      chat:         chatData,
      workspace:    workspaceData,
      forms:        formsData,
      nbox:         nboxData,
      payment:      paymentData,
      linnker:      linnkerData,
      spacePoints:  spacePointsData,
      stars:        starsData,
      spaceStation: spaceStationData,
      nasaRoute:    nasaRouteData,
      period:       { startDate: input.startDate, endDate: input.endDate },
    };
  });
