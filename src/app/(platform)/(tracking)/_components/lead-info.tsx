"use client";

import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import { getQueryClient } from "@/lib/query/hydration";
import { cn } from "@/lib/utils";
import { LeadFull } from "@/types/lead";
import { normalizePhone, phoneMask } from "@/utils/format-phone";
import { TabsContent } from "@radix-ui/react-tabs";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  Circle,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
                value={session?.user.name ?? "Sem Responsável"}
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

type TypeFieldLead =
  | "email"
  | "phone"
  | "responsible"
  | "street"
  | "city"
  | "country"
  | null;

interface InfoItemProps {
  label: string;
  value: string;
  loading?: boolean;
  type: TypeFieldLead;
  trackingId?: string;
}
function InfoItem({ label, value, loading, type, trackingId }: InfoItemProps) {
  const [isEditingLead, setIsEditingLead] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);
  const { leadId } = useParams<{ leadId: string }>();
  function handleToggle() {
    setIsEditingLead((isEditingLead) => !isEditingLead);
  }

  const queryClient = getQueryClient();
  const mutation = useMutation(
    orpc.leads.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.leads.get.queryKey({
            input: { id: leadId },
          }),
        });
      },
    })
  );

  function handleEditField(dataField: string) {
    handleToggle();
    const prev = displayValue;
    setDisplayValue(dataField);
    const payload: Record<string, string> = { id: leadId } as any;
    if (type === "email") payload.email = dataField;
    if (type === "phone") payload.phone = normalizePhone(dataField);
    if (type === "responsible") return;
    mutation.mutate(payload as any, {
      onError: () => {
        setDisplayValue(prev);
      },
    });
  }

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  return (
    <>
      <div className="flex flex-col gap-1 lead">
        {loading && (
          <div className="flex flex-col w-full gap-1">
            <Skeleton className="w-full h-4 rounded-sm" />
            <Skeleton className="w-20 h-4 rounded-sm" />
          </div>
        )}
        {!loading && (
          <div className="flex flex-col gap-1 group">
            <span className="text-xs opacity-60">{label}</span>
            {!isEditingLead ? (
              <div className="flex items-center">
                <Tooltip delayDuration={700}>
                  <TooltipTrigger asChild>
                    <span className="text-xs max-w-[180px] truncate">
                      {type === "phone"
                        ? phoneMask(displayValue)
                        : displayValue}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{displayValue}</p>
                  </TooltipContent>
                </Tooltip>
                {type && (
                  <Button
                    variant={"ghost"}
                    size={"icon-xs"}
                    className="items-center ml-2 opacity-100 sm:opacity-0 
                    transition-opacity
                    group-hover:opacity-100"
                    onClick={handleToggle}
                  >
                    <Pencil className="size-3" />
                  </Button>
                )}
              </div>
            ) : (
              <>
                {type === "responsible" ? (
                  <SelectEditForm
                    type={type}
                    trackingId={trackingId!}
                    value={displayValue}
                    onSubmit={(value) => handleEditField(value)}
                  />
                ) : (
                  <InputEditForm
                    type={type}
                    value={displayValue}
                    onSubmit={(value) => handleEditField(value)}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
interface EditingInputComponentProps {
  value: string;
  onSubmit: (value: string) => void;
  type: TypeFieldLead;
}

const InputEditForm = ({
  value,
  onSubmit,
  type,
}: EditingInputComponentProps) => {
  const [localValue, setLocalValue] = useState(value);

  const handleSubmit = (e: React.FormEvent) => {
    onSubmit(localValue);
    e.preventDefault();
  };

  return (
    <form onSubmit={handleSubmit}>
      <Input
        className="h-8 text-xs"
        autoFocus
        value={type === "phone" ? phoneMask(localValue) : localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleSubmit}
      />
      <button type="submit" className="hidden sr-only" />
    </form>
  );
};

interface EditingDropdownComponentProps extends EditingInputComponentProps {
  trackingId: string;
}

const SelectEditForm = ({
  value,
  onSubmit,
  trackingId,
}: EditingDropdownComponentProps) => {
  const [localValue, setLocalValue] = useState(value);

  const { data } = useQuery(
    orpc.tracking.listParticipants.queryOptions({
      input: {
        trackingId: trackingId,
      },
    })
  );

  const userSelectable = data ? data.participants : [];

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    onSubmit(newValue);
  };

  return (
    <Select onValueChange={handleChange}>
      <SelectTrigger className="w-[180px]" size="sm" autoFocus>
        <SelectValue placeholder={localValue} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {userSelectable.map((participant) => (
            <SelectItem
              key={`user-selectable-${participant.id}`}
              value={participant.user.name}
            >
              {participant.user.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};
