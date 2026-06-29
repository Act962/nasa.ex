import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { PageTemplatesGallery } from "@/features/pages/components/pages-list/pages-templates-gallery";

export default function TemplatesPage() {
  return (
    <div className="h-full w-full">
      <HeaderTracking />
      <div className="mx-auto md:px-10 py-6">
        <PageTemplatesGallery />
      </div>
    </div>
  );
}
