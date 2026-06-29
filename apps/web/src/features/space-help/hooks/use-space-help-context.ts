"use client";

import { usePathname } from "next/navigation";
import { resolveCategoryFromPath } from "../data/feature-map";

export function useSpaceHelpContext() {
  const pathname = usePathname();
  const categorySlug = resolveCategoryFromPath(pathname || "");
  return { categorySlug, featureSlug: null as string | null };
}
