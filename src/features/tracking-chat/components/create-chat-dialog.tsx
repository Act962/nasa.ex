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
import { Lead } from "@/generated/prisma/client";
import { CheckIcon, Search, UserIcon } from "lucide-react";
import { useState } from "react";
import { useQueryLeadsByWhats } from "../hooks/use-leads-conversation";
interface CreateChatProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateChatDialog({ isOpen, onOpenChange }: CreateChatProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Lead | null>();
  function toggleSelectCustomer(customer: Lead) {
    if (selectedCustomer?.id === customer.id) {
      setSelectedCustomer(null);
    } else {
      setSelectedCustomer(customer);
    }
  }

  const { data, isLoading } = useQueryLeadsByWhats();

  const filteredLeads = data?.leads.filter((customer) => {
    return (
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Crie um novo chat</DialogTitle>
          <DialogDescription>
            Busque e selecione um cliente para iniciar uma conversa
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
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
                    key={customer.id}
                    onClick={() => toggleSelectCustomer(customer)}
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
                        {selectedCustomer?.id === customer.id && (
                          <CheckIcon className="h-4 w-4 text-primary ml-auto shrink-0" />
                        )}
                      </div>
                      {customer.email && (
                        <p className="text-xs text-muted-foreground truncate">
                          {customer.email}
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
            >
              Cancelar
            </Button>
            <Button
              variant="default"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={!selectedCustomer}
            >
              Criar Chat
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
