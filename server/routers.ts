import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
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

  // Transactions
  transactions: router({
    create: protectedProcedure
      .input(z.object({
        goalId: z.number(),
        categoryId: z.number().optional(),
        type: z.enum(["income", "expense"]),
        amount: z.number(),
        reason: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createTransaction({
          userId: ctx.user.id,
          goalId: input.goalId,
          categoryId: input.categoryId || null,
          type: input.type,
          amount: input.amount,
          reason: input.reason,
        });

        // Update goal's current amount
        const goal = await db.getActiveGoal(ctx.user.id);
        if (goal) {
          const newAmount = input.type === "income" 
            ? goal.currentAmount + input.amount 
            : goal.currentAmount - input.amount;
          
          await db.updateGoal(goal.id, ctx.user.id, { currentAmount: newAmount });
        }

        return { success: true };
      }),

    getByGoal: protectedProcedure
      .input(z.object({ goalId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getTransactionsByGoalId(input.goalId, ctx.user.id);
      }),

    getAll: protectedProcedure.query(async ({ ctx }) => {
      return await db.getAllTransactionsByUserId(ctx.user.id);
    }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        categoryId: z.number().optional(),
        amount: z.number().optional(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        
        // Get the old transaction to calculate the difference
        const allTransactions = await db.getAllTransactionsByUserId(ctx.user.id);
        const oldTransaction = allTransactions.find(t => t.id === id);
        
        if (oldTransaction && data.amount !== undefined) {
          const goal = await db.getActiveGoal(ctx.user.id);
          if (goal) {
            // Reverse the old amount
            const reversedAmount = oldTransaction.type === "income" 
              ? goal.currentAmount - oldTransaction.amount 
              : goal.currentAmount + oldTransaction.amount;
            
            // Apply the new amount
            const newAmount = oldTransaction.type === "income" 
              ? reversedAmount + data.amount 
              : reversedAmount - data.amount;
            
            await db.updateGoal(goal.id, ctx.user.id, { currentAmount: newAmount });
          }
        }
        
        await db.updateTransaction(id, ctx.user.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Get the transaction to reverse its effect on the goal
        const allTransactions = await db.getAllTransactionsByUserId(ctx.user.id);
        const transaction = allTransactions.find(t => t.id === input.id);
        
        if (transaction) {
          const goal = await db.getActiveGoal(ctx.user.id);
          if (goal) {
            const newAmount = transaction.type === "income" 
              ? goal.currentAmount - transaction.amount 
              : goal.currentAmount + transaction.amount;
            
            await db.updateGoal(goal.id, ctx.user.id, { currentAmount: newAmount });
          }
        }
        
        await db.deleteTransaction(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // Categories
  categories: router({
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        emoji: z.string(),
        color: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createCategory({
          userId: ctx.user.id,
          name: input.name,
          emoji: input.emoji,
          color: input.color,
        });
        return { success: true };
      }),

    getAll: protectedProcedure.query(async ({ ctx }) => {
      return await db.getCategoriesByUserId(ctx.user.id);
    }),
  }),

  // User Settings
  settings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      let settings = await db.getUserSettings(ctx.user.id);
      
      if (!settings) {
        await db.createUserSettings({
          userId: ctx.user.id,
          language: "en",
          currency: "USD",
          theme: "dark",
          monthlySavingTarget: 0,
          hasUnreadArchived: false,
        });
        settings = await db.getUserSettings(ctx.user.id);
      }
      
      return settings;
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
        await db.updateUserSettings(ctx.user.id, input);
        return { success: true };
      }),
  }),

  // Recurring Expenses
  recurringExpenses: router({
    create: protectedProcedure
      .input(z.object({
        categoryId: z.number(),
        name: z.string(),
        amount: z.number(),
        frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createRecurringExpense({
          userId: ctx.user.id,
          categoryId: input.categoryId,
          name: input.name,
          amount: input.amount,
          frequency: input.frequency,
          isActive: true,
        });
        return { success: true };
      }),

    getAll: protectedProcedure.query(async ({ ctx }) => {
      return await db.getRecurringExpensesByUserId(ctx.user.id);
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

  // Projects
  projects: router({
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        category: z.string().optional(),
        amount: z.number(),
        month: z.number(),
        year: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createProject({
          userId: ctx.user.id,
          name: input.name,
          category: input.category || null,
          amount: input.amount,
          month: input.month,
          year: input.year,
          isPaid: false,
        });
        return { success: true };
      }),

    getAll: protectedProcedure.query(async ({ ctx }) => {
      return await db.getProjectsByUserId(ctx.user.id);
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

  // Events
  events: router({
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        month: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createEvent({
          userId: ctx.user.id,
          name: input.name,
          month: input.month,
        });
        return { success: true };
      }),

    getAll: protectedProcedure.query(async ({ ctx }) => {
      // Initialize default events if not already done
      await db.initializeDefaultEvents(ctx.user.id);
      return await db.getEventsByUserId(ctx.user.id);
    }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        month: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updateEvent(id, ctx.user.id, data);
        return { success: true };
      }),

    toggleSelection: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.toggleEventSelection(input.id, ctx.user.id);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteEvent(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // Chat
  chat: router({
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

        // Get chat history
        const history = await db.getChatMessagesByUserId(ctx.user.id);
        
        // Prepare messages for OpenAI
        const messages = [
          {
            role: "system" as const,
            content: "Você é o FinanAI, um consultor financeiro pessoal amigável e prestativo. Ajude o usuário com suas finanças, forneça conselhos sobre economia, orçamento e planejamento financeiro. Responda sempre em português brasileiro."
          },
          ...history.slice(-10).map(msg => ({
            role: msg.role as "user" | "assistant" | "system",
            content: msg.content
          }))
        ];

        // Call OpenAI
        const response = await invokeLLM({
          messages,
        });

        const content = response.choices[0]?.message?.content;
        const assistantMessage = typeof content === 'string' ? content : "Desculpe, não consegui processar sua mensagem.";

        // Save assistant message
        await db.createChatMessage({
          userId: ctx.user.id,
          role: "assistant",
          content: assistantMessage,
        });

        return { message: assistantMessage };
      }),

    getHistory: protectedProcedure.query(async ({ ctx }) => {
      return await db.getChatMessagesByUserId(ctx.user.id);
    }),

    clearHistory: protectedProcedure.mutation(async ({ ctx }) => {
      await db.deleteChatMessagesByUserId(ctx.user.id);
      return { success: true };
    }),
  }),

  // Monthly Payments
  monthlyPayments: router({    
    togglePaid: protectedProcedure
      .input(z.object({
        month: z.number(),
        year: z.number(),
        totalAmount: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check if already paid
        const existing = await db.getMonthlyPayment(ctx.user.id, input.month, input.year);
        
        if (existing) {
          // Unpay: delete the payment record and the transaction
          if (existing.transactionId) {
            await db.deleteTransaction(existing.transactionId, ctx.user.id);
            
            // Also update goal amount
            const goal = await db.getActiveGoal(ctx.user.id);
            if (goal) {
              const newAmount = goal.currentAmount - existing.totalAmount;
              await db.updateGoal(goal.id, ctx.user.id, { currentAmount: newAmount });
            }
          }
          await db.deleteMonthlyPayment(ctx.user.id, input.month, input.year);
          return { success: true, isPaid: false };
        } else {
          // Pay: create transaction and payment record
          const monthNames = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
          ];
          
          // Get active goal
          const goal = await db.getActiveGoal(ctx.user.id);
          if (!goal) {
            throw new Error("No active goal found");
          }
          
          // Create transaction
          const transactionResult = await db.createTransaction({
            userId: ctx.user.id,
            goalId: goal.id,
            type: "income",
            amount: input.totalAmount,
            reason: `${monthNames[input.month - 1]} ${input.year} - AQWorlds Projects`,
          });
          
          // Get the transaction ID from the result
          const transactionId = Number((transactionResult as any)[0]?.insertId || 0);
          
          // Update goal amount
          const newAmount = goal.currentAmount + input.totalAmount;
          await db.updateGoal(goal.id, ctx.user.id, { currentAmount: newAmount });
          
          // Create payment record
          await db.createMonthlyPayment({
            userId: ctx.user.id,
            month: input.month,
            year: input.year,
            totalAmount: input.totalAmount,
            transactionId,
          });
          
          return { success: true, isPaid: true };
        }
      }),
    
    getPayment: protectedProcedure
      .input(z.object({
        month: z.number(),
        year: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        return await db.getMonthlyPayment(ctx.user.id, input.month, input.year);
      }),
  }),
});

export type AppRouter = typeof appRouter;
