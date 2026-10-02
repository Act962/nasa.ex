"use client";

import { useSyncExternalStore } from "react";
import { authClient } from "@/lib/auth-client";

const HOUR_REFRESH_MS = 60_000;

function subscribeToClock(onChange: () => void) {
  const intervalId = window.setInterval(onChange, HOUR_REFRESH_MS);
  return () => window.clearInterval(intervalId);
}

const getCurrentHour = () => new Date().getHours();
// No servidor não há fuso do usuário: a saudação só aparece depois da hidratação.
const getServerHour = () => null;

function buildGreetingForHour(hour: number, organizationName?: string) {
  if (hour < 5) return "Madrugando hein?!";
  const period = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  return organizationName ? `${period}, ${organizationName}` : period;
}

/** Saudação da Início pelo horário local + nome da organização ativa. */
export function HomeGreeting() {
  const currentHour = useSyncExternalStore(subscribeToClock, getCurrentHour, getServerHour);
  const { data: activeOrganization } = authClient.useActiveOrganization();

  return (
    <h1 className="min-h-[1.25em] text-center text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
      {currentHour !== null && buildGreetingForHour(currentHour, activeOrganization?.name)}
    </h1>
  );
}
