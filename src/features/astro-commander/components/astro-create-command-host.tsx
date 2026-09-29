"use client";

import { useEffect, useState } from "react";
import {
  ASTRO_CREATE_COMMAND_EVENT,
  type AstroCreateCommandDetail,
} from "@/features/astro-commander/lib/open-create-command";
import { CreateCommandDialog } from "@/features/astro-commander/components/create-command-dialog";

/** Dialog global de "Criar comando", aberto por evento (spec 0029, RF-12). */
export function AstroCreateCommandHost() {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<AstroCreateCommandDetail>({});

  useEffect(() => {
    const handleOpen = (event: Event) => {
      setDetail((event as CustomEvent<AstroCreateCommandDetail>).detail ?? {});
      setOpen(true);
    };
    window.addEventListener(ASTRO_CREATE_COMMAND_EVENT, handleOpen);
    return () => window.removeEventListener(ASTRO_CREATE_COMMAND_EVENT, handleOpen);
  }, []);

  return (
    <CreateCommandDialog
      open={open}
      onOpenChange={setOpen}
      examples={detail.examples}
      initialInstruction={detail.instruction}
    />
  );
}
