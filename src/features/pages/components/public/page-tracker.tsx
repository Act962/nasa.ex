"use client";

import { useEffect, useRef } from "react";

/**
 * PageTracker — emite eventos analíticos pra `/public/pages/:slug/visit`:
 *
 * 1. **page-view**: 1 evento ao montar (já existente)
 * 2. **scroll markers**: ao cruzar 25/50/75/100% de scroll
 * 3. **section views**: cada `<section id>` que entra em viewport
 *    (IntersectionObserver, dispara 1 vez)
 * 4. **clicks**: em qualquer elemento com `data-el-id`
 * 5. **dwell time**: enviado no `beforeunload` (segundos totais)
 *
 * Tudo batched localmente em `sendBeacon` quando possível (não
 * bloqueia unload). Por enquanto eventos vão pro mesmo endpoint
 * de `registerVisit` (sem migration de schema).
 *
 * Não dispara no editor — só quando o componente é instanciado
 * com `slug` (página publicada/preview).
 */
export function PageTracker({ slug }: { slug: string }) {
  const startedAt = useRef<number>(0);
  const seenSections = useRef(new Set<string>());
  const reachedMarkers = useRef(new Set<number>());

  useEffect(() => {
    if (!slug || typeof window === "undefined") return;
    startedAt.current = performance.now();

    const send = (
      payload: {
        event?: "click" | "scroll" | "section" | "dwell";
        targetId?: string;
        value?: string;
      } = {},
    ) => {
      const body = JSON.stringify({
        json: {
          slug,
          path: payload.event ? undefined : window.location.pathname,
          referrer: document.referrer || undefined,
          userAgent: navigator.userAgent,
          device:
            window.innerWidth < 640
              ? "mobile"
              : window.innerWidth < 1024
                ? "tablet"
                : "desktop",
          ...payload,
        },
      });
      // sendBeacon prioritário pra `beforeunload`; falha pra fetch.
      if ("sendBeacon" in navigator) {
        try {
          navigator.sendBeacon(
            "/api/rpc/pages.registerVisit",
            new Blob([body], { type: "application/json" }),
          );
          return;
        } catch {
          /* fallback fetch */
        }
      }
      fetch("/api/rpc/pages.registerVisit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    };

    // 1. page-view inicial
    send();

    // 2. scroll markers
    const onScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      if (total <= 0) return;
      const pct = Math.round((window.scrollY / total) * 100);
      for (const mark of [25, 50, 75, 100]) {
        if (pct >= mark && !reachedMarkers.current.has(mark)) {
          reachedMarkers.current.add(mark);
          send({ event: "scroll", value: String(mark) });
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // 3. section views — IntersectionObserver
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const id = (e.target as HTMLElement).id;
          if (!id || seenSections.current.has(id)) continue;
          seenSections.current.add(id);
          send({ event: "section", targetId: id });
        }
      },
      { threshold: 0.3 },
    );
    document
      .querySelectorAll("section[id], footer[id], header[id]")
      .forEach((el) => observer.observe(el));

    // 4. clicks em elements com data-el-id
    const onClick = (e: MouseEvent) => {
      let cur = e.target as HTMLElement | null;
      while (cur && cur !== document.body) {
        const id = cur.getAttribute("data-el-id");
        if (id) {
          send({ event: "click", targetId: id });
          return;
        }
        cur = cur.parentElement;
      }
    };
    document.addEventListener("click", onClick, true);

    // 5. dwell no beforeunload
    const onUnload = () => {
      const seconds = Math.round(
        (performance.now() - startedAt.current) / 1000,
      );
      if (seconds > 1) send({ event: "dwell", value: String(seconds) });
    };
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("pagehide", onUnload);

    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("pagehide", onUnload);
      observer.disconnect();
    };
  }, [slug]);

  return null;
}
