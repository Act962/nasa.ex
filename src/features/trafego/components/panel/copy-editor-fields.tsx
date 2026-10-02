import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TechnicalTerm } from "../technical-term";

const CTA_SUGGESTIONS = [
  "Saiba mais",
  "Enviar mensagem",
  "Comprar agora",
  "Cadastre-se",
  "Fale conosco",
];

export interface CopyDraft {
  headline: string;
  primaryText: string;
  description: string;
  callToAction: string;
}

export const EMPTY_DRAFT: CopyDraft = {
  headline: "",
  primaryText: "",
  description: "",
  callToAction: "",
};

export function CopyEditorFields({
  draft,
  onChange,
}: {
  draft: CopyDraft;
  onChange: (draft: CopyDraft) => void;
}) {
  return (
    <div className="grid gap-3">
      <div>
        <Label className="text-xs">Título (opcional)</Label>
        <Input
          value={draft.headline}
          onChange={(event) =>
            onChange({ ...draft, headline: event.target.value })
          }
          placeholder="Ex.: Frete grátis nesta semana"
          className="mt-1"
        />
      </div>
      <div>
        <Label className="text-xs">Texto principal</Label>
        <Textarea
          value={draft.primaryText}
          onChange={(event) =>
            onChange({ ...draft, primaryText: event.target.value })
          }
          placeholder="O que o seu cliente precisa ler para clicar?"
          rows={4}
          className="mt-1"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Descrição (opcional)</Label>
          <Input
            value={draft.description}
            onChange={(event) =>
              onChange({ ...draft, description: event.target.value })
            }
            placeholder="Linha de apoio"
            className="mt-1"
          />
        </div>
        <div>
          <div className="flex items-center text-xs">
            <Label className="text-xs">Texto do botão</Label>
            <TechnicalTerm term="cta" />
          </div>
          <Input
            value={draft.callToAction}
            onChange={(event) =>
              onChange({ ...draft, callToAction: event.target.value })
            }
            placeholder="Saiba mais"
            className="mt-1"
            list="trafego-cta-suggestions"
          />
          <datalist id="trafego-cta-suggestions">
            {CTA_SUGGESTIONS.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        </div>
      </div>
    </div>
  );
}
