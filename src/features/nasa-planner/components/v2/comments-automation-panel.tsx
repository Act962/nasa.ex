"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { emitTourResult } from "@/features/tour/store";
import { GUIDE_RESULT_KINDS } from "@/features/astro-guides/lib/result-kinds";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { MetaConnectOption } from "@/features/social-accounts/components/meta-connect-option";
import { usePlannerPostComments, useSavePlannerPostComments } from "../../hooks/use-planner-integrations";

/** Comments nativo no post (spec 0059): responder comentários com DM e resposta pública, editado aqui mesmo. */

type CommentsStatus = NonNullable<ReturnType<typeof usePlannerPostComments>["commentsStatus"]>;

const splitList = (text: string) => text.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);

function CommentsForm({ postId, status }: { postId: string; status: CommentsStatus }) {
  const automation = status.automation;
  const [respondToAnyComment, setRespondToAnyComment] = useState(automation?.respondToAnyComment ?? false);
  const [keywordsText, setKeywordsText] = useState(automation?.keywords.join(", ") ?? "");
  const [excludedText, setExcludedText] = useState(automation?.excludedKeywords.join(", ") ?? "");
  const [directMessageText, setDirectMessageText] = useState(automation?.directMessageText ?? "");
  const [buttonTitle, setButtonTitle] = useState(automation?.buttonTitle ?? "");
  const [buttonUrl, setButtonUrl] = useState(automation?.buttonUrl ?? "");
  const [publicRepliesText, setPublicRepliesText] = useState(automation?.publicReplies.join("\n") ?? "");
  const [isActive, setIsActive] = useState(automation ? (status.isPublished ? automation.isActive : status.autoActivateOnPublish) : true);
  const saveComments = useSavePlannerPostComments();
  const isReadOnly = !status.canEditComments;

  const save = () =>
    saveComments.mutate(
      {
        postId,
        respondToAnyComment,
        keywords: splitList(keywordsText),
        excludedKeywords: splitList(excludedText),
        directMessageText,
        buttonTitle: buttonTitle || undefined,
        buttonUrl: buttonUrl || undefined,
        publicReplies: publicRepliesText.split("\n").map((reply) => reply.trim()).filter(Boolean),
        isActive,
      },
      {
        onSuccess: () => {
          toast.success(status.isPublished ? "Automação salva." : "Automação salva. Ela liga sozinha quando o post sair.");
          emitTourResult({ kind: GUIDE_RESULT_KINDS.plannerCommentsSaved });
        },
        onError: (error) => toast.error(error.message || "Não deu para salvar a automação."),
      },
    );

  return (
    <div className="space-y-3">
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>Responder a qualquer comentário</span>
        <Switch checked={respondToAnyComment} disabled={isReadOnly} onCheckedChange={setRespondToAnyComment} />
      </label>
      {!respondToAnyComment && (
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Palavras que disparam (separe por vírgula)</p>
          <Input value={keywordsText} disabled={isReadOnly} onChange={(event) => setKeywordsText(event.target.value)} placeholder="quero, preço, link" className="rounded-2xl" />
        </div>
      )}
      <div>
        <p className="mb-1 text-xs text-muted-foreground">Ignorar comentários com</p>
        <Input value={excludedText} disabled={isReadOnly} onChange={(event) => setExcludedText(event.target.value)} placeholder="spam, sorteio" className="rounded-2xl" />
      </div>
      <div>
        <p className="mb-1 text-xs text-muted-foreground">Mensagem enviada por DM</p>
        <Textarea value={directMessageText} disabled={isReadOnly} onChange={(event) => setDirectMessageText(event.target.value)} placeholder="Oi! Aqui está o link que você pediu 👇" className="min-h-20 rounded-2xl" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input value={buttonTitle} disabled={isReadOnly} onChange={(event) => setButtonTitle(event.target.value)} placeholder="Texto do botão (opcional)" maxLength={20} className="rounded-2xl" />
        <Input value={buttonUrl} disabled={isReadOnly} onChange={(event) => setButtonUrl(event.target.value)} placeholder="https://link-do-botao" className="rounded-2xl" />
      </div>
      <div>
        <p className="mb-1 text-xs text-muted-foreground">Respostas públicas no comentário (uma por linha, até 5 — sorteadas)</p>
        <Textarea value={publicRepliesText} disabled={isReadOnly} onChange={(event) => setPublicRepliesText(event.target.value)} placeholder={"Te mandei no direct! 📩\nOlha a DM 😉"} className="min-h-16 rounded-2xl" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={isActive} disabled={isReadOnly} onCheckedChange={setIsActive} />
          {status.isPublished ? "Automação ligada" : "Ligar quando o post sair"}
        </label>
        <div className="flex items-center gap-2">
          {automation && (
            <Link href={`/comments/automations/${automation.id}`} className="inline-flex items-center gap-1 rounded-full bg-panel px-3 py-1.5 text-xs">
              Abrir no Comments <ExternalLink className="size-3" />
            </Link>
          )}
          {!isReadOnly && (
            <button
              type="button"
              data-guide={GUIDE_ANCHORS.plannerCommentsSave.id}
              disabled={saveComments.isPending || !directMessageText.trim()}
              onClick={save}
              className="rounded-full bg-foreground px-4 py-1.5 text-sm font-semibold text-background disabled:opacity-40"
            >
              {saveComments.isPending ? "Salvando…" : "Salvar automação"}
            </button>
          )}
        </div>
      </div>
      {automation?.usesAiMessage && <p className="text-xs text-warning">Esta automação usa mensagem por IA; edite a DM no Comments para não perder a configuração.</p>}
    </div>
  );
}

export function CommentsAutomationPanel({ postId }: { postId: string }) {
  const { commentsStatus, isLoading } = usePlannerPostComments(postId);
  const [isOpen, setIsOpen] = useState(false);
  const automation = commentsStatus?.automation;
  const isOn = automation ? (commentsStatus?.isPublished ? automation.isActive : commentsStatus?.autoActivateOnPublish) : false;

  return (
    <section data-guide={GUIDE_ANCHORS.plannerCommentsPanel.id} className="rounded-2xl bg-panel p-3">
      <button type="button" onClick={() => setIsOpen((current) => !current)} className="flex w-full items-center gap-2 text-left">
        <MessageCircle className="size-4" />
        <span className="flex-1 text-sm font-semibold">Comentários automáticos</span>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", isOn ? "bg-success/15 text-success" : "bg-knob/60 text-muted-foreground")}>
          {isLoading ? "…" : automation ? (isOn ? (commentsStatus?.isPublished ? "Ligada" : "Liga ao publicar") : "Desligada") : "Sem automação"}
        </span>
      </button>
      {isOpen && (
        <div className="mt-3">
          {isLoading || !commentsStatus ? (
            <OrbitaSpinner className="size-4" />
          ) : commentsStatus.channel.needsAccountChoice ? (
            <p className="text-sm text-warning">Escolha em qual conta do Instagram este post vai sair para configurar os comentários automáticos.</p>
          ) : !commentsStatus.channel.isConnected ? (
            <div className="space-y-3">
              <MetaConnectOption organizationId={commentsStatus.organizationId} />
              <p className="text-xs text-muted-foreground">
                Ou conecte a conta deste post pelo passo a passo nos <Link href="/integrations/instagram" className="underline">Satélites</Link>.
              </p>
            </div>
          ) : (
            <>
              {commentsStatus.channel.accountMismatch && (
                <p className="mb-3 text-xs text-warning">
                  Esta automação foi criada em outra conta do Instagram. Ao salvar, ela é recriada em @{commentsStatus.channel.handle ?? "conta do post"}.
                </p>
              )}
              {commentsStatus.allPostsAutomations.length > 0 && (
                <p className="mb-3 text-xs text-muted-foreground">
                  Também vale para este post: {commentsStatus.allPostsAutomations.map((allPostsAutomation) => allPostsAutomation.name).join(", ")} (automação em todos os posts).
                </p>
              )}
              <CommentsForm key={automation?.id ?? "new"} postId={postId} status={commentsStatus} />
            </>
          )}
        </div>
      )}
    </section>
  );
}
