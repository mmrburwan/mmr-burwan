-- SQL script to create RPC functions for agent management
-- Run this in your Supabase SQL Editor

-- Function to list all agents
CREATE OR REPLACE FUNCTION list_agents()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  agents json;
BEGIN
  SELECT json_agg(
    json_build_object(
      'id', id,
      'email', email,
      'name', raw_user_meta_data->>'name',
      'createdAt', created_at,
      'disabled', COALESCE((raw_user_meta_data->>'is_disabled')::boolean, false)
    )
  ) INTO agents
  FROM auth.users
  WHERE raw_user_meta_data->>'role' = 'agent';
  
  RETURN coalesce(agents, '[]');
END;
$$;

-- Function to promote a user to an agent
CREATE OR REPLACE FUNCTION promote_to_agent(target_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user auth.users;
BEGIN
  -- get the user
  SELECT * INTO target_user FROM auth.users WHERE email = target_email LIMIT 1;
  
  IF target_user IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- update metadata
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    '"agent"'
  )
  WHERE id = target_user.id;
  
  RETURN json_build_object(
    'id', target_user.id,
    'email', target_user.email,
    'name', target_user.raw_user_meta_data->>'name'
  );
END;
$$;

-- Function to toggle agent disabled status
CREATE OR REPLACE FUNCTION toggle_agent_status(target_user_id uuid, is_disabled boolean)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user auth.users;
BEGIN
  -- get the user
  SELECT * INTO target_user FROM auth.users WHERE id = target_user_id LIMIT 1;
  
  IF target_user IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- update metadata with is_disabled
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{is_disabled}',
    to_jsonb(is_disabled)
  )
  WHERE id = target_user.id;
  
  RETURN json_build_object(
    'id', target_user.id,
    'email', target_user.email,
    'disabled', is_disabled
  );
END;
$$;

