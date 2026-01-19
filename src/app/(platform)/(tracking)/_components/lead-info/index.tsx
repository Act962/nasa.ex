"use client";

import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
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
import { InfoItem } from "./Info-item";
import { useMutationLeadUpdate } from "@/features/leads/hooks/use-lead-update";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface LeadInfoProps extends React.ComponentProps<"div"> {
  initialData: LeadFull;
}

export function LeadInfo({ initialData, className, ...rest }: LeadInfoProps) {
  const { data: session, isPending } = authClient.useSession();
  const [isEditingName, setIsEditingName] = useState(false);
  const [name, setName] = useState(initialData.lead.name);
  const router = useRouter();
  const { lead } = initialData;

  const mutate = useMutationLeadUpdate(lead.id);

  const handleUpdateName = (name: string) => {
    if (!name) return;
    mutate.mutate({
      id: lead.id,
      name,
    });
    setIsEditingName(false);
  };

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

      <div className="flex flex-col space-y-2 items-center mt-4">
        <Avatar className="size-12">
          <AvatarImage src={"https://github.com/ElFabrica.png"} />
        </Avatar>
        {isEditingName ? (
          <Input
            className="text-center max-w-40 h-8 text-sm"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onBlur={() => handleUpdateName(name)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleUpdateName(name);
              }
            }}
          />
        ) : (
          <div
            className="flex relative items-center justify-center group gap-2 w-full cursor-pointer"
            onClick={() => setIsEditingName(true)}
          >
            <p className="text-2xl text-center font-medium max-w-40 line-clamp-2">
              {lead.name}
            </p>

          </div>
        )}
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
              <InfoItem
                type="email"
                label="Email"
                value={lead.email ?? "Sem Email"}
              />
              <InfoItem
                type="phone"
                label="Telefone"
                value={lead.phone ?? "Sem Telefone"}
              />
              <InfoItem
                loading={isPending}
                label="Responsável"
                fieldValue={lead.responsible?.name ?? ""}
                value={lead.responsible?.id ?? ""}
                type="responsible"
                trackingId={lead.trackingId}
              />
              <InfoItem
                label="Tracking"
                value={lead.tracking.name}
                type={null}
              />
              <InfoItem label="Status" value={lead.status.name} type={null} />
            </CardContent>
          </TabsContent>
          <TabsContent value="address-lead" className="w-full ">
            <CardContent className="space-y-3">
              <InfoItem label="Rua" value="Sem rua" type="street" />
              <InfoItem label="Cidade" value="Sem Cidade" type="city" />
              <InfoItem label="Estado" value="Sem Estado" type="city" />
              <InfoItem label="País" value="Sem País" type="country" />
            </CardContent>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
