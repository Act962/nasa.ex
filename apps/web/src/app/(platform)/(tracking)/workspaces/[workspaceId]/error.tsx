"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WorkspaceError() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/workspaces");
  }, [router]);

  return null;
}
