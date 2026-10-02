import { StudentsTable } from "@/features/nasa-route/components/creator/students-table";
import { NasaRouteShell } from "@/features/nasa-route/components/shared/nasa-route-shell";

export default function StudentsPage() {
  return (
    <NasaRouteShell>
      <StudentsTable />
    </NasaRouteShell>
  );
}
