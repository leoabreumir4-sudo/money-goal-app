import { router, publicProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { getBalanceStatement, getProfiles } from "./_core/wise";
import { convertAmount } from "./_core/currencyConversion";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";

/**
 * Validate Wise webhook signature
 * Wise signs webhooks with HMAC-SHA256 using the webhook secret
 */
function validateWiseWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  const computedSignature = hmac.digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computedSignature)
  );
}

export const webhookRouter = router({
  /**
   * Wise webhook endpoint
   * Receives events from Wise API (balance updates, transfer changes)
   */
  wise: publicProcedure
    .input(z.object({
      signature: z.string(), // From X-Signature header
      payload: z.string(), // Raw JSON body
      userId: z.string(), // Custom header we add to identify user
    }))
    .mutation(async ({ input }) => {
      try {
        // Get user settings to retrieve webhook secret
        const settings = await db.getUserSettings(input.userId);
        
        if (!settings?.wiseWebhookSecret) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Wise webhook secret not configured.",
          });
        }

        // Validate signature
        const isValid = validateWiseWebhookSignature(
          input.payload,
          input.signature,
          settings.wiseWebhookSecret
        );

        if (!isValid) {
          console.error("Invalid Wise webhook signature");
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid webhook signature.",
          });
        }

        // Parse webhook payload
        const event = JSON.parse(input.payload);
        
        console.log("Received Wise webhook event:", event.event_type);

        // Handle different event types
        switch (event.event_type) {
          case "balances#credit":
          case "balances#update":
            await handleBalanceUpdate(input.userId, event, settings);
            break;
          
          case "transfers#state-change":
            await handleTransferStateChange(input.userId, event, settings);
            break;
          
          default:
            console.log("Unhandled webhook event type:", event.event_type);
        }

        return { success: true, processed: event.event_type };
      } catch (error) {
        console.error("Error processing Wise webhook:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to process webhook.",
        });
      }
    }),
});

/**
 * Handle balance update events
 * Fetches recent transactions and creates them in DB
 */
async function handleBalanceUpdate(
  userId: string,
  event: any,
  settings: any
) {
  if (!settings.wiseApiToken) return;

  try {
    const profiles = await getProfiles(settings.wiseApiToken);
    if (profiles.length === 0) return;

    const profileId = profiles[0].id;
    const currency = event.data?.currency || settings.currency || "USD";
    
    // Fetch transactions from last 7 days
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const statement = await getBalanceStatement(
      settings.wiseApiToken,
      profileId,
      currency,
      startDate,
      endDate
    );

    // Get user's active goal
    const goal = await db.getActiveGoal(userId);
    if (!goal) return;
    const goalId = goal.id;

    const preferredCurrency = settings.currency || "USD";

    // Process new transactions
    for (const transaction of statement.transactions) {
      // Skip if already exists
      const existing = await db.getTransactionsByGoalId(goalId, userId);
      const alreadyExists = existing.some(t =>
        t.reason.includes(transaction.referenceNumber)
      );

      if (alreadyExists) continue;

      let amount = Math.abs(Math.round(transaction.amount.value * 100));
      const type = transaction.amount.value > 0 ? "income" : "expense";

      // Convert to preferred currency if needed
      if (currency !== preferredCurrency) {
        amount = await convertAmount(amount, currency, preferredCurrency);
      }

      let reason = transaction.details.description || "Wise transaction";
      if (transaction.details.recipient?.name) {
        reason = `${transaction.details.recipient.name} - ${reason}`;
      } else if (transaction.details.merchant?.name) {
        reason = `${transaction.details.merchant.name} - ${reason}`;
      }

      if (currency !== preferredCurrency) {
        const originalAmount = Math.abs(transaction.amount.value);
        reason += ` (${originalAmount.toFixed(2)} ${currency} → ${preferredCurrency})`;
      }

      reason += ` (Ref: ${transaction.referenceNumber})`;

      await db.createTransaction({
        userId,
        goalId,
        type,
        amount,
        reason,
        source: "wise",
      });

      console.log(`Auto-synced Wise transaction: ${reason}`);
    }
  } catch (error) {
    console.error("Error handling balance update webhook:", error);
  }
}

/**
 * Handle transfer state change events
 * Similar logic to balance updates
 */
async function handleTransferStateChange(
  userId: string,
  event: any,
  settings: any
) {
  // For now, trigger same logic as balance update
  await handleBalanceUpdate(userId, event, settings);
}
