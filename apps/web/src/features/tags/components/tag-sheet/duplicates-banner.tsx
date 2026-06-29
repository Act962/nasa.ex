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
        className="mx-4 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40 px-3 py-2 text-left hover:bg-amber-100 dark:hover:bg-amber-950/60 transition-colors"
      >
        <AlertTriangleIcon className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
            {duplicates.totalGroups} grupo(s) de duplicatas detectado(s)
          </p>
          <p className="text-[11px] text-amber-700 dark:text-amber-300">
            Clique pra escolher qual manter (preserva leads + automações).
          </p>
        </div>
      </button>

      <DuplicateResolver open={resolverOpen} onOpenChange={setResolverOpen} />
    </>
  );
}
