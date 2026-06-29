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
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className={`flex-shrink-0 p-2 rounded-lg ${isDangerous ? "bg-red-500/10" : "bg-yellow-500/10"}`}>
            <AlertCircle
              className={`w-6 h-6 ${isDangerous ? "text-red-400" : "text-yellow-400"}`}
            />
          </div>
          <div>
            <h3 className="font-bold text-white">{title}</h3>
            <p className="text-sm text-zinc-400 mt-1">{description}</p>
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-4">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50 ${
              isDangerous
                ? "bg-red-600 hover:bg-red-700"
                : "bg-violet-600 hover:bg-violet-700"
            }`}
          >
            {isLoading ? "Processando..." : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
