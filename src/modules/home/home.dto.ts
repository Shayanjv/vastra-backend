import { z } from "zod";

export const dashboardQuerySchema = z.object({
  period: z.enum(["today", "week", "month"]).default("today")
});
