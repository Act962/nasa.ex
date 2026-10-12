"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/spinner";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { useFindChat } from "@/features/tracking-chat/hooks/use-conversation";
import { useDebouncedValue } from "@/hooks/use-debounced";
import {
  DAILY_SUMMARY_VARIABLES,
  DEFAULT_GROUP_MESSAGE_PAYLOAD,
  GROUP_MESSAGE_MAX_CHARS,
  GROUP_MESSAGE_TYPE,
  isGroupJid,
  type GroupMessagePayload,
} from "@/features/workflows/lib/group-message";

// Configuração do passo "Enviar para grupo" (spec 0101): o grupo, entre os do número deste funil, e o texto.

interface GroupChat {
  wa_chatid?: string;
  wa_name?: string;
  name?: string;
}

const SEARCH_DEBOUNCE_MS = 400;

export function GroupMessageDialog({
  open,
  onOpenChange,
  defaultPayload,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPayload?: Partial<GroupMessagePayload>;
  onSubmit: (payload: GroupMessagePayload) => void;
}) {
  const { trackingId: routeTrackingId } = useParams<{ trackingId?: string }>();
  const initialPayload = (): GroupMessagePayload => ({
    ...DEFAULT_GROUP_MESSAGE_PAYLOAD,
    ...defaultPayload,
    trackingId: defaultPayload?.trackingId || routeTrackingId || "",
    type: GROUP_MESSAGE_TYPE,
  });
  const [payload, setPayload] = useState<GroupMessagePayload>(initialPayload);
  const [groupSearch, setGroupSearch] = useState("");
  useEffect(() => {
    if (open) {
      setPayload(initialPayload());
      setGroupSearch("");
    }
    // Só ao abrir: enquanto a pessoa edita, o que vale é o que ela digitou.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const debouncedGroupSearch = useDebouncedValue(groupSearch, SEARCH_DEBOUNCE_MS);
  const groupQuery = useFindChat({
    trackingId: payload.trackingId,
    phone: "",
    name: debouncedGroupSearch,
    isGroup: true,
    enabled: open,
  });
  const foundGroups = ((groupQuery.data?.response as { chats?: GroupChat[] } | undefined)?.chats ?? []).filter((chat) => isGroupJid(chat.wa_chatid));
  const hasSearch = debouncedGroupSearch.trim().length > 0;

  const insertVariable = (variableKey: string) =>
    setPayload((current) => ({ ...current, message: `${current.message}{{${variableKey}}}`.slice(0, GROUP_MESSAGE_MAX_CHARS) }));
  const canSave = isGroupJid(payload.groupJid) && payload.trackingId.length > 0 && payload.message.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-node-config className="max-w-lg" data-guide={GUIDE_ANCHORS.workflowGroupMessageStep.id}>
        <DialogHeader>
          <DialogTitle>Enviar para grupo</DialogTitle>
          <DialogDescription>
            O texto sai pelo número deste funil para um grupo em que ele participa. Só funciona em número conectado por QR code: a API oficial do WhatsApp não envia para grupos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="group-message-search">Grupo</Label>
            {payload.groupJid ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
                <span className="truncate">{payload.groupName || payload.groupJid}</span>
                <Button type="button" size="sm" variant="ghost" onClick={() => setPayload((current) => ({ ...current, groupJid: "", groupName: "" }))}>
                  Trocar
                </Button>
              </div>
            ) : (
              <>
                <Input id="group-message-search" placeholder="Digite parte do nome do grupo" value={groupSearch} onChange={(event) => setGroupSearch(event.target.value)} />
                {groupQuery.isLoading && hasSearch && <Spinner />}
                {groupQuery.isError && hasSearch && (
                  <p className="text-xs text-destructive">Não consegui listar os grupos. Confira se o número deste funil está conectado por QR code.</p>
                )}
                {!groupQuery.isLoading && !groupQuery.isError && hasSearch && foundGroups.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum grupo com esse nome no número deste funil.</p>
                )}
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {foundGroups.map((chat) => (
                    <Button
                      key={chat.wa_chatid}
                      type="button"
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => setPayload((current) => ({ ...current, groupJid: chat.wa_chatid ?? "", groupName: chat.wa_name ?? chat.name ?? "" }))}
                    >
                      {chat.wa_name ?? chat.name ?? chat.wa_chatid}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="group-message-text">Mensagem</Label>
            <Textarea
              id="group-message-text"
              rows={8}
              maxLength={GROUP_MESSAGE_MAX_CHARS}
              value={payload.message}
              onChange={(event) => setPayload((current) => ({ ...current, message: event.target.value }))}
            />
            <p className="text-xs text-muted-foreground">Números do dia da empresa, calculados na hora do envio. Toque para inserir:</p>
            <div className="flex flex-wrap gap-1.5">
              {DAILY_SUMMARY_VARIABLES.map((variable) => (
                <Button key={variable.key} type="button" size="sm" variant="outline" className="rounded-full" onClick={() => insertVariable(variable.key)}>
                  {variable.label}
                </Button>
              ))}
            </div>
          </div>
          <p className="rounded-md border border-warning/30 bg-warning/15 px-3 py-2 text-xs text-warning">
            Todos os participantes do grupo veem a mensagem. Não envie dado que nem todos ali podem ver.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!canSave}
            onClick={() => {
              onSubmit({ ...payload, message: payload.message.trim() });
              onOpenChange(false);
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
