export type SalesGoalTheme = "GAMING" | "LIGHT" | "DARK" | "GALAXY";

export interface SalesGoalThemeStyle {
  label: string;
  podiumGradient: string;
  totalCardGradient: string;
  accent: string;
  textOnDark: boolean;
}

export const SALES_GOAL_THEME_STYLES: Record<SalesGoalTheme, SalesGoalThemeStyle> = {
  GAMING: {
    label: "Gaming",
    podiumGradient: "linear-gradient(180deg, #0d0030, #050510)",
    totalCardGradient: "linear-gradient(90deg, #1a0a3d, #0d0030)",
    accent: "#7a1fe7",
    textOnDark: true,
  },
  DARK: {
    label: "Escuro",
    podiumGradient: "linear-gradient(180deg, #1e293b, #020617)",
    totalCardGradient: "linear-gradient(90deg, #1e293b, #0f172a)",
    accent: "#6366f1",
    textOnDark: true,
  },
  GALAXY: {
    label: "Galáxia",
    podiumGradient: "linear-gradient(180deg, #312e81, #4c1d95)",
    totalCardGradient: "linear-gradient(90deg, #4c1d95, #701a75)",
    accent: "#a855f7",
    textOnDark: true,
  },
  LIGHT: {
    label: "Claro",
    podiumGradient: "linear-gradient(180deg, #f8fafc, #e2e8f0)",
    totalCardGradient: "linear-gradient(90deg, #eef2ff, #e0e7ff)",
    accent: "#4f46e5",
    textOnDark: false,
  },
};
