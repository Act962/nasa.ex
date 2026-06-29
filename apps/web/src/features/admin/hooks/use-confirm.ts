"use client";

import { useState } from "react";

interface ConfirmOptions {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
}

export function useConfirm() {
  const [state, setState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions | null;
    promise: {
      resolve: (value: boolean) => void;
      reject: (reason?: any) => void;
    } | null;
  }>({
    isOpen: false,
    options: null,
    promise: null,
  });

  const confirm = (options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      setState({
        isOpen: true,
        options,
        promise: { resolve, reject },
      });
    });
  };

  const handleConfirm = () => {
    state.promise?.resolve(true);
    setState({ isOpen: false, options: null, promise: null });
  };

  const handleCancel = () => {
    state.promise?.resolve(false);
    setState({ isOpen: false, options: null, promise: null });
  };

  return {
    confirm,
    isOpen: state.isOpen,
    options: state.options,
    onConfirm: handleConfirm,
    onCancel: handleCancel,
  };
}
