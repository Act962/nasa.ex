import { parseAsInteger, useQueryStates } from "nuqs";
import { useListActionByWorkspace } from "../../hooks/use-tasks";
import { columns } from "./columns";
import { ActionsTable } from "./table";

interface DataTableProps {
  workspaceId: string;
}

export const DataTable = ({ workspaceId }: DataTableProps) => {
  const [pagination] = useQueryStates({
    pageIndex: parseAsInteger.withDefault(0),
    pageSize: parseAsInteger.withDefault(20),
  });
  const { actions, total } = useListActionByWorkspace({
    workspaceId,
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
  });

  return (
    <div className="p-4">
      <ActionsTable columns={columns} data={actions} totalCount={total} />
    </div>
  );
};
