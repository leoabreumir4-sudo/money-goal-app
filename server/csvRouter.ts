import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";

/**
 * Parse Nubank CSV format
 * Expected format: date,description,amount
 * Example: 2025-01-15,Compra no iFood,-45.50
 */
function parseNubankCSV(csvContent: string): Array<{
  date: string;
  description: string;
  amount: number;
}> {
  const lines = csvContent.trim().split("\n");
  const transactions: Array<{ date: string; description: string; amount: number }> = [];

  // Skip header if present
  const startIndex = lines[0].toLowerCase().includes("data") || lines[0].toLowerCase().includes("date") ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV line (handle commas in quotes)
    const parts = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g);
    if (!parts || parts.length < 3) continue;

    const date = parts[0].replace(/"/g, "").trim();
    const description = parts[1].replace(/"/g, "").trim();
    const amountStr = parts[2].replace(/"/g, "").trim();

    // Parse amount (handle Brazilian format: R$ 1.234,56 or -1.234,56)
    const cleanAmount = amountStr
      .replace(/R\$\s*/g, "")
      .replace(/\./g, "") // Remove thousands separator
      .replace(",", "."); // Replace decimal comma with dot

    const amount = parseFloat(cleanAmount);

    if (isNaN(amount) || !date) continue;

    transactions.push({
      date,
      description,
      amount,
    });
  }

  return transactions;
}

export const csvRouter = router({
  /**
   * Import Nubank CSV transactions
   */
  importNubankCSV: protectedProcedure
    .input(z.object({
      goalId: z.number(),
      csvContent: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const transactions = parseNubankCSV(input.csvContent);

        if (transactions.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No valid transactions found in CSV file.",
          });
        }

        let importedCount = 0;
        let skippedCount = 0;

        for (const transaction of transactions) {
          // Check if transaction already exists (by description and date)
          const existing = await db.getTransactionsByGoalId(input.goalId, ctx.user.id);
          const alreadyExists = existing.some(t => 
            t.reason.includes(transaction.description) && 
            new Date(t.createdDate).toDateString() === new Date(transaction.date).toDateString()
          );

          if (alreadyExists) {
            skippedCount++;
            continue;
          }

          const amount = Math.abs(Math.round(transaction.amount * 100)); // Convert to cents
          const type = transaction.amount > 0 ? "income" : "expense";

          await db.createTransaction({
            userId: ctx.user.id,
            goalId: input.goalId,
            type,
            amount,
            reason: transaction.description,
            source: 'csv',
          });

          importedCount++;
        }

        return {
          success: true,
          importedCount,
          skippedCount,
          totalTransactions: transactions.length,
        };
      } catch (error) {
        console.error("Error importing Nubank CSV:", error);
        
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to parse CSV file. Please check the format.",
        });
      }
    }),
});
