import { eq, and, or, desc, asc, gte, lte, isNull, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../drizzle/schema";
import { 
  InsertUser, 
  users, 
  goals, 
  InsertGoal, 
  transactions, 
  InsertTransaction, 
  categories, 
  InsertCategory, 
  userSettings, 
  InsertUserSettings, 
  recurringExpenses, 
  InsertRecurringExpense, 
  projects, 
  InsertProject, 
  events, 
  InsertEvent,
  chatMessages,
  InsertChatMessage,
  monthlyPayments,
  InsertMonthlyPayment,
  budgets,
  InsertBudget,
  billReminders,
  InsertBillReminder,
  aiInsights,
  InsertAIInsight,
  categoryLearning,
  InsertCategoryLearning,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const pool = new Pool({ 
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 30000,
        ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
      });
      _db = drizzle(pool, { schema });
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      throw error;
    }
  }
  if (!_db) {
    throw new Error("Database not initialized");
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

// ---------- CORREÇÃO: Selecionar explicitamente campos essenciais para evitar erro de mapeamento do Drizzle ORM ----------
export async function getAllUsers() {
  const db = getDb();
  if (!db) {
    console.warn("[Database] Cannot get all users: database not available");
    return [];
  }

  const result = await db
    .select({
      id: users.id,
      openId: users.openId,
      email: users.email,
      name: users.name,
    })
    .from(users);

  return result;
}

export async function getUserByEmail(email: string) {
  const db = getDb();
  if (!db) {
    console.warn("[Database] Cannot get user by email: database not available");
    return undefined;
  }

  // Seleciona apenas campos essenciais para evitar problemas com colunas ausentes
  const result = await db
    .select({
      id: users.id,
      openId: users.openId,
      email: users.email,
      name: users.name,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByOpenId(openId: string) {
  const db = getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select({
      id: users.id,
      openId: users.openId,
      email: users.email,
      name: users.name,
      passwordHash: users.passwordHash,
      phoneNumber: users.phoneNumber,
      phoneVerified: users.phoneVerified,
    })
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByPhone(phoneNumber: string) {
  const db = getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select({
      id: users.id,
      openId: users.openId,
      email: users.email,
      name: users.name,
      phoneNumber: users.phoneNumber,
      phoneVerified: users.phoneVerified,
    })
    .from(users)
    .where(eq(users.phoneNumber, phoneNumber))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(userId: string) {
  const db = getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select({
      id: users.id,
      openId: users.openId,
      email: users.email,
      name: users.name,
      phoneNumber: users.phoneNumber,
      phoneVerified: users.phoneVerified,
    })
    .from(users)
    .where(eq(users.openId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserPhone(userId: string, phoneNumber: string | null) {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(users)
    .set({ 
      phoneNumber,
      phoneVerified: phoneNumber ? false : null,
      updatedAt: new Date(),
    })
    .where(eq(users.openId, userId));
}

export async function verifyUserPhone(userId: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(users)
    .set({ 
      phoneVerified: true,
      updatedAt: new Date(),
    })
    .where(eq(users.openId, userId));
}

// -------------------------------------------------------------------------------

// Goals
export async function createGoal(goal: InsertGoal) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(goals).values(goal);
  return result;
}

export async function getGoalsByUserId(userId: string) {
  const db = getDb();
  if (!db) return [];
  
  return await db.select().from(goals).where(eq(goals.userId, userId));
}

export async function getActiveGoal(userId: string) {
  const db = getDb();
  const result = await db
    .select()
    .from(goals)
    .where(and(eq(goals.userId, userId), isNull(goals.archivedDate), isNull(goals.completedDate)))
    .limit(1);
  return result[0] ?? null;
}

export async function getActiveGoals(userId: string) {
  const db = getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(goals)
    .where(and(eq(goals.userId, userId), isNull(goals.archivedDate), isNull(goals.completedDate)))
    .orderBy(asc(goals.priority)); // Order by priority
}

export async function getEmergencyFund(userId: string) {
  const db = getDb();
  const result = await db
    .select()
    .from(goals)
    .where(and(
      eq(goals.userId, userId), 
      eq(goals.goalType, "emergency"),
      eq(goals.status, "active")
    ))
    .limit(1);
  return result[0] ?? null;
}

export async function getSavingsGoals(userId: string) {
  const db = getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(goals)
    .where(and(
      eq(goals.userId, userId),
      eq(goals.goalType, "savings"),
      eq(goals.status, "active")
    ))
    .orderBy(asc(goals.priority));
}

export async function getGoalById(id: number, userId: string) {
  const db = getDb();
  const result = await db
    .select()
    .from(goals)
    .where(and(eq(goals.id, id), eq(goals.userId, userId)))
    .limit(1);
  return result[0] ?? null;
}

export async function getArchivedGoals(userId: string) {
  const db = getDb();
  if (!db) return [];
  
  return await db.select().from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.status, "archived")))
    .orderBy(desc(goals.archivedDate));
}

export async function updateGoal(id: number, userId: string, data: Partial<InsertGoal>) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(goals).set(data).where(and(eq(goals.id, id), eq(goals.userId, userId)));
}

export async function deleteGoal(id: number, userId: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, userId)));
}

// Transactions
export async function createTransaction(transaction: InsertTransaction) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(transactions).values(transaction).returning();
  return result[0];
}

export async function getTransactionsByGoalId(goalId: number, userId: string) {
  const db = getDb();
  if (!db) return [];
  
  return await db.select().from(transactions)
    .where(and(eq(transactions.goalId, goalId), eq(transactions.userId, userId)))
    .orderBy(desc(transactions.createdDate));
}

export async function getAllTransactionsByUserId(userId: string) {
  const db = getDb();
  if (!db) return [];
  
  return await db.select().from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.createdDate));
}

export async function getTransactionsByDateRange(userId: string, startDate: Date, endDate: Date) {
  const db = getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.createdDate, startDate),
        lte(transactions.createdDate, endDate)
      )
    )
    .orderBy(desc(transactions.createdDate));
}

export async function updateTransaction(id: number, userId: string, data: Partial<InsertTransaction>) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(transactions).set(data).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
}

export async function deleteTransaction(id: number, userId: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
}

export async function deleteWiseTransactions(userId: string, goalId: number) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(transactions).where(
    and(
      eq(transactions.userId, userId),
      eq(transactions.goalId, goalId),
      eq(transactions.source, 'wise')
    )
  );
}

// Categories
export async function createCategory(category: InsertCategory) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(categories).values(category).returning();
  return result[0];
}

export async function getAllCategories(userId?: string) {
  const db = getDb();
  if (!db) return [];
  
  if (!userId) {
    // Get only default categories if no user specified
    return await db.select().from(categories).where(eq(categories.isDefault, true)).orderBy(asc(categories.name));
  }
  
  // Get default categories OR user's custom categories
  return await db.select().from(categories).where(
    or(
      eq(categories.isDefault, true),
      eq(categories.userId, userId)
    )
  ).orderBy(asc(categories.name));
}

export async function getCategoriesByUserId(userId: string) {
  const db = getDb();
  if (!db) return [];
  
  // Get default categories (userId is null) AND user's custom categories
  return await db.select().from(categories).where(
    eq(categories.userId, userId)
  ).orderBy(asc(categories.name));
}

export async function getCategoryById(id: number) {
  const db = getDb();
  if (!db) return null;
  
  const result = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateCategory(id: number, data: Partial<InsertCategory>) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.update(categories).set(data).where(eq(categories.id, id)).returning();
  return result[0];
}

export async function deleteCategory(id: number) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(categories).where(eq(categories.id, id));
}

// User Settings
export async function getUserSettings(userId: string) {
  const db = getDb();
  if (!db) return null;
  
  const result = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createUserSettings(settings: InsertUserSettings) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(userSettings).values(settings);
  return result;
}

export async function updateUserSettings(userId: string, data: Partial<InsertUserSettings>) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if settings exist
  const existing = await getUserSettings(userId);
  
  if (!existing) {
    // Create new settings with defaults
    const defaultSettings: InsertUserSettings = {
      userId,
      language: 'en',
      currency: 'USD',
      theme: 'dark',
      monthlySavingTarget: 0,
      hasUnreadArchived: false,
      ...data, // Override with provided data
    };
    await db.insert(userSettings).values(defaultSettings);
  } else {
    // Update existing settings
    await db.update(userSettings).set(data).where(eq(userSettings.userId, userId));
  }
}

// Recurring Expenses
export async function createRecurringExpense(expense: InsertRecurringExpense) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(recurringExpenses).values(expense);
  return result;
}

export async function getRecurringExpensesByUserId(userId: string) {
  const db = getDb();
  if (!db) return [];
  
  return await db.select().from(recurringExpenses).where(eq(recurringExpenses.userId, userId));
}

export async function updateRecurringExpense(id: number, userId: string, data: Partial<InsertRecurringExpense>) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(recurringExpenses).set(data).where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.userId, userId)));
}

export async function deleteRecurringExpense(id: number, userId: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(recurringExpenses).where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.userId, userId)));
}

// Projects
export async function createProject(project: InsertProject) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(projects).values(project);
  return result;
}

export async function getProjectsByUserId(userId: string) {
  const db = getDb();
  if (!db) return [];
  
  return await db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.createdDate));
}

export async function updateProject(id: number, userId: string, data: Partial<InsertProject>) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(projects).set(data).where(and(eq(projects.id, id), eq(projects.userId, userId)));
}

export async function deleteProject(id: number, userId: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(projects).where(and(eq(projects.id, id), eq(projects.userId, userId)));
}

// Events
export async function createEvent(event: InsertEvent) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(events).values(event);
  return result;
}

export async function getEventsByUserId(userId: string) {
  const db = getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(events)
    .where(eq(events.userId, userId))
    .orderBy(asc(events.sortOrder), asc(events.id));
}

export async function getEventById(id: number, userId: string) {
  const db = getDb();
  const result = await db
    .select()
    .from(events)
    .where(and(eq(events.id, id), eq(events.userId, userId)))
    .limit(1);
  return result[0] ?? null;
}

export async function updateEvent(id: number, userId: string, data: Partial<InsertEvent>) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(events).set(data).where(and(eq(events.id, id), eq(events.userId, userId)));
}

export async function deleteEvent(id: number, userId: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(events).where(and(eq(events.id, id), eq(events.userId, userId)));
}

// Chat Messages
export async function createChatMessage(message: InsertChatMessage) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(chatMessages).values(message);
  return result;
}

export async function getChatMessagesByUserId(userId: string) {
  const db = getDb();
  if (!db) return [];
  
  return await db.select().from(chatMessages).where(eq(chatMessages.userId, userId)).orderBy(asc(chatMessages.createdDate));
}

export async function clearChatMessages(userId: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(chatMessages).where(eq(chatMessages.userId, userId));
}

// Monthly Payments
export async function createMonthlyPayment(payment: InsertMonthlyPayment) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(monthlyPayments).values(payment);
  return result;
}

export async function getMonthlyPaymentsByUserId(userId: string) {
  const db = getDb();
  if (!db) return [];
  
  return await db.select().from(monthlyPayments).where(eq(monthlyPayments.userId, userId)).orderBy(desc(monthlyPayments.createdDate));
}

export async function updateMonthlyPayment(id: number, userId: string, data: Partial<InsertMonthlyPayment>) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(monthlyPayments).set(data).where(and(eq(monthlyPayments.id, id), eq(monthlyPayments.userId, userId)));
}

export async function deleteMonthlyPayment(id: number, userId: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(monthlyPayments).where(and(eq(monthlyPayments.id, id), eq(monthlyPayments.userId, userId)));
}

// ============================================================================
// BUDGETS - Budget Planning & Alerts
// ============================================================================

export async function createBudget(budget: InsertBudget) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(budgets).values(budget).returning();
  return result[0];
}

export async function getBudgetsByUserId(userId: string) {
  const db = getDb();
  if (!db) return [];
  
  return await db.select().from(budgets).where(eq(budgets.userId, userId)).orderBy(asc(budgets.createdDate));
}

export async function getBudgetById(id: number, userId: string) {
  const db = getDb();
  const result = await db.select().from(budgets).where(and(eq(budgets.id, id), eq(budgets.userId, userId))).limit(1);
  return result[0] ?? null;
}

export async function updateBudget(id: number, userId: string, data: Partial<InsertBudget>) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(budgets).set(data).where(and(eq(budgets.id, id), eq(budgets.userId, userId)));
}

export async function deleteBudget(id: number, userId: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(budgets).where(and(eq(budgets.id, id), eq(budgets.userId, userId)));
}

// ============================================================================
// BILL REMINDERS
// ============================================================================

export async function createBillReminder(bill: InsertBillReminder) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(billReminders).values(bill).returning();
  return result[0];
}

export async function getBillRemindersByUserId(userId: string) {
  const db = getDb();
  if (!db) return [];
  
  return await db.select().from(billReminders).where(eq(billReminders.userId, userId)).orderBy(asc(billReminders.nextDueDate));
}

export async function getUpcomingBills(userId: string, daysAhead: number = 7) {
  const db = getDb();
  if (!db) return [];
  
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  
  return await db.select().from(billReminders).where(
    and(
      eq(billReminders.userId, userId),
      eq(billReminders.isActive, true),
      lte(billReminders.nextDueDate, futureDate)
    )
  ).orderBy(asc(billReminders.nextDueDate));
}

export async function updateBillReminder(id: number, userId: string, data: Partial<InsertBillReminder>) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(billReminders).set(data).where(and(eq(billReminders.id, id), eq(billReminders.userId, userId)));
}

export async function deleteBillReminder(id: number, userId: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(billReminders).where(and(eq(billReminders.id, id), eq(billReminders.userId, userId)));
}

// ============================================================================
// AI INSIGHTS - Financial Forecasting
// ============================================================================

export async function createAIInsight(insight: InsertAIInsight) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(aiInsights).values(insight).returning();
  return result[0];
}

export async function getAIInsightsByUserId(userId: string, limit: number = 10) {
  const db = getDb();
  if (!db) return [];
  
  return await db.select().from(aiInsights)
    .where(eq(aiInsights.userId, userId))
    .orderBy(desc(aiInsights.priority), desc(aiInsights.createdDate))
    .limit(limit);
}

export async function getUnreadInsights(userId: string) {
  const db = getDb();
  if (!db) return [];
  
  return await db.select().from(aiInsights)
    .where(and(eq(aiInsights.userId, userId), eq(aiInsights.isRead, false)))
    .orderBy(desc(aiInsights.priority), desc(aiInsights.createdDate));
}

export async function markInsightAsRead(id: number, userId: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(aiInsights).set({ isRead: true }).where(and(eq(aiInsights.id, id), eq(aiInsights.userId, userId)));
}

export async function deleteAIInsight(id: number, userId: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(aiInsights).where(and(eq(aiInsights.id, id), eq(aiInsights.userId, userId)));
}

// ============================================================================
// CATEGORY LEARNING - Auto-suggestion improvements
// ============================================================================

export async function learnCategoryMapping(userId: string, keyword: string, categoryId: number) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if mapping exists
  const existing = await db.select().from(categoryLearning)
    .where(and(
      eq(categoryLearning.userId, userId),
      eq(categoryLearning.keyword, keyword.toLowerCase())
    ))
    .limit(1);
  
  if (existing.length > 0) {
    // Update confidence and category
    await db.update(categoryLearning)
      .set({ 
        categoryId, 
        confidence: existing[0].confidence + 1,
        lastUsed: new Date()
      })
      .where(eq(categoryLearning.id, existing[0].id));
  } else {
    // Create new mapping
    await db.insert(categoryLearning).values({
      userId,
      keyword: keyword.toLowerCase(),
      categoryId,
      confidence: 1,
    });
  }
}

export async function suggestCategory(userId: string, description: string): Promise<number | null> {
  const db = getDb();
  if (!db) return null;
  
  const keywords = description.toLowerCase().split(/\s+/);
  
  // Find best matching learned keyword
  const matches = await db.select().from(categoryLearning)
    .where(and(
      eq(categoryLearning.userId, userId)
    ))
    .orderBy(desc(categoryLearning.confidence));
  
  for (const match of matches) {
    if (keywords.includes(match.keyword)) {
      // Update last used
      await db.update(categoryLearning)
        .set({ lastUsed: new Date() })
        .where(eq(categoryLearning.id, match.id));
      
      return match.categoryId;
    }
  }
  
  return null;
}

export async function getAllCategoryLearning(userId: string) {
  const db = getDb();
  if (!db) return [];
  
  return await db.select().from(categoryLearning)
    .where(eq(categoryLearning.userId, userId))
    .orderBy(desc(categoryLearning.confidence), desc(categoryLearning.lastUsed));
}

export async function getCategoryLearningByPattern(userId: string, pattern: string) {
  const db = getDb();
  if (!db) return null;
  
  const result = await db.select().from(categoryLearning)
    .where(and(
      eq(categoryLearning.userId, userId),
      eq(categoryLearning.keyword, pattern.toLowerCase())
    ))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function updateCategoryLearning(id: number, userId: string, data: Partial<typeof categoryLearning.$inferInsert>) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(categoryLearning)
    .set(data)
    .where(and(eq(categoryLearning.id, id), eq(categoryLearning.userId, userId)));
}

export async function deleteCategoryLearning(id: number, userId: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(categoryLearning)
    .where(and(eq(categoryLearning.id, id), eq(categoryLearning.userId, userId)));
}

// Bank Accounts functions removed - now using Wise API integration instead
