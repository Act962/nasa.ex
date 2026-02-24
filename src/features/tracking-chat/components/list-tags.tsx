import { Badge } from "@/components/ui/badge";
import { Lead } from "@/features/trackings/types";

interface listTagsProps {
  tags: Lead["leadTags"];
}

export function ListTags({ tags }: listTagsProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {tags.slice(0, 2).map(({ tag }) => (
        <Badge
          key={tag.id}
          // variant="outline"
          className="px-1 py-0 text-[10px] h-4 font-normal"
        >
          {tag.name}
        </Badge>
      ))}
      {tags.length > 2 && (
        <Badge
          variant="outline"
          className="px-1 py-0 text-[10px] h-4 font-normal bg-muted"
        >
          +{tags.length - 2}
        </Badge>
      )}
    </div>
  );
}
