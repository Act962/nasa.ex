"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { PauseIcon, PlayIcon, Volume2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface AudioMessageBoxProps {
  mediaUrl: string;
  mimetype: string;
}

export function AudioMessageBox({ mediaUrl, mimetype }: AudioMessageBoxProps) {
  const formatUrl = useConstructUrl(mediaUrl);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [wasPlayingBeforeSeek, setWasPlayingBeforeSeek] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const onEnded = () => {
      setIsPlaying(false);
      audio.currentTime = 0;
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  // Pre-process audio to generate waveform
  useEffect(() => {
    if (!formatUrl) return;

    const processAudio = async () => {
      try {
        const response = await fetch(formatUrl);
        const arrayBuffer = await response.arrayBuffer();

        const AudioContextConstructor =
          window.AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContextConstructor();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const rawData = audioBuffer.getChannelData(0);

        // Fixed samples for a fixed-width container
        const samples = 35;

        const blockSize = Math.floor(rawData.length / samples);
        const filteredData: number[] = [];

        for (let i = 0; i < samples; i++) {
          let blockStart = blockSize * i;
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum = sum + Math.abs(rawData[blockStart + j]);
          }
          filteredData.push(sum / blockSize);
        }

        const max = Math.max(...filteredData);
        const normalizedData = filteredData.map((n) => n / (max || 1));

        setWaveform(normalizedData);
        await audioContext.close();
      } catch (err) {
        console.error("Error processing audio waveform:", err);
      }
    };

    processAudio();
  }, [formatUrl]);

  // Render waveform with loading animation
  // Render waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveform.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      if (
        canvas.width !== rect.width * dpr ||
        canvas.height !== rect.height * dpr
      ) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
      }

      ctx.clearRect(0, 0, rect.width, rect.height);

      const barWidth = 3;
      const barGap = 2;
      const step = barWidth + barGap;
      const centerY = rect.height / 2;
      const color = getComputedStyle(canvas).color || "currentColor";

      waveform.forEach((value, i) => {
        const x = i * step;
        const barHeight = Math.max(4, value * rect.height * 0.8);
        const y = centerY - barHeight / 2;

        const progress = currentTime / (duration || 1);
        const isPlayed = i / waveform.length <= progress;

        ctx.fillStyle = color;
        ctx.globalAlpha = isPlayed ? 1 : 0.3;

        const radius = 1.5;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, radius);
        ctx.fill();
      });
    };

    render();
  }, [waveform, currentTime, duration]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleMouseDown = () => {
    if (isPlaying) {
      setWasPlayingBeforeSeek(true);
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      setWasPlayingBeforeSeek(false);
    }
  };
  const handleMouseUp = () => {
    if (wasPlayingBeforeSeek) {
      audioRef.current?.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-secondary/30 rounded-2xl w-[260px] shrink-0 group/card">
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

      <div className="flex flex-col flex-1 gap-1 mt-2 overflow-hidden">
        <div className="relative h-8 w-full flex items-center">
          {waveform.length === 0 ? (
            <div className="w-full">
              <Spinner />
            </div>
          ) : (
            <canvas ref={canvasRef} className="w-full h-full text-foreground" />
          )}

          <input
            type="range"
            min="0"
            max={duration || 0}
            step="0.01"
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
          />
          {waveform.length > 0 && (
            <div
              className="absolute top-1/2 -translate-y-1/2  w-3 h-3 bg-foreground rounded-full shadow-md pointer-events-none transition-opacity opacity-70 group-hover/card:opacity-100"
              style={{ left: `${(currentTime / (duration || 1)) * 90}%` }}
              onMouseDown={togglePlay}
            />
          )}
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
      <audio ref={audioRef} src={formatUrl} hidden crossOrigin="anonymous" />
    </div>
  );
}
