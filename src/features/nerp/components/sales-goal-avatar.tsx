"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { avatarColorFor, initialsFor } from "../lib/avatar-color";

export function SalesGoalAvatar({
  name,
  seed,
  photoUrl,
  size = 32,
}: {
  name: string;
  seed: string;
  photoUrl?: string | null;
  size?: number;
}) {
  const color = avatarColorFor(seed);

  return (
    <Avatar style={{ width: size, height: size }}>
      {photoUrl && <AvatarImage src={photoUrl} alt={name} />}
      <AvatarFallback
        style={{
          background: `radial-gradient(circle at 35% 35%, ${color}, ${color}55)`,
          color: "#fff",
          fontSize: size * 0.36,
        }}
        className="font-bold"
      >
        {initialsFor(name)}
      </AvatarFallback>
    </Avatar>
  );
}
