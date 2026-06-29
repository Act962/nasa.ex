import { CourseEditor } from "@/features/nasa-route/components/creator/course-editor";

interface Params {
  courseId: string;
}

export default async function EditCoursePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { courseId } = await params;
  return <CourseEditor courseId={courseId} />;
}
