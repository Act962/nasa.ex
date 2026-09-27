import { StarIcon } from "lucide-react";

export function StarFriendScreen() {
  return (
    <div className="flex h-60 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
      <StarIcon className="size-8" />
      <p className="text-sm font-medium">Star Friend chega em breve.</p>
    </div>
  );
}
