// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { App } from './App';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const result = { revenue: 40000, operating: 13000, rent: 24000, debt: 0, annualCashFlow: 3000, monthlyCashFlow: 250, breakEvenGrossRevenue: 35555 };
const response = (body: unknown, ok = true) => Promise.resolve({ ok, json: async () => body });
it('renders successful illustrative markets and calculated contribution', async () => {
  vi.stubGlobal('fetch', vi.fn((url) => response(url === '/api/markets' ? { markets: [{ name: 'Example market', revenue: 20000, occupancy: 60, role: 'Illustrative' }] } : result)));
  render(<App />);
  expect(await screen.findByText('Example market')).toBeInTheDocument();
  expect(await screen.findByText('$3,000')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Operating model'), { target: { value: 'management' } });
  expect(screen.getByText(/Operating cost ratio of management fee income/)).toBeInTheDocument();
});
it('shows independent market and scenario failures', async () => {
  vi.stubGlobal('fetch', vi.fn(() => response({}, false)));
  render(<App />);
  expect(await screen.findByText(/Market data could not be loaded/)).toBeInTheDocument();
  expect(await screen.findByText(/Scenario could not be calculated/)).toBeInTheDocument();
});
it('clears stale results when a recalculation fails', async () => {
  let fail = false;
  vi.stubGlobal('fetch', vi.fn((url) => response(url === '/api/markets' ? { markets: [] } : result, !fail)));
  render(<App />);
  expect(await screen.findByText('$3,000')).toBeInTheDocument();
  fail = true;
  fireEvent.change(screen.getByLabelText(/Annual guest revenue/), { target: { value: '50000' } });
  await screen.findByText(/Scenario could not be calculated/);
  expect(screen.queryByText('$3,000')).not.toBeInTheDocument();
});
it('ignores obsolete responses when assumptions change', async () => {
  let resolveFirst!: (value: unknown) => void;
  let calls = 0;
  vi.stubGlobal('fetch', vi.fn((url) => {
    if (url === '/api/markets') return response({ markets: [] });
    if (++calls === 1) return new Promise(resolve => { resolveFirst = resolve; });
    return response({ ...result, annualCashFlow: 5000 });
  }));
  render(<App />);
  fireEvent.change(screen.getByLabelText(/Annual guest revenue/), { target: { value: '50000' } });
  expect(await screen.findByText('$5,000')).toBeInTheDocument();
  resolveFirst({ ok: true, json: async () => result });
  await waitFor(() => expect(screen.queryByText('$3,000')).not.toBeInTheDocument());
});
