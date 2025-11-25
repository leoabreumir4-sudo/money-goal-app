// /home/ubuntu/money-goal-app/server/routers.ts
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";
import { authRouter } from "./authRouter";
import { plaidRouter } from "./plaidRouter";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter, // Usando o novo authRouter
  plaid: plaidRouter, // Bank synchronization via Plaid

  // TEMPORARY: Delete all users (REMOVE AFTER USE!)
  _dangerDeleteAllUsers: publicProcedure.mutation(async () => {
    const dbInstance = await db.getDb();
    if (!dbInstance) throw new Error("Database not available");
    
    const { users } = await import("../drizzle/schema");
    await dbInstance.delete(users);
    
    return { success: true, message: "All users deleted" };
  }),

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
      const goal = await db.getActiveGoal(ctx.user.id);
      
      // Recalculate currentAmount from transactions if goal exists
      if (goal) {
        const transactions = await db.getTransactionsByGoalId(goal.id, ctx.user.id);
        const calculatedAmount = transactions.reduce((sum, t) => {
          return t.type === "income" ? sum + t.amount : sum - t.amount;
        }, 0);
        
        // Update if different
        if (calculatedAmount !== goal.currentAmount) {
          await db.updateGoal(goal.id, ctx.user.id, {
            currentAmount: Math.max(0, calculatedAmount),
          });
          goal.currentAmount = Math.max(0, calculatedAmount);
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

  // Categories
  categories: router({
    getAll: protectedProcedure.query(async ({ ctx }) => {
      return await db.getCategoriesByUserId(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        emoji: z.string(),
        color: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createCategory({
          userId: ctx.user.id,
          ...input,
        });
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
        goalId: z.number(),
        categoryId: z.number().optional(),
        type: z.enum(["income", "expense"]),
        amount: z.number(),
        reason: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Create the transaction
        await db.createTransaction({
          userId: ctx.user.id,
          ...input,
        });
        
        // Update goal's currentAmount
        const goal = await db.getGoalById(input.goalId, ctx.user.id);
        if (goal) {
          const newAmount = input.type === "income" 
            ? goal.currentAmount + input.amount
            : goal.currentAmount - input.amount;
          
          await db.updateGoal(input.goalId, ctx.user.id, {
            currentAmount: Math.max(0, newAmount), // Prevent negative amounts
          });
        }
        
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
      return await db.getUserSettings(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        language: z.string().optional(),
        currency: z.string().optional(),
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
        theme: z.enum(["dark", "light"]).optional(),
        monthlySavingTarget: z.number().optional(),
        hasUnreadArchived: z.boolean().optional(),
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
        frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
        isActive: z.boolean().optional(),
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
        frequency: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
        isActive: z.boolean().optional(),
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
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updateEvent(id, ctx.user.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteEvent(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // Chat Messages
  chat: router({
    getHistory: protectedProcedure.query(async ({ ctx }) => {
      return await db.getChatMessagesByUserId(ctx.user.id);
    }),

    sendMessage: protectedProcedure
      .input(z.object({
        message: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Save user message
        await db.createChatMessage({
          userId: ctx.user.id,
          role: "user",
          content: input.message,
        });

        // Get AI response
        const response = await invokeLLM([
          { role: "user", content: input.message },
        ]);

        // Save AI response
        await db.createChatMessage({
          userId: ctx.user.id,
          role: "assistant",
          content: response,
        });

        return { response };
      }),
  }),

  // Monthly Payments
  monthlyPayments: router({
    getAll: protectedProcedure.query(async ({ ctx }) => {
      return await db.getMonthlyPaymentsByUserId(ctx.user.id);
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
