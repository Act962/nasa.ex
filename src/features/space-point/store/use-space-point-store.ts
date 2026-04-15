import { create } from "zustand";
import { type AchievementData } from "../components/achievement-popup";

export interface PopupTemplateData {
  id: string;
  name: string;
  title: string;
  message: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  enableConfetti: boolean;
  enableSound: boolean;
  dismissDuration: number;
  customJson?: Record<string, unknown>;
  type: string;
}

interface SpacePointStore {
  achievement: AchievementData | null;
  popupTemplates: PopupTemplateData[];
  setAchievement: (achievement: AchievementData | null) => void;
  setPopupTemplates: (templates: PopupTemplateData[]) => void;
}

export const useSpacePointStore = create<SpacePointStore>((set) => ({
  achievement: null,
  popupTemplates: [],
  setAchievement: (achievement) => set({ achievement }),
  setPopupTemplates: (popupTemplates) => set({ popupTemplates }),
}));
