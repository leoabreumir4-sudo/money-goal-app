import { ENV } from "./env";

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

/**
 * Get current exchange rate with multiple fallback sources for accuracy
 */
export async function getCurrentExchangeRate(fromCurrency: string, toCurrency: string): Promise<number | null> {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  
  // Try primary source: frankfurter.app (European Central Bank data - very accurate and free)
  try {
    const url = `https://api.frankfurter.app/latest?from=${from}&to=${to}`;
    console.log(`[Exchange Rate] Fetching ${from}/${to} from frankfurter.app (ECB data)`);
    
    const response = await fetch(url);
    
    if (response.ok) {
      const data = await response.json();
      if (data.rates && data.rates[to]) {
        const rate = data.rates[to];
        console.log(`[Exchange Rate] ✅ ${from}/${to}: ${rate} (source: ECB via frankfurter.app)`);
        return rate;
      }
    }
  } catch (error) {
    console.warn("[Exchange Rate] Frankfurter.app failed, trying fallback...");
  }
  
  // Fallback 1: exchangerate-api.com
  try {
    const url = `https://api.exchangerate-api.com/v4/latest/${from}`;
    console.log(`[Exchange Rate] Trying fallback: exchangerate-api.com`);
    
    const response = await fetch(url);
    
    if (response.ok) {
      const data = await response.json();
      if (data.rates && data.rates[to]) {
        const rate = data.rates[to];
        console.log(`[Exchange Rate] ✅ ${from}/${to}: ${rate} (source: exchangerate-api.com)`);
        return rate;
      }
    }
  } catch (error) {
    console.warn("[Exchange Rate] Exchangerate-api.com failed, trying final fallback...");
  }
  
  // Fallback 2: fawazahmed0 (community-driven, updated daily)
  try {
    const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${from.toLowerCase()}.json`;
    console.log(`[Exchange Rate] Trying final fallback: fawazahmed0 API`);
    
    const response = await fetch(url);
    
    if (response.ok) {
      const data = await response.json();
      const rates = data[from.toLowerCase()];
      if (rates && rates[to.toLowerCase()]) {
        const rate = rates[to.toLowerCase()];
        console.log(`[Exchange Rate] ✅ ${from}/${to}: ${rate} (source: fawazahmed0)`);
        return rate;
      }
    }
  } catch (error) {
    console.error("[Exchange Rate] All sources failed:", error);
  }
  
  console.error(`[Exchange Rate] ❌ Could not fetch rate for ${from}/${to} from any source`);
  return null;
}

/**
 * Perform a web search using SerpAPI
 */
export async function searchWeb(query: string): Promise<SearchResult[]> {
  const serpApiKey = ENV.serpApiKey;
  
  if (!serpApiKey) {
    console.log("[Web Search] SerpAPI key not configured");
    return [];
  }
  
  try {
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${serpApiKey}&num=5`;
    
    console.log(`[Web Search] Searching with SerpAPI: "${query}"`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`[Web Search] SerpAPI error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    
    if (!data.organic_results || data.organic_results.length === 0) {
      console.log("[Web Search] No results found");
      return [];
    }

    const results = data.organic_results.slice(0, 5).map((item: any) => ({
      title: item.title || "",
      link: item.link || "",
      snippet: item.snippet || "",
    }));

    console.log(`[Web Search] SerpAPI returned ${results.length} results`);
    return results;
  } catch (error) {
    console.error("[Web Search] SerpAPI failed:", error);
    return [];
  }
}

/**
 * Format search results for AI context
 */
export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) {
    return "Nenhum resultado de busca disponível.";
  }

  return results
    .map((result, i) => `${i + 1}. ${result.title}\n   ${result.snippet}\n   Fonte: ${result.link}`)
    .join("\n\n");
}


