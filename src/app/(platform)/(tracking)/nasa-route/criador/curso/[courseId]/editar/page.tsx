import { CourseEditor } from "@/features/nasa-route/components/creator/course-editor";
import { NasaRouteShell } from "@/features/nasa-route/components/shared/nasa-route-shell";

interface Params {
  courseId: string;
}

export default async function EditCoursePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { courseId } = await params;
  return (
    <NasaRouteShell>
      <CourseEditor courseId={courseId} />
    </NasaRouteShell>
  );
}
