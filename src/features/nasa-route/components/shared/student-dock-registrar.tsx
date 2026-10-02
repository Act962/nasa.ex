"use client";

import { useNasaRouteStudentDock, type NasaRouteStudentSection } from "../../hooks/use-nasa-route-dock";

/** Registra o menu de baixo do aluno em telas de servidor ou ramos que não podem chamar o hook direto. */
export function StudentDockRegistrar({ activeSection }: { activeSection?: NasaRouteStudentSection }) {
  useNasaRouteStudentDock({ activeSection });
  return null;
}
