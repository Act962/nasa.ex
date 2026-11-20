import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { OrbitaAuthScene } from "@/features/auth/components/orbita-auth-scene";
import { ConnectAiScreen } from "@/features/external-ai/components/connect-ai-screen";
import { resumeAuthorizationHref } from "@/features/external-ai/lib/oauth-request";
import { createMcpAccessContext, resolveAvailableApps } from "@/features/external-ai/server/mcp/apps";
import { readOAuthConnectRequest } from "@/features/external-ai/server/oauth-connect-request";

export const dynamic = "force-dynamic";

/** "Conectar ao ÓRBITA" (spec 0135, RF-6): a pessoa vê qual IA pede, para qual conta e o que ela alcança. */
export default async function ConnectAiPage({ searchParams }: { searchParams: Promise<{ request?: string }> }) {
  const { request } = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect(`/sign-in?${new URLSearchParams({ callbackUrl: resumeAuthorizationHref(request ?? "") })}`);
  }

  const connectRequest = await readOAuthConnectRequest(request);
  const apps = connectRequest ? await resolveAvailableApps(createMcpAccessContext(session.user.id)) : [];

  return (
    <OrbitaAuthScene isCompact>
      <ConnectAiScreen
        connectRequest={connectRequest}
        account={{ name: session.user.name, email: session.user.email }}
        appLabels={apps.map((app) => app.label)}
        switchAccountHref={`/sign-in?${new URLSearchParams({ callbackUrl: resumeAuthorizationHref(request ?? "") })}`}
      />
    </OrbitaAuthScene>
  );
}
