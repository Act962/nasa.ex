"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader } from "lucide-react";
import { useQueryFormInsights } from "../hooks/use-form";

const StatsCards = () => {
  const { data, isLoading } = useQueryFormInsights();

  return (
    <div
      className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4"
    >
      <Card className="bg-accent/10">
        <CardHeader className="pb-2">
          <CardDescription>Total Forms</CardDescription>
          <CardTitle className="text-4xl">
            {isLoading ? (
              <Loader className="h-[36px] animate-spin" />
            ) : (
              data?.totalForms || 0
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">
            Total de forms criados nesta empresa
          </div>
        </CardContent>
      </Card>

      {/* {Responses} */}
      <Card className="bg-accent/10">
        <CardHeader className="pb-2">
          <CardDescription>Total de respostas</CardDescription>
          <CardTitle className="text-4xl">
            {isLoading ? (
              <Loader className="h-[36px] animate-spin" />
            ) : (
              data?.totalResponses || 0
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">
            Total de respostas enviadas para os forms
          </div>
        </CardContent>
      </Card>

      {/* {Conversion Rate} */}
      <Card className="bg-accent/10">
        <CardHeader className="pb-2">
          <CardDescription>Taxa de conversão</CardDescription>
          <CardTitle className="text-4xl">
            {isLoading ? (
              <Loader className="h-[36px] animate-spin" />
            ) : (
              <>{data?.conversionRate?.toFixed(1)}%</>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">
            Percentual de visualizações que resultaram em respostas
          </div>
        </CardContent>
      </Card>

      {/* {Engagement Rate} */}
      <Card className="bg-accent/10">
        <CardHeader className="pb-2">
          <CardDescription>Taxa de engajamento</CardDescription>
          <CardTitle className="text-4xl">
            {isLoading ? (
              <Loader className="h-[36px] animate-spin" />
            ) : (
              <>{data?.engagementRate?.toFixed(1)}%</>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">
            Percentual de forms que receberam respostas
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatsCards;
