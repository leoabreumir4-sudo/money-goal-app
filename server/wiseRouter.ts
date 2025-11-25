import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { getProfiles, getBalances, getBalanceStatement } from "./_core/wise";
import { convertBalances, convertAmount } from "./_core/currencyConversion";
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
   * Get Wise balances converted to user's preferred currency
   */
  getBalancesConverted: protectedProcedure.query(async ({ ctx }) => {
    const settings = await db.getUserSettings(ctx.user.id);
    
    if (!settings?.wiseApiToken) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Wise API token not configured. Please add your token in Settings.",
      });
    }

    const preferredCurrency = settings.currency || "USD";

    try {
      const profiles = await getProfiles(settings.wiseApiToken);
      
      if (profiles.length === 0) {
        return [];
      }

      // Get balances for first profile (personal account)
      const balances = await getBalances(settings.wiseApiToken, profiles[0].id);
      
      // Convert to cents and map to our format
      const balancesInCents = balances.map(balance => ({
        currency: balance.currency,
        amount: Math.round(balance.amount.value * 100), // Convert to cents
      }));

      // Convert all balances to preferred currency
      const converted = await convertBalances(balancesInCents, preferredCurrency);
      
      return converted.map((conv) => ({
        currency: conv.currency,
        originalAmount: conv.originalAmount, // in cents
        convertedAmount: conv.convertedAmount, // in cents
        conversionRate: conv.conversionRate,
        targetCurrency: preferredCurrency,
      }));
    } catch (error) {
      console.error("Error fetching converted Wise balances:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch Wise balances. Token may have expired.",
      });
    }
  }),

  /**
   * Get total Wise balance converted to user's preferred currency
   * Returns the sum of all balances in cents
   */
  getTotalBalanceConverted: protectedProcedure.query(async ({ ctx }) => {
    const settings = await db.getUserSettings(ctx.user.id);
    
    // Return 0 if no Wise token configured
    if (!settings?.wiseApiToken) {
      return 0;
    }

    const preferredCurrency = settings.currency || "USD";

    try {
      const profiles = await getProfiles(settings.wiseApiToken);
      
      if (profiles.length === 0) {
        return 0;
      }

      // Get balances for first profile (personal account)
      const balances = await getBalances(settings.wiseApiToken, profiles[0].id);
      
      // Convert to cents and map to our format
      const balancesInCents = balances.map(balance => ({
        currency: balance.currency,
        amount: Math.round(balance.amount.value * 100), // Convert to cents
      }));

      // Convert all balances to preferred currency
      const converted = await convertBalances(balancesInCents, preferredCurrency);
      
      // Sum all converted amounts
      const totalAmount = converted.reduce((sum, balance) => sum + balance.convertedAmount, 0);
      
      return totalAmount; // in cents
    } catch (error) {
      console.error("Error fetching total Wise balance:", error);
      // Return 0 on error instead of throwing, so it doesn't break the goal display
      return 0;
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

      const preferredCurrency = settings.currency || "USD";

      try {
        const profiles = await getProfiles(settings.wiseApiToken);
        
        if (profiles.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No Wise profiles found.",
          });
        }

        // Get transactions for the period
        let statement;
        try {
          statement = await getBalanceStatement(
            settings.wiseApiToken,
            profiles[0].id,
            input.currency,
            input.startDate,
            input.endDate
          );
        } catch (error: any) {
          console.error("Error fetching Wise statement:", error);
          
          // Check if it's a 404 - might mean no transactions for this currency
          if (error.response?.status === 404) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: `No transactions found for ${input.currency} in the specified period. Make sure you have a ${input.currency} balance with transaction history.`,
            });
          }
          
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch Wise transactions. " + (error.response?.data?.message || error.message),
          });
        }

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

          let amount = Math.abs(Math.round(transaction.amount.value * 100)); // Convert to cents
          const type = transaction.amount.value > 0 ? "income" : "expense";
          
          // Convert amount to user's preferred currency if different
          if (input.currency !== preferredCurrency) {
            amount = await convertAmount(amount, input.currency, preferredCurrency);
          }
          
          // Determine reason/description
          let reason = transaction.details.description || "Wise transaction";
          if (transaction.details.recipient?.name) {
            reason = `${transaction.details.recipient.name} - ${reason}`;
          } else if (transaction.details.merchant?.name) {
            reason = `${transaction.details.merchant.name} - ${reason}`;
          }
          
          // Include original currency info if converted
          if (input.currency !== preferredCurrency) {
            const originalAmount = Math.abs(transaction.amount.value);
            reason += ` (${originalAmount.toFixed(2)} ${input.currency} → ${preferredCurrency})`;
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
