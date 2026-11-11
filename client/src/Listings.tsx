import React, { useEffect, useState } from 'react';
import { z } from 'zod';
const responseSchema = z.object({
  listings: z.array(z.object({
    id: z.string(), title: z.string(), market: z.string(), priceCad: z.string().regex(/^\d+(?:\.\d+)?$/),
    brokerageName: z.string().nullable().optional(), mlsNumber: z.string().nullable().optional(),
    bedrooms: z.number().int().nullable(), sourceName: z.string(),
    sourceUrl: z.string().url().refine(value => { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; }),
    retrievedAt: z.string().datetime({ offset: true }), verificationStatus: z.string(),
  })), total: z.number().int().nonnegative(), disclaimer: z.string(),
});
type ListingPage = z.infer<typeof responseSchema>;
export function Listings() {
  const [market, setMarket] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListingPage | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setData(null); setMessage('');
    const params = new URLSearchParams({ page: String(page), limit: '12' });
    if (filter) params.set('market', filter);
    fetch(`/api/listings?${params}`, { signal: controller.signal }).then(async response => {
      if (response.status === 503) {
        if (!controller.signal.aborted) setMessage('Sourced listings are not available yet. The planning benchmarks above remain illustrative.');
        return;
      }
      if (!response.ok) throw new Error('Request failed');
      const parsed = responseSchema.parse(await response.json());
      if (!controller.signal.aborted) setData(parsed);
    }).catch(() => {
      if (!controller.signal.aborted) setMessage('Listings could not be loaded. Please retry.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filter, page, retry]);
  return <section id="listings"><p className="eyebrow">SOURCED PROPERTY RESEARCH</p><h2>Explore imported listings</h2>
    <p>Source-attributed asking prices, separate from illustrative projections. Availability and short-term rental eligibility require independent verification.</p>
    <form className="listing-filter" onSubmit={event => { event.preventDefault(); setFilter(market.trim()); setPage(1); }}>
      <label htmlFor="listing-market">Market name</label>
      <input id="listing-market" value={market} maxLength={120} onChange={event => setMarket(event.target.value)} placeholder="All markets" />
      <button type="submit">Search listings</button>
    </form>
    <div aria-live="polite" aria-busy={loading}>
      {loading && <p>Loading sourced listings…</p>}
      {message && <p role="status">{message} <button onClick={() => setRetry(value => value + 1)}>Retry listings</button></p>}
      {data && <><p>{data.disclaimer}</p><p>{data.total} sourced listing{data.total === 1 ? '' : 's'}</p>
        {data.listings.length === 0 && <p>No imported listings match this market.</p>}
        <div className="cards">{data.listings.map(listing => <article className="card" key={listing.id}>
          <h3>{listing.title}</h3><p>{listing.market}</p>
          <p className="big">{new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(listing.priceCad))}</p>
          <p>Asking price · {listing.bedrooms === null ? 'Bedrooms not supplied' : `${listing.bedrooms} bedrooms`}</p>
          <p>Verification: {listing.verificationStatus}</p>
          {listing.brokerageName && <p>Listing brokerage: {listing.brokerageName}</p>}
          <p>Retrieved <time dateTime={listing.retrievedAt}>{new Date(listing.retrievedAt).toLocaleDateString('en-CA')}</time></p>
          <a href={listing.sourceUrl} target="_blank" rel="noopener noreferrer">Source record: {listing.sourceName}</a>
        </article>)}</div>
        <div className="listing-pagination"><button disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous listings</button>
          <span>Page {page}</span><button disabled={page * 12 >= data.total} onClick={() => setPage(value => value + 1)}>Next listings</button></div>
      </>}
    </div>
  </section>;
}
