"use client";

import { useCallback, useEffect, useState } from "react";

export const SYSTEM_SOUNDS = [
  { id: "ding", label: "Ding" },
  { id: "bell", label: "Campainha" },
  { id: "chime", label: "Carrilhão" },
  { id: "pop", label: "Pop" },
  { id: "alert", label: "Alerta" },
] as const;

export type SystemSoundId = (typeof SYSTEM_SOUNDS)[number]["id"];

export interface SoundNotificationSettings {
  enabled: boolean;
  selectedSound: SystemSoundId | "custom";
  customSoundDataUrl?: string;
  customSoundName?: string;
}

const DEFAULT_SETTINGS: SoundNotificationSettings = {
  enabled: false,
  selectedSound: "ding",
};

function getStorageKey(trackingId: string) {
  return `sound_notification_${trackingId}`;
}

export function useSoundNotificationSettings(trackingId: string) {
  const [settings, setSettings] =
    useState<SoundNotificationSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(getStorageKey(trackingId));
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
    setIsLoaded(true);
  }, [trackingId]);

  const updateSettings = useCallback(
    (partial: Partial<SoundNotificationSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...partial };
        try {
          localStorage.setItem(getStorageKey(trackingId), JSON.stringify(next));
        } catch {
          // ignore storage errors
        }
        return next;
      });
    },
    [trackingId],
  );

  return { settings, updateSettings, isLoaded };
}

// --- Audio generation via Web Audio API ---

function createAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    return new (window.AudioContext || (window as any).webkitAudioContext)();
  } catch {
    return null;
  }
}

function playDing(ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.3);
  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.5);
}

function playBell(ctx: AudioContext) {
  const frequencies = [880, 1100, 1320];
  frequencies.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.05);
    gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime + i * 0.05);
    osc.stop(ctx.currentTime + 0.8);
  });
}

function playChime(ctx: AudioContext) {
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
    gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.6);
    osc.start(ctx.currentTime + i * 0.12);
    osc.stop(ctx.currentTime + i * 0.12 + 0.6);
  });
}

function playPop(ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(400, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.05);
  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.15);
}

function playAlertSound(ctx: AudioContext) {
  [0, 0.2].forEach((offset) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "square";
    osc.frequency.setValueAtTime(440, ctx.currentTime + offset);
    gain.gain.setValueAtTime(0.2, ctx.currentTime + offset);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + offset + 0.15,
    );
    osc.start(ctx.currentTime + offset);
    osc.stop(ctx.currentTime + offset + 0.15);
  });
}

export async function playSystemSound(soundId: SystemSoundId) {
  const ctx = createAudioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  switch (soundId) {
    case "ding":
      playDing(ctx);
      break;
    case "bell":
      playBell(ctx);
      break;
    case "chime":
      playChime(ctx);
      break;
    case "pop":
      playPop(ctx);
      break;
    case "alert":
      playAlertSound(ctx);
      break;
  }
}

export async function playCustomSound(dataUrl: string) {
  const ctx = createAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    const response = await fetch(dataUrl);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.start();
  } catch {
    // fallback to ding
    playDing(ctx);
  }
}

export async function playSoundNotification(
  settings: SoundNotificationSettings,
) {
  if (!settings.enabled) return;

  if (settings.selectedSound === "custom" && settings.customSoundDataUrl) {
    await playCustomSound(settings.customSoundDataUrl);
  } else if (settings.selectedSound !== "custom") {
    await playSystemSound(settings.selectedSound as SystemSoundId);
  }
}
