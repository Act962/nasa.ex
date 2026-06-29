import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { PagesList } from "@/features/pages/components/pages-list/pages-list";

export default function Page() {
  return (
    <div className="h-full w-full">
      <HeaderTracking />
      <div className="mx-auto md:px-10 py-6">
        <PagesList />
      </div>
    </div>
  );
}
