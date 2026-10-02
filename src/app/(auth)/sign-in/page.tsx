export const dynamic = "force-dynamic";
import { Suspense } from "react";
import { OrbitaAuthHeadline, OrbitaAuthScene } from "@/features/auth/components/orbita-auth-scene";
import { AuthEntryActions } from "@/features/auth/components/auth-entry-actions";

export default function LoginPage() {
  return (
    <OrbitaAuthScene>
      <OrbitaAuthHeadline />
      <Suspense fallback={null}>
        <AuthEntryActions />
      </Suspense>
    </OrbitaAuthScene>
  );
}
