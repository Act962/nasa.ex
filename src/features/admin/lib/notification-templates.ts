export interface NotificationTemplate {
  id: string;
  name: string;
  title: string;
  body: string;
  type: "info" | "warning" | "success" | "error";
  category: "system" | "security" | "maintenance" | "feature" | "alert";
  variables?: string[];
}

export const NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  // Sistema
  {
    id: "system-maintenance",
    name: "Manutenção Programada",
    title: "Manutenção do Sistema",
    body: "O NASA.EX passará por manutenção programada em {{date}} das {{startTime}} às {{endTime}}. Esperamos aproximadamente {{duration}} de indisponibilidade.",
    type: "warning",
    category: "system",
    variables: ["date", "startTime", "endTime", "duration"],
  },
  {
    id: "system-update",
    name: "Atualização do Sistema",
    title: "Nova versão disponível",
    body: "Uma nova versão do NASA.EX foi lançada com {{featureCount}} melhorias e {{bugCount}} correções. Atualize para aproveitar os novos recursos!",
    type: "info",
    category: "system",
    variables: ["featureCount", "bugCount"],
  },
  {
    id: "system-downtime",
    name: "Sistema Indisponível",
    title: "Serviço Temporariamente Indisponível",
    body: "Desculpe, {{service}} está temporariamente indisponível. Nossa equipe está trabalhando para resolver o problema. Esperamos restabelecer em breve.",
    type: "error",
    category: "system",
    variables: ["service"],
  },

  // Segurança
  {
    id: "security-alert",
    name: "Alerta de Segurança",
    title: "Atividade Suspeita Detectada",
    body: "Detectamos {{attemptCount}} tentativas de acesso suspeitas em sua conta. Por favor, revise sua atividade recente e considere alterar sua senha.",
    type: "error",
    category: "security",
    variables: ["attemptCount"],
  },
  {
    id: "security-2fa",
    name: "Autenticação em Dois Fatores",
    title: "Habilite Autenticação em Dois Fatores",
    body: "Aumentamos a segurança da plataforma. Recomendamos habilitar autenticação em dois fatores em sua conta.",
    type: "warning",
    category: "security",
  },
  {
    id: "security-password-expire",
    name: "Expiração de Senha",
    title: "Sua Senha Vai Expirar em Breve",
    body: "Sua senha expirará em {{days}} dias. Por favor, atualize-a para manter o acesso à sua conta.",
    type: "warning",
    category: "security",
    variables: ["days"],
  },

  // Manutenção
  {
    id: "maintenance-backup",
    name: "Backup em Progresso",
    title: "Backup de Dados em Andamento",
    body: "Estamos realizando backup de seus dados. O sistema pode estar mais lento que o normal durante este período.",
    type: "info",
    category: "maintenance",
  },
  {
    id: "maintenance-database",
    name: "Otimização de Banco de Dados",
    title: "Otimizando Base de Dados",
    body: "Estamos otimizando nosso banco de dados para melhorar o desempenho. Algumas operações podem estar mais lentas.",
    type: "info",
    category: "maintenance",
  },

  // Feature
  {
    id: "feature-new-released",
    name: "Novo Recurso Disponível",
    title: "🚀 {{featureName}} já está disponível",
    body: "Teste agora o novo recurso {{featureName}}. Acesse {{link}} para saber mais.",
    type: "success",
    category: "feature",
    variables: ["featureName", "link"],
  },
  {
    id: "feature-beta-access",
    name: "Acesso Beta",
    title: "Você tem acesso ao programa Beta",
    body: "Parabéns! Você foi selecionado para acessar {{featureName}} em versão beta. Sua opinião é importante para nós!",
    type: "success",
    category: "feature",
    variables: ["featureName"],
  },

  // Alerta
  {
    id: "alert-storage-limit",
    name: "Limite de Armazenamento",
    title: "Espaço de Armazenamento Quase Cheio",
    body: "Você está usando {{usedPercent}}% do seu espaço. {{action}}",
    type: "warning",
    category: "alert",
    variables: ["usedPercent", "action"],
  },
  {
    id: "alert-quota-exceeded",
    name: "Cota Excedida",
    title: "Limite de {{resource}} Atingido",
    body: "Você atingiu o limite de {{resource}} do seu plano. Considere fazer upgrade ou liberar espaço.",
    type: "error",
    category: "alert",
    variables: ["resource"],
  },
  {
    id: "alert-invitation-pending",
    name: "Convite Pendente",
    title: "Você foi convidado para {{organizationName}}",
    body: "{{senderName}} convidou você para se juntar a {{organizationName}}. Aceitarei o convite?",
    type: "info",
    category: "alert",
    variables: ["organizationName", "senderName"],
  },
];

export function getTemplate(
  id: string
): NotificationTemplate | undefined {
  return NOTIFICATION_TEMPLATES.find((t) => t.id === id);
}

export function interpolateTemplate(
  template: NotificationTemplate,
  variables: Record<string, string>
): { title: string; body: string } {
  let title = template.title;
  let body = template.body;

  if (template.variables) {
    template.variables.forEach((variable) => {
      const value = variables[variable] || `{{${variable}}}`;
      const regex = new RegExp(`{{${variable}}}`, "g");
      title = title.replace(regex, value);
      body = body.replace(regex, value);
    });
  }

  return { title, body };
}

export function getTemplatesByCategory(
  category: NotificationTemplate["category"]
): NotificationTemplate[] {
  return NOTIFICATION_TEMPLATES.filter((t) => t.category === category);
}

export function getAllCategories(): NotificationTemplate["category"][] {
  const categories = new Set(NOTIFICATION_TEMPLATES.map((t) => t.category));
  return Array.from(categories);
}
