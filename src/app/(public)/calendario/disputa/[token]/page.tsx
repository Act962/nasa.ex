import { Metadata } from "next";
import { ClaimResponseClient } from "./client";

export const metadata: Metadata = {
  title: "Responder reivindicação · NASA",
  robots: { index: false, follow: false },
};

export default async function ClaimResponsePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-2xl p-4 lg:p-8">
        <ClaimResponseClient token={token} />
      </div>
    </div>
  );
}
