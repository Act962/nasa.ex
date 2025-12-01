"use client";

import { useEffect, useState } from "react";
import { ModalSettingTracking } from "../modals/settings-tracking";
import { SearchLeadModal } from "../modals/search-lead-modal";
import AddLeadSheet from "../modals/add-lead-sheet";
import { ModalCreateTracking } from "../modals/create-tracking-modal";
import { LostOrWinModal } from "../modals/lost-or-win-modal";

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
      <ModalSettingTracking />
      <ModalCreateTracking />
      <LeadModal />
      <SearchLeadModal />
      <AddLeadSheet />
    </>
  );
}
