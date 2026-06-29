import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { LinnkerPage_ } from "@/features/linnker/components/linnker-page";

export default function Page() {
  return (
    <div className="h-full w-full">
      <HeaderTracking />
      <div className="mx-auto md:px-10">
        <LinnkerPage_ />
      </div>
    </div>
  );
}
