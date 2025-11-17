"use client";

import { useEffect, useState } from "react";
import { ModalSettingTracking } from "../modals/settings-tracking";
import { LeadModal } from "../modals/lead-modal";
import { SearchLeadModal } from "../modals/search-lead-modal";

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
      <ModalSettingTracking />
      <LeadModal />
      <SearchLeadModal />
    </>
  );
}
