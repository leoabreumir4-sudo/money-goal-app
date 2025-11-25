import { router, protectedProcedure } from "./_core/trpc";
import { plaidClient, isPlaidConfigured } from "./_core/plaid";
import { z } from "zod";
import * as db from "./db";
import {
  CountryCode,
  Products,
  LinkTokenCreateRequest,
  ItemPublicTokenExchangeRequest,
  TransactionsGetRequest,
} from "plaid";
import { TRPCError } from "@trpc/server";

export const plaidRouter = router({
  /**
   * Create a link token for Plaid Link initialization
   */
  createLinkToken: protectedProcedure.query(async ({ ctx }) => {
    if (!isPlaidConfigured) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Plaid integration is not configured. Please add PLAID_CLIENT_ID and PLAID_SECRET environment variables.",
      });
    }

    try {
      const request: LinkTokenCreateRequest = {
        user: {
          client_user_id: ctx.user.openId,
        },
        client_name: "MoneyGoal",
        products: [Products.Transactions],
        country_codes: ["US", "GB", "ES", "BR"],
        language: "en",
      };

      const response = await plaidClient.linkTokenCreate(request);
      return { linkToken: response.data.link_token };
    } catch (error) {
      console.error("Error creating link token:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create link token",
      });
    }
  }),

  /**
   * Exchange public token for access token and save bank account
   */
  exchangePublicToken: protectedProcedure
    .input(
      z.object({
        publicToken: z.string(),
        metadata: z.object({
          institution: z
            .object({
              name: z.string(),
              institution_id: z.string(),
            })
            .optional(),
          accounts: z.array(
            z.object({
              id: z.string(),
              name: z.string().optional(),
              mask: z.string().optional(),
              type: z.string().optional(),
              subtype: z.string().optional(),
            })
          ),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const request: ItemPublicTokenExchangeRequest = {
          public_token: input.publicToken,
        };

        const response = await plaidClient.itemPublicTokenExchange(request);
        const accessToken = response.data.access_token;
        const itemId = response.data.item_id;

        // Save bank account to database
        await db.createBankAccount({
          userId: ctx.user.id,
          plaidItemId: itemId,
          plaidAccessToken: accessToken,
          institutionName: input.metadata.institution?.name || "Unknown",
          institutionId: input.metadata.institution?.institution_id || "",
          accountIds: JSON.stringify(input.metadata.accounts.map((a) => a.id)),
          isActive: true,
        });

        return { success: true, itemId };
      } catch (error) {
        console.error("Error exchanging public token:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to connect bank account",
        });
      }
    }),

  /**
   * Get list of connected bank accounts
   */
  getConnectedAccounts: protectedProcedure.query(async ({ ctx }) => {
    const accounts = await db.getBankAccountsByUserId(ctx.user.id);
    return accounts;
  }),

  /**
   * Sync transactions from a connected bank account
   */
  syncTransactions: protectedProcedure
    .input(
      z.object({
        bankAccountId: z.number(),
        goalId: z.number(),
        startDate: z.string(), // YYYY-MM-DD format
        endDate: z.string(), // YYYY-MM-DD format
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Get bank account
        const bankAccount = await db.getBankAccountById(input.bankAccountId);
        if (!bankAccount || bankAccount.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Bank account not found",
          });
        }

        // Fetch transactions from Plaid
        const request: TransactionsGetRequest = {
          access_token: bankAccount.plaidAccessToken,
          start_date: input.startDate,
          end_date: input.endDate,
        };

        const response = await plaidClient.transactionsGet(request);
        const transactions = response.data.transactions;

        // Import transactions to database
        let importedCount = 0;
        for (const txn of transactions) {
          // Skip pending transactions
          if (txn.pending) continue;

          // Determine if it's income or expense
          const isExpense = txn.amount > 0;
          const type = isExpense ? "expense" : "income";
          const amount = Math.abs(Math.round(txn.amount * 100)); // Convert to cents

          await db.createTransaction({
            userId: ctx.user.id,
            goalId: input.goalId,
            type,
            amount,
            reason: txn.name || txn.merchant_name || "Bank transaction",
            createdDate: new Date(txn.date),
            categoryId: null, // Could be enhanced to map Plaid categories to app categories
          });

          importedCount++;
        }

        // Update last sync date
        await db.updateBankAccountLastSync(input.bankAccountId);

        return {
          success: true,
          importedCount,
          totalTransactions: transactions.length,
        };
      } catch (error) {
        console.error("Error syncing transactions:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to sync transactions",
        });
      }
    }),

  /**
   * Disconnect a bank account
   */
  disconnectAccount: protectedProcedure
    .input(z.object({ bankAccountId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const bankAccount = await db.getBankAccountById(input.bankAccountId);
      if (!bankAccount || bankAccount.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bank account not found",
        });
      }

      await db.deactivateBankAccount(input.bankAccountId);
      return { success: true };
    }),
});
