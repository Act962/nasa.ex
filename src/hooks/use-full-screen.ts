"use client";

import { useCallback, useEffect, useState } from "react";

export function useFullscreen(target?: HTMLElement | null) {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const element = target ?? document.documentElement;

  const enterFullscreen = useCallback(async () => {
    if (!element) return;

    if (element.requestFullscreen) {
      await element.requestFullscreen();
    } else if ((element as any).webkitRequestFullscreen) {
      (element as any).webkitRequestFullscreen(); // Safari
    } else if ((element as any).msRequestFullscreen) {
      (element as any).msRequestFullscreen(); // Edge antigo
    }
  }, [element]);

  const exitFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) return;

    if (document.exitFullscreen) {
      await document.exitFullscreen();
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen();
    } else if ((document as any).msExitFullscreen) {
      (document as any).msExitFullscreen();
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  }, [enterFullscreen, exitFullscreen]);

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleChange);
    document.addEventListener(
      "webkitfullscreenchange",
      handleChange as EventListener,
    );
    document.addEventListener(
      "msfullscreenchange",
      handleChange as EventListener,
    );

    return () => {
      document.removeEventListener("fullscreenchange", handleChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleChange as EventListener,
      );
      document.removeEventListener(
        "msfullscreenchange",
        handleChange as EventListener,
      );
    };
  }, []);

  return {
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
  };
}
