"use client";

import { EntityLoading } from "@/components/entity-components";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { useEffect, Suspense } from "react";

function AcceptInvitationContent() {
  const [inviteId] = useQueryState("inviteId");
  const router = useRouter();

  useEffect(() => {
    if (inviteId) {
      router.replace(`/accept-invitation/${inviteId}`);
    }
  }, [inviteId, router]);

  return <EntityLoading />;
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<EntityLoading />}>
      <AcceptInvitationContent />
    </Suspense>
  );
}
