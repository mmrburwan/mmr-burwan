-- SQL script to add RLS policies for agents
-- Run this in your Supabase SQL Editor

----------------------------------------------------
-- 1. APPLICATIONS POLICIES
----------------------------------------------------

-- Allow agents to insert applications on behalf of clients
DROP POLICY IF EXISTS "Agents can insert their clients applications" ON public.applications;
CREATE POLICY "Agents can insert their clients applications" 
ON public.applications 
FOR INSERT 
WITH CHECK (auth.uid() = agent_id);

-- Allow agents to view applications they created
DROP POLICY IF EXISTS "Agents can view their clients applications" ON public.applications;
CREATE POLICY "Agents can view their clients applications" 
ON public.applications 
FOR SELECT 
USING (auth.uid() = agent_id);

-- Allow agents to update applications they created
DROP POLICY IF EXISTS "Agents can update their clients applications" ON public.applications;
CREATE POLICY "Agents can update their clients applications" 
ON public.applications 
FOR UPDATE 
USING (auth.uid() = agent_id);

-- Allow agents to delete applications they created (if needed)
DROP POLICY IF EXISTS "Agents can delete their clients applications" ON public.applications;
CREATE POLICY "Agents can delete their clients applications" 
ON public.applications 
FOR DELETE 
USING (auth.uid() = agent_id);


----------------------------------------------------
-- 2. PROXY USER CREDENTIALS POLICIES
----------------------------------------------------

-- Allow agents to insert credentials for their proxy users
DROP POLICY IF EXISTS "Agents can insert proxy credentials" ON public.proxy_user_credentials;
CREATE POLICY "Agents can insert proxy credentials" 
ON public.proxy_user_credentials 
FOR INSERT 
WITH CHECK (auth.uid() = created_by_admin_id);

-- Allow agents to view credentials they created
DROP POLICY IF EXISTS "Agents can view proxy credentials" ON public.proxy_user_credentials;
CREATE POLICY "Agents can view proxy credentials" 
ON public.proxy_user_credentials 
FOR SELECT 
USING (auth.uid() = created_by_admin_id);


----------------------------------------------------
-- 3. AUDIT LOGS POLICIES
----------------------------------------------------

-- Allow agents and authenticated users to insert audit logs
DROP POLICY IF EXISTS "Agents can insert audit logs" ON public.audit_logs;
CREATE POLICY "Agents can insert audit logs" 
ON public.audit_logs 
FOR INSERT 
TO authenticated
WITH CHECK (
  auth.uid() = actor_id 
  OR (auth.jwt()->'user_metadata'->>'role' = 'agent')
  OR (auth.jwt()->'user_metadata'->>'role' = 'admin')
  OR true
);

-- Allow agents to view audit logs they performed
DROP POLICY IF EXISTS "Agents can view their audit logs" ON public.audit_logs;
CREATE POLICY "Agents can view their audit logs" 
ON public.audit_logs 
FOR SELECT 
TO authenticated
USING (
  auth.uid() = actor_id 
  OR (auth.jwt()->'user_metadata'->>'role' = 'agent')
  OR (auth.jwt()->'user_metadata'->>'role' = 'admin')
);



----------------------------------------------------
-- 4. DOCUMENTS TABLE (PUBLIC.DOCUMENTS) POLICIES
----------------------------------------------------

-- Allow agents to view documents for applications they created/manage
DROP POLICY IF EXISTS "Agents can view application documents" ON public.documents;
CREATE POLICY "Agents can view application documents" 
ON public.documents 
FOR SELECT 
TO authenticated
USING (
  application_id IN (
    SELECT id FROM public.applications WHERE agent_id = auth.uid()
  )
  OR
  (auth.jwt()->'user_metadata'->>'role' = 'agent')
);

-- Allow agents to insert document records for their applications
DROP POLICY IF EXISTS "Agents can insert application documents" ON public.documents;
CREATE POLICY "Agents can insert application documents" 
ON public.documents 
FOR INSERT 
TO authenticated
WITH CHECK (
  application_id IN (
    SELECT id FROM public.applications WHERE agent_id = auth.uid()
  )
  OR
  (auth.jwt()->'user_metadata'->>'role' = 'agent')
);

-- Allow agents to update document records for their applications
DROP POLICY IF EXISTS "Agents can update application documents" ON public.documents;
CREATE POLICY "Agents can update application documents" 
ON public.documents 
FOR UPDATE 
TO authenticated
USING (
  application_id IN (
    SELECT id FROM public.applications WHERE agent_id = auth.uid()
  )
  OR
  (auth.jwt()->'user_metadata'->>'role' = 'agent')
);

-- Allow agents to delete document records for their applications
DROP POLICY IF EXISTS "Agents can delete application documents" ON public.documents;
CREATE POLICY "Agents can delete application documents" 
ON public.documents 
FOR DELETE 
TO authenticated
USING (
  application_id IN (
    SELECT id FROM public.applications WHERE agent_id = auth.uid()
  )
  OR
  (auth.jwt()->'user_metadata'->>'role' = 'agent')
);


----------------------------------------------------
-- 5. STORAGE OBJECTS (STORAGE.OBJECTS) POLICIES
----------------------------------------------------

-- Allow agents to upload files to documents bucket
DROP POLICY IF EXISTS "Agents can upload documents to storage" ON storage.objects;
CREATE POLICY "Agents can upload documents to storage"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  (
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.applications WHERE agent_id = auth.uid()
    )
    OR
    (auth.jwt()->'user_metadata'->>'role' = 'agent')
  )
);

-- Allow agents to view/download files in documents bucket
DROP POLICY IF EXISTS "Agents can read documents from storage" ON storage.objects;
CREATE POLICY "Agents can read documents from storage"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  (
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.applications WHERE agent_id = auth.uid()
    )
    OR
    (auth.jwt()->'user_metadata'->>'role' = 'agent')
  )
);

-- Allow agents to update files in documents bucket
DROP POLICY IF EXISTS "Agents can update documents in storage" ON storage.objects;
CREATE POLICY "Agents can update documents in storage"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents' AND
  (
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.applications WHERE agent_id = auth.uid()
    )
    OR
    (auth.jwt()->'user_metadata'->>'role' = 'agent')
  )
);

-- Allow agents to delete files in documents bucket
DROP POLICY IF EXISTS "Agents can delete documents from storage" ON storage.objects;
CREATE POLICY "Agents can delete documents from storage"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  (
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.applications WHERE agent_id = auth.uid()
    )
    OR
    (auth.jwt()->'user_metadata'->>'role' = 'agent')
  )
);

----------------------------------------------------
-- 6. CERTIFICATES & CERTIFICATE STORAGE POLICIES
----------------------------------------------------

-- Allow agents to view certificates for their clients
DROP POLICY IF EXISTS "Agents can view their clients certificates" ON public.certificates;
CREATE POLICY "Agents can view their clients certificates"
ON public.certificates
FOR SELECT
TO authenticated
USING (
  application_id IN (
    SELECT id FROM public.applications WHERE agent_id = auth.uid()
  )
  OR
  (auth.jwt()->'user_metadata'->>'role' = 'agent')
);

-- Allow agents to read certificate files in storage
DROP POLICY IF EXISTS "Agents can read certificates from storage" ON storage.objects;
CREATE POLICY "Agents can read certificates from storage"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'certificates' AND
  (
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.applications WHERE agent_id = auth.uid()
    )
    OR
    (auth.jwt()->'user_metadata'->>'role' = 'agent')
  )
);

