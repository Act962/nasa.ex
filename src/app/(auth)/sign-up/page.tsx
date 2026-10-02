export const dynamic = "force-dynamic";
import { Suspense } from "react";
import { OrbitaAuthScene } from "@/features/auth/components/orbita-auth-scene";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <OrbitaAuthScene isCompact>
      <div className="dark w-full rounded-3xl border border-line bg-background/55 px-[22px] py-7 text-foreground shadow-2xl backdrop-blur-xl">
        <Suspense fallback={null}>
          <SignupForm />
        </Suspense>
      </div>
      <p className="dark mt-4 text-center text-[11px] text-muted-foreground/70">
        Ao criar sua conta você concorda com nossos{" "}
        <a href="#" className="text-info">
          Termos de uso
        </a>
      </p>
    </OrbitaAuthScene>
  );
}
