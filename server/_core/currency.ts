/**
 * Currency conversion utilities using exchangerate-api.com
 */

interface ExchangeRates {
  [currency: string]: number;
}

interface CachedRates {
  rates: ExchangeRates;
  timestamp: number;
  baseCurrency: string;
}

// Cache exchange rates for 24 hours
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
let cachedRates: CachedRates | null = null;

/**
 * Fetch latest exchange rates from API (free tier: 1500 requests/month)
 */
async function fetchExchangeRates(baseCurrency = "USD"): Promise<ExchangeRates> {
  try {
    const response = await fetch(
      `https://api.exchangerate-api.com/v4/latest/${baseCurrency}`
    );

    if (!response.ok) {
      throw new Error(`Exchange rate API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.rates as ExchangeRates;
  } catch (error) {
    console.error("Failed to fetch exchange rates:", error);
    // Return fallback rates if API fails
    return getFallbackRates(baseCurrency);
  }
}

/**
 * Get cached exchange rates or fetch new ones if expired
 */
export async function getExchangeRates(
  baseCurrency = "USD"
): Promise<ExchangeRates> {
  const now = Date.now();

  // Return cached rates if valid
  if (
    cachedRates &&
    cachedRates.baseCurrency === baseCurrency &&
    now - cachedRates.timestamp < CACHE_DURATION
  ) {
    return cachedRates.rates;
  }

  // Fetch new rates
  const rates = await fetchExchangeRates(baseCurrency);

  // Update cache
  cachedRates = {
    rates,
    timestamp: now,
    baseCurrency,
  };

  return rates;
}

/**
 * Convert amount from one currency to another
 * @param amount - Amount in cents of source currency
 * @param fromCurrency - Source currency code (e.g., "BRL")
 * @param toCurrency - Target currency code (e.g., "USD")
 * @param exchangeRate - Optional historical exchange rate
 * @returns Amount in cents of target currency
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  exchangeRate?: string | null
): Promise<number> {
  // No conversion needed
  if (fromCurrency === toCurrency) {
    return amount;
  }

  // Use historical rate if provided
  if (exchangeRate) {
    const rate = parseFloat(exchangeRate);
    return Math.round(amount / rate);
  }

  // Fetch current rates
  const rates = await getExchangeRates(fromCurrency);

  const rate = rates[toCurrency];
  if (!rate) {
    console.warn(`No exchange rate found for ${fromCurrency} -> ${toCurrency}`);
    return amount; // Return original if conversion fails
  }

  return Math.round(amount * rate);
}

/**
 * Get current exchange rate between two currencies
 */
export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string
): Promise<number | null> {
  if (fromCurrency === toCurrency) return 1;

  const rates = await getExchangeRates(fromCurrency);
  return rates[toCurrency] || null;
}

/**
 * Fallback exchange rates (approximate, updated manually)
 * Used when API is unavailable
 */
function getFallbackRates(baseCurrency: string): ExchangeRates {
  const usdRates: ExchangeRates = {
    USD: 1,
    BRL: 5.38,
    EUR: 0.92,
    GBP: 0.79,
    JPY: 149.5,
    CAD: 1.36,
    AUD: 1.52,
    CHF: 0.88,
    CNY: 7.24,
    INR: 83.12,
    MXN: 17.15,
  };

  // If base is not USD, convert all rates
  if (baseCurrency !== "USD") {
    const baseRate = usdRates[baseCurrency];
    if (!baseRate) return usdRates;

    const converted: ExchangeRates = {};
    for (const [currency, rate] of Object.entries(usdRates)) {
      converted[currency] = rate / baseRate;
    }
    return converted;
  }

  return usdRates;
}

/**
 * Format currency with proper symbol
 */
export function formatCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: "$",
    BRL: "R$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    CAD: "C$",
    AUD: "A$",
    CHF: "CHF",
    CNY: "¥",
    INR: "₹",
    MXN: "MX$",
  };

  return symbols[currency] || currency;
}

/**
 * Convert amount to display format with conversion info
 */
export async function formatWithConversion(
  amount: number,
  originalCurrency: string,
  displayCurrency: string,
  exchangeRate?: string | null
): Promise<{ original: string; converted: string; rate: string }> {
  const convertedAmount = await convertCurrency(
    amount,
    originalCurrency,
    displayCurrency,
    exchangeRate
  );

  const rate =
    exchangeRate ||
    (await getExchangeRate(originalCurrency, displayCurrency))?.toFixed(4) ||
    "1";

  return {
    original: `${formatCurrencySymbol(originalCurrency)}${(amount / 100).toFixed(2)}`,
    converted: `${formatCurrencySymbol(displayCurrency)}${(convertedAmount / 100).toFixed(2)}`,
    rate: rate,
  };
}
