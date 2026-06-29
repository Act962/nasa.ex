import { FreePreviewPlayer } from "@/features/nasa-route/components/public/free-preview-player";

interface Params {
  companySlug: string;
  courseSlug: string;
  lessonId: string;
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { companySlug, courseSlug, lessonId } = await params;
  return (
    <FreePreviewPlayer
      companySlug={companySlug}
      courseSlug={courseSlug}
      lessonId={lessonId}
    />
  );
}
