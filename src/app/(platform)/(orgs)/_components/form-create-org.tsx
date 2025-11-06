"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function FormCreateOrg() {
  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle>Criar organização</CardTitle>
        <CardDescription>
          Preencha o formulário abaixo para criar sua organização.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form></form>
      </CardContent>
      <CardFooter></CardFooter>
    </Card>
  );
}
