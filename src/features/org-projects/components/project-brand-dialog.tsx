"use client";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { TagIcon } from "lucide-react";
import { BrandTab } from "@/features/settings/components/brand/brand-tab";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  project: { id: string; name: string };
}

export function ProjectBrandDialog({ open, onOpenChange, project }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TagIcon className="size-4 text-violet-500" />
            Marca — {project.name}
          </DialogTitle>
        </DialogHeader>
        <BrandTab entity="project" projectId={project.id} />
      </DialogContent>
    </Dialog>
  );
}
