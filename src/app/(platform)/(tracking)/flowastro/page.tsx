import { AttendanceFlowList } from "@/features/attendance-flows/components/attendance-flow-list";

export default function FlowAstroPage() {
  return (
    <div className="w-full min-w-0 flex-1">
      <div className="container mx-auto max-w-6xl px-4 py-6">
        <AttendanceFlowList />
      </div>
    </div>
  );
}
