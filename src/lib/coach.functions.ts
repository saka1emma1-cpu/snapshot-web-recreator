import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { askCoach } from "./coach.server";

export const getTacticalAdvice = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ position: z.string().min(10).max(2000), question: z.string().max(300) }).parse(d))
  .handler(async ({ data }) => {
    try {
      return { advice: await askCoach(data.position, data.question), error: null };
    } catch (e) {
      return { advice: null, error: e instanceof Error ? e.message : "Coach unavailable" };
    }
  });
