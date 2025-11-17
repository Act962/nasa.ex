"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLeads } from "@/hooks/use-lead";

export function LeadModal() {
  const lead = useLeads();

  return (
    <Dialog open={lead.isOpen} onOpenChange={lead.onClose}>
      <DialogContent className="w-full md:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Lead</DialogTitle>
        </DialogHeader>
        <div>TODO: Conteúdo</div>
      </DialogContent>
    </Dialog>
  );
}
