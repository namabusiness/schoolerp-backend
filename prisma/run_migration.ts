import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Connecting to database and running migration...');
  const statements = [
    // 1. AdmissionApplication
    `ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "age" INTEGER;`,
    `ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "studentPhotoUrl" TEXT;`,
    `ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "aadharNumber" TEXT;`,
    `ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "bloodGroup" TEXT;`,
    `ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "previousSchool" TEXT;`,
    `ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "previousBoard" TEXT;`,
    `ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "fatherName" TEXT;`,
    `ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "fatherPhone" TEXT;`,
    `ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "fatherPhotoUrl" TEXT;`,
    `ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "motherName" TEXT;`,
    `ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "motherPhone" TEXT;`,
    `ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "motherPhotoUrl" TEXT;`,
    `ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "emergencyPhone" TEXT;`,
    `ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "streamGroup" TEXT;`,
    `ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "tenthMarksData" TEXT;`,
    `ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "eleventhMarksData" TEXT;`,
    `ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "documentsData" TEXT;`,

    // 2. ParentGuardian
    `ALTER TABLE "ParentGuardian" ADD COLUMN IF NOT EXISTS "fatherPhone" TEXT;`,
    `ALTER TABLE "ParentGuardian" ADD COLUMN IF NOT EXISTS "fatherPhotoUrl" TEXT;`,
    `ALTER TABLE "ParentGuardian" ADD COLUMN IF NOT EXISTS "motherPhone" TEXT;`,
    `ALTER TABLE "ParentGuardian" ADD COLUMN IF NOT EXISTS "motherPhotoUrl" TEXT;`,
    `ALTER TABLE "ParentGuardian" ADD COLUMN IF NOT EXISTS "aadharNumber" TEXT;`,

    // 3. Student
    `ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "studentPhotoUrl" TEXT;`,
    `ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "aadharNumber" TEXT;`,
    `ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "fatherPhotoUrl" TEXT;`,
    `ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "motherPhotoUrl" TEXT;`,
    `ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "previousSchool" TEXT;`,
    `ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "streamGroup" TEXT;`,
    `ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "tenthMarksData" TEXT;`,
    `ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "eleventhMarksData" TEXT;`
  ];

  for (const sql of statements) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log('SUCCESS:', sql);
    } catch (err: any) {
      console.error('ERROR SQL:', sql, err.message);
    }
  }

  // Also query columns to verify
  const cols = await prisma.$queryRawUnsafe<any[]>(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'AdmissionApplication';`
  );
  console.log('Columns in AdmissionApplication:', cols.map((c) => c.column_name).join(', '));

  console.log('Migration script completed successfully!');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
