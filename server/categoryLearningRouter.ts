import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";

/**
 * Category Learning Router
 * 
 * Smart auto-categorization that learns from user behavior:
 * - Stores user corrections to improve future suggestions
 * - Provides multiple suggestions with confidence scores
 * - Uses pattern matching with learned mappings
 */
export const categoryLearningRouter = router({
  /**
   * Get smart category suggestions for a transaction
   * Returns top 3 suggestions based on learned patterns
   */
  getSuggestions: protectedProcedure
    .input(z.object({
      description: z.string().min(1),
      amount: z.number().int().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { description, amount } = input;
      
      // Get user's categories
      const categories = await db.getAllCategories(ctx.user.id);
      if (categories.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No categories found. Please create categories first.",
        });
      }

      // Get all learned mappings for this user
      const learned = await db.getAllCategoryLearning(ctx.user.id);
      
      // Score each category based on learned patterns
      const scores = new Map<number, { score: number; reason: string }>();
      
      // Check learned mappings first (highest priority)
      for (const mapping of learned) {
        const pattern = mapping.keyword.toLowerCase();
        const desc = description.toLowerCase();
        
        if (desc.includes(pattern) || pattern.includes(desc)) {
          const currentScore = scores.get(mapping.categoryId) || { score: 0, reason: "" };
          const confidence = mapping.confidence || 1;
          
          scores.set(mapping.categoryId, {
            score: currentScore.score + (100 * confidence),
            reason: `Learned from previous "${mapping.keyword}" transactions`,
          });
        }
      }
      
      // Fallback to basic keyword matching if no learned patterns
      if (scores.size === 0) {
        const categoryKeywords = {
          food: ["restaurant", "food", "cafe", "coffee", "lunch", "dinner", "breakfast", "grocery", "supermarket"],
          transport: ["uber", "taxi", "gas", "fuel", "metro", "bus", "parking", "transport"],
          entertainment: ["movie", "cinema", "game", "netflix", "spotify", "concert", "theater"],
          shopping: ["store", "shop", "amazon", "mall", "clothing", "shoes"],
          health: ["pharmacy", "doctor", "hospital", "gym", "fitness", "medication"],
          bills: ["rent", "electricity", "water", "internet", "phone", "insurance"],
        };

        const desc = description.toLowerCase();
        
        for (const category of categories) {
          const categoryName = category.name.toLowerCase();
          const keywords = categoryKeywords[categoryName as keyof typeof categoryKeywords] || [categoryName];
          
          for (const keyword of keywords) {
            if (desc.includes(keyword)) {
              const currentScore = scores.get(category.id) || { score: 0, reason: "" };
              scores.set(category.id, {
                score: currentScore.score + 50,
                reason: `Matched keyword "${keyword}"`,
              });
            }
          }
        }
      }
      
      // Sort categories by score and return top 3
      const suggestions = Array.from(scores.entries())
        .map(([categoryId, { score, reason }]) => {
          const category = categories.find(c => c.id === categoryId);
          if (!category) return null;
          
          return {
            categoryId,
            categoryName: category.name,
            categoryIcon: category.emoji || "📊",
            confidence: Math.min(100, score) / 100,
            reason,
          };
        })
        .filter(Boolean)
        .sort((a, b) => (b?.confidence || 0) - (a?.confidence || 0))
        .slice(0, 3);

      // If no suggestions, return the "Other" or first category as fallback
      if (suggestions.length === 0) {
        const fallbackCategory = categories.find(c => c.name.toLowerCase() === "other") || categories[0];
        return [{
          categoryId: fallbackCategory.id,
          categoryName: fallbackCategory.name,
          categoryIcon: fallbackCategory.emoji || "📊",
          confidence: 0.3,
          reason: "Default category (no patterns matched)",
        }];
      }

      return suggestions;
    }),

  /**
   * Learn from user's category choice
   * Called when user creates/edits transaction with category
   */
  learn: protectedProcedure
    .input(z.object({
      pattern: z.string().min(1).max(255),
      categoryId: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { pattern, categoryId } = input;
      
      // Verify category exists and belongs to user
      const categories = await db.getAllCategories(ctx.user.id);
      const category = categories.find(c => c.id === categoryId);
      if (!category) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Category not found",
        });
      }

      // Check if mapping already exists
      const existing = await db.getCategoryLearningByPattern(
        ctx.user.id,
        pattern.toLowerCase()
      );

      if (existing) {
        // If same category, increase confidence
        if (existing.categoryId === categoryId) {
          await db.updateCategoryLearning(existing.id, ctx.user.id, {
            confidence: Math.min(1, (existing.confidence || 1) + 0.1),
            lastUsed: new Date(),
          });
        } else {
          // Different category chosen - replace with new mapping at lower confidence
          await db.updateCategoryLearning(existing.id, ctx.user.id, {
            categoryId,
            confidence: 0.5,
            lastUsed: new Date(),
          });
        }
      } else {
        // Create new learned mapping
        await db.learnCategoryMapping(ctx.user.id, pattern.toLowerCase(), categoryId);
      }

      return { success: true };
    }),

  /**
   * Get all learned patterns for review/management
   */
  getAllLearned: protectedProcedure.query(async ({ ctx }) => {
    const learned = await db.getAllCategoryLearning(ctx.user.id);
    const categories = await db.getAllCategories(ctx.user.id);
    
    return learned.map((mapping: any) => ({
      id: mapping.id,
      pattern: mapping.pattern,
      categoryId: mapping.categoryId,
      categoryName: categories.find(c => c.id === mapping.categoryId)?.name || "Unknown",
      confidence: mapping.confidence || 1,
      lastUsed: mapping.lastUsed,
    }));
  }),

  /**
   * Delete a learned pattern
   */
  deleteLearned: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteCategoryLearning(input.id, ctx.user.id);
      return { success: true };
    }),

  /**
   * Reset all learned patterns (start fresh)
   */
  resetLearning: protectedProcedure.mutation(async ({ ctx }) => {
    const learned = await db.getAllCategoryLearning(ctx.user.id);
    
    for (const mapping of learned) {
      await db.deleteCategoryLearning(mapping.id, ctx.user.id);
    }
    
    return { success: true, deletedCount: learned.length };
  }),
});
