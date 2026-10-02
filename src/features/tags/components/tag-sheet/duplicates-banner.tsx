import { useState } from "react";
import { AlertTriangleIcon } from "lucide-react";
import { DuplicateResolver } from "@/features/tags/components/duplicate-resolver";
import { useDuplicateTags } from "@/features/tags/hooks/use-tags";

export function DuplicatesBanner() {
  const { data: duplicates } = useDuplicateTags();
  const [resolverOpen, setResolverOpen] = useState(false);

  if (!duplicates || duplicates.totalGroups === 0) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setResolverOpen(true)}
        className="mx-4 flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-left hover:bg-warning/15 transition-colors"
      >
        <AlertTriangleIcon className="size-4 text-warning shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-warning">
            {duplicates.totalGroups} grupo(s) de duplicatas detectado(s)
          </p>
          <p className="text-[11px] text-warning">
            Clique pra escolher qual manter (preserva leads + automações).
          </p>
        </div>
      </button>

      <DuplicateResolver open={resolverOpen} onOpenChange={setResolverOpen} />
    </>
  );
}
