import { protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";
import { convertCurrency } from "./_core/currency";
import { getProfiles, getBalances } from "./_core/wise";
import { searchWeb, formatSearchResults, getCurrentExchangeRate } from "./_core/webSearch";

/**
 * Detect language from user message using character frequency analysis and linguistic patterns
 * Much more robust than keyword matching - analyzes linguistic fingerprints
 */
function detectLanguage(message: string): "en" | "pt" | "es" {
  const text = message.toLowerCase();
  
  // Portuguese-specific patterns (weighted scoring)
  const ptScore = 
    (text.match(/[ãõç]/g) || []).length * 5 +  // Strong PT indicators (ã, õ, ç)
    (text.match(/ê|â|ô|á|é|í|ó|ú/g) || []).length * 2 +  // Common accents in PT
    (text.match(/\bque\b/g) || []).length * 3 +  // "que" extremely common in PT
    (text.match(/\b(de|da|do|dos|das|para|pra|com|sem|está|como|não|sim|por|qual|quando|onde|quem|seu|sua|meu|minha|esse|essa|isto|isso)\b/g) || []).length * 2;
  
  // Spanish-specific patterns
  const esScore = 
    (text.match(/[ñ¿¡]/g) || []).length * 5 +  // Strong ES indicators (ñ, ¿, ¡)
    (text.match(/\b(el|la|los|las|un|una|para|con|sin|está|cómo|cuál|cuándo|dónde|quién|su|mi|ese|esa|esto|eso)\b/g) || []).length * 2 +
    (text.match(/ción\b/g) || []).length * 3;  // Common ES ending
  
  // English patterns
  const enScore = 
    (text.match(/\b(the|is|are|was|were|what|when|where|who|why|how|can|could|would|should|will|this|that|these|those)\b/g) || []).length * 2 +
    (text.match(/ing\b/g) || []).length * 2 +  // -ing ending very common in EN
    (text.match(/\b(a|an|and|or|but|of|in|on|at|to|for|with)\b/g) || []).length;  // Common EN words
  
  // Log scores for debugging
  console.log(`[Language Detection] Scores - PT: ${ptScore}, ES: ${esScore}, EN: ${enScore} | Message: "${message}"`);
  
  // Determine language based on highest score
  const maxScore = Math.max(ptScore, esScore, enScore);
  
  if (maxScore === 0) {
    // No clear indicators - default to PT (most likely for this app's users)
    console.log(`[Language Detection] No indicators found, defaulting to PT`);
    return "pt";
  }
  
  if (ptScore === maxScore) return "pt";
  if (esScore === maxScore) return "es";
  return "en";
}

/**
 * Define conversation flows with their steps
 */
const CONVERSATION_FLOWS = {
  create_goal: {
    name: "Create Savings Goal",
    steps: [
      { step: 1, question: "What would you like to save for? (e.g., vacation, emergency fund, new car)" },
      { step: 2, question: "How much money do you need to save for this goal?" },
      { step: 3, question: "When do you want to achieve this goal? (e.g., in 6 months, by December 2025)" },
    ],
    finalAction: "create_goal_action",
  },
  budget_review: {
    name: "Monthly Budget Review",
    steps: [
      { step: 1, question: "Let me analyze your spending. What's your biggest concern right now?" },
      { step: 2, question: "Which expense category would you like to focus on reducing?" },
      { step: 3, question: "What's a realistic monthly budget for this category?" },
    ],
    finalAction: "budget_review_summary",
  },
  savings_plan: {
    name: "Personalized Savings Plan",
    steps: [
      { step: 1, question: "What's your main motivation for saving right now?" },
      { step: 2, question: "How much can you comfortably save each month without sacrificing essentials?" },
      { step: 3, question: "Are you willing to cut any specific expenses to boost your savings?" },
    ],
    finalAction: "savings_plan_summary",
  },
};

type FlowType = keyof typeof CONVERSATION_FLOWS;

/**
 * Detect if user wants to start a conversation flow
 */
function detectFlowIntent(message: string): FlowType | null {
  const lowerMessage = message.toLowerCase();
  
  // Create goal patterns
  if (/(criar|create|start|começar|empezar).*(meta|goal|objetivo)/i.test(message) ||
      /(quero|want|need|preciso|necesito).*(economizar|save|poupar|ahorrar)/i.test(message)) {
    return "create_goal";
  }
  
  // Budget review patterns
  if (/(revisar|review|analisar|analyze|analizar).*(orçamento|budget|gastos|expenses|despesas)/i.test(message) ||
      /onde (estou|tô|to) gastando/i.test(message) ||
      /where (am i|i'm) spending/i.test(message)) {
    return "budget_review";
  }
  
  // Savings plan patterns
  if (/(plano|plan).*(poupança|savings|ahorro)/i.test(message) ||
      /(plano|plan).*(economizar|save|poupar|ahorrar)/i.test(message) ||
      /(como|how).*(economizar mais|save more|poupar mais|ahorrar más)/i.test(message)) {
    return "savings_plan";
  }
  
  return null;
}

/**
 * Get the next step in a conversation flow
 */
function getNextFlowStep(flowType: FlowType, currentStep: number | null): { step: number; question: string } | null {
  const flow = CONVERSATION_FLOWS[flowType];
  const nextStep = (currentStep || 0) + 1;
  
  const stepData = flow.steps.find(s => s.step === nextStep);
  return stepData || null;
}

/**
 * Extract key facts from a conversation for memory
 * Returns array of memory strings to append
 */
function extractMemoriesFromMessage(userMessage: string, aiResponse: string): string[] {
  const memories: string[] = [];
  
  // Pattern: User mentions a goal or aspiration
  const goalPatterns = [
    /(?:quero|want to|planning to|planejo|planeo)\s+(?:comprar|buy|purchase|adquirir)\s+([a-zA-Z\sÀ-ÿ]+)/i,
    /(?:quero|want to|need to|preciso|necesito)\s+(?:economizar|save|juntar|ahorrar)\s+(?:para|for|to)\s+([a-zA-Z\sÀ-ÿ]+)/i,
    /my goal is (?:to\s+)?([a-zA-Z\sÀ-ÿ]+)/i,
    /minha meta (?:é|e)\s+([a-zA-Z\sÀ-ÿ]+)/i,
  ];
  
  for (const pattern of goalPatterns) {
    const match = userMessage.match(pattern);
    if (match && match[1] && match[1].length < 100) {
      memories.push(`Goal: ${match[1].trim()}`);
    }
  }
  
  // Pattern: Travel/vacation plans
  const travelPatterns = [
    /(?:viajar|travel|ir|go|want to go|quero ir)\s+(?:para|pra|to|a|no|na)\s+([a-zA-Z][a-zA-Z\sÀ-ÿ]+?)(?:\s+em|\s+in|\s+no|\s+na)?(?:\s+(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|january|february|march|april|may|june|july|august|september|october|november|december|\d{4}))?/i,
    /(?:trip to|viagem para|viaje a)\s+([a-zA-Z][a-zA-Z\sÀ-ÿ]+)/i,
    /(?:quero ir|want to go)\s+(?:no|na|ao|em|to)?\s+([a-z][a-z\sÀ-ÿ0-9]+)/i,  // Accepts lowercase like "lollapalooza"
  ];
  
  for (const pattern of travelPatterns) {
    const match = userMessage.match(pattern);
    if (match && match[1]) {
      const destination = match[1].trim();
      const when = match[2] ? ` (${match[2]})` : '';
      // Only save if destination is meaningful (not common words)
      if (destination.length > 3 && !/^(para|pra|the|uma|one)$/i.test(destination)) {
        memories.push(`Plans to travel to ${destination}${when}`);
      }
    }
  }
  
  // Pattern: User mentions preferences (restaurants, hobbies, etc.)
  const preferencePatterns = [
    /(?:i prefer|prefiro|prefiero)\s+([a-zA-Z\sÀ-ÿ]+)/i,
    /(?:i like|gosto de|me gusta)\s+(?:to\s+)?([a-zA-Z\sÀ-ÿ]+)/i,
    /(?:adoro|love|amo)\s+([a-zA-Z\sÀ-ÿ]+)/i,
  ];
  
  for (const pattern of preferencePatterns) {
    const match = userMessage.match(pattern);
    if (match && match[1] && match[1].length < 80) {
      memories.push(`Preference: ${match[1].trim()}`);
    }
  }
  
  // Pattern: Major purchases mentioned
  const purchasePatterns = [
    /(?:comprar|buy|purchase|adquirir)\s+(?:um|uma|a|an)\s+([a-zA-Z\sÀ-ÿ]+?)(?:\s+por|\s+for|\s+de)?\s*\$?(\d+)/i,
    /(?:trocar|change|upgrade|atualizar)\s+(?:de|o|a)?\s+([a-zA-Z\sÀ-ÿ]+)/i,
  ];
  
  for (const pattern of purchasePatterns) {
    const match = userMessage.match(pattern);
    if (match && match[1]) {
      const item = match[1].trim();
      const price = match[2] ? ` (~$${match[2]})` : '';
      memories.push(`Plans to buy: ${item}${price}`);
    }
  }
  
  // Pattern: Family/personal context
  if (/\b(family|familia|família|kids|children|filhos|hijos)\b/i.test(userMessage)) {
    memories.push(`Has family (mentioned in conversation)`);
  }
  
  if (/\b(spouse|cônjuge|cónyuge|wife|husband|esposa|esposo|namorad[ao]|boyfriend|girlfriend)\b/i.test(userMessage)) {
    memories.push(`Has partner/spouse (mentioned in conversation)`);
  }
  
  // Pattern: Job/career changes
  if (/\b(new job|novo emprego|nuevo trabajo|changing jobs|mudando de emprego|promotion|promoção)\b/i.test(userMessage)) {
    memories.push(`Career change or new job mentioned`);
  }
  
  // Pattern: Housing plans
  if (/\b(buy(?:ing)? (?:a |an )?house|comprar casa|apartment|apartamento|moving|mudança|mudar de casa)\b/i.test(userMessage)) {
    memories.push(`Housing plans mentioned (buying/moving)`);
  }
  
  return memories;
}

/**
 * Get system prompt in the appropriate language
 */
function getSystemPrompt(language: "en" | "pt" | "es"): string {
  const prompts = {
    en: `You are an expert AI Financial Advisor integrated into MoneyGoal, a personal finance app. Your role is to help users make informed financial decisions, track their goals, manage their spending, and improve their financial health.`,
    pt: `Você é um Consultor Financeiro de IA especializado integrado ao MoneyGoal, um aplicativo de finanças pessoais. Seu papel é ajudar os usuários a tomar decisões financeiras informadas, acompanhar suas metas, gerenciar seus gastos e melhorar sua saúde financeira.`,
    es: `Eres un Asesor Financiero de IA experto integrado en MoneyGoal, una aplicación de finanzas personales. Tu función es ayudar a los usuarios a tomar decisiones financieras informadas, realizar un seguimiento de sus objetivos, gestionar sus gastos y mejorar su salud financiera.`
  };
  
  return prompts[language];
}

// Build comprehensive financial context for the AI
async function buildUserFinancialContext(userId: string, userName?: string | null) {
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
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Calculate financial metrics
  const recentTransactions = transactions.filter((t: any) => new Date(t.createdDate) >= sixMonthsAgo);
  
  const monthsCount = Math.min(6, Math.ceil((now.getTime() - sixMonthsAgo.getTime()) / (1000 * 60 * 60 * 24 * 30)));
  
  // Detect salary from Artix Entertainment LLC income transactions
  const artixIncomeTransactions = recentTransactions.filter((t: any) => 
    t.type === "income" && 
    t.reason && 
    t.reason.toLowerCase().includes("artix entertainment")
  );
  
  const hasSalary = artixIncomeTransactions.length > 0;
  const totalSalaryIncome = artixIncomeTransactions.reduce((sum: number, t: any) => sum + t.amount, 0);
  const avgMonthlySalary = hasSalary && monthsCount > 0 ? Math.round(totalSalaryIncome / monthsCount) : 0;
  
  // Get user's preferred currency from settings
  const preferredCurrency = settings?.currency || "USD";
  console.log(`[Financial Context] Using currency: ${preferredCurrency} from user settings`);
  
  // Convert all transactions to preferred currency before summing
  const incomePromises = recentTransactions
    .filter((t: any) => t.type === "income")
    .map(async (t: any) => {
      const converted = await convertCurrency(
        t.amount,
        t.currency || "USD",
        preferredCurrency,
        t.exchangeRate
      );
      return converted;
    });
  
  const expensePromises = recentTransactions
    .filter((t: any) => t.type === "expense")
    .map(async (t: any) => {
      const converted = await convertCurrency(
        t.amount,
        t.currency || "USD",
        preferredCurrency,
        t.exchangeRate
      );
      return converted;
    });
  
  const incomeAmounts = await Promise.all(incomePromises);
  const expenseAmounts = await Promise.all(expensePromises);
  
  const income = incomeAmounts.reduce((sum: number, amount: number) => sum + amount, 0);
  const expenses = expenseAmounts.reduce((sum: number, amount: number) => sum + amount, 0);

  const avgMonthlyIncome = monthsCount > 0 ? Math.round(income / monthsCount) : 0;
  const avgMonthlyExpenses = monthsCount > 0 ? Math.round(expenses / monthsCount) : 0;
  const avgMonthlySavings = avgMonthlyIncome - avgMonthlyExpenses;
  const savingsRate = avgMonthlyIncome > 0 ? Math.round((avgMonthlySavings / avgMonthlyIncome) * 100) : 0;

  // Debug logging to understand the values
  console.log('[AI Chat Context] Financial calculations:', {
    preferredCurrency,
    monthsCount,
    recentTransactionsCount: recentTransactions.length,
    incomeTransactionsCount: recentTransactions.filter(t => t.type === 'income').length,
    expenseTransactionsCount: recentTransactions.filter(t => t.type === 'expense').length,
    totalIncome: income / 100, // Convert cents to dollars for readability
    totalExpenses: expenses / 100,
    avgMonthlyIncome: avgMonthlyIncome / 100,
    avgMonthlyExpenses: avgMonthlyExpenses / 100,
    avgMonthlySavings: avgMonthlySavings / 100,
    savingsRate: `${savingsRate}%`,
  });

  // Active goal
  const activeGoal = goals.find((g: any) => g.status === "active");

  // Format currency helper (defined early to be used throughout)
  const formatMoney = (cents: number) => {
    const currency = settings?.currency || "USD";
    const symbol = currency === "BRL" ? "R$" : currency === "EUR" ? "€" : "$";
    return `${symbol}${(cents / 100).toFixed(2)}`;
  };

  // Category breakdown (top 5) - WITH CURRENCY CONVERSION
  const categorySpendingMap = new Map<number, number>();
  
  // Convert each transaction to preferred currency before categorizing
  for (const t of recentTransactions.filter((t: any) => t.type === "expense" && t.categoryId)) {
    const converted = await convertCurrency(
      t.amount,
      t.currency || "USD",
      preferredCurrency,
      t.exchangeRate
    );
    const current = categorySpendingMap.get(t.categoryId!) || 0;
    categorySpendingMap.set(t.categoryId!, current + converted);
  }

  const topCategories = Array.from(categorySpendingMap.entries())
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

  // Debug log top categories with actual values
  console.log('[AI Chat Context] Top spending categories:', 
    topCategories.map(c => `${c.emoji} ${c.name}: ${formatMoney(c.total)} total, ${formatMoney(c.avgMonthly)}/month`)
  );

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

  // Parse chat memories from settings
  const memories: string[] = settings?.chatMemory ? JSON.parse(settings.chatMemory) : [];

  // Get user's monthly savings target
  const monthlySavingTarget = settings?.monthlySavingTarget || 0;

  // Get Wise balance if API token is available
  let wiseBalance = 0;
  if (settings?.wiseApiToken) {
    try {
      const profiles = await getProfiles(settings.wiseApiToken);
      if (profiles.length > 0) {
        const balances = await getBalances(settings.wiseApiToken, profiles[0].id);
        // Sum all balances, converting to preferred currency
        for (const balance of balances) {
          if (balance.balanceType === 'STANDARD') {
            const amountInCents = Math.round(balance.amount.value * 100);
            const converted = await convertCurrency(
              amountInCents,
              balance.currency,
              preferredCurrency
            );
            wiseBalance += converted;
          }
        }
      }
    } catch (error) {
      console.error('[Wise API] Failed to fetch balance:', error);
      // Continue without Wise balance if API fails
    }
  }

  // Create simplified context WITHOUT raw cent values to prevent AI confusion
  const simplifiedContext = {
    // User info
    userName: userName || null,
    
    // Overview
    currentDate: now.toISOString().split('T')[0],
    currency: settings?.currency || "USD",
    
    // Balances
    currentBalance: formatMoney(currentBalance),
    wiseBalance: wiseBalance > 0 ? formatMoney(wiseBalance) : null,
    totalSavingsInGoalAndWise: wiseBalance > 0 ? formatMoney(currentBalance + wiseBalance) : formatMoney(currentBalance),
    
    // Memories (context from previous conversations)
    memories,
    
    // Financial Summary (last 6 months)
    totalIncome: formatMoney(income),
    totalExpenses: formatMoney(expenses),
    totalSavingsLast6Months: formatMoney(avgMonthlySavings * monthsCount),
    avgMonthlyIncome: formatMoney(avgMonthlyIncome),
    avgMonthlyExpenses: formatMoney(avgMonthlyExpenses),
    avgMonthlySavings: formatMoney(avgMonthlySavings),
    avgMonthlySavingsRaw: avgMonthlySavings,
    savingsRate: `${savingsRate}%`,
    savingsRateRaw: savingsRate,
    
    // User's Savings Goal
    monthlySavingTarget: monthlySavingTarget > 0 ? formatMoney(monthlySavingTarget) : null,
    savingsTargetSet: monthlySavingTarget > 0,
    currentVsTarget: monthlySavingTarget > 0 ? {
      target: formatMoney(monthlySavingTarget),
      actual: formatMoney(avgMonthlySavings),
      difference: formatMoney(avgMonthlySavings - monthlySavingTarget),
      percentageOfTarget: Math.round((avgMonthlySavings / monthlySavingTarget) * 100),
    } : null,
    
    // Active Goal
    activeGoal: activeGoal ? {
      name: activeGoal.name,
      target: formatMoney(activeGoal.targetAmount),
      current: formatMoney(activeGoal.currentAmount),
      remaining: formatMoney(activeGoal.targetAmount - activeGoal.currentAmount),
      progress: Math.round((activeGoal.currentAmount / activeGoal.targetAmount) * 100),
      monthsToGoal: avgMonthlySavings > 0 ? 
        Math.ceil((activeGoal.targetAmount - activeGoal.currentAmount) / avgMonthlySavings) : null,
    } : null,
    
    // Spending Patterns - FORMATTED VALUES ONLY
    topCategories: topCategories.map(cat => ({
      name: cat.name,
      emoji: cat.emoji,
      avgMonthly: formatMoney(cat.avgMonthly),
      total: formatMoney(cat.total),
    })),
    
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
    
    // Transaction count
    totalTransactions: transactions.length,
    recentTransactionsCount: recentTransactions.length,
    
    // Salary information (Artix Entertainment LLC)
    hasSalary,
    avgMonthlySalary: hasSalary ? formatMoney(avgMonthlySalary) : null,
    salarySource: hasSalary ? "Artix Entertainment LLC" : null,
    salaryTransactionsCount: artixIncomeTransactions.length,
    
    // Date context
    currentMonth,
    currentYear,
  };

  return simplifiedContext;
}

export const chatRouter = router({
  // Get personalized welcome message with insights
  getWelcomeInsights: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const userName = ctx.user.name;
    const financialContext = await buildUserFinancialContext(userId, userName);
    
    const insights: string[] = [];
    
    // Analyze recent activity
    if (financialContext.avgMonthlySavingsRaw > 0) {
      insights.push(`💰 You're saving an average of ${financialContext.avgMonthlySavings}/month`);
    }
    
    // Check goal progress
    if (financialContext.activeGoal) {
      const progress = financialContext.activeGoal.progress;
      if (progress >= 90) {
        insights.push(`🎉 You're ${progress}% there with your ${financialContext.activeGoal.name}!`);
      } else if (progress >= 50) {
        insights.push(`📈 Your ${financialContext.activeGoal.name} is ${progress}% complete`);
      } else if (financialContext.activeGoal.monthsToGoal) {
        insights.push(`🎯 ${financialContext.activeGoal.monthsToGoal} months to reach your ${financialContext.activeGoal.name}`);
      }
    }
    
    // Savings rate insights
    if (financialContext.savingsRateRaw >= 40) {
      insights.push(`⭐ Excellent ${financialContext.savingsRate} savings rate!`);
    } else if (financialContext.savingsRateRaw < 10) {
      insights.push(`⚠️ Your savings rate is low (${financialContext.savingsRate})`);
    }
    
    // Top spending category
    if (financialContext.topCategories.length > 0) {
      const top = financialContext.topCategories[0];
      insights.push(`📊 Top expense: ${top.emoji} ${top.name} (${top.avgMonthly}/mo)`);
    }
    
    return {
      insights: insights.slice(0, 4), // Max 4 insights
      userName: ctx.user.name || "there",
    };
    
    function formatMoney(cents: number) {
      const currency = financialContext.currency || "USD";
      const symbol = currency === "BRL" ? "R$" : currency === "EUR" ? "€" : "$";
      return `${symbol}${(cents / 100).toFixed(2)}`;
    }
  }),

  // Get suggested prompts based on user's financial situation
  getSuggestedPrompts: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const userName = ctx.user.name;
    const financialContext = await buildUserFinancialContext(userId, userName);
    
    const prompts: string[] = [];
    
    // Always available prompts
    prompts.push("Analyze my financial health");
    prompts.push("How can I save more money?");
    
    // Goal-specific prompts
    if (financialContext.activeGoal) {
      prompts.push(`Am I on track to reach my ${financialContext.activeGoal.name}?`);
      if (financialContext.activeGoal.monthsToGoal) {
        prompts.push(`How can I reach my goal faster?`);
      }
    } else {
      prompts.push("Help me set a financial goal");
    }
    
    // Spending-related prompts
    if (financialContext.topCategories.length > 0) {
      const topCategory = financialContext.topCategories[0];
      prompts.push(`Is my spending on ${topCategory.name} normal?`);
    }
    
    // Recurring expenses prompts
    if (financialContext.recurringExpenses.length > 0) {
      prompts.push("Should I cancel any subscriptions?");
    }
    
    // Savings rate prompts
    if (financialContext.savingsRateRaw < 20) {
      prompts.push("Why is my savings rate low?");
    } else if (financialContext.savingsRateRaw > 40) {
      prompts.push("Am I saving too much?");
    }
    
    return prompts.slice(0, 6); // Return max 6 prompts
  }),

  // Send a message to the AI advisor
  sendMessage: protectedProcedure
    .input(z.object({
      message: z.string().min(1).max(1000),
      conversationId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const userName = ctx.user.name;

      // Rate limiting: Check message count in last 24 hours
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new Error("Database not available");
      
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentMessages = await db.getChatMessagesByUserId(userId);
      const userMessagesLast24h = recentMessages.filter(
        (msg: any) => msg.role === "user" && new Date(msg.createdDate) >= oneDayAgo
      );
      
      if (userMessagesLast24h.length >= 50) {
        throw new Error("Rate limit exceeded. Please try again in 24 hours. (Max 50 messages/day)");
      }

      // Build financial context
      const financialContext = await buildUserFinancialContext(userId, userName);

      // Get conversation history (last 10 messages)
      const history = await db.getChatMessagesByUserId(userId);
      const recentHistory = history.slice(-10);

      // Check if user is in an active conversation flow
      const lastUserMessage = recentHistory.filter(m => m.role === "user").slice(-1)[0];
      const currentFlow = lastUserMessage?.conversationFlow as FlowType | null;
      const currentStep = lastUserMessage?.flowStep || null;

      // Detect if user wants to start a new flow
      const detectedFlow = detectFlowIntent(input.message);

      let conversationFlow: FlowType | null = null;
      let flowStep: number | null = null;
      let isFlowResponse = false;

      // Handle conversation flows
      if (detectedFlow && !currentFlow) {
        // Start new flow
        conversationFlow = detectedFlow;
        flowStep = 1;
        isFlowResponse = true;
      } else if (currentFlow && currentStep) {
        // Continue existing flow
        conversationFlow = currentFlow;
        const nextStep = getNextFlowStep(currentFlow, currentStep);
        
        if (nextStep) {
          flowStep = nextStep.step;
          isFlowResponse = true;
        } else {
          // Flow completed - no more steps
          conversationFlow = null;
          flowStep = null;
        }
      }

      // Detect language from user's message AND recent history
      const recentUserMessages = recentHistory
        .filter(m => m.role === "user")
        .slice(-3)  // Last 3 user messages
        .map(m => m.content)
        .join(" ");
      
      const textToAnalyze = input.message + " " + recentUserMessages;
      const detectedLanguage = detectLanguage(textToAnalyze);
      
      console.log(`[Chat] Detected language: ${detectedLanguage} from message: "${input.message}"`);

      // Build system prompt with context
      const baseSystemPrompt = getSystemPrompt(detectedLanguage);
      
      const languageInstructions = {
        en: "You MUST respond ENTIRELY in English. Every single word must be in English. Do not mix languages.",
        pt: "Você DEVE responder COMPLETAMENTE em Português do Brasil. Cada palavra da resposta DEVE estar em Português. NÃO misture inglês.",
        es: "Debes responder COMPLETAMENTE en Español. Cada palabra debe estar en Español. NO mezcles inglés."
      };
      
      // Add flow context to system prompt if in a flow
      let flowContext = "";
      if (isFlowResponse && conversationFlow && flowStep) {
        const flow = CONVERSATION_FLOWS[conversationFlow];
        const stepData = flow.steps.find(s => s.step === flowStep);
        
        flowContext = `

ACTIVE CONVERSATION FLOW: ${flow.name}
Current Step: ${flowStep} of ${flow.steps.length}
Next Question: ${stepData?.question}

You are guiding the user through a multi-step conversation. Ask the next question clearly and wait for their response. Keep it brief and focused.`;
      }
      
      const systemPrompt = `🌍 **INSTRUÇÕES DE IDIOMA - MÁXIMA PRIORIDADE**:
**IDIOMA DETECTADO DO USUÁRIO**: ${detectedLanguage === 'pt' ? 'PORTUGUÊS (PT-BR)' : detectedLanguage === 'es' ? 'ESPAÑOL (ES)' : 'ENGLISH (EN)'}
**SEU IDIOMA DE RESPOSTA**: ${detectedLanguage === 'pt' ? 'PORTUGUÊS' : detectedLanguage === 'es' ? 'ESPAÑOL' : 'ENGLISH'}

${languageInstructions[detectedLanguage]}

⚠️ **REGRA ABSOLUTA**: Sua resposta INTEIRA deve ser em ${detectedLanguage === 'pt' ? 'Português do Brasil' : detectedLanguage === 'es' ? 'Español' : 'English'}.
⚠️ **NUNCA** use inglês se o usuário está falando português ou espanhol.
⚠️ **NUNCA** misture idiomas na mesma resposta.

${baseSystemPrompt}

📅 **CURRENT DATE**: November 27, 2025
⚠️ **CRITICAL DATE CALCULATION RULES**:

When the user mentions a month and year in the future (e.g., "June 2026" or "March 2026"):
1. Count from the NEXT MONTH (December 2025) to the target month
2. Examples:
   - June 2026 from December 2025 = Count: Dec, Jan, Feb, Mar, Apr, May, Jun = 7 months
   - March 2026 from December 2025 = Count: Dec, Jan, Feb, Mar = 4 months
   - Lollapalooza (March 2026) from December 2025 = 4 months
3. ALWAYS show your math: "From December 2025 to June 2026: December, January, February, March, April, May, June = 7 months"
4. NEVER say "19 months" or "16 months" - count carefully!

YOUR ROLE & PERSONALITY:
- You are Moni, ${financialContext.userName ? financialContext.userName + "'s" : "the user's"} personal financial manager and advisor
- Talk naturally like a helpful friend who cares about their financial success
- **DO NOT start every response with a greeting or the user's name** - only use it naturally when it fits the conversation
- Use the user's name sparingly: only for first greeting, after long breaks, or when being emphatic
- Provide realistic, data-driven financial advice based on ACTUAL user data
- Be honest and transparent about what's achievable
- Suggest specific, actionable steps with numbers and timelines
- Consider income, expenses, savings rate, and financial goals
- Prioritize financial health and realistic planning

💰 **MOEDA/CURRENCY RULE - ABSOLUTE PRIORITY**:
- User's preferred currency (from settings): **${financialContext.currency}**
- **YOU MUST USE ${financialContext.currency} IN EVERY SINGLE AMOUNT YOU MENTION**
- Currency symbols: USD = $, BRL = R$, EUR = €, GBP = £
- ALL financial data below is ALREADY CONVERTED to ${financialContext.currency}
- DO NOT convert or recalculate - values are ready to use
- Examples:
  * If currency is BRL: use "R$1.000" NOT "$1000"
  * If currency is USD: use "$1,000" NOT "R$5000"
  * If currency is EUR: use "€1.000" NOT "$1000"
- **NEVER use a different currency symbol than ${financialContext.currency}**

💬 **CONVERSATION HISTORY AWARENESS**:
- You have access to recent conversation history
- **NEVER repeat the full financial summary (TOTAIS, MÉDIAS MENSAIS, META DE POUPANÇA) if you already showed it in the last 3 messages**
- If you already shared financial data, reference it briefly: "Como vimos, você economiza $13.33/mês..."
- Only show the FULL financial summary if:
  * User explicitly asks: "mostre minhas finanças", "resumo financeiro", "analise completa"
  * It's the first message of a new conversation
  * More than 5 messages have passed since last summary
- For follow-up questions about travel/goals, focus ONLY on the new calculation
- Be conversational - build on what you've discussed, don't start from zero each time

🧠 **LEARNING ABOUT THE USER**:
- Pay attention to personal details the user shares (dreams, goals, preferences, plans)
- Examples: "Quero viajar para Paris em Junho de 2026", "Gosto de comer em restaurantes japoneses", "Planejo trocar de carro ano que vem"
- These details will be saved automatically and used in future conversations
- Use this knowledge to personalize advice and show you remember what matters to them
- When relevant, reference things they've mentioned before: "Considerando sua viagem para Paris..."
${financialContext.memories.length > 0 ? `
📝 **THINGS YOU ALREADY KNOW ABOUT THIS USER**:
${financialContext.memories.map((m: string, i: number) => `${i + 1}. ${m}`).join('\n')}

Use this context to personalize your responses and show continuity in the relationship.` : ''}

👋 **GREETING PROTOCOL**:
- **ONLY use the user's name in greetings if:**
  * It's the first message of a new conversation
  * User just said "hi"/"oi"/"hello" without context
  * You haven't greeted them in the last 5 messages
- For follow-up questions, jump straight to the answer - NO greetings
- Natural greeting examples:
  * First time: "${detectedLanguage === 'pt' ? `Oi${financialContext.userName ? `, ${financialContext.userName}` : ''}! Eu sou a Moni` : detectedLanguage === 'es' ? `¡Hola${financialContext.userName ? `, ${financialContext.userName}` : ''}! Soy Moni` : `Hi${financialContext.userName ? `, ${financialContext.userName}` : ''}! I'm Moni`}"
  * Follow-up: Start directly - "${detectedLanguage === 'pt' ? 'Vamos ver' : detectedLanguage === 'es' ? 'Veamos' : "Let's see"}..."
${flowContext}

🌍 **LEMBRETE FINAL DE IDIOMA**:
Responda TODA sua mensagem em ${detectedLanguage === 'pt' ? 'PORTUGUÊS' : detectedLanguage === 'es' ? 'ESPAÑOL' : 'ENGLISH'}.
NÃO use inglês se o usuário falou português. NÃO misture idiomas.

CURRENT USER FINANCIAL PROFILE:

ℹ️ **WHEN TO SHOW FINANCIAL SUMMARY**:
- Only show if: user asks for overview/resumo/análise OR it's relevant to their question
- Don't repeat summaries you've shown in recent messages
- If already discussed, reference it: "Como vimos, você está economizando $13.33/mês..."

📊 **${detectedLanguage === 'pt' ? 'Resumo Financeiro Disponível (Últimos 6 meses)' : detectedLanguage === 'es' ? 'Resumen Financiero Disponible (Últimos 6 meses)' : 'Available Financial Summary (Last 6 months)'}:**

**${detectedLanguage === 'pt' ? 'TOTAIS' : detectedLanguage === 'es' ? 'TOTALES' : 'TOTALS'} (${detectedLanguage === 'pt' ? 'últimos 6 meses' : detectedLanguage === 'es' ? 'últimos 6 meses' : 'last 6 months'}):**
- ${detectedLanguage === 'pt' ? 'Receita Total' : detectedLanguage === 'es' ? 'Ingresos Totales' : 'Total Income'}: ${financialContext.totalIncome}
- ${detectedLanguage === 'pt' ? 'Despesas Totais' : detectedLanguage === 'es' ? 'Gastos Totales' : 'Total Expenses'}: ${financialContext.totalExpenses}
- ${detectedLanguage === 'pt' ? 'Poupança Total' : detectedLanguage === 'es' ? 'Ahorros Totales' : 'Total Savings'}: ${financialContext.totalSavingsLast6Months}

**${detectedLanguage === 'pt' ? 'MÉDIAS MENSAIS' : detectedLanguage === 'es' ? 'PROMEDIOS MENSUALES' : 'MONTHLY AVERAGES'}:**
- ${detectedLanguage === 'pt' ? 'Receita Média' : detectedLanguage === 'es' ? 'Ingreso Promedio' : 'Avg Income'}: ${financialContext.avgMonthlyIncome}
- ${detectedLanguage === 'pt' ? 'Despesas Médias' : detectedLanguage === 'es' ? 'Gastos Promedio' : 'Avg Expenses'}: ${financialContext.avgMonthlyExpenses}
- ${detectedLanguage === 'pt' ? 'Poupança Média' : detectedLanguage === 'es' ? 'Ahorros Promedio' : 'Avg Savings'}: ${financialContext.avgMonthlySavings}
- ${detectedLanguage === 'pt' ? 'Taxa de Poupança' : detectedLanguage === 'es' ? 'Tasa de Ahorro' : 'Savings Rate'}: ${financialContext.savingsRate}

${financialContext.savingsTargetSet && financialContext.currentVsTarget ? `
**${detectedLanguage === 'pt' ? '🎯 META DE POUPANÇA MENSAL' : detectedLanguage === 'es' ? '🎯 META DE AHORRO MENSUAL' : '🎯 MONTHLY SAVINGS TARGET'}:**
- ${detectedLanguage === 'pt' ? 'Meta' : detectedLanguage === 'es' ? 'Meta' : 'Target'}: ${financialContext.currentVsTarget.target}
- ${detectedLanguage === 'pt' ? 'Atual' : detectedLanguage === 'es' ? 'Actual' : 'Actual'}: ${financialContext.currentVsTarget.actual}
- ${detectedLanguage === 'pt' ? 'Diferença' : detectedLanguage === 'es' ? 'Diferencia' : 'Difference'}: ${financialContext.currentVsTarget.difference}
- ${detectedLanguage === 'pt' ? 'Progresso' : detectedLanguage === 'es' ? 'Progreso' : 'Progress'}: ${financialContext.currentVsTarget.percentageOfTarget}%

⚠️ **IMPORTANT**: ${detectedLanguage === 'pt' ? 'O usuário definiu uma meta de poupar' : detectedLanguage === 'es' ? 'El usuario estableció una meta de ahorrar' : 'User set a goal to save'} ${financialContext.monthlySavingTarget} ${detectedLanguage === 'pt' ? 'por mês. SEMPRE mencione e compare com esta meta!' : detectedLanguage === 'es' ? 'por mes. ¡Menciona SIEMPRE y compara con esta meta!' : 'per month. ALWAYS mention and compare against this target!'}
` : ''}

⚠️ **QUANDO MOSTRAR O RESUMO FINANCEIRO:**
- ${detectedLanguage === 'pt' ? 'APENAS mostre se o usuário pedir explicitamente: "mostre minhas finanças", "resumo", "análise completa"' : detectedLanguage === 'es' ? 'SOLO muestra si el usuario pide explícitamente: "muestra mis finanzas", "resumen", "análisis completo"' : 'ONLY show if user explicitly asks: "show my finances", "summary", "complete analysis"'}
- ${detectedLanguage === 'pt' ? 'NÃO mostre o resumo completo se o usuário fez uma pergunta específica (ex: "quanto custa ingresso do lollapalooza?")' : detectedLanguage === 'es' ? 'NO muestres el resumen completo si el usuario hizo una pregunta específica (ej: "¿cuánto cuesta entrada de lollapalooza?")' : 'DO NOT show full summary if user asked a specific question (e.g., "how much is lollapalooza ticket?")'}
- ${detectedLanguage === 'pt' ? 'Para perguntas específicas: responda APENAS o que foi perguntado' : detectedLanguage === 'es' ? 'Para preguntas específicas: responde SOLO lo que se preguntó' : 'For specific questions: answer ONLY what was asked'}
- ${detectedLanguage === 'pt' ? 'Use dados financeiros do contexto quando RELEVANTE para a resposta' : detectedLanguage === 'es' ? 'Usa datos financieros del contexto cuando sea RELEVANTE para la respuesta' : 'Use financial data from context when RELEVANT to the answer'}

⚠️ **STRICT RULES:**
1. Answer ONLY what the user asked - don't add unrequested information
2. Financial summary is REFERENCE DATA - use it only when relevant
3. DO NOT recalculate values - use them AS-IS from the summary
4. ALL values are already formatted in the correct currency
5. Maintain consistent language: ${detectedLanguage === 'pt' ? 'PORTUGUÊS' : detectedLanguage === 'es' ? 'ESPAÑOL' : 'ENGLISH'}

SALARY & WORK INFORMATION:
${financialContext.hasSalary ? `✅ User has regular salary from ${financialContext.salarySource}
- Average monthly salary: ${financialContext.avgMonthlySalary}
- ${financialContext.salaryTransactionsCount} salary payments in last 6 months
- This is the user's PRIMARY income source - treat it as stable recurring income
- Other income sources are SECONDARY (bonuses, side projects, etc.)` : `❌ No regular salary detected
- All income appears to be from various sources
- Treat income as variable/unstable`}

RESPONSE FORMAT:
- Start with a brief analysis (1-2 sentences)
- Use **markdown formatting** for better readability:
  * **Bold** for important numbers
  * Tables for comparisons
  * Lists for action items
  * Emojis for visual cues (📊 📈 💰 ✅ ⚠️ 🎯)
- Include inline charts when helpful using this syntax:
  * Line chart: [CHART:line_graph data={"values":[{"label":"Jan","value":800},{"label":"Feb","value":1000}]}]
  * Pie chart: [CHART:pie_chart data=[{"label":"Food","value":500},{"label":"Transport","value":200}]]
  * Progress bar: [CHART:progress_bar data={"label":"Goal Progress","percentage":65,"subtitle":"$3,250 of $5,000"}]
- List 2-4 specific, actionable recommendations
- End with encouragement or next steps
- Keep responses concise (max 400 words)

STRICT VALIDATION RULES (MUST FOLLOW):

🔢 **MATH VALIDATION - COPY VALUES EXACTLY**:
⚠️ **FORBIDDEN:** Do NOT calculate anything! All math is already done.

**THE ONLY CORRECT VALUES ARE:**
- Income: ${financialContext.avgMonthlyIncome}
- Expenses: ${financialContext.avgMonthlyExpenses}
- Savings: ${financialContext.avgMonthlySavings}
- Rate: ${financialContext.savingsRate}

If you show ANY different number (like -320%, $-2928, $914, $3842), you have FAILED.
These are the ONLY valid answers. Memorize them and use them verbatim.

📊 **DATA VALIDATION - USE ONLY PROVIDED DATA**:
The user's ACTUAL spending categories are listed in topCategories array:
${JSON.stringify(financialContext.topCategories, null, 2)}

⚠️ **CRITICAL CATEGORY RULES**:
- The values above are FINAL and CORRECT - do NOT recalculate or invent new values
- ONLY mention categories that appear in the array above with EXACT amounts shown
- Example: If "Other" shows total: "$19.00", you MUST say $19, NOT $711, NOT $3,822, NOT any other number
- DO NOT add up values differently - the totals shown are already calculated correctly
- If you mention a category that's not in the list above, you are INVENTING DATA (forbidden!)
- Copy the EXACT dollar amounts from the array - do not parse, calculate, or modify them

WRONG EXAMPLES (DO NOT DO THIS):
❌ "Other category: $711/month" (when array shows $19.00)
❌ "Your biggest expense is Other at $3,822" (when array shows total: "$19.00")
❌ Mentioning any category not in the topCategories array

CORRECT EXAMPLES:
✅ "Transfer: ${financialContext.topCategories[0]?.avgMonthly || '$0'}/month"
✅ "Other category represents ${financialContext.topCategories.find(c => c.name === 'Other')?.avgMonthly || 'a small amount'} of spending"

🎯 **GOAL CALCULATION VALIDATION**:
When calculating months to reach a goal:
1. FIRST check if savings rate is positive or negative
2. If NEGATIVE → say "Currently spending more than earning - goal impossible without changes"
3. If POSITIVE → calculate: (goal amount - current amount) ÷ avgMonthlySavings
4. ALWAYS show the math: "($5,000 - $100) ÷ $79.99/month = 61.2 months"
5. If result > 24 months, suggest increasing savings or reducing goal

Example validation:
   ❌ WRONG: "Save $200/month for 6 months = $4,894" (6 × $200 = $1,200 NOT $4,894!)
   ✅ CORRECT: "To save $4,894 at $79.99/month would take 61 months (5+ years)"

📈 **CHART FORMAT - EXACT SYNTAX REQUIRED**:
Progress bars MUST be formatted EXACTLY like this (copy-paste this format):

[CHART:progress_bar data={"label":"Goal Progress","percentage":2,"subtitle":"$105 of $5,000"}]

RULES:
- Must be on its OWN line (no text before/after on same line)
- NO line breaks inside the [CHART:...] brackets
- Percentage MUST be a number (not "2%" - just 2)
- Use double quotes for JSON strings
- No trailing commas

💡 **RESPONSE QUALITY CHECKLIST**:
Before sending response, verify:
□ All math shown step-by-step with correct signs (+/-)
□ All categories mentioned exist in topCategories array with correct amounts
□ Progress bar syntax is exact (if used)
□ Savings rate matches sign of avgMonthlySavings (both + or both -)
□ Goal timeline calculations are realistic and shown with work
□ No invented data (categories, amounts, or percentages not in profile)

🎯 **ENDING YOUR RESPONSE**:
ALWAYS end your response by:
- Offering to help further or suggesting a next step
- Asking if the user has questions
- Providing actionable advice they can implement today

Examples:
- "Como posso ajudar você a melhorar suas finanças hoje?"
- "Gostaria de analisar alguma categoria específica?"
- "Quer que eu crie um plano para atingir sua meta de poupança?"

🌐 **WEB SEARCH RESULTS**:
When search results are provided in the user message (marked with 📊 **Resultados da Pesquisa na Web:**):
- Use these results to provide ACCURATE, UP-TO-DATE information
- Cite the sources when mentioning specific prices or facts
- Combine multiple sources to give a realistic range
- Always mention that prices can vary and suggest checking directly

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

      // Detect if user is asking for prices/budgets that need web search
      const needsWebSearch = /\b(quanto custa|custo|pre[çc]o|or[çc]amento|viagem|hotel|passagem|voo|flight|price|cost|budget|how much)\b/i.test(input.message);
      
      // Get current exchange rate if user's currency is not USD
      let currentExchangeRate: string = "";
      if (financialContext.currency !== "USD") {
        const rate = await getCurrentExchangeRate("USD", financialContext.currency);
        if (rate) {
          currentExchangeRate = `\n\n💱 **Taxa de Câmbio Atual:** 1 USD = ${rate.toFixed(2)} ${financialContext.currency} (fonte: pesquisa web em tempo real)`;
        }
      }
      
      // Perform web search if needed
      if (needsWebSearch) {
        console.log("[Chat] Performing web search for:", input.message);
        const searchResults = await searchWeb(input.message);
        
        if (searchResults.length > 0) {
          const formattedResults = formatSearchResults(searchResults);
          // Add search results to the last user message
          messages[messages.length - 1] = {
            role: "user" as const,
            content: `${input.message}${currentExchangeRate}\n\n📊 **Resultados da Pesquisa na Web:**\n${formattedResults}\n\nUse estas informações para fornecer uma resposta precisa e atualizada.`
          };
          console.log("[Chat] Added search results to context");
        }
      } else if (currentExchangeRate) {
        // Add exchange rate even without search
        messages[messages.length - 1] = {
          role: "user" as const,
          content: `${input.message}${currentExchangeRate}`
        };
      }

      // Call LLM
      const response = await invokeLLM({
        messages,
        maxTokens: 1000,
      });

      const assistantMessage = response.choices[0]?.message?.content;
      if (!assistantMessage || typeof assistantMessage !== 'string') {
        throw new Error("Invalid response from AI");
      }

      // Save user message with flow tracking
      await db.createChatMessage({
        userId,
        role: "user",
        content: input.message,
        conversationFlow: conversationFlow || undefined,
        flowStep: flowStep || undefined,
      });

      // Save assistant response with flow tracking
      await db.createChatMessage({
        userId,
        role: "assistant",
        content: assistantMessage,
        conversationFlow: conversationFlow || undefined,
        flowStep: flowStep || undefined,
      });

      // Extract and store memories
      const newMemories = extractMemoriesFromMessage(input.message, assistantMessage);
      if (newMemories.length > 0) {
        const settings = await db.getUserSettings(userId);
        const existingMemories: string[] = settings?.chatMemory ? JSON.parse(settings.chatMemory) : [];
        const updatedMemories = [...existingMemories, ...newMemories].slice(-20); // Keep last 20 memories
        
        await db.updateUserSettings(userId, {
          chatMemory: JSON.stringify(updatedMemories),
        });
      }

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
