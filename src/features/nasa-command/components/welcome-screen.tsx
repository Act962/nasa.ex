import React, { useState, useEffect } from "react";
import { NasaLogo } from "./nasa-logo";
import { RotatingExample } from "./rotating-example";
import { CommandInput, CommandInputProps } from "./command-input";
import { ExampleLibrary } from "./example-library";
import { RecentRequests } from "./recent-requests";

interface WelcomeScreenProps {
  onSelect: (e: string) => void;
  commandInputProps: CommandInputProps;
  recentCommands: string[];
  onClearRecent: () => void;
}

export function WelcomeScreen({
  onSelect,
  commandInputProps,
  recentCommands,
  onClearRecent,
}: WelcomeScreenProps) {
  const [mouse, setMouse] = useState({ x: -999, y: -999 });

  useEffect(() => {
    const handler = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  return (
    <div className="relative flex flex-col items-center w-full min-h-full px-4 py-10 sm:py-14 select-none">
      {/* Ambient nebula glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[640px] h-[400px] rounded-full bg-[#7C3AED]/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/4 w-[320px] h-[320px] rounded-full bg-[#a855f7]/7 blur-[100px] pointer-events-none" />

      {/* Mouse-tracking glow — bright blurred white dot */}
      <div
        className="fixed pointer-events-none z-50 w-20 h-20 rounded-full bg-white/30 blur-2xl"
        style={{
          left: mouse.x - 40,
          top: mouse.y - 40,
          transition: "left 0.05s linear, top 0.05s linear",
        }}
      />

      <div className="relative z-10 w-full max-w-2xl mx-auto flex flex-col items-center gap-6">
        {/* 1. Logo */}
        <div className="flex flex-col items-center gap-2">
          <NasaLogo className="w-[180px] sm:w-[240px] h-auto opacity-95" />
          <p className="text-[10px] font-bold tracking-[0.35em] text-zinc-500 uppercase">
            EXPLORER
          </p>
          <RotatingExample />
        </div>

        {/* 2. Campo de comando */}
        <div className="w-full">
          <CommandInput {...commandInputProps} />
        </div>

        {/* 3. Biblioteca de exemplos */}
        <div className="w-full flex flex-col items-center">
          <ExampleLibrary onSelect={onSelect} />
        </div>

        {/* 4. Últimas solicitações */}
        <RecentRequests
          recent={recentCommands}
          onSelect={onSelect}
          onClear={onClearRecent}
        />
      </div>
    </div>
  );
}
