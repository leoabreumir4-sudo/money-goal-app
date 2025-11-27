import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "./_core/llm";
import * as db from "./db";
import { ENV } from "./_core/env";

// Initialize Twilio only if credentials are available
let twilioClient: any = null;

async function initTwilio() {
  if (ENV.twilioAccountSid && ENV.twilioAuthToken) {
    const twilio = await import("twilio");
    twilioClient = twilio.default(ENV.twilioAccountSid, ENV.twilioAuthToken);
  }
}

initTwilio().catch((error) => {
  console.warn("Twilio not initialized - WhatsApp features will be disabled:", error);
});

// Helper: Send WhatsApp message
async function sendWhatsApp(to: string, message: string) {
  console.log("[WhatsApp] Attempting to send message to:", to);
  console.log("[WhatsApp] Message:", message);
  
  if (!twilioClient || !ENV.twilioWhatsappNumber) {
    console.warn("[WhatsApp] Twilio not configured:", {
      hasClient: !!twilioClient,
      hasNumber: !!ENV.twilioWhatsappNumber,
      number: ENV.twilioWhatsappNumber,
    });
    return;
  }

  try {
    const result = await twilioClient.messages.create({
      from: `whatsapp:${ENV.twilioWhatsappNumber}`,
      to: `whatsapp:${to}`,
      body: message,
    });
    console.log("[WhatsApp] Message sent successfully:", result.sid);
  } catch (error: any) {
    console.error("[WhatsApp] Error sending message:", {
      error: error.message,
      code: error.code,
      status: error.status,
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to send WhatsApp message",
    });
  }
}

// Helper: Parse expense using LLM
async function parseExpense(message: string): Promise<{
  description: string;
  amount: number;
  category: string;
  type: string;
  currency: string;
} | null> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a financial assistant that extracts transaction data from Portuguese text.
Return ONLY valid JSON with this exact structure:
{
  "description": "string (brief description)",
  "amount": number (in cents - multiply by 100),
  "category": "one of: Alimentação, Transporte, Saúde, Lazer, Moradia, Educação, Outros",
  "type": "expense or income",
  "currency": "BRL, USD, EUR, or other ISO code if mentioned"
}

Currency detection rules:
- If user says "reais", "R$", or just a number → "BRL"
- If user says "dólares", "dollars", "$", "USD" → "USD"
- If user says "euros", "EUR", "€" → "EUR"
- Default to "BRL" if no currency is mentioned

Examples:
"Mercado 350 reais" → {"description":"Mercado","amount":35000,"category":"Alimentação","type":"expense","currency":"BRL"}
"Uber 25" → {"description":"Uber","amount":2500,"category":"Transporte","type":"expense","currency":"BRL"}
"Recebi 1000 dólares do freelance" → {"description":"Freelance","amount":100000,"category":"Outros","type":"income","currency":"USD"}
"Salário 5000 euros" → {"description":"Salário","amount":500000,"category":"Outros","type":"income","currency":"EUR"}
"2 pães por 1,50 cada" → {"description":"Pães (2 unidades)","amount":300,"category":"Alimentação","type":"expense","currency":"BRL"}
"Comprei Iphone por 300 dólares" → {"description":"Iphone","amount":30000,"category":"Outros","type":"expense","currency":"USD"}

If the message doesn't contain transaction information, return: {"error": "invalid"}`,
        },
        { role: "user", content: message },
      ],
      responseFormat: { type: "json_object" },
    });

    const text = response.choices[0].message.content;
    const parsed = JSON.parse(typeof text === "string" ? text : JSON.stringify(text));

    console.log("[WhatsApp] LLM parsed result:", parsed);

    if (parsed.error === "invalid" || !parsed.description || !parsed.amount) {
      return null;
    }

    return {
      description: parsed.description,
      amount: parsed.amount,
      category: parsed.category || "Outros",
      type: parsed.type || "expense",
      currency: parsed.currency || "BRL",
    };
  } catch (error) {
    console.error("Error parsing expense:", error);
    return null;
  }
}

// Helper: Get spending summary for today
async function getTodaySummary(userId: string) {
  const transactions = await db.getTransactionsByDateRange(
    userId,
    new Date(new Date().setHours(0, 0, 0, 0)),
    new Date(new Date().setHours(23, 59, 59, 999))
  );

  const todayExpenses = transactions.filter((t: any) => t.type === "expense");
  const total = todayExpenses.reduce((sum: number, t: any) => sum + t.amount, 0);

  return { transactions: todayExpenses, total };
}

export const whatsappRouter = router({
  /**
   * Webhook that receives messages from WhatsApp (via Twilio)
   * This is called by Twilio when a user sends a message
   */
  webhook: publicProcedure
    .input(
      z.object({
        From: z.string().optional(), // Format: whatsapp:+5511999999999
        Body: z.string().optional(), // Message text
        ProfileName: z.string().optional(),
      }).passthrough() // Allow extra fields from Twilio
    )
    .mutation(async ({ input }) => {
      console.log("=".repeat(80));
      console.log("[WhatsApp Webhook] NEW MESSAGE RECEIVED");
      console.log("[WhatsApp Webhook] Timestamp:", new Date().toISOString());
      console.log("[WhatsApp Webhook] Full payload:", JSON.stringify(input, null, 2));
      console.log("=".repeat(80));

      if (!input.From || !input.Body) {
        console.error("[WhatsApp Webhook] Missing From or Body", input);
        return { success: false, reason: "missing_fields" };
      }

      const phoneNumber = input.From.replace("whatsapp:", "");
      const message = input.Body.trim();

      console.log(`[WhatsApp] Message from ${phoneNumber}: ${message}`);

      // Log Twilio configuration
      console.log("[WhatsApp] Twilio configured:", {
        hasClient: !!twilioClient,
        hasNumber: !!ENV.twilioWhatsappNumber,
        number: ENV.twilioWhatsappNumber,
      });

      // Find user by phone number
      const user = await db.getUserByPhone(phoneNumber);

      console.log("[WhatsApp] User lookup:", {
        phoneNumber,
        userFound: !!user,
        userId: user?.openId,
      });

      if (!user) {
        // User not linked
        await sendWhatsApp(
          phoneNumber,
          `❌ Número não vinculado ao MoneyGoal.\n\nPara usar este serviço, acesse o aplicativo em:\n🌐 ${ENV.viteAppUrl || "https://seu-app.com"}\n\nVá em Configurações → WhatsApp para vincular sua conta.`
        );
        return { success: false, reason: "user_not_found" };
      }

      // Mark phone as verified if not already
      if (!user.phoneVerified) {
        await db.verifyUserPhone(user.openId);
      }

      // Handle special commands
      const lowerMessage = message.toLowerCase();

      if (lowerMessage.includes("ajuda") || lowerMessage === "?" || lowerMessage === "help") {
        await sendWhatsApp(
          phoneNumber,
          `📱 *MoneyGoal - Comandos*\n\n*Registrar gastos:*\n• Mercado 350 reais\n• Uber 25\n• Padaria 15 café\n\n*Consultas:*\n• "hoje" - gastos de hoje\n• "saldo" - saldo disponível\n• "resumo" - resumo semanal\n\n*Outros:*\n• "ajuda" - esta mensagem`
        );
        return { success: true, action: "help" };
      }

      if (lowerMessage === "hoje" || lowerMessage === "gastos hoje") {
        const { transactions, total } = await getTodaySummary(user.openId);

        if (transactions.length === 0) {
          await sendWhatsApp(phoneNumber, `📊 *Gastos de hoje*\n\nNenhum gasto registrado ainda! 🎉`);
        } else {
          const list = transactions
            .map((t: any) => `• ${t.reason} - R$ ${(t.amount / 100).toFixed(2)}`)
            .join("\n");

          await sendWhatsApp(
            phoneNumber,
            `📊 *Gastos de hoje*\n\n${list}\n\n*Total:* R$ ${(total / 100).toFixed(2)}`
          );
        }
        return { success: true, action: "summary" };
      }

      // Parse expense from message
      console.log("[WhatsApp] Parsing expense from message:", message);
      const transaction = await parseExpense(message);

      console.log("[WhatsApp] Parsed transaction:", transaction);

      if (!transaction) {
        await sendWhatsApp(
          phoneNumber,
          `❓ Não consegui entender essa mensagem.\n\n*Exemplos válidos:*\n• Mercado 350 reais\n• Uber 25\n• Padaria 15 café\n• 20 garrafas de água por 2 reais cada\n\nEnvie "ajuda" para ver todos os comandos.`
        );
        return { success: false, reason: "invalid_format" };
      }

      // Create transaction
      try {
        const activeGoal = await db.getActiveGoal(user.openId);
        if (!activeGoal) {
          await sendWhatsApp(
            phoneNumber,
            `⚠️ Você precisa ter uma meta ativa para registrar gastos.\n\nAcesse o app e crie uma meta primeiro!`
          );
          return { success: false, reason: "no_active_goal" };
        }

        // Get user settings for currency fallback
        const settings = await db.getUserSettings(user.openId);
        const defaultCurrency = settings?.currency || "BRL";
        
        // Use currency from parsed message, fallback to user settings
        const currency = transaction.currency || defaultCurrency;

        // Find or create category
        let categoryId = null;
        const categories = await db.getAllCategories(user.openId);
        let category = categories.find((c: any) => c.name === transaction.category);
        
        if (!category) {
          // Create category if it doesn't exist
          const categoryEmojis: Record<string, string> = {
            "Alimentação": "🍔",
            "Transporte": "🚗",
            "Saúde": "💊",
            "Lazer": "🎮",
            "Moradia": "🏠",
            "Educação": "📚",
            "Outros": "📦",
          };
          
          const categoryColors: Record<string, string> = {
            "Alimentação": "#10b981",
            "Transporte": "#3b82f6",
            "Saúde": "#ef4444",
            "Lazer": "#8b5cf6",
            "Moradia": "#f59e0b",
            "Educação": "#06b6d4",
            "Outros": "#6b7280",
          };
          
          category = await db.createCategory({
            userId: user.openId,
            name: transaction.category,
            emoji: categoryEmojis[transaction.category] || "📦",
            color: categoryColors[transaction.category] || "#6b7280",
          });
        }
        categoryId = category.id;

        // Create transaction with WhatsApp tag in description
        const description = `${transaction.description} [WhatsApp]`;
        
        await db.createTransaction({
          userId: user.openId,
          goalId: activeGoal.id,
          reason: description,
          amount: transaction.amount,
          categoryId: categoryId,
          type: transaction.type as "expense" | "income",
          source: "whatsapp",
          currency: currency,
        });

        console.log("[WhatsApp] Transaction created:", {
          description,
          amount: transaction.amount,
          category: transaction.category,
          categoryId,
          type: transaction.type,
          currency,
          detectedCurrency: transaction.currency,
          defaultCurrency,
        });

        // Get user's current balance/goals for context
        const goals = await db.getActiveGoals(user.openId);
        const totalSaved = goals.reduce((sum: number, g: any) => sum + g.currentAmount, 0);

        // Send confirmation
        const emoji = transaction.type === "income" ? "💰" : "💸";
        const actionText = transaction.type === "income" ? "Receita registrada" : "Gasto registrado";
        
        // Format currency symbol
        const currencySymbol = currency === "BRL" ? "R$" : currency === "USD" ? "$" : currency === "EUR" ? "€" : currency;
        
        console.log("[WhatsApp] Sending confirmation message to", phoneNumber);
        
        const confirmationMessage = `✅ *${actionText}!*\n\n` +
          `📝 ${transaction.description}\n` +
          `${emoji} ${currencySymbol} ${(transaction.amount / 100).toFixed(2)}\n` +
          `🏷️ ${transaction.category}\n\n` +
          (totalSaved > 0 ? `💎 Economias totais: R$ ${(totalSaved / 100).toFixed(2)}` : `Confira no app: ${ENV.viteAppUrl || "https://seu-app.com"}`);
        
        console.log("[WhatsApp] Confirmation message content:", confirmationMessage);
        
        try {
          await sendWhatsApp(phoneNumber, confirmationMessage);
          console.log("[WhatsApp] Confirmation message sent successfully");
        } catch (sendError: any) {
          console.error("[WhatsApp] Failed to send confirmation:", {
            error: sendError.message,
            code: sendError.code,
            status: sendError.status,
          });
          // Don't throw - transaction was created successfully
        }

        return { success: true, action: "transaction_created" };
      } catch (error: any) {
        console.error("[WhatsApp] Error creating transaction:", {
          error: error.message,
          stack: error.stack,
        });
        
        // Try to send error message to user
        try {
          await sendWhatsApp(
            phoneNumber,
            `❌ Erro ao registrar gasto. Tente novamente ou acesse o app.`
          );
        } catch (sendError) {
          console.error("[WhatsApp] Failed to send error message:", sendError);
        }
        
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create transaction",
        });
      }
    }),

  /**
   * Link a phone number to the authenticated user
   */
  linkPhone: protectedProcedure
    .input(
      z.object({
        phoneNumber: z.string().min(10).max(20),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Normalize phone number (remove spaces, dashes, etc.)
      const normalizedPhone = input.phoneNumber.replace(/[\s\-\(\)]/g, "");

      // Check if phone is already linked to another user
      const existingUser = await db.getUserByPhone(normalizedPhone);
      if (existingUser && existingUser.openId !== ctx.user.openId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Este número já está vinculado a outra conta",
        });
      }

      // Update user's phone number
      await db.updateUserPhone(ctx.user.openId, normalizedPhone);

      // Send welcome message
      try {
        await sendWhatsApp(
          normalizedPhone,
          `🎉 *Bem-vindo ao MoneyGoal!*\n\n` +
            `Agora você pode registrar gastos direto pelo WhatsApp!\n\n` +
            `*Teste agora:*\n` +
            `• Mercado 100 reais\n` +
            `• Uber 35\n` +
            `• Café 12\n\n` +
            `*Comandos úteis:*\n` +
            `• "hoje" - ver gastos de hoje\n` +
            `• "ajuda" - ver todos os comandos\n\n` +
            `Boa economia! 💰`
        );
      } catch (error) {
        console.error("Failed to send welcome message:", error);
        // Don't fail the whole operation if message fails
      }

      return {
        success: true,
        phoneNumber: normalizedPhone,
      };
    }),

  /**
   * Unlink phone number from user
   */
  unlinkPhone: protectedProcedure.mutation(async ({ ctx }) => {
    await db.updateUserPhone(ctx.user.openId, null);
    return { success: true };
  }),

  /**
   * Get current phone link status
   */
  getPhoneStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.getUserById(ctx.user.openId);
    return {
      phoneNumber: user?.phoneNumber || null,
      phoneVerified: user?.phoneVerified || false,
    };
  }),
});
