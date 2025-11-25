// /home/ubuntu/money-goal-app/server/routers.ts
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";
import { authRouter } from "./authRouter";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter, // Usando o novo authRouter

  // Manter a rota de logout aqui por enquanto
  logout: publicProcedure.mutation(() => {
    // REMOVED: Cookie clearing logic. Client is now responsible for clearing localStorage.
    return {
      success: true,
    } as const;
  }),

  // Goals
  goals: router({
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        targetAmount: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createGoal({
          userId: ctx.user.id,
          name: input.name,
          targetAmount: input.targetAmount,
          currentAmount: 0,
          status: "active",
        });
        return { success: true };
      }),

    getActive: protectedProcedure.query(async ({ ctx }) => {
      return await db.getActiveGoal(ctx.user.id);
    }),

    getArchived: protectedProcedure.query(async ({ ctx }) => {
      return await db.getArchivedGoals(ctx.user.id);
    }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        targetAmount: z.number().optional(),
        currentAmount: z.number().optional(),
        status: z.enum(["active", "archived"]).optional(),
        archivedDate: z.date().optional(),
        completedDate: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updateGoal(id, ctx.user.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteGoal(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // ... (o resto do arquivo continua aqui)
});

export type AppRouter = typeof appRouter;
