-- SQL script to add RLS policies for agents
-- Run this in your Supabase SQL Editor

-- 1. Allow agents to insert applications on behalf of clients
CREATE POLICY "Agents can insert their clients applications" 
ON public.applications 
FOR INSERT 
WITH CHECK (auth.uid() = agent_id);

-- 2. Allow agents to view applications they created
CREATE POLICY "Agents can view their clients applications" 
ON public.applications 
FOR SELECT 
USING (auth.uid() = agent_id);

-- 3. Allow agents to update applications they created
CREATE POLICY "Agents can update their clients applications" 
ON public.applications 
FOR UPDATE 
USING (auth.uid() = agent_id);

-- 4. Allow agents to delete applications they created (if needed)
CREATE POLICY "Agents can delete their clients applications" 
ON public.applications 
FOR DELETE 
USING (auth.uid() = agent_id);

-- 5. Allow agents to insert credentials for their proxy users
CREATE POLICY "Agents can insert proxy credentials" 
ON public.proxy_user_credentials 
FOR INSERT 
WITH CHECK (auth.uid() = created_by_admin_id);

-- 6. Allow agents to view credentials they created
CREATE POLICY "Agents can view proxy credentials" 
ON public.proxy_user_credentials 
FOR SELECT 
USING (auth.uid() = created_by_admin_id);

-- 7. Allow agents to insert audit logs for their actions
CREATE POLICY "Agents can insert audit logs" 
ON public.audit_logs 
FOR INSERT 
WITH CHECK (auth.uid() = actor_id);
