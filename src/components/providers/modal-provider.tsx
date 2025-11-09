"use client";

import { useEffect, useState } from "react";
import { ModalSettingTracking } from "../modals/settings-tracking";

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
    </>
  );
}
