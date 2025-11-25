# Plaid Integration Deployment Steps

## Backend (Render)

1. **Add Environment Variables** in Render Dashboard:
   - `PLAID_CLIENT_ID=692595d071597c0023c9b06d`
   - `PLAID_SECRET=a13a620a13a991032305a7c4b3cc10`
   - `PLAID_ENV=sandbox`

2. **Run Database Migration** on Neon Dashboard:
   - Go to https://console.neon.tech/
   - Select your project
   - Go to SQL Editor
   - Run the SQL from `add-bank-accounts-table.sql`:
   ```sql
   CREATE TABLE IF NOT EXISTS "bankAccounts" (
     "id" serial PRIMARY KEY NOT NULL,
     "userId" uuid NOT NULL,
     "plaidItemId" varchar(255) NOT NULL,
     "plaidAccessToken" text NOT NULL,
     "institutionName" varchar(255),
     "institutionId" varchar(255),
     "accountIds" text NOT NULL,
     "isActive" boolean DEFAULT true NOT NULL,
     "lastSyncDate" timestamp,
     "createdDate" timestamp DEFAULT now() NOT NULL
   );
   ```

3. **Deploy Backend**:
   - Render will auto-deploy from the latest commit
   - Check logs to ensure plaid package installed successfully

## Frontend (Vercel)

1. **Deploy Frontend**:
   - Vercel will auto-deploy from the latest commit
   - No additional environment variables needed on frontend

## Testing Plaid Integration

1. **Login to your app** at the deployed URL

2. **Navigate to Dashboard** and look for the "Bank Synchronization" card with PlaidLink button

3. **Click "Connect Bank Account"**:
   - Plaid Link modal will open
   - Select "First Platypus Bank" (sandbox test bank)
   - Username: `user_good`
   - Password: `pass_good`
   - Complete the flow

4. **Sync Transactions**:
   - After connecting, click "Sync" button
   - Select date range (last 30 days recommended)
   - Transactions will be imported to your active goal

## Sandbox Test Credentials

Plaid provides several test banks in sandbox mode:

- **First Platypus Bank** (recommended):
  - Username: `user_good`
  - Password: `pass_good`
  - MFA: `1234`

- **Other test scenarios**:
  - `user_custom` / `pass_good` - Customize connection experience
  - See: https://plaid.com/docs/sandbox/test-credentials/

## Production Deployment (When Ready)

To use real bank data in production:

1. **Switch to Development Environment**:
   - Change `PLAID_ENV=development` in Render
   - Request to upgrade your Plaid account from sandbox to development
   - Pricing: ~$0.25-0.50 per connected user/month

2. **Get Production Keys**:
   - Generate production keys in Plaid Dashboard
   - Update `PLAID_CLIENT_ID` and `PLAID_SECRET` in Render
   - Change `PLAID_ENV=production`

## Features Included

✅ Connect unlimited bank accounts
✅ Sync transactions from last 30 days (or custom range)
✅ Auto-categorize as income/expense based on transaction type
✅ Store last sync date for each account
✅ Disconnect accounts
✅ View connected accounts list
✅ Import transactions to active goal

## Additional Features to Consider

- Auto-sync on schedule (daily/weekly)
- Category mapping from Plaid categories to app categories
- Multiple account selection within same institution
- Transaction deduplication
- Balance display
- Transaction exclusion/filtering
