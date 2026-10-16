// #236 #350 #351 #353 — a salary line's currency, period and amounts are read as written and shown the same in
// either language: no currency guessed from the language, names ending in 元 that aren't yuan recognised, hourly
// rates kept, and currency names shown in the interface language.
import { describe, expect, it } from 'vitest';
import { salaryText, CURRENCY_EN, CURRENCY_ZH } from '../src/lib/format';
import { currencyOf, parseMoney, periodOf } from '../src/features/workspace/completeness';
import { currencyLabel, inputUnit, salaryLine } from '../src/features/workspace/SalaryModal';

describe('#350 currencyOf', () => {
  it('reads names ending in 元 as their own currency, and a bare 元 as yuan', () => {
    expect(currencyOf('15K–20K/月 · 税前 · 美元')).toBe('USD');
    expect(currencyOf('15K–20K/月 · 新加坡元')).toBe('SGD');
    expect(currencyOf('300K–400K/年 · 日元')).toBe('JPY');
    expect(currencyOf('30K/月 · 港元')).toBe('HKD');
    expect(currencyOf('5K–6K/月 · 欧元')).toBe('EUR');
    expect(currencyOf('15K–20K/月 · 税前 · 人民币')).toBe('CNY');
    expect(currencyOf('15000-20000元/月')).toBe('CNY');
    expect(currencyOf('15K–22K / month · gross · CNY')).toBe('CNY');
    expect(currencyOf('USD 120K-150K / year')).toBe('USD');
    expect(currencyOf('$60-70k')).toBe('USD');
  });
  it('gives null for two different currencies or none — never one of them silently', () => {
    expect(currencyOf('15K 美元 或 100K 人民币')).toBeNull();
    expect(currencyOf('15K–20K / month')).toBeNull();
  });
});

describe('#351 hourly rates', () => {
  it('parses 26–36 / hour with its amounts and period, in English and Chinese', () => {
    expect(parseMoney('26–36 / hour · gross · USD')).toEqual({ amounts: [26, 36], currency: 'USD', period: 'hour' });
    expect(parseMoney('时薪 26–36 美元')).toEqual({ amounts: [26, 36], currency: 'USD', period: 'hour' });
    expect(periodOf('26-36/小时')).toBe('hour');
    // Small numbers are still not salaries when it isn't hourly.
    expect(parseMoney('3 年以上经验')).toBeNull();
  });
  it('round-trips: shown, parsed back into the editor, saved — same amounts, period and currency', () => {
    for (const [min, max, period, currency] of [[26, 36, 'hour', 'USD'], [15, 20, 'month', 'CNY'], [300, 400, 'year', 'JPY'], [12.5, 18.5, 'hour', 'SGD']] as const) {
      const line = salaryLine({ min, max, currency, period, tax: 'gross' }, 'en');
      const parsed = parseMoney(line)!;
      expect(parsed.period).toBe(period);
      expect(parsed.currency).toBe(currency);
      expect(parsed.amounts.map((n) => n / inputUnit(period))).toEqual([min, max]);
      expect(salaryLine({ min: parsed.amounts[0] / inputUnit(period), max: parsed.amounts[1] / inputUnit(period), currency, period, tax: 'gross' }, 'en')).toBe(line);
    }
  });
});

describe('#236 missing currency', () => {
  it('reads the same in both languages: not given, never yuan in Chinese and dollars in English', () => {
    const range = { min: 15000, max: 20000, period: 'month' as const, basis: 'gross' };
    expect(salaryText(range, 'zh')).toBe('15K–20K/月 · 税前 · 币种未提供');
    expect(salaryText(range, 'en')).toBe('15K–20K / month · gross · currency not given');
    expect(currencyOf(salaryText(range, 'en'))).toBeNull();
  });
  it('keeps a stated currency and amount as they are, without conversion', () => {
    expect(salaryText({ min: 15000, max: 20000, currency: 'USD', period: 'month' }, 'zh')).toBe('15K–20K/月 · 美元');
    expect(salaryText({ min: 15000, max: 20000, currency: 'USD', period: 'month' }, 'en')).toBe('15K–20K / month · USD');
  });
});

describe('#353 currency option labels', () => {
  it('names every supported currency in the interface language, ISO code kept', () => {
    for (const code of Object.keys(CURRENCY_ZH)) {
      expect(currencyLabel(code, 'en')).toBe(`${code} · ${CURRENCY_EN[code]}`);
      expect(currencyLabel(code, 'zh')).toBe(`${code} · ${CURRENCY_ZH[code]}`);
      expect(currencyLabel(code, 'en')).not.toMatch(/[一-鿿]/);
    }
  });
});
