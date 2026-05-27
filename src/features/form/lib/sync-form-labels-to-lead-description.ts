/**
 * Sincroniza os "títulos" (labels) das respostas de formulário do lead
 * pro campo `Lead.description` — que alimenta os textareas do lead em:
 *  - Card do lead no kanban (`LeadItemContainer` em `lead-item.tsx`)
 *  - Painel de observações em `lead-details.tsx` (`ObservationLead`)
 *
 * Origem: o toggle "Usar valor como título da resposta" num campo de
 * formulário (FormBuilder) faz com que o VALOR daquele campo vire o
 * `FormResponses.label` quando o lead preenche. Esses labels são
 * agregados aqui e propagados pro `Lead.description`.
 *
 * Estratégia de merge (não-destrutiva):
 *   1. Mantém intacto qualquer texto que o user escreveu MANUALMENTE
 *      antes do `MARKER` (caso clássico: anotações livres do atendente).
 *   2. Substitui tudo a partir do `MARKER` por uma seção gerenciada
 *      com os labels atuais. Quando labels mudam/somem, a seção
 *      atualiza sozinha sem mexer no texto manual.
 *   3. Quando não há labels, a seção é removida — `description` fica
 *      apenas com o texto manual.
 *
 * Fire-and-forget: erros internos logam mas não derrubam o caller —
 * a resposta do form é mais importante que o sync da description.
 */

import type { PrismaClient } from "@/generated/prisma/client";

const MARKER = "--- Respostas dos formulários ---";

export async function syncFormLabelsToLeadDescription(
  prisma: PrismaClient,
  leadId: string | null | undefined,
): Promise<void> {
  if (!leadId) return;
  try {
    const [lead, responses] = await Promise.all([
      prisma.lead.findUnique({
        where: { id: leadId },
        select: { description: true },
      }),
      prisma.formResponses.findMany({
        where: { leadId, label: { not: null } },
        select: { label: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    if (!lead) return;

    // Labels únicos (dedup defensivo — se 2 responses geram mesmo label,
    // não duplica). Mantém ordem original (FIFO por createdAt).
    const seen = new Set<string>();
    const labels: string[] = [];
    for (const r of responses) {
      const v = (r.label ?? "").trim();
      if (!v || seen.has(v)) continue;
      seen.add(v);
      labels.push(v);
    }

    const current = lead.description ?? "";
    const markerIdx = current.indexOf(MARKER);

    // Texto manual = tudo ANTES do marker (ou o `current` inteiro se
    // marker não existe). Trim no fim pra evitar acumular newlines em
    // edições sucessivas.
    const manualText =
      markerIdx >= 0 ? current.slice(0, markerIdx).trimEnd() : current.trimEnd();

    // Seção gerenciada — vazia se não tem labels
    const managedSection =
      labels.length > 0 ? `${MARKER}\n${labels.join("\n")}` : "";

    // Monta resultado final
    let next: string;
    if (!managedSection) {
      next = manualText;
    } else if (manualText) {
      next = `${manualText}\n\n${managedSection}`;
    } else {
      next = managedSection;
    }

    // No-op se nada mudou
    if (next === current) return;

    await prisma.lead.update({
      where: { id: leadId },
      data: { description: next },
    });
  } catch (err) {
    console.warn(
      "[syncFormLabelsToLeadDescription] failed for lead",
      leadId,
      err,
    );
  }
}
