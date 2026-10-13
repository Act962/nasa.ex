import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useFormRecordLookup } from "@/features/form-records/hooks/use-form-record-lookup";
import { useMergeLeadAsMember } from "@/features/lead-members/hooks/use-lead-members";

// Juntar um lead existente como vinculado deste (spec 0076, RF-11).

const SEARCH_DEBOUNCE_MS = 250;

export function MergeLeadDialog({
  titularLeadId,
  titularName,
  singularLabel,
  onClose,
}: {
  titularLeadId: string;
  titularName: string;
  singularLabel: string;
  onClose: () => void;
}) {
  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState("");
  const [chosenLead, setChosenLead] = useState<{ id: string; name: string } | null>(null);
  const mergeLead = useMergeLeadAsMember();

  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchText.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText]);

  const lookup = useFormRecordLookup({ source: "LEADS", query, enabled: query.length >= 2 && !chosenLead });
  const candidates = (lookup.data?.options ?? []).filter((option) => option.id && option.id !== titularLeadId);

  const confirm = () => {
    if (!chosenLead) return;
    mergeLead.mutate(
      { titularLeadId, sourceLeadId: chosenLead.id },
      {
        onSuccess: () => {
          toast.success(`${chosenLead.name} agora é ${singularLabel.toLowerCase()} de ${titularName}.`);
          onClose();
        },
        onError: (error) => toast.error(error.message || "Não foi possível juntar."),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Juntar um lead existente</DialogTitle>
          <DialogDescription>
            O lead escolhido vira {singularLabel.toLowerCase()} de {titularName}: as fichas abertas dele passam para cá e ele é arquivado no funil.
            Fichas de períodos já fechados ficam onde estão.
          </DialogDescription>
        </DialogHeader>

        {chosenLead ? (
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            <span className="min-w-0 break-words text-sm font-medium">{chosenLead.name}</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setChosenLead(null)}>
              Trocar
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={searchText} autoFocus placeholder="Buscar lead pelo nome ou telefone" className="pl-9" onChange={(event) => setSearchText(event.target.value)} />
            </div>
            {lookup.isFetching && <p className="text-sm text-muted-foreground">Buscando...</p>}
            {!lookup.isFetching && query.length >= 2 && candidates.length === 0 && <p className="text-sm text-muted-foreground">Nenhum lead encontrado.</p>}
            <ul className="max-h-56 space-y-1 overflow-y-auto">
              {candidates.map((candidate) => (
                <li key={candidate.id}>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto w-full flex-col items-start gap-0 whitespace-normal py-2 text-left"
                    onClick={() => setChosenLead({ id: candidate.id ?? "", name: candidate.label })}
                  >
                    <span className="break-words">{candidate.label}</span>
                    {candidate.detail && <span className="text-xs font-normal text-muted-foreground">{candidate.detail}</span>}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={!chosenLead || mergeLead.isPending} onClick={confirm}>
            {mergeLead.isPending ? "Juntando..." : "Juntar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
