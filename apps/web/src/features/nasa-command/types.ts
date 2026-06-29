import { ReactNode } from "react";

export type VoiceState = "idle" | "listening" | "processing" | "unsupported";

export type DropdownType = "variable" | "app" | "plus" | null;

export interface ExampleCategory {
  emoji: string;
  label: string;
  examples: string[];
}

export interface ResultLink {
  label: string;
  url: string;
  /** Comando pré-preenchido no Explorer ao clicar no ícone de editar */
  explorerCmd?: string;
}

export interface ResultData {
  type?:
    | "created"
    | "query_result"
    | "error"
    | "needs_input"
    | "post_generated"
    | "confirmation_needed";
  title: string;
  description: string;
  url: string;
  appName: string;
  resultLinks?: ResultLink[];
  missingFields?: Array<{ key: string; label: string }>;
  partialContext?: Record<string, unknown>;
  content?: string;
  starsSpent?: number;
  confirmOptions?: Array<{ key: string; label: string; icon?: string }>;
}

export type ModelType = string;

export interface ModelOption {
  id: string;
  label: string;
  sublabel: string;
  icon: ReactNode;
  provider: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  command?: string; // raw text for user messages
  thinking?: string[]; // step labels shown during processing
  result?: ResultData;
  isThinking?: boolean; // still loading
  originalCommand?: string; // for needs_input re-submission
}
