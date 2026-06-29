"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useRouter } from "next/navigation";

export function useNotifications() {
  const qc = useQueryClient();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["user-notifications"],
    queryFn: () => orpc.userNotifications.list.call({ limit: 20 }),
    refetchInterval: 30_000,
  });

  const markReadMut = useMutation({
    mutationFn: (id: string) => orpc.userNotifications.markRead.call({ notificationId: id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-notifications"] }),
  });

  const markAllMut = useMutation({
    mutationFn: () => orpc.userNotifications.markAllRead.call({}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-notifications"] }),
  });

  const unread = data?.unreadCount ?? 0;
  const notifications = data?.notifications ?? [];

  const handleNotifClick = useCallback((n: typeof notifications[0], onAction?: () => void) => {
    if (!n.isRead) markReadMut.mutate(n.id);
    if (n.actionUrl) {
      onAction?.();
      router.push(n.actionUrl);
    }
  }, [markReadMut, router]);

  return {
    notifications,
    unread,
    isLoading,
    markRead: markReadMut.mutate,
    markAllRead: markAllMut.mutate,
    isMarkingRead: markReadMut.isPending,
    isMarkingAllRead: markAllMut.isPending,
    handleNotifClick,
  };
}
