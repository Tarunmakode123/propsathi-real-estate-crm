import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Creates a tenant-isolated instance of the Prisma Client.
 * Automatically injects tenantId filters for reads and creates,
 * and intercepts unique lookups and writes to prevent cross-tenant access.
 */
export function getTenantPrisma(tenantId: string) {
  if (!tenantId) {
    throw new Error('Tenant ID is required to instantiate a tenant-scoped Prisma client.');
  }

  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: { model: string; operation: string; args: any; query: (args: any) => Promise<any> }) {
          const tenantModels = ['User', 'Connector', 'Lead', 'Listing', 'WebhookEventLog'];

          if (!tenantModels.includes(model)) {
            // Models like Tenant do not have tenantId field, run query normally
            return query(args);
          }

          const currentArgs = (args || {}) as any;

          // 1. Enforce tenantId on CREATE operations
          if (operation === 'create') {
            currentArgs.data = {
              ...currentArgs.data,
              tenantId,
            };
          }

          if (operation === 'createMany') {
            if (Array.isArray(currentArgs.data)) {
              currentArgs.data = currentArgs.data.map((item: any) => ({
                ...item,
                tenantId,
              }));
            } else {
              currentArgs.data = {
                ...currentArgs.data,
                tenantId,
              };
            }
          }

          // 2. Enforce tenantId on standard multi-record READ queries
          if (
            [
              'findFirst',
              'findMany',
              'count',
              'aggregate',
              'groupBy',
            ].includes(operation)
          ) {
            currentArgs.where = {
              ...currentArgs.where,
              tenantId,
            };
          }

          // 3. Enforce tenantId on UPDATE/DELETE operations (which use unique criteria in Prisma)
          if (['update', 'updateMany', 'delete', 'deleteMany'].includes(operation)) {
            // For updateMany and deleteMany, we can directly inject tenantId into the where clause
            if (operation === 'updateMany' || operation === 'deleteMany') {
              currentArgs.where = {
                ...currentArgs.where,
                tenantId,
              };
            } else {
              // For singular update/delete, we must verify ownership first to avoid Prisma shape errors
              const dbName = model.charAt(0).toLowerCase() + model.slice(1);
              const record = await (prisma as any)[dbName].findFirst({
                where: { ...currentArgs.where, tenantId },
                select: { id: true },
              });

              if (!record) {
                throw new Error(`Record not found or access denied in ${model}`);
              }
            }
          }

          // 4. Enforce tenantId on UPSERT operations
          if (operation === 'upsert') {
            currentArgs.create = {
              ...currentArgs.create,
              tenantId,
            };
            currentArgs.update = {
              ...currentArgs.update,
              tenantId,
            };
            currentArgs.where = {
              ...currentArgs.where,
              tenantId,
            };
          }

          // Execute query
          const result = await query(args);

          // 5. Post-query verification for findUnique (unique lookups don't allow injecting extra where fields in Prisma validation)
          if (operation === 'findUnique' && result) {
            if (result.tenantId !== tenantId) {
              // Row belongs to another tenant; return null as if it does not exist
              return null;
            }
          }

          return result;
        },
      },
    },
  });
}
