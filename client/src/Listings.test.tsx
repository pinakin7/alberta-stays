// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Listings } from './Listings';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('shows a distinct unavailable state without inventing listings', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 503, ok: false }));
  render(<Listings />);
  expect(await screen.findByText(/Sourced listings are not available yet/)).toBeInTheDocument();
});
it('displays asking-price provenance and supports market filters', async () => {
  const fetcher = vi.fn().mockResolvedValue({ status: 200, ok: true, json: async () => ({ total: 1, disclaimer: 'Imported, not independently verified.', listings: [{ id: 'fixture', title: 'Synthetic fixture', market: 'Calgary', priceCad: '200000.50', bedrooms: 2, sourceName: 'Fixture source', sourceUrl: 'https://example.com/fixture', retrievedAt: '2020-01-01T00:00:00Z', verificationStatus: 'unverified', brokerageName: 'Fixture brokerage' }] }) });
  vi.stubGlobal('fetch', fetcher); render(<Listings />);
  expect(await screen.findByText('Synthetic fixture')).toBeInTheDocument();
  expect(screen.getByText('Listing brokerage: Fixture brokerage')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Source record/ })).toHaveAttribute('href', 'https://example.com/fixture');
  fireEvent.change(screen.getByLabelText('Market name'), { target: { value: 'Calgary' } });
  fireEvent.click(screen.getByRole('button', { name: 'Search listings' }));
  expect(await screen.findByText('Synthetic fixture')).toBeInTheDocument();
  expect(fetcher.mock.calls.at(-1)?.[0]).toContain('market=Calgary');
});
it('rejects unsafe source links and shows a retry control', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, ok: true, json: async () => ({ total: 1, disclaimer: '', listings: [{ sourceUrl: 'javascript:alert(1)' }] }) }));
  render(<Listings />);
  expect(await screen.findByText(/Listings could not be loaded/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Retry listings' })).toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
