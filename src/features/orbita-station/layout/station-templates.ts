import type { RoomKindKey } from "./room-kinds";

/** Sala na fileira: tipo, largura em metros e um nome próprio opcional. */
export type TemplateRoom = readonly [kind: RoomKindKey, width: number, customName?: string];

export interface StationTemplate {
  key: string;
  name: string;
  description: string;
  top: readonly TemplateRoom[];
  bottom: readonly TemplateRoom[];
}

export const STATION_TEMPLATES: readonly StationTemplate[] = [
  {
    key: "completo",
    name: "Atendimento, financeiro e produção",
    description: "Operação completa com recepção e back-office.",
    top: [["terminal", 10], ["chat", 14], ["agenda", 12], ["meeting", 12], ["finance", 12]],
    bottom: [["workspace", 18], ["sales", 16], ["restroom", 8], ["common", 10], ["admin", 8, "RH"]],
  },
  {
    key: "compacto",
    name: "Escritório compacto",
    description: "Poucas salas, tudo perto.",
    top: [["terminal", 8], ["chat", 12], ["meeting", 10], ["finance", 10]],
    bottom: [["workspace", 14], ["sales", 12], ["restroom", 6], ["common", 8]],
  },
  {
    key: "atendimento",
    name: "Central de atendimento",
    description: "NasaChat grande no centro da operação.",
    top: [["terminal", 10], ["chat", 24], ["agenda", 10], ["meeting", 12]],
    bottom: [["workspace", 14], ["finance", 10], ["restroom", 8], ["common", 12], ["admin", 12]],
  },
  {
    key: "comercial",
    name: "Operação comercial",
    description: "Guichês para cada vendedor.",
    top: [["terminal", 8], ["chat", 12], ["sales", 24], ["meeting", 12]],
    bottom: [["field", 14], ["finance", 12], ["workspace", 12], ["restroom", 8], ["common", 10]],
  },
  {
    key: "agencia",
    name: "Agência de marketing",
    description: "Criação no centro, reuniões com clientes.",
    top: [["terminal", 8], ["meeting", 14], ["workspace", 22, "Criação"], ["agenda", 10]],
    bottom: [["sales", 12], ["chat", 12], ["finance", 10], ["restroom", 8], ["common", 12]],
  },
  {
    key: "servicos",
    name: "Empresa de serviços",
    description: "Agenda e operação em destaque.",
    top: [["terminal", 8], ["agenda", 12], ["chat", 14], ["workspace", 20, "Operações"]],
    bottom: [["finance", 12], ["meeting", 12], ["admin", 10], ["restroom", 8], ["common", 12]],
  },
  {
    key: "administrativo",
    name: "Escritório administrativo",
    description: "Documentos e financeiro.",
    top: [["terminal", 8], ["admin", 16], ["finance", 14], ["meeting", 14]],
    bottom: [["workspace", 18], ["agenda", 10], ["restroom", 10], ["common", 14]],
  },
  {
    key: "hibrido",
    name: "Híbrido com vendedores externos",
    description: "Base para quem vende na rua.",
    top: [["terminal", 8], ["chat", 12], ["sales", 14], ["field", 14], ["meeting", 12]],
    bottom: [["workspace", 16], ["finance", 12], ["restroom", 8], ["common", 12], ["admin", 12, "RH"]],
  },
];

export const DEFAULT_TEMPLATE_KEY = "completo";

export function findTemplate(templateKey: string): StationTemplate {
  return (
    STATION_TEMPLATES.find((template) => template.key === templateKey) ??
    STATION_TEMPLATES.find((template) => template.key === DEFAULT_TEMPLATE_KEY)!
  );
}
