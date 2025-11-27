import { protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";
import { convertCurrency } from "./_core/currency";

/**
 * Detect language from user message using simple keyword matching and character patterns
 */
function detectLanguage(message: string): "en" | "pt" | "es" {
  const portugueseKeywords = /\b(olá|oi|obrigad[oa]|como|está|você|voce|porque|por que|quero|posso|preciso|fazer|tenho|meu|minha|sim|não|nao)\b/i;
  const spanishKeywords = /\b(hola|gracias|cómo|como|está|usted|porque|por qué|quiero|puedo|necesito|hacer|tengo|mi|sí|no)\b/i;
  
  // Check for Portuguese-specific characters
  const hasPortugueseChars = /[ãçõê]/i.test(message);
  
  // Check for Spanish-specific characters (excluding those shared with Portuguese)
  const hasSpanishChars = /[ñ¿¡]/i.test(message);
  
  if (portugueseKeywords.test(message) || hasPortugueseChars) {
    return "pt";
  }
  
  if (spanishKeywords.test(message) || hasSpanishChars) {
    return "es";
  }
  
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
    /(?:quero|want to|planning to|planejo|planeo)\s+(?:comprar|buy|purchase|adquirir)\s+([a-zA-Z\s]+)/i,
    /(?:quero|want to|need to|preciso|necesito)\s+(?:economizar|save|juntar|ahorrar)\s+(?:para|for|to)\s+([a-zA-Z\s]+)/i,
    /my goal is (?:to\s+)?([a-zA-Z\s]+)/i,
    /minha meta (?:é|e)\s+([a-zA-Z\s]+)/i,
  ];
  
  for (const pattern of goalPatterns) {
    const match = userMessage.match(pattern);
    if (match && match[1]) {
      memories.push(`User wants to: ${match[1].trim()}`);
    }
  }
  
  // Pattern: User mentions a preference
  const preferencePatterns = [
    /(?:i prefer|prefiro|prefiero)\s+([a-zA-Z\s]+)/i,
    /(?:i like|gosto|me gusta)\s+(?:to\s+)?([a-zA-Z\s]+)/i,
  ];
  
  for (const pattern of preferencePatterns) {
    const match = userMessage.match(pattern);
    if (match && match[1]) {
      memories.push(`User prefers: ${match[1].trim()}`);
    }
  }
  
  // Pattern: User mentions family/personal context
  if (/\b(family|familia|família|kids|children|filhos|hijos|spouse|cônjuge|cónyuge)\b/i.test(userMessage)) {
    memories.push(`User has family considerations mentioned in conversation`);
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
  
  // Get user's preferred currency
  const preferredCurrency = settings?.currency || "USD";
  
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

  // Parse chat memories from settings
  const memories: string[] = settings?.chatMemory ? JSON.parse(settings.chatMemory) : [];

  // Create simplified context WITHOUT raw cent values to prevent AI confusion
  const simplifiedContext = {
    // Overview
    currentDate: now.toISOString().split('T')[0],
    currency: settings?.currency || "USD",
    
    // Balances
    currentBalance: formatMoney(currentBalance),
    
    // Memories (context from previous conversations)
    memories,
    
    // Income & Expenses (last 6 months average) - FORMATTED VALUES ONLY
    avgMonthlyIncome: formatMoney(avgMonthlyIncome),
    avgMonthlyExpenses: formatMoney(avgMonthlyExpenses),
    avgMonthlySavings: formatMoney(avgMonthlySavings),
    savingsRate: `${savingsRate}%`,
    
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
    const financialContext = await buildUserFinancialContext(userId);
    
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
      insights.push(`📊 Top expense: ${top.emoji} ${top.name} (${formatMoney(top.avgMonthly)}/mo)`);
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
    const financialContext = await buildUserFinancialContext(userId);
    
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
      const financialContext = await buildUserFinancialContext(userId);

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

      // Detect language from user's message
      const detectedLanguage = detectLanguage(input.message);

      // Build system prompt with context
      const baseSystemPrompt = getSystemPrompt(detectedLanguage);
      
      const languageInstructions = {
        en: "Respond ENTIRELY in English. Every single word must be in English.",
        pt: "Responda COMPLETAMENTE em Português. Cada palavra da resposta DEVE estar em Português do Brasil. NÃO misture inglês.",
        es: "Responde COMPLETAMENTE en Español. Cada palabra debe estar en Español. NO mezcles inglés."
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
      
      const systemPrompt = `${baseSystemPrompt}

YOUR ROLE:
- Provide realistic, data-driven financial advice based on ACTUAL user data
- Be honest and transparent about what's achievable
- Suggest specific, actionable steps with numbers and timelines
- Consider income, expenses, savings rate, and financial goals
- Prioritize financial health and realistic planning
- Use a friendly but professional tone
- **CRITICAL**: ${languageInstructions[detectedLanguage]}
- **NEVER switch languages mid-response** - maintain consistency throughout
${flowContext}

CURRENT USER FINANCIAL PROFILE:
${JSON.stringify(financialContext, null, 2)}

⚠️ CRITICAL - USER'S CURRENT FINANCIAL SUMMARY:
**LANGUAGE**: User is writing in ${detectedLanguage === 'pt' ? 'Portuguese (PT-BR)' : detectedLanguage === 'es' ? 'Spanish' : 'English'}.
You MUST respond in the SAME language throughout the ENTIRE response. No mixing languages!

You MUST start your response by confirming these exact values to verify you read them correctly:

📊 **Monthly Averages (Last 6 months):**
- Income: ${financialContext.avgMonthlyIncome}
- Expenses: ${financialContext.avgMonthlyExpenses}  
- Net Savings: ${financialContext.avgMonthlySavings}
- Savings Rate: ${financialContext.savingsRate}

🔴 **MANDATORY FIRST STEP:**
Begin your response with "${detectedLanguage === 'pt' ? '📊 Resumo Financeiro Mensal (Últimos 6 meses):' : detectedLanguage === 'es' ? '📊 Resumen Financiero Mensual (Últimos 6 meses):' : '📊 Monthly Financial Summary (Last 6 months):'}" and list the 4 values above EXACTLY as shown.
This proves you are using the correct data and not hallucinating numbers.

⚠️ **STRICT RULES:**
1. These values are FINAL - DO NOT recalculate or modify them
2. DO NOT parse numbers from the strings - use them AS-IS
3. ALL values are already formatted in the correct currency
4. Copy and paste EXACTLY - any deviation means you failed
5. Write EVERYTHING in ${detectedLanguage === 'pt' ? 'Portuguese' : detectedLanguage === 'es' ? 'Spanish' : 'English'} - NO exceptions!

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

RULES:
- ONLY mention categories that appear in the array above
- Use EXACT amounts shown (e.g., if "Other" = $19, say $19 NOT $3,559)
- If a category has $0 or is missing, DO NOT suggest cutting it
- Focus on the TOP 3 categories with highest amounts
- If you need to reference a category, copy the EXACT name from the array

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
