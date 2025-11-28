// /home/ubuntu/money-goal-app/server/routers.ts
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";
import { authRouter } from "./authRouter";
import { wiseRouter } from "./wiseRouter";
import { csvRouter } from "./csvRouter";
import { webhookRouter } from "./webhookRouter";
import { categoryRouter } from "./categoryRouter";
import { chatRouter } from "./chatRouter";
import { whatsappRouter } from "./whatsappRouter";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter, // Usando o novo authRouter
  wise: wiseRouter, // Wise bank synchronization
  csv: csvRouter, // CSV import (Nubank, etc.)
  webhooks: webhookRouter, // Webhook endpoints
  categories: categoryRouter, // Category management with auto-categorization
  chat: chatRouter, // AI Financial Advisor
  whatsapp: whatsappRouter, // WhatsApp integration

  // Logout procedure
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
        name: z.string().min(1, "Name is required").max(255, "Name too long"),
        targetAmount: z.number().int().positive("Target amount must be positive"),
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
      const goal = await db.getActiveGoal(ctx.user.id);
      
      // Recalculate currentAmount from transactions if goal exists
      if (goal) {
        const transactions = await db.getTransactionsByGoalId(goal.id, ctx.user.id);
        
        // Separate Wise transactions from manual transactions
        const manualTransactions = transactions.filter(t => t.source !== 'wise');
        const wiseTransactions = transactions.filter(t => t.source === 'wise');
        
        // Calculate amount from manual transactions only
        const manualAmount = manualTransactions.reduce((sum, t) => {
          return t.type === "income" ? sum + t.amount : sum - t.amount;
        }, 0);
        
        // Get total Wise balance converted to user's currency (this is the current real balance)
        let wiseBalance = 0;
        try {
          const settings = await db.getUserSettings(ctx.user.id);
          if (settings?.wiseApiToken) {
            // Import Wise functions
            const { getProfiles, getBalances } = await import("./_core/wise");
            const { convertBalances } = await import("./_core/currencyConversion");
            
            const preferredCurrency = settings.currency || "USD";
            const profiles = await getProfiles(settings.wiseApiToken);
            
            if (profiles.length > 0) {
              const balances = await getBalances(settings.wiseApiToken, profiles[0].id);
              const balancesInCents = balances.map(balance => ({
                currency: balance.currency,
                amount: Math.round(balance.amount.value * 100),
              }));
              
              const converted = await convertBalances(balancesInCents, preferredCurrency);
              wiseBalance = converted.reduce((sum, balance) => sum + balance.convertedAmount, 0);
            }
          }
        } catch (error) {
          console.error("Error fetching Wise balance for goal:", error);
          // Continue without Wise balance on error
        }
        
        // Total = manual transactions + current Wise balance (not Wise transactions from CSV)
        // Wise transactions are for history/detail only, the real balance comes from API
        const totalAmount = manualAmount + wiseBalance;
        
        // Update if different
        if (totalAmount !== goal.currentAmount) {
          await db.updateGoal(goal.id, ctx.user.id, {
            currentAmount: Math.max(0, totalAmount),
          });
          goal.currentAmount = Math.max(0, totalAmount);
        }
      }
      
      return goal;
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

  // Transactions
  transactions: router({
    getAll: protectedProcedure.query(async ({ ctx }) => {
      return await db.getAllTransactionsByUserId(ctx.user.id);
    }),

    getByGoalId: protectedProcedure
      .input(z.object({ goalId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getTransactionsByGoalId(input.goalId, ctx.user.id);
      }),

    create: protectedProcedure
      .input(z.object({
        goalId: z.number().int().positive(),
        categoryId: z.number().int().positive().optional(),
        type: z.enum(["income", "expense"]),
        amount: z.number().int().positive("Amount must be positive"),
        reason: z.string().min(1, "Reason is required").max(255, "Reason too long"),
        currency: z.string().length(3, "Currency must be 3 characters (e.g., USD)").optional(),
        exchangeRate: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Validate goal exists and belongs to user
        const goal = await db.getGoalById(input.goalId, ctx.user.id);
        if (!goal) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Goal not found",
          });
        }

        // Auto-categorize if no categoryId provided
        let categoryId = input.categoryId;
        if (!categoryId) {
          const { categorizeTransaction } = await import("./_core/categorization");
          const categories = await db.getAllCategories(ctx.user.id);
          categoryId = categorizeTransaction(input.reason, categories);
        }

        // Create the transaction
        await db.createTransaction({
          userId: ctx.user.id,
          goalId: input.goalId,
          categoryId,
          type: input.type,
          amount: input.amount,
          reason: input.reason,
          currency: input.currency || "USD",
          exchangeRate: input.exchangeRate,
        });
        
        // Update goal's currentAmount
        const newAmount = input.type === "income" 
            ? goal.currentAmount + input.amount
            : goal.currentAmount - input.amount;
          
          await db.updateGoal(input.goalId, ctx.user.id, {
            currentAmount: Math.max(0, newAmount), // Prevent negative amounts
          });
        
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        categoryId: z.number().optional(),
        type: z.enum(["income", "expense"]).optional(),
        amount: z.number().optional(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updateTransaction(id, ctx.user.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteTransaction(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // User Settings
  settings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      try {
        const settings = await db.getUserSettings(ctx.user.id);
        return settings;
      } catch (error) {
        console.error('[Settings] Error fetching user settings:', error);
        // Return null instead of throwing - frontend will handle missing settings
        return null;
      }
    }),

    create: protectedProcedure
      .input(z.object({
        language: z.string().optional(),
        currency: z.string().optional(),
        numberFormat: z.enum(["en-US", "pt-BR"]).optional(),
        theme: z.enum(["dark", "light"]).optional(),
        monthlySavingTarget: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createUserSettings({
          userId: ctx.user.id,
          ...input,
        });
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        language: z.string().optional(),
        currency: z.string().optional(),
        numberFormat: z.enum(["en-US", "pt-BR"]).optional(),
        theme: z.enum(["dark", "light"]).optional(),
        monthlySavingTarget: z.number().optional(),
        hasUnreadArchived: z.boolean().optional(),
        wiseApiToken: z.string().nullable().optional(),
        wiseWebhookSecret: z.string().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check if settings exist
        const existing = await db.getUserSettings(ctx.user.id);
        if (existing) {
          // Update existing settings
          await db.updateUserSettings(ctx.user.id, input);
        } else {
          // Create new settings
          await db.createUserSettings({
            userId: ctx.user.id,
            language: input.language || "en",
            currency: input.currency || "USD",
            numberFormat: input.numberFormat || "pt-BR",
            theme: input.theme || "dark",
            monthlySavingTarget: input.monthlySavingTarget || 0,
          });
        }
        return { success: true };
      }),
  }),

  // Recurring Expenses
  recurringExpenses: router({
    getAll: protectedProcedure.query(async ({ ctx }) => {
      return await db.getRecurringExpensesByUserId(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        categoryId: z.number(),
        name: z.string(),
        amount: z.number(),
        currency: z.string().optional(),
        frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
        isActive: z.boolean().optional(),
        dayOfMonth: z.number().min(1).max(31).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createRecurringExpense({
          userId: ctx.user.id,
          ...input,
        });
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        categoryId: z.number().optional(),
        name: z.string().optional(),
        amount: z.number().optional(),
        currency: z.string().optional(),
        frequency: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
        isActive: z.boolean().optional(),
        dayOfMonth: z.number().min(1).max(31).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updateRecurringExpense(id, ctx.user.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteRecurringExpense(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // Projects (AQWorlds)
  projects: router({
    getAll: protectedProcedure.query(async ({ ctx }) => {
      return await db.getProjectsByUserId(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        category: z.string().optional(),
        amount: z.number(),
        month: z.number(),
        year: z.number(),
        isPaid: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createProject({
          userId: ctx.user.id,
          ...input,
        });
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        category: z.string().optional(),
        amount: z.number().optional(),
        month: z.number().optional(),
        year: z.number().optional(),
        isPaid: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updateProject(id, ctx.user.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteProject(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // Events (AQWorlds Calendar)
  events: router({
    getAll: protectedProcedure.query(async ({ ctx }) => {
      const events = await db.getEventsByUserId(ctx.user.id);
      
      // If user has no events, initialize with default events
      if (events.length === 0) {
        const defaultEvents = [
          { month: 1, names: ["Australia Day", "Akiba New Year", "Nulgath's Birthday", "Dominik's Birthday"] },
          { month: 2, names: ["Carnaval", "Groundhorc's Day", "Heroes Heart Day", "Pancake Day", "Super Bowl"] },
          { month: 3, names: ["Dage's Birthday", "Good Luck Day", "Grenwog"] },
          { month: 4, names: ["April Fools' Day", "Earth Day", "Solar New Year"] },
          { month: 5, names: ["Cinco de Mayo", "May the 4th", "Summer Break"] },
          { month: 6, names: ["Alvaro's Birthday", "AQWorld Cup", "Father's Day"] },
          { month: 7, names: ["Freedom Day", "Frostval in July"] },
          { month: 8, names: ["Back to School", "Indonesian Day"] },
          { month: 9, names: ["Obrigado Brasil", "Talk Like a Pirate Day", "Yoshino's Birthday"] },
          { month: 10, names: ["AQWorlds' Birthday", "Canadian Thanksgiving", "Taco Day", "Alina's Birthday"] },
          { month: 11, names: ["Black Friday", "Cyber Monday", "Harvest Day"] },
          { month: 12, names: ["Frostval", "New Year"] },
        ];

        for (const monthData of defaultEvents) {
          for (const name of monthData.names) {
            await db.createEvent({
              userId: ctx.user.id,
              name,
              month: monthData.month,
              isSelected: 0,
              isDefault: 1,
            });
          }
        }

        return await db.getEventsByUserId(ctx.user.id);
      }

      return events;
    }),

    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        month: z.number(),
        isSelected: z.number().optional(),
        isDefault: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createEvent({
          userId: ctx.user.id,
          ...input,
        });
        return { success: true };
      }),

    toggleSelection: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const event = await db.getEventById(input.id, ctx.user.id);
        if (event) {
          await db.updateEvent(input.id, ctx.user.id, {
            isSelected: event.isSelected === 1 ? 0 : 1,
          });
        }
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        month: z.number().optional(),
        isSelected: z.number().optional(),
        isDefault: z.number().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updateEvent(id, ctx.user.id, data);
        return { success: true };
      }),

    reorder: protectedProcedure
      .input(z.object({
        eventId: z.number(),
        newSortOrder: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateEvent(input.eventId, ctx.user.id, { sortOrder: input.newSortOrder });
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteEvent(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // Monthly Payments
  monthlyPayments: router({
    getAll: protectedProcedure.query(async ({ ctx }) => {
      return await db.getMonthlyPaymentsByUserId(ctx.user.id);
    }),

    getPayment: protectedProcedure
      .input(z.object({
        month: z.number(),
        year: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const payments = await db.getMonthlyPaymentsByUserId(ctx.user.id);
        return payments.find(p => p.month === input.month && p.year === input.year) || null;
      }),

    togglePaid: protectedProcedure
      .input(z.object({
        month: z.number().int().min(1).max(12, "Month must be between 1 and 12"),
        year: z.number().int().min(2000).max(2100, "Year must be between 2000 and 2100"),
        totalAmount: z.number().int().positive("Total amount must be positive"),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check for existing payment (idempotency)
        const payments = await db.getMonthlyPaymentsByUserId(ctx.user.id);
        const existingPayment = payments.find(p => p.month === input.month && p.year === input.year);

        if (existingPayment) {
          // Unmark as paid: Delete payment and transaction
          if (existingPayment.transactionId) {
            try {
              await db.deleteTransaction(existingPayment.transactionId, ctx.user.id);
            } catch (error) {
              // Transaction might already be deleted, log but continue
              console.error("[MonthlyPayments] Transaction already deleted:", error);
            }
          }
          await db.deleteMonthlyPayment(existingPayment.id, ctx.user.id);
          return { isPaid: false };
        } else {
          // Mark as paid: Get active goal first
          const activeGoal = await db.getActiveGoal(ctx.user.id);
          if (!activeGoal) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "No active goal found. Please create a goal first.",
            });
          }

          // Create transaction first
          const transaction = await db.createTransaction({
            userId: ctx.user.id,
            goalId: activeGoal.id,
            type: 'income',
            amount: input.totalAmount,
            reason: `AQWorlds Payment - ${input.month}/${input.year}`,
            source: 'AQWorlds',
            currency: 'USD',
          });

          // Create payment with transaction reference
          await db.createMonthlyPayment({
            userId: ctx.user.id,
            month: input.month,
            year: input.year,
            totalAmount: input.totalAmount,
            transactionId: transaction.id,
          });

          return { isPaid: true };
        }
      }),

    create: protectedProcedure
      .input(z.object({
        month: z.number(),
        year: z.number(),
        totalAmount: z.number(),
        transactionId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createMonthlyPayment({
          userId: ctx.user.id,
          ...input,
        });
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        month: z.number().optional(),
        year: z.number().optional(),
        totalAmount: z.number().optional(),
        transactionId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updateMonthlyPayment(id, ctx.user.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteMonthlyPayment(input.id, ctx.user.id);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
