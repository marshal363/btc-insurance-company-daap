import '@testing-library/jest-dom';
import {
  formatBtc,
  formatUsd,
  formatPercentage,
  formatDuration,
  btcToUsd,
  usdToBtc
} from '../formatters';

describe('formatters', () => {
  describe('formatBtc', () => {
    it('should format BTC values with the default 8 decimal places', () => {
      expect(formatBtc(1.23456789)).toBe('1.23456789 BTC');
      expect(formatBtc(0.00000001)).toBe('0.00000001 BTC');
      expect(formatBtc(100)).toBe('100.00000000 BTC');
    });

    it('should format BTC values with specified decimal places', () => {
      expect(formatBtc(1.23456789, 2)).toBe('1.23 BTC');
      expect(formatBtc(0.0000001, 4)).toBe('0.0000 BTC');
      expect(formatBtc(100, 0)).toBe('100 BTC');
    });
  });

  describe('formatUsd', () => {
    it('should format USD values with the default 2 decimal places', () => {
      expect(formatUsd(1.23)).toBe('$1.23');
      expect(formatUsd(0.01)).toBe('$0.01');
      expect(formatUsd(1000)).toBe('$1,000.00');
    });

    it('should format USD values with specified decimal places', () => {
      expect(formatUsd(1.23456, 4)).toBe('$1.2346');
      expect(formatUsd(0.0001, 4)).toBe('$0.0001');
      expect(formatUsd(1000, 0)).toBe('$1,000');
    });
  });

  describe('formatPercentage', () => {
    it('should format percentage values with the default 2 decimal places', () => {
      expect(formatPercentage(0.0123)).toBe('1.23%');
      expect(formatPercentage(0.5)).toBe('50.00%');
      expect(formatPercentage(1)).toBe('100.00%');
    });

    it('should format percentage values with specified decimal places', () => {
      expect(formatPercentage(0.0123, 0)).toBe('1%');
      expect(formatPercentage(0.5, 1)).toBe('50.0%');
      expect(formatPercentage(0.123456, 4)).toBe('12.3456%');
    });
  });

  describe('formatDuration', () => {
    it('should format days correctly', () => {
      expect(formatDuration(1)).toBe('1 day');
      expect(formatDuration(5)).toBe('5 days');
      expect(formatDuration(29)).toBe('29 days');
    });

    it('should format months correctly', () => {
      expect(formatDuration(30)).toBe('1 month');
      expect(formatDuration(60)).toBe('2 months');
      expect(formatDuration(90)).toBe('3 months');
    });

    it('should format years correctly', () => {
      expect(formatDuration(365)).toBe('1 year');
      expect(formatDuration(730)).toBe('2 years');
    });
  });

  describe('btcToUsd', () => {
    it('should convert BTC to USD using the given price', () => {
      expect(btcToUsd(1, 50000)).toBe(50000);
      expect(btcToUsd(0.5, 40000)).toBe(20000);
      expect(btcToUsd(0, 30000)).toBe(0);
    });
  });

  describe('usdToBtc', () => {
    it('should convert USD to BTC using the given price', () => {
      expect(usdToBtc(50000, 50000)).toBe(1);
      expect(usdToBtc(20000, 40000)).toBe(0.5);
      expect(usdToBtc(0, 30000)).toBe(0);
    });

    it('should handle division by zero', () => {
      expect(usdToBtc(1000, 0)).toBe(Infinity);
    });
  });
}); 