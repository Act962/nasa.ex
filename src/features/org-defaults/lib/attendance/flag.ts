// Interruptor do estado de atendimento (spec 0113, RF-23): `ATTENDANCE_STATE_ORGS` = "all" ou ids de
// organização separados por vírgula. Ausente = comportamento antigo em todas as empresas.
const ALL_ORGANIZATIONS = "all";

export function isAttendanceStateEnabled(organizationId: string | null | undefined): boolean {
  if (!organizationId) return false;
  const configured = process.env.ATTENDANCE_STATE_ORGS?.trim();
  if (!configured) return false;
  if (configured === ALL_ORGANIZATIONS) return true;
  return configured
    .split(",")
    .map((enabledOrganizationId) => enabledOrganizationId.trim())
    .includes(organizationId);
}

/** Interruptor vazio: nenhuma empresa no modelo novo, e quem chama nem consulta o banco. */
export function isAttendanceStateConfigured(): boolean {
  return Boolean(process.env.ATTENDANCE_STATE_ORGS?.trim());
}

/**
 * Conversa que o estado de atendimento cuida: empresa no interruptor e canal WhatsApp. In-Chat, Instagram,
 * Facebook e chat do site seguem a regra antiga de etiquetas (o estado só é gravado em conversa de WhatsApp).
 */
export function isAttendanceManagedChannel(organizationId: string | null | undefined, channel: string | null | undefined): boolean {
  return isAttendanceStateEnabled(organizationId) && channel === "WHATSAPP";
}
