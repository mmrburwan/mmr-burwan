-- SQL script to add missing columns for agent applications
-- Run this in your Supabase SQL Editor

ALTER TABLE public.applications 
ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS agent_name TEXT,
ADD COLUMN IF NOT EXISTS is_agent_application BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS proxy_user_email TEXT,
ADD COLUMN IF NOT EXISTS offline_applicant_contact JSONB DEFAULT '{}'::jsonb;
