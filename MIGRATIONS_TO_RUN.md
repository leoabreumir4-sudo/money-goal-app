# Migration Instructions for Neon Console

You need to run 3 migrations in your Neon PostgreSQL console:

## Migration 1: Add currency field to recurringExpenses (0007)
```sql
ALTER TABLE "recurringExpenses" ADD COLUMN "currency" varchar(3) DEFAULT 'USD';
```

## Migration 2: Add chatMemory field to userSettings (0008)
```sql
ALTER TABLE "userSettings" ADD COLUMN "chatMemory" text;
```

## Migration 3: Add conversation flow fields to chatMessages (0009)
```sql
ALTER TABLE "chatMessages" ADD COLUMN "conversationFlow" varchar(50);
ALTER TABLE "chatMessages" ADD COLUMN "flowStep" integer;
```

## How to Run

1. Log into Neon Console: https://console.neon.tech
2. Select your project: `money-goal-app`
3. Navigate to **SQL Editor**
4. Copy and paste each migration SQL above
5. Execute each one separately
6. Verify with: `SELECT * FROM information_schema.columns WHERE table_name IN ('recurringExpenses', 'userSettings', 'chatMessages');`

## What These Migrations Enable

- **0007**: Recurring expenses can now have different currencies (USD, BRL, EUR)
- **0008**: AI chat can remember key facts from conversations (stored as JSON array)
- **0009**: Multi-step conversation flows (Create Goal, Budget Review, Savings Plan)
