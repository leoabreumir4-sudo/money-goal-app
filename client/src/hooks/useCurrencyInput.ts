import { useState, useCallback } from 'react';

/**
 * Hook for currency input formatting
 * - Allows typing with comma or dot as decimal separator
 * - Auto-formats as user types (adds thousand separators)
 * - Returns formatted display value and raw numeric value
 */
export function useCurrencyInput(initialValue: string = '') {
  const [displayValue, setDisplayValue] = useState(initialValue);

  const formatCurrency = useCallback((value: string): string => {
    // Remove all non-digit and non-comma/dot characters
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
    
    return cleaned;
  }, []);

  const handleChange = useCallback((inputValue: string) => {
    const formatted = formatCurrency(inputValue);
    setDisplayValue(formatted);
  }, [formatCurrency]);

  const getNumericValue = useCallback((): number => {
    const numeric = parseFloat(displayValue.replace(',', '.'));
    return isNaN(numeric) ? 0 : numeric;
  }, [displayValue]);

  const setValue = useCallback((value: string | number) => {
    if (typeof value === 'number') {
      setDisplayValue(value.toString());
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
