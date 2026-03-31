"use client";

import { useState } from "react";
import { YoutubeIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  youtubeUrl: string | null;
  onUpdate: (url: string | null) => void;
  disabled?: boolean;
}

function getYoutubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    let videoId: string | null = null;
    if (u.hostname === "youtu.be") {
      videoId = u.pathname.slice(1);
    } else if (u.hostname.includes("youtube.com")) {
      videoId = u.searchParams.get("v");
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  } catch {
    return null;
  }
}

export function YoutubeSection({ youtubeUrl, onUpdate, disabled }: Props) {
  const [editing, setEditing] = useState(!youtubeUrl);
  const [inputValue, setInputValue] = useState(youtubeUrl ?? "");

  const embedUrl = youtubeUrl ? getYoutubeEmbedUrl(youtubeUrl) : null;

  const handleSave = () => {
    if (!inputValue.trim()) {
      onUpdate(null);
    } else {
      onUpdate(inputValue.trim());
    }
    setEditing(false);
  };

  const handleRemove = () => {
    onUpdate(null);
    setInputValue("");
    setEditing(true);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <YoutubeIcon className="size-3.5 text-red-500" />YouTube
        </span>
        {youtubeUrl && !disabled && (
          <Button size="icon" variant="ghost" className="size-5 text-destructive" onClick={handleRemove}>
            <XIcon className="size-3" />
          </Button>
        )}
      </div>

      {youtubeUrl && embedUrl ? (
        <div className="rounded-md overflow-hidden border aspect-video">
          <iframe
            src={embedUrl}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Input
            placeholder="https://youtube.com/watch?v=..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="h-8 text-xs"
            disabled={disabled}
          />
          {inputValue.trim() && (
            <Button size="sm" className="h-7 text-xs" onClick={handleSave}>
              Incorporar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
