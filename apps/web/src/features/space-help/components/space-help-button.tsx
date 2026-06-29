"use client";

import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface Props {
  categorySlug?: string;
  featureSlug?: string;
  label?: string;
  variant?: "ghost" | "outline" | "default" | "secondary";
  size?: "sm" | "default" | "icon";
}

export function SpaceHelpButton({
  categorySlug: explicitCat,
  featureSlug: explicitFeat,
  label = "Space Help",
  variant = "ghost",
  size = "sm",
}: Props) {
  const [open, setOpen] = useState(false);
  const detected = useSpaceHelpContext();
  const categorySlug = explicitCat ?? detected?.categorySlug;
  const featureSlug = explicitFeat ?? detected?.featureSlug;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <GraduationCap className="size-4" />
        {size !== "icon" && <span>{label}</span>}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 overflow-y-auto">
          <SheetHeader className="px-6 pt-6 pb-2 sticky top-0 bg-background border-b border-border z-10">
            <SheetTitle className="flex items-center gap-2 text-base">
              <GraduationCap className="size-4 text-violet-600" />
              Space Help
            </SheetTitle>
            <SheetDescription className="text-xs">
              Tutorial contextual desta tela
            </SheetDescription>
          </SheetHeader>
          <div className="p-2">
            {categorySlug && featureSlug ? (
              <FeatureArticle
                categorySlug={categorySlug}
                featureSlug={featureSlug}
              />
            ) : (
              <div className="p-6 text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Não há tutorial específico para esta tela ainda.
                </p>
                <Link
                  href="/space-help"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
                >
                  <GraduationCap className="size-4" />
                  Explorar Space Help
                </Link>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
