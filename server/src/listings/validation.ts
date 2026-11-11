import { z } from 'zod';
import { parse } from 'csv-parse/sync';

const text = (max: number) => z.string().trim().min(1).max(max);
export const httpsUrl = z.string().max(2000).url().refine(value => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password;
}, 'Use an HTTPS URL without embedded credentials');
export const sourceSchema = z.object({
  name: text(120), url: httpsUrl,
  permissionReference: text(1000),
  authorized: z.literal(true),
  provider: z.enum(['csv', 'repliers']).default('csv'),
}).strict().refine(source => source.provider !== 'repliers' || source.url === 'https://api.repliers.io', 'Repliers sources must use https://api.repliers.io');
export const importSchema = z.object({ sourceId: text(100), csv: z.string().min(1).max(90_000) }).strict();
export const querySchema = z.object({
  market: text(120).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();
const rowSchema = z.object({
  externalId: text(200), title: text(240), market: text(120), sourceUrl: httpsUrl,
  retrievedAt: z.string().datetime({ offset: true }).refine(value => Date.parse(value) <= Date.now(), 'Retrieval timestamp cannot be in the future'),
  priceCad: z.string().regex(/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/).refine(value => Number(value) > 0 && Number(value) <= 10_000_000, 'Price must be positive and at most CAD 10 million'),
  bedrooms: z.string().regex(/^(?:[0-9]|[1-9][0-9])?$/).transform(value => value === '' ? null : Number(value)),
}).strict();
export type ListingRow = z.infer<typeof rowSchema> & { mlsNumber?: string; boardId?: number; brokerageName?: string; expiresAt?: Date };
export type SourceInput = z.infer<typeof sourceSchema>;
export type ListingQuery = z.infer<typeof querySchema>;

export class ImportError extends Error {}
export function parseListingsCsv(csv: string): ListingRow[] {
  let records: Record<string, string>[];
  const columns = ['externalId', 'title', 'market', 'sourceUrl', 'retrievedAt', 'priceCad', 'bedrooms'];
  try {
    records = parse(csv, {
      bom: true, skip_empty_lines: true, max_record_size: 10000,
      columns: (header: string[]) => {
        if (header.length !== columns.length || new Set(header).size !== columns.length || !columns.every(name => header.includes(name))) {
          throw new ImportError('CSV must contain exactly these unique columns: ' + columns.join(','));
        }
        return header;
      },
    });
  } catch (error) {
    throw new ImportError(error instanceof ImportError ? error.message : 'Malformed CSV; check quoting and column counts.');
  }
  if (records.length < 1 || records.length > 500) throw new ImportError('Import between 1 and 500 listings per batch.');
  const seen = new Set<string>();
  return records.map((record, index) => {
    const result = rowSchema.safeParse(record);
    if (!result.success) throw new ImportError(`Row ${index + 2}: invalid ${result.error.issues.map(issue => issue.path.join('.')).join(', ')}.`);
    if (seen.has(result.data.externalId)) throw new ImportError(`Row ${index + 2}: duplicate externalId in batch.`);
    seen.add(result.data.externalId);
    return result.data;
  });
}
