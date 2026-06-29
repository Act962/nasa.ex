import "server-only";
import { requireAuth } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";

/**
 * Verifica matrícula ativa do usuário logado em um curso. Se não tiver,
 * redireciona para a landing pública do curso com `?from=blocked`.
 *
 * Pensado para Server Components do player. Defense-in-depth — as
 * procedures oRPC já barram chamadas sem enrollment, mas a checagem aqui
 * evita render inicial do shell + chamada que vai falhar.
 *
 * Para aulas com `isFreePreview=true`, passe `allowFreePreviewLessonId`
 * para liberar o render mesmo sem enrollment.
 */
export async function ensureEnrollmentOrRedirect(opts: {
  courseId: string;
  allowFreePreviewLessonId?: string;
}) {
  const session = await requireAuth();
  const userId = session.user.id;

  const enrollment = await prisma.nasaRouteEnrollment.findUnique({
    where: { userId_courseId: { userId, courseId: opts.courseId } },
    select: {
      status: true,
      subscription: { select: { status: true } },
    },
  });

  const active =
    !!enrollment &&
    enrollment.status === "active" &&
    (!enrollment.subscription || enrollment.subscription.status === "active");

  if (active) return;

  if (opts.allowFreePreviewLessonId) {
    const lesson = await prisma.nasaRouteLesson.findUnique({
      where: { id: opts.allowFreePreviewLessonId },
      select: { isFreePreview: true, courseId: true },
    });
    if (
      lesson &&
      lesson.courseId === opts.courseId &&
      lesson.isFreePreview
    ) {
      return;
    }
  }

  // Não tem acesso — redireciona para a landing pública. O caminho público
  // exige slug do curso + slug da org, então buscamos.
  const course = await prisma.nasaRouteCourse.findUnique({
    where: { id: opts.courseId },
    select: {
      slug: true,
      creatorOrg: { select: { slug: true } },
    },
  });

  if (course) {
    redirect(
      `/c/${course.creatorOrg.slug}/${course.slug}?from=blocked`,
    );
  }
  redirect("/nasa-route?from=blocked");
}
