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
  
  // Try v3 endpoint first (more common)
  try {
    // First get borderless account
    const borderlessAccounts = await getBorderlessAccounts(apiToken, profileId);
    if (borderlessAccounts.length === 0) {
      throw new Error("No borderless accounts found");
    }
    
    const accountId = borderlessAccounts[0].id;
    
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
    return response.data;
  } catch (error) {
    console.log("v3 endpoint failed, trying v1...");
    
    // Fallback to v1 endpoint
    const response = await client.get(
      `/v1/profiles/${profileId}/balance-statements/${currency}/statement.json`,
      {
        params: {
          intervalStart,
          intervalEnd,
        },
      }
    );
    return response.data;
  }
}
