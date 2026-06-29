"use client";

import { useEffect, useState } from "react";

export function useFingerprint() {
  const [ready, setReady] = useState(false);
  const [fp, setFp] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await fetch("/api/fingerprint-init", { credentials: "include" });
        if (cancelled) return;

        const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
        const lang = typeof navigator !== "undefined" ? navigator.language : "";
        const raw = `${ua}|${tz}|${lang}|${screen.width}x${screen.height}`;

        const enc = new TextEncoder().encode(raw);
        const hashBuf = await crypto.subtle.digest("SHA-256", enc);
        const hashArr = Array.from(new Uint8Array(hashBuf));
        const hex = hashArr.map((b) => b.toString(16).padStart(2, "0")).join("");

        if (!cancelled) {
          setFp(hex);
          setReady(true);
        }
      } catch {
        if (!cancelled) setReady(true);
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  return { fingerprint: fp, ready };
}
