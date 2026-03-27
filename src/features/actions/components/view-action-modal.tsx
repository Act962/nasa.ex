// import * as Dialog from "@radix-ui/react-dialog";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog";
import { EllipsisIcon, XIcon } from "lucide-react";
import { useQueryAction } from "../hooks/use-tasks";

interface Props {
  actionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewActionModal({ actionId, open, onOpenChange }: Props) {
  const { action, isLoading } = useQueryAction(actionId);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className=" p-0 sm:max-w-2xl lg:max-w-4xl xl:max-w-6xl bg-muted"
        showCloseButton={false}
      >
        <DialogHeader className="border-b p-4">
          <div className="flex items-center justify-between w-full">
            <DialogTitle>{action?.title}</DialogTitle>
            <div className="flex items-center gap-x-2">
              <Button variant="ghost" size="icon" className="rounded-full">
                <EllipsisIcon className="size-4" />
              </Button>
              <DialogClose asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <XIcon className="size-4" />
                </Button>
              </DialogClose>
            </div>
          </div>
        </DialogHeader>

        <div>
          <pre>{JSON.stringify(action, null, 2)}</pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}
