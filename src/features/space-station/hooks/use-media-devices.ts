"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface EnumeratedDevices {
  audio: MediaDeviceInfo[];
  video: MediaDeviceInfo[];
  output: MediaDeviceInfo[];
}

const EMPTY_DEVICES: EnumeratedDevices = { audio: [], video: [], output: [] };

export interface UseMediaDevicesReturn {
  devices: EnumeratedDevices;
  refreshDevices: () => Promise<void>;
  /** Última enumeração, leitura não-reativa — pra callbacks sem stale closure. */
  getCurrentDevices: () => EnumeratedDevices;
  /**
   * gUM de prime: pede permissão de mic só pra liberar labels e a lista de
   * saídas (pré-permissão o browser esconde tudo), parando as tracks na hora.
   * Dispara o prompt nativo — chamar APENAS atrás de clique explícito.
   */
  requestDevicePermissions: () => Promise<void>;
}

/**
 * Enumeração de dispositivos de mídia compartilhada pelos dois transportes
 * do World (SFU e mesh). Centraliza o que antes era duplicado em cada hook:
 *
 * - filtra entradas placeholder pré-permissão (`deviceId === ""`) que
 *   renderizavam opções quebradas no painel;
 * - escuta `devicechange` nativo — plugou/desplugou headset, a lista
 *   atualiza nos DOIS transportes (o mesh não tinha listener nenhum; o SFU
 *   dependia do evento da LiveKit, que só existe com a room conectada).
 */
export function useMediaDevices(): UseMediaDevicesReturn {
  const [devices, setDevices] = useState<EnumeratedDevices>(EMPTY_DEVICES);
  const devicesRef = useRef<EnumeratedDevices>(EMPTY_DEVICES);

  const refreshDevices = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      return;
    }
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const usableDevices = allDevices.filter(
        (deviceInfo) => deviceInfo.deviceId !== "",
      );
      const nextDevices: EnumeratedDevices = {
        audio: usableDevices.filter((deviceInfo) => deviceInfo.kind === "audioinput"),
        video: usableDevices.filter((deviceInfo) => deviceInfo.kind === "videoinput"),
        output: usableDevices.filter((deviceInfo) => deviceInfo.kind === "audiooutput"),
      };
      devicesRef.current = nextDevices;
      setDevices(nextDevices);
    } catch {
      /* permissão ainda não concedida */
    }
  }, []);

  const getCurrentDevices = useCallback(() => devicesRef.current, []);

  const requestDevicePermissions = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return;
    }
    try {
      const primeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      primeStream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      console.warn("[useMediaDevices] permissão de prime negada:", err);
    }
    await refreshDevices();
  }, [refreshDevices]);

  useEffect(() => {
    void refreshDevices();
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.addEventListener) {
      return;
    }
    const handleDeviceChange = () => {
      void refreshDevices();
    };
    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [refreshDevices]);

  return { devices, refreshDevices, getCurrentDevices, requestDevicePermissions };
}
