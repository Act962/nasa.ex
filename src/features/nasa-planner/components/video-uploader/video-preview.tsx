"use client";

import { useRef, useState } from "react";
import { PlayIcon, PauseIcon, Volume2Icon, VolumeXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  videoKey: string;
  className?: string;
  label?: string;
}

function buildVideoUrl(key: string) {
  const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES;
  const endpoint = process.env.NEXT_PUBLIC_S3_PUBLIC_URL;
  if (endpoint) return `${endpoint}/${key}`;
  return `https://${bucket}.r2.dev/${key}`;
}

export function VideoPreview({ videoKey, className, label }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const url = buildVideoUrl(videoKey);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (playing) { v.pause(); setPlaying(false); }
    else { v.play(); setPlaying(true); }
  };

  return (
    <div className={cn("relative rounded-xl overflow-hidden bg-black group", className)}>
      <video
        ref={ref}
        src={url}
        muted={muted}
        loop
        playsInline
        className="w-full h-full object-cover"
        onEnded={() => setPlaying(false)}
      />
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
        <button
          onClick={toggle}
          className="size-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white hover:bg-white/30 transition-colors"
        >
          {playing ? <PauseIcon className="size-5" /> : <PlayIcon className="size-5 ml-0.5" />}
        </button>
      </div>
      <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setMuted((m) => !m)}
          className="size-7 rounded-lg bg-black/50 flex items-center justify-center text-white text-xs"
        >
          {muted ? <VolumeXIcon className="size-3.5" /> : <Volume2Icon className="size-3.5" />}
        </button>
      </div>
      {label && (
        <div className="absolute bottom-2 left-2 text-xs text-white bg-black/50 rounded px-1.5 py-0.5 truncate max-w-[120px]">
          {label}
        </div>
      )}
    </div>
  );
}
