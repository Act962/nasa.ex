import { useListActionByWorkspace } from "../../hooks/use-tasks";
import { columns } from "./columns";
import { ActionsTable } from "./table";

interface DataTableProps {
  workspaceId: string;
}

export const DataTable = ({ workspaceId }: DataTableProps) => {
  const { actions } = useListActionByWorkspace({ workspaceId });

  return (
    <div className="p-4">
      <ActionsTable columns={columns} data={actions} />
    </div>
  );
};
