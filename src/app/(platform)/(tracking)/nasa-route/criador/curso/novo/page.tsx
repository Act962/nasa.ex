import { CreatorNewCoursePage } from "@/features/nasa-route/components/creator/creator-new-course-page";
import { NasaRouteShell } from "@/features/nasa-route/components/shared/nasa-route-shell";

export default function NewCoursePage() {
  return (
    <NasaRouteShell>
      <CreatorNewCoursePage />
    </NasaRouteShell>
  );
}
