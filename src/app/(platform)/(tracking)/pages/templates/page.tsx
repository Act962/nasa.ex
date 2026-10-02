import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { PageTemplatesGallery } from "@/features/pages/components/pages-list/pages-templates-gallery";

export default function TemplatesPage() {
  return (
    <div className="h-full w-full">
      <HeaderTracking title="Templates" isTitleHidden />
      <div className="mx-auto px-4 pt-2 pb-28 md:px-10 md:py-6">
        <PageTemplatesGallery />
      </div>
    </div>
  );
}
