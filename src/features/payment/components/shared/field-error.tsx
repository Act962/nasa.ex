"use client";

import { AlertCircle } from "lucide-react";

// Mensagem de validação abaixo de um campo. Substitui o toast genérico
// ("Valor inválido"), que dizia que algo estava errado sem dizer onde.

export const fieldErrorClass =
  "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30";

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <p
      role="alert"
      className="flex items-center gap-1.5 text-xs text-destructive"
    >
      <AlertCircle className="size-3.5 shrink-0" />
      {message}
    </p>
  );
}
