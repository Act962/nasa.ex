"use client";

import type { ComponentType } from "react";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { cn } from "@/lib/utils";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { usePagesBuilderStore } from "../../context/pages-builder-store";
import type { Device } from "../../types";

const DEVICE_OPTIONS: { device: Device; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { device: "desktop", label: "Computador", icon: Monitor },
  { device: "tablet", label: "Tablet", icon: Tablet },
  { device: "mobile", label: "Celular", icon: Smartphone },
];

/** Troca o canvas entre a edição (computador) e a prévia real em tablet/celular. */
export function DeviceSwitcher() {
  const activeDevice = usePagesBuilderStore((state) => state.device);
  const setDevice = usePagesBuilderStore((state) => state.setDevice);
  const setZoomFit = usePagesBuilderStore((state) => state.setZoomFit);

  return (
    <div
      className="hidden shrink-0 items-center rounded-full bg-muted p-0.5 md:flex"
      data-guide={GUIDE_ANCHORS.pagesDeviceSwitcher.id}
    >
      {DEVICE_OPTIONS.map(({ device, label, icon: DeviceIcon }) => (
        <button
          key={device}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={activeDevice === device}
          onClick={() => {
            setDevice(device);
            setZoomFit(true);
          }}
          className={cn(
            "grid h-7 w-9 place-items-center rounded-full transition-colors",
            activeDevice === device
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <DeviceIcon className="size-4" />
        </button>
      ))}
    </div>
  );
}
