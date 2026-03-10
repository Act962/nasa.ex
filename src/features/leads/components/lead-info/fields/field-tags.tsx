"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useQueryTagByLead,
  useToggleTag,
} from "@/features/tracking-chat/hooks/use-leads-conversation";
import { LeadFull } from "@/types/lead";
import { getContrastColor } from "@/utils/get-contrast-color";
import { PlusIcon, XIcon } from "lucide-react";
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
            {tags.map((tag) => (
              <Badge
                className="text-xs h-6 group cursor-pointer transition-all hover:pr-1"
                style={{
                  backgroundColor: tag.color || "",
                  color: getContrastColor(tag.color || ""),
                }}
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
              >
                {tag.name}
                <XIcon className="ml-1 size-3 hidden group-hover:block transition-all text-current opacity-70" />
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
