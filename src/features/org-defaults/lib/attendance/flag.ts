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
