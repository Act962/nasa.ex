import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { CoursePublicPage } from "@/features/nasa-route/components/public/course-public-page";
import { getStarPriceBrl } from "@/features/nasa-route/lib/pricing";

interface Params {
  companySlug: string;
  courseSlug: string;
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { companySlug, courseSlug } = await params;
  const [session, starPriceBrl] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    getStarPriceBrl(),
  ]);
  const isAuthenticated = !!session?.user;

  return (
    <CoursePublicPage
      companySlug={companySlug}
      courseSlug={courseSlug}
      isAuthenticated={isAuthenticated}
      starPriceBrl={starPriceBrl}
    />
  );
}
