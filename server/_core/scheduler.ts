import * as db from "../db";

/**
 * Process recurring expenses and create transactions for active ones
 * This should be called daily (e.g., via cron job or on server startup)
 */
export async function processRecurringExpenses() {
  try {
    const today = new Date();
    const currentDay = today.getDate();
    
    console.log(`[Scheduler] Processing recurring expenses for day ${currentDay}...`);
    
    // Get all users (we need to process recurring expenses for all users)
    const allUsers = await db.getAllUsers();
    
    for (const user of allUsers) {
      // Get active recurring expenses for this user
      const recurringExpenses = await db.getRecurringExpensesByUserId(user.id);
      const activeExpenses = recurringExpenses.filter(
        (expense) => expense.isActive && expense.dayOfMonth === currentDay
      );
      
      if (activeExpenses.length === 0) continue;
      
      console.log(`[Scheduler] Processing ${activeExpenses.length} active recurring expenses for user ${user.id}`);
      
      // Get user's active goal (we need a goalId for transactions)
      const goals = await db.getGoalsByUserId(user.id);
      const activeGoal = goals.find((g) => g.status === "active");
      
      if (!activeGoal) {
        console.warn(`[Scheduler] User ${user.id} has no active goal, skipping recurring expenses`);
        continue;
      }
      
      // Get user's preferred currency
      const userSettings = await db.getUserSettings(user.id);
      const preferredCurrency = userSettings?.currency || "USD";
      
      // Create transaction for each active recurring expense
      for (const expense of activeExpenses) {
        // Check if we already created a transaction today for this recurring expense
        const existingTransactions = await db.getAllTransactionsByUserId(user.id);
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);
        
        const alreadyCreatedToday = existingTransactions.some(
          (t) =>
            t.reason.includes(`[Auto: ${expense.name}]`) &&
            t.createdDate >= todayStart &&
            t.createdDate < todayEnd
        );
        
        if (alreadyCreatedToday) {
          console.log(`[Scheduler] Transaction already created today for recurring expense "${expense.name}"`);
          continue;
        }
        
        // Create the transaction
        await db.createTransaction({
          userId: user.id,
          goalId: activeGoal.id,
          categoryId: expense.categoryId,
          type: "expense",
          amount: expense.amount,
          reason: `[Auto: ${expense.name}]`,
          source: "recurring",
          currency: preferredCurrency,
          exchangeRate: null, // No conversion needed for auto-created transactions
        });
        
        console.log(`[Scheduler] Created transaction for recurring expense "${expense.name}" (${expense.amount} cents)`);
      }
    }
    
    console.log("[Scheduler] Recurring expense processing complete");
  } catch (error) {
    console.error("[Scheduler] Error processing recurring expenses:", error);
  }
}

/**
 * Start the recurring expense scheduler
 * Runs every day at midnight (or on server startup if we missed today's run)
 */
export function startRecurringExpenseScheduler() {
  // Run immediately on startup
  processRecurringExpenses();
  
  // Schedule to run daily at midnight
  const msUntilMidnight = () => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0); // Next midnight
    return midnight.getTime() - now.getTime();
  };
  
  const scheduleNextRun = () => {
    const delay = msUntilMidnight();
    console.log(`[Scheduler] Next recurring expense check in ${Math.round(delay / 1000 / 60)} minutes`);
    
    setTimeout(() => {
      processRecurringExpenses();
      scheduleNextRun(); // Schedule the next run
    }, delay);
  };
  
  scheduleNextRun();
}
