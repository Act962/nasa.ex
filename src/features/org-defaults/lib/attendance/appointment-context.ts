import "server-only";
import prisma from "@/lib/prisma";

// Variável `agendamentosCliente` dos fluxos com IA (spec 0113, RF-19): o horário que o cliente perdeu e o que
// segue marcado. Sem ela, a recuperação lia só o resumo do atendimento e citava a consulta que continuava de pé.

const UPCOMING_APPOINTMENTS_LIMIT = 3;

function formatAppointmentTime(startsAt: Date): string {
  const date = startsAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
  const time = startsAt.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  return `${date} às ${time}`;
}

export async function describeAppointmentsForFlow(leadId: string): Promise<string | null> {
  const [missedAppointment, upcomingAppointments] = await Promise.all([
    prisma.appointment.findFirst({
      where: { leadId, status: { in: ["CANCELLED", "NO_SHOW"] } },
      orderBy: { updatedAt: "desc" },
      select: { startsAt: true, status: true, agenda: { select: { name: true } } },
    }),
    prisma.appointment.findMany({
      where: { leadId, status: { in: ["PENDING", "CONFIRMED"] }, startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      take: UPCOMING_APPOINTMENTS_LIMIT,
      select: { startsAt: true, agenda: { select: { name: true } } },
    }),
  ]);
  if (!missedAppointment && upcomingAppointments.length === 0) return null;

  const parts: string[] = [];
  if (missedAppointment) {
    const missedLabel = missedAppointment.status === "NO_SHOW" ? "Não veio" : "Cancelou";
    parts.push(`${missedLabel}: ${missedAppointment.agenda.name}, ${formatAppointmentTime(missedAppointment.startsAt)}`);
  }
  const upcomingText = upcomingAppointments
    .map((appointment) => `${appointment.agenda.name}, ${formatAppointmentTime(appointment.startsAt)}`)
    .join("; ");
  parts.push(`Ainda marcado: ${upcomingText || "nenhum"}`);
  return parts.join(". ");
}
