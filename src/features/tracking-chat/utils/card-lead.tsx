import { LeadSource } from "@/generated/prisma/enums";

export const colorsByTemperature: Record<
  string,
  { color: string; label: string }
> = {
  COLD: { color: "#3498db", label: "Frio" },
  WARM: { color: "#f1c40f", label: "Morno" },
  HOT: { color: "#e67e22", label: "Quente" },
  VERY_HOT: { color: "#e74c3c", label: "Muito Quente" },
};
export const LeadSourceColors: Record<
  LeadSource,
  { color: string; label: string }
> = {
  [LeadSource.WHATSAPP]: { color: "#25D366", label: "WhatsApp" },
  [LeadSource.FORM]: { color: "#3498db", label: "Formulário" },
  [LeadSource.AGENDA]: { color: "#e67e22", label: "Agenda" },
  [LeadSource.DEFAULT]: { color: "#95a5a6", label: "Padrão" },
  [LeadSource.OTHER]: { color: "#9b59b6", label: "Outro" },
};
