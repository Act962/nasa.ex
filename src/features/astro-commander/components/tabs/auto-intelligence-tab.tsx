"use client";

import { BookOpen, Brain, ThumbsUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Auto Inteligência (spec 0023, RF-13 a RF-16). A base de conhecimento, as
 * memórias e o feedback entram na fase 7 do roadmap — esta aba já existe para
 * o usuário saber onde isso vai morar.
 */
const SECTIONS = [
  {
    icon: BookOpen,
    title: "Base de conhecimento",
    description:
      "Envie PDFs, planilhas e documentos. O ASTRO passa a responder e executar com base neles.",
  },
  {
    icon: Brain,
    title: "Memórias e regras",
    description:
      "Fatos e limites da sua empresa, como desconto máximo e tom de voz. Valem acima de qualquer instrução que chegue por mensagem.",
  },
  {
    icon: ThumbsUp,
    title: "Aprender com o uso",
    description:
      "Suas correções viram sugestões de regra. Nada entra em vigor sem um administrador aprovar.",
  },
];

export function AutoIntelligenceTab() {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {SECTIONS.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <section.icon className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">{section.title}</CardTitle>
            <CardDescription>{section.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Em construção.</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
