"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Preferência de dispositivos de mídia do World (mic/câmera/saída).
 *
 * Store ÚNICO da seleção de devices do `use-sfu-room` (LiveKit) — persiste a
 * escolha entre reloads. (Antes era compartilhado com o mesh `use-webrtc`, hoje
 * removido; o store seguiu como fonte única da preferência.)
 *
 * `""` = default do sistema. deviceIds são per-browser/per-origin, por isso
 * localStorage (e não banco). Se o device persistido não estiver conectado,
 * `resolvePreferredDeviceId` cai no default SEM apagar a preferência — ela
 * volta a valer quando o device reconecta.
 */
interface MediaDeviceStore {
  audioInputId: string;
  videoInputId: string;
  audioOutputId: string;

  setAudioInputId: (deviceId: string) => void;
  setVideoInputId: (deviceId: string) => void;
  setAudioOutputId: (deviceId: string) => void;
}

export const useMediaDeviceStore = create<MediaDeviceStore>()(
  persist(
    (set) => ({
      audioInputId: "",
      videoInputId: "",
      audioOutputId: "",

      setAudioInputId: (audioInputId) => set({ audioInputId }),
      setVideoInputId: (videoInputId) => set({ videoInputId }),
      setAudioOutputId: (audioOutputId) => set({ audioOutputId }),
    }),
    {
      name: "space-station:media-devices", // localStorage key
      partialize: (state) => ({
        audioInputId: state.audioInputId,
        videoInputId: state.videoInputId,
        audioOutputId: state.audioOutputId,
      }),
    },
  ),
);
