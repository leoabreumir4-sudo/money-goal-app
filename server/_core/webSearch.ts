import { ENV } from "./env";

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

/**
 * Get current exchange rate using free API (no auth required)
 */
export async function getCurrentExchangeRate(fromCurrency: string, toCurrency: string): Promise<number | null> {
  try {
    // Use exchangerate-api.com (free, no auth required)
    const url = `https://api.exchangerate-api.com/v4/latest/${fromCurrency.toUpperCase()}`;
    
    console.log(`[Exchange Rate] Fetching ${fromCurrency}/${toCurrency} from exchangerate-api.com`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`[Exchange Rate] API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (!data.rates || !data.rates[toCurrency.toUpperCase()]) {
      console.error(`[Exchange Rate] Currency ${toCurrency} not found`);
      return null;
    }

    const rate = data.rates[toCurrency.toUpperCase()];
    console.log(`[Exchange Rate] ${fromCurrency}/${toCurrency}: ${rate}`);
    
    return rate;
  } catch (error) {
    console.error("[Exchange Rate] Error:", error);
    return null;
  }
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


