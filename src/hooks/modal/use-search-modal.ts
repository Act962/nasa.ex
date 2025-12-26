"use client";

import { useMemo, useState } from "react";

export function useSearchModal() {
  const [isOpen, setIsOpen] = useState(false);

  return useMemo(
    () => ({
      isOpen,
      setIsOpen,
    }),
    [isOpen, setIsOpen]
  );
}

export type SearchModalStore = ReturnType<typeof useSearchModal>;
