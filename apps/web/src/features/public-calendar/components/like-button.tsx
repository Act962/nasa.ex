"use client";

import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToggleLike } from "../hooks/use-toggle-like";
import { useFingerprint } from "../hooks/use-fingerprint";

interface LikeButtonProps {
  slug: string;
  likesCount: number;
  isLiked: boolean;
  variant?: "default" | "compact";
}

export function LikeButton({
  slug,
  likesCount,
  isLiked,
  variant = "default",
}: LikeButtonProps) {
  const { fingerprint } = useFingerprint();
  const mutation = useToggleLike(slug);

  const handleClick = () => {
    if (!fingerprint) return;
    mutation.mutate({ slug, fingerprint });
  };

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={mutation.isPending || !fingerprint}
        className={cn(
          "inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-pink-500",
          isLiked && "text-pink-500",
        )}
      >
        <Heart className={cn("h-3.5 w-3.5", isLiked && "fill-current")} />
        {likesCount}
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant={isLiked ? "default" : "outline"}
      size="sm"
      onClick={handleClick}
      disabled={mutation.isPending || !fingerprint}
      className={cn(
        "gap-1.5",
        isLiked && "bg-pink-500 text-white hover:bg-pink-600",
      )}
    >
      <Heart className={cn("h-4 w-4", isLiked && "fill-current")} />
      {likesCount}
    </Button>
  );
}
