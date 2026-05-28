"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useQueryTagByLead,
  useToggleTag,
} from "@/features/tracking-chat/hooks/use-leads-conversation";
import { LeadFull } from "@/types/lead";
import { cn } from "@/lib/utils";
import { getContrastColor } from "@/utils/get-contrast-color";
import { ArchiveIcon, PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { InputEditTag } from "../input-edit-tag";

interface FieldTagsProps {
  tags: LeadFull["lead"]["tags"];
  leadId: string;
  trackingId: string;
}

export function FieldTags({
  tags: initialTags,
  leadId,
  trackingId,
}: FieldTagsProps) {
  const [isEditing, setIsEditing] = useState(false);

  const { tags } = useQueryTagByLead(leadId, initialTags);
  const { toggleTag } = useToggleTag(leadId, trackingId);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-bold text-muted-foreground tracking-tight">
        Tags:
      </span>
      <div className="flex flex-wrap gap-2">
        {isEditing ? (
          <InputEditTag
            onSubmit={() => setIsEditing(false)}
            selectedTagIds={tags.map((t) => t.id)}
            trackingId={trackingId}
            onCancel={() => setIsEditing(false)}
            toggleTag={toggleTag}
          />
        ) : (
          <>
            {tags.map((tag) => {
              // Tag arquivada: visual diferenciado pra deixar claro que
              // o vínculo histórico existe mas a tag não está mais ativa.
              // Click pode desvincular (toggleTag) — preserva histórico
              // do lado da Jornada via metadata.
              const isArchived = (tag as { isArchived?: boolean }).isArchived;
              return (
                <Badge
                  className={cn(
                    "text-xs h-6 group cursor-pointer transition-all hover:pr-1",
                    isArchived && "opacity-50 line-through",
                  )}
                  style={{
                    backgroundColor: tag.color || "",
                    color: getContrastColor(tag.color || ""),
                  }}
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  title={isArchived ? "Tag arquivada (histórico)" : tag.name}
                >
                  {isArchived && <ArchiveIcon className="size-2.5 mr-0.5" />}
                  {tag.name}
                  <XIcon className="ml-1 size-3 hidden group-hover:block transition-all text-current opacity-70" />
                </Badge>
              );
            })}
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
