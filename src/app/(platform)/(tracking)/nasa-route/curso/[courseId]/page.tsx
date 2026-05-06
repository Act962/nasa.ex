import { CourseRouteViewer } from "@/features/nasa-route/components/student/viewers/course-route-viewer";

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
 */
export default async function Page({ params }: { params: Promise<Params> }) {
  const { courseId } = await params;
  return <CourseRouteViewer courseId={courseId} />;
}
