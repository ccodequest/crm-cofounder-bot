import { getDb } from './db.js';
import { SchemaVersion } from '../types/index.js';

export async function createDynamicTable(
  tableName: string,
  fields: Record<string, string>,
  createdBy: number
): Promise<SchemaVersion> {
  const prisma = getDb();

  const data = await prisma.schemaVersion.create({
    data: {
      table_name: tableName,
      schema_json: fields,
      version: 1,
      created_by: BigInt(createdBy),
      is_active: true,
    },
  });

  return data as unknown as SchemaVersion;
}

export async function listDynamicTables(): Promise<SchemaVersion[]> {
  const prisma = getDb();
  const data = await prisma.schemaVersion.findMany({
    where: { is_active: true },
    orderBy: { created_at: 'asc' },
  });
  return data as unknown as SchemaVersion[];
}
