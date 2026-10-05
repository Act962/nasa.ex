"use client";

import { Modal } from "./modal";
import { AlertCircle } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  isDangerous?: boolean;
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  onConfirm,
  onCancel,
  isDangerous = false,
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      size="sm"
      closeOnBackdropClick={!isLoading}
      hideCloseButton={isLoading}
    >
      <div className="space-y-5">
        <div className="space-y-3">
          <div
            className={`grid size-10 flex-none place-items-center rounded-full ${isDangerous ? "bg-red-500/10" : "bg-yellow-500/10"}`}
          >
            <AlertCircle className={`size-5 ${isDangerous ? "text-red-400" : "text-yellow-400"}`} />
          </div>
          <div className="min-w-0">
            <h3 className="text-base leading-snug font-bold break-words text-white">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{description}</p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-full bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`rounded-full px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
              isDangerous ? "bg-red-600 hover:bg-red-700" : "bg-violet-600 hover:bg-violet-700"
            }`}
          >
            {isLoading ? "Processando..." : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
