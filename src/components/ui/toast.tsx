"use client";

import { useEffect, useState } from "react";
import { X, CheckCircle, AlertCircle, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "info" | "warning";

interface ToastProps {
  id: string;
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: (id: string) => void;
}

const ICONS: Record<ToastType, React.ElementType> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

const COLORS: Record<ToastType, string> = {
  success: "bg-emerald-500/10 border-emerald-500/20 text-emerald-100",
  error: "bg-red-500/10 border-red-500/20 text-red-100",
  warning: "bg-yellow-500/10 border-yellow-500/20 text-yellow-100",
  info: "bg-blue-500/10 border-blue-500/20 text-blue-100",
};

const ICON_COLORS: Record<ToastType, string> = {
  success: "text-emerald-400",
  error: "text-red-400",
  warning: "text-yellow-400",
  info: "text-blue-400",
};

export function Toast({
  id,
  message,
  type = "info",
  duration = 4000,
  onClose,
}: ToastProps) {
  const Icon = ICONS[type];
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (duration === 0) return;

    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onClose(id), 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, id, onClose]);

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm transition-all duration-300",
        COLORS[type],
        isExiting && "opacity-0 translate-x-full"
      )}
    >
      <Icon className={cn("w-5 h-5 shrink-0", ICON_COLORS[type])} />
      <span className="flex-1 text-sm font-medium">{message}</span>
      <button
        onClick={() => {
          setIsExiting(true);
          setTimeout(() => onClose(id), 300);
        }}
        className="p-1 hover:bg-white/10 rounded transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Array<Omit<ToastProps, "onClose"> & { onClose?: any }>;
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 max-w-sm pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast {...toast} onClose={onRemove} />
        </div>
      ))}
    </div>
  );
}
