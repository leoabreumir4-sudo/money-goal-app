import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
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
      _db = drizzle(process.env.DATABASE_URL);
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

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user by email: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

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

export async function toggleEventSelection(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get current event
  const result = await db.select().from(events).where(and(eq(events.id, id), eq(events.userId, userId))).limit(1);
  if (result.length === 0) return;
  
  const event = result[0];
  const newStatus = event.isSelected === 1 ? 0 : 1;
  
  await db.update(events).set({ isSelected: newStatus }).where(and(eq(events.id, id), eq(events.userId, userId)));
}

export async function deleteEvent(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(events).where(and(eq(events.id, id), eq(events.userId, userId)));
}

export async function initializeDefaultEvents(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if user already has default events
  const existing = await db.select().from(events).where(and(eq(events.userId, userId), eq(events.isDefault, 1))).limit(1);
  if (existing.length > 0) return; // Already initialized
  
  const defaultEvents = [
    { month: 1, name: "Australia Day" },
    { month: 1, name: "Akiba New Year" },
    { month: 1, name: "Nulgath's Birthday" },
    { month: 2, name: "Carnaval" },
    { month: 2, name: "Groundhorc's Day" },
    { month: 2, name: "Heroes Heart Day" },
    { month: 2, name: "Pancake Day" },
    { month: 2, name: "Super Bowl" },
    { month: 3, name: "Dage's Birthday" },
    { month: 3, name: "Good Luck Day" },
    { month: 3, name: "Grenwog" },
    { month: 4, name: "April Fools' Day" },
    { month: 4, name: "Earth Day" },
    { month: 4, name: "Solar New Year" },
    { month: 5, name: "Cinco de Mayo" },
    { month: 5, name: "May the 4th" },
    { month: 5, name: "Summer Break" },
    { month: 6, name: "AQWorld Cup" },
    { month: 6, name: "Father's Day" },
    { month: 7, name: "Freedom Day" },
    { month: 7, name: "Frostval in July" },
    { month: 8, name: "Back to School" },
    { month: 8, name: "Indonesian Day" },
    { month: 9, name: "Obrigado Brasil" },
    { month: 9, name: "Talk Like a Pirate Day" },
    { month: 10, name: "AQWorlds' Birthday" },
    { month: 10, name: "Canadian Thanksgiving" },
    { month: 10, name: "Taco Day" },
    { month: 11, name: "Black Friday" },
    { month: 11, name: "Cyber Monday" },
    { month: 11, name: "Harvest Day" },
    { month: 12, name: "Frostval" },
    { month: 12, name: "New Year" },
  ];
  
  for (const event of defaultEvents) {
    await db.insert(events).values({
      userId,
      name: event.name,
      month: event.month,
      isDefault: 1,
      isSelected: 0,
    });
  }
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
  
  return await db.select().from(chatMessages)
    .where(eq(chatMessages.userId, userId))
    .orderBy(chatMessages.createdDate);
}

export async function deleteChatMessagesByUserId(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(chatMessages).where(eq(chatMessages.userId, userId));
}

// Monthly Payments
export async function createMonthlyPayment(payment: InsertMonthlyPayment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(monthlyPayments).values(payment);
  return result;
}

export async function getMonthlyPayment(userId: number, month: number, year: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(monthlyPayments)
    .where(
      and(
        eq(monthlyPayments.userId, userId),
        eq(monthlyPayments.month, month),
        eq(monthlyPayments.year, year)
      )
    )
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function deleteMonthlyPayment(userId: number, month: number, year: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(monthlyPayments).where(
    and(
      eq(monthlyPayments.userId, userId),
      eq(monthlyPayments.month, month),
      eq(monthlyPayments.year, year)
    )
  );
}
