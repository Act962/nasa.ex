import { ChevronRightIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DialogClose } from "@/components/ui/dialog";
import { ReactNode } from "react";

interface HeaderProps {
  workspaceName?: string;
  actionTitle?: string;
  isLoading: boolean;
  actionMenu?: ReactNode;
  historyTrigger?: ReactNode;
}

export function ActionHeader({
  workspaceName,
  actionTitle,
  isLoading,
  actionMenu,
  historyTrigger,
}: HeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
      <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
        <span className="truncate">{workspaceName}</span>
        <ChevronRightIcon className="size-3.5 shrink-0" />
        <span className="truncate font-medium text-foreground">
          {isLoading ? <Skeleton className="h-4 w-32" /> : actionTitle}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {/* {historyTrigger} */}
        {actionMenu}
        <DialogClose asChild>
          <Button variant="ghost" size="icon" className="size-8 rounded-full">
            <XIcon className="size-4" />
          </Button>
        </DialogClose>
      </div>
    </div>
  );
}
