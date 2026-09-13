-- ⚠️ LEGACY: These Supabase storage policies are no longer required for new deployments.
-- File storage has been migrated to Cloudflare R2 (see lib/storage.ts).
-- Supabase is still used for Auth, Database, and Realtime — but NOT for file storage.
-- These policies are kept for reference only.

-- Storage RLS Policies for 'documents' bucket (LEGACY - Supabase Storage)
-- Run this in your Supabase SQL Editor

-- Note: First ensure RLS is enabled on the 'documents' bucket in Storage settings
-- Go to Storage > documents bucket > Policies and enable RLS

-- Policy: Allow authenticated users to upload files to the documents bucket
CREATE POLICY "Allow authenticated users to upload documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  (
    -- User can upload to their own application folders
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM applications WHERE user_id = auth.uid()
    )
    OR
    -- Admin can upload to application folders they created
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM applications WHERE created_by_admin_id = auth.uid()
    )
    OR
    -- Admins can upload anywhere
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

-- Policy: Allow users to read their own documents
CREATE POLICY "Allow users to read their own documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  (
    -- User can read documents from their own applications
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM applications WHERE user_id = auth.uid()
    )
    OR
    -- Admin can read documents from applications they created
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM applications WHERE created_by_admin_id = auth.uid()
    )
    OR
    -- Admins can read all documents
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

-- Policy: Allow users to delete their own documents
CREATE POLICY "Allow users to delete their own documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  (
    -- User can delete documents from their own applications
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM applications WHERE user_id = auth.uid()
    )
    OR
    -- Admin can delete documents from applications they created
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM applications WHERE created_by_admin_id = auth.uid()
    )
    OR
    -- Admins can delete all documents
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

-- Policy: Allow users to update their own documents
CREATE POLICY "Allow users to update their own documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents' AND
  (
    -- User can update documents from their own applications
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM applications WHERE user_id = auth.uid()
    )
    OR
    -- Admin can update documents from applications they created
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM applications WHERE created_by_admin_id = auth.uid()
    )
    OR
    -- Admins can update all documents
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

