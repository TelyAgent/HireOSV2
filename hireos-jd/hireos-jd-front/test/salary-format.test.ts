// #99 review — two different salaries must never render the same text.
import { describe, expect, it } from 'vitest';
import { salaryText } from '../src/lib/format';

describe('salaryText', () => {
  it('shows small amounts as-is and larger ones in K without losing whole units', () => {
    expect(salaryText({ min: 26, max: 36, currency: 'USD', period: 'hour' }, 'en')).toBe('26–36 / hour · USD');
    expect(salaryText({ min: 15000, max: 22000, currency: 'CNY', period: 'month', basis: 'gross' }, 'en')).toBe('15K–22K / month · gross · CNY');
    expect(salaryText({ min: 1234, max: 1239, currency: 'USD', period: 'month' }, 'en')).toBe('1.234K–1.239K / month · USD');
  });
});
