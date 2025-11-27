import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import net from "net";
import fs from "fs";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startRecurringExpenseScheduler } from "./scheduler";

/**
 * Utility: check if a TCP port is available on this machine.
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

/**
 * Find an available port starting at startPort (tries a small range).
 */
async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();

  // When running behind a proxy (Render / Cloudflare), trust it so cookies/secure behave correctly.
  app.set("trust proxy", 1);

  // Body parsers
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  /**
   * CORS configuration
   * - credentials: true for cross-origin requests
   * - origin is validated and echoed back (cors package will send the specific origin).
   */
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (server-to-server, curl, Postman)
        if (!origin) return callback(null, true);

        // Allow localhost for dev
        if (origin.includes("localhost")) return callback(null, true);

        // Allow Vercel preview/prod domains
        if (origin.includes(".vercel.app")) return callback(null, true);

        // Add any additional allowed hosts here
        const allowedOrigins = [
          "https://money-goal-app.vercel.app",
          "https://dynamic-brioche-f9291c.netlify.app",
        ];

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        // Default: block
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
      methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  // Register OAuth routes
  registerOAuthRoutes(app);

  // WhatsApp webhook verification (GET)
  app.get("/api/webhooks/whatsapp", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    
    console.log("[WhatsApp Webhook] Verification request:", { mode, token: token ? "***" : "none" });
    
    if (mode === "subscribe" && token === ENV.whatsappWebhookToken) {
      console.log("[WhatsApp Webhook] Verification successful");
      return res.status(200).send(challenge);
    } else {
      console.log("[WhatsApp Webhook] Verification failed");
      return res.status(403).send("Forbidden");
    }
  });

  // WhatsApp webhook endpoint (WhatsApp Cloud API / 360Dialog)
  app.post("/api/webhooks/whatsapp", express.json(), async (req, res) => {
    try {
      console.log("[WhatsApp Webhook] Received request:", JSON.stringify(req.body, null, 2));
      
      // WhatsApp Cloud API sends data as JSON
      const { object, entry } = req.body;
      
      if (object !== "whatsapp_business_account" || !entry || entry.length === 0) {
        console.error("[WhatsApp Webhook] Invalid payload structure");
        return res.status(400).send("Invalid payload");
      }
      
      const changes = entry[0]?.changes;
      if (!changes || changes.length === 0) {
        return res.status(200).send("");
      }
      
      const value = changes[0]?.value;
      const messages = value?.messages;
      
      if (!messages || messages.length === 0) {
        // Status update or other event type
        return res.status(200).send("");
      }
      
      // Process first message
      const incomingMessage = messages[0];
      const From = incomingMessage.from; // Phone number without "whatsapp:" prefix
      const Body = incomingMessage.text?.body;
      const ProfileName = value.contacts?.[0]?.profile?.name;
      
      if (!From || !Body) {
        console.error("[WhatsApp Webhook] Missing from or body");
        return res.status(400).send("Missing required fields");
      }

      const phoneNumber = From; // Already in correct format (no prefix)
      const message = Body.trim();

      console.log("[WhatsApp] Processing message from ${phoneNumber}: ${message}");

      // Import DB and LLM
      const db = await import("../db");
      const { invokeLLM } = await import("./llm");
      const { ENV } = await import("./env");
      
      // Check if WhatsApp Cloud API is configured
      const hasWhatsAppAPI = ENV.whatsappPhoneNumberId && ENV.whatsappAccessToken;
      
      if (!hasWhatsAppAPI) {
        console.warn("[WhatsApp] WhatsApp Cloud API not configured");
        return res.status(500).send("WhatsApp not configured");
      }
      
      // Helper: Send WhatsApp message via Cloud API
      async function sendWhatsAppMessage(to: string, text: string) {
        console.log("[WhatsApp] Sending message to:", to);
        console.log("[WhatsApp] Message:", text);
        
        try {
          const response = await fetch(
            `https://graph.facebook.com/v21.0/${ENV.whatsappPhoneNumberId}/messages`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${ENV.whatsappAccessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: to,
                type: "text",
                text: { body: text },
              }),
            }
          );
          
          const result = await response.json();
          
          if (!response.ok) {
            console.error("[WhatsApp] Send failed:", result);
            throw new Error(`WhatsApp API error: ${result.error?.message || "Unknown error"}`);
          }
          
          console.log("[WhatsApp] Message sent successfully:", result.messages?.[0]?.id);
          return result;
        } catch (error: any) {
          console.error("[WhatsApp] Error sending message:", error.message);
          throw error;
        }
      }

      // Find user by phone
      const user = await db.getUserByPhone(phoneNumber);
      
      if (!user) {
        console.log("[WhatsApp] User not found for phone:", phoneNumber);
        await sendWhatsAppMessage(
          phoneNumber,
          `❌ Número não vinculado ao MoneyGoal.\n\nPara usar este serviço, acesse: ${ENV.viteAppUrl}\n\nVá em Configurações → WhatsApp para vincular sua conta.`
        );
        return res.status(200).send("");
      }

      console.log("[WhatsApp] User found:", user.email);

      // Verify phone if not verified
      if (!user.phoneVerified) {
        await db.verifyUserPhone(user.id);
      }

      // Handle commands
      const lowerMessage = message.toLowerCase();
      
      if (lowerMessage.includes("ajuda") || lowerMessage === "?") {
        await sendWhatsAppMessage(
          phoneNumber,
          `📱 *MoneyGoal - Comandos*\n\n*Registrar gastos:*\n• Mercado 350 reais\n• Uber 25\n\n*Consultas:*\n• "hoje" - gastos de hoje\n\n*Outros:*\n• "ajuda" - esta mensagem`
        );
        return res.status(200).send("");
      }

      if (lowerMessage === "hoje") {
        const transactions = await db.getTransactionsByDateRange(
          user.openId,
          new Date(new Date().setHours(0, 0, 0, 0)),
          new Date(new Date().setHours(23, 59, 59, 999))
        );
        const todayExpenses = transactions.filter((t: any) => t.type === "expense");
        const total = todayExpenses.reduce((sum: number, t: any) => sum + t.amount, 0);

        const list = todayExpenses.map((t: any) => `• ${t.reason} - R$ ${(t.amount / 100).toFixed(2)}`).join("\n");
        await sendWhatsAppMessage(
          phoneNumber,
          todayExpenses.length === 0 
            ? `📊 *Gastos de hoje*\n\nNenhum gasto registrado ainda! 🎉`
            : `📊 *Gastos de hoje*\n\n${list}\n\n*Total:* R$ ${(total / 100).toFixed(2)}`
        );
        return res.status(200).send("");
      }

      // Parse transaction with LLM
      console.log("[WhatsApp] Parsing transaction...");
      const llmResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Extract transaction data from Portuguese text. Return ONLY valid JSON:
{"description": "string", "amount": number (in cents), "category": "Alimentação|Transporte|Saúde|Lazer|Moradia|Educação|Outros", "type": "expense or income", "currency": "BRL|USD|EUR"}

Currency detection:
- "reais", "R$" or no currency → "BRL"
- "dólares", "dollars", "$", "USD" → "USD"
- "euros", "EUR", "€" → "EUR"

Examples:
"Mercado 350 reais" → {"description":"Mercado","amount":35000,"category":"Alimentação","type":"expense","currency":"BRL"}
"Uber 25" → {"description":"Uber","amount":2500,"category":"Transporte","type":"expense","currency":"BRL"}
"Recebi 1000 dólares" → {"description":"Freelance","amount":100000,"category":"Outros","type":"income","currency":"USD"}
"Comprei iPhone por 300 dólares" → {"description":"iPhone","amount":30000,"category":"Outros","type":"expense","currency":"USD"}

If invalid, return: {"error": "invalid"}`
          },
          { role: "user", content: message }
        ],
        responseFormat: { type: "json_object" }
      });

      let responseText = llmResponse.choices[0].message.content as string;
      
      // Remove markdown code blocks if present
      responseText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      
      console.log("[WhatsApp] LLM response:", responseText);
      
      const parsed = JSON.parse(responseText);
      
      if (parsed.error || !parsed.description || !parsed.amount) {
        console.log("[WhatsApp] Invalid transaction format");
        await sendWhatsAppMessage(
          phoneNumber,
          `❓ Não consegui entender.\n\n*Exemplos:*\n• Mercado 350 reais\n• Uber 25`
        );
        return res.status(200).send("");
      }

      // Create transaction
      const activeGoal = await db.getActiveGoal(user.openId);
      if (!activeGoal) {
        await sendWhatsAppMessage(
          phoneNumber,
          `⚠️ Você precisa ter uma meta ativa.\n\nAcesse o app e crie uma meta primeiro!`
        );
        return res.status(200).send("");
      }

      // Get user settings for currency fallback
      const settings = await db.getUserSettings(user.openId);
      const defaultCurrency = settings?.currency || "BRL";
      const currency = parsed.currency || defaultCurrency;
      const transactionType = parsed.type || "expense";

      // Find or create category
      const categories = await db.getAllCategories(user.openId);
      let category = categories.find(c => c.name === parsed.category);
      
      if (!category) {
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
          name: parsed.category,
          emoji: categoryEmojis[parsed.category] || "📦",
          color: categoryColors[parsed.category] || "#6b7280",
        });
      }
      
      const categoryId = category.id;
      const description = `${parsed.description} [WhatsApp]`;

      await db.createTransaction({
        userId: user.openId,
        goalId: activeGoal.id,
        reason: description,
        amount: parsed.amount,
        categoryId: categoryId,
        type: transactionType,
        source: "whatsapp",
        currency: currency,
      });

      console.log("[WhatsApp] Transaction created:", {
        description,
        amount: parsed.amount,
        category: parsed.category,
        type: transactionType,
        currency,
        detectedCurrency: parsed.currency,
        defaultCurrency,
      });

      // Send confirmation
      const goals = await db.getActiveGoals(user.openId);
      const totalSaved = goals.reduce((sum: number, g: any) => sum + g.currentAmount, 0);

      const emoji = transactionType === "income" ? "💰" : "💸";
      const actionText = transactionType === "income" ? "Receita registrada" : "Gasto registrado";
      const currencySymbol = currency === "BRL" ? "R$" : currency === "USD" ? "$" : currency === "EUR" ? "€" : currency;

      const confirmationMessage = `✅ *${actionText}!*\n\n📝 ${parsed.description}\n${emoji} ${currencySymbol} ${(parsed.amount / 100).toFixed(2)}\n🏷️ ${parsed.category}\n\n💎 Economias totais: R$ ${(totalSaved / 100).toFixed(2)}`;

      console.log("[WhatsApp] Sending confirmation message...");
      console.log("[WhatsApp] Message content:", confirmationMessage);
      
      try {
        const msgResult = await sendWhatsAppMessage(phoneNumber, confirmationMessage);
        console.log("[WhatsApp] Confirmation sent successfully! ID:", msgResult.messages?.[0]?.id);
      } catch (sendError: any) {
        console.error("[WhatsApp] Failed to send confirmation:", {
          error: sendError.message,
        });
      }

      res.status(200).send("");
    } catch (error) {
      console.error("[WhatsApp Webhook] Error:", error);
      res.status(500).send("Internal server error");
    }
  });

  // Wise webhook endpoint (raw body needed for signature validation)
  // URL format: /api/webhooks/wise/:userId
  // This endpoint bypasses CORS since it's server-to-server from Wise
  app.post("/api/webhooks/wise/:userId", express.json(), async (req, res) => {
    try {
      // Allow Wise webhooks (no CORS restriction for server-to-server)
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST");
      
      const signature = req.headers["x-signature-256"] as string;
      const userId = req.params.userId;
      
      if (!userId) {
        console.error("Webhook missing userId");
        return res.status(400).json({ error: "Missing userId" });
      }

      // If no signature, this is a test request from Wise - just return 200 OK
      if (!signature) {
        console.log(`Wise webhook test request received for user ${userId}`);
        return res.status(200).json({ success: true, message: "Webhook endpoint ready" });
      }

      // Import webhook handler
      const { handleWiseWebhook } = await import("./wiseWebhook");
      
      // Process webhook (pass stringified body for signature validation)
      await handleWiseWebhook(JSON.stringify(req.body), signature, userId);
      
      console.log(`Wise webhook processed successfully for user ${userId}`);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Wise webhook error:", error);
      res.status(500).json({ error: "Webhook processing failed", message: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // tRPC API with JWT Bearer token authentication
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Serve client: dev uses Vite, prod uses static files if present
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, createServer(app));
  } else {
    const clientDistPath = path.resolve(process.cwd(), "client", "dist");
    if (fs.existsSync(clientDistPath)) {
      console.log("[Server] Serving static client from", clientDistPath);
      serveStatic(app);
    } else {
      console.log("[Server] client/dist not found — static client will not be served.");
      app.get("/", (req, res) => {
        res.json({ ok: true, note: "Backend running — client not served from this host." });
      });
    }
  }

  const port = parseInt(process.env.PORT || "10000", 10);

  const server = createServer(app);
  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${port}/`);
    
    // Start the recurring expense scheduler
    startRecurringExpenseScheduler();
  });
}

startServer().catch((err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});
