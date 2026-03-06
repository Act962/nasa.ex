import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckIcon, Search, UserIcon } from "lucide-react";
import { useState } from "react";
import { useQueryLeadsWithoutConversation } from "../hooks/use-leads-conversation";
import { useCreateConversation } from "../hooks/use-conversation";
import { Spinner } from "@/components/ui/spinner";
interface CreateChatProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  trackingId: string;
  token: string;
}

export function CreateChatDialog({
  isOpen,
  onOpenChange,
  trackingId,
  token,
}: CreateChatProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<string[]>([]);
  function toggleSelectCustomer(phone: string) {
    if (selectedCustomer?.includes(phone)) {
      setSelectedCustomer(
        selectedCustomer.filter((customer) => customer !== phone),
      );
    } else {
      setSelectedCustomer([...selectedCustomer, phone]);
    }
  }

  const { customers, isLoading } = useQueryLeadsWithoutConversation(trackingId);
  const createConversation = useCreateConversation({ trackingId });

  const filteredLeads = customers?.filter((customer) => {
    return (
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const data = {
      phone: selectedCustomer,
      trackingId,
      token,
    };
    console.log(data);
    createConversation.mutate(data, {
      onSuccess: () => {
        onOpenChange(false);
        setSelectedCustomer([]);
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Crie um novo chat</DialogTitle>
          <DialogDescription>
            Busque e selecione um cliente para iniciar uma conversa
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>

          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-2">
              {!isLoading &&
                filteredLeads?.map((customer) => (
                  <button
                    disabled={createConversation.isPending || !customer.phone}
                    type="button"
                    key={customer.id}
                    onClick={() => toggleSelectCustomer(customer.phone || "")}
                    className="w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-all hover:border-primary hover:bg-accent"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <UserIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {customer.name}
                        </span>
                        {selectedCustomer?.includes(customer.phone || "") && (
                          <CheckIcon className="h-4 w-4 text-primary ml-auto shrink-0" />
                        )}
                      </div>
                      {customer.phone && (
                        <p className="text-xs text-muted-foreground truncate">
                          {customer.phone}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              {!isLoading && filteredLeads?.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <UserIcon className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Nenhum lead encontrado</p>
                  <p className="text-xs text-muted-foreground">
                    Tente buscar por outro lead
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={() => onOpenChange(false)}
              type="button"
            >
              Cancelar
            </Button>
            <Button
              variant="default"
              className="flex-1"
              type="submit"
              disabled={!selectedCustomer || createConversation.isPending}
            >
              {createConversation.isPending ? (
                <Spinner className="h-4 w-4" />
              ) : (
                "Criar Chat"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
