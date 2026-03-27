"use client";
import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface UseListFormsOptions {
  organizationId?: string;
}

export const useQueryListForms = ({
  organizationId,
}: UseListFormsOptions = {}) => {
  const { data, isLoading, ...query } = useQuery(
    orpc.form.list.queryOptions({
      input: {
        organizationId,
      },
    }),
  );

  return {
    forms: data?.forms ?? [],
    message: data?.message,
    isLoading,
    ...query,
  };
};

interface UseFormByIdOptions {
  formId: string;
}

export const useQueryFormById = ({ formId }: UseFormByIdOptions) => {
  const { data, isLoading } = useQuery(
    orpc.form.get.queryOptions({
      input: {
        id: formId,
      },
      enabled: !!formId,
    }),
  );

  return {
    form: data?.form,
    message: data?.message,
    isLoading,
  };
};

interface UseFormResponsesOptions {
  id: string;
}

export const useQueryFormResponses = ({ id }: UseFormResponsesOptions) => {
  const { data, isLoading, ...query } = useQuery(
    orpc.form.listResponse.queryOptions({
      input: {
        id,
      },
      enabled: !!id,
    }),
  );

  return {
    form: data?.form,
    message: data?.message,
    isLoading,
    ...query,
  };
};

interface UsePublicFormOptions {
  id: string;
}

export const useQueryPublicForm = ({ id }: UsePublicFormOptions) => {
  const { data, isLoading, ...query } = useQuery(
    orpc.form.getPublic.queryOptions({
      input: {
        id,
      },
      enabled: !!id,
    }),
  );

  return {
    form: data?.form,
    message: data?.message,
    isLoading,
    ...query,
  };
};

export const useQueryFormInsights = () => {
  const { data, isLoading, ...query } = useQuery(
    orpc.form.insightForm.queryOptions(),
  );

  return {
    data,
    isLoading,
    ...query,
  };
};

export const useMutationCreateForm = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.form.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.form.list.queryKey({
            input: {},
          }),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.form.insightForm.queryKey(),
        });
      },
    }),
  );
};

export const useMutationUpdateForm = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.form.update.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: orpc.form.list.queryKey({
            input: {},
          }),
        });
      },
    }),
  );
};

export const useMutationDeleteForm = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.form.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.form.list.queryKey({
            input: {},
          }),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.form.insightForm.queryKey(),
        });
      },
    }),
  );
};

export const useMutationPublishForm = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.form.PublishForm.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.form.list.queryKey({
            input: {},
          }),
        });
      },
    }),
  );
};

export const useMutationSubmitResponse = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.form.submitResponse.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: orpc.form.listResponse.queryKey({
            input: { id: data.id },
          }),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.form.insightForm.queryKey(),
        });
      },
    }),
  );
};
