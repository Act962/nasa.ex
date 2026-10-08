"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { useClientPublicLink } from "@/features/form-records/hooks/use-client-records";
import { formatPeriodKey } from "./form-records-section";

// Um lugar só para mandar ao cliente o link de acompanhamento dele (spec 0075, RF-16).

const ALL_PERIODS = "all";
const MIN_WHATSAPP_DIGITS = 10;
const BRAZIL_COUNTRY_CODE = "55";

export interface LinkClient {
  id: string;
  name: string;
  phone: string | null;
  recordCount: number;
}

/** Telefone provisório (só zeros) ou curto não vira destino: o WhatsApp abre para escolher o contato. */
function toWhatsAppNumber(phone: string | null): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < MIN_WHATSAPP_DIGITS || /^0+/.test(digits)) return "";
  return digits.startsWith(BRAZIL_COUNTRY_CODE) && digits.length > 11 ? digits : `${BRAZIL_COUNTRY_CODE}${digits}`;
}

export function SendClientLinkSheet({
  isOpen,
  onOpenChange,
  clients,
  periodKeys,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  clients: LinkClient[];
  periodKeys: string[];
}) {
  const [searchText, setSearchText] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [periodKey, setPeriodKey] = useState<string>(periodKeys[0] ?? ALL_PERIODS);
  const [tokenByClientId, setTokenByClientId] = useState<Record<string, string>>({});
  const clientLink = useClientPublicLink();

  const changeOpen = (nextIsOpen: boolean) => {
    if (!nextIsOpen) {
      setSearchText("");
      setSelectedClientId(null);
    }
    onOpenChange(nextIsOpen);
  };

  const normalizedSearch = searchText.trim().toLowerCase();
  const visibleClients = normalizedSearch ? clients.filter((client) => client.name.toLowerCase().includes(normalizedSearch)) : clients;
  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null;
  const token = selectedClientId ? tokenByClientId[selectedClientId] : undefined;

  // O link é gerado ao escolher o cliente, para o botão do WhatsApp já ser um link de verdade.
  const selectClient = (client: LinkClient) => {
    setSelectedClientId(client.id);
    if (tokenByClientId[client.id]) return;
    clientLink.mutate(
      { leadId: client.id, rotate: false },
      {
        onSuccess: (result) => {
          if (result.token) setTokenByClientId((current) => ({ ...current, [client.id]: result.token as string }));
        },
        onError: () => toast.error("Não consegui gerar o link deste cliente. Tente de novo."),
      },
    );
  };

  const periodQuery = periodKey === ALL_PERIODS ? "" : `?periodo=${periodKey}`;
  const linkUrl = token && typeof window !== "undefined" ? `${window.location.origin}/lead/${token}/fichas${periodQuery}` : "";
  const periodText = periodKey === ALL_PERIODS ? "" : ` de ${formatPeriodKey(periodKey)}`;
  const whatsAppUrl = linkUrl
    ? `https://wa.me/${toWhatsAppNumber(selectedClient?.phone ?? null)}?text=${encodeURIComponent(`Olá! Segue o link para acompanhar seus atendimentos${periodText}: ${linkUrl}`)}`
    : "";

  const copyLink = async () => {
    if (!linkUrl) return;
    try {
      await navigator.clipboard.writeText(linkUrl);
      toast.success(`Link de ${selectedClient?.name ?? "cliente"} copiado.`);
    } catch {
      toast.message(linkUrl);
    }
  };

  return (
    <Drawer open={isOpen} onOpenChange={changeOpen}>
      <DrawerContent className="mx-auto max-h-[88vh] w-full max-w-lg rounded-t-[26px]!">
        <DrawerHeader className="text-left">
          <DrawerTitle>Enviar link ao cliente</DrawerTitle>
          <DrawerDescription>O cliente vê só as fichas e os valores dele, sem senha.</DrawerDescription>
        </DrawerHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchText}
              placeholder="Buscar cliente"
              aria-label="Buscar cliente"
              onChange={(event) => setSearchText(event.target.value)}
              className="h-11 pl-9"
            />
          </div>
          <ul className="min-h-24 flex-1 divide-y overflow-y-auto rounded-[20px] border">
            {visibleClients.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhum cliente com ficha.</li>}
            {visibleClients.map((client) => {
              const isSelected = client.id === selectedClientId;
              return (
                <li key={client.id}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => selectClient(client)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-accent"
                  >
                    <span className={`min-w-0 break-words text-sm ${isSelected ? "font-semibold" : ""}`}>{client.name}</span>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      {client.recordCount} {client.recordCount === 1 ? "ficha" : "fichas"}
                      {isSelected && <Check className="size-4 text-foreground" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {periodKeys.length > 0 && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Mês</span>
              <Select value={periodKey} onValueChange={setPeriodKey}>
                <SelectTrigger className="h-11 w-56" aria-label="Mês">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_PERIODS}>Todos os meses</SelectItem>
                  {periodKeys.map((key) => (
                    <SelectItem key={key} value={key}>
                      {formatPeriodKey(key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {selectedClient && !linkUrl ? (
            <div className="flex h-11 items-center justify-center">
              <OrbitaSpinner className="size-6" />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Button asChild={Boolean(linkUrl)} disabled={!linkUrl} className="h-11 rounded-full">
                {linkUrl ? (
                  <a href={whatsAppUrl} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="size-4" />
                    Enviar pelo WhatsApp
                  </a>
                ) : (
                  <span>
                    <MessageCircle className="size-4" />
                    Escolha o cliente
                  </span>
                )}
              </Button>
              <Button type="button" variant="outline" disabled={!linkUrl} className="h-11 rounded-full" onClick={copyLink}>
                <Copy className="size-4" />
                Copiar link
              </Button>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
