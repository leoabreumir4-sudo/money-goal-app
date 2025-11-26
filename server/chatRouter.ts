import { protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";

// Build comprehensive financial context for the AI
async function buildUserFinancialContext(userId: string) {
  const dbInstance = await db.getDb();
  if (!dbInstance) throw new Error("Database not available");

  // Get all user data in parallel
  const [transactions, goals, recurringExpenses, categories, settings] = await Promise.all([
    db.getAllTransactionsByUserId(userId),
    db.getGoalsByUserId(userId),
    db.getRecurringExpensesByUserId(userId),
    db.getCategoriesByUserId(userId),
    db.getUserSettings(userId),
  ]);

  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Calculate financial metrics
  const recentTransactions = transactions.filter((t: any) => new Date(t.createdDate) >= threeMonthsAgo);
  
  const income = recentTransactions
    .filter((t: any) => t.type === "income")
    .reduce((sum: number, t: any) => sum + t.amount, 0);
  
  const expenses = recentTransactions
    .filter((t: any) => t.type === "expense")
    .reduce((sum: number, t: any) => sum + t.amount, 0);

  const monthsCount = Math.min(3, Math.ceil((now.getTime() - threeMonthsAgo.getTime()) / (1000 * 60 * 60 * 24 * 30)));
  const avgMonthlyIncome = monthsCount > 0 ? Math.round(income / monthsCount) : 0;
  const avgMonthlyExpenses = monthsCount > 0 ? Math.round(expenses / monthsCount) : 0;
  const avgMonthlySavings = avgMonthlyIncome - avgMonthlyExpenses;
  const savingsRate = avgMonthlyIncome > 0 ? Math.round((avgMonthlySavings / avgMonthlyIncome) * 100) : 0;

  // Active goal
  const activeGoal = goals.find((g: any) => g.status === "active");

  // Category breakdown (top 5)
  const categorySpending = new Map<number, number>();
  recentTransactions
    .filter((t: any) => t.type === "expense" && t.categoryId)
    .forEach((t: any) => {
      const current = categorySpending.get(t.categoryId!) || 0;
      categorySpending.set(t.categoryId!, current + t.amount);
    });

  const topCategories = Array.from(categorySpending.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([categoryId, amount]) => {
      const category = categories.find((c: any) => c.id === categoryId);
      return {
        name: category?.name || "Other",
        emoji: category?.emoji || "📦",
        avgMonthly: Math.round(amount / monthsCount),
        total: amount,
      };
    });

  // Recurring expenses
  const activeRecurring = recurringExpenses.filter((e: any) => e.isActive !== false);
  const totalMonthlyRecurring = activeRecurring.reduce((sum: number, e: any) => {
    const monthlyAmount = e.frequency === 'monthly' ? e.amount :
                         e.frequency === 'yearly' ? e.amount / 12 :
                         e.frequency === 'weekly' ? e.amount * 4.33 :
                         e.frequency === 'daily' ? e.amount * 30 : 0;
    return sum + monthlyAmount;
  }, 0);

  // Current balance (from active goal)
  const currentBalance = activeGoal?.currentAmount || 0;

  // Format currency helper
  const formatMoney = (cents: number) => {
    const currency = settings?.currency || "USD";
    const symbol = currency === "BRL" ? "R$" : currency === "EUR" ? "€" : "$";
    return `${symbol}${(cents / 100).toFixed(2)}`;
  };

  return {
    // Overview
    currentDate: now.toISOString().split('T')[0],
    currency: settings?.currency || "USD",
    
    // Balances
    currentBalance: formatMoney(currentBalance),
    currentBalanceCents: currentBalance,
    
    // Income & Expenses (last 3 months average)
    avgMonthlyIncome: formatMoney(avgMonthlyIncome),
    avgMonthlyIncomeRaw: avgMonthlyIncome,
    avgMonthlyExpenses: formatMoney(avgMonthlyExpenses),
    avgMonthlyExpensesRaw: avgMonthlyExpenses,
    avgMonthlySavings: formatMoney(avgMonthlySavings),
    avgMonthlySavingsRaw: avgMonthlySavings,
    savingsRate: `${savingsRate}%`,
    savingsRateRaw: savingsRate,
    
    // Active Goal
    activeGoal: activeGoal ? {
      name: activeGoal.name,
      target: formatMoney(activeGoal.targetAmount),
      targetRaw: activeGoal.targetAmount,
      current: formatMoney(activeGoal.currentAmount),
      currentRaw: activeGoal.currentAmount,
      remaining: formatMoney(activeGoal.targetAmount - activeGoal.currentAmount),
      remainingRaw: activeGoal.targetAmount - activeGoal.currentAmount,
      progress: Math.round((activeGoal.currentAmount / activeGoal.targetAmount) * 100),
      monthsToGoal: avgMonthlySavings > 0 ? 
        Math.ceil((activeGoal.targetAmount - activeGoal.currentAmount) / avgMonthlySavings) : null,
    } : null,
    
    // Spending Patterns
    topCategories,
    
    // Recurring Commitments
    recurringExpenses: activeRecurring.map((e: any) => {
      const category = categories.find((c: any) => c.id === e.categoryId);
      const monthlyAmount = e.frequency === 'monthly' ? e.amount :
                           e.frequency === 'yearly' ? e.amount / 12 :
                           e.frequency === 'weekly' ? e.amount * 4.33 :
                           e.frequency === 'daily' ? e.amount * 30 : e.amount;
      return {
        name: e.name,
        category: category?.name || "Other",
        amount: formatMoney(monthlyAmount),
        frequency: e.frequency,
        currency: e.currency || "USD",
      };
    }),
    totalMonthlyRecurring: formatMoney(totalMonthlyRecurring),
    totalMonthlyRecurringRaw: totalMonthlyRecurring,
    
    // Transaction count
    totalTransactions: transactions.length,
    recentTransactionsCount: recentTransactions.length,
    
    // Date context
    currentMonth,
    currentYear,
  };
}

export const chatRouter = router({
  // Send a message to the AI advisor
  sendMessage: protectedProcedure
    .input(z.object({
      message: z.string().min(1).max(1000),
      conversationId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Build financial context
      const financialContext = await buildUserFinancialContext(userId);

      // Get conversation history (last 10 messages)
      const history = await db.getChatMessagesByUserId(userId);
      const recentHistory = history.slice(-10);

      // Build system prompt with context
      const systemPrompt = `You are a professional financial advisor AI assistant named "MoneyGoal Advisor". You have access to the user's complete financial profile and transaction history.

YOUR ROLE:
- Provide realistic, data-driven financial advice based on ACTUAL user data
- Be honest and transparent about what's achievable
- Suggest specific, actionable steps with numbers and timelines
- Consider income, expenses, savings rate, and financial goals
- Prioritize financial health and realistic planning
- Use a friendly but professional tone
- Respond in the same language as the user's question

CURRENT USER FINANCIAL PROFILE:
${JSON.stringify(financialContext, null, 2)}

GUIDELINES:
1. Always use the user's ACTUAL numbers from the profile above
2. Account for recurring expenses in calculations
3. Be realistic - don't overpromise
4. Provide multiple scenarios when relevant (conservative, moderate, aggressive)
5. Suggest trade-offs when goals are ambitious
6. Consider the user's savings rate and consistency
7. If data is insufficient, acknowledge it and provide general guidance
8. Format numbers with proper currency symbols
9. Use emojis sparingly for visual organization (📊 📈 💰 ✅ ⚠️)
10. Keep responses concise but informative (max 300 words)

IMPORTANT: Base ALL calculations and advice on the financial data provided above. Do not make assumptions beyond what's in the profile.`;

      // Build messages array
      const messages = [
        { role: "system" as const, content: systemPrompt },
        ...recentHistory.map(msg => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
        { role: "user" as const, content: input.message },
      ];

      // Call LLM
      const response = await invokeLLM({
        messages,
        maxTokens: 1000,
      });

      const assistantMessage = response.choices[0]?.message?.content;
      if (!assistantMessage || typeof assistantMessage !== 'string') {
        throw new Error("Invalid response from AI");
      }

      // Save user message
      await db.createChatMessage({
        userId,
        role: "user",
        content: input.message,
      });

      // Save assistant response
      await db.createChatMessage({
        userId,
        role: "assistant",
        content: assistantMessage,
      });

      return {
        message: assistantMessage,
        usage: response.usage,
      };
    }),

  // Get conversation history
  getHistory: protectedProcedure.query(async ({ ctx }) => {
    return await db.getChatMessagesByUserId(ctx.user.id);
  }),

  // Clear conversation history
  clearHistory: protectedProcedure.mutation(async ({ ctx }) => {
    await db.clearChatMessages(ctx.user.id);
    return { success: true };
  }),
});
