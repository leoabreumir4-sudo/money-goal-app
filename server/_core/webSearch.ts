import { ENV } from "./env";

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

/**
 * Perform a web search using Google Custom Search API
 * Note: Requires GOOGLE_SEARCH_ENGINE_ID environment variable
 */
export async function searchWeb(query: string): Promise<SearchResult[]> {
  const apiKey = ENV.googleApiKey;
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID || "017576662512468239146:omuauf_lfve"; // Default CSE ID
  
  if (!apiKey) {
    console.warn("[Web Search] No API key available");
    return [];
  }

  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=5`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`[Web Search] API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      console.log("[Web Search] No results found");
      return [];
    }

    return data.items.slice(0, 5).map((item: any) => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet || "",
    }));
  } catch (error) {
    console.error("[Web Search] Error:", error);
    return [];
  }
}

/**
 * Get current exchange rate from web search
 */
export async function getCurrentExchangeRate(fromCurrency: string, toCurrency: string): Promise<number | null> {
  try {
    const query = `${fromCurrency} to ${toCurrency} exchange rate today`;
    const results = await searchWeb(query);
    
    if (results.length === 0) return null;
    
    // Try to extract rate from snippets
    for (const result of results) {
      const text = `${result.title} ${result.snippet}`.toLowerCase();
      
      // Match patterns like "1 usd = 5.25 brl" or "exchange rate: 5.25"
      const patterns = [
        /1\s*(?:usd|dollar|dólar)\s*=?\s*([\d.,]+)\s*(?:brl|real|reais)/i,
        /(?:rate|taxa|cotação).*?([\d.,]+)/i,
        /([\d.,]+)\s*(?:brl|real|reais)/i
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const rate = parseFloat(match[1].replace(',', '.'));
          if (rate > 0 && rate < 100) { // Sanity check
            console.log(`[Exchange Rate] Found ${fromCurrency}/${toCurrency}: ${rate}`);
            return rate;
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error("[Exchange Rate] Error:", error);
    return null;
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
