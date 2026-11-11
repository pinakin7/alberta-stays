import { describe, expect, it } from 'vitest';
import { calculateScenario, scenarioSchema, type Scenario } from './scenario.js';
const base: Scenario = { model: 'arbitrage', grossRevenue: 40000, expenseRatio: .325, monthlyRent: 2000, monthlyDebt: 1000, managementFee: .2 };
describe('annual scenario economics', () => {
  it('separates guest revenue, rent and debt for arbitrage', () => {
    expect(calculateScenario(base)).toMatchObject({ guestRevenue: 40000, managementFees: 0, revenue: 40000, operating: 13000, rent: 24000, debt: 0, annualCashFlow: 3000, monthlyCashFlow: 250 });
  });
  it('charges management costs against fee income, without owner rent or debt', () => {
    expect(calculateScenario({ ...base, model: 'management' })).toMatchObject({ guestRevenue: 40000, managementFees: 8000, revenue: 8000, operating: 2600, rent: 0, debt: 0, annualCashFlow: 5400, breakEvenGrossRevenue: 0 });
  });
  it('uses debt service only for owned properties', () => {
    expect(calculateScenario({ ...base, model: 'owned' })).toMatchObject({ rent: 0, debt: 12000, annualCashFlow: 15000 });
  });
  it('computes break-even and negative cash flow', () => {
    const result = calculateScenario({ ...base, grossRevenue: 10000 });
    expect(result.annualCashFlow).toBe(-17250);
    expect(result.breakEvenGrossRevenue).toBeCloseTo(35555.555556);
    expect(calculateScenario({ ...base, grossRevenue: result.breakEvenGrossRevenue! }).annualCashFlow).toBeCloseTo(0);
  });
  it('handles zero revenue and zero variable margin without Infinity', () => {
    expect(calculateScenario({ ...base, grossRevenue: 0 }).annualCashFlow).toBe(-24000);
    expect(calculateScenario({ ...base, expenseRatio: 1 }).breakEvenGrossRevenue).toBeNull();
    expect(calculateScenario({ ...base, model: 'management', managementFee: 0 }).breakEvenGrossRevenue).toBeNull();
  });
  it.each([{ grossRevenue: -1 }, { grossRevenue: NaN }, { monthlyDebt: Infinity }, { expenseRatio: 1.1 }, { managementFee: -.1 }, { monthlyRent: 10000001 }])('rejects invalid financial input %j', patch => {
    expect(scenarioSchema.safeParse({ ...base, ...patch }).success).toBe(false);
    expect(() => calculateScenario({ ...base, ...patch })).toThrow();
  });
});
