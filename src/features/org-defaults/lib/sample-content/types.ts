export type SampleSeedContext = {
  organizationId: string;
  ownerUserId: string;
  organizationSlug: string;
  trackings: { id: string; name: string; statuses: { id: string; name: string }[] }[];
};
