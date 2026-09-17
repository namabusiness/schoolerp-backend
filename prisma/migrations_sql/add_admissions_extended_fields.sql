-- ==============================================================================
-- MIGRATION: EXTENDED ADMISSION FIELDS & TAMIL NADU MARKSHEET METADATA
-- Safe idempotent script using IF NOT EXISTS for Supabase PostgreSQL
-- ==============================================================================

-- 1. Extend AdmissionApplication table
ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "age" INTEGER;
ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "studentPhotoUrl" TEXT;
ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "aadharNumber" TEXT;
ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "bloodGroup" TEXT;
ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "previousSchool" TEXT;
ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "previousBoard" TEXT;
ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "fatherName" TEXT;
ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "fatherPhone" TEXT;
ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "fatherPhotoUrl" TEXT;
ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "motherName" TEXT;
ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "motherPhone" TEXT;
ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "motherPhotoUrl" TEXT;
ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "emergencyPhone" TEXT;
ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "streamGroup" TEXT;
ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "tenthMarksData" TEXT;
ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "eleventhMarksData" TEXT;
ALTER TABLE "AdmissionApplication" ADD COLUMN IF NOT EXISTS "documentsData" TEXT;

-- 2. Extend ParentGuardian table
ALTER TABLE "ParentGuardian" ADD COLUMN IF NOT EXISTS "fatherPhone" TEXT;
ALTER TABLE "ParentGuardian" ADD COLUMN IF NOT EXISTS "fatherPhotoUrl" TEXT;
ALTER TABLE "ParentGuardian" ADD COLUMN IF NOT EXISTS "motherPhone" TEXT;
ALTER TABLE "ParentGuardian" ADD COLUMN IF NOT EXISTS "motherPhotoUrl" TEXT;
ALTER TABLE "ParentGuardian" ADD COLUMN IF NOT EXISTS "aadharNumber" TEXT;

-- 3. Extend Student table
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "studentPhotoUrl" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "aadharNumber" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "fatherPhotoUrl" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "motherPhotoUrl" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "previousSchool" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "streamGroup" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "tenthMarksData" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "eleventhMarksData" TEXT;
