"use client";

import { useRouter } from "next/navigation";
import { LayoutGrid, LayoutTemplate, PenLine, Plus } from "lucide-react";
import { useRegisterOrbitDock } from "@/components/orbit-dock/orbit-dock-store";
import { usePages } from "./use-pages";

export type PagesSection = "sites" | "templates" | "analytics";

/** Menu de baixo das telas do Pages (fora do editor): Sites, Templates · Novo site, Último editado. */
export function usePagesOrbitDock({
  activeSection,
  onCreateSite,
}: {
  activeSection: PagesSection;
  onCreateSite: () => void;
}) {
  const router = useRouter();
  const { data } = usePages();
  const lastEditedPageId = data?.pages?.[0]?.id;

  useRegisterOrbitDock({
    leftItems: [
      { label: "Sites", icon: <LayoutGrid />, href: "/pages", isActive: activeSection === "sites" },
      {
        label: "Templates",
        icon: <LayoutTemplate />,
        href: "/pages/templates",
        isActive: activeSection === "templates",
      },
    ],
    rightItems: [
      { label: "Novo site", icon: <Plus />, onSelect: onCreateSite },
      {
        label: "Último editado",
        icon: <PenLine />,
        onSelect: () => (lastEditedPageId ? router.push(`/pages/${lastEditedPageId}`) : onCreateSite()),
      },
    ],
  });
}
