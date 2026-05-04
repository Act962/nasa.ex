"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { ALL_MODULES, type AppModule } from "@/features/insights/types";
import type { InsightBlock } from "@/lib/insights/app-metrics";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface LayoutContextValue {
  blocks: InsightBlock[];
  canEdit: boolean;
  loaded: boolean;
  isEditing: boolean;
  setEditing: (next: boolean) => void;
  saveStatus: SaveStatus;
  addBlock: (block: InsightBlock) => void;
  removeBlock: (id: string) => void;
  reorderBlocks: (next: InsightBlock[]) => void;
  updateBlock: (id: string, patch: Partial<InsightBlock>) => void;
  togglePinToApp: (id: string, app: AppModule) => void;
  resetLayout: () => void;
}

const Ctx = createContext<LayoutContextValue | null>(null);

const SAVE_DEBOUNCE_MS = 1500;

function defaultBlocks(): InsightBlock[] {
  return ALL_MODULES.map<InsightBlock>((appModule, i) => ({
    id: `section-${appModule}`,
    type: "section",
    appModule,
    order: i,
  }));
}

export function OrgLayoutProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [blocks, setBlocks] = useState<InsightBlock[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const layoutQuery = useQuery({
    ...orpc.insights.getOrgLayout.queryOptions(),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!layoutQuery.data) return;
    const next =
      layoutQuery.data.blocks && layoutQuery.data.blocks.length > 0
        ? (layoutQuery.data.blocks as InsightBlock[])
        : defaultBlocks();
    setBlocks(normalizeOrder(next));
    setCanEdit(layoutQuery.data.canEdit);
    setLoaded(true);
  }, [layoutQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (input: { blocks: InsightBlock[] }) =>
      orpc.insights.saveOrgLayout.call(input),
    onMutate: () => {
      setSaveStatus("saving");
    },
    onSuccess: () => {
      setSaveStatus("saved");
      queryClient.invalidateQueries({
        queryKey: ["insights", "getOrgLayout"],
      });
      window.setTimeout(() => setSaveStatus("idle"), 2000);
    },
    onError: () => {
      setSaveStatus("error");
    },
  });

  const scheduleSave = useCallback(
    (next: InsightBlock[]) => {
      if (!canEdit) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveMutation.mutate({ blocks: next });
      }, SAVE_DEBOUNCE_MS);
    },
    [canEdit, saveMutation],
  );

  const commit = useCallback(
    (next: InsightBlock[]) => {
      const normalized = normalizeOrder(next);
      setBlocks(normalized);
      scheduleSave(normalized);
    },
    [scheduleSave],
  );

  const addBlock = useCallback(
    (block: InsightBlock) => {
      commit([...blocks, { ...block, order: blocks.length }]);
    },
    [blocks, commit],
  );

  const removeBlock = useCallback(
    (id: string) => {
      commit(blocks.filter((b) => b.id !== id));
    },
    [blocks, commit],
  );

  const reorderBlocks = useCallback(
    (next: InsightBlock[]) => {
      commit(next);
    },
    [commit],
  );

  const updateBlock = useCallback(
    (id: string, patch: Partial<InsightBlock>) => {
      commit(
        blocks.map((b) =>
          b.id === id ? ({ ...b, ...patch } as InsightBlock) : b,
        ),
      );
    },
    [blocks, commit],
  );

  const togglePinToApp = useCallback(
    (id: string, app: AppModule) => {
      commit(
        blocks.map((b) => {
          if (b.id !== id) return b;
          if (b.type === "section" || b.type === "add-anchor") return b;
          const list = b.pinnedToApps ?? [];
          const next = list.includes(app)
            ? list.filter((x) => x !== app)
            : [...list, app];
          return { ...b, pinnedToApps: next } as InsightBlock;
        }),
      );
    },
    [blocks, commit],
  );

  const resetLayout = useCallback(() => {
    commit(defaultBlocks());
  }, [commit]);

  const value = useMemo<LayoutContextValue>(
    () => ({
      blocks,
      canEdit,
      loaded,
      isEditing: isEditing && canEdit,
      setEditing: setIsEditing,
      saveStatus,
      addBlock,
      removeBlock,
      reorderBlocks,
      updateBlock,
      togglePinToApp,
      resetLayout,
    }),
    [
      blocks,
      canEdit,
      loaded,
      isEditing,
      saveStatus,
      addBlock,
      removeBlock,
      reorderBlocks,
      updateBlock,
      togglePinToApp,
      resetLayout,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOrgLayout(): LayoutContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useOrgLayout must be used inside OrgLayoutProvider");
  }
  return ctx;
}

function normalizeOrder(blocks: InsightBlock[]): InsightBlock[] {
  return blocks.map((b, i) => ({ ...b, order: i }) as InsightBlock);
}
