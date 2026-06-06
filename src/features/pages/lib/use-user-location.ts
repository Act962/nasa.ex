"use client";

/**
 * Detecta a cidade/UF do usuário via IP geolocation.
 *
 * Usa `ipapi.co` (gratuito, ~1k req/dia/IP, sem chave). Resultado fica
 * cacheado em `sessionStorage` durante toda a sessão pra não bater na
 * API toda vez que algum widget Marketing reidrata.
 *
 * Brasil-aware: só devolve location se a resposta indicar `country === "BR"`,
 * pra evitar mostrar "São Paulo - CA" caso o user esteja fora do país e a
 * API devolva uma cidade gringa que casa com nome BR. Pra tudo fora do
 * Brasil, retorna `null` e o caller mostra cidade aleatória padrão.
 */
import { useEffect, useState } from "react";

const STORAGE_KEY = "nasa_user_location_v1";

export interface UserLocation {
  city: string;
  state: string;
}

function readCache(): UserLocation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { city?: string; state?: string };
    if (parsed.city && parsed.state) {
      return { city: parsed.city, state: parsed.state };
    }
    return null;
  } catch {
    return null;
  }
}

function writeCache(loc: UserLocation | null) {
  if (typeof window === "undefined") return;
  try {
    if (!loc) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({}));
      return;
    }
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
  } catch {
    /* ignore */
  }
}

export function useUserLocation(enabled: boolean = true): UserLocation | null {
  const [location, setLocation] = useState<UserLocation | null>(() => readCache());

  useEffect(() => {
    if (!enabled) return;
    if (location) return; // já tem (do cache ou de fetch anterior)
    // Tenta uma vez. Se falhar (offline, rate-limit), cacheia null com
    // TTL implícito = sessão.
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);
    fetch("https://ipapi.co/json/", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { city?: string; region_code?: string; country?: string } | null) => {
        if (!data || data.country !== "BR" || !data.city || !data.region_code) {
          writeCache(null);
          return;
        }
        const loc = { city: data.city, state: data.region_code };
        writeCache(loc);
        setLocation(loc);
      })
      .catch(() => {
        writeCache(null);
      })
      .finally(() => clearTimeout(t));
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [enabled, location]);

  return location;
}
