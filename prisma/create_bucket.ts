import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Connecting to database to check and create storage buckets...');

  try {
    // Check if storage.buckets table exists
    const existingBuckets = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, name, public, created_at FROM storage.buckets;`
    );
    console.log('Existing storage buckets:', existingBuckets);
  } catch (err: any) {
    console.log('Querying storage.buckets:', err.message);
  }

  const sqlStatements = [
    // 1. Insert bucket 'school-erp-vault'
    `INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
     VALUES ('school-erp-vault', 'school-erp-vault', true, 52428800, NULL)
     ON CONFLICT (id) DO UPDATE SET public = true;`,

    // 2. Enable RLS on storage.objects if not already
    `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`,

    // 3. Drop existing policies if need to recreate cleanly
    `DROP POLICY IF EXISTS "Public Access" ON storage.objects;`,
    `DROP POLICY IF EXISTS "Allow All Uploads" ON storage.objects;`,
    `DROP POLICY IF EXISTS "Allow All Updates" ON storage.objects;`,
    `DROP POLICY IF EXISTS "Allow All Deletes" ON storage.objects;`,

    // 4. Create policies
    `CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'school-erp-vault');`,
    `CREATE POLICY "Allow All Uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'school-erp-vault');`,
    `CREATE POLICY "Allow All Updates" ON storage.objects FOR UPDATE USING (bucket_id = 'school-erp-vault');`,
    `CREATE POLICY "Allow All Deletes" ON storage.objects FOR DELETE USING (bucket_id = 'school-erp-vault');`
  ];

  for (const sql of sqlStatements) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log('SUCCESS SQL:', sql.split('\n')[0]);
    } catch (err: any) {
      console.error('ERROR SQL:', sql.split('\n')[0], '->', err.message);
    }
  }

  // Verify buckets after
  try {
    const bucketsAfter = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, name, public FROM storage.buckets;`
    );
    console.log('Storage buckets after execution:', bucketsAfter);
  } catch (err: any) {
    console.error('Error fetching buckets after:', err.message);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
