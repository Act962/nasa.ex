import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lead } from "@/features/trackings/types";
import { getContrastColor } from "@/utils/get-contrast-color";
import { PlusIcon } from "lucide-react";

interface listTagsProps {
  tags: Lead["leadTags"];
  onOpenAddTag?: () => void;
}

export function ListTags({ tags, onOpenAddTag }: listTagsProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {tags.slice(0, 2).map(({ tag }) => {
        const textColor = getContrastColor(tag.color || "");
        return (
          <Badge
            key={tag.id}
            // variant="outline"
            className="px-1 py-0 text-[10px] h-4 font-normal"
            style={{
              backgroundColor: tag.color ?? undefined,
              color: textColor,
            }}
          >
            {tag.name}
          </Badge>
        );
      })}
      {tags.length > 2 && (
        <Badge
          variant="outline"
          className="px-1 py-0 text-[10px] h-4 font-normal bg-muted"
        >
          +{tags.length - 2}
        </Badge>
      )}
      {onOpenAddTag && (
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-white hover:bg-white/10 h-5"
          onClick={(e) => [e.stopPropagation(), onOpenAddTag()]}
        >
          <PlusIcon className="size-3" />
        </Button>
      )}
    </div>
  );
}
