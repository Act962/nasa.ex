import {
  UserPlus,
  Search,
  ArrowRight,
  Zap,
  Workflow,
  GraduationCap,
  FileSignature,
  Sparkles,
} from "lucide-react";

export const SUGGESTED_PROMPTS = [
  // ── Geração de workflows (IA generativa — novo) ─────────────
  {
    icon: Sparkles,
    label: "Criar workflow do zero",
    text: "Crie um workflow assim: quando lead receber a tag 'Inbound', enviar mensagem de boas-vindas, esperar 1 dia, mandar menu de 3 opções (Consultoria/Produtos/Outros) e classificar resposta com IA pra aplicar a tag certa.",
    color: "text-violet-500",
  },
  {
    icon: FileSignature,
    label: "Preset Proposta + Contrato",
    text: "Aplica o preset 'proposta-contrato' nesse tracking — quero a cadência longa de fechamento (D+0/3/7/15/30) com contrato automático.",
    color: "text-blue-500",
  },
  {
    icon: GraduationCap,
    label: "Preset Boas-vindas NASA Route",
    text: "Quero o preset de boas-vindas pós-pagamento NASA Route — email + WhatsApp com info do curso + check-in em 3 dias.",
    color: "text-pink-500",
  },
  {
    icon: Workflow,
    label: "Workflow custom",
    text: "Quando o lead pagar uma proposta no Forge, marcar como 'Cliente Ativo', enviar email de boas-vindas e abrir um agendamento de onboarding em 7 dias.",
    color: "text-amber-500",
  },
  // ── Leads (sempre úteis) ────────────────────────────────────
  {
    icon: UserPlus,
    label: "Criar lead",
    text: "Quero criar um novo lead. Me ajude com o processo.",
    color: "text-green-500",
  },
  {
    icon: Search,
    label: "Buscar leads",
    text: "Busque leads com propostas em aberto.",
    color: "text-cyan-500",
  },
  {
    icon: ArrowRight,
    label: "Mover lead",
    text: "Quero mover um lead para a próxima etapa do funil.",
    color: "text-purple-500",
  },
  {
    icon: Zap,
    label: "Follow-up",
    text: "Liste os leads que precisam de acompanhamento hoje.",
    color: "text-yellow-500",
  },
];
