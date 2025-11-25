// Currency formatting helper with European formatting (. for thousands, , for decimals)
export const formatCurrency = (amount: number, currency: string = "USD"): string => {
  const value = amount / 100; // Convert cents to dollars
  
  const currencySymbols: Record<string, string> = {
    USD: "$",
    BRL: "R$",
    EUR: "€",
    GBP: "£",
  };
  
  const symbol = currencySymbols[currency] || "$";
  
  // Format with European style: . for thousands, , for decimals
  const formatted = value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  
  return `${symbol}${formatted}`;
};

// Format number without currency symbol (for display purposes)
export const formatNumber = (value: number, decimals: number = 2): string => {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

// Get user's currency from settings
export const getUserCurrency = (): string => {
  // This will be populated by the settings context
  return "USD";
};
