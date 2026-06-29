"use client";

import { useMemo, useState } from "react";

export function useAddLead() {
  const [isOpen, setIsOpen] = useState(false);

  return useMemo(
    () => ({
      isOpen,
      setIsOpen,
    }),
    [isOpen, setIsOpen]
  );
}

export type AddLeadType = ReturnType<typeof useAddLead>;
