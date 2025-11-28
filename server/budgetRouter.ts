import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";

export const budgetRouter = router({
  // Get all budgets for user
  getAll: protectedProcedure.query(async ({ ctx }) => {
    try {
      console.log(`[BudgetRouter] Getting budgets for user id: ${ctx.user.id}, openId: ${ctx.user.openId}`);
      return await db.getBudgetsByUserId(ctx.user.id);
    } catch (error) {
      console.error(`[BudgetRouter] Error getting budgets:`, error);
      // If budgets table doesn't exist, return empty array
      if (error instanceof Error && error.message.includes('relation "budgets" does not exist')) {
        return [];
      }
      throw error;
    }
  }),

  // Create new budget
  create: protectedProcedure
    .input(z.object({
      categoryId: z.number().int().positive(),
      period: z.enum(["weekly", "monthly", "yearly"]),
      limitAmount: z.number().int().positive("Limit must be positive"),
      alertThreshold: z.number().int().min(1).max(100).default(75),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Check if budget already exists for this category and period
        const existing = await db.getBudgetsByUserId(ctx.user.openId);
        const duplicate = existing.find(b => 
          b.categoryId === input.categoryId && 
          b.period === input.period &&
          b.isActive
        );

        if (duplicate) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Budget already exists for this category and period",
          });
        }

        // Set start and end dates based on period
        const startDate = new Date();
        const endDate = new Date();
        
        switch (input.period) {
          case "weekly":
            endDate.setDate(endDate.getDate() + 7);
            break;
          case "monthly":
            endDate.setMonth(endDate.getMonth() + 1);
            break;
          case "yearly":
            endDate.setFullYear(endDate.getFullYear() + 1);
            break;
        }

        const budget = await db.createBudget({
          userId: ctx.user.openId,
          categoryId: input.categoryId,
          period: input.period,
          limitAmount: input.limitAmount,
          alertThreshold: input.alertThreshold,
          startDate,
          endDate,
          currentSpent: 0,
          isActive: true,
        });

        return budget;
      } catch (error) {
        if (error instanceof Error && error.message.includes('relation "budgets" does not exist')) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Budget feature is not available. Database table missing.",
          });
        }
        throw error;
      }
    }),

  // Update budget
  update: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      limitAmount: z.number().int().positive().optional(),
      alertThreshold: z.number().int().min(1).max(100).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      
      // Verify budget belongs to user
      const budget = await db.getBudgetById(id, ctx.user.openId);
      if (!budget) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Budget not found",
        });
      }

      await db.updateBudget(id, ctx.user.openId, data);
      return { success: true };
    }),

  // Delete budget
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteBudget(input.id, ctx.user.openId);
      return { success: true };
    }),

  // Check budget status and get alerts
  checkStatus: protectedProcedure.query(async ({ ctx }) => {
    try {
      const budgets = await db.getBudgetsByUserId(ctx.user.openId);
      const alerts: Array<{
        budgetId: number;
        categoryId: number;
        percentage: number;
        severity: "warning" | "danger" | "critical";
        message: string;
      }> = [];

      for (const budget of budgets) {
        if (!budget.isActive) continue;

        const percentage = (budget.currentSpent / budget.limitAmount) * 100;

        if (percentage >= 100) {
          alerts.push({
            budgetId: budget.id,
            categoryId: budget.categoryId,
            percentage,
            severity: "critical",
            message: `Budget exceeded! You've spent ${percentage.toFixed(0)}% of your limit.`,
          });
        } else if (percentage >= 90) {
          alerts.push({
            budgetId: budget.id,
            categoryId: budget.categoryId,
            percentage,
            severity: "danger",
            message: `Almost at limit! ${percentage.toFixed(0)}% of budget used.`,
          });
        } else if (percentage >= budget.alertThreshold) {
          alerts.push({
            budgetId: budget.id,
            categoryId: budget.categoryId,
            percentage,
            severity: "warning",
            message: `${percentage.toFixed(0)}% of budget used. Consider slowing down.`,
          });
        }
      }

      return { budgets, alerts };
    } catch (error) {
      // If budgets table doesn't exist, return empty state
      if (error instanceof Error && error.message.includes('relation "budgets" does not exist')) {
        return { budgets: [], alerts: [] };
      }
      throw error;
    }
  }),
});
