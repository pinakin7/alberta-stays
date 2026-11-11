import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '@prisma/client';
import { ImportError, type ListingQuery, type ListingRow, type SourceInput } from './validation.js';

export function listingRepository(db: PrismaClient) {
  return {
    source: (id: string) => db.dataSource.findUnique({ where: { id } }),
    purge: (sourceId: string) => db.listing.deleteMany({ where: { sourceId } }),
    sources: () => db.dataSource.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    createSource: (input: SourceInput) => db.dataSource.create({ data: {
      name: input.name, url: input.url, provider: input.provider, permissionReference: input.permissionReference,
    } }),
    async import(sourceId: string, rows: ListingRow[], hiddenIds: string[] = []) {
      return db.$transaction(async tx => {
        const source = await tx.dataSource.findUnique({ where: { id: sourceId } });
        if (!source) throw new ImportError('Unknown data source. Register an authorized source first.');
        const origin = new URL(source.url).origin;
        if (rows.some(row => new URL(row.sourceUrl).origin !== origin)) throw new ImportError('Every listing URL must belong to the registered source origin.');
        await tx.listing.deleteMany({ where: { sourceId, expiresAt: { lte: new Date() } } });
        if (hiddenIds.length) await tx.listing.deleteMany({ where: { sourceId, externalId: { in: hiddenIds } } });
        let updated = 0;
        let skipped = 0;
        for (const row of rows) {
          const existing = await tx.listing.findUnique({ where: { sourceId_externalId: { sourceId, externalId: row.externalId } } });
          if (existing && existing.retrievedAt >= new Date(row.retrievedAt)) { skipped++; continue; }
          const market = await tx.market.upsert({ where: { name: row.market }, create: { name: row.market }, update: {} });
          const data = {
            title: row.title, sourceUrl: row.sourceUrl, retrievedAt: new Date(row.retrievedAt),
            priceCad: new Prisma.Decimal(row.priceCad), bedrooms: row.bedrooms,
            mlsNumber: row.mlsNumber ?? null, boardId: row.boardId ?? null, brokerageName: row.brokerageName ?? null, expiresAt: row.expiresAt ?? null,
            marketId: market.id, verificationStatus: 'unverified', importedAt: new Date(),
          };
          await tx.listing.upsert({
            where: { sourceId_externalId: { sourceId, externalId: row.externalId } },
            create: { ...data, sourceId, externalId: row.externalId }, update: data,
          });
          updated++;
        }
        return { updated, skipped };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 30000 });
    },
    async list(query: ListingQuery) {
      const where = {
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        ...(query.market ? { market: { name: { equals: query.market, mode: 'insensitive' as const } } } : {}),
      };
      const [total, rows] = await db.$transaction([
        db.listing.count({ where }),
        db.listing.findMany({ where, orderBy: [{ retrievedAt: 'desc' }, { id: 'asc' }], skip: (query.page - 1) * query.limit, take: query.limit,
          include: { market: { select: { name: true } }, source: { select: { name: true, url: true } } },
        }),
      ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 10000, timeout: 10000 });
      return { total, listings: rows.map(row => ({
        id: row.id, title: row.title, market: row.market.name, priceCad: row.priceCad.toString(),
        bedrooms: row.bedrooms, sourceUrl: row.sourceUrl, retrievedAt: row.retrievedAt.toISOString(),
        verificationStatus: row.verificationStatus, brokerageName: row.brokerageName, mlsNumber: row.mlsNumber, boardId: row.boardId, sourceName: row.source.name,
      })) };
    },
  };
}
export type ListingRepository = ReturnType<typeof listingRepository>;
export function createListingStorage() {
  if (process.env.ENABLE_LISTING_STORAGE !== 'true') return undefined;
  if (!process.env.DATABASE_URL || !process.env.DIRECT_URL || (process.env.ADMIN_INGEST_TOKEN?.length ?? 0) < 32) {
    throw new Error('Listing storage requires DATABASE_URL, DIRECT_URL and an ADMIN_INGEST_TOKEN of at least 32 characters.');
  }
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 10000 }), log: [] });
  return { repository: listingRepository(client), publishListings: process.env.LISTING_PUBLICATION_AUTHORIZED === 'true', repliersKey: process.env.REPLIERS_API_KEY, token: process.env.ADMIN_INGEST_TOKEN!, disconnect: () => client.$disconnect() };
}
