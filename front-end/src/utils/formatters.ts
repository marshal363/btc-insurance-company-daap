/**
 * Formatting utility functions for consistent display of monetary values
 */

/**
 * Format a number as USD currency
 * @param value The numeric value to format
 * @param options Optional formatting options
 * @returns Formatted string with $ symbol and commas (e.g., $1,234.56)
 */
export const formatUSD = (
  value: number, 
  options: { 
    minimumFractionDigits?: number; 
    maximumFractionDigits?: number; 
    compact?: boolean;
  } = {}
): string => {
  const { 
    minimumFractionDigits = 2, 
    maximumFractionDigits = 2,
    compact = false 
  } = options;

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits,
    maximumFractionDigits,
    notation: compact ? 'compact' : 'standard',
    compactDisplay: compact ? 'short' : undefined
  }).format(value);
};

/**
 * Format a number as BTC
 * @param value The numeric value to format
 * @param options Optional formatting options
 * @returns Formatted string with BTC symbol (e.g., 0.25 BTC)
 */
export const formatBTC = (
  value: number,
  options: { 
    minimumFractionDigits?: number; 
    maximumFractionDigits?: number;
    includeSuffix?: boolean;
  } = {}
): string => {
  const { 
    minimumFractionDigits = 2, 
    maximumFractionDigits = 8,
    includeSuffix = true
  } = options;

  const formattedValue = new Intl.NumberFormat('en-US', {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);

  return includeSuffix ? `${formattedValue} BTC` : formattedValue;
};

/**
 * Format a number as a percentage
 * @param value The numeric value to format (0.05 = 5%)
 * @param options Optional formatting options
 * @returns Formatted string with % symbol (e.g., 5.00%)
 */
export const formatPercent = (
  value: number,
  options: { 
    minimumFractionDigits?: number; 
    maximumFractionDigits?: number;
  } = {}
): string => {
  const { 
    minimumFractionDigits = 2, 
    maximumFractionDigits = 2
  } = options;

  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value / 100);
};

/**
 * Format a timestamp as a human-readable date/time
 * @param timestamp The timestamp to format
 * @param options Optional formatting options
 * @returns Formatted date string
 */
export const formatTimestamp = (
  timestamp: number,
  options: {
    includeTime?: boolean;
  } = {}
): string => {
  const { includeTime = true } = options;
  
  const date = new Date(timestamp);
  const dateOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(includeTime ? {
      hour: '2-digit',
      minute: '2-digit',
    } : {})
  };
  
  return new Intl.DateTimeFormat('en-US', dateOptions).format(date);
};

/**
 * Utility functions for formatting monetary values consistently across the application
 */

/**
 * Format a BTC value to a human-readable string with a specified number of decimal places
 * @param value The BTC value to format
 * @param decimals The number of decimal places to show (default: 8)
 * @returns Formatted BTC value with BTC symbol
 */
export function formatBtc(value: number, decimals = 8): string {
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} BTC`;
}

/**
 * Format a USD value to a human-readable string with a specified number of decimal places
 * @param value The USD value to format
 * @param decimals The number of decimal places to show (default: 2)
 * @returns Formatted USD value with $ symbol
 */
export function formatUsd(value: number, decimals = 2): string {
  return value.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a percentage value to a human-readable string
 * @param value The percentage value (0.05 = 5%)
 * @param decimals The number of decimal places to show (default: 2)
 * @returns Formatted percentage value with % symbol
 */
export function formatPercentage(value: number, decimals = 2): string {
  return `${(value * 100).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

/**
 * Format a duration value in days to a human-readable string
 * @param days The number of days
 * @returns Formatted string (e.g., "30 days", "1 year")
 */
export function formatDuration(days: number): string {
  if (days % 365 === 0 && days >= 365) {
    const years = days / 365;
    return `${years} ${years === 1 ? 'year' : 'years'}`;
  }
  if (days % 30 === 0 && days >= 30) {
    const months = days / 30;
    return `${months} ${months === 1 ? 'month' : 'months'}`;
  }
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

/**
 * Convert a BTC value to USD based on the current price
 * @param btcValue The BTC value to convert
 * @param btcPrice The current BTC price in USD
 * @returns The equivalent USD value
 */
export function btcToUsd(btcValue: number, btcPrice: number): number {
  return btcValue * btcPrice;
}

/**
 * Convert a USD value to BTC based on the current price
 * @param usdValue The USD value to convert
 * @param btcPrice The current BTC price in USD
 * @returns The equivalent BTC value
 */
export function usdToBtc(usdValue: number, btcPrice: number): number {
  return usdValue / btcPrice;
} 