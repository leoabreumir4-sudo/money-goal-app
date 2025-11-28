import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";

export const aiInsightsRouter = router({
  // Get all insights
  getAll: protectedProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(50).default(10),
    }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 10;
      return await db.getAIInsightsByUserId(ctx.user.id, limit);
    }),

  // Get unread insights
  getUnread: protectedProcedure.query(async ({ ctx }) => {
    return await db.getUnreadInsights(ctx.user.id);
  }),

  // Mark insight as read
  markAsRead: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await db.markInsightAsRead(input.id, ctx.user.id);
      return { success: true };
    }),

  // Delete insight
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteAIInsight(input.id, ctx.user.id);
      return { success: true };
    }),

  // Generate financial forecast
  generateForecast: protectedProcedure.mutation(async ({ ctx }) => {
    // Get user's financial data
    const transactions = await db.getAllTransactionsByUserId(ctx.user.id);
    const goals = await db.getActiveGoals(ctx.user.id);
    const categories = await db.getAllCategories(ctx.user.id);
    
    if (transactions.length < 5) {
      throw new Error("Need at least 5 transactions to generate meaningful forecasts");
    }

    // Calculate statistics
    const last3Months = new Date();
    last3Months.setMonth(last3Months.getMonth() - 3);
    
    const recentTransactions = transactions.filter(t => 
      new Date(t.createdDate) >= last3Months
    );

    const totalIncome = recentTransactions
      .filter(t => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = recentTransactions
      .filter(t => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    const avgMonthlyIncome = totalIncome / 3;
    const avgMonthlyExpense = totalExpenses / 3;
    const monthlySavings = avgMonthlyIncome - avgMonthlyExpense;

    // Category breakdown
    const categorySpending = categories.map(cat => {
      const spent = recentTransactions
        .filter(t => t.categoryId === cat.id && t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);
      
      return {
        name: cat.name,
        amount: spent,
        percentage: totalExpenses > 0 ? (spent / totalExpenses) * 100 : 0,
      };
    }).filter(c => c.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Prepare prompt for AI
    const prompt = `Analyze this financial data and provide insights:

Income (last 3 months): $${(totalIncome / 100).toFixed(2)}
Expenses (last 3 months): $${(totalExpenses / 100).toFixed(2)}
Monthly Average Income: $${(avgMonthlyIncome / 100).toFixed(2)}
Monthly Average Expenses: $${(avgMonthlyExpense / 100).toFixed(2)}
Monthly Savings: $${(monthlySavings / 100).toFixed(2)}

Top Spending Categories:
${categorySpending.map(c => `- ${c.name}: $${(c.amount / 100).toFixed(2)} (${c.percentage.toFixed(1)}%)`).join('\n')}

Active Goals:
${goals.map(g => `- ${g.name}: $${(g.currentAmount / 100).toFixed(2)} / $${(g.targetAmount / 100).toFixed(2)} (${((g.currentAmount / g.targetAmount) * 100).toFixed(1)}%)`).join('\n')}

Provide:
1. Financial health assessment (1-2 sentences)
2. Spending pattern analysis (1-2 sentences)
3. Goal achievement forecast (when will they reach their goals at current pace)
4. 3 specific, actionable recommendations to improve finances
5. Projected annual savings at current rate

Keep it concise, encouraging, and actionable. Use dollar amounts and percentages.`;

    try {
      const aiResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are a professional financial advisor. Provide clear, actionable advice based on user data. Be encouraging but honest about areas for improvement.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 800,
      });

      // Extract text from InvokeResult
      let message: string;
      if (typeof aiResponse === 'string') {
        message = aiResponse;
      } else {
        const content = aiResponse.choices?.[0]?.message?.content;
        if (typeof content === 'string') {
          message = content;
        } else if (Array.isArray(content)) {
          message = content
            .map(c => (c as any).text || (c as any).type || '')
            .filter(Boolean)
            .join('\n');
        } else {
          message = JSON.stringify(aiResponse);
        }
      }

      const insight = await db.createAIInsight({
        userId: ctx.user.id,
        type: "forecast",
        title: "Your Financial Forecast",
        message,
        data: JSON.stringify({
          avgMonthlyIncome: avgMonthlyIncome / 100,
          avgMonthlyExpense: avgMonthlyExpense / 100,
          monthlySavings: monthlySavings / 100,
          projectedAnnualSavings: (monthlySavings * 12) / 100,
          topCategories: categorySpending,
        }),
        priority: 10,
        isRead: false,
      });

      return insight;
    } catch (error) {
      console.error("[AI Insights] Error generating forecast:", error);
      throw error;
    }
  }),

  // Generate spending alerts
  generateAlerts: protectedProcedure.mutation(async ({ ctx }) => {
    const transactions = await db.getAllTransactionsByUserId(ctx.user.id);
    const categories = await db.getAllCategories(ctx.user.id);
    
    // Analyze last month vs previous month
    const now = new Date();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0);

    const lastMonthExpenses = transactions.filter(t => 
      t.type === "expense" &&
      new Date(t.createdDate) >= lastMonthStart &&
      new Date(t.createdDate) <= lastMonthEnd
    );

    const prevMonthExpenses = transactions.filter(t =>
      t.type === "expense" &&
      new Date(t.createdDate) >= prevMonthStart &&
      new Date(t.createdDate) <= prevMonthEnd
    );

    const lastMonthTotal = lastMonthExpenses.reduce((sum, t) => sum + t.amount, 0);
    const prevMonthTotal = prevMonthExpenses.reduce((sum, t) => sum + t.amount, 0);
    const increase = lastMonthTotal - prevMonthTotal;
    const percentIncrease = prevMonthTotal > 0 ? (increase / prevMonthTotal) * 100 : 0;

    const insights: any[] = [];

    // Alert if spending increased significantly
    if (percentIncrease > 20) {
      const insight = await db.createAIInsight({
        userId: ctx.user.id,
        type: "alert",
        title: "⚠️ Spending Increased",
        message: `Your spending increased by ${percentIncrease.toFixed(1)}% last month ($${(increase / 100).toFixed(2)} more than previous month). Review your expenses to stay on track.`,
        priority: 8,
        isRead: false,
      });
      insights.push(insight);
    }

    // Check for unusual category spending
    for (const category of categories) {
      const lastMonthCat = lastMonthExpenses
        .filter(t => t.categoryId === category.id)
        .reduce((sum, t) => sum + t.amount, 0);
      
      const prevMonthCat = prevMonthExpenses
        .filter(t => t.categoryId === category.id)
        .reduce((sum, t) => sum + t.amount, 0);

      if (prevMonthCat > 0) {
        const catIncrease = ((lastMonthCat - prevMonthCat) / prevMonthCat) * 100;
        
        if (catIncrease > 50 && lastMonthCat > 5000) { // $50+ and 50% increase
          const insight = await db.createAIInsight({
            userId: ctx.user.id,
            type: "alert",
            title: `📊 ${category.emoji} ${category.name} Spike`,
            message: `${category.name} spending up ${catIncrease.toFixed(0)}% ($${(lastMonthCat / 100).toFixed(2)} vs $${(prevMonthCat / 100).toFixed(2)}). Is this intentional?`,
            priority: 6,
            isRead: false,
          });
          insights.push(insight);
        }
      }
    }

    return insights;
  }),

  // Generate achievement insights
  generateAchievements: protectedProcedure.mutation(async ({ ctx }) => {
    const goals = await db.getGoalsByUserId(ctx.user.id);
    const insights: any[] = [];

    for (const goal of goals) {
      const progress = (goal.currentAmount / goal.targetAmount) * 100;

      // Milestones: 25%, 50%, 75%, 100%
      const milestones = [25, 50, 75, 100];
      
      for (const milestone of milestones) {
        if (progress >= milestone && progress < milestone + 5) {
          const emoji = milestone === 100 ? "🎉" : milestone === 75 ? "🔥" : milestone === 50 ? "⭐" : "🎯";
          
          const insight = await db.createAIInsight({
            userId: ctx.user.id,
            type: "achievement",
            title: `${emoji} ${milestone}% Milestone!`,
            message: `Congratulations! You've reached ${milestone}% of your "${goal.name}" goal ($${(goal.currentAmount / 100).toFixed(2)} / $${(goal.targetAmount / 100).toFixed(2)}). ${milestone === 100 ? "Goal complete!" : "Keep going!"}`,
            priority: 9,
            isRead: false,
          });
          
          insights.push(insight);
        }
      }
    }

    return insights;
  }),
});
