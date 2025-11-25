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

/**
 * Parse Wise CSV format
 * Format: ID,Status,Direction,"Created on","Finished on","Source name","Source amount (after fees)","Source currency","Target name","Target amount (after fees)","Target currency",...
 * 
 * Rules:
 * - Only imports IN and OUT transactions (skips NEUTRAL conversions)
 * - Detects internal transfers when source name = target name
 * - OUT to self: "Transferred to another bank"
 * - Uses original transaction amounts (no conversion)
 * - Simplified descriptions without amount values
 */
function parseWiseCSV(csvContent: string): Array<{
  date: string;
  description: string;
  amount: number;
  currency: string;
  reference: string;
}> {
  const lines = csvContent.trim().split("\n");
  const transactions: Array<{ date: string; description: string; amount: number; currency: string; reference: string }> = [];

  if (lines.length < 2) return transactions;

  // Parse header to find column indices
  const header = lines[0].split(",").map(h => h.replace(/"/g, "").trim());
  const finishedOnIdx = header.findIndex(h => h.toLowerCase() === "finished on");
  const sourceNameIdx = header.findIndex(h => h.toLowerCase() === "source name");
  const targetNameIdx = header.findIndex(h => h.toLowerCase() === "target name");
  const sourceAmountIdx = header.findIndex(h => h.toLowerCase() === "source amount (after fees)");
  const targetAmountIdx = header.findIndex(h => h.toLowerCase() === "target amount (after fees)");
  const sourceCurrencyIdx = header.findIndex(h => h.toLowerCase() === "source currency");
  const targetCurrencyIdx = header.findIndex(h => h.toLowerCase() === "target currency");
  const referenceIdx = header.findIndex(h => h.toLowerCase() === "reference");
  const directionIdx = header.findIndex(h => h.toLowerCase() === "direction");

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV line properly (handle quoted fields with commas)
    const parts: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        parts.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    parts.push(current.trim());

    if (parts.length < header.length - 5) continue; // Allow some missing columns

    const date = parts[finishedOnIdx]?.replace(/"/g, "");
    const sourceName = parts[sourceNameIdx]?.replace(/"/g, "");
    const targetName = parts[targetNameIdx]?.replace(/"/g, "");
    const sourceAmount = parseFloat(parts[sourceAmountIdx] || "0");
    const targetAmount = parseFloat(parts[targetAmountIdx] || "0");
    const sourceCurrency = parts[sourceCurrencyIdx]?.replace(/"/g, "");
    const targetCurrency = parts[targetCurrencyIdx]?.replace(/"/g, "");
    const reference = parts[referenceIdx]?.replace(/"/g, "") || "";
    const direction = parts[directionIdx]?.replace(/"/g, "");

    if (!date || isNaN(sourceAmount) || isNaN(targetAmount)) continue;

    // Skip NEUTRAL transactions (currency conversions)
    if (direction === "NEUTRAL") {
      continue;
    }

    let amount: number;
    let currency: string;
    let description: string;

    if (direction === "IN") {
      // Money coming in - use target amount and show source
      amount = targetAmount;
      currency = targetCurrency;
      description = sourceName || "Income";
    } else if (direction === "OUT") {
      // Money going out - check if it's to self or external
      amount = -sourceAmount;
      currency = sourceCurrency;
      
      // Check if source and target names are the same (internal transfer)
      if (sourceName && targetName && sourceName.trim() === targetName.trim()) {
        // Transfer to another bank account of yours
        description = "Transferred to another bank";
      } else {
        // External payment
        description = targetName || "Expense";
      }
    } else {
      continue;
    }

    transactions.push({
      date,
      description: description.trim(),
      amount,
      currency,
      reference: reference || `${date}-${Math.abs(amount)}`,
    });
  }

  return transactions;
}

export const csvRouter = router({
  /**
   * Delete all Wise imported transactions for a goal
   */
  clearWiseTransactions: protectedProcedure
    .input(z.object({
      goalId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteWiseTransactions(ctx.user.id, input.goalId);
      return { success: true };
    }),

  /**
   * Import Wise CSV transactions
   */
  importWiseCSV: protectedProcedure
    .input(z.object({
      goalId: z.number(),
      csvContent: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const transactions = parseWiseCSV(input.csvContent);

        if (transactions.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No valid transactions found in Wise CSV file.",
          });
        }

        let importedCount = 0;
        let skippedCount = 0;

        for (const transaction of transactions) {
          // Check if transaction already exists (by reference)
          const existing = await db.getTransactionsByGoalId(input.goalId, ctx.user.id);
          const alreadyExists = existing.some(t => 
            t.reason.includes(transaction.reference)
          );

          if (alreadyExists) {
            skippedCount++;
            continue;
          }

          // Use original amount (no conversion)
          const amount = Math.abs(Math.round(transaction.amount * 100)); // Convert to cents
          const type = transaction.amount > 0 ? "income" : "expense";

          // Simple description without amount
          const reason = transaction.description;

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
          skippedCount,
          totalTransactions: transactions.length,
        };
      } catch (error) {
        console.error("Error importing Wise CSV:", error);
        
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to parse Wise CSV file. Please check the format.",
        });
      }
    }),

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
