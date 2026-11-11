import { z } from 'zod';

// Ratios are fractions. For management, expenseRatio applies to operator fee
// income, excluding owner-paid property costs. All monetary inputs are CAD.
const amount = z.number().finite().min(0).max(10_000_000);
export const scenarioSchema = z.object({
  model: z.enum(['owned', 'arbitrage', 'management']),
  grossRevenue: amount,
  expenseRatio: z.number().finite().min(0).max(1),
  monthlyRent: amount.default(0),
  monthlyDebt: amount.default(0),
  managementFee: z.number().finite().min(0).max(1).default(0.2),
}).strict();
export type Scenario = z.infer<typeof scenarioSchema>;

/** Annual contribution before tax, setup costs and central overhead.
 * Debt is cash debt service, not an operating expense or tax deduction.
 * null break-even means no positive contribution margin is available.
 */
export function calculateScenario(input: Scenario) {
  const v = scenarioSchema.parse(input);
  const managementFees = v.model === 'management' ? v.grossRevenue * v.managementFee : 0;
  const revenue = v.model === 'management' ? managementFees : v.grossRevenue;
  const operating = revenue * v.expenseRatio;
  const rent = v.model === 'arbitrage' ? v.monthlyRent * 12 : 0;
  const debt = v.model === 'owned' ? v.monthlyDebt * 12 : 0;
  const annualCashFlow = revenue - operating - rent - debt;
  const margin = (v.model === 'management' ? v.managementFee : 1) * (1 - v.expenseRatio);
  return {
    guestRevenue: v.grossRevenue, managementFees, revenue, operating, rent, debt,
    annualCashFlow, monthlyCashFlow: annualCashFlow / 12,
    breakEvenGrossRevenue: margin > 0 ? (rent + debt) / margin : null,
  };
}
