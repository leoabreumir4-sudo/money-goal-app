// Currency formatting helper
export const formatCurrency = (amount: number, currency: string = "USD"): string => {
  const value = amount / 100; // Convert cents to dollars
  
  const currencySymbols: Record<string, string> = {
    USD: "$",
    BRL: "R$",
    EUR: "€",
    GBP: "£",
  };
  
  // Locale mapping for proper number formatting
  const localeMap: Record<string, string> = {
    USD: "en-US",
    BRL: "pt-BR",
    EUR: "de-DE",
    GBP: "en-GB",
  };
  
  const symbol = currencySymbols[currency] || "$";
  const locale = localeMap[currency] || "en-US";
  
  // Format with proper thousands separator and decimal separator
  const formatted = value.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  
  return `${symbol}${formatted}`;
};

// Get user's currency from settings
export const getUserCurrency = (): string => {
  // This will be populated by the settings context
  return "USD";
};
