-- Storage RLS Policies for 'documents' bucket
-- Run this in your Supabase SQL Editor

-- Ensure RLS is enabled on the 'documents' bucket in Storage settings
-- Go to Storage > documents bucket > Policies and enable RLS

-- 1. Policy: Allow authenticated users, admins, and agents to upload files to the documents bucket
DROP POLICY IF EXISTS "Allow authenticated users to upload documents" ON storage.objects;
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
    -- Agent can upload to application folders they created/manage
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM applications WHERE agent_id = auth.uid()
    )
    OR
    -- Admins and agents can upload based on role metadata or profiles
    (auth.jwt()->'user_metadata'->>'role' IN ('admin', 'agent'))
    OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE (id = auth.uid() OR user_id = auth.uid()) AND role IN ('admin', 'agent')
    )
  )
);

-- 2. Policy: Allow users, admins, and agents to read documents
DROP POLICY IF EXISTS "Allow users to read their own documents" ON storage.objects;
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
    -- Agent can read documents from applications they created/manage
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM applications WHERE agent_id = auth.uid()
    )
    OR
    -- Admins and agents can read based on role metadata or profiles
    (auth.jwt()->'user_metadata'->>'role' IN ('admin', 'agent'))
    OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE (id = auth.uid() OR user_id = auth.uid()) AND role IN ('admin', 'agent')
    )
  )
);

-- 3. Policy: Allow users, admins, and agents to delete documents
DROP POLICY IF EXISTS "Allow users to delete their own documents" ON storage.objects;
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
    -- Agent can delete documents from applications they created/manage
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM applications WHERE agent_id = auth.uid()
    )
    OR
    -- Admins and agents can delete based on role metadata or profiles
    (auth.jwt()->'user_metadata'->>'role' IN ('admin', 'agent'))
    OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE (id = auth.uid() OR user_id = auth.uid()) AND role IN ('admin', 'agent')
    )
  )
);

-- 4. Policy: Allow users, admins, and agents to update documents
DROP POLICY IF EXISTS "Allow users to update their own documents" ON storage.objects;
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
    -- Agent can update documents from applications they created/manage
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM applications WHERE agent_id = auth.uid()
    )
    OR
    -- Admins and agents can update based on role metadata or profiles
    (auth.jwt()->'user_metadata'->>'role' IN ('admin', 'agent'))
    OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE (id = auth.uid() OR user_id = auth.uid()) AND role IN ('admin', 'agent')
    )
  )
);
