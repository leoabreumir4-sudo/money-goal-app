import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import * as db from "./db";
import { categorizeTransaction } from "./_core/categorization";

export const categoryRouter = router({
  // Get all categories (default + user's custom)
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return await db.getAllCategories(ctx.user.id);
  }),

  // Get category by ID
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await db.getCategoryById(input.id);
    }),

  // Create custom category
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        emoji: z.string().max(10),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
        keywords: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await db.createCategory({
        userId: ctx.user.id,
        name: input.name,
        emoji: input.emoji,
        color: input.color,
        keywords: input.keywords || [],
        isDefault: false,
      });
    }),

  // Update category
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        emoji: z.string().max(10).optional(),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
        keywords: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const category = await db.getCategoryById(input.id);
      
      // Only allow updating user's own categories (not defaults)
      if (!category || (category.userId !== ctx.user.id && category.isDefault)) {
        throw new Error("Cannot update this category");
      }

      const { id, ...updateData } = input;
      return await db.updateCategory(id, updateData);
    }),

  // Delete category
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const category = await db.getCategoryById(input.id);
      
      // Only allow deleting user's own categories (not defaults)
      if (!category || category.userId !== ctx.user.id) {
        throw new Error("Cannot delete this category");
      }

      await db.deleteCategory(input.id);
      return { success: true };
    }),

  // Auto-categorize a description
  suggestCategory: protectedProcedure
    .input(z.object({ description: z.string() }))
    .query(async ({ ctx, input }) => {
      const categories = await db.getAllCategories();
      const filtered = categories.filter(c => c.isDefault || c.userId === ctx.user.id);
      const categoryId = categorizeTransaction(input.description, filtered);
      
      if (!categoryId) return null;
      return await db.getCategoryById(categoryId);
    }),
});
