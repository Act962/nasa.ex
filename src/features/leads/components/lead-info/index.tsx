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
  ClipboardClockIcon,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ActionButton } from "./action-button";
import { FieldPhone } from "./fields/field-phone";
import { FieldEmail } from "./fields/field-email";
import { FieldResponsible } from "./fields/field-responsible";
import { FieldTags } from "./fields/field-tags";
import { FieldText } from "./fields/field-text";
import { InfoItem } from "./Info-item";
import { ListHistoric } from "../list-historic";
import { WhatsappIcon } from "@/components/whatsapp";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LeadInfoProps extends React.ComponentProps<"div"> {
  initialData: LeadFull;
}

export function LeadInfo({ initialData, className, ...rest }: LeadInfoProps) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { lead } = initialData;

  const [openHistoric, setOpenHistoric] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [name, setName] = useState(lead.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const mutate = useMutationLeadUpdate(lead.id, lead.trackingId);

  const handleUpdateName = (newName: string) => {
    if (!newName || newName === lead.name) {
      setIsEditingName(false);
      return;
    }
    const name = newName.trim();
    if (!name) {
      setIsEditingName(false);
      return;
    }
    mutate.mutate(
      { id: lead.id, name },
      {
        onSuccess: () => {
          setIsEditingName(false);
        },
        onError: () => {
          setName(lead.name);
        },
      },
    );
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

  function goToTracking() {
    const idConversation = initialData.lead.conversation?.id;
    router.push(`/tracking-chat/${idConversation ? idConversation : ""}`);
  }

  return (
    <>
      <div
        className={cn(
          "w-72 h-full bg-sidebar border-r flex flex-col overflow-y-auto",
          className,
        )}
        {...rest}
      >
        {/* Navigation Header - Fixed */}
        <div className="p-4 flex items-center gap-3 shrink-0">
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

        <div className="flex-1 flex flex-col min-h-0">
          {/* Profile Section - Fixed */}
          <div className="flex flex-col items-center space-y-3 pt-2 pb-6 px-4 shrink-0">
            <Avatar className="size-16 border border-muted shadow-sm">
              <AvatarImage src={useConstructUrl(lead.profile ?? "")} />
              <AvatarFallback className="bg-primary/5 font-bold text-xl">
                {lead.name.trim().charAt(0).toUpperCase()}
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

            <div className="flex items-center gap-2 pt-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <ActionButton
                    onClick={goToTracking}
                    icon={<WhatsappIcon className="size-4" />}
                  />
                </TooltipTrigger>
                <TooltipContent>Conversa</TooltipContent>
              </Tooltip>
              <ActionButton icon={<Mail className="size-4" />} />
              {/* <ActionButton icon={<Phone className="size-4" />} /> */}

              <Tooltip>
                <TooltipTrigger asChild onClick={() => setOpenHistoric(true)}>
                  <ActionButton
                    icon={<ClipboardClockIcon className="size-4" />}
                  />
                </TooltipTrigger>
                <TooltipContent>Histórico</TooltipContent>
              </Tooltip>
            </div>

            <div className="flex items-center gap-2 py-1">
              <Circle className="fill-emerald-500 text-emerald-500 size-2" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-tight">
                Atividade: {new Date(lead.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Details Tabs - Scrollable content inside */}
          <Tabs defaultValue="info" className="flex-1 flex flex-col min-h-0">
            <div className="px-4 shrink-0">
              <TabsList className="w-full grid grid-cols-2 mb-4">
                <TabsTrigger value="info" className="text-xs h-8">
                  Informações
                </TabsTrigger>
                <TabsTrigger value="address" className="text-xs h-8">
                  Endereço
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent
              value="info"
              className="flex-1 overflow-y-auto min-h-0"
            >
              <div className="px-4 py-2 space-y-2 pb-10">
                <FieldEmail
                  label="E-mail"
                  value={lead.email ?? ""}
                  trackingId={lead.trackingId}
                />
                <FieldPhone
                  label="Telefone"
                  value={lead.phone ?? ""}
                  trackingId={lead.trackingId}
                />
                <FieldResponsible
                  label="Responsável"
                  value={lead.responsible?.id ?? ""}
                  displayName={lead.responsible?.name ?? ""}
                  trackingId={lead.trackingId}
                  loading={isPending}
                />
                <InfoItem label="Fluxo / Tracking" value={lead.tracking.name} />
                <InfoItem label="Status Atual" value={lead.status.name} />
                <FieldTags
                  leadId={lead.id}
                  tags={lead.tags}
                  trackingId={lead.trackingId}
                />
              </div>
            </TabsContent>

            <TabsContent value="address" className="flex-1 min-h-0 ">
              <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4 pb-10">
                <FieldText
                  label="Logradouro"
                  value=""
                  fieldKey="street"
                  trackingId={lead.trackingId}
                />
                <FieldText
                  label="Cidade"
                  value=""
                  fieldKey="city"
                  trackingId={lead.trackingId}
                />
                <FieldText
                  label="Estado"
                  value=""
                  fieldKey="state"
                  trackingId={lead.trackingId}
                />
                <FieldText
                  label="País"
                  value=""
                  fieldKey="country"
                  placeholder="Brasil"
                  trackingId={lead.trackingId}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <ListHistoric
        leadId={lead.id}
        open={openHistoric}
        onOpenChange={setOpenHistoric}
      />
    </>
  );
}
