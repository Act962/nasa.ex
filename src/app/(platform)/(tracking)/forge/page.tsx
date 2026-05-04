import { ForgePage } from "@/features/forge/components/forge-page";
import { AppPinnedInsightsStrip } from "@/components/app-pinned-insights-strip";

export default function Page() {
  return (
    <>
      <AppPinnedInsightsStrip appModule="forge" />
      <ForgePage />
    </>
  );
}
