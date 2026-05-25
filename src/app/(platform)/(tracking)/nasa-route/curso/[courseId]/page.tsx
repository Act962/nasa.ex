import { CourseRouteViewer } from "@/features/nasa-route/components/student/viewers/course-route-viewer";
import { ensureEnrollmentOrRedirect } from "@/features/nasa-route/lib/server-access";

interface Params {
  courseId: string;
}

/**
 * Página unificada do curso pro aluno. O `CourseRouteViewer` decide qual
 * componente renderizar com base em `course.format`:
 *  - course/training/mentoring → CoursePlayerShell (player de aulas)
 *  - ebook → EbookViewer
 *  - event → EventViewer
 *  - community → CommunityViewer
 *  - subscription → SubscriptionViewer
 *
 * SSR check: redireciona para landing pública se o aluno não tem matrícula
 * ativa. Defense-in-depth — a oRPC já barra, mas evitamos render inicial.
 */
export default async function Page({ params }: { params: Promise<Params> }) {
  const { courseId } = await params;
  await ensureEnrollmentOrRedirect({ courseId });
  return <CourseRouteViewer courseId={courseId} />;
}
