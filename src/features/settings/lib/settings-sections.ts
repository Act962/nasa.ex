import {
  Bell,
  Building2Icon,
  CreditCard,
  FileInput,
  FolderIcon,
  GraduationCap,
  ShieldCheck,
  UserRound,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

export type SettingsSectionGroup = "voce" | "empresa" | "ferramentas";

export interface SettingsSection {
  id: string;
  /** Rótulo da aba no computador. */
  tabLabel: string;
  /** Título da seção no celular (lista e topo da página). */
  title: string;
  description: string;
  path: string;
  icon: LucideIcon;
  group: SettingsSectionGroup;
  /** Conta de usuário único também vê a seção (algumas só para leitura). */
  isVisibleToSingleUser: boolean;
}

export const SETTINGS_ROOT_PATH = "/settings";

/** No celular, `/settings` mostra a lista; o perfil abre com este parâmetro. */
export const SETTINGS_PROFILE_QUERY = "secao=perfil";

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  {
    id: "perfil",
    tabLabel: "Geral",
    title: "Meu perfil",
    description: "Foto, nome, telefone e tema",
    path: SETTINGS_ROOT_PATH,
    icon: UserRound,
    group: "voce",
    isVisibleToSingleUser: true,
  },
  {
    id: "notifications",
    tabLabel: "Notificações",
    title: "Notificações",
    description: "O que você recebe na plataforma",
    path: "/settings/notifications",
    icon: Bell,
    group: "voce",
    isVisibleToSingleUser: true,
  },
  {
    id: "company",
    tabLabel: "Empresa",
    title: "Empresa",
    description: "Dados, logo, marca e calendário",
    path: "/settings/company",
    icon: Building2Icon,
    group: "empresa",
    isVisibleToSingleUser: true,
  },
  {
    id: "projects",
    tabLabel: "Projetos/Clientes",
    title: "Projetos e clientes",
    description: "Organize o trabalho por cliente ou projeto",
    path: "/settings/projects",
    icon: FolderIcon,
    group: "empresa",
    isVisibleToSingleUser: true,
  },
  {
    id: "members",
    tabLabel: "Membros",
    title: "Membros",
    description: "Equipe, convites e cargos",
    path: "/settings/members",
    icon: UsersIcon,
    group: "empresa",
    isVisibleToSingleUser: false,
  },
  {
    id: "permissions",
    tabLabel: "Permissões",
    title: "Permissões",
    description: "O que cada pessoa pode ver e fazer",
    path: "/settings/permissions",
    icon: ShieldCheck,
    group: "empresa",
    isVisibleToSingleUser: true,
  },
  {
    id: "billing",
    tabLabel: "Assinatura",
    title: "Assinatura",
    description: "Plano, saldo de Stars e faturas",
    path: "/settings/billing",
    icon: CreditCard,
    group: "empresa",
    isVisibleToSingleUser: true,
  },
  {
    id: "integration",
    tabLabel: "Importar",
    title: "Importar dados",
    description: "Traga seus dados para a ÓRBITA",
    path: "/settings/integration",
    icon: FileInput,
    group: "ferramentas",
    isVisibleToSingleUser: false,
  },
  {
    id: "nasa-route",
    tabLabel: "ÓRBITA Route",
    title: "ÓRBITA Route",
    description: "Cursos, alunos e acesso livre",
    path: "/settings/nasa-route",
    icon: GraduationCap,
    group: "ferramentas",
    isVisibleToSingleUser: false,
  },
];

export const SETTINGS_GROUP_LABELS: Record<SettingsSectionGroup, string> = {
  voce: "Você",
  empresa: "Empresa",
  ferramentas: "Ferramentas",
};

export const SETTINGS_GROUP_ORDER: readonly SettingsSectionGroup[] = [
  "voce",
  "empresa",
  "ferramentas",
];

/** Ordem das abas no computador — mantém a que o time já conhece. */
export const SETTINGS_TAB_ORDER: readonly string[] = [
  "perfil",
  "company",
  "projects",
  "members",
  "permissions",
  "integration",
  "notifications",
  "billing",
  "nasa-route",
];

export function findSettingsSection(pathname: string): SettingsSection | undefined {
  return SETTINGS_SECTIONS.find((section) => section.path === pathname);
}

export function getVisibleSettingsSections(isSingleUser: boolean): SettingsSection[] {
  return SETTINGS_SECTIONS.filter(
    (section) => !isSingleUser || section.isVisibleToSingleUser,
  );
}
