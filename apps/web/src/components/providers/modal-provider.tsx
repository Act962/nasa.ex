"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useQueryState } from "nuqs";
import { ViewActionModal } from "@/features/actions/components/view-action-modal";

const ModalCreateTracking = dynamic(
  () =>
    import("../modals/create-tracking-modal").then((mod) => ({
      default: mod.ModalCreateTracking,
    })),
  { ssr: false },
);

const LostOrWinModal = dynamic(
  () =>
    import("../modals/lost-or-win-modal").then((mod) => ({
      default: mod.LostOrWinModal,
    })),
  { ssr: false },
);

const DeletarLeadModal = dynamic(
  () =>
    import("../modals/delete-lead-modal").then((mod) => ({
      default: mod.DeletarLeadModal,
    })),
  { ssr: false },
);

const AddMemberModal = dynamic(
  () =>
    import("../modals/add-member-modal").then((mod) => ({
      default: mod.AddMemberModal,
    })),
  { ssr: false },
);

export function ModalProvider() {
  const [isMounted, setIsMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [actionId] = useQueryState("actionId", { shallow: true });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (actionId) {
      setOpen(true);
    }
  }, [actionId]);

  if (!isMounted) {
    return null;
  }

  return (
    <>
      <LostOrWinModal />
      <ModalCreateTracking />
      <DeletarLeadModal />
      <AddMemberModal />
      {actionId && (
        <ViewActionModal
          actionId={actionId}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}
