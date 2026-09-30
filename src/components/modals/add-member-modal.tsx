"use client";

import { useMemberModal } from "@/hooks/use-member";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../ui/input-group";
import { UserIcon } from "lucide-react";
import { Button } from "../ui/button";
import { useState, useTransition } from "react";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { Spinner } from "../ui/spinner";
import { useRouter } from "next/navigation";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { emitTourResult } from "@/features/tour/store";
import { GUIDE_RESULT_KINDS } from "@/features/astro-guides/lib/result-kinds";

export function AddMemberModal() {
  const router = useRouter();
  const { isOpen, onClose } = useMemberModal();
  const [email, setEmail] = useState("");
  const [isSendInvitation, setIsSendInvitation] = useTransition();

  const sendInvite = async () => {
    await authClient.organization.inviteMember(
      {
        email,
        role: "member",
        resend: true,
      },
      {
        onSuccess: () => {
          setEmail("");
          onClose();
          toast.success("Membro convidado com sucesso!");
          emitTourResult({ kind: GUIDE_RESULT_KINDS.memberInvited });
          router.refresh();
        },
        onError: ({ error }) => {
          console.log("Invite:", error);
          toast.error("Erro ao convidar membro.");
        },
      },
    );
  };

  const onInvite = async () => {
    if (!email) {
      return;
    }

    setIsSendInvitation(async () => await sendInvite());
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Membro</DialogTitle>
          <DialogDescription>
            Adicione um novo membro na equipe.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <InputGroup>
            <InputGroupInput
              type="email"
              placeholder="Digite o e-mail do membro"
              data-guide={GUIDE_ANCHORS.memberInviteEmail.id}
              value={email}
              disabled={isSendInvitation}
              onChange={(e) => setEmail(e.target.value)}
            />
            <InputGroupAddon>
              <UserIcon className="size-4" />
            </InputGroupAddon>
          </InputGroup>

          <Button
            disabled={isSendInvitation}
            className="w-full"
            onClick={onInvite}
            data-guide={GUIDE_ANCHORS.memberInviteSubmit.id}
          >
            {isSendInvitation && <Spinner />}
            Adicionar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
