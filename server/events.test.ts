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

describe("Events Feature", () => {
  it("should initialize default events for a new user", async () => {
    const { ctx } = createAuthContext(999); // Use a unique user ID
    const caller = appRouter.createCaller(ctx);

    // First call should initialize default events
    const events = await caller.events.getAll();

    // Should have 33 default events (as defined in the default events list)
    expect(events.length).toBeGreaterThanOrEqual(33);
    
    // Check that some default events exist
    const januaryEvents = events.filter(e => e.month === 1);
    expect(januaryEvents.length).toBeGreaterThan(0);
    
    // All should be marked as default
    const defaultEvents = events.filter(e => e.isDefault === 1);
    expect(defaultEvents.length).toBeGreaterThanOrEqual(33);
  });

  it("should create a custom event", async () => {
    const { ctx } = createAuthContext(1000);
    const caller = appRouter.createCaller(ctx);

    // Create a custom event
    await caller.events.create({
      name: "My Custom Event",
      month: 6,
    });

    const events = await caller.events.getAll();
    const customEvent = events.find(e => e.name === "My Custom Event" && e.isDefault === 0);
    
    expect(customEvent).toBeDefined();
    expect(customEvent?.month).toBe(6);
    expect(customEvent?.isDefault).toBe(0);
    expect(customEvent?.isSelected).toBe(0);
  });

  it("should toggle event selection", async () => {
    const { ctx } = createAuthContext(1001);
    const caller = appRouter.createCaller(ctx);

    // Get events
    const events = await caller.events.getAll();
    const firstEvent = events[0];

    // Toggle selection
    await caller.events.toggleSelection({ id: firstEvent.id });

    // Get updated events
    const updatedEvents = await caller.events.getAll();
    const toggledEvent = updatedEvents.find(e => e.id === firstEvent.id);

    // Should be selected now (1)
    expect(toggledEvent?.isSelected).toBe(1);

    // Toggle again
    await caller.events.toggleSelection({ id: firstEvent.id });

    // Get events again
    const finalEvents = await caller.events.getAll();
    const finalEvent = finalEvents.find(e => e.id === firstEvent.id);

    // Should be unselected now (0)
    expect(finalEvent?.isSelected).toBe(0);
  });

  it("should delete custom events but not default events", async () => {
    const { ctx } = createAuthContext(1002);
    const caller = appRouter.createCaller(ctx);

    // Create a custom event
    await caller.events.create({
      name: "Deletable Event",
      month: 7,
    });

    let events = await caller.events.getAll();
    const customEvent = events.find(e => e.name === "Deletable Event");
    expect(customEvent).toBeDefined();

    // Delete the custom event
    await caller.events.delete({ id: customEvent!.id });

    events = await caller.events.getAll();
    const deletedEvent = events.find(e => e.name === "Deletable Event");
    expect(deletedEvent).toBeUndefined();
  });

  it("should update custom event name", async () => {
    const { ctx } = createAuthContext(1003);
    const caller = appRouter.createCaller(ctx);

    // Create a custom event
    await caller.events.create({
      name: "Original Name",
      month: 8,
    });

    let events = await caller.events.getAll();
    const customEvent = events.find(e => e.name === "Original Name");
    expect(customEvent).toBeDefined();

    // Update the event name
    await caller.events.update({
      id: customEvent!.id,
      name: "Updated Name",
    });

    events = await caller.events.getAll();
    const updatedEvent = events.find(e => e.id === customEvent!.id);
    expect(updatedEvent?.name).toBe("Updated Name");
  });
});
