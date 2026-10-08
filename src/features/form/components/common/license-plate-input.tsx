"use client";

import { useId } from "react";

// Campo de placa de veículo: a própria placa é o campo, e o que se digita
// aparece dentro dela. Aceita o padrão Mercosul (ABC1D23) e o antigo (ABC1234).

const PLATE_LENGTH = 7;
const PLATE_GUIDE = "ABC1D23";
const PLATE_PATTERN = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;
const PLATE_IMAGE_URL = "/form-assets/license-plate-blank.png";

export function normalizePlate(rawText: string): string {
  return rawText.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, PLATE_LENGTH);
}

function describePlate(plate: string): string {
  if (plate.length === 0) return "Toque na placa para digitar";
  if (plate.length < PLATE_LENGTH) return `Faltam ${PLATE_LENGTH - plate.length} caracteres`;
  return PLATE_PATTERN.test(plate) ? "Placa completa" : "Confira: o formato é ABC1D23 ou ABC1234";
}

export function LicensePlateInput({
  value,
  onChange,
  onBlur,
  label,
  hasError,
}: {
  value: string;
  onChange: (plate: string) => void;
  onBlur: (plate: string) => void;
  label: string;
  hasError?: boolean;
}) {
  const hintId = useId();
  const plate = normalizePlate(value);

  return (
    <div className="w-full max-w-sm">
      {/* Tema claro fixo (`light`): o texto fica sobre a foto da placa, que é sempre branca. */}
      <div
        className={`light relative aspect-[700/245] w-full rounded-[14px] bg-cover bg-center [container-type:inline-size] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${hasError ? "ring-2 ring-destructive" : ""}`}
        style={{ backgroundImage: `url(${PLATE_IMAGE_URL})` }}
      >
        <div
          aria-hidden
          className="absolute bottom-[8%] left-[10%] right-[3%] top-[33%] flex items-center justify-center whitespace-nowrap text-[17cqw] font-extrabold leading-none tracking-[0.06em] text-foreground"
          style={{ fontFamily: '"DIN Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif' }}
        >
          {plate}
          <span className="text-muted-foreground/35">{PLATE_GUIDE.slice(plate.length)}</span>
        </div>
        <input
          value={plate}
          maxLength={PLATE_LENGTH}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-label={label}
          aria-describedby={hintId}
          onChange={(event) => onChange(normalizePlate(event.target.value))}
          onBlur={(event) => onBlur(normalizePlate(event.target.value))}
          className="absolute inset-0 size-full cursor-text opacity-0"
        />
      </div>
      <p id={hintId} className="mt-1.5 flex justify-between text-xs text-muted-foreground">
        <span>{describePlate(plate)}</span>
        <span className="tabular-nums">
          {plate.length}/{PLATE_LENGTH}
        </span>
      </p>
    </div>
  );
}
