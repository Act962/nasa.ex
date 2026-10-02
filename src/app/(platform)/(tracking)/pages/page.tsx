import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { PagesList } from "@/features/pages/components/pages-list/pages-list";

export default function Page() {
  return (
    <div className="h-full w-full">
      <HeaderTracking title="ÓRBITA Pages" isTitleHidden />
      <div className="mx-auto px-4 pt-2 pb-28 md:px-10 md:py-6">
        <PagesList />
      </div>
    </div>
  );
}
