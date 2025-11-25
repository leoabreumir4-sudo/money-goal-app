import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId: number = 1): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `user-${userId}`,
    email: `user${userId}@example.com`,
    name: `User ${userId}`,
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
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("Monthly Payments Feature", () => {
  it("should mark a month as paid and create transaction", async () => {
    const { ctx } = createAuthContext(2000);
    const caller = appRouter.createCaller(ctx);

    // First create a goal
    await caller.goals.create({
      name: "Test Goal for Payments",
      targetAmount: 100000, // $1000
    });

    // Create a project for the month
    await caller.projects.create({
      name: "Test Project",
      amount: 50000, // $500
      month: 11,
      year: 2025,
    });

    // Mark the month as paid
    const result = await caller.monthlyPayments.togglePaid({
      month: 11,
      year: 2025,
      totalAmount: 50000,
    });

    expect(result.success).toBe(true);
    expect(result.isPaid).toBe(true);

    // Verify payment was created
    const payment = await caller.monthlyPayments.getPayment({
      month: 11,
      year: 2025,
    });

    expect(payment).toBeDefined();
    expect(payment?.month).toBe(11);
    expect(payment?.year).toBe(2025);
    expect(payment?.totalAmount).toBe(50000);

    // Verify goal was updated
    const goal = await caller.goals.getActive();
    expect(goal?.currentAmount).toBe(50000);
  });

  it("should unmark a month and remove transaction", async () => {
    const { ctx } = createAuthContext(2001);
    const caller = appRouter.createCaller(ctx);

    // Create a goal
    await caller.goals.create({
      name: "Test Goal for Unmark",
      targetAmount: 100000,
    });

    // Mark as paid
    await caller.monthlyPayments.togglePaid({
      month: 10,
      year: 2025,
      totalAmount: 30000,
    });

    // Verify it's paid
    let payment = await caller.monthlyPayments.getPayment({
      month: 10,
      year: 2025,
    });
    expect(payment).toBeDefined();

    // Unmark (toggle again)
    const result = await caller.monthlyPayments.togglePaid({
      month: 10,
      year: 2025,
      totalAmount: 30000,
    });

    expect(result.success).toBe(true);
    expect(result.isPaid).toBe(false);

    // Verify payment was removed
    payment = await caller.monthlyPayments.getPayment({
      month: 10,
      year: 2025,
    });
    expect(payment).toBeNull();

    // Verify goal amount was reduced
    const goal = await caller.goals.getActive();
    expect(goal?.currentAmount).toBe(0);
  });

  it("should handle multiple months independently", async () => {
    const { ctx } = createAuthContext(2002);
    const caller = appRouter.createCaller(ctx);

    // Create a goal
    await caller.goals.create({
      name: "Test Goal for Multiple Months",
      targetAmount: 200000,
    });

    // Mark September as paid
    await caller.monthlyPayments.togglePaid({
      month: 9,
      year: 2025,
      totalAmount: 40000,
    });

    // Mark October as paid
    await caller.monthlyPayments.togglePaid({
      month: 10,
      year: 2025,
      totalAmount: 60000,
    });

    // Verify both payments exist
    const septemberPayment = await caller.monthlyPayments.getPayment({
      month: 9,
      year: 2025,
    });
    const octoberPayment = await caller.monthlyPayments.getPayment({
      month: 10,
      year: 2025,
    });

    expect(septemberPayment).toBeDefined();
    expect(octoberPayment).toBeDefined();

    // Verify goal has both amounts
    const goal = await caller.goals.getActive();
    expect(goal?.currentAmount).toBe(100000); // 40000 + 60000
  });
});
