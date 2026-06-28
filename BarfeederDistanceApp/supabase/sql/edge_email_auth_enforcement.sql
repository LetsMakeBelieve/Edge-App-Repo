-- Run this in the Supabase SQL editor, then enable the hook in:
-- Authentication > Hooks > Before User Created.
--
-- The hook rejects new auth accounts unless the email matches:
--   first initial + last name @ edgetechnologies.com
-- Example:
--   mkaran@edgetechnologies.com -> M. Karan

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.edge_user_display_name(email text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT
    upper(substr(split_part(email, '@', 1), 1, 1)) ||
    '. ' ||
    initcap(substr(split_part(email, '@', 1), 2));
$$;

CREATE OR REPLACE FUNCTION private.is_edge_company_email(email text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(email, '') ~* '^[a-z][a-z]+@edgetechnologies\.com$';
$$;

CREATE OR REPLACE FUNCTION public.before_user_created_enforce_edge_email(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  user_email text := lower(event->'user'->>'email');
BEGIN
  IF NOT private.is_edge_company_email(user_email) THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Only edgetechnologies.com emails using first initial plus last name are allowed.'
      )
    );
  END IF;

  RETURN '{}'::jsonb;
END;
$$;

GRANT EXECUTE ON FUNCTION public.before_user_created_enforce_edge_email(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.before_user_created_enforce_edge_email(jsonb) FROM authenticated, anon, public;

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_edge_company_email(text) TO authenticated;

DROP INDEX IF EXISTS lathes_name_unique_ci;
DROP INDEX IF EXISTS bar_feeders_name_unique_ci;

CREATE UNIQUE INDEX IF NOT EXISTS lathes_manufacturer_name_unique_ci
ON lathes (lower(coalesce(manufacturer, '')), lower(name));

CREATE UNIQUE INDEX IF NOT EXISTS bar_feeders_manufacturer_name_unique_ci
ON bar_feeders (lower(coalesce(manufacturer, '')), lower(name));

-- Optional hardening: only signed-in Edge company users can read core equipment data.
-- These replace the earlier public read policies from the initial schema.

DROP POLICY IF EXISTS "Public read access for lathes" ON lathes;
DROP POLICY IF EXISTS "Public read access for bar_feeders" ON bar_feeders;
DROP POLICY IF EXISTS "Public read access for distances" ON distances;

DROP POLICY IF EXISTS "Edge users can read lathes" ON lathes;
DROP POLICY IF EXISTS "Edge users can read bar feeders" ON bar_feeders;
DROP POLICY IF EXISTS "Edge users can read distances" ON distances;
DROP POLICY IF EXISTS "Edge users can insert lathes" ON lathes;
DROP POLICY IF EXISTS "Edge users can insert bar feeders" ON bar_feeders;

CREATE POLICY "Edge users can read lathes"
ON lathes
FOR SELECT
TO authenticated
USING (private.is_edge_company_email(auth.jwt()->>'email'));

CREATE POLICY "Edge users can read bar feeders"
ON bar_feeders
FOR SELECT
TO authenticated
USING (private.is_edge_company_email(auth.jwt()->>'email'));

CREATE POLICY "Edge users can read distances"
ON distances
FOR SELECT
TO authenticated
USING (private.is_edge_company_email(auth.jwt()->>'email'));

CREATE POLICY "Edge users can insert lathes"
ON lathes
FOR INSERT
TO authenticated
WITH CHECK (private.is_edge_company_email(auth.jwt()->>'email'));

CREATE POLICY "Edge users can insert bar feeders"
ON bar_feeders
FOR INSERT
TO authenticated
WITH CHECK (private.is_edge_company_email(auth.jwt()->>'email'));

-- Optional hardening for user-generated rows.
DROP POLICY IF EXISTS "Users can view their own submissions" ON user_submissions;
DROP POLICY IF EXISTS "Users can view their own variations" ON variations;
DROP POLICY IF EXISTS "Users can insert their own submissions" ON user_submissions;
DROP POLICY IF EXISTS "Users can insert their own variations" ON variations;

CREATE POLICY "Edge users can view their own submissions"
ON user_submissions
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  AND private.is_edge_company_email(auth.jwt()->>'email')
);

CREATE POLICY "Edge users can view their own variations"
ON variations
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  AND private.is_edge_company_email(auth.jwt()->>'email')
);

CREATE POLICY "Edge users can insert their own submissions"
ON user_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND private.is_edge_company_email(auth.jwt()->>'email')
);

CREATE POLICY "Edge users can insert their own variations"
ON variations
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND private.is_edge_company_email(auth.jwt()->>'email')
);
