"use client";

import {
  Building2Icon,
  SettingsIcon,
  UsersIcon,
  ShieldCheck,
  FileInput,
  Bell,
  FolderIcon,
  CreditCard,
  GraduationCap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOrgRole } from "@/hooks/use-org-role";

const tabsLink = [
  {
    label: "Geral",
    href: "",
    icon: SettingsIcon,
    singleAllowed: true,
  },
  {
    label: "Empresa",
    href: "/company",
    icon: Building2Icon,
    singleAllowed: true, // visible but read-only
  },
  {
    label: "Projetos/Clientes",
    href: "/projects",
    icon: FolderIcon,
    singleAllowed: true,
  },
  {
    label: "Membros",
    href: "/members",
    icon: UsersIcon,
    singleAllowed: false,
  },
  {
    label: "Permissões",
    href: "/permissions",
    icon: ShieldCheck,
    singleAllowed: true, // can see but can't edit
  },
  {
    label: "Importar",
    href: "/integration",
    icon: FileInput,
    singleAllowed: false,
  },
  {
    label: "Notificações",
    href: "/notifications",
    icon: Bell,
    singleAllowed: true,
  },
  {
    label: "Assinatura",
    href: "/billing",
    icon: CreditCard,
    singleAllowed: true,
  },
  {
    label: "NASA Route",
    href: "/nasa-route",
    icon: GraduationCap,
    singleAllowed: false,
  },
];

export function TabsList() {
  const pathname = usePathname();
  const { isSingle } = useOrgRole();

  const isActive = (href: string) => {
    const fullPath = href ? `/settings${href}` : "/settings";
    return pathname === fullPath;
  };

  const visibleTabs = tabsLink.filter((tab) => !isSingle || tab.singleAllowed);

  return (
    <div className="border-b pb-2 pl-4">
      <div className="w-full flex max-w-7xl mx-auto items-center gap-4 overflow-x-auto">
        {visibleTabs.map((tab) => (
          <Link
            key={tab.href}
            href={`/settings${tab.href}`}
            className={`flex items-center gap-2 text-sm font-medium whitespace-nowrap cursor-pointer hover:bg-muted px-2 py-1 rounded-md transition-colors ${
              isActive(tab.href) ? "bg-muted" : ""
            }`}
          >
            <tab.icon className="size-4" />
            <span className="text-sm font-medium text-foreground">
              {tab.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
