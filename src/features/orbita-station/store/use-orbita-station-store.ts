import { create } from "zustand";
import type { QualityTier } from "../engine/finish";
import type { RoomLayout } from "../layout/station-layout";

export type StationStatus = "loading" | "ready" | "no-webgl" | "error";
export type StationPanel = "none" | "studio" | "map" | "editor";

interface OrbitaStationState {
  status: StationStatus;
  errorMessage: string | null;
  currentRoom: RoomLayout | null;
  quality: QualityTier;
  panel: StationPanel;
  setStatus: (status: StationStatus, errorMessage?: string) => void;
  setCurrentRoom: (room: RoomLayout | null) => void;
  setQuality: (quality: QualityTier) => void;
  setPanel: (panel: StationPanel) => void;
}

export const useOrbitaStationStore = create<OrbitaStationState>((set) => ({
  status: "loading",
  errorMessage: null,
  currentRoom: null,
  quality: "medio",
  panel: "none",
  setStatus: (status, errorMessage) => set({ status, errorMessage: errorMessage ?? null }),
  setCurrentRoom: (currentRoom) => set({ currentRoom }),
  setQuality: (quality) => set({ quality }),
  setPanel: (panel) => set({ panel }),
}));
