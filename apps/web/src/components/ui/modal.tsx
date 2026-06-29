"use client";

import { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  hideCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
}

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
  className,
  hideCloseButton = false,
  closeOnBackdropClick = true,
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={() => closeOnBackdropClick && onClose()}
      />

      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={cn(
            "relative w-full rounded-xl bg-zinc-900 shadow-xl border border-zinc-800 overflow-hidden",
            SIZES[size],
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          {title && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <div>
                {typeof title === "string" ? (
                  <h2 className="text-lg font-bold text-white">{title}</h2>
                ) : (
                  title
                )}
              </div>
              {!hideCloseButton && (
                <button
                  onClick={onClose}
                  className="rounded-lg p-1 hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-400 hover:text-white" />
                </button>
              )}
            </div>
          )}

          {/* Body */}
          <div className="px-6 py-4">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
