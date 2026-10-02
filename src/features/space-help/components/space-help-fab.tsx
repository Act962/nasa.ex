"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { GraduationCap, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useSpaceHelpContext } from "../hooks/use-space-help-context";
import { FeatureArticle } from "./feature-article";
import Link from "next/link";

const HIDE_ON = [/^\/space-help/, /^\/tracking-chat\/[^/]+$/, /^\/login/, /^\/signup/];

export function SpaceHelpFab() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || "";
  const detected = useSpaceHelpContext();

  if (HIDE_ON.some((re) => re.test(pathname))) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir Space Help"
        className={cn(
          "fixed z-40 bottom-24 right-5 size-12 rounded-full",
          "bg-primary text-primary-foreground",
          "shadow-lg",
          "flex items-center justify-center transition hover:scale-105 active:scale-95",
        )}
      >
        <GraduationCap className="size-5" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 overflow-y-auto">
          <SheetHeader className="px-6 pt-6 pb-2 sticky top-0 bg-background z-10">
            <SheetTitle className="flex items-center gap-2 text-base">
              <GraduationCap className="size-4 text-info" />
              Space Help
            </SheetTitle>
            <SheetDescription className="text-xs">
              {detected?.categorySlug
                ? `Tutorial contextual: ${detected.categorySlug}`
                : "Hub educacional ÓRBITA"}
            </SheetDescription>
          </SheetHeader>
          <div className="p-2">
            {detected?.categorySlug && detected.featureSlug ? (
              <FeatureArticle
                categorySlug={detected.categorySlug}
                featureSlug={detected.featureSlug}
              />
            ) : (
              <div className="p-6 text-center space-y-3">
                <GraduationCap className="size-10 mx-auto text-info" />
                <p className="text-sm text-muted-foreground">
                  Tutorial contextual desta tela ainda não disponível.
                </p>
                <Link
                  href="/space-help"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Explorar Space Help completo
                </Link>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
