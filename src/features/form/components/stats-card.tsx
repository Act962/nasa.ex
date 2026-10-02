"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { useQueryFormInsights } from "../hooks/use-form";

const StatsCards = () => {
  const { data, isLoading } = useQueryFormInsights();

  return (
    <div
      className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4"
    >
      <Card className="bg-accent/10 max-sm:gap-2 max-sm:py-4">
        <CardHeader className="pb-2 max-sm:px-4 max-sm:pb-0">
          <CardDescription>Total Forms</CardDescription>
          <CardTitle className="text-2xl sm:text-4xl">
            {isLoading ? (
              <OrbitaSpinner className="size-9" />
            ) : (
              data?.totalForms || 0
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="max-sm:px-4">
          <div className="text-xs text-muted-foreground max-sm:line-clamp-2 max-sm:text-[11px]">
            Total de forms criados nesta empresa
          </div>
        </CardContent>
      </Card>

      {/* {Responses} */}
      <Card className="bg-accent/10 max-sm:gap-2 max-sm:py-4">
        <CardHeader className="pb-2 max-sm:px-4 max-sm:pb-0">
          <CardDescription>Total de respostas</CardDescription>
          <CardTitle className="text-2xl sm:text-4xl">
            {isLoading ? (
              <OrbitaSpinner className="size-9" />
            ) : (
              data?.totalResponses || 0
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="max-sm:px-4">
          <div className="text-xs text-muted-foreground max-sm:line-clamp-2 max-sm:text-[11px]">
            Total de respostas enviadas para os forms
          </div>
        </CardContent>
      </Card>

      {/* {Conversion Rate} */}
      <Card className="bg-accent/10 max-sm:gap-2 max-sm:py-4">
        <CardHeader className="pb-2 max-sm:px-4 max-sm:pb-0">
          <CardDescription>Taxa de conversão</CardDescription>
          <CardTitle className="text-2xl sm:text-4xl">
            {isLoading ? (
              <OrbitaSpinner className="size-9" />
            ) : (
              <>{data?.conversionRate?.toFixed(1)}%</>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="max-sm:px-4">
          <div className="text-xs text-muted-foreground max-sm:line-clamp-2 max-sm:text-[11px]">
            Percentual de visualizações que resultaram em respostas
          </div>
        </CardContent>
      </Card>

      {/* {Engagement Rate} */}
      <Card className="bg-accent/10 max-sm:gap-2 max-sm:py-4">
        <CardHeader className="pb-2 max-sm:px-4 max-sm:pb-0">
          <CardDescription>Taxa de engajamento</CardDescription>
          <CardTitle className="text-2xl sm:text-4xl">
            {isLoading ? (
              <OrbitaSpinner className="size-9" />
            ) : (
              <>{data?.engagementRate?.toFixed(1)}%</>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="max-sm:px-4">
          <div className="text-xs text-muted-foreground max-sm:line-clamp-2 max-sm:text-[11px]">
            Percentual de forms que receberam respostas
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatsCards;
