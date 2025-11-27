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
 * Perform a web search using Google Custom Search API with fallback
 */
export async function searchWeb(query: string): Promise<SearchResult[]> {
  const apiKey = ENV.googleApiKey;
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID || "017576662512468239146:omuauf_lfve";
  
  // Try Google Custom Search API if we have API key
  if (apiKey) {
    try {
      const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=5`;
      
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
          console.log(`[Web Search] Google API returned ${data.items.length} results`);
          return data.items.slice(0, 5).map((item: any) => ({
            title: item.title,
            link: item.link,
            snippet: item.snippet || "",
          }));
        }
      } else {
        console.warn(`[Web Search] Google API error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error("[Web Search] Google API failed:", error);
    }
  }

  // Fallback: Return empty array and let AI use its knowledge
  console.log("[Web Search] No results available, AI will use general knowledge");
  return [];
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

