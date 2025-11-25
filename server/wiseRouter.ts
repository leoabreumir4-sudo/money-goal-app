import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { getProfiles, getBalances, getBalanceStatement } from "./_core/wise";
import { TRPCError } from "@trpc/server";

export const wiseRouter = router({
  /**
   * Save Wise API token to user settings
   */
  saveToken: protectedProcedure
    .input(z.object({
      token: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Validate token by fetching profiles
        await getProfiles(input.token);

        // Update user settings with token
        await db.updateUserSettings(ctx.user.id, {
          wiseApiToken: input.token,
        });

        return { success: true };
      } catch (error) {
        console.error("Error saving Wise token:", error);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid Wise API token. Please check and try again.",
        });
      }
    }),

  /**
   * Remove Wise API token from user settings
   */
  removeToken: protectedProcedure.mutation(async ({ ctx }) => {
    await db.updateUserSettings(ctx.user.id, {
      wiseApiToken: null,
    });
    return { success: true };
  }),

  /**
   * Get Wise balances for all currencies
   */
  getBalances: protectedProcedure.query(async ({ ctx }) => {
    const settings = await db.getUserSettings(ctx.user.id);
    
    if (!settings?.wiseApiToken) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Wise API token not configured. Please add your token in Settings.",
      });
    }

    try {
      const profiles = await getProfiles(settings.wiseApiToken);
      
      if (profiles.length === 0) {
        return [];
      }

      // Get balances for first profile (personal account)
      const balances = await getBalances(settings.wiseApiToken, profiles[0].id);
      
      return balances.map(balance => ({
        currency: balance.currency,
        amount: balance.amount.value,
        type: balance.balanceType,
      }));
    } catch (error) {
      console.error("Error fetching Wise balances:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch Wise balances. Token may have expired.",
      });
    }
  }),

  /**
   * Sync transactions from Wise for a date range
   */
  syncTransactions: protectedProcedure
    .input(z.object({
      goalId: z.number(),
      currency: z.string(),
      startDate: z.string(), // ISO date
      endDate: z.string(), // ISO date
    }))
    .mutation(async ({ ctx, input }) => {
      const settings = await db.getUserSettings(ctx.user.id);
      
      if (!settings?.wiseApiToken) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Wise API token not configured.",
        });
      }

      try {
        const profiles = await getProfiles(settings.wiseApiToken);
        
        if (profiles.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No Wise profiles found.",
          });
        }

        // Get transactions for the period
        const statement = await getBalanceStatement(
          settings.wiseApiToken,
          profiles[0].id,
          input.currency,
          input.startDate,
          input.endDate
        );

        // Create transactions in database
        let importedCount = 0;
        
        for (const transaction of statement.transactions) {
          // Skip if transaction already exists (by reference number)
          const existing = await db.getTransactionsByGoalId(input.goalId, ctx.user.id);
          const alreadyExists = existing.some(t => 
            t.reason.includes(transaction.referenceNumber)
          );
          
          if (alreadyExists) {
            continue;
          }

          const amount = Math.abs(Math.round(transaction.amount.value * 100)); // Convert to cents
          const type = transaction.amount.value > 0 ? "income" : "expense";
          
          // Determine reason/description
          let reason = transaction.details.description || "Wise transaction";
          if (transaction.details.recipient?.name) {
            reason = `${transaction.details.recipient.name} - ${reason}`;
          } else if (transaction.details.merchant?.name) {
            reason = `${transaction.details.merchant.name} - ${reason}`;
          }
          reason += ` (Ref: ${transaction.referenceNumber})`;

          await db.createTransaction({
            userId: ctx.user.id,
            goalId: input.goalId,
            type,
            amount,
            reason,
            source: 'wise',
          });

          importedCount++;
        }

        return { 
          success: true, 
          importedCount,
          totalTransactions: statement.transactions.length,
        };
      } catch (error) {
        console.error("Error syncing Wise transactions:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to sync Wise transactions.",
        });
      }
    }),
});
