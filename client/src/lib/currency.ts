// Currency formatting helper
export const formatCurrency = (amount: number, currency: string = "USD"): string => {
  const value = amount / 100; // Convert cents to dollars
  
  const currencySymbols: Record<string, string> = {
    USD: "$",
    BRL: "R$",
    EUR: "€",
    GBP: "£",
  };
  
  const symbol = currencySymbols[currency] || "$";
  return `${symbol}${value.toFixed(2)}`;
};

// Get user's currency from settings
export const getUserCurrency = (): string => {
  // This will be populated by the settings context
  return "USD";
};
