import type { NBoxItemType } from "@/generated/prisma/enums";

export type NBoxViewMode = "grid" | "list";

export interface NBoxFolderView {
  id: string;
  name: string;
  color: string | null;
  parentId: string | null;
  createdAt: Date | string;
  isRestricted?: boolean;
  systemKey?: string | null;
}

export interface NBoxItemView {
  id: string;
  name: string;
  type: NBoxItemType;
  url: string | null;
  mimeType: string | null;
  size: number | null;
  description: string | null;
  tags: string[];
  folderId: string | null;
  createdAt: Date | string;
  createdBy: { name: string; image: string | null };
  isPublic: boolean;
  publicToken: string | null;
}

/** Resolve o link de abrir/baixar do item. `null` esconde a ação. */
export type NBoxItemHrefResolver = (item: NBoxItemView) => string | null;
