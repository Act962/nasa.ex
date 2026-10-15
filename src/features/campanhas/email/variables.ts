// Spec 0107: variáveis aceitas no assunto e no corpo dos modelos de email (tela e envio).
export const EMAIL_TEMPLATE_VARIABLES = [
  { key: "primeiro_nome", label: "Primeiro nome" },
  { key: "nome", label: "Nome completo" },
  { key: "email", label: "Email do contato" },
  { key: "empresa", label: "Nome da empresa" },
] as const;

export type EmailVariableKey = (typeof EMAIL_TEMPLATE_VARIABLES)[number]["key"];
