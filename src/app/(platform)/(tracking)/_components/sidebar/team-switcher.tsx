"use client";

import * as React from "react";
import { ChevronsUpDown, Plus } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
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

export function TeamSwitcher({
  teams,
}: {
  teams: {
    name: string;
    logo: React.ElementType;
    plan: string;
  }[];
}) {
  const { isMobile } = useSidebar();
  const [activeTeam, setActiveTeam] = React.useState(teams[0]);
  const [organizationActive, setOrganizationActive] =
    React.useState<ActiveOrganization | null>();
  const { data: organizations } = authClient.useListOrganizations();

  if (!activeTeam) {
    return null;
  }

  const selectedOrganization = async (data: {
    orgId: string;
    orgSlug: string;
  }) => {
    const { data: organization, error } =
      await authClient.organization.setActive({
        organizationId: data.orgId,
        organizationSlug: data.orgSlug,
      });

    if (error) {
      toast.error("Erro ao tentar trocar de empresa!");
    }

    setOrganizationActive(organization);
    toast.success("Sucesso!");
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
                  <activeTeam.logo className="size-4" />
                </div>
              )}
              <div className="grid flex-1 text-left text-sm leading-tight">
                {organizationActive?.name ? (
                  <span className="truncate font-medium">
                    {organizationActive.name}
                  </span>
                ) : (
                  <span className="truncate font-medium">Nenhuma empresa</span>
                )}
              </div>
              <ChevronsUpDown className="ml-auto" />
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
            {organizations?.map((org, index) => (
              <DropdownMenuItem
                key={org.name}
                className="gap-2 p-2 cursor-pointer"
                onClick={() =>
                  selectedOrganization({ orgId: org.id, orgSlug: org.slug })
                }
              >
                <div className="flex size-6 items-center justify-center rounded-md border overflow-hidden">
                  {org.logo && (
                    <Image
                      src={org.logo}
                      alt={org.name}
                      width={16}
                      height={16}
                      className="size-6"
                    />
                  )}
                </div>
                {org.name}
                <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
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
  );
}
