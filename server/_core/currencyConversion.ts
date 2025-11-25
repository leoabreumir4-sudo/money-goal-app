import axios from "axios";

// Using free exchangerate-api.com API (1500 requests/month free)
const EXCHANGE_API_BASE = "https://api.exchangerate-api.com/v4/latest";

interface ExchangeRateResponse {
  base: string;
  date: string;
  rates: Record<string, number>;
}

// Cache para evitar muitas requests
const rateCache = new Map<string, { rates: Record<string, number>; timestamp: number }>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

/**
 * Get exchange rates for a base currency
 * @param baseCurrency - Base currency code (USD, BRL, EUR, etc)
 * @returns Object with exchange rates for all currencies
 */
export async function getExchangeRates(baseCurrency: string): Promise<Record<string, number>> {
  const cached = rateCache.get(baseCurrency);
  
  // Return cached rates if still valid
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.rates;
  }

  try {
    const response = await axios.get<ExchangeRateResponse>(`${EXCHANGE_API_BASE}/${baseCurrency}`);
    const rates = response.data.rates;
    
    // Update cache
    rateCache.set(baseCurrency, {
      rates,
      timestamp: Date.now(),
    });
    
    return rates;
  } catch (error) {
    console.error(`Failed to fetch exchange rates for ${baseCurrency}:`, error);
    
    // Return fallback rates if API fails
    if (cached) {
      console.warn(`Using stale cached rates for ${baseCurrency}`);
      return cached.rates;
    }
    
    throw new Error(`Failed to fetch exchange rates: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Convert amount from one currency to another
 * @param amount - Amount in source currency (in cents)
 * @param fromCurrency - Source currency code
 * @param toCurrency - Target currency code
 * @returns Converted amount in target currency (in cents)
 */
export async function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  // No conversion needed if currencies match
  if (fromCurrency === toCurrency) {
    return amount;
  }

  try {
    const rates = await getExchangeRates(fromCurrency);
    const rate = rates[toCurrency];
    
    if (!rate) {
      throw new Error(`Exchange rate not found for ${fromCurrency} to ${toCurrency}`);
    }
    
    // Convert: amount is in cents, rate is for whole units
    const amountInUnits = amount / 100;
    const convertedUnits = amountInUnits * rate;
    const convertedCents = Math.round(convertedUnits * 100);
    
    return convertedCents;
  } catch (error) {
    console.error(`Failed to convert ${amount} from ${fromCurrency} to ${toCurrency}:`, error);
    throw error;
  }
}

/**
 * Convert multiple currency amounts to target currency
 * @param balances - Array of {currency, amount} objects (amounts in cents)
 * @param targetCurrency - Target currency to convert to
 * @returns Array of converted balances with original and converted amounts
 */
export async function convertBalances(
  balances: Array<{ currency: string; amount: number }>,
  targetCurrency: string
): Promise<Array<{ 
  currency: string; 
  originalAmount: number; 
  convertedAmount: number;
  conversionRate: number;
}>> {
  const results = await Promise.all(
    balances.map(async (balance) => {
      const convertedAmount = await convertAmount(
        balance.amount,
        balance.currency,
        targetCurrency
      );
      
      // Calculate conversion rate for display
      const rate = balance.currency === targetCurrency 
        ? 1 
        : convertedAmount / balance.amount;
      
      return {
        currency: balance.currency,
        originalAmount: balance.amount,
        convertedAmount,
        conversionRate: rate,
      };
    })
  );
  
  return results;
}
