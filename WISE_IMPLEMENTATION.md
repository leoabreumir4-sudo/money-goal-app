# Wise API + Nubank CSV Integration - Complete Implementation

## ✅ What Was Done

### 1. **Removed Plaid Integration**
- Deleted `server/plaidRouter.ts`
- Deleted `server/_core/plaid.ts`
- Deleted `client/src/components/PlaidLinkButton.tsx`
- Removed all Plaid dependencies and imports

### 2. **Database Schema Changes**
- **Added**: `wiseApiToken` text field to `userSettings` table
- **Removed**: `bankAccounts` table (no longer needed)
- **Migration**: `drizzle/0001_chubby_lady_bullseye.sql` generated

### 3. **Wise API Integration** (`server/_core/wise.ts`)
- Official Wise REST API client using `axios`
- Functions:
  - `getProfiles(token)` - Get user's Wise profiles
  - `getBalances(token, profileId)` - Get all currency balances
  - `getBalanceStatement(token, profileId, currency, dates)` - Get transactions
- Full TypeScript types for API responses

### 4. **Wise Router** (`server/wiseRouter.ts`)
- `saveToken` - Validates token by calling Wise API, saves to database
- `removeToken` - Clears token from user settings
- `getBalances` - Returns all currency balances for authenticated user
- `syncTransactions` - Imports transactions for selected currency and date range
  - Deduplicates by `referenceNumber`
  - Converts amounts from Wise format to cents (integer)

### 5. **CSV Import** (`server/csvRouter.ts`)
- `importNubankCSV` - Parses Brazilian Nubank CSV format
- Handles Brazilian number format: `R$ 1.234,56`
- Deduplicates by description + date combination
- Returns `{ importedCount, skippedCount, totalTransactions }`

### 6. **Settings Page Updates**
- Added "Wise API Token" card with:
  - Password input field for security
  - "Save Token" button (validates token before saving)
  - "Remove Token" button
  - Link to Wise API documentation: https://wise.com/help/articles/2958229

### 7. **BankSync Component Rewrite**
- Replaced Plaid UI with two sync methods:
  1. **Wise Sync**: 
     - Shows currency balances when token configured
     - Dialog to select currency and date range
     - Sync button to import transactions
  2. **CSV Upload**:
     - File input for Nubank CSV
     - Parses and imports automatically
     - Shows success message with import stats

### 8. **Internationalization (i18n)**
- Added translations for English, Portuguese, Spanish:
  - `wiseApiToken`, `saveToken`, `removeToken`
  - `syncWise`, `uploadCSV`
  - `selectCurrency`, `wiseBalances`
  - `tokenNotConfigured`, `csvExpectedFormat`
  - `syncing`, `importing`

## 📦 Commits Made

1. `11135f1` - feat: replace Plaid with Wise API and Nubank CSV import
2. `2abc498` - feat: rewrite BankSync component with Wise sync and CSV upload
3. `7e824dd` - feat: add i18n translations for Wise and CSV import features

## 🚀 How to Use

### For Users

1. **Get Wise API Token**:
   - Go to https://wise.com/settings/api-tokens
   - Create a new "Read-only" token
   - Copy the token

2. **Configure in App**:
   - Navigate to Settings
   - Paste token in "Wise API Token" field
   - Click "Save Token"

3. **Sync Transactions**:
   - Go to Dashboard
   - Expand "Bank Synchronization" card
   - Click "Sync Wise"
   - Select currency (USD, BRL, EUR, etc.)
   - Choose date range (defaults to last 30 days)
   - Click "Sync"

4. **Import Nubank CSV** (alternative method):
   - Export CSV from Nubank app
   - Go to Dashboard → Bank Synchronization
   - Click "Upload CSV"
   - Select your Nubank CSV file
   - Transactions imported automatically

### CSV Format Expected

```csv
date,description,amount
2025-01-15,Compra iFood,-45.50
2025-01-16,Salário,3000.00
```

## 🔧 Technical Notes

### Money Storage
- All amounts stored as **cents (integers)** in database
- Wise amounts converted: `Math.round(amount * 100)`
- Display: `amount / 100`

### Authentication
- Each user stores their own Wise token (encrypted in database)
- Token validated on save by calling Wise API `/v1/profiles`
- Token used in `Authorization: Bearer <token>` header for API calls

### Deduplication
- **Wise**: Uses `referenceNumber` field (unique per transaction)
- **CSV**: Uses `description + date` combination

### Error Handling
- `PRECONDITION_FAILED` - No token configured (shows "Go to Settings" message)
- `BAD_REQUEST` - Invalid token or API error
- `INTERNAL_SERVER_ERROR` - Network or parsing errors

## 🗄️ Database Migration

The migration needs to run on production. It will run automatically when you:
1. Deploy to Vercel/production (with `MIGRATE=1` env var set for one deploy)
2. Or run `pnpm dev` locally (runs migrations on startup)

**Migration SQL**:
```sql
ALTER TABLE "userSettings" ADD COLUMN "wiseApiToken" text;
DROP TABLE IF EXISTS "bankAccounts" CASCADE;
```

## 📝 Next Steps

1. **Test with Real Data**:
   - Add your Wise token in Settings
   - Test Wise sync with different currencies
   - Test Nubank CSV import with real file

2. **Monitor Deployment**:
   - Check Vercel logs for migration success
   - Verify no errors in production

3. **Optional Enhancements** (if needed later):
   - Add scheduled auto-sync (cron job)
   - Add more CSV formats (Itaú, Santander, etc.)
   - Add Wise transfer/payment tracking
   - Add multi-currency goals

## 🎉 Summary

You now have a **free, personal-use** bank sync solution that:
- ✅ Supports Wise (API-based, automatic)
- ✅ Supports Nubank (CSV-based, manual monthly)
- ✅ No subscription fees (Plaid costs eliminated)
- ✅ Works for Brazil + US (and all Wise countries)
- ✅ Full control over your data
- ✅ Perfect for 2-person use case

Total changes: **3 commits**, **12 files changed**, **+1,152/-347 lines**
