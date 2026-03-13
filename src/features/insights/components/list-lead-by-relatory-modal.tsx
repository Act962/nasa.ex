import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckIcon, Search, UserIcon } from "lucide-react";
import { useState } from "react";
import { useListLeadsAtInsights } from "../hooks/use-list-lead";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
interface ListLeadByRelatoryModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  leadIds: string[];
}

export function ListLeadByRelatoryModal({
  isOpen,
  onOpenChange,
  leadIds,
}: ListLeadByRelatoryModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<string[]>([]);
  const { leads, isLoading } = useListLeadsAtInsights(leadIds);

  const filteredLeads = leads?.filter((customer) => {
    return (
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Leads do relatório</DialogTitle>
          <DialogDescription>
            Busque e selecione um lead para ver os detalhes
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4">
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
            <div className="space-y-2 grid grid-rows-1 ">
              {!isLoading &&
                filteredLeads?.map((customer) => (
                  <button type="button" key={customer.id}>
                    <Link
                      href={`/contatos/${customer.id}`}
                      className="w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-all hover:border-primary hover:bg-accent"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <UserIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium line-clamp-1">
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
                    </Link>
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
              {isLoading &&
                Array.from({ length: 10 }).map((_, index) => (
                  <Skeleton className="h-10 w-full" key={index} />
                ))}
            </div>
          </ScrollArea>
        </form>
      </DialogContent>
    </Dialog>
  );
}
