'use client';

import { useQuery } from '@tanstack/react-query';
import { BitcoinPriceData } from '../lib/types';

export function useBitcoinPrice() {
  return useQuery<BitcoinPriceData>({
    queryKey: ['bitcoinPrice'],
    queryFn: async () => {
      const response = await fetch('/api/bitcoin/price');
      if (!response.ok) {
        throw new Error('Failed to fetch Bitcoin price data');
      }
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });
}