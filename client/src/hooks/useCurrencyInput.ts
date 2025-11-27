import { useState, useCallback } from 'react';

/**
 * Hook for currency input formatting
 * - Allows typing with comma or dot as decimal separator
 * - Auto-formats with thousand separators as user types
 * - Returns formatted display value and raw numeric value
 */
export function useCurrencyInput(initialValue: string = '') {
  const [displayValue, setDisplayValue] = useState(initialValue);

  const formatCurrency = useCallback((value: string): string => {
    // Remove all non-digit characters except comma and dot
    let cleaned = value.replace(/[^\d,.]/g, '');
    
    // Replace comma with dot for internal processing
    cleaned = cleaned.replace(',', '.');
    
    // Ensure only one decimal separator
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Limit to 2 decimal places
    if (parts.length === 2 && parts[1].length > 2) {
      cleaned = parts[0] + '.' + parts[1].slice(0, 2);
    }
    
    // Format with thousand separators
    const [integerPart, decimalPart] = cleaned.split('.');
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    
    // Return formatted value
    if (decimalPart !== undefined) {
      return formattedInteger + '.' + decimalPart;
    }
    
    return formattedInteger;
  }, []);

  const handleChange = useCallback((inputValue: string) => {
    const formatted = formatCurrency(inputValue);
    setDisplayValue(formatted);
  }, [formatCurrency]);

  const getNumericValue = useCallback((): number => {
    // Remove thousand separators and convert to number
    const cleaned = displayValue.replace(/,/g, '');
    const numeric = parseFloat(cleaned);
    return isNaN(numeric) ? 0 : numeric;
  }, [displayValue]);

  const setValue = useCallback((value: string | number) => {
    if (typeof value === 'number') {
      setDisplayValue(formatCurrency(value.toString()));
    } else {
      setDisplayValue(formatCurrency(value));
    }
  }, [formatCurrency]);

  const reset = useCallback(() => {
    setDisplayValue('');
  }, []);

  return {
    displayValue,
    handleChange,
    getNumericValue,
    setValue,
    reset,
  };
}
