"use client";

import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { LeadFull } from "@/types/lead";
import { TabsContent } from "@radix-ui/react-tabs";
import {
  ChevronLeft,
  Circle,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface LeadInfoProps extends React.ComponentProps<"div"> {
  initialData: LeadFull;
}

export function LeadInfo({ initialData, className, ...rest }: LeadInfoProps) {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const { lead } = initialData;
  return (
    <div
      className={cn("w-64 h-full bg-sidebar border-r px-4", className)}
      {...rest}
    >
      <div className="hidden sm:flex items-center gap-2 mt-3">
        <Button
          size={"icon-xs"}
          variant={"outline"}
          onClick={() => router.back()}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-xs font-medium">Voltar</span>
      </div>
      {/*Info */}

      <div>
        <div className="flex flex-col space-y-2 items-center mt-4">
          <Avatar className="size-12">
            <AvatarImage src={"https://github.com/ElFabrica.png"} />
          </Avatar>
          <span className="text-2xl font-medium">{lead.name}</span>
          <div className="flex items-center justify-items-center gap-3">
            <Button
              size={"icon-xs"}
              className="bg-foreground/1"
              variant={"ghost"}
            >
              <Plus className="size-3" />
            </Button>
            <Button
              size={"icon-xs"}
              className="bg-foreground/1"
              variant={"ghost"}
            >
              <Mail className="size-3" />
            </Button>
            <Button
              size={"icon-xs"}
              className="bg-foreground/1"
              variant={"ghost"}
            >
              <Phone className="size-3" />
            </Button>
            <Button
              size={"icon-xs"}
              className="bg-foreground/1"
              variant={"ghost"}
            >
              <MoreHorizontal className="size-3" />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Circle
              color="bg-emerald-500"
              className="bg-emerald-500 rounded-3xl size-1.5"
            />
            <span className="text-xs font-light opacity-70">
              Última atividade - {lead.updatedAt.toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/*Tabs */}
      <div className="mt-2">
        <Tabs defaultValue="info-lead" className="items-center">
          <TabsList>
            <TabsTrigger className="text-xs " value="info-lead">
              Informações
            </TabsTrigger>
            <TabsTrigger className="text-xs" value="address-lead">
              Endereço
            </TabsTrigger>
          </TabsList>
          <TabsContent value="info-lead" className="w-full ">
            <CardContent className="space-y-3">
              <InfoItem label="Email" value={lead.email ?? "Sem Email"} />
              <InfoItem label="Telefone" value={lead.phone ?? "Sem Telefone"} />
              <InfoItem
                loading={isPending}
                label="Responsável"
                value={session?.user.name ?? "Sem Responsável"}
              />
              <InfoItem label="Tracking" value={lead.tracking.name} />
              <InfoItem label="Status" value={lead.status.name} />
            </CardContent>
          </TabsContent>
          <TabsContent value="address-lead" className="w-full ">
            <CardContent className="space-y-3">
              <InfoItem label="Rua" value="Sem rua" />
              <InfoItem label="Cidade" value="Sem Cidade" />
              <InfoItem label="Estado" value="Sem Estado" />
              <InfoItem label="País" value="Sem País" />
            </CardContent>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

interface InfoItemProps {
  label: string;
  value: string;
  loading?: boolean;
}

function InfoItem({ label, value, loading }: InfoItemProps) {
  return (
    <div className="flex flex-col gap-1">
      {loading && (
        <div className="flex flex-col w-full gap-1">
          <Skeleton className="w-full h-4 rounded-sm" />
          <Skeleton className="w-20 h-4 rounded-sm" />
        </div>
      )}
      {!loading && (
        <div className="flex flex-col gap-1">
          <span className="text-xs opacity-60">{label}</span>
          <span className="text-xs">{value}</span>
        </div>
      )}
    </div>
  );
}
