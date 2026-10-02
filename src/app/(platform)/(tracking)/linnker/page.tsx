import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { LinnkerPage_ } from "@/features/linnker/components/linnker-page";
import { LINNKER_COMMAND_EXAMPLES } from "@/features/linnker/lib/linnker-command-examples";

export default function Page() {
  return (
    <div className="h-full w-full">
      <HeaderTracking
        title="Linnker"
        isTitleHidden
        astroCommand={{ examples: LINNKER_COMMAND_EXAMPLES, isHiddenOnMobile: true }}
      />
      <div className="mx-auto md:px-10">
        <LinnkerPage_ />
      </div>
    </div>
  );
}
