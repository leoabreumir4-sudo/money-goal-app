import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";

export const billReminderRouter = router({
  // Get all bill reminders
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return await db.getBillRemindersByUserId(ctx.user.id);
  }),

  // Get upcoming bills (next 7 days)
  getUpcoming: protectedProcedure
    .input(z.object({
      daysAhead: z.number().int().min(1).max(90).default(7),
    }).optional())
    .query(async ({ ctx, input }) => {
      const daysAhead = input?.daysAhead ?? 7;
      return await db.getUpcomingBills(ctx.user.id, daysAhead);
    }),

  // Create bill reminder
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      amount: z.number().int().positive(),
      dueDay: z.number().int().min(1).max(31),
      frequency: z.enum(["daily", "weekly", "monthly", "yearly"]).default("monthly"),
      categoryId: z.number().int().positive().optional(),
      reminderDaysBefore: z.number().int().min(0).max(30).default(3),
      autoCreateTransaction: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      // Calculate next due date
      const nextDueDate = new Date();
      nextDueDate.setDate(input.dueDay);
      
      // If due day has passed this month, move to next month
      if (nextDueDate < new Date()) {
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      }

      const bill = await db.createBillReminder({
        userId: ctx.user.id,
        name: input.name,
        amount: input.amount,
        dueDay: input.dueDay,
        frequency: input.frequency,
        categoryId: input.categoryId,
        reminderDaysBefore: input.reminderDaysBefore,
        autoCreateTransaction: input.autoCreateTransaction,
        nextDueDate,
        status: "pending",
        isActive: true,
      });

      return bill;
    }),

  // Mark bill as paid
  markAsPaid: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      createTransaction: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const bill = await db.getBillRemindersByUserId(ctx.user.id);
      const targetBill = bill.find(b => b.id === input.id);

      if (!targetBill) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bill reminder not found",
        });
      }

      // Create transaction if requested
      if (input.createTransaction) {
        const activeGoal = await db.getActiveGoal(ctx.user.id);
        if (activeGoal) {
          await db.createTransaction({
            userId: ctx.user.id,
            goalId: activeGoal.id,
            categoryId: targetBill.categoryId,
            type: "expense",
            amount: targetBill.amount,
            reason: `Bill: ${targetBill.name}`,
            currency: "USD",
          });
        }
      }

      // Calculate next due date based on frequency
      const nextDueDate = new Date(targetBill.nextDueDate);
      
      switch (targetBill.frequency) {
        case "daily":
          nextDueDate.setDate(nextDueDate.getDate() + 1);
          break;
        case "weekly":
          nextDueDate.setDate(nextDueDate.getDate() + 7);
          break;
        case "monthly":
          nextDueDate.setMonth(nextDueDate.getMonth() + 1);
          break;
        case "yearly":
          nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
          break;
      }

      // Update bill
      await db.updateBillReminder(input.id, ctx.user.id, {
        status: "paid",
        lastPaidDate: new Date(),
        nextDueDate,
      });

      // Reset status to pending for next cycle
      setTimeout(async () => {
        await db.updateBillReminder(input.id, ctx.user.id, {
          status: "pending",
        });
      }, 1000);

      return { success: true };
    }),

  // Update bill reminder
  update: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      name: z.string().min(1).max(255).optional(),
      amount: z.number().int().positive().optional(),
      dueDay: z.number().int().min(1).max(31).optional(),
      frequency: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
      categoryId: z.number().int().positive().optional(),
      reminderDaysBefore: z.number().int().min(0).max(30).optional(),
      autoCreateTransaction: z.boolean().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await db.updateBillReminder(id, ctx.user.id, data);
      return { success: true };
    }),

  // Delete bill reminder
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteBillReminder(input.id, ctx.user.id);
      return { success: true };
    }),
});
