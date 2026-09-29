"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import {
  Building,
  Check,
  ChevronsUpDown,
  GalleryVerticalEnd,
  Plus,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import Image from "next/image";
import { ActiveOrganization } from "@/lib/auth-types";
import { toast } from "sonner";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { resolveOrgSwitchRedirect } from "./resolve-org-switch-redirect";

// Update
export function TeamSwitcher() {
  const { isMobile } = useSidebar();
  const [organizationActive, setOrganizationActive] =
    React.useState<ActiveOrganization | null>();
  const { data: organizations } = authClient.useListOrganizations();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [switchingToName, setSwitchingToName] = React.useState<string | null>(null);

  const organizationsSorted = organizations?.sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const selectedOrganization = async (data: {
    orgId: string;
    orgSlug: string;
    orgName: string;
  }) => {
    if (data.orgId === organizationActive?.id || switchingToName) return;
    setSwitchingToName(data.orgName);
    try {
      const { data: organization, error } =
        await authClient.organization.setActive({
          organizationId: data.orgId,
          organizationSlug: data.orgSlug,
        });

      if (error) {
        toast.error("Erro ao tentar trocar de empresa!");
        return;
      }

      setOrganizationActive(organization);

      const redirectTo = resolveOrgSwitchRedirect(pathname);
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }

      // Reset (e não invalidate): a tela troca na hora para o carregamento, sem mostrar dados da empresa anterior.
      await queryClient.resetQueries();

      toast.success(`Agora você está em ${data.orgName}`);
    } finally {
      setSwitchingToName(null);
    }
  };

  React.useEffect(() => {
    const getCurrentOrg = async () => {
      const { data, error } =
        await authClient.organization.getFullOrganization();
      if (!error && data) {
        setOrganizationActive(data);
      }
    };
    getCurrentOrg();
  }, []);

  return (
    <>
    {/* Portal no body: dentro da sidebar o z-index fica preso ao stacking context dela e headers da página vazam por cima do desfoque. */}
    {switchingToName && createPortal(
      <div
        role="status"
        className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/40 backdrop-blur-md animate-in fade-in-0"
      >
        <OrbitaSpinner className="size-20 drop-shadow-lg" />
        <span className="sr-only">Entrando em {switchingToName}…</span>
      </div>,
      document.body,
    )}
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer"
            >
              {organizationActive?.logo ? (
                <Image
                  src={organizationActive.logo}
                  width={32}
                  height={32}
                  alt="Logo"
                  className="size-8 aspect-square rounded-lg"
                />
              ) : (
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <GalleryVerticalEnd className="size-4" />
                </div>
              )}
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                {organizationActive?.name ? (
                  <span className="truncate font-medium">
                    {organizationActive.name}
                  </span>
                ) : (
                  <span className="truncate font-medium">Nenhuma empresa</span>
                )}
              </div>
              <ChevronsUpDown className="ml-auto group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Empresas
            </DropdownMenuLabel>
            {organizationsSorted?.map((org, index) => (
              <DropdownMenuItem
                key={org.name}
                className="gap-2 p-2 cursor-pointer"
                onClick={() =>
                  selectedOrganization({ orgId: org.id, orgSlug: org.slug, orgName: org.name })
                }
              >
                <div className="flex size-6 items-center justify-center rounded-md border overflow-hidden">
                  {org.logo ? (
                    <Image
                      src={org.logo}
                      alt={org.name}
                      width={16}
                      height={16}
                      className="size-6"
                    />
                  ) : (
                    <Building className="size-4" />
                  )}
                </div>
                <span className="flex-1 truncate">{org.name}</span>
                {org.id === organizationActive?.id && <Check className="size-4 text-primary" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2 cursor-pointer" asChild>
              <Link href="/create-organization">
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <Plus className="size-4" />
                </div>
                <div className="text-muted-foreground font-medium">
                  Adicionar empresa
                </div>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
    </>
  );
}
