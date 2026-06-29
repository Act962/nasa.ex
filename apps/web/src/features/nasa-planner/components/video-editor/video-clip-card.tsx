"use client";

import { GripVerticalIcon, Trash2Icon, VideoIcon } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { VideoClip } from "./use-ffmpeg-editor";

interface Props {
  clip: VideoClip;
  onRemove: (id: string) => void;
}

export function VideoClipCard({ clip, onRemove }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: clip.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl border bg-background transition-shadow",
        isDragging && "shadow-lg opacity-80 z-50",
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="text-muted-foreground/50 hover:text-muted-foreground cursor-grab active:cursor-grabbing"
      >
        <GripVerticalIcon className="size-4" />
      </button>

      <div className="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <VideoIcon className="size-5 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{clip.filename}</p>
        {clip.durationSeconds !== undefined && (
          <p className="text-xs text-muted-foreground">
            {clip.durationSeconds}s
          </p>
        )}
      </div>

      <span className="text-xs text-muted-foreground shrink-0">#{clip.order}</span>

      <button
        onClick={() => onRemove(clip.id)}
        className="size-7 flex items-center justify-center rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors"
      >
        <Trash2Icon className="size-3.5" />
      </button>
    </div>
  );
}
