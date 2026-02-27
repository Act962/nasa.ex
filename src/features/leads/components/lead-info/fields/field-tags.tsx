"use client";

import { useMutationLeadUpdate } from "@/features/leads/hooks/use-lead-update";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { LeadFull } from "@/types/lead";
import { toast } from "sonner";
import { InputEditTag } from "../input-edit-tag";
import { getContrastColor } from "@/utils/get-contrast-color";

interface FieldTagsProps {
  tags: LeadFull["lead"]["tags"];
  leadId: string;
  trackingId: string;
}

export function FieldTags({ tags, leadId, trackingId }: FieldTagsProps) {
  const [isEditing, setIsEditing] = useState(false);

  const mutation = useMutationLeadUpdate(leadId, trackingId);

  const handleSubmit = (newValue: string[]) => {
    setIsEditing(false);

    mutation.mutate(
      {
        id: leadId,
        tagIds: newValue,
      },
      {
        onError: () => {
          toast.error("Erro ao atualizar tags");
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-bold text-muted-foreground tracking-tight">
        Tags:
      </span>
      <div className="flex flex-wrap gap-2">
        {isEditing ? (
          <InputEditTag
            onSubmit={handleSubmit}
            selectedTagIds={tags.map((t) => t.id)}
            trackingId={trackingId}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <>
            {tags.map((tag) => (
              <Badge
                className="text-xs h-6"
                style={{
                  backgroundColor: tag.color || "",
                  color: getContrastColor(tag.color || ""),
                }}
                key={tag.id}
              >
                {tag.name}
              </Badge>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="hover:bg-muted"
              onClick={() => setIsEditing(true)}
            >
              {tags.length === 0 ? (
                <div className="flex items-center gap-2">
                  <PlusIcon className="size-4" />
                  Adicionar tag
                </div>
              ) : (
                <PlusIcon className="size-4" />
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
