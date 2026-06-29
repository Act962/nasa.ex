"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({ queryKey: ["commentsApp", "subscription"] });
}

export function useCommentsCurrentSubscription() {
  return useQuery(
    orpc.commentsApp.subscription.currentSubscription.queryOptions({
      input: {},
    }),
  );
}

export function useUpgradeCommentsSubscription() {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.commentsApp.subscription.upgrade.mutationOptions({
      onSuccess: invalidate,
    }),
  );
}

export function useCommentsBillingPortal() {
  return useMutation(
    orpc.commentsApp.subscription.billingPortal.mutationOptions(),
  );
}
