import { serve } from "inngest/next";
import { inngest, functions } from "@/inngest/registry";

export const { GET, POST, PUT } = serve({ client: inngest, functions });
