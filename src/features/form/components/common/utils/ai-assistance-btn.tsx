"use client";
import { FormBlockInstance } from "@/features/form/types";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { toast } from "sonner";
import { AIChatSession } from "@/features/form/lib/google-ai";
import { v4 as uuidv4 } from "uuid";
import { generateFormQuestionPrompt } from "@/features/form/lib/prompts";
import { AstroSymbolIcon } from "@/components/astro-symbol-icon";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { useState } from "react";

const PROMPT_SUGGESTIONS = [
  "Formulário de orçamento",
  "Pesquisa de satisfação curta",
  "Inscrição para evento",
  "Adicionar 3 perguntas sobre o cliente",
];

export function AiAssistanceBtn() {
  const { formData, blockLayouts, setBlockLayouts } = useBuilderStore();
  const [userRequest, setUserRequest] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const isPublished = formData?.published;

  const GenerateFormQuestionsWithAI = async () => {
    if (!userRequest) {
      toast.error("Conte ao Astro o que você quer criar.");
      return;
    }
    try {
      setLoading(true);
      const formName = formData?.name || "";
      const formDescription = formData?.description || "";

      const PROMPT = generateFormQuestionPrompt(
        userRequest,
        formName,
        formDescription,
        blockLayouts,
      );

      const result = await AIChatSession.sendMessage(PROMPT);
      const responseText = await result.response.text();
      const parsedResponse = JSON?.parse(responseText);
      const actionType = parsedResponse.actionType;
      const generatedBlocks = parsedResponse.blocks;
      const addUniqueIdToGeneratedBlocks = addUniqueIds(generatedBlocks);

      setBlockLayouts((prevBlocks) => {
        if (actionType === "addQuestions") {
          // Append the new blocks to the existing ones
          return [...prevBlocks, ...addUniqueIdToGeneratedBlocks];
        } else if (actionType === "createForm") {
          // Remove all existing blocks
          return [...addUniqueIdToGeneratedBlocks];
        } else {
          console.warn(`Unhandled actionType: ${actionType}`);
          return prevBlocks;
        }
      });
      setIsOpen(false);
      setUserRequest("");
    } catch (error) {
      console.log(error, "error");
      toast.error("O Astro não conseguiu gerar agora. Tente de novo.");
    } finally {
      setLoading(false);
    }
  };

  function addUniqueIds(blocks: FormBlockInstance[]) {
    blocks.forEach((block) => {
      block.id = uuidv4();
      block?.childblocks?.forEach((child) => {
        child.id = uuidv4();
      });
    });
    return blocks;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          className="size-10 rounded-full border-none bg-info! text-white shadow-sm shadow-info/30 hover:bg-info/90!"
          aria-label="Criar com o Astro"
          title="Criar com o Astro"
        >
          <AstroSymbolIcon className="size-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] max-w-[calc(100vw-1rem)] p-0" forceMount align="start" side="right">
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-info text-white shadow-sm shadow-info/30">
              <AstroSymbolIcon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Criar com o Astro</p>
              <p className="text-xs text-muted-foreground">Descreva o formulário ou as perguntas que você quer.</p>
            </div>
            <span className="rounded-full bg-info/10 px-2 py-0.5 text-[10px] font-semibold text-info">Beta</span>
          </div>

          <Textarea
            value={userRequest}
            rows={4}
            readOnly={isPublished}
            className="min-h-24 resize-none rounded-[18px] text-sm"
            placeholder="Ex.: formulário de inscrição para um workshop, com e-mail, WhatsApp e nível de experiência"
            spellCheck="false"
            onChange={(event) => setUserRequest(event.target.value)}
          />

          <div className="flex flex-wrap gap-1.5">
            {PROMPT_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={isPublished}
                onClick={() => setUserRequest(suggestion)}
                className="rounded-full bg-info/10 px-2.5 py-1 text-[11px] font-medium text-info transition-colors hover:bg-info/20 disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>

          {isPublished && (
            <p className="text-xs text-muted-foreground">Formulário publicado: despublique para gerar perguntas com o Astro.</p>
          )}

          <Button
            type="button"
            className="w-full bg-info! text-white hover:bg-info/90!"
            disabled={loading || isPublished || !userRequest.trim()}
            onClick={GenerateFormQuestionsWithAI}
          >
            {loading ? <OrbitaSpinner className="size-4" isOnBrandColor /> : <AstroSymbolIcon className="size-4" />}
            {loading ? "O Astro está montando…" : "Gerar com o Astro"}
          </Button>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Dica: diga o objetivo, o que quer coletar, o tom (formal ou informal) e quantas perguntas.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
