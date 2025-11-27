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

  // WhatsApp webhook endpoint (Twilio)
  app.post("/api/webhooks/whatsapp", express.urlencoded({ extended: true }), async (req, res) => {
    try {
      console.log("[WhatsApp Webhook] Received request:", JSON.stringify(req.body, null, 2));
      
      // Twilio sends data as application/x-www-form-urlencoded
      const { From, Body, ProfileName } = req.body;
      
      if (!From || !Body) {
        console.error("[WhatsApp Webhook] Missing From or Body");
        return res.status(400).send("Missing required fields");
      }

      const phoneNumber = From.replace("whatsapp:", "");
      const message = Body.trim();

      console.log(`[WhatsApp] Processing message from ${phoneNumber}: ${message}`);

      // Import and process directly
      const db = await import("../db");
      const { invokeLLM } = await import("./llm");
      const { ENV } = await import("./env");
      
      // Initialize Twilio
      let twilioClient: any = null;
      if (ENV.twilioAccountSid && ENV.twilioAuthToken) {
        const twilio = await import("twilio");
        twilioClient = twilio.default(ENV.twilioAccountSid, ENV.twilioAuthToken);
      }

      // Find user by phone
      const user = await db.getUserByPhone(phoneNumber);
      
      if (!user) {
        console.log("[WhatsApp] User not found for phone:", phoneNumber);
        if (twilioClient && ENV.twilioWhatsappNumber) {
          await twilioClient.messages.create({
            from: `whatsapp:${ENV.twilioWhatsappNumber}`,
            to: From,
            body: `❌ Número não vinculado ao MoneyGoal.\n\nPara usar este serviço, acesse: ${ENV.viteAppUrl}\n\nVá em Configurações → WhatsApp para vincular sua conta.`
          });
        }
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
        if (twilioClient && ENV.twilioWhatsappNumber) {
          await twilioClient.messages.create({
            from: `whatsapp:${ENV.twilioWhatsappNumber}`,
            to: From,
            body: `📱 *MoneyGoal - Comandos*\n\n*Registrar gastos:*\n• Mercado 350 reais\n• Uber 25\n\n*Consultas:*\n• "hoje" - gastos de hoje\n\n*Outros:*\n• "ajuda" - esta mensagem`
          });
        }
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

        if (twilioClient && ENV.twilioWhatsappNumber) {
          const list = todayExpenses.map((t: any) => `• ${t.reason} - R$ ${(t.amount / 100).toFixed(2)}`).join("\n");
          await twilioClient.messages.create({
            from: `whatsapp:${ENV.twilioWhatsappNumber}`,
            to: From,
            body: todayExpenses.length === 0 
              ? `📊 *Gastos de hoje*\n\nNenhum gasto registrado ainda! 🎉`
              : `📊 *Gastos de hoje*\n\n${list}\n\n*Total:* R$ ${(total / 100).toFixed(2)}`
          });
        }
        return res.status(200).send("");
      }

      // Parse expense with LLM
      console.log("[WhatsApp] Parsing expense...");
      const llmResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Extract expense data from Portuguese text. Return ONLY valid JSON:
{"description": "string", "amount": number (in cents), "category": "Alimentação|Transporte|Saúde|Lazer|Moradia|Educação|Outros"}

Examples:
"Mercado 350 reais" → {"description":"Mercado","amount":35000,"category":"Alimentação"}
"Uber 25" → {"description":"Uber","amount":2500,"category":"Transporte"}

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
        console.log("[WhatsApp] Invalid expense format");
        if (twilioClient && ENV.twilioWhatsappNumber) {
          await twilioClient.messages.create({
            from: `whatsapp:${ENV.twilioWhatsappNumber}`,
            to: From,
            body: `❓ Não consegui entender.\n\n*Exemplos:*\n• Mercado 350 reais\n• Uber 25`
          });
        }
        return res.status(200).send("");
      }

      // Create transaction
      const activeGoal = await db.getActiveGoal(user.id);
      if (!activeGoal) {
        if (twilioClient && ENV.twilioWhatsappNumber) {
          await twilioClient.messages.create({
            from: `whatsapp:${ENV.twilioWhatsappNumber}`,
            to: From,
            body: `⚠️ Você precisa ter uma meta ativa.\n\nAcesse o app e crie uma meta primeiro!`
          });
        }
        return res.status(200).send("");
      }

      // Map category name to ID
      const categories = await db.getAllCategories(user.id);
      const categoryMap: Record<string, number> = {
        'Alimentação': categories.find(c => c.name === 'Alimentação')?.id || 1,
        'Transporte': categories.find(c => c.name === 'Transporte')?.id || 2,
        'Saúde': categories.find(c => c.name === 'Saúde')?.id || 3,
        'Lazer': categories.find(c => c.name === 'Lazer')?.id || 4,
        'Moradia': categories.find(c => c.name === 'Moradia')?.id || 5,
        'Educação': categories.find(c => c.name === 'Educação')?.id || 6,
        'Outros': categories.find(c => c.name === 'Outros')?.id || 7,
      };
      
      const categoryId = categoryMap[parsed.category] || categoryMap['Outros'];

      await db.createTransaction({
        userId: user.id,
        goalId: activeGoal.id,
        reason: parsed.description,
        amount: parsed.amount,
        categoryId: categoryId,
        type: "expense",
        source: "whatsapp"
      });

      console.log("[WhatsApp] Transaction created successfully");

      // Send confirmation
      if (twilioClient && ENV.twilioWhatsappNumber) {
        const goals = await db.getActiveGoals(user.id);
        const totalSaved = goals.reduce((sum: number, g: any) => sum + g.currentAmount, 0);

        console.log("[WhatsApp] Sending confirmation message...");
        await twilioClient.messages.create({
          from: `whatsapp:${ENV.twilioWhatsappNumber}`,
          to: From,
          body: `✅ *Gasto registrado!*\n\n📝 ${parsed.description}\n💰 R$ ${(parsed.amount / 100).toFixed(2)}\n🏷️ ${parsed.category}\n\n💎 Economias: R$ ${(totalSaved / 100).toFixed(2)}`
        });
        console.log("[WhatsApp] Confirmation sent");
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
