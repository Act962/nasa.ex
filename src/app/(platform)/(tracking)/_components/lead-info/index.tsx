"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutationLeadUpdate } from "@/features/leads/hooks/use-lead-update";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { LeadFull } from "@/types/lead";
import {
  ChevronLeft,
  Circle,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { InfoItem } from "./Info-item";
import { phoneMaskFull } from "@/utils/format-phone";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LeadInfoProps extends React.ComponentProps<"div"> {
  initialData: LeadFull;
}

export function LeadInfo({ initialData, className, ...rest }: LeadInfoProps) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { lead } = initialData;

  const [isEditingName, setIsEditingName] = useState(false);
  const [name, setName] = useState(lead.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const mutate = useMutationLeadUpdate(lead.id);

  const handleUpdateName = (newName: string) => {
    if (!newName || newName === lead.name) {
      setIsEditingName(false);
      return;
    }
    mutate.mutate({ id: lead.id, name: newName });
    setIsEditingName(false);
  };

  useEffect(() => {
    if (isEditingName) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditingName]);

  useEffect(() => {
    setName(lead.name);
  }, [lead.name]);

  return (
    <div
      className={cn(
        "w-72 h-full bg-sidebar border-r flex flex-col px-4",
        className,
      )}
      {...rest}
    >
      {/* Navigation Header */}
      <div className="p-4 flex items-center gap-3">
        <Button
          size="icon-xs"
          variant="ghost"
          className="rounded-full h-8 w-8 hover:bg-muted"
          onClick={() => router.back()}
        >
          <ChevronLeft className="size-5" />
        </Button>
        <h2 className="text-sm font-semibold tracking-tight">
          Detalhes do Lead
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-6">
        {/* Profile Section */}
        <div className="flex flex-col items-center space-y-3 pt-2">
          <Avatar className="size-20 border-2 border-muted shadow-sm">
            <AvatarImage src={useConstructUrl(lead.profile ?? "")} />
            <AvatarFallback className="bg-primary/5 text-primary font-bold text-xl">
              {lead.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="w-full px-2 text-center">
            {isEditingName ? (
              <Input
                disabled={mutate.isPending}
                className="text-center h-9 font-semibold text-lg"
                value={name}
                ref={inputRef}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => handleUpdateName(name)}
                onKeyDown={(e) => e.key === "Enter" && handleUpdateName(name)}
              />
            ) : (
              <h1
                className="text-xl font-bold line-clamp-2 cursor-pointer"
                onClick={() => setIsEditingName(true)}
              >
                {lead.name}
              </h1>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 pt-1">
            <ActionButton icon={<Plus className="size-4" />} />
            <ActionButton icon={<Mail className="size-4" />} />
            <ActionButton icon={<Phone className="size-4" />} />
            <ActionButton icon={<MoreHorizontal className="size-4" />} />
          </div>

          <div className="flex items-center gap-2 py-1">
            <Circle className="fill-emerald-500 text-emerald-500 size-2" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-tight">
              Atividade: {new Date(lead.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Details Tabs */}
        <Tabs defaultValue="info" className="w-full">
          <TabsList className="w-full grid grid-cols-2 mb-4">
            <TabsTrigger value="info" className="text-xs h-8">
              Informações
            </TabsTrigger>
            <TabsTrigger value="address" className="text-xs h-8">
              Endereço
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="info"
            className="space-y-2 animate-in fade-in-50 duration-300 overflow-y-auto"
          >
            <div className="space-y-2">
              <InfoItem
                type="email"
                label="E-mail"
                value={lead.email ?? ""}
                displayValueOverride={lead.email ?? "Não informado"}
                fieldKey="email"
              />
              <InfoItem
                type="phone"
                label="Telefone"
                value={lead.phone ?? ""}
                displayValueOverride={phoneMaskFull(lead.phone ?? "")}
                fieldKey="phone"
              />
              <InfoItem
                type="responsible"
                label="Responsável"
                value={lead.responsible?.id ?? ""}
                displayValueOverride={lead.responsible?.name ?? "Não atribuído"}
                fieldKey="responsibleId"
                trackingId={lead.trackingId}
                loading={isPending}
              />
              <InfoItem
                type={null}
                label="Fluxo / Tracking"
                value={lead.tracking.name}
              />
              <InfoItem
                type={null}
                label="Status Atual"
                value={lead.status.name}
              />
              <InfoItem
                type="tags"
                label="Tags"
                value={lead.tags.map((tag) => tag.id)}
                renderValue={(value) => (
                  <ScrollArea className="h-[calc(100vh-200px)]">
                    <div className="space-y-2">{value}</div>
                  </ScrollArea>
                )}
                displayValueOverride={lead.tags
                  .map((tag) => tag.name)
                  .join(", ")}
                fieldKey="tagIds"
                trackingId={lead.trackingId}
              />
            </div>
          </TabsContent>

          <TabsContent
            value="address"
            className="space-y-5 animate-in fade-in-50 duration-300"
          >
            <div className="space-y-4">
              <InfoItem
                label="Logradouro"
                value=""
                displayValueOverride="Não informado"
                type="text"
                fieldKey="street"
              />
              <InfoItem
                label="Cidade"
                value=""
                displayValueOverride="Não informado"
                type="text"
                fieldKey="city"
              />
              <InfoItem
                label="Estado"
                value=""
                displayValueOverride="Não informado"
                type="text"
                fieldKey="state"
              />
              <InfoItem
                label="País"
                value=""
                displayValueOverride="Brasil"
                type="text"
                fieldKey="country"
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ActionButton({ icon }: { icon: React.ReactNode }) {
  return (
    <Button
      size="icon-xs"
      variant="secondary"
      className="rounded-full bg-secondary/50 hover:bg-secondary h-8 w-8 transition-all hover:scale-105"
    >
      {icon}
    </Button>
  );
}
