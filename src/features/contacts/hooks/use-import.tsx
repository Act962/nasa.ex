import { orpc } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";
import { useSpacePointCtx } from "@/features/space-point/components/space-point-provider";

export function useMutationImport() {
  const { earn } = useSpacePointCtx();
  return useMutation(
    orpc.leads.importLead.mutationOptions({
      onSuccess: () => {
        earn("lead_import_batch", "Leads importados 📥");
      },
    }),
  );
}
