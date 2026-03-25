import { FormPage } from "@/features/form/components/form-page";
import { HeaderTracking } from "@/features/leads/components/header-tracking";

export default function Page() {
  return (
    <div className="h-full w-full">
      <HeaderTracking />
      <FormPage />
    </div>
  );
}
