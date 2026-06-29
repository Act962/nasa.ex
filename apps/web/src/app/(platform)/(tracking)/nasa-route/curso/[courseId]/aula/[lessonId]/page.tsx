import { CoursePlayerShell } from "@/features/nasa-route/components/student/course-player-shell";
import { ensureEnrollmentOrRedirect } from "@/features/nasa-route/lib/server-access";

interface Params {
  courseId: string;
  lessonId: string;
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { courseId, lessonId } = await params;
  // Permite render se a aula for free preview, mesmo sem enrollment.
  await ensureEnrollmentOrRedirect({
    courseId,
    allowFreePreviewLessonId: lessonId,
  });
  return <CoursePlayerShell courseId={courseId} initialLessonId={lessonId} />;
}
