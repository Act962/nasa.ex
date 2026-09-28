"use client";

import type { ClipboardEvent, DragEvent } from "react";

// Colar ou arrastar arquivos no input vira anexo. Sem `onAddFiles`, os
// eventos seguem o comportamento normal do navegador.

export function useFileDrop(onAddFiles?: (files: File[]) => void) {
  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (!onAddFiles) return;
    const files = Array.from(event.clipboardData?.files ?? []);
    if (files.length === 0) return;
    event.preventDefault();
    onAddFiles(files);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!onAddFiles) return;
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length === 0) return;
    event.preventDefault();
    onAddFiles(files);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (onAddFiles) event.preventDefault();
  };

  return { handlePaste, handleDrop, handleDragOver };
}
