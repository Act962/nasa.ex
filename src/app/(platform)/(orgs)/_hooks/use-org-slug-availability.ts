import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/use-debounced";
import { checkOrgSlug } from "../_actions/check-org-slug";
import { ORG_SLUG_MAX_LENGTH, ORG_SLUG_PATTERN } from "../_lib/org-slug";

const SLUG_CHECK_DEBOUNCE_MS = 400;

export type OrgSlugStatus = "idle" | "checking" | "available" | "taken";

const isCheckableSlug = (slug: string) =>
  slug.length <= ORG_SLUG_MAX_LENGTH && ORG_SLUG_PATTERN.test(slug);

export function useOrgSlugAvailability(slug: string) {
  const debouncedSlug = useDebouncedValue(slug, SLUG_CHECK_DEBOUNCE_MS);
  const isSlugValid = isCheckableSlug(slug);

  const slugCheckQuery = useQuery({
    queryKey: ["org-slug-check", debouncedSlug],
    queryFn: () => checkOrgSlug(debouncedSlug),
    enabled: isCheckableSlug(debouncedSlug),
    staleTime: 30_000,
    retry: false,
  });

  const isCheckCurrent = debouncedSlug === slug && slugCheckQuery.isSuccess;

  let status: OrgSlugStatus = "idle";
  if (isSlugValid && !slugCheckQuery.isError) {
    if (!isCheckCurrent) status = "checking";
    else status = slugCheckQuery.data.isAvailable ? "available" : "taken";
  }

  return {
    status,
    suggestions: isCheckCurrent ? slugCheckQuery.data.suggestions : [],
  };
}
