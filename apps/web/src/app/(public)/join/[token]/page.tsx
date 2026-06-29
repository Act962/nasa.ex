"use client";
export const dynamic = "force-dynamic";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { authClient } from "@/lib/auth-client";
import { client } from "@/lib/orpc";
import { AlertCircle, CheckIcon } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface InviteLinkData {
  id: string;
  role: string;
  expiresAt: string | Date;
  organization: { id: string; name: string; slug: string; logo: string | null };
  createdBy: { id: string; name: string };
}

export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [data, setData] = useState<InviteLinkData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await client.inviteLinks.getByToken({ token });
        if (!cancelled) {
          setData(res as InviteLinkData);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Link inválido");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleJoin = async () => {
    setJoining(true);
    try {
      const res = await client.inviteLinks.join({ token });
      setJoined(true);
      router.push(`/tracking`);
      void res;
    } catch (e: any) {
      setError(e?.message ?? "Erro ao entrar na organização");
    } finally {
      setJoining(false);
    }
  };

  if (loading || isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="size-5" />
              <CardTitle>Link inválido</CardTitle>
            </div>
            <CardDescription>
              {error ?? "Este link de convite não está disponível."}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="outline">
              <Link href="/sign-in">Ir para o login</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const expiresAt = new Date(data.expiresAt);

  if (joined) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-emerald-500">
              <CheckIcon className="size-5" />
              <CardTitle>Você entrou em {data.organization.name}</CardTitle>
            </div>
            <CardDescription>Redirecionando...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Entrar em {data.organization.name}</CardTitle>
          <CardDescription>
            Você foi convidado por <strong>{data.createdBy.name}</strong> para
            entrar nesta organização.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Cargo ao entrar</span>
            <Badge variant="outline">{data.role}</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Válido até</span>
            <span>{expiresAt.toLocaleDateString("pt-BR")}</span>
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          {session?.user ? (
            <Button onClick={handleJoin} disabled={joining} className="w-full">
              {joining ? "Entrando..." : "Entrar na organização"}
            </Button>
          ) : (
            <>
              <Button asChild variant="outline" className="flex-1">
                <Link href={`/sign-in?callbackUrl=/join/${token}`}>Entrar</Link>
              </Button>
              <Button asChild className="flex-1">
                <Link href={`/sign-up?callbackUrl=/join/${token}`}>
                  Criar conta
                </Link>
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
