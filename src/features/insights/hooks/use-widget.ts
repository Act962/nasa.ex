"use client";
import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface UseListWidgetsOptions {
  organizationIds: string[];
}

export const useQueryListWidgets = ({
  organizationIds,
}: UseListWidgetsOptions) => {
  const { data, isLoading } = useQuery(
    orpc.widgets.list.queryOptions({
      input: {
        organizationIds,
      },
    }),
  );

  return {
    widgets: data ?? [],
    isLoading,
  };
};

interface UseWidgetByTagOptions {
  tagId: string;
  organizationId: string;
}

export const useQueryWidgetByTag = ({
  tagId,
  organizationId,
}: UseWidgetByTagOptions) => {
  const { data, ...query } = useQuery(
    orpc.widgets.byTag.queryOptions({
      input: {
        tagId,
        organizationId,
      },
      enabled: !!tagId && !!organizationId,
    }),
  );

  return {
    data,
    ...query,
  };
};

export const useMutationCreateWidget = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.widgets.create.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: orpc.widgets.list.queryKey({
            input: { organizationIds: [data.organizationId] },
          }),
        });
      },
    }),
  );
};

export const useMutationUpdateWidget = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.widgets.update.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: orpc.widgets.list.queryKey({
            input: { organizationIds: [data.organizationId] },
          }),
        });
      },
    }),
  );
};

export const useMutationDeleteWidget = (organizationIds: string[]) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.widgets.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.widgets.list.queryKey({
            input: {
              organizationIds,
            },
          }),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.tags.listTagsWithoutWidget.queryKey({
            input: {
              organizationIds,
            },
          }),
        });
      },
    }),
  );
};
