import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  useDeleteInsightShares,
  useMutationShareInsights,
  useQueryListInsightShares,
} from "../../hooks/use-dashboard";
import { Input } from "@/components/ui/input";
import React, { useState } from "react";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { toast } from "sonner";
import {
  LinkIcon,
  ExternalLinkIcon,
  ClockIcon,
  Trash2Icon,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ShareListItem } from "./share-list-item";

interface SharingInsightsProps {
  children: React.ReactNode;
  name?: string;
  filters: any;
  settings: any;
}

export function SharingInsights({
  children,
  name,
  filters,
  settings,
}: SharingInsightsProps) {
  const mutation = useMutationShareInsights();
  const { shares, isLoading: isLoadingShares } = useQueryListInsightShares();
  const [nameSharing, setNameSharing] = useState<string>(name ?? "");
  const [hasError, setHasError] = useState(false);
  const [tab, setTab] = useState("create");

  const handleShareInsights = (e: React.FormEvent) => {
    e.preventDefault();

    if (!nameSharing.trim()) {
      setHasError(true);
      return;
    }

    mutation.mutate(
      {
        name: nameSharing.trim(),
        filters,
        settings,
      },
      {
        onSuccess: (data) => {
          toast.success(
            "Link de compartilhamento copiado para área de trabalho",
          );
          navigator.clipboard.writeText(
            `${process.env.NEXT_PUBLIC_APP_URL}/insights/${data.organizationId}/${data.token}`,
          );
          setNameSharing("");
        },
        onError: () => {
          toast.error("Erro ao compartilhar relatório");
        },
      },
    );
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Compartilhar</DialogTitle>
          <DialogDescription>
            Compartilhe este relatório com sua equipe
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="create">Criar novo</TabsTrigger>
            <TabsTrigger value="list">Compartilhamentos</TabsTrigger>
          </TabsList>

          {/* Aba: Criar novo compartilhamento */}
          <TabsContent value="create">
            <form onSubmit={handleShareInsights} className="space-y-5 py-6 ">
              <Field data-invalid={hasError}>
                <FieldLabel htmlFor="name">Nome do relatório *</FieldLabel>
                <Input
                  id="name"
                  type="text"
                  placeholder="Ex: Relatório de trackings"
                  value={nameSharing}
                  onChange={(e) => {
                    setNameSharing(e.target.value);
                    if (hasError) setHasError(false);
                  }}
                  disabled={mutation.isPending}
                />
                {hasError && <FieldError>Nome é obrigatório</FieldError>}
              </Field>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button disabled={mutation.isPending}>
                  Compartilhar
                  {mutation.isPending ? <Spinner /> : <LinkIcon />}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          {/* Aba: Lista de compartilhamentos */}
          <TabsContent value="list">
            <div className="pt-2">
              {isLoadingShares ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : shares.length === 0 ? (
                <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-10 text-sm">
                  <LinkIcon className="size-8 opacity-30" />
                  <p>Nenhum relatório compartilhado ainda</p>
                </div>
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {shares.map((share) => (
                    <ShareListItem key={share.id} share={share} />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
