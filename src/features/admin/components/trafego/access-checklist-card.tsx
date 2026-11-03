"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { ACCESS_CHECKLIST_ITEMS, parseAccessChecklist } from "@/features/trafego/lib/release";
import { useUpdateTrafegoAccessChecklistAdmin } from "@/features/trafego/hooks/use-trafego-admin";

/** Conferência do setup pela equipe: página, Instagram, BM e parceria (spec 0126, RF-7, D-2). */
export function AccessChecklistCard({ orderId, accessChecklist }: { orderId: string; accessChecklist: unknown }) {
  const update = useUpdateTrafegoAccessChecklistAdmin();
  const [localItems, setLocalItems] = useState<Record<string, boolean> | null>(null);
  const items = localItems ?? parseAccessChecklist(accessChecklist);
  const doneCount = ACCESS_CHECKLIST_ITEMS.filter((item) => items[item.id]).length;

  function toggle(id: string, isChecked: boolean) {
    const next = { ...items, [id]: isChecked };
    setLocalItems(next);
    update.mutate(
      { orderId, items: next },
      {
        onError: (error) => {
          setLocalItems(items);
          toast.error(error.message);
        },
      },
    );
  }

  return (
    <div className="rounded-lg border p-4">
      <h3 className="text-sm font-semibold">Setup: acessos conferidos</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {doneCount} de {ACCESS_CHECKLIST_ITEMS.length}. O cliente não vê esta lista.
      </p>
      <ul className="mt-3 space-y-2">
        {ACCESS_CHECKLIST_ITEMS.map((item) => (
          <li key={item.id}>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={Boolean(items[item.id])} onCheckedChange={(value) => toggle(item.id, value === true)} />
              {item.label}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
