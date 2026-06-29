"use client";

import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  rightSlot?: React.ReactNode;
}

export function CourseRow({ title, subtitle, children, rightSlot }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  function scroll(dir: 1 | -1) {
    const el = ref.current;
    if (!el) return;
    const amount = Math.max(el.clientWidth * 0.85, 320);
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
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
          className="flex gap-3 overflow-x-auto overflow-y-visible scroll-smooth px-4 pb-8 pt-2 [scrollbar-width:none] md:gap-4 md:px-8 [&::-webkit-scrollbar]:hidden"
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
