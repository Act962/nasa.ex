import { z } from "zod";

export const salesSectorSchema = z.enum(["COMMERCIAL", "FINANCE", "LOGISTICS", "ACCOUNTING"]);
export const salesRoundSchema = z.enum(["PRE_PAYMENT", "POST_PAYMENT"]);
