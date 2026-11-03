"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced";
import { useCampaignCitySearch } from "@/features/trafego/hooks/use-trafego-campaign-builder";
import {
  MAX_AGE,
  MAX_RADIUS_KM,
  MIN_AGE,
  MIN_RADIUS_KM,
  type AudienceDraft,
  type AudienceGender,
} from "@/features/trafego/lib/campaign-builder/build-meta-payloads";

/** Público da campanha: cidade com raio, idade e gênero (spec 0124, RF-4). */

const GENDER_OPTIONS: { value: AudienceGender; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "female", label: "Mulheres" },
  { value: "male", label: "Homens" },
];

function toBoundedNumber(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function AudienceFields({
  orderId,
  audience,
  onChange,
}: {
  orderId: string;
  audience: AudienceDraft | null;
  onChange: (audience: AudienceDraft) => void;
}) {
  const [cityQuery, setCityQuery] = useState("");
  const debouncedQuery = useDebouncedValue(cityQuery, 350);
  const { data: cities, isFetching } = useCampaignCitySearch(orderId, debouncedQuery);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">Cidade</p>
        {audience && (
          <p className="mt-1 flex items-center gap-1.5 text-sm">
            <MapPin className="size-4 text-primary" />
            {audience.cityName} + {audience.radiusKm} km
          </p>
        )}
        <Input
          className="mt-2"
          value={cityQuery}
          onChange={(event) => setCityQuery(event.target.value)}
          placeholder={audience ? "Trocar a cidade…" : "Digite a cidade do negócio"}
        />
        {isFetching && <OrbitaSpinner className="mt-2 size-4" />}
        {cities && cityQuery.trim().length >= 2 && (
          <ul className="mt-2 divide-y rounded-[14px] border">
            {cities.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">Nenhuma cidade encontrada.</li>}
            {cities.map((city) => (
              <li key={city.key}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    onChange({
                      cityKey: city.key,
                      cityName: city.region ? `${city.name}, ${city.region}` : city.name,
                      radiusKm: audience?.radiusKm ?? MIN_RADIUS_KM,
                      ageMin: audience?.ageMin ?? MIN_AGE,
                      ageMax: audience?.ageMax ?? MAX_AGE,
                      gender: audience?.gender ?? "all",
                    });
                    setCityQuery("");
                  }}
                >
                  {city.name}
                  {city.region && <span className="text-muted-foreground"> · {city.region}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {audience && (
        <div className="grid grid-cols-3 gap-2">
          <label className="text-xs text-muted-foreground">
            Raio (km)
            <Input
              type="number"
              inputMode="numeric"
              min={MIN_RADIUS_KM}
              max={MAX_RADIUS_KM}
              value={audience.radiusKm}
              onChange={(event) =>
                onChange({ ...audience, radiusKm: toBoundedNumber(event.target.value, MIN_RADIUS_KM, MAX_RADIUS_KM, audience.radiusKm) })
              }
              className="mt-1"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Idade mínima
            <Input
              type="number"
              inputMode="numeric"
              min={MIN_AGE}
              max={MAX_AGE}
              value={audience.ageMin}
              onChange={(event) =>
                onChange({ ...audience, ageMin: toBoundedNumber(event.target.value, MIN_AGE, audience.ageMax, audience.ageMin) })
              }
              className="mt-1"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Idade máxima
            <Input
              type="number"
              inputMode="numeric"
              min={MIN_AGE}
              max={MAX_AGE}
              value={audience.ageMax}
              onChange={(event) =>
                onChange({ ...audience, ageMax: toBoundedNumber(event.target.value, audience.ageMin, MAX_AGE, audience.ageMax) })
              }
              className="mt-1"
            />
          </label>
        </div>
      )}

      {audience && (
        <div className="flex flex-wrap gap-1.5">
          {GENDER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange({ ...audience, gender: option.value })}
              className={cn(
                "min-h-8 rounded-full border px-3 text-xs transition",
                audience.gender === option.value ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
