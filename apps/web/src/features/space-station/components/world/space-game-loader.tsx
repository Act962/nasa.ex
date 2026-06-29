"use client";

import dynamic from "next/dynamic";
import type { AvatarConfig, StationWorldConfig } from "../../types";

const SpaceGame = dynamic(
  () => import("./space-game").then((m) => m.SpaceGame),
  { ssr: false },
);

interface Props {
  worldConfig:  StationWorldConfig;
  avatarConfig?: AvatarConfig;
  stationId:    string;
  nick:         string;
  isOwner?:     boolean;
  userImage?:   string | null;
  userId?:      string;
  userName?:    string;
  userNick?:    string;
}

export function SpaceGameLoader(props: Props) {
  return <SpaceGame {...props} />;
}
