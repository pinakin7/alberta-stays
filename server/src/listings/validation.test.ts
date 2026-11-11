import { expect, it } from 'vitest';
import { parseListingsCsv, sourceSchema } from './validation.js';
const header = 'externalId,title,market,sourceUrl,retrievedAt,priceCad,bedrooms\n';
const row = 'one,"Example, not a live listing",Calgary,https://example.com/one,2020-01-01T00:00:00Z,200000.50,2';
it('preserves decimal asking prices, quoted commas and provenance', () => {
  expect(parseListingsCsv(header + row)[0]).toMatchObject({ externalId: 'one', title: 'Example, not a live listing', priceCad: '200000.50', bedrooms: 2, retrievedAt: '2020-01-01T00:00:00Z' });
});
it('requires an explicit source permission record', () => {
  expect(sourceSchema.safeParse({ name: 'example', url: 'https://example.com', permissionReference: 'license' }).success).toBe(false);
});
it.each([
  header + row + '\n' + row,
  header + row.replace('200000.50', '-1'),
  header + row.replace('200000.50', '1e6'),
  header + row.replace('2020-01-01', '2999-01-01'),
  header + row.replace('https://example.com/one', 'javascript:alert(1)'),
  header + row.replace('https://example.com/one', 'https://user:pass@example.com'),
  header.replace('bedrooms', 'title') + row,
  header + '"unterminated',
  header,
  header + Array.from({ length: 501 }, (_, i) => row.replace('one,', `${i},`)).join('\n'),
])('rejects malformed, unsafe or ambiguous import data', csv => { expect(() => parseListingsCsv(csv)).toThrow(); });
