"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { DuplicatesBanner } from "./duplicates-banner";
import { TagCreateForm } from "./tag-create-form";
import { TagList } from "./tag-list";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackingId?: string;
}

export function TagSheet({ open, onOpenChange, trackingId }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Tags</SheetTitle>
          <SheetDescription>
            Adicione tags para categorizar seus leads.
          </SheetDescription>
        </SheetHeader>

        <DuplicatesBanner />

        <div className="space-y-4 flex flex-col flex-1 min-h-0 overflow-y-auto scroll-cols-tracking">
          <TagCreateForm open={open} trackingId={trackingId} />

          <Separator className="my-4" />

          <TagList />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export { TagItem } from "./tag-item";
export { ArchivedTagItem } from "./archived-tag-item";
export type { TagItemProps } from "./types";
