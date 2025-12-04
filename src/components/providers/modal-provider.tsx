"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// Lazy load dos modais
const ModalSettingTracking = dynamic(
  () =>
    import("../modals/settings-tracking").then((mod) => ({
      default: mod.ModalSettingTracking,
    })),
  { ssr: false }
);

const SearchLeadModal = dynamic(
  () =>
    import("../modals/search-lead-modal").then((mod) => ({
      default: mod.SearchLeadModal,
    })),
  { ssr: false }
);

const AddLeadSheet = dynamic(() => import("../modals/add-lead-sheet"), {
  ssr: false,
});

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
      <SearchLeadModal />
      {/* <AddLeadSheet /> */}
    </>
  );
}
