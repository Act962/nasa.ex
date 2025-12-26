"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const ModalCreateTracking = dynamic(
  () =>
    import("../modals/create-tracking-modal").then((mod) => ({
      default: mod.ModalCreateTracking,
    })),
  { ssr: false }
);

const LostOrWinModal = dynamic(
  () =>
    import("../modals/lost-or-win-modal").then((mod) => ({
      default: mod.LostOrWinModal,
    })),
  { ssr: false }
);

const DeletarLeadModal = dynamic(
  () =>
    import("../modals/delete-lead-modal").then((mod) => ({
      default: mod.DeletarLeadModal,
    })),
  { ssr: false }
);

const AddMemberModal = dynamic(
  () =>
    import("../modals/add-member-modal").then((mod) => ({
      default: mod.AddMemberModal,
    })),
  { ssr: false }
);

export function ModalProvider() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <>
      <LostOrWinModal />
      <ModalCreateTracking />
      <DeletarLeadModal />
      <AddMemberModal />
    </>
  );
}
