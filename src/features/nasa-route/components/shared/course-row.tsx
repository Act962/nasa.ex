"use client";

import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  rightSlot?: React.ReactNode;
  /** No celular vira grade de 2 colunas em vez de carrossel. */
  isGridOnMobile?: boolean;
}

export function CourseRow({ title, subtitle, children, rightSlot, isGridOnMobile = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const scrollContainer = ref.current;
    if (!scrollContainer) return;
    const updateScrollButtons = () => {
      setCanScrollLeft(scrollContainer.scrollLeft > 4);
      setCanScrollRight(
        scrollContainer.scrollLeft + scrollContainer.clientWidth < scrollContainer.scrollWidth - 4,
      );
    };
    updateScrollButtons();
    scrollContainer.addEventListener("scroll", updateScrollButtons, { passive: true });
    const resizeObserver = new ResizeObserver(updateScrollButtons);
    resizeObserver.observe(scrollContainer);
    return () => {
      scrollContainer.removeEventListener("scroll", updateScrollButtons);
      resizeObserver.disconnect();
    };
  }, []);

  function scroll(direction: 1 | -1) {
    const scrollContainer = ref.current;
    if (!scrollContainer) return;
    const amount = Math.max(scrollContainer.clientWidth * 0.85, 320);
    scrollContainer.scrollBy({ left: direction * amount, behavior: "smooth" });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3 px-4 md:px-8">
        <div className="min-w-0">
          <h2 className="text-lg font-bold leading-tight md:text-xl">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-muted-foreground md:text-sm">
              {subtitle}
            </p>
          )}
        </div>
        {rightSlot}
      </div>

      <div className="group/row relative">
        <button
          type="button"
          aria-label="Anterior"
          onClick={() => scroll(-1)}
          className={cn(
            "absolute left-0 top-0 z-30 hidden h-full w-12 items-center justify-center bg-gradient-to-r from-background/95 via-background/70 to-transparent text-foreground transition-opacity md:flex",
            canScrollLeft ? "opacity-0 group-hover/row:opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <ChevronLeft className="size-7" />
        </button>

        <div
          ref={ref}
          className={cn(
            "scroll-hidden-x flex gap-3 overflow-x-auto overflow-y-visible scroll-smooth px-4 pt-2 pb-6 md:gap-4 md:px-8 md:pb-8",
            isGridOnMobile
              ? "max-md:grid max-md:grid-cols-2 max-md:overflow-visible max-md:pb-2 max-md:*:w-auto"
              : "snap-x snap-mandatory scroll-px-4 max-md:*:w-[62%] max-md:*:snap-start md:snap-none",
          )}
        >
          {children}
        </div>

        <button
          type="button"
          aria-label="Próximo"
          onClick={() => scroll(1)}
          className={cn(
            "absolute right-0 top-0 z-30 hidden h-full w-12 items-center justify-center bg-gradient-to-l from-background/95 via-background/70 to-transparent text-foreground transition-opacity md:flex",
            canScrollRight ? "opacity-0 group-hover/row:opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <ChevronRight className="size-7" />
        </button>
      </div>
    </section>
  );
}
