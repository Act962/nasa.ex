"use client";
import { useQueryFormInsights } from "../hooks/use-form";
import StatsCards from "./stats-card";

export function StatsListWrap() {
  const { data } = useQueryFormInsights();

  return <StatsCards loading={false} data={data} />;
}
