import { Agenda } from "@/features/agenda/components/agenda";
import { HeaderTracking } from "../_components/header-tracking";

export default function Page() {
  return (
    <div className="w-full">
      <HeaderTracking title="Agenda" />
      <Agenda />
    </div>
  );
}
