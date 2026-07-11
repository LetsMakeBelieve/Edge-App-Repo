-- Allow authenticated app users to save first measurements into distances
-- and view shared measurement history for the selected install.
--
-- Run this in the Supabase SQL editor after the existing schema scripts.

DROP POLICY IF EXISTS "Authenticated users can insert distances" ON distances;
DROP POLICY IF EXISTS "Authenticated users can update distances" ON distances;
DROP POLICY IF EXISTS "Authenticated users can view measurement submissions" ON user_submissions;
DROP POLICY IF EXISTS "Authenticated users can view measurement variations" ON variations;

CREATE POLICY "Authenticated users can insert distances"
ON distances
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update distances"
ON distances
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view measurement submissions"
ON user_submissions
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view measurement variations"
ON variations
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
