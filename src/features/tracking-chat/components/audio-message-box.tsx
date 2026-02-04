"use client";

import { Button } from "@/components/ui/button";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { PauseIcon, PlayIcon, Volume2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface AudioMessageBoxProps {
  mediaUrl: string;
  mimetype: string;
}

export function AudioMessageBox({ mediaUrl, mimetype }: AudioMessageBoxProps) {
  const formatUrl = useConstructUrl(mediaUrl);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const time = parseFloat(e.target.value);
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-2xl min-w-[240px] max-w-sm">
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 rounded-full bg-foreground/10 hover:bg-foreground/20 text-foreground shrink-0"
        onClick={togglePlay}
      >
        {isPlaying ? (
          <PauseIcon className="h-5 w-5 fill-current" />
        ) : (
          <PlayIcon className="h-5 w-5 fill-current ml-0.5" />
        )}
      </Button>

      <div className="flex flex-col flex-1 gap-1 mt-2">
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSliderChange}
            className="w-full h-1.5 bg-foreground/20 rounded-lg appearance-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground"
          />
        </div>
        <div className="flex justify-between items-center text-[10px] text-muted-foreground font-medium tabular-nums">
          <span>{formatTime(currentTime)}</span>
          <div className="flex items-center gap-1 opacity-50">
            <Volume2Icon className="h-3 w-3" />
            <span>{mimetype.split("/")[1].toUpperCase()}</span>
          </div>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <audio ref={audioRef} src={formatUrl} hidden />
    </div>
  );
}
