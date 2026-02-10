"use client";

import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import {
  MicIcon,
  PauseIcon,
  PlayIcon,
  SendIcon,
  Trash2Icon,
  CircleStopIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SendAudioProps {
  onSend: (audioBlob: Blob) => void;
  onCancel: () => void;
  disabled?: boolean;
}

const isRecordingSupported =
  typeof window !== "undefined" &&
  !!navigator.mediaDevices &&
  typeof navigator.mediaDevices.getUserMedia === "function" &&
  typeof window.MediaRecorder === "function";

export function SendAudio({ onSend, onCancel, disabled }: SendAudioProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentPlayerTime, setCurrentPlayerTime] = useState<number>(0);

  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer logic
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording, isPaused]);

  // Player time logic
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentPlayerTime(audio.currentTime);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("ended", onEnded);
    };
  }, [recordedAudioUrl]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    handleStartRecording();
  }, []);

  async function handleStartRecording() {
    if (!isRecordingSupported) {
      toast.error("Seu navegador não suporta gravação de áudio");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const audioUrl = URL.createObjectURL(blob);
        setRecordedAudioUrl(audioUrl);
        setRecordedBlob(blob);
        setIsRecording(false);
        setIsPaused(false);
      };

      recorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingDuration(0);
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Erro ao acessar o microfone.");
    }
  }

  function handlePauseRecording() {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  }

  function handleResumeRecording() {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "paused"
    ) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    }
  }

  function handleStopRecording() {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    }
  }

  function handleDeleteRecording() {
    if (isRecording) {
      handleStopRecording();
      onCancel();
    }

    // If we have something to delete, just clear it
    if (recordedAudioUrl || isRecording) {
      setRecordedAudioUrl(null);
      setRecordedBlob(null);
      setRecordingDuration(0);
      setIsRecording(false);
      setIsPaused(false);
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        handleStopRecording();
        onCancel();
      }
    } else {
      onCancel();
    }
  }

  function handlePlayback() {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }

  function handleSendAudio() {
    if (!recordedBlob) return;

    if (onSend) {
      onSend(recordedBlob);
    }

    handleDeleteRecording();
  }

  return (
    <div className="flex items-center gap-2 w-full justify-end">
      {/* Botão de Cancelar/Deletar */}
      {(isRecording || recordedAudioUrl) && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDeleteRecording}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2Icon className="w-5 h-5" />
        </Button>
      )}

      {/* Área Central: Timer ou Player */}
      <div
        className={cn(
          "flex-1 flex items-center justify-between px-4 py-2 bg-secondary/50 rounded-full transition-all",
          isRecording || recordedAudioUrl
            ? "opacity-100"
            : "opacity-0 pointer-events-none",
        )}
      >
        {isRecording ? (
          <div className="flex items-center gap-3 w-full">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-medium tabular-nums">
              {formatTime(recordingDuration)}
            </span>
            <div className="flex-1" />
            <div className="flex items-center gap-1">
              {isPaused ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleResumeRecording}
                >
                  <MicIcon className="w-4 h-4 text-green-500" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handlePauseRecording}
                >
                  <PauseIcon className="w-4 h-4 text-yellow-500" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleStopRecording}
              >
                <CircleStopIcon className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>
        ) : recordedAudioUrl ? (
          <div className="flex items-center gap-3 w-full">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handlePlayback}
            >
              {isPlaying ? (
                <PauseIcon className="w-4 h-4" />
              ) : (
                <PlayIcon className="w-4 h-4" />
              )}
            </Button>
            <span className="text-sm font-medium tabular-nums">
              {isPlaying
                ? formatTime(Math.floor(currentPlayerTime))
                : formatTime(recordingDuration)}
            </span>
            <div className="flex-1" />
            <audio ref={audioRef} src={recordedAudioUrl} hidden />
          </div>
        ) : null}
      </div>

      {/* Botão de Ação: Mic ou Enviar */}
      {!isRecording && !recordedAudioUrl ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleStartRecording}
          disabled={disabled}
          className="rounded-full hover:bg-primary hover:text-primary-foreground transition-all duration-300 transform active:scale-90"
        >
          <MicIcon className="w-6 h-6" />
        </Button>
      ) : (
        recordedAudioUrl &&
        !isRecording && (
          <Button
            variant="default"
            size="icon"
            onClick={handleSendAudio}
            className="rounded-full shadow-lg transform active:scale-95 transition-all"
          >
            <SendIcon className="w-5 h-5" />
          </Button>
        )
      )}
    </div>
  );
}
