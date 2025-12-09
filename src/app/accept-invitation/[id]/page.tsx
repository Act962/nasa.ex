"use client";

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
import { authClient } from "@/lib/auth-client";
import { AlertCircle, CheckIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Invitation {
  organizationName: string;
  organizationSlug: string;
  inviterEmail: string;
  id: string;
  status: "pending" | "accepted" | "rejected" | "canceled";
  email: string;
  expiresAt: Date;
  organizationId: string;
  role: string;
  inviterId: string;
}

export default function Page() {
  const { id: invitationId } = useParams<{ id: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [invitationStatus, setInvitationStatus] = useState<
    "pending" | "accepted" | "rejected" | "canceled"
  >("pending");

  const handleAccept = async () => {
    await authClient.organization
      .acceptInvitation({
        invitationId,
      })
      .then((res) => {
        if (res.error) {
          setError(
            res.error.message || "Aconteceu um erro ao aceitar o convite."
          );
        } else {
          setInvitationStatus("accepted");

          router.push(`/tracking`);
        }
      });
  };

  const handleReject = async () => {
    await authClient.organization
      .rejectInvitation({
        invitationId,
      })
      .then((res) => {
        if (res.error) {
          setError(
            res.error.message || "Aconteceu um erro ao recusar o convite."
          );
        } else {
          setInvitationStatus("rejected");
        }
      });
  };

  useEffect(() => {
    authClient.organization
      .getInvitation({
        query: {
          id: invitationId,
        },
      })
      .then((res) => {
        if (res.error) {
          setError(res.error.message || "Ocorreu um erro ao buscar a convite.");
        } else {
          setInvitation(res.data);
        }
      });
  }, []);

  return (
    <div className="h-full flex items-center justify-center bg-background">
      {invitation ? (
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Convite da {invitation?.organizationName}</CardTitle>
            <CardDescription>
              Você foi convidado para participar de uma empresa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invitationStatus === "pending" && (
              <div className="space-y-4">
                <p>
                  <strong>{invitation?.inviterEmail}</strong> convidou você para
                  juntar <strong>{invitation?.organizationName}</strong>.
                </p>
                <p>
                  Este convite foi enviado para{" "}
                  <strong>{invitation?.email}</strong>.
                </p>
              </div>
            )}
            {invitationStatus === "accepted" && (
              <div className="space-y-4">
                <div className="flex items-center justify-center w-16 h-16 mx-auto bg-green-100 rounded-full">
                  <CheckIcon className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-center">
                  Bem-vindo à {invitation?.organizationName}!
                </h2>
                <p className="text-center">
                  Você se juntou à organização com sucesso. Estamos felizes em
                  tê-lo(a) conosco!
                </p>
              </div>
            )}
            {invitationStatus === "rejected" && (
              <div className="space-y-4">
                <div className="flex items-center justify-center w-16 h-16 mx-auto bg-red-100 rounded-full">
                  <XIcon className="w-8 h-8 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-center">
                  Convite Recusado
                </h2>
                <p className="text-center">
                  Você recusou o convite para se juntar à{" "}
                  <strong>{invitation?.organizationName}</strong>.
                </p>
              </div>
            )}
          </CardContent>
          {invitationStatus === "pending" && (
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={handleReject}>
                Recusar
              </Button>
              <Button onClick={handleAccept}>Aceitar Convite</Button>
            </CardFooter>
          )}
        </Card>
      ) : error ? (
        <InvitationError />
      ) : (
        <InvitationSkeleton />
      )}
    </div>
  );
}

function InvitationSkeleton() {
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Skeleton className="w-6 h-6 rounded-full" />
          <Skeleton className="h-6 w-24" />
        </div>
        <Skeleton className="h-4 w-full mt-2" />
        <Skeleton className="h-4 w-2/3 mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </CardContent>
      <CardFooter className="flex justify-end">
        <Skeleton className="h-10 w-24" />
      </CardFooter>
    </Card>
  );
}

function InvitationError() {
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-6 h-6 text-destructive" />
          <CardTitle className="text-xl text-destructive">
            Erro de convite
          </CardTitle>
        </div>
        <CardDescription>Houve um problema com o seu convite.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          O convite que você está tentando acessar é inválido ou você não tem as
          permissões corretas. Por favor, verifique seu e-mail para um convite
          válido ou entre em contato com a pessoa que o enviou.
        </p>
      </CardContent>
      <CardFooter>
        <Link href="/" className="w-full">
          <Button variant="outline" className="w-full">
            Voltar para a página inicial
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
