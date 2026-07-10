"use client";

import { useEffect, useRef, useState } from "react";
import type { FocusMunicipio } from "@/http/focus-nfe/types";

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;

export function useMunicipioSearch(query: string) {
  const [municipios, setMunicipios] = useState<FocusMunicipio[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortController = useRef<AbortController | null>(null);

  useEffect(() => {
    if (query.length < MIN_QUERY_LENGTH) {
      setMunicipios([]);
      setIsLoading(false);
      return;
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      abortController.current?.abort();
      abortController.current = new AbortController();

      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/focus-nfe/municipios?nome=${encodeURIComponent(query)}`,
          { signal: abortController.current.signal },
        );
        if (response.ok) {
          const data = await response.json();
          setMunicipios(data as FocusMunicipio[]);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setMunicipios([]);
      } finally {
        setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  return { municipios, isLoading };
}
