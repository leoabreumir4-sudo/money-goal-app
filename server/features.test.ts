import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId: number = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `user-${userId}`,
    email: `user${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return ctx;
}

describe("Goals Feature", () => {
  it("creates a goal successfully", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.goals.create({
      name: "Test Goal",
      targetAmount: 100000, // $1000.00
    });

    expect(result.success).toBe(true);
  });

  it("gets active goal", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a goal first
    await caller.goals.create({
      name: "Test Goal for List",
      targetAmount: 50000,
    });

    const goal = await caller.goals.getActive();
    expect(goal).toBeDefined();
  });

  it("gets archived goals", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Check archived goals
    const archivedGoals = await caller.goals.getArchived();
    expect(Array.isArray(archivedGoals)).toBe(true);
  });
});

describe("Transactions Feature", () => {
  it("creates an income transaction", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a goal first
    await caller.goals.create({
      name: "Goal for Transaction",
      targetAmount: 100000,
    });

    // Get the active goal
    const goal = await caller.goals.getActive();

    const result = await caller.transactions.create({
      goalId: goal!.id,
      type: "income",
      amount: 50000, // $500.00
      reason: "Test Income",
    });

    expect(result.success).toBe(true);
  });

  it("creates an expense transaction", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a goal first
    await caller.goals.create({
      name: "Goal for Expense",
      targetAmount: 100000,
    });

    // Get the active goal
    const goal = await caller.goals.getActive();

    const result = await caller.transactions.create({
      goalId: goal!.id,
      type: "expense",
      amount: 20000, // $200.00
      reason: "Test Expense",
    });

    expect(result.success).toBe(true);
  });

  it("lists all transactions for a user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const transactions = await caller.transactions.getAll();
    expect(Array.isArray(transactions)).toBe(true);
  });
});

describe("Projects Feature (AQWorlds)", () => {
  it("creates a project successfully", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.projects.create({
      name: "Test Project",
      amount: 35000, // $350.00
      month: 12,
      year: 2025,
    });

    expect(result.success).toBe(true);
  });

  it("lists all projects", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const projects = await caller.projects.getAll();
    expect(Array.isArray(projects)).toBe(true);
  });

  it("gets all projects", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a project for 2025
    await caller.projects.create({
      name: "2025 Project",
      amount: 10000,
      month: 6,
      year: 2025,
    });

    const projects = await caller.projects.getAll();
    expect(Array.isArray(projects)).toBe(true);
  });
});

describe("Recurring Expenses Feature", () => {
  it("creates a recurring expense", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.recurringExpenses.create({
      categoryId: 1,
      name: "Gym Membership",
      amount: 2200, // $22.00
      frequency: "monthly",
    });

    expect(result.success).toBe(true);
  });

  it("gets all recurring expenses", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create expense
    await caller.recurringExpenses.create({
      categoryId: 1,
      name: "Netflix",
      amount: 1500,
      frequency: "monthly",
    });

    const expenses = await caller.recurringExpenses.getAll();
    expect(Array.isArray(expenses)).toBe(true);
  });
});

describe("Events Feature (AQWorlds Calendar)", () => {
  it("creates an event successfully", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.events.create({
      name: "Test Event",
      month: 12,
    });

    expect(result.success).toBe(true);
  });

  it("lists all events", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const events = await caller.events.getAll();
    expect(Array.isArray(events)).toBe(true);
  });
});

describe("User Settings Feature", () => {
  it("creates user settings", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.settings.update({
      language: "en",
      currency: "USD",
      theme: "dark",
      monthlySavingTarget: 50000,
    });

    expect(result.success).toBe(true);
  });

  it("retrieves user settings", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create settings first
    await caller.settings.update({
      language: "pt",
      currency: "BRL",
      theme: "dark",
    });

    const settings = await caller.settings.get();
    expect(settings).toBeDefined();
    expect(settings?.language).toBe("pt");
    expect(settings?.currency).toBe("BRL");
  });
});

describe("Data Isolation Between Users", () => {
  it("ensures users can only see their own goals", async () => {
    const user1Ctx = createAuthContext(100);
    const user2Ctx = createAuthContext(200);
    
    const caller1 = appRouter.createCaller(user1Ctx);
    const caller2 = appRouter.createCaller(user2Ctx);

    // User 1 creates a goal
    await caller1.goals.create({
      name: "User 100 Goal",
      targetAmount: 100000,
    });

    // User 2 creates a goal
    await caller2.goals.create({
      name: "User 200 Goal",
      targetAmount: 200000,
    });

    // User 1 should only see their own goal
    const user1Goal = await caller1.goals.getActive();
    expect(user1Goal?.userId).toBe(100);
    expect(user1Goal?.name).toBe("User 100 Goal");

    // User 2 should only see their own goal
    const user2Goal = await caller2.goals.getActive();
    expect(user2Goal?.userId).toBe(200);
    expect(user2Goal?.name).toBe("User 200 Goal");
  });

  it("ensures users can only see their own transactions", async () => {
    const user1Ctx = createAuthContext(100);
    const user2Ctx = createAuthContext(200);
    
    const caller1 = appRouter.createCaller(user1Ctx);
    const caller2 = appRouter.createCaller(user2Ctx);

    // User 1 transactions
    const user1Transactions = await caller1.transactions.getAll();
    expect(user1Transactions.every(t => t.userId === 100)).toBe(true);

    // User 2 transactions
    const user2Transactions = await caller2.transactions.getAll();
    expect(user2Transactions.every(t => t.userId === 200)).toBe(true);
  });
});
