import { pgEnum, pgTable, text, timestamp, varchar, integer, boolean, serial, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const goalStatusEnum = pgEnum("goal_status", ["active", "archived"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["income", "expense"]);
export const themeEnum = pgEnum("theme", ["dark", "light"]);
export const frequencyEnum = pgEnum("frequency", ["daily", "weekly", "monthly", "yearly"]);
export const chatRoleEnum = pgEnum("chat_role", ["user", "assistant", "system"]);

/**
 * Core user table backing auth flow.
 */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  passwordHash: text("passwordHash"), // Campo para hash da senha
  name: text("name"),
  email: varchar("email", { length: 320 }),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(), // PostgreSQL does not have ON UPDATE CURRENT_TIMESTAMP natively
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Financial goals table
 */
export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  userId: uuid("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  targetAmount: integer("targetAmount").notNull(), // Store as cents to avoid decimal issues
  currentAmount: integer("currentAmount").notNull().default(0),
  status: goalStatusEnum("status").default("active").notNull(),
  createdDate: timestamp("createdDate").defaultNow().notNull(),
  archivedDate: timestamp("archivedDate"),
  completedDate: timestamp("completedDate"),
});

export type Goal = typeof goals.$inferSelect;
export type InsertGoal = typeof goals.$inferInsert;

/**
 * Categories for transactions
 */
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  userId: uuid("userId"),
  name: varchar("name", { length: 255 }).notNull(),
  emoji: varchar("emoji", { length: 10 }).notNull(),
  color: varchar("color", { length: 7 }).notNull(), // Hex color
  keywords: text("keywords").array(), // Array of keywords for auto-categorization
  isDefault: boolean("isDefault").default(false).notNull(), // System default categories
  createdDate: timestamp("createdDate").defaultNow().notNull(),
});

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

/**
 * Transactions (income/expense)
 */
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: uuid("userId").notNull(),
  goalId: integer("goalId").notNull(),
  categoryId: integer("categoryId"),
  type: transactionTypeEnum("type").notNull(),
  amount: integer("amount").notNull(), // Store as cents
  reason: varchar("reason", { length: 255 }).notNull(),
  source: varchar("source", { length: 50 }), // "wise", "csv", or null for manual
  currency: varchar("currency", { length: 3 }).default("USD"), // ISO currency code (USD, BRL, EUR, etc.)
  exchangeRate: text("exchangeRate"), // Exchange rate at time of transaction (for historical accuracy)
  createdDate: timestamp("createdDate").defaultNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

/**
 * User settings
 */
export const userSettings = pgTable("userSettings", {
  id: serial("id").primaryKey(),
  userId: uuid("userId").notNull().unique(),
  language: varchar("language", { length: 10 }).notNull().default("en"),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  theme: themeEnum("theme").default("dark").notNull(),
  monthlySavingTarget: integer("monthlySavingTarget").notNull().default(0), // Store as cents
  hasUnreadArchived: boolean("hasUnreadArchived").notNull().default(false),
  wiseApiToken: text("wiseApiToken"), // Wise API token for bank sync
  wiseWebhookSecret: text("wiseWebhookSecret"), // Secret for validating Wise webhooks
  chatMemory: text("chatMemory"), // JSON array of key facts extracted from conversations
});

export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = typeof userSettings.$inferInsert;

/**
 * Recurring expenses
 */
export const recurringExpenses = pgTable("recurringExpenses", {
  id: serial("id").primaryKey(),
  userId: uuid("userId").notNull(),
  categoryId: integer("categoryId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  amount: integer("amount").notNull(), // Store as cents
  currency: varchar("currency", { length: 3 }).default("USD"), // ISO currency code (USD, BRL, EUR, etc.)
  frequency: frequencyEnum("frequency").notNull(),
  isActive: boolean("isActive").notNull().default(true),
  dayOfMonth: integer("dayOfMonth").notNull().default(1), // Day of month when transaction should be created (1-31)
  createdDate: timestamp("createdDate").defaultNow().notNull(),
});

export type RecurringExpense = typeof recurringExpenses.$inferSelect;
export type InsertRecurringExpense = typeof recurringExpenses.$inferInsert;

/**
 * Projects (for AQWorlds feature)
 */
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  userId: uuid("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 255 }),
  amount: integer("amount").notNull(), // Store as cents
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  isPaid: boolean("isPaid").notNull().default(false),
  createdDate: timestamp("createdDate").defaultNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

/**
 * Events (for AQWorlds calendar)
 */
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  userId: uuid("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  month: integer("month").notNull(), // 1-12
  isSelected: integer("isSelected").default(0).notNull(), // 0 = not selected, 1 = selected (green)
  isDefault: integer("isDefault").default(0).notNull(), // 0 = custom, 1 = default event
  sortOrder: integer("sortOrder").default(0).notNull(), // For custom ordering via drag & drop
  createdDate: timestamp("createdDate").defaultNow().notNull(),
});

export type Event = typeof events.$inferSelect;
export type InsertEvent = typeof events.$inferInsert;

/**
 * Chat messages (for OpenAI chat history)
 */
export const chatMessages = pgTable("chatMessages", {
  id: serial("id").primaryKey(),
  userId: uuid("userId").notNull(),
  role: chatRoleEnum("role").notNull(),
  content: text("content").notNull(),
  createdDate: timestamp("createdDate").defaultNow().notNull(),
  conversationFlow: varchar("conversationFlow", { length: 50 }), // e.g., "create_goal", "budget_review"
  flowStep: integer("flowStep"), // Current step in multi-step flow (1, 2, 3...)
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

/**
 * Monthly Payments tracking (for AQWorlds Monthly Status)
 */
export const monthlyPayments = pgTable("monthlyPayments", {
  id: serial("id").primaryKey(),
  userId: uuid("userId").notNull(),
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  totalAmount: integer("totalAmount").notNull(), // Store as cents
  transactionId: integer("transactionId"), // Reference to the transaction created in Dashboard
  createdDate: timestamp("createdDate").defaultNow().notNull(),
});

export type MonthlyPayment = typeof monthlyPayments.$inferSelect;
export type InsertMonthlyPayment = typeof monthlyPayments.$inferInsert;

/**
 * Connected bank accounts (Plaid integration)
 */
// Relations (optional, but good practice)
export const usersRelations = relations(users, ({ many }) => ({
  goals: many(goals),
  categories: many(categories),
  transactions: many(transactions),
  userSettings: many(userSettings),
  recurringExpenses: many(recurringExpenses),
  projects: many(projects),
  events: many(events),
  chatMessages: many(chatMessages),
  monthlyPayments: many(monthlyPayments),
}));

export const goalsRelations = relations(goals, ({ one, many }) => ({
  user: one(users, {
    fields: [goals.userId],
    references: [users.id],
  }),
  transactions: many(transactions),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, {
    fields: [categories.userId],
    references: [users.id],
  }),
  transactions: many(transactions),
  recurringExpenses: many(recurringExpenses),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  goal: one(goals, {
    fields: [transactions.goalId],
    references: [goals.id],
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.id],
  }),
}));

export const recurringExpensesRelations = relations(recurringExpenses, ({ one }) => ({
  user: one(users, {
    fields: [recurringExpenses.userId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [recurringExpenses.categoryId],
    references: [categories.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  user: one(users, {
    fields: [events.userId],
    references: [users.id],
  }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  user: one(users, {
    fields: [chatMessages.userId],
    references: [users.id],
  }),
}));

export const monthlyPaymentsRelations = relations(monthlyPayments, ({ one }) => ({
  user: one(users, {
    fields: [monthlyPayments.userId],
    references: [users.id],
  }),
  transaction: one(transactions, {
    fields: [monthlyPayments.transactionId],
    references: [transactions.id],
  }),
}));


