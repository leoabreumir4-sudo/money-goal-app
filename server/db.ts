import { eq, and, desc } from "drizzle-orm";
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
  InsertMonthlyPayment
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      _db = drizzle(pool, { schema });
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
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

// ---------- ATUALIZAÇÃO: Selecionar explicitamente campos essenciais ----------
export async function getUserByEmail(email: string) {
  const db = await getDb();
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
      role: users.role,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
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
      role: users.role,
    })
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}
// -------------------------------------------------------------------------------

// Goals
export async function createGoal(goal: InsertGoal) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(goals).values(goal);
  return result;
}

export async function getGoalsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(goals).where(eq(goals.userId, userId));
}

export async function getActiveGoal(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.status, "active")))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function getArchivedGoals(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.status, "archived")))
    .orderBy(desc(goals.archivedDate));
}

export async function updateGoal(id: number, userId: number, data: Partial<InsertGoal>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(goals).set(data).where(and(eq(goals.id, id), eq(goals.userId, userId)));
}

export async function deleteGoal(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, userId)));
}

// Transactions
export async function createTransaction(transaction: InsertTransaction) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(transactions).values(transaction);
  return result;
}

export async function getTransactionsByGoalId(goalId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(transactions)
    .where(and(eq(transactions.goalId, goalId), eq(transactions.userId, userId)))
    .orderBy(desc(transactions.createdDate));
}

export async function getAllTransactionsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.createdDate));
}

export async function updateTransaction(id: number, userId: number, data: Partial<InsertTransaction>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(transactions).set(data).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
}

export async function deleteTransaction(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
}

// Categories
export async function createCategory(category: InsertCategory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(categories).values(category);
  return result;
}

export async function getCategoriesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(categories).where(eq(categories.userId, userId));
}

// User Settings
export async function getUserSettings(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createUserSettings(settings: InsertUserSettings) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(userSettings).values(settings);
  return result;
}

export async function updateUserSettings(userId: number, data: Partial<InsertUserSettings>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(userSettings).set(data).where(eq(userSettings.userId, userId));
}

// Recurring Expenses
export async function createRecurringExpense(expense: InsertRecurringExpense) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(recurringExpenses).values(expense);
  return result;
}

export async function getRecurringExpensesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(recurringExpenses).where(eq(recurringExpenses.userId, userId));
}

export async function updateRecurringExpense(id: number, userId: number, data: Partial<InsertRecurringExpense>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(recurringExpenses).set(data).where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.userId, userId)));
}

export async function deleteRecurringExpense(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(recurringExpenses).where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.userId, userId)));
}

// Projects
export async function createProject(project: InsertProject) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(projects).values(project);
  return result;
}

export async function getProjectsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.createdDate));
}

export async function updateProject(id: number, userId: number, data: Partial<InsertProject>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(projects).set(data).where(and(eq(projects.id, id), eq(projects.userId, userId)));
}

export async function deleteProject(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(projects).where(and(eq(projects.id, id), eq(projects.userId, userId)));
}

// Events
export async function createEvent(event: InsertEvent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(events).values(event);
  return result;
}

export async function getEventsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(events).where(eq(events.userId, userId));
}

export async function updateEvent(id: number, userId: number, data: Partial<InsertEvent>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(events).set(data).where(and(eq(events.id, id), eq(events.userId, userId)));
}

export async function deleteEvent(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(events).where(and(eq(events.id, id), eq(events.userId, userId)));
}

// Chat Messages
export async function createChatMessage(message: InsertChatMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(chatMessages).values(message);
  return result;
}

export async function getChatMessagesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(chatMessages).where(eq(chatMessages.userId, userId)).orderBy(desc(chatMessages.createdDate));
}

// Monthly Payments
export async function createMonthlyPayment(payment: InsertMonthlyPayment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(monthlyPayments).values(payment);
  return result;
}

export async function getMonthlyPaymentsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(monthlyPayments).where(eq(monthlyPayments.userId, userId)).orderBy(desc(monthlyPayments.createdDate));
}

export async function updateMonthlyPayment(id: number, userId: number, data: Partial<InsertMonthlyPayment>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(monthlyPayments).set(data).where(and(eq(monthlyPayments.id, id), eq(monthlyPayments.userId, userId)));
}

export async function deleteMonthlyPayment(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(monthlyPayments).where(and(eq(monthlyPayments.id, id), eq(monthlyPayments.userId, userId)));
}
