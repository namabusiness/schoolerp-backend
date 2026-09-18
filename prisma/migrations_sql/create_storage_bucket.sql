-- ==============================================================================
-- SUPABASE STORAGE BUCKET CREATION & ACCESS POLICIES
-- ==============================================================================
-- Bucket Name: school-erp-vault (matches SUPABASE_BUCKET in backend/.env)
-- Access: Public (allows public reading of document links, photos & marksheet scans)
-- ==============================================================================

-- 1. Create the Storage Bucket in Supabase
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'school-erp-vault',
    'school-erp-vault',
    true,
    52428800, -- 50MB max file size limit
    NULL      -- Allows PDF, PNG, JPG, WEBP, etc.
)
ON CONFLICT (id) DO UPDATE 
SET public = true, 
    file_size_limit = 52428800;

-- 2. Drop any previous conflicting policies (idempotent)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Allow All Uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow All Updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow All Deletes" ON storage.objects;

-- 3. Policy: Allow Public Read Access (view photos, TCs, marksheets, receipts)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'school-erp-vault');

-- 4. Policy: Allow Uploads (insert files into vault)
CREATE POLICY "Allow All Uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'school-erp-vault');

-- 5. Policy: Allow Updates
CREATE POLICY "Allow All Updates"
ON storage.objects FOR UPDATE
USING (bucket_id = 'school-erp-vault');

-- 6. Policy: Allow Deletes
CREATE POLICY "Allow All Deletes"
ON storage.objects FOR DELETE
USING (bucket_id = 'school-erp-vault');

-- ==============================================================================
-- VERIFICATION QUERY
-- ==============================================================================
SELECT id, name, public, file_size_limit, created_at 
FROM storage.buckets 
WHERE id = 'school-erp-vault';
