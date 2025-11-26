import type { Category } from "../../drizzle/schema";

/**
 * Auto-categorize a transaction based on description/name using keyword matching
 */
export function categorizeTransaction(
  description: string,
  categories: Category[]
): number | null {
  if (!description) return null;

  const normalized = description.toLowerCase().trim();

  // Sort categories by keyword count (more specific first)
  const sortedCategories = [...categories].sort((a, b) => {
    const aKeywords = a.keywords?.length || 0;
    const bKeywords = b.keywords?.length || 0;
    return bKeywords - aKeywords;
  });

  // Find first matching category
  for (const category of sortedCategories) {
    if (!category.keywords || category.keywords.length === 0) continue;

    // Check if any keyword matches
    const hasMatch = category.keywords.some((keyword) =>
      normalized.includes(keyword.toLowerCase())
    );

    if (hasMatch) {
      return category.id;
    }
  }

  // If no match, return "Other" category (last one in defaults)
  const otherCategory = categories.find((c) => c.name === "Other");
  return otherCategory?.id || null;
}

/**
 * Get category by name (useful for fallbacks)
 */
export function getCategoryByName(
  name: string,
  categories: Category[]
): Category | undefined {
  return categories.find(
    (c) => c.name.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Extract potential keywords from a transaction description
 * Useful for suggesting keywords to add to categories
 */
export function extractKeywords(description: string): string[] {
  // Remove common words and extract meaningful terms
  const commonWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
  ]);

  const words = description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !commonWords.has(word));

  return Array.from(new Set(words));
}
