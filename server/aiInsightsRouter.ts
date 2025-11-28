import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";

export const aiInsightsRouter = router({
  // Check if user has enough data for AI insights
  checkDataAvailability: protectedProcedure.query(async ({ ctx }) => {
    const transactions = await db.getAllTransactionsByUserId(ctx.user.id);
    const goals = await db.getActiveGoals(ctx.user.id);
    
    return {
      hasMinTransactions: transactions.length >= 5,
      transactionCount: transactions.length,
      hasGoals: goals.length > 0,
      goalCount: goals.length,
      canGenerateForecast: transactions.length >= 5,
      canGenerateAlerts: transactions.length >= 3,
      canGenerateAchievements: goals.length > 0,
      recommendations: [
        ...(transactions.length < 5 ? [`Add ${5 - transactions.length} more transactions to unlock AI forecasts`] : []),
        ...(goals.length === 0 ? ["Create your first financial goal to track progress"] : []),
        ...(transactions.length < 3 ? ["Add more transactions to get spending alerts"] : []),
      ]
    };
  }),

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
    const settings = await db.getUserSettings(ctx.user.id);
    
    if (transactions.length < 5) {
      throw new Error(`Insufficient data: You have ${transactions.length} transactions, but need at least 5 to generate meaningful forecasts. Add ${5 - transactions.length} more transactions first!`);
    }

    // Detect user's preferred language and currency
    const language = settings?.language || "en";
    const currency = settings?.currency || "USD";
    const currencySymbol = currency === "BRL" ? "R$" : currency === "EUR" ? "€" : "$";
    
    // Format money based on currency
    const formatMoney = (cents: number) => {
      if (currency === "BRL") {
        return `${currencySymbol} ${(cents / 100).toFixed(2).replace(".", ",").replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.")}`;
      } else if (currency === "EUR") {
        return `${currencySymbol}${(cents / 100).toFixed(2).replace(".", ",").replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.")}`;
      } else {
        return `${currencySymbol}${(cents / 100).toFixed(2).replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,")}`;
      }
    };

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

    // Translate based on language
    const translations = {
      en: {
        title: "Your Financial Forecast",
        systemPrompt: "You are a professional financial advisor. Provide clear, actionable advice based on user data. Be encouraging but honest about areas for improvement. Keep responses concise and under 300 words.",
        prompt: `Analyze this financial data and provide a brief forecast:

Income (last 3 months): ${formatMoney(totalIncome)}
Expenses (last 3 months): ${formatMoney(totalExpenses)}
Monthly Average Income: ${formatMoney(avgMonthlyIncome)}
Monthly Average Expenses: ${formatMoney(avgMonthlyExpense)}
Monthly Savings: ${formatMoney(monthlySavings)}

Top Spending Categories:
${categorySpending.map(c => `- ${c.name}: ${formatMoney(c.amount)} (${c.percentage.toFixed(1)}%)`).join('\n')}

Active Goals:
${goals.map(g => `- ${g.name}: ${formatMoney(g.currentAmount)} / ${formatMoney(g.targetAmount)} (${((g.currentAmount / g.targetAmount) * 100).toFixed(1)}%)`).join('\n')}

Provide in ENGLISH:
1. **Financial Health Assessment:** (1 sentence)
2. **Spending Pattern Analysis:** (1 sentence)  
3. **Goal Achievement Forecast:** When will they reach goals at current pace?
4. **Actionable Recommendations:** 3 specific actions with numbers
5. **Projected Annual Savings:** At current rate

Keep it concise (<300 words), encouraging, actionable. Use ${currency} amounts.`,
      },
      pt: {
        title: "Sua Previsão Financeira",
        systemPrompt: "Você é um consultor financeiro profissional brasileiro. Forneça conselhos ESPECÍFICOS e PERSONALIZADOS baseados nos dados reais do usuário. Use números concretos, mencione categorias específicas, e dê recomendações práticas e diretas. Seja encorajador mas realista. NUNCA use frases genéricas ou clichês.",
        prompt: `Analise estes dados financeiros REAIS e forneça insights ESPECÍFICOS e PRÁTICOS:

📊 **DADOS FINANCEIROS (últimos 3 meses):**
• Receita Total: ${formatMoney(totalIncome)}
• Despesas Total: ${formatMoney(totalExpenses)}
• Média Mensal de Receita: ${formatMoney(avgMonthlyIncome)}
• Média Mensal de Despesas: ${formatMoney(avgMonthlyExpense)}
• Poupança Mensal: ${formatMoney(monthlySavings)}
• Taxa de Poupança: ${savingsRate > 0 ? Math.round((monthlySavings / avgMonthlyIncome) * 100) : 0}%

💰 **PRINCIPAIS GASTOS (categorias reais):**
${categorySpending.map(c => `• ${c.name}: ${formatMoney(c.amount)} (${c.percentage.toFixed(1)}% do total)`).join('\n')}

🎯 **METAS ATIVAS:**
${goals.length > 0 ? goals.map(g => `• ${g.name}: ${formatMoney(g.currentAmount)} de ${formatMoney(g.targetAmount)} (${((g.currentAmount / g.targetAmount) * 100).toFixed(1)}% completo)`).join('\n') : '• Nenhuma meta ativa'}

⚠️ **INSTRUÇÕES CRÍTICAS:**
1. Mencione NÚMEROS ESPECÍFICOS dos dados acima
2. Cite CATEGORIAS REAIS pelo nome (ex: "${categorySpending[0]?.name}")
3. Use a TAXA DE POUPANÇA EXATA nos cálculos
4. Se houver meta, calcule QUANDO será atingida no ritmo atual (conte meses de Nov 2025 corretamente)
5. Dê recomendações COM VALORES CONCRETOS (ex: "reduza ${categorySpending[0]?.name} em ${formatMoney(Math.round(categorySpending[0]?.amount * 0.2))}")

📝 **FORMATO DA RESPOSTA (use EXATAMENTE esta estrutura):**

**1. Avaliação de Saúde Financeira:**
[1 frase mencionando taxa de poupança EXATA e se está acima/abaixo da média brasileira de 15%]

**2. Análise de Padrões de Gastos:**
[1-2 frases sobre as categorias TOP 3 ESPECÍFICAS e percentuais REAIS. Não seja genérico!]

**3. Previsão de Conquista de Metas:**
${goals.length > 0 ? `[Calcule meses até atingir "${goals[0].name}" no ritmo de ${formatMoney(monthlySavings)}/mês. Conte meses corretamente de Nov 2025]` : '[Sugira criar uma meta específica]'}

**4. Recomendações Acionáveis:**
• [Ação 1: mencione categoria específica e valor em ${currency}]
• [Ação 2: use número concreto das finanças acima]
• [Ação 3: recomendação prática com meta numérica]

**5. Projeção de Poupança Anual:**
[Mostre ${formatMoney(monthlySavings * 12)} e o que isso representa para as metas]

🚫 **EVITE ABSOLUTAMENTE:**
- Frases genéricas: "você está no caminho certo", "continue assim"
- Usar "suas despesas" sem especificar QUAL categoria
- Dar valores arredondados - use os valores EXATOS
- Esquecer de mencionar categorias pelo nome

Máximo: 250 palavras. Seja direto, específico e acionável!`,
      },
      es: {
        title: "Tu Pronóstico Financiero",
        systemPrompt: "Eres un asesor financiero profesional. Proporciona consejos claros y accionables basados en los datos del usuario. Sé alentador pero honesto sobre áreas para mejorar. Mantén respuestas concisas con menos de 300 palabras.",
        prompt: `Analiza estos datos financieros y proporciona un pronóstico breve:

Ingresos (últimos 3 meses): ${formatMoney(totalIncome)}
Gastos (últimos 3 meses): ${formatMoney(totalExpenses)}
Promedio Mensual de Ingresos: ${formatMoney(avgMonthlyIncome)}
Promedio Mensual de Gastos: ${formatMoney(avgMonthlyExpense)}
Ahorros Mensuales: ${formatMoney(monthlySavings)}

Principales Categorías de Gastos:
${categorySpending.map(c => `- ${c.name}: ${formatMoney(c.amount)} (${c.percentage.toFixed(1)}%)`).join('\n')}

Metas Activas:
${goals.map(g => `- ${g.name}: ${formatMoney(g.currentAmount)} / ${formatMoney(g.targetAmount)} (${((g.currentAmount / g.targetAmount) * 100).toFixed(1)}%)`).join('\n')}

Proporciona en ESPAÑOL:
1. **Evaluación de Salud Financiera:** (1 oración)
2. **Análisis de Patrones de Gastos:** (1 oración)
3. **Pronóstico de Logro de Metas:** ¿Cuándo alcanzarán las metas al ritmo actual?
4. **Recomendaciones Accionables:** 3 acciones específicas con números
5. **Proyección de Ahorros Anuales:** Al ritmo actual

Mantén conciso (<300 palabras), alentador, accionable. Usa valores en ${currency}.`,
      },
    };

    const lang = (language === "pt" || language === "es") ? language : "en";
    const { title, systemPrompt, prompt } = translations[lang];

    try {
      const aiResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: systemPrompt,
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
        title: title,
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
