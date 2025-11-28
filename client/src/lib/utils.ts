import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata número em moeda brasileira
 * @param value - Valor em centavos ou dólares
 * @param currency - Código da moeda (BRL, USD, EUR)
 * @param isCents - Se o valor está em centavos (padrão: false)
 */
export function formatCurrency(value: number, currency: string = "USD", isCents: boolean = false): string {
  const amount = isCents ? value / 100 : value;
  
  if (currency === "BRL") {
    // Formato brasileiro: R$ 1.234,56
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } else if (currency === "EUR") {
    // Formato europeu: € 1.234,56
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } else {
    // Formato americano: $1,234.56
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }
}

/**
 * Formata número de forma compacta (1.5K, 1.2M)
 */
export function formatCompactCurrency(value: number, currency: string = "USD", isCents: boolean = false): string {
  const amount = isCents ? value / 100 : value;
  const symbol = currency === "BRL" ? "R$" : currency === "EUR" ? "€" : "$";
  
  if (amount >= 1000000) {
    return `${symbol} ${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `${symbol} ${(amount / 1000).toFixed(1)}K`;
  } else {
    return formatCurrency(value, currency, isCents);
  }
}
