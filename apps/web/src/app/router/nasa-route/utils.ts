import { randomBytes } from "node:crypto";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { StarTransactionType } from "@/generated/prisma/enums";
import { pusherServer } from "@/lib/pusher";
import { awardPoints } from "@/app/router/space-point/utils";

const MODERATOR_ROLES = ["owner", "moderador"];

/** Taxa retida pela plataforma sobre cada compra de curso. */
export const PLATFORM_FEE_PCT = 0.10;

// ─── Vídeo: detecta provedor + extrai ID ─────────────────────────────────

export type VideoProvider = "youtube" | "vimeo";

export interface ParsedVideo {
  provider: VideoProvider | null;
  videoId: string | null;
  embedUrl: string | null;
}

const YT_RE =
  /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/;
const VIMEO_RE_1 = /vimeo\.com\/(?:video\/)?(\d+)/;
const VIMEO_RE_2 = /player\.vimeo\.com\/video\/(\d+)/;

export function parseVideoUrl(url: string | null | undefined): ParsedVideo {
  if (!url) return { provider: null, videoId: null, embedUrl: null };

  const yt = url.match(YT_RE);
  if (yt) {
    const id = yt[1]!;
    return {
      provider: "youtube",
      videoId: id,
      embedUrl: `https://www.youtube.com/embed/${id}`,
    };
  }

  const vimeo = url.match(VIMEO_RE_1) ?? url.match(VIMEO_RE_2);
  if (vimeo) {
    const id = vimeo[1]!;
    return {
      provider: "vimeo",
      videoId: id,
      embedUrl: `https://player.vimeo.com/video/${id}`,
    };
  }

  return { provider: null, videoId: null, embedUrl: null };
}

// ─── Permissões ───────────────────────────────────────────────────────────

/** Retorna true se o user é dono/moderador da org criadora do curso. */
export async function isCourseManager(
  userId: string,
  creatorOrgId: string,
): Promise<boolean> {
  const member = await prisma.member.findFirst({
    where: { organizationId: creatorOrgId, userId },
  });
  return !!member && MODERATOR_ROLES.includes(member.role);
}

/** Lança 403 se o user não puder editar o curso (criador OU moderador da org criadora). */
export async function requireCourseManager(
  userId: string,
  courseId: string,
): Promise<{ creatorOrgId: string }> {
  const course = await prisma.nasaRouteCourse.findUnique({
    where: { id: courseId },
    select: { id: true, creatorOrgId: true, creatorUserId: true },
  });
  if (!course) {
    throw new ORPCError("NOT_FOUND", { message: "Curso não encontrado" });
  }
  if (course.creatorUserId === userId) {
    return { creatorOrgId: course.creatorOrgId };
  }
  const ok = await isCourseManager(userId, course.creatorOrgId);
  if (!ok) {
    throw new ORPCError("FORBIDDEN", {
      message: "Apenas o criador ou moderador da organização pode editar este curso",
    });
  }
  return { creatorOrgId: course.creatorOrgId };
}

/** Verifica se user tem entry na lista de acesso livre da org criadora (org-wide ou específico do curso). */
export async function canEnrollFree(
  userId: string,
  courseId: string,
  creatorOrgId: string,
): Promise<boolean> {
  const entry = await prisma.nasaRouteFreeAccess.findFirst({
    where: {
      creatorOrgId,
      userId,
      OR: [{ courseId: null }, { courseId }],
    },
    select: { id: true },
  });
  return !!entry;
}

// ─── Recompensa de conclusão de curso ─────────────────────────────────────

/**
 * Concede SP de bônus quando o curso é totalmente concluído + dispara Pusher.
 * Idempotente: só dispara uma vez por (user, course) — o caller deve chamar
 * apenas quando `completedAt` for setado pela primeira vez.
 */
export async function awardCourseRewards(opts: {
  userId: string;
  buyerOrgId: string | null;
  courseId: string;
}): Promise<{ spAwarded: number }> {
  const { userId, buyerOrgId, courseId } = opts;

  const course = await prisma.nasaRouteCourse.findUnique({
    where: { id: courseId },
    select: { id: true, title: true, slug: true, rewardSpOnComplete: true, creatorUserId: true },
  });
  if (!course) return { spAwarded: 0 };

  let spAwarded = 0;

  if (buyerOrgId) {
    // Regra padrão "complete_course" + bônus específico do curso (se houver)
    const result = await awardPoints(
      userId,
      buyerOrgId,
      "complete_course",
      `Curso concluído: ${course.title}`,
      { source: "nasa-route", courseId, courseSlug: course.slug },
    );
    spAwarded = result.points;

    // Bônus extra configurado pelo criador (não passa pela rule)
    if (course.rewardSpOnComplete > 0) {
      const userPoint = await prisma.userSpacePoint.upsert({
        where: { userId },
        create: { userId, orgId: buyerOrgId },
        update: {},
      });
      const now = new Date();
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const thisMonday = new Date(now);
      thisMonday.setDate(now.getDate() + mondayOffset);
      thisMonday.setHours(0, 0, 0, 0);

      const isSameWeek = userPoint.weekStart && userPoint.weekStart >= thisMonday;
      const newWeekly = (isSameWeek ? userPoint.weeklyPoints : 0) + course.rewardSpOnComplete;
      const newTotal = userPoint.totalPoints + course.rewardSpOnComplete;

      await prisma.$transaction([
        prisma.spacePointTransaction.create({
          data: {
            userPointId: userPoint.id,
            points: course.rewardSpOnComplete,
            description: `Bônus de conclusão: ${course.title}`,
            metadata: { source: "nasa-route", courseId, bonus: true } as any,
          },
        }),
        prisma.userSpacePoint.update({
          where: { id: userPoint.id },
          data: {
            totalPoints: newTotal,
            weeklyPoints: newWeekly,
            weekStart: isSameWeek ? userPoint.weekStart : thisMonday,
          },
        }),
      ]);
      spAwarded += course.rewardSpOnComplete;
    }
  }

  // Notifica via Pusher (popup celebratório no aluno + toast no criador)
  try {
    await pusherServer.trigger(`private-user-${userId}`, "nasaroute:course-completed", {
      courseId,
      courseTitle: course.title,
      spAwarded,
    });
    if (course.creatorUserId !== userId) {
      await pusherServer.trigger(
        `private-user-${course.creatorUserId}`,
        "nasaroute:student-completed",
        { courseId, courseTitle: course.title, studentId: userId },
      );
    }
  } catch (err) {
    console.error("[nasa-route/awardCourseRewards] pusher error:", err);
  }

  return { spAwarded };
}

// ─── Certificado ──────────────────────────────────────────────────────────

function generateCertCode(): string {
  return `NR-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/**
 * Emite um certificado para uma matrícula concluída (idempotente via
 * `enrollmentId @unique`). Retorna o certificado existente se já houver.
 */
export async function issueCertificate(opts: {
  enrollmentId: string;
}): Promise<{ id: string; code: string } | null> {
  const existing = await prisma.nasaRouteCertificate.findUnique({
    where: { enrollmentId: opts.enrollmentId },
    select: { id: true, code: true },
  });
  if (existing) return existing;

  const enrollment = await prisma.nasaRouteEnrollment.findUnique({
    where: { id: opts.enrollmentId },
    select: {
      id: true,
      userId: true,
      courseId: true,
      user: { select: { name: true } },
      course: {
        select: {
          title: true,
          durationMin: true,
          creatorOrg: { select: { name: true } },
        },
      },
    },
  });
  if (!enrollment) return null;

  // Em caso (raro) de colisão de código, tenta novamente.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const created = await prisma.nasaRouteCertificate.create({
        data: {
          code: generateCertCode(),
          userId: enrollment.userId,
          courseId: enrollment.courseId,
          enrollmentId: enrollment.id,
          studentName: enrollment.user.name,
          courseTitle: enrollment.course.title,
          orgName: enrollment.course.creatorOrg.name,
          durationMin: enrollment.course.durationMin,
        },
        select: { id: true, code: true },
      });
      return created;
    } catch (err: any) {
      if (err?.code === "P2002" && attempt < 4) continue;
      throw err;
    }
  }
  return null;
}

// ─── Star helpers (sem retentativa de moderador) ─────────────────────────
// Usamos chamadas diretas dentro de `prisma.$transaction` em purchase-course
// para garantir atomicidade entre debit do aluno + credit do criador. Por isso
// o star-service.ts não é chamado lá (ele faz transações separadas). Aqui
// expomos apenas os tipos para reuso.

export const COURSE_PURCHASE_TYPE: StarTransactionType = StarTransactionType.COURSE_PURCHASE;
export const COURSE_PAYOUT_TYPE: StarTransactionType = StarTransactionType.COURSE_PAYOUT;
