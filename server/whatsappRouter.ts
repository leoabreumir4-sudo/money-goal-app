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
  if (!twilioClient || !ENV.twilioWhatsappNumber) {
    console.warn("Twilio not configured - cannot send WhatsApp message");
    return;
  }

  try {
    await twilioClient.messages.create({
      from: `whatsapp:${ENV.twilioWhatsappNumber}`,
      to: `whatsapp:${to}`,
      body: message,
    });
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
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
} | null> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a financial assistant that extracts expense data from Portuguese text.
Return ONLY valid JSON with this exact structure:
{
  "description": "string (brief description)",
  "amount": number (in cents - multiply reais by 100),
  "category": "one of: Alimentação, Transporte, Saúde, Lazer, Moradia, Educação, Outros"
}

Examples:
"Mercado 350 reais" → {"description":"Mercado","amount":35000,"category":"Alimentação"}
"Uber 25" → {"description":"Uber","amount":2500,"category":"Transporte"}
"25 garrafas de água por 1 real cada" → {"description":"Água (25 garrafas)","amount":2500,"category":"Alimentação"}
"Academia 120 mensalidade" → {"description":"Academia","amount":12000,"category":"Saúde"}
"Aluguel 1500" → {"description":"Aluguel","amount":150000,"category":"Moradia"}

If the message doesn't contain expense information, return: {"error": "invalid"}`,
        },
        { role: "user", content: message },
      ],
      responseFormat: { type: "json_object" },
    });

    const text = response.choices[0].message.content;
    const parsed = JSON.parse(typeof text === "string" ? text : JSON.stringify(text));

    if (parsed.error === "invalid" || !parsed.description || !parsed.amount) {
      return null;
    }

    return {
      description: parsed.description,
      amount: parsed.amount,
      category: parsed.category || "Outros",
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
      console.log("[WhatsApp Webhook] Received:", JSON.stringify(input, null, 2));

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

        await db.createTransaction({
          userId: user.openId,
          goalId: activeGoal.id,
          reason: transaction.description,
          amount: transaction.amount,
          categoryId: null,
          type: "expense",
          source: "whatsapp",
        });

        // Get user's current balance/goals for context
        const goals = await db.getActiveGoals(user.openId);
        const totalSaved = goals.reduce((sum: number, g: any) => sum + g.currentAmount, 0);

        // Send confirmation
        await sendWhatsApp(
          phoneNumber,
          `✅ *Gasto registrado!*\n\n` +
            `📝 ${transaction.description}\n` +
            `💰 R$ ${(transaction.amount / 100).toFixed(2)}\n` +
            `🏷️ ${transaction.category}\n\n` +
            (totalSaved > 0 ? `💎 Economias totais: R$ ${(totalSaved / 100).toFixed(2)}` : `Confira no app: ${ENV.viteAppUrl || "https://seu-app.com"}`)
        );

        return { success: true, action: "expense_created" };
      } catch (error) {
        console.error("Error creating transaction:", error);
        await sendWhatsApp(
          phoneNumber,
          `❌ Erro ao registrar gasto. Tente novamente ou acesse o app.`
        );
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
