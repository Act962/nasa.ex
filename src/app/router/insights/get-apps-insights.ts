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
      select: { id: true, status: true, startsAt: true, leadId: true },
    });

    const spacetimeData = {
      total:     appointments.length,
      pending:   appointments.filter((a) => a.status === "PENDING").length,
      confirmed: appointments.filter((a) => a.status === "CONFIRMED").length,
      done:      appointments.filter((a) => a.status === "DONE").length,
      cancelled: appointments.filter((a) => a.status === "CANCELLED").length,
      noShow:    appointments.filter((a) => a.status === "NO_SHOW").length,
      withLead:  appointments.filter((a) => a.leadId).length,
      conversionRate:
        appointments.length > 0
          ? (appointments.filter((a) => a.status === "DONE").length / appointments.length) * 100
          : 0,
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
    const [conversations, totalMessages] = await Promise.all([
      prisma.conversation.findMany({
        where: {
          tracking: { organizationId: { in: orgIds } },
          ...(dateFilter ? { createdAt: dateFilter } : {}),
          ...(input.trackingId ? { trackingId: input.trackingId } : {}),
          ...(tagWhereLead ? { lead: { is: tagWhereLead } } : {}),
        },
        select: { id: true, isActive: true },
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
    ]);

    // Active conversations as proxy for "attended"
    const attendedCount = conversations.filter((c) => c.isActive).length;

    const chatData = {
      totalConversations: conversations.length,
      totalMessages,
      attendedConversations: attendedCount,
      unattendedConversations: conversations.length - attendedCount,
      attendanceRate:
        conversations.length > 0
          ? (attendedCount / conversations.length) * 100
          : 0,
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
      },
      select: {
        id: true,
        type: true,
        isDone: true,
        dueDate: true,
        createdBy: true,
      },
    });

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

    const formsData = {
      totalForms: forms.length,
      publishedForms: forms.filter((f) => f.published).length,
      totalResponses: formResponses.length,
      responsesWithLead: formResponses.filter((r) => r.leadId).length,
      totalViews: forms.reduce((s, f) => s + f.views, 0),
      topForms,
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
      },
    });

    const paid = paymentEntries.filter((e) => e.status === "PAID");
    const pending = paymentEntries.filter((e) => e.status === "PENDING");
    const overdueEntries = paymentEntries.filter(
      (e) => e.status === "PENDING" && e.dueDate < now,
    );
    const revenueEntries = paid.filter((e) => e.type === "RECEIVABLE");
    const expenseEntries = paid.filter((e) => e.type === "PAYABLE");

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
        select: { id: true, source: true, paidStars: true, completedAt: true, courseId: true },
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
