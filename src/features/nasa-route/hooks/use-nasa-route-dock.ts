"use client";

import { createElement } from "react";
import { Award, BookOpen, Gift, LayoutGrid, PenSquare, PlayCircle, TrendingUp, Users } from "lucide-react";
import { useRegisterOrbitDock } from "@/components/orbit-dock/orbit-dock-store";

export type NasaRouteStudentSection = "catalog" | "my-courses" | "certificates" | "creator";

export const NASA_ROUTE_MY_COURSES_HREF = "/nasa-route?secao=meus-cursos";

interface StudentDockOptions {
  activeSection?: NasaRouteStudentSection;
  /** Na própria vitrine, Cursos e Meus cursos trocam de seção sem navegar. */
  onSelectSection?: (section: "catalog" | "my-courses") => void;
}

/** Menu de baixo do aluno: Cursos, Meus cursos · Certificados, Criador. */
export function useNasaRouteStudentDock({ activeSection, onSelectSection }: StudentDockOptions = {}) {
  useRegisterOrbitDock({
    leftItems: [
      {
        label: "Cursos",
        icon: createElement(LayoutGrid),
        isActive: activeSection === "catalog",
        ...(onSelectSection ? { onSelect: () => onSelectSection("catalog") } : { href: "/nasa-route" }),
      },
      {
        label: "Meus cursos",
        icon: createElement(PlayCircle),
        isActive: activeSection === "my-courses",
        ...(onSelectSection
          ? { onSelect: () => onSelectSection("my-courses") }
          : { href: NASA_ROUTE_MY_COURSES_HREF }),
      },
    ],
    rightItems: [
      {
        label: "Certificados",
        icon: createElement(Award),
        href: "/nasa-route/certificados",
        isActive: activeSection === "certificates",
      },
      {
        label: "Criador",
        icon: createElement(PenSquare),
        href: "/nasa-route/criador",
        isActive: activeSection === "creator",
      },
    ],
  });
}

export type NasaRouteCreatorSection = "courses" | "sales" | "students" | "free-access";

/** Menu de baixo do criador: Cursos, Vendas · Alunos, Acesso livre. */
export function useNasaRouteCreatorDock(activeSection?: NasaRouteCreatorSection) {
  useRegisterOrbitDock({
    leftItems: [
      { label: "Cursos", icon: createElement(BookOpen), href: "/nasa-route/criador", isActive: activeSection === "courses" },
      { label: "Vendas", icon: createElement(TrendingUp), href: "/nasa-route/criador/vendas", isActive: activeSection === "sales" },
    ],
    rightItems: [
      { label: "Alunos", icon: createElement(Users), href: "/nasa-route/criador/alunos", isActive: activeSection === "students" },
      { label: "Acesso livre", icon: createElement(Gift), href: "/nasa-route/criador/acesso-livre", isActive: activeSection === "free-access" },
    ],
  });
}
