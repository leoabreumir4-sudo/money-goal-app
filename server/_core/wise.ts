import axios, { AxiosInstance } from "axios";

export interface WiseProfile {
  id: number;
  type: string;
  details: {
    firstName?: string;
    lastName?: string;
    name?: string;
  };
}

export interface WiseBalance {
  balanceType: string;
  currency: string;
  amount: {
    value: number;
    currency: string;
  };
}

export interface WiseTransaction {
  type: string;
  date: string;
  amount: {
    value: number;
    currency: string;
  };
  totalFees: {
    value: number;
    currency: string;
  };
  details: {
    type: string;
    description: string;
    recipient?: {
      name: string;
    };
    merchant?: {
      name: string;
    };
  };
  exchangeDetails?: {
    rate: number;
  };
  runningBalance: {
    value: number;
    currency: string;
  };
  referenceNumber: string;
}

export interface WiseBalanceStatement {
  accountHolder: {
    type: string;
    address: {
      addressFirstLine: string;
      city: string;
      postCode: string;
      stateCode: string;
      countryName: string;
    };
    firstName: string;
    lastName: string;
  };
  issuer: {
    name: string;
    firstLine: string;
    city: string;
    postCode: string;
    stateCode: string;
    country: string;
  };
  bankDetails: null;
  transactions: WiseTransaction[];
  endOfStatementBalance: {
    value: number;
    currency: string;
  };
  query: {
    intervalStart: string;
    intervalEnd: string;
    currency: string;
    accountId: number;
  };
}

/**
 * Create Wise API client
 */
export function createWiseClient(apiToken: string): AxiosInstance {
  return axios.create({
    baseURL: "https://api.wise.com",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    timeout: 30000,
  });
}

/**
 * Get user profiles
 */
export async function getProfiles(apiToken: string): Promise<WiseProfile[]> {
  const client = createWiseClient(apiToken);
  const response = await client.get("/v1/profiles");
  return response.data;
}

/**
 * Get balances for a profile
 */
export async function getBalances(
  apiToken: string,
  profileId: number
): Promise<WiseBalance[]> {
  const client = createWiseClient(apiToken);
  const response = await client.get(`/v4/profiles/${profileId}/balances?types=STANDARD`);
  return response.data;
}

/**
 * Get borderless accounts for a profile
 */
export async function getBorderlessAccounts(
  apiToken: string,
  profileId: number
): Promise<any[]> {
  const client = createWiseClient(apiToken);
  const response = await client.get(`/v1/borderless-accounts?profileId=${profileId}`);
  return response.data;
}

/**
 * Get balance statement (transactions) for a period
 * Try multiple endpoints as Wise API has different versions
 */
export async function getBalanceStatement(
  apiToken: string,
  profileId: number,
  currency: string,
  intervalStart: string, // ISO date string
  intervalEnd: string // ISO date string
): Promise<WiseBalanceStatement> {
  const client = createWiseClient(apiToken);
  
  let lastError: any;
  
  // First, get borderless accounts to find the account ID
  let borderlessAccounts;
  let accountId;
  
  try {
    borderlessAccounts = await getBorderlessAccounts(apiToken, profileId);
    console.log(`[Wise] Found ${borderlessAccounts.length} borderless accounts`);
    
    if (borderlessAccounts.length === 0) {
      throw new Error("No Wise accounts found. Make sure you have a Wise multi-currency account.");
    }
    
    accountId = borderlessAccounts[0].id;
    console.log(`[Wise] Using account ID: ${accountId}`);
  } catch (error: any) {
    console.log(`[Wise] Failed to get borderless accounts:`, error.response?.status, error.response?.data || error.message);
    // If we can't get borderless accounts, we'll try endpoints without accountId
    console.log(`[Wise] Continuing without borderless account validation...`);
  }
  
  // Try v3 endpoint first (if we have accountId)
  if (accountId) {
    try {
      console.log(`[Wise] Attempting v3 endpoint for account ${accountId}, currency ${currency}, dates ${intervalStart} to ${intervalEnd}`);
      
      const response = await client.get(
        `/v3/profiles/${profileId}/borderless-accounts/${accountId}/statement.json`,
        {
          params: {
            currency,
            intervalStart,
            intervalEnd,
          },
        }
      );
      console.log(`[Wise] v3 endpoint succeeded with ${response.data.transactions?.length || 0} transactions`);
      return response.data;
    } catch (error: any) {
      console.error(`[Wise] v3 endpoint failed with status ${error.response?.status}:`, error.response?.data || error.message);
      lastError = error;
    }
  }

  // Try v1 currency endpoint as last resort
  try {
    console.log(`[Wise] Attempting v1 currency endpoint for ${currency}, dates ${intervalStart} to ${intervalEnd}`);
    const response = await client.get(
      `/v1/profiles/${profileId}/balance-statements/${currency}/statement.json`,
      {
        params: {
          intervalStart,
          intervalEnd,
        },
      }
    );
    console.log(`[Wise] v1 currency endpoint succeeded with ${response.data.transactions?.length || 0} transactions`);
    return response.data;
  } catch (error: any) {
    console.error(`[Wise] v1 currency endpoint failed with status ${error.response?.status}:`, error.response?.data || error.message);
    lastError = error;
  }

  // All endpoints failed - throw informative error
  const errorMessage = lastError.response?.data?.message || lastError.message;
  const errorStatus = lastError.response?.status;
  console.error(`[Wise] All endpoints failed. Last status: ${errorStatus}, Last error: ${errorMessage}`);
  
  throw new Error(
    `Failed to fetch Wise transactions for ${currency}. All API endpoints returned errors. ` +
    `Status: ${errorStatus}, Error: ${errorMessage}. ` +
    `Please verify: (1) Your API token has 'Read' permission, (2) You have transactions in ${currency}, ` +
    `(3) The date range contains activity.`
  );
}
