-- SQL Migration: Schema for Divorce Section
-- Run this in your Supabase SQL Editor

----------------------------------------------------
-- 1. DIVORCE APPLICATIONS TABLE
----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.divorce_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected')),
  progress INTEGER DEFAULT 100,
  marriage_application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  marriage_certificate_number TEXT,
  user_details JSONB,
  partner_form JSONB,
  user_address JSONB,
  user_current_address JSONB,
  partner_address JSONB,
  partner_current_address JSONB,
  divorce_date DATE,
  divorce_reason TEXT,
  divorce_type TEXT DEFAULT 'talaq',
  declarations JSONB,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  certificate_number TEXT,
  registration_date TEXT,
  registrar_name TEXT,
  certificate_details JSONB,
  admin_comment TEXT,
  created_by_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_proxy_application BOOLEAN DEFAULT TRUE,
  proxy_user_email TEXT,
  offline_applicant_contact JSONB,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  last_updated TIMESTAMPTZ DEFAULT now()
);

-- Index for searching and filtering
CREATE INDEX IF NOT EXISTS idx_divorce_apps_user_id ON public.divorce_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_divorce_apps_certificate_number ON public.divorce_applications(certificate_number);
CREATE INDEX IF NOT EXISTS idx_divorce_apps_status ON public.divorce_applications(status);
CREATE INDEX IF NOT EXISTS idx_divorce_apps_verified ON public.divorce_applications(verified);
CREATE INDEX IF NOT EXISTS idx_divorce_apps_created_at ON public.divorce_applications(created_at DESC);

----------------------------------------------------
-- 2. DIVORCE DOCUMENTS TABLE
----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.divorce_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  divorce_application_id UUID REFERENCES public.divorce_applications(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  file_path TEXT,
  status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
  size BIGINT DEFAULT 0,
  mime_type TEXT,
  belongs_to TEXT,
  is_reuploaded BOOLEAN DEFAULT FALSE,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_divorce_docs_app_id ON public.divorce_documents(divorce_application_id);

----------------------------------------------------
-- 3. DIVORCE CERTIFICATES TABLE
----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.divorce_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  divorce_application_id UUID REFERENCES public.divorce_applications(id) ON DELETE CASCADE,
  verification_id TEXT NOT NULL,
  name TEXT DEFAULT 'Divorce Registration Certificate',
  issued_on TIMESTAMPTZ DEFAULT now(),
  pdf_url TEXT,
  verified BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  certificate_number TEXT,
  registration_date TEXT,
  husband_name TEXT,
  wife_name TEXT,
  can_download BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_divorce_certs_user_id ON public.divorce_certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_divorce_certs_app_id ON public.divorce_certificates(divorce_application_id);
CREATE INDEX IF NOT EXISTS idx_divorce_certs_cert_num ON public.divorce_certificates(certificate_number);
CREATE INDEX IF NOT EXISTS idx_divorce_certs_verification_id ON public.divorce_certificates(verification_id);

----------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
----------------------------------------------------

ALTER TABLE public.divorce_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.divorce_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.divorce_certificates ENABLE ROW LEVEL SECURITY;

-- Helper condition check for admin users
-- Admin can do everything on all divorce tables
CREATE POLICY "Admins have full access to divorce_applications"
ON public.divorce_applications
FOR ALL
USING (
  auth.role() = 'authenticated' AND (
    (auth.jwt()->'user_metadata'->>'role') = 'admin' OR
    auth.email() LIKE '%admin%' OR
    auth.email() LIKE '%@mmrburwan.com'
  )
)
WITH CHECK (
  auth.role() = 'authenticated' AND (
    (auth.jwt()->'user_metadata'->>'role') = 'admin' OR
    auth.email() LIKE '%admin%' OR
    auth.email() LIKE '%@mmrburwan.com'
  )
);

CREATE POLICY "Admins have full access to divorce_documents"
ON public.divorce_documents
FOR ALL
USING (
  auth.role() = 'authenticated' AND (
    (auth.jwt()->'user_metadata'->>'role') = 'admin' OR
    auth.email() LIKE '%admin%' OR
    auth.email() LIKE '%@mmrburwan.com'
  )
)
WITH CHECK (
  auth.role() = 'authenticated' AND (
    (auth.jwt()->'user_metadata'->>'role') = 'admin' OR
    auth.email() LIKE '%admin%' OR
    auth.email() LIKE '%@mmrburwan.com'
  )
);

CREATE POLICY "Admins have full access to divorce_certificates"
ON public.divorce_certificates
FOR ALL
USING (
  auth.role() = 'authenticated' AND (
    (auth.jwt()->'user_metadata'->>'role') = 'admin' OR
    auth.email() LIKE '%admin%' OR
    auth.email() LIKE '%@mmrburwan.com'
  )
)
WITH CHECK (
  auth.role() = 'authenticated' AND (
    (auth.jwt()->'user_metadata'->>'role') = 'admin' OR
    auth.email() LIKE '%admin%' OR
    auth.email() LIKE '%@mmrburwan.com'
  )
);

-- Client / User read access to their own divorce data
CREATE POLICY "Users can view their own divorce applications"
ON public.divorce_applications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view documents of their own divorce applications"
ON public.divorce_documents
FOR SELECT
USING (
  divorce_application_id IN (
    SELECT id FROM public.divorce_applications WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can view their own divorce certificates"
ON public.divorce_certificates
FOR SELECT
USING (auth.uid() = user_id);

-- Public verification access for verified divorce certificates
CREATE POLICY "Public can view verified divorce applications for verification"
ON public.divorce_applications
FOR SELECT
USING (verified = true);

CREATE POLICY "Public can view verified divorce certificates"
ON public.divorce_certificates
FOR SELECT
USING (verified = true);



----------------------------------------------------
-- 4. NOTIFICATIONS COMPATIBILITY
----------------------------------------------------
ALTER TABLE IF EXISTS public.notifications 
  ADD COLUMN IF NOT EXISTS divorce_application_id UUID REFERENCES public.divorce_applications(id) ON DELETE CASCADE;
