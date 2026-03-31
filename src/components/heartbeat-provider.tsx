"use client";

import { useEffect } from "react";
import { orpc } from "@/lib/orpc";

export function HeartbeatProvider() {
  useEffect(() => {
    // Send heartbeat immediately and then every 30 seconds
    const sendHeartbeat = () => {
      orpc.activity.heartbeat.call({}).catch(() => {});
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30_000);
    return () => clearInterval(interval);
  }, []);
  return null;
}
