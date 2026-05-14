import { OrgPublicCalendarView } from "@/features/public-calendar/components/org-public-calendar-view";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  return <OrgPublicCalendarView slug={slug} token={token} />;
}
