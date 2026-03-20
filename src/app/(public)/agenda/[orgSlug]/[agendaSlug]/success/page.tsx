"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { CheckIcon } from "lucide-react";

export default function SuccessPage() {
  return (
    <div className="min-h-screen w-screen flex items-center justify-center p-5">
      <Card className="max-w-[850px] w-full">
        <CardContent>
          <div className="flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center">
              <CheckIcon className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-semibold mt-5">
              Agendamento realizado
            </h1>
            <p className="text-sm font-medium text-muted-foreground mt-2">
              Seu agendamento foi realizado com sucesso!
            </p>
          </div>
          <CardFooter className="flex items-center justify-center mt-4">
            <Button onClick={() => window.close()}>Fechar página</Button>
          </CardFooter>
        </CardContent>
      </Card>
    </div>
  );
}
